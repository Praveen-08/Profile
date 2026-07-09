/**
 * Deterministic PRNG (mulberry32) shared by every AI Director Engine
 * package. Every camera/transition/hook/timing/music decision is seeded
 * off the renderId, so re-rendering the same project+style+music produces
 * an identical edit. "Never random" per product spec means never
 * *unreproducible*, not literally static.
 */
export function createSeededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;

  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted random pick using a seeded rng source. Returns null for an empty/zero-weight pool. */
export function weightedPick<T>(pool: Array<{ item: T; weight: number }>, rng: () => number): T | null {
  const positive = pool.filter((p) => p.weight > 0);
  if (positive.length === 0) return null;
  const total = positive.reduce((sum, p) => sum + p.weight, 0);
  let target = rng() * total;
  for (const p of positive) {
    target -= p.weight;
    if (target <= 0) return p.item;
  }
  return positive[positive.length - 1]!.item;
}
