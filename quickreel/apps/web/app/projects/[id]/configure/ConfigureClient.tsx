"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import {
  MUSIC_VIBES,
  MUSIC_VIBE_LABELS,
  REEL_LENGTH_OPTIONS,
  ROOM_TYPE_LABELS,
  type MusicVibe,
  type ReelLengthSec,
  type RoomType,
} from "@quickreel/shared";
import { api, type MusicTrackSummary, type ProjectDetail, type StyleSummary } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  styles,
}: {
  token: string;
  project: ProjectDetail;
  styles: StyleSummary[];
}) {
  const router = useRouter();
  const [reelLengthSec, setReelLengthSec] = useState<ReelLengthSec>((project.reelLengthSec as ReelLengthSec) ?? 15);
  const [styleId, setStyleId] = useState(project.styleId ?? styles[0]?.id ?? "");
  const [vibe, setVibe] = useState<MusicVibe | null>((project.musicTrack?.vibe as MusicVibe) ?? null);
  const [tracks, setTracks] = useState<MusicTrackSummary[]>([]);
  const [trackId, setTrackId] = useState(project.musicTrackId ?? "");
  const [hookArchetype, setHookArchetype] = useState(project.hookArchetype ?? "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vibe) return;
    api.listMusicTracks(token, vibe).then(setTracks);
  }, [vibe, token]);

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
      await api.updateProject(token, project.id, {
        reelLengthSec,
        styleId,
        musicTrackId: trackId,
        hookArchetype: hookArchetype || undefined,
      });
      await api.createRender(token, project.id);
      router.push(`/projects/${project.id}/render`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start render");
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold">AI Preview</h1>
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

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Story Timeline · {orderedImages.length} clips
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {orderedImages.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.02 }}
              className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border"
            >
              <Image src={image.url} alt="" fill className="object-cover" unoptimized />
              {image.isHero && (
                <span className="absolute left-1 top-1 rounded bg-accent px-1 text-[9px] font-bold text-black">HERO</span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-[9px] text-white">
                {image.roomType ? ROOM_TYPE_LABELS[image.roomType as RoomType] : "—"}
              </span>
            </motion.div>
          ))}
        </div>
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
