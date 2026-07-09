import { describe, expect, it } from "vitest";
import type { BeatGrid, EditDecisionList, StyleConfig } from "@quickreel/shared";
import { scoreReel } from "./score.js";

const style: StyleConfig = {
  slug: "test-luxury",
  name: "Test Luxury",
  description: "",
  defaultCameraMoves: [{ type: "SLOW_PUSH", weight: 1 }],
  cameraMovementBias: {},
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
  motionIntensity: 0.4,
  preferredHookArchetypes: ["BEST_EXTERIOR_QUICK_ZOOM"],
  atmosphericEffectsEnabled: true,
};

const beatGrid: BeatGrid = {
  bpm: 96,
  beatsPerBar: 4,
  beatTimestampsMs: [0, 625, 1250, 1875, 2500, 3125, 3750, 4375, 5000, 5625, 6250, 6875, 7500],
  barStartTimestampsMs: [0, 2500, 5000, 7500],
  energyCurve: [{ tMs: 0, energy: 0.5 }],
  sections: {
    intro: { startMs: 0, endMs: 2500 },
    buildUp: null,
    drop: null,
    body: { startMs: 2500, endMs: 7500 },
    outro: { startMs: 6875, endMs: 7500 },
  },
  durationMs: 7500,
  sourceTrackId: "test-track",
  analysisVersion: "beat-v1",
};

function makeClip(overrides: Partial<EditDecisionList["clips"][number]>): EditDecisionList["clips"][number] {
  return {
    clipIndex: 0,
    imageId: "img-1",
    imageStorageKey: "img-1.jpg",
    roomType: "EXTERIOR_FRONT",
    startMs: 0,
    endMs: 2500,
    durationMs: 2500,
    beatIndexStart: 0,
    beatIndexEnd: 4,
    camera: {
      type: "HERO_PUSH",
      startScale: 1,
      endScale: 1.12,
      startFocalPoint: { x: 0.5, y: 0.5 },
      endFocalPoint: { x: 0.5, y: 0.46 },
      easing: "momentumOut",
      intensity: 0.6,
    },
    transitionIn: { type: "LUXURY_FADE", durationMs: 600, easing: "easeInOut" },
    transitionOut: { type: "LUXURY_FADE", durationMs: 600, easing: "easeInOut" },
    textOverlays: [],
    depth: null,
    atmosphericEffect: null,
    ...overrides,
  };
}

function makeEdl(clips: EditDecisionList["clips"]): EditDecisionList {
  const totalDurationMs = clips.length > 0 ? clips[clips.length - 1]!.endMs : 0;
  return {
    version: "edl-v3",
    projectId: "project-1",
    renderId: "render-1",
    compositionWidth: 1080,
    compositionHeight: 1920,
    fps: 30,
    totalDurationMs,
    styleSlug: style.slug,
    hookArchetype: "BEST_EXTERIOR_QUICK_ZOOM",
    musicTrackId: "track-1",
    beatGrid,
    clips,
    audio: { trackStorageKey: "track.wav", startOffsetMs: 0 },
    brandKit: null,
  };
}

describe("scoreReel", () => {
  it("scores a well-paced, beat-synced, diverse reel highly", () => {
    const clips = [
      makeClip({ clipIndex: 0, roomType: "EXTERIOR_FRONT", startMs: 0, endMs: 2500, durationMs: 2500 }),
      makeClip({
        clipIndex: 1,
        roomType: "LIVING_ROOM",
        startMs: 2500,
        endMs: 5000,
        durationMs: 2500,
        camera: { ...makeClip({}).camera, type: "SLOW_PUSH", easing: "cinematicEaseInOut" },
      }),
      makeClip({
        clipIndex: 2,
        roomType: "KITCHEN",
        startMs: 5000,
        endMs: 7500,
        durationMs: 2500,
        camera: { ...makeClip({}).camera, type: "REVEAL", easing: "craneEase" },
      }),
    ];
    const edl = makeEdl(clips);

    const score = scoreReel({ edl, beatGrid, style });

    expect(score.scoreVersion).toBe("score-v1");
    expect(score.beatSyncScore).toBeGreaterThan(80);
    expect(score.storytellingScore).toBeGreaterThan(70);
    expect(score.motionQualityScore).toBeGreaterThan(70);
    expect(score.overallScore).toBeGreaterThan(60);
    expect(score.recommendations).toHaveLength(0);
  });

  it("flags a weak hook, off-beat cuts, and repeated movement", () => {
    const repeatedCamera = { ...makeClip({}).camera, type: "SLOW_PUSH" as const, easing: "linear" as const };
    const clips = [
      makeClip({ clipIndex: 0, roomType: "BATHROOM", startMs: 0, endMs: 400, durationMs: 400, camera: repeatedCamera }),
      makeClip({
        clipIndex: 1,
        roomType: "BATHROOM",
        startMs: 400,
        endMs: 4400,
        durationMs: 4000,
        camera: repeatedCamera,
      }),
      makeClip({
        clipIndex: 2,
        roomType: "BATHROOM",
        startMs: 4400,
        endMs: 8400,
        durationMs: 4000,
        camera: repeatedCamera,
      }),
    ];
    const edl = makeEdl(clips);

    const score = scoreReel({ edl, beatGrid, style });

    expect(score.recommendations.some((r) => r.includes("hook"))).toBe(true);
    expect(score.recommendations.some((r) => r.includes("bathroom"))).toBe(true);
    expect(score.recommendations.some((r) => r.includes("repeating"))).toBe(true);
  });

  it("never produces scores outside 0..100", () => {
    const edl = makeEdl([makeClip({})]);
    const score = scoreReel({ edl, beatGrid, style });

    for (const value of [
      score.storytellingScore,
      score.beatSyncScore,
      score.luxuryScore,
      score.motionQualityScore,
      score.viewerRetentionPrediction,
      score.socialMediaScore,
      score.overallScore,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
