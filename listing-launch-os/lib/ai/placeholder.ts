import { TARGET_BUYER_LABELS, type CampaignInput } from "../types";
import { propertyFactsList } from "../utils";

/**
 * Free, deterministic, template-based generator used when AI_MODE=placeholder.
 * It uses the real campaign facts (never invents anything) so it's genuinely
 * useful for testing the product flow and demoing to agents without any API cost.
 */

function factsSentence(input: CampaignInput): string {
  const facts = propertyFactsList(input);
  return facts.length ? `Featuring ${facts.join(", ")}, ` : "";
}

function featuresLine(input: CampaignInput): string {
  return input.keyFeatures ? ` Highlights include ${input.keyFeatures.toLowerCase()}.` : "";
}

function renovationsLine(input: CampaignInput): string {
  return input.renovations ? ` The property has benefited from ${input.renovations.toLowerCase()}.` : "";
}

function amenitiesLine(input: CampaignInput): string {
  return input.amenities ? ` Close to ${input.amenities.toLowerCase()}.` : "";
}

function ctaLine(input: CampaignInput): string {
  return input.cta ? input.cta : "Contact us today to arrange a viewing.";
}

function agentSignoff(input: CampaignInput): string {
  const name = input.agentName || "The agent";
  const agency = input.agencyName ? ` at ${input.agencyName}` : "";
  return `${name}${agency}`;
}

const buyerAngle: Record<string, string> = {
  first_home_buyer: "an excellent opportunity to step onto the property ladder",
  family: "a practical, comfortable home for family life",
  investor: "a listing worth adding to your portfolio shortlist",
  downsizer: "a low-maintenance option for a simpler next chapter",
  luxury_buyer: "a refined home for discerning buyers",
};

const PLACEHOLDER_GENERATORS: Record<string, (input: CampaignInput) => string> = {
  premium_description: (i) =>
    `Positioned in ${i.suburb}, this ${i.propertyType.toLowerCase()} at ${i.address} presents ${buyerAngle[i.targetBuyer]}. ` +
    `${factsSentence(i)}the home offers a considered layout suited to everyday living.${featuresLine(i)}${renovationsLine(i)}${amenitiesLine(i)}\n\n` +
    `Approximately ${i.landSize || "size on request"} of land and ${i.floorArea || "floor area on request"} give a sense of scale, ` +
    `while the ${i.suburb} location adds everyday convenience. ${ctaLine(i)}\n\n— ${agentSignoff(i)}`,

  short_description: (i) =>
    `${i.propertyType} in ${i.suburb} — ${propertyFactsList(i).join(", ") || "details on request"}. ${
      i.keyFeatures ? i.keyFeatures + ". " : ""
    }${ctaLine(i)}`,

  trademe_description: (i) =>
    `**${i.propertyType} — ${i.suburb}**\n\n${factsSentence(i)}this home at ${i.address} offers ${buyerAngle[i.targetBuyer]}.${featuresLine(i)}\n\n` +
    `Key details:\n${propertyFactsList(i)
      .map((f) => `- ${f.charAt(0).toUpperCase()}${f.slice(1)}`)
      .join("\n") || "- Details available on request"}${i.amenities ? `\n- Close to ${i.amenities.toLowerCase()}` : ""}\n\n` +
    `${renovationsLine(i)}\n\n${ctaLine(i)}`,

  instagram_caption: (i) =>
    `Just imagine calling ${i.suburb} home. ✨\n${i.propertyType} with ${propertyFactsList(i).join(", ") || "space to suit your lifestyle"}.${featuresLine(i)}\n\n${ctaLine(i)}\n\n#${i.suburb.replace(/\s+/g, "")} #NZRealEstate #${i.propertyType.replace(/\s+/g, "")} #JustListed #AucklandRealEstate #HomeForSale #PropertyNZ #OpenHome #NZHomes #RealEstateNZ`,

  facebook_caption: (i) =>
    `We're excited to share this ${i.propertyType.toLowerCase()} in ${i.suburb}. ${factsSentence(i)}it's ${buyerAngle[i.targetBuyer]}.${featuresLine(i)}${amenitiesLine(i)} ${ctaLine(i)}`,

  linkedin_caption: (i) =>
    `New to market: a ${i.propertyType.toLowerCase()} in ${i.suburb}. ${factsSentence(i)}well suited to ${TARGET_BUYER_LABELS[i.targetBuyer].toLowerCase()} buyers. ${ctaLine(i)} — ${agentSignoff(i)}`,

  hooks: (i) =>
    [
      `1. What would ${i.suburb} living look like for you?`,
      `2. ${propertyFactsList(i)[0] || "Space, comfort, and location"} — all in one address.`,
      `3. Have you seen what's new in ${i.suburb}?`,
      `4. This ${i.propertyType.toLowerCase()} won't stay on the market long.`,
      `5. Here's why ${i.suburb} keeps coming up in buyer searches.`,
    ].join("\n"),

  reel_scripts: (i) =>
    `Script 1 — Walkthrough\nWelcome to ${i.address}, ${i.suburb}. ${factsSentence(i)}let's take a look inside.${featuresLine(i)} ${ctaLine(i)}\n\n` +
    `Script 2 — Lifestyle\nThis is what ${TARGET_BUYER_LABELS[i.targetBuyer].toLowerCase()} living could look like in ${i.suburb}.${amenitiesLine(i)} ${ctaLine(i)}\n\n` +
    `Script 3 — Feature highlight\n${i.keyFeatures ? `One thing buyers love here: ${i.keyFeatures.toLowerCase()}.` : `This ${i.propertyType.toLowerCase()} has plenty to offer.`} ${ctaLine(i)}`,

  reel_onscreen_text: (i) =>
    [
      `${i.suburb} living`,
      `${i.propertyType}`,
      propertyFactsList(i)[0] || "Space to grow",
      i.keyFeatures ? i.keyFeatures.split(",")[0] : "Thoughtfully designed",
      i.renovations ? "Recently upgraded" : "Move-in ready",
      i.amenities ? "Close to everything you need" : "Well located",
      "Book a viewing",
      "Link in bio",
    ].join("\n"),

  voiceover_script: (i) =>
    `Welcome to ${i.address} in ${i.suburb}. ${factsSentence(i)}this ${i.propertyType.toLowerCase()} offers ${buyerAngle[i.targetBuyer]}.${featuresLine(i)}${renovationsLine(i)}${amenitiesLine(i)} ${ctaLine(i)}`,

  shot_list: (i) =>
    [
      "1. Exterior establishing shot (street view)",
      "2. Front entrance / doorway",
      "3. Living area, wide shot",
      "4. Kitchen, wide and detail shots",
      i.bedrooms ? "5. Main bedroom" : "5. Bedroom(s)",
      i.bathrooms ? "6. Bathroom" : "6. Bathroom(s)",
      i.garages ? "7. Garage / car parking" : "7. Outdoor parking area",
      "8. Outdoor / garden area",
      i.amenities ? "9. Nearby amenity or street context shot" : "9. Neighbourhood context shot",
      "10. Closing exterior shot at golden hour",
    ].join("\n"),

  open_home_post: (i) =>
    `Open home reminder — ${i.address}, ${i.suburb}. Come and see this ${i.propertyType.toLowerCase()} for yourself this weekend.${featuresLine(i)} Can't make it? ${ctaLine(i)}`,

  just_listed_post: (i) =>
    `Just listed in ${i.suburb}! This ${i.propertyType.toLowerCase()} offers ${propertyFactsList(i).join(", ") || "great potential"}.${featuresLine(i)} ${ctaLine(i)}`,

  vendor_update_email: (i) =>
    `Hi there,\n\nQuick update on the campaign for ${i.address}. The listing is now live and the full marketing pack — descriptions, social content, and video assets — has been prepared and rolled out across our channels.\n\nNext steps: we'll be tracking enquiries and open home attendance, and I'll keep you posted after each touchpoint.\n\nPlease let me know if you have any questions in the meantime.\n\nKind regards,\n${agentSignoff(i)}`,

  buyer_followup_email: (i) =>
    `Hi [Buyer name],\n\nThanks for your interest in ${i.address}, ${i.suburb}. ${featuresLine(i).trim() || "It's a great property with plenty to offer."}\n\nHappy to answer any questions or arrange a second viewing at a time that suits you.\n\nLooking forward to hearing from you.\n\nKind regards,\n${agentSignoff(i)}`,

  social_plan_7day: (i) =>
    [
      "Day 1 — Just-listed announcement (Facebook post)",
      "Day 2 — Feature highlight (Instagram Story)",
      "Day 3 — Reel: walkthrough script (Instagram/Facebook reel)",
      `Day 4 — ${i.amenities ? "Neighbourhood/amenity highlight" : "Suburb highlight"} (Instagram carousel)`,
      "Day 5 — Agent talking points / behind-the-scenes (Story)",
      "Day 6 — Open home reminder (Facebook + Instagram post)",
      "Day 7 — Recap + CTA push (LinkedIn post)",
    ].join("\n"),

  agent_talking_points: (i) =>
    [
      `This ${i.propertyType.toLowerCase()} is located in ${i.suburb}.`,
      ...propertyFactsList(i).map((f) => `It offers ${f}.`),
      i.keyFeatures ? `Notable features include ${i.keyFeatures.toLowerCase()}.` : null,
      i.renovations ? `The property has had ${i.renovations.toLowerCase()}.` : null,
      i.amenities ? `It's close to ${i.amenities.toLowerCase()}.` : null,
      `It's well suited to ${TARGET_BUYER_LABELS[i.targetBuyer].toLowerCase()} buyers.`,
    ]
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n"),

  amenity_highlights: (i) =>
    i.amenities
      ? i.amenities
          .split(",")
          .map((a) => `- ${a.trim()}`)
          .join("\n")
      : "- Amenity details not yet provided for this listing.",

  cta_options: (i) =>
    [
      i.cta ? `1. ${i.cta}` : "1. Contact us today to arrange a viewing.",
      "2. Message us for more information.",
      "3. Come along to the next open home.",
      "4. Get in touch to book a private viewing.",
      "5. Enquire now before it's gone.",
    ].join("\n"),
};

export function generatePlaceholder(sectionKey: string, input: CampaignInput): string {
  const generator = PLACEHOLDER_GENERATORS[sectionKey];
  if (!generator) {
    return `[Placeholder content for "${sectionKey}" — no template defined yet.]`;
  }
  return generator(input);
}
