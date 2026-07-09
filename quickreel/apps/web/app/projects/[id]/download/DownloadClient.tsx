"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DownloadClient({
  videoUrl,
  durationSec,
  projectId,
}: {
  videoUrl: string;
  durationSec: number | null;
  projectId: string;
}) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Your reel is ready</h1>
      <p className="mt-1 text-muted">{durationSec ? `${Math.round(durationSec)}s` : ""} · 1080×1920 · MP4</p>

      <div className="mx-auto mt-8 aspect-[9/16] w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-black">
        <video src={videoUrl} controls playsInline className="h-full w-full object-contain" />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <a href={videoUrl} download>
          <Button size="lg" className="w-full">
            <Download className="h-4 w-4" /> Download MP4
          </Button>
        </a>
        <Link href={`/projects/${projectId}/configure`}>
          <Button size="lg" variant="secondary" className="w-full">
            Regenerate with a different style
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button size="lg" variant="ghost" className="w-full">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
