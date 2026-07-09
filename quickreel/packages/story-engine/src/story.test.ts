import { describe, expect, it } from "vitest";
import type { PhotoQualityScores } from "@quickreel/shared";
import { buildStory } from "./build-story.js";
import { detectDuplicates, hammingDistanceHex } from "./dedup.js";
import { selectHeroImages } from "./hero.js";
import { orderStory } from "./order.js";
import type { StoryCandidateImage } from "./types.js";

function quality(overall: number): PhotoQualityScores {
  return {
    sharpness: overall,
    composition: overall,
    brightness: overall,
    leadingLines: overall,
    visualImpact: overall,
    luxuryAppeal: overall,
    storyImportance: overall,
    overall,
  };
}

function img(
  imageId: string,
  roomType: StoryCandidateImage["roomType"],
  overall: number,
  hash: string,
): StoryCandidateImage {
  return { imageId, roomType, roomConfidence: 0.9, quality: quality(overall), perceptualHash: hash };
}

describe("hammingDistanceHex", () => {
  it("is 0 for identical hashes and counts bit differences otherwise", () => {
    expect(hammingDistanceHex("ffffffff", "ffffffff")).toBe(0);
    expect(hammingDistanceHex("00000000", "ffffffff")).toBe(32);
    expect(hammingDistanceHex("f0000000", "00000000")).toBe(4);
  });
});

describe("detectDuplicates", () => {
  it("clusters near-identical hashes and keeps the highest-quality one canonical", () => {
    const images = [
      img("a", "LIVING_ROOM", 0.6, "aaaaaaaa"),
      img("b", "LIVING_ROOM", 0.9, "aaaaaaab"), // 1 bit off from a -> same cluster
      img("c", "KITCHEN", 0.7, "ffffffff"), // far away -> distinct
    ];
    const result = detectDuplicates(images, 6);
    const byId = Object.fromEntries(result.map((r) => [r.imageId, r]));
    expect(byId.b!.isDuplicate).toBe(false);
    expect(byId.a!.isDuplicate).toBe(true);
    expect(byId.a!.duplicateOfId).toBe("b");
    expect(byId.c!.isDuplicate).toBe(false);
  });
});

describe("selectHeroImages", () => {
  it("prefers an exterior/twilight shot as hero even if an interior scores higher", () => {
    const images = [
      img("interior", "LIVING_ROOM", 0.95, "11111111"),
      img("exterior", "EXTERIOR_FRONT", 0.8, "22222222"),
    ];
    const hero = selectHeroImages(images);
    expect(hero.heroImageId).toBe("exterior");
  });

  it("falls back to the highest-quality image overall when no exterior/twilight exists", () => {
    const images = [
      img("interior-1", "LIVING_ROOM", 0.7, "11111111"),
      img("interior-2", "KITCHEN", 0.9, "22222222"),
    ];
    const hero = selectHeroImages(images);
    expect(hero.heroImageId).toBe("interior-2");
  });

  it("picks a second hero from a different room type than the hero", () => {
    const images = [
      img("ext-1", "EXTERIOR_FRONT", 0.9, "11111111"),
      img("ext-2", "EXTERIOR_FRONT", 0.85, "22222222"),
      img("living-1", "LIVING_ROOM", 0.8, "33333333"),
    ];
    const hero = selectHeroImages(images);
    expect(hero.heroImageId).toBe("ext-1");
    expect(hero.secondHeroImageId).toBe("living-1");
  });
});

describe("orderStory", () => {
  it("follows the cinematic property journey order", () => {
    const images = [
      img("bedroom", "BEDROOM", 0.8, "11111111"),
      img("exterior", "EXTERIOR_FRONT", 0.8, "22222222"),
      img("kitchen", "KITCHEN", 0.8, "33333333"),
      img("twilight", "TWILIGHT", 0.8, "44444444"),
      img("living", "LIVING_ROOM", 0.8, "55555555"),
    ];
    const order = orderStory(images);
    expect(order).toEqual(["exterior", "living", "kitchen", "bedroom", "twilight"]);
  });
});

describe("buildStory", () => {
  it("excludes duplicates from the final ordered sequence", () => {
    const images = [
      img("ext-1", "EXTERIOR_FRONT", 0.9, "11111111"),
      img("ext-1-dupe", "EXTERIOR_FRONT", 0.5, "11111112"), // 1 bit off -> dup of ext-1
      img("living-1", "LIVING_ROOM", 0.7, "aaaaaaaa"),
    ];
    const plan = buildStory(images);
    expect(plan.orderedImageIds).not.toContain("ext-1-dupe");
    expect(plan.orderedImageIds).toContain("ext-1");
    expect(plan.hero.heroImageId).toBe("ext-1");
  });
});
