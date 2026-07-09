import { StyleConfigSchema, type StyleConfig } from "@quickreel/shared";
import {
  CALM_CAMERA_BIAS,
  DOCUMENTARY_CAMERA_BIAS,
  DYNAMIC_CAMERA_BIAS,
  ENERGETIC_CAMERA_BIAS,
} from "./presets/camera-bias.js";
import {
  BALANCED_TRANSITIONS,
  CINEMATIC_TRANSITIONS,
  DOCUMENTARY_TRANSITIONS,
  ELEGANT_TRANSITIONS,
  ENERGETIC_TRANSITIONS,
  MINIMAL_TRANSITIONS,
} from "./presets/transitions.js";
import {
  BOLD_VIRAL_TYPOGRAPHY,
  CORPORATE_SANS_TYPOGRAPHY,
  DOCUMENTARY_SERIF_TYPOGRAPHY,
  MINIMAL_SANS_TYPOGRAPHY,
  SANS_MODERN_TYPOGRAPHY,
  SERIF_LUXURY_TYPOGRAPHY,
  withAccentColor,
} from "./presets/typography.js";
import { FAST_CUT_SPEED, MEDIUM_CUT_SPEED, SLOW_CUT_SPEED, VERY_FAST_CUT_SPEED } from "./presets/cut-speed.js";

const CALM_DEFAULT_MOVES = [{ type: "SLOW_PUSH" as const, weight: 0.6 }, { type: "REVEAL_MOTION" as const, weight: 0.4 }];
const DYNAMIC_DEFAULT_MOVES = [{ type: "TRUCK_LEFT" as const, weight: 0.5 }, { type: "TRUCK_RIGHT" as const, weight: 0.5 }];
const ENERGETIC_DEFAULT_MOVES = [
  { type: "PAN_LEFT" as const, weight: 0.3 },
  { type: "PAN_RIGHT" as const, weight: 0.3 },
  { type: "ARC" as const, weight: 0.4 },
];
const DOCUMENTARY_DEFAULT_MOVES = [
  { type: "DEPTH_PUSH" as const, weight: 0.5 },
  { type: "FOREGROUND_REVEAL" as const, weight: 0.5 },
];

function style(config: StyleConfig): StyleConfig {
  return StyleConfigSchema.parse(config);
}

export const LUXURY_CINEMATIC = style({
  slug: "luxury-cinematic",
  name: "Luxury Cinematic",
  description: "Slow, confident camera work and a gold-serif title system — the flagship premium listing style.",
  defaultCameraMoves: CALM_DEFAULT_MOVES,
  cameraMovementBias: CALM_CAMERA_BIAS,
  transitionSet: CINEMATIC_TRANSITIONS,
  typography: SERIF_LUXURY_TYPOGRAPHY,
  cutSpeedCurve: SLOW_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.55,
  preferredHookArchetypes: ["TWILIGHT_REVEAL", "BEST_EXTERIOR_QUICK_ZOOM", "LUXURY_INTERIOR_FIRST"],
});

export const MODERN_LUXURY = style({
  slug: "modern-luxury",
  name: "Modern Luxury",
  description: "Confident lateral camera moves and clean sans typography for contemporary high-end builds.",
  defaultCameraMoves: DYNAMIC_DEFAULT_MOVES,
  cameraMovementBias: DYNAMIC_CAMERA_BIAS,
  transitionSet: ELEGANT_TRANSITIONS,
  typography: withAccentColor(SANS_MODERN_TYPOGRAPHY, "#C9A227"),
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.6,
  preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM", "LUXURY_INTERIOR_FIRST", "DRONE_FIRST"],
});

export const MINIMAL = style({
  slug: "minimal",
  name: "Minimal",
  description: "The quietest style in the library — restrained motion, near-silent cuts, no ornamentation.",
  defaultCameraMoves: CALM_DEFAULT_MOVES,
  cameraMovementBias: CALM_CAMERA_BIAS,
  transitionSet: MINIMAL_TRANSITIONS,
  typography: MINIMAL_SANS_TYPOGRAPHY,
  cutSpeedCurve: SLOW_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: false, outroHoldOnLogoBeats: 4 },
  motionIntensity: 0.35,
  preferredHookArchetypes: ["LUXURY_INTERIOR_FIRST", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const FAST_PACE = style({
  slug: "fast-pace",
  name: "Fast Pace",
  description: "Punchy cuts and directional camera moves for agents who want energy over elegance.",
  defaultCameraMoves: ENERGETIC_DEFAULT_MOVES,
  cameraMovementBias: ENERGETIC_CAMERA_BIAS,
  transitionSet: ENERGETIC_TRANSITIONS,
  typography: BOLD_VIRAL_TYPOGRAPHY,
  cutSpeedCurve: FAST_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 2 },
  motionIntensity: 0.85,
  preferredHookArchetypes: ["FAST_MONTAGE", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const INSTAGRAM_VIRAL = style({
  slug: "instagram-viral",
  name: "Instagram Viral",
  description: "Feed-native pacing — rapid-fire opening montage, bold captions, built to stop the scroll.",
  defaultCameraMoves: ENERGETIC_DEFAULT_MOVES,
  cameraMovementBias: ENERGETIC_CAMERA_BIAS,
  transitionSet: ENERGETIC_TRANSITIONS,
  typography: withAccentColor(BOLD_VIRAL_TYPOGRAPHY, "#FF3B5C"),
  cutSpeedCurve: VERY_FAST_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 2 },
  motionIntensity: 0.9,
  preferredHookArchetypes: ["FAST_MONTAGE", "DRONE_FIRST", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const TIKTOK = style({
  slug: "tiktok",
  name: "TikTok",
  description: "Maximum-energy vertical-native cutting with a signature cyan accent.",
  defaultCameraMoves: ENERGETIC_DEFAULT_MOVES,
  cameraMovementBias: ENERGETIC_CAMERA_BIAS,
  transitionSet: ENERGETIC_TRANSITIONS,
  typography: withAccentColor(BOLD_VIRAL_TYPOGRAPHY, "#25F4EE"),
  cutSpeedCurve: VERY_FAST_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 2 },
  motionIntensity: 0.92,
  preferredHookArchetypes: ["FAST_MONTAGE", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const LUXURY_TWILIGHT = style({
  slug: "luxury-twilight",
  name: "Luxury Twilight",
  description: "Built around the golden-hour hero shot — moody, slow, and dramatic.",
  defaultCameraMoves: CALM_DEFAULT_MOVES,
  cameraMovementBias: CALM_CAMERA_BIAS,
  transitionSet: CINEMATIC_TRANSITIONS,
  typography: withAccentColor(SERIF_LUXURY_TYPOGRAPHY, "#B08BD9"),
  cutSpeedCurve: SLOW_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 4 },
  motionIntensity: 0.5,
  preferredHookArchetypes: ["TWILIGHT_REVEAL", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const ARCHITECTURAL = style({
  slug: "architectural",
  name: "Architectural",
  description: "Observational, structure-first camera language for design-forward homes.",
  defaultCameraMoves: DOCUMENTARY_DEFAULT_MOVES,
  cameraMovementBias: DOCUMENTARY_CAMERA_BIAS,
  transitionSet: DOCUMENTARY_TRANSITIONS,
  typography: MINIMAL_SANS_TYPOGRAPHY,
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: false, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.5,
  preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM", "DRONE_FIRST", "LUXURY_INTERIOR_FIRST"],
});

export const BUILDER_SHOWCASE = style({
  slug: "builder-showcase",
  name: "Builder Showcase",
  description: "Confident, scale-forward edit for developers and builders — drone-led, orange accent.",
  defaultCameraMoves: DYNAMIC_DEFAULT_MOVES,
  cameraMovementBias: DYNAMIC_CAMERA_BIAS,
  transitionSet: BALANCED_TRANSITIONS,
  typography: withAccentColor(SANS_MODERN_TYPOGRAPHY, "#F97316"),
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 2 },
  motionIntensity: 0.7,
  preferredHookArchetypes: ["DRONE_FIRST", "BEST_EXTERIOR_QUICK_ZOOM", "FAST_MONTAGE"],
});

export const PRESTIGE = style({
  slug: "prestige",
  name: "Prestige",
  description: "Understated wealth — patient pacing, elegant transitions, serif titles.",
  defaultCameraMoves: CALM_DEFAULT_MOVES,
  cameraMovementBias: CALM_CAMERA_BIAS,
  transitionSet: ELEGANT_TRANSITIONS,
  typography: SERIF_LUXURY_TYPOGRAPHY,
  cutSpeedCurve: SLOW_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.5,
  preferredHookArchetypes: ["TWILIGHT_REVEAL", "LUXURY_INTERIOR_FIRST", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const LIFESTYLE = style({
  slug: "lifestyle",
  name: "Lifestyle",
  description: "Warm, social, green-accented edit that sells a way of living, not just a floor plan.",
  defaultCameraMoves: DYNAMIC_DEFAULT_MOVES,
  cameraMovementBias: DYNAMIC_CAMERA_BIAS,
  transitionSet: BALANCED_TRANSITIONS,
  typography: withAccentColor(SANS_MODERN_TYPOGRAPHY, "#22C55E"),
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 2 },
  motionIntensity: 0.65,
  preferredHookArchetypes: ["LUXURY_INTERIOR_FIRST", "FAST_MONTAGE", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const COASTAL = style({
  slug: "coastal",
  name: "Coastal",
  description: "Airy, blue-accented edit built around light, water, and outdoor-indoor flow.",
  defaultCameraMoves: DYNAMIC_DEFAULT_MOVES,
  cameraMovementBias: DYNAMIC_CAMERA_BIAS,
  transitionSet: ELEGANT_TRANSITIONS,
  typography: withAccentColor(SANS_MODERN_TYPOGRAPHY, "#38BDF8"),
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.6,
  preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM", "DRONE_FIRST", "TWILIGHT_REVEAL"],
});

export const ELEGANT = style({
  slug: "elegant",
  name: "Elegant",
  description: "Soft, romantic pacing with warm serif titles — timeless rather than trend-driven.",
  defaultCameraMoves: CALM_DEFAULT_MOVES,
  cameraMovementBias: CALM_CAMERA_BIAS,
  transitionSet: ELEGANT_TRANSITIONS,
  typography: withAccentColor(SERIF_LUXURY_TYPOGRAPHY, "#E8C9A0"),
  cutSpeedCurve: SLOW_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.5,
  preferredHookArchetypes: ["TWILIGHT_REVEAL", "LUXURY_INTERIOR_FIRST", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const PREMIUM_AGENCY = style({
  slug: "premium-agency",
  name: "Premium Agency",
  description: "A polished, brand-forward edit for agencies who need consistency across every listing.",
  defaultCameraMoves: CALM_DEFAULT_MOVES,
  cameraMovementBias: CALM_CAMERA_BIAS,
  transitionSet: CINEMATIC_TRANSITIONS,
  typography: withAccentColor(CORPORATE_SANS_TYPOGRAPHY, "#1E3A8A"),
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.55,
  preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM", "TWILIGHT_REVEAL", "DRONE_FIRST"],
});

export const NETFLIX_DOCUMENTARY = style({
  slug: "netflix-documentary",
  name: "Netflix Documentary",
  description: "Observational, unhurried, editorial — feels like the cold open of a design documentary.",
  defaultCameraMoves: DOCUMENTARY_DEFAULT_MOVES,
  cameraMovementBias: DOCUMENTARY_CAMERA_BIAS,
  transitionSet: DOCUMENTARY_TRANSITIONS,
  typography: DOCUMENTARY_SERIF_TYPOGRAPHY,
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: false, outroHoldOnLogoBeats: 4 },
  motionIntensity: 0.45,
  preferredHookArchetypes: ["LUXURY_INTERIOR_FIRST", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const APPLE_STYLE = style({
  slug: "apple-style",
  name: "Apple Style",
  description: "Clean, confident, product-launch energy — white space, precise motion, zero clutter.",
  defaultCameraMoves: CALM_DEFAULT_MOVES,
  cameraMovementBias: CALM_CAMERA_BIAS,
  transitionSet: MINIMAL_TRANSITIONS,
  typography: withAccentColor(MINIMAL_SANS_TYPOGRAPHY, "#FFFFFF"),
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: false, alignHeroRevealToDrop: false, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.45,
  preferredHookArchetypes: ["LUXURY_INTERIOR_FIRST", "BEST_EXTERIOR_QUICK_ZOOM"],
});

export const CORPORATE = style({
  slug: "corporate",
  name: "Corporate",
  description: "Neutral, professional edit for institutional listings, portfolios, and investor decks.",
  defaultCameraMoves: DOCUMENTARY_DEFAULT_MOVES,
  cameraMovementBias: DOCUMENTARY_CAMERA_BIAS,
  transitionSet: BALANCED_TRANSITIONS,
  typography: CORPORATE_SANS_TYPOGRAPHY,
  cutSpeedCurve: MEDIUM_CUT_SPEED,
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: false, outroHoldOnLogoBeats: 3 },
  motionIntensity: 0.5,
  preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM", "LUXURY_INTERIOR_FIRST"],
});

export const STYLE_CATALOG: StyleConfig[] = [
  LUXURY_CINEMATIC,
  MODERN_LUXURY,
  MINIMAL,
  FAST_PACE,
  INSTAGRAM_VIRAL,
  TIKTOK,
  LUXURY_TWILIGHT,
  ARCHITECTURAL,
  BUILDER_SHOWCASE,
  PRESTIGE,
  LIFESTYLE,
  COASTAL,
  ELEGANT,
  PREMIUM_AGENCY,
  NETFLIX_DOCUMENTARY,
  APPLE_STYLE,
  CORPORATE,
];

export function getStyleBySlug(slug: string): StyleConfig | undefined {
  return STYLE_CATALOG.find((s) => s.slug === slug);
}
