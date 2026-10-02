/**
 * Copy the engine and interface into the extension's Resources.
 *
 * The extension does not reimplement anything: it loads the same modules the
 * CLI and the standalone app use, so a change to the emphasis or layout
 * engine reaches all three at once. There is no build step and no bundler —
 * they are ES modules and WKWebView loads them directly.
 *
 * Only modules reachable from compose() and exportFCPXML() are copied, and
 * the copy fails loudly if any of them imports Node, because that would be a
 * blank panel inside Final Cut with a console message nobody sees.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '../..');
const SRC = path.join(PROJECT, 'src');
const PANEL = path.resolve(HERE, '../Panel');
const OUT = path.resolve(HERE, '../Extension/Resources/web');

/** The two doors into the engine. Everything else is pulled in by following imports. */
const ENTRIES = ['engine/compose.js', 'export/fcpxml.js', 'export/captioned.js', 'render/svg.js', 'transcript/ingest.js', 'transcript/sync.js', 'templates/schema.js', 'templates/builtin/index.js'];

/**
 * Follow the import graph from the entry points.
 * @returns {Promise<{modules: string[], nodeImports: Array<{module: string, spec: string}>}>}
 */
export async function collectModules() {
  /** @type {Set<string>} */ const seen = new Set();
  /** @type {Array<{module: string, spec: string}>} */ const nodeImports = [];
  const queue = [...ENTRIES];

  while (queue.length) {
    const rel = queue.pop();
    if (!rel || seen.has(rel)) continue;
    seen.add(rel);

    const source = await fs.readFile(path.join(SRC, rel), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    for (const [, spec] of code.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      if (spec.startsWith('node:')) { nodeImports.push({ module: rel, spec }); continue; }
      if (spec.startsWith('.')) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
    }
  }
  return { modules: [...seen].sort(), nodeImports };
}

/** @param {{silent?: boolean}} [opts] */
export async function bundle(opts = {}) {
  const { modules, nodeImports } = await collectModules();

  if (nodeImports.length) {
    const detail = nodeImports.map((n) => `  ${n.module} imports ${n.spec}`).join('\n');
    throw new Error(
      `The extension runs in a WKWebView, which has no Node. These top-level imports would break it:\n${detail}\n\n` +
      'Move the Node-only work behind a lazy import inside a function, or into the native side.',
    );
  }

  // Resources/web is generated in full every time, so nothing stale can
  // survive a rename. That is exactly why the panel's own sources live in
  // Panel/ and are copied in — keeping them here would mean this line
  // deleted them.
  await fs.rm(OUT, { recursive: true, force: true });
  for (const rel of modules) {
    const dest = path.join(OUT, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(path.join(SRC, rel), dest);
  }

  // Shared styling, then the panel's own sources.
  await fs.copyFile(path.join(SRC, 'ui/public/styles.css'), path.join(OUT, 'styles.css'));

  const panelFiles = await fs.readdir(PANEL);
  for (const file of panelFiles) await fs.copyFile(path.join(PANEL, file), path.join(OUT, file));

  if (!opts.silent) {
    console.log(`Bundled ${modules.length} engine modules + ${panelFiles.length} panel files into Extension/Resources/web`);
  }
  return { modules, panel: panelFiles, out: OUT };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bundle().catch((err) => { console.error(`\n${err.message}\n`); process.exit(1); });
}
