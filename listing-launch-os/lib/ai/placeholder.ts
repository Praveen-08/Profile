import { OWNERSHIP_TYPE_LABELS, SALE_METHOD_LABELS, type CampaignInput } from "../types";
import { propertyFactsList } from "../utils";
import { getBuyerAngle, getBuyerLabel } from "../buyerAngle";
import { normalizeCampaignInput } from "../formatCampaignData";
import { pickHookAngle } from "../hookAngle";

/**
 * Free, deterministic, template-based generator used when AI_MODE=placeholder.
 * It uses the real campaign facts (never invents anything) so it's genuinely
 * useful for testing the product flow and demoing to agents without any API
 * cost. Input is normalised first (title case, m² units, tidy open-home
 * time) so placeholder quality matches what live generation should produce.
 */

function featuresLine(input: CampaignInput): string {
  return input.keyFeatures ? ` Highlights include ${input.keyFeatures.toLowerCase()}.` : "";
}

function renovationsLine(input: CampaignInput): string {
  return input.renovations ? ` The property has benefited from ${input.renovations.toLowerCase()}.` : "";
}

function amenitiesLine(input: CampaignInput): string {
  return input.amenities ? ` Close to ${input.amenities}.` : "";
}

function ctaLine(input: CampaignInput): string {
  return input.cta ? input.cta : "Contact us today to arrange a viewing.";
}

function agentSignoff(input: CampaignInput): string {
  const name = input.agentName || "The agent";
  const agency = input.agencyName ? ` at ${input.agencyName}` : "";
  return `${name}${agency}`;
}

function agentContactLine(input: CampaignInput): string {
  const parts = [input.agentPhone, input.agentEmail].filter(Boolean);
  return parts.length ? `\n${parts.join(" · ")}` : "";
}

function ownershipPhrase(input: CampaignInput): string | null {
  return input.ownershipType && input.ownershipType !== "unknown"
    ? OWNERSHIP_TYPE_LABELS[input.ownershipType].toLowerCase()
    : null;
}

function saleMethodHeading(input: CampaignInput): string {
  return input.saleMethod ? `For Sale by ${SALE_METHOD_LABELS[input.saleMethod]}\n\n` : "";
}

function openHomeLine(input: CampaignInput): string {
  return input.openHomeDateTime ? `Open home: ${input.openHomeDateTime}.` : "Come along to this weekend's open home.";
}

/** Descriptor fragments used to build one natural sentence instead of restating the full fact list everywhere. */
function descriptorFragments(input: CampaignInput, max = 3): string[] {
  const fragments: string[] = [];
  const ownership = ownershipPhrase(input);
  if (ownership) fragments.push(`a ${ownership} option`);
  const facts = propertyFactsList(input);
  if (facts.length) fragments.push(facts.slice(0, max).join(", "));
  return fragments;
}

/** Strips any agent-specified "words to avoid" from generated placeholder copy. */
function applyWordsToAvoid(text: string, wordsToAvoid?: string): string {
  if (!wordsToAvoid) return text;
  const phrases = wordsToAvoid
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  let result = text;
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
  }
  return result.replace(/[ \t]{2,}/g, " ").replace(/ +([.,!?])/g, "$1");
}

/**
 * 10 varied, PK Script Assistant-style hook lines (short-form video/social
 * hooks, not brochure copy) — never "Welcome to...", never invents facts,
 * spans several hook types (feature, location, buyer-insight, ownership,
 * curiosity/question) so placeholder mode isn't repetitive.
 */
function hookVariants(input: CampaignInput): string[] {
  const facts = propertyFactsList(input);
  const fact0 = facts[0];
  const feature0 = input.keyFeatures ? input.keyFeatures.split(",")[0].trim() : null;
  const amenity0 = input.amenities ? input.amenities.split(",")[0].trim() : null;
  const ownership = ownershipPhrase(input);
  const buyerLabel = getBuyerLabel(input);
  const propertyLower = input.propertyType.toLowerCase();

  return [
    feature0 ? `This ${propertyLower} has ${feature0.toLowerCase()}.` : `Here's what stands out about this ${propertyLower}.`,
    amenity0 ? `Minutes from ${amenity0}, right here in ${input.suburb}.` : `${input.suburb} buyers, this one's for you.`,
    `If you're ${buyerLabel}, you'll want to see this.`,
    ownership ? `A ${ownership} ${propertyLower} in ${input.suburb}.` : `Not every ${propertyLower} in ${input.suburb} looks like this.`,
    fact0 ? `${fact0.charAt(0).toUpperCase()}${fact0.slice(1)} — in ${input.suburb}.` : `Here's what ${input.suburb} living looks like.`,
    `Still scrolling past ${input.suburb} listings? Watch this one.`,
    input.targetBuyer === "investor"
      ? `The numbers on this ${input.suburb} ${propertyLower} are worth a look.`
      : `Three things buyers keep asking about this one.`,
    amenity0 ? `Close to ${amenity0} and still feels like home.` : `Location does a lot of the talking here.`,
    input.renovations ? `This one's had ${input.renovations.split(",")[0].trim().toLowerCase()}.` : `Take a closer look inside.`,
    `Here's why this ${input.suburb} ${propertyLower} is turning heads.`,
  ];
}

const PLACEHOLDER_GENERATORS: Record<string, (input: CampaignInput) => string> = {
  // ---------------------------------------------------------------- Portal Copy
  premium_description: (i) => {
    const fragments = descriptorFragments(i);
    const opener = `Set in a convenient ${i.suburb} location, ${i.address} offers ${getBuyerAngle(i)}${
      fragments.length ? ` with ${fragments.join(", ")}` : ""
    }.`;
    const body = [featuresLine(i).trim(), renovationsLine(i).trim(), amenitiesLine(i).trim()].filter(Boolean).join(" ");
    return [opener, body, ctaLine(i)].filter(Boolean).join("\n\n") + `\n\n— ${agentSignoff(i)}${agentContactLine(i)}`;
  },

  short_description: (i) => {
    const facts = propertyFactsList(i);
    return `${i.propertyType} in ${i.suburb} — ${facts.slice(0, 3).join(", ") || "details on request"}${
      ownershipPhrase(i) ? `, ${ownershipPhrase(i)}` : ""
    }. ${ctaLine(i)}`;
  },

  trademe_description: (i) => {
    const facts = propertyFactsList(i);
    const ownership = ownershipPhrase(i);
    return (
      `${saleMethodHeading(i)}**${i.propertyType} — ${i.suburb}**\n\n` +
      `${i.address} presents ${getBuyerAngle(i)}.${featuresLine(i)}\n\n` +
      `Key details:\n${
        facts.map((f) => `- ${f.charAt(0).toUpperCase()}${f.slice(1)}`).join("\n") || "- Details available on request"
      }${ownership ? `\n- ${ownership.charAt(0).toUpperCase()}${ownership.slice(1)}` : ""}${
        i.amenities ? `\n- Close to ${i.amenities}` : ""
      }\n\n${renovationsLine(i).trim()}\n\n${ctaLine(i)}`
    );
  },

  feature_bullets: (i) => {
    const ownership = ownershipPhrase(i);
    return [
      ...propertyFactsList(i).map((f) => `- ${f.charAt(0).toUpperCase()}${f.slice(1)}`),
      ownership ? `- ${ownership.charAt(0).toUpperCase()}${ownership.slice(1)}` : null,
      i.keyFeatures ? `- ${i.keyFeatures}` : null,
      i.renovations ? `- ${i.renovations}` : null,
      i.amenities ? `- Close to ${i.amenities}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  },

  headline_options: (i) => {
    const ownership = ownershipPhrase(i);
    const facts = propertyFactsList(i);
    return [
      `1. ${ownership ? `${ownership.charAt(0).toUpperCase()}${ownership.slice(1)} ` : ""}${i.propertyType} in ${i.suburb}`,
      `2. ${facts[0] ? `${facts[0].charAt(0).toUpperCase()}${facts[0].slice(1)}, ` : ""}${i.suburb} ${i.propertyType}`,
      `3. Convenient ${i.suburb} Location — ${i.propertyType}`,
      `4. ${i.address}: ${facts.slice(0, 2).join(", ") || "A Well-Placed " + i.propertyType}`,
    ].join("\n");
  },

  buyer_summary: (i) =>
    `This ${i.propertyType.toLowerCase()} in ${i.suburb} is well suited to ${getBuyerLabel(i)}. ${getBuyerAngle(i)
      .charAt(0)
      .toUpperCase()}${getBuyerAngle(i).slice(1)}${
      i.amenities ? `, with everyday convenience thanks to nearby ${i.amenities}` : ""
    }. ${ctaLine(i)}`,

  // ---------------------------------------------------------------- Social Posts
  instagram_caption: (i) =>
    `${hookVariants(i)[0]}\n${propertyFactsList(i).slice(0, 2).join(" · ") || "space to suit your lifestyle"}${
      i.keyFeatures ? `\n${i.keyFeatures}` : ""
    }\n\n${ctaLine(i)}\n\n#${i.suburb.replace(/\s+/g, "")} #NZRealEstate #${i.propertyType.replace(/\s+/g, "")} #JustListed #PropertyNZ #NZHomes #RealEstateNZ`,

  facebook_caption: (i) =>
    `We're excited to share this ${i.propertyType.toLowerCase()} in ${i.suburb}. ${getBuyerAngle(i)}.${featuresLine(
      i
    )}${amenitiesLine(i)} ${ctaLine(i)}`,

  linkedin_caption: (i) =>
    `New to market: a ${i.propertyType.toLowerCase()} in ${i.suburb}. Well suited to ${getBuyerLabel(i)}. ${ctaLine(
      i
    )} — ${agentSignoff(i)}`,

  hooks: (i) =>
    [
      `1. What would ${i.suburb} living look like for you?`,
      `2. ${propertyFactsList(i)[0] || "Space, comfort, and location"} — all in one address.`,
      `3. Have you seen what's new in ${i.suburb}?`,
      `4. ${ownershipPhrase(i) ? `A ${ownershipPhrase(i)} find in ${i.suburb}.` : `Take a closer look at this ${i.suburb} ${i.propertyType.toLowerCase()}.`}`,
      `5. Here's why ${i.suburb} keeps coming up in buyer searches.`,
    ].join("\n"),

  just_listed_post: (i) =>
    `Just listed in ${i.suburb}! This ${i.propertyType.toLowerCase()} offers ${
      propertyFactsList(i).slice(0, 3).join(", ") || "plenty to offer"
    }.${featuresLine(i)} ${ctaLine(i)}`,

  story_sequence: (i) =>
    [
      `Slide 1: ${hookVariants(i)[1]}`,
      `Slide 2: ${i.address}, ${i.suburb}`,
      `Slide 3: ${propertyFactsList(i)[0] || i.propertyType}`,
      i.keyFeatures ? `Slide 4: ${i.keyFeatures.split(",")[0].trim()}` : `Slide 4: ${i.propertyType} living`,
      `Slide 5: ${ctaLine(i)}`,
    ].join("\n"),

  hashtags: (i) =>
    [
      `#${i.suburb.replace(/\s+/g, "")}`,
      "#NZRealEstate",
      `#${i.propertyType.replace(/\s+/g, "")}ForSale`,
      "#JustListed",
      "#PropertyNZ",
      "#NZHomes",
      "#RealEstateNZ",
      ownershipPhrase(i) === "freehold" ? "#Freehold" : "#NZProperty",
      "#HomeForSale",
      "#OpenHome",
    ].join(" "),

  cta_options: (i) =>
    [
      i.cta ? `1. ${i.cta}` : "1. Contact us today to arrange a viewing.",
      "2. Message us for more information.",
      "3. Come along to the next open home.",
      "4. Get in touch to book a private viewing.",
      "5. Enquire now to find out more.",
    ].join("\n"),

  // ---------------------------------------------------------------- Reels & Video
  reel_hooks_10: (i) => hookVariants(i).map((hook, idx) => `${idx + 1}. ${hook}`).join("\n"),

  reel_scripts: (i) => {
    const hooks = hookVariants(i);
    const fact0 = propertyFactsList(i)[0];
    const feature = i.keyFeatures || `a well laid out ${i.propertyType.toLowerCase()}`;
    return [
      `Script 1\nHook: ${hooks[0]}\nMiddle: ${feature}.${
        fact0 ? ` ${fact0.charAt(0).toUpperCase()}${fact0.slice(1)}.` : ""
      }\nCTA: ${ctaLine(i)}`,
      `Script 2\nHook: ${hooks[1]}\nMiddle: ${
        i.amenities ? `Everyday life here means being close to ${i.amenities}.` : `Everyday convenience in a well-placed location.`
      }${i.renovations ? ` It's also had ${i.renovations.toLowerCase()}.` : ""}\nCTA: ${ctaLine(i)}`,
      `Script 3\nHook: ${hooks[6]}\nMiddle: ${
        i.keyFeatures ? `Buyers keep asking about ${i.keyFeatures.toLowerCase()}.` : `This ${i.propertyType.toLowerCase()} has plenty to offer.`
      }\nCTA: ${ctaLine(i)}`,
    ].join("\n\n");
  },

  reel_onscreen_text: (i) =>
    [
      hookVariants(i)[0],
      `${i.propertyType}`,
      propertyFactsList(i)[0] || "Well placed",
      i.keyFeatures ? i.keyFeatures.split(",")[0].trim() : "Thoughtfully laid out",
      i.renovations ? i.renovations.split(",")[0].trim() : "Ready to view",
      i.amenities ? `Near ${i.amenities.split(",")[0].trim()}` : "Well located",
      "Book a viewing",
      "Link in bio",
    ].join("\n"),

  voiceover_script: (i) =>
    `${hookVariants(i)[4]} ${getBuyerAngle(i)}.${featuresLine(i)}${renovationsLine(i)}${amenitiesLine(i)} ${ctaLine(i)}`,

  shot_list: (i) =>
    [
      "1. Opening hook shot — exterior establishing shot (street view)",
      "2. Front entrance / doorway",
      "3. Living area, wide shot",
      "4. Kitchen, wide and detail shots",
      i.bedrooms ? "5. Main bedroom" : "5. Bedroom(s)",
      i.bathrooms ? "6. Bathroom" : "6. Bathroom(s)",
      i.garages ? "7. Garage / car parking" : "7. Outdoor parking area",
      "8. Outdoor / garden area",
      i.amenities ? "9. Nearby amenity or street context shot" : "9. Neighbourhood context shot",
      "10. Closing CTA shot at golden hour",
    ].join("\n"),

  agent_presenter_script: (i) =>
    `Hi, I'm ${i.agentName || "your agent"}${i.agencyName ? ` from ${i.agencyName}` : ""}, and I'm here at ${i.address} in ${i.suburb}.\n\n` +
    `${hookVariants(i)[2]}${featuresLine(i)}\n\n` +
    `${ctaLine(i)} — I'd love to show you through.`,

  silent_reel_version: (i) =>
    [
      hookVariants(i)[3],
      i.keyFeatures ? i.keyFeatures.split(",")[0].trim() : `A well laid out ${i.propertyType.toLowerCase()}`,
      propertyFactsList(i)[0] || "Take a look inside",
      i.amenities ? `Close to ${i.amenities.split(",")[0].trim()}` : "Well located",
      ctaLine(i),
    ].join("\n"),

  thumbnail_text_options: (i) => {
    const angle = pickHookAngle(i);
    const fact0 = propertyFactsList(i)[0];
    const angleText: Record<string, string> = {
      "Feature Hook": i.keyFeatures ? i.keyFeatures.split(",")[0].trim().toUpperCase() : "SEE INSIDE",
      "Location Hook": `${i.suburb.toUpperCase()} GEM`,
      "Scarcity Hook": "RARE FIND",
      "Buyer Insight Hook": "YOUR NEXT HOME?",
      "Investor Hook": "NUMBERS INSIDE",
      "Luxury Hook": "STEP INSIDE",
    };
    return [
      `1. ${angleText[angle.type]}`,
      `2. ${i.suburb.toUpperCase()} LISTING`,
      `3. ${fact0 ? fact0.toUpperCase() : "JUST LISTED"}`,
      `4. ${i.openHomeDateTime ? "OPEN HOME" : "BOOK A VIEWING"}`,
    ].join("\n");
  },

  // ---------------------------------------------------------------- Open Home
  open_home_post: (i) =>
    `Open home — ${i.address}, ${i.suburb}. ${openHomeLine(i)} Come and see this ${i.propertyType.toLowerCase()} for yourself.${featuresLine(
      i
    )} Can't make it? ${ctaLine(i)}`,

  open_home_morning_reminder: (i) =>
    `Reminder: our open home at ${i.address}, ${i.suburb} is today${
      i.openHomeDateTime ? ` — ${i.openHomeDateTime}` : ""
    }. ${ctaLine(i)}`,

  open_home_story_sequence: (i) =>
    [
      "Slide 1: Open home today 🏡",
      `Slide 2: ${i.address}, ${i.suburb}`,
      `Slide 3: ${i.openHomeDateTime || "See details in our profile"}`,
      `Slide 4: ${ctaLine(i)}`,
    ].join("\n"),

  agent_talking_points: (i) =>
    [
      `This ${i.propertyType.toLowerCase()} is located in ${i.suburb}.`,
      ...propertyFactsList(i)
        .slice(0, 2)
        .map((f) => `It offers ${f}.`),
      i.keyFeatures ? `Notable features include ${i.keyFeatures.toLowerCase()}.` : null,
      i.renovations ? `The property has had ${i.renovations.toLowerCase()}.` : null,
      i.amenities ? `It's close to ${i.amenities}.` : null,
      ownershipPhrase(i) ? `It's a ${ownershipPhrase(i)} property.` : null,
      `It's well suited to ${getBuyerLabel(i)}.`,
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

  open_home_checklist: () =>
    [
      "1. Arrive early to set up signage and prepare the property",
      "2. Have a sign-in sheet and business cards ready",
      "3. Review buyer talking points beforehand",
      "4. Have agency agreement / listing information on hand for interested buyers",
      "5. Note attendee feedback for the next vendor update",
      "6. Flag any strong interest for immediate follow-up",
      "7. Lock up and do a final walkthrough after guests leave",
    ].join("\n"),

  post_open_home_followup_prompt: (i) =>
    `Reminder: follow up with today's open home attendees at ${i.address} within 24 hours. Log feedback for the vendor update and flag any strong interest for immediate follow-up.`,

  // ---------------------------------------------------------------- Email & Follow-up
  buyer_followup_email: (i) =>
    `Hi [Buyer name],\n\nThanks for your interest in ${i.address}, ${i.suburb}. ${
      featuresLine(i).trim() || "It's a great property with plenty to offer."
    }\n\nHappy to answer any questions or arrange a second viewing at a time that suits you.\n\nLooking forward to hearing from you.\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  second_viewing_message: (i) =>
    `Hi [Buyer name],\n\nThanks again for taking the time to view ${i.address}. Would a second viewing help you get a better feel for the space? I'm happy to arrange a time that suits, including evenings or weekends.\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  finance_checkin_message: (i) =>
    `Hi [Buyer name],\n\nJust checking in — how are things progressing on your end, e.g. with finance or pre-approval? Happy to answer any questions about ${i.address} in the meantime.\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  open_home_thankyou_message: (i) =>
    `Hi [Buyer name],\n\nThanks for coming along to the open home at ${i.address} today. It was great to meet you. Let me know if any questions come up, or if you'd like to arrange a private viewing.\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  private_viewing_cta: (i) =>
    `Prefer a quieter look? I'm happy to arrange a private viewing of ${i.address} at a time that suits you — just get in touch and we'll find a time this week.`,

  // ---------------------------------------------------------------- Vendor Updates (campaign-pack templates)
  vendor_update_email: (i) =>
    `Hi there,\n\nQuick update on the campaign for ${i.address}. The listing is now live and the full marketing pack — descriptions, social content, and video assets — has been prepared and rolled out across our channels.${
      i.saleMethod ? ` The campaign is running as a ${SALE_METHOD_LABELS[i.saleMethod].toLowerCase()}.` : ""
    }\n\nNext steps: we'll be tracking enquiries and open home attendance, and I'll keep you posted after each touchpoint.\n\nPlease let me know if you have any questions in the meantime.\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  post_open_home_vendor_update: (i) =>
    `Hi there,\n\nA quick update following today's open home at ${i.address}. We had [X] groups through and [X] enquiries so far. Overall feedback has been [positive/mixed] — I'll share more detail as it comes in.\n\nNext step: [recommended next step].\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  weekly_vendor_update: (i) =>
    `Hi there,\n\nHere's this week's update on the campaign for ${i.address}. Enquiries so far: [X]. Online views: [X]. Feedback themes: [summary].\n\nRecommended next step: [next step].\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  low_enquiry_vendor_update: (i) =>
    `Hi there,\n\nWanted to give you an honest update on how the campaign for ${i.address} is tracking. Enquiry levels have been quieter than we'd like so far. This isn't unusual at this stage, and I'd like to talk through a few options — including refreshing the marketing angle or reviewing pricing feedback — to help build momentum.\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  price_feedback_vendor_wording: (i) =>
    `Feedback from buyers on ${i.address} so far suggests [buyer price feedback]. This reflects buyer commentary gathered during the campaign, not a formal valuation — happy to talk through what this means for our approach.\n\nKind regards,\n${agentSignoff(
      i
    )}${agentContactLine(i)}`,

  // ---------------------------------------------------------------- Campaign Timeline
  social_plan_7day: (i) =>
    [
      "Day 1 — Just-listed announcement (Facebook post)",
      "Day 2 — Feature highlight (Instagram Story)",
      "Day 3 — Reel: walkthrough script (Instagram/Facebook reel)",
      `Day 4 — ${i.amenities ? "Neighbourhood/amenity highlight" : "Suburb highlight"} (Instagram carousel)`,
      "Day 5 — Buyer talking points / behind-the-scenes (Story)",
      "Day 6 — Open home reminder (Facebook + Instagram post)",
      "Day 7 — Recap + CTA push (LinkedIn post)",
    ].join("\n"),
};

export function generatePlaceholder(sectionKey: string, rawInput: CampaignInput): string {
  const input = normalizeCampaignInput(rawInput);
  const generator = PLACEHOLDER_GENERATORS[sectionKey];
  if (!generator) {
    return `[Placeholder content for "${sectionKey}" — no template defined yet.]`;
  }
  return applyWordsToAvoid(generator(input), input.wordsToAvoid);
}
