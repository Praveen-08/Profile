import sharp from "sharp";
import type { RoomType } from "@quickreel/shared";

export interface HeuristicClassification {
  roomType: RoomType;
  confidence: number;
  isOutdoor: boolean;
  isTwilight: boolean;
}

/**
 * The no-API-key fallback. This is an HONEST GAP, not a lightweight
 * version of real room classification: pixel statistics alone cannot
 * distinguish a kitchen from a bedroom. What it *can* do reasonably
 * well — sky detection via the top band's blue dominance and overall
 * exposure — is used to separate exterior-daytime / exterior-twilight /
 * exterior-night from "can't tell, probably indoors" (UNKNOWN,
 * confidence 0). See packages/vision/README.md.
 */
export async function classifyRoomHeuristic(imageBuffer: Buffer): Promise<HeuristicClassification> {
  const image = sharp(imageBuffer).resize(256, 256, { fit: "fill" });

  const [overallStats, topBandStats] = await Promise.all([
    image.clone().stats(),
    image.clone().extract({ left: 0, top: 0, width: 256, height: 77 }).stats(),
  ]);

  const overallBrightness = mean(overallStats.channels) / 255;
  const topBrightness = mean(topBandStats.channels) / 255;
  const topBlueDominance = (topBandStats.channels[2]?.mean ?? 0) - (topBandStats.channels[0]?.mean ?? 0);

  const looksLikeSky = topBlueDominance > 8 && topBrightness > 0.4;

  if (!looksLikeSky) {
    return { roomType: "UNKNOWN", confidence: 0, isOutdoor: false, isTwilight: false };
  }

  if (overallBrightness < 0.12) {
    return { roomType: "NIGHT", confidence: 0.35, isOutdoor: true, isTwilight: true };
  }
  if (overallBrightness < 0.28) {
    return { roomType: "TWILIGHT", confidence: 0.35, isOutdoor: true, isTwilight: true };
  }
  return { roomType: "EXTERIOR_GENERAL", confidence: 0.4, isOutdoor: true, isTwilight: false };
}

function mean(channels: sharp.Stats["channels"]): number {
  return channels.reduce((sum, c) => sum + c.mean, 0) / channels.length;
}
