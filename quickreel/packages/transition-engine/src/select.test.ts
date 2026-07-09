import { describe, expect, it } from "vitest";
import type { StyleConfig } from "@quickreel/shared";
import { createSeededRng } from "@quickreel/shared";
import { createTransitionUsageCounts, MAX_TRANSITION_REPEATS, selectTransition } from "./select.js";

const style: StyleConfig = {
  slug: "test-style",
  name: "Test Style",
  description: "",
  defaultCameraMoves: [{ type: "SLOW_PUSH", weight: 1 }],
  cameraMovementBias: {},
  transitionSet: [
    { type: "CAMERA_MATCH", weight: 0.5, maxDurationMs: 150 },
    { type: "LUXURY_FADE", weight: 0.3, maxDurationMs: 800 },
    { type: "PUSH", weight: 0.2, maxDurationMs: 400 },
  ],
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

describe("selectTransition", () => {
  it("prefers the curated relationship rule when the style allows it", () => {
    const rng = createSeededRng("seed-1");
    const usageCounts = createTransitionUsageCounts();
    const spec = selectTransition({ fromRoomType: "KITCHEN", toRoomType: "DINING", style, rng, usageCounts });
    expect(spec.type).toBe("CAMERA_MATCH");
    expect(spec.durationMs).toBeLessThanOrEqual(150);
  });

  it("respects the per-reel repeat cap", () => {
    const rng = createSeededRng("seed-2");
    const usageCounts = createTransitionUsageCounts();
    for (let i = 0; i < MAX_TRANSITION_REPEATS; i++) {
      selectTransition({ fromRoomType: "KITCHEN", toRoomType: "DINING", style, rng, usageCounts });
    }
    const next = selectTransition({ fromRoomType: "KITCHEN", toRoomType: "DINING", style, rng, usageCounts });
    expect(next.type).not.toBe("CAMERA_MATCH");
  });

  it("falls back to weighted pick for uncurated pairs", () => {
    const rng = createSeededRng("seed-3");
    const usageCounts = createTransitionUsageCounts();
    const spec = selectTransition({ fromRoomType: "BEDROOM", toRoomType: "OFFICE", style, rng, usageCounts });
    expect(["CAMERA_MATCH", "LUXURY_FADE", "PUSH"]).toContain(spec.type);
  });
});
