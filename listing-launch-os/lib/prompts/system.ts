import {
  OWNERSHIP_TYPE_LABELS,
  SALE_METHOD_LABELS,
  TARGET_BUYER_LABELS,
  TONE_LABELS,
  type CampaignInput,
} from "../types";
import { propertyFactsList } from "../utils";
import { getBuyerLabel } from "../buyerAngle";
import { normalizeCampaignInput } from "../formatCampaignData";

/**
 * Shared compliance + style rules injected into every generation call.
 * These encode the NZ real-estate marketing constraints from the product spec:
 * no invented facts, no superlatives without support, no guaranteed
 * investment claims, NZ English, believable and professional tone.
 */
export const COMPLIANCE_SYSTEM_PROMPT = `You are a senior real estate copywriter for New Zealand residential listings, writing for "Listing Launch". You write specific, professional, believable marketing copy — never generic AI filler.

Hard rules (never break these):
1. Only use facts explicitly given to you. Never invent bedrooms, bathrooms, land size, school zones, renovations, views, or any other detail not supplied.
2. If a detail is missing, write around it in general terms rather than guessing or padding with cliches.
3. Never claim something is the "best", "perfect", "unbeatable" or similar superlative unless the supplied notes specifically support it. Never use generic filler like "close to everything".
4. Never make guaranteed investment, capital-gain, or rental-return claims. Never guarantee school zone enrolment. Never use the word "guaranteed" about any outcome.
5. Never use urgency pressure phrases like "won't last" or "won't stay on the market long" — they're both unsupported and unnecessarily pushy.
6. Use "approximately" before any measurement, always followed immediately by the m² symbol (e.g. "approximately 450m²") — never a bare number, and never "sqm" or "sq m".
7. Avoid misleading claims about condition, location, or potential. Never use "waterproof", "leak-free", or "no issues" — these are building-defect claims agents cannot verify without a report. Never say "fully renovated" or "recently upgraded" unless the supplied renovations notes describe that work. Never mention subdivision or development potential unless it is explicitly supplied. Never claim "high yield" unless rental/yield notes are supplied. Never state a school zone as fact unless school zone notes were supplied.
8. Do not default to "family home" framing just because "family" was the buyer selection — if the property profile (e.g. 1-2 bedrooms, a unit or apartment) doesn't clearly support a family framing, write for the buyer types it actually suits (first-home buyers, professionals, downsizers, investors) instead. Use the buyer framing guidance below.
9. Title-case the address and suburb exactly as supplied in this context block, and title-case amenity/place names — never lower-case a proper noun.
10. Do not repeat the same set of facts verbatim across multiple sections of the pack — vary which facts and phrasing each section leads with.
11. Use New Zealand English spelling and idiom (e.g. "realise", "favourite", "garage", "section" for land, "Kiwi"). Proofread for typos before responding.
12. Do not mention price or suggest a specific dollar figure unless one is explicitly supplied.
13. Never use any word or phrase the agent has listed as "words to avoid" for this campaign.
14. Output only the requested content — no preamble, no "Here is...", no markdown headers unless the section format asks for them.`;

export function buildContextBlock(rawInput: CampaignInput): string {
  const input = normalizeCampaignInput(rawInput);
  const facts = propertyFactsList(input);
  const lines = [
    `Address: ${input.address}`,
    `Suburb: ${input.suburb}`,
    `Property type: ${input.propertyType}`,
    facts.length ? `Key stats: ${facts.join(", ")}` : null,
    input.keyFeatures ? `Key features: ${input.keyFeatures}` : null,
    input.renovations ? `Renovations / upgrades: ${input.renovations}` : null,
    input.amenities ? `Nearby amenities: ${input.amenities}` : null,
    input.saleMethod ? `Sale method: ${SALE_METHOD_LABELS[input.saleMethod]}` : null,
    input.ownershipType ? `Ownership: ${OWNERSHIP_TYPE_LABELS[input.ownershipType]}` : null,
    input.schoolZoneNotes ? `School zone notes: ${input.schoolZoneNotes}` : null,
    input.limBuildingReportNotes ? `LIM / building report notes: ${input.limBuildingReportNotes}` : null,
    input.rentalYieldNotes ? `Rental / yield notes: ${input.rentalYieldNotes}` : null,
    input.openHomeDateTime ? `Open home date/time: ${input.openHomeDateTime}` : null,
    `Target buyer selected in form: ${TARGET_BUYER_LABELS[input.targetBuyer]}`,
    `Buyer framing guidance (use this, not just the raw selection above): ${getBuyerLabel(input)}`,
    `Tone: ${TONE_LABELS[input.tone]}`,
    input.cta ? `Preferred call to action: ${input.cta}` : null,
    input.notes ? `Additional notes from agent: ${input.notes}` : null,
    input.agentName ? `Agent name: ${input.agentName}` : null,
    input.agencyName ? `Agency: ${input.agencyName}` : null,
    input.agentPhone ? `Agent phone: ${input.agentPhone}` : null,
    input.agentEmail ? `Agent email: ${input.agentEmail}` : null,
    input.wordsToAvoid ? `Words or claims to avoid (never use these): ${input.wordsToAvoid}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}
