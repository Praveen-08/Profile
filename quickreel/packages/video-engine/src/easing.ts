import { Easing } from "remotion";
import type { EasingCurve } from "@quickreel/shared";

/**
 * Cubic-bezier control points for each named curve in
 * packages/shared/src/easing.ts — chosen to encode a specific physical
 * feel (acceleration, momentum, a natural stop) rather than an arbitrary
 * "nice-looking" curve. See that file's doc comment for the intent behind
 * each cinematic curve.
 */
const EASING_FNS: Record<EasingCurve, (t: number) => number> = {
  linear: Easing.linear,
  easeInOut: Easing.inOut(Easing.ease),
  easeOutCubic: Easing.out(Easing.cubic),
  easeInCubic: Easing.in(Easing.cubic),
  cinematicEaseInOut: Easing.bezier(0.65, 0, 0.35, 1),
  momentumOut: Easing.bezier(0.16, 1, 0.3, 1),
  gentleDrift: Easing.bezier(0.37, 0, 0.63, 1),
  craneEase: Easing.bezier(0.22, 1, 0.36, 1),
};

export function resolveEasing(name: string): (t: number) => number {
  return EASING_FNS[name as EasingCurve] ?? Easing.linear;
}
