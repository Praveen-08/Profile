import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest, detectFormat, distributeLine, syllableWeight } from '../src/transcript/ingest.js';
import { normalize } from '../src/transcript/normalize.js';
import { findNormalisations, formatPrice } from '../src/lexicon/real-estate.js';

const SRT = `1
00:00:01,000 --> 00:00:04,200
I've always been competitive in sports,

2
00:00:04,200 --> 00:00:07,000
business and real estate.
`;

const VTT = `WEBVTT

00:00.000 --> 00:02.000
<00:00.000>Four <00:00.500>bedrooms <00:01.200>and <00:01.500>a pool
`;

test('formats are detected from their content', () => {
  assert.equal(detectFormat(SRT), 'srt');
  assert.equal(detectFormat(VTT), 'vtt');
  assert.equal(detectFormat('{"segments":[]}'), 'json');
  assert.equal(detectFormat('<?xml version="1.0"?><fcpxml/>'), 'fcpxml');
  assert.equal(detectFormat('just some words'), 'text');
});

test('SRT lines become word-level timing', () => {
  const t = ingest(SRT);
  assert.equal(t.words.length, 10);
  assert.equal(t.words[0].text, "I've");
  assert.ok(Math.abs(t.words[0].start - 1.0) < 1e-6);
  assert.ok(Math.abs(t.words.at(-1).end - 7.0) < 1e-6);
});

test('words never overlap and never have zero length', () => {
  const t = ingest(SRT);
  for (let i = 0; i < t.words.length; i++) {
    assert.ok(t.words[i].end > t.words[i].start, `word ${i} has no duration`);
    if (i) assert.ok(t.words[i].start >= t.words[i - 1].end - 1e-9, `word ${i} overlaps its predecessor`);
  }
});

test('VTT inline timestamps are used in preference to interpolation', () => {
  const t = ingest(VTT);
  const bedrooms = t.words.find((w) => w.text === 'bedrooms');
  assert.ok(Math.abs(bedrooms.start - 0.5) < 0.01, `expected 0.5s, got ${bedrooms.start}`);
});

test('Whisper-style JSON is read from segments or a flat array', () => {
  const nested = ingest(JSON.stringify({ segments: [{ words: [{ word: 'Four', start: 0, end: 0.4 }, { word: 'beds', start: 0.4, end: 1 }] }] }));
  assert.deepEqual(nested.words.map((w) => w.text), ['Four', 'beds']);
  const flat = ingest(JSON.stringify([{ text: 'Hello', start: 1, end: 1.5 }]));
  assert.equal(flat.words[0].start, 1);
});

test('long words get more time than short ones', () => {
  const words = distributeLine('a extraordinarily b', 0, 3);
  assert.ok(words[1].end - words[1].start > (words[0].end - words[0].start) * 3);
  assert.ok(syllableWeight('strength') < syllableWeight('absolutely'));
});

test('real-estate spans collapse to designed figures', () => {
  const cases = [
    ['four bedrooms', '4 BEDROOMS'],
    ['two bathrooms', '2 BATHROOMS'],
    ['six hundred and fifty square metres', '650m²'],
    ['one point five million dollars', '$1.5M'],
    ['one point two five million', '$1.25M'],
  ];
  for (const [input, expected] of cases) {
    const found = findNormalisations(input.split(' '));
    assert.equal(found[0]?.text, expected, `"${input}"`);
  }
});

test('a price format is the editor\'s choice, not the engine\'s', () => {
  assert.equal(formatPrice(1295000, 'full'), '$1,295,000');
  assert.equal(formatPrice(1295000, 'short'), '$1.295M');
  assert.equal(formatPrice(950000, 'short'), '$950K');
});

test('ordinary numbers are not mistaken for prices', () => {
  assert.equal(findNormalisations('back in nineteen ninety'.split(' ')).filter((n) => n.concept === 'PRICE').length, 0);
  assert.equal(findNormalisations('two bathrooms'.split(' '))[0].concept, 'BATHROOMS');
});

test('collapsing keeps the timing and the spoken original', () => {
  const t = ingest('This home has four bedrooms today', { format: 'text' });
  const before = t.words.find((w) => w.text === 'four');
  const after = t.words.find((w) => w.text === 'bedrooms');
  const { transcript } = normalize(t, { realEstate: true, collapse: true });
  const merged = transcript.words.find((w) => w.normalized);
  assert.equal(merged.text, '4 BEDROOMS');
  assert.equal(merged.spoken, 'four bedrooms');
  assert.equal(merged.start, before.start);
  assert.equal(merged.end, after.end);
});

test('a transcription correction does not disturb the timing around it', () => {
  const t = ingest('We work in Mana Kau every week', { format: 'text' });
  const before = t.words.map((w) => [w.text, w.start, w.end]);
  const { transcript, changes } = normalize(t, { corrections: { 'Mana Kau': 'Manukau' } });
  assert.equal(changes.length, 1);
  const fixed = transcript.words.find((w) => w.text === 'Manukau');
  assert.equal(fixed.start, before[3][1]);
  assert.equal(fixed.end, before[4][2]);
  assert.equal(transcript.words.at(-1).start, before.at(-1)[1], 'later words must not move');
});

test('captions come back frame-exact from a Final Cut XML export', async () => {
  const fs = await import('node:fs/promises');
  const url = new URL('../examples/timeline-export.fcpxml', import.meta.url);
  const t = ingest(await fs.readFile(url, 'utf8'));

  assert.equal(t.source, 'fcpxml');
  assert.ok(t.words.length > 10);

  // Final Cut writes rational times; they must survive as the exact seconds
  // they denote, or every caption drifts against the picture.
  assert.ok(Math.abs(t.words[0].start - 12012 / 30000) < 1e-9, `first word at ${t.words[0].start}`);
  const third = t.words.find((w) => /Four/.test(w.text));
  assert.ok(third && Math.abs(third.start - 210210 / 30000) < 1e-9, `third caption at ${third?.start}`);

  // And the words inside a caption must run in order without gaps or overlap.
  for (let i = 1; i < t.words.length; i++) {
    assert.ok(t.words[i].start >= t.words[i - 1].end - 1e-9, `word ${i} overlaps its predecessor`);
  }
});

test('normalisation is off unless it is asked for', () => {
  const t = ingest('four bedrooms', { format: 'text' });
  const { transcript } = normalize(t, { realEstate: true, collapse: false });
  assert.deepEqual(transcript.words.map((w) => w.text), ['four', 'bedrooms']);
});

test('mCaptionsAI caption titles give word timing when there are no captions', async () => {
  const { parseFCPXMLCaptionTitles } = await import('../src/transcript/ingest.js');
  const block = (data) => Buffer.from(JSON.stringify(data)).toString('base64');
  const words = [
    { Text: 'Want', RawStartTime: '55/100s', RawEndTime: '61/100s' },
    { Text: 'to', RawStartTime: '61/100s', RawEndTime: '71/100s' },
    { Text: 'upgrade', RawStartTime: '71/100s', RawEndTime: '112/100s' },
  ];
  const title = (offset, data) => `<title ref="r3" offset="${offset}" name="x" duration="17017/24000s">
      <text><text-style ref="ts1">Want to upgrade</text-style></text>
      <text><text-style ref="ts2">${block(data)}</text-style></text></title>`;
  // A lower third: a title with no word data must never be read as speech.
  const lowerThird = '<title ref="r4" offset="0s" duration="5s"><text><text-style ref="ts9">Jane Smith, Ray White</text-style></text></title>';
  const xml = `<fcpxml version="1.14"><spine>${lowerThird}${title('10010/24000s', { StartTime: '10010/24000s', Words: words })}</spine></fcpxml>`;

  const out = parseFCPXMLCaptionTitles(xml);
  assert.deepEqual(out.map((w) => w.text), ['Want', 'to', 'upgrade']);
  assert.equal(out[0].start, 0.55);
  assert.equal(out[2].end, 1.12);

  // Moved two seconds later on the timeline since mCaptions made it: words follow.
  const moved = parseFCPXMLCaptionTitles(`<fcpxml>${title('58010/24000s', { StartTime: '10010/24000s', Words: words })}</fcpxml>`);
  assert.ok(Math.abs(moved[0].start - 2.55) < 1e-9);

  // Real captions win when both are present.
  const both = `<fcpxml><caption offset="0s" duration="1s"><text><text-style>Hello there</text-style></text></caption>${title('10010/24000s', { StartTime: '10010/24000s', Words: words })}</fcpxml>`;
  assert.deepEqual(ingest(both, { format: 'fcpxml' }).words.map((w) => w.text), ['Hello', 'there']);
});

test('captions are placed in project time, through the clip they are connected to', () => {
  // A project starting at 01:00:00:00; a clip connected 10s in, trimmed to
  // start 5s into its media; a caption 7s into that clip's clock — so 2s
  // after the clip appears, 12s into the project. Read raw, it landed at 7s.
  const xml = `<fcpxml version="1.11"><library><event><project name="p"><sequence duration="60s" tcStart="3600s"><spine>
    <gap name="Gap" offset="3600s" start="3600s" duration="60s">
      <asset-clip ref="a1" lane="1" offset="3610s" start="5s" duration="20s">
        <caption lane="1" offset="7s" duration="2s"><text><text-style>hello there</text-style></text></caption>
      </asset-clip>
      <caption lane="2" offset="3630s" duration="1s"><text><text-style>later</text-style></text></caption>
    </gap>
    <asset-clip ref="a1" offset="3660s" start="0s" duration="10s">
      <caption lane="1" offset="1s" duration="1s"><text><text-style>end</text-style></text></caption>
    </asset-clip></spine></sequence></project></event></library></fcpxml>`;
  const t = ingest(xml);
  const at = Object.fromEntries(t.words.map((w) => [w.text, Number(w.start.toFixed(3))]));
  assert.equal(at.hello, 12);
  assert.equal(at.later, 30);
  assert.equal(at.end, 61);
});

test('mCaptions titles connected to a clip are placed through its clock too', async () => {
  const { parseFCPXMLCaptionTitles } = await import('../src/transcript/ingest.js');
  const block = Buffer.from(JSON.stringify({ StartTime: '2s', Words: [{ Text: 'Hi', RawStartTime: '2.5s', RawEndTime: '3s' }] })).toString('base64');
  const xml = `<fcpxml><library><event><project name="p"><sequence tcStart="3600s"><spine>
    <asset-clip ref="a1" offset="3605s" start="10s" duration="20s">
      <title lane="1" offset="12s" duration="2s"><text><text-style ref="a">Hi</text-style><text-style ref="b">${block}</text-style></text></title>
    </asset-clip></spine></sequence></project></event></library></fcpxml>`;
  // Clip at 5s, title 2s into it (7s), word 0.5s into the title: 7.5s.
  const [w] = parseFCPXMLCaptionTitles(xml);
  assert.equal(Number(w.start.toFixed(3)), 7.5);
});
