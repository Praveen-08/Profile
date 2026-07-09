import { MAX_IMAGES_BY_REEL_LENGTH, type ReelLengthSec } from "@quickreel/shared";
import type { TimingCandidateImage } from "./types.js";

/**
 * Floor on perceived clip length — below this, cuts start to feel
 * subliminal rather than intentional. Enforced on top of the per-length
 * image cap so a photographer who uploads 30 great shots for a 10s reel
 * still gets an edit that "never feels rushed," per product spec, rather
 * than 30 flickering half-second clips.
 */
export const MIN_COMFORTABLE_CLIP_SECONDS = 0.6;

/**
 * Enforces the reel-length -> max-image-count rule, then keeps trimming
 * from the tail (the caller must pass images already ordered by story
 * importance — hook + hero images first) until the average clip length
 * clears the "never rush" floor.
 */
export function selectImagesForReel(
  orderedImages: TimingCandidateImage[],
  reelLengthSec: ReelLengthSec,
): TimingCandidateImage[] {
  const hardCap = MAX_IMAGES_BY_REEL_LENGTH[reelLengthSec];
  let images = orderedImages.slice(0, hardCap);

  while (images.length > 3 && reelLengthSec / images.length < MIN_COMFORTABLE_CLIP_SECONDS) {
    images = images.slice(0, images.length - 1);
  }

  return images;
}
