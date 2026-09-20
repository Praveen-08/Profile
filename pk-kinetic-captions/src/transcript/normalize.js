/**
 * Transcript normalisation and correction.
 *
 * Three separable things happen here, and all of them are optional and
 * reversible, because the brief is emphatic that meaning must never change
 * behind the editor's back:
 *
 *   1. Concept tagging      — always safe, purely additive.
 *   2. Text correction      — editor-supplied, e.g. "Mana Kau" -> "Manukau".
 *   3. Typographic collapse — "four bedrooms" -> "4 BEDROOMS". Off by default
 *                             unless real-estate mode asks for it.
 *
 * Every word keeps `spoken`, so the original wording is one click away.
 *
 * @typedef {import('../core/types.js').Word} Word
 * @typedef {import('../core/types.js').Transcript} Transcript
 */

import { conceptOf, findNormalisations } from '../lexicon/real-estate.js';

/**
 * @typedef {object} NormalizeOptions
 * @property {boolean} [realEstate]        Enable concept tagging.
 * @property {boolean} [collapse]          Enable typographic collapse of spans.
 * @property {boolean} [counts]
 * @property {boolean} [areas]
 * @property {boolean} [prices]
 * @property {"full"|"short"} [priceFormat]
 * @property {Record<string,string>} [corrections]  Exact or lowercase phrase -> replacement.
 */

/**
 * @param {Transcript} transcript
 * @param {NormalizeOptions} [opts]
 * @returns {{transcript: Transcript, changes: Array<{ids:string[], from:string, to:string, rule:string}>}}
 */
export function normalize(transcript, opts = {}) {
  /** @type {Array<{ids:string[], from:string, to:string, rule:string}>} */
  const changes = [];
  let words = transcript.words.map((w) => ({ ...w }));

  if (opts.corrections && Object.keys(opts.corrections).length) {
    words = applyCorrections(words, opts.corrections, changes);
  }

  if (opts.collapse) {
    words = collapseSpans(words, opts, changes);
  }

  if (opts.realEstate !== false) {
    for (const w of words) {
      if (w.concept) continue;
      const hit = conceptOf(w.text) ?? conceptOf(w.spoken);
      if (hit) w.concept = hit.concept;
    }
  }

  return { transcript: { ...transcript, words }, changes };
}

/**
 * Apply editor corrections. Multi-word corrections re-span the timing of the
 * words they replace rather than resetting it, which is what "the correction
 * should not destroy the timing" means in practice.
 *
 * @param {Word[]} words
 * @param {Record<string,string>} corrections
 * @param {Array<{ids:string[], from:string, to:string, rule:string}>} changes
 * @returns {Word[]}
 */
function applyCorrections(words, corrections, changes) {
  /** @type {Array<{from:string[], to:string}>} */
  const rules = Object.entries(corrections)
    .map(([from, to]) => ({ from: from.trim().split(/\s+/), to }))
    .sort((a, b) => b.from.length - a.from.length);   // longest match wins

  /** @type {Word[]} */
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const rule = rules.find((r) => matchesAt(words, i, r.from));
    if (!rule) { out.push(words[i]); continue; }

    const span = words.slice(i, i + rule.from.length);
    const replacement = rule.to.trim().split(/\s+/);
    const start = span[0].start, end = span[span.length - 1].end;
    const ids = span.map((w) => w.id);

    if (replacement.length === 1) {
      out.push({ ...span[0], text: carryPunctuation(span[span.length - 1].text, replacement[0]), end });
    } else {
      // Redistribute the span's duration evenly across the replacement words.
      const step = (end - start) / replacement.length;
      replacement.forEach((text, k) => {
        out.push({
          ...span[0],
          id: k === 0 ? span[0].id : `${span[0].id}+${k}`,
          text: k === replacement.length - 1 ? carryPunctuation(span[span.length - 1].text, text) : text,
          spoken: span[k]?.spoken ?? span[0].spoken,
          start: start + step * k, end: start + step * (k + 1),
        });
      });
    }
    changes.push({ ids, from: span.map((w) => w.text).join(' '), to: rule.to, rule: 'correction' });
    i += rule.from.length - 1;
  }
  return out;
}

/** @param {Word[]} words @param {number} i @param {string[]} pattern @returns {boolean} */
function matchesAt(words, i, pattern) {
  if (i + pattern.length > words.length) return false;
  return pattern.every((p, k) => stripPunct(words[i + k].text).toLowerCase() === stripPunct(p).toLowerCase());
}

const stripPunct = (s) => s.replace(/[^\p{L}\p{N}'$%²]/gu, '');

/** Keep the trailing punctuation of the text being replaced. */
function carryPunctuation(original, replacement) {
  const tail = /[.,!?;:—–]+$/.exec(original);
  return tail && !/[.,!?;:]$/.test(replacement) ? replacement + tail[0] : replacement;
}

/**
 * Collapse multi-word spans into one designed token: "four bedrooms" becomes
 * a single word "4 BEDROOMS" spanning the original timing, so it animates as
 * one graphic instead of two.
 *
 * @param {Word[]} words
 * @param {NormalizeOptions} opts
 * @param {Array<{ids:string[], from:string, to:string, rule:string}>} changes
 * @returns {Word[]}
 */
function collapseSpans(words, opts, changes) {
  const spans = findNormalisations(words.map((w) => w.text), {
    counts: opts.counts !== false,
    areas: opts.areas !== false,
    prices: opts.prices !== false,
    priceFormat: opts.priceFormat ?? 'short',
  });
  if (!spans.length) return words;

  /** @type {Word[]} */
  const out = [];
  let cursor = 0;
  for (const span of spans) {
    for (; cursor < span.startIndex; cursor++) out.push(words[cursor]);
    const group = words.slice(span.startIndex, span.endIndex + 1);
    const tail = group[group.length - 1].text;
    const punct = /[.,!?;:]+$/.exec(tail)?.[0] ?? '';
    out.push({
      ...group[0],
      text: span.text + punct,
      spoken: group.map((w) => w.spoken).join(' '),
      start: group[0].start,
      end: group[group.length - 1].end,
      concept: span.concept,
      normalized: true,
    });
    changes.push({
      ids: group.map((w) => w.id),
      from: group.map((w) => w.text).join(' '),
      to: span.text, rule: span.rule,
    });
    cursor = span.endIndex + 1;
  }
  for (; cursor < words.length; cursor++) out.push(words[cursor]);
  return out;
}
