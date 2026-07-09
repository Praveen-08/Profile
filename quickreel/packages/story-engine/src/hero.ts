import type { RoomType } from "@quickreel/shared";
import type { HeroResult, StoryCandidateImage } from "./types.js";

const HERO_ROOM_TYPES: RoomType[] = ["EXTERIOR_FRONT", "EXTERIOR_GENERAL", "TWILIGHT"];

/**
 * v1 heuristic, deliberately simple and labeled as such: hero = the
 * highest-quality exterior/twilight shot; falls back to the single
 * highest-quality image overall when the set has no exterior/twilight
 * photo at all (e.g. an interior-only listing). Second hero = the next
 * best shot from a *different* room type, so the two heroes don't
 * duplicate the same space. This is not a trained saliency/composition
 * model — see packages/story-engine/README.md.
 */
export function selectHeroImages(images: StoryCandidateImage[]): HeroResult {
  if (images.length === 0) return { heroImageId: null, secondHeroImageId: null };

  const byQualityDesc = [...images].sort((a, b) => b.quality.overall - a.quality.overall);

  const heroCandidates = byQualityDesc.filter((img) => HERO_ROOM_TYPES.includes(img.roomType));
  const hero = heroCandidates[0] ?? byQualityDesc[0]!;

  const secondHero = byQualityDesc.find((img) => img.imageId !== hero.imageId && img.roomType !== hero.roomType);

  return {
    heroImageId: hero.imageId,
    secondHeroImageId: secondHero?.imageId ?? null,
  };
}
