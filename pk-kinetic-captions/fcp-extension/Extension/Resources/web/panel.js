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
  },
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
      chip.onclick = () => {
        const next = { normal: 'emphasis', emphasis: 'hero', hero: 'normal' }[state.overrides[w.id]?.level ?? w.level];
        state.overrides[w.id] = { ...(state.overrides[w.id] ?? {}), level: next };
        regenerate();
      };
      host.append(chip);
    }
    const br = document.createElement('span');
    br.className = 'wbreak';
    host.append(br);
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
    state.custom = { ...state.custom, ...saved, mainColour: saved.mainColour ?? null };
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
