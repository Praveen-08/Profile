import sharp from "sharp";

/**
 * 64-bit average hash (aHash): downsample to 8x8 grayscale, threshold
 * every pixel against the mean, pack the 64 bits into a 16-char hex
 * string. Cheap, deterministic, and exactly what
 * story-engine's Hamming-distance dedup expects.
 */
export async function computePerceptualHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mean = data.reduce((sum, v) => sum + v, 0) / data.length;

  let bits = "";
  for (const pixel of data) {
    bits += pixel >= mean ? "1" : "0";
  }

  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}
