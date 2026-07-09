import sharp from "sharp";
import { clamp01 } from "./util.js";

export interface RawQualityMetrics {
  sharpness: number;
  composition: number;
  brightness: number;
  leadingLines: number;
  visualImpact: number;
  luxuryAppeal: number;
}

// Empirically-chosen normalization constants for an 8-bit (0-255) pixel scale.
const SHARPNESS_NORMALIZATION = 40;
const COLORFULNESS_NORMALIZATION = 90;

const LAPLACIAN_KERNEL = { width: 3, height: 3, kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] };
const SOBEL_HORIZONTAL = { width: 3, height: 3, kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1] };
const SOBEL_VERTICAL = { width: 3, height: 3, kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1] };

/**
 * Real, deterministic image-signal-processing scores — computed with
 * `sharp`, no ML model involved, so they work identically with or without
 * an OpenAI key. Each is a documented approximation of the named concept,
 * not a claim of ground truth:
 *   - sharpness: stdev of a Laplacian-convolved image (classic
 *     "variance of Laplacian" focus metric).
 *   - brightness: mean luminance, normalized 0..1.
 *   - composition: penalizes images whose edge energy is concentrated
 *     dead-center rather than distributed toward the rule-of-thirds grid.
 *   - leadingLines: how strongly horizontal vs. vertical edge energy
 *     dominates — a proxy for strong directional structure (hallways,
 *     staircases, sightlines).
 *   - visualImpact: blend of sharpness, contrast, and colorfulness
 *     (a simplified Hasler-Süsstrunk-style colorfulness proxy).
 *   - luxuryAppeal: the weakest heuristic here by far — a blend of
 *     "well-lit but not blown out" brightness, composition, and
 *     colorfulness. Genuinely improved by the OpenAI Vision adapter,
 *     which judges this directly from the image.
 */
export async function computeQualityMetrics(imageBuffer: Buffer): Promise<RawQualityMetrics> {
  // Materialized once via toBuffer() rather than kept as a live pipeline: sharp merges the
  // options of a second chained .resize() into the first rather than applying them in sequence
  // (so a later resize(300,300) would silently inherit this stage's withoutEnlargement:true and
  // never actually enlarge). Starting each downstream operation fresh from a real buffer avoids that.
  const colorBuffer = await sharp(imageBuffer).resize(512, 512, { fit: "inside", withoutEnlargement: true }).toBuffer();
  const grayscaleBuffer = await sharp(colorBuffer).grayscale().toBuffer();

  const [grayStats, laplacianStats, sobelHStats, sobelVStats, colorStats, gridEnergies] = await Promise.all([
    sharp(grayscaleBuffer).stats(),
    sharp(grayscaleBuffer).convolve(LAPLACIAN_KERNEL).stats(),
    sharp(grayscaleBuffer).convolve(SOBEL_HORIZONTAL).stats(),
    sharp(grayscaleBuffer).convolve(SOBEL_VERTICAL).stats(),
    sharp(colorBuffer).stats(),
    computeRuleOfThirdsGridEnergy(grayscaleBuffer),
  ]);

  const brightness = clamp01((grayStats.channels[0]?.mean ?? 128) / 255);
  const sharpness = clamp01((laplacianStats.channels[0]?.stdev ?? 0) / SHARPNESS_NORMALIZATION);
  const contrast = clamp01((grayStats.channels[0]?.stdev ?? 0) / 80);

  const hEnergy = sobelHStats.channels[0]?.stdev ?? 0;
  const vEnergy = sobelVStats.channels[0]?.stdev ?? 0;
  const directionalRatio = Math.max(hEnergy, vEnergy) / (hEnergy + vEnergy + 1e-6);
  const leadingLines = clamp01((directionalRatio - 0.5) * 2);

  const totalGridEnergy = gridEnergies.reduce((s, v) => s + v, 0) || 1;
  const centerEnergyShare = (gridEnergies[4] ?? 0) / totalGridEnergy;
  const composition = clamp01(1 - centerEnergyShare * 2);

  const channelStdevs = colorStats.channels.map((c) => c.stdev);
  const colorfulness = clamp01(
    (channelStdevs.reduce((s, v) => s + v, 0) / Math.max(1, channelStdevs.length)) / COLORFULNESS_NORMALIZATION,
  );

  const visualImpact = clamp01(0.5 * sharpness + 0.3 * colorfulness + 0.2 * contrast);

  // Peaks around a well-exposed 0.55-0.75 brightness band, tapering off toward under/over-exposure.
  const brightnessIdeal = clamp01(1 - Math.abs(brightness - 0.65) / 0.5);
  const luxuryAppeal = clamp01(0.4 * brightnessIdeal + 0.3 * composition + 0.3 * colorfulness);

  return { sharpness, composition, brightness, leadingLines, visualImpact, luxuryAppeal };
}

/** Mean absolute pixel value in each cell of a 3x3 grid, row-major (index 4 = center). */
async function computeRuleOfThirdsGridEnergy(grayscaleBuffer: Buffer): Promise<number[]> {
  const gridBuffer = await sharp(grayscaleBuffer).resize(300, 300, { fit: "fill" }).toBuffer();
  const cellSize = 100;
  const energies: number[] = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const { data } = await sharp(gridBuffer)
        .extract({ left: col * cellSize, top: row * cellSize, width: cellSize, height: cellSize })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const mean = data.reduce((s, v) => s + v, 0) / data.length;
      energies.push(mean);
    }
  }
  return energies;
}
