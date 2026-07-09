import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { CameraMove } from "@quickreel/shared";
import type { EDLClip } from "@quickreel/shared";
import { resolveEasing } from "../easing.js";
import { msToFrames } from "../timing.js";
import { getTransitionStyle } from "../transition-style.js";

export interface ClipLayerProps {
  clip: EDLClip;
  fps: number;
  imageUrl: string;
  /** Both present only when depth estimation succeeded for this image (apps/ai-service) — see depth-mask generation in packages/vision. */
  depthMapUrl?: string;
  foregroundMaskUrl?: string;
}

/** intensity=0 collapses motion amplitude to nothing (static frame); intensity=1 is the movement's full designed amplitude. */
function scaleAmplitude(value: number, baseline: number, intensity: number): number {
  return baseline + (value - baseline) * intensity;
}

interface LayerTransform {
  scale: number;
  translateXPercent: number;
  translateYPercent: number;
}

/**
 * Computes one layer's scale/translate at the given eased progress.
 * `amplitudeMultiplier` scales the camera move's effective intensity for
 * this layer only — this is the entire depth-parallax mechanism: the
 * foreground layer gets a larger multiplier than the background layer, so
 * it visibly moves/zooms faster over the same clip duration. Same focal-
 * point-under-scale math as the single-layer case (see below).
 */
function computeLayerTransform(camera: CameraMove, eased: number, amplitudeMultiplier: number): LayerTransform {
  const intensity = camera.intensity * amplitudeMultiplier;
  const startScale = scaleAmplitude(camera.startScale, 1, intensity);
  const endScale = scaleAmplitude(camera.endScale, 1, intensity);
  const scale = startScale + (endScale - startScale) * eased;

  const startFocalX = scaleAmplitude(camera.startFocalPoint.x, 0.5, intensity);
  const endFocalX = scaleAmplitude(camera.endFocalPoint.x, 0.5, intensity);
  const startFocalY = scaleAmplitude(camera.startFocalPoint.y, 0.5, intensity);
  const endFocalY = scaleAmplitude(camera.endFocalPoint.y, 0.5, intensity);
  const focalX = startFocalX + (endFocalX - startFocalX) * eased;
  const focalY = startFocalY + (endFocalY - startFocalY) * eased;

  return {
    scale,
    translateXPercent: -(focalX - 0.5) * 100 * scale,
    translateYPercent: -(focalY - 0.5) * 100 * scale,
  };
}

/** Background layer moves less than the single-layer baseline; foreground moves more — net "foreground moves faster, background moves slower" without changing the clip's overall designed amplitude. */
const BACKGROUND_AMPLITUDE_MULTIPLIER = 0.72;
const FOREGROUND_AMPLITUDE_MULTIPLIER = 1.55;

/**
 * Renders one clip: the source photo, pixel-untouched (only CSS
 * scale/translate/filter/mask applied — never a pixel-editing/generative
 * operation), animated per its assigned CameraMove, with the transition
 * in/out effects layered on top during their respective windows.
 *
 * When a depth map + foreground mask are available, renders TWO copies of
 * the same photo instead of one: a background layer (full frame, slower
 * motion) and a foreground layer (CSS `mask-image` cut to the near-depth
 * pixels via the precomputed matte, faster motion) — genuine depth-cued
 * parallax reconstructed entirely from the original pixels, geometry
 * preserved, nothing synthesized. Falls back to single-layer motion when
 * depth data is absent (see honest-gap notes in apps/ai-service).
 *
 * Focal-point math keeps the camera's chosen point of interest centered
 * under scale, using CSS translate-percentage semantics (which resolve
 * against the element's unscaled box, independent of any `scale()` in the
 * same transform property).
 */
export function ClipLayer({ clip, fps, imageUrl, depthMapUrl, foregroundMaskUrl }: ClipLayerProps) {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1, msToFrames(clip.durationMs, fps));
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = resolveEasing(clip.camera.easing)(progress);

  const hasDepth = Boolean(depthMapUrl && foregroundMaskUrl);
  const backgroundTransform = computeLayerTransform(clip.camera, eased, hasDepth ? BACKGROUND_AMPLITUDE_MULTIPLIER : 1);
  const foregroundTransform = hasDepth ? computeLayerTransform(clip.camera, eased, FOREGROUND_AMPLITUDE_MULTIPLIER) : null;

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
          transform: `translate(${backgroundTransform.translateXPercent}%, ${backgroundTransform.translateYPercent}%) scale(${backgroundTransform.scale})`,
        }}
      />
      {foregroundTransform && (
        <Img
          src={imageUrl}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transformOrigin: "50% 50%",
            transform: `translate(${foregroundTransform.translateXPercent}%, ${foregroundTransform.translateYPercent}%) scale(${foregroundTransform.scale})`,
            maskImage: `url(${foregroundMaskUrl})`,
            maskMode: "luminance",
            maskSize: "cover",
            maskRepeat: "no-repeat",
            WebkitMaskImage: `url(${foregroundMaskUrl})`,
            WebkitMaskSize: "cover",
            WebkitMaskRepeat: "no-repeat",
          }}
        />
      )}
    </AbsoluteFill>
  );
}
