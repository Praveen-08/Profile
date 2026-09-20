/**
 * Template persistence.
 *
 * The brief's mandatory test is that a template saved today survives quitting
 * Final Cut Pro, a new project, a new library and a reboot. That rules out
 * anything stored inside the FCP library or the project, so templates live in
 * the user's Application Support directory, as plain JSON, one file per
 * template.
 *
 * Plain files, not a database, on purpose: an editor can back them up by
 * dragging a folder, and if this tool ever disappears their styles are still
 * readable.
 *
 *   ~/Library/Application Support/PK Visuals/Kinetic Captions/
 *     templates/<id>.json      user templates
 *     thumbnails/<id>.svg      generated previews
 *     brand.json               MY BRAND profile
 *     overrides/<project>.json per-project word overrides
 *
 * Writes are atomic (temp file + rename) so an interrupted save can never
 * leave a half-written template behind.
 */

import { homedir, platform } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { migrateTemplate, validateTemplate, merge, TEMPLATE_VERSION } from './schema.js';
import { BUILTIN_TEMPLATES, BUILTIN_IDS, builtinById } from './builtin/index.js';

/** @typedef {import('./schema.js').Template} Template */

/**
 * Where everything lives. `PKKC_HOME` overrides it, which is what the tests
 * use and what lets a studio point every seat at a shared folder.
 * @returns {string}
 */
export function storeRoot() {
  if (process.env.PKKC_HOME) return path.resolve(process.env.PKKC_HOME);
  const home = homedir();
  if (platform() === 'darwin') return path.join(home, 'Library', 'Application Support', 'PK Visuals', 'Kinetic Captions');
  if (platform() === 'win32') return path.join(process.env.APPDATA ?? home, 'PK Visuals', 'Kinetic Captions');
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, '.config'), 'pk-visuals', 'kinetic-captions');
}

export const paths = () => {
  const root = storeRoot();
  return {
    root,
    templates: path.join(root, 'templates'),
    thumbnails: path.join(root, 'thumbnails'),
    overrides: path.join(root, 'overrides'),
    brand: path.join(root, 'brand.json'),
  };
};

async function ensureDirs() {
  const p = paths();
  await fs.mkdir(p.templates, { recursive: true });
  await fs.mkdir(p.thumbnails, { recursive: true });
  await fs.mkdir(p.overrides, { recursive: true });
  return p;
}

/** Write via a temp file so a crash mid-write cannot corrupt an existing template. */
async function writeAtomic(file, contents) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, contents, 'utf8');
  await fs.rename(tmp, file);
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * Every template the editor can choose from — built-ins first, then theirs.
 * @returns {Promise<{builtin: Template[], user: Template[], problems: string[]}>}
 */
export async function listTemplates() {
  const p = await ensureDirs();
  /** @type {Template[]} */ const user = [];
  /** @type {string[]} */ const problems = [];

  let files = [];
  try { files = await fs.readdir(p.templates); } catch { /* first run */ }

  for (const file of files.filter((f) => f.endsWith('.json'))) {
    const full = path.join(p.templates, file);
    try {
      const raw = JSON.parse(await fs.readFile(full, 'utf8'));
      const { template, notes } = migrateTemplate(raw);
      const check = validateTemplate(template);
      if (!check.ok) { problems.push(`${file}: ${check.errors.join('; ')}`); continue; }
      template.kind = 'user';
      if (notes.length) problems.push(`${file}: ${notes.join(' ')}`);
      user.push(template);
    } catch (err) {
      problems.push(`${file}: ${/** @type {Error} */ (err).message}`);
    }
  }

  user.sort((a, b) => (b.meta.updated ?? '').localeCompare(a.meta.updated ?? '') || a.name.localeCompare(b.name));
  return { builtin: BUILTIN_TEMPLATES, user, problems };
}

/** @param {string} id @returns {Promise<Template|null>} */
export async function getTemplate(id) {
  const builtin = builtinById(id);
  if (builtin) return builtin;
  const p = paths();
  try {
    const raw = JSON.parse(await fs.readFile(path.join(p.templates, `${safeId(id)}.json`), 'utf8'));
    const { template } = migrateTemplate(raw);
    template.kind = 'user';
    return template;
  } catch { return null; }
}

/**
 * Resolve what the editor typed — an id or a name, case-insensitively.
 * @param {string} query @returns {Promise<Template|null>}
 */
export async function resolveTemplate(query) {
  if (!query) return null;
  const direct = await getTemplate(query);
  if (direct) return direct;
  const { builtin, user } = await listTemplates();
  const q = query.trim().toLowerCase();
  return [...user, ...builtin].find((t) => t.name.toLowerCase() === q)
    ?? [...user, ...builtin].find((t) => t.id.toLowerCase() === q)
    ?? [...user, ...builtin].find((t) => t.name.toLowerCase().includes(q))
    ?? null;
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * Save the current configuration as a named user template.
 *
 * Built-in ids are protected: saving over one creates a distinct user
 * template instead of shadowing the built-in, so an engine update can never
 * silently replace someone's style and their style can never break a built-in.
 *
 * @param {Template} template
 * @param {{name?: string, overwrite?: boolean}} [opts]
 * @returns {Promise<{template: Template, file: string, created: boolean}>}
 */
export async function saveTemplate(template, opts = {}) {
  const p = await ensureDirs();
  const name = (opts.name ?? template.name ?? 'Untitled').trim();
  let id = template.kind === 'user' && template.id && !BUILTIN_IDS.has(template.id)
    ? template.id
    : slugify(name);

  if (BUILTIN_IDS.has(id)) id = `${id}-mine`;

  const file = path.join(p.templates, `${safeId(id)}.json`);
  const existed = await exists(file);
  if (existed && !opts.overwrite && !(template.kind === 'user' && template.id === id)) {
    id = await uniqueId(p.templates, id);
  }

  const now = new Date().toISOString();
  const previous = existed ? await readJSON(file) : null;

  /** @type {Template} */
  const saved = merge(template, {
    id: safeId(id), name, kind: 'user', version: TEMPLATE_VERSION,
    basedOn: template.basedOn ?? (BUILTIN_IDS.has(template.id) ? template.id : undefined),
    meta: { ...template.meta, created: previous?.meta?.created ?? template.meta.created ?? now, updated: now },
  });

  const check = validateTemplate(saved);
  if (!check.ok) throw new Error(`Cannot save "${name}":\n  - ${check.errors.join('\n  - ')}`);

  const target = path.join(p.templates, `${saved.id}.json`);
  await writeAtomic(target, `${JSON.stringify(saved, null, 2)}\n`);
  return { template: saved, file: target, created: !(await exists(target)) || !existed };
}

/**
 * Replace a saved template's settings, keeping its identity and created date.
 * @param {string} id @param {Template} settings @returns {Promise<Template>}
 */
export async function updateTemplate(id, settings) {
  if (BUILTIN_IDS.has(id)) throw new Error(`"${id}" is a built-in template and cannot be updated. Duplicate it first.`);
  const current = await getTemplate(id);
  if (!current) throw new Error(`No template with id "${id}".`);
  const { template } = await saveTemplate(merge(settings, { id, name: current.name, kind: 'user', meta: current.meta }), { overwrite: true });
  return template;
}

/**
 * @param {string} id @param {string} newName @returns {Promise<Template>}
 */
export async function duplicateTemplate(id, newName) {
  const source = await getTemplate(id);
  if (!source) throw new Error(`No template with id "${id}".`);
  const { template } = await saveTemplate(
    merge(source, { id: slugify(newName), name: newName, kind: 'user', basedOn: source.id, meta: { ...source.meta, created: undefined, updated: undefined } }),
  );
  return template;
}

/** @param {string} id @returns {Promise<boolean>} */
export async function deleteTemplate(id) {
  if (BUILTIN_IDS.has(id)) throw new Error(`"${id}" is a built-in template and cannot be deleted.`);
  const p = paths();
  try {
    await fs.unlink(path.join(p.templates, `${safeId(id)}.json`));
    await fs.rm(path.join(p.thumbnails, `${safeId(id)}.svg`), { force: true });
    return true;
  } catch { return false; }
}

/* ------------------------------------------------------------------ *
 * Thumbnails
 * ------------------------------------------------------------------ */

/** @param {string} id @param {string} svg @returns {Promise<string>} */
export async function saveThumbnail(id, svg) {
  const p = await ensureDirs();
  const file = path.join(p.thumbnails, `${safeId(id)}.svg`);
  await writeAtomic(file, svg);
  return file;
}

/** @param {string} id @returns {Promise<string|null>} */
export async function readThumbnail(id) {
  try { return await fs.readFile(path.join(paths().thumbnails, `${safeId(id)}.svg`), 'utf8'); }
  catch { return null; }
}

/* ------------------------------------------------------------------ *
 * Per-project word overrides
 * ------------------------------------------------------------------ */

/**
 * Overrides belong to a project, not to a template — that separation is what
 * lets a global style change flow through to every word while an editor's
 * manual decisions on individual words survive it.
 *
 * @param {string} projectKey @returns {Promise<import('../core/types.js').OverrideMap>}
 */
export async function loadOverrides(projectKey) {
  try { return JSON.parse(await fs.readFile(overrideFile(projectKey), 'utf8')); }
  catch { return {}; }
}

/** @param {string} projectKey @param {import('../core/types.js').OverrideMap} overrides */
export async function saveOverrides(projectKey, overrides) {
  await ensureDirs();
  await writeAtomic(overrideFile(projectKey), `${JSON.stringify(overrides, null, 2)}\n`);
  return overrideFile(projectKey);
}

const overrideFile = (key) => path.join(paths().overrides, `${safeId(key)}.json`);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

export function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'template';
}

/**
 * A template id becomes a filename, and ids can arrive from an imported
 * .pkcaption someone else made. Path separators are replaced, parent
 * references are collapsed wherever they appear (not only at the start), and
 * anything that reduces to nothing is refused outright.
 */
export function safeId(id) {
  const clean = String(id)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^[.\-]+/, '')
    .replace(/[.\-]+$/, '')
    .slice(0, 120);
  if (!clean) throw new Error(`Unsafe template id: "${id}"`);
  return clean;
}

async function uniqueId(dir, base) {
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(path.join(dir, `${candidate}.json`)))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readJSON(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}
