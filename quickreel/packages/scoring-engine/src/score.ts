import {
  CURRENT_SCORE_VERSION,
  type BeatGrid,
  type EditDecisionList,
  type ReelScore,
  type RoomType,
  type StyleConfig,
} from "@quickreel/shared";

export interface ScoreReelInput {
  edl: EditDecisionList;
  beatGrid: BeatGrid;
  style: StyleConfig;
}

const HOOK_ROOM_TYPES: readonly RoomType[] = ["EXTERIOR_FRONT", "EXTERIOR_GENERAL", "DRONE", "TWILIGHT"];
const HIGH_MOTION_EASINGS = new Set(["cinematicEaseInOut", "momentumOut", "craneEase"]);
const BATHROOM_ROOM_TYPES: readonly RoomType[] = ["BATHROOM", "ENSUITE"];

function clamp0to100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Distance in ms from a clip boundary to the nearest beat timestamp. */
function nearestBeatDistanceMs(tMs: number, beatTimestampsMs: number[]): number {
  let best = Infinity;
  for (const beatMs of beatTimestampsMs) {
    const d = Math.abs(beatMs - tMs);
    if (d < best) best = d;
  }
  return best;
}

function scoreStorytelling(edl: EditDecisionList): { score: number; hookStrength: number; diversity: number } {
  const first = edl.clips[0];
  const hookStrength = first && HOOK_ROOM_TYPES.includes(first.roomType) ? 100 : 55;

  const uniqueRoomTypes = new Set(edl.clips.map((c) => c.roomType)).size;
  const diversity = clamp0to100((uniqueRoomTypes / Math.max(1, edl.clips.length)) * 140);

  return { score: clamp0to100(hookStrength * 0.6 + diversity * 0.4), hookStrength, diversity };
}

function scoreBeatSync(edl: EditDecisionList, beatGrid: BeatGrid): number {
  if (edl.clips.length < 2 || beatGrid.beatTimestampsMs.length === 0) return 100;

  const beatIntervalMs = 60000 / beatGrid.bpm;
  const boundaries = edl.clips.slice(1).map((c) => c.startMs);
  const deviations = boundaries.map((tMs) => nearestBeatDistanceMs(tMs, beatGrid.beatTimestampsMs) / beatIntervalMs);
  const avgDeviation = average(deviations);

  // A boundary landing exactly on a beat has deviation 0 (score 100); a full beat-interval off (1.0) scores 0.
  return clamp0to100(100 - avgDeviation * 100);
}

function scoreLuxury(edl: EditDecisionList, style: StyleConfig): number {
  const avgClipDurationSec = average(edl.clips.map((c) => c.durationMs)) / 1000;
  // Longer holds read as more premium/patient; 4s+ average is already top of the range for a 10-20s reel.
  const paceScore = clamp0to100((avgClipDurationSec / 4) * 100);
  const atmosphericBonus = style.atmosphericEffectsEnabled ? 100 : 40;
  const intensityScore = clamp0to100(100 - style.motionIntensity * 60);

  return clamp0to100(paceScore * 0.4 + atmosphericBonus * 0.3 + intensityScore * 0.3);
}

function scoreMotionQuality(edl: EditDecisionList): number {
  const moves = edl.clips.map((c) => c.camera.type);
  let repeatPenalty = 0;
  for (let i = 1; i < moves.length; i++) {
    if (moves[i] === moves[i - 1]) repeatPenalty += 1;
  }
  const repeatScore = clamp0to100(100 - (repeatPenalty / Math.max(1, moves.length - 1)) * 100);

  const cinematicEasingCount = edl.clips.filter((c) => HIGH_MOTION_EASINGS.has(c.camera.easing)).length;
  const easingScore = clamp0to100((cinematicEasingCount / Math.max(1, edl.clips.length)) * 100);

  return clamp0to100(repeatScore * 0.6 + easingScore * 0.4);
}

function scoreViewerRetention(hookStrength: number, edl: EditDecisionList): number {
  const openingClips = edl.clips.filter((c) => c.startMs < 3000);
  const openingPace = clamp0to100(100 - average(openingClips.map((c) => c.durationMs / 1000)) * 10);
  const lengthFit = edl.totalDurationMs <= 22000 ? 100 : 60;

  return clamp0to100(hookStrength * 0.5 + openingPace * 0.3 + lengthFit * 0.2);
}

function scoreSocialMedia(edl: EditDecisionList): number {
  const aspectBonus = edl.compositionWidth === 1080 && edl.compositionHeight === 1920 ? 100 : 40;
  const durationBonus = edl.totalDurationMs <= 20000 ? 100 : 70;
  const ctaBonus = edl.clips.some((c) => c.textOverlays.some((o) => o.kind === "CTA")) ? 100 : 70;

  return clamp0to100(aspectBonus * 0.4 + durationBonus * 0.35 + ctaBonus * 0.25);
}

function buildRecommendations(input: {
  hookStrength: number;
  beatSyncScore: number;
  motionQualityScore: number;
  luxuryScore: number;
  style: StyleConfig;
  edl: EditDecisionList;
}): string[] {
  const recs: string[] = [];
  const { hookStrength, beatSyncScore, motionQualityScore, luxuryScore, style, edl } = input;

  if (hookStrength < 70) {
    recs.push("Increase hook speed — open on a stronger exterior, drone, or twilight shot to grab attention faster.");
  }

  const heroClip = edl.clips.find((c) => c.clipIndex === 0);
  if (!heroClip || heroClip.durationMs < 1200) {
    recs.push("Use a stronger hero image — the opening clip is too brief to register as the listing's best shot.");
  }

  const totalMs = edl.totalDurationMs || 1;
  const bathroomMs = edl.clips
    .filter((c) => BATHROOM_ROOM_TYPES.includes(c.roomType))
    .reduce((sum, c) => sum + c.durationMs, 0);
  if (bathroomMs / totalMs > 0.15) {
    recs.push("Reduce bathroom duration — bathrooms are taking up more than 15% of the reel's runtime.");
  }

  if (beatSyncScore < 70) {
    recs.push("Cuts are drifting from the beat — pick a track with a clearer downbeat or a slower BPM.");
  }

  if (motionQualityScore < 70) {
    recs.push("Camera movement is repeating too often back-to-back — vary movement types for a more handcrafted feel.");
  }

  if (style.atmosphericEffectsEnabled && luxuryScore < 60) {
    recs.push("Slow the pace slightly for a more luxury feel — this style reads best with longer, patient holds.");
  }

  return recs;
}

/**
 * AI Reel Score — six deterministic sub-scores computed from the resolved
 * EDL, the beat grid it was cut to, and the style it was cut with. This is
 * pattern-based scoring (pacing, room-type diversity, beat alignment,
 * movement repetition, aspect/duration fit), not a model trained on real
 * viewer engagement data — see this package's README for the honest gap,
 * matching the same disclosure pattern as packages/vision's heuristic
 * fallback and apps/ai-service's depth-estimation sandbox note.
 */
export function scoreReel(input: ScoreReelInput): ReelScore {
  const { edl, beatGrid, style } = input;

  const storytelling = scoreStorytelling(edl);
  const beatSyncScore = scoreBeatSync(edl, beatGrid);
  const luxuryScore = scoreLuxury(edl, style);
  const motionQualityScore = scoreMotionQuality(edl);
  const viewerRetentionPrediction = scoreViewerRetention(storytelling.hookStrength, edl);
  const socialMediaScore = scoreSocialMedia(edl);

  const overallScore = clamp0to100(
    storytelling.score * 0.2 +
      beatSyncScore * 0.2 +
      luxuryScore * 0.15 +
      motionQualityScore * 0.15 +
      viewerRetentionPrediction * 0.2 +
      socialMediaScore * 0.1,
  );

  const recommendations = buildRecommendations({
    hookStrength: storytelling.hookStrength,
    beatSyncScore,
    motionQualityScore,
    luxuryScore,
    style,
    edl,
  });

  return {
    scoreVersion: CURRENT_SCORE_VERSION,
    storytellingScore: storytelling.score,
    beatSyncScore,
    luxuryScore,
    motionQualityScore,
    viewerRetentionPrediction,
    socialMediaScore,
    overallScore,
    recommendations,
  };
}
