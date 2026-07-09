import type { CameraMoveType, EasingCurve, RoomType } from "@quickreel/shared";

export type FocalPoint = { x: number; y: number };

export interface CameraMovementDef {
  type: CameraMoveType;
  label: string;
  description: string;
  /** [start, end] image scale (1 = fit-to-frame, no zoom). */
  scaleRange: [number, number];
  startFocalPoint: FocalPoint;
  endFocalPoint: FocalPoint;
  defaultEasing: EasingCurve;
  /** Room types this movement was designed for — informs, doesn't gate, selection. */
  preferredRoomTypes: RoomType[];
}

const c = (x: number, y: number): FocalPoint => ({ x, y });

/**
 * The canonical 22-movement catalog — the Cinematic Motion Engine's full
 * vocabulary. Every style references these by `type` with per-room weights
 * (packages/shared/style-schema.ts) — no per-style branching logic exists
 * anywhere in this package or the ones downstream of it.
 *
 * `defaultEasing` is chosen per-movement for physical plausibility (a real
 * camera operator's push has momentum; a crane has weight decelerating at
 * the top of its arc) rather than picked for visual variety — see
 * packages/shared/src/easing.ts for what each curve encodes.
 */
export const CAMERA_MOVEMENT_CATALOG: Record<CameraMoveType, CameraMovementDef> = {
  SLOW_PUSH: {
    type: "SLOW_PUSH",
    label: "Slow Push",
    description: "Gentle, continuous zoom in toward the center of the frame.",
    scaleRange: [1.0, 1.08],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["LIVING_ROOM", "DINING", "OFFICE", "BEDROOM"],
  },
  SLOW_PULL: {
    type: "SLOW_PULL",
    label: "Slow Pull",
    description: "Gentle zoom out, opening up the room as the clip plays.",
    scaleRange: [1.08, 1.0],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["MASTER_BEDROOM", "BEDROOM", "HALLWAY"],
  },
  PAN_LEFT: {
    type: "PAN_LEFT",
    label: "Pan Left",
    description: "Horizontal sweep from right to left across the frame.",
    scaleRange: [1.15, 1.15],
    startFocalPoint: c(0.72, 0.5),
    endFocalPoint: c(0.28, 0.5),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["KITCHEN", "DINING", "OFFICE"],
  },
  PAN_RIGHT: {
    type: "PAN_RIGHT",
    label: "Pan Right",
    description: "Horizontal sweep from left to right across the frame.",
    scaleRange: [1.15, 1.15],
    startFocalPoint: c(0.28, 0.5),
    endFocalPoint: c(0.72, 0.5),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["KITCHEN", "DINING", "OFFICE"],
  },
  TRUCK_LEFT: {
    type: "TRUCK_LEFT",
    label: "Truck Left",
    description: "Simulated lateral camera travel left, holding subject distance.",
    scaleRange: [1.18, 1.12],
    startFocalPoint: c(0.65, 0.5),
    endFocalPoint: c(0.35, 0.5),
    defaultEasing: "gentleDrift",
    preferredRoomTypes: ["LIVING_ROOM", "KITCHEN"],
  },
  TRUCK_RIGHT: {
    type: "TRUCK_RIGHT",
    label: "Truck Right",
    description: "Simulated lateral camera travel right, holding subject distance.",
    scaleRange: [1.18, 1.12],
    startFocalPoint: c(0.35, 0.5),
    endFocalPoint: c(0.65, 0.5),
    defaultEasing: "gentleDrift",
    preferredRoomTypes: ["LIVING_ROOM", "KITCHEN"],
  },
  PEDESTAL_UP: {
    type: "PEDESTAL_UP",
    label: "Pedestal Up",
    description: "Vertical rise, revealing scale from ground to sky.",
    scaleRange: [1.12, 1.0],
    startFocalPoint: c(0.5, 0.75),
    endFocalPoint: c(0.5, 0.35),
    defaultEasing: "craneEase",
    preferredRoomTypes: ["EXTERIOR_GENERAL", "EXTERIOR_FRONT", "OUTDOOR", "POOL", "DECK"],
  },
  PEDESTAL_DOWN: {
    type: "PEDESTAL_DOWN",
    label: "Pedestal Down",
    description: "Vertical descent, settling attention toward detail.",
    scaleRange: [1.0, 1.1],
    startFocalPoint: c(0.5, 0.3),
    endFocalPoint: c(0.5, 0.6),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["BATHROOM", "ENSUITE"],
  },
  ARC: {
    type: "ARC",
    label: "Arc",
    description: "Diagonal sweep with a slight zoom, simulating a curved camera path.",
    scaleRange: [1.1, 1.18],
    startFocalPoint: c(0.35, 0.4),
    endFocalPoint: c(0.65, 0.6),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["LIVING_ROOM", "DINING"],
  },
  ORBIT: {
    type: "ORBIT",
    label: "Orbit",
    description: "Sweeping diagonal motion around a central feature, e.g. a kitchen island.",
    scaleRange: [1.15, 1.15],
    startFocalPoint: c(0.3, 0.55),
    endFocalPoint: c(0.7, 0.45),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["KITCHEN", "DINING"],
  },
  PARALLAX: {
    type: "PARALLAX",
    label: "Parallax",
    description: "Diagonal push that exaggerates depth between foreground and background — depth-aware when a depth map is available.",
    scaleRange: [1.0, 1.14],
    startFocalPoint: c(0.4, 0.55),
    endFocalPoint: c(0.55, 0.45),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["LIVING_ROOM", "KITCHEN", "MASTER_BEDROOM"],
  },
  FOREGROUND_REVEAL: {
    type: "FOREGROUND_REVEAL",
    label: "Foreground Reveal",
    description: "Starts tight on a foreground element, then pulls back to reveal the room.",
    scaleRange: [1.18, 1.0],
    startFocalPoint: c(0.5, 0.6),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "momentumOut",
    preferredRoomTypes: ["HALLWAY", "KITCHEN"],
  },
  DEPTH_PUSH: {
    type: "DEPTH_PUSH",
    label: "Depth Push",
    description: "Push toward the frame's vanishing point, emphasizing depth and scale — depth-aware when a depth map is available.",
    scaleRange: [1.0, 1.16],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.42),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["HALLWAY", "DINING"],
  },
  PERSPECTIVE_SHIFT: {
    type: "PERSPECTIVE_SHIFT",
    label: "Perspective Shift",
    description: "Diagonal shift combined with a subtle zoom — reads as a diagonal slide across the frame.",
    scaleRange: [1.08, 1.15],
    startFocalPoint: c(0.42, 0.5),
    endFocalPoint: c(0.58, 0.46),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["KITCHEN", "OFFICE"],
  },
  TILT: {
    type: "TILT",
    label: "Tilt",
    description: "Vertical reframe without lateral motion — an elegant, unhurried reveal for compact rooms.",
    scaleRange: [1.1, 1.1],
    startFocalPoint: c(0.5, 0.3),
    endFocalPoint: c(0.5, 0.7),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["BATHROOM", "ENSUITE", "LAUNDRY"],
  },
  HERO_PUSH: {
    type: "HERO_PUSH",
    label: "Hero Push",
    description: "Deliberate, confident push reserved for hero exterior/twilight shots.",
    scaleRange: [1.0, 1.12],
    startFocalPoint: c(0.5, 0.5),
    endFocalPoint: c(0.5, 0.46),
    defaultEasing: "momentumOut",
    preferredRoomTypes: ["EXTERIOR_FRONT", "EXTERIOR_GENERAL", "TWILIGHT"],
  },
  REVEAL: {
    type: "REVEAL",
    label: "Reveal",
    description: "Slow, understated pull that uncovers the full scene — closing-shot energy.",
    scaleRange: [1.06, 1.0],
    startFocalPoint: c(0.5, 0.52),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["LIVING_ROOM", "MASTER_BEDROOM", "TWILIGHT"],
  },
  CRANE_RISE: {
    type: "CRANE_RISE",
    label: "Crane Rise",
    description: "A large, dramatic vertical rise with real weight — decelerates like a physical crane arm settling.",
    scaleRange: [1.2, 1.0],
    startFocalPoint: c(0.5, 0.85),
    endFocalPoint: c(0.5, 0.3),
    defaultEasing: "craneEase",
    preferredRoomTypes: ["EXTERIOR_GENERAL", "EXTERIOR_FRONT", "DECK", "POOL"],
  },
  CORNER_REVEAL: {
    type: "CORNER_REVEAL",
    label: "Corner Reveal",
    description: "Starts tucked into a corner of the frame, then arcs out to reveal the full space.",
    scaleRange: [1.22, 1.0],
    startFocalPoint: c(0.75, 0.72),
    endFocalPoint: c(0.5, 0.5),
    defaultEasing: "momentumOut",
    preferredRoomTypes: ["DECK", "HALLWAY", "OFFICE"],
  },
  MICRO_CAMERA_DRIFT: {
    type: "MICRO_CAMERA_DRIFT",
    label: "Micro Camera Drift",
    description: "Barely-there handheld-style drift for detail shots that shouldn't call attention to their motion.",
    scaleRange: [1.0, 1.03],
    startFocalPoint: c(0.49, 0.5),
    endFocalPoint: c(0.51, 0.5),
    defaultEasing: "gentleDrift",
    preferredRoomTypes: ["LAUNDRY", "HALLWAY", "OFFICE"],
  },
  DRONE_RISE: {
    type: "DRONE_RISE",
    label: "Drone Rise",
    description: "Simulated aerial ascent, opening up scale and horizon.",
    scaleRange: [1.15, 1.0],
    startFocalPoint: c(0.5, 0.7),
    endFocalPoint: c(0.5, 0.35),
    defaultEasing: "craneEase",
    preferredRoomTypes: ["DRONE", "VIEWS"],
  },
  DRONE_DESCEND: {
    type: "DRONE_DESCEND",
    label: "Drone Descend",
    description: "Simulated aerial descent, settling from a wide establishing view toward the property.",
    scaleRange: [1.0, 1.12],
    startFocalPoint: c(0.5, 0.3),
    endFocalPoint: c(0.5, 0.55),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["DRONE", "EXTERIOR_GENERAL"],
  },
  DRONE_ORBIT: {
    type: "DRONE_ORBIT",
    label: "Drone Orbit",
    description: "Aerial arc combined with a slight rise — a sweeping cinematic establishing move.",
    scaleRange: [1.1, 1.16],
    startFocalPoint: c(0.3, 0.6),
    endFocalPoint: c(0.7, 0.4),
    defaultEasing: "cinematicEaseInOut",
    preferredRoomTypes: ["DRONE", "VIEWS", "POOL"],
  },
};

export function getMovementDef(type: CameraMoveType): CameraMovementDef {
  return CAMERA_MOVEMENT_CATALOG[type];
}
