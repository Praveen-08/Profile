import type { CutSpeedCurve, RoomType } from "@quickreel/shared";
import type { ClipBeatAllocation, TimingCandidateImage } from "./types.js";

/** Small, function-heavy rooms read better on a slightly shorter beat allocation. */
const DETAIL_ROOM_TYPES = new Set<RoomType>(["BATHROOM", "ENSUITE", "LAUNDRY", "HALLWAY"]);

export function isDetailRoom(roomType: RoomType): boolean {
  return DETAIL_ROOM_TYPES.has(roomType);
}

/**
 * Assigns a target beat-length to every clip, purely from the style's
 * cut-speed curve and each image's role (hero / detail-room / standard).
 * Tempo-independent by design — see types.ts.
 */
export function allocateBeats(
  images: TimingCandidateImage[],
  cutSpeedCurve: CutSpeedCurve,
): ClipBeatAllocation[] {
  return images.map((img) => {
    const targetBeats =
      img.isHero || img.isSecondHero
        ? cutSpeedCurve.heroClipDurationBeats
        : isDetailRoom(img.roomType)
          ? cutSpeedCurve.detailClipDurationBeats
          : cutSpeedCurve.baseClipDurationBeats;

    return {
      imageId: img.imageId,
      roomType: img.roomType,
      targetBeats,
      isHero: img.isHero,
    };
  });
}
