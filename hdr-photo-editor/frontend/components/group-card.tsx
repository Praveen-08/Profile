"use client";

import * as React from "react";
import { GripVertical, X } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GroupStatusBadge, ProcessingStatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { formatShutter, formatTime } from "@/lib/utils";
import { mediaUrl } from "@/lib/api";
import type { Group } from "@/lib/types";

interface GroupCardProps {
  group: Group;
  mergeMode: boolean;
  mergeSelected: boolean;
  onToggleMergeSelect: (groupId: string) => void;
  splitMode: boolean;
  splitSelection: Set<string>;
  onToggleSplitSelect: (photoId: string) => void;
  onStartSplit: (groupId: string) => void;
  onConfirmSplit: (groupId: string) => void;
  onCancelSplit: () => void;
  onRemovePhoto: (groupId: string, photoId: string) => void;
  onProcess: (groupId: string) => void;
  onDropPhoto: (groupId: string, photoId: string) => void;
  onDragPhotoStart: (photoId: string, sourceGroupId: string) => void;
  isProcessing: boolean;
}

export function GroupCard({
  group,
  mergeMode,
  mergeSelected,
  onToggleMergeSelect,
  splitMode,
  splitSelection,
  onToggleSplitSelect,
  onStartSplit,
  onConfirmSplit,
  onCancelSplit,
  onRemovePhoto,
  onProcess,
  onDropPhoto,
  onDragPhotoStart,
  isProcessing,
}: GroupCardProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const rangeLabel =
    group.capture_time_start && group.capture_time_end
      ? `${formatTime(group.capture_time_start)} – ${formatTime(group.capture_time_end)}`
      : "--";

  return (
    <Card
      className={cn("flex flex-col", isDragOver && "drag-over")}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const photoId = e.dataTransfer.getData("text/photo-id");
        if (photoId) onDropPhoto(group.id, photoId);
      }}
    >
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            {mergeMode && (
              <input
                type="checkbox"
                checked={mergeSelected}
                onChange={() => onToggleMergeSelect(group.id)}
                className="h-4 w-4"
              />
            )}
            <span className="text-sm font-semibold">Group {group.number}</span>
            <GroupStatusBadge status={group.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {rangeLabel} · {group.photo_count} photo{group.photo_count === 1 ? "" : "s"}
          </p>
        </div>
        <ProcessingStatusBadge status={group.processing_status} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto rounded-md bg-muted/40 p-2">
          {group.photos.map((photo) => (
            <div
              key={photo.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/photo-id", photo.id);
                onDragPhotoStart(photo.id, group.id);
              }}
              className={cn(
                "group relative flex w-24 shrink-0 flex-col items-center gap-1 rounded-md border border-border bg-card p-1",
                splitMode && splitSelection.has(photo.id) && "ring-2 ring-accent"
              )}
            >
              {splitMode && (
                <input
                  type="checkbox"
                  className="absolute left-1 top-1 h-3.5 w-3.5"
                  checked={splitSelection.has(photo.id)}
                  onChange={() => onToggleSplitSelect(photo.id)}
                />
              )}
              <button
                className="absolute right-1 top-1 hidden rounded-full bg-background/80 p-0.5 group-hover:block"
                onClick={() => onRemovePhoto(group.id, photo.id)}
                title="Remove from group"
              >
                <X className="h-3 w-3" />
              </button>
              {photo.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(photo.thumbnail_url) ?? undefined}
                  alt={photo.filename}
                  className="h-16 w-full rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-full items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  no preview
                </div>
              )}
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                {formatShutter(photo.shutter_speed)}
              </span>
              <GripVertical className="h-3 w-3 text-muted-foreground/50" />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Sorted darkest → brightest. Drag a photo onto another group card to move it.</p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {!splitMode ? (
          <>
            <Button
              size="sm"
              onClick={() => onProcess(group.id)}
              disabled={group.status === "NEEDS_REVIEW" || isProcessing}
            >
              Process
            </Button>
            <Button size="sm" variant="outline" onClick={() => onStartSplit(group.id)} disabled={group.photo_count < 2}>
              Split
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => onConfirmSplit(group.id)} disabled={splitSelection.size === 0}>
              Move {splitSelection.size || ""} to new group
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelSplit}>
              Cancel
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
