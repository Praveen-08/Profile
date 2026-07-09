import type { RoomType } from "@quickreel/shared";

export interface TimingCandidateImage {
  imageId: string;
  roomType: RoomType;
  isHero: boolean;
  isSecondHero: boolean;
}

/**
 * The contract handed to packages/beat-engine: "this clip should get
 * roughly this many beats." beat-engine is responsible for converting beat
 * budgets into exact, snapped millisecond boundaries against a real
 * BeatGrid — timing-engine never touches milliseconds or BPM directly, it
 * only reasons in pacing/beats so its output is tempo-independent.
 */
export interface ClipBeatAllocation {
  imageId: string;
  roomType: RoomType;
  targetBeats: number;
  isHero: boolean;
}
