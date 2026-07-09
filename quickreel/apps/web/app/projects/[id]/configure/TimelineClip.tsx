"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock, Sparkles as SparklesIcon } from "lucide-react";
import { ROOM_TYPE_LABELS, type RoomType } from "@quickreel/shared";
import { api, type CameraMovementSummary, type ProjectImageSummary } from "@/lib/api";

export function TimelineClip({
  token,
  projectId,
  image,
  movementLabel,
  isOverride,
  movements,
  onChanged,
}: {
  token: string;
  projectId: string;
  image: ProjectImageSummary;
  movementLabel: string;
  isOverride: boolean;
  movements: CameraMovementSummary[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const roomType = image.roomType as RoomType | null;
  const preferred = movements.filter((m) => roomType && m.preferredRoomTypes.includes(roomType));
  const preferredTypes = new Set(preferred.map((m) => m.type));
  const others = movements.filter((m) => !preferredTypes.has(m.type));

  async function choose(type: string | null) {
    setSaving(true);
    try {
      await api.setCameraMoveOverride(token, projectId, image.id, type);
      onChanged();
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative flex-shrink-0">
      <div className="relative h-28 w-20 overflow-hidden rounded-lg border border-border">
        <Image src={image.url} alt="" fill className="object-cover" unoptimized />
        {image.isHero && (
          <span className="absolute left-1 top-1 rounded bg-accent px-1 text-[9px] font-bold text-black">HERO</span>
        )}
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-[9px] text-white">
          {roomType ? ROOM_TYPE_LABELS[roomType] : "—"}
        </span>
        {saving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white">Saving…</div>
        )}
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex w-20 items-center gap-1 truncate rounded border border-border bg-surface px-1.5 py-1 text-left text-[10px] text-muted hover:border-accent/50"
      >
        {isOverride && <Lock className="h-2.5 w-2.5 flex-shrink-0 text-accent" />}
        <span className="truncate">{movementLabel}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-border bg-surface-2 p-2 shadow-xl">
            <button
              onClick={() => choose(null)}
              className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-surface"
            >
              <SparklesIcon className="h-3 w-3" /> AI decides
            </button>
            {preferred.length > 0 && (
              <>
                <p className="px-2 pt-1 text-[10px] uppercase tracking-wide text-muted">Suggested for this room</p>
                {preferred.map((m) => (
                  <button
                    key={m.type}
                    onClick={() => choose(m.type)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface"
                  >
                    {m.label}
                  </button>
                ))}
              </>
            )}
            <p className="px-2 pt-2 text-[10px] uppercase tracking-wide text-muted">All movements</p>
            {others.map((m) => (
              <button
                key={m.type}
                onClick={() => choose(m.type)}
                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface"
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
