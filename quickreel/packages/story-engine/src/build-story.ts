import { DEFAULT_DUPLICATE_THRESHOLD, detectDuplicates } from "./dedup.js";
import { selectHeroImages } from "./hero.js";
import { orderStory } from "./order.js";
import type { StoryCandidateImage, StoryPlan } from "./types.js";

/**
 * The full story-engine pipeline: dedup -> hero/second-hero selection ->
 * cinematic ordering. Duplicates are excluded entirely from
 * `orderedImageIds` (their record is preserved in `duplicates` for
 * persistence/debugging) so the rest of the AI Director Engine only ever
 * sees the canonical shot per angle.
 */
export function buildStory(
  images: StoryCandidateImage[],
  duplicateThreshold: number = DEFAULT_DUPLICATE_THRESHOLD,
): StoryPlan {
  const duplicates = detectDuplicates(images, duplicateThreshold);
  const duplicateIds = new Set(duplicates.filter((d) => d.isDuplicate).map((d) => d.imageId));
  const uniqueImages = images.filter((img) => !duplicateIds.has(img.imageId));

  const hero = selectHeroImages(uniqueImages);
  const orderedImageIds = orderStory(uniqueImages);

  return { orderedImageIds, duplicates, hero };
}
