import type { CameraMoveType, RoomType } from "@quickreel/shared";

export type FocalPoint = { x: number; y: number };
export type Easing = "linear" | "easeInOut" | "easeOutCubic" | "easeInCubic";

export interface CameraMovementDef {
  type: CameraMoveType;
  label: string;
  description: string;
  /** [start, end] image scale (1 = fit-to-frame, no zoom). */
  scaleRange: [number, number];
  startFocalPoint: FocalPoint;
  endFocalPoint: FocalPoint;
  defaultEasing: Easing;
  /** Room types this movement was designed for — informs, doesn't gate, selection. */
  preferredRoomTypes: RoomType[];
}

const c = (x: number, y: number): FocalPoint => ({ x, y });

/**
 * The canonical ~18-movement catalog. Every style references these by
 * `type` with per-room weights (packages/shared/style-schema.ts) — no
 * per-style branching logic exists anywhere in this package or the ones
 * downstream of it.
 */
export const CAMERA_MOVEMENT_CATALOG: Record<CameraMoveType, CameraMovementDef> = {
  SLOW_PUSH: {
    type: "SLOW_PUSH",
    label: "Slow Push",
    description: "Gentle, continuous zoom in toward the center of the frame.",
    scaleRange: [1.0, 1.08],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["LIVING_ROOM", "DINING", "OFFICE", "BEDROOM"],
  },
  SLOW_PULL: {
    type: "SLOW_PULL",
    label: "Slow Pull",
    description: "Gentle zoom out, opening up the room as the clip plays.",
    scaleRange: [1.08, 1.0],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["MASTER_BEDROOM", "BEDROOM", "HALLWAY"],
  },
  PAN_LEFT: {
    type: "PAN_LEFT",
    label: "Pan Left",
    description: "Horizontal sweep from right to left across the frame.",
    scaleRange: [1.15, 1.15],
    startFocalPoint: c(0.72, 0.5),
    endFocalPoint: c(0.28, 0.5),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["KITCHEN", "DINING", "OFFICE"],
  },
  PAN_RIGHT: {
    type: "PAN_RIGHT",
    label: "Pan Right",
    description: "Horizontal sweep from left to right across the frame.",
    scaleRange: [1.15, 1.15],
    startFocalPoint: c(0.28, 0.5),
    endFocalPoint: c(0.72, 0.5),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["KITCHEN", "DINING", "OFFICE"],
  },
  TRUCK_LEFT: {
    type: "TRUCK_LEFT",
    label: "Truck Left",
    description: "Simulated lateral camera travel left, holding subject distance.",
    scaleRange: [1.18, 1.12],
    startFocalPoint: c(0.65, 0.5),
    endFocalPoint: c(0.35, 0.5),
    defaultEasing: "linear",
    preferredRoomTypes: ["LIVING_ROOM", "KITCHEN"],
  },
  TRUCK_RIGHT: {
    type: "TRUCK_RIGHT",
    label: "Truck Right",
    description: "Simulated lateral camera travel right, holding subject distance.",
    scaleRange: [1.18, 1.12],
    startFocalPoint: c(0.35, 0.5),
    endFocalPoint: c(0.65, 0.5),
    defaultEasing: "linear",
    preferredRoomTypes: ["LIVING_ROOM", "KITCHEN"],
  },
  PEDESTAL_UP: {
    type: "PEDESTAL_UP",
    label: "Pedestal Up",
    description: "Vertical rise, revealing scale from ground to sky — crane-like.",
    scaleRange: [1.12, 1.0],
    startFocalPoint: c(0.5, 0.75),
    endFocalPoint: c(0.5, 0.35),
    defaultEasing: "easeOutCubic",
    preferredRoomTypes: ["EXTERIOR_GENERAL", "EXTERIOR_FRONT", "OUTDOOR", "POOL", "DECK"],
  },
  PEDESTAL_DOWN: {
    type: "PEDESTAL_DOWN",
    label: "Pedestal Down",
    description: "Vertical descent, settling attention toward detail.",
    scaleRange: [1.0, 1.1],
    startFocalPoint: c(0.5, 0.3),
    endFocalPoint: c(0.5, 0.6),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["BATHROOM", "ENSUITE"],
  },
  ARC: {
    type: "ARC",
    label: "Arc",
    description: "Diagonal sweep with a slight zoom, simulating a curved camera path.",
    scaleRange: [1.1, 1.18],
    startFocalPoint: c(0.35, 0.4),
    endFocalPoint: c(0.65, 0.6),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["LIVING_ROOM", "DINING"],
  },
  ORBIT: {
    type: "ORBIT",
    label: "Orbit",
    description: "Sweeping diagonal motion around a central feature, e.g. a kitchen island.",
    scaleRange: [1.15, 1.15],
    startFocalPoint: c(0.3, 0.55),
    endFocalPoint: c(0.7, 0.45),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["KITCHEN", "DINING"],
  },
  PARALLAX: {
    type: "PARALLAX",
    label: "Parallax",
    description: "Diagonal push that exaggerates depth between foreground and background.",
    scaleRange: [1.0, 1.14],
    startFocalPoint: c(0.4, 0.55),
    endFocalPoint: c(0.55, 0.45),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["LIVING_ROOM", "KITCHEN", "MASTER_BEDROOM"],
  },
  FOREGROUND_REVEAL: {
    type: "FOREGROUND_REVEAL",
    label: "Foreground Reveal",
    description: "Starts tight on a foreground element, then pulls back to reveal the room.",
    scaleRange: [1.18, 1.0],
    startFocalPoint: c(0.5, 0.6),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "easeOutCubic",
    preferredRoomTypes: ["HALLWAY", "KITCHEN"],
  },
  DEPTH_PUSH: {
    type: "DEPTH_PUSH",
    label: "Depth Push",
    description: "Push toward the frame's vanishing point, emphasizing depth and scale.",
    scaleRange: [1.0, 1.16],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.42),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["HALLWAY", "DINING"],
  },
  PERSPECTIVE_SHIFT: {
    type: "PERSPECTIVE_SHIFT",
    label: "Perspective Shift",
    description: "Diagonal shift combined with a subtle zoom, unsettling the frame just enough to feel alive.",
    scaleRange: [1.08, 1.15],
    startFocalPoint: c(0.42, 0.5),
    endFocalPoint: c(0.58, 0.46),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["KITCHEN", "OFFICE"],
  },
  TILT: {
    type: "TILT",
    label: "Tilt",
    description: "Vertical reframe without lateral motion — ideal for compact, detail-oriented rooms.",
    scaleRange: [1.1, 1.1],
    startFocalPoint: c(0.5, 0.3),
    endFocalPoint: c(0.5, 0.7),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["BATHROOM", "ENSUITE", "LAUNDRY"],
  },
  HERO_PUSH: {
    type: "HERO_PUSH",
    label: "Hero Push",
    description: "Deliberate, confident push reserved for hero exterior/twilight shots.",
    scaleRange: [1.0, 1.12],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.46),
    defaultEasing: "easeOutCubic",
    preferredRoomTypes: ["EXTERIOR_FRONT", "EXTERIOR_GENERAL", "TWILIGHT"],
  },
  DRONE_SIMULATION: {
    type: "DRONE_SIMULATION",
    label: "Drone Simulation",
    description: "Simulated aerial rise/pull-back, for drone stills and wide exteriors.",
    scaleRange: [1.12, 1.0],
    startFocalPoint: c(0.5, 0.65),
    endFocalPoint: c(0.5, 0.4),
    defaultEasing: "easeOutCubic",
    preferredRoomTypes: ["DRONE", "VIEWS", "EXTERIOR_GENERAL"],
  },
  REVEAL_MOTION: {
    type: "REVEAL_MOTION",
    label: "Reveal Motion",
    description: "Slow, understated pull that uncovers the full scene — closing-shot energy.",
    scaleRange: [1.06, 1.0],
    startFocalPoint: c(0.5, 0.52),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "easeInOut",
    preferredRoomTypes: ["LIVING_ROOM", "MASTER_BEDROOM", "TWILIGHT"],
  },
};

export function getMovementDef(type: CameraMoveType): CameraMovementDef {
  return CAMERA_MOVEMENT_CATALOG[type];
}
