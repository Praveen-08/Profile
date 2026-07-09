import { nearestBeat, type BeatGrid, type CutSpeedCurve, type RoomType } from "@quickreel/shared";
import type { ClipBeatAllocation } from "@quickreel/timing-engine";

export interface ClipTiming {
  imageId: string;
  roomType: RoomType;
  startMs: number;
  endMs: number;
  durationMs: number;
  beatIndexStart: number;
  beatIndexEnd: number;
}

/** Floor enforced after snapping so two boundaries that land on the same beat never produce a zero/negative-length clip. */
const MIN_CLIP_DURATION_MS = 150;

function msPerBeat(beatGrid: BeatGrid): number {
  return 60000 / beatGrid.bpm;
}

/**
 * The core beat-engine algorithm: converts tempo-independent beat budgets
 * (packages/timing-engine's output) into exact, beat-snapped millisecond
 * boundaries on a specific track's BeatGrid, guaranteeing the total lands
 * exactly on `targetTotalMs` (the reel length is a hard product
 * requirement — the individual cut points are what flex to the beat).
 *
 * Three passes:
 *  1. Raw ms per clip from targetBeats, with the style's drop-acceleration
 *     rule applied once we know (from an unaccelerated estimate) which
 *     clip crosses the drop.
 *  2. Uniform proportional scale so the raw total matches targetTotalMs
 *     exactly, preserving relative pacing (hero clips stay longest).
 *  3. Snap every interior boundary to the nearest beat (or bar-start, if
 *     the style demands downbeat-only cuts), nudging forward on collision
 *     so no clip ever collapses to ~0ms.
 */
export function computeClipBoundaries(
  allocations: ClipBeatAllocation[],
  beatGrid: BeatGrid,
  targetTotalMs: number,
  cutSpeedCurve: CutSpeedCurve,
  syncCutsToDownbeatOnly: boolean,
): ClipTiming[] {
  if (allocations.length === 0) return [];

  const beatMs = msPerBeat(beatGrid);
  const rawDurationsMs = allocations.map((a) => a.targetBeats * beatMs);

  if (cutSpeedCurve.accelerateOnDrop && beatGrid.sections.drop) {
    const dropAtMs = beatGrid.sections.drop.atMs;
    let cumulative = 0;
    let dropClipIndex = -1;
    for (let i = 0; i < rawDurationsMs.length; i++) {
      if (cumulative >= dropAtMs) {
        dropClipIndex = i;
        break;
      }
      cumulative += rawDurationsMs[i]!;
    }
    if (dropClipIndex >= 0) {
      for (let i = dropClipIndex; i < rawDurationsMs.length; i++) {
        rawDurationsMs[i] = rawDurationsMs[i]! * cutSpeedCurve.accelerationFactor;
      }
    }
  }

  const sumRawMs = rawDurationsMs.reduce((sum, d) => sum + d, 0);
  const scaleFactor = sumRawMs > 0 ? targetTotalMs / sumRawMs : 1;
  const scaledDurationsMs = rawDurationsMs.map((d) => d * scaleFactor);

  const idealBoundaries: number[] = [0];
  let cursor = 0;
  for (const d of scaledDurationsMs) {
    cursor += d;
    idealBoundaries.push(cursor);
  }
  idealBoundaries[idealBoundaries.length - 1] = targetTotalMs;

  const snapTargets = syncCutsToDownbeatOnly && beatGrid.barStartTimestampsMs.length > 0
    ? beatGrid.barStartTimestampsMs
    : beatGrid.beatTimestampsMs;

  const snappedBoundaries: number[] = [0];
  for (let i = 1; i < idealBoundaries.length - 1; i++) {
    const snapped = snapToGrid(snapTargets, idealBoundaries[i]!);
    const previous = snappedBoundaries[snappedBoundaries.length - 1]!;
    snappedBoundaries.push(Math.max(snapped, previous + MIN_CLIP_DURATION_MS));
  }
  snappedBoundaries.push(targetTotalMs);

  // A final nudge pass in case the previous+MIN_CLIP_DURATION_MS fallback pushed a boundary past the next one.
  for (let i = 1; i < snappedBoundaries.length - 1; i++) {
    if (snappedBoundaries[i]! >= snappedBoundaries[i + 1]!) {
      snappedBoundaries[i] = snappedBoundaries[i + 1]! - MIN_CLIP_DURATION_MS;
    }
  }

  return allocations.map((allocation, i) => {
    const startMs = Math.max(0, snappedBoundaries[i]!);
    const endMs = snappedBoundaries[i + 1]!;
    return {
      imageId: allocation.imageId,
      roomType: allocation.roomType,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      beatIndexStart: nearestBeat(beatGrid, startMs).index,
      beatIndexEnd: nearestBeat(beatGrid, endMs).index,
    };
  });
}

function snapToGrid(sortedTimestamps: number[], targetMs: number): number {
  if (sortedTimestamps.length === 0) return targetMs;
  let lo = 0;
  let hi = sortedTimestamps.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sortedTimestamps[mid]! < targetMs) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [lo - 1, lo].filter((i) => i >= 0 && i < sortedTimestamps.length);
  let best = candidates[0]!;
  for (const i of candidates) {
    if (Math.abs(sortedTimestamps[i]! - targetMs) < Math.abs(sortedTimestamps[best]! - targetMs)) {
      best = i;
    }
  }
  return sortedTimestamps[best]!;
}
