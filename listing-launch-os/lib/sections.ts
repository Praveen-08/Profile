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
  // Portal Copy
  { key: "premium_description", label: "Premium listing description", tab: "portal_copy", multiline: true },
  { key: "short_description", label: "Short listing description", tab: "portal_copy", multiline: true },
  { key: "trademe_description", label: "Trade Me / realestate.co.nz description", tab: "portal_copy", multiline: true },
  { key: "feature_bullets", label: "Feature bullets", tab: "portal_copy", multiline: true },
  { key: "headline_options", label: "Headline options", tab: "portal_copy", multiline: true },
  { key: "buyer_summary", label: "Buyer-focused summary", tab: "portal_copy", multiline: true },

  // Social Posts
  { key: "instagram_caption", label: "Instagram caption", tab: "social_posts", multiline: true },
  { key: "facebook_caption", label: "Facebook caption", tab: "social_posts", multiline: true },
  { key: "linkedin_caption", label: "LinkedIn caption", tab: "social_posts", multiline: true },
  { key: "hooks", label: "5 strong hooks", tab: "social_posts", multiline: true },
  { key: "just_listed_post", label: "Just-listed post", tab: "social_posts", multiline: true },
  { key: "story_sequence", label: "Story sequence", tab: "social_posts", multiline: true },
  { key: "hashtags", label: "Hashtags", tab: "social_posts", multiline: true },
  { key: "cta_options", label: "CTA options", tab: "social_posts", multiline: true },

  // Reels & Video
  { key: "reel_hooks_10", label: "10 reel hooks", tab: "reels_video", multiline: true },
  { key: "reel_scripts", label: "3 short reel scripts (under 30s)", tab: "reels_video", multiline: true },
  { key: "reel_onscreen_text", label: "On-screen text for reels", tab: "reels_video", multiline: true },
  { key: "voiceover_script", label: "Voiceover script", tab: "reels_video", multiline: true },
  { key: "shot_list", label: "Shot list for property video", tab: "reels_video", multiline: true },
  { key: "agent_presenter_script", label: "Agent presenter script", tab: "reels_video", multiline: true },
  { key: "silent_reel_version", label: "Silent reel version (captions only)", tab: "reels_video", multiline: true },
  { key: "thumbnail_text_options", label: "Thumbnail text options", tab: "reels_video", multiline: true },

  // Open Home
  { key: "open_home_post", label: "Open-home announcement", tab: "open_home", multiline: true },
  { key: "open_home_morning_reminder", label: "Morning-of reminder", tab: "open_home", multiline: true },
  { key: "open_home_story_sequence", label: "Open-home story sequence", tab: "open_home", multiline: true },
  { key: "agent_talking_points", label: "Buyer talking points", tab: "open_home", multiline: true },
  { key: "amenity_highlights", label: "Nearby amenity highlights", tab: "open_home", multiline: true },
  { key: "open_home_checklist", label: "Agent open-home checklist", tab: "open_home", multiline: true },
  { key: "post_open_home_followup_prompt", label: "Post-open-home follow-up prompt", tab: "open_home", multiline: true },

  // Email & Follow-up
  { key: "buyer_followup_email", label: "Warm buyer follow-up email", tab: "email_followup", multiline: true },
  { key: "second_viewing_message", label: "Second viewing message", tab: "email_followup", multiline: true },
  { key: "finance_checkin_message", label: "Finance/check-in message", tab: "email_followup", multiline: true },
  { key: "open_home_thankyou_message", label: "Open-home thank-you message", tab: "email_followup", multiline: true },
  { key: "private_viewing_cta", label: "Private viewing CTA", tab: "email_followup", multiline: true },

  // Vendor Updates
  { key: "vendor_update_email", label: "Launch-day vendor update", tab: "vendor_updates", multiline: true },
  { key: "post_open_home_vendor_update", label: "Post-open-home vendor update", tab: "vendor_updates", multiline: true },
  { key: "weekly_vendor_update", label: "Weekly campaign update", tab: "vendor_updates", multiline: true },
  { key: "low_enquiry_vendor_update", label: "Low-enquiry careful update", tab: "vendor_updates", multiline: true },
  { key: "price_feedback_vendor_wording", label: "Price feedback wording", tab: "vendor_updates", multiline: true },

  // Campaign Timeline
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
