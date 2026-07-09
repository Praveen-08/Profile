import { describe, expect, it } from "vitest";
import type { StyleConfig } from "@quickreel/shared";
import { createSeededRng } from "@quickreel/shared";
import { createUsageCounts, MAX_MOVEMENT_REPEATS, selectCameraMove } from "./select.js";

const style: StyleConfig = {
  slug: "test-style",
  name: "Test Style",
  description: "",
  defaultCameraMoves: [{ type: "SLOW_PUSH", weight: 1 }],
  cameraMovementBias: {
    LIVING_ROOM: [
      { type: "SLOW_PUSH", weight: 0.6 },
      { type: "PARALLAX", weight: 0.4 },
    ],
  },
  transitionSet: [],
  typography: {
    fontFamily: "Inter",
    headlineWeight: 600,
    accentColor: "#fff",
    animationPreset: "fadeUp",
    overlayPositions: {},
  },
  cutSpeedCurve: {
    baseClipDurationBeats: 4,
    heroClipDurationBeats: 6,
    detailClipDurationBeats: 3,
    accelerateOnDrop: true,
    accelerationFactor: 0.75,
  },
  musicBehavior: { syncCutsToDownbeatOnly: true, alignHeroRevealToDrop: true, outroHoldOnLogoBeats: 2 },
  motionIntensity: 0.8,
  preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM"],
};

describe("selectCameraMove", () => {
  it("respects the repeat cap while the biased pool can still satisfy it", () => {
    const rng = createSeededRng("render-123");
    const usageCounts = createUsageCounts();
    // 4 picks against a 2-movement pool (cap 2 each) is exactly satisfiable.
    const picks = Array.from({ length: 4 }, () =>
      selectCameraMove({ roomType: "LIVING_ROOM", style, rng, usageCounts }).type,
    );
    const counts: Record<string, number> = {};
    for (const p of picks) counts[p] = (counts[p] ?? 0) + 1;
    for (const count of Object.values(counts)) {
      expect(count).toBeLessThanOrEqual(MAX_MOVEMENT_REPEATS);
    }
  });

  it("degrades to an even spread (rather than spamming one movement) once the pool is exhausted", () => {
    const rng = createSeededRng("render-123");
    const usageCounts = createUsageCounts();
    // 12 picks against a 2-movement pool can't honor the cap (needs 6 uses/movement at minimum) —
    // the least-used-first degrade strategy should still spread as evenly as mathematically possible.
    const picks = Array.from({ length: 12 }, () =>
      selectCameraMove({ roomType: "LIVING_ROOM", style, rng, usageCounts }).type,
    );
    const counts: Record<string, number> = {};
    for (const p of picks) counts[p] = (counts[p] ?? 0) + 1;
    const poolSize = 2;
    const maxPossibleEvenSpread = Math.ceil(picks.length / poolSize);
    for (const count of Object.values(counts)) {
      expect(count).toBeLessThanOrEqual(maxPossibleEvenSpread);
    }
  });

  it("is deterministic for a given seed", () => {
    const runOnce = () => {
      const rng = createSeededRng("render-abc");
      const usageCounts = createUsageCounts();
      return Array.from({ length: 5 }, () => selectCameraMove({ roomType: "LIVING_ROOM", style, rng, usageCounts }).type);
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it("falls back to defaultCameraMoves for an unbiased room type", () => {
    const rng = createSeededRng("render-xyz");
    const usageCounts = createUsageCounts();
    const move = selectCameraMove({ roomType: "OFFICE", style, rng, usageCounts });
    expect(move.type).toBe("SLOW_PUSH");
  });
});
