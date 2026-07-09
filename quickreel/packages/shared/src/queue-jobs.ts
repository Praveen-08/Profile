export const QUEUE_NAMES = {
  ANALYSIS: "analysis-queue",
  RENDER: "render-queue",
} as const;

export interface AnalyzeProjectJobPayload {
  projectId: string;
}

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
