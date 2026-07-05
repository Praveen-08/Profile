"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { runSafeCheck } from "@/lib/safecheck";
import { SECTIONS, TAB_LABELS, TAB_ORDER, sectionsForTab, type TabKey } from "@/lib/sections";
import { OWNERSHIP_TYPE_LABELS, SALE_METHOD_LABELS, type CampaignInput } from "@/lib/types";
import { downloadTextFile } from "@/lib/utils";
import { useMemo, useState } from "react";
import { OutputSection } from "./OutputSection";
import { SafeCheckPanel } from "./SafeCheckPanel";

export function OutputPack({
  campaignId,
  userId,
  campaign,
  outputs: initialOutputs,
}: {
  campaignId: string;
  userId: string;
  campaign: CampaignInput;
  outputs: Record<string, string>;
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

  function handleExport() {
    const text = SECTIONS.map((s) => `${s.label}\n${"-".repeat(s.label.length)}\n${outputs[s.key] || ""}`).join(
      "\n\n"
    );
    downloadTextFile(`${campaign.address.replace(/[^\w-]+/g, "_")}_launch_pack.txt`, text);
  }

  const activeSections = sectionsForTab(activeTab);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-3 no-print">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
        <Button variant="outline" onClick={handleExport}>
          Download as text
        </Button>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as TabKey)} />

      <div className="space-y-4">
        {activeTab === "safecheck" ? (
          <SafeCheckPanel outputs={outputs} input={campaign} />
        ) : (
          <>
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
