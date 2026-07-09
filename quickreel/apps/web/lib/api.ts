const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, token: string | undefined, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(response.status, body || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface StyleSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
}

export interface MusicTrackSummary {
  id: string;
  slug: string;
  vibe: string;
  title: string;
  genre: string | null;
  mood: string | null;
  bpm: number;
  energy: number;
  durationSec: number;
}

export interface ProjectImageSummary {
  id: string;
  url: string;
  originalFilename: string;
  roomType: string | null;
  qualityScore: number | null;
  isDuplicate: boolean;
  isHero: boolean;
  isSecondHero: boolean;
  orderIndex: number | null;
}

export interface ProjectSummary {
  id: string;
  title: string | null;
  address: string | null;
  bedCount: number | null;
  bathCount: number | null;
  status: string;
  reelLengthSec: number | null;
  styleId: string | null;
  musicTrackId: string | null;
  hookArchetype: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  images: ProjectImageSummary[];
  style: StyleSummary | null;
  musicTrack: MusicTrackSummary | null;
  renders: RenderSummary[];
}

export interface RenderSummary {
  id: string;
  status: string;
  outputStorageKey: string | null;
  outputUrl: string | null;
  outputDurationSec: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const api = {
  listStyles: (token?: string) => apiFetch<StyleSummary[]>("/styles", token),
  listMusicTracks: (token: string | undefined, vibe?: string) =>
    apiFetch<MusicTrackSummary[]>(`/music-tracks${vibe ? `?vibe=${vibe}` : ""}`, token),

  listProjects: (token: string) => apiFetch<ProjectSummary[]>("/projects", token),
  createProject: (token: string, body: { title?: string; address?: string; bedCount?: number; bathCount?: number }) =>
    apiFetch<ProjectSummary>("/projects", token, { method: "POST", body: JSON.stringify(body) }),
  getProject: (token: string, id: string) => apiFetch<ProjectDetail>(`/projects/${id}`, token),
  updateProject: (
    token: string,
    id: string,
    body: Partial<{
      title: string;
      address: string;
      bedCount: number;
      bathCount: number;
      reelLengthSec: number;
      styleId: string;
      musicTrackId: string;
      hookArchetype: string;
    }>,
  ) => apiFetch<ProjectSummary>(`/projects/${id}`, token, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProject: (token: string, id: string) => apiFetch<void>(`/projects/${id}`, token, { method: "DELETE" }),

  presignImage: (token: string, projectId: string, body: { filename: string; contentType: string }) =>
    apiFetch<{ storageKey: string; upload: { url: string; method: "PUT"; headers?: Record<string, string> } }>(
      `/projects/${projectId}/images/presign`,
      token,
      { method: "POST", body: JSON.stringify(body) },
    ),
  completeImage: (
    token: string,
    projectId: string,
    body: { storageKey: string; originalFilename: string; width?: number; height?: number },
  ) =>
    apiFetch<ProjectImageSummary>(`/projects/${projectId}/images/complete`, token, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteImage: (token: string, projectId: string, imageId: string) =>
    apiFetch<void>(`/projects/${projectId}/images/${imageId}`, token, { method: "DELETE" }),

  analyzeProject: (token: string, projectId: string) =>
    apiFetch<{ queue: string; jobId: string }>(`/projects/${projectId}/analyze`, token, { method: "POST" }),

  createRender: (token: string, projectId: string) =>
    apiFetch<RenderSummary>(`/projects/${projectId}/renders`, token, { method: "POST" }),
  getLatestRender: (token: string, projectId: string) =>
    apiFetch<RenderSummary>(`/projects/${projectId}/renders/latest`, token),
};
