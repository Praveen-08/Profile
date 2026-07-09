import type { Job } from "bullmq";
import { prisma } from "@quickreel/database";
import { createStorageAdapterFromEnv } from "@quickreel/storage";
import { createVisionAdapter, generateForegroundMask, requestDepthMap } from "@quickreel/vision";
import { buildStory, type StoryCandidateImage } from "@quickreel/story-engine";
import type { AnalyzeProjectJobPayload, AnalyzeProjectJobResult } from "@quickreel/shared";

const storage = createStorageAdapterFromEnv();
const vision = createVisionAdapter({
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_VISION_MODEL,
});

const ANALYSIS_CONCURRENCY = 4;
/** Depth inference is CPU/memory-heavier than the sharp-based vision metrics — lower concurrency. */
const DEPTH_CONCURRENCY = 2;

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

  // Depth estimation only for images that survived dedup — no point spending ML inference on
  // shots that won't appear in the final reel. Failures here are non-fatal: video-engine falls
  // back to single-layer camera motion for any clip without depth data.
  const survivingImages = images.filter((img) => storyPlan.orderedImageIds.includes(img.id));
  await mapWithConcurrency(survivingImages, DEPTH_CONCURRENCY, async (image) => {
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
      const imageUrl = storage.getObjectUrl(image.storageKey);
      const depthPng = await requestDepthMap(imageUrl, aiServiceUrl);
      const maskPng = await generateForegroundMask(depthPng);

      const depthMapStorageKey = `projects/${projectId}/images/${image.id}-depth.png`;
      const foregroundMaskStorageKey = `projects/${projectId}/images/${image.id}-fgmask.png`;
      await storage.putObject(depthMapStorageKey, depthPng, "image/png");
      await storage.putObject(foregroundMaskStorageKey, maskPng, "image/png");

      await prisma.projectImage.update({
        where: { id: image.id },
        data: { depthMapStorageKey, foregroundMaskStorageKey },
      });
    } catch (err) {
      console.warn(`Depth estimation failed for image ${image.id}, continuing without parallax layers:`, err);
    }
  });

  await prisma.project.update({ where: { id: projectId }, data: { status: "READY" } });

  return {
    imageCount: images.length,
    duplicatesRemoved: storyPlan.duplicates.filter((d) => d.isDuplicate).length,
    heroImageId: storyPlan.hero.heroImageId,
  };
}
