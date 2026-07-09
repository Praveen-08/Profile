import { REEL_LENGTH_OPTIONS, type ReelLengthSec, type SmartRegenerateDirective } from "@quickreel/shared";

/**
 * "Instead of rendering again from scratch, the user clicks Make Faster /
 * More Cinematic / Luxury / Minimal / More Emotional / Higher Energy — the
 * AI changes only what is required." In this build "only what is required"
 * is a style swap plus a reel-length nudge, not a frame-level EDL patch:
 * the render pipeline is already fast (~20-30s), so a targeted config
 * change followed by a normal full render satisfies the product goal
 * (skip manual reconfiguration) without the complexity and fragility of
 * partial re-rendering. See VersionsService.smartRegenerate.
 */
export const DIRECTIVE_STYLE_SLUG: Record<SmartRegenerateDirective, string> = {
  MAKE_FASTER: "fast-pace",
  MORE_CINEMATIC: "luxury-cinematic",
  LUXURY: "modern-luxury",
  MINIMAL: "minimal",
  MORE_EMOTIONAL: "lifestyle",
  HIGHER_ENERGY: "tiktok",
};

/** MAKE_FASTER/HIGHER_ENERGY shorten toward 10s; MORE_CINEMATIC/MORE_EMOTIONAL lengthen toward 20s; LUXURY/MINIMAL leave pacing alone. */
export function adjustReelLength(
  directive: SmartRegenerateDirective,
  current: ReelLengthSec | null,
): ReelLengthSec {
  const options = REEL_LENGTH_OPTIONS;
  const index = options.indexOf(current ?? 15);

  switch (directive) {
    case "MAKE_FASTER":
    case "HIGHER_ENERGY":
      return options[Math.max(0, index - 1)]!;
    case "MORE_CINEMATIC":
    case "MORE_EMOTIONAL":
      return options[Math.min(options.length - 1, index + 1)]!;
    case "LUXURY":
    case "MINIMAL":
    default:
      return current ?? 15;
  }
}
