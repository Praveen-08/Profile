"use client";

import { Card } from "@/components/ui/Card";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { MEETING_PLAYBOOK_SECTIONS, meetingPlaybookSectionMeta } from "@/lib/meetingPlaybookSections";
import { useState } from "react";
import { MeetingPlaybookOutputSection } from "./MeetingPlaybookOutputSection";

const COMPLIANCE_REMINDER =
  "This is a workflow assistant, not legal advice. Review with your agency procedures and REA obligations. The agent remains responsible for compliance and accuracy.";

export function MeetingPlaybookOutputView({
  playbookId,
  userId,
  outputs: initialOutputs,
}: {
  playbookId: string;
  userId: string;
  outputs: Record<string, string>;
}) {
  const [outputs, setOutputs] = useState(initialOutputs);
  const [activeTab, setActiveTab] = useState(MEETING_PLAYBOOK_SECTIONS[0].key);

  function updateSection(key: string, content: string) {
    setOutputs((prev) => ({ ...prev, [key]: content }));
  }

  const tabs: TabItem[] = MEETING_PLAYBOOK_SECTIONS.map((s) => ({ key: s.key, label: s.label }));
  const activeMeta = meetingPlaybookSectionMeta(activeTab);

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "compliance_notes" && (
        <Card className="border-gold/40 bg-gold/5 p-4 text-sm text-ink/70">{COMPLIANCE_REMINDER}</Card>
      )}

      {activeMeta && (
        <MeetingPlaybookOutputSection
          key={activeMeta.key}
          playbookId={playbookId}
          userId={userId}
          sectionKey={activeMeta.key}
          label={activeMeta.label}
          content={outputs[activeMeta.key] || ""}
          allOutputs={outputs}
          onContentChange={(content) => updateSection(activeMeta.key, content)}
        />
      )}
    </div>
  );
}
