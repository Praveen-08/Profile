import type { RoomType } from "@quickreel/shared";

/**
 * How central a room type is to a listing's story, independent of any one
 * photo's quality — hero exteriors and living spaces carry a listing;
 * laundries and hallways support it. Mirrors (inversely) story-engine's
 * ROOM_TYPE_STORY_PRIORITY ordering, kept as a separate table here since
 * vision computes this per-image at analysis time, before story-engine
 * ever runs.
 */
const STORY_IMPORTANCE_WEIGHT: Record<RoomType, number> = {
  EXTERIOR_FRONT: 1.0,
  TWILIGHT: 0.95,
  EXTERIOR_GENERAL: 0.9,
  DRONE: 0.85,
  LIVING_ROOM: 0.85,
  KITCHEN: 0.8,
  MASTER_BEDROOM: 0.75,
  VIEWS: 0.7,
  POOL: 0.68,
  DINING: 0.65,
  EXTERIOR_REAR: 0.6,
  DECK: 0.58,
  OUTDOOR: 0.55,
  NIGHT: 0.55,
  BEDROOM: 0.5,
  BATHROOM: 0.45,
  OFFICE: 0.4,
  ENSUITE: 0.4,
  HALLWAY: 0.3,
  LAUNDRY: 0.2,
  UNKNOWN: 0.25,
};

export function storyImportanceFor(roomType: RoomType): number {
  return STORY_IMPORTANCE_WEIGHT[roomType];
}
