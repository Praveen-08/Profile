export const QUEUE_NAMES = {
  ANALYSIS: "analysis-queue",
  RENDER: "render-queue",
  EXPORT: "export-queue",
} as const;

export interface AnalyzeProjectJobPayload {
  projectId: string;
}

/**
 * versionId is not carried here — Render.versionId is the source of truth
 * once the render row exists, so the processor looks it up from the DB
 * rather than trusting a second copy of it in the job payload.
 */
export interface RenderVideoJobPayload {
  projectId: string;
  renderId: string;
}

export type AnalyzeProjectJobResult = {
  imageCount: number;
  duplicatesRemoved: number;
  heroImageId: string | null;
};

export type RenderVideoJobResult = {
  outputStorageKey: string;
  outputDurationSec: number;
};

export interface ExportRenderJobPayload {
  exportId: string;
}

export type ExportRenderJobResult = {
  outputStorageKey: string;
};
