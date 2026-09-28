import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp, APP_NAME } from '../app/build-app.mjs';

const PROJECT = fileURLToPath(new URL('..', import.meta.url));

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pkkc-app-'));
  try { return await fn(dir); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

test('the bundle has the shape macOS requires', async () => {
  await withTempDir(async (dir) => {
    const { app } = await buildApp({ outDir: dir, projectDir: PROJECT });
    assert.equal(path.basename(app), `${APP_NAME}.app`);
    for (const rel of ['Contents/Info.plist', 'Contents/PkgInfo', `Contents/MacOS/${APP_NAME}`, 'Contents/Resources/AppIcon.icns']) {
      await fs.access(path.join(app, rel));
    }
    assert.equal(await fs.readFile(path.join(app, 'Contents/PkgInfo'), 'utf8'), 'APPL????');
  });
});

test('Info.plist names the executable that is actually there', async () => {
  await withTempDir(async (dir) => {
    const { app } = await buildApp({ outDir: dir, projectDir: PROJECT });
    const plist = await fs.readFile(path.join(app, 'Contents/Info.plist'), 'utf8');
    const value = (key) => new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist)?.[1];

    assert.equal(value('CFBundleExecutable'), APP_NAME);
    await fs.access(path.join(app, 'Contents/MacOS', value('CFBundleExecutable') ?? ''));
    assert.equal(value('CFBundleIconFile'), 'AppIcon');
    assert.equal(value('CFBundleIdentifier'), 'nz.pkvisuals.kinetic-captions');
    assert.equal(value('CFBundlePackageType'), 'APPL');

    // The version placeholder must be gone, or the Finder shows "__VERSION__".
    assert.ok(!plist.includes('__VERSION__'));
    const pkg = JSON.parse(await fs.readFile(path.join(PROJECT, 'package.json'), 'utf8'));
    assert.equal(value('CFBundleShortVersionString'), pkg.version);
  });
});

test('the launcher is executable and knows where the project is', async () => {
  await withTempDir(async (dir) => {
    const { app } = await buildApp({ outDir: dir, projectDir: '/Users/someone/PK/pk-kinetic-captions' });
    const exe = path.join(app, 'Contents/MacOS', APP_NAME);

    const mode = (await fs.stat(exe)).mode & 0o777;
    assert.ok(mode & 0o111, `launcher is not executable (mode ${mode.toString(8)})`);

    const script = await fs.readFile(exe, 'utf8');
    assert.ok(script.startsWith('#!/bin/bash'));
    assert.ok(!script.includes('__PROJECT_DIR__'), 'the project path placeholder was not replaced');
    assert.ok(script.includes('PROJECT_DIR="/Users/someone/PK/pk-kinetic-captions"'));
  });
});

test('the launcher looks for Node where Node actually lives', async () => {
  await withTempDir(async (dir) => {
    const { app } = await buildApp({ outDir: dir, projectDir: PROJECT });
    const script = await fs.readFile(path.join(app, 'Contents/MacOS', APP_NAME), 'utf8');

    // A double-clicked app gets no login shell, so PATH alone is not enough.
    for (const location of ['/opt/homebrew/bin/node', '/usr/local/bin/node', '.nvm/versions/node', '.fnm/node-versions', '.volta/bin/node', '.asdf/installs/nodejs']) {
      assert.ok(script.includes(location), `the launcher does not check ${location}`);
    }
    assert.match(script, /sort -V \| tail -1/, 'version managers need the newest version picked, not the first');
    assert.match(script, /-lic 'command -v node'/, 'there should be a login-shell fallback');
    assert.match(script, /osascript/, 'a failure has to be visible when launched from the dock');
    assert.match(script, /Library\/Logs/, 'a dock launch with no log is undebuggable');
  });
});

test('rebuilding replaces the bundle rather than layering onto it', async () => {
  await withTempDir(async (dir) => {
    const { app } = await buildApp({ outDir: dir, projectDir: '/Users/a/first' });
    const stray = path.join(app, 'Contents/Resources/stale.txt');
    await fs.writeFile(stray, 'from an older build', 'utf8');

    await buildApp({ outDir: dir, projectDir: '/Users/b/second' });
    await assert.rejects(() => fs.access(stray), 'a stale file survived the rebuild');

    const script = await fs.readFile(path.join(app, 'Contents/MacOS', APP_NAME), 'utf8');
    assert.ok(script.includes('/Users/b/second'), 'the launcher still points at the old project');
  });
});

test('a project path containing a space or a quote is baked in safely', async () => {
  await withTempDir(async (dir) => {
    const { app } = await buildApp({ outDir: dir, projectDir: '/Users/pk/My Video Tools/pk-kinetic-captions' });
    const script = await fs.readFile(path.join(app, 'Contents/MacOS', APP_NAME), 'utf8');
    assert.ok(script.includes('PROJECT_DIR="/Users/pk/My Video Tools/pk-kinetic-captions"'));
    // Quoted everywhere it is used, so a space cannot split it into two words.
    assert.ok(!/cd \$PROJECT_DIR/.test(script) && script.includes('cd "$PROJECT_DIR"'));
    assert.ok(script.includes('[ -d "$PROJECT_DIR" ]'));
  });
});

test('the icon is a well-formed icns with the sizes the dock needs', async () => {
  const icns = await fs.readFile(path.join(PROJECT, 'app/AppIcon.icns'));
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length, 'the declared length must match the file');

  /** @type {Record<string, number>} */
  const found = {};
  let offset = 8;
  while (offset < icns.length) {
    const type = icns.subarray(offset, offset + 4).toString('ascii');
    const length = icns.readUInt32BE(offset + 4);
    assert.ok(length > 8 && offset + length <= icns.length, `chunk ${type} has a bad length`);

    const payload = icns.subarray(offset + 8, offset + length);
    assert.equal(payload.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${type} is not a PNG`);
    found[type] = payload.readUInt32BE(16);   // IHDR width
    offset += length;
  }

  assert.equal(offset, icns.length, 'chunks do not fill the file exactly');
  // 16 for the Finder list, 1024 for Retina Get Info, and the steps between.
  for (const [type, size] of [['icp4', 16], ['icp5', 32], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]]) {
    assert.equal(found[type], size, `${type} should be ${size}px, was ${found[type]}`);
  }
});
