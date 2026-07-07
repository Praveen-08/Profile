import type { Group, Project } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return `${API_BASE_URL}${path}`;
}

export const api = {
  createProject(name: string) {
    return request<Project>(`/api/projects?name=${encodeURIComponent(name)}`, { method: "POST" });
  },

  getProject(projectId: string) {
    return request<Project>(`/api/projects/${projectId}`);
  },

  uploadPhotos(projectId: string, files: File[]) {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return request<Group[]>(`/api/projects/${projectId}/upload`, {
      method: "POST",
      body: form,
    });
  },

  listGroups(projectId: string) {
    return request<Group[]>(`/api/projects/${projectId}/groups`);
  },

  rerunGrouping(projectId: string, rangeSeconds: number) {
    return request<Group[]>(`/api/projects/${projectId}/groups/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ range_seconds: rangeSeconds }),
    });
  },

  splitGroup(projectId: string, groupId: string, photoIds: string[]) {
    return request<Group[]>(`/api/projects/${projectId}/groups/${groupId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_ids: photoIds }),
    });
  },

  mergeGroups(projectId: string, groupIds: string[]) {
    return request<Group>(`/api/projects/${projectId}/groups/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_ids: groupIds }),
    });
  },

  movePhoto(projectId: string, photoId: string, targetGroupId: string | null) {
    return request<Group[]>(`/api/projects/${projectId}/groups/move-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photoId, target_group_id: targetGroupId }),
    });
  },

  removePhoto(projectId: string, groupId: string, photoId: string) {
    return request<Group[]>(`/api/projects/${projectId}/groups/${groupId}/remove-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photoId }),
    });
  },

  processGroup(projectId: string, groupId: string) {
    return request<Group>(`/api/projects/${projectId}/groups/${groupId}/process`, {
      method: "POST",
    });
  },

  processAll(projectId: string) {
    return request<Group[]>(`/api/projects/${projectId}/process-all`, {
      method: "POST",
    });
  },

  getGroup(projectId: string, groupId: string) {
    return request<Group>(`/api/projects/${projectId}/groups/${groupId}`);
  },

  downloadGroupUrl(projectId: string, groupId: string) {
    return `${API_BASE_URL}/api/projects/${projectId}/groups/${groupId}/download`;
  },

  exportAllUrl(projectId: string) {
    return `${API_BASE_URL}/api/projects/${projectId}/export`;
  },
};
