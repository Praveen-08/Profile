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
  fileSizeBytes: number | null;
}

export interface ProjectSummary {
  id: string;
  title: string | null;
  address: string | null;
  bedCount: number | null;
  bathCount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReelScore {
  scoreVersion: string;
  storytellingScore: number;
  beatSyncScore: number;
  luxuryScore: number;
  motionQualityScore: number;
  viewerRetentionPrediction: number;
  socialMediaScore: number;
  overallScore: number;
  recommendations: string[];
}

export interface RenderSummary {
  id: string;
  projectId: string;
  versionId: string;
  status: string;
  outputStorageKey: string | null;
  outputUrl: string | null;
  outputDurationSec: number | null;
  outputFileSizeBytes: number | null;
  scoreJson: ReelScore | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BrandKitSummary {
  id: string;
  name: string;
  isDefault: boolean;
  agencyName: string | null;
  logoStorageKey: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  outroStorageKey: string | null;
  outroUrl: string | null;
  watermarkStorageKey: string | null;
  watermarkUrl: string | null;
  watermarkPosition: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactWebsite: string | null;
}

export interface VersionSummary {
  id: string;
  projectId: string;
  name: string;
  reelLengthSec: number | null;
  styleId: string | null;
  style: StyleSummary | null;
  musicTrackId: string | null;
  musicTrack: MusicTrackSummary | null;
  hookArchetype: string | null;
  brandKitId: string | null;
  brandKit: BrandKitSummary | null;
  parentVersionId: string | null;
  regenerateDirective: string | null;
  createdAt: string;
  updatedAt: string;
  latestRender?: RenderSummary | null;
}

export interface ProjectDetail extends ProjectSummary {
  images: ProjectImageSummary[];
  versions: VersionSummary[];
}

export interface CameraMovementSummary {
  type: string;
  label: string;
  description: string;
  preferredRoomTypes: string[];
}

export interface CameraMovePreviewEntry {
  imageId: string;
  roomType: string;
  movementType: string;
  isOverride: boolean;
}

export interface CommentSummary {
  id: string;
  projectId: string;
  renderId: string | null;
  authorUserId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ShareLinkSummary {
  id: string;
  projectId: string;
  renderId: string;
  token: string;
  approvedAt: string | null;
  approvedByName: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface SharePageData {
  token: string;
  approvedAt: string | null;
  approvedByName: string | null;
  project: { title: string | null; address: string | null };
  render: { id: string; status: string; outputUrl: string | null; outputDurationSec: number | null };
  comments: CommentSummary[];
}

export interface RenderExportSummary {
  id: string;
  renderId: string;
  platform: string;
  resolution: string;
  status: string;
  outputStorageKey: string | null;
  outputUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DashboardData {
  recentReels: {
    renderId: string;
    projectId: string;
    title: string;
    styleName: string | null;
    outputUrl: string | null;
    outputDurationSec: number | null;
    overallScore: number | null;
    completedAt: string | null;
  }[];
  renderingStatus: { renderId: string; projectId: string; title: string; status: string }[];
  storage: { imagesBytes: number; rendersBytes: number };
  favouriteStyles: { name: string; slug: string; count: number }[];
  analytics: { totalProjects: number; totalRenders: number; completedRenders: number };
  brandKit: BrandKitSummary | null;
}

export const api = {
  listStyles: (token?: string) => apiFetch<StyleSummary[]>("/styles", token),
  listMusicTracks: (token: string | undefined, vibe?: string) =>
    apiFetch<MusicTrackSummary[]>(`/music-tracks${vibe ? `?vibe=${vibe}` : ""}`, token),
  listCameraMovements: (token?: string) => apiFetch<CameraMovementSummary[]>("/camera-movements", token),

  getDashboard: (token: string) => apiFetch<DashboardData>("/dashboard", token),

  listProjects: (token: string) => apiFetch<ProjectSummary[]>("/projects", token),
  createProject: (token: string, body: { title?: string; address?: string; bedCount?: number; bathCount?: number }) =>
    apiFetch<ProjectSummary>("/projects", token, { method: "POST", body: JSON.stringify(body) }),
  getProject: (token: string, id: string) => apiFetch<ProjectDetail>(`/projects/${id}`, token),
  updateProject: (
    token: string,
    id: string,
    body: Partial<{ title: string; address: string; bedCount: number; bathCount: number }>,
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
    body: { storageKey: string; originalFilename: string; width?: number; height?: number; fileSizeBytes?: number },
  ) =>
    apiFetch<ProjectImageSummary>(`/projects/${projectId}/images/complete`, token, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteImage: (token: string, projectId: string, imageId: string) =>
    apiFetch<void>(`/projects/${projectId}/images/${imageId}`, token, { method: "DELETE" }),

  analyzeProject: (token: string, projectId: string) =>
    apiFetch<{ queue: string; jobId: string }>(`/projects/${projectId}/analyze`, token, { method: "POST" }),

  setCameraMoveOverride: (token: string, projectId: string, imageId: string, cameraMoveOverride: string | null) =>
    apiFetch<ProjectImageSummary>(`/projects/${projectId}/images/${imageId}/camera-move`, token, {
      method: "PATCH",
      body: JSON.stringify({ cameraMoveOverride }),
    }),

  // ---- Version Engine ----
  listVersions: (token: string, projectId: string) =>
    apiFetch<VersionSummary[]>(`/projects/${projectId}/versions`, token),
  createVersion: (
    token: string,
    projectId: string,
    body: Partial<{
      name: string;
      reelLengthSec: number;
      styleId: string;
      musicTrackId: string;
      hookArchetype: string;
      brandKitId: string;
    }>,
  ) => apiFetch<VersionSummary>(`/projects/${projectId}/versions`, token, { method: "POST", body: JSON.stringify(body) }),
  getVersion: (token: string, projectId: string, versionId: string) =>
    apiFetch<VersionSummary>(`/projects/${projectId}/versions/${versionId}`, token),
  updateVersion: (
    token: string,
    projectId: string,
    versionId: string,
    body: Partial<{
      name: string;
      reelLengthSec: number;
      styleId: string | null;
      musicTrackId: string | null;
      hookArchetype: string;
      brandKitId: string | null;
    }>,
  ) =>
    apiFetch<VersionSummary>(`/projects/${projectId}/versions/${versionId}`, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteVersion: (token: string, projectId: string, versionId: string) =>
    apiFetch<void>(`/projects/${projectId}/versions/${versionId}`, token, { method: "DELETE" }),
  duplicateVersion: (token: string, projectId: string, versionId: string, name?: string) =>
    apiFetch<VersionSummary>(`/projects/${projectId}/versions/${versionId}/duplicate`, token, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  smartRegenerate: (token: string, projectId: string, versionId: string, directive: string) =>
    apiFetch<{ version: VersionSummary; render: RenderSummary | null }>(
      `/projects/${projectId}/versions/${versionId}/smart-regenerate`,
      token,
      { method: "POST", body: JSON.stringify({ directive }) },
    ),
  getCameraMovesPreview: (token: string, projectId: string, versionId: string) =>
    apiFetch<CameraMovePreviewEntry[]>(`/projects/${projectId}/versions/${versionId}/camera-moves-preview`, token),

  createRender: (token: string, projectId: string, versionId: string) =>
    apiFetch<{ render: RenderSummary; queue: string; jobId: string }>(
      `/projects/${projectId}/versions/${versionId}/renders`,
      token,
      { method: "POST" },
    ),
  listRenders: (token: string, projectId: string, versionId: string) =>
    apiFetch<RenderSummary[]>(`/projects/${projectId}/versions/${versionId}/renders`, token),
  getLatestRender: (token: string, projectId: string, versionId: string) =>
    apiFetch<RenderSummary>(`/projects/${projectId}/versions/${versionId}/renders/latest`, token),

  // ---- Brand Kits ----
  listBrandKits: (token: string) => apiFetch<BrandKitSummary[]>("/brand-kits", token),
  getDefaultBrandKit: (token: string) => apiFetch<BrandKitSummary | null>("/brand-kits/default", token),
  createBrandKit: (token: string, body: Partial<BrandKitSummary>) =>
    apiFetch<BrandKitSummary>("/brand-kits", token, { method: "POST", body: JSON.stringify(body) }),
  updateBrandKit: (token: string, id: string, body: Partial<BrandKitSummary>) =>
    apiFetch<BrandKitSummary>(`/brand-kits/${id}`, token, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBrandKit: (token: string, id: string) => apiFetch<void>(`/brand-kits/${id}`, token, { method: "DELETE" }),
  presignBrandAsset: (token: string, id: string, kind: "logo" | "outro" | "watermark", filename: string, contentType: string) =>
    apiFetch<{ storageKey: string; upload: { url: string; method: "PUT"; headers?: Record<string, string> } }>(
      `/brand-kits/${id}/assets/presign`,
      token,
      { method: "POST", body: JSON.stringify({ kind, filename, contentType }) },
    ),
  completeBrandAsset: (token: string, id: string, kind: "logo" | "outro" | "watermark", storageKey: string) =>
    apiFetch<BrandKitSummary>(`/brand-kits/${id}/assets/complete`, token, {
      method: "POST",
      body: JSON.stringify({ kind, storageKey }),
    }),

  // ---- Comments ----
  listComments: (token: string, projectId: string) => apiFetch<CommentSummary[]>(`/projects/${projectId}/comments`, token),
  createComment: (token: string, projectId: string, body: { renderId?: string; body: string }) =>
    apiFetch<CommentSummary>(`/projects/${projectId}/comments`, token, { method: "POST", body: JSON.stringify(body) }),
  deleteComment: (token: string, projectId: string, commentId: string) =>
    apiFetch<void>(`/projects/${projectId}/comments/${commentId}`, token, { method: "DELETE" }),

  // ---- Client Sharing ----
  listShareLinks: (token: string, projectId: string) =>
    apiFetch<ShareLinkSummary[]>(`/projects/${projectId}/share-links`, token),
  createShareLink: (token: string, projectId: string, renderId: string) =>
    apiFetch<ShareLinkSummary>(`/projects/${projectId}/share-links`, token, {
      method: "POST",
      body: JSON.stringify({ renderId }),
    }),
  deleteShareLink: (token: string, projectId: string, shareLinkId: string) =>
    apiFetch<void>(`/projects/${projectId}/share-links/${shareLinkId}`, token, { method: "DELETE" }),
  getSharePage: (token: string) => apiFetch<SharePageData>(`/share/${token}`, undefined),
  approveSharePage: (token: string, approvedByName: string) =>
    apiFetch<ShareLinkSummary>(`/share/${token}/approve`, undefined, {
      method: "POST",
      body: JSON.stringify({ approvedByName }),
    }),
  postShareComment: (token: string, authorName: string, body: string) =>
    apiFetch<CommentSummary>(`/share/${token}/comments`, undefined, {
      method: "POST",
      body: JSON.stringify({ authorName, body }),
    }),

  // ---- Exports ----
  createExport: (token: string, projectId: string, renderId: string, platform: string, resolution: string) =>
    apiFetch<RenderExportSummary>(`/projects/${projectId}/renders/${renderId}/exports`, token, {
      method: "POST",
      body: JSON.stringify({ platform, resolution }),
    }),
  listExports: (token: string, projectId: string, renderId: string) =>
    apiFetch<RenderExportSummary[]>(`/projects/${projectId}/renders/${renderId}/exports`, token),
};
