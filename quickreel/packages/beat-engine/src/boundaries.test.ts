import { describe, expect, it } from "vitest";
import type { BeatGrid, CutSpeedCurve } from "@quickreel/shared";
import type { ClipBeatAllocation } from "@quickreel/timing-engine";
import { computeClipBoundaries } from "./boundaries.js";

const BPM = 120;
const BEAT_MS = 60000 / BPM;

function makeBeatGrid(totalBeats: number, dropBeatIndex: number | null): BeatGrid {
  const beatTimestampsMs = Array.from({ length: totalBeats }, (_, i) => i * BEAT_MS);
  const barStartTimestampsMs = beatTimestampsMs.filter((_, i) => i % 4 === 0);
  return {
    bpm: BPM,
    beatsPerBar: 4,
    beatTimestampsMs,
    barStartTimestampsMs,
    energyCurve: [],
    sections: {
      intro: { startMs: 0, endMs: BEAT_MS * 4 },
      buildUp: null,
      drop: dropBeatIndex !== null ? { atMs: dropBeatIndex * BEAT_MS } : null,
      body: { startMs: BEAT_MS * 4, endMs: totalBeats * BEAT_MS },
      outro: { startMs: totalBeats * BEAT_MS - BEAT_MS * 4, endMs: totalBeats * BEAT_MS },
    },
    durationMs: totalBeats * BEAT_MS,
    sourceTrackId: "test-track",
    analysisVersion: "test-v1",
  };
}

const cutSpeedCurve: CutSpeedCurve = {
  baseClipDurationBeats: 4,
  heroClipDurationBeats: 6,
  detailClipDurationBeats: 2,
  accelerateOnDrop: false,
  accelerationFactor: 0.75,
};

const allocations: ClipBeatAllocation[] = [
  { imageId: "hero", roomType: "EXTERIOR_FRONT", targetBeats: 6, isHero: true },
  { imageId: "living", roomType: "LIVING_ROOM", targetBeats: 4, isHero: false },
  { imageId: "kitchen", roomType: "KITCHEN", targetBeats: 4, isHero: false },
  { imageId: "bath", roomType: "BATHROOM", targetBeats: 2, isHero: false },
];

describe("computeClipBoundaries", () => {
  it("starts at 0 and ends exactly at targetTotalMs", () => {
    const grid = makeBeatGrid(64, null);
    const targetTotalMs = 10000;
    const timings = computeClipBoundaries(allocations, grid, targetTotalMs, cutSpeedCurve, false);
    expect(timings[0]!.startMs).toBe(0);
    expect(timings.at(-1)!.endMs).toBe(targetTotalMs);
  });

  it("produces monotonically increasing, non-overlapping boundaries", () => {
    const grid = makeBeatGrid(64, null);
    const timings = computeClipBoundaries(allocations, grid, 10000, cutSpeedCurve, false);
    for (let i = 1; i < timings.length; i++) {
      expect(timings[i]!.startMs).toBeGreaterThanOrEqual(timings[i - 1]!.endMs);
    }
    for (const t of timings) {
      expect(t.durationMs).toBeGreaterThan(0);
    }
  });

  it("keeps the hero clip proportionally longer than base/detail clips", () => {
    const grid = makeBeatGrid(64, null);
    const timings = computeClipBoundaries(allocations, grid, 10000, cutSpeedCurve, false);
    const hero = timings.find((t) => t.imageId === "hero")!;
    const bath = timings.find((t) => t.imageId === "bath")!;
    expect(hero.durationMs).toBeGreaterThan(bath.durationMs);
  });

  it("shortens clips at and after the drop when accelerateOnDrop is set", () => {
    const grid = makeBeatGrid(64, 8); // drop at beat 8, i.e. after the hero+living clips (6+4=10 beats > 8)
    const accelerating: CutSpeedCurve = { ...cutSpeedCurve, accelerateOnDrop: true, accelerationFactor: 0.5 };
    const normal = computeClipBoundaries(allocations, grid, 10000, cutSpeedCurve, false);
    const accelerated = computeClipBoundaries(allocations, grid, 10000, accelerating, false);
    const normalKitchen = normal.find((t) => t.imageId === "kitchen")!;
    const acceleratedKitchen = accelerated.find((t) => t.imageId === "kitchen")!;
    expect(acceleratedKitchen.durationMs).toBeLessThan(normalKitchen.durationMs);
  });

  it("produces valid beat indices", () => {
    const grid = makeBeatGrid(64, null);
    const timings = computeClipBoundaries(allocations, grid, 10000, cutSpeedCurve, false);
    for (const t of timings) {
      expect(t.beatIndexStart).toBeGreaterThanOrEqual(0);
      expect(t.beatIndexEnd).toBeGreaterThanOrEqual(0);
      expect(t.beatIndexStart).toBeLessThan(grid.beatTimestampsMs.length);
    }
  });
});
