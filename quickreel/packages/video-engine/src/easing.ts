import { Easing } from "remotion";

export type EasingName = "linear" | "easeInOut" | "easeOutCubic" | "easeInCubic";

const EASING_FNS: Record<EasingName, (t: number) => number> = {
  linear: Easing.linear,
  easeInOut: Easing.inOut(Easing.ease),
  easeOutCubic: Easing.out(Easing.cubic),
  easeInCubic: Easing.in(Easing.cubic),
};

export function resolveEasing(name: string): (t: number) => number {
  return EASING_FNS[name as EasingName] ?? Easing.linear;
}
