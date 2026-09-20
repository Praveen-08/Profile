/**
 * The interface.
 *
 * One rule governs this file: it holds no design logic. Every decision about
 * typography, hierarchy, colour, position and motion is made by the engine on
 * the server, and this page only collects settings and draws what comes back.
 * That is what keeps the preview honest — it is rendered by the same code
 * that writes the FCPXML.
 */

// The DOM here is fully under this file's control and its contract with the
// server is JSON, which the type checker cannot verify either way. Typing
// every query as a specific element subtype would add casts on almost every
// line without catching a single real bug, so the accessors are deliberately
// loose and the interface is covered by the browser integration test instead.

/** @param {string} sel @returns {any} */
const $ = (sel) => document.querySelector(sel);
/** @param {string} sel @returns {any[]} */
const $$ = (sel) => [...document.querySelectorAll(sel)];

const SAMPLE = "I've always been competitive. In sports, in business, and in real estate. "
  + 'This architectural home offers four bedrooms, two bathrooms and a double garage, '
  + 'set on six hundred and fifty square metres of freehold land with uninterrupted sea views. '
  + 'Priced at one point nine five million dollars.';

const ASPECT_SIZES = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '16:9': [1920, 1080] };

/**
 * Everything the page knows. The server owns the truth; this is a cache.
 * @type {any}
 */
const app = {
  state: null,
  templateId: 'pk-real-estate',
  patch: {},
  overrides: {},
  plan: null,
  time: 0,
  playing: false,
  aspect: '9:16',
  accent: '',
  plate: null,
  activeWord: null,
  project: 'default',
};

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

init().catch((e) => toast(message(e), true));

async function init() {
  app.state = await api('/api/state');
  $('#store-path').textContent = app.state.environment.storeRoot;
  $('#out-dir').value = `${app.state.cwd}/pk-captions`;
  $('#env').textContent = app.state.environment.isMac
    ? (app.state.environment.pkTitleInstalled ? 'PK title installed' : 'Native profile')
    : `${app.state.environment.platform} — preview and export only`;

  app.templateId = app.state.brand.defaultTemplateId || 'pk-real-estate';
  app.accent = app.state.brand.accentColour || '#c9a84c';

  buildTemplateLists();
  buildQuickControls();
  buildAdvanced();
  wireStage();
  wireTemplateActions();
  wireSource();
  wireDialogs();

  $('#transcript').value = SAMPLE;
  selectTemplate(app.templateId, { silent: true });
  await regenerate();
}

/* ------------------------------------------------------------------ *
 * Styles rail
 * ------------------------------------------------------------------ */

function buildTemplateLists() {
  const render = (host, items) => {
    host.replaceChildren(...items.map((t) => {
      const el = document.createElement('button');
      el.className = 'tcard';
      el.dataset.id = t.id;
      // The card shows a type specimen rather than a shrunken 9:16 frame:
      // at this size a whole frame is an unreadable dark rectangle, while a
      // specimen still communicates the fonts, weights and colours.
      el.innerHTML = `
        <span class="tname"></span>
        <span class="tmeta"></span>
        <span class="thumb"><img alt="" loading="lazy" src="/api/thumbnail?id=${encodeURIComponent(t.id)}&swatch=1"></span>`;
      /** @type {any} */ (el.querySelector('.tname')).textContent = t.name;
      /** @type {any} */ (el.querySelector('.tmeta')).textContent =
        `${t.fonts.normal.family} · ${t.fonts.hero.family}${t.fonts.hero.italic ? ' italic' : ''}`;
      el.title = t.description ?? t.name;
      el.onclick = () => selectTemplate(t.id);
      return el;
    }));
  };
  render($('#builtin-list'), app.state.builtin);
  render($('#user-list'), app.state.user);
  $('#user-count').textContent = app.state.user.length ? `(${app.state.user.length})` : '';

  const sel = $('#q-template');
  sel.replaceChildren();
  for (const [label, items] of [['Built-in', app.state.builtin], ['My templates', app.state.user]]) {
    if (!items.length) continue;
    const g = document.createElement('optgroup');
    g.label = label;
    for (const t of items) {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.name;
      g.append(o);
    }
    sel.append(g);
  }
}

function currentTemplate() {
  return [...app.state.builtin, ...app.state.user].find((t) => t.id === app.templateId)?.template ?? app.state.defaults;
}

function selectTemplate(id, opts = {}) {
  app.templateId = id;
  app.patch = {};
  $$('.tcard').forEach((c) => c.classList.toggle('is-on', c.dataset.id === id));
  $('#q-template').value = id;

  const t = currentTemplate();
  const isUser = app.state.user.some((u) => u.id === id);
  $('#update-template').disabled = !isUser;
  $('#delete-template').disabled = !isUser;

  app.accent = t.colours.accent;
  syncQuickFrom(t);
  syncAdvancedFrom(t);
  if (!opts.silent) regenerate();
}

/* ------------------------------------------------------------------ *
 * Quick controls
 * ------------------------------------------------------------------ */

function buildQuickControls() {
  const anim = $('#q-animation');
  anim.replaceChildren(...app.state.animationStyles.map((s) => option(s, title(s))));

  const inter = $('#q-interaction');
  inter.replaceChildren(...app.state.interactions.map((i) => option(i.preset, i.label)));
  inter.onchange = () => {
    const spec = app.state.interactions.find((i) => i.preset === inter.value);
    $('#interaction-note').textContent = spec?.description ?? '';
    setPatch('interaction.preset', inter.value);
  };

  $('#q-template').onchange = (e) => selectTemplate(e.target.value);
  anim.onchange = () => setPatch('motion.style', anim.value);

  seg('#q-emphasis', (v) => setPatch('hierarchy.emphasisDensity', v));
  seg('#q-density', (v) => setPatch('hierarchy.captionDensity', v));

  const colour = $('#q-accent');
  const hex = $('#q-accent-hex');
  colour.oninput = () => { hex.value = colour.value; applyAccent(colour.value); };
  hex.onchange = () => {
    if (!/^#?[0-9a-f]{3,8}$/i.test(hex.value.trim())) return toast('That is not a colour.', true);
    colour.value = normaliseHex(hex.value);
    applyAccent(colour.value);
  };
  $('#q-palette').onchange = () => regenerate();
  $('#q-realestate').onchange = (e) => setPatch('realEstate.enabled', e.target.checked);
  $('#q-normalise').onchange = (e) => setPatch('realEstate.collapse', e.target.checked);
  $('#pick-colour').onclick = () => $('#capture-dialog').showModal();

  $$('.mode').forEach((b) => {
    b.onclick = () => {
      $$('.mode').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      $$('[data-for]').forEach((p) => { p.hidden = p.dataset.for !== b.dataset.mode; });
    };
  });

  $('#generate').onclick = () => regenerate();
}

function syncQuickFrom(t) {
  $('#q-animation').value = t.motion.style;
  $('#q-interaction').value = t.interaction.preset;
  $('#interaction-note').textContent = app.state.interactions.find((i) => i.preset === t.interaction.preset)?.description ?? '';
  setSeg('#q-emphasis', t.hierarchy.emphasisDensity);
  setSeg('#q-density', t.hierarchy.captionDensity);
  $('#q-realestate').checked = t.realEstate.enabled;
  $('#q-normalise').checked = t.realEstate.collapse;
  const hex = normaliseHex(t.colours.accent);
  $('#q-accent').value = hex;
  $('#q-accent-hex').value = hex;
  app.accent = hex;
  drawPalette();
}

async function applyAccent(hex) {
  app.accent = hex;
  await drawPalette();
  regenerate();
}

async function drawPalette() {
  try {
    const r = await api('/api/palette', { accent: app.accent, mood: currentTemplate().mood });
    $('#palette-strip').innerHTML = Object.values(r.palette)
      .map((c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('');
  } catch { /* a bad colour is already reported by the field */ }
}

/* ------------------------------------------------------------------ *
 * Advanced controls
 * ------------------------------------------------------------------ */

/** Declarative control definitions, so adding a knob is one line. */
function advancedSpec() {
  const families = app.state.families.map((f) => f.family);
  const weights = app.state.weights;
  const casing = ['none', 'upper', 'lower', 'title'];
  const levels = ['normal', 'emphasis', 'hero'];

  /** @type {Array<[string, any[][]]>} */
  return [
    ['#adv-type', levels.flatMap((lv) => [
      ['heading', `${title(lv)} words`],
      ['select', `fonts.${lv}.family`, 'Font', families],
      ['select', `fonts.${lv}.weight`, 'Weight', weights],
      ['select', `fonts.${lv}.width`, 'Width', ['condensed', 'normal', 'expanded']],
      ['select', `fonts.${lv}.casing`, 'Case', casing],
      ['check', `fonts.${lv}.italic`, 'Italic'],
      ['number', `fonts.${lv}.tracking`, 'Tracking (1/1000 em)', { step: 5 }],
      ['number', `fonts.${lv}.lineHeight`, 'Line height ×', { step: 0.02 }],
    ])],
    ['#adv-hier', [
      ['select', 'hierarchy.captionDensity', 'Caption density', ['low', 'medium', 'high']],
      ['select', 'hierarchy.emphasisDensity', 'Emphasis density', ['subtle', 'balanced', 'strong']],
      ['check', 'hierarchy.autoEmphasis', 'Auto emphasis'],
      ['number', 'hierarchy.maxWordsPerPhrase', 'Max words per phrase', { step: 1, min: 1 }],
      ['number', 'hierarchy.maxLines', 'Max lines', { step: 1, min: 1 }],
      ['number', 'hierarchy.maxHeroPerPhrase', 'Max hero words per phrase', { step: 1, min: 0 }],
      ['number', 'hierarchy.heroCooldown', 'Seconds between hero words', { step: 0.2 }],
      ['number', 'hierarchy.maxWidth', 'Max width of frame', { step: 0.02, min: 0.2, max: 1 }],
      ['check', 'hierarchy.stripTerminalPunctuation', 'Drop full stops from promoted words'],
    ]],
    ['#adv-colour', [
      ['colour', 'colours.primary', 'Primary (normal words)'],
      ['colour', 'colours.accent', 'Accent (emphasis)'],
      ['colour', 'colours.hero', 'Hero'],
      ['colour', 'colours.secondary', 'Secondary'],
      ['colour', 'colours.neutral', 'Neutral'],
    ]],
    ['#adv-position', [
      ['select', 'position.mode', 'Mode', ['static', 'dynamic', 'subjectAware', 'manual']],
      ['select', 'position.home', 'Home zone', ['top', 'upperLeft', 'upperRight', 'center', 'lowerLeft', 'lowerRight', 'bottom']],
      ['select', 'position.align', 'Alignment', ['left', 'center', 'right']],
      ['check', 'position.faceAvoidance', 'Avoid the face'],
      ['check', 'position.heroMayOverlap', 'Hero type may cross the subject'],
      ['number', 'position.zoneHold', 'Hold a zone for (s)', { step: 0.2 }],
      ['number', 'position.margin', 'Margin', { step: 0.01, min: 0, max: 0.3 }],
    ]],
    ['#adv-space', [
      ['number', 'scale.base', 'Base cap height (of short edge)', { step: 0.002, min: 0.01, max: 0.2 }],
      ['number', 'scale.emphasis', 'Emphasis scale ×', { step: 0.05 }],
      ['number', 'scale.hero', 'Hero scale ×', { step: 0.1 }],
      ['number', 'spacing.wordGap', 'Word gap (em)', { step: 0.02 }],
      ['number', 'spacing.lineGap', 'Line gap (em)', { step: 0.02 }],
    ]],
    ['#adv-motion', [
      ['select', 'motion.style', 'Style', app.state.animationStyles],
      ['select', 'motion.reveal', 'Reveal', ['spoken', 'phrase']],
      ['number', 'motion.speed', 'Speed ×', { step: 0.1, min: 0.2, max: 4 }],
      ['number', 'motion.hold', 'Hold after last word (s)', { step: 0.05 }],
      ['check', 'motion.perCharacterHero', 'Animate hero letters individually'],
      ...levels.flatMap((lv) => [
        ['select', `motion.in.${lv}`, `${title(lv)} in`, ['fade', 'rise', 'slide', 'scale', 'pop', 'blur', 'stretch', 'type', 'reveal', 'maskReveal']],
        ['select', `motion.out.${lv}`, `${title(lv)} out`, ['fade', 'scale', 'slide', 'blur', 'shrink', 'maskExit']],
      ]),
    ]],
    ['#adv-subject', [
      ['select', 'interaction.preset', 'Text interaction', app.state.interactions.map((i) => i.preset)],
      ['select', 'interaction.heroPreset', 'Hero interaction', app.state.interactions.map((i) => i.preset)],
      ['check', 'interaction.heroBehindSubject', 'Hero type sits behind the subject'],
    ]],
    ['#adv-deco', [
      ['check', 'decoration.glow.enabled', 'Glow'],
      ['number', 'decoration.glow.intensity', 'Glow intensity', { step: 0.05, min: 0, max: 1 }],
      ['number', 'decoration.glow.radius', 'Glow radius', { step: 1, min: 0 }],
      ['check', 'decoration.shadow.enabled', 'Shadow'],
      ['number', 'decoration.shadow.opacity', 'Shadow opacity', { step: 0.05, min: 0, max: 1 }],
      ['number', 'decoration.shadow.blur', 'Shadow blur', { step: 1, min: 0 }],
      ['number', 'decoration.shadow.distance', 'Shadow distance', { step: 1, min: 0 }],
      ['number', 'decoration.shadow.angle', 'Shadow angle', { step: 5 }],
      ['check', 'decoration.outline.enabled', 'Outline'],
      ['number', 'decoration.outline.width', 'Outline width', { step: 0.5, min: 0 }],
    ]],
  ];
}

function buildAdvanced() {
  for (const group of advancedSpec()) {
    const el = $(String(group[0]));
    el.replaceChildren();
    for (const def of /** @type {any[][]} */ (group[1])) el.append(control(def));
  }
}

function control(def) {
  const [kind, ...rest] = def;
  if (kind === 'heading') {
    const h = document.createElement('h2');
    h.textContent = rest[0];
    h.style.marginTop = '14px';
    return h;
  }
  const [pathKey, label, extra] = rest;
  const wrap = document.createElement('label');

  if (kind === 'check') {
    wrap.className = 'check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.path = pathKey;
    input.onchange = () => setPatch(pathKey, input.checked);
    wrap.append(input, document.createTextNode(` ${label}`));
    return wrap;
  }

  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  wrap.append(span);

  if (kind === 'select') {
    const sel = document.createElement('select');
    sel.dataset.path = pathKey;
    sel.replaceChildren(...(/** @type {any[]} */ (extra)).map((v) => option(String(v), title(String(v)))));
    sel.onchange = () => setPatch(pathKey, sel.value);
    wrap.append(sel);
  } else if (kind === 'colour') {
    const row = document.createElement('div');
    row.className = 'accent-row';
    const c = document.createElement('input');
    c.type = 'color'; c.dataset.path = pathKey;
    const hex = document.createElement('input');
    hex.type = 'text'; hex.className = 'mono'; hex.dataset.pathHex = pathKey;
    const push = (v) => { c.value = v; hex.value = v; setPatch(pathKey, v); };
    c.oninput = () => push(c.value);
    hex.onchange = () => { if (/^#?[0-9a-f]{3,8}$/i.test(hex.value.trim())) push(normaliseHex(hex.value)); else toast('That is not a colour.', true); };
    row.append(c, hex);
    wrap.append(row);
  } else {
    const input = document.createElement('input');
    input.type = 'number';
    input.dataset.path = pathKey;
    Object.assign(input, extra ?? {});
    input.onchange = () => setPatch(pathKey, Number(input.value));
    wrap.append(input);
  }
  return wrap;
}

function syncAdvancedFrom(t) {
  for (const el of $$('[data-path]')) {
    const v = get(t, el.dataset.path);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'color') el.value = normaliseHex(String(v ?? '#000000'));
    else if (v !== undefined && v !== null) el.value = String(v);
  }
  for (const el of $$('[data-path-hex]')) el.value = normaliseHex(String(get(t, el.dataset.pathHex) ?? '#000000'));
}

/* ------------------------------------------------------------------ *
 * Stage
 * ------------------------------------------------------------------ */

function wireStage() {
  seg('#aspect-seg', (v) => { app.aspect = v; regenerate(); }, 'aspect');
  $('#safe-area').onchange = () => regenerate();
  $('#guides').onchange = () => draw();
  $('#plate-toggle').onchange = (e) => { if (e.target.checked) $('#plate-file').click(); else { app.plate = null; draw(); } };
  $('#plate-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    app.plate = await fileToDataURL(f);
    draw();
  };

  const scrub = $('#scrub');
  scrub.oninput = () => { app.time = Number(scrub.value); draw(); };
  $('#play').onclick = togglePlay;

  document.addEventListener('keydown', (e) => {
    if (/input|textarea|select/i.test(/** @type {any} */ (e.target)?.tagName ?? '')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  });
}

/** @type {any} */ let raf = 0;
function togglePlay() {
  app.playing = !app.playing;
  $('#play').textContent = app.playing ? '❚❚' : '▶';
  if (!app.playing) return cancelAnimationFrame(raf);

  const total = Number($('#scrub').max);
  let last = performance.now();
  const step = (now) => {
    if (!app.playing) return;
    app.time += (now - last) / 1000;
    last = now;
    if (app.time > total) app.time = 0;
      $('#scrub').value = String(app.time);
    draw();
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ *
 * Generate and draw
 * ------------------------------------------------------------------ */

function requestBody(extra = {}) {
  const [w, h] = ASPECT_SIZES[app.aspect];
  return {
    text: $('#transcript').value,
    templateId: app.templateId,
    patch: app.patch,
    overrides: app.overrides,
    accent: app.accent,
    generatePalette: $('#q-palette').checked,
    frame: { width: w, height: h, fps: 30, aspect: app.aspect, safeArea: $('#safe-area').checked },
    ...extra,
  };
}

let pending = null;
async function regenerate() {
  const body = requestBody();
  pending = body;
  try {
    const r = await api('/api/plan', body);
    if (pending !== body) return;                     // a newer request already went out
    app.plan = r.plan;

    const total = Math.max(1, ...r.plan.phrases.map((p) => p.end));
    const scrub = $('#scrub');
    scrub.max = String(total.toFixed(2));
    // Land on a frame that shows the hierarchy rather than on an empty one:
    // opening a design tool on a blank canvas tells the editor nothing.
    if (app.time > total || app.time === 0) app.time = firstInterestingTime(r.plan);
    scrub.value = String(app.time);

    const s = r.plan.stats;
    $('#stats').textContent = `${s.words} words · ${s.phrases} phrases · ${s.byLevel.normal}/${s.byLevel.emphasis}/${s.byLevel.hero} N·E·H · ${Math.round(s.emphasisRatio * 100)}% promoted`;

    drawWords();
    draw();
    if (r.warnings?.length) toast(r.warnings[0]);
  } catch (e) {
    toast(message(e), true);
  }
}

let drawing = false, drawAgain = false;
async function draw() {
  if (!app.plan) return;
  if (drawing) { drawAgain = true; return; }
  drawing = true;
  try {
    $('#time').textContent = `${app.time.toFixed(2)}s`;
    highlightLiveWords();
    const svg = await apiText('/api/render', requestBody({
      time: app.time, guides: $('#guides').checked, plate: app.plate ? undefined : '#16191c',
    }));
    const host = $('#canvas');
    host.innerHTML = svg;
    if (app.plate) {
      const el = /** @type {any} */ (host.querySelector('svg'));
      if (el) { el.style.background = `url(${app.plate}) center/cover`; el.querySelector('rect')?.setAttribute('fill', 'transparent'); }
    }
  } catch (e) {
    toast(message(e), true);
  } finally {
    drawing = false;
    if (drawAgain) { drawAgain = false; draw(); }
  }
}

/** The moment the plan is most worth looking at: the first hero word, else the first emphasis. */
function firstInterestingTime(plan) {
  const rank = { hero: 2, emphasis: 1, normal: 0 };
  let best = null;
  for (const p of plan.phrases) {
    for (const w of p.words) {
      const score = rank[w.level];
      if (!best || score > best.score) best = { score, t: w.start + (w.end - w.start) * 0.55 };
      if (best.score === 2) return best.t;
    }
  }
  return best?.t ?? 0;
}

/* ------------------------------------------------------------------ *
 * Word editor
 * ------------------------------------------------------------------ */

function drawWords() {
  const host = $('#words');
  host.replaceChildren();
  for (const phrase of app.plan.phrases) {
    for (const w of phrase.words) {
      const chip = document.createElement('button');
      chip.className = `wchip lv-${w.level}`;
      chip.dataset.id = w.id;
      chip.textContent = w.text;
      chip.title = `${w.level} · ${w.start.toFixed(2)}–${w.end.toFixed(2)}s · ${Math.round(w.size)}pt`;
      if (app.overrides[w.id]) chip.classList.add('is-over');
      chip.onclick = (e) => (e.shiftKey ? openWordDialog(w) : cycleLevel(w));
      chip.oncontextmenu = (e) => { e.preventDefault(); openWordDialog(w); };
      host.append(chip);
    }
    const br = document.createElement('span');
    br.className = 'wbreak';
    host.append(br);
  }
  $('#reset-overrides').onclick = () => { app.overrides = {}; regenerate(); };
}

function highlightLiveWords() {
  const live = new Set();
  for (const p of app.plan.phrases) for (const w of p.words) if (app.time >= w.start && app.time < w.end) live.add(w.id);
  for (const chip of $$('.wchip')) chip.classList.toggle('is-live', live.has(chip.dataset.id));
}

const LEVEL_CYCLE = { normal: 'emphasis', emphasis: 'hero', hero: 'normal' };

function cycleLevel(w) {
  const next = LEVEL_CYCLE[app.overrides[w.id]?.level ?? w.level];
  app.overrides[w.id] = { ...(app.overrides[w.id] ?? {}), level: next };
  regenerate();
}

function openWordDialog(w) {
  app.activeWord = w;
  const o = app.overrides[w.id] ?? {};
  $('#word-title').textContent = `"${w.text}"  ·  ${w.start.toFixed(2)}–${w.end.toFixed(2)}s`;
  $('#w-text').value = o.text ?? w.text;
  setSeg('#w-level', o.level ?? w.level);
  $('#w-colour').value = o.colour ? normaliseHex(o.colour) : rgbaToHex(w.colour);
  $('#w-scale').value = String(o.scale ?? 1);
  $('#w-start').value = String((o.start ?? w.start).toFixed(2));
  $('#w-end').value = String((o.end ?? w.end).toFixed(2));
  $('#w-depth').value = o.depth ?? '';

  const fonts = $('#w-font');
  fonts.replaceChildren(option('', 'Template'), ...app.state.families.map((f) => option(f.family, f.family)));
  fonts.value = o.fontFamily ?? '';
  const weights = $('#w-weight');
  weights.replaceChildren(option('', 'Template'), ...app.state.weights.map((x) => option(x, title(x))));
  weights.value = o.fontWeight ?? '';

  $('#word-dialog').showModal();
}

function wireDialogs() {
  // --- word overrides ---
  const setOverride = (key, value) => {
    const id = app.activeWord?.id;
    if (!id) return;
    const next = { ...(app.overrides[id] ?? {}) };
    if (value === '' || value === null || value === undefined) delete next[key];
    else next[key] = value;
    if (Object.keys(next).length) app.overrides[id] = next; else delete app.overrides[id];
    regenerate();
  };

  seg('#w-level', (v) => setOverride('level', v));
  $('#w-text').onchange = (e) => setOverride('text', e.target.value);
  $('#w-colour').oninput = (e) => setOverride('colour', e.target.value);
  $('#w-colour-clear').onclick = () => setOverride('colour', '');
  $('#w-scale').onchange = (e) => setOverride('scale', Number(e.target.value) || 1);
  $('#w-font').onchange = (e) => setOverride('fontFamily', e.target.value);
  $('#w-weight').onchange = (e) => setOverride('fontWeight', e.target.value);
  $('#w-depth').onchange = (e) => setOverride('depth', e.target.value);
  $('#w-start').onchange = (e) => setOverride('start', Number(e.target.value));
  $('#w-end').onchange = (e) => setOverride('end', Number(e.target.value));
  $('#w-reset').onclick = () => {
    if (app.activeWord) delete app.overrides[app.activeWord.id];
    $('#word-dialog').close();
    regenerate();
  };
  $('#w-close').onclick = () => $('#word-dialog').close();

  // --- colour capture ---
  /** @type {HTMLCanvasElement} */
  const canvas = $('#capture-canvas');
  let picked = null;
  $('#capture-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.src = await fileToDataURL(f);
    await img.decode();
    const max = 1400;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    /** @type {any} */ (canvas.getContext('2d')).drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  canvas.onclick = async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
    const r = 14;   // sample a patch, not one pixel — one pixel picks up noise
    const sx = Math.max(0, x - r), sy = Math.max(0, y - r);
    const sw = Math.min(canvas.width - sx, r * 2), sh = Math.min(canvas.height - sy, r * 2);
    if (sw <= 0 || sh <= 0) return;
    const data = /** @type {any} */ (canvas.getContext('2d')).getImageData(sx, sy, sw, sh).data;
    const res = await api('/api/capture', { pixels: [...data] });
    picked = res.colour;
    $('#capture-swatch').style.background = res.colour;
    $('#capture-hex').textContent = res.chromatic ? res.colour : `${res.colour} (little colour here)`;
    $('#capture-use').disabled = false;
  };

  $('#capture-cancel').onclick = () => $('#capture-dialog').close();
  $('#capture-use').onclick = () => {
    if (picked) {
      $('#q-accent').value = picked;
      $('#q-accent-hex').value = picked;
      applyAccent(picked);
    }
    $('#capture-dialog').close();
  };
}

/* ------------------------------------------------------------------ *
 * Template actions, source, export
 * ------------------------------------------------------------------ */

function wireTemplateActions() {
  $('#save-template').onclick = async () => {
    const name = prompt('Name this style', `${currentTemplate().name} — mine`);
    if (!name) return;
    const r = await api('/api/template/save', { templateId: app.templateId, patch: app.patch, name });
    app.state = r.state;
    buildTemplateLists();
    selectTemplate(r.template.id);
    toast(`Saved "${r.template.name}". It will still be here in your next project.`);
  };

  $('#update-template').onclick = async () => {
    const r = await api('/api/template/update', { id: app.templateId, templateId: app.templateId, patch: app.patch });
    app.state = r.state;
    buildTemplateLists();
    selectTemplate(r.template.id);
    toast(`Updated "${r.template.name}".`);
  };

  $('#duplicate-template').onclick = async () => {
    const name = prompt('Name for the copy', `${currentTemplate().name} copy`);
    if (!name) return;
    const r = await api('/api/template/duplicate', { id: app.templateId, name });
    app.state = r.state;
    buildTemplateLists();
    selectTemplate(r.template.id);
    toast(`Duplicated as "${r.template.name}".`);
  };

  $('#delete-template').onclick = async () => {
    const t = currentTemplate();
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    const r = await api('/api/template/delete', { id: app.templateId });
    app.state = r.state;
    buildTemplateLists();
    selectTemplate('pk-real-estate');
    toast('Deleted.');
  };

  $('#export-template').onclick = async () => {
    const destination = prompt('Export to which folder?', $('#out-dir').value);
    if (!destination) return;
    const r = await api('/api/template/export', { id: app.templateId, destination });
    toast(`Exported to ${r.file}`);
  };

  $('#import-template').onclick = async () => {
    const file = prompt('Path to a .pkcaption file');
    if (!file) return;
    const r = await api('/api/template/import', { file });
    app.state = r.state;
    buildTemplateLists();
    selectTemplate(r.template.id);
    toast(`Imported "${r.template.name}".`);
  };
}

function wireSource() {
  /** @type {any} */ let timer = 0;
  $('#transcript').oninput = () => { clearTimeout(timer); timer = setTimeout(regenerate, 420); };
  $('#load-sample').onclick = () => { $('#transcript').value = SAMPLE; regenerate(); };
  $('#load-file').onclick = () => $('#transcript-file').click();
  $('#transcript-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    $('#transcript').value = await f.text();
    regenerate();
  };

  $('#export').onclick = async () => {
    try {
      const r = await api('/api/export', requestBody({ out: $('#out-dir').value, stem: currentTemplate().name }));
      $('#export-note').textContent = `${r.stats.titles} title clips across ${r.stats.lanes} lanes → ${r.file}. In Final Cut: File ▸ Import ▸ XML…`;
      toast(`Exported ${r.stats.titles} clips.`);
      if (r.warnings?.length) console.warn(r.warnings);
    } catch (e) { toast(message(e), true); }
  };
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function setPatch(pathKey, value) {
  set(app.patch, pathKey, value);
  regenerate();
}

function set(obj, pathKey, value) {
  const keys = pathKey.split('.');
  let node = obj;
  for (const k of keys.slice(0, -1)) node = node[k] ??= {};
  node[keys.at(-1)] = value;
}

const get = (obj, pathKey) => pathKey.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function seg(sel, onPick, attr = 'v') {
  for (const b of $$(`${sel} button`)) {
    b.onclick = () => {
      $$(`${sel} button`).forEach((x) => x.classList.toggle('is-on', x === b));
      onPick(b.dataset[attr]);
    };
  }
}

function setSeg(sel, value) {
  for (const b of $$(`${sel} button`)) b.classList.toggle('is-on', b.dataset.v === value);
}

function option(value, label) {
  const o = document.createElement('option');
  o.value = value; o.textContent = label;
  return o;
}

const title = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const esc = (s) => String(s).replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]));

function normaliseHex(v) {
  let h = String(v).trim().replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return `#${h.slice(0, 6).padEnd(6, '0')}`;
}

/** @param {unknown} e @returns {string} */
const message = (e) => (e instanceof Error ? e.message : String(e));

const rgbaToHex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}

async function api(route, body) {
  const res = await fetch(route, body === undefined
    ? {}
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

async function apiText(route, body) {
  const res = await fetch(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 200));
  return text;
}

/** @type {any} */ let toastTimer = 0;
function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast${isError ? ' err' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 6000 : 3800);
}
