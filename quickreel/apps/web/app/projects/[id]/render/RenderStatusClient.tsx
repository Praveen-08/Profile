"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film } from "lucide-react";
import { api, type RenderSummary } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const STAGE_PROGRESS: Record<string, number> = {
  QUEUED: 8,
  RESOLVING_EDL: 25,
  RENDERING: 65,
  MUXING: 82,
  UPLOADING: 92,
  COMPLETE: 100,
  FAILED: 100,
};

const STAGE_LABEL: Record<string, string> = {
  QUEUED: "Queued for rendering…",
  RESOLVING_EDL: "The AI Director is planning your edit…",
  RENDERING: "Rendering your cinematic reel…",
  MUXING: "Mixing in the soundtrack…",
  UPLOADING: "Finalizing your reel…",
  COMPLETE: "Done!",
  FAILED: "Something went wrong.",
};

export function RenderStatusClient({ token, projectId }: { token: string; projectId: string }) {
  const router = useRouter();
  const [render, setRender] = useState<RenderSummary | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const latest = await api.getLatestRender(token, projectId);
        if (cancelled) return;
        setRender(latest);
        if (latest.status === "COMPLETE") {
          router.push(`/projects/${projectId}/download`);
          return;
        }
        if (latest.status !== "FAILED") {
          setTimeout(poll, 2000);
        }
      } catch {
        setTimeout(poll, 2000);
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [token, projectId, router]);

  async function retry() {
    setRetrying(true);
    await api.createRender(token, projectId);
    setRetrying(false);
  }

  const status = render?.status ?? "QUEUED";

  return (
    <div className="w-full">
      <Film className="mx-auto mb-6 h-10 w-10 text-accent" />
      <h1 className="font-serif text-2xl font-semibold">{STAGE_LABEL[status] ?? status}</h1>
      <p className="mt-2 text-sm text-muted">This usually takes under a minute.</p>
      <Progress value={STAGE_PROGRESS[status] ?? 5} className="mt-8" />

      {status === "FAILED" && (
        <div className="mt-6">
          {render?.errorMessage && <p className="mb-4 text-sm text-red-400">{render.errorMessage}</p>}
          <Button onClick={retry} disabled={retrying}>
            {retrying ? "Retrying…" : "Try Again"}
          </Button>
        </div>
      )}
    </div>
  );
}
