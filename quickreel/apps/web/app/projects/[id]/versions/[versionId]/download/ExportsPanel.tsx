"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  EXPORT_PLATFORMS,
  EXPORT_PLATFORM_LABELS,
  EXPORT_RESOLUTIONS,
  EXPORT_RESOLUTION_LABELS,
  type ExportPlatform,
  type ExportResolution,
} from "@quickreel/shared";
import { api, type RenderExportSummary } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExportsPanel({
  token,
  projectId,
  renderId,
  initialExports,
}: {
  token: string;
  projectId: string;
  renderId: string;
  initialExports: RenderExportSummary[];
}) {
  const [exports, setExports] = useState(initialExports);
  const [platform, setPlatform] = useState<ExportPlatform>(EXPORT_PLATFORMS[0]);
  const [resolution, setResolution] = useState<ExportResolution>(EXPORT_RESOLUTIONS[0]);
  const [creating, setCreating] = useState(false);

  async function createExport() {
    setCreating(true);
    try {
      const exportRow = await api.createExport(token, projectId, renderId, platform, resolution);
      setExports((prev) => [exportRow, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Export</h2>

      <div className="mb-2 flex flex-wrap gap-2">
        {EXPORT_PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              platform === p ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
            )}
          >
            {EXPORT_PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {EXPORT_RESOLUTIONS.map((r) => (
          <button
            key={r}
            onClick={() => setResolution(r)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              resolution === r ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
            )}
          >
            {EXPORT_RESOLUTION_LABELS[r]}
          </button>
        ))}
      </div>

      <Button size="sm" onClick={createExport} disabled={creating} className="w-full">
        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Create Export
      </Button>

      {exports.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {exports.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <span>
                {EXPORT_PLATFORM_LABELS[e.platform as (typeof EXPORT_PLATFORMS)[number]] ?? e.platform} ·{" "}
                {EXPORT_RESOLUTION_LABELS[e.resolution as (typeof EXPORT_RESOLUTIONS)[number]] ?? e.resolution}
              </span>
              {e.status === "COMPLETE" && e.outputUrl ? (
                <a href={e.outputUrl} download className="text-accent hover:underline">
                  Download
                </a>
              ) : (
                <Badge>{e.status}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
