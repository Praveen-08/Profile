import type { TransitionType } from "@quickreel/shared";

export interface TransitionRenderStyle {
  opacity: number;
  transform: string;
  filter: string;
}

const IDENTITY: TransitionRenderStyle = { opacity: 1, transform: "", filter: "" };

/**
 * Visually distinct rendering for each of the 12 transition types. `progress`
 * is 0..1 within the transition window; `direction: "in"` fades/slides the
 * incoming clip in from `progress=0`, `direction: "out"` fades/slides the
 * outgoing clip away toward `progress=1`. Kept intentionally restrained —
 * "avoid cheesy effects" per product spec — every transition is opacity,
 * blur, or translate, nothing gimmicky.
 */
export function getTransitionStyle(
  type: TransitionType,
  progress: number,
  direction: "in" | "out",
): TransitionRenderStyle {
  const p = Math.max(0, Math.min(1, progress));

  switch (type) {
    case "LUXURY_FADE":
    case "FILM_DISSOLVE":
      return direction === "in" ? { ...IDENTITY, opacity: p } : { ...IDENTITY, opacity: 1 - p };

    case "LIGHT_LEAK":
      return direction === "in"
        ? { opacity: p, transform: "", filter: `brightness(${1 + (1 - p) * 0.6})` }
        : { opacity: 1 - p, transform: "", filter: `brightness(${1 + p * 0.6})` };

    case "LENS_FLARE":
      return direction === "in"
        ? { opacity: p, transform: `scale(${1 + (1 - p) * 0.04})`, filter: `brightness(${1 + (1 - p) * 0.4})` }
        : { opacity: 1 - p, transform: `scale(${1 + p * 0.04})`, filter: `brightness(${1 + p * 0.4})` };

    case "WHIP":
      return direction === "in"
        ? { opacity: 1, transform: `translateX(${(1 - p) * 100}%)`, filter: `blur(${(1 - p) * 14}px)` }
        : { opacity: 1, transform: `translateX(${-p * 100}%)`, filter: `blur(${p * 14}px)` };

    case "MOTION_BLUR":
      return direction === "in"
        ? { opacity: p, transform: `translateX(${(1 - p) * 30}%)`, filter: `blur(${(1 - p) * 10}px)` }
        : { opacity: 1 - p, transform: `translateX(${-p * 30}%)`, filter: `blur(${p * 10}px)` };

    case "PUSH":
      return direction === "in"
        ? { ...IDENTITY, transform: `translateX(${(1 - p) * 100}%)` }
        : { ...IDENTITY, transform: `translateX(${-p * 100}%)` };

    case "SLIDE":
      return direction === "in"
        ? { ...IDENTITY, transform: `translateY(${(1 - p) * 100}%)` }
        : { ...IDENTITY, transform: `translateY(${-p * 15}%)`, opacity: 1 - p * 0.3 };

    case "PARALLAX_TRANSITION":
      return direction === "in"
        ? { opacity: p, transform: `translateX(${(1 - p) * 40}%) scale(${1 + (1 - p) * 0.08})`, filter: "" }
        : { opacity: 1 - p, transform: `translateX(${-p * 15}%) scale(${1 - p * 0.03})`, filter: "" };

    case "WHITE_FLASH":
      return direction === "in"
        ? { opacity: p, transform: "", filter: `brightness(${1 + (1 - p) * 3})` }
        : { opacity: 1 - p, transform: "", filter: `brightness(${1 + p * 3})` };

    case "BLUR":
      return direction === "in"
        ? { opacity: p, transform: "", filter: `blur(${(1 - p) * 20}px)` }
        : { opacity: 1 - p, transform: "", filter: `blur(${p * 20}px)` };

    case "CAMERA_MATCH":
      // A true match cut: near-instant, no visible effect — continuity comes from the camera moves themselves.
      return direction === "in" ? { ...IDENTITY, opacity: p > 0.5 ? 1 : 0 } : { ...IDENTITY, opacity: p > 0.5 ? 0 : 1 };

    default:
      return IDENTITY;
  }
}
