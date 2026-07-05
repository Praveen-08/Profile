"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/utils";
import { runSafeCheck, type RiskLevel } from "@/lib/safecheck";
import type { CampaignInput } from "@/lib/types";
import { useMemo } from "react";

const RISK_STYLES: Record<RiskLevel, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-ink/5 text-ink/60 border-ink/10",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};

export function SafeCheckPanel({ outputs, input }: { outputs: Record<string, string>; input: CampaignInput }) {
  const result = useMemo(() => runSafeCheck(outputs, input), [outputs, input]);

  return (
    <div className="space-y-4">
      <Card className="border-gold/40 bg-gold/5 p-4 text-sm text-ink/70">{result.disclaimer}</Card>

      <div className="flex flex-wrap gap-3 text-sm">
        <Badge className="bg-red-100 text-red-700">{result.summary.high} high</Badge>
        <Badge className="bg-amber-100 text-amber-700">{result.summary.medium} medium</Badge>
        <Badge className="bg-ink/10 text-ink/60">{result.summary.low} low</Badge>
      </div>

      {result.issues.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink/60">{result.noIssuesMessage}</Card>
      ) : (
        <div className="space-y-3">
          {result.issues.map((issue, i) => (
            <Card key={i} className={cx("border p-4", RISK_STYLES[issue.riskLevel])}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">{issue.issue}</p>
                <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                  {RISK_LABELS[issue.riskLevel]}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-ink/40">{issue.sectionLabel}</p>
              <p className="mt-2 text-sm text-ink/70">{issue.reason}</p>
              <p className="mt-2 text-sm">
                <span className="font-medium text-ink/70">Safer wording: </span>
                {issue.saferAlternative}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
