import { z } from "zod";

/**
 * The full easing vocabulary shared by camera moves and transitions.
 * Beyond the four standard CSS-style curves, the cinematic ones encode a
 * specific physical intent (see packages/video-engine/src/easing.ts for the
 * exact cubic-bezier control points) so a "real camera operator" feel —
 * acceleration, momentum, a natural stop — comes from the curve itself
 * rather than from tuning individual clips by hand:
 *   - cinematicEaseInOut: pronounced smooth accelerate-then-decelerate,
 *     heavier / more deliberate than standard easeInOut — the default for
 *     dolly-style moves (push/pull/truck).
 *   - momentumOut: starts at speed (as if already moving) and settles to a
 *     natural stop — for moves that should feel like they're "arriving"
 *     (hero push, reveals).
 *   - gentleDrift: barely-eased, near-linear but not mechanical — for
 *     micro-movements that must not draw attention to themselves.
 *   - craneEase: strong deceleration at the end, like a physical crane arm
 *     losing momentum at the top of its rise — for crane/drone rises.
 */
export const EASING_CURVES = [
  "linear",
  "easeInOut",
  "easeOutCubic",
  "easeInCubic",
  "cinematicEaseInOut",
  "momentumOut",
  "gentleDrift",
  "craneEase",
] as const;

export const EasingCurveSchema = z.enum(EASING_CURVES);
export type EasingCurve = z.infer<typeof EasingCurveSchema>;
