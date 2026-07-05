"use client";

import { Button } from "@/components/ui/Button";
import { CATEGORY_LABELS, SECTIONS } from "@/lib/sections";
import { downloadTextFile } from "@/lib/utils";
import { OutputSection } from "./OutputSection";

export function OutputPack({
  campaignId,
  outputs,
  addressLine,
}: {
  campaignId: string;
  outputs: Record<string, string>;
  addressLine: string;
}) {
  const grouped = SECTIONS.reduce<Record<string, typeof SECTIONS>>((acc, s) => {
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(s);
    return acc;
  }, {});

  function handleExport() {
    const text = SECTIONS.map((s) => `${s.label}\n${"-".repeat(s.label.length)}\n${outputs[s.key] || ""}`).join(
      "\n\n"
    );
    downloadTextFile(`${addressLine.replace(/[^\w-]+/g, "_")}_launch_pack.txt`, text);
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-end gap-3 no-print">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
        <Button variant="outline" onClick={handleExport}>
          Download as text
        </Button>
      </div>

      {Object.entries(grouped).map(([category, sections]) => (
        <div key={category}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold-dark">
            {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
          </h2>
          <div className="space-y-4">
            {sections.map((s) => (
              <OutputSection
                key={s.key}
                campaignId={campaignId}
                sectionKey={s.key}
                label={s.label}
                initialContent={outputs[s.key] || ""}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
