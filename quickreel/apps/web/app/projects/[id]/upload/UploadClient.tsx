"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { api, type ProjectImageSummary } from "@/lib/api";
import { uploadProjectImage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const MIN_IMAGES = 5;
const MAX_IMAGES = 30;

export function UploadClient({
  token,
  projectId,
  initialImages,
  status,
}: {
  token: string;
  projectId: string;
  initialImages: ProjectImageSummary[];
  status: string;
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(status === "ANALYZING");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      const remaining = MAX_IMAGES - images.length;
      const toUpload = Array.from(files).slice(0, Math.max(0, remaining));
      if (toUpload.length === 0) return;

      setUploading(true);
      try {
        for (const file of toUpload) {
          const image = await uploadProjectImage(token, projectId, file);
          setImages((prev) => [...prev, image]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [images.length, projectId, token],
  );

  async function removeImage(imageId: string) {
    setImages((prev) => prev.filter((i) => i.id !== imageId));
    await api.deleteImage(token, projectId, imageId).catch(() => undefined);
  }

  async function startAnalysis() {
    setError(null);
    setAnalyzing(true);
    try {
      await api.analyzeProject(token, projectId);
      await pollUntilReady();
      router.push(`/projects/${projectId}/configure`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setAnalyzing(false);
    }
  }

  async function pollUntilReady(): Promise<void> {
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const project = await api.getProject(token, projectId);
      if (project.status === "READY") return;
      if (project.status === "FAILED") throw new Error("Analysis failed — please try again.");
    }
  }

  const canAnalyze = images.length >= MIN_IMAGES && images.length <= MAX_IMAGES && !uploading && !analyzing;

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Upload Photos</h1>
      <p className="mt-1 text-muted">
        Upload {MIN_IMAGES}–{MAX_IMAGES} professionally edited JPGs. The AI Director will detect rooms, remove
        duplicates, and build the story order.
      </p>

      <Card
        className="mt-6 flex flex-col items-center justify-center gap-3 border-dashed p-10 text-center transition-colors hover:border-accent/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="h-8 w-8 text-muted" />
        <p className="text-sm text-muted">Drag and drop photos here, or</p>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : "Choose files"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </Card>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        <AnimatePresence>
          {images.map((image) => (
            <motion.div
              key={image.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border"
            >
              <Image src={image.url} alt={image.originalFilename} fill className="object-cover" unoptimized />
              <button
                onClick={() => removeImage(image.id)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <span className="text-sm text-muted">
          {images.length} / {MAX_IMAGES} photos {images.length < MIN_IMAGES && `(minimum ${MIN_IMAGES})`}
        </span>
        <Button onClick={startAnalysis} disabled={!canAnalyze} size="lg">
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing photos…
            </>
          ) : (
            "Analyze Photos"
          )}
        </Button>
      </div>
    </div>
  );
}
