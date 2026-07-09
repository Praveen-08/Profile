import { createAnalysisWorker, createExportWorker, createRenderWorker } from "@quickreel/queue";
import { analyzeProjectProcessor } from "./processors/analyze-project.processor.js";
import { renderVideoProcessor } from "./processors/render-video.processor.js";
import { exportRenderProcessor } from "./processors/export-render.processor.js";

const analysisWorker = createAnalysisWorker(analyzeProjectProcessor, 4);
const renderWorker = createRenderWorker(renderVideoProcessor, 1);
const exportWorker = createExportWorker(exportRenderProcessor, 1);

for (const [name, worker] of [
  ["analysis", analysisWorker],
  ["render", renderWorker],
  ["export", exportWorker],
] as const) {
  worker.on("completed", (job) => console.log(`[${name}] job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[${name}] job ${job?.id} failed:`, err.message));
}

console.log("QuickReel worker started — listening on analysis-queue, render-queue, and export-queue.");

async function shutdown() {
  console.log("Shutting down worker...");
  await Promise.all([analysisWorker.close(), renderWorker.close(), exportWorker.close()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
