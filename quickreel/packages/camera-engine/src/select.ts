import type { CameraMove, CameraMoveType, RoomType, StyleConfig } from "@quickreel/shared";
import { weightedPick } from "@quickreel/shared";
import { getMovementDef } from "./movements.js";

/** Same movement type used more than this many times across one reel starts to feel repetitive. */
export const MAX_MOVEMENT_REPEATS = 2;

/** Tracks how many times each movement has been used so far in the current render. */
export type MovementUsageCounts = Partial<Record<CameraMoveType, number>>;

export function createUsageCounts(): MovementUsageCounts {
  return {};
}

export interface SelectCameraMoveInput {
  roomType: RoomType;
  style: StyleConfig;
  rng: () => number;
  usageCounts: MovementUsageCounts;
}

/**
 * Picks a camera movement for one clip: weighted-random within the style's
 * per-room bias table, seeded for reproducibility, with a "never repeat
 * more than twice per reel" constraint. When every biased option has
 * already hit the cap (a room type with many more clips than the style
 * has assigned movements for it — mathematically the cap can't hold),
 * degrades to the least-used option(s) rather than falling back to the
 * full pool, so repetition stays as evenly spread as possible instead of
 * concentrating on whichever movement wins the first post-cap pick.
 */
export function selectCameraMove(input: SelectCameraMoveInput): CameraMove {
  const { roomType, style, rng, usageCounts } = input;
  const biasEntries = style.cameraMovementBias[roomType]?.length
    ? style.cameraMovementBias[roomType]!
    : style.defaultCameraMoves;

  const underCap = biasEntries.filter((e) => (usageCounts[e.type] ?? 0) < MAX_MOVEMENT_REPEATS);
  const pool = underCap.length > 0 ? underCap : leastUsed(biasEntries, usageCounts);

  const picked =
    weightedPick(
      pool.map((e) => ({ item: e.type, weight: e.weight })),
      rng,
    ) ?? (biasEntries[0]?.type as CameraMoveType);

  usageCounts[picked] = (usageCounts[picked] ?? 0) + 1;

  const def = getMovementDef(picked);
  return {
    type: picked,
    startScale: def.scaleRange[0],
    endScale: def.scaleRange[1],
    startFocalPoint: def.startFocalPoint,
    endFocalPoint: def.endFocalPoint,
    easing: def.defaultEasing,
    intensity: style.motionIntensity,
  };
}

function leastUsed<T extends { type: CameraMoveType }>(entries: T[], usageCounts: MovementUsageCounts): T[] {
  const min = Math.min(...entries.map((e) => usageCounts[e.type] ?? 0));
  return entries.filter((e) => (usageCounts[e.type] ?? 0) === min);
}
