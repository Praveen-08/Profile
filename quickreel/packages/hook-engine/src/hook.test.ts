import { describe, expect, it } from "vitest";
import type { StyleConfig } from "@quickreel/shared";
import { buildFeasibleHookPlans } from "./archetypes.js";
import { rankHookPlans, selectDefaultHook } from "./select.js";
import { applyHookToStoryOrder } from "./apply.js";
import type { HookCandidateImage } from "./types.js";

const images: HookCandidateImage[] = [
  { imageId: "ext-1", roomType: "EXTERIOR_FRONT", qualityScore: 0.9, isHero: true, isSecondHero: false },
  { imageId: "living-1", roomType: "LIVING_ROOM", qualityScore: 0.8, isHero: false, isSecondHero: false },
  { imageId: "kitchen-1", roomType: "KITCHEN", qualityScore: 0.75, isHero: false, isSecondHero: false },
  { imageId: "bath-1", roomType: "BATHROOM", qualityScore: 0.6, isHero: false, isSecondHero: false },
];

function makeStyle(preferredHookArchetypes: string[]): StyleConfig {
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
    motionIntensity: 0.8,
    preferredHookArchetypes,
    atmosphericEffectsEnabled: true,
  };
}

describe("hook-engine", () => {
  it("omits DRONE_FIRST and TWILIGHT_REVEAL when no drone/twilight photo exists", () => {
    const plans = buildFeasibleHookPlans(images);
    const archetypes = plans.map((p) => p.archetype);
    expect(archetypes).not.toContain("DRONE_FIRST");
    expect(archetypes).not.toContain("TWILIGHT_REVEAL");
    expect(archetypes).toContain("BEST_EXTERIOR_QUICK_ZOOM");
    expect(archetypes).toContain("LUXURY_INTERIOR_FIRST");
  });

  it("ranks by the style's preferred archetype order first", () => {
    const style = makeStyle(["LUXURY_INTERIOR_FIRST", "BEST_EXTERIOR_QUICK_ZOOM"]);
    const ranked = rankHookPlans(images, style);
    expect(ranked[0]!.archetype).toBe("LUXURY_INTERIOR_FIRST");
  });

  it("falls back to quality score when style has no preference for feasible archetypes", () => {
    const style = makeStyle(["DRONE_FIRST"]); // infeasible for this photo set
    const best = selectDefaultHook(images, style);
    // ext-1 (0.9) should outrank living-1 (0.8) among the remaining exterior/interior options
    expect(best?.archetype).toBe("BEST_EXTERIOR_QUICK_ZOOM");
  });

  it("splices the hook's opening images to the front without duplicating", () => {
    const storyOrder = ["kitchen-1", "living-1", "ext-1", "bath-1"];
    const hook = buildFeasibleHookPlans(images).find((p) => p.archetype === "BEST_EXTERIOR_QUICK_ZOOM")!;
    const result = applyHookToStoryOrder(storyOrder, hook);
    expect(result[0]).toBe("ext-1");
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
  });
});
