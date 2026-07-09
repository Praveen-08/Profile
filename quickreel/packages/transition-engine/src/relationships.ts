import type { RoomType, TransitionType } from "@quickreel/shared";

/** The end-card position after the last photo clip — not a real RoomType. */
export const LOGO_POSITION = "LOGO" as const;
export type StoryPosition = RoomType | typeof LOGO_POSITION;

type RelationshipKey = `${RoomType}->${StoryPosition}`;

function key(from: RoomType, to: StoryPosition): RelationshipKey {
  return `${from}->${to}`;
}

/**
 * Curated room-to-room transition pairings — spatially/emotionally
 * intentional cuts called out explicitly in the product spec (e.g. an
 * open-plan kitchen-to-dining cut should feel continuous, not abrupt).
 * Pairs not listed here fall back to a weighted-random pick from the
 * active style's transition set (see select.ts) — this table is a set of
 * overrides, not an exhaustive matrix.
 */
export const ROOM_RELATIONSHIP_RULES: Partial<Record<RelationshipKey, TransitionType>> = {
  [key("KITCHEN", "DINING")]: "CAMERA_MATCH",
  [key("DINING", "KITCHEN")]: "CAMERA_MATCH",
  [key("LIVING_ROOM", "KITCHEN")]: "CAMERA_MATCH",
  [key("EXTERIOR_FRONT", "LIVING_ROOM")]: "PUSH",
  [key("EXTERIOR_GENERAL", "LIVING_ROOM")]: "PUSH",
  [key("DRONE", "EXTERIOR_FRONT")]: "MOTION_BLUR",
  [key("DRONE", "EXTERIOR_GENERAL")]: "MOTION_BLUR",
  [key("EXTERIOR_GENERAL", "DRONE")]: "LIGHT_LEAK",
  [key("MASTER_BEDROOM", "ENSUITE")]: "CAMERA_MATCH",
  [key("BEDROOM", "BATHROOM")]: "SLIDE",
  [key("OUTDOOR", "POOL")]: "PARALLAX_TRANSITION",
  [key("POOL", "DECK")]: "PARALLAX_TRANSITION",
  [key("VIEWS", "TWILIGHT")]: "LUXURY_FADE",
  [key("TWILIGHT", "LOGO")]: "LUXURY_FADE",
  [key("NIGHT", "LOGO")]: "LUXURY_FADE",
  [key("EXTERIOR_GENERAL", "LOGO")]: "LUXURY_FADE",
  [key("EXTERIOR_FRONT", "LOGO")]: "LUXURY_FADE",
};

export function lookupRelationshipRule(from: RoomType, to: StoryPosition): TransitionType | undefined {
  return ROOM_RELATIONSHIP_RULES[key(from, to)];
}
