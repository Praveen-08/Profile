"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { type RenderExportSummary, type RenderSummary, type ShareLinkSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ExportsPanel } from "./ExportsPanel";
import { ReelScoreCard } from "./ReelScoreCard";
import { SharePanel } from "./SharePanel";
import { SmartRegeneratePanel } from "./SmartRegeneratePanel";

export function DownloadClient({
  token,
  projectId,
  versionId,
  render,
  initialExports,
  initialShareLinks,
}: {
  token: string;
  projectId: string;
  versionId: string;
  render: RenderSummary;
  initialExports: RenderExportSummary[];
  initialShareLinks: ShareLinkSummary[];
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-semibold">Your reel is ready</h1>
        <p className="mt-1 text-muted">
          {render.outputDurationSec ? `${Math.round(render.outputDurationSec)}s` : ""} · 1080×1920 · MP4
        </p>

        <div className="mx-auto mt-8 aspect-[9/16] w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-black">
          <video src={render.outputUrl ?? undefined} controls playsInline className="h-full w-full object-contain" />
        </div>

        <div className="mx-auto mt-8 flex max-w-xs flex-col gap-3">
          <a href={render.outputUrl ?? undefined} download>
            <Button size="lg" className="w-full">
              <Download className="h-4 w-4" /> Download MP4
            </Button>
          </a>
          <Link href={`/projects/${projectId}/configure?version=${versionId}`}>
            <Button size="lg" variant="secondary" className="w-full">
              Edit this version
            </Button>
          </Link>
          <Link href={`/projects/${projectId}`}>
            <Button size="lg" variant="ghost" className="w-full">
              Back to Project
            </Button>
          </Link>
        </div>
      </div>

      {render.scoreJson && <ReelScoreCard score={render.scoreJson} />}

      <SmartRegeneratePanel token={token} projectId={projectId} versionId={versionId} />

      <ExportsPanel token={token} projectId={projectId} renderId={render.id} initialExports={initialExports} />

      <SharePanel token={token} projectId={projectId} renderId={render.id} initialShareLinks={initialShareLinks} />
    </div>
  );
}
