"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { api, type CommentSummary, type ProjectDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CommentsPanel } from "./CommentsPanel";
import { VersionCard } from "./VersionCard";

export function ProjectHubClient({
  token,
  project,
  initialComments,
}: {
  token: string;
  project: ProjectDetail;
  initialComments: CommentSummary[];
}) {
  const router = useRouter();
  const [versions, setVersions] = useState(project.versions);
  const [creating, setCreating] = useState(false);

  async function refreshVersions() {
    const fresh = await api.listVersions(token, project.id);
    setVersions(fresh);
  }

  async function createVersion() {
    setCreating(true);
    try {
      const version = await api.createVersion(token, project.id, {});
      router.push(`/projects/${project.id}/configure?version=${version.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{project.title || project.address || "Untitled Listing"}</h1>
          <p className="mt-1 text-muted">
            {project.images.filter((i) => !i.isDuplicate).length} photos · {versions.length}{" "}
            {versions.length === 1 ? "version" : "versions"}
          </p>
        </div>
        <Button onClick={createVersion} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Version
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Versions</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">
            No versions yet — every render configuration (style, music, brand kit) lives on a version. Create one to
            get started.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {versions.map((v) => (
              <VersionCard key={v.id} token={token} projectId={project.id} version={v} onChanged={refreshVersions} />
            ))}
          </div>
        )}
      </section>

      <CommentsPanel token={token} projectId={project.id} initialComments={initialComments} />
    </div>
  );
}
