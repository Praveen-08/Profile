import type { TransitionSet } from "@quickreel/shared";

export const ELEGANT_TRANSITIONS: TransitionSet = [
  { type: "LUXURY_FADE", weight: 0.3, maxDurationMs: 800 },
  { type: "FILM_DISSOLVE", weight: 0.2, maxDurationMs: 500 },
  { type: "LIGHT_LEAK", weight: 0.15, maxDurationMs: 400 },
  { type: "CAMERA_MATCH", weight: 0.15, maxDurationMs: 120 },
  { type: "GLASS_TRANSITION", weight: 0.12, maxDurationMs: 500 },
  { type: "BLUR", weight: 0.08, maxDurationMs: 400 },
];

export const CINEMATIC_TRANSITIONS: TransitionSet = [
  { type: "LUXURY_FADE", weight: 0.26, maxDurationMs: 850 },
  { type: "LENS_FLARE", weight: 0.16, maxDurationMs: 400 },
  { type: "LIGHT_LEAK", weight: 0.16, maxDurationMs: 450 },
  { type: "CAMERA_MATCH", weight: 0.16, maxDurationMs: 120 },
  { type: "PERSPECTIVE_MATCH", weight: 0.16, maxDurationMs: 500 },
  { type: "FILM_DISSOLVE", weight: 0.1, maxDurationMs: 550 },
];

export const BALANCED_TRANSITIONS: TransitionSet = [
  { type: "FILM_DISSOLVE", weight: 0.22, maxDurationMs: 500 },
  { type: "PUSH", weight: 0.18, maxDurationMs: 400 },
  { type: "SLIDE", weight: 0.14, maxDurationMs: 350 },
  { type: "CAMERA_MATCH", weight: 0.18, maxDurationMs: 120 },
  { type: "PERSPECTIVE_MATCH", weight: 0.13, maxDurationMs: 500 },
  { type: "LUXURY_FADE", weight: 0.15, maxDurationMs: 700 },
];

export const ENERGETIC_TRANSITIONS: TransitionSet = [
  { type: "WHIP", weight: 0.26, maxDurationMs: 280 },
  { type: "MOTION_BLUR", weight: 0.2, maxDurationMs: 300 },
  { type: "MOTION_MATCH", weight: 0.18, maxDurationMs: 280 },
  { type: "WHITE_FLASH", weight: 0.13, maxDurationMs: 180 },
  { type: "PUSH", weight: 0.12, maxDurationMs: 350 },
  { type: "SLIDE", weight: 0.11, maxDurationMs: 320 },
];

export const MINIMAL_TRANSITIONS: TransitionSet = [
  { type: "BLUR", weight: 0.35, maxDurationMs: 450 },
  { type: "FILM_DISSOLVE", weight: 0.3, maxDurationMs: 500 },
  { type: "GLASS_TRANSITION", weight: 0.2, maxDurationMs: 450 },
  { type: "CAMERA_MATCH", weight: 0.15, maxDurationMs: 100 },
];

export const DOCUMENTARY_TRANSITIONS: TransitionSet = [
  { type: "FILM_DISSOLVE", weight: 0.3, maxDurationMs: 550 },
  { type: "CAMERA_MATCH", weight: 0.25, maxDurationMs: 120 },
  { type: "PERSPECTIVE_MATCH", weight: 0.2, maxDurationMs: 500 },
  { type: "BLUR", weight: 0.15, maxDurationMs: 450 },
  { type: "LIGHT_LEAK", weight: 0.1, maxDurationMs: 400 },
];
