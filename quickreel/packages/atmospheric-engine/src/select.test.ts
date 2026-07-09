import { describe, expect, it } from "vitest";
import type { StyleConfig } from "@quickreel/shared";
import { createSeededRng } from "@quickreel/shared";
import { selectAtmosphericEffect } from "./select.js";

function makeStyle(atmosphericEffectsEnabled: boolean): StyleConfig {
  return {
    slug: "test",
    name: "Test",
    description: "",
    defaultCameraMoves: [{ type: "SLOW_PUSH", weight: 1 }],
    cameraMovementBias: {},
    transitionSet: [{ type: "LUXURY_FADE", weight: 1, maxDurationMs: 800 }],
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
    motionIntensity: 0.6,
    preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM"],
    atmosphericEffectsEnabled,
  };
}

describe("selectAtmosphericEffect", () => {
  it("never selects an effect for styles with atmosphericEffectsEnabled=false", () => {
    const style = makeStyle(false);
    const rng = createSeededRng("seed");
    for (let i = 0; i < 50; i++) {
      expect(selectAtmosphericEffect({ roomType: "EXTERIOR_FRONT", style, rng })).toBeNull();
    }
  });

  it("never selects an effect for a room type with no defined options", () => {
    const style = makeStyle(true);
    const rng = createSeededRng("seed");
    for (let i = 0; i < 50; i++) {
      expect(selectAtmosphericEffect({ roomType: "BATHROOM", style, rng })).toBeNull();
    }
  });

  it("selects effects for an eligible room+style less than half the time (never overuse)", () => {
    const style = makeStyle(true);
    const rng = createSeededRng("seed-freq");
    let selected = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      if (selectAtmosphericEffect({ roomType: "EXTERIOR_FRONT", style, rng })) selected++;
    }
    expect(selected / trials).toBeLessThan(0.5);
    expect(selected).toBeGreaterThan(0);
  });

  it("only returns effect types valid for the given room", () => {
    const style = makeStyle(true);
    const rng = createSeededRng("seed-pool");
    for (let i = 0; i < 100; i++) {
      const effect = selectAtmosphericEffect({ roomType: "POOL", style, rng });
      if (effect) expect(effect.type).toBe("REFLECTION_SHIMMER");
    }
  });

  it("keeps intensity in the subtle range", () => {
    const style = makeStyle(true);
    const rng = createSeededRng("seed-intensity");
    for (let i = 0; i < 100; i++) {
      const effect = selectAtmosphericEffect({ roomType: "TWILIGHT", style, rng });
      if (effect) {
        expect(effect.intensity).toBeGreaterThanOrEqual(0.06);
        expect(effect.intensity).toBeLessThanOrEqual(0.16);
      }
    }
  });
});
