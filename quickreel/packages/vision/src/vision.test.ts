import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { computePerceptualHash } from "./hash.js";
import { computeQualityMetrics } from "./quality.js";
import { classifyRoomHeuristic } from "./classifiers/heuristic.js";

async function makeTestImage(opts: { r: number; g: number; b: number; noisy?: boolean }): Promise<Buffer> {
  const base = sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: opts.r, g: opts.g, b: opts.b } },
  });
  if (opts.noisy) {
    // Composite a few contrasting rectangles to give the sharpness/composition metrics something to measure.
    const rect = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 255 - opts.r, g: 255 - opts.g, b: 255 - opts.b } },
    })
      .png()
      .toBuffer();
    return base
      .composite([
        { input: rect, top: 20, left: 20 },
        { input: rect, top: 140, left: 140 },
      ])
      .jpeg()
      .toBuffer();
  }
  return base.jpeg().toBuffer();
}

describe("computePerceptualHash", () => {
  it("produces a 16-char hex string", async () => {
    const buf = await makeTestImage({ r: 100, g: 100, b: 100 });
    const hash = await computePerceptualHash(buf);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces identical hashes for identical images", async () => {
    const buf = await makeTestImage({ r: 50, g: 150, b: 200, noisy: true });
    const [h1, h2] = await Promise.all([computePerceptualHash(buf), computePerceptualHash(buf)]);
    expect(h1).toBe(h2);
  });
});

describe("computeQualityMetrics", () => {
  it("returns all scores clamped to 0..1", async () => {
    const buf = await makeTestImage({ r: 180, g: 160, b: 140, noisy: true });
    const metrics = await computeQualityMetrics(buf);
    for (const value of Object.values(metrics)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("scores a flat gray image as low sharpness", async () => {
    const buf = await makeTestImage({ r: 128, g: 128, b: 128 });
    const metrics = await computeQualityMetrics(buf);
    expect(metrics.sharpness).toBeLessThan(0.2);
  });
});

describe("classifyRoomHeuristic", () => {
  it("classifies a uniform dark gray image as UNKNOWN (no sky signal)", async () => {
    const buf = await makeTestImage({ r: 60, g: 60, b: 60 });
    const result = await classifyRoomHeuristic(buf);
    expect(result.roomType).toBe("UNKNOWN");
    expect(result.confidence).toBe(0);
  });

  it("classifies a bright blue-sky-like image as an exterior shot", async () => {
    const buf = await makeTestImage({ r: 120, g: 170, b: 230 });
    const result = await classifyRoomHeuristic(buf);
    expect(result.isOutdoor).toBe(true);
    expect(result.roomType).toBe("EXTERIOR_GENERAL");
  });
});
