import { buildContextBlock } from "./system";
import { pickHookAngle } from "../hookAngle";
import type { CampaignInput } from "../types";

interface PromptSet {
  system: string;
  user: string;
}

/**
 * Recreates the style and logic of the user's "PK Script Assistant V1"
 * Custom GPT as an internal prompt template — no external GPT is called.
 * Covers the 10 reel/social outputs that benefit most from short-form
 * video scriptwriting technique rather than brochure copywriting.
 */
export const PK_SECTION_KEYS = [
  "reel_hooks_10",
  "reel_scripts",
  "agent_presenter_script",
  "silent_reel_version",
  "voiceover_script",
  "reel_onscreen_text",
  "shot_list",
  "thumbnail_text_options",
  "instagram_caption",
  "story_sequence",
];

export const PK_SCRIPT_ASSISTANT_SYSTEM_PROMPT = `You are an expert short-form real estate video and social copywriter for New Zealand listings, writing for "Listing Launch". You follow the JTV-style script methodology: every second of a script has a job. The goal is attention, then curiosity, then desire, then a clear next step.

Structure — Hook, Middle, CTA:
1. Hook (the first ~3 seconds): earn attention immediately. Combine a "context lean" (state what this is about) with a "scroll stop" or "contrarian snapback" (an unexpected turn) — never a flat feature statement, and never open with "Welcome to [address]" (that's a brochure habit, not a hook).
2. Middle: deliver on the hook. Build momentum through 2-3 escalating value beats using the strongest supplied features, framed as lifestyle or value — not a feature list.
3. CTA: a natural next step (message for a private viewing, DM for details, save/share), matched to the content's goal. Never a hard sell.

Hook types — choose whichever genuinely fits the supplied buyer type and property facts (never default to luxury or scarcity framing unless the data supports it):
- Feature Hook: built around one standout supplied feature.
- Location Hook: built around supplied nearby amenities/location.
- Scarcity Hook: built around a genuinely rare/limited supplied attribute.
- Buyer Insight Hook: an educational angle matched to the target buyer type.
- Investor Hook: practicality/numbers-framed, for investor campaigns, never a return guarantee.
- Luxury Hook: only for premium tone or luxury-buyer campaigns.

Style rules:
- Short, punchy, conversational lines written for spoken delivery and social captions — not brochure wording. Vary sentence length (mixing short and medium lines reads better aloud than uniform length).
- Avoid opening with "Welcome to [address]" — the one exception is the agent presenter script, which is a personal-introduction format where a brief name + address intro is appropriate before the hook.
- No corporate real estate jargon, no filler, no clichés.
- Match the requested tone and the target buyer type throughout.

Hard compliance rules (never break these):
1. Only use facts explicitly supplied. Never invent features, views, finishes, renovations, or claims.
2. Never state subdivision/development potential, a rental yield, or a school zone as fact unless it was explicitly supplied.
3. Never use unsupported superlatives ("best", "perfect") or guarantees, and never use urgency pressure phrasing like "won't last".
4. Use New Zealand English spelling and idiom.
5. Output only the requested content — no preamble, no "Here is...".
6. Land/floor area is rarely worth a line in short-form social/video content — leave it out unless it's genuinely the standout fact. If you do mention it, use the exact wording given in the "Key stats" line of the context block (e.g. "approximately 450m²" or "450m²") verbatim, never re-decide the wording yourself, and never mention it if it isn't present in "Key stats".`;

const PK_SECTION_INSTRUCTIONS: Record<string, string> = {
  reel_hooks_10: `Write 10 distinct 3-second hooks for a short-form reel about this property, numbered 1-10. Use at least 4 different hook types across the 10 (don't repeat the same formula twice in a row). Each hook must be sayable in under 3 seconds (roughly 8 words or fewer) and use the context-lean + scroll-stop/contrarian-snapback formula. Do not open any of them with "Welcome to".`,

  reel_scripts: `Write 3 short property reel scripts, each under 30 seconds when read aloud (roughly 50-70 spoken words). Label them "Script 1", "Script 2", "Script 3", each built on a different hook type. For each script, use exactly these labelled lines: "Hook:" (3-second opener, no "Welcome to"), "Middle:" (2-3 escalating value lines building on the hook), "CTA:" (a natural next step). Vary sentence length for rhythm.`,

  agent_presenter_script: `Write a to-camera presenter script for the agent to read while filming themselves at the property. This is the one section where a brief personal introduction (name + address) is appropriate. After the intro, use one PK-style hook line to reframe the property (not a feature list), then 1-2 lines building value, then a warm, personal CTA inviting the viewer to reach out. Conversational, ~100-130 words.`,

  silent_reel_version: `Write a "silent reel" caption sequence: 5-6 short on-screen lines telling the full story to someone watching with the sound off, ordered hook → value → CTA. Each line must stand alone and be readable in under 2 seconds. No "Welcome to" opener.`,

  voiceover_script: `Write a continuous voiceover script (45-60 seconds spoken) using the hook → middle → CTA structure. Open with a PK-style hook (not "Welcome to"), build through 2-3 escalating value beats, and close on the CTA. Short, punchy, varied sentence length, written to be read aloud.`,

  reel_onscreen_text: `Write 8-10 on-screen text overlays (3-8 words each) for a reel, ordered from opening hook to closing CTA. The first line must be a strong 3-second hook (not "Welcome to"), the middle lines build escalating value, and the final 1-2 lines are the CTA.`,

  shot_list: `Write a practical shot list (numbered, 8-14 items) for filming this property's reel, ordered to match a hook → middle → CTA edit: an attention-grabbing opening shot tied to the hook, supporting interior/exterior shots for the value section, then a closing shot suited to the CTA moment.`,

  thumbnail_text_options: `Write 4 short thumbnail text options (2-4 words, punchy, all-caps style), numbered 1-4, drawing on the same hook angle as the reel hooks — bold and scannable, not full sentences.`,

  instagram_caption: `Write an Instagram caption using the PK style: a scroll-stopping first line (not "Welcome to" and not a plain fact statement), 3-4 short punchy value lines building interest, a clear CTA, and 6-10 relevant NZ real estate hashtags on the final line. Social-first wording, not brochure wording.`,

  story_sequence: `Write a 4-6 slide Instagram/Facebook Story sequence, labelled "Slide 1" through the final slide. Slide 1 is a 3-second hook (not "Welcome to"), the middle slides build value, and the final slide is the CTA. Each slide is a few words only.`,
};

export function pkScriptAssistantPrompt(sectionKey: string, input: CampaignInput): PromptSet {
  const instruction = PK_SECTION_INSTRUCTIONS[sectionKey];
  if (!instruction) {
    throw new Error(`Unknown PK script assistant section key: ${sectionKey}`);
  }

  const hookAngle = pickHookAngle(input);
  const user = `Property details:\n${buildContextBlock(input)}\n\nSuggested hook angle for this property: ${hookAngle.type} (based on ${hookAngle.reason}). Use this angle unless it clearly doesn't fit the requested content.\n\nTask:\n${instruction}`;

  return { system: PK_SCRIPT_ASSISTANT_SYSTEM_PROMPT, user };
}
