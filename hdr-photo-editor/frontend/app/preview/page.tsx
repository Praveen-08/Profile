"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { GroupStatusBadge } from "@/components/status-badge";
import { useProject } from "@/components/project-context";
import { api, mediaUrl } from "@/lib/api";
import type { Group } from "@/lib/types";

export default function PreviewPage() {
  const router = useRouter();
  const { projectId } = useProject();
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!projectId) {
      router.replace("/");
      return;
    }
    api
      .listGroups(projectId)
      .then(setGroups)
      .finally(() => setLoading(false));
  }, [projectId, router]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const done = groups.filter((g) => g.processing_status === "DONE" && g.output_thumbnail_url);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Before / after preview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag the slider to compare the original exposure against the finished edit.
          </p>
        </div>
        <Button size="sm" onClick={() => router.push("/export")}>
          Go to export →
        </Button>
      </div>

      {done.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No processed groups yet. Head back to the processing step first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {done.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Group {group.number}</CardTitle>
                  <GroupStatusBadge status={group.status} />
                </div>
              </CardHeader>
              <CardContent>
                <BeforeAfterSlider
                  beforeUrl={mediaUrl(group.before_preview_url) ?? ""}
                  afterUrl={mediaUrl(group.output_thumbnail_url) ?? ""}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
