import { describe, expect, it } from "vitest";
import { MUSIC_VIBES } from "@quickreel/shared";
import { listTracksByVibe, MUSIC_TRACK_CATALOG } from "./catalog.js";

describe("music track catalog", () => {
  it("has unique slugs", () => {
    const slugs = MUSIC_TRACK_CATALOG.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers every music vibe with at least one track", () => {
    for (const vibe of MUSIC_VIBES) {
      expect(listTracksByVibe(vibe).length).toBeGreaterThan(0);
    }
  });

  it("every track has a duration long enough for a 20s reel", () => {
    for (const track of MUSIC_TRACK_CATALOG) {
      expect(track.durationSec).toBeGreaterThanOrEqual(20);
    }
  });
});
