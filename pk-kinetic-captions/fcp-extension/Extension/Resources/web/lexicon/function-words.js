/**
 * Function words.
 *
 * These are the words that carry grammar rather than meaning. They are the
 * "I've always been", "in", "and", "when you" of the brief — the quiet
 * scaffolding that makes a hero word land. The emphasis engine is forbidden
 * from promoting anything in this set, which is the single rule that keeps a
 * caption from turning into ALL CAPS SOUP.
 */

export const FUNCTION_WORDS = new Set([
  // determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'some', 'any', 'each', 'every', 'no', 'another', 'such',
  // pronouns
  'i', 'me', 'we', 'us', 'you', 'he', 'him', 'she', 'it', 'they', 'them',
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
  'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever',
  // auxiliaries and copulas
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'have', 'has', 'had', 'having', 'will', 'would', 'shall', 'should', 'can',
  'could', 'may', 'might', 'must', 'ought', 'let', 'gonna', 'wanna', 'gotta',
  // contracted forms that survive most transcription engines
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd",
  "we're", "we've", "we'll", "we'd", "they're", "they've", "they'll", "they'd",
  "it's", "that's", "there's", "here's", "what's", "who's", "he's", "she's",
  "isn't", "aren't", "wasn't", "weren't", "don't", "doesn't", "didn't",
  "can't", "couldn't", "won't", "wouldn't", "shouldn't", "haven't", "hasn't", "hadn't",
  // prepositions
  'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
  'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'onto', 'upon',
  'within', 'without', 'along', 'across', 'behind', 'beyond', 'near', 'around',
  // conjunctions and connectives
  'and', 'but', 'or', 'nor', 'so', 'yet', 'because', 'as', 'until', 'while',
  'if', 'then', 'than', 'though', 'although', 'unless', 'whether', 'since',
  'when', 'where', 'why', 'how', 'whereas',
  // degree and filler
  'very', 'really', 'quite', 'just', 'only', 'also', 'too', 'even', 'still',
  'well', 'now', 'here', 'there', 'not', "n't", 'all', 'both', 'more', 'most',
  'other', 'own', 'same', 'like', 'get', 'got', 'go', 'going', 'went', 'come',
  'kind', 'sort', 'bit', 'lot', 'thing', 'things', 'stuff', 'way',
  // discourse markers — almost always filler in spoken video
  'um', 'uh', 'er', 'ah', 'oh', 'yeah', 'yep', 'okay', 'ok', 'right', 'look',
  'basically', 'actually', 'literally', 'obviously', 'honestly', 'anyway',
  "you know", 'mean', 'say', 'said', 'know', 'think', 'thought',
]);

/** Words that mark the clause after them as the point being made. */
export const PIVOT_WORDS = new Set([
  'but', 'because', 'however', 'although', 'though', 'yet', 'unless',
  'until', 'whereas', 'instead', 'actually', 'truly', 'genuinely',
]);

/** Intensifiers — they do not get emphasised, they mark the *next* word as hot. */
export const INTENSIFIERS = new Set([
  'very', 'really', 'incredibly', 'absolutely', 'completely', 'totally',
  'extremely', 'seriously', 'genuinely', 'truly', 'massively', 'hugely',
  'super', 'so', 'most', 'best', 'never', 'always', 'every', 'entire', 'whole',
]);

/** @param {string} word @returns {boolean} */
export function isFunctionWord(word) {
  return FUNCTION_WORDS.has(normaliseToken(word));
}

/** Strip punctuation and case for lookup, keeping internal apostrophes. */
export function normaliseToken(word) {
  return String(word).toLowerCase().replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%²$]+$/gu, '');
}
