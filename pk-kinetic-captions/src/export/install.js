/**
 * Installation and environment checks.
 *
 * There are two things to install, and only one of them is required:
 *
 *   - Nothing, for the default (native) profile. It drives Final Cut's own
 *     Basic Title, so the plugin works on a clean machine.
 *   - The PK Kinetic Caption Motion title, for the pk profile, which adds
 *     true blur, mask reveals and per-character hero animation. It is built
 *     in Motion following docs/motion-template.md and installed here.
 *
 * This module also answers the question that actually bites editors in
 * practice: is the font this template wants present on this Mac?
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir, platform } from 'node:os';
import { scanInstalledFamilies, resolveFamily, familyInfo } from '../engine/fonts.js';
import { storeRoot } from '../templates/store.js';
import { BUILTIN_TEMPLATES } from '../templates/builtin/index.js';

export const TEMPLATE_CATEGORY = 'PK Visuals';
export const TEMPLATE_NAME = 'PK Kinetic Caption';

/** Where Final Cut and Motion look for user title templates. */
export function motionTemplatesDir() {
  if (process.env.PKKC_MOTION_DIR) return path.resolve(process.env.PKKC_MOTION_DIR);
  return path.join(homedir(), 'Movies', 'Motion Templates.localized', 'Titles.localized');
}

export function pkTitleDir() {
  return path.join(motionTemplatesDir(), `${TEMPLATE_CATEGORY}.localized`, `${TEMPLATE_NAME}.localized`);
}

export function pkTitleFile() {
  return path.join(pkTitleDir(), `${TEMPLATE_NAME}.moti`);
}

/**
 * @typedef {object} EnvironmentReport
 * @property {string} platform
 * @property {boolean} isMac
 * @property {string} storeRoot
 * @property {string} motionDir
 * @property {boolean} motionDirExists
 * @property {boolean} pkTitleInstalled
 * @property {Set<string>|null} installedFonts
 * @property {Array<{template: string, level: string, wanted: string, used: string, ok: boolean}>} fonts
 * @property {string[]} notes
 */

/** @returns {Promise<EnvironmentReport>} */
export async function checkEnvironment() {
  const isMac = platform() === 'darwin';
  const motionDir = motionTemplatesDir();
  const installedFonts = await scanInstalledFamilies();
  /** @type {string[]} */
  const notes = [];

  if (!isMac) {
    notes.push(`Running on ${platform()}, not macOS. Plans, previews and FCPXML export all work here; installing the Motion title and detecting fonts need a Mac.`);
  }

  /** @type {EnvironmentReport['fonts']} */
  const fonts = [];
  for (const t of BUILTIN_TEMPLATES) {
    for (const level of /** @type {const} */ (['normal', 'emphasis', 'hero'])) {
      const wanted = t.fonts[level].family;
      const { family: used } = resolveFamily(wanted, installedFonts);
      fonts.push({ template: t.name, level, wanted, used, ok: used === wanted });
    }
  }

  const missing = [...new Set(fonts.filter((f) => !f.ok).map((f) => f.wanted))];
  if (missing.length && installedFonts) {
    notes.push(`Not installed: ${missing.join(', ')}. Those styles fall back to a similar face — install the real fonts for the intended look.`);
  }

  return {
    platform: platform(), isMac, storeRoot: storeRoot(), motionDir,
    motionDirExists: await exists(motionDir),
    pkTitleInstalled: await exists(pkTitleFile()),
    installedFonts, fonts, notes,
  };
}

/**
 * Create the store directories and the Motion Templates category folder so
 * a hand-built title has somewhere obvious to go.
 *
 * @param {{bundle?: string}} [opts] Path to a `.moti` produced in Motion.
 * @returns {Promise<{created: string[], installed: string|null, notes: string[]}>}
 */
export async function install(opts = {}) {
  /** @type {string[]} */ const created = [];
  /** @type {string[]} */ const notes = [];

  for (const dir of [storeRoot(), path.join(storeRoot(), 'templates'), path.join(storeRoot(), 'thumbnails'), path.join(storeRoot(), 'overrides')]) {
    if (!(await exists(dir))) { await fs.mkdir(dir, { recursive: true }); created.push(dir); }
  }

  if (platform() !== 'darwin') {
    notes.push('Skipped the Motion title: that part only applies on macOS. Everything else is ready.');
    return { created, installed: null, notes };
  }

  const dir = pkTitleDir();
  if (!(await exists(dir))) { await fs.mkdir(dir, { recursive: true }); created.push(dir); }

  if (!opts.bundle) {
    notes.push(
      `The PK Motion title is not bundled with this release. The default export profile does not need it.`,
      `To add it: build the title in Motion following docs/motion-template.md, save it to "${TEMPLATE_CATEGORY}" › "${TEMPLATE_NAME}", then export with --profile pk.`,
    );
    return { created, installed: null, notes };
  }

  const src = path.resolve(opts.bundle);
  if (!(await exists(src))) throw new Error(`No Motion title found at ${src}`);
  const dest = pkTitleFile();
  await fs.copyFile(src, dest);
  notes.push(`Installed the PK Motion title. It appears in Final Cut under Titles › ${TEMPLATE_CATEGORY}.`);
  return { created, installed: dest, notes };
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}
