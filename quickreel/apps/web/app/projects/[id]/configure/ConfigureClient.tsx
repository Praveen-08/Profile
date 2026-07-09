"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import {
  MUSIC_VIBES,
  MUSIC_VIBE_LABELS,
  REEL_LENGTH_OPTIONS,
  type MusicVibe,
  type ReelLengthSec,
} from "@quickreel/shared";
import {
  api,
  type BrandKitSummary,
  type CameraMovePreviewEntry,
  type CameraMovementSummary,
  type MusicTrackSummary,
  type ProjectDetail,
  type StyleSummary,
  type VersionSummary,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TimelineClip } from "./TimelineClip";

const HOOK_ARCHETYPE_LABELS: Record<string, string> = {
  BEST_EXTERIOR_QUICK_ZOOM: "Best Exterior, Quick Zoom",
  DRONE_FIRST: "Drone First",
  TWILIGHT_REVEAL: "Twilight Reveal",
  LUXURY_INTERIOR_FIRST: "Luxury Interior First",
  FAST_MONTAGE: "Fast Montage",
};

export function ConfigureClient({
  token,
  project,
  version,
  styles,
  brandKits,
}: {
  token: string;
  project: ProjectDetail;
  version: VersionSummary;
  styles: StyleSummary[];
  brandKits: BrandKitSummary[];
}) {
  const router = useRouter();
  const [versionName, setVersionName] = useState(version.name);
  const [reelLengthSec, setReelLengthSec] = useState<ReelLengthSec>((version.reelLengthSec as ReelLengthSec) ?? 15);
  const [styleId, setStyleId] = useState(version.styleId ?? styles[0]?.id ?? "");
  const [vibe, setVibe] = useState<MusicVibe | null>((version.musicTrack?.vibe as MusicVibe) ?? null);
  const [tracks, setTracks] = useState<MusicTrackSummary[]>([]);
  const [trackId, setTrackId] = useState(version.musicTrackId ?? "");
  const [hookArchetype, setHookArchetype] = useState(version.hookArchetype ?? "");
  const [brandKitId, setBrandKitId] = useState(version.brandKitId ?? "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<CameraMovementSummary[]>([]);
  const [moveSelections, setMoveSelections] = useState<CameraMovePreviewEntry[]>([]);

  useEffect(() => {
    if (!vibe) return;
    api.listMusicTracks(token, vibe).then(setTracks);
  }, [vibe, token]);

  useEffect(() => {
    api.listCameraMovements(token).then(setMovements);
  }, [token]);

  const refreshCameraMoves = useCallback(() => {
    if (!styleId) return;
    api.getCameraMovesPreview(token, project.id, version.id).then(setMoveSelections).catch(() => setMoveSelections([]));
  }, [token, project.id, version.id, styleId]);

  useEffect(() => {
    refreshCameraMoves();
  }, [refreshCameraMoves]);

  const movementByImageId = useMemo(
    () => new Map(moveSelections.map((entry) => [entry.imageId, entry])),
    [moveSelections],
  );
  const movementLabelByType = useMemo(() => new Map(movements.map((m) => [m.type, m.label])), [movements]);

  const orderedImages = useMemo(
    () => [...project.images].filter((i) => !i.isDuplicate).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [project.images],
  );

  const estimatedRenderSeconds = 25 + orderedImages.length * 1.2;

  const canGenerate = Boolean(styleId && trackId && reelLengthSec) && !generating;

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      await api.updateVersion(token, project.id, version.id, {
        name: versionName,
        reelLengthSec,
        styleId,
        musicTrackId: trackId,
        hookArchetype: hookArchetype || undefined,
        brandKitId: brandKitId || null,
      });
      await api.createRender(token, project.id, version.id);
      router.push(`/projects/${project.id}/versions/${version.id}/render`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start render");
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <input
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          className="w-full bg-transparent font-serif text-3xl font-semibold outline-none focus:underline"
        />
        <p className="mt-1 text-muted">Review the story order, pick a style and music vibe, then generate.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Reel Length</h2>
        <div className="flex gap-3">
          {REEL_LENGTH_OPTIONS.map((len) => (
            <button
              key={len}
              onClick={() => setReelLengthSec(len)}
              className={cn(
                "rounded-xl border px-5 py-3 text-sm font-medium transition-colors",
                reelLengthSec === len ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
              )}
            >
              {len}s
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Style</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => setStyleId(style.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                styleId === style.id ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40",
              )}
            >
              <p className="font-medium">{style.name}</p>
              {style.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{style.description}</p>}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Music Vibe</h2>
        <div className="flex flex-wrap gap-2">
          {MUSIC_VIBES.map((v) => (
            <button
              key={v}
              onClick={() => setVibe(v)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                vibe === v ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
              )}
            >
              {MUSIC_VIBE_LABELS[v]}
            </button>
          ))}
        </div>

        {tracks.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tracks.map((track) => (
              <button
                key={track.id}
                onClick={() => setTrackId(track.id)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
                  trackId === track.id ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40",
                )}
              >
                <div>
                  <p className="text-sm font-medium">{track.title}</p>
                  <p className="text-xs text-muted">
                    {track.genre} · {track.mood}
                  </p>
                </div>
                <Badge>{Math.round(track.bpm)} BPM</Badge>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Opening Hook</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setHookArchetype("")}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              hookArchetype === "" ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
            )}
          >
            AI decides
          </button>
          {Object.entries(HOOK_ARCHETYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setHookArchetype(key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                hookArchetype === key ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {brandKits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Brand Kit</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBrandKitId("")}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                brandKitId === "" ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
              )}
            >
              None
            </button>
            {brandKits.map((kit) => (
              <button
                key={kit.id}
                onClick={() => setBrandKitId(kit.id)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  brandKitId === kit.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
                )}
              >
                {kit.name}
                {kit.isDefault && " · default"}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Story Timeline · {orderedImages.length} clips
        </h2>
        <p className="mb-3 text-xs text-muted">
          Every clip shows the camera movement the AI assigned. Click a movement to replace it — replacing locks it in
          for future renders, even after you change other settings.
        </p>
        {!styleId ? (
          <p className="text-sm text-muted">Pick a style above to see (and edit) each clip&apos;s camera movement.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {orderedImages.map((image, index) => {
              const selection = movementByImageId.get(image.id);
              const movementLabel = selection
                ? (movementLabelByType.get(selection.movementType) ?? selection.movementType)
                : "…";
              return (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <TimelineClip
                    token={token}
                    projectId={project.id}
                    image={image}
                    movementLabel={movementLabel}
                    isOverride={selection?.isOverride ?? false}
                    movements={movements}
                    onChanged={refreshCameraMoves}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <Card className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted">Estimated render time</p>
          <p className="text-lg font-medium">~{Math.round(estimatedRenderSeconds)} seconds</p>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-400">{error}</span>}
          <Button size="lg" onClick={handleGenerate} disabled={!canGenerate}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate Reel
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
