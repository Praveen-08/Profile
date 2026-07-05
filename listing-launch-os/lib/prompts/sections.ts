import type { CampaignInput } from "../types";
import { buildContextBlock, COMPLIANCE_SYSTEM_PROMPT } from "./system";

interface PromptSet {
  system: string;
  user: string;
}

const SECTION_INSTRUCTIONS: Record<string, string> = {
  premium_description: `Write a premium, polished full listing description (180-260 words) suitable for a print brochure or the top of an online listing. Open with a strong scene-setting line, weave in the supplied features naturally, mention the ownership type and sale method if supplied (naturally, not as a bullet point), and close with a call to action using the preferred CTA if one was given.`,

  short_description: `Write a short listing description (50-70 words) for use where space is limited (e.g. a signboard flyer or a listing summary card). Cover the essentials only: property type, key stats, standout feature, suburb appeal.`,

  trademe_description: `Write a listing description in the style used on Trade Me Property and realestate.co.nz (NZ's major listing portals). Use short paragraphs and occasional bullet points for key features. 200-300 words. If a sale method was supplied, state it clearly near the top (e.g. "For Sale by Auction", "Deadline Sale", "Price by Negotiation") in the way NZ portals conventionally present it. If an ownership type was supplied, mention it factually. Include a closing line inviting enquiries or an open home visit.`,

  instagram_caption: `Write an Instagram caption for this listing. Punchy opening line, 3-5 short lines of body copy, a clear CTA, and 8-12 relevant NZ real estate hashtags (mix of suburb, property type, and general real estate tags) on a final line.`,

  facebook_caption: `Write a Facebook post caption for this listing. Slightly longer and more conversational than Instagram (60-100 words), friendly tone, ends with a clear CTA. No hashtags needed (max 2-3 if natural).`,

  linkedin_caption: `Write a LinkedIn post caption announcing this listing, framed for a professional network (other agents, local business owners, investors where relevant). 50-90 words, confident and professional, ends with a CTA.`,

  hooks: `Write 5 strong, distinct opening hooks (each one sentence, under 15 words) that could be used as the first line of a social caption or the opening line of a reel voiceover. Number them 1-5. Vary the angle across the 5 (e.g. curiosity, lifestyle, feature-led, question, bold statement) — do not repeat the same structure.`,

  reel_scripts: `Write 3 short property reel scripts, each designed to run under 30 seconds when read aloud (roughly 50-70 words of spoken line per script). Label them "Script 1", "Script 2", "Script 3". Each script should have a distinct angle (e.g. walkthrough, lifestyle/emotional, feature highlight). Format each script as a simple line-by-line spoken script.`,

  reel_onscreen_text: `Write the on-screen text overlays for a property reel (short punchy phrases, one per screen, 3-8 words each). Provide 8-10 overlay lines in the order they'd appear across a walkthrough video, from opening hook to closing CTA.`,

  voiceover_script: `Write a single continuous voiceover script for a property walkthrough video, timed for approximately 45-60 seconds when read aloud. Warm, professional narration style. End on the CTA.`,

  shot_list: `Write a practical shot list for filming this property's marketing video/reel, as a numbered list. Include exterior establishing shots, key interior rooms/features mentioned, and a closing shot suggestion. 8-14 items. Keep each item to one short line (shot description only, no camera jargon overload).`,

  open_home_post: `Write a social post reminding followers about an upcoming open home for this property. Friendly, inviting tone, clear mention that it's an open home reminder, and a CTA to attend or message for a private viewing. If an open home date/time was supplied, state it clearly and exactly as given. If not, refer to it generally as "this weekend's open home" — do not invent a specific date or time.`,

  just_listed_post: `Write a "just listed" announcement post for this property. Exciting but professional tone, clearly signals it's a new listing, highlights the standout feature, ends with a CTA to view or enquire.`,

  vendor_update_email: `Write a short, professional email update to the property vendor (seller) about how the listing campaign has launched. Reassuring and informative tone. Structure: greeting, summary of what's been done for the launch (marketing pack/campaign created, listing live), a note on next steps (open homes, enquiries), and a warm sign-off from the agent including their phone and/or email if supplied. Do not invent specific enquiry numbers or offers.`,

  buyer_followup_email: `Write a follow-up email template an agent can send to a prospective buyer who viewed or enquired about this property. Friendly, helpful, low-pressure tone. Recap 2-3 standout features, invite questions, and include a clear next-step CTA (e.g. second viewing, more information). Sign off with the agent's name and include their phone and/or email if supplied.`,

  social_plan_7day: `Write a simple 7-day social media posting plan for launching this listing, formatted as "Day 1" through "Day 7". For each day give a one-line content idea and suggested format (e.g. Instagram carousel, Story, Facebook post, reel). Keep the plan realistic for a solo agent to execute.`,

  agent_talking_points: `Write 6-8 short talking points the agent can use when speaking with buyers at an open home or on the phone about this property. Each point should be a single confident sentence grounded only in the supplied facts. Cover property features, suburb/location appeal, and buyer-fit for the specified target buyer.`,

  amenity_highlights: `Write a short "nearby amenities" highlight section (bulleted list, 4-8 items) based only on the amenities supplied. If very few amenities were supplied, keep the list short rather than inventing extras. Each bullet should be a brief, appealing one-line description.`,

  cta_options: `Write 5 alternative call-to-action lines the agent can choose between for this campaign (for use across social posts, emails, or listing copy). Keep each under 12 words. If a preferred CTA was supplied, include a polished version of it as option 1.`,
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
