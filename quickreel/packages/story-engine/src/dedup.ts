import type { DuplicateResult, StoryCandidateImage } from "./types.js";

/**
 * Hamming distance between two same-length hex-encoded perceptual hashes.
 * A 64-bit hash (16 hex chars) is standard for aHash/pHash/dHash.
 */
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`hammingDistanceHex: hash length mismatch ("${a}" vs "${b}")`);
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    distance += POPCOUNT_NIBBLE[x]!;
  }
  return distance;
}

const POPCOUNT_NIBBLE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/**
 * Two shots are "near-identical angles" (product spec's phrase) below this
 * Hamming distance out of a 64-bit hash. Tuned conservatively — false
 * negatives (missing a near-dup) are far less damaging to the final reel
 * than false positives (silently dropping a genuinely distinct shot).
 */
export const DEFAULT_DUPLICATE_THRESHOLD = 6;

class UnionFind {
  private parent: Map<string, string> = new Map();

  find(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // path compression
    let cursor = id;
    while (this.parent.get(cursor) !== root) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/**
 * Clusters near-identical shots (O(n^2) pairwise Hamming comparison — fine
 * at the product's 5-30 image ceiling) and keeps the single highest
 * `quality.overall` image per cluster as canonical. Everything else in the
 * cluster is marked a duplicate pointing at that canonical image.
 */
export function detectDuplicates(
  images: StoryCandidateImage[],
  threshold: number = DEFAULT_DUPLICATE_THRESHOLD,
): DuplicateResult[] {
  const uf = new UnionFind();
  for (const img of images) uf.find(img.imageId);

  for (let i = 0; i < images.length; i++) {
    for (let j = i + 1; j < images.length; j++) {
      const a = images[i]!;
      const b = images[j]!;
      if (hammingDistanceHex(a.perceptualHash, b.perceptualHash) <= threshold) {
        uf.union(a.imageId, b.imageId);
      }
    }
  }

  const clusters = new Map<string, StoryCandidateImage[]>();
  for (const img of images) {
    const root = uf.find(img.imageId);
    const cluster = clusters.get(root) ?? [];
    cluster.push(img);
    clusters.set(root, cluster);
  }

  const results: DuplicateResult[] = [];
  for (const cluster of clusters.values()) {
    if (cluster.length === 1) {
      results.push({ imageId: cluster[0]!.imageId, isDuplicate: false, duplicateOfId: null });
      continue;
    }
    const canonical = [...cluster].sort((a, b) => b.quality.overall - a.quality.overall)[0]!;
    for (const img of cluster) {
      results.push(
        img.imageId === canonical.imageId
          ? { imageId: img.imageId, isDuplicate: false, duplicateOfId: null }
          : { imageId: img.imageId, isDuplicate: true, duplicateOfId: canonical.imageId },
      );
    }
  }

  return results;
}
