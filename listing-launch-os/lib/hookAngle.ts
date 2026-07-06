import type { CampaignInput } from "./types";

/**
 * Picks a short-form-video "hook angle" (PK Script Assistant style) from the
 * supplied campaign data — never invents a rarity/luxury claim the data
 * doesn't support.
 */

export type HookAngleType =
  | "Feature Hook"
  | "Location Hook"
  | "Scarcity Hook"
  | "Buyer Insight Hook"
  | "Investor Hook"
  | "Luxury Hook";

export interface HookAngle {
  type: HookAngleType;
  reason: string;
}

const RARE_KEYWORDS = /waterfront|water view|sea view|ocean view|no through road|cul-de-sac|elevated|rare|last (?:one|section|remaining)|final section|reserve backing/i;

export function pickHookAngle(input: CampaignInput): HookAngle {
  if (input.targetBuyer === "luxury_buyer" || input.tone === "premium") {
    return { type: "Luxury Hook", reason: "premium tone / luxury buyer selection" };
  }
  if (input.targetBuyer === "investor") {
    return { type: "Investor Hook", reason: "investor buyer selection" };
  }

  const combinedText = `${input.keyFeatures || ""} ${input.notes || ""}`;
  if (RARE_KEYWORDS.test(combinedText)) {
    return { type: "Scarcity Hook", reason: "a rare or limited attribute mentioned in the property details" };
  }
  if (input.keyFeatures) {
    return { type: "Feature Hook", reason: "a standout supplied feature" };
  }
  if (input.amenities) {
    return { type: "Location Hook", reason: "supplied nearby amenities" };
  }
  return { type: "Buyer Insight Hook", reason: "the target buyer type, since no standout feature or amenity was supplied" };
}
