import type { RoomType } from "@quickreel/shared";
import type { StoryCandidateImage } from "./types.js";

/**
 * The cinematic property-journey template from the product spec: Hero
 * Exterior -> Entrance -> Living -> Kitchen -> Dining -> Master -> Bathrooms
 * -> Bedrooms -> Outdoor -> Drone -> Twilight. ("Hook" and "Logo" are not
 * photo room types — hook-engine resequences the opening after this
 * ordering runs, and "Logo" is a text-only end card added by the worker.)
 * Lower number = earlier in the reel. Room types sharing a number are
 * ordered by quality within that group.
 */
export const ROOM_TYPE_STORY_PRIORITY: Record<RoomType, number> = {
  EXTERIOR_FRONT: 0,
  EXTERIOR_GENERAL: 0,
  HALLWAY: 1,
  LIVING_ROOM: 2,
  KITCHEN: 3,
  DINING: 4,
  MASTER_BEDROOM: 5,
  BATHROOM: 6,
  ENSUITE: 6,
  BEDROOM: 7,
  OFFICE: 7.5,
  LAUNDRY: 7.8,
  OUTDOOR: 8,
  DECK: 8,
  POOL: 8.2,
  VIEWS: 8.5,
  EXTERIOR_REAR: 8.7,
  DRONE: 9,
  TWILIGHT: 10,
  NIGHT: 10,
  UNKNOWN: 11,
};

/**
 * Orders a deduped photo set into the cinematic property journey. Ties
 * within the same story beat (e.g. two bedrooms) are broken by quality,
 * best first — the AI still makes an intentional choice about which of
 * several similar rooms leads its group.
 */
export function orderStory(images: StoryCandidateImage[]): string[] {
  return [...images]
    .sort((a, b) => {
      const priorityDiff = ROOM_TYPE_STORY_PRIORITY[a.roomType] - ROOM_TYPE_STORY_PRIORITY[b.roomType];
      if (priorityDiff !== 0) return priorityDiff;
      return b.quality.overall - a.quality.overall;
    })
    .map((img) => img.imageId);
}
