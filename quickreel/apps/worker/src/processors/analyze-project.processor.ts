import type { Job } from "bullmq";
import { prisma } from "@quickreel/database";
import { createStorageAdapterFromEnv } from "@quickreel/storage";
import { createVisionAdapter } from "@quickreel/vision";
import { buildStory, type StoryCandidateImage } from "@quickreel/story-engine";
import type { AnalyzeProjectJobPayload, AnalyzeProjectJobResult } from "@quickreel/shared";

const storage = createStorageAdapterFromEnv();
const vision = createVisionAdapter({
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_VISION_MODEL,
});

const ANALYSIS_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/**
 * Analyzes every photo in a project (room type, quality, perceptual hash),
 * then runs the full story-engine pipeline (dedup -> hero selection ->
 * cinematic ordering) over the results and persists everything back to
 * `project_images`. One job per project, not per image — dedup and story
 * ordering are inherently whole-set operations.
 */
export async function analyzeProjectProcessor(job: Job<AnalyzeProjectJobPayload>): Promise<AnalyzeProjectJobResult> {
  const { projectId } = job.data;

  const images = await prisma.projectImage.findMany({ where: { projectId } });
  if (images.length === 0) {
    throw new Error(`Project ${projectId} has no images to analyze`);
  }

  const analyzed = await mapWithConcurrency(images, ANALYSIS_CONCURRENCY, async (image) => {
    const buffer = await storage.getObjectBuffer(image.storageKey);
    const result = await vision.analyze(buffer);
    await prisma.projectImage.update({
      where: { id: image.id },
      data: {
        roomType: result.roomType,
        roomConfidence: result.roomConfidence,
        qualityScore: result.quality.overall,
        perceptualHash: result.perceptualHash,
        analysisJson: result as unknown as object,
      },
    });
    const candidate: StoryCandidateImage = {
      imageId: image.id,
      roomType: result.roomType,
      roomConfidence: result.roomConfidence,
      quality: result.quality,
      perceptualHash: result.perceptualHash,
    };
    return candidate;
  });

  const storyPlan = buildStory(analyzed);

  await Promise.all(
    storyPlan.duplicates
      .filter((d) => d.isDuplicate)
      .map((d) =>
        prisma.projectImage.update({
          where: { id: d.imageId },
          data: { isDuplicate: true, duplicateOfId: d.duplicateOfId },
        }),
      ),
  );

  await Promise.all(
    storyPlan.orderedImageIds.map((imageId, index) =>
      prisma.projectImage.update({
        where: { id: imageId },
        data: {
          orderIndex: index,
          isHero: imageId === storyPlan.hero.heroImageId,
          isSecondHero: imageId === storyPlan.hero.secondHeroImageId,
          heroScore: imageId === storyPlan.hero.heroImageId ? 1 : imageId === storyPlan.hero.secondHeroImageId ? 0.8 : null,
        },
      }),
    ),
  );

  await prisma.project.update({ where: { id: projectId }, data: { status: "READY" } });

  return {
    imageCount: images.length,
    duplicatesRemoved: storyPlan.duplicates.filter((d) => d.isDuplicate).length,
    heroImageId: storyPlan.hero.heroImageId,
  };
}
