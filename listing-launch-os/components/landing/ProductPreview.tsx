"use client";

import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/utils";
import { useState } from "react";

interface PreviewTab {
  key: string;
  label: string;
  heading: string;
  snippet: string;
}

const PREVIEW_TABS: PreviewTab[] = [
  {
    key: "portal_copy",
    label: "Portal Copy",
    heading: "Premium listing description",
    snippet:
      "Positioned in the heart of Mount Eden, this three-bedroom, two-bathroom home brings together everyday convenience, flexible living, and a location buyers know and trust. With north-facing living, a renovated kitchen, off-street parking, and approximately 450m² of land, it offers a strong option for families, professionals, and buyers wanting an established city-fringe address.",
  },
  {
    key: "social_posts",
    label: "Social Posts",
    heading: "Instagram caption",
    snippet:
      "Just imagine calling Mount Eden home. ✨\nNorth-facing living, a renovated kitchen, and off-street parking on approximately 450m².\n\nContact us today to arrange a viewing.\n#MountEden #NZRealEstate #JustListed",
  },
  {
    key: "reels_video",
    label: "Reels & Video",
    heading: "Reel script — walkthrough",
    snippet:
      "Welcome to this Mount Eden home. Three bedrooms, two bathrooms, and a renovated kitchen that opens onto north-facing living. Let's take a look inside. Contact us today to arrange a viewing.",
  },
  {
    key: "open_home",
    label: "Open Home",
    heading: "Open-home reminder post",
    snippet:
      "Open home reminder — Mount Eden. Open home: Saturday 11:00am - 11:30am. Come and see this home for yourself. Can't make it? Message us to arrange a private viewing.",
  },
  {
    key: "safecheck",
    label: "SafeCheck",
    heading: "Flagged before publishing",
    snippet:
      '⚠ Medium risk — "perfect family home"\nUnsupported superlative unless specifically confirmed.\nSafer wording: "a home well suited to family living"',
  },
  {
    key: "campaign_timeline",
    label: "Campaign Timeline",
    heading: "7-day posting plan",
    snippet:
      "Day 1 — Just-listed announcement (Facebook post)\nDay 3 — Reel: walkthrough script (Instagram/Facebook reel)\nDay 6 — Open home reminder (Facebook + Instagram post)",
  },
];

export function ProductPreview() {
  const [active, setActive] = useState(PREVIEW_TABS[0].key);
  const activeTab = PREVIEW_TABS.find((t) => t.key === active) || PREVIEW_TABS[0];

  return (
    <section id="product-preview" className="mx-auto max-w-4xl px-6 pb-16">
      <Card className="overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-ink/10 bg-ink/[0.02] px-3 pt-3">
          {PREVIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cx(
                "shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                active === tab.key ? "border-gold bg-white text-ink" : "border-transparent text-ink/50 hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-gold-dark">{activeTab.heading}</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">{activeTab.snippet}</p>
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-ink/40">
        Sample output shown for illustration — every campaign is generated from the details you enter.
      </p>
    </section>
  );
}
