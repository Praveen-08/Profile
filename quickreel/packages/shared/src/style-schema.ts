import { z } from "zod";
import {
  CameraMoveTypeSchema,
  RoomTypeSchema,
  TextOverlayKindSchema,
  TransitionTypeSchema,
} from "./enums.js";

/**
 * Per-room-type weighted options for camera movement selection. Weights need
 * not sum to 1 — camera-engine normalizes at selection time. An empty/absent
 * room key falls back to the style's `defaultCameraMoves`.
 */
export const CameraMovementBiasSchema = z.record(
  RoomTypeSchema,
  z.array(z.object({ type: CameraMoveTypeSchema, weight: z.number().min(0).max(1) })),
);
export type CameraMovementBias = z.infer<typeof CameraMovementBiasSchema>;

export const TransitionSetEntrySchema = z.object({
  type: TransitionTypeSchema,
  weight: z.number().min(0).max(1),
  maxDurationMs: z.number().positive(),
});
export const TransitionSetSchema = z.array(TransitionSetEntrySchema);
export type TransitionSet = z.infer<typeof TransitionSetSchema>;

export const TypographyTreatmentSchema = z.object({
  fontFamily: z.string(),
  headlineWeight: z.number(),
  accentColor: z.string(),
  animationPreset: z.enum(["fadeUp", "typewriter", "slideIn", "maskWipe"]),
  overlayPositions: z.record(TextOverlayKindSchema, z.enum(["lowerThird", "center", "topBanner"])),
});
export type TypographyTreatment = z.infer<typeof TypographyTreatmentSchema>;

export const CutSpeedCurveSchema = z.object({
  /** Base clip length, expressed in beats (not ms) so it scales with BPM. */
  baseClipDurationBeats: z.number().positive(),
  heroClipDurationBeats: z.number().positive(),
  detailClipDurationBeats: z.number().positive(),
  /** Shorten clip durations after the music's drop for extra energy. */
  accelerateOnDrop: z.boolean(),
  accelerationFactor: z.number().min(0.3).max(1).default(0.75),
});
export type CutSpeedCurve = z.infer<typeof CutSpeedCurveSchema>;

export const MusicBehaviorRulesSchema = z.object({
  syncCutsToDownbeatOnly: z.boolean(),
  alignHeroRevealToDrop: z.boolean(),
  outroHoldOnLogoBeats: z.number().nonnegative(),
});
export type MusicBehaviorRules = z.infer<typeof MusicBehaviorRulesSchema>;

export const StyleConfigSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  /** Used when a room type has no explicit entry in cameraMovementBias. */
  defaultCameraMoves: z.array(z.object({ type: CameraMoveTypeSchema, weight: z.number().min(0).max(1) })),
  cameraMovementBias: CameraMovementBiasSchema,
  transitionSet: TransitionSetSchema,
  typography: TypographyTreatmentSchema,
  cutSpeedCurve: CutSpeedCurveSchema,
  musicBehavior: MusicBehaviorRulesSchema,
  /** Global multiplier applied to every camera move's intensity (0..1). */
  motionIntensity: z.number().min(0).max(1),
  /** Preferred hook archetypes for this style, in priority order. */
  preferredHookArchetypes: z.array(z.string()).min(1),
  /** "Luxury only" per product spec — packages/atmospheric-engine never selects an effect when false. */
  atmosphericEffectsEnabled: z.boolean(),
});
export type StyleConfig = z.infer<typeof StyleConfigSchema>;
