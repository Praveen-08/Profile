"use client";

import { Card } from "@/components/ui/Card";
import { SAFECHECK_DISCLAIMER } from "@/lib/safecheck";
import { VENDOR_UPDATE_SECTIONS, sectionsToGenerate } from "@/lib/vendorUpdateSections";
import type { VendorUpdateFormData } from "@/lib/types";
import { useState } from "react";
import { VendorUpdateOutputSection } from "./VendorUpdateOutputSection";

export function VendorUpdateOutputView({
  vendorUpdateId,
  userId,
  formData,
  outputs: initialOutputs,
}: {
  vendorUpdateId: string;
  userId: string;
  formData: VendorUpdateFormData;
  outputs: Record<string, string>;
}) {
  const [outputs, setOutputs] = useState(initialOutputs);

  function updateSection(key: string, content: string) {
    setOutputs((prev) => ({ ...prev, [key]: content }));
  }

  const visibleKeys = sectionsToGenerate(formData);
  const isPriceRelevant = formData.updateType === "price_feedback" || !!formData.priceFeedback;

  return (
    <div className="space-y-4">
      {isPriceRelevant && (
        <Card className="border-gold/40 bg-gold/5 p-4 text-sm text-ink/70">
          <p className="font-medium text-ink">SafeCheck reminder</p>
          <p className="mt-1">
            This update includes price or market-sensitive wording. It reflects buyer feedback, not a formal
            valuation — review it before sending. {SAFECHECK_DISCLAIMER}
          </p>
        </Card>
      )}

      {VENDOR_UPDATE_SECTIONS.filter((s) => visibleKeys.includes(s.key)).map((s) => (
        <VendorUpdateOutputSection
          key={s.key}
          vendorUpdateId={vendorUpdateId}
          userId={userId}
          sectionKey={s.key}
          label={s.label}
          content={outputs[s.key] || ""}
          allOutputs={outputs}
          onContentChange={(content) => updateSection(s.key, content)}
        />
      ))}
    </div>
  );
}
