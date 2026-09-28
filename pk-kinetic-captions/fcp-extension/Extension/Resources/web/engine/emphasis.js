/**
 * Emphasis engine — decides which words are NORMAL, EMPHASIS and HERO.
 *
 * This is the part that makes the difference between kinetic typography and
 * bolded subtitles, and it is governed by one rule from the brief: if
 * everything is emphasised, nothing is. So the engine works in two stages:
 *
 *   1. **Score** every word on its own merits (0..1). Cheap, order-free,
 *      explainable — every score carries the reasons that produced it, which
 *      the word editor shows on hover.
 *
 *   2. **Allocate** levels against a budget. Emphasis density sets how much
 *      of the transcript may be promoted; hero words additionally compete for
 *      a limited number of slots with a cooldown between them. A word is not
 *      promoted because it scored well in isolation — it is promoted because
 *      it scored well *relative to the words around it*.
 *
 * Stage 2 is what produces the NORMAL -> EMPHASIS -> NORMAL -> HERO rhythm.
 *
 * @typedef {import('../core/types.js').Word} Word
 * @typedef {import('../core/types.js').Level} Level
 * @typedef {import('../core/types.js').Phrase} Phrase
 * @typedef {import('../templates/schema.js').Template} Template
 */

import { analyse, looksProper, isIntensifier, endsSentence, endsClause } from '../lexicon/morphology.js';
import { isFunctionWord, normaliseToken, PIVOT_WORDS } from '../lexicon/function-words.js';
import { conceptOf } from '../lexicon/real-estate.js';

/**
 * @typedef {object} WordScore
 * @property {string} id
 * @property {number} score        0..1
 * @property {string[]} reasons
 * @property {boolean} eligible    False for function words and filler — never promotable.
 * @property {string} [concept]
 */

/** Weights are additive and then squashed; kept as named constants so the behaviour is tunable, not magic. */
const W = {
  noun: 0.30, verb: 0.34, adjective: 0.32, adverb: 0.08, number: 0.52,
  proper: 0.26, concept: 0.50, afterIntensifier: 0.18, afterPivot: 0.16,
  clauseFinal: 0.14, sentenceFinal: 0.10, pauseBefore: 0.22, pauseAfter: 0.26,
  longWord: 0.10, repeated: -0.16, duration: 0.18, lowConfidence: -0.12,
};

/**
 * Score every word. Pure and order-stable.
 *
 * @param {Word[]} words
 * @param {Template} template
 * @returns {WordScore[]}
 */
export function scoreWords(words, template) {
  const counts = new Map();
  for (const w of words) {
    const k = normaliseToken(w.text);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const gaps = words.map((w, i) => (i === 0 ? 0.4 : Math.max(0, w.start - words[i - 1].end)));
  const medianDur = median(words.map((w) => w.end - w.start)) || 0.3;
  const reBoost = template.realEstate.enabled ? template.realEstate.conceptBoost : 0;

  return words.map((w, i) => {
    /** @type {string[]} */
    const reasons = [];
    const { pos } = analyse(w.text);
    const token = normaliseToken(w.text);
    const prev = words[i - 1];
    const next = words[i + 1];

    const eligible = pos !== 'function' && token.length > 0 && !isIntensifier(w.text);
    if (!eligible) {
      return { id: w.id, score: 0, reasons: [pos === 'function' ? 'function word' : 'intensifier'], eligible: false, concept: w.concept };
    }

    let s = 0;
    const add = (amount, why) => { if (amount) { s += amount; reasons.push(`${why} ${amount > 0 ? '+' : ''}${amount.toFixed(2)}`); } };

    add(W[pos] ?? 0, pos);

    if (looksProper(w.text, i === 0 || (prev && endsSentence(prev.text)))) add(W.proper, 'proper noun');

    const concept = w.concept ?? conceptOf(w.text)?.concept;
    if (concept && reBoost) {
      const weight = conceptOf(w.text)?.weight ?? 0.7;
      add(W.concept * weight * reBoost, `real-estate:${concept}`);
    }
    if (w.normalized) add(0.12, 'normalised figure');

    if (prev && isIntensifier(prev.text)) add(W.afterIntensifier, `after "${prev.text}"`);
    if (prev && PIVOT_WORDS.has(normaliseToken(prev.text))) add(W.afterPivot, `after pivot "${prev.text}"`);

    if (endsSentence(w.text)) add(W.sentenceFinal, 'sentence-final');
    else if (endsClause(w.text)) add(W.clauseFinal, 'clause-final');

    // A speaker pausing around a word is the strongest natural emphasis
    // signal there is, and it is free — it is already in the timing.
    if (gaps[i] > 0.18) add(Math.min(W.pauseBefore, gaps[i] * 0.5), `pause before (${gaps[i].toFixed(2)}s)`);
    if (next) {
      const after = Math.max(0, next.start - w.end);
      if (after > 0.18) add(Math.min(W.pauseAfter, after * 0.55), `pause after (${after.toFixed(2)}s)`);
    }

    // Deliberate lengthening: "it was HUUUGE".
    const dur = w.end - w.start;
    if (dur > medianDur * 1.6) add(W.duration, 'held long');

    if (token.length >= 9) add(W.longWord, 'long word');

    const repeats = counts.get(token) ?? 1;
    if (repeats > 2) add(W.repeated * Math.min(2, repeats - 2), `repeated ${repeats}x`);

    if (w.confidence !== undefined && w.confidence < 0.6) add(W.lowConfidence, 'low transcription confidence');

    return { id: w.id, score: clamp01(s), reasons, eligible: true, concept };
  });
}

/* ------------------------------------------------------------------ *
 * Allocation
 * ------------------------------------------------------------------ */

/** Share of *eligible* words that may be promoted, per density setting. */
const DENSITY = {
  subtle: { emphasis: 0.16, hero: 0.035 },
  balanced: { emphasis: 0.30, hero: 0.070 },
  strong: { emphasis: 0.48, hero: 0.120 },
};

/**
 * Assign levels across the whole transcript.
 *
 * Budgets are global, but hero placement is additionally constrained by a
 * cooldown and a per-phrase cap, which is what stops three hero words landing
 * in a row and flattening the hierarchy back out.
 *
 * @param {Phrase[]} phrases
 * @param {WordScore[]} scores
 * @param {Template} template
 * @param {import('../core/types.js').OverrideMap} [overrides]
 * @returns {Map<string, {level: Level, score: number, reasons: string[], source: "auto"|"override"|"off"}>}
 */
export function assignLevels(phrases, scores, template, overrides = {}) {
  /** @type {Map<string, {level: Level, score: number, reasons: string[], source: "auto"|"override"|"off"}>} */
  const result = new Map();
  const byId = new Map(scores.map((s) => [s.id, s]));
  const allWords = phrases.flatMap((p) => p.words);

  // Manual overrides are absolute and are removed from the budget entirely.
  /** @type {Set<string>} */
  const locked = new Set();
  for (const w of allWords) {
    const o = overrides[w.id];
    if (o?.level) {
      const s = byId.get(w.id);
      result.set(w.id, { level: o.level, score: s?.score ?? 0, reasons: ['manual override'], source: 'override' });
      locked.add(w.id);
    }
  }

  if (!template.hierarchy.autoEmphasis) {
    for (const w of allWords) {
      if (!locked.has(w.id)) result.set(w.id, { level: 'normal', score: byId.get(w.id)?.score ?? 0, reasons: ['auto emphasis off'], source: 'off' });
    }
    return result;
  }

  const density = DENSITY[template.hierarchy.emphasisDensity] ?? DENSITY.balanced;
  const candidates = allWords
    .filter((w) => !locked.has(w.id) && byId.get(w.id)?.eligible)
    .map((w) => ({ word: w, ...(/** @type {WordScore} */ (byId.get(w.id))) }))
    .filter((c) => c.score > 0.18);

  const eligibleCount = allWords.filter((w) => byId.get(w.id)?.eligible).length;
  const manualHeroes = [...locked].filter((id) => result.get(id)?.level === 'hero').length;
  const manualEmph = [...locked].filter((id) => result.get(id)?.level === 'emphasis').length;

  let heroBudget = Math.max(0, Math.round(eligibleCount * density.hero) - manualHeroes);
  let emphBudget = Math.max(0, Math.round(eligibleCount * density.emphasis) - manualEmph);

  // A short clip still deserves one hero word — otherwise a 12-word reel
  // renders as flat subtitles, which is the failure mode the brief names.
  if (heroBudget === 0 && manualHeroes === 0 && candidates.length >= 4) heroBudget = 1;
  if (emphBudget === 0 && candidates.length >= 2) emphBudget = 1;

  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.word.start - b.word.start);

  /** @type {Array<{start:number,end:number}>} */
  const heroTimes = allWords.filter((w) => result.get(w.id)?.level === 'hero').map((w) => ({ start: w.start, end: w.end }));
  const heroPerPhrase = new Map();
  for (const p of phrases) heroPerPhrase.set(p.id, p.words.filter((w) => result.get(w.id)?.level === 'hero').length);
  const phraseOf = new Map();
  for (const p of phrases) for (const w of p.words) phraseOf.set(w.id, p);

  // Pass 1 — heroes.
  for (const c of ranked) {
    if (heroBudget <= 0) break;
    if (c.score < 0.42) break;                       // never manufacture a hero out of a weak word
    const phrase = phraseOf.get(c.word.id);
    if ((heroPerPhrase.get(phrase.id) ?? 0) >= template.hierarchy.maxHeroPerPhrase) continue;
    const tooClose = heroTimes.some((h) => Math.abs(h.start - c.word.start) < template.hierarchy.heroCooldown);
    if (tooClose) continue;
    result.set(c.word.id, { level: 'hero', score: c.score, reasons: c.reasons, source: 'auto' });
    heroTimes.push({ start: c.word.start, end: c.word.end });
    heroPerPhrase.set(phrase.id, (heroPerPhrase.get(phrase.id) ?? 0) + 1);
    heroBudget--;
  }

  // Pass 2 — emphasis, skipping anything already promoted.
  for (const c of ranked) {
    if (emphBudget <= 0) break;
    if (result.has(c.word.id)) continue;
    if (c.score < 0.24) break;
    // Avoid two adjacent emphasis words: side by side they read as one long
    // emphasised run rather than as a highlight.
    const phrase = phraseOf.get(c.word.id);
    const idx = phrase.words.findIndex((w) => w.id === c.word.id);
    const neighbourPromoted = [idx - 1, idx + 1].some((k) => {
      const n = phrase.words[k];
      return n && (result.get(n.id)?.level === 'emphasis');
    });
    if (neighbourPromoted && phrase.words.length > 2) continue;
    result.set(c.word.id, { level: 'emphasis', score: c.score, reasons: c.reasons, source: 'auto' });
    emphBudget--;
  }

  for (const w of allWords) {
    if (!result.has(w.id)) {
      const s = byId.get(w.id);
      result.set(w.id, { level: 'normal', score: s?.score ?? 0, reasons: s?.reasons ?? [], source: 'auto' });
    }
  }
  return result;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
