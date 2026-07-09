import {
  BRAND_OUTRO_DURATION_MS,
  createSeededRng,
  CURRENT_EDL_VERSION,
  EditDecisionListSchema,
  type BeatGrid,
  type BrandKitConfig,
  type CameraMoveType,
  type EDLClip,
  type EditDecisionList,
  type HookArchetype,
  type ReelLengthSec,
  type RoomType,
  type StyleConfig,
  type TransitionSpec,
  type TransitionType,
} from "@quickreel/shared";
import { buildCameraMove, createUsageCounts, selectCameraMove } from "@quickreel/camera-engine";
import {
  createTransitionUsageCounts,
  LOGO_POSITION,
  selectTransition,
  type StoryPosition,
} from "@quickreel/transition-engine";
import { buildFeasibleHookPlans, getHookPlanByArchetype, rankHookPlans, applyHookToStoryOrder, type HookCandidateImage } from "@quickreel/hook-engine";
import { allocateBeats, selectImagesForReel, type TimingCandidateImage } from "@quickreel/timing-engine";
import { computeClipBoundaries } from "@quickreel/beat-engine";
import { selectAtmosphericEffect } from "@quickreel/atmospheric-engine";
import { assignOverlaysToClips, buildTextOverlays, type OverlayProjectFields } from "./text-overlays.js";

export interface ResolveEdlImageInput {
  imageId: string;
  storageKey: string;
  roomType: RoomType;
  qualityScore: number;
  isHero: boolean;
  isSecondHero: boolean;
  /** Both present only when depth estimation succeeded for this image — see apps/ai-service's honest-gap note. */
  depthMapStorageKey: string | null;
  foregroundMaskStorageKey: string | null;
  /** Set via the timeline-editing "replace movement" action; null means the AI decides. */
  cameraMoveOverride: CameraMoveType | null;
}

export interface ResolveEdlInput {
  projectId: string;
  renderId: string;
  reelLengthSec: ReelLengthSec;
  style: StyleConfig;
  hookArchetypeOverride: HookArchetype | null;
  /** Already deduped, in story-engine's cinematic order. */
  orderedImages: ResolveEdlImageInput[];
  beatGrid: BeatGrid;
  musicTrackId: string;
  musicTrackStorageKey: string;
  project: OverlayProjectFields;
  /** Null when the version has no brand kit assigned. */
  brandKit: BrandKitConfig | null;
}

/**
 * The full AI Director Engine pipeline, composed: hook placement -> reel-
 * length/never-rush image selection -> beat allocation -> beat-grid
 * snapping -> per-clip camera + transition selection -> text overlays.
 * Pure and synchronous (all I/O — vision analysis, beat detection — has
 * already happened by the time this runs), which makes it directly
 * unit-testable and guarantees re-running it for the same renderId
 * produces an identical EDL (every random choice is seeded off renderId).
 */
export function resolveEDL(input: ResolveEdlInput): EditDecisionList {
  const byId = new Map(input.orderedImages.map((img) => [img.imageId, img]));

  const hookCandidates: HookCandidateImage[] = input.orderedImages.map((img) => ({
    imageId: img.imageId,
    roomType: img.roomType,
    qualityScore: img.qualityScore,
    isHero: img.isHero,
    isSecondHero: img.isSecondHero,
  }));

  const hookPlan =
    (input.hookArchetypeOverride && getHookPlanByArchetype(hookCandidates, input.hookArchetypeOverride)) ||
    rankHookPlans(hookCandidates, input.style)[0] ||
    null;
  const resolvedHookArchetype = hookPlan?.archetype ?? "BEST_EXTERIOR_QUICK_ZOOM";

  const storyOrderIds = input.orderedImages.map((img) => img.imageId);
  const hookOrderedIds = hookPlan ? applyHookToStoryOrder(storyOrderIds, hookPlan) : storyOrderIds;

  const timingCandidates: TimingCandidateImage[] = hookOrderedIds.map((id) => {
    const img = byId.get(id)!;
    return { imageId: img.imageId, roomType: img.roomType, isHero: img.isHero, isSecondHero: img.isSecondHero };
  });
  const selected = selectImagesForReel(timingCandidates, input.reelLengthSec);
  const allocations = allocateBeats(selected, input.style.cutSpeedCurve);

  const targetTotalMs = input.reelLengthSec * 1000;
  const clipTimings = computeClipBoundaries(
    allocations,
    input.beatGrid,
    targetTotalMs,
    input.style.cutSpeedCurve,
    input.style.musicBehavior.syncCutsToDownbeatOnly,
  );

  // One transition per boundary (N+1 total: opening-in, N-1 interior cuts, closing-out to the logo card),
  // shared between the outgoing clip's transitionOut and the incoming clip's transitionIn so they
  // render as a single coherent cut rather than two independent effects.
  const transitionRng = createSeededRng(`${input.renderId}:transitions`);
  const transitionUsage = createTransitionUsageCounts();
  const boundarySpecs: TransitionSpec[] = [];
  let previousType: TransitionType | undefined;
  for (let i = 0; i <= clipTimings.length; i++) {
    const fromRoomType = i === 0 ? clipTimings[0]!.roomType : clipTimings[i - 1]!.roomType;
    const toPosition: StoryPosition = i === clipTimings.length ? LOGO_POSITION : clipTimings[i]!.roomType;
    const spec = selectTransition({
      fromRoomType,
      toRoomType: toPosition,
      style: input.style,
      rng: transitionRng,
      usageCounts: transitionUsage,
      previousType,
    });
    previousType = spec.type;
    boundarySpecs.push(spec);
  }

  // Seeded off projectId (not renderId): camera movement selection is stable for the life of
  // the project, so apps/api's timeline-preview endpoint (computed before any render exists)
  // shows exactly what the eventual render will use, rather than a seed that only exists once
  // a render row has been created.
  const cameraRng = createSeededRng(`${input.projectId}:camera`);
  const cameraUsage = createUsageCounts();
  const atmosphericRng = createSeededRng(`${input.renderId}:atmospheric`);

  const clipsWithoutText: Omit<EDLClip, "textOverlays">[] = clipTimings.map((timing, index) => {
    const img = byId.get(timing.imageId)!;

    // A user-locked/replaced movement still counts toward the per-reel repeat cap bookkeeping —
    // otherwise a manual override could silently let a movement exceed the "never repeat more
    // than twice" constraint for the AI-decided clips around it.
    const camera = img.cameraMoveOverride
      ? (() => {
          cameraUsage[img.cameraMoveOverride!] = (cameraUsage[img.cameraMoveOverride!] ?? 0) + 1;
          return buildCameraMove(img.cameraMoveOverride!, input.style);
        })()
      : selectCameraMove({ roomType: timing.roomType, style: input.style, rng: cameraRng, usageCounts: cameraUsage });

    const depth =
      img.depthMapStorageKey && img.foregroundMaskStorageKey
        ? { depthMapStorageKey: img.depthMapStorageKey, foregroundMaskStorageKey: img.foregroundMaskStorageKey }
        : null;

    const atmosphericEffect = selectAtmosphericEffect({
      roomType: timing.roomType,
      style: input.style,
      rng: atmosphericRng,
    });

    return {
      clipIndex: index,
      imageId: img.imageId,
      imageStorageKey: img.storageKey,
      roomType: timing.roomType,
      startMs: timing.startMs,
      endMs: timing.endMs,
      durationMs: timing.durationMs,
      beatIndexStart: timing.beatIndexStart,
      beatIndexEnd: timing.beatIndexEnd,
      camera,
      transitionIn: boundarySpecs[index]!,
      transitionOut: boundarySpecs[index + 1]!,
      depth,
      atmosphericEffect,
    };
  });

  const overlays = buildTextOverlays(clipTimings, input.project, input.style);
  const clips: EDLClip[] = assignOverlaysToClips(clipsWithoutText, overlays);

  // The outro clip (when a brand kit sets one) plays after the music-synced portion of the reel,
  // so it extends total composition duration rather than stealing time from the beat-synced clips.
  const outroDurationMs = input.brandKit?.outroStorageKey ? BRAND_OUTRO_DURATION_MS : 0;

  const edl: EditDecisionList = {
    version: CURRENT_EDL_VERSION,
    projectId: input.projectId,
    renderId: input.renderId,
    compositionWidth: 1080,
    compositionHeight: 1920,
    fps: 30,
    totalDurationMs: targetTotalMs + outroDurationMs,
    styleSlug: input.style.slug,
    hookArchetype: resolvedHookArchetype,
    musicTrackId: input.musicTrackId,
    beatGrid: input.beatGrid,
    clips,
    audio: { trackStorageKey: input.musicTrackStorageKey, startOffsetMs: 0 },
    brandKit: input.brandKit,
  };

  return EditDecisionListSchema.parse(edl);
}

/** Exposed for the AI Preview endpoint — lets the web app show every feasible hook option, not just the chosen default. */
export function listFeasibleHooks(images: ResolveEdlImageInput[]) {
  return buildFeasibleHookPlans(
    images.map((img) => ({
      imageId: img.imageId,
      roomType: img.roomType,
      qualityScore: img.qualityScore,
      isHero: img.isHero,
      isSecondHero: img.isSecondHero,
    })),
  );
}
