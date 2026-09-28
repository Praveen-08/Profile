/**
 * Tap-to-sync.
 *
 * Typing the words is easy; typing the *timing* is not. This aligns text an
 * editor has typed or pasted to the audio in a single real-time pass: the
 * clip plays, and they tap once as each line is spoken.
 *
 * Tapping per word would mean 150 taps for a one-minute reel, so taps mark
 * lines. Word times inside a line are then interpolated by syllable weight —
 * the same model the SRT importer uses to spread a subtitle across its words,
 * which tracks speech noticeably better than dividing by character count.
 *
 * The result has exactly the shape an imported SRT has, so everything
 * downstream — phrasing, emphasis, layout, export — is unchanged.
 *
 * @typedef {import('../core/types.js').Word} Word
 * @typedef {import('../core/types.js').Transcript} Transcript
 */

import { distributeLine, syllableWeight } from './ingest.js';

/** A line is never allowed to be shorter than this, so a double tap cannot produce a flash. */
const MIN_LINE = 0.25;

/**
 * Split typed text into the lines an editor will tap along to.
 *
 * Explicit line breaks win: if they typed the text in lines, those are the
 * lines. Otherwise it splits on sentence punctuation and then on length,
 * because a line you have to tap for should be one breath of speech.
 *
 * This is deliberately *not* the phrasing engine. That engine decides how
 * captions are grouped on screen and needs timing to do it; this only decides
 * how often the editor taps. The phrasing engine runs afterwards, on the
 * timed result, exactly as it does for an SRT.
 *
 * @param {string} text
 * @param {{maxWords?: number}} [opts]
 * @returns {string[]}
 */
export function splitForSync(text, opts = {}) {
  const maxWords = opts.maxWords ?? 7;
  const source = String(text ?? '').trim();
  if (!source) return [];

  const explicit = source.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const useExplicit = explicit.length > 1;

  /** @type {string[]} */
  const lines = [];
  for (const block of useExplicit ? explicit : [source]) {
    const units = useExplicit ? [block] : splitSentences(block);
    for (const unit of units) {
      const words = unit.split(/\s+/).filter(Boolean);
      if (words.length <= maxWords) { lines.push(words.join(' ')); continue; }

      // Break a long sentence into even pieces rather than a full one and a
      // stub: four words then one reads as a mistake when you tap it.
      const pieces = Math.ceil(words.length / maxWords);
      const per = Math.ceil(words.length / pieces);
      for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(' '));
    }
  }
  return lines;
}

/** @param {string} block @returns {string[]} */
function splitSentences(block) {
  return block
    .split(/(?<=[.!?])\s+/)
    .flatMap((s) => (s.split(/\s+/).length > 14 ? s.split(/(?<=[,;:])\s+/) : [s]))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Turn taps into a timed transcript.
 *
 * `taps[i]` is when line `i` was spoken. A line runs until the next line
 * starts, so the editor never has to mark an end. Lines they did not reach
 * are estimated from the pace of the ones they did, so an interrupted pass
 * still produces something usable rather than nothing.
 *
 * @param {string[]} lines
 * @param {number[]} taps          Seconds on the clip, ascending.
 * @param {{end?: number, gap?: number}} [opts]
 *   `end` is where the last line stops — the clip's duration, or a final tap.
 *   `gap` is how long a trailing line is held when nothing bounds it.
 * @returns {Transcript}
 */
export function applyTapTimes(lines, taps, opts = {}) {
  const gap = opts.gap ?? 1.6;
  const clean = [...taps].filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);

  /** @type {Array<{text: string, start: number, end: number}>} */
  const timed = [];

  for (let i = 0; i < lines.length; i++) {
    const start = clean[i] ?? estimateStart(timed, lines, i, gap);
    timed.push({ text: lines[i], start, end: start + MIN_LINE });
  }

  // Each line runs to the next one. Done last so an estimated start still
  // closes the line before it.
  for (let i = 0; i < timed.length; i++) {
    const next = timed[i + 1];
    const bound = next ? next.start : (opts.end ?? timed[i].start + gap);
    timed[i].end = Math.max(timed[i].start + MIN_LINE, bound);
  }

  /** @type {Word[]} */
  const words = [];
  for (const line of timed) words.push(...distributeLine(line.text, line.start, line.end));

  return {
    words: words.map((w, i) => ({ ...w, id: `w${String(i).padStart(4, '0')}` })),
    source: 'sync',
  };
}

/**
 * Where an untapped line probably starts: carry on at the pace of the lines
 * that were tapped, weighted by how much there is to say.
 */
function estimateStart(timed, lines, index, gap) {
  const previous = timed[index - 1];
  if (!previous) return 0;

  const pace = measurePace(timed, lines, index);
  const weight = lines[index - 1].split(/\s+/).reduce((a, w) => a + syllableWeight(w), 0);
  return previous.start + Math.max(MIN_LINE, weight * pace);
}

/** Seconds per syllable across the lines that were actually tapped. */
function measurePace(timed, lines, index) {
  let seconds = 0, syllables = 0;
  for (let i = 1; i < index; i++) {
    const span = timed[i].start - timed[i - 1].start;
    if (span <= 0) continue;
    seconds += span;
    syllables += lines[i - 1].split(/\s+/).reduce((a, w) => a + syllableWeight(w), 0);
  }
  return syllables > 0 ? seconds / syllables : 0.22;   // ~150 wpm if nothing to go on
}

/**
 * How far through a tap pass the editor is — what the interface shows while
 * they work.
 *
 * @param {string[]} lines @param {number[]} taps
 * @returns {{done: number, total: number, current: string|null, next: string|null, complete: boolean}}
 */
export function syncProgress(lines, taps) {
  const done = Math.min(taps.length, lines.length);
  return {
    done,
    total: lines.length,
    current: done > 0 ? lines[done - 1] : null,
    next: done < lines.length ? lines[done] : null,
    complete: done >= lines.length,
  };
}
