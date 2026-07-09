import { BeatGridSchema, type BeatGrid } from "@quickreel/shared";

export interface BeatDetectRequest {
  /** A URL apps/ai-service can fetch directly (local-storage public base URL or R2 public URL). */
  audioUrl: string;
  trackSlug: string;
}

/**
 * Thin HTTP client to apps/ai-service's librosa-backed beat detector — the
 * one genuinely Python-only surface in this system. Callers (the worker)
 * should check `music_tracks.beatGridJson` first and only call this when
 * absent, since analysis is deterministic per track and safe to cache
 * forever (until CURRENT_BEAT_ANALYSIS_VERSION changes).
 */
export async function detectBeatGrid(
  request: BeatDetectRequest,
  aiServiceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BeatGrid> {
  const response = await fetchImpl(`${aiServiceUrl.replace(/\/$/, "")}/audio/beat-detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`beat-detect request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return BeatGridSchema.parse(json);
}
