import type { TypographyTreatment } from "@quickreel/shared";

/**
 * Overlay placement rarely needs to change between styles even when font
 * and color do — headline-y announcements up top, factual details in the
 * lower third, logo/CTA centered as a closing card.
 */
const DEFAULT_OVERLAY_POSITIONS: TypographyTreatment["overlayPositions"] = {
  JUST_LISTED: "topBanner",
  NEW_TO_MARKET: "topBanner",
  LUXURY_LIVING: "topBanner",
  BED_COUNT: "lowerThird",
  BATH_COUNT: "lowerThird",
  ADDRESS: "lowerThird",
  AUCTION: "lowerThird",
  OPEN_HOME: "lowerThird",
  LOGO: "center",
  CTA: "center",
};

function typography(overrides: Omit<TypographyTreatment, "overlayPositions">): TypographyTreatment {
  return { ...overrides, overlayPositions: DEFAULT_OVERLAY_POSITIONS };
}

export const SERIF_LUXURY_TYPOGRAPHY = typography({
  fontFamily: "Playfair Display",
  headlineWeight: 600,
  accentColor: "#D4AF37",
  animationPreset: "fadeUp",
});

export const SANS_MODERN_TYPOGRAPHY = typography({
  fontFamily: "Inter",
  headlineWeight: 700,
  accentColor: "#FFFFFF",
  animationPreset: "slideIn",
});

export const BOLD_VIRAL_TYPOGRAPHY = typography({
  fontFamily: "Poppins",
  headlineWeight: 800,
  accentColor: "#FF3B5C",
  animationPreset: "typewriter",
});

export const MINIMAL_SANS_TYPOGRAPHY = typography({
  fontFamily: "Helvetica Neue",
  headlineWeight: 500,
  accentColor: "#FFFFFF",
  animationPreset: "fadeUp",
});

export const CORPORATE_SANS_TYPOGRAPHY = typography({
  fontFamily: "Inter",
  headlineWeight: 600,
  accentColor: "#2563EB",
  animationPreset: "slideIn",
});

export const DOCUMENTARY_SERIF_TYPOGRAPHY = typography({
  fontFamily: "Georgia",
  headlineWeight: 500,
  accentColor: "#E8E4DA",
  animationPreset: "maskWipe",
});

/** Helper for styles that want one of the above with just the accent color swapped. */
export function withAccentColor(base: TypographyTreatment, accentColor: string): TypographyTreatment {
  return { ...base, accentColor };
}
