import { z } from "zod";
import { BeatGridSchema } from "./beat-grid.js";
import { EasingCurveSchema } from "./easing.js";
import {
  AtmosphericEffectTypeSchema,
  CameraMoveTypeSchema,
  RoomTypeSchema,
  TextOverlayKindSchema,
  TransitionTypeSchema,
} from "./enums.js";
import { BrandKitConfigSchema } from "./premium.js";

export const CURRENT_EDL_VERSION = "edl-v3";

export const CameraMoveSchema = z.object({
  type: CameraMoveTypeSchema,
  startScale: z.number().min(1).max(3),
  endScale: z.number().min(1).max(3),
  startFocalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  endFocalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  easing: EasingCurveSchema,
  /** 0..1 style-driven multiplier applied to the movement's base amplitude. */
  intensity: z.number().min(0).max(1),
});
export type CameraMove = z.infer<typeof CameraMoveSchema>;

export const TransitionSpecSchema = z.object({
  type: TransitionTypeSchema,
  durationMs: z.number().positive(),
  easing: EasingCurveSchema,
});
export type TransitionSpec = z.infer<typeof TransitionSpecSchema>;

/**
 * Cached, per-image monocular depth output (packages/vision +
 * apps/ai-service) — a depth map plus a smoothed foreground matte derived
 * from it. Present only when depth estimation succeeded for this image;
 * video-engine falls back to single-layer camera motion when absent.
 */
export const DepthLayersSchema = z.object({
  depthMapStorageKey: z.string(),
  foregroundMaskStorageKey: z.string(),
});
export type DepthLayers = z.infer<typeof DepthLayersSchema>;

export const AtmosphericEffectSchema = z.object({
  type: AtmosphericEffectTypeSchema,
  /** 0..1, deliberately capped low upstream — "extremely subtle, never overuse." */
  intensity: z.number().min(0).max(1),
});
export type AtmosphericEffect = z.infer<typeof AtmosphericEffectSchema>;

export const TextOverlaySchema = z.object({
  id: z.string(),
  kind: TextOverlayKindSchema,
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  animationIn: z.enum(["fadeUp", "typewriter", "slideIn", "maskWipe"]),
  animationOut: z.enum(["fadeDown", "fadeOut", "slideOut"]),
  position: z.enum(["lowerThird", "center", "topBanner"]),
  styleTokens: z.object({
    fontFamily: z.string(),
    fontWeight: z.number(),
    color: z.string(),
    sizePx: z.number(),
  }),
});
export type TextOverlay = z.infer<typeof TextOverlaySchema>;

export const EDLClipSchema = z.object({
  clipIndex: z.number().int().nonnegative(),
  imageId: z.string(),
  imageStorageKey: z.string(),
  roomType: RoomTypeSchema,
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  durationMs: z.number().positive(),
  beatIndexStart: z.number().int(),
  beatIndexEnd: z.number().int(),
  camera: CameraMoveSchema,
  transitionIn: TransitionSpecSchema,
  transitionOut: TransitionSpecSchema,
  textOverlays: z.array(TextOverlaySchema),
  /** Null when depth estimation didn't run or failed for this image — video-engine renders single-layer motion in that case. */
  depth: DepthLayersSchema.nullable(),
  atmosphericEffect: AtmosphericEffectSchema.nullable(),
});
export type EDLClip = z.infer<typeof EDLClipSchema>;

/**
 * The single contract everything in the AI Director Engine converges on.
 * story-engine + camera-engine + transition-engine + hook-engine +
 * timing-engine + music-engine + beat-engine each contribute a slice; the
 * worker's render-video processor assembles and Zod-validates the whole
 * thing before it is ever handed to Remotion. Persisted verbatim to
 * renders.edlJson for reproducibility and debugging.
 */
export const EditDecisionListSchema = z.object({
  version: z.literal(CURRENT_EDL_VERSION),
  projectId: z.string(),
  renderId: z.string(),
  compositionWidth: z.literal(1080),
  compositionHeight: z.literal(1920),
  fps: z.literal(30),
  totalDurationMs: z.number().positive(),
  styleSlug: z.string(),
  hookArchetype: z.string(),
  musicTrackId: z.string(),
  beatGrid: BeatGridSchema,
  clips: z.array(EDLClipSchema).min(1),
  audio: z.object({
    trackStorageKey: z.string(),
    startOffsetMs: z.number().nonnegative(),
    volumeCurve: z
      .array(z.object({ tMs: z.number().nonnegative(), gain: z.number().min(0).max(1) }))
      .optional(),
  }),
  /** Null when the version has no brand kit assigned — video-engine renders no watermark/outro in that case. */
  brandKit: BrandKitConfigSchema.nullable(),
});
export type EditDecisionList = z.infer<typeof EditDecisionListSchema>;

export function parseEDL(data: unknown): EditDecisionList {
  return EditDecisionListSchema.parse(data);
}
