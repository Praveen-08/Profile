import type { StyleConfig } from "@quickreel/shared";
import { listTracksByVibe, MUSIC_TRACK_CATALOG } from "./catalog.js";
import type { MusicTrackDef } from "./types.js";

export interface ScoredTrack {
  track: MusicTrackDef;
  score: number;
}

/**
 * Ranks tracks by fit against a style's editorial intent: a style's
 * `motionIntensity` is treated as its target energy level (a "Fast Pace"
 * style wants high-energy tracks, "Minimal" wants restrained ones), with a
 * bonus for tracks that have a defined drop when the style's cut-speed
 * curve is configured to accelerate on the drop.
 */
export function recommendTracksForStyle(style: StyleConfig, vibe?: MusicTrackDef["vibe"]): ScoredTrack[] {
  const pool = vibe ? listTracksByVibe(vibe) : MUSIC_TRACK_CATALOG;

  return pool
    .map((track) => {
      const energyFit = 1 - Math.abs(track.energy - style.motionIntensity);
      const dropBonus = style.cutSpeedCurve.accelerateOnDrop && track.dropSec !== null ? 0.1 : 0;
      return { track, score: energyFit + dropBonus };
    })
    .sort((a, b) => b.score - a.score);
}

export function recommendTrackForStyle(style: StyleConfig, vibe?: MusicTrackDef["vibe"]): MusicTrackDef | null {
  return recommendTracksForStyle(style, vibe)[0]?.track ?? null;
}
