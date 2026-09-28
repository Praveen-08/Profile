/**
 * Typography engine.
 *
 * Resolves a template's font system into concrete, renderable specs, and
 * measures the result so the layout engine can fit type to the frame.
 *
 * Two decisions here matter more than the rest:
 *
 *  - **Sizing is cap-height-based, not point-based.** `scale.base` is the cap
 *    height of a normal word as a fraction of frame height. Point size is
 *    derived per family. Without this, switching the hero font from Helvetica
 *    to Cormorant (cap height 0.714 vs 0.66) silently shrinks every hero word
 *    by 8%, and the editor has to re-tune the whole template.
 *
 *  - **Measurement is metric-modelled, not rendered.** There is no font
 *    rasteriser in the pipeline, so widths come from a calibrated advance
 *    table. It is accurate to a few percent, which is enough to decide line
 *    breaks and to shrink-to-fit with a safety margin.
 *
 * @typedef {import('../core/types.js').FontSpec} FontSpec
 * @typedef {import('../core/types.js').Level} Level
 * @typedef {import('../templates/schema.js').Template} Template
 */

import { familyInfo, resolveFamily, resolveWeight, resolveWidth, resolveItalic, WEIGHT_NUMERIC } from './fonts.js';

/** Advance widths per 1000 em for the reference sans (Helvetica Regular). */
const ADVANCE = (() => {
  /** @type {Record<string, number>} */
  const m = {};
  const set = (chars, w) => { for (const c of chars) m[c] = w; };
  set('abcdeghknopqsuvxyz', 556);
  set('cs', 500); set('kvxyz', 500);
  set('fijlt', 260); set('i', 222); set('l', 222); set('j', 222); set('f', 278); set('t', 278);
  set('r', 333); set('m', 833); set('w', 722);
  set('ABDEHKNRUX', 700); set('A', 667); set('B', 667); set('D', 722); set('E', 667);
  set('C', 722); set('F', 611); set('G', 778); set('H', 722); set('I', 278); set('J', 500);
  set('K', 667); set('L', 556); set('M', 833); set('N', 722); set('O', 778); set('P', 667);
  set('Q', 778); set('R', 722); set('S', 667); set('T', 611); set('U', 722); set('V', 667);
  set('W', 944); set('X', 667); set('Y', 667); set('Z', 611);
  set('0123456789', 556);
  set(' ', 278); set('.', 278); set(',', 278); set(':', 278); set(';', 278);
  set("'", 191); set('"', 355); set('!', 278); set('?', 556); set('-', 333); set('–', 556);
  set('—', 1000); set('(', 333); set(')', 333); set('[', 278); set(']', 278);
  set('$', 556); set('%', 889); set('&', 667); set('/', 278); set('²', 400); set('°', 400);
  set('€', 556); set('£', 556); set('+', 584); set('=', 584); set('#', 556); set('@', 1015);
  return m;
})();

const DEFAULT_ADVANCE = 556;

/** Weight widens a face; condensing narrows it. Calibrated against Helvetica Neue's real faces. */
function weightFactor(weight) {
  const n = WEIGHT_NUMERIC[weight] ?? 400;
  return 1 + (n - 400) / 400 * 0.09;
}
function widthFactor(width) {
  return width === 'condensed' ? 0.80 : width === 'expanded' ? 1.18 : 1.0;
}

/**
 * Width of a string in em units at 1pt.
 * @param {string} text @param {FontSpec} font @returns {number}
 */
export function measureEm(text, font) {
  const info = familyInfo(font.family);
  const cased = applyCasing(text, font.casing);
  let sum = 0;
  for (const ch of cased) sum += (ADVANCE[ch] ?? DEFAULT_ADVANCE) / 1000;
  // Tracking in FCP is 1/1000 em per gap, applied between characters.
  sum += ((font.tracking ?? 0) / 1000) * Math.max(0, [...cased].length - 1);
  const italicBump = font.italic && info.classification === 'serif' ? 0.98 : 1.0;
  return Math.max(0, sum * info.widthFactor * weightFactor(font.weight) * widthFactor(font.width) * italicBump);
}

/** @param {string} text @param {FontSpec} font @param {number} sizePt @returns {number} */
export const measureWidth = (text, font, sizePt) => measureEm(text, font) * sizePt;

/** @param {FontSpec} font @param {number} sizePt @returns {number} Cap height in points. */
export const capHeightOf = (font, sizePt) => familyInfo(font.family).capHeight * sizePt;

/** @param {FontSpec} font @param {number} sizePt @returns {number} Line box height. */
export const lineHeightOf = (font, sizePt) => sizePt * (font.lineHeight ?? 1.05);

/**
 * Units are not words. Uppercasing "650m²" to "650M²" is simply wrong — the
 * SI symbol is lowercase — and a listing caption that gets its own units
 * wrong undermines everything else on screen.
 */
/** @type {Array<[RegExp, string]>} */
const UNIT_FIXUPS = [[/(\d)M²/g, '$1m²'], [/(\d)M2/g, '$1m²'], [/(\d)KM/g, '$1km'], [/(\d)SQM/g, '$1m²']];

/** @param {string} text @param {FontSpec['casing']} casing @returns {string} */
export function applyCasing(text, casing) {
  switch (casing) {
    case 'upper': {
      let t = text.toLocaleUpperCase();
      for (const [re, to] of UNIT_FIXUPS) t = t.replace(re, to);
      return t;
    }
    case 'lower': return text.toLocaleLowerCase();
    case 'title': return text.replace(/\p{L}[\p{L}']*/gu, (w) => w[0].toLocaleUpperCase() + w.slice(1).toLocaleLowerCase());
    default: return text;
  }
}

/* ------------------------------------------------------------------ *
 * Resolution against a template
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} ResolvedType
 * @property {Record<Level, FontSpec>} fonts
 * @property {Record<Level, number>} sizes     Point size at the frame's height.
 * @property {string[]} warnings
 */

/**
 * Turn a template's font system into concrete faces and point sizes for a
 * given frame.
 *
 * @param {Template} template
 * @param {{width: number, height: number}} frame
 * @param {Set<string>|null} [installed]
 * @returns {ResolvedType}
 */
export function resolveTypography(template, frame, installed = null) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {any} */ const fonts = {};
  /** @type {any} */ const sizes = {};

  for (const level of /** @type {Level[]} */ (['normal', 'emphasis', 'hero'])) {
    const wanted = template.fonts[level];
    const { family, note } = resolveFamily(wanted.family, installed);
    if (note) warnings.push(`${level}: ${note}`);

    const weight = resolveWeight(family, wanted.weight);
    if (weight !== wanted.weight) warnings.push(`${level}: "${family}" has no ${wanted.weight}; used ${weight}.`);
    const width = resolveWidth(family, wanted.width);
    if (width !== wanted.width) warnings.push(`${level}: "${family}" has no ${wanted.width} width; used normal.`);
    const italic = resolveItalic(family, wanted.italic);
    if (wanted.italic && !italic) warnings.push(`${level}: "${family}" has no italic; set upright.`);

    /** @type {FontSpec} */
    const spec = { ...wanted, family, weight, width, italic };
    fonts[level] = spec;

    // Cap-height-normalised sizing keeps the visual hierarchy identical
    // across font pairings. The reference is the frame's SHORT edge, so a
    // style reads at the same physical weight in 9:16 and 16:9 instead of
    // doubling in size when the editor switches to portrait.
    const targetCap = template.scale.base * template.scale[level] * referenceEdge(frame);
    const pt = targetCap / familyInfo(family).capHeight;
    sizes[level] = clampSize(pt, template);
  }

  return { fonts, sizes, warnings };
}

/** @param {{width:number,height:number}} frame @returns {number} */
export const referenceEdge = (frame) => Math.min(frame.width, frame.height);

/** @param {number} pt @param {Template} t @returns {number} */
export function clampSize(pt, t) {
  const lo = t.scale.minPt ?? 12, hi = t.scale.maxPt ?? 800;
  return Math.round(Math.min(hi, Math.max(lo, pt)) * 10) / 10;
}

/**
 * Shrink a word until it fits the available width. Kinetic hero words are
 * routinely 2-3x normal, and on a 9:16 frame a long hero word will not fit at
 * its nominal size — shrinking it is always better than letting it run off
 * the frame or wrapping a single word.
 *
 * @param {string} text @param {FontSpec} font @param {number} sizePt @param {number} maxWidthPx
 * @returns {{size: number, fitted: boolean, width: number}}
 */
export function fitToWidth(text, font, sizePt, maxWidthPx) {
  const em = measureEm(text, font);
  if (em <= 0) return { size: sizePt, fitted: true, width: 0 };
  const natural = em * sizePt;
  if (natural <= maxWidthPx) return { size: sizePt, fitted: true, width: natural };
  const size = Math.floor((maxWidthPx / em) * 10) / 10;
  return { size, fitted: false, width: em * size };
}

/**
 * Greedy line breaking within a width budget, never splitting a word.
 * @param {Array<{text:string, font:FontSpec, size:number, gap:number}>} items
 * @param {number} maxWidthPx
 * @param {number} maxLines
 * @returns {Array<Array<{text:string, font:FontSpec, size:number, gap:number, width:number}>>}
 */
export function breakLines(items, maxWidthPx, maxLines) {
  /** @type {any[][]} */
  const lines = [[]];
  let width = 0;
  for (const item of items) {
    const w = measureWidth(item.text, item.font, item.size);
    const gap = lines[lines.length - 1].length ? item.gap : 0;
    if (width + gap + w > maxWidthPx && lines[lines.length - 1].length > 0 && lines.length < maxLines) {
      lines.push([]);
      width = 0;
    }
    lines[lines.length - 1].push({ ...item, width: w });
    width += (lines[lines.length - 1].length > 1 ? item.gap : 0) + w;
  }
  return lines;
}
