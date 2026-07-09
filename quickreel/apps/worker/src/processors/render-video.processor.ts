import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Job } from "bullmq";
import { prisma } from "@quickreel/database";
import { createStorageAdapterFromEnv } from "@quickreel/storage";
import { getStyleBySlug } from "@quickreel/style-engine";
import { detectBeatGrid } from "@quickreel/beat-engine";
import { renderReel, type ChromiumGlBackend } from "@quickreel/video-engine";
import {
  BeatGridSchema,
  CURRENT_BEAT_ANALYSIS_VERSION,
  type CameraMoveType,
  type HookArchetype,
  type ReelLengthSec,
  type RenderVideoJobPayload,
  type RenderVideoJobResult,
} from "@quickreel/shared";
import { resolveEDL, type ResolveEdlImageInput } from "../lib/resolve-edl.js";

const storage = createStorageAdapterFromEnv();

async function markFailed(renderId: string, projectId: string, error: unknown): Promise<never> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.render.update({ where: { id: renderId }, data: { status: "FAILED", errorMessage: message } });
  await prisma.project.update({ where: { id: projectId }, data: { status: "FAILED" } });
  throw error instanceof Error ? error : new Error(message);
}

/**
 * Orchestrates the full AI Director Engine into an EDL and drives Remotion:
 * resolve style/music -> ensure a cached (or freshly analyzed) BeatGrid ->
 * resolveEDL() -> renderMedia() -> upload the MP4 -> mark complete.
 */
export async function renderVideoProcessor(job: Job<RenderVideoJobPayload>): Promise<RenderVideoJobResult> {
  const { projectId, renderId } = job.data;

  await prisma.render.update({ where: { id: renderId }, data: { status: "RESOLVING_EDL", startedAt: new Date() } });

  try {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        images: { where: { isDuplicate: false }, orderBy: { orderIndex: "asc" } },
        style: true,
        musicTrack: true,
      },
    });

    if (!project.style || !project.musicTrack || !project.reelLengthSec) {
      throw new Error("Project is missing a style, music track, or reel length");
    }

    const styleConfig = getStyleBySlug(project.style.slug);
    if (!styleConfig) throw new Error(`No style-engine config for slug "${project.style.slug}"`);

    const orderedImages: ResolveEdlImageInput[] = project.images
      .filter((img): img is typeof img & { roomType: NonNullable<typeof img.roomType> } => img.roomType !== null)
      .map((img) => ({
        imageId: img.id,
        storageKey: img.storageKey,
        roomType: img.roomType,
        qualityScore: img.qualityScore ?? 0.5,
        isHero: img.isHero,
        isSecondHero: img.isSecondHero,
        depthMapStorageKey: img.depthMapStorageKey,
        foregroundMaskStorageKey: img.foregroundMaskStorageKey,
        cameraMoveOverride: img.cameraMoveOverride as CameraMoveType | null,
      }));

    if (orderedImages.length === 0) {
      throw new Error("Project has no analyzed images — run analysis before rendering");
    }

    const beatGrid = await ensureBeatGrid(project.musicTrack);

    const edl = resolveEDL({
      projectId: project.id,
      renderId,
      reelLengthSec: project.reelLengthSec as ReelLengthSec,
      style: styleConfig,
      hookArchetypeOverride: (project.hookArchetype as HookArchetype | null) ?? null,
      orderedImages,
      beatGrid,
      musicTrackId: project.musicTrack.id,
      musicTrackStorageKey: project.musicTrack.storageKey,
      project: {
        title: project.title,
        address: project.address,
        bedCount: project.bedCount,
        bathCount: project.bathCount,
      },
    });

    await prisma.render.update({ where: { id: renderId }, data: { status: "RENDERING", edlJson: edl as unknown as object } });

    const imageUrls: Record<string, string> = {};
    for (const clip of edl.clips) {
      imageUrls[clip.imageStorageKey] = storage.getObjectUrl(clip.imageStorageKey);
      if (clip.depth) {
        imageUrls[clip.depth.depthMapStorageKey] = storage.getObjectUrl(clip.depth.depthMapStorageKey);
        imageUrls[clip.depth.foregroundMaskStorageKey] = storage.getObjectUrl(clip.depth.foregroundMaskStorageKey);
      }
    }
    const audioUrl = storage.getObjectUrl(edl.audio.trackStorageKey);

    const tmpDir = process.env.RENDER_OUTPUT_TMP_DIR ?? join(tmpdir(), "quickreel-renders");
    await mkdir(tmpDir, { recursive: true });
    const localOutputPath = join(tmpDir, `${renderId}.mp4`);

    await renderReel({
      edl,
      imageUrls,
      audioUrl,
      outputPath: localOutputPath,
      chromiumExecutablePath: process.env.REMOTION_CHROMIUM_EXECUTABLE_PATH,
      concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : undefined,
      glBackend: (process.env.RENDER_GL_BACKEND as ChromiumGlBackend | undefined) || undefined,
      onProgress: ({ renderedFrames, totalFrames }) => {
        job.updateProgress(totalFrames > 0 ? Math.round((renderedFrames / totalFrames) * 100) : 0).catch(() => undefined);
      },
    });

    await prisma.render.update({ where: { id: renderId }, data: { status: "UPLOADING" } });

    const outputBuffer = await readFile(localOutputPath);
    const outputStorageKey = `projects/${projectId}/renders/${renderId}.mp4`;
    await storage.putObject(outputStorageKey, outputBuffer, "video/mp4");
    await rm(localOutputPath, { force: true });

    const outputDurationSec = edl.totalDurationMs / 1000;
    await prisma.render.update({
      where: { id: renderId },
      data: { status: "COMPLETE", outputStorageKey, outputDurationSec, completedAt: new Date() },
    });
    await prisma.project.update({ where: { id: projectId }, data: { status: "COMPLETE" } });

    return { outputStorageKey, outputDurationSec };
  } catch (error) {
    return markFailed(renderId, projectId, error);
  }
}

async function ensureBeatGrid(musicTrack: {
  id: string;
  slug: string;
  storageKey: string;
  beatGridJson: unknown;
  beatGridVersion: string | null;
}) {
  if (musicTrack.beatGridJson && musicTrack.beatGridVersion === CURRENT_BEAT_ANALYSIS_VERSION) {
    return BeatGridSchema.parse(musicTrack.beatGridJson);
  }

  const audioUrl = storage.getObjectUrl(musicTrack.storageKey);
  const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
  const beatGrid = await detectBeatGrid({ audioUrl, trackSlug: musicTrack.slug }, aiServiceUrl);

  await prisma.musicTrack.update({
    where: { id: musicTrack.id },
    data: { beatGridJson: beatGrid as unknown as object, beatGridVersion: beatGrid.analysisVersion },
  });

  return beatGrid;
}
