import type { MusicVibe } from "@quickreel/shared";

export interface MusicTrackDef {
  /** Stable identifier — also used to derive the seeded DB row and the storage key. */
  slug: string;
  vibe: MusicVibe;
  title: string;
  /** Filename produced by scripts/synthesize.ts; storageKey = `music-library/${filename}`. */
  filename: string;
  genre: string;
  mood: string;
  bpm: number;
  /** 0..1 */
  energy: number;
  buildUpSec: number | null;
  dropSec: number | null;
  outroSec: number | null;
  durationSec: number;
}
