import { Queue, Worker, type Processor } from "bullmq";
import {
  QUEUE_NAMES,
  type AnalyzeProjectJobPayload,
  type AnalyzeProjectJobResult,
  type ExportRenderJobPayload,
  type ExportRenderJobResult,
  type RenderVideoJobPayload,
  type RenderVideoJobResult,
} from "@quickreel/shared";
import { getRedisConnection } from "./connection.js";

/** One retry with backoff — analysis/render jobs are expensive; a tight retry loop would just burn compute on a persistent failure. */
const DEFAULT_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7 days
  removeOnFail: { age: 60 * 60 * 24 * 30 }, // 30 days, kept longer for debugging
};

export function createAnalysisQueue(): Queue<AnalyzeProjectJobPayload, AnalyzeProjectJobResult> {
  return new Queue(QUEUE_NAMES.ANALYSIS, {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

export function createRenderQueue(): Queue<RenderVideoJobPayload, RenderVideoJobResult> {
  return new Queue(QUEUE_NAMES.RENDER, {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

/** I/O-bound (vision API calls) — higher concurrency is safe. */
export function createAnalysisWorker(
  processor: Processor<AnalyzeProjectJobPayload, AnalyzeProjectJobResult>,
  concurrency = 5,
): Worker<AnalyzeProjectJobPayload, AnalyzeProjectJobResult> {
  return new Worker(QUEUE_NAMES.ANALYSIS, processor, { connection: getRedisConnection(), concurrency });
}

/** CPU/memory-bound (Chromium rendering) — keep concurrency low per process; scale via replicas instead. */
export function createRenderWorker(
  processor: Processor<RenderVideoJobPayload, RenderVideoJobResult>,
  concurrency = 1,
): Worker<RenderVideoJobPayload, RenderVideoJobResult> {
  return new Worker(QUEUE_NAMES.RENDER, processor, { connection: getRedisConnection(), concurrency });
}

export function createExportQueue(): Queue<ExportRenderJobPayload, ExportRenderJobResult> {
  return new Queue(QUEUE_NAMES.EXPORT, {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

/** Same CPU/memory profile as the primary render — a 4K export re-renders through Chromium at scale=2. */
export function createExportWorker(
  processor: Processor<ExportRenderJobPayload, ExportRenderJobResult>,
  concurrency = 1,
): Worker<ExportRenderJobPayload, ExportRenderJobResult> {
  return new Worker(QUEUE_NAMES.EXPORT, processor, { connection: getRedisConnection(), concurrency });
}
