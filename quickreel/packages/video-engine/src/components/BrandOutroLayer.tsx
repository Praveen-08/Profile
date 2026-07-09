import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { BrandKitConfig } from "@quickreel/shared";
import { resolveEasing } from "../easing.js";

export interface BrandOutroLayerProps {
  brandKit: BrandKitConfig;
  logoUrl: string | undefined;
  outroImageUrl: string | undefined;
}

const ENTRANCE_FRAMES = 22;

/**
 * The final full-screen brand card, appended after the last photo clip —
 * logo, agency name, and contact details, held for BRAND_OUTRO_DURATION_MS.
 * If the brand kit's outro asset is itself a photo/graphic (not just a
 * logo), it's used as the card's background; otherwise falls back to a
 * plain dark field tinted with the brand's primary color.
 */
export function BrandOutroLayer({ brandKit, logoUrl, outroImageUrl }: BrandOutroLayerProps) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, ENTRANCE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = resolveEasing("cinematicEaseInOut")(progress);
  const scale = 1.04 - eased * 0.04;

  const contactLine = [brandKit.contactPhone, brandKit.contactEmail, brandKit.contactWebsite]
    .filter(Boolean)
    .join("   ·   ");

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandKit.secondaryColor ?? "#0a0a0a",
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
      }}
    >
      {outroImageUrl && (
        <Img
          src={outroImageUrl}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }}
        />
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          opacity: eased,
          transform: `scale(${scale})`,
        }}
      >
        {logoUrl && <Img src={logoUrl} style={{ height: 110, width: "auto", objectFit: "contain" }} />}
        {brandKit.agencyName && (
          <span
            style={{
              fontFamily: brandKit.fontFamily ?? "Inter",
              fontWeight: 600,
              fontSize: 40,
              color: brandKit.primaryColor ?? "#ffffff",
              letterSpacing: 1,
              textAlign: "center",
            }}
          >
            {brandKit.agencyName}
          </span>
        )}
        {contactLine && (
          <span
            style={{
              fontFamily: brandKit.fontFamily ?? "Inter",
              fontWeight: 400,
              fontSize: 20,
              color: "rgba(255,255,255,0.75)",
              letterSpacing: 0.5,
              textAlign: "center",
            }}
          >
            {contactLine}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
}
