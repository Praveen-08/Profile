import type { EasingCurve, TransitionType } from "@quickreel/shared";

export interface TransitionDef {
  type: TransitionType;
  label: string;
  description: string;
  /** [min, max] sensible duration in ms — style config's maxDurationMs clamps within this. */
  durationRangeMs: [number, number];
  defaultEasing: EasingCurve;
}

/**
 * The 16-transition palette — "movie quality only." Deliberately restrained
 * per product spec: "keep transitions elegant, avoid cheesy effects, never
 * cheesy" — no spins, no cube rotations, nothing that reads as a
 * PowerPoint template. MOTION_MATCH/PERSPECTIVE_MATCH/REFLECTION_WIPE/
 * GLASS_TRANSITION were added in the Cinematic Motion Engine pass.
 */
export const TRANSITION_CATALOG: Record<TransitionType, TransitionDef> = {
  LUXURY_FADE: {
    type: "LUXURY_FADE",
    label: "Luxury Fade",
    description: "Slow cross-dissolve through a soft black hold — the signature closing transition.",
    durationRangeMs: [500, 900],
    defaultEasing: "cinematicEaseInOut",
  },
  FILM_DISSOLVE: {
    type: "FILM_DISSOLVE",
    label: "Film Dissolve",
    description: "Classic cross-dissolve between two frames.",
    durationRangeMs: [350, 600],
    defaultEasing: "cinematicEaseInOut",
  },
  LIGHT_LEAK: {
    type: "LIGHT_LEAK",
    label: "Light Leak",
    description: "A warm light sweep washes across the cut, evoking film stock.",
    durationRangeMs: [300, 500],
    defaultEasing: "easeOutCubic",
  },
  LENS_FLARE: {
    type: "LENS_FLARE",
    label: "Lens Flare",
    description: "A brief flare streak masks the cut point — best used sparingly on exteriors.",
    durationRangeMs: [250, 450],
    defaultEasing: "easeOutCubic",
  },
  WHIP: {
    type: "WHIP",
    label: "Whip",
    description: "Fast directional blur pan connecting two shots with energy.",
    durationRangeMs: [180, 320],
    defaultEasing: "easeInCubic",
  },
  MOTION_BLUR: {
    type: "MOTION_BLUR",
    label: "Motion Blur",
    description: "Directional blur ramps into the next frame, matching implied camera motion.",
    durationRangeMs: [200, 350],
    defaultEasing: "linear",
  },
  PUSH: {
    type: "PUSH",
    label: "Push",
    description: "The incoming frame pushes the outgoing frame off-screen.",
    durationRangeMs: [280, 450],
    defaultEasing: "cinematicEaseInOut",
  },
  SLIDE: {
    type: "SLIDE",
    label: "Slide",
    description: "The incoming frame slides in over the outgoing frame.",
    durationRangeMs: [250, 400],
    defaultEasing: "cinematicEaseInOut",
  },
  PARALLAX_TRANSITION: {
    type: "PARALLAX_TRANSITION",
    label: "Parallax",
    description: "Frames shift at different depths/speeds, echoing the parallax camera move.",
    durationRangeMs: [300, 500],
    defaultEasing: "cinematicEaseInOut",
  },
  WHITE_FLASH: {
    type: "WHITE_FLASH",
    label: "White Flash",
    description: "Brief flash to white bridges the cut — high-energy, use sparingly.",
    durationRangeMs: [120, 220],
    defaultEasing: "linear",
  },
  BLUR: {
    type: "BLUR",
    label: "Blur",
    description: "Soft defocus dissolve — gentle, unobtrusive.",
    durationRangeMs: [300, 500],
    defaultEasing: "cinematicEaseInOut",
  },
  CAMERA_MATCH: {
    type: "CAMERA_MATCH",
    label: "Camera Match",
    description: "Cut timed so the outgoing and incoming camera moves feel continuous — a true match cut.",
    durationRangeMs: [0, 120],
    defaultEasing: "linear",
  },
  MOTION_MATCH: {
    type: "MOTION_MATCH",
    label: "Motion Match",
    description: "The incoming clip continues the outgoing clip's camera direction — a directional blur bridges the two so the motion itself never seems to stop.",
    durationRangeMs: [150, 300],
    defaultEasing: "momentumOut",
  },
  PERSPECTIVE_MATCH: {
    type: "PERSPECTIVE_MATCH",
    label: "Perspective Match",
    description: "A subtle scale-and-skew blend aligns the two frames' vanishing points before the cut.",
    durationRangeMs: [300, 550],
    defaultEasing: "cinematicEaseInOut",
  },
  REFLECTION_WIPE: {
    type: "REFLECTION_WIPE",
    label: "Reflection Wipe",
    description: "A mirrored sheen sweeps across the frame, echoing a reflection off water or glass.",
    durationRangeMs: [350, 600],
    defaultEasing: "momentumOut",
  },
  GLASS_TRANSITION: {
    type: "GLASS_TRANSITION",
    label: "Glass Transition",
    description: "A frosted-glass blur with a faint chromatic offset, like looking through a pane as it clears.",
    durationRangeMs: [300, 550],
    defaultEasing: "gentleDrift",
  },
};

export function getTransitionDef(type: TransitionType): TransitionDef {
  return TRANSITION_CATALOG[type];
}
