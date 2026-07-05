"use client";

import { Button } from "@/components/ui/Button";
import { buildExportFileBase, printCampaignExport } from "@/lib/campaignExport";
import { runSafeCheck } from "@/lib/safecheck";
import { SECTIONS, sectionsForTab, type TabKey } from "@/lib/sections";
import type { CampaignInput } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

interface DownloadOption {
  key: string;
  label: string;
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  { key: "full_pack", label: "Full Campaign Pack" },
  { key: "portal_copy", label: "Portal Copy" },
  { key: "social_posts", label: "Social Posts" },
  { key: "reels_video", label: "Reels & Video" },
  { key: "open_home", label: "Open Home" },
  { key: "vendor_updates", label: "Vendor Emails" },
  { key: "email_followup", label: "Buyer Follow-up" },
  { key: "safecheck", label: "SafeCheck" },
  { key: "campaign_timeline", label: "Campaign Timeline" },
];

function formatSafeCheckForExport(outputs: Record<string, string>, campaign: CampaignInput): string {
  const result = runSafeCheck(outputs, campaign);
  if (result.issues.length === 0) {
    return `${result.noIssuesMessage}\n\n${result.disclaimer}`;
  }
  const lines = result.issues.map(
    (issue, idx) =>
      `${idx + 1}. [${issue.riskLevel.toUpperCase()}] ${issue.issue} — ${issue.sectionLabel}\n   Why it matters: ${
        issue.reason
      }\n   Safer wording: ${issue.saferAlternative}`
  );
  return `${lines.join("\n\n")}\n\n${result.disclaimer}`;
}

export function DownloadMenu({ campaign, outputs }: { campaign: CampaignInput; outputs: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleDownload(optionKey: string) {
    setOpen(false);
    const option = DOWNLOAD_OPTIONS.find((o) => o.key === optionKey);
    if (!option) return;

    let sections: { label: string; content: string }[];

    if (optionKey === "full_pack") {
      sections = SECTIONS.map((s) => ({ label: s.label, content: outputs[s.key] || "" }));
    } else if (optionKey === "safecheck") {
      sections = [{ label: "SafeCheck report", content: formatSafeCheckForExport(outputs, campaign) }];
    } else {
      sections = sectionsForTab(optionKey as TabKey).map((s) => ({ label: s.label, content: outputs[s.key] || "" }));
    }

    printCampaignExport({
      fileNameBase: buildExportFileBase(campaign.address, campaign.suburb, option.label),
      propertyAddress: campaign.address,
      suburb: campaign.suburb,
      sectionLabel: option.label,
      agentName: campaign.agentName,
      agencyName: campaign.agencyName,
      sections,
    });
  }

  return (
    <div className="relative no-print" ref={containerRef}>
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        Download
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-ink/10 bg-white py-2 shadow-premium">
          {DOWNLOAD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleDownload(option.key)}
              className="block w-full px-4 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
