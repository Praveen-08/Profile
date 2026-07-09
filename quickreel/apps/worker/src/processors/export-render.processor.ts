import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Job } from "bullmq";
import { prisma } from "@quickreel/database";
import { createStorageAdapterFromEnv } from "@quickreel/storage";
import { renderReel, type ChromiumGlBackend } from "@quickreel/video-engine";
import { EditDecisionListSchema, type ExportRenderJobPayload, type ExportRenderJobResult } from "@quickreel/shared";
import { buildImageUrls } from "../lib/build-image-urls.js";

const storage = createStorageAdapterFromEnv();

const RESOLUTION_SCALE: Record<"HD_1080P" | "UHD_4K", number> = {
  HD_1080P: 1,
  UHD_4K: 2,
};

async function markFailed(exportId: string, error: unknown): Promise<never> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.renderExport.update({ where: { id: exportId }, data: { status: "FAILED", errorMessage: message } });
  throw error instanceof Error ? error : new Error(message);
}

/**
 * A platform export re-renders the *same* EDL already stored on the parent
 * Render at a different resolution scale. HD_1080P exports never reach this
 * processor — apps/api's ExportsService resolves those instantly by
 * pointing at the existing master file, since the master already renders at
 * 1080x1920. Only UHD_4K (scale=2, 2160x3840) does real re-render work here.
 */
export async function exportRenderProcessor(job: Job<ExportRenderJobPayload>): Promise<ExportRenderJobResult> {
  const { exportId } = job.data;

  await prisma.renderExport.update({ where: { id: exportId }, data: { status: "PROCESSING" } });

  try {
    const exportRow = await prisma.renderExport.findUniqueOrThrow({
      where: { id: exportId },
      include: { render: true },
    });

    if (!exportRow.render.edlJson) {
      throw new Error("Parent render has no stored EDL to re-render from");
    }
    const edl = EditDecisionListSchema.parse(exportRow.render.edlJson);

    const imageUrls = buildImageUrls(edl, storage);
    const audioUrl = storage.getObjectUrl(edl.audio.trackStorageKey);

    const tmpDir = process.env.RENDER_OUTPUT_TMP_DIR ?? join(tmpdir(), "quickreel-renders");
    await mkdir(tmpDir, { recursive: true });
    const localOutputPath = join(tmpDir, `export-${exportId}.mp4`);

    await renderReel({
      edl,
      imageUrls,
      audioUrl,
      outputPath: localOutputPath,
      chromiumExecutablePath: process.env.REMOTION_CHROMIUM_EXECUTABLE_PATH,
      concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : undefined,
      glBackend: (process.env.RENDER_GL_BACKEND as ChromiumGlBackend | undefined) || undefined,
      resolutionScale: RESOLUTION_SCALE[exportRow.resolution as "HD_1080P" | "UHD_4K"],
    });

    const outputBuffer = await readFile(localOutputPath);
    const outputStorageKey = `projects/${exportRow.render.projectId}/exports/${exportId}.mp4`;
    await storage.putObject(outputStorageKey, outputBuffer, "video/mp4");
    await rm(localOutputPath, { force: true });

    await prisma.renderExport.update({
      where: { id: exportId },
      data: { status: "COMPLETE", outputStorageKey, completedAt: new Date() },
    });

    return { outputStorageKey };
  } catch (error) {
    return markFailed(exportId, error);
  }
}
