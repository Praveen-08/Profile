import type { EditDecisionList } from "@quickreel/shared";
import type { StorageAdapter } from "@quickreel/storage";

/**
 * Every storage key referenced anywhere in an EDL (photos, depth maps,
 * foreground masks, brand-kit logo/outro/watermark), resolved to a
 * fetchable URL — the one lookup table Remotion's composition needs. Shared
 * between the primary render processor and the export processor so a 4K
 * export re-render resolves assets identically to the original render.
 */
export function buildImageUrls(edl: EditDecisionList, storage: StorageAdapter): Record<string, string> {
  const imageUrls: Record<string, string> = {};

  for (const clip of edl.clips) {
    imageUrls[clip.imageStorageKey] = storage.getObjectUrl(clip.imageStorageKey);
    if (clip.depth) {
      imageUrls[clip.depth.depthMapStorageKey] = storage.getObjectUrl(clip.depth.depthMapStorageKey);
      imageUrls[clip.depth.foregroundMaskStorageKey] = storage.getObjectUrl(clip.depth.foregroundMaskStorageKey);
    }
  }

  if (edl.brandKit) {
    for (const key of [edl.brandKit.logoStorageKey, edl.brandKit.outroStorageKey, edl.brandKit.watermarkStorageKey]) {
      if (key) imageUrls[key] = storage.getObjectUrl(key);
    }
  }

  return imageUrls;
}
