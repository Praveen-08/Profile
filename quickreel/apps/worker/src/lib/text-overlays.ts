import type { StyleConfig, TextOverlay } from "@quickreel/shared";
import type { ClipTiming } from "@quickreel/beat-engine";

export interface OverlayProjectFields {
  title: string | null;
  address: string | null;
  bedCount: number | null;
  bathCount: number | null;
}

const OPENING_BANNER_MS = 2500;
const DETAILS_BANNER_MS = 2800;

function makeOverlay(
  id: string,
  kind: TextOverlay["kind"],
  text: string,
  startMs: number,
  endMs: number,
  style: StyleConfig,
): TextOverlay {
  return {
    id,
    kind,
    text,
    startMs,
    endMs,
    animationIn: style.typography.animationPreset,
    animationOut: style.typography.animationPreset === "typewriter" ? "fadeOut" : "fadeDown",
    position: style.typography.overlayPositions[kind] ?? "lowerThird",
    styleTokens: {
      fontFamily: style.typography.fontFamily,
      fontWeight: style.typography.headlineWeight,
      color: style.typography.accentColor,
      sizePx: kind === "LOGO" ? 44 : kind === "ADDRESS" ? 34 : 40,
    },
  };
}

/**
 * Deliberately minimal per product spec ("never overcrowd the screen"):
 * at most three overlays across the whole reel — an opening banner, one
 * combined property-details card (address + bed/bath folded into a single
 * lowerThird block rather than three separate overlays), and a closing
 * logo card. Any field the agent didn't provide is simply omitted rather
 * than shown empty.
 */
export function buildTextOverlays(clipTimings: ClipTiming[], project: OverlayProjectFields, style: StyleConfig): TextOverlay[] {
  const overlays: TextOverlay[] = [];
  if (clipTimings.length === 0) return overlays;

  const firstClip = clipTimings[0]!;
  overlays.push(
    makeOverlay("hook-banner", "JUST_LISTED", "JUST LISTED", 0, Math.min(firstClip.endMs, OPENING_BANNER_MS), style),
  );

  const detailParts: string[] = [];
  if (project.address) detailParts.push(project.address);
  if (project.bedCount) detailParts.push(`${project.bedCount} BED`);
  if (project.bathCount) detailParts.push(`${project.bathCount} BATH`);

  if (detailParts.length > 0) {
    const detailsClipIndex = Math.min(2, clipTimings.length - 1);
    const clip = clipTimings[detailsClipIndex]!;
    overlays.push(
      makeOverlay(
        "details",
        "ADDRESS",
        detailParts.join("  ·  "),
        clip.startMs,
        Math.min(clip.endMs, clip.startMs + DETAILS_BANNER_MS),
        style,
      ),
    );
  }

  const lastClip = clipTimings[clipTimings.length - 1]!;
  overlays.push(makeOverlay("logo", "LOGO", project.title ?? "QuickReel", lastClip.startMs, lastClip.endMs, style));

  return overlays;
}

/** Attaches every overlay whose time window intersects a clip to that clip's `textOverlays`. */
export function assignOverlaysToClips<T extends { startMs: number; endMs: number }>(
  clips: T[],
  overlays: TextOverlay[],
): (T & { textOverlays: TextOverlay[] })[] {
  return clips.map((clip) => ({
    ...clip,
    textOverlays: overlays.filter((o) => o.startMs < clip.endMs && o.endMs > clip.startMs),
  }));
}
