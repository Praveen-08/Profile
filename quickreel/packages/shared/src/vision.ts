import { z } from "zod";
import { RoomTypeSchema } from "./enums.js";

/**
 * The seven photo quality signals from the product spec, each normalized to
 * 0..1. `overall` is the weighted composite story-engine ranks images by.
 * See packages/vision/README.md for exactly how each signal is computed by
 * the heuristic vs. OpenAI-Vision-backed adapter.
 */
export const PhotoQualityScoresSchema = z.object({
  sharpness: z.number().min(0).max(1),
  composition: z.number().min(0).max(1),
  brightness: z.number().min(0).max(1),
  leadingLines: z.number().min(0).max(1),
  visualImpact: z.number().min(0).max(1),
  luxuryAppeal: z.number().min(0).max(1),
  storyImportance: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
});
export type PhotoQualityScores = z.infer<typeof PhotoQualityScoresSchema>;

export const VisionAnalysisResultSchema = z.object({
  roomType: RoomTypeSchema,
  roomConfidence: z.number().min(0).max(1),
  quality: PhotoQualityScoresSchema,
  /** 64-bit perceptual hash (hex string) — the dedup similarity key. */
  perceptualHash: z.string(),
  /** true when the shot reads as outdoor/exterior (heuristic hue/brightness or vision-confirmed). */
  isOutdoor: z.boolean(),
  /** true when the shot reads as a twilight/night exterior. */
  isTwilight: z.boolean(),
  source: z.enum(["openai_vision", "heuristic"]),
});
export type VisionAnalysisResult = z.infer<typeof VisionAnalysisResultSchema>;
