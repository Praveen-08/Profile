import type { CampaignInput } from "../types";
import { buildContextBlock, COMPLIANCE_SYSTEM_PROMPT } from "./system";

interface PromptSet {
  system: string;
  user: string;
}

const SECTION_INSTRUCTIONS: Record<string, string> = {
  // ---------------------------------------------------------------- Portal Copy
  premium_description: `Write a premium, polished full listing description (180-260 words) suitable for a print brochure or the top of an online listing. Open with a strong scene-setting line, weave in the supplied features naturally, mention the ownership type and sale method if supplied (naturally, not as a bullet point), and close with a call to action using the preferred CTA if one was given. Do not restate every single fact — pick the two or three most relevant to lead with.`,

  short_description: `Write a short listing description (50-70 words) for use where space is limited (e.g. a signboard flyer or a listing summary card). Cover the essentials only: property type, key stats, standout feature, suburb appeal.`,

  trademe_description: `Write a listing description in the style used on Trade Me Property and realestate.co.nz (NZ's major listing portals). Use short paragraphs and occasional bullet points for key features. 200-300 words. If a sale method was supplied, state it clearly near the top (e.g. "For Sale by Auction", "Deadline Sale", "Price by Negotiation") in the way NZ portals conventionally present it. If an ownership type was supplied, mention it factually. Include a closing line inviting enquiries or an open home visit.`,

  feature_bullets: `Write a clean bullet list (one line each) combining the property's key stats, standout features, ownership type if supplied, and nearby amenities if supplied. No narrative sentences — bullets only, each starting with a capital letter.`,

  headline_options: `Write 4 short listing headline options (portal-title style, under 10 words each), numbered 1-4. Each should be keyword-forward (suburb, property type, standout stat or feature) rather than a full sentence. No superlatives.`,

  buyer_summary: `Write a short paragraph (40-60 words) explicitly framed around who this property suits and why, using the buyer framing guidance provided (not just the raw buyer selection). End with the CTA.`,

  // ---------------------------------------------------------------- Social Posts
  // instagram_caption and story_sequence are handled by lib/prompts/pkScriptAssistantPrompt.ts
  // (PK Script Assistant style) — see PK_SECTION_KEYS in lib/ai/generate.ts.
  facebook_caption: `Write a Facebook post caption for this listing. Slightly longer, warmer, and more informative than Instagram (60-100 words), friendly tone, ends with a clear CTA. No hashtags needed (max 2-3 if natural).`,

  linkedin_caption: `Write a LinkedIn post caption announcing this listing, framed for a professional, market-facing network (other agents, local business owners, investors where relevant). 50-90 words, confident and professional, ends with a CTA.`,

  hooks: `Write 5 strong, distinct opening hooks (each one sentence, under 15 words) that could be used as the first line of a social caption. Number them 1-5. Vary the angle across the 5 (e.g. curiosity, lifestyle, feature-led, question, bold statement) — do not repeat the same structure. Never use urgency pressure phrasing like "won't last".`,

  just_listed_post: `Write a "just listed" announcement post for this property. Exciting but professional tone, clearly signals it's a new listing, highlights the standout feature, ends with a CTA to view or enquire.`,

  hashtags: `Write a single line of 8-10 relevant NZ real estate hashtags for this listing (suburb, property type, general real estate tags), space-separated, each starting with #.`,

  cta_options: `Write 5 alternative call-to-action lines the agent can choose between for this campaign (for use across social posts, emails, or listing copy). Keep each under 12 words. If a preferred CTA was supplied, include a polished version of it as option 1.`,

  // ---------------------------------------------------------------- Reels & Video
  // reel_hooks_10, reel_scripts, reel_onscreen_text, voiceover_script, shot_list,
  // agent_presenter_script, silent_reel_version, and thumbnail_text_options are
  // handled by lib/prompts/pkScriptAssistantPrompt.ts (PK Script Assistant style)
  // — see PK_SECTION_KEYS in lib/ai/generate.ts.

  // ---------------------------------------------------------------- Open Home
  open_home_post: `Write a social post announcing an upcoming open home for this property. Friendly, inviting tone, clear mention that it's an open home, and a CTA to attend or message for a private viewing. If an open home date/time was supplied, state it clearly and exactly as given. If not, refer to it generally as "this weekend's open home" — do not invent a specific date or time.`,

  open_home_morning_reminder: `Write a short same-day morning reminder post for the open home (1-2 sentences), referencing the exact time if supplied, with a CTA.`,

  open_home_story_sequence: `Write a 3-4 slide Story sequence specifically reminding followers about today's open home, labelled "Slide 1", "Slide 2", etc. Include the address and time (if supplied) and a CTA.`,

  agent_talking_points: `Write 6-8 short, polished talking points the agent can use when speaking with buyers at an open home or on the phone about this property. Each point should be a single confident, specific sentence grounded only in the supplied facts — not generic filler like "This property is located in [suburb]." Cover property features, suburb/location appeal, and buyer-fit using the buyer framing guidance.`,

  amenity_highlights: `Write a short "nearby amenities" highlight section (bulleted list, 4-8 items) based only on the amenities supplied. If very few amenities were supplied, keep the list short rather than inventing extras. Each bullet should be a brief, appealing one-line description. Keep amenity names capitalised exactly as proper nouns.`,

  open_home_checklist: `Write a practical checklist (numbered, 6-8 items) for the agent to run through before, during, and immediately after the open home itself (not buyer-facing copy) — arriving early, signage, sign-in sheet, talking points ready, agency documents on hand, noting feedback, flagging strong interest, locking up.`,

  post_open_home_followup_prompt: `Write a single short internal reminder (1-2 sentences) prompting the agent to follow up with today's open home attendees within 24 hours and log feedback for the vendor update.`,

  // ---------------------------------------------------------------- Email & Follow-up
  buyer_followup_email: `Write a warm follow-up email template an agent can send to a prospective buyer who viewed or enquired about this property. Friendly, helpful, low-pressure tone — some urgency is fine (e.g. inviting them to act soon) but never pressuring. Recap 2-3 standout features, invite questions, and include a clear next-step CTA. Sign off with the agent's name and include their phone and/or email if supplied.`,

  second_viewing_message: `Write a short message inviting a buyer who has already viewed the property to arrange a second viewing. Warm, low-pressure, flexible on timing.`,

  finance_checkin_message: `Write a short, friendly check-in message to a buyer who showed interest, gently asking how their finance/pre-approval process is progressing, without being pushy.`,

  open_home_thankyou_message: `Write a short thank-you message to send to attendees after an open home, warm and appreciative, inviting further questions or a private viewing.`,

  private_viewing_cta: `Write a single short paragraph offering a prospective buyer a private viewing at a time that suits them. Confident and inviting, with a light sense of momentum but no pressure tactics.`,

  // ---------------------------------------------------------------- Vendor Updates (campaign-pack templates)
  vendor_update_email: `Write a short, professional launch-day email update to the property vendor (seller) about how the listing campaign has launched. Calm, reassuring, and informative tone. Structure: greeting, summary of what's been done for the launch (marketing pack/campaign created, listing live), a note on next steps (open homes, enquiries), and a warm sign-off from the agent including their phone and/or email if supplied. Do not invent specific enquiry numbers or offers — use bracketed placeholders like [X] for any figure that would need to come from real campaign activity.`,

  post_open_home_vendor_update: `Write a vendor update EMAIL TEMPLATE for use immediately after an open home. Use bracketed placeholders (e.g. "[X] groups", "[X] enquiries", "[recommended next step]") for anything that depends on real activity data, since none was supplied here — this is a reusable template, not a report of actual results. Calm, professional tone.`,

  weekly_vendor_update: `Write a vendor update EMAIL TEMPLATE for a weekly campaign check-in. Use bracketed placeholders for enquiry counts, view counts, and feedback themes, since none was supplied here. Calm, professional tone, ending with a recommended-next-step placeholder.`,

  low_enquiry_vendor_update: `Write a careful, calm vendor update template for a period of lower-than-hoped enquiry levels. Honest but not alarming — acknowledge the situation plainly, then pivot to constructive next steps (e.g. reviewing marketing angle or price feedback) without assigning blame or overpromising a turnaround.`,

  price_feedback_vendor_wording: `Write a careful paragraph template for sharing buyer price feedback with the vendor, using a bracketed placeholder for the actual feedback content since none was supplied here. Use hedged, non-committal language (e.g. "buyers have indicated...") and explicitly note this reflects buyer commentary, not a formal valuation.`,

  // ---------------------------------------------------------------- Campaign Timeline
  social_plan_7day: `Write a simple 7-day social media posting plan for launching this listing, formatted as "Day 1" through "Day 7". For each day give a one-line content idea and suggested format (e.g. Instagram carousel, Story, Facebook post, reel). Keep the plan realistic for a solo agent to execute.`,
};

export function getSectionPrompt(sectionKey: string, input: CampaignInput): PromptSet {
  const instruction = SECTION_INSTRUCTIONS[sectionKey];
  if (!instruction) {
    throw new Error(`Unknown section key: ${sectionKey}`);
  }

  const user = `Property details:\n${buildContextBlock(input)}\n\nTask:\n${instruction}`;

  return { system: COMPLIANCE_SYSTEM_PROMPT, user };
}

export { SECTION_INSTRUCTIONS };
