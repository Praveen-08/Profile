import type { AtmosphericEffectType, RoomType } from "@quickreel/shared";

/**
 * Which atmospheric effects make sense for which room type. Content-aware
 * placement (e.g. actually detecting tree canopies for "breeze in trees")
 * is out of scope — this is a deliberate, documented simplification: the
 * effect set for a room type is generic rather than positioned against
 * real image content. Utility rooms (bathroom, ensuite, laundry, hallway,
 * office) and plain bedrooms intentionally have no entry — they never get
 * an atmospheric effect, keeping the feature restrained to spaces where it
 * reads as intentional rather than decorative noise.
 */
export const ROOM_EFFECT_OPTIONS: Partial<Record<RoomType, AtmosphericEffectType[]>> = {
  EXTERIOR_FRONT: ["CLOUD_DRIFT", "SOFT_SUN_RAYS", "LENS_FLARE"],
  EXTERIOR_GENERAL: ["CLOUD_DRIFT", "SOFT_SUN_RAYS"],
  EXTERIOR_REAR: ["CLOUD_DRIFT"],
  DRONE: ["CLOUD_DRIFT", "SOFT_SUN_RAYS"],
  VIEWS: ["CLOUD_DRIFT", "SOFT_SUN_RAYS"],
  OUTDOOR: ["CLOUD_DRIFT", "DUST_HAZE"],
  POOL: ["REFLECTION_SHIMMER"],
  DECK: ["SOFT_SUN_RAYS", "DUST_HAZE"],
  TWILIGHT: ["EXTERIOR_LIGHT_FADE", "LENS_FLARE", "WINDOW_GLOW"],
  NIGHT: ["WINDOW_GLOW", "EXTERIOR_LIGHT_FADE"],
  LIVING_ROOM: ["WINDOW_GLOW", "DUST_HAZE"],
  KITCHEN: ["WINDOW_GLOW"],
  DINING: ["WINDOW_GLOW"],
  MASTER_BEDROOM: ["DUST_HAZE", "WINDOW_GLOW"],
};
