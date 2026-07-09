import { z } from "zod";

/**
 * Room/scene classification produced by packages/vision and consumed by
 * story-engine, camera-engine, and transition-engine. Kept as a flat enum
 * (not a taxonomy) because every downstream engine keys off it directly via
 * Record<RoomType, ...> lookup tables.
 */
export const RoomTypeSchema = z.enum([
  "EXTERIOR_FRONT",
  "EXTERIOR_REAR",
  "EXTERIOR_GENERAL",
  "DRONE",
  "LIVING_ROOM",
  "KITCHEN",
  "DINING",
  "MASTER_BEDROOM",
  "BEDROOM",
  "BATHROOM",
  "ENSUITE",
  "LAUNDRY",
  "HALLWAY",
  "OFFICE",
  "OUTDOOR",
  "POOL",
  "DECK",
  "VIEWS",
  "TWILIGHT",
  "NIGHT",
  "UNKNOWN",
]);
export type RoomType = z.infer<typeof RoomTypeSchema>;
export const ROOM_TYPES = RoomTypeSchema.options;

/** Human-readable labels for UI display. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  EXTERIOR_FRONT: "Front Elevation",
  EXTERIOR_REAR: "Rear Elevation",
  EXTERIOR_GENERAL: "Exterior",
  DRONE: "Drone",
  LIVING_ROOM: "Living Room",
  KITCHEN: "Kitchen",
  DINING: "Dining",
  MASTER_BEDROOM: "Master Bedroom",
  BEDROOM: "Bedroom",
  BATHROOM: "Bathroom",
  ENSUITE: "Ensuite",
  LAUNDRY: "Laundry",
  HALLWAY: "Hallway",
  OFFICE: "Office",
  OUTDOOR: "Outdoor",
  POOL: "Pool",
  DECK: "Deck",
  VIEWS: "Views",
  TWILIGHT: "Twilight",
  NIGHT: "Night",
  UNKNOWN: "Unclassified",
};

/**
 * 10 curated music vibe categories (packages/music-engine). Each vibe holds
 * N tracks; users pick a vibe, then optionally a specific track within it.
 */
export const MusicVibeSchema = z.enum([
  "LUXURY_PIANO",
  "EPIC_CINEMATIC",
  "MODERN_ELECTRONIC",
  "CORPORATE",
  "DEEP_HOUSE",
  "ACOUSTIC",
  "LIFESTYLE",
  "AMBIENT",
  "HIGH_ENERGY",
  "MOTIVATIONAL",
]);
export type MusicVibe = z.infer<typeof MusicVibeSchema>;
export const MUSIC_VIBES = MusicVibeSchema.options;

export const MUSIC_VIBE_LABELS: Record<MusicVibe, string> = {
  LUXURY_PIANO: "Luxury Piano",
  EPIC_CINEMATIC: "Epic Cinematic",
  MODERN_ELECTRONIC: "Modern Electronic",
  CORPORATE: "Corporate",
  DEEP_HOUSE: "Deep House",
  ACOUSTIC: "Acoustic",
  LIFESTYLE: "Lifestyle",
  AMBIENT: "Ambient",
  HIGH_ENERGY: "High Energy",
  MOTIVATIONAL: "Motivational",
};

/**
 * The full ~22-movement camera catalog (packages/camera-engine) — the
 * Cinematic Motion Engine's vocabulary. Every style references a subset of
 * these by weight per room type — never hardcoded per-style branching.
 * CRANE_RISE/CORNER_REVEAL/MICRO_CAMERA_DRIFT/DRONE_RISE/DRONE_DESCEND/
 * DRONE_ORBIT were added, and the single DRONE_SIMULATION was split into
 * the three DRONE_* variants, in the Cinematic Motion Engine pass — no
 * production renders existed yet, so this was a clean rename rather than a
 * migration.
 */
export const CameraMoveTypeSchema = z.enum([
  "SLOW_PUSH",
  "SLOW_PULL",
  "PAN_LEFT",
  "PAN_RIGHT",
  "TRUCK_LEFT",
  "TRUCK_RIGHT",
  "PEDESTAL_UP",
  "PEDESTAL_DOWN",
  "ARC",
  "ORBIT",
  "PARALLAX",
  "FOREGROUND_REVEAL",
  "DEPTH_PUSH",
  "PERSPECTIVE_SHIFT",
  "TILT",
  "HERO_PUSH",
  "REVEAL",
  "CRANE_RISE",
  "CORNER_REVEAL",
  "MICRO_CAMERA_DRIFT",
  "DRONE_RISE",
  "DRONE_DESCEND",
  "DRONE_ORBIT",
]);
export type CameraMoveType = z.infer<typeof CameraMoveTypeSchema>;
export const CAMERA_MOVE_TYPES = CameraMoveTypeSchema.options;

/**
 * The 16-transition palette (packages/transition-engine). Kept intentionally
 * small and elegant per product spec — "avoid cheesy effects, movie
 * quality only." MOTION_MATCH/PERSPECTIVE_MATCH/REFLECTION_WIPE/
 * GLASS_TRANSITION were added in the Cinematic Motion Engine pass.
 */
export const TransitionTypeSchema = z.enum([
  "LUXURY_FADE",
  "FILM_DISSOLVE",
  "LIGHT_LEAK",
  "LENS_FLARE",
  "WHIP",
  "MOTION_BLUR",
  "PUSH",
  "SLIDE",
  "PARALLAX_TRANSITION",
  "WHITE_FLASH",
  "BLUR",
  "CAMERA_MATCH",
  "MOTION_MATCH",
  "PERSPECTIVE_MATCH",
  "REFLECTION_WIPE",
  "GLASS_TRANSITION",
]);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;
export const TRANSITION_TYPES = TransitionTypeSchema.options;

/**
 * Extremely subtle, style-gated ("luxury only") procedural overlay effects
 * — packages/atmospheric-engine picks at most one per clip, never more.
 * Purely CSS/canvas overlays composited above the untouched source photo;
 * they never alter the photograph itself.
 */
export const AtmosphericEffectTypeSchema = z.enum([
  "CLOUD_DRIFT",
  "LENS_FLARE",
  "SOFT_SUN_RAYS",
  "REFLECTION_SHIMMER",
  "DUST_HAZE",
  "WINDOW_GLOW",
  "EXTERIOR_LIGHT_FADE",
]);
export type AtmosphericEffectType = z.infer<typeof AtmosphericEffectTypeSchema>;
export const ATMOSPHERIC_EFFECT_TYPES = AtmosphericEffectTypeSchema.options;

export const ReelLengthSecSchema = z.union([z.literal(10), z.literal(15), z.literal(20)]);
export type ReelLengthSec = z.infer<typeof ReelLengthSecSchema>;
export const REEL_LENGTH_OPTIONS: ReelLengthSec[] = [10, 15, 20];

/** Maximum image count per reel length — enforced by packages/timing-engine. */
export const MAX_IMAGES_BY_REEL_LENGTH: Record<ReelLengthSec, number> = {
  10: 10,
  15: 15,
  20: 20,
};

export const TextOverlayKindSchema = z.enum([
  "JUST_LISTED",
  "NEW_TO_MARKET",
  "LUXURY_LIVING",
  "BED_COUNT",
  "BATH_COUNT",
  "AUCTION",
  "OPEN_HOME",
  "ADDRESS",
  "LOGO",
  "CTA",
]);
export type TextOverlayKind = z.infer<typeof TextOverlayKindSchema>;

export const ProjectStatusSchema = z.enum([
  "DRAFT",
  "UPLOADING",
  "ANALYZING",
  "READY",
  "QUEUED",
  "RENDERING",
  "COMPLETE",
  "FAILED",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const RenderStatusSchema = z.enum([
  "QUEUED",
  "RESOLVING_EDL",
  "RENDERING",
  "MUXING",
  "UPLOADING",
  "COMPLETE",
  "FAILED",
]);
export type RenderStatus = z.infer<typeof RenderStatusSchema>;

/**
 * The five hook-opening archetypes generated by packages/hook-engine.
 * See packages/hook-engine/README.md for the selection heuristics.
 */
export const HookArchetypeSchema = z.enum([
  "BEST_EXTERIOR_QUICK_ZOOM",
  "DRONE_FIRST",
  "TWILIGHT_REVEAL",
  "LUXURY_INTERIOR_FIRST",
  "FAST_MONTAGE",
]);
export type HookArchetype = z.infer<typeof HookArchetypeSchema>;
