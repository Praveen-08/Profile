import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import type { EditDecisionList, TextOverlay } from "@quickreel/shared";
import { AtmosphericEffectLayer } from "./components/AtmosphericEffectLayer.js";
import { ClipLayer } from "./components/ClipLayer.js";
import { TextOverlayLayer } from "./components/TextOverlayLayer.js";
import { msToFrames } from "./timing.js";

/**
 * Intersected with `Record<string, unknown>` so this satisfies Remotion's
 * `<Composition props extends Record<string, unknown>>` generic constraint
 * — a plain interface without an index signature isn't structurally
 * assignable to that constraint even though every field is a known type.
 */
export type QuickReelCompositionProps = {
  edl: EditDecisionList;
  /** imageStorageKey -> fetchable URL, resolved by the worker before render (keeps this package storage-adapter-agnostic). */
  imageUrls: Record<string, string>;
  audioUrl: string;
} & Record<string, unknown>;

function volumeAt(edl: EditDecisionList, frameMs: number): number {
  const curve = edl.audio.volumeCurve;
  if (!curve || curve.length === 0) return 1;
  let result = curve[0]!.gain;
  for (const sample of curve) {
    if (sample.tMs > frameMs) break;
    result = sample.gain;
  }
  return result;
}

/**
 * The single Remotion composition every render goes through — a pure
 * function of the EDL. No per-style branching lives here: every visual
 * decision (which movement, which transition, which text, when) was
 * already made upstream by the AI Director Engine packages and baked into
 * `edl`.
 */
export function QuickReelComposition({ edl, imageUrls, audioUrl }: QuickReelCompositionProps) {
  const uniqueOverlays = useMemo(() => {
    const byId = new Map<string, TextOverlay>();
    for (const clip of edl.clips) {
      for (const overlay of clip.textOverlays) {
        byId.set(overlay.id, overlay);
      }
    }
    return [...byId.values()];
  }, [edl.clips]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {edl.clips.map((clip) => {
        const durationInFrames = Math.max(1, msToFrames(clip.durationMs, edl.fps));
        return (
          <Sequence
            key={clip.imageId + clip.clipIndex}
            from={msToFrames(clip.startMs, edl.fps)}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <ClipLayer
              clip={clip}
              fps={edl.fps}
              imageUrl={imageUrls[clip.imageStorageKey] ?? clip.imageStorageKey}
              depthMapUrl={clip.depth ? imageUrls[clip.depth.depthMapStorageKey] : undefined}
              foregroundMaskUrl={clip.depth ? imageUrls[clip.depth.foregroundMaskStorageKey] : undefined}
            />
            {clip.atmosphericEffect && (
              <AtmosphericEffectLayer effect={clip.atmosphericEffect} durationInFrames={durationInFrames} />
            )}
          </Sequence>
        );
      })}

      {uniqueOverlays.map((overlay) => {
        const from = msToFrames(overlay.startMs, edl.fps);
        const durationInFrames = Math.max(1, msToFrames(overlay.endMs - overlay.startMs, edl.fps));
        return (
          <Sequence key={overlay.id} from={from} durationInFrames={durationInFrames} layout="none">
            <TextOverlayLayer overlay={overlay} fps={edl.fps} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}

      <Audio
        src={audioUrl}
        startFrom={msToFrames(edl.audio.startOffsetMs, edl.fps)}
        volume={(frame) => volumeAt(edl, (frame / edl.fps) * 1000)}
      />
    </AbsoluteFill>
  );
}
