/**
 * .pkcaption — template interchange.
 *
 * One file, one template, plus the thumbnail so a style can be previewed
 * before it is imported. It is JSON inside, but nobody is expected to open
 * it: the envelope carries a magic string and a version so a corrupt or
 * foreign file is rejected with a sentence an editor can act on rather than a
 * JSON parse error.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { migrateTemplate, validateTemplate, merge } from './schema.js';
import { saveTemplate, saveThumbnail, slugify } from './store.js';
import { BUILTIN_IDS } from './builtin/index.js';

export const PACKAGE_MAGIC = 'pk-kinetic-captions';
export const PACKAGE_VERSION = 1;
export const PACKAGE_EXTENSION = '.pkcaption';

/** @typedef {import('./schema.js').Template} Template */

/**
 * @typedef {object} CaptionPackage
 * @property {string} magic
 * @property {number} packageVersion
 * @property {string} exported     ISO date.
 * @property {string} generator
 * @property {Template} template
 * @property {string} [thumbnail]  Inline SVG.
 * @property {object} [brand]
 */

/**
 * @param {Template} template
 * @param {{thumbnail?: string, brand?: object}} [extras]
 * @returns {CaptionPackage}
 */
export function buildPackage(template, extras = {}) {
  return {
    magic: PACKAGE_MAGIC,
    packageVersion: PACKAGE_VERSION,
    exported: new Date().toISOString(),
    generator: 'PK Kinetic Captions 1.1.0',
    template: { ...template, kind: 'user' },
    ...(extras.thumbnail ? { thumbnail: extras.thumbnail } : {}),
    ...(extras.brand ? { brand: extras.brand } : {}),
  };
}

/**
 * @param {Template} template
 * @param {string} destination  A file path, or a directory to write into.
 * @param {{thumbnail?: string, brand?: object}} [extras]
 * @returns {Promise<string>} The file written.
 */
export async function exportTemplate(template, destination, extras = {}) {
  const pkg = buildPackage(template, extras);
  let file = destination;
  const stat = await fs.stat(destination).catch(() => null);
  if (stat?.isDirectory()) file = path.join(destination, `${slugify(template.name)}${PACKAGE_EXTENSION}`);
  if (!file.endsWith(PACKAGE_EXTENSION)) file += PACKAGE_EXTENSION;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return file;
}

/**
 * Read a package without installing it — the UI uses this to show a preview
 * and the style's name before the editor commits.
 *
 * @param {string} file
 * @returns {Promise<{template: Template, thumbnail?: string, notes: string[]}>}
 */
export async function readPackage(file) {
  let raw;
  try { raw = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (err) {
    throw new Error(`"${path.basename(file)}" could not be read as a PK Kinetic Captions template. ${/** @type {Error} */ (err).message}`);
  }

  if (raw?.magic !== PACKAGE_MAGIC) {
    // Tolerate a bare template export — people will inevitably send the JSON.
    if (raw?.fonts && raw?.colours) {
      const { template, notes } = migrateTemplate(raw);
      return { template, notes: [...notes, 'Imported a bare template file rather than a .pkcaption package.'] };
    }
    throw new Error(`"${path.basename(file)}" is not a PK Kinetic Captions template.`);
  }

  if (Number(raw.packageVersion) > PACKAGE_VERSION) {
    throw new Error(`"${path.basename(file)}" was exported by a newer version of PK Kinetic Captions (package v${raw.packageVersion}). Update the plugin and try again.`);
  }

  const { template, notes } = migrateTemplate(raw.template);
  const check = validateTemplate(template);
  if (!check.ok) throw new Error(`"${path.basename(file)}" contains an invalid template:\n  - ${check.errors.join('\n  - ')}`);

  return { template, thumbnail: raw.thumbnail, notes: [...notes, ...check.warnings] };
}

/**
 * Import a package into MY TEMPLATES.
 *
 * An imported template never lands on a built-in id, and by default never
 * silently replaces one of the editor's own — a name clash produces
 * "Luxury Teal 2" rather than destroying their work.
 *
 * @param {string} file
 * @param {{rename?: string, overwrite?: boolean}} [opts]
 * @returns {Promise<{template: Template, notes: string[]}>}
 */
export async function importTemplate(file, opts = {}) {
  const { template, thumbnail, notes } = await readPackage(file);
  const name = opts.rename ?? template.name;
  const incoming = merge(template, {
    id: BUILTIN_IDS.has(template.id) ? `${template.id}-imported` : template.id,
    name, kind: 'user',
  });
  const { template: saved } = await saveTemplate(incoming, { name, overwrite: opts.overwrite === true });
  if (thumbnail) await saveThumbnail(saved.id, thumbnail);
  return { template: saved, notes };
}
