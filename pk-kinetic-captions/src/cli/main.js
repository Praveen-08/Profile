/**
 * `pkkc` — the command line.
 *
 * The UI is the product; this is the engine room. It exists so the whole
 * pipeline is scriptable (batch a folder of listings, regenerate every
 * thumbnail, run the template persistence test) and so anything the UI can
 * do can be done without it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, numberOr, oneOf } from './args.js';
import { ingest } from '../transcript/ingest.js';
import { compose, describePlan } from '../engine/compose.js';
import { exportFCPXML } from '../export/fcpxml.js';
import { renderContactSheet, renderFrame } from '../render/svg.js';
import { renderThumbnail, renderSwatch } from '../templates/thumbnail.js';
import { merge, validateTemplate } from '../templates/schema.js';
import { BUILTIN_TEMPLATES, builtinById } from '../templates/builtin/index.js';
import * as store from '../templates/store.js';
import { exportTemplate, importTemplate, readPackage } from '../templates/package.js';
import { loadBrand, saveBrand, applyBrand } from '../templates/brand.js';
import { checkEnvironment, install } from '../export/install.js';
import { scanInstalledFamilies } from '../engine/fonts.js';
import { parseColour, toHex, generatePalette, harmonies } from '../core/colour.js';

const ASPECTS = /** @type {const} */ (['9:16', '16:9', '4:5', '1:1']);
const DENSITIES = /** @type {const} */ (['low', 'medium', 'high']);
const EMPHASIS = /** @type {const} */ (['subtle', 'balanced', 'strong']);
const ANIMATIONS = /** @type {const} */ (['minimal', 'smooth', 'editorial', 'cinematic', 'luxury', 'punchy', 'energetic']);
const INTERACTIONS = /** @type {const} */ (['clean', 'invert', 'cinematic', 'ghost', 'editorial', 'knockout', 'luminous', 'ink']);
const POSITIONS = /** @type {const} */ (['static', 'dynamic', 'subjectAware', 'manual']);

const DEFAULT_DIMENSIONS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '4:5': [1080, 1350], '1:1': [1080, 1080] };

/** @param {string[]} argv */
export async function run(argv) {
  const { command, positional, flags } = parseArgs(argv);
  switch (command) {
    case 'generate': case 'gen': return cmdGenerate(positional, flags);
    case 'preview': return cmdPreview(positional, flags);
    case 'templates': case 'ls': return cmdTemplates(flags);
    case 'show': return cmdShow(positional);
    case 'save': return cmdSave(positional, flags);
    case 'duplicate': case 'dup': return cmdDuplicate(positional);
    case 'delete': case 'rm': return cmdDelete(positional, flags);
    case 'export-template': return cmdExportTemplate(positional);
    case 'import-template': return cmdImportTemplate(positional, flags);
    case 'thumbnails': return cmdThumbnails(flags);
    case 'brand': return cmdBrand(flags);
    case 'palette': return cmdPalette(positional, flags);
    case 'check': return cmdCheck();
    case 'install': return cmdInstall(flags);
    case 'where': return cmdWhere();
    case 'ui': return cmdUI(flags);
    case 'app': return cmdApp(flags);
    case 'demo': return cmdDemo(flags);
    case 'help': case '--help': case '-h': default: return usage();
  }
}

/* ------------------------------------------------------------------ *
 * generate
 * ------------------------------------------------------------------ */

async function cmdGenerate(positional, flags) {
  const source = positional[0];
  if (!source) return fail('Usage: pkkc generate <transcript> [--template NAME] [--accent HEX] [--out DIR]');

  const { plan, template, warnings } = await buildPlan(source, flags);
  const outDir = String(flags.out ?? path.join(process.cwd(), 'pk-captions'));
  await fs.mkdir(outDir, { recursive: true });

  const stem = flags.name ? String(flags.name) : path.basename(source).replace(/\.[^.]+$/, '') || 'captions';
  const profile = /** @type {"native"|"pk"} */ (oneOf(flags.profile, ['native', 'pk'], 'profile') ?? 'native');

  const fcp = exportFCPXML(plan, { projectName: `${stem} — ${template.name}`, profile });
  const xmlPath = path.join(outDir, `${stem}.fcpxml`);
  await fs.writeFile(xmlPath, fcp.xml, 'utf8');

  const planPath = path.join(outDir, `${stem}.plan.json`);
  await fs.writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

  let sheetPath = null;
  if (flags.preview !== false) {
    sheetPath = path.join(outDir, `${stem}.preview.svg`);
    await fs.writeFile(sheetPath, renderContactSheet(plan, { count: numberOr(flags.frames, 12), columns: numberOr(flags.columns, 4) }), 'utf8');
  }

  console.log(describePlan(plan));
  console.log('');
  console.log(`  FCPXML   ${xmlPath}`);
  console.log(`  Plan     ${planPath}`);
  if (sheetPath) console.log(`  Preview  ${sheetPath}`);
  console.log(`  ${fcp.stats.titles} title clips across ${fcp.stats.lanes} lanes, ${fcp.stats.duration.toFixed(2)}s.`);
  for (const w of [...warnings, ...fcp.warnings]) console.log(`  ! ${w}`);
  console.log('');
  console.log('  Next: in Final Cut, File › Import › XML…, then copy the caption clips onto your timeline.');
}

async function cmdPreview(positional, flags) {
  const source = positional[0];
  if (!source) return fail('Usage: pkkc preview <transcript> [--template NAME] [--time 2.5] [--out FILE]');
  const { plan } = await buildPlan(source, flags);
  const out = String(flags.out ?? 'preview.svg');
  const svg = flags.time !== undefined
    ? renderFrame(plan, { time: numberOr(flags.time, 0), scale: 1, guides: flags.guides === true })
    : renderContactSheet(plan, { count: numberOr(flags.frames, 12), columns: numberOr(flags.columns, 4) });
  await fs.writeFile(out, svg, 'utf8');
  console.log(`Wrote ${out}`);
}

/**
 * Shared by generate and preview: resolve the template, apply the quick-mode
 * flags over it, and compose.
 */
async function buildPlan(source, flags) {
  const raw = await fs.readFile(source, 'utf8');
  const transcript = ingest(raw, {
    format: /** @type {any} */ (oneOf(flags.format, ['srt', 'vtt', 'json', 'whisper', 'fcpxml', 'text'], 'format')),
    wpm: numberOr(flags.wpm, 150),
  });

  const wanted = flags.template ? String(flags.template) : (await loadBrand()).defaultTemplateId;
  const base = (await store.resolveTemplate(String(wanted))) ?? builtinById('pk-real-estate');
  if (!base) return fail(`No template matching "${wanted}". Run: pkkc templates`);

  const template = merge(base, patchFromFlags(flags));
  const check = validateTemplate(template);
  if (!check.ok) return fail(`Template is invalid:\n  - ${check.errors.join('\n  - ')}`);

  const aspect = /** @type {any} */ (oneOf(flags.aspect, ASPECTS, 'aspect') ?? '9:16');
  const [dw, dh] = DEFAULT_DIMENSIONS[aspect];
  const frame = {
    width: numberOr(flags.width, dw),
    height: numberOr(flags.height, dh),
    fps: numberOr(flags.fps, 30),
    aspect,
    safeArea: flags.safeArea !== false,
  };

  const shots = flags.shots ? JSON.parse(await fs.readFile(String(flags.shots), 'utf8')) : undefined;
  const overrides = flags.overrides ? JSON.parse(await fs.readFile(String(flags.overrides), 'utf8')) : undefined;
  const corrections = flags.corrections ? JSON.parse(await fs.readFile(String(flags.corrections), 'utf8')) : undefined;

  const plan = compose({
    transcript, template, frame, shots, overrides, corrections,
    accent: flags.accent ? toHex(parseColour(String(flags.accent))) : undefined,
    generatePaletteFromAccent: flags.palette === true,
    installedFonts: await scanInstalledFamilies(),
    capabilities: flags.profile === 'pk' ? { blur: true, perCharacter: true, maskReveal: true } : undefined,
  });

  return { plan, template, warnings: [...check.warnings, ...plan.warnings] };
}

/** Quick-mode flags map onto the template rather than onto the engine. */
function patchFromFlags(flags) {
  /** @type {any} */
  const patch = { hierarchy: {}, motion: {}, position: {}, interaction: {}, realEstate: {}, colours: {}, decoration: { glow: {}, outline: {}, shadow: {} } };

  const density = oneOf(flags.density, DENSITIES, 'density');
  if (density) patch.hierarchy.captionDensity = density;
  const emphasis = oneOf(flags.emphasis, EMPHASIS, 'emphasis');
  if (emphasis) patch.hierarchy.emphasisDensity = emphasis;
  if (flags.autoEmphasis === false) patch.hierarchy.autoEmphasis = false;

  const animation = oneOf(flags.animation, ANIMATIONS, 'animation');
  if (animation) patch.motion.style = animation;
  if (flags.speed !== undefined) patch.motion.speed = numberOr(flags.speed, 1);

  const position = oneOf(flags.position, POSITIONS, 'position');
  if (position) patch.position.mode = position;
  if (flags.faceAvoidance === false) patch.position.faceAvoidance = false;

  const interaction = oneOf(flags.interaction, INTERACTIONS, 'interaction');
  if (interaction) patch.interaction.preset = interaction;
  const heroInteraction = oneOf(flags.heroInteraction, INTERACTIONS, 'hero-interaction');
  if (heroInteraction) patch.interaction.heroPreset = heroInteraction;
  if (flags.behindSubject !== undefined) patch.interaction.heroBehindSubject = flags.behindSubject !== false;

  if (flags.realEstate !== undefined) patch.realEstate.enabled = flags.realEstate !== false;
  if (flags.normalise !== undefined || flags.normalize !== undefined) {
    patch.realEstate.collapse = (flags.normalise ?? flags.normalize) !== false;
  }
  const priceFormat = oneOf(flags.priceFormat, ['full', 'short'], 'price-format');
  if (priceFormat) patch.realEstate.priceFormat = priceFormat;

  if (flags.accent && flags.palette !== true) patch.colours.accent = toHex(parseColour(String(flags.accent)));
  if (flags.glow !== undefined) patch.decoration.glow.enabled = flags.glow !== false;
  if (flags.outline !== undefined) patch.decoration.outline.enabled = flags.outline !== false;
  if (flags.shadow !== undefined) patch.decoration.shadow.enabled = flags.shadow !== false;
  if (flags.scale !== undefined) patch.scale = { base: numberOr(flags.scale, 0.048) };

  return patch;
}

/* ------------------------------------------------------------------ *
 * templates
 * ------------------------------------------------------------------ */

async function cmdTemplates(flags) {
  const { builtin, user, problems } = await store.listTemplates();
  const row = (t) => `  ${t.id.padEnd(24)} ${t.name.padEnd(22)} ${t.fonts.normal.family} / ${t.fonts.hero.family}${t.fonts.hero.italic ? ' italic' : ''}`;

  console.log('\nBUILT-IN');
  for (const t of builtin) console.log(row(t));
  console.log('\nMY TEMPLATES');
  if (!user.length) console.log('  (none yet — pkkc save "Luxury Teal" --template pk-luxury --accent "#14b8a6")');
  for (const t of user) console.log(`${row(t)}${t.basedOn ? `   ← ${t.basedOn}` : ''}`);
  console.log(`\n  Stored in ${store.paths().templates}`);
  if (problems.length) { console.log('\n  Problems:'); for (const p of problems) console.log(`    ! ${p}`); }
  if (flags.json) console.log(JSON.stringify({ builtin, user }, null, 2));
  console.log('');
}

async function cmdShow(positional) {
  const t = await store.resolveTemplate(positional[0] ?? '');
  if (!t) return fail(`No template matching "${positional[0]}".`);
  console.log(JSON.stringify(t, null, 2));
}

async function cmdSave(positional, flags) {
  const name = positional[0];
  if (!name) return fail('Usage: pkkc save "Luxury Teal" [--template pk-luxury] [--accent "#14b8a6"] [...style flags]');

  const baseName = flags.template ? String(flags.template) : 'pk-real-estate';
  const base = await store.resolveTemplate(baseName);
  if (!base) return fail(`No template matching "${baseName}".`);

  const brand = await loadBrand();
  const withBrand = flags.brand === true ? applyBrand(base, brand) : base;
  const template = merge(withBrand, patchFromFlags(flags));

  const { template: saved, file } = await store.saveTemplate(template, { name, overwrite: flags.overwrite === true });
  await store.saveThumbnail(saved.id, renderThumbnail(saved));
  console.log(`Saved "${saved.name}" (${saved.id})\n  ${file}`);
}

async function cmdDuplicate(positional) {
  const [id, name] = positional;
  if (!id || !name) return fail('Usage: pkkc duplicate <id> "New Name"');
  const t = await store.duplicateTemplate(id, name);
  await store.saveThumbnail(t.id, renderThumbnail(t));
  console.log(`Duplicated to "${t.name}" (${t.id})`);
}

async function cmdDelete(positional, flags) {
  const id = positional[0];
  if (!id) return fail('Usage: pkkc delete <id> --yes');
  if (flags.yes !== true) return fail(`This permanently deletes "${id}". Re-run with --yes to confirm.`);
  console.log(await store.deleteTemplate(id) ? `Deleted "${id}".` : `No user template with id "${id}".`);
}

async function cmdExportTemplate(positional) {
  const [id, dest] = positional;
  if (!id) return fail('Usage: pkkc export-template <id> [destination]');
  const t = await store.resolveTemplate(id);
  if (!t) return fail(`No template matching "${id}".`);
  const file = await exportTemplate(t, dest ?? process.cwd(), { thumbnail: renderThumbnail(t, { height: 640 }) });
  console.log(`Exported "${t.name}" to ${file}`);
}

async function cmdImportTemplate(positional, flags) {
  const file = positional[0];
  if (!file) return fail('Usage: pkkc import-template <file.pkcaption> [--rename "New Name"]');
  const preview = await readPackage(file);
  const { template, notes } = await importTemplate(file, { rename: flags.rename ? String(flags.rename) : undefined, overwrite: flags.overwrite === true });
  console.log(`Imported "${preview.template.name}" as "${template.name}" (${template.id})`);
  for (const n of notes) console.log(`  ! ${n}`);
}

async function cmdThumbnails(flags) {
  const { builtin, user } = await store.listTemplates();
  const all = flags.userOnly === true ? user : [...builtin, ...user];
  for (const t of all) {
    await store.saveThumbnail(t.id, renderThumbnail(t, { height: numberOr(flags.height, 960) }));
    if (flags.swatch === true) await store.saveThumbnail(`${t.id}-swatch`, renderSwatch(t));
  }
  console.log(`Wrote ${all.length} thumbnails to ${store.paths().thumbnails}`);
}

/* ------------------------------------------------------------------ *
 * brand, colour, environment
 * ------------------------------------------------------------------ */

async function cmdBrand(flags) {
  const keys = ['name', 'primaryColour', 'accentColour', 'secondaryColour', 'preferredFont', 'preferredSerif', 'logo', 'defaultTemplateId'];
  const patch = {};
  for (const k of keys) if (flags[k] !== undefined) patch[k] = String(flags[k]);
  const brand = Object.keys(patch).length ? await saveBrand(patch) : await loadBrand();
  console.log('\nMY BRAND');
  for (const [k, v] of Object.entries(brand)) console.log(`  ${k.padEnd(18)} ${v}`);
  console.log(`\n  ${store.paths().brand}\n`);
}

async function cmdPalette(positional, flags) {
  const input = positional[0];
  if (!input) return fail('Usage: pkkc palette "#14b8a6" [--mood luxury]');
  const mood = /** @type {any} */ (oneOf(flags.mood, ['neutral', 'luxury', 'social'], 'mood') ?? 'neutral');
  const p = generatePalette(input, { mood });
  console.log(`\nPalette from ${toHex(parseColour(input))} (${mood})`);
  for (const [k, v] of Object.entries(p)) console.log(`  ${k.padEnd(10)} ${toHex(v)}`);
  console.log('\nHarmonies');
  for (const [k, v] of Object.entries(harmonies(input))) console.log(`  ${k.padEnd(14)} ${toHex(v)}`);
  console.log('');
}

async function cmdCheck() {
  const r = await checkEnvironment();
  console.log(`\nPK Kinetic Captions — environment\n`);
  console.log(`  Platform            ${r.platform}${r.isMac ? '' : '  (not macOS)'}`);
  console.log(`  Templates stored    ${r.storeRoot}`);
  console.log(`  Motion Templates    ${r.motionDir}${r.motionDirExists ? '' : '  (not created yet)'}`);
  console.log(`  PK Motion title     ${r.pkTitleInstalled ? 'installed' : 'not installed (the default export profile does not need it)'}`);
  console.log(`  Fonts detected      ${r.installedFonts ? `${r.installedFonts.size} families` : 'unknown on this platform'}`);
  const subs = r.fonts.filter((f) => !f.ok);
  if (subs.length) {
    console.log('\n  Font substitutions');
    for (const f of subs) console.log(`    ${f.template} (${f.level}): ${f.wanted} → ${f.used}`);
  }
  for (const n of r.notes) console.log(`\n  ! ${n}`);
  console.log('');
}

async function cmdInstall(flags) {
  const r = await install({ bundle: flags.bundle ? String(flags.bundle) : undefined });
  for (const c of r.created) console.log(`  created  ${c}`);
  if (r.installed) console.log(`  installed ${r.installed}`);
  for (const n of r.notes) console.log(`  ! ${n}`);
  console.log('\nReady. Try: pkkc templates');
}

async function cmdWhere() {
  const p = store.paths();
  console.log(`\n  Templates   ${p.templates}`);
  console.log(`  Thumbnails  ${p.thumbnails}`);
  console.log(`  Overrides   ${p.overrides}`);
  console.log(`  Brand       ${p.brand}`);
  console.log(`\n  Back them up by copying ${p.root}\n`);
}

async function cmdUI(flags) {
  const { startServer } = await import('../ui/server.js');
  await startServer({ port: numberOr(flags.port, 7847), open: flags.open !== false });
}

async function cmdApp(flags) {
  const { buildApp, APP_NAME } = await import('../../app/build-app.mjs');
  const { app, warnings } = await buildApp({
    outDir: flags.out ? String(flags.out) : undefined,
    projectDir: fileURLToPath(new URL('../..', import.meta.url)),
  });

  console.log(`\n  Built ${app}\n`);
  for (const w of warnings) console.log(`  ! ${w}`);
  if (process.platform === 'darwin') {
    console.log('  Open it from Applications, then drag it to the dock.');
    console.log(`  The first time, right-click ▸ Open — it is not code-signed, so double-clicking is refused once.`);
    console.log(`\n  If it does not start, the reason is in ~/Library/Logs/${APP_NAME}.log`);
  } else {
    console.log('  Copy it to a Mac, into /Applications or ~/Applications.');
  }
  console.log('');
}

async function cmdDemo(flags) {
  const outDir = String(flags.out ?? path.join(process.cwd(), 'pk-captions-demo'));
  await fs.mkdir(outDir, { recursive: true });
  const script = 'Welcome to 42 Harbour Road. This architectural home offers four bedrooms, two bathrooms and a double garage, set on six hundred and fifty square metres of freehold land with uninterrupted sea views. Priced at one point nine five million dollars.';
  const src = path.join(outDir, 'demo.txt');
  await fs.writeFile(src, script, 'utf8');
  for (const t of BUILTIN_TEMPLATES) {
    const { plan } = await buildPlan(src, { template: t.id, aspect: '9:16', realEstate: true, normalise: true });
    await fs.writeFile(path.join(outDir, `${t.id}.fcpxml`), exportFCPXML(plan, { projectName: `Demo — ${t.name}` }).xml, 'utf8');
    await fs.writeFile(path.join(outDir, `${t.id}.svg`), renderContactSheet(plan, { count: 8, columns: 4, scale: 0.2 }), 'utf8');
  }
  console.log(`Wrote ${BUILTIN_TEMPLATES.length} demo projects and preview sheets to ${outDir}`);
}

/* ------------------------------------------------------------------ */

function usage() {
  console.log(`
PK Kinetic Captions — kinetic typography for Final Cut Pro          PK Visuals

  pkkc generate <transcript>          Design captions and export FCPXML
  pkkc preview <transcript>           Write an SVG preview sheet
  pkkc templates                      List built-in and saved styles
  pkkc show <id>                      Print a template as JSON
  pkkc save "<name>"                  Save the current settings as a template
  pkkc duplicate <id> "<name>"        Copy a template
  pkkc delete <id> --yes              Remove a saved template
  pkkc export-template <id> [dest]    Write a .pkcaption file
  pkkc import-template <file>         Add a .pkcaption to MY TEMPLATES
  pkkc thumbnails                     Regenerate template previews
  pkkc brand [--accentColour HEX]     View or set MY BRAND
  pkkc palette "#14b8a6"              Generate a palette from an accent
  pkkc check                          Environment, fonts and install state
  pkkc install                        Create the store and Motion folders
  pkkc where                          Where templates are stored
  pkkc ui [--port 7847]               Open the design interface
  pkkc app [--out ~/Applications]     Build the Mac app you can put in the dock
  pkkc demo                           Write one demo project per built-in style

Generate options
  --template NAME        Built-in id or saved name          (default: MY BRAND)
  --accent HEX           Accent colour for emphasis words
  --palette              Derive the whole palette from --accent
  --density              low | medium | high                       (caption density)
  --emphasis             subtle | balanced | strong               (emphasis density)
  --animation            minimal | smooth | editorial | cinematic | luxury | punchy | energetic
  --interaction          clean | invert | cinematic | ghost | editorial | knockout | luminous | ink
  --hero-interaction     the same list, applied to hero words only
  --behind-subject       let hero type sit behind the speaker
  --position             static | dynamic | subjectAware | manual
  --aspect               9:16 | 16:9 | 4:5 | 1:1                      (default 9:16)
  --width --height --fps
  --no-safe-area         ignore the social UI keep-outs
  --real-estate          recognise prices, bedrooms, land, location
  --normalise            set figures typographically: "4 BEDROOMS", "650m²", "$1.95M"
  --price-format         full | short
  --shots FILE.json      per-shot face/subject analysis
  --overrides FILE.json  per-word overrides
  --corrections FILE.json  {"Mana Kau": "Manukau"}
  --profile              native | pk
  --out DIR              where to write
  --no-preview           skip the SVG preview sheet
`);
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
  throw new Error(message);   // unreachable, but it makes the type honest
}
