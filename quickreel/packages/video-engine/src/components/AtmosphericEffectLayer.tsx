import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { AtmosphericEffect } from "@quickreel/shared";

export interface AtmosphericEffectLayerProps {
  effect: AtmosphericEffect;
  durationInFrames: number;
}

/**
 * Purely procedural CSS overlays — no ML, no content awareness — composited
 * above ClipLayer at low opacity (effect.intensity, capped at 0.06-0.16
 * upstream by packages/atmospheric-engine). "Extremely subtle, luxury
 * only, never overuse" per product spec: every effect here reads as
 * ambient atmosphere, never as a graphic overlay competing with the photo.
 */
export function AtmosphericEffectLayer({ effect, durationInFrames }: AtmosphericEffectLayerProps) {
  const frame = useCurrentFrame();
  const t = durationInFrames > 0 ? frame / durationInFrames : 0;
  // Fade the effect in/out at the clip's edges so it never appears/disappears abruptly.
  const edgeFade = Math.min(1, interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" })) *
    Math.min(1, interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: "clamp" }));
  const opacity = effect.intensity * edgeFade;

  switch (effect.type) {
    case "CLOUD_DRIFT": {
      const driftX = -10 + t * 20;
      return (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity }}>
          <div
            style={{
              position: "absolute",
              top: "-10%",
              left: `${driftX}%`,
              width: "80%",
              height: "35%",
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)",
              filter: "blur(30px)",
            }}
          />
        </AbsoluteFill>
      );
    }

    case "LENS_FLARE": {
      const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI * 2);
      return (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: opacity * pulse }}>
          <div
            style={{
              position: "absolute",
              top: "18%",
              left: `${25 + t * 15}%`,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,244,214,1) 0%, rgba(255,244,214,0) 70%)",
              filter: "blur(4px)",
            }}
          />
        </AbsoluteFill>
      );
    }

    case "SOFT_SUN_RAYS": {
      const rotation = t * 20;
      return (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: opacity * 0.8 }}>
          <div
            style={{
              position: "absolute",
              inset: "-50%",
              background:
                "conic-gradient(from 0deg, rgba(255,244,214,0) 0deg, rgba(255,244,214,0.5) 8deg, rgba(255,244,214,0) 20deg, rgba(255,244,214,0) 340deg, rgba(255,244,214,0.5) 352deg, rgba(255,244,214,0) 360deg)",
              transform: `rotate(${rotation}deg)`,
            }}
          />
        </AbsoluteFill>
      );
    }

    case "REFLECTION_SHIMMER": {
      const shimmerPos = (t * 220) % 220;
      return (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity }}>
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "38%",
              backgroundImage:
                "repeating-linear-gradient(115deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0.5) 6px, rgba(255,255,255,0) 14px, rgba(255,255,255,0) 40px)",
              backgroundPositionX: `${shimmerPos}px`,
            }}
          />
        </AbsoluteFill>
      );
    }

    case "DUST_HAZE": {
      const hazeOpacity = opacity * (0.6 + 0.4 * Math.sin(t * Math.PI * 2));
      return (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: hazeOpacity }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at 50% 60%, rgba(255,250,240,0.8) 0%, rgba(255,250,240,0) 65%)",
            }}
          />
        </AbsoluteFill>
      );
    }

    case "WINDOW_GLOW": {
      const glowPulse = 0.85 + 0.15 * Math.sin(t * Math.PI * 2);
      return (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: opacity * glowPulse }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 60% 40% at 15% 20%, rgba(255,214,150,0.9) 0%, rgba(255,214,150,0) 60%)," +
                "radial-gradient(ellipse 60% 40% at 85% 15%, rgba(255,214,150,0.7) 0%, rgba(255,214,150,0) 60%)",
            }}
          />
        </AbsoluteFill>
      );
    }

    case "EXTERIOR_LIGHT_FADE": {
      const fade = 0.5 + 0.5 * t;
      return (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: opacity * fade }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(255,190,120,0.5) 0%, rgba(255,190,120,0) 55%)",
            }}
          />
        </AbsoluteFill>
      );
    }

    default:
      return null;
  }
}
