import type { RoomType } from "@quickreel/shared";

/**
 * The minimal slice of an analyzed photo hook-engine needs. Deliberately
 * not imported from story-engine (which owns the full analysis record) to
 * keep every AI Director Engine package independently testable and free of
 * cross-engine coupling — the worker wires them together.
 */
export interface HookCandidateImage {
  imageId: string;
  roomType: RoomType;
  qualityScore: number;
  isHero: boolean;
  isSecondHero: boolean;
}
