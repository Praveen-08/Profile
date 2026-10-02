import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest } from '../src/transcript/ingest.js';
import { normalize } from '../src/transcript/normalize.js';
import { scoreWords } from '../src/engine/emphasis.js';
import { groupPhrases } from '../src/engine/phrasing.js';
import { resolveTypography, measureWidth, applyCasing, fitToWidth } from '../src/engine/typography.js';
import { chooseZone, liveArea, rectOverlapRatio } from '../src/engine/layout.js';
import { buildMotion, sample, STYLES } from '../src/engine/motion.js';
import { resolveInteraction, adaptColourForBlend, assignLanes, INTERACTIONS } from '../src/engine/composite.js';
import { resolveWeight, faceName, resolveFamily } from '../src/engine/fonts.js';
import { compose } from '../src/engine/compose.js';
import { defaultTemplate, merge } from '../src/templates/schema.js';
import { BUILTIN_TEMPLATES, builtinById } from '../src/templates/builtin/index.js';
import { parseColour, toHex, toOKLCH } from '../src/core/colour.js';
import { normaliseToken } from '../src/lexicon/function-words.js';
import { FRAME_916, FRAME_169, AGENT_SCRIPT, LISTING_SCRIPT, TALKING_HEAD_SHOTS, allWords } from './helpers.js';

const plan = (script, template, extra = {}) =>
  compose({ transcript: ingest(script, { format: 'text' }), template, frame: FRAME_916, ...extra });

/* ------------------------------------------------------------ phrasing */

test('a phrase never ends on an article or preposition', () => {
  const HARD = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'and', 'or']);
  for (const t of BUILTIN_TEMPLATES) {
    for (const script of [AGENT_SCRIPT, LISTING_SCRIPT]) {
      for (const p of plan(script, t).phrases) {
        const last = normaliseToken(p.words.at(-1).text);
        assert.ok(!HARD.has(last), `${t.name} left "${last}" dangling in "${p.words.map((w) => w.text).join(' ')}"`);
      }
    }
  }
});

test('a compound is never split across two phrases', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const phrases = plan('We work in real estate and the sea views are the best part.', t).phrases;
    for (let i = 0; i < phrases.length - 1; i++) {
      const pair = `${normaliseToken(phrases[i].words.at(-1).text)} ${normaliseToken(phrases[i + 1].words[0].text)}`;
      assert.notEqual(pair, 'real estate');
      assert.notEqual(pair, 'sea views');
    }
  }
});

test('caption density genuinely changes how much is on screen at once', () => {
  const t = builtinById('pk-real-estate');
  const counts = ['low', 'medium', 'high'].map((d) => {
    const p = plan(LISTING_SCRIPT, merge(t, { hierarchy: { captionDensity: d } }));
    return p.stats.words / p.stats.phrases;
  });
  assert.ok(counts[0] < counts[1], `low (${counts[0]}) should be sparser than medium (${counts[1]})`);
  assert.ok(counts[1] < counts[2], `medium (${counts[1]}) should be sparser than high (${counts[2]})`);
});

test('a standout word is isolated rather than buried mid-phrase', () => {
  const t = merge(builtinById('pk-editorial'), { hierarchy: { captionDensity: 'low' } });
  const phrases = plan(AGENT_SCRIPT, t).phrases;
  const host = phrases.find((p) => p.words.some((w) => /competitive/i.test(w.text)));
  const at = host.words.findIndex((w) => /competitive/i.test(w.text));
  const shown = phrases.map((p) => p.words.map((w) => w.text).join(' ')).join(' | ');
  assert.ok(host.words.length <= 2, `"competitive" shared a caption with ${host.words.length - 1} other words: ${shown}`);
  assert.ok(at === 0 || at === host.words.length - 1, `"competitive" was buried mid-phrase: ${shown}`);
});

test('a short script puts its one standout word on screen alone', () => {
  const t = merge(builtinById('pk-editorial'), { hierarchy: { captionDensity: 'low' } });
  const phrases = plan("I've always been competitive in sports, business and real estate.", t).phrases;
  const solo = phrases.some((p) => p.words.length === 1 && /competitive/i.test(p.words[0].text));
  assert.ok(solo, `expected "competitive" alone; got ${phrases.map((p) => p.words.map((w) => w.text).join(' ')).join(' | ')}`);
});

/* ----------------------------------------------------------- hierarchy */

test('emphasis density controls how much is promoted, and never promotes everything', () => {
  const t = builtinById('pk-modern');
  const ratios = ['subtle', 'balanced', 'strong'].map((d) =>
    plan(LISTING_SCRIPT, merge(t, { hierarchy: { emphasisDensity: d } })).stats.emphasisRatio);
  assert.ok(ratios[0] < ratios[1] && ratios[1] < ratios[2], `ratios were ${ratios.join(', ')}`);
  assert.ok(ratios[2] < 0.6, 'even "strong" must leave most words as supporting type');
});

test('function words are never promoted', () => {
  for (const t of BUILTIN_TEMPLATES) {
    for (const w of allWords(plan(LISTING_SCRIPT, t))) {
      if (w.level === 'normal') continue;
      assert.ok(!['the', 'and', 'a', 'of', 'with', 'is', 'to'].includes(normaliseToken(w.text)),
        `${t.name} promoted the function word "${w.text}"`);
    }
  }
});

test('hero words respect their cooldown and their per-phrase cap', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const p = plan(`${LISTING_SCRIPT} ${AGENT_SCRIPT}`, t);
    const heroes = allWords(p).filter((w) => w.level === 'hero').sort((a, b) => a.start - b.start);
    for (let i = 1; i < heroes.length; i++) {
      assert.ok(heroes[i].start - heroes[i - 1].start >= t.hierarchy.heroCooldown - 1e-6,
        `${t.name}: heroes only ${(heroes[i].start - heroes[i - 1].start).toFixed(2)}s apart`);
    }
    for (const phrase of p.phrases) {
      assert.ok(phrase.words.filter((w) => w.level === 'hero').length <= t.hierarchy.maxHeroPerPhrase);
    }
  }
});

test('real-estate mode promotes the figures that sell the property', () => {
  const p = plan(LISTING_SCRIPT, builtinById('pk-real-estate'));
  const promoted = allWords(p).filter((w) => w.level !== 'normal').map((w) => w.text).join(' ');
  for (const needle of ['4 BEDROOMS', '$1.95M']) {
    assert.ok(promoted.includes(needle), `expected "${needle}" to be promoted; promoted set was: ${promoted}`);
  }
});

test('turning auto emphasis off leaves every word alone', () => {
  const p = plan(LISTING_SCRIPT, merge(builtinById('pk-modern'), { hierarchy: { autoEmphasis: false } }));
  assert.equal(p.stats.byLevel.emphasis + p.stats.byLevel.hero, 0);
});

/* ---------------------------------------------------------- typography */

test('type reads at the same size in portrait and landscape', () => {
  const t = builtinById('pk-modern');
  const a = resolveTypography(t, { width: 1080, height: 1920 });
  const b = resolveTypography(t, { width: 1920, height: 1080 });
  assert.equal(a.sizes.normal, b.sizes.normal);
  const c = resolveTypography(t, { width: 3840, height: 2160 });
  assert.ok(Math.abs(c.sizes.normal / b.sizes.normal - 2) < 0.02, '4K should be exactly twice 1080');
});

test('cap-height sizing keeps the hierarchy when the hero font changes', () => {
  const base = builtinById('pk-modern');
  const swapped = merge(base, { fonts: { hero: { family: 'Cormorant Garamond' } } });
  const a = resolveTypography(base, { width: 1080, height: 1920 });
  const b = resolveTypography(swapped, { width: 1080, height: 1920 });
  const capA = a.sizes.hero * 0.708, capB = b.sizes.hero * 0.66;
  assert.ok(Math.abs(capA - capB) < 1.5, 'cap heights should match even though point sizes differ');
});

test('a weight a family does not have degrades in the right direction', () => {
  assert.equal(resolveWeight('Didot', 'black'), 'bold');
  assert.equal(resolveWeight('Avenir Next', 'thin'), 'extralight');
  assert.equal(resolveWeight('Helvetica Neue', 'black'), 'black');
});

test('face names match what Final Cut expects', () => {
  assert.equal(faceName('Helvetica Neue', 'black', 'normal', false), 'Black');
  assert.equal(faceName('Helvetica Neue', 'bold', 'condensed', false), 'Condensed Bold');
  assert.equal(faceName('Avenir Next', 'semibold', 'normal', false), 'Demi Bold');
  assert.equal(faceName('Didot', 'regular', 'normal', true), 'Italic');
});

test('a missing font falls back to one with the same intention', () => {
  const installed = new Set(['helvetica neue', 'didot']);
  assert.equal(resolveFamily('Cormorant Garamond', installed).family, 'Didot');
  assert.equal(resolveFamily('Inter', installed).family, 'Helvetica Neue');
});

test('units keep their case even in an uppercase style', () => {
  assert.equal(applyCasing('650m²', 'upper'), '650m²');
  assert.equal(applyCasing('four bedrooms', 'upper'), 'FOUR BEDROOMS');
});

test('no word is ever wider than the frame allows', () => {
  for (const t of BUILTIN_TEMPLATES) {
    for (const frame of [FRAME_916, FRAME_169]) {
      const p = compose({ transcript: ingest('Extraordinary architecturally uncompromising waterfront', { format: 'text' }), template: t, frame });
      for (const w of allWords(p)) {
        assert.ok(w.box.w <= t.hierarchy.maxWidth + 0.02,
          `${t.name} ${frame.aspect}: "${w.text}" is ${(w.box.w * 100).toFixed(0)}% of frame width`);
      }
    }
  }
});

test('shrink-to-fit only shrinks', () => {
  const t = builtinById('pk-bold');
  const ty = resolveTypography(t, { width: 1080, height: 1920 });
  const fit = fitToWidth('SHORT', ty.fonts.hero, ty.sizes.hero, 10000);
  assert.equal(fit.size, ty.sizes.hero);
  assert.ok(fitToWidth('UNCOMPROMISINGLY', ty.fonts.hero, ty.sizes.hero, 600).size < ty.sizes.hero);
});

/* -------------------------------------------------------------- layout */

test('type stays inside the safe area when the safe area is on', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const p = plan(LISTING_SCRIPT, t, { shots: TALKING_HEAD_SHOTS });
    const live = liveArea(FRAME_916, t);
    for (const w of allWords(p)) {
      assert.ok(w.box.y - w.box.h / 2 >= live.y - live.h / 2 - 0.03, `${t.name}: "${w.text}" sits below the safe area`);
      assert.ok(w.box.y + w.box.h / 2 <= live.y + live.h / 2 + 0.03, `${t.name}: "${w.text}" sits above the safe area`);
    }
  }
});

test('composition follows the subject into the empty side of the frame', () => {
  const t = builtinById('pk-real-estate');
  const right = chooseZone({ id: 'p1', start: 0 }, t, FRAME_916,
    { start: 0, end: 9, kind: 'talkingHead', face: { x: 0.12, y: 0.2, w: 0.2, h: 0.15 }, subject: { x: 0.2, y: -0.1, w: 0.5, h: 0.8 } }, null, false);
  const left = chooseZone({ id: 'p1', start: 0 }, t, FRAME_916,
    { start: 0, end: 9, kind: 'talkingHead', face: { x: -0.12, y: 0.2, w: 0.2, h: 0.15 }, subject: { x: -0.2, y: -0.1, w: 0.5, h: 0.8 } }, null, false);
  assert.ok(right.zone.endsWith('Left'), `subject on the right should push type left, got ${right.zone}`);
  assert.ok(left.zone.endsWith('Right'), `subject on the left should push type right, got ${left.zone}`);
});

test('a static style does not move', () => {
  const p = plan(LISTING_SCRIPT, builtinById('pk-minimal'), { shots: TALKING_HEAD_SHOTS });
  assert.equal(new Set(p.phrases.map((ph) => ph.zone)).size, 1);
});

test('a dynamic style moves, but not on every caption', () => {
  const p = plan(`${LISTING_SCRIPT} ${AGENT_SCRIPT}`, builtinById('pk-bold'), { shots: [{ start: 0, end: 60, kind: 'property' }] });
  const zones = p.phrases.map((ph) => ph.zone);
  const changes = zones.filter((z, i) => i && z !== zones[i - 1]).length;
  assert.ok(new Set(zones).size > 1, 'a dynamic style should use more than one zone');
  assert.ok(changes < zones.length * 0.7, `the composition changed ${changes} times in ${zones.length} phrases — that is hopping, not designing`);
});

test('normal captions keep clear of the face', () => {
  const t = merge(builtinById('pk-real-estate'), { position: { faceAvoidance: true, heroMayOverlap: false } });
  const face = TALKING_HEAD_SHOTS[0].face;
  for (const w of allWords(plan(LISTING_SCRIPT, t, { shots: TALKING_HEAD_SHOTS }))) {
    if (w.level === 'hero') continue;
    assert.ok(rectOverlapRatio(w.box, face) < 0.5, `"${w.text}" covers the face`);
  }
});

/* -------------------------------------------------------------- motion */

test('opacity never leaves 0..1 for any style, level or animation', () => {
  const ins = ['fade', 'rise', 'slide', 'scale', 'pop', 'blur', 'stretch', 'type', 'reveal', 'maskReveal'];
  const outs = ['fade', 'scale', 'slide', 'blur', 'shrink', 'maskExit'];
  for (const style of Object.keys(STYLES)) {
    for (const level of ['normal', 'emphasis', 'hero']) {
      for (const i of ins) {
        for (const o of outs) {
          const t = merge(defaultTemplate(), { motion: { style, in: { [level]: i }, out: { [level]: o } } });
          const m = buildMotion({ level, template: t, life: 1.4, capFraction: 0.08, capabilities: { blur: true } });
          for (let k = 0; k <= 40; k++) {
            const v = sample(m.opacity, (k / 40) * 1.4, 1);
            assert.ok(v >= -1e-9 && v <= 1 + 1e-9, `${style}/${level}/${i}/${o} produced opacity ${v}`);
          }
        }
      }
    }
  }
});

test('every word gets a real hold between arriving and leaving', () => {
  for (const style of Object.keys(STYLES)) {
    for (const life of [0.25, 0.6, 1.5, 4]) {
      const t = merge(defaultTemplate(), { motion: { style } });
      const m = buildMotion({ level: 'hero', template: t, life, capFraction: 0.1 });
      assert.ok(m.inDuration + m.outDuration <= life * 0.71 + 1e-6,
        `${style} at ${life}s spends ${(m.inDuration + m.outDuration).toFixed(2)}s animating`);
    }
  }
});

test('exits accelerate rather than blinking off', () => {
  for (const style of Object.keys(STYLES)) {
    const t = merge(defaultTemplate(), { motion: { style } });
    const m = buildMotion({ level: 'normal', template: t, life: 2, capFraction: 0.06 });
    const outStart = 2 - m.outDuration;
    const quarter = sample(m.opacity, outStart + m.outDuration * 0.25, 1);
    assert.ok(quarter > 0.55, `${style} had already dropped to ${quarter.toFixed(2)} a quarter of the way out`);
  }
});

test('hero words are given more motion than normal ones', () => {
  const t = merge(defaultTemplate(), { motion: { style: 'editorial' } });
  const normal = buildMotion({ level: 'normal', template: t, life: 3, capFraction: 0.05 });
  const hero = buildMotion({ level: 'hero', template: t, life: 3, capFraction: 0.12 });
  assert.ok(hero.inDuration > normal.inDuration);
});

test('the default plan contains nothing the stock title cannot render', () => {
  for (const t of BUILTIN_TEMPLATES) {
    for (const w of allWords(plan(AGENT_SCRIPT, t))) {
      assert.equal(w.motion.blur.length, 0, `${t.name} put blur in a native-profile plan`);
    }
  }
});

/* ----------------------------------------------------------- compositing */

test('creative presets map to real compositing modes', () => {
  assert.equal(INTERACTIONS.invert.blend, 'difference');
  assert.equal(INTERACTIONS.ghost.blend, 'screen');
  assert.equal(INTERACTIONS.ink.blend, 'multiply');
  assert.equal(INTERACTIONS.knockout.blend, 'stencilAlpha');
});

test('a colour that would vanish under its blend mode is adapted, with a reason', () => {
  const dark = adaptColourForBlend(parseColour('#101010'), 'screen');
  assert.ok(toOKLCH(dark.colour).L > 0.5 && dark.note);
  const pale = adaptColourForBlend(parseColour('#f0ede8'), 'multiply');
  assert.ok(toOKLCH(pale.colour).L < 0.5 && pale.note);
  assert.equal(toHex(adaptColourForBlend(parseColour('#14b8a6'), 'normal').colour), '#14b8a6');
});

test('hero type can take a different interaction from the rest', () => {
  const t = merge(defaultTemplate(), { interaction: { preset: 'clean', heroPreset: 'invert', heroBehindSubject: true } });
  assert.equal(resolveInteraction('normal', t).blend, 'normal');
  assert.equal(resolveInteraction('hero', t).blend, 'difference');
  assert.equal(resolveInteraction('hero', t).depth, 'background');
});

test('the largest word goes furthest back so it never covers its context', () => {
  const lanes = assignLanes([
    { id: 'small', level: 'normal', size: 60, depth: 'foreground' },
    { id: 'huge', level: 'hero', size: 300, depth: 'foreground' },
  ]);
  assert.ok(lanes.get('huge') < lanes.get('small'));
});

/* ----------------------------------------------------------- determinism */

test('the same input always produces the same design', () => {
  for (const t of BUILTIN_TEMPLATES) {
    const a = plan(LISTING_SCRIPT, t, { shots: TALKING_HEAD_SHOTS });
    const b = plan(LISTING_SCRIPT, t, { shots: TALKING_HEAD_SHOTS });
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${t.name} is not deterministic`);
  }
});

/* ------------------------------------------------------ global restyling */

test('changing the accent moves every emphasis word and nothing else', () => {
  const t = builtinById('pk-real-estate');
  const before = plan(LISTING_SCRIPT, t);
  const after = plan(LISTING_SCRIPT, t, { accent: '#14b8a6' });
  const emph = allWords(after).filter((w) => w.level === 'emphasis');
  assert.ok(emph.length > 0);
  for (const w of emph) assert.equal(toHex(w.colour), '#14b8a6');
  const normalsBefore = allWords(before).filter((w) => w.level === 'normal').map((w) => toHex(w.colour));
  const normalsAfter = allWords(after).filter((w) => w.level === 'normal').map((w) => toHex(w.colour));
  assert.deepEqual(normalsAfter, normalsBefore, 'normal words should not have changed colour');
});

test('changing the hero font moves every hero word', () => {
  const t = merge(builtinById('pk-real-estate'), { fonts: { hero: { family: 'Didot', italic: true } } });
  const heroes = allWords(plan(`${LISTING_SCRIPT} ${AGENT_SCRIPT}`, t)).filter((w) => w.level === 'hero');
  assert.ok(heroes.length > 0, 'expected at least one hero word');
  for (const w of heroes) {
    assert.equal(w.font.family, 'Didot');
    assert.equal(w.font.italic, true);
  }
});

/* -------------------------------------------------------------- overrides */

test('a manual override wins, is flagged, and survives a template change', () => {
  const t = builtinById('pk-real-estate');
  const first = allWords(plan(AGENT_SCRIPT, t)).find((w) => w.level === 'normal' && /sports/i.test(w.text));
  const overrides = { [first.id]: { level: 'hero', colour: '#ff3ea5', scale: 1.4 } };

  const withOverride = allWords(plan(AGENT_SCRIPT, t, { overrides })).find((w) => w.id === first.id);
  assert.equal(withOverride.level, 'hero');
  assert.equal(toHex(withOverride.colour), '#ff3ea5');
  assert.equal(withOverride.overridden, true);

  const otherStyle = allWords(plan(AGENT_SCRIPT, builtinById('pk-luxury'), { overrides })).find((w) => w.id === first.id);
  assert.equal(otherStyle.level, 'hero');
  assert.equal(toHex(otherStyle.colour), '#ff3ea5');
});

test('clearing an override restores exactly what the template would have done', () => {
  const t = builtinById('pk-modern');
  const before = JSON.stringify(plan(AGENT_SCRIPT, t));
  const w = allWords(plan(AGENT_SCRIPT, t))[3];
  plan(AGENT_SCRIPT, t, { overrides: { [w.id]: { level: 'hero' } } });
  assert.equal(JSON.stringify(plan(AGENT_SCRIPT, t)), before);
});

test('an editor can hide a word entirely', () => {
  const t = builtinById('pk-modern');
  const w = allWords(plan(AGENT_SCRIPT, t))[2];
  const after = plan(AGENT_SCRIPT, t, { overrides: { [w.id]: { hidden: true } } });
  assert.equal(allWords(after).some((x) => x.id === w.id), false);
});

test('one word can be styled on its own: look, colour, size, text', async () => {
  const { compose } = await import('../src/engine/compose.js');
  const { ingest } = await import('../src/transcript/ingest.js');
  const { builtinById } = await import('../src/templates/builtin/index.js');
  const frame = { width: 1080, height: 1920, fps: 30, aspect: '9:16', safeArea: true };
  const transcript = ingest('Welcome to a beautiful family home with sea views.', { format: 'text' });
  const run = (overrides) => compose({ transcript, template: builtinById('pk-bold'), frame, overrides }).phrases.flatMap((p) => p.words);
  const words = run({});
  const small = words.find((w) => w.text === 'to');
  const other = words.find((w) => w.text === 'home');

  const after = run({
    [small.id]: { look: 'invert', colour: '#ff0000', scale: 1.5 },
    [other.id]: { text: 'house' },
  });
  const w = after.find((x) => x.id === small.id);
  assert.equal(w.blend, 'difference');
  assert.ok(Math.abs(w.size - small.size * 1.5) < 0.01, `${w.size} vs ${small.size}`);
  assert.deepEqual([w.colour.r, w.colour.g, w.colour.b].map((v) => Math.round(v * 255)), [255, 0, 0]);
  assert.equal(after.find((x) => x.id === other.id).text, 'house');

  // Its neighbours are untouched.
  for (const x of after.filter((x) => x.id !== small.id && x.id !== other.id)) {
    const before = words.find((y) => y.id === x.id);
    assert.equal(x.blend, before.blend);
    assert.deepEqual(x.colour, before.colour);
  }

  // A long word cannot be scaled past the frame's safe width.
  const long = words.find((x) => x.text === 'BEAUTIFUL');
  const capped = run({ [long.id]: { scale: 3 } }).find((x) => x.id === long.id);
  assert.ok(capped.box.w <= 0.87, `box width ${capped.box.w}`);

  // Resizing one word leaves every other word exactly where it was.
  const resized = run({ [small.id]: { scale: 1.8 } });
  for (const x of resized.filter((x) => x.id !== small.id)) {
    const before = words.find((y) => y.id === x.id);
    assert.deepEqual(x.position, before.position, `${x.text} moved`);
    assert.equal(x.size, before.size);
  }
  assert.deepEqual(resized.find((x) => x.id === small.id).position, small.position, 'the word grows about its own centre');
});

test('main text, highlights and colour-pattern words can each animate their own way', async () => {
  const { compose } = await import('../src/engine/compose.js');
  const { ingest } = await import('../src/transcript/ingest.js');
  const { builtinById } = await import('../src/templates/builtin/index.js');
  const { merge } = await import('../src/templates/schema.js');
  const frame = { width: 1080, height: 1920, fps: 30, aspect: '9:16', safeArea: true };
  const transcript = ingest('Welcome to a beautiful family home with stunning sea views and a double garage.', { format: 'text' });
  const template = merge(builtinById('pk-bold'), {
    motion: { in: { normal: 'fade', emphasis: 'rise', hero: 'rise' }, patternIn: 'pop', patternOut: 'shrink' },
    colours: { pattern: ['#ff0000', '#00ff00'], patternScope: 'highlights' },
  });
  const words = compose({ transcript, template, frame }).phrases.flatMap((p) => p.words);
  const normal = words.filter((w) => w.level === 'normal');
  const highlighted = words.filter((w) => w.level !== 'normal');
  assert.ok(normal.length && highlighted.length);
  for (const w of normal) assert.equal(w.motion.inAnimation, 'fade');
  // With the pattern on highlights, every highlight is a pattern word.
  for (const w of highlighted) assert.deepEqual([w.motion.inAnimation, w.motion.outAnimation], ['pop', 'shrink']);

  // Without a pattern, highlights use their level's animation.
  const plain = compose({ transcript, template: merge(template, { colours: { pattern: [] } }), frame }).phrases.flatMap((p) => p.words);
  for (const w of plain.filter((x) => x.level !== 'normal')) assert.equal(w.motion.inAnimation, 'rise');
});

test('animation can be tuned per group and per word: duration, distance, direction, easing', async () => {
  const { compose } = await import('../src/engine/compose.js');
  const { ingest } = await import('../src/transcript/ingest.js');
  const { builtinById } = await import('../src/templates/builtin/index.js');
  const { merge } = await import('../src/templates/schema.js');
  const { sample } = await import('../src/engine/motion.js');
  const frame = { width: 1080, height: 1920, fps: 30, aspect: '9:16', safeArea: true };
  const transcript = ingest('Welcome home to this stunning four bedroom family home with views over the water.', { format: 'text' });
  const template = merge(builtinById('pk-bold'), {
    motion: {
      in: { normal: 'slide', emphasis: 'rise', hero: 'rise' },
      tune: { normal: { inDuration: 0.4, direction: 'down', distance: 2 }, emphasis: { direction: 'left', ease: 'linear' } },
    },
  });
  const words = compose({ transcript, template, frame }).phrases.flatMap((p) => p.words);
  const normal = words.find((w) => w.level === 'normal' && w.end - w.start > 2);
  assert.ok(normal, 'expected a long-lived normal word');
  // Slides DOWN into place: starts above (+y), no sideways travel.
  assert.ok(sample(normal.motion.offsetY, 0, 0) > 0);
  assert.equal(normal.motion.offsetX.length, 0);
  assert.ok(Math.abs(normal.motion.inDuration - 0.4) < 1e-9);

  const emph = words.find((w) => w.level === 'emphasis');
  assert.ok(emph);
  // Comes in from the right, moving left.
  assert.ok(sample(emph.motion.offsetX, 0, 0) > 0);
  assert.equal(emph.motion.offsetY.length, 0);

  // A word's own tune wins over its group's.
  const id = normal.id;
  const solo = compose({ transcript, template, frame, overrides: { [id]: { tune: { direction: 'up', inDuration: 0.25 } } } })
    .phrases.flatMap((p) => p.words).find((w) => w.id === id);
  assert.ok(sample(solo.motion.offsetY, 0, 0) < 0, 'up means it starts below');
  assert.ok(Math.abs(solo.motion.inDuration - 0.25) < 1e-9);

  // The 30% hold survives any duration asked for.
  const greedy = compose({ transcript, template: merge(template, { motion: { tune: { normal: { inDuration: 9, outDuration: 9 } } } }), frame })
    .phrases.flatMap((p) => p.words).filter((w) => w.level === 'normal');
  for (const w of greedy) {
    const life = w.end - w.start;
    assert.ok(w.motion.inDuration <= life * 0.35 + 1e-9 && w.motion.outDuration <= life * 0.35 + 1e-9);
  }
});

test('groups style together: main, highlights, hook and pattern, with the word on top', async () => {
  const { compose } = await import('../src/engine/compose.js');
  const { ingest } = await import('../src/transcript/ingest.js');
  const { builtinById } = await import('../src/templates/builtin/index.js');
  const { merge } = await import('../src/templates/schema.js');
  const frame = { width: 1080, height: 1920, fps: 30, aspect: '9:16', safeArea: true };
  const transcript = ingest('Stop scrolling. This stunning family home has four bedrooms, two bathrooms and sweeping sea views from every room.', { format: 'text' });
  const rgb = (c) => [c.r, c.g, c.b].map((v) => Math.round(v * 255)).join(',');
  const template = merge(builtinById('pk-bold'), {
    hook: { enabled: true, seconds: 1 },
    groups: {
      normal: { fontWeight: 'light', scale: 0.8, colour: '#dddddd', opacity: 0.7 },
      highlight: { fontWeight: 'black', scale: 1.3, colour: '#00ff00' },
      hook: { colour: '#ff0000', fontWeight: 'heavy' },
    },
  });
  const phrases = compose({ transcript, template, frame }).phrases;
  const words = phrases.flatMap((p) => p.words);
  const hook = words.filter((w) => w.start < 1);
  const rest = words.filter((w) => w.start >= 1.5);
  assert.ok(hook.length && rest.length);

  for (const w of hook) assert.equal(rgb(w.colour), '255,0,0', `hook word ${w.text}`);
  for (const w of rest.filter((x) => x.level === 'normal')) {
    assert.equal(rgb(w.colour), '221,221,221');
    assert.equal(w.font.weight, 'light');
    // Opacity scales the whole fade: it peaks at 70%, not 100%.
    assert.ok(Math.max(...w.motion.opacity.map((k) => k.v)) <= 0.7 + 1e-9);
  }
  for (const w of rest.filter((x) => x.level !== 'normal')) {
    assert.equal(rgb(w.colour), '0,255,0');
    assert.equal(w.font.weight, 'black');
  }

  // A word's own colour beats the hook's.
  const first = hook[0];
  const solo = compose({ transcript, template, frame, overrides: { [first.id]: { colour: '#0000ff' } } })
    .phrases.flatMap((p) => p.words).find((w) => w.id === first.id);
  assert.equal(rgb(solo.colour), '0,0,255');

  // With a colour pattern on highlights, the pattern colours them, not the group.
  const patterned = compose({ transcript, template: merge(template, { colours: { pattern: ['#123456'], patternScope: 'highlights' } }), frame })
    .phrases.flatMap((p) => p.words).filter((w) => w.level !== 'normal' && w.start >= 1.5);
  for (const w of patterned) assert.equal(rgb(w.colour), '18,52,86');
});

test('the editor can start a new caption, join the caption before, or break a line', () => {
  const transcript = ingest('This beautiful home has four bedrooms and a stunning view of the harbour at sunset', { format: 'text' });
  const template = builtinById('pk-modern');
  const frame = { width: 1080, height: 1920, fps: 30 };
  const base = compose({ transcript, template, frame });
  const firstOf = (plan) => plan.phrases.map((p) => p.words[0].text.toLowerCase());
  const phraseOf = (plan, text) => plan.phrases.findIndex((p) => p.words.some((w) => w.text.toLowerCase() === text));

  // A new caption at "four".
  const four = transcript.words.find((w) => w.text === 'four');
  const split = compose({ transcript, template, frame, overrides: { [four.id]: { breakBefore: 'caption' } } });
  assert.ok(firstOf(split).includes('four'), 'a caption starts at "four"');

  // Join the first word of the second caption onto the first.
  const second = base.phrases[1].words[0];
  const joined = compose({ transcript, template, frame, overrides: { [second.id]: { breakBefore: 'join' } } });
  assert.equal(phraseOf(joined, second.text.toLowerCase()), 0, `"${second.text}" stays with the first caption`);

  // A new line inside a caption, without a new caption.
  const w = base.phrases[0].words[1];
  const lined = compose({ transcript, template, frame, overrides: { [w.id]: { breakBefore: 'line' } } });
  const p0 = lined.phrases[0].words;
  const a = p0.find((x) => x.id === base.phrases[0].words[0].id), b = p0.find((x) => x.id === w.id);
  assert.ok(a.position.y > b.position.y + 0.005, 'the word moved onto a line below');
  assert.equal(lined.phrases.length, base.phrases.length);
});

test('a cross dissolve is opacity only, on a gentle curve, in and out', () => {
  const t = merge(builtinById('pk-editorial'), { motion: { in: { normal: 'dissolve', emphasis: 'dissolve', hero: 'dissolve' }, out: { normal: 'dissolve', emphasis: 'dissolve', hero: 'dissolve' } } });
  const plan = compose({ transcript: ingest('A calm and quiet home by the water', { format: 'text' }), template: t, frame: { width: 1080, height: 1920, fps: 30 } });
  const first = plan.phrases[0].words[0];
  assert.ok(first.motion.inDuration >= 0.3, 'a word with room to breathe gets a real dissolve');
  for (const w of plan.phrases.flatMap((p) => p.words)) {
    assert.deepEqual(w.motion.offsetX, []);
    assert.deepEqual(w.motion.offsetY, []);
    assert.deepEqual(w.motion.scale, []);
    assert.ok(w.motion.blur.every((k) => k.v === 0));
    assert.equal(w.motion.opacity[0].v, 0);
    assert.equal(w.motion.opacity.at(-1).v, 0);
  }
});

test('a blink is whole frames on and off, then stays on', () => {
  const t = merge(builtinById('pk-minimal'), { motion: { in: { normal: 'blink', emphasis: 'blink', hero: 'blink' } } });
  const fps = 25;
  const plan = compose({ transcript: ingest('Simply stunning views across the whole harbour', { format: 'text' }), template: t, frame: { width: 1080, height: 1920, fps } });
  const w = plan.phrases[0].words[0];
  const at = (k) => sample(w.motion.opacity, k / fps, 1);
  const seq = Array.from({ length: 10 }, (_, k) => at(k));
  assert.deepEqual(seq.slice(0, 8), [1, 0, 1, 0, 1, 0, 1, 0], 'on, off, on, off … one frame each');
  assert.equal(seq[8], 1, 'then it stays');
  assert.ok(seq.every((v) => v === 0 || v === 1), 'never a fade between');
});

test('a word can stay on screen through the next caption', () => {
  const transcript = ingest('This beautiful home has four bedrooms and a stunning view of the harbour at sunset', { format: 'text' });
  const template = builtinById('pk-modern');
  const frame = { width: 1080, height: 1920, fps: 30 };
  const base = compose({ transcript, template, frame });
  const w = base.phrases[0].words[0];
  const plan = compose({ transcript, template, frame, overrides: { [w.id]: { tune: { stayThrough: 1 } } } });
  const held = plan.phrases[0].words.find((x) => x.id === w.id);
  const next = plan.phrases[1];
  assert.ok(held.end >= next.words[next.words.length - 1].start, 'still on while the next caption plays');
  assert.ok(Math.abs(held.end - Math.max(...next.words.map((x) => x.end))) < 0.05, 'leaves with that caption');
  // Its neighbours keep their own timing.
  const other = plan.phrases[0].words[1];
  assert.equal(other.end, base.phrases[0].words[1].end);
});
