import { TARGET_BUYER_LABELS, type CampaignInput, type TargetBuyer } from "./types";

/**
 * Buyer-fit framing. "family" is the form's default selection, so treating
 * it as gospel for every property (including a 2-bedroom unit) produces
 * copy that doesn't match the actual property profile. When the property
 * looks like a starter/compact profile, we widen the framing to buyer types
 * it genuinely suits, rather than assuming a family angle just because that
 * was the default left in the form.
 */

const BASE_ANGLES: Record<TargetBuyer, string> = {
  first_home_buyer: "an excellent opportunity to step onto the property ladder",
  family: "a practical, comfortable home for family life",
  investor: "a listing worth adding to your portfolio shortlist",
  downsizer: "a low-maintenance option for a simpler next chapter",
  luxury_buyer: "a refined home for discerning buyers",
};

const BLENDED_STARTER_ANGLE =
  "a practical option for first-home buyers, professionals, downsizers, or investors seeking a low-maintenance property";

const BLENDED_STARTER_LABEL = "first-home buyers, professionals, and downsizers";

const COMPACT_PROPERTY_TYPES = new Set(["unit", "apartment"]);

function looksLikeStarterProfile(input: CampaignInput): boolean {
  const smallBedrooms = typeof input.bedrooms === "number" && input.bedrooms <= 2;
  const compactType = COMPACT_PROPERTY_TYPES.has((input.propertyType || "").toLowerCase());
  return smallBedrooms || compactType;
}

/** True when the "family" selection looks like it was left as the default rather than a deliberate fit. */
function isUnsupportedFamilyAngle(input: CampaignInput): boolean {
  return input.targetBuyer === "family" && looksLikeStarterProfile(input);
}

export function getBuyerAngle(input: CampaignInput): string {
  if (isUnsupportedFamilyAngle(input)) return BLENDED_STARTER_ANGLE;
  return BASE_ANGLES[input.targetBuyer];
}

/** Short plural label for use in phrases like "well suited to ___ buyers." */
export function getBuyerLabel(input: CampaignInput): string {
  if (isUnsupportedFamilyAngle(input)) return BLENDED_STARTER_LABEL;
  const label = TARGET_BUYER_LABELS[input.targetBuyer].toLowerCase();
  return label.endsWith("buyer") ? `${label}s` : `${label} buyers`;
}
