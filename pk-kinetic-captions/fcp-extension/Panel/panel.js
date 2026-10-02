/**
 * The Final Cut panel.
 *
 * It imports the engine modules directly — the same files the command line
 * and the standalone app use — so every design decision is made in one place
 * and cannot drift between the three front ends. Swift is asked only for the
 * things a web view cannot do: talk to Final Cut, and read and write the
 * styles folder.
 *
 * The preview draws the same plan the export writes, over a still of the
 * editor's own footage, so what is styled here is what lands in Final Cut.
 */

import { compose } from './engine/compose.js';
import { exportFCPXML } from './export/fcpxml.js';
import { captionedProject } from './export/captioned.js';
import { ingest, distributeLine } from './transcript/ingest.js';
import { merge } from './templates/schema.js';
import { BUILTIN_TEMPLATES } from './templates/builtin/index.js';
import { parseColour, toHex } from './core/colour.js';
import { frameFromFCPXML } from './frame.js';
import { videoSegments, pictureAt } from './timeline.js';
import { renderFrame } from './render/svg.js';
import { setTextMeasurer, setCapMeasurer } from './engine/typography.js';
import { WEIGHT_NUMERIC, exportFamily } from './engine/fonts.js';

// Lay words out by their real width in the real font. The same face is what
// Final Cut renders, so spacing in the export matches the preview.
{
  const ctx = document.createElement('canvas').getContext('2d');
  const SIZE = 200;
  // A missing font would be measured in a fallback without any error. It is
  // installed only if the width does not change with the fallback chosen.
  const installed = new Map();
  const isInstalled = (family) => {
    if (!installed.has(family)) {
      const probe = 'mmmmmmmmmlliWW@#';
      const w = (fallback) => { ctx.font = `${SIZE}px "${family}", ${fallback}`; return ctx.measureText(probe).width; };
      installed.set(family, w('monospace') === w('serif'));
    }
    return installed.get(family);
  };
  setTextMeasurer((text, font) => {
    // Measure the family Final Cut will draw (Avenir Next's condensed cut is its own family).
    const family = font.face ? font.family : exportFamily(font.family, font.width);
    if (!ctx || !isInstalled(family)) return NaN;
    ctx.font = `${font.italic ? 'italic ' : ''}${WEIGHT_NUMERIC[font.weight] ?? 400} ${SIZE}px "${family}"`;
    return ctx.measureText(text).width / SIZE;
  });
  // The font's own cap height, from an "H": it places each word's baseline.
  const caps = new Map();
  setCapMeasurer((font) => {
    const family = font.face ? font.family : exportFamily(font.family, font.width);
    if (!ctx || !isInstalled(family)) return NaN;
    const key = `${family}|${font.weight}|${font.italic}`;
    if (!caps.has(key)) {
      ctx.font = `${font.italic ? 'italic ' : ''}${WEIGHT_NUMERIC[font.weight] ?? 400} ${SIZE}px "${family}"`;
      caps.set(key, ctx.measureText('H').actualBoundingBoxAscent / SIZE);
    }
    return caps.get(key);
  });
}

const $ = (sel) => /** @type {any} */ (document.querySelector(sel));
const $$ = (sel) => [...document.querySelectorAll(sel)];

/** @type {any} */
const state = {
  transcript: null,
  templateId: 'pk-real-estate',
  patch: {},
  overrides: {},
  plan: null,
  frame: { width: 1080, height: 1920, fps: 30, aspect: '9:16', safeArea: true },
  userTemplates: [],
  /**
   * The editor's own settings, applied over whichever style is chosen.
   * Sizes are kept per orientation: vertical and horizontal video want
   * different type sizes, and switching between them should not mean
   * re-setting the slider each time. Saved through Swift, so they survive
   * closing the panel.
   */
  custom: {
    sizeVertical: 100,
    sizeHorizontal: 100,
    /**
     * Text style per group: fontFamily, fontFace, fontWeight, italic, scale,
     * casing, colour, opacity, look. Anything unset follows the style.
     */
    groups: { normal: {}, highlight: {}, hook: {}, pattern: {} },
    /** The opening line: phrases starting in the first `seconds`. */
    hook: { enabled: false, seconds: 3 },
    patternScope: 'off',
    pattern: ['#c9a84c', '#14b8a6', '#f97362', '#a78bfa'],
    // Where the editor dragged the captions, per orientation, as a fraction
    // of the frame (centre origin, +y up — the engine's own coordinates).
    offsetVertical: { x: 0, y: 0 },
    offsetHorizontal: { x: 0, y: 0 },
    /**
     * Animation, per group. Each group is {in, out, tune}; anything unset
     * follows the style. `high` covers emphasis and hero words; `pattern` the
     * words the colour pattern picks out.
     */
    anim: { feel: '', reveal: '', groups: { normal: {}, high: {}, pattern: {} } },
    /**
     * Where captions sit. 'style' lets the style move them around the
     * picture; 'fixed' puts every phrase on one line (y, from the top, as a
     * fraction of the frame), kept inside the chosen platform's safe zone.
     */
    place: { mode: 'style', safe: 'reels', guides: true, lines: {}, zones: {} },
  },
  /** Per-phrase moves on top of the overall offset, keyed by first word id. */
  phraseNudges: /** @type {Record<string, {x: number, y: number}>} */ ({}),
  /** Per-word moves, on top of the phrase's. */
  wordNudges: /** @type {Record<string, {x: number, y: number}>} */ ({}),
  /** The word being styled on its own. */
  selected: /** @type {string|null} */ (null),
  /** The dropped timeline's pictures, for the preview. */
  segments: /** @type {import('./timeline.js').Segment[]} */ ([]),
  time: 0,
  playing: false,
};

const isVertical = () => state.frame.height > state.frame.width;
const sizeKey = () => (isVertical() ? 'sizeVertical' : 'sizeHorizontal');

/* ------------------------------------------------------------------ *
 * The native bridge
 * ------------------------------------------------------------------ */

/**
 * Messages to Swift are promises; Swift replies by calling `resolve` with the
 * id it was given. Without the id, two calls in flight would resolve each
 * other's promises — which across a web-view boundary is a bug that only
 * shows up under load and is miserable to find.
 */
const pending = new Map();
let nextId = 0;

window.pkkc = {
  /** Swift -> panel, unprompted. */
  receive(event, payload) {
    if (event === 'timelineDropped') useTimelineXML(payload.fcpxml, 'dragged in');
    if (event === 'hostConnected') markConnected(true);
    if (event === 'license') showLicence(payload);
  },
  /** Swift -> panel, answering a call. */
  resolve(payload) {
    const entry = pending.get(payload.__id);
    if (!entry) return;
    pending.delete(payload.__id);
    if (payload.__ok) return entry.resolve(payload);
    // Keep the reply's other fields (e.g. which folder needs access) on the error.
    entry.reject(Object.assign(new Error(payload.error ?? 'Final Cut refused the request.'), payload));
  },
};

/**
 * @param {string} name @param {object} [body]
 * @returns {Promise<any>}
 */
function callNative(name, body = {}) {
  const handler = window.webkit?.messageHandlers?.[name];
  if (!handler) return Promise.reject(new Error(`Not running inside Final Cut (no "${name}" handler).`));

  const id = `m${nextId++}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    handler.postMessage({ ...body, __id: id });
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error('Final Cut did not answer.'));
    }, 20000);
  });
}

/* ------------------------------------------------------------------ *
 * Sources
 * ------------------------------------------------------------------ */

/**
 * Take the captions out of a timeline.
 *
 * This is the whole reason the panel is worth building: Final Cut has already
 * transcribed and aligned the words, so reading its FCPXML gives word timing
 * that is correct by construction — nothing to export, nothing to type,
 * nothing to sync.
 *
 * @param {string} xml @param {string} how
 */
function useTimelineXML(xml, how) {
  try {
    const transcript = ingest(xml, { format: 'fcpxml' });
    if (!transcript.words.length) {
      return noteSource('That timeline has no captions on it. Transcribe the clip in Final Cut first.', true);
    }
    state.rawTranscript = transcript;
    state.droppedXml = xml;
    state.projectName = /<project\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1]?.replace(/&amp;/g, '&') ?? '';
    state.textEdits = [];
    state.transcript = transcript;
    state.segments = videoSegments(xml);
    state.phraseNudges = {};
    state.wordNudges = {};
    state.overrides = {};
    state.selected = null;
    state.time = 0;
    adoptFrameFrom(xml);
    noteSource(`${transcript.words.length} words ${how}.`);
    $('#step-source').classList.add('is-loaded');
    // Shaping the captions is the first step: start there.
    showTab('words');
    state.editsKey = projectKey(xml, transcript);
    // Nothing is saved for this project until its saved edits have been
    // read back, or the empty state of a fresh drop would overwrite them.
    state.editsReady = false;
    history.reset();
    regenerate();
    restoreEdits(state.editsKey, transcript);
  } catch (err) {
    noteSource(`Could not read that timeline: ${err.message}`, true);
  }
}

/**
 * Report on a drop right under the drop zone. The status line is at the foot
 * of the panel, out of sight of where the editor just dropped something.
 */
function noteSource(text, isError = false) {
  $('#source-note').textContent = text;
  $('#source-note').style.color = isError ? 'var(--danger)' : '';
}

/** Design against the sequence's real dimensions and rate, not a guess. */
function adoptFrameFrom(xml) {
  state.frame = { ...state.frame, ...frameFromFCPXML(xml, state.frame) };
  showCustom();
}

/* ------------------------------------------------------------------ *
 * Design
 * ------------------------------------------------------------------ */

function currentTemplate() {
  const all = [...BUILTIN_TEMPLATES, ...state.userTemplates];
  return all.find((t) => t.id === state.templateId) ?? BUILTIN_TEMPLATES[5];
}

function regenerate() {
  if (!state.transcript) return;
  if (state.rawTranscript) state.transcript = editedTranscript();
  try {
    const template = merge(merge(currentTemplate(), state.patch), customPatch(currentTemplate()));
    state.plan = compose({
      transcript: state.transcript,
      template,
      frame: state.frame,
      overrides: state.overrides,
    });

    applyPositions(state.plan);
    drawPreview();
    history.record();
    saveEditsSoon();

    const s = state.plan.stats;
    $('#wstats').textContent = `${s.words} words · ${s.byLevel.normal}/${s.byLevel.emphasis}/${s.byLevel.hero}`;
    drawWords();
    $('#apply').disabled = s.words === 0;
    $('#dragout').classList.toggle('is-off', s.words === 0);
    setStatus(`${state.frame.width}×${state.frame.height} · ${state.frame.fps}fps · ${s.phrases} phrases`);
  } catch (err) {
    setStatus(err.message, true);
  }
}

/* ------------------------------------------------------------------ *
 * Preview
 * ------------------------------------------------------------------ */

const offsetKey = () => (isVertical() ? 'offsetVertical' : 'offsetHorizontal');

/**
 * Move the composed captions where the editor dragged them. Applied to the
 * plan itself, so the export carries exactly what the preview shows.
 */
function applyPositions(plan) {
  if (isFixed()) return fixPositions(plan);
  const all = state.custom[offsetKey()] ?? { x: 0, y: 0 };
  for (const phrase of plan.phrases) {
    const own = state.phraseNudges[phrase.words[0]?.id] ?? { x: 0, y: 0 };
    for (const w of phrase.words) {
      const mine = state.wordNudges[w.id] ?? { x: 0, y: 0 };
      const dx = all.x + own.x + mine.x, dy = all.y + own.y + mine.y;
      if (!dx && !dy) continue;
      w.position = { x: w.position.x + dx, y: w.position.y + dy };
      w.box = { ...w.box, x: w.box.x + dx, y: w.box.y + dy };
    }
  }
}

/* ------------------------------------------------------------------ *
 * Safe zones and the fixed caption line
 * ------------------------------------------------------------------ */

/**
 * Where each platform's own interface covers a vertical video, as fractions
 * of the frame: the top bar, the caption/buttons block at the bottom, and
 * the like/comment/share column on the right. Approximate — the apps change
 * their layouts — and deliberately on the generous side.
 */
const SAFE_ZONES = {
  reels: { name: 'Instagram Reels', top: 0.14, bottom: 0.22, left: 0.06, right: 0.13 },
  tiktok: { name: 'TikTok', top: 0.10, bottom: 0.20, left: 0.06, right: 0.16 },
  shorts: { name: 'YouTube Shorts', top: 0.08, bottom: 0.21, left: 0.06, right: 0.15 },
};
SAFE_ZONES.all = {
  name: 'All platforms',
  top: Math.max(...Object.values(SAFE_ZONES).map((z) => z.top)),
  bottom: Math.max(...Object.values(SAFE_ZONES).map((z) => z.bottom)),
  left: Math.max(...Object.values(SAFE_ZONES).map((z) => z.left)),
  right: Math.max(...Object.values(SAFE_ZONES).map((z) => z.right)),
};
/** Horizontal video: broadcast title-safe, 5% each side. */
const TITLE_SAFE = { name: 'Title', top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 };

function place() {
  // Normalised in place, never copied: callers write into what this returns.
  const p = state.custom.place ?? (state.custom.place = {});
  // Settings saved before per-platform lines: start on Instagram.
  if ('yVertical' in p) { p.safe = 'reels'; delete p.yVertical; delete p.yHorizontal; }
  p.mode ??= 'style';
  p.safe ??= 'reels';
  p.guides ??= true;
  p.lines ??= {};
  p.zones ??= {};
  return p;
}
const isFixed = () => place().mode === 'fixed';
/** Which platform's settings apply: vertical video has one per platform. */
const platformKey = () => (isVertical() ? place().safe : 'horizontal');

/** The platform's safe rectangle (fractions from each edge), with the editor's changes. */
function zoneFor(key) {
  if (key === 'off') return null;
  const base = key === 'horizontal' ? TITLE_SAFE : (SAFE_ZONES[key] ?? SAFE_ZONES.reels);
  return { ...base, ...(place().zones[key] ?? {}) };
}
/** The safe rectangle in use, or null when off. */
const safeZone = () => zoneFor(platformKey());

/** Each platform keeps its own caption line; a new one starts just above its bottom zone. */
function getLine() {
  const key = platformKey();
  const saved = place().lines[key];
  if (saved !== undefined) return saved;
  const z = zoneFor(key);
  return z ? Math.min(0.68, 1 - z.bottom - 0.1) : 0.8;
}
function setLine(y) { place().lines[platformKey()] = y; }

/**
 * Fixed place: every phrase centred on the caption line, across the middle
 * of the safe zone, and pushed back inside it if it would cross an edge.
 * Per-word nudges still apply on top, for the odd word that needs it.
 */
function fixPositions(plan) {
  const z = safeZone() ?? { top: 0, bottom: 0, left: 0, right: 0 };
  // Engine coordinates: centre origin, +y up, fractions of the frame.
  const lineY = 0.5 - getLine();
  const midX = (z.left - z.right) / 2;
  const top = 0.5 - z.top, bottom = -0.5 + z.bottom, left = -0.5 + z.left, right = 0.5 - z.right;
  for (const phrase of plan.phrases) {
    const ws = phrase.words;
    if (!ws.length) continue;
    // Measured on the layout before any word's own resize, so making one
    // word bigger does not move the phrase.
    const bx = (w) => w.layoutBox ?? w.box;
    const pad = (w) => bx(w).h * 0.45;    // room for ascenders and descenders around the cap height
    const t = Math.max(...ws.map((w) => bx(w).y + bx(w).h / 2 + pad(w)));
    const b = Math.min(...ws.map((w) => bx(w).y - bx(w).h / 2 - pad(w)));
    const l = Math.min(...ws.map((w) => bx(w).x - bx(w).w / 2));
    const r = Math.max(...ws.map((w) => bx(w).x + bx(w).w / 2));
    let dy = lineY - (t + b) / 2;
    let dx = midX - (l + r) / 2;
    if (t + dy > top) dy = top - t;
    if (b + dy < bottom) dy = bottom - b;
    if (r + dx > right) dx = right - r;
    if (l + dx < left) dx = left - l;
    for (const w of ws) {
      const mine = state.wordNudges[w.id] ?? { x: 0, y: 0 };
      const ox = dx + mine.x, oy = dy + mine.y;
      w.position = { x: w.position.x + ox, y: w.position.y + oy };
      w.box = { ...w.box, x: w.box.x + ox, y: w.box.y + oy };
      if (w.layoutBox) w.layoutBox = { ...w.layoutBox, x: w.layoutBox.x + ox, y: w.layoutBox.y + oy };
    }
  }
}

/** The guides over the preview: what the apps cover, and the caption line. */
function drawGuides() {
  const host = $('#pv-guides');
  const p = place();
  const z = safeZone();
  if (!state.plan || !p.guides || (!z && !isFixed())) { host.innerHTML = ''; return; }
  const W = state.frame.width, H = state.frame.height;
  const parts = [];
  if (z) {
    const x0 = z.left * W, x1 = W - z.right * W, y0 = z.top * H, y1 = H - z.bottom * H;
    // Shade what the app covers; outline what is left.
    parts.push(`<path d="M0 0H${W}V${H}H0Z M${x0} ${y0}V${y1}H${x1}V${y0}Z" fill="rgba(255,64,64,.16)" fill-rule="evenodd"/>`);
    parts.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="${W / 400}" stroke-dasharray="${W / 60} ${W / 90}"/>`);
    parts.push(`<text x="${x0 + W * 0.012}" y="${y0 - H * 0.008}" fill="rgba(255,255,255,.75)" font-size="${H * 0.017}" font-family="-apple-system, sans-serif">${z.name} safe zone</text>`);
  }
  if (isFixed()) {
    const y = getLine() * H;
    parts.push(`<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#c9a84c" stroke-width="${W / 300}" stroke-dasharray="${W / 40} ${W / 60}"/>`);
    parts.push(`<text x="${W * 0.985}" y="${y - H * 0.008}" text-anchor="end" fill="#c9a84c" font-size="${H * 0.017}" font-family="-apple-system, sans-serif">caption line</text>`);
  }
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${parts.join('')}</svg>`;
}

/** Show the Position controls from state. */
function showPlace() {
  const p = place();
  for (const b of $$('#place-mode button')) b.classList.toggle('is-on', b.dataset.v === p.mode);
  for (const b of $$('#place-safe button')) b.classList.toggle('is-on', b.dataset.v === p.safe);
  $('#place-guides').checked = p.guides;
  $('#place-line-row').hidden = p.mode !== 'fixed';
  $('#place-y').value = String(Math.round(getLine() * 100));
  $('#place-y-val').textContent = `${Math.round(getLine() * 100)}% down`;
  // The zone's edges, for the platform in use.
  const z = safeZone();
  $('#zone-edit').hidden = !z || !$('#zone-toggle').classList.contains('is-on');
  $('#zone-toggle').hidden = !z;
  if (z) {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      $(`#zone-${edge}`).value = String(Math.round(z[edge] * 100));
      $(`#zone-${edge}-val`).textContent = `${Math.round(z[edge] * 100)}%`;
    }
    $('#zone-name').textContent = z.name;
    $('#zone-reset').disabled = !place().zones[platformKey()];
  }
  $('#place-safe-row').hidden = !isVertical();
}

function planDuration() {
  const words = state.plan ? state.plan.phrases.flatMap((p) => p.words) : [];
  const fromWords = words.length ? Math.max(...words.map((w) => w.end)) : 0;
  const fromVideo = state.segments.length ? Math.max(...state.segments.map((x) => x.end)) : 0;
  return Math.max(fromWords, fromVideo, 1);
}

function drawPreview() {
  const host = $('#step-preview');
  if (!state.plan) { host.hidden = true; return; }
  host.hidden = false;

  const pv = $('#pv');
  pv.style.aspectRatio = `${state.frame.width} / ${state.frame.height}`;
  // Fit inside the panel: the width the column allows, or the height cap.
  // Side by side, the preview has the column's height to fill; stacked, it
  // keeps to a third of the window so the settings below stay usable.
  const wide = window.innerWidth >= 760;
  const maxH = wide ? Math.max(200, window.innerHeight - 390) : window.innerHeight * 0.34;
  pv.style.width = `${Math.min(pv.parentElement.clientWidth, maxH * state.frame.width / state.frame.height)}px`;

  const dur = planDuration();
  $('#pv-scrub').max = String(dur);
  $('#pv-scrub').value = String(state.time);
  $('#pv-time').textContent = `${state.time.toFixed(1)}s`;
  // Words behind the agent are drawn under a cut-out of the people in the
  // frame, as the masked copy of the shot covers them in Final Cut.
  const behind = hasBehind();
  $('#pv-back').innerHTML = behind ? renderFrame(state.plan, { time: state.time, plate: 'none', scale: 1, standalone: true, depth: 'background', idPrefix: 'b-' }) : '';
  $('#pv-svg').innerHTML = renderFrame(state.plan, { time: state.time, plate: 'none', scale: 1, standalone: true, ...(behind ? { depth: 'foreground' } : {}) });
  $('#pv-cut').hidden = !behind || state.playing || !$('#pv-cut').getAttribute('src');
  $('#dragout-back').hidden = !behind;
  $('#dragout b').textContent = behind ? 'Or drag: in front' : 'Or drag onto a timeline';
  const isProject = Boolean(state.droppedXml && /<project\b/.test(state.droppedXml));
  $('#send-sub').textContent = isProject
    ? `a copy of “${state.projectName}” with the captions in sync${behind ? ', ready for the masked shot' : ''}`
    : 'as a new project (drag the project itself for a synced copy)';
  $('#pv-empty').hidden = state.segments.length > 0;
  drawGuides();
  drawSelection();
  requestFrame(state.time);
}

const allWords = () => state.plan?.phrases.flatMap((p) => p.words) ?? [];
const selectedWord = () => allWords().find((w) => w.id === state.selected) ?? null;

/** Outline the selected word in the preview, when it is on screen. */
function drawSelection() {
  const box = $('#pv-sel');
  const w = selectedWord();
  if (!w || state.time < w.start || state.time >= w.end) { box.hidden = true; return; }
  const b = w.box;
  box.hidden = false;
  box.style.left = `${(b.x - b.w / 2 + 0.5) * 100}%`;
  box.style.width = `${b.w * 100}%`;
  box.style.top = `${(0.5 - b.y - b.h * 0.75) * 100}%`;
  box.style.height = `${b.h * 1.5 * 100}%`;
}

/** The word under a point in the preview, among those on screen now. */
function wordAtPoint(clientX, clientY) {
  const rect = $('#pv').getBoundingClientRect();
  const nx = (clientX - rect.left) / rect.width - 0.5;
  const ny = 0.5 - (clientY - rect.top) / rect.height;
  let best = null, bestDist = Infinity;
  for (const w of allWords()) {
    if (state.time < w.start || state.time >= w.end) continue;
    const dx = Math.abs(nx - w.box.x) - w.box.w / 2;
    const dy = Math.abs(ny - w.box.y) - w.box.h;
    const d = Math.max(dx, 0) + Math.max(dy, 0);
    if (d < bestDist) { best = w; bestDist = d; }
  }
  return bestDist < 0.04 ? best : null;
}

function select(id, { seek: doSeek = false } = {}) {
  state.selected = id;
  const w = selectedWord();
  if (doSeek && w) state.time = Math.min(w.start + 0.1 + (w.end - w.start) * 0.1, w.end - 0.01);
  showWord();
  drawWords();
  drawPreview();
}

/** Fill the selected-word controls from the word and its overrides. */
function showWord() {
  const host = $('#step-word');
  const w = selectedWord();
  $('#pv-quick').hidden = !w;
  $('#pv-quick-break').hidden = !w;
  $('#word-empty').hidden = Boolean(w);
  if (!w) { host.hidden = true; return; }
  host.hidden = false;
  const o = state.overrides[w.id] ?? {};
  $('#w-text').value = o.text ?? w.text;
  setSeg('#w-level', w.level);
  setSeg('#pv-level', w.level);
  setSeg('#w-break', o.breakBefore ?? 'auto');
  setSeg('#w-with', o.withPrevious ? 'with' : 'own');
  setSeg('#pv-break', o.breakBefore ?? 'auto');
  $('#pv-quick-word').textContent = o.text ?? w.text;
  const pct = Math.round((o.scale ?? 1) * 100);
  void pct;
  wordStyle.show(o, toHex(w.colour));
  wordEditor.show({ in: o.inAnimation, out: o.outAnimation, tune: o.tune });
  $('#w-hide').textContent = 'Delete word';
}

/** Change the selected word's overrides, then redesign. */
function overrideSelected(patch) {
  const id = state.selected;
  if (!id) return;
  const next = { ...(state.overrides[id] ?? {}), ...patch };
  for (const [k, v] of Object.entries(next)) if (v === undefined || v === null || v === '') delete next[k];
  if (Object.keys(next).length) state.overrides[id] = next; else delete state.overrides[id];
  regenerate();
  showWord();
}

function stepWord(dir) {
  const words = allWords();
  const i = words.findIndex((w) => w.id === state.selected);
  const next = words[Math.max(0, Math.min(words.length - 1, (i < 0 ? 0 : i + dir)))];
  if (next) select(next.id, { seek: true });
}

/* Frames come from Swift one at a time. While one is decoding, only the most
   recent request is kept, so scrubbing and playback never queue up behind
   frames nobody wants any more. */
let frameBusy = false;
let frameWanted = /** @type {number|null} */ (null);
let frameShown = { src: '', time: -1 };

/** Whether any word is set behind the agent. */
const hasBehind = () => Boolean(state.plan?.phrases.some((p) => p.words.some((w) => w.depth === 'background')));

function requestFrame(t) {
  frameWanted = t;
  if (!frameBusy) pumpFrame();
}

function pumpFrame() {
  if (frameWanted === null) return;
  const t = frameWanted;
  frameWanted = null;
  const pic = pictureAt(state.segments, t);
  const img = $('#pv-img');
  if (!pic) { img.hidden = true; frameShown = { src: '', time: -1 }; return; }
  // Cutting the agent out takes about half a second, so it is done for a
  // still picture, not during playback.
  const cutout = hasBehind() && !state.playing;
  if (pic.src === frameShown.src && (pic.still || Math.abs(pic.time - frameShown.time) < 1 / 30) && cutout === frameShown.cutout) return;

  frameBusy = true;
  const height = Math.round(Math.min(1080, $('#pv').clientHeight * (window.devicePixelRatio || 1)));
  callNative('frame', { path: pic.src, time: pic.time, height, cutout })
    .then(({ image, person }) => {
      img.src = image; img.hidden = false;
      const cut = $('#pv-cut');
      if (person) cut.src = person; else cut.removeAttribute('src');
      cut.hidden = !cutout || !person;
      frameShown = { src: pic.src, time: pic.time, cutout };
    })
    .catch((err) => {
      if (err.message === 'needsAccess') return askForAccess(pic.src, err.folder);
      setStatus(`Preview: ${err.message}`, true);
    })
    .finally(() => { frameBusy = false; pumpFrame(); });
}

/** Footage not yet allowed: offer the one-time grant on the preview itself. */
let accessFor = '';
function askForAccess(src, folder) {
  accessFor = src;
  $('#pv-access-folder').textContent = folder || 'this drive';
  $('#pv-access').hidden = false;
}
$('#pv-access-btn').onclick = () => {
  callNative('grantAccess', { path: accessFor })
    .then(() => { $('#pv-access').hidden = true; frameShown = { src: '', time: -1 }; requestFrame(state.time); })
    .catch((err) => setStatus(err.message, true));
};

function seek(t) {
  state.time = Math.max(0, Math.min(t, planDuration()));
  drawPreview();
}

let playFrom = 0, playClock = 0;
function togglePlay() {
  state.playing = !state.playing;
  $('#pv-play').textContent = state.playing ? '❚❚' : '▶';
  if (!state.playing) { drawPreview(); return; }     // paused: fetch the frame with its cut-out
  if (state.time >= planDuration() - 0.05) state.time = 0;
  playFrom = state.time;
  playClock = performance.now();
  requestAnimationFrame(tick);
}
function tick(now) {
  if (!state.playing) return;
  state.time = playFrom + (now - playClock) / 1000;
  if (state.time >= planDuration()) { state.time = planDuration(); state.playing = false; $('#pv-play').textContent = '▶'; }
  drawPreview();
  if (state.playing) requestAnimationFrame(tick);
}

/**
 * Play the phrase being edited from its first word, then freeze again on the
 * frame the editor was looking at — so an animation change can be judged
 * without losing the place.
 */
let replayTimer = 0;
function replayCurrentPhrase() {
  const phrase = (state.plan?.phrases ?? []).find((p) => p.words.some((w) => w.id === state.selected)) ?? phraseAt(state.time);
  if (!phrase) return;
  const start = Math.min(...phrase.words.map((w) => w.start));
  const end = Math.max(...phrase.words.map((w) => w.end));
  const freezeAt = state.time;
  cancelAnimationFrame(replayTimer);
  if (state.playing) togglePlay();
  const t0 = performance.now();
  const step = (now) => {
    const t = start + (now - t0) / 1000;
    if (t >= end) { state.time = freezeAt; drawPreview(); return; }
    state.time = t;
    drawPreview();
    replayTimer = requestAnimationFrame(step);
  };
  replayTimer = requestAnimationFrame(step);
}

/** The phrase on screen at the current time, if any. */
function phraseAt(t) {
  for (const p of state.plan?.phrases ?? []) {
    const start = Math.min(...p.words.map((w) => w.start));
    const end = Math.max(...p.words.map((w) => w.end));
    if (t >= start && t < end) return p;
  }
  return null;
}

/** Drag on the preview to move the captions; the export follows. */
/**
 * Drag on the preview to move captions; hold ⌘ while dragging to resize them.
 * Up or right grows, down or left shrinks. The Word / Phrase / All captions
 * choice decides what moves or resizes. Everything lands in the export.
 */
function wirePreviewDrag() {
  const pv = $('#pv');
  let drag = null;
  const clampScale = (v) => Math.min(4, Math.max(0.3, v));
  // Show which gesture is armed: a resize cursor while ⌘ is held.
  const cursor = (e) => { pv.style.cursor = e.metaKey ? 'nwse-resize' : 'move'; };
  pv.addEventListener('pointermove', cursor);
  window.addEventListener('keydown', (e) => { if (e.key === 'Meta') pv.style.cursor = 'nwse-resize'; });
  window.addEventListener('keyup', (e) => { if (e.key === 'Meta') pv.style.cursor = 'move'; });

  pv.addEventListener('pointerdown', (e) => {
    if (!state.plan) return;
    const scope = $('#drag-scope .is-on')?.dataset.v ?? 'word';
    const resize = e.metaKey;
    let target;
    if (scope === 'word') {
      const w = wordAtPoint(e.clientX, e.clientY);
      if (!w) return;
      if (w.id !== state.selected) select(w.id);
      target = { word: w.id };
    } else if (scope === 'phrase') {
      const phrase = phraseAt(state.time);
      if (!phrase) return setStatus('No phrase on screen here — scrub to one, then drag it.', true);
      target = { phrase };
    } else {
      target = { all: true };
    }

    if (resize) {
      // Each word's own size at the start of the gesture, so a phrase keeps
      // its proportions while it grows.
      const ids = target.word ? [target.word] : target.phrase ? target.phrase.words.map((w) => w.id) : [];
      const bases = Object.fromEntries(ids.map((id) => [id, state.overrides[id]?.scale ?? 1]));
      drag = { mode: 'resize', x: e.clientX, y: e.clientY, target, bases, baseAll: state.custom[sizeKey()] };
    } else {
      const base = target.word ? { ...(state.wordNudges[target.word] ?? { x: 0, y: 0 }) }
        : target.phrase ? { ...(state.phraseNudges[target.phrase.words[0].id] ?? { x: 0, y: 0 }) }
          : { ...state.custom[offsetKey()] };
      // With a fixed caption line, moving a phrase or all of them moves the
      // line itself, so every phrase stays in the same place.
      if (isFixed() && !target.word) {
        drag = { mode: 'line', y: e.clientY, base: getLine() };
        return pv.setPointerCapture(e.pointerId);
      }
      drag = { mode: 'move', x: e.clientX, y: e.clientY, target, base };
    }
    pv.setPointerCapture(e.pointerId);
  });

  pv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = pv.getBoundingClientRect();
    const dx = (e.clientX - drag.x) / rect.width;
    const dy = (e.clientY - drag.y) / rect.height;
    if (drag.mode === 'line') {
      // Snap to the thirds, the middle, and the safe zone's lower edge area.
      let y = Math.min(0.95, Math.max(0.05, drag.base + dy));
      const z = safeZone();
      const snaps = [1 / 3, 0.5, 2 / 3, ...(z ? [1 - z.bottom - 0.04] : [])];
      const near = snaps.find((s) => Math.abs(s - y) < 0.012);
      if (near !== undefined && !e.altKey) y = near;
      setLine(y);
      showPlace();
      setStatus(`Caption line ${Math.round(y * 100)}% down${near !== undefined && !e.altKey ? ' · snapped' : ''} (hold ⌥ to move freely)`);
      regenerate();
      return;
    }
    if (drag.mode === 'move') {
      const next = { x: drag.base.x + dx, y: drag.base.y - dy };
      if (drag.target.word) state.wordNudges[drag.target.word] = next;
      else if (drag.target.phrase) state.phraseNudges[drag.target.phrase.words[0].id] = next;
      else state.custom[offsetKey()] = next;
    } else {
      // Up or right grows; a quarter of the preview's size doubles it.
      const factor = Math.pow(2, (dx - dy) * 4);
      if (drag.target.all) {
        state.custom[sizeKey()] = Math.round(Math.min(300, Math.max(30, drag.baseAll * factor)));
        $('#size').value = state.custom[sizeKey()];
        $('#size-val').textContent = `${state.custom[sizeKey()]}%`;
      } else {
        for (const [id, base] of Object.entries(drag.bases)) {
          const scale = Math.round(clampScale(base * factor) * 100) / 100;
          if (Math.abs(scale - 1) < 0.005) {
            const { scale: _, ...rest } = state.overrides[id] ?? {};
            if (Object.keys(rest).length) state.overrides[id] = rest; else delete state.overrides[id];
          } else {
            state.overrides[id] = { ...(state.overrides[id] ?? {}), scale };
          }
        }
      }
      setStatus(drag.target.all ? `Overall size ${state.custom[sizeKey()]}%`
        : `Size ${Math.round((state.overrides[Object.keys(drag.bases)[0]]?.scale ?? 1) * 100)}%`);
    }
    regenerate();
    if (drag.target.word) showWord();
  });
  const end = () => { if (drag) { drag = null; changed(); } };
  pv.addEventListener('pointerup', end);
  pv.addEventListener('pointercancel', end);
}

/** The editor's settings, as a patch over the chosen style. */
function customPatch(base) {
  const c = state.custom;
  const pct = c[sizeKey()] / 100;
  const a = c.anim ?? {};
  const g = a.groups ?? {};
  // "Cross dissolve everything": the default for every word, which a type's
  // or a word's own animation can still override.
  const dz = a.dissolve ? 'dissolve' : undefined;
  const motionIn = dz ? { normal: dz, emphasis: dz, hero: dz } : {};
  const motionOut = dz ? { normal: dz, emphasis: dz, hero: dz } : {};
  if (g.normal?.in) motionIn.normal = g.normal.in;
  if (g.high?.in) { motionIn.emphasis = g.high.in; motionIn.hero = g.high.in; }
  if (g.normal?.out) motionOut.normal = g.normal.out;
  if (g.high?.out) { motionOut.emphasis = g.high.out; motionOut.hero = g.high.out; }
  return {
    motion: {
      ...(a.feel ? { style: a.feel } : {}),
      ...(a.reveal ? { reveal: a.reveal } : {}),
      in: motionIn, out: motionOut,
      patternIn: g.pattern?.in || dz, patternOut: g.pattern?.out || dz,
      tune: { normal: g.normal?.tune ?? {}, emphasis: g.high?.tune ?? {}, hero: g.high?.tune ?? {}, pattern: g.pattern?.tune ?? {} },
    },
    scale: { base: base.scale.base * pct },
    hook: { enabled: Boolean(c.hook?.enabled), seconds: c.hook?.seconds ?? 3 },
    groups: {
      normal: clean(c.groups?.normal),
      highlight: clean(c.groups?.highlight),
      pattern: clean(c.groups?.pattern),
      // The hook animates on its own too, from the animation editor's Hook tab.
      hook: {
        ...clean(c.groups?.hook),
        ...(g.hook?.in ? { inAnimation: g.hook.in } : {}),
        ...(g.hook?.out ? { outAnimation: g.hook.out } : {}),
        ...(g.hook?.tune && Object.keys(g.hook.tune).length ? { tune: g.hook.tune } : {}),
      },
    },
    colours: {
      pattern: c.patternScope === 'off' ? [] : c.pattern,
      patternScope: c.patternScope === 'off' ? 'highlights' : c.patternScope,
    },
    // Fixed place: one composition the panel then puts on the caption line,
    // with lines broken to fit between the safe zone's sides.
    ...(isFixed() ? {
      position: { mode: 'static', home: 'center', faceAvoidance: false, align: 'center' },
      hierarchy: {
        maxWidth: Math.min(base.hierarchy.maxWidth, (() => { const z = safeZone(); return z ? (1 - z.left - z.right) * 0.96 : 0.9; })()),
      },
    } : {}),
  };
}

/** Put every control in step with state.custom. */
function showCustom() {
  const c = state.custom;
  $('#size').value = c[sizeKey()];
  $('#size-val').textContent = `${c[sizeKey()]}%`;
  $('#size-orient').textContent = isVertical() ? '· vertical' : '· horizontal';
  setSeg('#pattern-scope', c.patternScope);
  showPlace();
  showGroupStyle();
  drawPattern();
  $('#a-feel').value = c.anim?.feel ?? '';
  setSeg('#a-reveal', c.anim?.reveal || 'spoken');
  setSeg('#a-dissolve', c.anim?.dissolve ? 'on' : 'off');
  showTypeCards();
}

function drawPattern() {
  const host = $('#pattern');
  host.classList.toggle('is-off', state.custom.patternScope === 'off');
  host.replaceChildren(...state.custom.pattern.map((hex, i) => {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = hex;
    input.title = 'Click to change · Alt-click to remove';
    input.oninput = () => { state.custom.pattern[i] = input.value; changed(); };
    input.onclick = (e) => {
      if (!e.altKey || state.custom.pattern.length <= 2) return;
      e.preventDefault();
      state.custom.pattern.splice(i, 1);
      drawPattern();
      changed();
    };
    return input;
  }));
  if (state.custom.pattern.length < 6) {
    const add = document.createElement('button');
    add.textContent = '+ colour';
    add.onclick = () => { state.custom.pattern.push('#ffffff'); drawPattern(); changed(); };
    host.append(add);
  }
}

function setSeg(sel, value) {
  for (const b of $$(`${sel} button`)) b.classList.toggle('is-on', b.dataset.v === value);
}

let saveTimer = 0;
/** Something the editor set changed: redesign, and remember it. */
function changed() {
  regenerate();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => callNative('savePrefs', { json: JSON.stringify(state.custom) }).catch(() => {}), 400);
}

function drawWords() {
  const host = $('#words');
  host.replaceChildren();
  state.plan.phrases.forEach((phrase, pi) => {
    // Each caption is its own group: drag words between neighbouring groups,
    // click between two words to break a line or split the caption.
    const group = document.createElement('div');
    group.className = 'wgroup';
    group.dataset.phrase = String(pi);
    host.append(group);

    const num = Object.assign(document.createElement('span'), { className: 'wnum', textContent: String(pi + 1) });
    group.append(num);

    phrase.words.forEach((w, wi) => {
      if (wi > 0) {
        // Between two words: shows and cycles the break before the second.
        const brk = state.overrides[w.id]?.breakBefore;
        const newLine = brk === 'line' || (w.line ?? 0) > (phrase.words[wi - 1].line ?? 0);
        const gap = document.createElement('button');
        gap.className = `wgap${brk === 'line' ? ' is-line' : newLine ? ' is-wrap' : ''}`;
        gap.dataset.id = w.id;
        gap.title = brk === 'line' ? 'New line here — click to split the caption here'
          : 'Click: new line here · click again: split the caption here';
        gap.textContent = newLine ? '↵' : '';
        gap.onclick = (e) => { e.stopPropagation(); cycleBreak(pi, wi); };
        group.append(gap);
        if (newLine) group.append(Object.assign(document.createElement('span'), { className: 'wnl' }));
      }
      const chip = document.createElement('button');
      chip.className = `wchip lv-${w.level}`;
      chip.dataset.id = w.id;
      chip.dataset.phrase = String(pi);
      chip.dataset.index = String(wi);
      chip.textContent = w.text;
      chip.title = `${w.level} · ${w.start.toFixed(2)}s — drag to the caption before or after · double-click: main ↔ highlight`;
      chip.classList.toggle('is-sel', w.id === state.selected);
      // The dot marks a word styled on its own — not one only regrouped.
      const styled = Object.keys(state.overrides[w.id] ?? {}).some((k) => !['breakBefore', 'withPrevious'].includes(k));
      chip.classList.toggle('is-custom', styled || Boolean(state.wordNudges[w.id]));
      if (state.overrides[w.id]?.withPrevious) chip.classList.add('is-with');
      // A word that stays on into the next caption.
      if (state.overrides[w.id]?.tune?.stayThrough) {
        chip.classList.add('is-stays');
        chip.title = `Stays on through ${state.overrides[w.id].tune.stayThrough === 1 ? 'the next caption' : `${state.overrides[w.id].tune.stayThrough} captions`} · ${chip.title}`;
      }
      // Click selects; clicking the selected word again edits it in place.
      chip.onclick = (e) => {
        if (wordDrag.moved) return;
        if (e.target.closest('.wx')) return;
        if (state.selected === w.id) return editWordInline(chip, w);
        select(w.id, { seek: true });
      };
      const x = Object.assign(document.createElement('span'), { className: 'wx', textContent: '×', title: 'Delete this word' });
      x.setAttribute('role', 'button');
      x.onclick = (e) => { e.stopPropagation(); deleteWords([w.id]); };
      chip.append(x);
      group.append(chip);
    });

    // Caption tools: edit its text; words one by one, or all at once.
    const tools = document.createElement('span');
    tools.className = 'wtools';
    const edit = Object.assign(document.createElement('button'), { className: 'wtool', textContent: '✎', title: 'Edit this caption’s text' });
    edit.onclick = (e) => { e.stopPropagation(); startCaptionEdit(group, phrase); };
    const allAtOnce = phrase.words.length > 1 && phrase.words.slice(1).every((w) => state.overrides[w.id]?.withPrevious);
    const reveal = Object.assign(document.createElement('button'), {
      className: `wtool${allAtOnce ? ' is-on' : ''}`, textContent: allAtOnce ? 'Together' : 'Word by word',
      title: 'Click to switch: words appear one by one as they are said, or the whole caption at once',
    });
    reveal.onclick = (e) => {
      e.stopPropagation();
      for (const w of phrase.words.slice(1)) {
        const { withPrevious: _, ...rest } = state.overrides[w.id] ?? {};
        const next = allAtOnce ? rest : { ...rest, withPrevious: true };
        if (Object.keys(next).length) state.overrides[w.id] = next; else delete state.overrides[w.id];
      }
      regenerate();
      replayCurrentPhrase();
    };
    const del = Object.assign(document.createElement('button'), { className: 'wtool', textContent: '🗑', title: 'Delete this whole caption' });
    del.onclick = (e) => { e.stopPropagation(); deleteWords(phrase.words.map((w) => w.id)); };
    tools.append(edit, reveal, del);
    group.append(tools);
  });
  const hidden = Object.entries(state.overrides).filter(([, o]) => o.hidden);
  if (hidden.length) {
    const restore = document.createElement('button');
    restore.className = 'pv-btn';
    restore.textContent = `Restore ${hidden.length} hidden word${hidden.length === 1 ? '' : 's'}`;
    restore.onclick = () => {
      for (const [id, o] of hidden) {
        const { hidden: _, ...rest } = o;
        if (Object.keys(rest).length) state.overrides[id] = rest; else delete state.overrides[id];
      }
      regenerate();
    };
    host.append(restore);
  }
}

/* ------------------------------------------------------------------ *
 * Caption structure: which words share a caption, and where lines break
 * ------------------------------------------------------------------ */

/**
 * Write a caption structure for a run of captions as explicit breaks, so the
 * optimiser keeps exactly this grouping: each caption's first word starts a
 * caption, the rest join it (or start a new line), and the word after the
 * run starts the next caption.
 * @param {{ids: string[], lines: Set<string>}[]} caps
 * @param {string|undefined} after  the first word after the run
 */
function setStructure(caps, after) {
  const put = (id, b) => {
    const { breakBefore: _, ...rest } = state.overrides[id] ?? {};
    state.overrides[id] = b ? { ...rest, breakBefore: b } : rest;
    if (!Object.keys(state.overrides[id]).length) delete state.overrides[id];
  };
  for (const cap of caps) {
    cap.ids.forEach((id, k) => put(id, k === 0 ? 'caption' : cap.lines.has(id) ? 'line' : 'join'));
  }
  if (after) put(after, 'caption');
  regenerate();
}

/** A caption as ids, with the words that start a new line in it. */
function capOf(phrase) {
  const lines = new Set(phrase.words.filter((w, k) => k > 0 && (state.overrides[w.id]?.breakBefore === 'line'
    || (w.line ?? 0) > (phrase.words[k - 1].line ?? 0))).map((w) => w.id));
  return { ids: phrase.words.map((w) => w.id), lines };
}
const firstAfter = (pi) => state.plan.phrases[pi + 1]?.words[0]?.id;

/** Move a word — with the words before it in its caption — to the caption before. */
function moveToPrevious(pi, wi) {
  const ps = state.plan.phrases;
  if (pi === 0) return setStatus('This is the first caption — there is none before it.', true);
  const prev = capOf(ps[pi - 1]), cur = capOf(ps[pi]);
  const moved = cur.ids.slice(0, wi + 1), rest = cur.ids.slice(wi + 1);
  const caps = [{ ids: [...prev.ids, ...moved], lines: new Set([...prev.lines].concat([...cur.lines].filter((id) => moved.includes(id)))) }];
  if (rest.length) caps.push({ ids: rest, lines: new Set([...cur.lines].filter((id) => rest.includes(id) && id !== rest[0])) });
  setStructure(caps, firstAfter(pi));
}

/** Move a word — with the words after it in its caption — to the caption after. */
function moveToNext(pi, wi) {
  const ps = state.plan.phrases;
  if (pi >= ps.length - 1) return setStatus('This is the last caption — there is none after it.', true);
  const cur = capOf(ps[pi]), next = capOf(ps[pi + 1]);
  const keep = cur.ids.slice(0, wi), moved = cur.ids.slice(wi);
  const caps = [];
  if (keep.length) caps.push({ ids: keep, lines: new Set([...cur.lines].filter((id) => keep.includes(id))) });
  caps.push({ ids: [...moved, ...next.ids], lines: new Set([...cur.lines].filter((id) => moved.includes(id) && id !== moved[0]).concat([...next.lines])) });
  setStructure(caps, firstAfter(pi + 1));
}

/** Between two words: nothing → new line → new caption → nothing. */
function cycleBreak(pi, wi) {
  const phrase = state.plan.phrases[pi];
  const cap = capOf(phrase);
  const id = cap.ids[wi];
  const explicit = state.overrides[id]?.breakBefore === 'line';
  if (!explicit && !cap.lines.has(id)) {
    cap.lines.add(id);                                   // a new line here
    setStructure([cap], firstAfter(pi));
    setStatus('New line. Click the ↵ again to split the caption there.');
  } else if (explicit || cap.lines.has(id)) {
    if (explicit) {
      // Split the caption here.
      setStructure([
        { ids: cap.ids.slice(0, wi), lines: new Set([...cap.lines].filter((x) => cap.ids.indexOf(x) < wi)) },
        { ids: cap.ids.slice(wi), lines: new Set([...cap.lines].filter((x) => cap.ids.indexOf(x) > wi)) },
      ], firstAfter(pi));
      setStatus('Split into two captions. Drag a word back to join them again.');
    } else {
      // An automatic wrap: make it explicit first, so the next click splits.
      setStructure([cap], firstAfter(pi));
      const o = state.overrides[id] ?? {};
      state.overrides[id] = { ...o, breakBefore: 'line' };
      regenerate();
    }
  }
}

/* Dragging a word between captions, with the pointer — not HTML drag and
   drop, which Final Cut's web view can take for a clip being dropped. */
const wordDrag = { id: '', pi: -1, wi: -1, x: 0, y: 0, moved: false, ghost: /** @type {HTMLElement|null} */ (null), over: /** @type {HTMLElement|null} */ (null) };
$('#words').addEventListener('pointerdown', (e) => {
  const chip = e.target.closest('.wchip');
  if (!chip || e.button !== 0 || e.target.closest('.wx, input')) return;
  Object.assign(wordDrag, { id: chip.dataset.id, pi: Number(chip.dataset.phrase), wi: Number(chip.dataset.index), x: e.clientX, y: e.clientY, moved: false, pointer: e.pointerId });
});
$('#words').addEventListener('pointermove', (e) => {
  if (!wordDrag.id) return;
  if (!wordDrag.moved && Math.hypot(e.clientX - wordDrag.x, e.clientY - wordDrag.y) < 5) return;
  if (!wordDrag.moved) {
    wordDrag.moved = true;
    // Only now: a press that never moves stays an ordinary click.
    try { $('#words').setPointerCapture(wordDrag.pointer); } catch { /* released already */ }
    const ghost = document.createElement('div');
    ghost.className = 'wghost';
    ghost.textContent = $(`#words .wchip[data-id="${wordDrag.id}"]`)?.textContent ?? '';
    document.body.append(ghost);
    wordDrag.ghost = ghost;
    $('#words').classList.add('is-dragging');
  }
  wordDrag.ghost.style.left = `${e.clientX + 8}px`;
  wordDrag.ghost.style.top = `${e.clientY + 8}px`;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.wgroup');
  if (wordDrag.over && wordDrag.over !== target) wordDrag.over.classList.remove('is-target', 'is-bad');
  wordDrag.over = target ?? null;
  if (target) {
    const tp = Number(target.dataset.phrase);
    target.classList.add(Math.abs(tp - wordDrag.pi) === 1 ? 'is-target' : 'is-bad');
  }
});
const endWordDrag = (e) => {
  if (!wordDrag.id) return;
  const { pi, wi, moved, over } = wordDrag;
  wordDrag.ghost?.remove();
  over?.classList.remove('is-target', 'is-bad');
  $('#words').classList.remove('is-dragging');
  wordDrag.id = '';
  wordDrag.ghost = null;
  if (!moved || !over || e.type === 'pointercancel') return;
  const tp = Number(over.dataset.phrase);
  if (tp === pi - 1) moveToPrevious(pi, wi);
  else if (tp === pi + 1) moveToNext(pi, wi);
  else if (tp !== pi) setStatus('Drag a word to the caption just before or just after it.', true);
  // The click that ends a drag is not a selection.
  setTimeout(() => { wordDrag.moved = false; }, 0);
};
$('#words').addEventListener('pointerup', endWordDrag);
$('#words').addEventListener('pointercancel', endWordDrag);

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

/** A small rendered sample of each style, drawn once per style. */
const thumbs = new Map();
const THUMB_FRAME = { width: 1080, height: 1350, fps: 30 };
const THUMB_LINE = 'Simply STUNNING views';
function styleThumb(t) {
  if (thumbs.has(t.id)) return thumbs.get(t.id);
  let svg = '';
  try {
    const plan = compose({ transcript: ingest(THUMB_LINE, { format: 'text' }), template: t, frame: THUMB_FRAME });
    const phrase = plan.phrases.find((p) => p.words.some((w) => w.level !== 'normal')) ?? plan.phrases[0];
    // The moment every word of the phrase has landed and none has started to leave.
    const landed = Math.max(...phrase.words.map((w) => w.start + w.motion.inDuration)) + 0.04;
    const leaving = Math.min(...phrase.words.map((w) => w.end - w.motion.outDuration));
    svg = renderFrame(plan, { time: Math.min(landed, leaving - 0.02), plate: 'none', scale: 0.12, standalone: true, idPrefix: `t-${t.id}-` });
    // Frame the caption, not the whole picture: a 4:5 window around the
    // phrase with room to breathe, so the type reads at thumbnail size.
    const { width: W, height: H } = THUMB_FRAME;
    const xs = phrase.words.flatMap((w) => [(0.5 + w.position.x - w.box.w / 2) * W, (0.5 + w.position.x + w.box.w / 2) * W]);
    const ys = phrase.words.flatMap((w) => [(0.5 - w.position.y - w.box.h / 2) * H, (0.5 - w.position.y + w.box.h / 2) * H]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const vw = Math.min(W, Math.max((Math.max(...xs) - Math.min(...xs)) * 1.3, ((Math.max(...ys) - Math.min(...ys)) * 2.2) * 4 / 5, W * 0.45));
    const vh = vw * 5 / 4;
    svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${Math.round(cx - vw / 2)} ${Math.round(cy - vh / 2)} ${Math.round(vw)} ${Math.round(vh)}"`);
  } catch { /* a style that cannot render a sample still gets its name */ }
  thumbs.set(t.id, svg);
  return svg;
}

function buildStyles() {
  buildSetups();
  const host = $('#styles');
  host.replaceChildren(...[...BUILTIN_TEMPLATES, ...state.userTemplates.filter((t) => t.kind !== 'setup')].map((t) => {
    const el = document.createElement('button');
    el.className = `pstyle${t.id === state.templateId ? ' is-on' : ''}`;
    el.innerHTML = '<span class="thumb"></span><b></b><i></i>';
    el.querySelector('.thumb').innerHTML = styleThumb(t);
    el.title = t.description ?? '';
    el.querySelector('b').textContent = t.name;
    el.querySelector('i').textContent = `${t.fonts.normal.family} · ${t.fonts.hero.family}`;
    el.onclick = () => {
      state.templateId = t.id;
      state.patch = {};
      // A new style brings its own fonts, colours and looks; the editor's
      // sizes are kept.
      for (const k of Object.keys(state.custom.groups)) {
        const scale = state.custom.groups[k]?.scale;
        state.custom.groups[k] = scale ? { scale } : {};
      }
      showCustom();
      buildStyles();
      regenerate();
    };
    return el;
  }));
}

function seg(sel, apply) {
  for (const b of $$(`${sel} button`)) {
    b.onclick = () => {
      $$(`${sel} button`).forEach((x) => x.classList.toggle('is-on', x === b));
      apply(b.dataset.v);
      regenerate();
    };
  }
}

function markConnected(live) {
  $('#link').textContent = live ? 'Final Cut connected' : 'not connected';
  $('#link').classList.toggle('is-live', live);
}

function setStatus(text, isError = false) {
  $('#status').textContent = text;
  $('#status').style.color = isError ? 'var(--danger)' : '';
}

const drop = $('#pdrop');
for (const evt of ['dragenter', 'dragover']) {
  document.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.add('is-hot'); });
}
document.addEventListener('dragleave', () => drop.classList.remove('is-hot'));

/**
 * Inside Final Cut, DragWebView intercepts a dragged clip natively and this
 * never fires. It matters anyway: it is the path when the panel is opened
 * outside Final Cut for development, and when someone drags an exported
 * .fcpxml file in from Finder rather than a clip from the browser.
 */
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  drop.classList.remove('is-hot');

  const file = [...(e.dataTransfer?.files ?? [])][0];
  if (file) {
    const text = await file.text();
    if (!text.includes('<fcpxml')) return noteSource(`${file.name} is not a Final Cut XML export.`, true);
    return useTimelineXML(text, `from ${file.name}`);
  }

  for (const type of [...(e.dataTransfer?.types ?? [])]) {
    const payload = e.dataTransfer.getData(type);
    if (payload?.includes('<fcpxml')) return useTimelineXML(payload, 'dragged in');
  }

  noteSource('That drop carried no timeline data.', true);
});

/** Whether the PK title is installed; the extension installs it on launch. */
let pkTitleInstalled = false;

/**
 * Final Cut's Basic Title unless a word uses an effect only the PK title
 * draws (gradient, glow), and the PK title is there to draw it.
 * @param {object} extra
 */
function exportOptions(extra) {
  const words = state.plan.phrases.flatMap((p) => p.words);
  const needsPK = words.some((w) => w.decoration.gradient?.enabled || w.decoration.glow.enabled || w.active);
  return { projectName: `${state.plan.templateName} Captions`, profile: needsPK && pkTitleInstalled ? 'pk' : 'native', ...extra };
}

/*
 * Send to Final Cut. When a project was dropped, the fastest route: a copy of
 * that project with the captions already connected at its first frame, so
 * nothing has to be lined up by eye. Words behind the agent go on a lower
 * lane than the rest, leaving the lane between for the masked copy of the
 * shot. Otherwise (a clip was dropped), the captions as a project of their own.
 */
$('#apply').onclick = async () => {
  if (!state.plan) return;
  try {
    setStatus('Building the titles…');
    let xml, message;
    if (state.droppedXml && /<project\b/.test(state.droppedXml)) {
      const behind = hasBehind();
      const layer = (only, name, lane) => ({ xml: exportFCPXML(state.plan, exportOptions({ as: 'clip', ...(only ? { only } : {}), projectName: name })).xml, lane, name });
      const clips = behind
        ? [layer('background', 'Captions — behind the agent', 9), layer('foreground', 'Captions — in front', 11)]
        : [layer(null, 'Captions', 9)];
      xml = captionedProject(state.droppedXml, clips);
      message = behind
        ? `Sent “${state.projectName} — captions”. Choose the library, open it, then copy your clip onto the empty lane between the two caption layers and add a Magnetic Mask to the agent.`
        : `Sent “${state.projectName} — captions”. Choose the library and open it — the captions are already in sync. Your original project is unchanged.`;
    } else {
      const out = exportFCPXML(state.plan, exportOptions({}));
      xml = out.xml;
      message = `${out.stats.titles} titles sent to Final Cut as a new project — choose where to import them.`;
    }
    await callNative('sendToTimeline', { fcpxml: xml });
    setStatus(message);
  } catch (err) {
    setStatus(err.message, true);
  }
};


$('#pv-scrub').oninput = () => { if (state.playing) togglePlay(); seek(Number($('#pv-scrub').value)); };
$('#pv-play').onclick = togglePlay;
for (const b of $$('#drag-scope button')) b.onclick = () => setSeg('#drag-scope', b.dataset.v);
$('#pv-reset').onclick = () => {
  state.custom[offsetKey()] = { x: 0, y: 0 };
  state.phraseNudges = {};
  state.wordNudges = {};
  changed();
};
window.addEventListener('resize', () => drawPreview());

/* ------------------------------------------------------------------ *
 * Text style editor — one block, used for each group and for a word
 * ------------------------------------------------------------------ */

const IN_ANIMS = [['dissolve', 'Cross dissolve'], ['blink', 'Blink'], ['fade', 'Fade'], ['rise', 'Rise'], ['slide', 'Slide'], ['scale', 'Scale up'], ['pop', 'Pop'], ['stretch', 'Stretch'], ['rotate', 'Rotate in'], ['typewriter', 'Typewriter'], ['reveal', 'Reveal']];
const OUT_ANIMS = [['dissolve', 'Cross dissolve'], ['blink', 'Blink'], ['fade', 'Fade'], ['scale', 'Grow'], ['shrink', 'Shrink'], ['slide', 'Slide away'], ['maskExit', 'Cut']];
const IN_EASES = [['out', 'Smooth'], ['outSoft', 'Soft'], ['outSlow', 'Slow settle'], ['inOut', 'Even'], ['back', 'Bouncy'], ['backHard', 'Springy'], ['linear', 'Linear']];
const OUT_EASES = [['inOut', 'Smooth'], ['in', 'Accelerate'], ['linear', 'Linear']];
/** Caption fonts that read well and pair well — the research shortlist. */
const RECOMMENDED_FONTS = ['Montserrat', 'Anton', 'Poppins', 'Bebas Neue', 'League Spartan', 'Inter',
  'Playfair Display', 'Cormorant Garamond', 'Avenir Next', 'Futura', 'Helvetica Neue', 'Didot'];
const CSS_TO_WEIGHT = { 100: 'thin', 200: 'extralight', 300: 'light', 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black' };
const LOOKS = [['', 'Style'], ['clean', 'Normal'], ['invert', 'Difference'], ['luminous', 'Screen'], ['cinematic', 'Overlay']];
const CASINGS = [['', 'Style'], ['none', 'As typed'], ['upper', 'UPPER'], ['lower', 'lower'], ['title', 'Title']];

/** Installed fonts, from Swift; a short fallback when running outside Final Cut. */
let fonts = /** @type {{family: string, faces: {face: string, weight: number, italic: boolean}[]}[]} */ (
  RECOMMENDED_FONTS.map((family) => ({ family, faces: [
    { face: 'Regular', weight: 400, italic: false }, { face: 'Bold', weight: 700, italic: false }, { face: 'Black', weight: 900, italic: false },
  ] })));

/** Drop unset fields, so the style shows through. */
function clean(o) {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined && v !== '' && v !== null));
}

/**
 * Build a text style editor into `host`.
 * @param {HTMLElement} host
 * @param {{blank: string}} opts
 * @param {(v: object) => void} onChange
 */
function styleEditor(host, { blank }, onChange) {
  let value = {};
  let shownColour = '#ffffff';
  const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const segOf = (list) => {
    const d = el('div', { className: 'seg' });
    for (const [v, l] of list) { const b = el('button', { textContent: l }); b.dataset.v = v; d.append(b); }
    return d;
  };
  const range = (min, max, step) => { const input = el('input', { type: 'range', min, max, step }); const out = el('span'); return { wrap: el('div', { className: 'rng' }, [input, out]), input, out }; };

  const family = el('select');
  const face = el('select');
  const size = range(0.4, 2.5, 0.05);
  const casing = segOf(CASINGS);
  const colour = el('input', { type: 'color' });
  const colourAuto = el('button', { className: 'pv-btn', textContent: 'Style colour' });
  const opacity = range(0.1, 1, 0.05);
  const look = segOf(LOOKS);
  const layer = segOf([['', 'Style'], ['foreground', 'In front'], ['background', 'Behind the agent']]);
  const lookHint = el('p', { className: 'hint span2' });
  // Effects. Gradient and glow are drawn in Final Cut by the PK title.
  const gradOn = segOf([['', 'Off'], ['on', 'On']]);
  const gradFrom = el('input', { type: 'color' });
  const gradTo = el('input', { type: 'color' });
  const gradAngle = range(0, 180, 15);
  const gradSpan = segOf([['', 'Each word'], ['line', 'Whole line']]);
  const gradPresets = el('div', { className: 'swatches' }, GRADIENTS.map(([name, from, to]) => {
    const b = el('button', { className: 'swatch', title: name });
    b.style.background = `linear-gradient(90deg, ${from}, ${to})`;
    b.onclick = () => set({ gradient: { enabled: true, from, to, angle: value.gradient?.angle ?? 0 } });
    return b;
  }));
  const glowOn = segOf([['', 'Off'], ['on', 'On']]);
  const glowColour = el('input', { type: 'color' });
  const glowStrength = range(0.1, 1, 0.05);
  const glowSize = range(4, 60, 1);
  const shineOn = segOf([['', 'Off'], ['on', 'On']]);
  const activeOn = segOf([['', 'Off'], ['on', 'On']]);
  const activeColour = el('input', { type: 'color' });
  const reset = el('button', { className: 'pv-btn reset', textContent: 'Reset style' });
  const row = (label, control) => [el('label', { textContent: label }), control];
  // Two parts, shown one at a time by whoever hosts the editor: the text
  // itself, and the effects layered on it.
  const textPart = el('div', { className: 'anim-ed ed-part' }, [
    ...row('Font', family), ...row('Style', face), ...row('Size', size.wrap), ...row('Capitals', casing),
    ...row('Colour', el('div', { className: 'rng' }, [colour, colourAuto])), ...row('Opacity', opacity.wrap),
    ...row('Blend', look), lookHint,
    ...row('Layer', layer),
  ]);
  const fxPart = el('div', { className: 'anim-ed ed-part' }, [
    el('div', { className: 'ed-sub span2', textContent: 'Gradient' }),
    ...row('Gradient', gradOn), ...row('', gradPresets),
    ...row('Colours', el('div', { className: 'rng' }, [gradFrom, el('span', { textContent: '→' }), gradTo])),
    ...row('Angle', gradAngle.wrap), ...row('Spread', gradSpan),
    el('div', { className: 'ed-sub span2', textContent: 'Glow & shine' }),
    ...row('Glow', glowOn), ...row('Glow colour', glowColour), ...row('Strength', glowStrength.wrap), ...row('Glow size', glowSize.wrap),
    ...row('Shine', shineOn),
    el('div', { className: 'ed-sub span2', textContent: 'While the word is spoken' }),
    ...row('Spoken colour', activeOn), ...row('Colour', activeColour),
  ]);
  textPart.dataset.part = 'text';
  fxPart.dataset.part = 'fx';
  host.replaceChildren(textPart, fxPart, reset);
  const gradRows = [gradPresets, gradFrom.parentElement, gradAngle.wrap, gradSpan];
  const glowRows = [glowColour, glowStrength.wrap, glowSize.wrap];

  function fillFamilies() {
    const current = value.fontFamily ?? '';
    const have = new Set(fonts.map((f) => f.family));
    const rec = RECOMMENDED_FONTS.filter((f) => have.has(f));
    const recGroup = el('optgroup', { label: 'Recommended for captions' }, rec.map((f) => new Option(f, f)));
    const allGroup = el('optgroup', { label: 'All fonts' }, fonts.map((f) => new Option(f.family, f.family)));
    family.replaceChildren(new Option(blank, ''), ...(rec.length ? [recGroup] : []), allGroup);
    family.value = current;
  }
  function fillFaces() {
    const f = fonts.find((x) => x.family === value.fontFamily);
    face.replaceChildren(new Option(f ? 'Pick a style' : '—', ''), ...(f?.faces ?? []).map((x) => new Option(x.face, x.face)));
    face.disabled = !f;
    face.value = value.fontFace ?? '';
  }
  const emit = () => { value = clean(value); onChange(value); };
  const set = (patch) => { value = { ...value, ...patch }; show(value, shownColour); emit(); };

  family.onchange = () => {
    const f = fonts.find((x) => x.family === family.value);
    // A new family starts on its nearest match to the current weight.
    const want = { thin: 100, extralight: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }[value.fontWeight ?? 'bold'] ?? 700;
    const best = f?.faces.filter((x) => !x.italic).sort((a, b) => Math.abs(a.weight - want) - Math.abs(b.weight - want))[0];
    set({ fontFamily: family.value || undefined, fontFace: best?.face, fontWeight: best ? CSS_TO_WEIGHT[best.weight] : undefined, italic: best ? false : undefined });
  };
  face.onchange = () => {
    const f = fonts.find((x) => x.family === value.fontFamily)?.faces.find((x) => x.face === face.value);
    set({ fontFace: face.value || undefined, fontWeight: f ? CSS_TO_WEIGHT[f.weight] : undefined, italic: f ? f.italic : undefined });
  };
  size.input.oninput = () => set({ scale: Number(size.input.value) });
  size.out.ondblclick = () => set({ scale: undefined });
  for (const b of casing.children) b.onclick = () => set({ casing: b.dataset.v || undefined });
  colour.oninput = () => set({ colour: colour.value });
  colourAuto.onclick = () => set({ colour: undefined });
  opacity.input.oninput = () => set({ opacity: Number(opacity.input.value) });
  opacity.out.ondblclick = () => set({ opacity: undefined });
  for (const b of look.children) b.onclick = () => set({ look: b.dataset.v || undefined });
  for (const b of layer.children) b.onclick = () => set({ depth: b.dataset.v || undefined });
  const grad = (patch) => set({ gradient: { enabled: true, from: shownColour, to: '#7C3AED', angle: 0, ...value.gradient, ...patch } });
  for (const b of gradOn.children) b.onclick = () => (b.dataset.v ? grad({ enabled: true }) : set({ gradient: undefined }));
  gradFrom.oninput = () => grad({ from: gradFrom.value });
  gradTo.oninput = () => grad({ to: gradTo.value });
  gradAngle.input.oninput = () => grad({ angle: Number(gradAngle.input.value) });
  const glow = (patch) => set({ glow: { enabled: true, colour: value.gradient?.to ?? shownColour, intensity: 0.7, radius: 18, ...value.glow, ...patch } });
  for (const b of glowOn.children) b.onclick = () => (b.dataset.v ? glow({ enabled: true }) : set({ glow: undefined }));
  glowColour.oninput = () => glow({ colour: glowColour.value });
  glowStrength.input.oninput = () => glow({ intensity: Number(glowStrength.input.value) });
  glowSize.input.oninput = () => glow({ radius: Number(glowSize.input.value) });
  for (const b of shineOn.children) b.onclick = () => set({ shine: b.dataset.v ? true : undefined });
  for (const b of gradSpan.children) b.onclick = () => grad({ span: b.dataset.v || undefined });
  for (const b of activeOn.children) b.onclick = () => set({ activeColour: b.dataset.v ? (value.activeColour ?? '#34D399') : undefined });
  activeColour.oninput = () => set({ activeColour: activeColour.value });
  reset.onclick = () => { value = {}; show(value, shownColour); emit(); };

  /** @param {object} v @param {string} currentColour the colour the word or group shows now */
  function show(v, currentColour) {
    value = { ...(v ?? {}) };
    shownColour = currentColour ?? shownColour;
    fillFamilies();
    fillFaces();
    size.input.value = String(value.scale ?? 1);
    size.out.textContent = value.scale === undefined ? 'auto' : `${Math.round(value.scale * 100)}%`;
    size.wrap.classList.toggle('is-auto', value.scale === undefined);
    for (const b of casing.children) b.classList.toggle('is-on', (b.dataset.v || '') === (value.casing ?? ''));
    colour.value = value.colour ?? shownColour;
    colourAuto.disabled = value.colour === undefined;
    opacity.input.value = String(value.opacity ?? 1);
    opacity.out.textContent = value.opacity === undefined ? 'auto' : `${Math.round(value.opacity * 100)}%`;
    opacity.wrap.classList.toggle('is-auto', value.opacity === undefined);
    for (const b of look.children) b.classList.toggle('is-on', (b.dataset.v || '') === (value.look ?? ''));
    for (const b of layer.children) b.classList.toggle('is-on', (b.dataset.v || '') === (value.depth ?? ''));
    const g = value.gradient?.enabled ? value.gradient : null;
    for (const b of gradOn.children) b.classList.toggle('is-on', !!b.dataset.v === !!g);
    gradFrom.value = g?.from ?? shownColour;
    gradTo.value = g?.to ?? '#7c3aed';
    gradAngle.input.value = String(g?.angle ?? 0);
    gradAngle.out.textContent = `${g?.angle ?? 0}°`;
    for (const r of gradRows) r.classList.toggle('is-off', !g);
    const gl = value.glow?.enabled ? value.glow : null;
    for (const b of glowOn.children) b.classList.toggle('is-on', !!b.dataset.v === !!gl);
    glowColour.value = gl?.colour ?? shownColour;
    glowStrength.input.value = String(gl?.intensity ?? 0.7);
    glowStrength.out.textContent = `${Math.round((gl?.intensity ?? 0.7) * 100)}%`;
    glowSize.input.value = String(gl?.radius ?? 18);
    glowSize.out.textContent = `${gl?.radius ?? 18}px`;
    for (const r of glowRows) r.classList.toggle('is-off', !gl);
    for (const b of shineOn.children) b.classList.toggle('is-on', !!b.dataset.v === !!value.shine);
    for (const b of gradSpan.children) b.classList.toggle('is-on', (b.dataset.v || '') === (g?.span ?? ''));
    for (const b of activeOn.children) b.classList.toggle('is-on', !!b.dataset.v === !!value.activeColour);
    activeColour.value = value.activeColour ?? '#34d399';
    activeColour.classList.toggle('is-off', !value.activeColour);
    // The looks that blend into the picture hide the colour by design — say so.
    lookHint.textContent = value.look === 'cinematic'
      ? 'Overlay blends the text into the picture: colour shows only faintly, and not at all over black.'
      : value.look === 'luminous' ? 'Screen only brightens: dark colours disappear.'
        : value.look === 'invert' ? 'Difference inverts what is behind the text; the colour mixes with the picture.' : '';
  }
  show({});
  return { show, parts: { text: textPart, fx: fxPart } };
}

/** Gradient presets: the pairs seen in the reference reels, plus the brand's gold. */
const GRADIENTS = [
  ['Ember', '#FF3B30', '#FF9500'],
  ['Neon', '#FF2D55', '#2563EB'],
  ['Violet', '#FFFFFF', '#8B5CF6'],
  ['Royal', '#7C3AED', '#2563EB'],
  ['Mint', '#34D399', '#22D3EE'],
  ['Gold', '#F7E7A1', '#D4AF37'],
];

const TYPES = [
  { key: 'normal', anim: 'normal', title: 'Main text', hint: 'Every word that is not a highlight.', level: 'normal' },
  { key: 'highlight', anim: 'high', title: 'Highlights', hint: 'Emphasis and hero words.', level: 'emphasis' },
  { key: 'hook', anim: 'hook', title: 'Hook', hint: 'The opening line — phrases that start in the first seconds. Make it stop the scroll.', level: 'normal' },
  { key: 'pattern', anim: 'pattern', title: 'Pattern words', hint: 'Words the colour pattern picks out; their colours come from the pattern.', level: 'emphasis' },
];

/** Build one card per type: its look and its animation, together. */
const typeCards = {};
{
  const host = $('#type-cards');
  const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  for (const t of TYPES) {
    const summaryLine = el('i');
    const lookHost = el('div', { className: 'anim-ed' });
    const animHost = el('div', { className: 'anim-ed' });
    const extra = [];
    if (t.key === 'hook') {
      const on = el('div', { className: 'seg' }, [Object.assign(el('button', { textContent: 'Off' }), {}), el('button', { textContent: 'On' })]);
      on.children[0].dataset.v = 'off'; on.children[1].dataset.v = 'on';
      const sec = el('input', { type: 'range', min: 1, max: 10, step: 0.5 });
      const secVal = el('span');
      for (const b of on.children) {
        b.onclick = () => { state.custom.hook = { ...(state.custom.hook ?? { seconds: 3 }), enabled: b.dataset.v === 'on' }; showTypeCards(); changed(); };
      }
      sec.oninput = () => { state.custom.hook = { ...(state.custom.hook ?? { enabled: true }), seconds: Number(sec.value) }; secVal.textContent = `first ${sec.value}s`; changed(); };
      extra.push(el('div', { className: 'anim-ed' }, [el('label', { textContent: 'Hook' }), on, el('label', { textContent: 'Opening' }), el('div', { className: 'rng' }, [sec, secVal])]));
      typeCards.hookControls = { on, sec, secVal };
    }
    // One type at a time (picked above), with its look or its animation.
    lookHost.dataset.mode = 'look';
    animHost.dataset.mode = 'anim';
    const card = el('div', { className: 'type-card', hidden: true }, [...extra, lookHost, animHost]);
    card.dataset.type = t.key;
    host.append(card);
    const pick = el('button', {}, [el('b', { textContent: t.title }), summaryLine]);
    pick.dataset.v = t.key;
    pick.onclick = () => showType(t.key);
    $('#type-pick').append(pick);
    const look = styleEditor(lookHost, { blank: 'Style default' }, (v) => {
      state.custom.groups = { ...state.custom.groups, [t.key]: v };
      changed();
      summarise(t);
    });
    const anim = animEditor(animHost, 'Style default', (v) => {
      state.custom.anim.groups = { ...(state.custom.anim.groups ?? {}), [t.anim]: v };
      changed();
      replayCurrentPhrase();
      summarise(t);
    });
    typeCards[t.key] = { look, anim, summaryLine };
  }
}

/** Show one type's editor, in the chosen mode (look / animation). */
let shownType = 'normal';
let typeMode = 'text';
function showType(key = shownType) {
  shownType = key;
  for (const b of $$('#type-pick button')) b.classList.toggle('is-on', b.dataset.v === key);
  for (const c of $$('#type-cards .type-card')) {
    c.hidden = c.dataset.type !== key;
    for (const host of c.querySelectorAll('[data-mode]')) host.hidden = (host.dataset.mode === 'anim') !== (typeMode === 'anim');
    for (const part of c.querySelectorAll('[data-part]')) part.hidden = part.dataset.part !== typeMode;
  }
  for (const b of $$('#type-mode button')) b.classList.toggle('is-on', b.dataset.v === typeMode);
  $('#type-hint').textContent = TYPES.find((t) => t.key === key)?.hint ?? '';
}
for (const b of $$('#type-mode button')) b.onclick = () => { typeMode = b.dataset.v; showType(); };
showType();

/** The one-line summary under each type's name: font, colour, animation. */
function summarise(t) {
  const g = state.custom.groups?.[t.key] ?? {};
  const a = state.custom.anim.groups?.[t.anim] ?? {};
  const parts = [];
  if (t.key === 'hook') parts.push(state.custom.hook?.enabled ? `on · first ${state.custom.hook.seconds}s` : 'off');
  parts.push(g.fontFamily ? `${g.fontFamily}${g.fontFace ? ' ' + g.fontFace : ''}` : 'style font');
  if (g.scale) parts.push(`${Math.round(g.scale * 100)}%`);
  if (g.colour) parts.push(g.colour);
  if (g.look) parts.push(LOOKS.find(([v]) => v === g.look)?.[1] ?? g.look);
  const fx = [g.gradient?.enabled && (g.gradient.span === 'line' ? 'line gradient' : 'gradient'), g.glow?.enabled && 'glow', g.shine && 'shine', g.activeColour && 'spoken colour'].filter(Boolean);
  if (fx.length) parts.push(fx.join(' + '));
  parts.push(a.in ? `in: ${IN_ANIMS.find(([v]) => v === a.in)?.[1] ?? a.in}` : 'style animation');
  typeCards[t.key].summaryLine.textContent = parts.join(' · ');
}

function showTypeCards() {
  for (const t of TYPES) {
    const sample = allWords().find((w) => w.level === t.level);
    typeCards[t.key].look.show(state.custom.groups?.[t.key] ?? {}, sample ? toHex(sample.colour) : '#ffffff');
    typeCards[t.key].anim.show(state.custom.anim.groups?.[t.anim] ?? {});
    summarise(t);
  }
  const h = state.custom.hook ?? { enabled: false, seconds: 3 };
  const hc = typeCards.hookControls;
  for (const b of hc.on.children) b.classList.toggle('is-on', b.dataset.v === (h.enabled ? 'on' : 'off'));
  hc.sec.value = String(h.seconds);
  hc.secVal.textContent = `first ${h.seconds}s`;
}
/** Kept for callers that refreshed the old single editor. */
const showGroupStyle = () => showTypeCards();

const wordStyle = styleEditor($('#style-word'), { blank: 'As its group' }, (v) => {
  const id = state.selected;
  if (!id) return;
  const keep = Object.fromEntries(Object.entries(state.overrides[id] ?? {}).filter(([k]) => ['level', 'text', 'hidden', 'inAnimation', 'outAnimation', 'tune', 'position'].includes(k)));
  const next = clean({ ...keep, ...v });
  if (Object.keys(next).length) state.overrides[id] = next; else delete state.overrides[id];
  regenerate();
});

callNative('fonts').then(({ fonts: list }) => { if (Array.isArray(list) && list.length) { fonts = list; showTypeCards(); showWord(); } }).catch(() => {});

/* ------------------------------------------------------------------ *
 * Animation editor — one block, used for each group and for a word
 * ------------------------------------------------------------------ */


/**
 * Build an animation editor into `host`.
 * @param {HTMLElement} host
 * @param {string} blank   What an unset value means ("Style default" / "As its group").
 * @param {(v: {in?: string, out?: string, tune?: object}) => void} onChange
 */
function animEditor(host, blank, onChange) {
  /** @type {{in?: string, out?: string, tune?: any}} */
  let value = {};
  const el = (tag, props = {}, kids = []) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  };
  const select = (list) => { const sel = el('select'); sel.append(new Option(blank, ''), ...list.map(([v, l]) => new Option(l, v))); return sel; };
  const range = (min, max, step, fmt) => {
    const input = el('input', { type: 'range', min, max, step });
    const out = el('span');
    const wrap = el('div', { className: 'rng' }, [input, out]);
    return { wrap, input, out, fmt };
  };

  const inType = select(IN_ANIMS);
  const dir = el('div', { className: 'seg' });
  for (const [v, l] of [['', 'Auto'], ['up', '↑'], ['down', '↓'], ['left', '←'], ['right', '→']]) dir.append(el('button', { textContent: l, title: v ? `Travels ${v}` : 'The animation\'s own direction' }));
  [...dir.children].forEach((b, i) => { b.dataset.v = ['', 'up', 'down', 'left', 'right'][i]; });
  const inDur = range(0.05, 1.5, 0.05, (v) => `${v.toFixed(2)}s`);
  const dist = range(0, 4, 0.1, (v) => `${Math.round(v * 100)}%`);
  const scaleFrom = range(0.2, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`);
  const turn = range(-45, 45, 1, (v) => `${v}°`);
  const inEase = select(IN_EASES);
  const outType = select(OUT_ANIMS);
  const outDur = range(0.05, 1.5, 0.05, (v) => `${v.toFixed(2)}s`);
  const outEase = select(OUT_EASES);
  // How long it stays: with its own caption, or on through the next ones.
  const stays = el('div', { className: 'seg' });
  for (const [v, l] of [['0', 'Its caption'], ['1', '+ next caption'], ['2', '+ 2 captions']]) {
    const b = el('button', { textContent: l }); b.dataset.v = v; stays.append(b);
  }
  const reset = el('button', { className: 'pv-btn reset', textContent: 'Reset animation' });

  const row = (label, control) => [el('label', { textContent: label }), control];
  host.replaceChildren(
    el('div', { className: 'sub', textContent: 'Entrance' }),
    ...row('Type', inType), ...row('Direction', dir), ...row('Duration', inDur.wrap),
    ...row('Distance', dist.wrap), ...row('Start scale', scaleFrom.wrap), ...row('Turn', turn.wrap), ...row('Easing', inEase),
    el('div', { className: 'sub', textContent: 'Exit' }),
    ...row('Stays on', stays),
    ...row('Type', outType), ...row('Duration', outDur.wrap), ...row('Easing', outEase),
    reset,
  );

  const emit = () => {
    const tune = Object.fromEntries(Object.entries(value.tune ?? {}).filter(([, v]) => v !== undefined && v !== ''));
    value = { ...value, tune };
    onChange(value);
  };
  const tuneSet = (k, v) => { value = { ...value, tune: { ...(value.tune ?? {}), [k]: v } }; show(value); emit(); };
  const wireRange = (r, key) => { r.input.oninput = () => tuneSet(key, Number(r.input.value)); r.out.ondblclick = () => tuneSet(key, undefined); r.out.title = 'Double-click for auto'; };

  inType.onchange = () => { value = { ...value, in: inType.value || undefined }; show(value); emit(); };
  outType.onchange = () => { value = { ...value, out: outType.value || undefined }; emit(); };
  for (const b of dir.children) b.onclick = () => tuneSet('direction', b.dataset.v || undefined);
  wireRange(inDur, 'inDuration'); wireRange(dist, 'distance'); wireRange(scaleFrom, 'scaleFrom'); wireRange(outDur, 'outDuration'); wireRange(turn, 'rotateFrom');
  inEase.onchange = () => tuneSet('ease', inEase.value || undefined);
  outEase.onchange = () => tuneSet('outEase', outEase.value || undefined);
  for (const b of stays.children) b.onclick = () => tuneSet('stayThrough', b.dataset.v === '0' ? undefined : Number(b.dataset.v));
  reset.onclick = () => { value = {}; show(value); emit(); };

  /** Ranges show "auto" until the editor sets them. */
  const showRange = (r, v, fallback) => {
    r.wrap.classList.toggle('is-auto', v === undefined);
    r.input.value = String(v ?? fallback);
    r.out.textContent = v === undefined ? 'auto' : r.fmt(Number(v));
  };
  function show(v) {
    value = v ?? {};
    const t = value.tune ?? {};
    inType.value = value.in ?? '';
    outType.value = value.out ?? '';
    for (const b of dir.children) b.classList.toggle('is-on', (b.dataset.v || '') === (t.direction ?? ''));
    showRange(inDur, t.inDuration, 0.3); showRange(dist, t.distance, 1); showRange(scaleFrom, t.scaleFrom, 0.9); showRange(outDur, t.outDuration, 0.22); showRange(turn, t.rotateFrom, 14);
    turn.wrap.classList.toggle('is-off', (value.in ?? '') !== 'rotate');
    inEase.value = t.ease ?? '';
    for (const b of stays.children) b.classList.toggle('is-on', b.dataset.v === String(t.stayThrough ?? 0));
    outEase.value = t.outEase ?? '';
  }
  show({});
  return { show };
}

$('#a-feel').onchange = () => { state.custom.anim.feel = $('#a-feel').value; changed(); replayCurrentPhrase(); };
for (const b of $$('#a-dissolve button')) {
  b.onclick = () => { state.custom.anim.dissolve = b.dataset.v === 'on'; setSeg('#a-dissolve', b.dataset.v); changed(); replayCurrentPhrase(); };
}
for (const b of $$('#a-reveal button')) {
  b.onclick = () => { state.custom.anim.reveal = b.dataset.v; setSeg('#a-reveal', b.dataset.v); changed(); replayCurrentPhrase(); };
}

const wordEditor = animEditor($('#anim-word'), 'As its group', (v) => {
  overrideSelected({ inAnimation: v.in, outAnimation: v.out, tune: v.tune && Object.keys(v.tune).length ? v.tune : undefined });
  replayCurrentPhrase();
});
$('#w-replay').onclick = () => replayCurrentPhrase();

$('#w-prev').onclick = () => stepWord(-1);
$('#w-next').onclick = () => stepWord(1);
$('#w-text').onchange = () => {
  const text = $('#w-text').value.trim();
  overrideSelected({ text: text && text !== selectedWord()?.text ? text : undefined });
};
for (const b of $$('#w-level button, #pv-level button')) b.onclick = () => overrideSelected({ level: b.dataset.v });
for (const b of $$('#w-with button')) b.onclick = () => { overrideSelected({ withPrevious: b.dataset.v === 'with' ? true : undefined }); replayCurrentPhrase(); };
// Where captions split: before the selected word.
for (const b of $$('#w-break button, #pv-break button')) {
  b.onclick = () => overrideSelected({ breakBefore: b.dataset.v === 'auto' ? undefined : b.dataset.v });
}

// Quick level changes without leaving the picture: double-click a word to
// swap main text and highlight; 1, 2, 3 set main, highlight, hero.
$('#pv').addEventListener('dblclick', (e) => {
  const w = wordAtPoint(e.clientX, e.clientY) ?? selectedWord();
  if (!w) return;
  if (w.id !== state.selected) select(w.id);
  overrideSelected({ level: w.level === 'normal' ? 'emphasis' : 'normal' });
});
$('#words').addEventListener('dblclick', (e) => {
  const chip = e.target.closest('[data-id]');
  const w = chip && allWords().find((x) => x.id === chip.dataset.id);
  if (!w) return;
  select(w.id);
  overrideSelected({ level: w.level === 'normal' ? 'emphasis' : 'normal' });
});
window.addEventListener('keydown', (e) => {
  if (!state.selected || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
  const level = { 1: 'normal', 2: 'emphasis', 3: 'hero' }[e.key];
  if (level) { e.preventDefault(); overrideSelected({ level }); }
});
$('#w-hide').onclick = () => {
  const id = state.selected;
  overrideSelected({ hidden: true });
  stepWord(1);
  if (state.selected === id) { state.selected = null; showWord(); }
};
$('#w-reset').onclick = () => {
  if (!state.selected) return;
  delete state.overrides[state.selected];
  delete state.wordNudges[state.selected];
  regenerate();
  showWord();
};
wirePreviewDrag();

$('#size').oninput = () => {
  state.custom[sizeKey()] = Number($('#size').value);
  $('#size-val').textContent = `${$('#size').value}%`;
  changed();
};
for (const [sel, key] of [['#pattern-scope', 'patternScope']]) {
  for (const b of $$(`${sel} button`)) {
    b.onclick = () => { state.custom[key] = b.dataset.v; setSeg(sel, b.dataset.v); drawPattern(); changed(); };
  }
}

/*
 * Drag to timeline. A web page cannot start a native drag, so pressing the
 * chip hands Swift the captions as one compound clip — the same FCPXML shape
 * Final Cut itself puts on the pasteboard for a dragged clip — and Swift
 * starts the drag as soon as the mouse moves.
 */
$('#dragout').addEventListener('mousedown', () => {
  if (!state.plan) return;
  const { xml } = exportFCPXML(state.plan, exportOptions({ as: 'clip', ...(hasBehind() ? { only: 'foreground' } : {}) }));
  callNative('beginDrag', { fcpxml: xml }).catch((err) => setStatus(err.message, true));
});
$('#dragout').addEventListener('dragstart', (e) => e.preventDefault());
// The words behind the agent, as their own clip, to go under the masked shot.
$('#dragout-back').addEventListener('mousedown', () => {
  if (!state.plan) return;
  const { xml } = exportFCPXML(state.plan, exportOptions({ as: 'clip', only: 'background', projectName: `${state.plan.templateName} Captions — behind` }));
  callNative('beginDrag', { fcpxml: xml }).catch((err) => setStatus(err.message, true));
});
$('#dragout-back').addEventListener('dragstart', (e) => e.preventDefault());

seg('#emphasis', (v) => { state.patch.hierarchy = { ...(state.patch.hierarchy ?? {}), emphasisDensity: v }; });
seg('#density', (v) => { state.patch.hierarchy = { ...(state.patch.hierarchy ?? {}), captionDensity: v }; });

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

buildStyles();
showCustom();

callNative('loadPrefs')
  .then(({ json }) => {
    if (!json) return;
    const saved = JSON.parse(json);
    // Settings from earlier versions of the panel move into the groups.
    const groups = saved.groups ?? {
      normal: { ...(saved.mainColour ? { colour: saved.mainColour } : {}), ...(saved.mainLook && saved.mainLook !== 'clean' ? { look: saved.mainLook } : {}) },
      highlight: { ...(saved.highlightColour ? { colour: saved.highlightColour } : {}), ...(saved.highlightLook && saved.highlightLook !== 'clean' ? { look: saved.highlightLook } : {}) },
      hook: {}, pattern: {},
    };
    state.custom = {
      ...state.custom, ...saved, groups, hook: saved.hook ?? { enabled: false, seconds: 3 },
      offsetVertical: saved.offsetVertical ?? { x: 0, y: 0 },
      offsetHorizontal: saved.offsetHorizontal ?? { x: 0, y: 0 },
      anim: {
        feel: saved.anim?.feel ?? '',
        reveal: saved.anim?.reveal ?? '',
        groups: saved.anim?.groups ?? {
          // Settings saved by the first version of this panel.
          normal: { in: saved.anim?.mainIn || undefined, out: saved.anim?.mainOut || undefined },
          high: { in: saved.anim?.highIn || undefined, out: saved.anim?.highOut || undefined },
          pattern: { in: saved.anim?.patIn || undefined, out: saved.anim?.patOut || undefined },
        },
      },
    };
    showCustom();
    regenerate();
  })
  .catch(() => { /* first run, or outside Final Cut */ });

callNative('status')
  .then(({ connected, pkTitle }) => {
    pkTitleInstalled = !!pkTitle;
    markConnected(connected);
    setStatus(connected ? 'Drag a clip onto the panel to begin.' : 'Final Cut is not attached yet.');
  })
  .catch(() => setStatus('Running outside Final Cut — drag an .fcpxml in to try it.'));

callNative('listTemplates')
  .then(({ templates }) => {
    /** @type {any[]} */
    const loaded = [];
    let unreadable = 0;
    for (const raw of templates ?? []) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.id && parsed?.name) loaded.push(parsed);
        else unreadable++;
      } catch {
        // One hand-edited or half-written file must not take the rest of
        // someone's saved styles with it.
        unreadable++;
      }
    }
    state.userTemplates = loaded;
    buildStyles();
    if (unreadable) setStatus(`${unreadable} saved style${unreadable === 1 ? '' : 's'} could not be read and were skipped.`, true);
  })
  .catch(() => { /* built-ins are enough */ });

export { state, useTimelineXML, adoptFrameFrom };

/* ------------------------------------------------------------------ *
 * Licence
 * ------------------------------------------------------------------ */

/** @param {{usable: boolean, state: string, summary: string}} lic */
function showLicence(lic) {
  const open = !lic.usable;
  $('#licence').hidden = !open && !$('#licence').dataset.pinned;
  $('#lic-summary').textContent = lic.summary;
  $('#lic-move').hidden = !(lic.state === 'active' || lic.state === 'trial');
  const badge = $('#lic-badge');
  badge.hidden = false;
  badge.textContent = lic.state === 'trial' ? lic.summary.replace(/\.$/, '') : lic.usable ? 'Licensed' : 'Activate';
  badge.classList.toggle('is-warn', !lic.usable);
}

$('#lic-badge').onclick = () => {
  const box = $('#licence');
  box.hidden = !box.hidden;
  box.dataset.pinned = box.hidden ? '' : '1';
};
$('#lic-activate').onclick = async () => {
  const key = $('#lic-key').value.trim();
  if (!key) return $('#lic-key').focus();
  $('#lic-activate').disabled = true;
  $('#lic-summary').textContent = 'Checking the key…';
  try {
    const lic = await callNative('licenseActivate', { key });
    $('#lic-key').value = '';
    $('#licence').dataset.pinned = '';
    showLicence(lic);
  } catch (err) {
    $('#lic-summary').textContent = err.message;
  } finally {
    $('#lic-activate').disabled = false;
  }
};
$('#lic-move').onclick = async () => {
  try { showLicence(await callNative('licenseDeactivate')); }
  catch (err) { $('#lic-summary').textContent = err.message; }
};
callNative('license').then(showLicence).catch(() => { /* outside Final Cut */ });

/* ------------------------------------------------------------------ *
 * Word edits: kept per project, with undo
 * ------------------------------------------------------------------ */

/** FNV-1a, 32-bit, as hex: a short stable name for a project. */
function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/**
 * Which project this is: its name, plus its opening words so two projects
 * that share a name ("Untitled Project") stay apart.
 */
function projectKey(xml, transcript) {
  const name = /<project\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1] ?? /<sequence\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1] ?? '';
  const opening = transcript.words.slice(0, 24).map((w) => `${w.text}@${w.start.toFixed(1)}`).join(' ');
  return `p${fnv(name)}${fnv(opening)}`;
}

/** The editor's work that undo and saving cover. */
const editable = () => ({
  templateId: state.templateId, patch: state.patch, custom: state.custom,
  overrides: state.overrides, wordNudges: state.wordNudges, phraseNudges: state.phraseNudges,
  textEdits: state.textEdits ?? [],
});

const history = (() => {
  /** @type {string[]} */ let past = [];
  /** @type {string[]} */ let future = [];
  let current = '';
  let lastAt = 0;
  let restoring = false;
  const buttons = () => {
    const u = $('#pv-undo'), r = $('#pv-redo');
    if (u) u.disabled = !past.length;
    if (r) r.disabled = !future.length;
  };
  return {
    reset() { past = []; future = []; current = ''; buttons(); },
    /** After every redesign: a change since the last one becomes an undo step. */
    record() {
      if (restoring) return;
      const now = JSON.stringify(editable());
      if (!current) { current = now; return buttons(); }
      if (now === current) return;
      // A slider or a drag sends many small changes; within a moment they
      // are one step, so undo goes back to before the gesture, not one pixel.
      const t = Date.now();
      if (t - lastAt > 700 || !past.length) past.push(current);
      lastAt = t;
      if (past.length > 200) past.shift();
      future = [];
      current = now;
      buttons();
    },
    undo() { if (past.length) { future.push(current); this.apply(past.pop()); } },
    redo() { if (future.length) { past.push(current); this.apply(future.pop()); } },
    apply(json) {
      const s = JSON.parse(json);
      Object.assign(state, {
        templateId: s.templateId, patch: s.patch, custom: s.custom,
        overrides: s.overrides, wordNudges: s.wordNudges, phraseNudges: s.phraseNudges,
        textEdits: s.textEdits ?? [],
      });
      current = json;
      lastAt = 0;
      restoring = true;
      try { refreshAll(); } finally { restoring = false; }
      buttons();
      callNative('savePrefs', { json: JSON.stringify(state.custom) }).catch(() => {});
    },
  };
})();

/** Redraw every control from state, after undo or a restore. */
function refreshAll() {
  showCustom();
  buildStyles();
  regenerate();
  showTypeCards();
  showWord();
}

let editsTimer = 0;
/** Keep this project's word edits on disk, a moment after the last change. */
function saveEditsSoon() {
  if (!state.editsKey || !state.editsReady) return;
  clearTimeout(editsTimer);
  editsTimer = setTimeout(() => {
    // Each edited word's text is stored beside its edits: a word id is its
    // position in the transcript, so if the captions change in Final Cut an
    // edit only comes back onto the same word.
    const ids = new Set([...Object.keys(state.overrides), ...Object.keys(state.wordNudges), ...Object.keys(state.phraseNudges)]);
    const words = Object.fromEntries((state.transcript?.words ?? []).filter((w) => ids.has(w.id)).map((w) => [w.id, w.text]));
    // Text edits name the original words they replace, with their text, so
    // they too only come back onto the same words.
    const raw = new Map((state.rawTranscript?.words ?? []).map((w) => [w.id, w.text]));
    const textEdits = (state.textEdits ?? []).map((e) => ({ ...e, was: e.ids.map((id) => raw.get(id)) }));
    const json = JSON.stringify({
      version: 1, saved: new Date().toISOString(), words, overrides: state.overrides, wordNudges: state.wordNudges, phraseNudges: state.phraseNudges, textEdits,
      // The whole setup this project was styled with, so each home keeps its own.
      setup: currentSetup(),
    });
    callNative('saveEdits', { key: state.editsKey, json }).catch(() => {});
  }, 500);
}

/** Bring back the word edits saved for this project, where the words still match. */
async function restoreEdits(key, transcript) {
  let saved = null;
  try { saved = JSON.parse((await callNative('loadEdits', { key })).json || 'null'); } catch { /* none, or outside Final Cut */ }
  if (state.editsKey !== key) return;          // another project was dropped meanwhile
  state.editsReady = true;
  if (!saved) return;
  // This home's own setup comes back with it.
  if (saved.setup) {
    applySetup(saved.setup, { quiet: true });
    noteSource(`${transcript.words.length} words · this project's setup is back.`);
  }
  const text = new Map(transcript.words.map((w) => [w.id, w.text]));
  const same = (id) => saved.words?.[id] !== undefined && text.get(id) === saved.words[id];
  const keep = (rec) => Object.fromEntries(Object.entries(rec ?? {}).filter(([id]) => same(id)));
  const raw = new Map((state.rawTranscript?.words ?? []).map((w) => [w.id, w.text]));
  const textEdits = (saved.textEdits ?? []).filter((e) => e.ids?.length && e.ids.every((id, k) => raw.get(id) === e.was?.[k]))
    .map(({ ids, text }) => ({ ids, text }));
  // Word edits are checked against the words as edited, so restore the text first.
  state.textEdits = textEdits;
  const edited = editedTranscript();
  const textNow = new Map(edited.words.map((w) => [w.id, w.text]));
  const sameNow = (id) => saved.words?.[id] !== undefined && textNow.get(id) === saved.words[id];
  const keepNow = (rec) => Object.fromEntries(Object.entries(rec ?? {}).filter(([id]) => sameNow(id)));
  const overrides = keepNow(saved.overrides), wordNudges = keepNow(saved.wordNudges), phraseNudges = keepNow(saved.phraseNudges);
  void keep;
  const count = new Set([...Object.keys(overrides), ...Object.keys(wordNudges), ...Object.keys(phraseNudges)]).size + textEdits.length;
  if (!count) return;
  Object.assign(state, { overrides, wordNudges, phraseNudges });
  history.reset();
  refreshAll();
  noteSource(`${transcript.words.length} words · your edits to ${count} word${count === 1 ? '' : 's'} are back.`);
}

$('#pv-undo').onclick = () => history.undo();
$('#pv-redo').onclick = () => history.redo();
window.addEventListener('keydown', (e) => {
  if (!e.metaKey || e.key.toLowerCase() !== 'z') return;
  if (e.target instanceof HTMLElement && e.target.closest('input[type="text"], textarea')) return;
  e.preventDefault();
  if (e.shiftKey) history.redo(); else history.undo();
});

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */

/** Show one tab. Remembered for next time, where the browser allows. */
function showTab(name) {
  for (const b of $$('#tabs button')) b.classList.toggle('is-on', b.dataset.tab === name);
  for (const p of $$('.tab-pane')) p.hidden = p.dataset.tab !== name;
  try { localStorage.setItem('pkkc.tab', name); } catch { /* private storage */ }
}
for (const b of $$('#tabs button')) b.onclick = () => { showTab(b.dataset.tab); $(`.tab-pane[data-tab="${b.dataset.tab}"]`).scrollTop = 0; };
try { const t = localStorage.getItem('pkkc.tab'); if (t) showTab(t); } catch { /* none */ }

// Choosing a word takes the editor to the Words tab, where its controls are.
{
  const plain = select;
  // eslint-disable-next-line no-func-assign
  select = (id, opts) => { plain(id, opts); if (id) showTab('words'); };
}

// The word inspector: look or animation, one at a time.
for (const b of $$('#word-mode button')) {
  b.onclick = () => {
    for (const x of $$('#word-mode button')) x.classList.toggle('is-on', x === b);
    const mode = b.dataset.v;
    $('#style-word').hidden = mode === 'anim';
    for (const part of $$('#style-word [data-part]')) part.hidden = part.dataset.part !== mode;
    $('#anim-word').hidden = mode !== 'anim';
    $('#w-replay').hidden = b.dataset.v !== 'anim';
  };
}
// Start the word inspector on its Text part.
for (const part of $$('#style-word [data-part]')) part.hidden = part.dataset.part !== 'text';

/* ------------------------------------------------------------------ *
 * Position controls
 * ------------------------------------------------------------------ */

for (const b of $$('#place-mode button')) {
  b.onclick = () => {
    place().mode = b.dataset.v;
    // A fixed line replaces the per-phrase moves; undo brings them back.
    if (b.dataset.v === 'fixed') state.phraseNudges = {};
    showPlace();
    changed();
  };
}
for (const b of $$('#place-safe button')) b.onclick = () => { place().safe = b.dataset.v; showPlace(); changed(); };
$('#place-guides').onchange = () => { place().guides = $('#place-guides').checked; drawPreview(); changed(); };
$('#place-y').oninput = () => {
  setLine(Number($('#place-y').value) / 100);
  showPlace();
  changed();
};
showPlace();

// Adjusting a platform's zone: the editor's own measurements win.
$('#zone-toggle').onclick = () => { $('#zone-toggle').classList.toggle('is-on'); showPlace(); };
for (const edge of ['top', 'bottom', 'left', 'right']) {
  $(`#zone-${edge}`).oninput = () => {
    const key = platformKey();
    place().zones[key] = { ...(place().zones[key] ?? {}), [edge]: Number($(`#zone-${edge}`).value) / 100 };
    showPlace();
    changed();
  };
}
$('#zone-reset').onclick = () => { delete place().zones[platformKey()]; showPlace(); changed(); };

/* ------------------------------------------------------------------ *
 * Editing the caption text
 * ------------------------------------------------------------------ */

/**
 * The transcript with the editor's text edits applied. Each edit replaces a
 * run of the original words with new text: the same number of words keeps
 * every word's timing; a different number spreads the run's time across the
 * new words by syllable. New words get ids derived from the run's first word.
 */
function editedTranscript() {
  const raw = state.rawTranscript;
  if (!raw) return state.transcript;
  const edits = state.textEdits ?? [];
  if (!edits.length) return raw;
  const byFirst = new Map(edits.map((e) => [e.ids[0], e]));
  const covered = new Set(edits.flatMap((e) => e.ids));
  const out = [];
  for (const w of raw.words) {
    const e = byFirst.get(w.id);
    if (e) {
      const run = e.ids.map((id) => raw.words.find((x) => x.id === id)).filter(Boolean);
      const tokens = e.text.split(/\s+/).filter(Boolean);
      if (tokens.length === run.length) {
        run.forEach((r, k) => out.push({ ...r, text: tokens[k], spoken: tokens[k] }));
      } else {
        const spread = distributeLine(tokens.join(' '), run[0].start, run[run.length - 1].end);
        spread.forEach((n, k) => out.push({ ...n, id: k === 0 ? run[0].id : `${run[0].id}.${k}`, index: 0 }));
      }
      continue;
    }
    if (!covered.has(w.id)) out.push(w);
  }
  return { ...raw, words: out.map((w, i) => ({ ...w, index: i })) };
}

/** The original words a current word stands for. */
function rawIdsOf(id) {
  const e = (state.textEdits ?? []).find((x) => x.ids.includes(id) || id.startsWith(`${x.ids[0]}.`));
  return e ? e.ids : [id];
}

/** Replace a caption's text. */
function editCaptionText(phrase, text) {
  const rawIds = [...new Set(phrase.words.flatMap((w) => rawIdsOf(w.id)))];
  const order = new Map((state.rawTranscript?.words ?? []).map((w, i) => [w.id, i]));
  rawIds.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const clean = text.replace(/\s+/g, ' ').trim();
  // Edits that overlap this caption are replaced by this one.
  const others = (state.textEdits ?? []).filter((e) => !e.ids.some((id) => rawIds.includes(id)));
  const original = rawIds.map((id) => state.rawTranscript.words.find((w) => w.id === id)?.text).join(' ');
  state.textEdits = clean && clean !== original ? [...others, { ids: rawIds, text: clean }] : others;
  // Per-word text overrides on these words would fight the new text.
  for (const w of phrase.words) {
    if (state.overrides[w.id]?.text !== undefined) {
      const { text: _, ...rest } = state.overrides[w.id];
      if (Object.keys(rest).length) state.overrides[w.id] = rest; else delete state.overrides[w.id];
    }
  }
  // What was typed stays one caption: a break before its first word, its
  // other words joined to it, and a break before the word that follows.
  const tokens = clean.split(' ').filter(Boolean);
  const ids = !clean ? [] : tokens.length === rawIds.length ? rawIds : tokens.map((_, k) => (k ? `${rawIds[0]}.${k}` : rawIds[0]));
  const setBreak = (id, b) => { state.overrides[id] = { ...(state.overrides[id] ?? {}), breakBefore: b }; };
  ids.forEach((id, k) => setBreak(id, k ? 'join' : 'caption'));
  const raw = state.rawTranscript.words;
  const after = raw[raw.findIndex((w) => w.id === rawIds[rawIds.length - 1]) + 1];
  if (after && !state.overrides[after.id]?.breakBefore) setBreak(after.id, 'caption');
  regenerate();
}

/** Turn a caption group in the words list into a text field. */
function startCaptionEdit(group, phrase) {
  const words = new Map((state.transcript?.words ?? []).map((w) => [w.id, w]));
  const current = phrase.words.map((w) => state.overrides[w.id]?.text ?? words.get(w.id)?.text ?? w.text).join(' ');
  const input = Object.assign(document.createElement('input'), { type: 'text', className: 'wedit', value: current, spellcheck: true });
  group.replaceChildren(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    if (save && input.value.trim() !== current) editCaptionText(phrase, input.value);
    else drawWords();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  };
  input.onblur = () => finish(true);
}

/* ------------------------------------------------------------------ *
 * Setups: the whole look of a project, kept per project and by name
 * ------------------------------------------------------------------ */

/** Everything that makes a project look the way it does (not its words). */
function currentSetup() {
  return JSON.parse(JSON.stringify({ templateId: state.templateId, patch: state.patch ?? {}, custom: state.custom }));
}

/** Put a setup in place: style, sizes, types, motion, position and safe zone. */
function applySetup(setup, { quiet = false } = {}) {
  if (!setup?.custom) return;
  const known = [...BUILTIN_TEMPLATES, ...state.userTemplates].some((t) => t.id === setup.templateId);
  state.templateId = known ? setup.templateId : state.templateId;
  state.patch = JSON.parse(JSON.stringify(setup.patch ?? {}));
  state.custom = { ...state.custom, ...JSON.parse(JSON.stringify(setup.custom)) };
  refreshAll();
  if (!quiet) setStatus('Setup applied.');
  callNative('savePrefs', { json: JSON.stringify(state.custom) }).catch(() => {});
}

/** The setup rendered as a template, for its thumbnail. */
function setupTemplate(setup) {
  const base = [...BUILTIN_TEMPLATES, ...state.userTemplates].find((t) => t.id === setup.templateId) ?? BUILTIN_TEMPLATES[0];
  const saved = state.custom;
  try {
    state.custom = { ...saved, ...setup.custom };
    return merge(merge(base, setup.patch ?? {}), customPatch(base));
  } finally {
    state.custom = saved;
  }
}

function buildSetups() {
  const host = $('#setups');
  if (!host) return;
  const setups = state.userTemplates.filter((t) => t.kind === 'setup');
  $('#setups-empty').hidden = setups.length > 0;
  host.replaceChildren(...setups.map((t) => {
    const el = document.createElement('div');
    el.className = 'pstyle setup';
    el.innerHTML = '<span class="thumb"></span><b></b><i></i><button class="setup-del" title="Delete this setup">×</button>';
    el.querySelector('.thumb').innerHTML = styleThumb({ ...setupTemplate(t.setup), id: `setup-thumb-${t.id}-${t.updated ?? ''}` });
    el.querySelector('b').textContent = t.name;
    el.querySelector('i').textContent = 'Click to use on this project';
    el.onclick = () => applySetup(t.setup);
    el.querySelector('.setup-del').onclick = (e) => {
      e.stopPropagation();
      callNative('deleteTemplate', { id: t.id }).catch(() => {});
      state.userTemplates = state.userTemplates.filter((x) => x.id !== t.id);
      buildSetups();
    };
    return el;
  }));
}

$('#setup-save').onclick = async () => {
  const name = $('#setup-name').value.trim();
  if (!name) return $('#setup-name').focus();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'setup';
  const id = `setup-${slug}`;
  const setup = currentSetup();
  const record = { ...setupTemplate(setup), id, name, kind: 'setup', setup, updated: Date.now() };
  try {
    await callNative('saveTemplate', { id, json: JSON.stringify(record) });
  } catch (err) {
    return setStatus(`Could not save the setup: ${err.message}`, true);
  }
  state.userTemplates = [...state.userTemplates.filter((t) => t.id !== id), record];
  $('#setup-name').value = '';
  buildSetups();
  setStatus(`Saved “${name}”. Use it on any home from Style ▸ Your setups.`);
};
$('#setup-name').onkeydown = (e) => { if (e.key === 'Enter') $('#setup-save').click(); };

/* ------------------------------------------------------------------ *
 * Deleting and editing words in the captions list
 * ------------------------------------------------------------------ */

/**
 * Hold the captions around some words exactly as they are now, so changing
 * those words (deleting, retyping) does not regroup their neighbours. Line
 * breaks the editor made are kept; automatic wraps stay automatic.
 */
function pinCaptionsAround(ids) {
  const ps = state.plan.phrases;
  const hit = new Set(ps.map((p, i) => (p.words.some((w) => ids.includes(w.id)) ? i : -1)).filter((i) => i >= 0));
  const range = new Set([...hit].flatMap((i) => [i - 1, i, i + 1]).filter((i) => i >= 0 && i < ps.length));
  for (const i of range) {
    ps[i].words.forEach((w, k) => {
      const keep = state.overrides[w.id]?.breakBefore === 'line' && k > 0 ? 'line' : k === 0 ? 'caption' : 'join';
      state.overrides[w.id] = { ...(state.overrides[w.id] ?? {}), breakBefore: keep };
    });
    const after = ps[i + 1]?.words[0]?.id;
    if (after) state.overrides[after] = { ...(state.overrides[after] ?? {}), breakBefore: 'caption' };
  }
}

/** Take words off the captions (undo brings them back; so does "Restore"). */
function deleteWords(ids) {
  const wasSelected = ids.includes(state.selected);
  pinCaptionsAround(ids);
  // A deleted word that started a caption hands that start to the next word left in it.
  for (const p of state.plan.phrases) {
    const left = p.words.filter((w) => !ids.includes(w.id));
    if (left.length && left.length < p.words.length && ids.includes(p.words[0].id)) {
      state.overrides[left[0].id] = { ...(state.overrides[left[0].id] ?? {}), breakBefore: 'caption' };
    }
  }
  for (const id of ids) state.overrides[id] = { ...(state.overrides[id] ?? {}), hidden: true };
  if (wasSelected) state.selected = null;
  regenerate();
  showWord();
  setStatus(`Deleted ${ids.length === 1 ? 'a word' : `${ids.length} words`}. ⌘Z brings ${ids.length === 1 ? 'it' : 'them'} back.`);
}

/**
 * Retype one word where it is. Empty deletes it; several words replace it,
 * sharing its time, and stay in its caption.
 */
function editWordInline(chip, w) {
  const words = new Map((state.transcript?.words ?? []).map((x) => [x.id, x]));
  const current = state.overrides[w.id]?.text ?? words.get(w.id)?.text ?? w.text;
  const input = Object.assign(document.createElement('input'), { type: 'text', className: 'wedit-word', value: current, spellcheck: true });
  input.style.width = `${Math.max(4, current.length + 2)}ch`;
  chip.replaceWith(input);
  input.focus();
  input.select();
  input.oninput = () => { input.style.width = `${Math.max(4, input.value.length + 2)}ch`; };
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const text = input.value.replace(/\s+/g, ' ').trim();
    if (!save || text === current) return drawWords();
    if (!text) return deleteWords([w.id]);
    editWordText(w.id, text);
  };
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  };
  input.onblur = () => finish(true);
}

/** Replace one word's text; extra words share its time and its caption. */
function editWordText(id, text) {
  pinCaptionsAround([id]);
  const tokens = text.split(' ');
  if (tokens.length === 1) {
    // One word for one word: a text override keeps every setting on it.
    state.overrides[id] = { ...(state.overrides[id] ?? {}), text };
    regenerate();
    return;
  }
  const rawIds = rawIdsOf(id);
  const others = (state.textEdits ?? []).filter((e) => !e.ids.some((r) => rawIds.includes(r)));
  // Keep the rest of an earlier edit's run as it was typed.
  const prior = (state.textEdits ?? []).find((e) => e.ids.some((r) => rawIds.includes(r)));
  let newText = text;
  if (prior) {
    const parts = prior.text.split(' ');
    const at = id.includes('.') ? Number(id.split('.').pop()) : 0;
    parts.splice(at, 1, ...tokens);
    newText = parts.join(' ');
  }
  state.textEdits = [...others, { ids: rawIds, text: newText }];
  const { text: _, ...rest } = state.overrides[id] ?? {};
  if (Object.keys(rest).length) state.overrides[id] = rest; else delete state.overrides[id];
  // The new words stay in this word's caption.
  const first = rawIds[0];
  newText.split(' ').forEach((_, k) => {
    if (k > 0) state.overrides[`${first}.${k}`] = { ...(state.overrides[`${first}.${k}`] ?? {}), breakBefore: 'join' };
  });
  regenerate();
}

// Keys on a selected word: Delete removes it, Enter edits it.
window.addEventListener('keydown', (e) => {
  if (!state.selected || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteWords([state.selected]); }
  if (e.key === 'Enter') {
    const chip = $(`#words .wchip[data-id="${state.selected}"]`);
    const w = allWords().find((x) => x.id === state.selected);
    if (chip && w) { e.preventDefault(); showTab('words'); editWordInline(chip, w); }
  }
});

