import { z } from "zod";
import { WatermarkPositionSchema } from "./enums.js";

/**
 * A user's saved identity — logo, colors, fonts, outro, watermark, contact
 * details — folded into the EDL by apps/worker's resolve-edl.ts and
 * rendered by packages/video-engine as a persistent watermark overlay plus
 * an appended outro clip. All asset fields are storage keys (not URLs),
 * matching every other asset reference in the EDL (imageStorageKey,
 * depthMapStorageKey, ...): apps/worker resolves them to fetchable URLs at
 * render time via the storage adapter, keeping video-engine storage-agnostic.
 */
export const BrandKitConfigSchema = z.object({
  agencyName: z.string().nullable(),
  logoStorageKey: z.string().nullable(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
  fontFamily: z.string().nullable(),
  outroStorageKey: z.string().nullable(),
  watermarkStorageKey: z.string().nullable(),
  watermarkPosition: WatermarkPositionSchema,
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactWebsite: z.string().nullable(),
});
export type BrandKitConfig = z.infer<typeof BrandKitConfigSchema>;

/** Fixed length of the appended brand-kit outro clip, when a brand kit sets one. */
export const BRAND_OUTRO_DURATION_MS = 3000;

export const CURRENT_SCORE_VERSION = "score-v1";

/**
 * AI Reel Score — six deterministic, EDL-derived sub-scores plus an overall
 * composite and plain-language recommendations. Computed by
 * packages/scoring-engine from the resolved EDL, beat grid, and style —
 * **not** a trained viewer-behavior model. `viewerRetentionPrediction` in
 * particular is named to match the product spec but is a heuristic proxy
 * (pacing/hook-strength/variety), not a model fit on real watch-time data;
 * see that package's README for the honest gap, matching this repo's
 * pattern for packages/vision's heuristic fallback.
 */
export const ReelScoreSchema = z.object({
  scoreVersion: z.literal(CURRENT_SCORE_VERSION),
  storytellingScore: z.number().min(0).max(100),
  beatSyncScore: z.number().min(0).max(100),
  luxuryScore: z.number().min(0).max(100),
  motionQualityScore: z.number().min(0).max(100),
  viewerRetentionPrediction: z.number().min(0).max(100),
  socialMediaScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
});
export type ReelScore = z.infer<typeof ReelScoreSchema>;
