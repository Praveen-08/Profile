/**
 * Time and frame maths.
 *
 * FCPXML expresses every time as an exact rational `N/Ds` against a timebase.
 * Emitting decimal seconds is the single most common way to produce an FCPXML
 * that imports with drifting or refused clips, so every boundary that reaches
 * the exporter goes through here first.
 */

/** Timebases that cover the frame rates FCP actually ships. */
const TIMEBASES = new Map([
  [23.976, 24000], [24, 24], [25, 25], [29.97, 30000],
  [30, 30], [50, 50], [59.94, 60000], [60, 60],
  [100, 100], [120, 120],
]);

/**
 * @param {number} fps
 * @returns {{timebase:number, frameDuration:number}} frameDuration in timebase ticks.
 */
export function timebaseFor(fps) {
  const key = [...TIMEBASES.keys()].find((k) => Math.abs(k - fps) < 0.01);
  if (key === undefined) {
    // Unusual rate: use a 1000x timebase so the rational stays exact enough.
    const timebase = Math.round(fps * 1000);
    return { timebase, frameDuration: 1000 };
  }
  const timebase = /** @type {number} */ (TIMEBASES.get(key));
  return { timebase, frameDuration: Math.round(timebase / key) };
}

/**
 * Snap seconds to the nearest whole frame and return FCPXML rational form.
 * @param {number} seconds
 * @param {number} fps
 * @returns {string} e.g. "12012/24000s"
 */
export function toFCPTime(seconds, fps) {
  const { timebase, frameDuration } = timebaseFor(fps);
  const frames = Math.round((seconds * timebase) / frameDuration);
  const ticks = frames * frameDuration;
  return ticks === 0 ? '0s' : `${ticks}/${timebase}s`;
}

/** @param {number} seconds @param {number} fps @returns {number} Seconds, snapped. */
export function snapToFrame(seconds, fps) {
  const { timebase, frameDuration } = timebaseFor(fps);
  return (Math.round((seconds * timebase) / frameDuration) * frameDuration) / timebase;
}

/** @param {number} seconds @param {number} fps @returns {number} */
export const toFrames = (seconds, fps) => Math.round(seconds * fps);

/** @param {number} frames @param {number} fps @returns {number} */
export const toSeconds = (frames, fps) => frames / fps;

/**
 * A duration of at least one frame — FCP silently drops zero-length clips.
 * @param {number} seconds @param {number} fps @returns {number}
 */
export function atLeastOneFrame(seconds, fps) {
  const snapped = snapToFrame(seconds, fps);
  return snapped < 1 / fps ? 1 / fps : snapped;
}

/** @param {number} s @returns {string} `00:00:04.120`, for logs and the UI. */
export function timecode(s) {
  const sign = s < 0 ? '-' : '';
  const t = Math.abs(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** @param {number} a0 @param {number} a1 @param {number} b0 @param {number} b1 @returns {boolean} */
export const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
