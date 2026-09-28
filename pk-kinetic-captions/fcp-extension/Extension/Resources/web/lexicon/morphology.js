/**
 * Lightweight part-of-speech and shape heuristics.
 *
 * A real POS tagger would be a model download and a runtime dependency. For
 * deciding which of six words in a phrase deserves to be 200pt, English
 * suffix morphology plus the function-word list gets us most of the way, runs
 * in microseconds, and — critically — is inspectable: when an editor asks why
 * a word got promoted, there is a reason to show them.
 */

import { isFunctionWord, normaliseToken, INTENSIFIERS } from './function-words.js';

/** @typedef {"noun"|"verb"|"adjective"|"adverb"|"number"|"function"|"unknown"} PartOfSpeech */

const NOUN_SUFFIXES = ['tion', 'sion', 'ment', 'ness', 'ity', 'ship', 'hood', 'ance', 'ence', 'ist', 'ism', 'ure', 'age', 'dom', 'or', 'er'];
const VERB_SUFFIXES = ['ise', 'ize', 'ify', 'ate', 'en'];
const ADJ_SUFFIXES = ['ous', 'ful', 'less', 'able', 'ible', 'ive', 'ic', 'al', 'ish', 'ant', 'ent', 'y'];
const ADV_SUFFIXES = ['ly'];

/** Strong verbs that read as action in an agent-to-camera video. */
const STRONG_VERBS = new Set([
  'build', 'built', 'create', 'created', 'design', 'designed', 'sell', 'sold',
  'buy', 'bought', 'win', 'won', 'grow', 'grew', 'launch', 'launched',
  'transform', 'transformed', 'deliver', 'delivered', 'negotiate', 'negotiated',
  'renovate', 'renovated', 'invest', 'invested', 'develop', 'developed',
  'discover', 'search', 'searching', 'found', 'compete', 'achieve', 'achieved',
  'lead', 'led', 'move', 'moved', 'move', 'list', 'listed', 'settle', 'settled',
]);

/** Adjectives with enough charge to carry a hero word. */
const STRONG_ADJECTIVES = new Set([
  'competitive', 'stunning', 'beautiful', 'incredible', 'exceptional', 'rare',
  'perfect', 'huge', 'massive', 'private', 'quiet', 'bright', 'spacious',
  'modern', 'classic', 'elegant', 'iconic', 'premium', 'exclusive', 'prestige',
  'immaculate', 'pristine', 'expansive', 'dramatic', 'breathtaking', 'sunny',
  'north-facing', 'elevated', 'secluded', 'walkable', 'central',
]);

/**
 * Common nouns the suffix rules mis-tag. "estate" is not a verb because it
 * ends in -ate, and in a real-estate video it is one of the words most likely
 * to become a hero word, so getting it wrong is expensive.
 */
const NOUN_OVERRIDES = new Set([
  'estate', 'property', 'properties', 'home', 'homes', 'house', 'houses',
  'apartment', 'apartments', 'listing', 'listings', 'market', 'client',
  'clients', 'buyer', 'buyers', 'seller', 'sellers', 'agent', 'agents',
  'business', 'sport', 'sports', 'team', 'family', 'families', 'space',
  'light', 'view', 'views', 'land', 'street', 'suburb', 'city', 'deal', 'deals',
  'rate', 'rates', 'price', 'prices', 'value', 'values', 'offer', 'offers',
  'plate', 'gate', 'state', 'date', 'garden', 'gardens', 'kitchen', 'room', 'rooms',
]);

/**
 * @param {string} raw
 * @returns {{pos: PartOfSpeech, token: string, reasons: string[]}}
 */
export function analyse(raw) {
  const token = normaliseToken(raw);
  /** @type {string[]} */
  const reasons = [];
  if (!token) return { pos: 'unknown', token, reasons };

  if (isNumeric(raw)) { reasons.push('numeric'); return { pos: 'number', token, reasons }; }
  if (isFunctionWord(token)) { reasons.push('function-word'); return { pos: 'function', token, reasons }; }

  if (NOUN_OVERRIDES.has(token)) { reasons.push('known-noun'); return { pos: 'noun', token, reasons }; }
  if (STRONG_VERBS.has(token)) { reasons.push('strong-verb'); return { pos: 'verb', token, reasons }; }
  if (STRONG_ADJECTIVES.has(token)) { reasons.push('strong-adjective'); return { pos: 'adjective', token, reasons }; }

  const suffix = (list) => list.find((s) => token.length > s.length + 2 && token.endsWith(s));

  const adv = suffix(ADV_SUFFIXES);
  if (adv) { reasons.push(`suffix:-${adv}`); return { pos: 'adverb', token, reasons }; }

  const adj = suffix(ADJ_SUFFIXES);
  if (adj) { reasons.push(`suffix:-${adj}`); return { pos: 'adjective', token, reasons }; }

  const verb = suffix(VERB_SUFFIXES);
  if (verb) { reasons.push(`suffix:-${verb}`); return { pos: 'verb', token, reasons }; }

  const noun = suffix(NOUN_SUFFIXES);
  if (noun) { reasons.push(`suffix:-${noun}`); return { pos: 'noun', token, reasons }; }

  if (/(ing|ed)$/.test(token) && token.length > 5) { reasons.push('inflected'); return { pos: 'verb', token, reasons }; }

  // Default for a content word: treat it as a noun. Nouns are the safe
  // emphasis candidate — a mis-tagged noun still reads as a keyword.
  reasons.push('content-word');
  return { pos: 'noun', token, reasons };
}

/** @param {string} raw @returns {boolean} A digit, currency amount, measurement or written number. */
export function isNumeric(raw) {
  const t = String(raw).trim();
  if (/[\d]/.test(t)) return true;
  return WRITTEN_NUMBERS.has(normaliseToken(t));
}

export const WRITTEN_NUMBERS = new Map([
  ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
  ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
  ['nineteen', 19], ['twenty', 20], ['thirty', 30], ['forty', 40],
  ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80], ['ninety', 90],
  ['hundred', 100], ['thousand', 1000], ['million', 1e6], ['billion', 1e9],
]);

/**
 * A proper noun in the middle of a sentence is a name or a place, and both
 * are strong emphasis candidates. Sentence-initial capitals are ignored, and
 * fully-uppercase tokens are ignored too because plenty of transcription
 * engines shout.
 *
 * @param {string} raw
 * @param {boolean} isSentenceStart
 * @returns {boolean}
 */
export function looksProper(raw, isSentenceStart) {
  const t = String(raw).replace(/^[^\p{L}]+/u, '');
  if (!t || isSentenceStart) return false;
  if (t === t.toUpperCase() && t.length > 1) return false;
  return /^\p{Lu}/u.test(t);
}

/** @param {string} raw @returns {boolean} */
export const isIntensifier = (raw) => INTENSIFIERS.has(normaliseToken(raw));

/** @param {string} raw @returns {boolean} Ends a clause. */
export const endsClause = (raw) => /[.!?;:,—–]$/.test(String(raw).trim());

/** @param {string} raw @returns {boolean} Ends a sentence outright. */
export const endsSentence = (raw) => /[.!?]["')\]]?$/.test(String(raw).trim());
