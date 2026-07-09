"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { SMART_REGENERATE_DIRECTIVE_LABELS } from "@quickreel/shared";
import { api, type VersionSummary } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_TONE: Record<string, string> = {
  COMPLETE: "text-accent",
  FAILED: "text-red-400",
};

export function VersionCard({
  token,
  projectId,
  version,
  onChanged,
}: {
  token: string;
  projectId: string;
  version: VersionSummary;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"duplicate" | "delete" | null>(null);
  const render = version.latestRender;

  async function duplicate() {
    setBusy("duplicate");
    try {
      await api.duplicateVersion(token, projectId, version.id);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete version "${version.name}"? This cannot be undone.`)) return;
    setBusy("delete");
    try {
      await api.deleteVersion(token, projectId, version.id);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[9/16] w-full bg-black">
        {render?.outputUrl ? (
          <video src={render.outputUrl} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted">No render yet</div>
        )}
        {render && (
          <span className={`absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[render.status] ?? "text-white"}`}>
            {render.status}
          </span>
        )}
        {render?.scoreJson && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {render.scoreJson.overallScore}
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="truncate font-medium">{version.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {version.style?.name ?? "No style"} · {version.reelLengthSec ? `${version.reelLengthSec}s` : "—"}
        </p>
        {version.regenerateDirective && (
          <Badge className="mt-2">
            {SMART_REGENERATE_DIRECTIVE_LABELS[version.regenerateDirective as keyof typeof SMART_REGENERATE_DIRECTIVE_LABELS] ??
              version.regenerateDirective}
          </Badge>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/projects/${projectId}/configure?version=${version.id}`}>
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          </Link>
          {render?.status === "COMPLETE" && (
            <Link href={`/projects/${projectId}/versions/${version.id}/download`}>
              <Button size="sm">View</Button>
            </Link>
          )}
          {render && render.status !== "COMPLETE" && render.status !== "FAILED" && (
            <Link href={`/projects/${projectId}/versions/${version.id}/render`}>
              <Button size="sm" variant="secondary">
                Watch progress
              </Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={duplicate} disabled={busy !== null}>
            {busy === "duplicate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} disabled={busy !== null}>
            {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
