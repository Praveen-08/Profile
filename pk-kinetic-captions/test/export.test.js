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
  assert.ok(xml.includes(`mode="22 (Difference)"`), 'Invert must export as a difference blend');

  const clean = exportFCPXML(make(merge(t, { interaction: { preset: 'clean' } }))).xml;
  assert.ok(!clean.includes(`mode="22 (Difference)"`));

  for (const [preset, mode] of [['ghost', '10 (Screen)'], ['ink', '4 (Multiply)'], ['editorial', '15 (Soft Light)'], ['knockout', '25 (Stencil Alpha)']]) {
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

test('the Basic Title the export points at exists in Final Cut, when Final Cut is installed', async (t) => {
  const fs = await import('node:fs');
  const { BASIC_TITLE_UID } = await import('../src/export/fcpxml.js');
  const templates = '/Applications/Final Cut Pro.app/Contents/PlugIns/MediaProviders/MotionEffect.fxp/Contents/Resources/PETemplates.localized';
  if (!fs.existsSync(templates)) return t.skip('Final Cut Pro is not installed');
  // ".../" stands for Final Cut's own template root.
  const file = templates + BASIC_TITLE_UID.replace(/^\.\.\./, '');
  assert.ok(fs.existsSync(file), `Final Cut has no ${BASIC_TITLE_UID} — every title would import as unreadable`);
});

test('keyframes use curve, which Final Cut accepts, not interp', () => {
  // Both are legal in the DTD, but Final Cut 12.2 drops any transform param
  // whose keyframes carry interp: "This param element was ignored because it
  // does not support the interpolation attribute". The motion silently goes.
  const { xml } = exportFCPXML(make(builtinById('pk-bold')));
  assert.ok(xml.includes('<keyframe '), 'expected animated titles');
  assert.ok(!/<keyframe [^>]*interp=/.test(xml), 'interp on a keyframe makes Final Cut ignore the param');
  assert.match(xml, /<keyframe [^>]*curve="linear"/);
});

test('every title is positioned inside the frame, in Final Cut\'s units', () => {
  // FCPXML transform positions are percent of the frame height. Pixels there
  // put every title far off-screen in Final Cut — valid XML, nothing visible.
  for (const frame of [FRAME_916, FRAME_169]) {
    const { xml } = exportFCPXML(make(builtinById('pk-bold'), frame));
    const halfW = (frame.width / frame.height) * 50;
    const values = [
      ...[...xml.matchAll(/position="([^"]+)"/g)].map((m) => m[1]),
      ...[...xml.matchAll(/<param name="position" value="([^"]+)"/g)].map((m) => m[1]),
      ...[...xml.matchAll(/<param name="position">([\s\S]*?)<\/param>/g)]
        .flatMap((m) => [...m[1].matchAll(/value="([^"]+)"/g)].map((k) => k[1])),
    ];
    assert.ok(values.length > 0);
    for (const v of values) {
      const [x, y] = v.split(' ').map(Number);
      assert.ok(Math.abs(x) <= halfW && Math.abs(y) <= 50, `position ${v} is outside a ${frame.width}x${frame.height} frame`);
    }
  }
});

test('font sizes are in Final Cut\'s 1080-line units', () => {
  // Final Cut draws title text relative to a 1080-line frame, so a vertical
  // 1080x1920 plan must write its sizes scaled by 1080/1920 or every word
  // draws 1.78x too big. Landscape 1080p is unchanged.
  for (const frame of [FRAME_916, FRAME_169]) {
    const plan = make(builtinById('pk-bold'), frame);
    const { xml } = exportFCPXML(plan);
    const written = Number(/fontSize="([^"]+)"/.exec(xml)[1]);
    const first = plan.phrases[0].words[0];
    assert.ok(Math.abs(written - first.size * (1080 / frame.height)) < 0.06, `${frame.width}x${frame.height}: wrote ${written} for size ${first.size}`);
  }
});

test('the clip form is one compound clip, the shape Final Cut drags', () => {
  const { xml } = exportFCPXML(make(builtinById('pk-bold')), { as: 'clip', projectName: 'PK Captions' });
  assert.ok(!/<library|<event|<project/.test(xml), 'a timeline drop must not carry a library or project');
  assert.match(xml, /<media id="r3" name="PK Captions">\s*<sequence/);
  assert.match(xml, /<\/resources>\s*<ref-clip ref="r3" name="PK Captions" duration="[^"]+"\/>\s*<\/fcpxml>/);
  assert.ok((xml.match(/<title /g) ?? []).length > 0);
});

test('main text and highlights can have different blends', () => {
  const t = merge(builtinById('pk-bold'), { interaction: { preset: 'invert', emphasisPreset: 'clean', heroPreset: 'clean' } });
  const words = make(t).phrases.flatMap((p) => p.words);
  assert.ok(words.some((w) => w.level !== 'normal'), 'expected some highlighted words');
  for (const w of words) assert.equal(w.blend, w.level === 'normal' ? 'difference' : 'normal', `${w.text} (${w.level})`);
  // Final Cut's own form: menu position and name. A bare "difference" is
  // silently ignored and the title imports as Normal.
  const { xml } = exportFCPXML(make(t));
  assert.match(xml, /<adjust-blend mode="22 \(Difference\)"/);
  assert.ok(!/mode="difference"|mode="normal"/.test(xml));
});

test('a colour pattern cycles in reading order, the same every time', () => {
  const pattern = ['#ff0000', '#00ff00', '#0000ff'];
  const hex = (c) => [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  const run = (scope) => make(merge(builtinById('pk-bold'), { colours: { pattern, patternScope: scope } })).phrases;

  const all = run('all').flatMap((p) => p.words);
  all.forEach((w, i) => assert.equal(hex(w.colour), pattern[i % 3].slice(1), `word ${i}`));

  const highlights = run('highlights').flatMap((p) => p.words).filter((w) => w.level !== 'normal');
  highlights.forEach((w, i) => assert.equal(hex(w.colour), pattern[i % 3].slice(1)));

  const phrases = run('phrases');
  phrases.forEach((p, pi) => p.words.forEach((w) => assert.equal(hex(w.colour), pattern[pi % 3].slice(1))));

  assert.deepEqual(run('all').flatMap((p) => p.words).map((w) => w.colour), all.map((w) => w.colour));
});

test('a face picked from the installed fonts is exported by its exact name', () => {
  const t = merge(builtinById('pk-bold'), { groups: { normal: { fontFamily: 'Montserrat', fontFace: 'ExtraBold Italic', fontWeight: 'extrabold', italic: true } } });
  const { xml } = exportFCPXML(make(t));
  assert.match(xml, /font="Montserrat" [^>]*fontFace="ExtraBold Italic"/);
});

test('the PK title carries gradient and glow as its own published controls', () => {
  const t = merge(builtinById('pk-modern'), {
    groups: { highlight: { gradient: { enabled: true, from: '#FF3B30', to: '#7C3AED' }, glow: { enabled: true, colour: '#7C3AED', intensity: 0.8, radius: 12 } } },
  });
  const plan = make(t);
  const { xml, warnings } = exportFCPXML(plan, { profile: 'pk' });
  assertWellFormed(xml);
  assert.ok(xml.includes('uid="~/Titles.localized/PK Visuals/PK Kinetic Caption/PK Kinetic Caption.moti"'));
  // Final Cut's own keys, read back from a project it exported.
  assert.ok(xml.includes('key="9999/10005/10011/5/10042/14/15" value="1 (Gradient)"'), 'gradient fill');
  assert.ok(xml.includes('key="9999/10005/10011/5/10042/14/17/1/999140132/3" value="1 0.231373 0.188235"'), 'start stop');
  assert.ok(/key="9999\/10005\/10011\/5\/10042\/38\/43" value="0.8"/.test(xml), 'glow opacity');
  // Words without a gradient switch the template's glow off rather than inherit it.
  assert.ok(xml.includes('key="9999/10005/10011/5/10042/14/15" value="0 (Color)"'));
  assert.ok(xml.includes('key="9999/10005/10011/5/10042/38/43" value="0"'));
  // Params come before the text, as the DTD orders a title's children.
  const title = xml.slice(xml.indexOf('<title '), xml.indexOf('</title>'));
  assert.ok(title.indexOf('<param') < title.indexOf('<text>'));
  assert.ok(!warnings.some((w) => w.includes('Gradient and glow')));

  const native = exportFCPXML(plan);
  assert.ok(!native.xml.includes('10042'));
  assert.ok(native.warnings.some((w) => w.includes('Gradient and glow')));
});

test('a condensed Avenir Next is exported as its own family, the way macOS names it', () => {
  // Final Cut matched nothing for "Avenir Next" / "Condensed Heavy" and drew
  // the word in 6pt Helvetica.
  const { xml } = exportFCPXML(make(builtinById('pk-modern')));
  assert.ok(!xml.includes('fontFace="Condensed'), 'no "Condensed …" face inside Avenir Next');
  if (xml.includes('Avenir Next Condensed')) assert.ok(/font="Avenir Next Condensed" fontSize="[\d.]+" fontFace="Heavy"/.test(xml));
});

/**
 * Every face a built-in style exports, checked against the faces macOS and the
 * bundled fonts actually publish (NSFontManager, October 2026). Final Cut
 * matches fontFace exactly and silently draws 6pt Helvetica when it misses,
 * so a new style or a mapping change must keep to faces that exist.
 */
const KNOWN_FACES = new Set([
  'Anton|Regular',
  'Avenir Next Condensed|Heavy',
  'Avenir Next|Bold',
  'Avenir Next|Medium',
  'Avenir Next|Regular',
  'Avenir Next|Ultra Light',
  'Cormorant Garamond|Light',
  'Didot|Italic',
  'Helvetica Neue|Bold',
  'Helvetica Neue|Condensed Black',
  'Helvetica Neue|Light',
  'Helvetica Neue|Medium',
  'Helvetica Neue|Regular',
  'Helvetica Neue|Thin',
  'Inter|Black',
  'Inter|Bold',
  'Montserrat|Black',
  'Montserrat|ExtraBold',
  'Montserrat|SemiBold',
  'Playfair Display|Bold',
  'Playfair Display|Italic',
  'Poppins|Black',
  'Poppins|Bold',
  'Poppins|ExtraBold',
]);

test('every built-in style exports only faces that exist', () => {
  for (const t of BUILTIN_TEMPLATES) {
    for (const frame of [FRAME_916, FRAME_169]) {
      const { xml } = exportFCPXML(make(t, frame));
      for (const m of xml.matchAll(/font="([^"]+)" fontSize="[^"]+" fontFace="([^"]+)"/g)) {
        assert.ok(KNOWN_FACES.has(m[1] + '|' + m[2]), t.id + ': ' + m[1] + ' / ' + m[2] + ' is not an installed face');
      }
    }
  }
});

test('a title is placed by its baseline, half a cap height below the centre the preview draws', async () => {
  // Measured in Final Cut 12.2: a title at position 0 0 draws its baseline on
  // the frame centre. Placing the word's centre there put every caption high
  // by half its cap height (more on bigger text).
  const { capHeightOf } = await import('../src/engine/typography.js');
  const plan = make(builtinById('pk-minimal'));
  const w = plan.phrases[0].words[0];
  const { xml } = exportFCPXML(plan);
  const title = xml.slice(xml.indexOf('<title '), xml.indexOf('</title>'));
  const m = /position="(-?[\d.]+) (-?[\d.]+)"/.exec(title) ?? /<keyframe time="[^"]+" value="(-?[\d.]+) (-?[\d.]+)"/.exec(title);
  const yPct = Number(m[2]);
  const expected = (w.position.y * plan.frame.height - capHeightOf(w.font, w.size) / 2) / plan.frame.height * 100;
  assert.ok(Math.abs(yPct - expected) < 0.6, `y ${yPct} vs ${expected}`);
});

/** A small project as Final Cut exports it: a 01:00:00:00 start, a gap with
 *  connected clips and markers, and its own titles using ts1 and r1–r3. */
const PROJECT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    <format id="r1" frameDuration="1001/24000s" width="1080" height="1920"/>
    <asset id="r2" name="shot" start="0s" duration="60s" hasVideo="1"><media-rep kind="original-media" src="file:///tmp/shot.mov"/></asset>
    <effect id="r3" name="Basic Title" uid=".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti"/>
  </resources>
  <library>
    <event name="Houses">
      <project name="Houses &amp; Co" uid="ABC" modDate="2026-10-02 10:00:00 +1300">
        <sequence format="r1" duration="30s" tcStart="3600s" tcFormat="NDF">
          <spine>
            <gap name="Gap" offset="3600s" start="3600s" duration="30s">
              <asset-clip ref="r2" lane="1" offset="3600s" name="shot" start="10s" duration="30s" format="r1"/>
              <title ref="r3" lane="2" offset="3605s" name="Theirs" start="0s" duration="2s">
                <text><text-style ref="ts1">Theirs</text-style></text>
                <text-style-def id="ts1"><text-style font="Helvetica" fontSize="60"/></text-style-def>
              </title>
              <marker start="3610s" duration="1001/24000s" value="Marker 1"/>
            </gap>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

test('a captioned copy of the project: captions at its first frame, the original untouched', async (t) => {
  const { captionedProject } = await import('../src/export/captioned.js');
  const plan = make(builtinById('pk-reel-bold'), { width: 1080, height: 1920, fps: 23.976 });
  const front = exportFCPXML(plan, { as: 'clip' }).xml;
  const out = captionedProject(PROJECT, [{ xml: front, lane: 11, name: 'Captions — in front' }, { xml: front, lane: 9, name: 'Captions — behind' }]);

  // A new project, named for the original, without the original's uid.
  assert.ok(out.includes('<project name="Houses &amp; Co — captions"'));
  assert.ok(!/<project[^>]*uid=/.test(out));
  // Both layers at the gap's own start (its clock reads 3600s at the project's first frame).
  assert.ok(/<ref-clip ref="pk0r\d+" lane="11" offset="3600s" name="Captions — in front"/.test(out));
  assert.ok(/<ref-clip ref="pk1r\d+" lane="9" offset="3600s"/.test(out));
  // Connected clips go before the gap's markers, as the DTD orders them.
  assert.ok(out.indexOf('name="Captions — in front"') < out.indexOf('<marker'));
  // Ids that cannot collide with the project's own r1–r3 and ts1.
  assert.ok(out.includes('id="pk0ts1"') && out.includes('ref="pk0ts1"') && out.includes('<text-style-def id="ts1">'));
  assert.equal((out.match(/\bid="r1"/g) ?? []).length, 1);

  // A project whose first item is self-closing still takes the captions.
  const lone = PROJECT.replace(/<gap[\s\S]*<\/gap>/, '<asset-clip ref="r2" offset="3600s" name="shot" start="10s" duration="30s" format="r1"/>');
  const out2 = captionedProject(lone, front);
  assert.ok(/<asset-clip [^>]*name="shot"[^>]*><ref-clip ref="pk0r\d+" lane="9" offset="10s"/.test(out2), 'offset in the clip’s own clock');

  // And Final Cut's DTD accepts the result.
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dtd = '/Applications/Final Cut Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_11.dtd';
  if (!fs.existsSync(dtd)) return t.skip('Final Cut Pro is not installed');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkkc-dtd-'));
  try {
    fs.copyFileSync(dtd, path.join(dir, 'fcpxml.dtd'));
    for (const [i, xml] of [out, out2].entries()) {
      const file = path.join(dir, `p${i}.fcpxml`);
      fs.writeFileSync(file, xml);
      execFileSync('xmllint', ['--noout', '--dtdvalid', path.join(dir, 'fcpxml.dtd'), file], { stdio: 'pipe' });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a blink exports as one keyframe per frame, alternating, never two on one frame', () => {
  const t = merge(builtinById('pk-minimal'), { motion: { in: { normal: 'blink', emphasis: 'blink', hero: 'blink' } } });
  const plan = make(t, { width: 1080, height: 1920, fps: 29.97 });
  const { xml } = exportFCPXML(plan);
  const title = xml.slice(xml.indexOf('<title '), xml.indexOf('</title>'));
  const blend = title.slice(title.indexOf('<adjust-blend'));
  const keys = [...blend.matchAll(/<keyframe time="([^"]+)" value="([^"]+)"/g)].map((m) => [m[1], Number(m[2])]);
  const times = keys.map(([time]) => time);
  assert.equal(new Set(times).size, times.length, 'one keyframe per time');
  assert.deepEqual(keys.slice(0, 8).map(([, v]) => v), [1, 0, 1, 0, 1, 0, 1, 0]);
});
