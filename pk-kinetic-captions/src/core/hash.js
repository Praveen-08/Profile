/**
 * Deterministic selection.
 *
 * The brief is explicit that nothing may be randomised: the same transcript
 * and the same template must always produce the same design, or an editor can
 * never trust a re-generate. Where the engine needs to vary something (which
 * zone comes next, which of two equally good hero treatments to use) it draws
 * from a hash of stable content instead of a random source.
 */

/** FNV-1a. Small, fast, and stable across Node versions — which `Math.random` is not. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** @param {string} seed @returns {number} 0..1 */
export const hashUnit = (seed) => hashString(seed) / 0x100000000;

/**
 * @template T
 * @param {readonly T[]} items
 * @param {string} seed
 * @returns {T}
 */
export function pick(items, seed) {
  if (items.length === 0) throw new RangeError('pick() needs at least one item');
  return items[hashString(seed) % items.length];
}
