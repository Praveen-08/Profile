/**
 * Font catalogue and resolution.
 *
 * A template names the family it *wants*. This module decides what the Mac
 * can actually render, because a template built on a machine with Cormorant
 * Garamond installed must not silently fall back to Times on a machine
 * without it — it should fall back to Didot, which is the same design
 * intention. Each entry therefore carries an intention-preserving fallback
 * chain ending in a family that ships with every macOS install.
 *
 * Weight and width availability is declared per family so the typography
 * engine can honour "support where available" rather than requesting a
 * Condensed Black face from a family that has no such thing.
 */

/** @typedef {import('../core/types.js').FontWeight} FontWeight */
/** @typedef {import('../core/types.js').FontWidth} FontWidth */

/**
 * @typedef {object} FamilyEntry
 * @property {string} family
 * @property {"sans"|"serif"|"display"} classification
 * @property {FontWeight[]} weights
 * @property {FontWidth[]} widths
 * @property {boolean} italic
 * @property {string[]} fallbacks
 * @property {number} widthFactor   Mean advance width relative to the reference sans, for measurement.
 * @property {number} capHeight     Cap height as a fraction of point size.
 * @property {boolean} systemMac    Ships with macOS, so it is always safe.
 */

/** @type {FamilyEntry[]} */
export const FAMILIES = [
  {
    family: 'Helvetica Neue', classification: 'sans', systemMac: true,
    weights: ['thin', 'extralight', 'light', 'regular', 'medium', 'bold', 'black'],
    widths: ['condensed', 'normal'], italic: true,
    fallbacks: ['Helvetica', 'Arial'], widthFactor: 1.0, capHeight: 0.714,
  },
  {
    family: 'SF Pro Display', classification: 'sans', systemMac: true,
    weights: ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'],
    widths: ['normal'], italic: true,
    fallbacks: ['SF Pro Text', 'Helvetica Neue'], widthFactor: 1.0, capHeight: 0.7,
  },
  {
    family: 'Avenir Next', classification: 'sans', systemMac: true,
    weights: ['extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold'],
    widths: ['condensed', 'normal'], italic: true,
    fallbacks: ['Avenir', 'Futura', 'Helvetica Neue'], widthFactor: 1.02, capHeight: 0.708,
  },
  {
    family: 'Futura', classification: 'sans', systemMac: true,
    weights: ['medium', 'bold'], widths: ['condensed', 'normal'], italic: true,
    fallbacks: ['Avenir Next', 'Helvetica Neue'], widthFactor: 1.05, capHeight: 0.73,
  },
  {
    family: 'Inter', classification: 'sans', systemMac: false,
    weights: ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'],
    widths: ['normal'], italic: true,
    fallbacks: ['SF Pro Display', 'Helvetica Neue'], widthFactor: 1.0, capHeight: 0.727,
  },
  {
    family: 'Didot', classification: 'serif', systemMac: true,
    weights: ['regular', 'bold'], widths: ['normal'], italic: true,
    fallbacks: ['Bodoni 72', 'Baskerville', 'Times New Roman'], widthFactor: 0.95, capHeight: 0.7,
  },
  {
    family: 'Bodoni 72', classification: 'serif', systemMac: true,
    weights: ['regular', 'bold'], widths: ['normal'], italic: true,
    fallbacks: ['Didot', 'Baskerville'], widthFactor: 0.96, capHeight: 0.7,
  },
  {
    family: 'Baskerville', classification: 'serif', systemMac: true,
    weights: ['regular', 'semibold', 'bold'], widths: ['normal'], italic: true,
    fallbacks: ['Times New Roman', 'Georgia'], widthFactor: 0.97, capHeight: 0.69,
  },
  {
    family: 'Cormorant Garamond', classification: 'serif', systemMac: false,
    weights: ['light', 'regular', 'medium', 'semibold', 'bold'], widths: ['normal'], italic: true,
    fallbacks: ['Didot', 'Baskerville', 'Times New Roman'], widthFactor: 0.88, capHeight: 0.66,
  },
  {
    family: 'Playfair Display', classification: 'serif', systemMac: false,
    weights: ['regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'], widths: ['normal'], italic: true,
    fallbacks: ['Didot', 'Bodoni 72', 'Baskerville'], widthFactor: 0.98, capHeight: 0.7,
  },
  {
    family: 'Georgia', classification: 'serif', systemMac: true,
    weights: ['regular', 'bold'], widths: ['normal'], italic: true,
    fallbacks: ['Times New Roman'], widthFactor: 1.04, capHeight: 0.692,
  },
  {
    family: 'Impact', classification: 'display', systemMac: true,
    weights: ['bold'], widths: ['condensed'], italic: false,
    fallbacks: ['Helvetica Neue'], widthFactor: 0.78, capHeight: 0.72,
  },
];

/** @type {Map<string, FamilyEntry>} */
const BY_NAME = new Map(FAMILIES.map((f) => [f.family.toLowerCase(), f]));

/** Guaranteed-present last resort. */
export const SAFE_FAMILY = 'Helvetica Neue';

/** @param {string} family @returns {FamilyEntry} */
export function familyInfo(family) {
  return BY_NAME.get(String(family).toLowerCase())
    ?? { family, classification: 'sans', systemMac: false, weights: ['regular', 'bold'], widths: ['normal'], italic: true, fallbacks: [SAFE_FAMILY], widthFactor: 1.0, capHeight: 0.71 };
}

/**
 * Pick the best available family.
 * @param {string} wanted
 * @param {Set<string>|null} installed  Lowercased installed family names, or null when unknown.
 * @returns {{family: string, substituted: boolean, note?: string}}
 */
export function resolveFamily(wanted, installed = null) {
  const info = familyInfo(wanted);
  const has = (name) => {
    if (installed) return installed.has(name.toLowerCase());
    return familyInfo(name).systemMac;   // unknown environment: assume only macOS system fonts
  };
  if (installed ? has(wanted) : (info.systemMac || !installed)) {
    if (!installed) return { family: wanted, substituted: false };
    return { family: wanted, substituted: false };
  }
  for (const alt of info.fallbacks) {
    if (has(alt)) return { family: alt, substituted: true, note: `"${wanted}" is not installed; used "${alt}".` };
  }
  return { family: SAFE_FAMILY, substituted: true, note: `"${wanted}" and its fallbacks are not installed; used "${SAFE_FAMILY}".` };
}

/* ------------------------------------------------------------------ *
 * Weight and width resolution
 * ------------------------------------------------------------------ */

/** @type {FontWeight[]} */
export const WEIGHT_ORDER = ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'];

/** @type {Record<FontWeight, number>} */
export const WEIGHT_NUMERIC = {
  thin: 100, extralight: 200, light: 300, regular: 400, medium: 500,
  semibold: 600, bold: 700, extrabold: 800, black: 900,
};

/**
 * Snap a requested weight to the nearest the family actually has, preferring
 * to go heavier when a heavy weight was asked for and lighter when a light
 * one was — so "hero should be Black" degrades to Bold, never to Regular.
 *
 * @param {string} family @param {FontWeight} wanted @returns {FontWeight}
 */
export function resolveWeight(family, wanted) {
  const info = familyInfo(family);
  if (info.weights.includes(wanted)) return wanted;
  const target = WEIGHT_NUMERIC[wanted] ?? 400;
  const available = info.weights.length ? info.weights : /** @type {FontWeight[]} */ (['regular']);
  const prefer = target >= 600 ? 'heavier' : target <= 300 ? 'lighter' : 'either';

  const sorted = [...available].sort((a, b) => Math.abs(WEIGHT_NUMERIC[a] - target) - Math.abs(WEIGHT_NUMERIC[b] - target));
  if (prefer === 'either') return sorted[0];
  const directional = available.filter((w) => (prefer === 'heavier' ? WEIGHT_NUMERIC[w] >= target : WEIGHT_NUMERIC[w] <= target));
  if (directional.length) {
    return directional.sort((a, b) => Math.abs(WEIGHT_NUMERIC[a] - target) - Math.abs(WEIGHT_NUMERIC[b] - target))[0];
  }
  return sorted[0];
}

/** @param {string} family @param {FontWidth} wanted @returns {FontWidth} */
export function resolveWidth(family, wanted) {
  const info = familyInfo(family);
  return info.widths.includes(wanted) ? wanted : 'normal';
}

/** @param {string} family @param {boolean} wanted @returns {boolean} */
export function resolveItalic(family, wanted) {
  return wanted && familyInfo(family).italic;
}

/** Families whose condensed cut macOS installs as a separate family. */
const SEPARATE_CONDENSED = new Set(['Avenir Next']);

/**
 * The family name to write to FCPXML for a family at a width.
 * @param {string} family @param {FontWidth} width
 */
export function exportFamily(family, width) {
  const info = familyInfo(family);
  return width === 'condensed' && SEPARATE_CONDENSED.has(info.family) ? `${info.family} Condensed` : family;
}

/**
 * The FCPXML `fontFace` string. FCP matches these against the installed
 * face names, and gets it wrong quietly if the string is not one a font
 * actually publishes, so the mapping is explicit.
 *
 * @param {string} family @param {FontWeight} weight @param {FontWidth} width @param {boolean} italic
 * @returns {string}
 */
export function faceName(family, weight, width, italic) {
  const info = familyInfo(family);
  const w = {
    thin: 'Thin', extralight: 'UltraLight', light: 'Light', regular: 'Regular',
    medium: 'Medium', semibold: 'Semibold', bold: 'Bold', extrabold: 'Heavy', black: 'Black',
  }[weight] ?? 'Regular';

  // Family-specific naming quirks that FCP is strict about.
  let base = w;
  if (info.family === 'Avenir Next') {
    base = { thin: 'Ultra Light', extralight: 'Ultra Light', light: 'Ultra Light', regular: 'Regular', medium: 'Medium', semibold: 'Demi Bold', bold: 'Bold', extrabold: 'Heavy', black: 'Heavy' }[weight] ?? 'Regular';
  } else if (info.family === 'Helvetica Neue') {
    base = { thin: 'Thin', extralight: 'UltraLight', light: 'Light', regular: 'Regular', medium: 'Medium', semibold: 'Bold', bold: 'Bold', extrabold: 'Bold', black: 'Black' }[weight] ?? 'Regular';
  } else if (info.classification === 'serif' && (weight === 'black' || weight === 'extrabold')) {
    base = 'Bold';
  }

  const parts = [];
  // Avenir Next's condensed cut is a family of its own on macOS ("Avenir
  // Next Condensed" / "Heavy"); see exportFamily. Asking Final Cut for
  // "Avenir Next" / "Condensed Heavy" matched nothing and it drew the word in
  // 6pt Helvetica.
  if (width === 'condensed' && !SEPARATE_CONDENSED.has(info.family)) parts.push('Condensed');
  if (width === 'expanded') parts.push('Expanded');
  if (base !== 'Regular' || parts.length === 0) parts.push(base);
  if (italic) parts.push(base === 'Regular' && parts.length === 1 ? 'Italic' : 'Italic');

  const face = parts.join(' ').replace('Regular Italic', 'Italic').trim();
  return face || 'Regular';
}

/**
 * Scan a Mac's font directories. Returns null off macOS so callers know the
 * answer is "unknown" rather than "nothing is installed".
 * @param {{fs?: any, homedir?: string}} [io]
 * @returns {Promise<Set<string>|null>}
 */
export async function scanInstalledFamilies(io = {}) {
  if (process.platform !== 'darwin') return null;
  const fs = io.fs ?? (await import('node:fs/promises'));
  const os = await import('node:os');
  const path = await import('node:path');
  const dirs = [
    '/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts',
    path.join(io.homedir ?? os.homedir(), 'Library/Fonts'),
  ];
  /** @type {Set<string>} */
  const found = new Set();
  for (const dir of dirs) {
    let entries;
    try { entries = await fs.readdir(dir); } catch { continue; }
    for (const e of entries) {
      const base = e.replace(/\.(ttf|otf|ttc|dfont)$/i, '');
      found.add(base.toLowerCase());
      // "HelveticaNeue.ttc" -> "helvetica neue"; "AvenirNext.ttc" -> "avenir next"
      found.add(base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase());
    }
  }
  return found;
}
