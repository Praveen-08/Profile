import type { HookArchetype, StyleConfig } from "@quickreel/shared";
import { buildFeasibleHookPlans, type HookPlan } from "./archetypes.js";
import type { HookCandidateImage } from "./types.js";

/**
 * Ranks every feasible hook option for this photo set: style preference
 * order wins first (a style's `preferredHookArchetypes` encodes editorial
 * intent — e.g. "Luxury Twilight" prefers TWILIGHT_REVEAL), photo quality
 * breaks ties. Archetypes the style doesn't mention at all are still
 * offered (never hide an option from the user) but rank last.
 */
export function rankHookPlans(images: HookCandidateImage[], style: StyleConfig): HookPlan[] {
  const plans = buildFeasibleHookPlans(images);
  const preferenceIndex = new Map(style.preferredHookArchetypes.map((a, i) => [a, i]));

  return [...plans].sort((a, b) => {
    const aRank = preferenceIndex.get(a.archetype) ?? Number.MAX_SAFE_INTEGER;
    const bRank = preferenceIndex.get(b.archetype) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return b.qualityScore - a.qualityScore;
  });
}

/** The AI's chosen default — the top of the ranked list. Null only when no archetype is feasible (degenerate photo sets). */
export function selectDefaultHook(images: HookCandidateImage[], style: StyleConfig): HookPlan | null {
  return rankHookPlans(images, style)[0] ?? null;
}

/** Looks up a specific archetype for the "AI Preview -> quick adjustments" picker. Null if infeasible for this photo set. */
export function getHookPlanByArchetype(images: HookCandidateImage[], archetype: HookArchetype): HookPlan | null {
  return buildFeasibleHookPlans(images).find((p) => p.archetype === archetype) ?? null;
}
