import React from "react";
import { Composition, registerRoot } from "remotion";
import { CURRENT_BEAT_ANALYSIS_VERSION, CURRENT_EDL_VERSION, type EditDecisionList } from "@quickreel/shared";
import { QuickReelComposition, type QuickReelCompositionProps } from "./Composition.js";
import { msToFrames } from "./timing.js";

/** Only used for Remotion Studio's default preview — every real render passes actual inputProps from apps/worker. */
const PLACEHOLDER_EDL: EditDecisionList = {
  version: CURRENT_EDL_VERSION,
  projectId: "placeholder",
  renderId: "placeholder",
  compositionWidth: 1080,
  compositionHeight: 1920,
  fps: 30,
  totalDurationMs: 4000,
  styleSlug: "luxury-cinematic",
  hookArchetype: "BEST_EXTERIOR_QUICK_ZOOM",
  musicTrackId: "placeholder",
  beatGrid: {
    bpm: 96,
    beatsPerBar: 4,
    beatTimestampsMs: [0, 625, 1250, 1875, 2500, 3125, 3750],
    barStartTimestampsMs: [0, 2500],
    energyCurve: [{ tMs: 0, energy: 0.5 }],
    sections: {
      intro: { startMs: 0, endMs: 2500 },
      buildUp: null,
      drop: null,
      body: { startMs: 2500, endMs: 4000 },
      outro: { startMs: 3500, endMs: 4000 },
    },
    durationMs: 4000,
    sourceTrackId: "placeholder",
    analysisVersion: CURRENT_BEAT_ANALYSIS_VERSION,
  },
  clips: [
    {
      clipIndex: 0,
      imageId: "placeholder",
      imageStorageKey: "placeholder.jpg",
      roomType: "EXTERIOR_FRONT",
      startMs: 0,
      endMs: 4000,
      durationMs: 4000,
      beatIndexStart: 0,
      beatIndexEnd: 6,
      camera: {
        type: "HERO_PUSH",
        startScale: 1,
        endScale: 1.12,
        startFocalPoint: { x: 0.5, y: 0.5 },
        endFocalPoint: { x: 0.5, y: 0.46 },
        easing: "easeOutCubic",
        intensity: 0.6,
      },
      transitionIn: { type: "LUXURY_FADE", durationMs: 600, easing: "easeInOut" },
      transitionOut: { type: "LUXURY_FADE", durationMs: 600, easing: "easeInOut" },
      textOverlays: [],
      depth: null,
      atmosphericEffect: null,
    },
  ],
  audio: { trackStorageKey: "placeholder.wav", startOffsetMs: 0 },
};

const PLACEHOLDER_PROPS: QuickReelCompositionProps = {
  edl: PLACEHOLDER_EDL,
  imageUrls: {},
  audioUrl: "",
};

export const QUICKREEL_COMPOSITION_ID = "QuickReel";

const RemotionRoot: React.FC = () => (
  <Composition
    id={QUICKREEL_COMPOSITION_ID}
    component={QuickReelComposition}
    durationInFrames={msToFrames(PLACEHOLDER_EDL.totalDurationMs, PLACEHOLDER_EDL.fps)}
    fps={PLACEHOLDER_EDL.fps}
    width={PLACEHOLDER_EDL.compositionWidth}
    height={PLACEHOLDER_EDL.compositionHeight}
    defaultProps={PLACEHOLDER_PROPS}
    calculateMetadata={async ({ props }) => ({
      durationInFrames: Math.max(1, msToFrames(props.edl.totalDurationMs, props.edl.fps)),
      fps: props.edl.fps,
      width: props.edl.compositionWidth,
      height: props.edl.compositionHeight,
    })}
  />
);

registerRoot(RemotionRoot);
