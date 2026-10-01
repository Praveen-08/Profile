import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest } from '../src/transcript/ingest.js';
import { compose } from '../src/engine/compose.js';
import { exportFCPXML, assignGlobalLanes } from '../src/export/fcpxml.js';
import { renderFrame, renderContactSheet, pickRepresentativeTimes } from '../src/render/svg.js';
import { BUILTIN_TEMPLATES, builtinById } from '../src/templates/builtin/index.js';
import { merge } from '../src/templates/schema.js';
import { FRAME_916, FRAME_169, LISTING_SCRIPT, AGENT_SCRIPT, TALKING_HEAD_SHOTS, allWords } from './helpers.js';

const make = (template, frame = FRAME_916, extra = {}) =>
  compose({ transcript: ingest(LISTING_SCRIPT, { format: 'text' }), template, frame, shots: TALKING_HEAD_SHOTS, ...extra });

/**
 * A deliberately strict well-formedness check. There is no XML parser in the
 * dependency set, so this walks the tags and verifies they nest and close —
 * enough to catch the escaping and nesting mistakes a string-built document
 * actually makes.
 */
function assertWellFormed(xml) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let m, consumed = 0;
  const body = xml.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '');
  while ((m = re.exec(body))) {
    const [full, closing, name, , selfClose] = m;
    consumed += full.length;
    if (selfClose) continue;
    if (closing) {
      assert.equal(stack.pop(), name, `</${name}> closed the wrong element`);
    } else stack.push(name);
  }
  assert.deepEqual(stack, [], `unclosed elements: ${stack.join(', ')}`);

  // Every `<` outside a tag must have been escaped.
  const tagChars = consumed;
  const angle = (body.match(/</g) ?? []).length;
  assert.ok(tagChars > 0 && angle === (body.match(/<[/a-zA-Z]/g) ?? []).length, 'found a raw "<" in text content');
}

test('every built-in style exports well-formed FCPXML', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const { xml, stats } = exportFCPXML(make(t));
    assertWellFormed(xml);
    assert.ok(xml.includes('<fcpxml version="1.11">'));
    assert.ok(stats.titles > 0);
  }
});

test('characters that break XML are escaped', () => {
  const plan = compose({
    transcript: ingest('Ben & Jerry\'s <best> "deal" priced at 5 > 4', { format: 'text' }),
    template: builtinById('pk-modern'), frame: FRAME_916,
  });
  const { xml } = exportFCPXML(plan);
  assertWellFormed(xml);
  assert.ok(xml.includes('&amp;'));

  // Inspect the text nodes themselves: no bare "<", ">" or stray "&".
  const texts = [...xml.matchAll(/<text-style ref="ts\d+">([\s\S]*?)<\/text-style>/g)].map((m) => m[1]);
  assert.ok(texts.length > 0);
  for (const body of texts) {
    assert.ok(!/[<>]/.test(body), `unescaped angle bracket in ${JSON.stringify(body)}`);
    assert.ok(!/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(body), `unescaped ampersand in ${JSON.stringify(body)}`);
  }
  assert.ok(texts.join(' ').includes('&amp;'), 'the ampersand in the script should have survived as an entity');

  // And in attribute values, which carry the same text in the clip name.
  for (const [, value] of xml.matchAll(/name="([^"]*)"/g)) {
    assert.ok(!/[<>]/.test(value), `unescaped angle bracket in attribute ${JSON.stringify(value)}`);
  }
});

test('every time is an exact rational on a frame boundary', () => {
  for (const frame of [FRAME_916, FRAME_169, { ...FRAME_916, fps: 23.976 }]) {
    const { xml } = exportFCPXML(make(builtinById('pk-real-estate'), frame));
    for (const [, value] of xml.matchAll(/(?:offset|duration|time|frameDuration)="([^"]+)"/g)) {
      assert.match(value, /^(0s|-?\d+\/\d+s|-?\d+s)$/, `"${value}" is not a frame-exact time`);
    }
  }
});

test('no clip is shorter than a frame and none starts before zero', () => {
  const { xml } = exportFCPXML(make(builtinById('pk-bold')));
  for (const [, dur] of xml.matchAll(/<title[^>]*duration="(\d+)\/(\d+)s"/g)) assert.ok(Number(dur) > 0);
  for (const [, off] of xml.matchAll(/<title[^>]*offset="([^"]+)"/g)) assert.ok(!off.startsWith('-'));
});

test('opacity keyframes stay inside 0..1', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const { xml } = exportFCPXML(make(t));
    for (const block of xml.matchAll(/<param name="amount">([\s\S]*?)<\/param>/g)) {
      for (const [, v] of block[1].matchAll(/value="([-\d.]+)"/g)) {
        const n = Number(v);
        assert.ok(n >= 0 && n <= 1, `${t.name} exported opacity ${n}`);
      }
    }
  }
});

test('blend modes are real compositing, not a colour trick', () => {
  const t = merge(builtinById('pk-modern'), { interaction: { preset: 'invert' } });
  const { xml } = exportFCPXML(make(t));
  assert.ok(xml.includes('mode="difference"'), 'Invert must export as a difference blend');

  const clean = exportFCPXML(make(merge(t, { interaction: { preset: 'clean' } }))).xml;
  assert.ok(!clean.includes('mode="difference"'));

  for (const [preset, mode] of [['ghost', 'screen'], ['ink', 'multiply'], ['editorial', 'soft light'], ['knockout', 'stencil alpha']]) {
    assert.ok(exportFCPXML(make(merge(t, { interaction: { preset } }))).xml.includes(`mode="${mode}"`), `${preset} should export as ${mode}`);
  }
});

test('behind-subject type is placed on lanes below the storyline', () => {
  const t = merge(builtinById('pk-editorial'), { interaction: { heroBehindSubject: true } });
  const plan = make(t);
  assert.ok(allWords(plan).some((w) => w.depth === 'background'), 'expected some background words');
  const { xml, warnings } = exportFCPXML(plan);
  assert.match(xml, /<title[^>]*lane="-\d+"/, 'background type should sit on a negative lane');
  assert.ok(warnings.some((w) => w.includes('behind the subject')));
});

test('words that share the screen never share a lane', () => {
  const words = [
    { id: 'a', start: 0, end: 2, lane: 1, depth: 'foreground', level: 'normal', size: 60 },
    { id: 'b', start: 1, end: 3, lane: 2, depth: 'foreground', level: 'hero', size: 200 },
    { id: 'c', start: 4, end: 5, lane: 1, depth: 'foreground', level: 'normal', size: 60 },
  ];
  const lanes = assignGlobalLanes(words);
  assert.notEqual(lanes.get('a'), lanes.get('b'), 'overlapping words collided on one lane');
  assert.equal(lanes.get('c'), lanes.get('a'), 'a lane should be reused once it is free');
});

test('the format element is only named when it is a real Final Cut preset', () => {
  assert.ok(exportFCPXML(make(builtinById('pk-modern'), FRAME_169)).xml.includes('name="FFVideoFormat1080p25"'));
  const portrait = exportFCPXML(make(builtinById('pk-modern'), FRAME_916)).xml;
  assert.ok(!portrait.includes('name="FFVideoFormat'), 'a vertical sequence has no matching preset name');
  assert.ok(portrait.includes('width="1080" height="1920"'));
});

test('a held segment does not waste keyframes', () => {
  const { xml } = exportFCPXML(make(builtinById('pk-luxury')));
  const perTitle = xml.split('<title').slice(1).map((chunk) => (chunk.match(/<keyframe/g) ?? []).length);
  assert.ok(Math.max(...perTitle) < 70, `one title carried ${Math.max(...perTitle)} keyframes`);
});

test('an empty transcript exports a valid, empty project rather than failing', () => {
  const plan = compose({ transcript: ingest('', { format: 'text' }), template: builtinById('pk-modern'), frame: FRAME_916 });
  const { xml, stats, warnings } = exportFCPXML(plan);
  assertWellFormed(xml);
  assert.equal(stats.titles, 0);
  assert.ok(warnings.length > 0);
});

test('export is deterministic', () => {
  for (const t of BUILTIN_TEMPLATES) {
    assert.equal(exportFCPXML(make(t)).xml, exportFCPXML(make(t)).xml, `${t.name} exported differently twice`);
  }
});

test('the SVG preview renders for every style and is well-formed', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const plan = make(t);
    for (const time of pickRepresentativeTimes(plan, 6)) {
      const svg = renderFrame(plan, { time, scale: 0.5 });
      assertWellFormed(svg);
      assert.ok(svg.includes('<text'), `${t.name} rendered nothing at ${time.toFixed(2)}s`);
    }
    assertWellFormed(renderContactSheet(plan, { count: 4, columns: 2 }));
  }
});

test('the preview samples the same curves the exporter bakes', () => {
  const plan = make(builtinById('pk-real-estate'));
  const w = allWords(plan).find((x) => x.level === 'hero') ?? allWords(plan)[0];
  const mid = w.start + (w.end - w.start) / 2;
  const svg = renderFrame(plan, { time: mid, scale: 1 });
  assert.ok(svg.includes(w.text), 'a word on screen in the plan must be in the preview');
  assert.ok(!renderFrame(plan, { time: w.end + 0.5, scale: 1 }).includes(`>${w.text}<`), 'a word past its end must be gone');
});

test('the agent script and the listing script both survive every style end to end', () => {
  for (const script of [AGENT_SCRIPT, LISTING_SCRIPT]) {
    for (const t of BUILTIN_TEMPLATES) {
      for (const frame of [FRAME_916, FRAME_169, { ...FRAME_916, width: 3840, height: 2160, aspect: '16:9' }]) {
        const plan = compose({ transcript: ingest(script, { format: 'text' }), template: t, frame, shots: TALKING_HEAD_SHOTS });
        assert.ok(plan.stats.words > 0);
        assertWellFormed(exportFCPXML(plan).xml);
      }
    }
  }
});

// Final Cut ships its own DTDs. When one is on this machine, validate against
// it: well-formedness alone passed for months while every title was invalid
// (adjust-* before <text>, keyframes outside <keyframeAnimation>), which
// Final Cut rejects on import.
test('FCPXML validates against Final Cut\'s own DTD, when Final Cut is installed', async (t) => {
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dtd = '/Applications/Final Cut Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_11.dtd';
  if (!fs.existsSync(dtd)) return t.skip('Final Cut Pro is not installed');

  // xmllint cannot resolve a DTD path containing spaces, so copy it out.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkkc-dtd-'));
  try {
    fs.copyFileSync(dtd, path.join(dir, 'fcpxml.dtd'));
    for (const template of BUILTIN_TEMPLATES) {
      const file = path.join(dir, `${template.id}.fcpxml`);
      fs.writeFileSync(file, exportFCPXML(make(template)).xml);
      try {
        execFileSync('xmllint', ['--noout', '--dtdvalid', path.join(dir, 'fcpxml.dtd'), file], { stdio: 'pipe' });
      } catch (err) {
        assert.fail(`${template.id} does not validate:\n${String(err.stderr).split('\n').slice(0, 4).join('\n')}`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
