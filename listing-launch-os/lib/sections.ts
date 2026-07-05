// Canonical list of every section in a Listing Launch Pack.
// Order here controls display order on the output page.

export interface SectionMeta {
  key: string;
  label: string;
  category: "descriptions" | "social" | "video" | "posts" | "emails" | "plan" | "extras";
  multiline: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { key: "premium_description", label: "Premium listing description", category: "descriptions", multiline: true },
  { key: "short_description", label: "Short listing description", category: "descriptions", multiline: true },
  { key: "trademe_description", label: "TradeMe / realestate.co.nz description", category: "descriptions", multiline: true },
  { key: "instagram_caption", label: "Instagram caption", category: "social", multiline: true },
  { key: "facebook_caption", label: "Facebook caption", category: "social", multiline: true },
  { key: "linkedin_caption", label: "LinkedIn caption", category: "social", multiline: true },
  { key: "hooks", label: "5 strong hooks", category: "social", multiline: true },
  { key: "reel_scripts", label: "3 short reel scripts (under 30s)", category: "video", multiline: true },
  { key: "reel_onscreen_text", label: "On-screen text for reels", category: "video", multiline: true },
  { key: "voiceover_script", label: "Voiceover script", category: "video", multiline: true },
  { key: "shot_list", label: "Shot list for property video", category: "video", multiline: true },
  { key: "open_home_post", label: "Open-home reminder post", category: "posts", multiline: true },
  { key: "just_listed_post", label: "Just-listed post", category: "posts", multiline: true },
  { key: "vendor_update_email", label: "Vendor update email", category: "emails", multiline: true },
  { key: "buyer_followup_email", label: "Buyer follow-up email", category: "emails", multiline: true },
  { key: "social_plan_7day", label: "7-day social posting plan", category: "plan", multiline: true },
  { key: "agent_talking_points", label: "Agent talking points", category: "extras", multiline: true },
  { key: "amenity_highlights", label: "Nearby amenity highlights", category: "extras", multiline: true },
  { key: "cta_options", label: "CTA options", category: "extras", multiline: true },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export const CATEGORY_LABELS: Record<SectionMeta["category"], string> = {
  descriptions: "Listing descriptions",
  social: "Social captions & hooks",
  video: "Video & reel content",
  posts: "Campaign posts",
  emails: "Emails",
  plan: "Posting plan",
  extras: "Talking points & extras",
};

export function sectionMeta(key: string): SectionMeta | undefined {
  return SECTIONS.find((s) => s.key === key);
}
