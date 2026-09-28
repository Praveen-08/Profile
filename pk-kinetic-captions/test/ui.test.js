import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/ui/server.js';
import { renderFrame } from '../src/render/svg.js';
import { compose } from '../src/engine/compose.js';
import { ingest } from '../src/transcript/ingest.js';
import { builtinById } from '../src/templates/builtin/index.js';
import { withTempStore, FRAME_916, AGENT_SCRIPT } from './helpers.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const PUBLIC = path.join(SRC, 'ui/public');

/** The modules the page imports over HTTP, and everything they pull in. */
const BROWSER_MODULES = ['render/svg.js', 'engine/motion.js', 'engine/fonts.js', 'core/colour.js'];

async function withServer(fn) {
  return withTempStore(async () => {
    const { server, url } = await startServer({ port: 0, open: false });
    try { return await fn(url); }
    finally { await new Promise((r) => server.close(r)); }
  });
}

test('the page and its assets are served', async () => {
  await withServer(async (url) => {
    for (const [file, needle] of [['', '<title>PK Kinetic Captions'], ['styles.css', '--gold'], ['app.js', 'renderFrame'], ['favicon.ico', '<svg']]) {
      const res = await fetch(url + file);
      assert.equal(res.status, 200, `${file || 'index'} was ${res.status}`);
      assert.ok((await res.text()).includes(needle), `${file || 'index'} missing ${needle}`);
    }
  });
});

test('the engine modules the page draws with are served under /lib', async () => {
  await withServer(async (url) => {
    for (const mod of BROWSER_MODULES) {
      const res = await fetch(`${url}lib/${mod}`);
      assert.equal(res.status, 200, `/lib/${mod} was ${res.status}`);
      assert.match(res.headers.get('content-type') ?? '', /javascript/);
      assert.ok((await res.text()).includes('export'), `/lib/${mod} is not a module`);
    }
  });
});

test('/lib serves only the allowed modules and cannot be walked out of', async () => {
  await withServer(async (url) => {
    for (const hostile of [
      'lib/templates/store.js',          // real module, but not browser-safe
      'lib/ui/server.js',
      'lib/../../package.json',
      'lib/%2e%2e/%2e%2e/package.json',
      'lib/engine/compose.js',
    ]) {
      const res = await fetch(url + hostile, { redirect: 'manual' });
      assert.ok(res.status === 404 || res.status === 403, `${hostile} returned ${res.status}`);
    }
  });
});

/**
 * The page imports these modules straight from src/. If one of them ever
 * gains a top-level Node import, the app breaks in the browser with a blank
 * stage and a console error, and nothing in the Node-side tests would notice.
 * This is the guard for that.
 */
test('browser-served modules import nothing from Node at the top level', async () => {
  const seen = new Set();
  const queue = [...BROWSER_MODULES];

  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);

    const source = await fs.readFile(path.join(SRC, rel), 'utf8');

    // Strip block comments so JSDoc `import(...)` type references do not count.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    for (const [, spec] of code.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      assert.ok(!spec.startsWith('node:'), `${rel} imports ${spec} at the top level`);
      if (spec.startsWith('.')) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
    }
    // A dynamic import of node: inside a function is fine — it only runs when
    // that function is called, and the browser never calls it. Only an
    // unindented one is at module scope and would run on load.
    for (const [, spec] of code.matchAll(/^(?:export\s+)?(?:const|let|var)\s[^=\n]*=\s*await\s+import\(['"]([^'"]+)['"]\)/gm)) {
      assert.ok(!spec.startsWith('node:'), `${rel} awaits ${spec} at module scope`);
    }
  }

  assert.ok(seen.size >= BROWSER_MODULES.length);
});

test('a transparent plate leaves the video visible underneath', () => {
  const plan = compose({ transcript: ingest(AGENT_SCRIPT, { format: 'text' }), template: builtinById('pk-modern'), frame: FRAME_916 });
  const time = plan.phrases[1].start + 0.3;

  const opaque = renderFrame(plan, { time, scale: 1 });
  assert.match(opaque, /<rect width="1080" height="1920"/, 'the standalone preview should paint its own backdrop');

  const overlay = renderFrame(plan, { time, scale: 1, plate: 'none' });
  assert.doesNotMatch(overlay, /<rect width="1080" height="1920"/, 'the overlay must not paint over the footage');
  assert.ok(overlay.includes('<text'), 'the overlay still has to draw the captions');
});

test('the app markup has the pieces the interface script binds to', async () => {
  const html = await fs.readFile(path.join(PUBLIC, 'index.html'), 'utf8');
  for (const id of ['drop', 'video', 'canvas', 'scrub', 'play', 'fps', 'video-file', 'transcript-file',
    'capture-canvas', 'pick-colour', 'words', 'q-template', 'q-accent', 'export', 'media-info']) {
    assert.ok(html.includes(`id="${id}"`), `index.html is missing #${id}`);
  }
});

test('the overlay is not cut off from the video by a stacking context', async () => {
  // Blend modes only composite against the footage while .media stays a plain
  // stacking context. `isolation`, `opacity` or `filter` on it would silently
  // turn Invert and Ghost into previews against black.
  const css = await fs.readFile(path.join(PUBLIC, 'styles.css'), 'utf8');
  const block = /\.media\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(block, '.media rule not found');
  for (const prop of ['isolation', 'opacity', 'filter', 'mix-blend-mode']) {
    assert.ok(!new RegExp(`(^|;)\\s*${prop}\\s*:`).test(block), `.media sets ${prop}, which breaks blend previews`);
  }
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none/, 'hidden elements must actually hide');
});
