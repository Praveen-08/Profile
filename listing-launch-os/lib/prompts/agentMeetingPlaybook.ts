import { MARKETING_PACKAGES } from "../marketingPackages";
import {
  MEETING_SALE_METHOD_LABELS,
  MEETING_TONE_LABELS,
  MEETING_TYPE_LABELS,
  VENDOR_CONCERN_LABELS,
  VENDOR_MOTIVATION_LABELS,
  VENDOR_PERSONALITY_LABELS,
  VENDOR_PRIORITY_LABELS,
  type AgentMeetingPlaybookFormData,
} from "../types";

interface PromptSet {
  system: string;
  user: string;
}

/**
 * Compliance + style rules for the Agent Meeting Playbook. This module
 * touches the most compliance-sensitive part of the agent's job — appraisal
 * and listing meetings — so the rules here are the strictest in the app:
 * workflow guidance and draft wording only, never legal advice, and never a
 * substitute for the agent's own agency procedures and REA obligations.
 */
export const AGENT_MEETING_PLAYBOOK_SYSTEM_PROMPT = `You are an experienced New Zealand real estate coach helping an agent prepare for a vendor/appraisal/listing meeting, writing for "Listing Launch". You produce practical, specific, professional workflow guidance and draft wording — never generic filler, never legal advice.

Hard rules (never break these):
1. This is workflow guidance and draft wording only — never legal advice. Do not tell the agent what they are legally required to do; instead remind them to confirm requirements against their agency's procedures and the Real Estate Authority (REA) obligations.
2. Never guarantee a sale price, timeframe, or outcome. Never imply a valuation figure as certain.
3. Marketing packages and costs are editable templates and inputs, not fixed national prices or promises. If specific costs were supplied, use them; if not, use placeholder wording and advise the agent to confirm exact costs with their agency/provider before presenting to the vendor.
4. Always be clear about what marketing is included in a package versus what the vendor may be separately charged for.
5. Never state an unsupported factual claim about the property. Only use what was explicitly supplied, and flag anything the agent should verify before using it in marketing.
6. A written appraisal is required before a prospective client signs an agency agreement in New Zealand — where relevant, remind the agent of this rather than assuming it's already been provided.
7. Keep the tone calm, respectful, and professional — never pushy, never high-pressure.
8. Use New Zealand English spelling and idiom.
9. Match the requested tone (professional, premium, warm, direct, confident, or consultative) without abandoning rules 1-8.
10. Output only the requested content — no preamble, no "Here is...".`;

function formatCostLine(label: string, value?: string): string | null {
  return value ? `${label}: ${value}` : null;
}

export function buildMeetingPlaybookContextBlock(input: AgentMeetingPlaybookFormData): string {
  const packagesBlock = MARKETING_PACKAGES.map((p) => `${p.label}: ${p.inclusions.join(", ")}`).join("\n");

  const costLines = [
    formatCostLine("Photography cost", input.photographyCost),
    formatCostLine("Video cost", input.videoCost),
    formatCostLine("Floor plan cost", input.floorPlanCost),
    formatCostLine("Drone/aerial cost", input.droneCost),
    formatCostLine("Twilight cost", input.twilightCost),
    formatCostLine("Portal upgrade cost", input.portalUpgradeCost),
    formatCostLine("Social ad budget", input.socialAdBudget),
    formatCostLine("Print/signage cost", input.printSignageCost),
    formatCostLine("Total recommended marketing budget", input.totalBudget),
  ].filter(Boolean);

  const lines = [
    `Meeting type: ${MEETING_TYPE_LABELS[input.meetingType]}`,
    `Property: ${input.propertyAddress}, ${input.suburb} (${input.propertyType})`,
    input.estimatedValueRange ? `Estimated value range: ${input.estimatedValueRange}` : null,
    input.saleMethod ? `Sale method being considered: ${MEETING_SALE_METHOD_LABELS[input.saleMethod]}` : null,
    input.meetingDateTime ? `Meeting date/time: ${input.meetingDateTime}` : null,
    input.vendorName ? `Vendor name: ${input.vendorName}` : null,
    "",
    input.vendorMotivation ? `Vendor motivation: ${VENDOR_MOTIVATION_LABELS[input.vendorMotivation]}` : null,
    input.vendorPriority ? `Vendor priority: ${VENDOR_PRIORITY_LABELS[input.vendorPriority]}` : null,
    input.vendorConcerns?.length
      ? `Vendor concerns: ${input.vendorConcerns.map((c) => VENDOR_CONCERN_LABELS[c]).join(", ")}`
      : null,
    input.vendorPersonality ? `Vendor personality/tone: ${VENDOR_PERSONALITY_LABELS[input.vendorPersonality]}` : null,
    "",
    input.keyStrengths ? `Key strengths: ${input.keyStrengths}` : null,
    input.knownWeaknesses ? `Known weaknesses or risks: ${input.knownWeaknesses}` : null,
    input.renovations ? `Renovations/upgrades: ${input.renovations}` : null,
    input.amenities ? `Nearby amenities: ${input.amenities}` : null,
    input.schoolZoneNotes ? `School zone notes: ${input.schoolZoneNotes}` : null,
    input.limBuildingReportNotes ? `LIM/building report notes: ${input.limBuildingReportNotes}` : null,
    input.disclosureItems ? `Disclosure or property issues to clarify: ${input.disclosureItems}` : null,
    input.claimsToVerify ? `Claims to verify before marketing: ${input.claimsToVerify}` : null,
    "",
    input.agentName ? `Agent name: ${input.agentName}` : null,
    input.agencyName ? `Agency: ${input.agencyName}` : null,
    input.agentPhone ? `Agent phone: ${input.agentPhone}` : null,
    input.agentEmail ? `Agent email: ${input.agentEmail}` : null,
    input.agentStrengths ? `Agent strengths: ${input.agentStrengths}` : null,
    input.recentSales ? `Recent relevant sales: ${input.recentSales}` : null,
    input.testimonials ? `Testimonials/proof points: ${input.testimonials}` : null,
    input.whyChooseAgent ? `Why choose this agent: ${input.whyChooseAgent}` : null,
    `Preferred tone: ${MEETING_TONE_LABELS[input.tone]}`,
    "",
    input.preferredPackage
      ? `Agent's preferred package: ${input.preferredPackage}`
      : "Agent has not preselected a package — recommend one.",
    "Available package templates (editable, not fixed promises):",
    packagesBlock,
    costLines.length ? `Costs entered:\n${costLines.join("\n")}` : "No specific costs entered — use placeholder wording and advise confirming exact costs with the agency/provider.",
  ].filter((line) => line !== null);

  return lines.join("\n");
}

const MEETING_PLAYBOOK_SECTION_INSTRUCTIONS: Record<string, string> = {
  meeting_checklist: `Write a meeting checklist in three clearly labelled parts: "Before the meeting", "During the meeting", "After the meeting". Use short checklist-style lines (one action per line). Ground it in the supplied property, vendor, and meeting details. Cover reviewing comparable sales and competing listings, preparing written appraisal notes, checking property facts, preparing marketing package options, preparing questions about motivation/timing/price expectation/concerns, preparing disclosure questions, bringing/sending required agency documents, and preparing a follow-up template — adapted to the specific meeting type and vendor situation supplied.`,

  what_to_say: `Write a practical talking script for the agent structured as: Opening, Discovery questions, Explaining market conditions, Explaining sale method, Explaining the marketing package, Explaining vendor updates, Explaining SafeCheck/compliance-aware copy, Closing. Keep each section to 2-4 sentences of natural spoken language the agent could actually say, tailored to the vendor's personality and priority.`,

  questions_to_ask: `Write questions to ask the vendor, grouped under these headings: Motivation, Timing, Price expectation, Property history, Renovations and claims, Known defects/issues, Marketing budget, Privacy/access, Preferred communication, Previous agent/campaign experience (only include this last group if relevant). 2-3 questions per group.`,

  package_recommendation: `Recommend one marketing package (Essential Launch, Premium Launch, or Signature Launch) from the templates supplied, based on the property type, vendor priority, property strengths/weaknesses, sale method, and vendor concerns. Structure the answer as: which package and why it fits; what it includes (list the template's inclusions); what could be reduced if the vendor is cost-sensitive; what should not be cut if presentation quality matters; and a short paragraph on how to explain the value of this package to the vendor. Make clear the package is a customisable starting point, not a fixed promise.`,

  cost_explanation: `Write a script the agent can use to explain marketing costs clearly. State plainly that costs vary by agency and provider. If specific costs were supplied, reference them; if not, use placeholder wording (e.g. "confirm exact costs with your agency/provider before presenting") rather than inventing numbers. Clearly separate what's included in the recommended package from what the vendor may be separately charged for. Do not make any guarantees about sale price or campaign outcome.`,

  objection_handling: `Write calm, respectful, non-pushy responses to these common vendor objections, one short paragraph each: "Marketing is too expensive", "Can we skip video?", "Can we just list online?", "Another agent is cheaper", "I want a higher price", "I don't want open homes", "I don't want to pay upfront", "We can sell it ourselves", "The market is slow", "I need to think about it". Ground responses in the specific property/vendor context where relevant.`,

  compliance_notes: `Write a meeting-specific compliance/SafeCheck checklist covering: claims to verify before using them in marketing, claims to avoid, property issues to clarify, a school zone caution (zoning/enrolment can't be guaranteed), a subdivision/development potential caution (don't state it unless confirmed), a rental/yield caution (don't state a yield claim without evidence), a renovation claims caution ("fully renovated" only if accurate), a marketing cost explanation reminder, an agency agreement/written appraisal reminder (a written appraisal is required before a prospective client signs an agency agreement), and finish with exactly this disclaimer on its own line: "This is a workflow assistant, not legal advice. Review with your agency procedures and REA obligations."`,

  followup_pack: `Write five short follow-up items, clearly labelled: a follow-up email after the meeting, a short SMS follow-up, a gentle reminder message if the vendor hasn't responded, a proposal cover note, and a "next steps" message. Keep each concise and in the requested tone.`,

  seven_day_plan: `Write a 7-day win-the-listing follow-up plan formatted as "Day 1" through "Day 7": Day 1 thank-you and recap, Day 2 send proposal/appraisal note, Day 3 share relevant proof or case study, Day 4 answer objections, Day 5 check decision timing, Day 6 send marketing recommendation reminder, Day 7 final gentle follow-up. One short line per day, adapted to the specific vendor and meeting context.`,
};

export function agentMeetingPlaybookPrompt(sectionKey: string, input: AgentMeetingPlaybookFormData): PromptSet {
  const instruction = MEETING_PLAYBOOK_SECTION_INSTRUCTIONS[sectionKey];
  if (!instruction) {
    throw new Error(`Unknown meeting playbook section key: ${sectionKey}`);
  }

  const user = `Meeting playbook details:\n${buildMeetingPlaybookContextBlock(input)}\n\nTask:\n${instruction}`;

  return { system: AGENT_MEETING_PLAYBOOK_SYSTEM_PROMPT, user };
}
