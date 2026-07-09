import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { TextOverlay } from "@quickreel/shared";

export interface TextOverlayLayerProps {
  overlay: TextOverlay;
  fps: number;
  durationInFrames: number;
}

const POSITION_STYLE: Record<TextOverlay["position"], React.CSSProperties> = {
  lowerThird: { justifyContent: "flex-end", alignItems: "flex-start", paddingBottom: "14%", paddingLeft: "7%" },
  center: { justifyContent: "center", alignItems: "center" },
  topBanner: { justifyContent: "flex-start", alignItems: "center", paddingTop: "8%" },
};

const ENTRANCE_FRAMES = 14;
const EXIT_FRAMES = 10;

export function TextOverlayLayer({ overlay, fps, durationInFrames }: TextOverlayLayerProps) {
  const frame = useCurrentFrame();
  const entranceProgress = interpolate(frame, [0, ENTRANCE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitProgress = interpolate(
    frame,
    [durationInFrames - EXIT_FRAMES, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const { transform, opacity, clipPath, visibleChars } = animationStyle(
    overlay.animationIn,
    overlay.animationOut,
    entranceProgress,
    exitProgress,
    overlay.text.length,
  );

  const displayText = visibleChars !== undefined ? overlay.text.slice(0, visibleChars) : overlay.text;

  return (
    <AbsoluteFill style={{ display: "flex", ...POSITION_STYLE[overlay.position] }}>
      <div
        style={{
          transform,
          opacity,
          clipPath,
          fontFamily: overlay.styleTokens.fontFamily,
          fontWeight: overlay.styleTokens.fontWeight,
          color: overlay.styleTokens.color,
          fontSize: overlay.styleTokens.sizePx,
          letterSpacing: overlay.position === "topBanner" ? 4 : 0.5,
          textTransform: overlay.position === "topBanner" ? "uppercase" : "none",
          textShadow: "0 2px 16px rgba(0,0,0,0.45)",
        }}
      >
        {displayText}
      </div>
    </AbsoluteFill>
  );
}

function animationStyle(
  animationIn: TextOverlay["animationIn"],
  animationOut: TextOverlay["animationOut"],
  entrance: number,
  exit: number,
  textLength: number,
): { transform: string; opacity: number; clipPath: string; visibleChars?: number } {
  let opacity = entrance * (1 - exit);
  let translateY = 0;
  let translateX = 0;
  let clipPath = "none";
  let visibleChars: number | undefined;

  switch (animationIn) {
    case "fadeUp":
      translateY += (1 - entrance) * 24;
      break;
    case "slideIn":
      translateX += (1 - entrance) * 60;
      break;
    case "typewriter":
      opacity = 1 - exit;
      visibleChars = Math.round(entrance * textLength);
      break;
    case "maskWipe":
      clipPath = `inset(0 ${(1 - entrance) * 100}% 0 0)`;
      break;
  }

  switch (animationOut) {
    case "fadeDown":
      translateY += exit * 24;
      break;
    case "slideOut":
      translateX += exit * 60;
      break;
    case "fadeOut":
    default:
      break;
  }

  return {
    transform: `translate(${translateX}px, ${translateY}px)`,
    opacity,
    clipPath,
    visibleChars,
  };
}
