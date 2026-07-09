import { z } from "zod";

/**
 * The output of audio analysis (apps/ai-service's librosa endpoint, wrapped
 * by packages/beat-engine). This is the timing skeleton every clip boundary,
 * camera move, and transition in the EDL is snapped to.
 */
export const BeatGridSchema = z.object({
  bpm: z.number().positive(),
  beatsPerBar: z.number().int().positive().default(4),
  /** Every detected onset, in ms from track start. */
  beatTimestampsMs: z.array(z.number().nonnegative()),
  /** Downbeat subset of beatTimestampsMs — one per bar. */
  barStartTimestampsMs: z.array(z.number().nonnegative()),
  /** Resampled energy envelope, ~10 samples/sec, normalized 0..1. */
  energyCurve: z.array(
    z.object({
      tMs: z.number().nonnegative(),
      energy: z.number().min(0).max(1),
    }),
  ),
  sections: z.object({
    intro: z.object({ startMs: z.number(), endMs: z.number() }),
    buildUp: z.object({ startMs: z.number(), endMs: z.number() }).nullable(),
    /** Heuristic peak-derivative pick; null when no clear drop is detected. */
    drop: z.object({ atMs: z.number() }).nullable(),
    body: z.object({ startMs: z.number(), endMs: z.number() }),
    outro: z.object({ startMs: z.number(), endMs: z.number() }),
  }),
  durationMs: z.number().positive(),
  sourceTrackId: z.string(),
  /** Bump when the analysis algorithm changes to invalidate cached grids. */
  analysisVersion: z.string(),
});
export type BeatGrid = z.infer<typeof BeatGridSchema>;

export const CURRENT_BEAT_ANALYSIS_VERSION = "beat-engine-v1";

/**
 * Given a target timestamp, returns the nearest beat timestamp (and its
 * index) in the grid — the core "snap to beat" primitive used everywhere a
 * clip boundary or transition needs to land exactly on a beat.
 */
export function nearestBeat(
  grid: Pick<BeatGrid, "beatTimestampsMs">,
  targetMs: number,
): { index: number; timestampMs: number } {
  const beats = grid.beatTimestampsMs;
  if (beats.length === 0) {
    return { index: -1, timestampMs: targetMs };
  }

  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((beats[mid] as number) < targetMs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const candidates = [lo - 1, lo].filter((i) => i >= 0 && i < beats.length);
  let best = candidates[0] as number;
  for (const i of candidates) {
    if (Math.abs((beats[i] as number) - targetMs) < Math.abs((beats[best] as number) - targetMs)) {
      best = i;
    }
  }
  return { index: best, timestampMs: beats[best] as number };
}

/** The energy value at (or nearest sample before) a given timestamp. */
export function energyAt(grid: Pick<BeatGrid, "energyCurve">, tMs: number): number {
  const curve = grid.energyCurve;
  if (curve.length === 0) return 0.5;
  let result = curve[0] as { tMs: number; energy: number };
  for (const sample of curve) {
    if (sample.tMs > tMs) break;
    result = sample;
  }
  return result.energy;
}
