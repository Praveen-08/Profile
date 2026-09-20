/**
 * MY BRAND — the editor's defaults, above any individual template.
 *
 * A template describes a look; a brand describes the person. Keeping them
 * separate means an agency's colours can be applied across several styles
 * without duplicating six templates, and a new template inherits sensible
 * starting values instead of engine defaults.
 */

import fs from 'node:fs/promises';
import { paths } from './store.js';
import { merge } from './schema.js';
import { parseColour, toHex } from '../core/colour.js';

/**
 * @typedef {object} BrandProfile
 * @property {string} name
 * @property {string} primaryColour
 * @property {string} accentColour
 * @property {string} secondaryColour
 * @property {string} preferredFont
 * @property {string} preferredSerif
 * @property {string} [logo]              Absolute path to a logo file.
 * @property {string} [defaultTemplateId]
 * @property {string} [updated]
 */

/** @returns {BrandProfile} */
export function defaultBrand() {
  return {
    name: 'PK Visuals',
    primaryColour: '#f0ede8',
    accentColour: '#c9a84c',
    secondaryColour: '#a9a49b',
    preferredFont: 'Avenir Next',
    preferredSerif: 'Cormorant Garamond',
    defaultTemplateId: 'pk-real-estate',
  };
}

/** @returns {Promise<BrandProfile>} */
export async function loadBrand() {
  try {
    const raw = JSON.parse(await fs.readFile(paths().brand, 'utf8'));
    return merge(defaultBrand(), raw);
  } catch { return defaultBrand(); }
}

/** @param {Partial<BrandProfile>} patch @returns {Promise<BrandProfile>} */
export async function saveBrand(patch) {
  const p = paths();
  await fs.mkdir(p.root, { recursive: true });
  const next = merge(await loadBrand(), { ...patch, updated: new Date().toISOString() });
  for (const key of ['primaryColour', 'accentColour', 'secondaryColour']) {
    if (next[key]) next[key] = toHex(parseColour(next[key]));   // normalise and reject nonsense early
  }
  const tmp = `${p.brand}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, p.brand);
  return next;
}

/**
 * Start a new template from the brand rather than from engine defaults.
 * @param {import('./schema.js').Template} base
 * @param {BrandProfile} brand
 * @returns {import('./schema.js').Template}
 */
export function applyBrand(base, brand) {
  return merge(base, {
    colours: {
      primary: brand.primaryColour,
      accent: brand.accentColour,
      secondary: brand.secondaryColour,
      hero: base.colours.hero === base.colours.accent ? brand.accentColour : base.colours.hero,
    },
    fonts: {
      normal: { family: brand.preferredFont },
      emphasis: { family: brand.preferredFont },
      hero: { family: base.fonts.hero.family === base.fonts.normal.family ? brand.preferredFont : brand.preferredSerif },
    },
    meta: { author: brand.name },
  });
}
