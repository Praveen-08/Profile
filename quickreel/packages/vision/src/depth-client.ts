/**
 * Thin HTTP client to apps/ai-service's depth-estimation endpoint — mirrors
 * packages/beat-engine's detectBeatGrid client. See
 * apps/ai-service/app/depth_estimation.py for the honest gap: this call
 * requires the depth model's weights to already be downloaded (or
 * downloadable) by the ai-service process, which is untested in network-
 * restricted sandboxes.
 */
export async function requestDepthMap(
  imageUrl: string,
  aiServiceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const response = await fetchImpl(`${aiServiceUrl.replace(/\/$/, "")}/vision/depth-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`depth-map request failed (${response.status}): ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
