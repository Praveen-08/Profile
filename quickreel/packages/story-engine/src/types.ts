import type { PhotoQualityScores, RoomType } from "@quickreel/shared";

/** The slice of packages/vision's output story-engine needs. */
export interface StoryCandidateImage {
  imageId: string;
  roomType: RoomType;
  roomConfidence: number;
  quality: PhotoQualityScores;
  /** 64-bit perceptual hash, hex string — the dedup similarity key. */
  perceptualHash: string;
}

export interface DuplicateResult {
  imageId: string;
  isDuplicate: boolean;
  /** Set only when isDuplicate is true — points at the kept, highest-quality image in its cluster. */
  duplicateOfId: string | null;
}

export interface HeroResult {
  heroImageId: string | null;
  secondHeroImageId: string | null;
}

export interface StoryPlan {
  /** Final, deduped, story-ordered image id sequence (excludes duplicates entirely). */
  orderedImageIds: string[];
  duplicates: DuplicateResult[];
  hero: HeroResult;
}
