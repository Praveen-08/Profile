import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { withTempStore, LISTING_SCRIPT } from './helpers.js';

const run = promisify(execFile);
const BIN = fileURLToPath(new URL('../bin/pkkc.js', import.meta.url));

const pkkc = (args, env = {}) =>
  run(process.execPath, [BIN, ...args], { env: { ...process.env, ...env }, cwd: path.dirname(BIN) });

test('the CLI lists built-in styles and says where templates live', async () => {
  await withTempStore(async (dir) => {
    const { stdout } = await pkkc(['templates'], { PKKC_HOME: dir });
    for (const name of ['PK Editorial', 'PK Luxury', 'PK Modern', 'PK Minimal', 'PK Bold', 'PK Real Estate']) {
      assert.ok(stdout.includes(name), `missing ${name}`);
    }
    assert.ok(stdout.includes(path.join(dir, 'templates')));
  });
});

test('save, list, duplicate, export, import and delete work from the command line', async () => {
  await withTempStore(async (dir) => {
    const env = { PKKC_HOME: dir };

    await pkkc(['save', 'Luxury Teal', '--template', 'pk-luxury', '--accent', '#14b8a6'], env);
    assert.ok((await pkkc(['templates'], env)).stdout.includes('Luxury Teal'));

    await pkkc(['duplicate', 'luxury-teal', 'Luxury Gold'], env);
    assert.ok((await pkkc(['templates'], env)).stdout.includes('Luxury Gold'));

    const exported = await pkkc(['export-template', 'luxury-teal', dir], env);
    const file = path.join(dir, 'luxury-teal.pkcaption');
    assert.ok(exported.stdout.includes(file));
    await fs.access(file);

    await pkkc(['import-template', file, '--rename', 'From A Colleague'], env);
    assert.ok((await pkkc(['templates'], env)).stdout.includes('From A Colleague'));

    await pkkc(['delete', 'luxury-gold', '--yes'], env);
    assert.ok(!(await pkkc(['templates'], env)).stdout.includes('Luxury Gold'));
  });
});

test('deleting without --yes refuses rather than guessing', async () => {
  await withTempStore(async (dir) => {
    await pkkc(['save', 'Temporary', '--template', 'pk-bold'], { PKKC_HOME: dir });
    await assert.rejects(() => pkkc(['delete', 'temporary'], { PKKC_HOME: dir }), /Re-run with --yes/);
    assert.ok((await pkkc(['templates'], { PKKC_HOME: dir })).stdout.includes('Temporary'));
  });
});

test('generate writes an FCPXML, a plan and a preview', async () => {
  await withTempStore(async (dir) => {
    const src = path.join(dir, 'listing.txt');
    await fs.writeFile(src, LISTING_SCRIPT, 'utf8');
    const out = path.join(dir, 'out');

    const { stdout } = await pkkc([
      'generate', src, '--template', 'pk-real-estate', '--accent', '#c9a84c',
      '--real-estate', '--normalise', '--density', 'low', '--out', out,
    ], { PKKC_HOME: dir });

    assert.ok(stdout.includes('title clips'));
    const files = await fs.readdir(out);
    assert.deepEqual(files.sort(), ['listing.fcpxml', 'listing.plan.json', 'listing.preview.svg']);

    const xml = await fs.readFile(path.join(out, 'listing.fcpxml'), 'utf8');
    assert.ok(xml.startsWith('<?xml'));
    assert.ok(xml.includes('4 BEDROOMS'), 'real-estate normalisation should reach the timeline');
    assert.ok(xml.includes('$1.95M'));

    const plan = JSON.parse(await fs.readFile(path.join(out, 'listing.plan.json'), 'utf8'));
    assert.ok(plan.stats.words > 0);
  });
});

test('a bad flag value explains itself instead of failing cryptically', async () => {
  await withTempStore(async (dir) => {
    const src = path.join(dir, 'x.txt');
    await fs.writeFile(src, 'hello world', 'utf8');
    await assert.rejects(
      () => pkkc(['generate', src, '--animation', 'wobble'], { PKKC_HOME: dir }),
      /must be one of: minimal, smooth/,
    );
  });
});

test('a template saved by the CLI is usable by a later, separate invocation', async () => {
  await withTempStore(async (dir) => {
    const env = { PKKC_HOME: dir };
    const src = path.join(dir, 's.txt');
    await fs.writeFile(src, LISTING_SCRIPT, 'utf8');

    await pkkc(['save', 'Agency White', '--template', 'pk-modern', '--accent', '#ffffff', '--emphasis', 'strong'], env);
    // A completely separate process, as if Final Cut had been quit and reopened.
    const { stdout } = await pkkc(['generate', src, '--template', 'Agency White', '--out', path.join(dir, 'o')], env);
    assert.ok(stdout.includes('Agency White'));
  });
});

test('check reports the environment without needing a Mac', async () => {
  await withTempStore(async (dir) => {
    const { stdout } = await pkkc(['check'], { PKKC_HOME: dir });
    assert.ok(stdout.includes('Templates stored'));
    assert.ok(stdout.includes('Motion Templates'));
  });
});

test('help is printed for an unknown command rather than a stack trace', async () => {
  const { stdout } = await pkkc(['nonsense']);
  assert.ok(stdout.includes('pkkc generate'));
});
