/**
 * Deterministic SVG renderer.
 *
 * One renderer serves three jobs: the live preview in the UI, template
 * thumbnails, and design verification during development. Because it samples
 * the same keyframes the exporter writes, what the editor sees in the preview
 * is what the timeline produces — a preview that approximates the output
 * separately is worse than no preview at all.
 *
 * @typedef {import('../core/types.js').CaptionPlan} CaptionPlan
 * @typedef {import('../core/types.js').PlacedWord} PlacedWord
 * @typedef {import('../core/types.js').ShotAnalysis} ShotAnalysis
 */

import { capHeightOf } from '../engine/typography.js';
import { sample } from '../engine/motion.js';
import { toCSS, withAlpha } from '../core/colour.js';
import { WEIGHT_NUMERIC, familyInfo, exportFamily } from '../engine/fonts.js';

/** CSS blend-mode names for the engine's compositing modes. */
const CSS_BLEND = {
  normal: 'normal', difference: 'difference', screen: 'screen', overlay: 'overlay',
  softLight: 'soft-light', multiply: 'multiply',
  stencilAlpha: 'normal', silhouetteAlpha: 'normal',
};

/**
 * @typedef {object} RenderOptions
 * @property {number} time                Seconds on the plan's timeline.
 * @property {string} [plate]             Background colour behind the type; "none" leaves it transparent so the page can show video underneath.
 * @property {string} [plateImage]        Optional image href, drawn to fill.
 * @property {ShotAnalysis|null} [shot]   Draws subject/face guides when `guides` is on.
 * @property {boolean} [guides]           Zone, safe-area and subject overlays.
 * @property {number} [scale]             Output pixel scale, default 0.5.
 * @property {boolean} [standalone]       Emit a full SVG document.
 */

/**
 * @param {CaptionPlan} plan
 * @param {RenderOptions} opts
 * @returns {string}
 */
export function renderFrame(plan, opts) {
  const { width, height } = plan.frame;
  const t = opts.time;
  const scale = opts.scale ?? 0.5;
  const W = Math.round(width * scale), H = Math.round(height * scale);

  /** @type {PlacedWord[]} */
  const live = [];
  for (const phrase of plan.phrases) {
    for (const w of phrase.words) {
      if (t >= w.start - 1e-6 && t < w.end && (!opts.depth || (opts.depth === 'background') === (w.depth === 'background'))) live.push(w);
    }
  }
  // Background lanes first, then foreground, each by lane order.
  live.sort((a, b) => (a.depth === b.depth ? a.lane - b.lane : a.depth === 'background' ? -1 : 1));

  const parts = [];
  // A transparent plate is what makes the overlay usable on top of a playing
  // video — and it is what lets the blend modes composite against the actual
  // footage rather than against a flat swatch.
  const plate = opts.plate ?? '#101214';
  if (plate !== 'none') parts.push(`<rect width="${width}" height="${height}" fill="${plate}"/>`);
  if (opts.plateImage) {
    parts.push(`<image href="${escapeAttr(opts.plateImage)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  const behind = live.filter((w) => w.depth === 'background');
  const front = live.filter((w) => w.depth !== 'background');

  for (const w of behind) parts.push(drawWord(w, t, plan, opts.idPrefix));

  // A behind-subject look needs something to be behind. With a real plate FCP
  // supplies the isolated subject; in preview we draw the analysed subject box
  // so the editor can see the type disappear behind it.
  if (behind.length && opts.shot?.subject) {
    const s = opts.shot.subject;
    parts.push(`<rect x="${(0.5 + s.x - s.w / 2) * width}" y="${(0.5 - s.y - s.h / 2) * height}" width="${s.w * width}" height="${s.h * height}" rx="${s.w * width * 0.14}" fill="${plate === 'none' ? '#101214' : plate}" opacity="0.94"/>`);
  }

  for (const w of front) parts.push(drawWord(w, t, plan, opts.idPrefix));

  if (opts.guides) parts.push(drawGuides(plan, opts));

  const body = parts.join('\n  ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${width} ${height}" font-kerning="normal">
  ${body}
</svg>`;
  return opts.standalone === false ? body : svg;
}

/**
 * @param {PlacedWord} w
 * @param {number} t
 * @param {CaptionPlan} plan
 * @param {string} [idPrefix]  Keeps paint-server ids unique when several frames share a page.
 * @returns {string}
 */
function drawWord(w, t, plan, idPrefix = '') {
  // Final Cut shows whole frames; so does the preview, or a one-frame blink
  // would read as a fade.
  const fps = plan.frame.fps || 30;
  const local = Math.floor((t - w.start) * fps + 1e-6) / fps;
  const opacity = clamp01(sample(w.motion.opacity, local, 1));
  if (opacity <= 0.001) return '';

  const sc = sample(w.motion.scale, local, 1);
  const dx = sample(w.motion.offsetX, local, 0) * plan.frame.height;
  const dy = sample(w.motion.offsetY, local, 0) * plan.frame.height;
  const blur = sample(w.motion.blur, local, 0);
  const rot = sample(w.motion.rotation ?? [], local, 0);
  const shown = clamp01(sample(w.motion.reveal ?? [], local, 1));
  if (shown <= 0.001) return '';
  const colour = w.active && local < w.active.until ? w.active.colour : w.colour;

  // Normalized centre-origin, +y up  ->  SVG top-left origin, +y down.
  const cx = (0.5 + w.position.x) * plan.frame.width + dx;
  const cy = (0.5 - w.position.y) * plan.frame.height - dy;

  const info = familyInfo(w.font.family);
  // The word is drawn on its baseline, half a cap height below the point the
  // plan positions — exactly as the exporter places it in Final Cut, so the
  // preview and the timeline agree for any font and size. The group's origin
  // stays at the middle of the capitals, so scale and rotation pivot there.
  const baseline = capHeightOf(w.font, w.size) / 2;
  const drawn = w.font.face ? w.font.family : exportFamily(w.font.family, w.font.width);
  const family = [...new Set([drawn, w.font.family]), ...info.fallbacks, info.classification === 'serif' ? 'serif' : 'sans-serif']
    .map((f) => (f.includes(' ') ? `'${f}'` : f)).join(', ');

  // Gradient fill and the shine sweep are per-word paint servers, so each
  // word gets its own ids (word ids are unique within a plan).
  const gid = `pk-${idPrefix}${String(w.id).replace(/[^\w-]/g, '_')}`;
  const grad = w.decoration.gradient?.enabled ? w.decoration.gradient : null;
  const defs = [];
  if (grad) defs.push(linearGradient(`${gid}-f`, grad.angle, [[0, toCSS(grad.from)], [1, toCSS(grad.to)]]));
  // Shine: a soft white band crosses the word once, just after it lands.
  const SHINE_START = 0.12, SHINE_LEN = 0.6;
  const p = (local - SHINE_START) / SHINE_LEN;
  const shining = w.decoration.shine && p > 0 && p < 1;
  // Typewriter: a clip that uncovers the word from its left edge. Generous
  // height so ascenders, descenders and the glow are never cut.
  let clip = '';
  if (shown < 0.999) {
    const halfW = (w.box.w * plan.frame.width) / Math.max(sc, 0.01) / 2 + w.size * 0.1;
    defs.push(`<clipPath id="${gid}-c"><rect x="${round(-halfW)}" y="${round(-w.size * 1.5)}" width="${round(2 * halfW * shown)}" height="${round(w.size * 3)}"/></clipPath>`);
    clip = ` clip-path="url(#${gid}-c)"`;
  }
  if (shining) {
    const c = -0.3 + p * 1.6;   // the band's centre travels from off the left edge to off the right
    defs.push(linearGradient(`${gid}-s`, 20, [
      [c - 0.18, 'rgba(255,255,255,0)'], [c, 'rgba(255,255,255,0.85)'], [c + 0.18, 'rgba(255,255,255,0)'],
    ]));
  }

  /** @type {string[]} */
  const attrs = [
    `x="0"`, `y="${round(baseline)}"`,
    `font-family="${escapeAttr(family)}"`,
    `font-size="${round(w.size)}"`,
    `font-weight="${WEIGHT_NUMERIC[w.font.weight] ?? 400}"`,
    w.font.italic ? 'font-style="italic"' : '',
    `letter-spacing="${round((w.font.tracking / 1000) * w.size)}"`,
    `fill="${grad ? `url(#${gid}-f)` : toCSS(colour)}"`,
    `text-anchor="middle"`,
  ].filter(Boolean);

  const filters = [];
  if (blur > 0.01) filters.push(`blur(${round(blur)}px)`);
  if (w.decoration.glow.enabled && w.decoration.glow.intensity > 0) {
    const g = w.decoration.glow;
    filters.push(`drop-shadow(0 0 ${round(g.radius)}px ${toCSS(withAlpha(g.colour, Math.min(1, g.intensity)))})`);
  }
  if (w.decoration.shadow.enabled && w.decoration.shadow.opacity > 0) {
    const s = w.decoration.shadow;
    const rad = (s.angle * Math.PI) / 180;
    filters.push(`drop-shadow(${round(Math.cos(rad) * s.distance)}px ${round(-Math.sin(rad) * s.distance)}px ${round(s.blur)}px ${toCSS(withAlpha(s.colour, s.opacity))})`);
  }

  const stroke = w.decoration.outline.enabled
    ? ` stroke="${toCSS(w.decoration.outline.colour)}" stroke-width="${round(w.decoration.outline.width)}" paint-order="stroke fill" stroke-linejoin="round"`
    : '';

  const style = [
    `opacity:${round(opacity, 4)}`,
    `mix-blend-mode:${CSS_BLEND[w.blend] ?? 'normal'}`,
    filters.length ? `filter:${filters.join(' ')}` : '',
  ].filter(Boolean).join(';');


  const text = escapeText(w.text);
  const shine = shining
    ? `<text ${attrs.filter((a) => !a.startsWith('fill=')).join(' ')} fill="url(#${gid}-s)">${text}</text>`
    : '';
  // SVG rotates clockwise for +deg; the engine's + is anticlockwise.
  const turn = Math.abs(rot) > 0.01 ? ` rotate(${round(-rot, 3)})` : '';
  return `<g transform="translate(${round(cx)} ${round(cy)})${turn} scale(${round(sc, 5)})" style="${style}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    `<g${clip}><text ${attrs.join(' ')}${stroke}>${text}</text>${shine}</g></g>`;
}

/**
 * A linear gradient across the text's own box. `angle` in degrees: 0 runs
 * left to right, 90 bottom to top.
 * @param {string} id @param {number} angle @param {[number, string][]} stops
 */
function linearGradient(id, angle, stops) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) / 2, dy = Math.sin(rad) / 2;
  const s = stops.map(([o, c]) => `<stop offset="${round(Math.min(1, Math.max(0, o)), 4)}" stop-color="${c}"/>`).join('');
  return `<linearGradient id="${id}" x1="${round(0.5 - dx, 4)}" y1="${round(0.5 + dy, 4)}" x2="${round(0.5 + dx, 4)}" y2="${round(0.5 - dy, 4)}">${s}</linearGradient>`;
}

/** Zone, safe-area and subject overlays for the UI's layout view. */
function drawGuides(plan, opts) {
  const { width, height } = plan.frame;
  const out = [];
  const box = (x, y, w, h, colour, dash = '10 10') =>
    `<rect x="${(0.5 + x - w / 2) * width}" y="${(0.5 - y - h / 2) * height}" width="${w * width}" height="${h * height}" fill="none" stroke="${colour}" stroke-width="3" stroke-dasharray="${dash}"/>`;

  if (opts.shot?.face) out.push(box(opts.shot.face.x, opts.shot.face.y, opts.shot.face.w, opts.shot.face.h, '#ff5f8f'));
  if (opts.shot?.subject) out.push(box(opts.shot.subject.x, opts.shot.subject.y, opts.shot.subject.w, opts.shot.subject.h, '#5fb0ff'));

  for (const p of plan.phrases) {
    if (opts.time >= p.start && opts.time < p.end) {
      for (const w of p.words) out.push(box(w.box.x, w.box.y, w.box.w, w.box.h, 'rgba(120,255,190,0.55)', '4 8'));
    }
  }
  return out.join('\n  ');
}

/* ------------------------------------------------------------------ *
 * Contact sheet
 * ------------------------------------------------------------------ */

/**
 * A grid of sampled frames. This is how a whole plan is reviewed at a glance
 * — and how the design was checked while the engines were built.
 *
 * @param {CaptionPlan} plan
 * @param {{count?: number, columns?: number, scale?: number, plate?: string, times?: number[]}} [opts]
 * @returns {string}
 */
export function renderContactSheet(plan, opts = {}) {
  const times = opts.times ?? pickRepresentativeTimes(plan, opts.count ?? 12);
  const columns = opts.columns ?? 4;
  const scale = opts.scale ?? 0.22;
  const { width, height } = plan.frame;
  const cw = Math.round(width * scale), ch = Math.round(height * scale);
  const pad = 14, labelH = 22;
  const rows = Math.ceil(times.length / columns);
  const W = columns * (cw + pad) + pad, H = rows * (ch + pad + labelH) + pad;

  const cells = times.map((t, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    const x = pad + col * (cw + pad), y = pad + row * (ch + pad + labelH);
    const inner = renderFrame(plan, { time: t, plate: opts.plate, scale: 1, standalone: false });
    return `<g transform="translate(${x} ${y})">
    <svg width="${cw}" height="${ch}" viewBox="0 0 ${width} ${height}">${inner}</svg>
    <rect width="${cw}" height="${ch}" fill="none" stroke="#2a2d31"/>
    <text x="0" y="${ch + 15}" font-family="ui-monospace, monospace" font-size="11" fill="#8b9096">${t.toFixed(2)}s</text>
  </g>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0b0c0e"/>
  ${cells}
</svg>`;
}

/**
 * Sample times that actually show something: the midpoint of each phrase,
 * preferring phrases that contain a promoted word.
 * @param {CaptionPlan} plan @param {number} count @returns {number[]}
 */
export function pickRepresentativeTimes(plan, count) {
  if (!plan.phrases.length) return [0];
  const ranked = plan.phrases
    .map((p) => ({
      t: p.start + (p.end - p.start) * 0.62,
      weight: p.words.some((w) => w.level === 'hero') ? 2 : p.words.some((w) => w.level === 'emphasis') ? 1 : 0,
      index: p.index,
    }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, count)
    .sort((a, b) => a.index - b.index);
  return ranked.map((r) => r.t);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const round = (v, d = 2) => Number(v.toFixed(d));
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
