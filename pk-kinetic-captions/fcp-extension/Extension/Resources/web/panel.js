/**
 * The Final Cut panel.
 *
 * It imports the engine modules directly — the same files the command line
 * and the standalone app use — so every design decision is made in one place
 * and cannot drift between the three front ends. Swift is asked only for the
 * things a web view cannot do: talk to Final Cut, and read and write the
 * styles folder.
 *
 * There is no video preview here on purpose. Final Cut's viewer is the
 * preview; a second, smaller one in a side panel would only disagree with it.
 */

import { compose } from './engine/compose.js';
import { exportFCPXML } from './export/fcpxml.js';
import { ingest } from './transcript/ingest.js';
import { merge } from './templates/schema.js';
import { BUILTIN_TEMPLATES } from './templates/builtin/index.js';
import { parseColour, toHex } from './core/colour.js';
import { frameFromFCPXML } from './frame.js';
import { videoSegments, pictureAt } from './timeline.js';
import { renderFrame } from './render/svg.js';

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
    mainLook: 'clean',
    highlightLook: 'clean',
    mainColour: /** @type {string|null} */ (null),
    patternScope: 'off',
    pattern: ['#c9a84c', '#14b8a6', '#f97362', '#a78bfa'],
    // Where the editor dragged the captions, per orientation, as a fraction
    // of the frame (centre origin, +y up — the engine's own coordinates).
    offsetVertical: { x: 0, y: 0 },
    offsetHorizontal: { x: 0, y: 0 },
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
  },
  /** Swift -> panel, answering a call. */
  resolve(payload) {
    const entry = pending.get(payload.__id);
    if (!entry) return;
    pending.delete(payload.__id);
    payload.__ok ? entry.resolve(payload) : entry.reject(new Error(payload.error ?? 'Final Cut refused the request.'));
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
    state.transcript = transcript;
    state.segments = videoSegments(xml);
    state.phraseNudges = {};
    state.wordNudges = {};
    state.overrides = {};
    state.selected = null;
    state.time = 0;
    adoptFrameFrom(xml);
    noteSource(`${transcript.words.length} words ${how}.`);
    regenerate();
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
  try {
    const template = merge(merge(currentTemplate(), state.patch), customPatch(currentTemplate()));
    state.plan = compose({
      transcript: state.transcript,
      template,
      frame: state.frame,
      overrides: state.overrides,
      accent: toHex(parseColour($('#accent').value)),
    });

    applyPositions(state.plan);
    drawPreview();

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
  const maxH = window.innerHeight * 0.58;
  pv.style.width = `${Math.min(pv.parentElement.clientWidth, maxH * state.frame.width / state.frame.height)}px`;

  const dur = planDuration();
  $('#pv-scrub').max = String(dur);
  $('#pv-scrub').value = String(state.time);
  $('#pv-time').textContent = `${state.time.toFixed(1)}s`;
  $('#pv-svg').innerHTML = renderFrame(state.plan, { time: state.time, plate: 'none', scale: 1, standalone: true });
  $('#pv-empty').hidden = state.segments.length > 0;
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
  if (!w) { host.hidden = true; return; }
  host.hidden = false;
  const o = state.overrides[w.id] ?? {};
  $('#w-text').value = o.text ?? w.text;
  setSeg('#w-level', w.level);
  const pct = Math.round((o.scale ?? 1) * 100);
  $('#w-size').value = pct;
  $('#w-size-val').textContent = `${pct}%`;
  setSeg('#w-look', o.look ?? '');
  $('#w-colour').value = toHex(w.colour);
  $('#w-hide').textContent = 'Hide word';
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
  if (pic.src === frameShown.src && (pic.still || Math.abs(pic.time - frameShown.time) < 1 / 30)) return;

  frameBusy = true;
  const height = Math.round(Math.min(1080, $('#pv').clientHeight * (window.devicePixelRatio || 1)));
  callNative('frame', { path: pic.src, time: pic.time, height })
    .then(({ image }) => { img.src = image; img.hidden = false; frameShown = { src: pic.src, time: pic.time }; })
    .catch((err) => setStatus(`Preview: ${err.message}`, true))
    .finally(() => { frameBusy = false; pumpFrame(); });
}

function seek(t) {
  state.time = Math.max(0, Math.min(t, planDuration()));
  drawPreview();
}

let playFrom = 0, playClock = 0;
function togglePlay() {
  state.playing = !state.playing;
  $('#pv-play').textContent = state.playing ? '❚❚' : '▶';
  if (!state.playing) return;
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
function wirePreviewDrag() {
  const pv = $('#pv');
  let drag = null;
  pv.addEventListener('pointerdown', (e) => {
    if (!state.plan) return;
    const scope = $('#drag-scope .is-on')?.dataset.v ?? 'word';
    if (scope === 'word') {
      const w = wordAtPoint(e.clientX, e.clientY);
      if (!w) return;
      if (w.id !== state.selected) select(w.id);
      drag = { x: e.clientX, y: e.clientY, word: w.id, base: { ...(state.wordNudges[w.id] ?? { x: 0, y: 0 }) } };
      pv.setPointerCapture(e.pointerId);
      return;
    }
    const phrase = scope === 'phrase' ? phraseAt(state.time) : null;
    if (scope === 'phrase' && !phrase) return setStatus('No phrase on screen here — scrub to one, then drag it.', true);
    const key = phrase?.words[0]?.id;
    const base = key ? { ...(state.phraseNudges[key] ?? { x: 0, y: 0 }) } : { ...state.custom[offsetKey()] };
    drag = { x: e.clientX, y: e.clientY, key, base };
    pv.setPointerCapture(e.pointerId);
  });
  pv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = pv.getBoundingClientRect();
    const next = {
      x: drag.base.x + (e.clientX - drag.x) / rect.width,
      y: drag.base.y - (e.clientY - drag.y) / rect.height,
    };
    if (drag.word) state.wordNudges[drag.word] = next;
    else if (drag.key) state.phraseNudges[drag.key] = next;
    else state.custom[offsetKey()] = next;
    regenerate();
  });
  const end = () => { if (drag) { drag = null; changed(); } };
  pv.addEventListener('pointerup', end);
  pv.addEventListener('pointercancel', end);
}

/** The editor's settings, as a patch over the chosen style. */
function customPatch(base) {
  const c = state.custom;
  const pct = c[sizeKey()] / 100;
  return {
    scale: { base: base.scale.base * pct },
    interaction: { preset: c.mainLook, emphasisPreset: c.highlightLook, heroPreset: c.highlightLook },
    colours: {
      ...(c.mainColour ? { primary: c.mainColour } : {}),
      pattern: c.patternScope === 'off' ? [] : c.pattern,
      patternScope: c.patternScope === 'off' ? 'highlights' : c.patternScope,
    },
  };
}

/** Put every control in step with state.custom. */
function showCustom() {
  const c = state.custom;
  $('#size').value = c[sizeKey()];
  $('#size-val').textContent = `${c[sizeKey()]}%`;
  $('#size-orient').textContent = isVertical() ? '· vertical' : '· horizontal';
  setSeg('#main-look', c.mainLook);
  setSeg('#highlight-look', c.highlightLook);
  setSeg('#pattern-scope', c.patternScope);
  const main = c.mainColour ?? toHex(parseColour(currentTemplate().colours.primary));
  $('#main-colour').value = main;
  $('#main-colour-hex').value = main;
  drawPattern();
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
  for (const phrase of state.plan.phrases) {
    for (const w of phrase.words) {
      const chip = document.createElement('button');
      chip.className = `wchip lv-${w.level}`;
      chip.textContent = w.text;
      chip.title = `${w.level} · ${w.start.toFixed(2)}s`;
      chip.classList.toggle('is-sel', w.id === state.selected);
      chip.classList.toggle('is-custom', Boolean(state.overrides[w.id] || state.wordNudges[w.id]));
      chip.onclick = () => select(w.id, { seek: true });
      host.append(chip);
    }
    const br = document.createElement('span');
    br.className = 'wbreak';
    host.append(br);
  }
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
 * Wiring
 * ------------------------------------------------------------------ */

function buildStyles() {
  const host = $('#styles');
  host.replaceChildren(...[...BUILTIN_TEMPLATES, ...state.userTemplates].map((t) => {
    const el = document.createElement('button');
    el.className = `pstyle${t.id === state.templateId ? ' is-on' : ''}`;
    el.innerHTML = '<b></b><i></i>';
    el.querySelector('b').textContent = t.name;
    el.querySelector('i').textContent = `${t.fonts.normal.family} · ${t.fonts.hero.family}`;
    el.onclick = () => {
      state.templateId = t.id;
      state.patch = {};
      state.custom.mainColour = null;
      state.custom.mainLook = t.interaction?.preset ?? 'clean';
      state.custom.highlightLook = t.interaction?.heroPreset ?? t.interaction?.preset ?? 'clean';
      showCustom();
      const accent = toHex(parseColour(t.colours.accent));
      $('#accent').value = accent;
      $('#accent-hex').value = accent;
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

$('#apply').onclick = async () => {
  if (!state.plan) return;
  try {
    setStatus('Building the titles…');
    const { xml, stats } = exportFCPXML(state.plan, { projectName: `${state.plan.templateName} Captions` });
    await callNative('sendToTimeline', { fcpxml: xml });
    setStatus(`${stats.titles} titles sent to Final Cut as a new project — choose where to import them.`);
  } catch (err) {
    setStatus(err.message, true);
  }
};

$('#accent').oninput = () => { $('#accent-hex').value = $('#accent').value; regenerate(); };
$('#accent-hex').onchange = () => {
  try {
    const hex = toHex(parseColour($('#accent-hex').value));
    $('#accent').value = hex;
    regenerate();
  } catch { setStatus('That is not a colour.', true); }
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

$('#w-prev').onclick = () => stepWord(-1);
$('#w-next').onclick = () => stepWord(1);
$('#w-text').onchange = () => {
  const text = $('#w-text').value.trim();
  overrideSelected({ text: text && text !== selectedWord()?.text ? text : undefined });
};
for (const b of $$('#w-level button')) b.onclick = () => overrideSelected({ level: b.dataset.v });
$('#w-size').oninput = () => {
  $('#w-size-val').textContent = `${$('#w-size').value}%`;
  const v = Number($('#w-size').value) / 100;
  overrideSelected({ scale: v === 1 ? undefined : v });
};
for (const b of $$('#w-look button')) b.onclick = () => overrideSelected({ look: b.dataset.v || undefined });
$('#w-colour').oninput = () => overrideSelected({ colour: $('#w-colour').value });
$('#w-colour-auto').onclick = () => overrideSelected({ colour: undefined });
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
for (const [sel, key] of [['#main-look', 'mainLook'], ['#highlight-look', 'highlightLook'], ['#pattern-scope', 'patternScope']]) {
  for (const b of $$(`${sel} button`)) {
    b.onclick = () => { state.custom[key] = b.dataset.v; setSeg(sel, b.dataset.v); drawPattern(); changed(); };
  }
}
$('#main-colour').oninput = () => {
  state.custom.mainColour = $('#main-colour').value;
  $('#main-colour-hex').value = $('#main-colour').value;
  changed();
};
$('#main-colour-hex').onchange = () => {
  try {
    const hex = toHex(parseColour($('#main-colour-hex').value));
    state.custom.mainColour = hex;
    $('#main-colour').value = hex;
    changed();
  } catch { setStatus('That is not a colour.', true); }
};

/*
 * Drag to timeline. A web page cannot start a native drag, so pressing the
 * chip hands Swift the captions as one compound clip — the same FCPXML shape
 * Final Cut itself puts on the pasteboard for a dragged clip — and Swift
 * starts the drag as soon as the mouse moves.
 */
$('#dragout').addEventListener('mousedown', () => {
  if (!state.plan) return;
  const { xml } = exportFCPXML(state.plan, { as: 'clip', projectName: `${state.plan.templateName} Captions` });
  callNative('beginDrag', { fcpxml: xml }).catch((err) => setStatus(err.message, true));
});
$('#dragout').addEventListener('dragstart', (e) => e.preventDefault());

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
    state.custom = {
      ...state.custom, ...saved, mainColour: saved.mainColour ?? null,
      offsetVertical: saved.offsetVertical ?? { x: 0, y: 0 },
      offsetHorizontal: saved.offsetHorizontal ?? { x: 0, y: 0 },
    };
    showCustom();
    regenerate();
  })
  .catch(() => { /* first run, or outside Final Cut */ });

callNative('status')
  .then(({ connected }) => {
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
