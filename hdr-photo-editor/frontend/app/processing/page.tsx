"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GroupStatusBadge, ProcessingStatusBadge } from "@/components/status-badge";
import { useProject } from "@/components/project-context";
import { api, mediaUrl } from "@/lib/api";
import type { Group } from "@/lib/types";

export default function ProcessingPage() {
  const router = useRouter();
  const { projectId } = useProject();
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const loadGroups = React.useCallback(async () => {
    if (!projectId) return;
    const data = await api.listGroups(projectId);
    setGroups(data);
    return data;
  }, [projectId]);

  React.useEffect(() => {
    if (!projectId) {
      router.replace("/");
      return;
    }
    loadGroups()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load groups"))
      .finally(() => setLoading(false));
  }, [projectId, router, loadGroups]);

  React.useEffect(() => {
    const anyActive = groups.some(
      (g) => g.processing_status === "QUEUED" || g.processing_status === "PROCESSING"
    );
    if (anyActive && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadGroups().catch(() => {});
      }, 2000);
    }
    if (!anyActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [groups, loadGroups]);

  async function handleProcessAll() {
    if (!projectId) return;
    setError(null);
    try {
      const updated = await api.processAll(projectId);
      setGroups(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue processing");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const processable = groups.filter((g) => g.status !== "NEEDS_REVIEW");
  const done = processable.filter((g) => g.processing_status === "DONE").length;
  const failed = processable.filter((g) => g.processing_status === "FAILED").length;
  const progressPct = processable.length ? (done / processable.length) * 100 : 0;
  const needsReviewCount = groups.length - processable.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HDR processing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            HDR Ready groups are aligned, exposure-fused, and auto-edited. Single Edit photos get the
            same auto-edit without a merge.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleProcessAll}>
            Process all ready groups
          </Button>
          <Button size="sm" variant="secondary" onClick={() => router.push("/preview")}>
            Go to preview →
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              {done} / {processable.length} processed
              {failed > 0 && <span className="text-destructive"> · {failed} failed</span>}
            </span>
            {needsReviewCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {needsReviewCount} group(s) still need review before they can be processed
              </span>
            )}
          </div>
          <Progress value={progressPct} />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardContent className="flex items-center gap-4 p-3">
              {group.output_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(group.output_thumbnail_url) ?? undefined}
                  alt={`Group ${group.number} result`}
                  className="h-14 w-20 rounded object-cover"
                />
              ) : (
                <div className="flex h-14 w-20 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  pending
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Group {group.number}</span>
                  <GroupStatusBadge status={group.status} />
                </div>
                <p className="text-xs text-muted-foreground">{group.photo_count} photo(s)</p>
                {group.processing_error && (
                  <p className="text-xs text-destructive">{group.processing_error}</p>
                )}
              </div>
              <ProcessingStatusBadge status={group.processing_status} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
