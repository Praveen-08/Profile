import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { EDLClip } from "@quickreel/shared";
import { resolveEasing } from "../easing.js";
import { msToFrames } from "../timing.js";
import { getTransitionStyle } from "../transition-style.js";

export interface ClipLayerProps {
  clip: EDLClip;
  fps: number;
  imageUrl: string;
}

/** intensity=0 collapses motion amplitude to nothing (static frame); intensity=1 is the movement's full designed amplitude. */
function scaleAmplitude(value: number, baseline: number, intensity: number): number {
  return baseline + (value - baseline) * intensity;
}

/**
 * Renders one clip: the source photo, pixel-untouched (only CSS
 * scale/translate/filter applied — never a pixel-editing/generative
 * operation), animated per its assigned CameraMove, with the transition
 * in/out effects layered on top during their respective windows at the
 * start and end of the clip.
 *
 * Focal-point math keeps the camera's chosen point of interest centered
 * under scale, using CSS translate-percentage semantics (which resolve
 * against the element's unscaled box, independent of any `scale()` in the
 * same transform property — see the derivation this repo's PR description
 * or packages/video-engine/README.md).
 */
export function ClipLayer({ clip, fps, imageUrl }: ClipLayerProps) {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1, msToFrames(clip.durationMs, fps));
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = resolveEasing(clip.camera.easing)(progress);

  const intensity = clip.camera.intensity;
  const startScale = scaleAmplitude(clip.camera.startScale, 1, intensity);
  const endScale = scaleAmplitude(clip.camera.endScale, 1, intensity);
  const scale = startScale + (endScale - startScale) * eased;

  const startFocalX = scaleAmplitude(clip.camera.startFocalPoint.x, 0.5, intensity);
  const endFocalX = scaleAmplitude(clip.camera.endFocalPoint.x, 0.5, intensity);
  const startFocalY = scaleAmplitude(clip.camera.startFocalPoint.y, 0.5, intensity);
  const endFocalY = scaleAmplitude(clip.camera.endFocalPoint.y, 0.5, intensity);
  const focalX = startFocalX + (endFocalX - startFocalX) * eased;
  const focalY = startFocalY + (endFocalY - startFocalY) * eased;

  const translateXPercent = -(focalX - 0.5) * 100 * scale;
  const translateYPercent = -(focalY - 0.5) * 100 * scale;

  const transitionInFrames = msToFrames(clip.transitionIn.durationMs, fps);
  const transitionOutStartFrame = durationInFrames - msToFrames(clip.transitionOut.durationMs, fps);

  let transitionStyle = { opacity: 1, transform: "", filter: "" };
  if (frame < transitionInFrames && transitionInFrames > 0) {
    transitionStyle = getTransitionStyle(clip.transitionIn.type, frame / transitionInFrames, "in");
  } else if (frame >= transitionOutStartFrame && clip.transitionOut.durationMs > 0) {
    const outProgress = (frame - transitionOutStartFrame) / (durationInFrames - transitionOutStartFrame);
    transitionStyle = getTransitionStyle(clip.transitionOut.type, outProgress, "out");
  }

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        backgroundColor: "#000",
        opacity: transitionStyle.opacity,
        filter: transitionStyle.filter || undefined,
        transform: transitionStyle.transform || undefined,
      }}
    >
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transformOrigin: "50% 50%",
          transform: `translate(${translateXPercent}%, ${translateYPercent}%) scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
}
