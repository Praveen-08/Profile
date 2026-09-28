/**
 * Transcript ingest.
 *
 * The editor generates the transcript once, in whatever tool they already
 * use. This module's job is to turn any of the common outputs into one shape
 * — word-level timing — because every design decision downstream (phrasing,
 * animation, reveal order) depends on knowing when each individual word is
 * spoken, not just each line.
 *
 * Where a format only carries line-level timing (plain SRT), word timings are
 * interpolated across the line by syllable weight rather than by character
 * count, which tracks real speech noticeably better.
 *
 * @typedef {import('../core/types.js').Word} Word
 * @typedef {import('../core/types.js').Transcript} Transcript
 */

let wordCounter = 0;
const nextId = (i) => `w${String(i).padStart(4, '0')}`;

/**
 * Detect the format and parse. Explicit `format` wins when given.
 * @param {string} source
 * @param {{format?: "srt"|"vtt"|"json"|"whisper"|"fcpxml"|"text", fps?: number, wpm?: number, start?: number}} [opts]
 * @returns {Transcript}
 */
export function ingest(source, opts = {}) {
  const format = opts.format ?? detectFormat(source);
  switch (format) {
    case 'srt': return finish(parseSRT(source), 'srt', opts);
    case 'vtt': return finish(parseVTT(source), 'vtt', opts);
    case 'whisper':
    case 'json': return finish(parseJSON(source), 'json', opts);
    case 'fcpxml': return finish(parseFCPXMLCaptions(source), 'fcpxml', opts);
    default: return finish(parsePlainText(source, opts), 'text', opts);
  }
}

/** @param {string} source @returns {"srt"|"vtt"|"json"|"fcpxml"|"text"} */
export function detectFormat(source) {
  const head = source.slice(0, 2048).trim();
  if (head.startsWith('WEBVTT')) return 'vtt';
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  if (head.startsWith('<?xml') || head.includes('<fcpxml')) return 'fcpxml';
  if (/^\s*\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(source)) return 'srt';
  if (/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(source)) return 'srt';
  return 'text';
}

/**
 * @param {Word[]} words
 * @param {string} src
 * @param {object} opts
 * @returns {Transcript}
 */
function finish(words, src, opts) {
  wordCounter = 0;
  const cleaned = words
    .filter((w) => w.text && w.text.trim().length > 0)
    .sort((a, b) => a.start - b.start)
    .map((w, i) => ({ ...w, id: nextId(i), index: i }));

  // Repair overlaps and zero-length words in place — transcription engines
  // emit both, and a zero-length word becomes an invisible caption.
  for (let i = 0; i < cleaned.length; i++) {
    const w = cleaned[i];
    const next = cleaned[i + 1];
    if (w.end <= w.start) w.end = w.start + 0.12;
    if (next && w.end > next.start) w.end = Math.max(w.start + 0.05, next.start);
  }
  return { words: cleaned, source: src, fps: opts.fps };
}

/* ------------------------------------------------------------------ *
 * SRT / VTT
 * ------------------------------------------------------------------ */

const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})|(\d{1,2}):(\d{2})[,.](\d{1,3})/;

/** @param {string} s @returns {number} */
export function parseTimestamp(s) {
  const m = TIME_RE.exec(s.trim());
  if (!m) return NaN;
  if (m[1] !== undefined) {
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
  }
  return Number(m[5]) * 60 + Number(m[6]) + Number(m[7].padEnd(3, '0')) / 1000;
}

/** @param {string} src @returns {Word[]} */
export function parseSRT(src) {
  /** @type {Word[]} */
  const out = [];
  const blocks = src.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim());
    const cueIdx = lines.findIndex((l) => l.includes('-->'));
    if (cueIdx === -1) continue;
    const [fromRaw, toRaw] = lines[cueIdx].split('-->');
    const start = parseTimestamp(fromRaw), end = parseTimestamp(toRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const text = lines.slice(cueIdx + 1).join(' ').trim();
    out.push(...distributeLine(text, start, end));
  }
  return out;
}

/** @param {string} src @returns {Word[]} */
export function parseVTT(src) {
  /** @type {Word[]} */
  const out = [];
  const body = src.replace(/\r\n/g, '\n').replace(/^WEBVTT[^\n]*\n/, '');
  for (const block of body.trim().split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() && !/^NOTE\b/.test(l));
    const cueIdx = lines.findIndex((l) => l.includes('-->'));
    if (cueIdx === -1) continue;
    const [fromRaw, toRaw] = lines[cueIdx].split('-->');
    const start = parseTimestamp(fromRaw), end = parseTimestamp(toRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const text = lines.slice(cueIdx + 1).join(' ');

    // VTT inline timestamps give true word timing — always prefer them.
    // They come in both `MM:SS.mmm` and `HH:MM:SS.mmm` forms.
    if (INLINE_TS.test(text)) {
      out.push(...parseVTTInline(text, start, end));
    } else {
      out.push(...distributeLine(stripTags(text), start, end));
    }
  }
  return out;
}

const stripTags = (s) => s.replace(/<[^>]*>/g, '').trim();

/** A VTT cue timestamp, with or without the hours field. */
const INLINE_TS = /<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/;

/** @param {string} text @param {number} start @param {number} end @returns {Word[]} */
function parseVTTInline(text, start, end) {
  /** @type {Word[]} */
  const out = [];
  const parts = text.split(/<(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})>/);
  let cursor = start;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) { cursor = parseTimestamp(parts[i]); continue; }
    const chunk = stripTags(parts[i]);
    if (!chunk) continue;
    const nextTs = parts[i + 1] ? parseTimestamp(parts[i + 1]) : end;
    out.push(...distributeLine(chunk, cursor, Number.isFinite(nextTs) ? nextTs : end));
    cursor = Number.isFinite(nextTs) ? nextTs : cursor;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * JSON (Whisper, WhisperX, Deepgram-ish, plain word arrays)
 * ------------------------------------------------------------------ */

/** @param {string|object} src @returns {Word[]} */
export function parseJSON(src) {
  const data = typeof src === 'string' ? JSON.parse(src) : src;
  /** @type {Word[]} */
  const out = [];

  /** @param {any} w */
  const push = (w) => {
    const text = String(w.text ?? w.word ?? w.punctuated_word ?? '').trim();
    const start = num(w.start ?? w.startTime ?? w.from ?? w.s);
    const end = num(w.end ?? w.endTime ?? w.to ?? w.e);
    if (!text || !Number.isFinite(start)) return;
    out.push({
      id: '', text, spoken: text,
      start, end: Number.isFinite(end) ? end : start + 0.25,
      confidence: Number.isFinite(num(w.confidence ?? w.probability)) ? num(w.confidence ?? w.probability) : undefined,
    });
  };

  const arrays = [];
  if (Array.isArray(data)) arrays.push(data);
  if (Array.isArray(data?.words)) arrays.push(data.words);
  if (Array.isArray(data?.segments)) {
    for (const seg of data.segments) {
      if (Array.isArray(seg.words) && seg.words.length) arrays.push(seg.words);
      else if (seg.text) out.push(...distributeLine(String(seg.text), num(seg.start), num(seg.end)));
    }
  }
  if (Array.isArray(data?.results?.channels?.[0]?.alternatives?.[0]?.words)) {
    arrays.push(data.results.channels[0].alternatives[0].words);
  }

  for (const arr of arrays) for (const w of arr) push(w);
  return out;
}

const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN);

/* ------------------------------------------------------------------ *
 * FCPXML captions (what FCP's own "Transcribe to Captions" exports)
 * ------------------------------------------------------------------ */

/** @param {string} src @returns {Word[]} */
export function parseFCPXMLCaptions(src) {
  /** @type {Word[]} */
  const out = [];
  const captionRe = /<caption\b([^>]*)>([\s\S]*?)<\/caption>/g;
  let m;
  while ((m = captionRe.exec(src))) {
    const attrs = m[1];
    const start = fcpTimeToSeconds(attr(attrs, 'offset') ?? attr(attrs, 'start'));
    const dur = fcpTimeToSeconds(attr(attrs, 'duration'));
    if (!Number.isFinite(start) || !Number.isFinite(dur)) continue;
    const text = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) out.push(...distributeLine(decodeXML(text), start, start + dur));
  }
  return out;
}

const attr = (s, name) => { const m = new RegExp(`${name}="([^"]*)"`).exec(s); return m ? m[1] : null; };

/** @param {string|null} t @returns {number} `12012/24000s` or `4s` -> seconds. */
export function fcpTimeToSeconds(t) {
  if (!t) return NaN;
  const s = t.trim().replace(/s$/, '');
  if (s.includes('/')) { const [n, d] = s.split('/').map(Number); return d ? n / d : NaN; }
  return Number(s);
}

const decodeXML = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&amp;/g, '&');

/* ------------------------------------------------------------------ *
 * Plain text
 * ------------------------------------------------------------------ */

/**
 * No timing at all — synthesise it. Useful for scripted voice-over where the
 * editor will nudge timing in the word editor afterwards.
 * @param {string} src
 * @param {{wpm?: number, start?: number}} opts
 * @returns {Word[]}
 */
export function parsePlainText(src, opts = {}) {
  const wpm = opts.wpm ?? 150;
  const perWord = 60 / wpm;
  let t = opts.start ?? 0;
  /** @type {Word[]} */
  const out = [];
  for (const raw of src.split(/\s+/).filter(Boolean)) {
    const weight = syllableWeight(raw);
    const dur = perWord * weight;
    out.push({ id: '', text: raw, spoken: raw, start: t, end: t + dur * 0.92 });
    t += dur;
    if (/[.!?]$/.test(raw)) t += perWord * 0.6;   // a real speaker breathes here
    else if (/[,;:]$/.test(raw)) t += perWord * 0.25;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Shared
 * ------------------------------------------------------------------ */

/**
 * Split a line into words and spread the line's duration across them by
 * syllable weight. Character count under-weights short heavy words ("strength")
 * and over-weights long light ones ("absolutely"); syllables track speech.
 *
 * @param {string} text @param {number} start @param {number} end @returns {Word[]}
 */
export function distributeLine(text, start, end) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length || !Number.isFinite(start)) return [];
  const span = Math.max((Number.isFinite(end) ? end : start + tokens.length * 0.35) - start, 0.001);
  const weights = tokens.map(syllableWeight);
  const total = weights.reduce((a, b) => a + b, 0) || tokens.length;

  /** @type {Word[]} */
  const out = [];
  let t = start;
  for (let i = 0; i < tokens.length; i++) {
    const dur = (weights[i] / total) * span;
    out.push({ id: '', text: tokens[i], spoken: tokens[i], start: t, end: t + dur });
    t += dur;
  }
  return out;
}

/** Rough syllable count, floored at 1, plus a small bump for trailing punctuation. */
export function syllableWeight(word) {
  const t = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!t) return 1;
  const groups = t.replace(/e$/, '').match(/[aeiouy]+/g);
  let n = groups ? groups.length : 1;
  if (/[aeiouy]le$/.test(t)) n++;
  return Math.max(1, n) + (/[.!?,;:]$/.test(word) ? 0.35 : 0);
}
