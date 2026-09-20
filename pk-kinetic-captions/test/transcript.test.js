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

test('normalisation is off unless it is asked for', () => {
  const t = ingest('four bedrooms', { format: 'text' });
  const { transcript } = normalize(t, { realEstate: true, collapse: false });
  assert.deepEqual(transcript.words.map((w) => w.text), ['four', 'bedrooms']);
});
