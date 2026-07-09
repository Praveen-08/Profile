import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { EditDecisionList } from "@quickreel/shared";
import { QUICKREEL_COMPOSITION_ID } from "./remotion-entry.js";
import type { QuickReelCompositionProps } from "./Composition.js";

/** Remotion's Chromium GL backends. "swiftshader" (software) is the safe default for containers without a GPU; "angle"/"egl"/"vulkan" use real hardware acceleration where available. */
export type ChromiumGlBackend = "angle" | "egl" | "swiftshader" | "swangle" | "vulkan" | "angle-egl";

export interface RenderReelOptions {
  edl: EditDecisionList;
  /** imageStorageKey -> fetchable URL, resolved by the caller via a StorageAdapter (this package stays storage-agnostic). */
  imageUrls: Record<string, string>;
  audioUrl: string;
  outputPath: string;
  /**
   * Points at a pre-installed Chromium instead of letting Remotion download
   * its own Chrome-for-Testing build — see REMOTION_CHROMIUM_EXECUTABLE_PATH
   * in .env.example. Must be the `headless_shell` build specifically — see
   * this package's README for why regular Chromium fails.
   */
  chromiumExecutablePath?: string;
  /**
   * "final" (default) renders at full 1080x1920/crf20. "preview" halves the
   * output resolution and uses a higher (more compressed, faster) CRF —
   * for a quick "does this look right" pass before committing to the full
   * render. Both go through the exact same EDL/composition, so a preview
   * is representative of the final render, just lower fidelity.
   */
  quality?: "preview" | "final";
  /**
   * Overrides the quality-derived scale factor entirely — e.g. `2` for a 4K
   * export (2160x3840) re-render of the same 1080x1920-authored
   * composition. See apps/worker's export-render processor.
   */
  resolutionScale?: number;
  /** Parallel Chromium frame-rendering workers — real, direct performance lever, tune to available CPU cores. */
  concurrency?: number;
  /** GPU-accelerated GL backend for deployments with a real GPU; omit for software rendering (the only option available in a plain CPU container like the one this repo was developed in). */
  glBackend?: ChromiumGlBackend;
  onProgress?: (progress: { renderedFrames: number; totalFrames: number }) => void;
}

export interface RenderReelResult {
  outputPath: string;
  durationSec: number;
}

/**
 * Bundled once per worker process and reused for every render — this is
 * the biggest real caching win available: webpack bundling the composition
 * takes longer than most individual frame renders, and the bundle output
 * never changes between renders (it's a pure function of this package's
 * source, not of any project's data).
 */
let cachedServeUrl: Promise<string> | null = null;

function getServeUrl(): Promise<string> {
  if (!cachedServeUrl) {
    cachedServeUrl = bundle({
      entryPoint: fileURLToPath(new URL("./remotion-entry.tsx", import.meta.url)),
      // Every package in this monorepo uses Node's ESM convention of importing relative
      // TypeScript files with a ".js" extension (e.g. `from "./enums.js"`, resolved back to
      // enums.ts by tsc/tsx's NodeNext resolution). Remotion's bundler uses webpack, which has
      // no built-in knowledge of that convention — without this, it 404s on every such import.
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          extensionAlias: {
            ".js": [".ts", ".tsx", ".js"],
          },
        },
      }),
    });
  }
  return cachedServeUrl;
}

/**
 * Programmatic entry point apps/worker calls per render job — bundles the
 * composition once per worker process (cached, see getServeUrl), then
 * selects and renders it against the actual EDL. Never invokes the
 * Remotion CLI as a subprocess; this stays a plain async function so the
 * worker can await it directly inside a BullMQ processor.
 *
 * Other real caches in the render pipeline, tracked upstream of this
 * function: `MusicTrack.beatGridJson` (apps/worker's ensureBeatGrid skips
 * re-running librosa for a track it's already analyzed) and each image's
 * `depthMapStorageKey`/`foregroundMaskStorageKey` (computed once during
 * analysis, never recomputed on re-render).
 */
export async function renderReel(options: RenderReelOptions): Promise<RenderReelResult> {
  const serveUrl = await getServeUrl();
  const inputProps: QuickReelCompositionProps = {
    edl: options.edl,
    imageUrls: options.imageUrls,
    audioUrl: options.audioUrl,
  };

  const composition = await selectComposition({
    serveUrl,
    id: QUICKREEL_COMPOSITION_ID,
    inputProps,
    browserExecutable: options.chromiumExecutablePath,
  });

  const isPreview = options.quality === "preview";
  const scale = options.resolutionScale ?? (isPreview ? 0.5 : 1);

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: options.outputPath,
    inputProps,
    browserExecutable: options.chromiumExecutablePath,
    crf: isPreview ? 30 : 20,
    scale,
    concurrency: options.concurrency,
    imageFormat: "jpeg",
    chromiumOptions: options.glBackend ? { gl: options.glBackend } : undefined,
    onProgress: options.onProgress
      ? ({ renderedFrames }) => options.onProgress!({ renderedFrames, totalFrames: composition.durationInFrames })
      : undefined,
  });

  return { outputPath: options.outputPath, durationSec: options.edl.totalDurationMs / 1000 };
}
