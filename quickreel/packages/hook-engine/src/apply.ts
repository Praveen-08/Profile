import type { HookPlan } from "./archetypes.js";

/**
 * Splices a hook plan's opening images to the front of an already-ordered
 * story sequence (story-engine's output), preserving the relative order of
 * everything else and removing duplicates — most hook archetypes reuse an
 * image (e.g. the hero exterior) that story-engine already placed early.
 */
export function applyHookToStoryOrder(orderedImageIds: string[], hook: HookPlan): string[] {
  const hookSet = new Set(hook.openingImageIds);
  const rest = orderedImageIds.filter((id) => !hookSet.has(id));
  return [...hook.openingImageIds, ...rest];
}
