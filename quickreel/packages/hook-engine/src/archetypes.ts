import type { HookArchetype, RoomType } from "@quickreel/shared";
import type { HookCandidateImage } from "./types.js";

export interface HookPlan {
  archetype: HookArchetype;
  label: string;
  description: string;
  /** Images placed at the very front of the reel, in order. story-engine's
   *  existing ordering is otherwise left untouched — see apply.ts. */
  openingImageIds: string[];
  /** Suggested clip length (in beats) for these opening clips only. */
  perImageClipBeats: number;
  /** Intrinsic quality of the images this plan would use, 0..1 — combined
   *  with style preference in select.ts, not itself style-aware. */
  qualityScore: number;
}

const HOOK_META: Record<HookArchetype, { label: string; description: string }> = {
  BEST_EXTERIOR_QUICK_ZOOM: {
    label: "Best Exterior, Quick Zoom",
    description: "Opens on the strongest exterior shot with a fast push and immediate title reveal.",
  },
  DRONE_FIRST: {
    label: "Drone First",
    description: "Opens aerial, then settles into the hero exterior — establishes scale immediately.",
  },
  TWILIGHT_REVEAL: {
    label: "Twilight Reveal",
    description: "Opens on the twilight exterior for a dramatic, moody first impression.",
  },
  LUXURY_INTERIOR_FIRST: {
    label: "Luxury Interior First",
    description: "Skips the exterior — opens straight into the best interior space.",
  },
  FAST_MONTAGE: {
    label: "Fast Montage",
    description: "Three rapid-fire cuts across different rooms before settling into normal pacing.",
  },
};

function byQualityDesc(a: HookCandidateImage, b: HookCandidateImage): number {
  return b.qualityScore - a.qualityScore;
}

function findByRoom(images: HookCandidateImage[], ...roomTypes: RoomType[]): HookCandidateImage[] {
  const set = new Set(roomTypes);
  return images.filter((i) => set.has(i.roomType)).sort(byQualityDesc);
}

function plan(
  archetype: HookArchetype,
  openingImageIds: string[],
  perImageClipBeats: number,
  qualityScore: number,
): HookPlan {
  return { archetype, ...HOOK_META[archetype], openingImageIds, perImageClipBeats, qualityScore };
}

function buildBestExteriorQuickZoom(images: HookCandidateImage[]): HookPlan | null {
  const candidates = findByRoom(images, "EXTERIOR_FRONT", "EXTERIOR_GENERAL", "TWILIGHT");
  const best = candidates[0];
  if (!best) return null;
  return plan("BEST_EXTERIOR_QUICK_ZOOM", [best.imageId], 3, best.qualityScore);
}

function buildDroneFirst(images: HookCandidateImage[]): HookPlan | null {
  const drones = findByRoom(images, "DRONE");
  const best = drones[0];
  if (!best) return null;
  return plan("DRONE_FIRST", [best.imageId], 3, best.qualityScore);
}

function buildTwilightReveal(images: HookCandidateImage[]): HookPlan | null {
  const twilight = findByRoom(images, "TWILIGHT");
  const best = twilight[0];
  if (!best) return null;
  return plan("TWILIGHT_REVEAL", [best.imageId], 5, best.qualityScore);
}

const INTERIOR_PRIORITY: Partial<Record<RoomType, number>> = {
  LIVING_ROOM: 0.06,
  KITCHEN: 0.03,
  MASTER_BEDROOM: 0,
};

function buildLuxuryInteriorFirst(images: HookCandidateImage[]): HookPlan | null {
  const candidates = findByRoom(images, "LIVING_ROOM", "KITCHEN", "MASTER_BEDROOM").sort(
    (a, b) =>
      b.qualityScore + (INTERIOR_PRIORITY[b.roomType] ?? 0) - (a.qualityScore + (INTERIOR_PRIORITY[a.roomType] ?? 0)),
  );
  const best = candidates[0];
  if (!best) return null;
  return plan("LUXURY_INTERIOR_FIRST", [best.imageId], 4, best.qualityScore);
}

function buildFastMontage(images: HookCandidateImage[]): HookPlan | null {
  const sorted = [...images].sort(byQualityDesc);
  const chosen: HookCandidateImage[] = [];
  const seenRoomTypes = new Set<RoomType>();

  for (const img of sorted) {
    if (chosen.length >= 3) break;
    if (seenRoomTypes.has(img.roomType)) continue;
    chosen.push(img);
    seenRoomTypes.add(img.roomType);
  }
  // Not enough room-type diversity — fill remaining slots ignoring the diversity constraint.
  if (chosen.length < 3) {
    for (const img of sorted) {
      if (chosen.length >= 3) break;
      if (chosen.includes(img)) continue;
      chosen.push(img);
    }
  }

  if (chosen.length < 2) return null;
  const avgQuality = chosen.reduce((sum, i) => sum + i.qualityScore, 0) / chosen.length;
  return plan(
    "FAST_MONTAGE",
    chosen.map((i) => i.imageId),
    1.5,
    avgQuality,
  );
}

const BUILDERS: Record<HookArchetype, (images: HookCandidateImage[]) => HookPlan | null> = {
  BEST_EXTERIOR_QUICK_ZOOM: buildBestExteriorQuickZoom,
  DRONE_FIRST: buildDroneFirst,
  TWILIGHT_REVEAL: buildTwilightReveal,
  LUXURY_INTERIOR_FIRST: buildLuxuryInteriorFirst,
  FAST_MONTAGE: buildFastMontage,
};

/** Builds every hook archetype that is feasible for this photo set — infeasible ones (e.g. no drone shot) are simply omitted. */
export function buildFeasibleHookPlans(images: HookCandidateImage[]): HookPlan[] {
  return Object.values(BUILDERS)
    .map((build) => build(images))
    .filter((p): p is HookPlan => p !== null);
}
