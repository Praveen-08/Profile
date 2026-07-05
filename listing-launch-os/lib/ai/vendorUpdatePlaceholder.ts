import type { VendorUpdateContext } from "../types";

/**
 * Free, deterministic, template-based generator used when AI_MODE=placeholder.
 * Mirrors lib/ai/placeholder.ts: uses only the real numbers/feedback supplied,
 * and falls back to honest, general language rather than inventing anything.
 */

const PRICE_FEEDBACK_REMINDER =
  "Note: this update includes price/market feedback — it reflects buyer commentary, not a valuation, so please confirm before relying on it.";

function isPriceRelevant(input: VendorUpdateContext): boolean {
  return input.updateType === "price_feedback" || !!input.priceFeedback;
}

function enquiriesPhrase(input: VendorUpdateContext): string {
  if (typeof input.enquiries === "number") {
    return `${input.enquiries} enquir${input.enquiries === 1 ? "y" : "ies"}`;
  }
  return "a steady flow of enquiries";
}

function openHomeGroupsPhrase(input: VendorUpdateContext): string {
  if (typeof input.openHomeGroups === "number") {
    return `${input.openHomeGroups} group${input.openHomeGroups === 1 ? "" : "s"} through the open home`;
  }
  return "a number of groups through the open home";
}

function toneOpener(input: VendorUpdateContext): string {
  const openers: Record<VendorUpdateContext["tone"], string> = {
    confident: "Great progress to share on your campaign.",
    warm: "Thanks so much for your continued trust throughout this campaign.",
    direct: "Here's a clear update on where things stand.",
    careful: "Wanted to give you a considered update on how things are tracking.",
    premium: "We wanted to provide you with a considered update on your campaign's progress.",
  };
  return openers[input.tone];
}

const UPDATE_TYPE_FRAMING: Record<VendorUpdateContext["updateType"], string> = {
  post_open_home: "Following the latest open home,",
  weekly_update: "Here's this week's campaign update:",
  price_feedback: "We wanted to share some price feedback we've received from buyers.",
  low_enquiry_update: "Wanted to give you an honest update on enquiry levels so far.",
  offer_update: "We've had some buyer interest worth flagging.",
};

function agentSignoff(input: VendorUpdateContext): string {
  const name = input.agentName || "Your agent";
  const agency = input.agencyName ? ` at ${input.agencyName}` : "";
  const contact = [input.agentPhone, input.agentEmail].filter(Boolean).join(" · ");
  return `${name}${agency}${contact ? `\n${contact}` : ""}`;
}

function feedbackLine(label: string, value?: string): string {
  return value ? `${label}: ${value}` : "";
}

const VENDOR_UPDATE_PLACEHOLDER_GENERATORS: Record<string, (input: VendorUpdateContext) => string> = {
  vendor_update_email: (i) => {
    const parts = [
      `Hi there,`,
      ``,
      `${toneOpener(i)} ${UPDATE_TYPE_FRAMING[i.updateType]}`,
      ``,
      `So far we've had ${enquiriesPhrase(i)}${
        typeof i.openHomeGroups === "number" || i.updateType === "post_open_home"
          ? ` and ${openHomeGroupsPhrase(i)}`
          : ""
      }.`,
      i.positiveFeedback ? `On the positive side, buyers have mentioned: ${i.positiveFeedback}.` : "",
      i.concerns ? `A few buyers raised some points worth noting: ${i.concerns}.` : "",
      i.priceFeedback
        ? `On price, feedback so far suggests: ${i.priceFeedback}. This reflects buyer commentary rather than a formal valuation.`
        : "",
      i.offersOrInterest ? `Worth flagging — ${i.offersOrInterest}.` : "",
      i.onlineViews ? `Online, the listing has had ${i.onlineViews}.` : "",
      i.socialActivity ? `On social media: ${i.socialActivity}.` : "",
      ``,
      i.recommendedNextStep
        ? `Recommended next step: ${i.recommendedNextStep}.`
        : `We'll keep the campaign moving and update you again after the next round of activity.`,
      isPriceRelevant(i) ? `` : "",
      isPriceRelevant(i) ? PRICE_FEEDBACK_REMINDER : "",
      ``,
      `Kind regards,`,
      agentSignoff(i),
    ];
    return parts.filter((l) => l !== "").join("\n");
  },

  sms_update: (i) => {
    const headline =
      i.updateType === "post_open_home"
        ? `${openHomeGroupsPhrase(i)} at the open home, ${enquiriesPhrase(i)} so far.`
        : i.updateType === "offer_update"
        ? i.offersOrInterest || "Some buyer interest to share."
        : `${enquiriesPhrase(i)} on the campaign so far.`;
    const next = i.recommendedNextStep || "Happy to chat through details — call anytime.";
    return `Hi, quick update on ${i.address}: ${headline} ${next}`.trim();
  },

  what_we_learned: (i) =>
    [
      i.buyerFeedbackSummary ? `- ${i.buyerFeedbackSummary}` : "- Buyer feedback is still building as the campaign progresses.",
      i.positiveFeedback ? `- Buyers responded well to: ${i.positiveFeedback}.` : null,
      i.concerns ? `- A recurring theme in feedback: ${i.concerns}.` : null,
      i.priceFeedback ? `- Price positioning signal: ${i.priceFeedback}.` : null,
      i.socialActivity ? `- Online/social engagement: ${i.socialActivity}.` : null,
    ]
      .filter(Boolean)
      .join("\n"),

  buyer_feedback_summary: (i) =>
    [
      "Positive feedback",
      i.positiveFeedback ? i.positiveFeedback : "No specific positive feedback logged yet.",
      "",
      "Concerns raised",
      i.concerns ? i.concerns : "No specific concerns raised so far.",
    ].join("\n"),

  recommended_next_steps: (i) => {
    const stepsByType: Record<VendorUpdateContext["updateType"], string[]> = {
      post_open_home: ["Follow up with attendees who showed strong interest", "Share open home highlights on social media"],
      weekly_update: ["Review this week's enquiry sources", "Refresh one piece of campaign content"],
      price_feedback: ["Discuss price feedback directly with you before any changes", "Continue monitoring buyer response"],
      low_enquiry_update: ["Review the marketing angle and target buyer", "Consider a fresh round of social promotion"],
      offer_update: ["Clarify terms and timeline with the interested party", "Keep other active enquiries warm in parallel"],
    };
    const steps = [
      i.recommendedNextStep,
      ...stepsByType[i.updateType],
      "Check in again after the next round of activity",
    ].filter(Boolean) as string[];
    return steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n");
  },

  price_feedback_wording: (i) =>
    [
      i.priceFeedback
        ? `Feedback from buyers suggests: ${i.priceFeedback}. This is buyer commentary gathered during the campaign, not a formal valuation.`
        : `We haven't gathered specific price feedback yet — we'll flag it as soon as buyers share views on value.`,
      PRICE_FEEDBACK_REMINDER,
    ].join("\n\n"),

  next_7day_actions: (i) =>
    [
      `Day 1 — ${i.offersOrInterest ? "Follow up with the interested buyer" : "Review enquiries from this period"}`,
      `Day 2 — Refresh one social post or story for the listing`,
      `Day 3 — ${i.concerns ? "Address feedback themes in updated talking points" : "Check in with recent enquirers"}`,
      `Day 4 — Review campaign performance so far`,
      `Day 5 — ${i.recommendedNextStep || "Plan the next open home or viewing"}`,
      `Day 6 — Prepare next vendor update`,
      `Day 7 — Reassess campaign settings based on the week's activity`,
    ].join("\n"),
};

export function generateVendorUpdatePlaceholder(sectionKey: string, input: VendorUpdateContext): string {
  const generator = VENDOR_UPDATE_PLACEHOLDER_GENERATORS[sectionKey];
  if (!generator) {
    return `[Placeholder content for "${sectionKey}" — no template defined yet.]`;
  }
  return generator(input);
}
