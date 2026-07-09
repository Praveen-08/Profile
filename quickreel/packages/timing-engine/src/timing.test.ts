import { describe, expect, it } from "vitest";
import type { CutSpeedCurve } from "@quickreel/shared";
import { allocateBeats } from "./allocate-beats.js";
import { MIN_COMFORTABLE_CLIP_SECONDS, selectImagesForReel } from "./select-images.js";
import type { TimingCandidateImage } from "./types.js";

function makeImages(count: number): TimingCandidateImage[] {
  return Array.from({ length: count }, (_, i) => ({
    imageId: `img-${i}`,
    roomType: i === 0 ? "EXTERIOR_FRONT" : "LIVING_ROOM",
    isHero: i === 0,
    isSecondHero: false,
  }));
}

describe("selectImagesForReel", () => {
  it("caps at the reel-length's max image count", () => {
    const result = selectImagesForReel(makeImages(30), 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("never produces an average clip length below the comfort floor", () => {
    const result = selectImagesForReel(makeImages(30), 10);
    expect(10 / result.length).toBeGreaterThanOrEqual(MIN_COMFORTABLE_CLIP_SECONDS);
  });

  it("keeps the earliest (most important) images when trimming", () => {
    const result = selectImagesForReel(makeImages(30), 10);
    expect(result[0]!.imageId).toBe("img-0");
  });
});

describe("allocateBeats", () => {
  const cutSpeedCurve: CutSpeedCurve = {
    baseClipDurationBeats: 4,
    heroClipDurationBeats: 6,
    detailClipDurationBeats: 2,
    accelerateOnDrop: true,
    accelerationFactor: 0.75,
  };

  it("gives hero images the longest beat allocation", () => {
    const images: TimingCandidateImage[] = [
      { imageId: "hero", roomType: "EXTERIOR_FRONT", isHero: true, isSecondHero: false },
      { imageId: "standard", roomType: "LIVING_ROOM", isHero: false, isSecondHero: false },
      { imageId: "detail", roomType: "BATHROOM", isHero: false, isSecondHero: false },
    ];
    const allocations = allocateBeats(images, cutSpeedCurve);
    expect(allocations[0]!.targetBeats).toBe(6);
    expect(allocations[1]!.targetBeats).toBe(4);
    expect(allocations[2]!.targetBeats).toBe(2);
  });
});
