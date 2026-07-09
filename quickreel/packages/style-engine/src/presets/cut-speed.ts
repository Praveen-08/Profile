import type { CutSpeedCurve } from "@quickreel/shared";

export const SLOW_CUT_SPEED: CutSpeedCurve = {
  baseClipDurationBeats: 6,
  heroClipDurationBeats: 8,
  detailClipDurationBeats: 4,
  accelerateOnDrop: false,
  accelerationFactor: 0.85,
};

export const MEDIUM_CUT_SPEED: CutSpeedCurve = {
  baseClipDurationBeats: 4,
  heroClipDurationBeats: 6,
  detailClipDurationBeats: 3,
  accelerateOnDrop: true,
  accelerationFactor: 0.8,
};

export const FAST_CUT_SPEED: CutSpeedCurve = {
  baseClipDurationBeats: 2.5,
  heroClipDurationBeats: 4,
  detailClipDurationBeats: 2,
  accelerateOnDrop: true,
  accelerationFactor: 0.7,
};

export const VERY_FAST_CUT_SPEED: CutSpeedCurve = {
  baseClipDurationBeats: 1.5,
  heroClipDurationBeats: 2.5,
  detailClipDurationBeats: 1.25,
  accelerateOnDrop: true,
  accelerationFactor: 0.6,
};
