"use client";

import { Card } from "@/components/ui/Card";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { DownloadMenu } from "./DownloadMenu";
import { SaveCampaignButton } from "./SaveCampaignButton";
import { runSafeCheck } from "@/lib/safecheck";
import { TAB_LABELS, TAB_ORDER, sectionsForTab, type TabKey } from "@/lib/sections";
import { OWNERSHIP_TYPE_LABELS, SALE_METHOD_LABELS, type CampaignInput } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";
import { OutputSection } from "./OutputSection";
import { SafeCheckPanel } from "./SafeCheckPanel";

export interface VendorUpdateSummary {
  id: string;
  label: string;
  createdAt: string;
}

export function OutputPack({
  campaignId,
  userId,
  campaign,
  outputs: initialOutputs,
  vendorUpdates = [],
}: {
  campaignId: string;
  userId: string;
  campaign: CampaignInput;
  outputs: Record<string, string>;
  vendorUpdates?: VendorUpdateSummary[];
}) {
  const [outputs, setOutputs] = useState(initialOutputs);
  const [activeTab, setActiveTab] = useState<TabKey>("portal_copy");

  function updateSection(key: string, content: string) {
    setOutputs((prev) => ({ ...prev, [key]: content }));
  }

  const safeCheckIssueCount = useMemo(() => runSafeCheck(outputs, campaign).issues.length, [outputs, campaign]);

  const tabs: TabItem[] = TAB_ORDER.map((tab) => ({
    key: tab,
    label: TAB_LABELS[tab],
    badge: tab === "safecheck" ? safeCheckIssueCount : undefined,
  }));

  const activeSections = sectionsForTab(activeTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-3 no-print">
        <SaveCampaignButton campaignId={campaignId} userId={userId} outputs={outputs} />
        <DownloadMenu campaign={campaign} outputs={outputs} />
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as TabKey)} />

      <div className="space-y-4">
        {activeTab === "safecheck" ? (
          <SafeCheckPanel outputs={outputs} input={campaign} />
        ) : (
          <>
            {activeTab === "vendor_updates" && (
              <Card className="p-5 text-sm text-ink/70">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-medium text-ink">Vendor update reports</h3>
                  <Link
                    href={`/vendor-updates/new?campaignId=${campaignId}`}
                    className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 hover:border-gold hover:text-ink"
                  >
                    Create Vendor Update
                  </Link>
                </div>
                {vendorUpdates.length === 0 ? (
                  <p>No vendor update reports for this campaign yet — create one after your next open home or weekly review.</p>
                ) : (
                  <ul className="space-y-2">
                    {vendorUpdates.map((v) => (
                      <li key={v.id}>
                        <Link href={`/vendor-updates/${v.id}`} className="text-gold-dark underline">
                          {v.label}
                        </Link>{" "}
                        <span className="text-ink/40">— {formatDate(v.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
            {activeTab === "campaign_timeline" && (
              <Card className="p-5 text-sm text-ink/70">
                <h3 className="mb-2 font-medium text-ink">Key campaign dates</h3>
                <ul className="space-y-1">
                  <li>
                    <span className="text-ink/50">Sale method: </span>
                    {campaign.saleMethod ? SALE_METHOD_LABELS[campaign.saleMethod] : "Not set"}
                  </li>
                  <li>
                    <span className="text-ink/50">Ownership: </span>
                    {campaign.ownershipType ? OWNERSHIP_TYPE_LABELS[campaign.ownershipType] : "Not set"}
                  </li>
                  <li>
                    <span className="text-ink/50">Open home: </span>
                    {campaign.openHomeDateTime || "Not scheduled yet"}
                  </li>
                </ul>
              </Card>
            )}
            {activeSections.map((s) => (
              <OutputSection
                key={s.key}
                campaignId={campaignId}
                userId={userId}
                sectionKey={s.key}
                label={s.label}
                content={outputs[s.key] || ""}
                onContentChange={(content) => updateSection(s.key, content)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
