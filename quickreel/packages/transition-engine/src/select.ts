import type { RoomType, StyleConfig, TransitionSpec, TransitionType } from "@quickreel/shared";
import { weightedPick } from "@quickreel/shared";
import { getTransitionDef } from "./catalog.js";
import { lookupRelationshipRule, type StoryPosition } from "./relationships.js";

export const MAX_TRANSITION_REPEATS = 3;

export type TransitionUsageCounts = Partial<Record<TransitionType, number>>;

export function createTransitionUsageCounts(): TransitionUsageCounts {
  return {};
}

export interface SelectTransitionInput {
  fromRoomType: RoomType;
  toRoomType: StoryPosition;
  style: StyleConfig;
  rng: () => number;
  usageCounts: TransitionUsageCounts;
  /** The immediately preceding transition's type, if any — used to avoid back-to-back repeats. */
  previousType?: TransitionType;
}

function resolveDurationMs(type: TransitionType, maxDurationMs: number): number {
  const [min, max] = getTransitionDef(type).durationRangeMs;
  return Math.max(min, Math.min(max, maxDurationMs));
}

function styleAllows(style: StyleConfig, type: TransitionType): boolean {
  return style.transitionSet.some((e) => e.type === type);
}

/**
 * Chooses the transition for one clip boundary. Curated room-relationship
 * pairs (relationships.ts) take priority when the active style permits
 * that transition type; otherwise falls back to a weighted-random pick
 * from the style's transition set, respecting a per-reel repeat cap and
 * softly avoiding an immediate back-to-back repeat of the same effect.
 */
export function selectTransition(input: SelectTransitionInput): TransitionSpec {
  const { fromRoomType, toRoomType, style, rng, usageCounts, previousType } = input;

  const curated = lookupRelationshipRule(fromRoomType, toRoomType);
  if (curated && styleAllows(style, curated) && (usageCounts[curated] ?? 0) < MAX_TRANSITION_REPEATS) {
    const entry = style.transitionSet.find((e) => e.type === curated)!;
    usageCounts[curated] = (usageCounts[curated] ?? 0) + 1;
    return {
      type: curated,
      durationMs: resolveDurationMs(curated, entry.maxDurationMs),
      easing: getTransitionDef(curated).defaultEasing,
    };
  }

  const underCap = style.transitionSet.filter((e) => (usageCounts[e.type] ?? 0) < MAX_TRANSITION_REPEATS);
  let pool = underCap.length > 0 ? underCap : style.transitionSet;

  if (previousType && pool.length > 1) {
    const withoutPrevious = pool.filter((e) => e.type !== previousType);
    if (withoutPrevious.length > 0) pool = withoutPrevious;
  }

  const picked =
    weightedPick(
      pool.map((e) => ({ item: e, weight: e.weight })),
      rng,
    ) ?? style.transitionSet[0]!;

  usageCounts[picked.type] = (usageCounts[picked.type] ?? 0) + 1;
  return {
    type: picked.type,
    durationMs: resolveDurationMs(picked.type, picked.maxDurationMs),
    easing: getTransitionDef(picked.type).defaultEasing,
  };
}
