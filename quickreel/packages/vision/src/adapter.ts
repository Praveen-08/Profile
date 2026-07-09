import type { VisionAnalysisResult } from "@quickreel/shared";
import { classifyRoomHeuristic } from "./classifiers/heuristic.js";
import { classifyRoomOpenAI } from "./classifiers/openai.js";
import { computePerceptualHash } from "./hash.js";
import { computeQualityMetrics } from "./quality.js";
import { storyImportanceFor } from "./room-type-importance.js";

export interface VisionAdapterConfig {
  /** When absent/empty, the adapter runs entirely on the heuristic fallback. */
  openaiApiKey?: string;
  openaiModel?: string;
  fetchImpl?: typeof fetch;
}

export interface VisionAdapter {
  analyze(imageBuffer: Buffer): Promise<VisionAnalysisResult>;
}

/**
 * Composes the always-available signal-processing metrics (sharpness,
 * brightness, composition, leading lines, visual impact, perceptual hash —
 * all real `sharp`-computed values, see quality.ts/hash.ts) with room
 * classification, which comes from OpenAI Vision when a key is configured
 * and falls back to the heuristic sky/exposure classifier otherwise.
 * luxuryAppeal is likewise upgraded to the model's own judgment when
 * available.
 */
export function createVisionAdapter(config: VisionAdapterConfig): VisionAdapter {
  const useOpenAi = Boolean(config.openaiApiKey);

  return {
    async analyze(imageBuffer: Buffer): Promise<VisionAnalysisResult> {
      const [quality, perceptualHash] = await Promise.all([
        computeQualityMetrics(imageBuffer),
        computePerceptualHash(imageBuffer),
      ]);

      const classification = useOpenAi
        ? await classifyRoomOpenAI(imageBuffer, {
            apiKey: config.openaiApiKey!,
            model: config.openaiModel ?? "gpt-4o-mini",
            fetchImpl: config.fetchImpl,
          }).then((r) => ({ ...r, source: "openai_vision" as const }))
        : await classifyRoomHeuristic(imageBuffer).then((r) => ({
            ...r,
            luxuryAppeal: quality.luxuryAppeal,
            source: "heuristic" as const,
          }));

      const overall = clampedWeightedAverage(quality);

      return {
        roomType: classification.roomType,
        roomConfidence: classification.confidence,
        quality: {
          sharpness: quality.sharpness,
          composition: quality.composition,
          brightness: quality.brightness,
          leadingLines: quality.leadingLines,
          visualImpact: quality.visualImpact,
          luxuryAppeal: classification.luxuryAppeal,
          storyImportance: storyImportanceFor(classification.roomType),
          overall,
        },
        perceptualHash,
        isOutdoor: classification.isOutdoor,
        isTwilight: classification.isTwilight,
        source: classification.source,
      };
    },
  };
}

function clampedWeightedAverage(quality: {
  sharpness: number;
  composition: number;
  brightness: number;
  leadingLines: number;
  visualImpact: number;
  luxuryAppeal: number;
}): number {
  const weights = {
    sharpness: 0.25,
    composition: 0.15,
    brightness: 0.1,
    leadingLines: 0.1,
    visualImpact: 0.2,
    luxuryAppeal: 0.2,
  };
  return (
    quality.sharpness * weights.sharpness +
    quality.composition * weights.composition +
    quality.brightness * weights.brightness +
    quality.leadingLines * weights.leadingLines +
    quality.visualImpact * weights.visualImpact +
    quality.luxuryAppeal * weights.luxuryAppeal
  );
}
