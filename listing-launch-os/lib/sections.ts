// Canonical list of every generated section in a Listing Launch Pack, and how
// they're grouped into tabs on the campaign output page.

export type TabKey =
  | "portal_copy"
  | "social_posts"
  | "reels_video"
  | "open_home"
  | "email_followup"
  | "vendor_updates"
  | "safecheck"
  | "campaign_timeline";

export interface SectionMeta {
  key: string;
  label: string;
  tab: TabKey;
  multiline: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { key: "premium_description", label: "Premium listing description", tab: "portal_copy", multiline: true },
  { key: "short_description", label: "Short listing description", tab: "portal_copy", multiline: true },
  { key: "trademe_description", label: "Trade Me / realestate.co.nz description", tab: "portal_copy", multiline: true },
  { key: "instagram_caption", label: "Instagram caption", tab: "social_posts", multiline: true },
  { key: "facebook_caption", label: "Facebook caption", tab: "social_posts", multiline: true },
  { key: "linkedin_caption", label: "LinkedIn caption", tab: "social_posts", multiline: true },
  { key: "hooks", label: "5 strong hooks", tab: "social_posts", multiline: true },
  { key: "just_listed_post", label: "Just-listed post", tab: "social_posts", multiline: true },
  { key: "cta_options", label: "CTA options", tab: "social_posts", multiline: true },
  { key: "reel_scripts", label: "3 short reel scripts (under 30s)", tab: "reels_video", multiline: true },
  { key: "reel_onscreen_text", label: "On-screen text for reels", tab: "reels_video", multiline: true },
  { key: "voiceover_script", label: "Voiceover script", tab: "reels_video", multiline: true },
  { key: "shot_list", label: "Shot list for property video", tab: "reels_video", multiline: true },
  { key: "open_home_post", label: "Open-home reminder post", tab: "open_home", multiline: true },
  { key: "agent_talking_points", label: "Agent talking points", tab: "open_home", multiline: true },
  { key: "amenity_highlights", label: "Nearby amenity highlights", tab: "open_home", multiline: true },
  { key: "buyer_followup_email", label: "Buyer follow-up email", tab: "email_followup", multiline: true },
  { key: "vendor_update_email", label: "Vendor update email", tab: "vendor_updates", multiline: true },
  { key: "social_plan_7day", label: "7-day social posting plan", tab: "campaign_timeline", multiline: true },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export const TAB_LABELS: Record<TabKey, string> = {
  portal_copy: "Portal Copy",
  social_posts: "Social Posts",
  reels_video: "Reels & Video",
  open_home: "Open Home",
  email_followup: "Email & Follow-up",
  vendor_updates: "Vendor Updates",
  safecheck: "SafeCheck",
  campaign_timeline: "Campaign Timeline",
};

export const TAB_ORDER: TabKey[] = [
  "portal_copy",
  "social_posts",
  "reels_video",
  "open_home",
  "email_followup",
  "vendor_updates",
  "campaign_timeline",
  "safecheck",
];

export function sectionsForTab(tab: TabKey): SectionMeta[] {
  return SECTIONS.filter((s) => s.tab === tab);
}

export function sectionMeta(key: string): SectionMeta | undefined {
  return SECTIONS.find((s) => s.key === key);
}
