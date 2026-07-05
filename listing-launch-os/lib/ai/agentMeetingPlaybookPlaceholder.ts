import { marketingPackage, type MarketingPackage } from "../marketingPackages";
import {
  MEETING_SALE_METHOD_LABELS,
  VENDOR_CONCERN_LABELS,
  VENDOR_MOTIVATION_LABELS,
  VENDOR_PRIORITY_LABELS,
  type AgentMeetingPlaybookFormData,
} from "../types";

/**
 * Free, deterministic, template-based generator used when AI_MODE=placeholder.
 * Follows the same rule as every other placeholder generator in the app:
 * only use what was actually entered, write generally otherwise, never
 * invent numbers, claims, or guarantees.
 */

const COMPLIANCE_DISCLAIMER =
  "This is a workflow assistant, not legal advice. Review with your agency procedures and REA obligations.";

function vendorLabel(input: AgentMeetingPlaybookFormData): string {
  return input.vendorName || "the vendor";
}

function agentSignoff(input: AgentMeetingPlaybookFormData): string {
  const name = input.agentName || "Your agent";
  const agency = input.agencyName ? ` at ${input.agencyName}` : "";
  const contact = [input.agentPhone, input.agentEmail].filter(Boolean).join(" · ");
  return `${name}${agency}${contact ? `\n${contact}` : ""}`;
}

function costLine(label: string, value?: string): string {
  return value ? `${label}: ${value}` : `${label}: to be confirmed with your agency/provider`;
}

function recommendPackage(input: AgentMeetingPlaybookFormData): MarketingPackage {
  if (input.preferredPackage) return input.preferredPackage;

  const costSensitive =
    input.vendorConcerns?.includes("marketing_cost") || input.vendorPriority === "low_upfront_cost";
  const premiumFocused = input.vendorPriority === "premium_marketing" || input.vendorPersonality === "premium_focused";

  if (costSensitive) return "essential_launch";
  if (premiumFocused) return "signature_launch";
  return "premium_launch";
}

const MEETING_PLAYBOOK_PLACEHOLDER_GENERATORS: Record<string, (input: AgentMeetingPlaybookFormData) => string> = {
  meeting_checklist: (i) =>
    [
      "BEFORE THE MEETING",
      "- Review recent comparable sales",
      "- Review current competing listings",
      "- Prepare written appraisal notes",
      `- Check property facts for ${i.propertyAddress}`,
      "- Check title/ownership notes if available",
      "- Prepare marketing package options",
      `- Prepare questions about ${vendorLabel(i)}'s motivation`,
      "- Prepare questions about timing, price expectation, and concerns",
      i.disclosureItems ? `- Prepare questions on: ${i.disclosureItems}` : "- Prepare disclosure/property issue questions",
      "- Bring or send required agency/REA documents as appropriate",
      "- Prepare follow-up email template",
      "",
      "DURING THE MEETING",
      `- Ask ${vendorLabel(i)}'s motivation and timeline`,
      "- Ask what matters most to the vendor",
      "- Walk through property strengths and risks",
      "- Explain sale method options",
      "- Explain the marketing plan",
      "- Explain what marketing is included and what costs may be charged to the vendor",
      "- Explain how buyer feedback and vendor updates will work",
      "- Ask about known property issues",
      "- Clarify any claims before using them in marketing",
      "- Explain next steps",
      "",
      "AFTER THE MEETING",
      "- Send thank-you/follow-up email",
      "- Send marketing recommendation",
      "- Send appraisal/proposal if appropriate",
      "- Confirm marketing costs and inclusions",
      "- Confirm next steps",
      "- Log notes",
      "- Schedule follow-up reminder",
    ].join("\n"),

  what_to_say: (i) => {
    const pkg = marketingPackage(recommendPackage(i));
    return [
      "Opening",
      `Thanks for making the time today${i.vendorName ? `, ${i.vendorName}` : ""}. Before we get into the details, I'd love to understand a bit more about your plans for ${i.propertyAddress}.`,
      "",
      "Discovery questions",
      i.vendorMotivation
        ? `Given you mentioned ${VENDOR_MOTIVATION_LABELS[i.vendorMotivation].toLowerCase()}, can you tell me more about your timeline?`
        : "What's driving the decision to sell, and what timeline are you working towards?",
      "",
      "Explaining market conditions",
      "Based on recent comparable sales and current competing listings, here's how I'd position your property in today's market — happy to walk through the detail.",
      "",
      "Explaining sale method",
      i.saleMethod
        ? `Given what we've discussed, I'd recommend considering ${MEETING_SALE_METHOD_LABELS[i.saleMethod].toLowerCase()} — let me explain why.`
        : "Let's talk through the sale method options and which might suit your situation best.",
      "",
      "Explaining the marketing package",
      `I'd recommend the ${pkg.label} package, which includes ${pkg.inclusions.slice(0, 3).join(", ")}, and more. I'll walk you through exactly what's included and what to expect.`,
      "",
      "Explaining vendor updates",
      "Throughout the campaign, you'll get regular vendor updates — after each open home and weekly — so you always know where things stand.",
      "",
      "Explaining SafeCheck/compliance-aware copy",
      "All of our marketing copy goes through a compliance review before it's published, so nothing overstates what we can back up.",
      "",
      "Closing",
      "What questions do you have for me? And if you're comfortable, I'd love to talk through next steps.",
    ].join("\n");
  },

  questions_to_ask: (i) =>
    [
      "Motivation",
      "- What's driving your decision to sell?",
      "- How important is this sale to your future plans?",
      "",
      "Timing",
      "- What timeframe are you hoping to sell within?",
      "- Are there any fixed dates we need to work around?",
      "",
      "Price expectation",
      "- What price range were you expecting or hoping for?",
      "- Have you had any other appraisals or feedback so far?",
      "",
      "Property history",
      "- How long have you owned the property?",
      "- Has it been on the market before?",
      "",
      "Renovations and claims",
      i.renovations
        ? `- Can you tell me more about: ${i.renovations}?`
        : "- Have there been any renovations or upgrades we should know about?",
      "- Are there any claims about the property we should verify before marketing it?",
      "",
      "Known defects/issues",
      "- Are there any known issues we should be aware of and plan to disclose?",
      "- Have you had a LIM or building report done recently?",
      "",
      "Marketing budget",
      "- Do you have a marketing budget in mind, or would you like a recommendation?",
      "",
      "Privacy/access",
      "- Are there any access restrictions or privacy preferences for viewings?",
      "",
      "Preferred communication",
      "- What's the best way and best time to reach you with updates?",
      "",
      "Previous agent/campaign experience",
      "- Have you worked with an agent before, and if so, what worked or didn't work?",
    ].join("\n"),

  package_recommendation: (i) => {
    const key = recommendPackage(i);
    const pkg = marketingPackage(key);
    const reasons: string[] = [];
    if (i.vendorPriority) reasons.push(`the vendor's priority is ${VENDOR_PRIORITY_LABELS[i.vendorPriority].toLowerCase()}`);
    if (i.vendorConcerns?.length) reasons.push(`concerns raised include ${i.vendorConcerns.map((c) => VENDOR_CONCERN_LABELS[c].toLowerCase()).join(", ")}`);
    if (i.propertyType) reasons.push(`the property is a ${i.propertyType.toLowerCase()}`);

    return [
      `Recommended package: ${pkg.label}`,
      "",
      `Why it fits: ${reasons.length ? reasons.join("; ") + "." : "this is a balanced starting point for most listings."}`,
      "",
      `What it includes: ${pkg.inclusions.join(", ")}.`,
      "",
      "What can be reduced if the vendor is cost-sensitive: drone/aerial photography, video, and portal upgrades are usually the easiest to scale back first.",
      "",
      "What should not be cut if presentation quality matters: professional photography and floor plan — these are the foundation of every listing and affect buyer perception across every channel.",
      "",
      "How to explain the value: focus on how professional presentation affects buyer perception and enquiry volume, not on guaranteeing a price outcome. Remind the vendor this package is a starting point — it can be tailored with your agency.",
    ].join("\n");
  },

  cost_explanation: (i) => {
    const hasCosts = [
      i.photographyCost,
      i.videoCost,
      i.floorPlanCost,
      i.droneCost,
      i.twilightCost,
      i.portalUpgradeCost,
      i.socialAdBudget,
      i.printSignageCost,
      i.totalBudget,
    ].some(Boolean);

    return [
      "Marketing costs vary by agency, region, and provider — the figures below are a starting point for this conversation, not a fixed national price.",
      "",
      costLine("Photography", i.photographyCost),
      costLine("Video", i.videoCost),
      costLine("Floor plan", i.floorPlanCost),
      costLine("Drone/aerial", i.droneCost),
      costLine("Twilight", i.twilightCost),
      costLine("Portal upgrade", i.portalUpgradeCost),
      costLine("Social ad budget", i.socialAdBudget),
      costLine("Print/signage", i.printSignageCost),
      costLine("Total recommended marketing budget", i.totalBudget),
      "",
      hasCosts
        ? "These figures reflect what's been entered for this meeting — confirm final costs with your agency/provider before the vendor commits."
        : "Confirm exact marketing costs with your agency/provider before presenting to the vendor.",
      "",
      "Be clear with the vendor about what's included in the recommended package versus anything charged separately, and avoid making any guarantee about sale price or campaign outcome.",
    ].join("\n");
  },

  objection_handling: (i) =>
    [
      {
        objection: "Marketing is too expensive",
        response:
          "I understand cost is front of mind. Let's look at what's actually included and why — professional presentation tends to affect both enquiry volume and buyer perception. We can also look at a package that fits your budget more closely.",
      },
      {
        objection: "Can we skip video?",
        response: "We can — video isn't essential for every listing. Photography and floor plan remain the priority either way.",
      },
      {
        objection: "Can we just list online?",
        response: "Online listing is the core channel, but signage, social, and portal upgrades often bring additional buyer reach — happy to scale it to what feels right for you.",
      },
      {
        objection: "Another agent is cheaper",
        response: i.agentStrengths || i.testimonials
          ? `I'd rather focus on the value I bring: ${i.agentStrengths || i.testimonials}. Happy to walk through exactly what's included in my service.`
          : "I'd rather focus on the value included in my service and marketing approach than compete purely on price — happy to walk through the detail.",
      },
      {
        objection: "I want a higher price",
        response: "I hear you — let's go through the comparable sales and current market feedback together so we're aligned on a realistic and achievable range.",
      },
      {
        objection: "I don't want open homes",
        response: "That's completely workable — we can run private viewings by appointment instead and adjust the marketing plan accordingly.",
      },
      {
        objection: "I don't want to pay upfront",
        response: "Let's talk through the payment options available through the agency — there may be more flexibility than you expect.",
      },
      {
        objection: "We can sell it ourselves",
        response: "Totally understandable to consider — I'm happy to explain specifically what I'd add in terms of marketing reach, buyer management, and negotiation support.",
      },
      {
        objection: "The market is slow",
        response: "Market conditions do shift, and that's exactly why the right marketing and pricing strategy matters even more right now — let's make sure yours stands out.",
      },
      {
        objection: "I need to think about it",
        response: "Of course — take the time you need. I'll follow up in a few days, and please reach out sooner if any questions come up.",
      },
    ]
      .map((o) => `"${o.objection}"\n${o.response}`)
      .join("\n\n"),

  compliance_notes: (i) =>
    [
      "Claims to verify before marketing:",
      i.claimsToVerify ? `- ${i.claimsToVerify}` : "- No specific claims flagged yet — confirm anything used in marketing copy is accurate.",
      "",
      "Claims to avoid: guaranteed sale price or outcome, unverified building claims (\"waterproof\", \"leak-free\", \"no issues\"), unsupported superlatives.",
      "",
      "Property issues to clarify:",
      i.disclosureItems ? `- ${i.disclosureItems}` : "- None flagged yet — confirm with the vendor before marketing.",
      "",
      "School zone caution: never guarantee school zone enrolment — zoning can change and enrolment isn't guaranteed by a listing.",
      "",
      "Subdivision/development potential caution: only mention if explicitly confirmed by the vendor or supporting documents.",
      "",
      "Rental/yield caution: don't state a yield or rental return claim without supporting evidence.",
      "",
      "Renovation claims caution: only say \"fully renovated\" if that accurately describes the work done.",
      "",
      "Marketing cost explanation reminder: make sure the vendor understands what's included versus separately charged before they commit.",
      "",
      "Agency agreement/appraisal reminder: a written appraisal is required before a prospective client signs an agency agreement.",
      "",
      COMPLIANCE_DISCLAIMER,
    ].join("\n"),

  followup_pack: (i) =>
    [
      "Follow-up email after meeting",
      `Hi${i.vendorName ? ` ${i.vendorName}` : ""},\n\nThanks for your time today discussing ${i.propertyAddress}. It was great to learn more about your plans, and I'll follow up shortly with my marketing recommendation and next steps.\n\nKind regards,\n${agentSignoff(i)}`,
      "",
      "Short SMS follow-up",
      `Hi${i.vendorName ? ` ${i.vendorName}` : ""}, thanks for today — I'll send through my proposal shortly. Let me know if any questions come up in the meantime.`,
      "",
      "Reminder message if vendor hasn't responded",
      `Hi${i.vendorName ? ` ${i.vendorName}` : ""}, just checking in — wanted to see if you had a chance to look over the proposal I sent through. Happy to answer any questions.`,
      "",
      "Proposal cover note",
      `Please find attached my recommended approach for marketing ${i.propertyAddress}, including the marketing package and next steps we discussed. I'm happy to talk through any part of it.`,
      "",
      "Next steps message",
      "Once you're ready to proceed, the next steps are: confirm the marketing package and costs, complete the agency agreement, and lock in a launch date for the campaign.",
    ].join("\n\n"),

  seven_day_plan: (i) =>
    [
      "Day 1 — Thank-you and recap of the meeting",
      "Day 2 — Send proposal / appraisal note",
      `Day 3 — Share relevant proof or case study${i.recentSales ? ` (e.g. ${i.recentSales})` : ""}`,
      "Day 4 — Answer any objections raised",
      "Day 5 — Check in on decision timing",
      "Day 6 — Send marketing recommendation reminder",
      "Day 7 — Final gentle follow-up",
    ].join("\n"),
};

export function generateMeetingPlaybookPlaceholder(sectionKey: string, input: AgentMeetingPlaybookFormData): string {
  const generator = MEETING_PLAYBOOK_PLACEHOLDER_GENERATORS[sectionKey];
  if (!generator) {
    return `[Placeholder content for "${sectionKey}" — no template defined yet.]`;
  }
  return generator(input);
}
