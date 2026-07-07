"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GROUPING_PRESET_SECONDS, type GroupingPreset } from "@/lib/types";

const PRESET_LABELS: { preset: Exclude<GroupingPreset, "custom">; label: string }[] = [
  { preset: "tight", label: "Tight (1s)" },
  { preset: "normal", label: "Normal (3s)" },
  { preset: "loose", label: "Loose (5s)" },
  { preset: "very_loose", label: "Very Loose (10s)" },
];

export function GroupingControls({
  preset,
  rangeSeconds,
  onPresetChange,
  onCustomChange,
  onRerun,
  isRunning,
}: {
  preset: GroupingPreset;
  rangeSeconds: number;
  onPresetChange: (preset: GroupingPreset) => void;
  onCustomChange: (seconds: number) => void;
  onRerun: () => void;
  isRunning: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-xs font-medium text-muted-foreground">Grouping range:</span>
        {PRESET_LABELS.map(({ preset: p, label }) => (
          <button
            key={p}
            onClick={() => onPresetChange(p)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              preset === p ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPresetChange("custom")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              preset === "custom" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            Custom
          </button>
          {preset === "custom" && (
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={rangeSeconds}
              onChange={(e) => onCustomChange(parseFloat(e.target.value) || 0)}
              className="h-7 w-20 rounded-md border border-border bg-background px-2 text-xs"
            />
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Current: {rangeSeconds}s</span>
          <Button size="sm" onClick={onRerun} disabled={isRunning}>
            {isRunning ? "Re-running…" : "Re-run Auto Grouping"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
