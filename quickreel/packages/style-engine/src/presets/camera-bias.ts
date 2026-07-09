import type { CameraMovementBias } from "@quickreel/shared";

/**
 * Four "camera personalities" every style's `cameraMovementBias` is built
 * from. Room types not listed explicitly fall back to the style's
 * `defaultCameraMoves` — the schema's designed fallback for less-common
 * rooms (hallway, office, laundry, deck, views, night).
 *
 * Room behavior follows the Cinematic Motion Engine spec: exterior gets a
 * large hero push, living rooms a soft forward move, kitchens read as a
 * diagonal slide (PERSPECTIVE_SHIFT), bathrooms an elegant tilt, bedrooms a
 * slow pull, pools emphasize the water surface (PARALLAX/PEDESTAL_DOWN,
 * paired with the atmospheric ReflectionShimmer effect), decks get a
 * reveal move (REVEAL/CORNER_REVEAL), drone shots get a large cinematic
 * move (DRONE_RISE/DRONE_ORBIT), and twilight gets a slow dramatic push.
 */
export const CALM_CAMERA_BIAS: CameraMovementBias = {
  EXTERIOR_FRONT: [{ type: "HERO_PUSH", weight: 0.7 }, { type: "CRANE_RISE", weight: 0.3 }],
  EXTERIOR_GENERAL: [{ type: "HERO_PUSH", weight: 0.6 }, { type: "SLOW_PUSH", weight: 0.4 }],
  EXTERIOR_REAR: [{ type: "SLOW_PUSH", weight: 0.6 }, { type: "CRANE_RISE", weight: 0.4 }],
  DRONE: [{ type: "DRONE_RISE", weight: 0.5 }, { type: "DRONE_ORBIT", weight: 0.3 }, { type: "DRONE_DESCEND", weight: 0.2 }],
  LIVING_ROOM: [{ type: "SLOW_PUSH", weight: 0.5 }, { type: "PARALLAX", weight: 0.5 }],
  KITCHEN: [{ type: "PERSPECTIVE_SHIFT", weight: 0.6 }, { type: "PARALLAX", weight: 0.4 }],
  DINING: [{ type: "SLOW_PUSH", weight: 0.6 }, { type: "ARC", weight: 0.4 }],
  MASTER_BEDROOM: [{ type: "SLOW_PULL", weight: 0.6 }, { type: "REVEAL", weight: 0.4 }],
  BEDROOM: [{ type: "SLOW_PULL", weight: 0.7 }, { type: "SLOW_PUSH", weight: 0.3 }],
  BATHROOM: [{ type: "TILT", weight: 0.8 }, { type: "PEDESTAL_DOWN", weight: 0.2 }],
  ENSUITE: [{ type: "TILT", weight: 0.7 }, { type: "PEDESTAL_DOWN", weight: 0.3 }],
  OUTDOOR: [{ type: "PEDESTAL_UP", weight: 0.5 }, { type: "SLOW_PUSH", weight: 0.5 }],
  POOL: [{ type: "PARALLAX", weight: 0.5 }, { type: "PEDESTAL_DOWN", weight: 0.3 }, { type: "CRANE_RISE", weight: 0.2 }],
  DECK: [{ type: "REVEAL", weight: 0.5 }, { type: "CORNER_REVEAL", weight: 0.5 }],
  TWILIGHT: [{ type: "REVEAL", weight: 0.5 }, { type: "HERO_PUSH", weight: 0.5 }],
};

export const DYNAMIC_CAMERA_BIAS: CameraMovementBias = {
  EXTERIOR_FRONT: [{ type: "HERO_PUSH", weight: 0.5 }, { type: "TRUCK_RIGHT", weight: 0.5 }],
  EXTERIOR_GENERAL: [{ type: "TRUCK_LEFT", weight: 0.5 }, { type: "ARC", weight: 0.5 }],
  EXTERIOR_REAR: [{ type: "TRUCK_RIGHT", weight: 0.5 }, { type: "PAN_LEFT", weight: 0.5 }],
  DRONE: [{ type: "DRONE_ORBIT", weight: 0.5 }, { type: "DRONE_RISE", weight: 0.3 }, { type: "DRONE_DESCEND", weight: 0.2 }],
  LIVING_ROOM: [
    { type: "PAN_RIGHT", weight: 0.4 },
    { type: "ARC", weight: 0.3 },
    { type: "PARALLAX", weight: 0.3 },
  ],
  KITCHEN: [{ type: "PERSPECTIVE_SHIFT", weight: 0.6 }, { type: "ORBIT", weight: 0.4 }],
  DINING: [{ type: "PAN_LEFT", weight: 0.5 }, { type: "TRUCK_LEFT", weight: 0.5 }],
  MASTER_BEDROOM: [{ type: "SLOW_PULL", weight: 0.5 }, { type: "TRUCK_RIGHT", weight: 0.5 }],
  BEDROOM: [{ type: "SLOW_PULL", weight: 0.6 }, { type: "PAN_RIGHT", weight: 0.4 }],
  BATHROOM: [{ type: "TILT", weight: 0.7 }, { type: "PAN_LEFT", weight: 0.3 }],
  ENSUITE: [{ type: "TILT", weight: 0.6 }, { type: "PEDESTAL_DOWN", weight: 0.4 }],
  OUTDOOR: [{ type: "TRUCK_LEFT", weight: 0.5 }, { type: "PEDESTAL_UP", weight: 0.5 }],
  POOL: [{ type: "PARALLAX", weight: 0.4 }, { type: "DRONE_ORBIT", weight: 0.3 }, { type: "PEDESTAL_DOWN", weight: 0.3 }],
  DECK: [{ type: "CORNER_REVEAL", weight: 0.6 }, { type: "REVEAL", weight: 0.4 }],
  TWILIGHT: [{ type: "HERO_PUSH", weight: 0.5 }, { type: "CRANE_RISE", weight: 0.5 }],
};

export const ENERGETIC_CAMERA_BIAS: CameraMovementBias = {
  EXTERIOR_FRONT: [{ type: "HERO_PUSH", weight: 0.5 }, { type: "ARC", weight: 0.5 }],
  EXTERIOR_GENERAL: [
    { type: "PAN_RIGHT", weight: 0.4 },
    { type: "TRUCK_LEFT", weight: 0.3 },
    { type: "ARC", weight: 0.3 },
  ],
  EXTERIOR_REAR: [{ type: "PAN_LEFT", weight: 0.5 }, { type: "TRUCK_RIGHT", weight: 0.5 }],
  DRONE: [{ type: "DRONE_ORBIT", weight: 0.6 }, { type: "DRONE_DESCEND", weight: 0.4 }],
  LIVING_ROOM: [
    { type: "ARC", weight: 0.4 },
    { type: "PERSPECTIVE_SHIFT", weight: 0.3 },
    { type: "CORNER_REVEAL", weight: 0.3 },
  ],
  KITCHEN: [{ type: "PERSPECTIVE_SHIFT", weight: 0.6 }, { type: "ORBIT", weight: 0.4 }],
  DINING: [{ type: "PAN_RIGHT", weight: 0.5 }, { type: "ARC", weight: 0.5 }],
  MASTER_BEDROOM: [{ type: "PAN_LEFT", weight: 0.5 }, { type: "FOREGROUND_REVEAL", weight: 0.5 }],
  BEDROOM: [{ type: "PAN_RIGHT", weight: 0.5 }, { type: "TRUCK_LEFT", weight: 0.5 }],
  BATHROOM: [{ type: "TILT", weight: 0.5 }, { type: "FOREGROUND_REVEAL", weight: 0.5 }],
  ENSUITE: [{ type: "TILT", weight: 0.5 }, { type: "PERSPECTIVE_SHIFT", weight: 0.5 }],
  OUTDOOR: [{ type: "TRUCK_RIGHT", weight: 0.5 }, { type: "ARC", weight: 0.5 }],
  POOL: [{ type: "DRONE_ORBIT", weight: 0.4 }, { type: "PARALLAX", weight: 0.3 }, { type: "ARC", weight: 0.3 }],
  DECK: [{ type: "CORNER_REVEAL", weight: 0.6 }, { type: "FOREGROUND_REVEAL", weight: 0.4 }],
  TWILIGHT: [{ type: "HERO_PUSH", weight: 0.6 }, { type: "ARC", weight: 0.4 }],
};

export const DOCUMENTARY_CAMERA_BIAS: CameraMovementBias = {
  EXTERIOR_FRONT: [{ type: "HERO_PUSH", weight: 0.6 }, { type: "DEPTH_PUSH", weight: 0.4 }],
  EXTERIOR_GENERAL: [{ type: "DEPTH_PUSH", weight: 0.5 }, { type: "CRANE_RISE", weight: 0.5 }],
  EXTERIOR_REAR: [{ type: "FOREGROUND_REVEAL", weight: 0.5 }, { type: "DEPTH_PUSH", weight: 0.5 }],
  DRONE: [{ type: "DRONE_RISE", weight: 0.6 }, { type: "DRONE_DESCEND", weight: 0.4 }],
  LIVING_ROOM: [{ type: "DEPTH_PUSH", weight: 0.5 }, { type: "FOREGROUND_REVEAL", weight: 0.5 }],
  KITCHEN: [{ type: "PERSPECTIVE_SHIFT", weight: 0.6 }, { type: "DEPTH_PUSH", weight: 0.4 }],
  DINING: [{ type: "DEPTH_PUSH", weight: 0.6 }, { type: "SLOW_PUSH", weight: 0.4 }],
  MASTER_BEDROOM: [{ type: "SLOW_PULL", weight: 0.6 }, { type: "FOREGROUND_REVEAL", weight: 0.4 }],
  BEDROOM: [{ type: "SLOW_PULL", weight: 0.6 }, { type: "DEPTH_PUSH", weight: 0.4 }],
  BATHROOM: [{ type: "TILT", weight: 0.7 }, { type: "PEDESTAL_DOWN", weight: 0.3 }],
  ENSUITE: [{ type: "TILT", weight: 0.6 }, { type: "PEDESTAL_DOWN", weight: 0.4 }],
  OUTDOOR: [{ type: "PEDESTAL_UP", weight: 0.5 }, { type: "DEPTH_PUSH", weight: 0.5 }],
  POOL: [{ type: "PARALLAX", weight: 0.5 }, { type: "PEDESTAL_DOWN", weight: 0.5 }],
  DECK: [{ type: "REVEAL", weight: 0.6 }, { type: "DEPTH_PUSH", weight: 0.4 }],
  TWILIGHT: [{ type: "REVEAL", weight: 0.6 }, { type: "HERO_PUSH", weight: 0.4 }],
};
