import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withTempStore, FRAME_916, LISTING_SCRIPT, AGENT_SCRIPT } from './helpers.js';
import { ingest } from '../src/transcript/ingest.js';
import { compose } from '../src/engine/compose.js';
import { merge, validateTemplate, defaultTemplate, migrateTemplate, fingerprint } from '../src/templates/schema.js';
import { BUILTIN_TEMPLATES, builtinById } from '../src/templates/builtin/index.js';
import { renderThumbnail, renderSwatch } from '../src/templates/thumbnail.js';

/** Imported fresh each time so the store re-reads `PKKC_HOME`. */
const freshStore = () => import(`../src/templates/store.js?v=${Math.random()}`);
const freshPackage = () => import(`../src/templates/package.js?v=${Math.random()}`);

test('every built-in template is valid and has real hierarchy', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const v = validateTemplate(t);
    assert.ok(v.ok, `${t.name}: ${v.errors.join('; ')}`);
    assert.deepEqual(v.warnings, [], `${t.name}: ${v.warnings.join('; ')}`);
    assert.ok(t.scale.hero / t.scale.normal >= 1.5, `${t.name} has too little scale contrast`);
  }
});

test('validation catches the mistakes a hand-edited template makes', () => {
  const bad = merge(defaultTemplate(), { id: 'x', name: 'X', motion: { style: 'wobble' }, colours: { accent: 'teal' } });
  const v = validateTemplate(bad);
  assert.equal(v.ok, false);
  assert.equal(v.errors.length, 2);
});

test('an older template without a version still loads', () => {
  const { template, migrated } = migrateTemplate({ id: 'old', name: 'Old', colours: { accent: '#ff0000' } });
  assert.equal(migrated, true);
  assert.equal(template.colours.accent, '#ff0000');
  assert.equal(template.colours.primary, defaultTemplate().colours.primary, 'missing fields fill in from defaults');
  assert.ok(validateTemplate(template).ok);
});

test('a template from a newer build loads with a note rather than an error', () => {
  const { template, notes } = migrateTemplate({ ...defaultTemplate(), version: 99, somethingNew: true });
  assert.ok(notes.some((n) => n.includes('v99')));
  assert.ok(validateTemplate(template).ok);
});

/* ------------------------------------------------------------ *
 * The persistence test the brief calls mandatory.
 * ------------------------------------------------------------ */

test('MANDATORY: a saved template survives a restart and reproduces the identical design', async () => {
  await withTempStore(async () => {
    const transcript = ingest(LISTING_SCRIPT, { format: 'text' });

    // --- Session one: build "Luxury Teal" and use it. ---
    const store1 = await freshStore();
    const designed = merge(builtinById('pk-luxury'), {
      name: 'Luxury Teal',
      colours: { accent: '#14b8a6', hero: '#2dd4bf' },
      motion: { style: 'cinematic', speed: 0.9 },
      hierarchy: { emphasisDensity: 'strong', captionDensity: 'low' },
      position: { mode: 'subjectAware', align: 'center' },
      interaction: { preset: 'ghost', heroBehindSubject: true },
      decoration: { glow: { enabled: true, intensity: 0.4, radius: 22 } },
      fonts: { hero: { family: 'Didot', italic: true, tracking: -14 } },
      scale: { base: 0.041, hero: 3.3 },
    });
    const { template: saved } = await store1.saveTemplate(designed);
    await store1.saveThumbnail(saved.id, renderThumbnail(saved));

    const planBefore = compose({ transcript, template: saved, frame: FRAME_916 });

    // --- Quit Final Cut, reboot, new library, new project. Nothing is in
    //     memory; the only thing that persists is the file on disk. ---
    const store2 = await freshStore();
    const { user } = await store2.listTemplates();
    const reloaded = user.find((t) => t.name === 'Luxury Teal');
    assert.ok(reloaded, 'the template was not there after a restart');

    // Everything the brief lists must come back identically.
    assert.deepEqual(reloaded.fonts, saved.fonts, 'fonts changed');
    assert.deepEqual(reloaded.colours, saved.colours, 'colours changed');
    assert.deepEqual(reloaded.scale, saved.scale, 'sizes changed');
    assert.deepEqual(reloaded.spacing, saved.spacing, 'spacing changed');
    assert.deepEqual(reloaded.position, saved.position, 'position changed');
    assert.deepEqual(reloaded.motion, saved.motion, 'animation changed');
    assert.deepEqual(reloaded.interaction, saved.interaction, 'blend changed');
    assert.deepEqual(reloaded.decoration, saved.decoration, 'effects changed');
    assert.deepEqual(reloaded.hierarchy, saved.hierarchy, 'hierarchy changed');
    assert.equal(fingerprint(reloaded), fingerprint(saved));

    // And applying it must produce exactly the same typography, not merely a
    // similar-looking one.
    const planAfter = compose({ transcript, template: reloaded, frame: FRAME_916 });
    assert.equal(JSON.stringify(planAfter), JSON.stringify(planBefore),
      'the reloaded template produced a different design');

    // It is also retrievable by the name the editor gave it.
    assert.equal((await (await freshStore()).resolveTemplate('Luxury Teal'))?.id, saved.id);
  });
});

test('built-in templates are protected from update and deletion', async () => {
  await withTempStore(async () => {
    const store = await freshStore();
    await assert.rejects(() => store.deleteTemplate('pk-luxury'), /built-in/);
    await assert.rejects(() => store.updateTemplate('pk-luxury', builtinById('pk-luxury')), /built-in/);

    // Saving under a built-in id makes a separate user template instead.
    const { template } = await store.saveTemplate(merge(builtinById('pk-luxury'), { colours: { accent: '#ff0000' } }), { name: 'PK Luxury' });
    assert.notEqual(template.id, 'pk-luxury');
    assert.equal(builtinById('pk-luxury').colours.accent, '#c9a84c', 'the built-in was modified');
  });
});

test('a user template is never silently overwritten', async () => {
  await withTempStore(async () => {
    const store = await freshStore();
    const a = await store.saveTemplate(builtinById('pk-bold'), { name: 'Agency White' });
    const b = await store.saveTemplate(builtinById('pk-modern'), { name: 'Agency White' });
    assert.notEqual(a.template.id, b.template.id);
    assert.equal((await store.listTemplates()).user.length, 2);
  });
});

test('update replaces the settings but keeps the identity and creation date', async () => {
  await withTempStore(async () => {
    const store = await freshStore();
    const { template } = await store.saveTemplate(builtinById('pk-modern'), { name: 'Agency Cyan' });
    const created = template.meta.created;
    await new Promise((r) => setTimeout(r, 6));
    const updated = await store.updateTemplate(template.id, merge(template, { colours: { accent: '#ff3ea5' } }));
    assert.equal(updated.id, template.id);
    assert.equal(updated.name, 'Agency Cyan');
    assert.equal(updated.colours.accent, '#ff3ea5');
    assert.equal(updated.meta.created, created);
    assert.notEqual(updated.meta.updated, created);
  });
});

test('duplicate makes an independent copy that records its parent', async () => {
  await withTempStore(async () => {
    const store = await freshStore();
    const teal = merge(builtinById('pk-luxury'), { colours: { accent: '#14b8a6' } });
    const { template } = await store.saveTemplate(teal, { name: 'Luxury Teal' });
    const copy = await store.duplicateTemplate(template.id, 'Luxury Gold');
    assert.equal(copy.basedOn, template.id);
    assert.equal(copy.colours.accent, '#14b8a6');

    await store.updateTemplate(copy.id, merge(copy, { colours: { accent: '#c9a84c' } }));
    const original = await store.getTemplate(template.id);
    assert.equal(original.colours.accent, '#14b8a6', 'editing the copy changed the original');
    assert.equal((await store.getTemplate(copy.id)).colours.accent, '#c9a84c');
  });
});

test('a template id can never escape the templates folder', async () => {
  await withTempStore(async () => {
    const store = await freshStore();
    assert.throws(() => store.safeId('..'), /Unsafe/);
    assert.throws(() => store.safeId('.'), /Unsafe/);
    for (const hostile of ['../../etc/passwd', '..\\..\\windows', '/absolute/path', '....//x']) {
      const safe = store.safeId(hostile);
      assert.ok(!safe.includes('/') && !safe.includes('\\'), `${hostile} -> ${safe} still has a separator`);
      assert.ok(!safe.includes('..'), `${hostile} -> ${safe} still has a parent reference`);
      assert.ok(!safe.startsWith('.'), `${hostile} -> ${safe} is a dotfile`);
    }
  });
});

test('a corrupt template file is reported, not fatal', async () => {
  await withTempStore(async (dir) => {
    const store = await freshStore();
    await store.saveTemplate(builtinById('pk-bold'), { name: 'Good One' });
    await fs.writeFile(path.join(dir, 'templates', 'broken.json'), '{ not json', 'utf8');
    const { user, problems } = await store.listTemplates();
    assert.equal(user.length, 1);
    assert.equal(problems.length, 1);
  });
});

test('export and import round-trip a template exactly', async () => {
  await withTempStore(async (dir) => {
    const store = await freshStore();
    const pkg = await freshPackage();
    const source = merge(builtinById('pk-editorial'), { name: 'Editorial Gold', colours: { accent: '#c9a84c' } });
    const { template: saved } = await store.saveTemplate(source);

    const file = await pkg.exportTemplate(saved, dir, { thumbnail: renderThumbnail(saved, { height: 320 }) });
    assert.ok(file.endsWith('.pkcaption'));

    const preview = await pkg.readPackage(file);
    assert.equal(preview.template.name, 'Editorial Gold');
    assert.ok(preview.thumbnail?.startsWith('<svg'), 'the package should carry a preview');

    const { template: imported } = await pkg.importTemplate(file, { rename: 'Editorial Gold (from Sam)' });
    assert.equal(imported.name, 'Editorial Gold (from Sam)');
    assert.deepEqual(imported.fonts, saved.fonts);
    assert.deepEqual(imported.colours, saved.colours);
    assert.equal(imported.kind, 'user');

    const transcript = ingest(AGENT_SCRIPT, { format: 'text' });
    assert.equal(
      JSON.stringify(compose({ transcript, template: imported, frame: FRAME_916 }).phrases),
      JSON.stringify(compose({ transcript, template: saved, frame: FRAME_916 }).phrases),
    );
  });
});

test('a file that is not a PK template is refused in plain language', async () => {
  await withTempStore(async (dir) => {
    const pkg = await freshPackage();
    const junk = path.join(dir, 'notes.pkcaption');
    await fs.writeFile(junk, JSON.stringify({ hello: 'world' }), 'utf8');
    await assert.rejects(() => pkg.readPackage(junk), /is not a PK Kinetic Captions template/);
  });
});

test('a package from a future version refuses with advice', async () => {
  await withTempStore(async (dir) => {
    const pkg = await freshPackage();
    const file = path.join(dir, 'future.pkcaption');
    await fs.writeFile(file, JSON.stringify({ magic: 'pk-kinetic-captions', packageVersion: 99, template: defaultTemplate() }), 'utf8');
    await assert.rejects(() => pkg.readPackage(file), /newer version/);
  });
});

test('per-project overrides persist separately from templates', async () => {
  await withTempStore(async () => {
    const store = await freshStore();
    await store.saveOverrides('harbour-road', { w0003: { level: 'hero' } });
    assert.deepEqual(await (await freshStore()).loadOverrides('harbour-road'), { w0003: { level: 'hero' } });
    assert.deepEqual(await store.loadOverrides('some-other-project'), {});
  });
});

test('every template renders a thumbnail that shows all three levels', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const svg = renderThumbnail(t, { height: 640 });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
    assert.ok(svg.includes('architectural') || svg.includes('ARCHITECTURAL'), `${t.name} thumbnail lost its hero word`);
    assert.ok(renderSwatch(t).includes(t.name));
  }
});
