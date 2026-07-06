"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProject } from "@/components/project-context";
import { api, mediaUrl } from "@/lib/api";
import type { Group } from "@/lib/types";

export default function ExportPage() {
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
  if (!projectId) return null;

  const done = groups.filter((g) => g.processing_status === "DONE");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Export & download</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            High-quality JPEGs, ready for MLS or listing sites.
          </p>
        </div>
        <a href={api.exportAllUrl(projectId)}>
          <Button size="sm" disabled={done.length === 0}>
            Download all ({done.length}) as ZIP
          </Button>
        </a>
      </div>

      {done.length === 0 ? (
        <p className="text-sm text-muted-foreground">No processed images are ready yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {done.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle>Group {group.number}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {group.output_thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(group.output_thumbnail_url) ?? undefined}
                    alt={`Group ${group.number} edited result`}
                    className="aspect-[3/2] w-full rounded-md object-cover"
                  />
                )}
                <a href={api.downloadGroupUrl(projectId, group.id)}>
                  <Button size="sm" variant="outline" className="w-full">
                    Download JPEG
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
