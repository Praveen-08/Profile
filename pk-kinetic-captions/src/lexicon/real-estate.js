/**
 * Real-estate intelligence.
 *
 * Two jobs:
 *   1. Recognise the concepts that matter in a listing video, so the emphasis
 *      engine can promote "four bedrooms" over "and then we walk through".
 *   2. Offer — never impose — the typographic normalisations an agent would
 *      make by hand: "four bedrooms" -> "4 BEDROOMS", "$1.5 million" -> "$1.5M".
 *
 * The hard rule from the brief: normalisation must never change meaning, and
 * the spoken original is always preserved on the word.
 */

import { WRITTEN_NUMBERS, isNumeric } from './morphology.js';
import { normaliseToken } from './function-words.js';

/** @typedef {"PROPERTY"|"PRICE"|"BEDROOMS"|"BATHROOMS"|"CARPARKS"|"LAND_AREA"|"FLOOR_AREA"|"LOCATION"|"FEATURE"|"CONDITION"|"LIFESTYLE"|"TENURE"} Concept */

/**
 * Concept keywords. Weight is the emphasis bonus a match contributes — a
 * price is always the loudest thing in a listing video, a lifestyle word is a
 * nice-to-have.
 * @type {Array<{concept: Concept, weight: number, words: string[]}>}
 */
export const CONCEPTS = [
  { concept: 'PROPERTY', weight: 0.7, words: ['property', 'properties', 'home', 'homes', 'house', 'apartment', 'townhouse', 'estate', 'listing', 'residence', 'villa'] },
  { concept: 'PRICE', weight: 1.0, words: ['price', 'priced', 'million', 'thousand', 'k', 'm', 'offers', 'auction', 'tender', 'deadline', 'negotiation', 'cv', 'rv', 'valuation', 'budget', 'asking'] },
  { concept: 'BEDROOMS', weight: 0.9, words: ['bedroom', 'bedrooms', 'bed', 'beds', 'double', 'master', 'ensuite'] },
  { concept: 'BATHROOMS', weight: 0.85, words: ['bathroom', 'bathrooms', 'bath', 'baths', 'wc', 'powder'] },
  { concept: 'CARPARKS', weight: 0.75, words: ['garage', 'garaging', 'carpark', 'carparks', 'carport', 'parking', 'car'] },
  { concept: 'LAND_AREA', weight: 0.9, words: ['section', 'land', 'site', 'hectare', 'hectares', 'acre', 'acres', 'freehold', 'subdividable', 'subdivision'] },
  { concept: 'FLOOR_AREA', weight: 0.8, words: ['floor', 'metres', 'meters', 'sqm', 'm2', 'footprint', 'living'] },
  { concept: 'LOCATION', weight: 0.9, words: ['street', 'road', 'avenue', 'drive', 'suburb', 'city', 'central', 'zone', 'zoned', 'school', 'grammar', 'beach', 'waterfront', 'harbour', 'harbor', 'coast', 'cbd', 'motorway', 'transport', 'village'] },
  { concept: 'FEATURE', weight: 0.85, words: ['pool', 'spa', 'workshop', 'studio', 'deck', 'patio', 'courtyard', 'garden', 'gardens', 'fireplace', 'kitchen', 'scullery', 'pantry', 'office', 'gym', 'cellar', 'lift', 'views', 'view', 'outlook', 'aspect', 'sun', 'north-facing', 'indoor-outdoor', 'flow'] },
  { concept: 'CONDITION', weight: 0.8, words: ['renovated', 'renovation', 'new', 'build', 'newbuild', 'architectural', 'designer', 'character', 'villa', 'bungalow', 'original', 'restored', 'turnkey', 'immaculate', 'warranty'] },
  { concept: 'LIFESTYLE', weight: 0.6, words: ['lifestyle', 'entertaining', 'family', 'downsize', 'downsizing', 'first-home', 'investment', 'investor', 'rental', 'yield', 'luxury', 'privacy', 'private', 'sanctuary', 'retreat'] },
  { concept: 'TENURE', weight: 0.55, words: ['freehold', 'leasehold', 'crosslease', 'unit', 'title', 'body', 'corporate'] },
];

/** @type {Map<string, {concept: Concept, weight: number}>} */
const INDEX = new Map();
for (const { concept, weight, words } of CONCEPTS) {
  for (const w of words) if (!INDEX.has(w)) INDEX.set(w, { concept, weight });
}

/** @param {string} raw @returns {{concept: Concept, weight: number}|null} */
export function conceptOf(raw) {
  return INDEX.get(normaliseToken(raw)) ?? null;
}

/**
 * Compounds that must never be split across two captions. "business and real"
 * / "estate." is a phrasing failure no amount of typography recovers from.
 */
export const COMPOUNDS = new Set([
  'real estate', 'sea views', 'sea view', 'water views', 'harbour views',
  'open home', 'first home', 'double garage', 'single garage', 'square metres',
  'square meters', 'floor area', 'land area', 'off street', 'north facing',
  'indoor outdoor', 'body corporate', 'cross lease', 'resource consent',
  'building report', 'auction day', 'under offer', 'price by', 'by negotiation',
  'master bedroom', 'living area', 'family home', 'lifestyle block',
  'walk in', 'brand new', 'move in', 'turn key',
]);

/**
 * True when breaking between `a` and `b` would split a compound.
 * @param {string} a @param {string} b @returns {boolean}
 */
export function isCompoundBreak(a, b) {
  return COMPOUNDS.has(`${normaliseToken(a)} ${normaliseToken(b)}`);
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} NormalisationResult
 * @property {number} startIndex   First word index consumed.
 * @property {number} endIndex     Last word index consumed, inclusive.
 * @property {string} text         Replacement display text for the span.
 * @property {Concept} concept
 * @property {string} rule         Which rule fired, for the UI's "why" tooltip.
 */

/**
 * @typedef {object} NormaliseOptions
 * @property {boolean} [counts]       "four bedrooms" -> "4 BEDROOMS"
 * @property {boolean} [areas]        "six hundred and fifty square metres" -> "650m²"
 * @property {boolean} [prices]       "one point five million dollars" -> "$1.5M"
 * @property {"full"|"short"} [priceFormat]  $1,295,000 vs $1.295M
 */

/**
 * Scan a token list and return the spans that could be typographically
 * normalised. Returns *candidates* — applying them is the caller's decision,
 * which is what keeps this optional as the brief requires.
 *
 * @param {string[]} tokens
 * @param {NormaliseOptions} [opts]
 * @returns {NormalisationResult[]}
 */
export function findNormalisations(tokens, opts = {}) {
  const { counts = true, areas = true, prices = true, priceFormat = 'short' } = opts;
  /** @type {NormalisationResult[]} */
  const out = [];
  let i = 0;

  while (i < tokens.length) {
    const consumedPrice = prices ? matchPrice(tokens, i, priceFormat) : null;
    if (consumedPrice) { out.push(consumedPrice); i = consumedPrice.endIndex + 1; continue; }

    const consumedArea = areas ? matchArea(tokens, i) : null;
    if (consumedArea) { out.push(consumedArea); i = consumedArea.endIndex + 1; continue; }

    const consumedCount = counts ? matchCount(tokens, i) : null;
    if (consumedCount) { out.push(consumedCount); i = consumedCount.endIndex + 1; continue; }

    i++;
  }
  return out;
}

/** Read a written or digit number starting at `i`. @returns {{value:number, end:number}|null} */
export function readNumber(tokens, i) {
  let total = 0, current = 0, end = -1, sawAny = false;

  for (let k = i; k < tokens.length; k++) {
    const t = normaliseToken(tokens[k]);
    if (!t) break;
    if (t === 'and' && sawAny) continue;

    if (t === 'point' && sawAny) {
      // "one point five" — read the fractional digits that follow.
      const digits = [];
      let k2 = k + 1;
      while (k2 < tokens.length) {
        const d = normaliseToken(tokens[k2]);
        const dv = WRITTEN_NUMBERS.get(d);
        if (dv !== undefined && dv < 10) { digits.push(dv); k2++; }
        else if (/^\d$/.test(d)) { digits.push(Number(d)); k2++; }
        else break;
      }
      if (!digits.length) break;
      // Fold the fraction into `current` immediately: "one point five million"
      // must multiply 1.5 by a million, not add 0.5 to a million.
      current += Number(`0.${digits.join('')}`);
      end = k2 - 1;
      k = k2 - 1;
      continue;
    }

    const digitMatch = /^\$?([\d][\d,]*(?:\.\d+)?)$/.exec(t);
    if (digitMatch) {
      current += Number(digitMatch[1].replace(/,/g, ''));
      sawAny = true; end = k; continue;
    }

    const value = WRITTEN_NUMBERS.get(t);
    if (value === undefined) break;
    sawAny = true; end = k;
    if (value === 100) current = (current || 1) * 100;
    else if (value >= 1000) { total += (current || 1) * value; current = 0; }
    else current += value;
  }

  if (!sawAny) return null;
  return { value: total + current, end };
}

const PRICE_TAIL = new Set(['dollars', 'dollar', 'bucks']);

function matchPrice(tokens, i, format) {
  const first = normaliseToken(tokens[i]);
  const hasSymbol = /^\$/.test(tokens[i]?.trim() ?? '');
  const num = readNumber(tokens, i);
  if (!num) return null;

  let end = num.end;
  let scale = 1;
  const next = normaliseToken(tokens[end + 1] ?? '');
  if (next === 'million' || next === 'mil') { scale = 1e6; end += 1; }
  else if (next === 'thousand') { scale = 1e3; end += 1; }

  const tail = normaliseToken(tokens[end + 1] ?? '');
  const hasTail = PRICE_TAIL.has(tail);
  if (hasTail) end += 1;

  const value = num.value * scale;
  // Only claim it as a price when it is unambiguous: a currency symbol, the
  // word "dollars", or a magnitude no bedroom count could reach.
  if (!hasSymbol && !hasTail && value < 10000) return null;
  if (value <= 0) return null;

  return {
    startIndex: i, endIndex: end, concept: /** @type {Concept} */ ('PRICE'),
    text: formatPrice(value, format), rule: `price:${format}`,
  };
}

/** @param {number} value @param {"full"|"short"} format @returns {string} */
export function formatPrice(value, format = 'short') {
  if (format === 'full') return `$${Math.round(value).toLocaleString('en-US')}`;
  if (value >= 1e6) {
    const m = value / 1e6;
    const s = m >= 10 ? m.toFixed(1) : m.toFixed(m % 1 === 0 ? 0 : m * 10 % 1 === 0 ? 1 : 3);
    return `$${s.replace(/\.?0+$/, '')}M`;
  }
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `$${Math.round(value)}`;
}

const AREA_UNITS = [
  { words: ['square', 'metres'], out: 'm²' }, { words: ['square', 'meters'], out: 'm²' },
  { words: ['square', 'metre'], out: 'm²' }, { words: ['square', 'meter'], out: 'm²' },
  { words: ['sqm'], out: 'm²' }, { words: ['m2'], out: 'm²' },
  { words: ['hectares'], out: 'ha' }, { words: ['hectare'], out: 'ha' },
  { words: ['acres'], out: ' ACRES' }, { words: ['acre'], out: ' ACRE' },
];

function matchArea(tokens, i) {
  const num = readNumber(tokens, i);
  if (!num) return null;
  for (const unit of AREA_UNITS) {
    const ok = unit.words.every((w, k) => normaliseToken(tokens[num.end + 1 + k] ?? '') === w);
    if (!ok) continue;
    const end = num.end + unit.words.length;
    const value = num.value % 1 === 0 ? String(num.value) : num.value.toFixed(2).replace(/\.?0+$/, '');
    const concept = /** @type {Concept} */ (unit.out === 'ha' || unit.out.includes('ACRE') ? 'LAND_AREA' : 'FLOOR_AREA');
    return { startIndex: i, endIndex: end, text: `${value}${unit.out}`, concept, rule: `area:${unit.out.trim()}` };
  }
  return null;
}

const COUNT_NOUNS = new Map([
  ['bedroom', 'BEDROOM'], ['bedrooms', 'BEDROOMS'], ['bed', 'BED'], ['beds', 'BEDS'],
  ['bathroom', 'BATHROOM'], ['bathrooms', 'BATHROOMS'], ['bath', 'BATH'], ['baths', 'BATHS'],
  ['garage', 'GARAGE'], ['garages', 'GARAGES'], ['carpark', 'CARPARK'], ['carparks', 'CARPARKS'],
  ['living', 'LIVING'], ['levels', 'LEVELS'], ['level', 'LEVEL'], ['storey', 'STOREY'], ['storeys', 'STOREYS'],
]);

const COUNT_CONCEPT = /** @type {Record<string, Concept>} */ ({
  BEDROOM: 'BEDROOMS', BEDROOMS: 'BEDROOMS', BED: 'BEDROOMS', BEDS: 'BEDROOMS',
  BATHROOM: 'BATHROOMS', BATHROOMS: 'BATHROOMS', BATH: 'BATHROOMS', BATHS: 'BATHROOMS',
  GARAGE: 'CARPARKS', GARAGES: 'CARPARKS', CARPARK: 'CARPARKS', CARPARKS: 'CARPARKS',
  LIVING: 'FEATURE', LEVELS: 'FEATURE', LEVEL: 'FEATURE', STOREY: 'FEATURE', STOREYS: 'FEATURE',
});

function matchCount(tokens, i) {
  const num = readNumber(tokens, i);
  if (!num || num.value > 20 || num.value % 1 !== 0) return null;

  // Allow one adjective between the number and the noun: "four double bedrooms".
  for (const gap of [0, 1]) {
    const idx = num.end + 1 + gap;
    const noun = COUNT_NOUNS.get(normaliseToken(tokens[idx] ?? ''));
    if (!noun) continue;
    if (gap === 1 && isNumeric(tokens[num.end + 1] ?? '')) continue;
    return {
      startIndex: i, endIndex: idx, text: `${num.value} ${noun}`,
      concept: COUNT_CONCEPT[noun] ?? /** @type {Concept} */ ('FEATURE'),
      rule: `count:${noun.toLowerCase()}`,
    };
  }
  return null;
}
