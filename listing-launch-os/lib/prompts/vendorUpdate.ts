import { VENDOR_UPDATE_TYPE_LABELS, VENDOR_UPDATE_TONE_LABELS, type VendorUpdateContext } from "../types";

interface PromptSet {
  system: string;
  user: string;
}

/**
 * Compliance + style rules for vendor update reports. These are distinct
 * from the campaign-copy rules: the audience is the vendor (not buyers), the
 * goal is an honest status report, and the biggest risk is either inventing
 * numbers or causing unnecessary alarm.
 */
export const VENDOR_UPDATE_SYSTEM_PROMPT = `You are a New Zealand real estate agent's assistant, writing vendor (seller) campaign updates for "Listing Launch". You write honest, calm, professional updates — never hype, never spin.

Hard rules (never break these):
1. Only use numbers and facts explicitly given to you. Never invent enquiry counts, open-home attendance, offer amounts, or online view counts.
2. If a number wasn't provided, write about it in general terms (e.g. "a steady flow of enquiries") rather than guessing or leaving an awkward gap.
3. Keep the tone calm and confidence-building. The vendor should feel informed, not panicked — even when the update includes soft enquiry numbers or price feedback.
4. Never overpromise a sale outcome, timeframe, or price. Never make guaranteed claims about market conditions.
5. If the update includes price feedback, market commentary, or anything a vendor could read as a valuation, keep the wording careful and hedged (e.g. "buyers have suggested...", "feedback indicates...") — never state it as fact.
6. Use New Zealand English spelling and idiom.
7. Match the requested tone (confident, warm, direct, careful, or premium) without abandoning rules 1-6.
8. Output only the requested content — no preamble, no "Here is...".`;

export function buildVendorUpdateContextBlock(input: VendorUpdateContext): string {
  const lines = [
    `Property: ${input.address}, ${input.suburb} (${input.propertyType})`,
    `Update type: ${VENDOR_UPDATE_TYPE_LABELS[input.updateType]}`,
    typeof input.enquiries === "number" ? `Enquiries: ${input.enquiries}` : null,
    typeof input.openHomeGroups === "number" ? `Open home groups through: ${input.openHomeGroups}` : null,
    input.buyerFeedbackSummary ? `Buyer feedback summary: ${input.buyerFeedbackSummary}` : null,
    input.positiveFeedback ? `Positive feedback: ${input.positiveFeedback}` : null,
    input.concerns ? `Concerns/objections raised: ${input.concerns}` : null,
    input.priceFeedback ? `Price feedback: ${input.priceFeedback}` : null,
    input.offersOrInterest ? `Offers or serious interest: ${input.offersOrInterest}` : null,
    input.onlineViews ? `Online views/clicks: ${input.onlineViews}` : null,
    input.socialActivity ? `Social media activity: ${input.socialActivity}` : null,
    input.recommendedNextStep ? `Agent's recommended next step: ${input.recommendedNextStep}` : null,
    input.agentNotes ? `Additional agent notes: ${input.agentNotes}` : null,
    `Tone: ${VENDOR_UPDATE_TONE_LABELS[input.tone]}`,
    input.agentName ? `Agent name: ${input.agentName}` : null,
    input.agencyName ? `Agency: ${input.agencyName}` : null,
    input.agentPhone ? `Agent phone: ${input.agentPhone}` : null,
    input.agentEmail ? `Agent email: ${input.agentEmail}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

const VENDOR_UPDATE_SECTION_INSTRUCTIONS: Record<string, string> = {
  vendor_update_email: `Write a complete vendor update email (150-220 words). Greeting, a calm summary of campaign activity since the last update, buyer feedback (positive and any concerns, framed constructively), price feedback if supplied (hedged, not stated as fact), any offers or serious interest, the recommended next step, and a warm sign-off with the agent's name and contact details if supplied. If the update includes price or market-sensitive commentary, add one short closing line reminding the reader this is feedback, not a valuation.`,

  sms_update: `Write a short SMS/WhatsApp-style update (under 300 characters). One or two sentences: the headline update plus the recommended next step or an invitation to call for more detail. No email formatting, no greeting needed.`,

  what_we_learned: `Write a short "What we learned" summary (3-5 bullet points) capturing the key takeaways from this period of the campaign — buyer profile signals, feedback themes, price positioning signals, and any promotional channel performance. Keep it factual and grounded only in what was supplied.`,

  buyer_feedback_summary: `Write a structured buyer feedback summary with two short sections: "Positive feedback" and "Concerns raised". Use the supplied feedback only. If one side has nothing supplied, write a single honest line for that section instead of inventing content (e.g. "No specific concerns raised so far.").`,

  recommended_next_steps: `Write 3-5 numbered recommended next steps for the campaign, grounded in the agent's recommended next step and the update type. Keep it practical and specific to what a solo agent can action in the coming days.`,

  price_feedback_wording: `Write a careful paragraph summarising the price feedback received, using hedged, non-committal language (e.g. "buyers have indicated...", "feedback suggests..."). Do not state a value as fact and do not suggest a specific price adjustment. End with a one-line reminder that this is market feedback, not a valuation, and should be discussed directly with the agent before acting on it.`,

  next_7day_actions: `Write a simple next-7-day campaign action plan, formatted as "Day 1" through "Day 7". Each day gets one short, concrete action (e.g. follow up with an interested buyer, refresh a social post, review feedback with the vendor). Base it on the update type and recommended next step; keep the rest realistic and generic rather than invented specifics.`,
};

export function getVendorUpdateSectionPrompt(sectionKey: string, input: VendorUpdateContext): PromptSet {
  const instruction = VENDOR_UPDATE_SECTION_INSTRUCTIONS[sectionKey];
  if (!instruction) {
    throw new Error(`Unknown vendor update section key: ${sectionKey}`);
  }

  const user = `Vendor update details:\n${buildVendorUpdateContextBlock(input)}\n\nTask:\n${instruction}`;

  return { system: VENDOR_UPDATE_SYSTEM_PROMPT, user };
}
