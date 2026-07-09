import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { BrandKitConfig } from "@quickreel/shared";

export interface BrandWatermarkLayerProps {
  brandKit: BrandKitConfig;
  logoUrl: string | undefined;
}

const POSITION_STYLE: Record<BrandKitConfig["watermarkPosition"], React.CSSProperties> = {
  TOP_LEFT: { top: "4%", left: "5%" },
  TOP_RIGHT: { top: "4%", right: "5%" },
  BOTTOM_LEFT: { bottom: "5%", left: "5%" },
  BOTTOM_RIGHT: { bottom: "5%", right: "5%" },
  CENTER: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

const FADE_IN_FRAMES = 20;

/**
 * A small, persistent brand mark composited over every clip — the one
 * un-timed layer in the composition (no Sequence wrapper), since it should
 * read throughout the whole reel rather than per clip. Fades in once at the
 * very start rather than snapping in, so it doesn't read as a UI overlay.
 */
export function BrandWatermarkLayer({ brandKit, logoUrl }: BrandWatermarkLayerProps) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_IN_FRAMES], [0, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (!logoUrl && !brandKit.agencyName) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity,
          filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.5))",
          ...POSITION_STYLE[brandKit.watermarkPosition],
        }}
      >
        {logoUrl && <Img src={logoUrl} style={{ height: 46, width: "auto", objectFit: "contain" }} />}
        {!logoUrl && brandKit.agencyName && (
          <span
            style={{
              fontFamily: brandKit.fontFamily ?? "Inter",
              fontWeight: 600,
              fontSize: 22,
              color: brandKit.primaryColor ?? "#ffffff",
              letterSpacing: 0.5,
            }}
          >
            {brandKit.agencyName}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
}
