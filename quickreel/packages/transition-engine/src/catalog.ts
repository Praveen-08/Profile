import type { TransitionType } from "@quickreel/shared";

export interface TransitionDef {
  type: TransitionType;
  label: string;
  description: string;
  /** [min, max] sensible duration in ms — style config's maxDurationMs clamps within this. */
  durationRangeMs: [number, number];
  defaultEasing: "linear" | "easeInOut" | "easeOutCubic" | "easeInCubic";
}

/**
 * The 12-transition palette. Deliberately restrained per product spec:
 * "keep transitions elegant, avoid cheesy effects" — no spins, no cube
 * rotations, nothing that reads as a PowerPoint template.
 */
export const TRANSITION_CATALOG: Record<TransitionType, TransitionDef> = {
  LUXURY_FADE: {
    type: "LUXURY_FADE",
    label: "Luxury Fade",
    description: "Slow cross-dissolve through a soft black hold — the signature closing transition.",
    durationRangeMs: [500, 900],
    defaultEasing: "easeInOut",
  },
  FILM_DISSOLVE: {
    type: "FILM_DISSOLVE",
    label: "Film Dissolve",
    description: "Classic cross-dissolve between two frames.",
    durationRangeMs: [350, 600],
    defaultEasing: "easeInOut",
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
    defaultEasing: "easeInOut",
  },
  SLIDE: {
    type: "SLIDE",
    label: "Slide",
    description: "The incoming frame slides in over the outgoing frame.",
    durationRangeMs: [250, 400],
    defaultEasing: "easeInOut",
  },
  PARALLAX_TRANSITION: {
    type: "PARALLAX_TRANSITION",
    label: "Parallax",
    description: "Frames shift at different depths/speeds, echoing the parallax camera move.",
    durationRangeMs: [300, 500],
    defaultEasing: "easeInOut",
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
    defaultEasing: "easeInOut",
  },
  CAMERA_MATCH: {
    type: "CAMERA_MATCH",
    label: "Camera Match",
    description: "Cut timed so the outgoing and incoming camera moves feel continuous — a true match cut.",
    durationRangeMs: [0, 120],
    defaultEasing: "linear",
  },
};

export function getTransitionDef(type: TransitionType): TransitionDef {
  return TRANSITION_CATALOG[type];
}
