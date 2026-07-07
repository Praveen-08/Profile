"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { useProject } from "@/components/project-context";
import { api } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const { projectId, setProjectId } = useProject();
  const [projectName, setProjectName] = React.useState("New Listing");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleUpload() {
    if (files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      let currentProjectId = projectId;
      if (!currentProjectId) {
        const project = await api.createProject(projectName || "New Listing");
        currentProjectId = project.id;
        setProjectId(project.id);
      }
      await api.uploadPhotos(currentProjectId, files);
      router.push("/groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function startNewProject() {
    setProjectId(null);
    setFiles([]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload real estate photos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload every bracketed exposure for the shoot. The app groups them automatically by EXIF
          capture time on the next step.
        </p>
      </div>

      {projectId && (
        <Card className="border-accent/50 bg-muted/40">
          <CardContent className="flex items-center justify-between p-4 text-sm">
            <span>
              Continuing project <span className="font-mono text-xs">{projectId}</span>
            </span>
            <button className="text-xs underline" onClick={startNewProject}>
              Start a new project instead
            </button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>Give this shoot a name (e.g. the listing address)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!projectId && (
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="123 Main St"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          )}

          <UploadDropzone files={files} onFilesChange={setFiles} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button disabled={files.length === 0 || isUploading} onClick={handleUpload}>
              {isUploading ? "Uploading…" : `Upload ${files.length || ""} photo(s) & continue`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
