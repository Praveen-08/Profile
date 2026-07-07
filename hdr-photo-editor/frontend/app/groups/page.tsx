"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GroupingControls } from "@/components/grouping-controls";
import { GroupCard } from "@/components/group-card";
import { useProject } from "@/components/project-context";
import { api } from "@/lib/api";
import { GROUPING_PRESET_SECONDS, type Group, type GroupingPreset } from "@/lib/types";

function pollGroupUntilSettled(
  projectId: string,
  groupId: string,
  onUpdate: (group: Group) => void
) {
  const interval = setInterval(async () => {
    try {
      const group = await api.getGroup(projectId, groupId);
      onUpdate(group);
      if (group.processing_status === "DONE" || group.processing_status === "FAILED") {
        clearInterval(interval);
      }
    } catch {
      clearInterval(interval);
    }
  }, 1500);
  return interval;
}

export default function GroupsPage() {
  const router = useRouter();
  const { projectId } = useProject();

  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [preset, setPreset] = React.useState<GroupingPreset>("normal");
  const [rangeSeconds, setRangeSeconds] = React.useState(3);
  const [isRerunning, setIsRerunning] = React.useState(false);

  const [mergeMode, setMergeMode] = React.useState(false);
  const [mergeSelection, setMergeSelection] = React.useState<Set<string>>(new Set());

  const [splitGroupId, setSplitGroupId] = React.useState<string | null>(null);
  const [splitSelection, setSplitSelection] = React.useState<Set<string>>(new Set());

  const [processingIds, setProcessingIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!projectId) {
      router.replace("/");
      return;
    }
    api
      .listGroups(projectId)
      .then(setGroups)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load groups"))
      .finally(() => setLoading(false));
  }, [projectId, router]);

  function updateGroupInPlace(updated: Group) {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  function handlePresetChange(next: GroupingPreset) {
    setPreset(next);
    if (next !== "custom") setRangeSeconds(GROUPING_PRESET_SECONDS[next]);
  }

  async function handleRerun() {
    if (!projectId) return;
    setIsRerunning(true);
    setError(null);
    try {
      const updated = await api.rerunGrouping(projectId, rangeSeconds);
      setGroups(updated);
      setMergeMode(false);
      setMergeSelection(new Set());
      setSplitGroupId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-run grouping");
    } finally {
      setIsRerunning(false);
    }
  }

  async function handleProcess(groupId: string) {
    if (!projectId) return;
    setProcessingIds((prev) => new Set(prev).add(groupId));
    try {
      const group = await api.processGroup(projectId, groupId);
      updateGroupInPlace(group);
      pollGroupUntilSettled(projectId, groupId, (g) => {
        updateGroupInPlace(g);
        if (g.processing_status === "DONE" || g.processing_status === "FAILED") {
          setProcessingIds((prev) => {
            const next = new Set(prev);
            next.delete(groupId);
            return next;
          });
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start processing");
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }

  async function handleProcessAll() {
    if (!projectId) return;
    try {
      const updated = await api.processAll(projectId);
      setGroups(updated);
      for (const g of updated) {
        if (g.processing_status === "QUEUED" || g.processing_status === "PROCESSING") {
          setProcessingIds((prev) => new Set(prev).add(g.id));
          pollGroupUntilSettled(projectId, g.id, (updatedGroup) => {
            updateGroupInPlace(updatedGroup);
            if (updatedGroup.processing_status === "DONE" || updatedGroup.processing_status === "FAILED") {
              setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(g.id);
                return next;
              });
            }
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue processing");
    }
  }

  async function handleDropPhoto(targetGroupId: string, photoId: string) {
    if (!projectId) return;
    try {
      const updated = await api.movePhoto(projectId, photoId, targetGroupId);
      setGroups(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move photo");
    }
  }

  async function handleRemovePhoto(groupId: string, photoId: string) {
    if (!projectId) return;
    try {
      const updated = await api.removePhoto(projectId, groupId, photoId);
      setGroups(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photo");
    }
  }

  function toggleMergeSelect(groupId: string) {
    setMergeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function handleConfirmMerge() {
    if (!projectId || mergeSelection.size < 2) return;
    try {
      await api.mergeGroups(projectId, Array.from(mergeSelection));
      const refreshed = await api.listGroups(projectId);
      setGroups(refreshed);
      setMergeMode(false);
      setMergeSelection(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge groups");
    }
  }

  function toggleSplitSelect(photoId: string) {
    setSplitSelection((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  async function handleConfirmSplit(groupId: string) {
    if (!projectId || splitSelection.size === 0) return;
    try {
      const updated = await api.splitGroup(projectId, groupId, Array.from(splitSelection));
      setGroups((prev) => {
        const map = new Map(prev.map((g) => [g.id, g]));
        for (const g of updated) map.set(g.id, g);
        return Array.from(map.values()).sort((a, b) => a.number - b.number);
      });
      setSplitGroupId(null);
      setSplitSelection(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to split group");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading groups…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auto grouping review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Photos are grouped by capture time and sorted darkest → brightest within each group.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mergeMode ? "default" : "outline"}
            onClick={() => {
              setMergeMode((m) => !m);
              setMergeSelection(new Set());
            }}
          >
            {mergeMode ? "Cancel merge" : "Merge groups"}
          </Button>
          {mergeMode && (
            <Button size="sm" onClick={handleConfirmMerge} disabled={mergeSelection.size < 2}>
              Merge {mergeSelection.size || ""} selected
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleProcessAll}>
            Process all ready groups
          </Button>
          <Button size="sm" onClick={() => router.push("/processing")}>
            Go to processing →
          </Button>
        </div>
      </div>

      <GroupingControls
        preset={preset}
        rangeSeconds={rangeSeconds}
        onPresetChange={handlePresetChange}
        onCustomChange={setRangeSeconds}
        onRerun={handleRerun}
        isRunning={isRerunning}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              mergeMode={mergeMode}
              mergeSelected={mergeSelection.has(group.id)}
              onToggleMergeSelect={toggleMergeSelect}
              splitMode={splitGroupId === group.id}
              splitSelection={splitSelection}
              onToggleSplitSelect={toggleSplitSelect}
              onStartSplit={(groupId) => {
                setSplitGroupId(groupId);
                setSplitSelection(new Set());
              }}
              onConfirmSplit={handleConfirmSplit}
              onCancelSplit={() => {
                setSplitGroupId(null);
                setSplitSelection(new Set());
              }}
              onRemovePhoto={handleRemovePhoto}
              onProcess={handleProcess}
              onDropPhoto={handleDropPhoto}
              onDragPhotoStart={() => {}}
              isProcessing={processingIds.has(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
