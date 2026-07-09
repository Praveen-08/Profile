import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { EditDecisionList } from "@quickreel/shared";
import { QUICKREEL_COMPOSITION_ID } from "./remotion-entry.js";
import type { QuickReelCompositionProps } from "./Composition.js";

export interface RenderReelOptions {
  edl: EditDecisionList;
  /** imageStorageKey -> fetchable URL, resolved by the caller via a StorageAdapter (this package stays storage-agnostic). */
  imageUrls: Record<string, string>;
  audioUrl: string;
  outputPath: string;
  /**
   * Points at a pre-installed Chromium instead of letting Remotion download
   * its own Chrome-for-Testing build — see REMOTION_CHROMIUM_EXECUTABLE_PATH
   * in .env.example. UNVALIDATED in this environment: Remotion typically
   * expects a specific Chrome-for-Testing revision, so this is flagged as
   * the first spike task (#21) before relying on it in production.
   */
  chromiumExecutablePath?: string;
  onProgress?: (progress: { renderedFrames: number; totalFrames: number }) => void;
}

export interface RenderReelResult {
  outputPath: string;
  durationSec: number;
}

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
 * composition once per worker process (cached), then selects and renders
 * it against the actual EDL. Never invokes the Remotion CLI as a
 * subprocess; this stays a plain async function so the worker can await it
 * directly inside a BullMQ processor.
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

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: options.outputPath,
    inputProps,
    browserExecutable: options.chromiumExecutablePath,
    crf: 20,
    imageFormat: "jpeg",
    onProgress: options.onProgress
      ? ({ renderedFrames }) => options.onProgress!({ renderedFrames, totalFrames: composition.durationInFrames })
      : undefined,
  });

  return { outputPath: options.outputPath, durationSec: options.edl.totalDurationMs / 1000 };
}
