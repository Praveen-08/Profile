/**
 * Phrase grouping.
 *
 * Splitting speech into visual phrases is the difference between "a caption
 * every four words" and a designed sequence. It is a global optimisation, not
 * a local one: a greedy splitter will happily leave one orphan word at the
 * end of a sentence, so this uses dynamic programming to find the segmentation
 * with the lowest total cost across the whole transcript.
 *
 * Cost has two parts:
 *   - **Phrase badness** — how far a candidate phrase is from the target word
 *     count, duration and width for the chosen caption density.
 *   - **Boundary cost** — how unnatural it is to break at that point. A full
 *     stop is nearly free; splitting "the" from the noun it introduces is
 *     expensive.
 *
 * @typedef {import('../core/types.js').Word} Word
 * @typedef {import('../core/types.js').Phrase} Phrase
 * @typedef {import('../templates/schema.js').Template} Template
 * @typedef {import('./emphasis.js').WordScore} WordScore
 */

import { endsSentence, endsClause, WRITTEN_NUMBERS } from '../lexicon/morphology.js';
import { normaliseToken, PIVOT_WORDS } from '../lexicon/function-words.js';
import { measureEm } from './typography.js';
import { isCompoundBreak } from '../lexicon/real-estate.js';

/** Target shape per caption density. */
const DENSITY = {
  low: { words: 2.4, maxWords: 4, maxDur: 2.6, minDur: 0.5, breakCost: 1.0, isolation: 1.9 },
  medium: { words: 4.0, maxWords: 6, maxDur: 3.4, minDur: 0.5, breakCost: 1.8, isolation: 1.35 },
  high: { words: 6.5, maxWords: 9, maxDur: 4.2, minDur: 0.45, breakCost: 3.0, isolation: 0.6 },
};

/** Written numbers that read as counts, so they must stay with their noun. */
const WRITTEN_COUNTS = new Set([...WRITTEN_NUMBERS.keys()].filter((k) => (WRITTEN_NUMBERS.get(k) ?? 0) <= 20));

/** Words that must not be left dangling at the end of a phrase. */
/**
 * Determiners and prepositions. These bind so tightly to the word after them
 * that ending a caption on one is always wrong, no matter how much the
 * engine wants to isolate the word that follows — so the penalty is set
 * above any isolation reward the optimiser can offer.
 */
const HARD_NO_TRAIL = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by',
  'my', 'your', 'our', 'their', 'his', 'her', 'its', 'this', 'that', 'these',
  'those', 'into', 'onto', 'over', 'under', 'and', 'or',
]);

/** Auxiliaries and degree words: awkward to trail, but not broken. */
const SOFT_NO_TRAIL = new Set([
  'but', 'do', 'does', 'did', 'is', 'are', 'am', 'was', 'were', 'not',
  'very', 'more', 'most', 'so', 'as', 'than', 'no', 'every', 'each', 'some', 'any',
]);

/**
 * Trailing words that read fine at the end of a phrase even though they are
 * function words, because the break lands on a natural breath: "I've always
 * been" / "COMPETITIVE" is the shape the brief asks for.
 */
const TRAIL_OK = new Set(['been', 'be', 'got', 'get', 'it', 'me', 'you', 'us', 'them', 'up']);

/**
 * @param {Word[]} words
 * @param {Template} template
 * @param {{scores?: WordScore[], maxWidthEm?: number}} [ctx]
 * @returns {Phrase[]}
 */
export function groupPhrases(words, template, ctx = {}) {
  if (!words.length) return [];

  const shape = DENSITY[template.hierarchy.captionDensity] ?? DENSITY.medium;
  const maxWords = Math.min(template.hierarchy.maxWordsPerPhrase || shape.maxWords, shape.maxWords);
  // Isolation is decided on a word's standing *relative to this transcript*,
  // not on an absolute score. A listing script is wall-to-wall keywords; if
  // every word above a fixed threshold were isolated, the result would be one
  // word per caption. Percentile ranking self-limits to the real standouts.
  const scoreOf = standoutMap(ctx.scores ?? []);

  // Width budget expressed in em of a normal word, so phrasing stays
  // resolution-independent and consistent with the typography engine.
  const widthBudget = (ctx.maxWidthEm ?? estimateWidthBudget(template)) * (template.hierarchy.maxLines || 2);

  // The word cap is a preference, not a wall. When every legal break inside a
  // span is blocked — a compound on one side, a dangling article on the other
  // — refusing to exceed the cap forces the optimiser to choose a defect.
  // Allowing two extra words at a steep price lets it choose the phrase
  // instead, which is always the better caption.
  const hardMax = maxWords + 2;

  const n = words.length;
  /** @type {number[]} */ const best = new Array(n + 1).fill(Infinity);
  /** @type {number[]} */ const from = new Array(n + 1).fill(-1);
  best[0] = 0;

  for (let end = 1; end <= n; end++) {
    for (let len = 1; len <= hardMax && end - len >= 0; len++) {
      const start = end - len;
      if (best[start] === Infinity) continue;
      const overflow = len > maxWords ? (len - maxWords) ** 2 * 6 : 0;
      const cost = best[start] + phraseCost(words, start, end, shape, template, widthBudget, scoreOf)
        + overflow + boundaryCost(words, end, n, shape);
      if (cost < best[end]) { best[end] = cost; from[end] = start; }
    }
  }

  /** @type {number[]} */
  const cuts = [];
  for (let i = n; i > 0; i = from[i]) {
    if (from[i] < 0) break;
    cuts.push(from[i]);
  }
  cuts.reverse();
  cuts.push(n);

  /** @type {Phrase[]} */
  const phrases = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const start = cuts[k], end = cuts[k + 1];
    const slice = words.slice(start, end);
    if (!slice.length) continue;
    phrases.push({
      id: `p${String(phrases.length).padStart(3, '0')}`,
      index: phrases.length,
      words: slice,
      start: slice[0].start,
      end: slice[slice.length - 1].end,
      breakReason: describeBreak(words, end, n),
    });
  }
  return phrases;
}

/**
 * How bad is it to render words[start..end) as one phrase?
 */
export function phraseCost(words, start, end, shape, template, widthBudget, scoreOf) {
  const len = end - start;
  const slice = words.slice(start, end);
  const dur = slice[slice.length - 1].end - slice[0].start;

  // Deviation from the density's target word count.
  let cost = Math.abs(len - shape.words) ** 1.6 * 1.0;

  // Duration: a phrase that flashes past is unreadable, one that lingers is dead air.
  if (dur > shape.maxDur) cost += (dur - shape.maxDur) ** 2 * 3.0;
  if (dur < shape.minDur && len > 1) cost += (shape.minDur - dur) * 4.0;

  // Width: type that cannot fit is a layout failure, so this is weighted hard.
  const em = slice.reduce((a, w) => a + measureEm(w.text, template.fonts.normal) + template.spacing.wordGap, 0);
  if (em > widthBudget) cost += (em - widthBudget) ** 1.5 * 2.2;

  // An internal sentence end is a missed break — a phrase should not straddle
  // a full stop unless the fragments either side would be tiny.
  for (let i = start; i < end - 1; i++) {
    if (endsSentence(words[i].text)) cost += 7.0;
    else if (endsClause(words[i].text)) cost += 1.6;
    const gap = words[i + 1].start - words[i].end;
    if (gap > 0.45) cost += gap * 5.0;              // straddling a real pause
  }

  // A strongly-scored word is worth isolating: "COMPETITIVE" standing alone is
  // the whole idea of the format. The reward is large because it has to beat
  // the word-count target, which otherwise pulls every phrase toward four
  // words and flattens the sequence out.
  const top = Math.max(0, ...slice.map((w) => scoreOf.get(w.id) ?? 0));
  if (top > 0) {
    // Peaked hard on length 1: the design intent is a standout word ALONE on
    // screen. A two-word phrase that merely contains it is barely rewarded,
    // otherwise the optimiser pairs the hero with whatever precedes it.
    const byLength = len === 1 ? 9.0 : len === 2 ? 2.0 : len === 3 ? 0.7 : 0.1;
    cost -= top * byLength * shape.isolation;
  }

  // Never split a figure from the thing it counts: "four" / "bedrooms" is a
  // broken caption even when the phrasing maths likes it.
  for (let i = start; i < end - 1; i++) void 0;

  // Never strand a single function word as an entire phrase.
  const soleTok = len === 1 ? normaliseToken(slice[0].text) : '';
  if (soleTok && (HARD_NO_TRAIL.has(soleTok) || SOFT_NO_TRAIL.has(soleTok))) cost += 30;

  return cost;
}

/** Cost of placing a break immediately after index `end - 1`. */
export function boundaryCost(words, end, n, shape) {
  if (end >= n) return 0;
  const last = words[end - 1], next = words[end];

  let cost = shape.breakCost;                        // a break always costs something
  if (endsSentence(last.text)) cost -= 4.0;
  else if (endsClause(last.text)) cost -= 2.0;

  const gap = next.start - last.end;
  if (gap > 0.12) cost -= Math.min(3.0, gap * 5.0);  // break where the speaker breathed

  if (PIVOT_WORDS.has(normaliseToken(next.text))) cost -= 1.5;   // "…but" starts the point

  const lastTok = normaliseToken(last.text);
  if (!TRAIL_OK.has(lastTok)) {
    if (HARD_NO_TRAIL.has(lastTok)) cost += 30.0;
    else if (SOFT_NO_TRAIL.has(lastTok)) cost += 8.0;
  }

  // A bare figure belongs with the noun it counts — but a token that has
  // already been normalised to "4 BEDROOMS" or "650m²" carries its own noun
  // and is a perfectly good place to break.
  const bareFigure = /^\$?[\d][\d,.]*$/.test(lastTok) || WRITTEN_COUNTS.has(lastTok);
  if (bareFigure) cost += 9.0;

  if (isCompoundBreak(last.text, next.text)) cost += 30.0;

  return Math.max(-5, cost);
}

function describeBreak(words, end, n) {
  if (end >= n) return 'end';
  const last = words[end - 1], next = words[end];
  if (endsSentence(last.text)) return 'sentence';
  if (endsClause(last.text)) return 'clause';
  const gap = next.start - last.end;
  if (gap > 0.25) return `pause ${gap.toFixed(2)}s`;
  return 'length';
}

/**
 * Map each word id to a 0..1 "standout" value: how far into the top of this
 * transcript's score distribution it sits. Only the top ~18% register at all.
 *
 * @param {WordScore[]} scores
 * @returns {Map<string, number>}
 */
export function standoutMap(scores) {
  /** @type {Map<string, number>} */
  const out = new Map();
  const eligible = scores.filter((s) => s.eligible && s.score > 0);
  if (!eligible.length) return out;

  const sorted = eligible.map((s) => s.score).sort((a, b) => a - b);
  const quantile = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

  // Measure each word against the upper-middle of the distribution rather
  // than against a fixed number. In a keyword-dense listing script the floor
  // rises with it, so only genuine standouts still clear it.
  const floor = Math.max(0.4, quantile(0.7));
  const peak = sorted[sorted.length - 1];
  const span = Math.max(0.15, peak - floor);

  for (const s of scores) {
    out.set(s.id, s.eligible && s.score > floor ? Math.min(1, (s.score - floor) / span) : 0);
  }
  return out;
}

/**
 * How many em of normal-weight text fit across the frame. Derived from the
 * template rather than a constant, so a style with a tight max width
 * automatically phrases shorter.
 * @param {Template} template @returns {number}
 */
export function estimateWidthBudget(template) {
  // A normal word's cap height is scale.base of the short edge; the short edge
  // is therefore 1/scale.base cap heights across, and roughly 0.7 of that in em.
  const capsAcross = 1 / template.scale.base;
  return capsAcross * 0.72 * template.hierarchy.maxWidth;
}
