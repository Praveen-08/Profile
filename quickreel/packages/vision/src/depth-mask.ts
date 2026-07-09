import sharp from "sharp";

/** Brightest 35% of depth-map pixels are treated as "foreground" for the parallax matte. */
const FOREGROUND_PERCENTILE = 0.65;
/** Feather radius (px) so the foreground/background split isn't a hard-edged cutout. */
const FEATHER_BLUR_SIGMA = 12;

/**
 * Derives a smoothed foreground matte from a depth map (255=near, 0=far —
 * see apps/ai-service/app/depth_estimation.py): threshold at the 65th
 * brightness percentile (computed via a 256-bin histogram, not a full
 * pixel sort — cheap even at multi-megapixel resolution), then heavily
 * blur the resulting binary mask so packages/video-engine's CSS
 * `mask-image` compositing gets a smooth depth transition rather than a
 * jagged cutout. White = foreground (kept in the fast-moving layer),
 * black = background.
 */
export async function generateForegroundMask(depthMapBuffer: Buffer): Promise<Buffer> {
  const { data } = await sharp(depthMapBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });

  const histogram = new Uint32Array(256);
  for (const pixel of data) histogram[pixel]!++;

  const targetCount = data.length * (1 - FOREGROUND_PERCENTILE);
  let cumulative = 0;
  let threshold = 255;
  for (let level = 255; level >= 0; level--) {
    cumulative += histogram[level]!;
    if (cumulative >= targetCount) {
      threshold = level;
      break;
    }
  }

  return sharp(depthMapBuffer).greyscale().threshold(threshold).blur(FEATHER_BLUR_SIGMA).png().toBuffer();
}
