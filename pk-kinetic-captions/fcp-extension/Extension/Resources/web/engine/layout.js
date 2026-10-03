/**
 * Position engine.
 *
 * Decides where each phrase sits and lays its words out inside that zone.
 *
 * The rule the brief is strictest about: movement must look intentional. So
 * zone choice is scored, not cycled and never randomised — a zone is held for
 * a minimum dwell time, changes are driven by what is actually in the frame
 * (face, subject, negative space), and ties break on a hash of the phrase id
 * so the same transcript always lands in the same place.
 *
 * @typedef {import('../core/types.js').Phrase} Phrase
 * @typedef {import('../core/types.js').Level} Level
 * @typedef {import('../core/types.js').Zone} Zone
 * @typedef {import('../core/types.js').Rect} Rect
 * @typedef {import('../core/types.js').Point} Point
 * @typedef {import('../core/types.js').Frame} Frame
 * @typedef {import('../core/types.js').ShotAnalysis} ShotAnalysis
 * @typedef {import('../core/types.js').FontSpec} FontSpec
 * @typedef {import('../templates/schema.js').Template} Template
 */

import { measureWidth, lineHeightOf, capHeightOf, applyCasing, fitToWidth } from './typography.js';
import { hashUnit } from '../core/hash.js';
import { isFunctionWord } from '../lexicon/function-words.js';
import { ZONES } from '../core/types.js';

/** Zone anchors in normalized centre-origin space, +y up. */
const ZONE_ANCHOR = /** @type {Record<Zone, Point>} */ ({
  top: { x: 0, y: 0.33 },
  upperLeft: { x: -0.24, y: 0.20 },
  upperRight: { x: 0.24, y: 0.20 },
  center: { x: 0, y: 0.0 },
  lowerLeft: { x: -0.24, y: -0.20 },
  lowerRight: { x: 0.24, y: -0.20 },
  bottom: { x: 0, y: -0.31 },
});

/**
 * Platform UI keep-outs, as fractions of the frame. Instagram, TikTok and
 * Shorts all put chrome in roughly these places; the union is what "Safe"
 * means in the UI.
 */
const SAFE_INSETS = {
  '9:16': { top: 0.11, bottom: 0.20, left: 0.05, right: 0.16 },
  '4:5': { top: 0.07, bottom: 0.13, left: 0.05, right: 0.08 },
  '1:1': { top: 0.06, bottom: 0.10, left: 0.05, right: 0.06 },
  '16:9': { top: 0.06, bottom: 0.10, left: 0.05, right: 0.05 },
};

/** @param {Frame} frame @param {Template} template @returns {{top:number,bottom:number,left:number,right:number}} */
export function insetsFor(frame, template) {
  const m = template.position.margin;
  const base = { top: m, bottom: m, left: m, right: m };
  if (!frame.safeArea) return base;
  const safe = SAFE_INSETS[frame.aspect] ?? SAFE_INSETS['16:9'];
  return {
    top: Math.max(base.top, safe.top), bottom: Math.max(base.bottom, safe.bottom),
    left: Math.max(base.left, safe.left), right: Math.max(base.right, safe.right),
  };
}

/** The rectangle type is allowed to occupy, in normalized coords. */
export function liveArea(frame, template) {
  const i = insetsFor(frame, template);
  return {
    x: (i.left - i.right) / 2,
    y: (i.bottom - i.top) / 2,
    w: 1 - i.left - i.right,
    h: 1 - i.top - i.bottom,
  };
}

/* ------------------------------------------------------------------ *
 * Zone selection
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} ZoneDecision
 * @property {Zone} zone
 * @property {string} reason
 * @property {number} score
 */

/**
 * @param {Phrase} phrase
 * @param {Template} template
 * @param {Frame} frame
 * @param {ShotAnalysis|null} shot
 * @param {{zone: Zone, since: number, runLength?: number}|null} held
 * @param {boolean} hasHero
 * @returns {ZoneDecision}
 */
export function chooseZone(phrase, template, frame, shot, held, hasHero) {
  const cfg = template.position;

  if (cfg.mode === 'static' || cfg.mode === 'manual') {
    return { zone: cfg.home, reason: cfg.mode === 'static' ? 'static composition' : 'manual placement', score: 0 };
  }

  const allowed = (cfg.zones?.length ? cfg.zones : ZONES).filter((z) => ZONES.includes(z));
  if (!allowed.length) return { zone: cfg.home, reason: 'no zones configured', score: 0 };

  // Hold the current zone unless it has been held long enough, so the type
  // does not hop on every caption.
  if (held && phrase.start - held.since < cfg.zoneHold && allowed.includes(held.zone)) {
    const blocked = cfg.faceAvoidance && shot?.face && overlapsFace(held.zone, shot.face, frame, template);
    if (!blocked) return { zone: held.zone, reason: `holding (${(phrase.start - held.since).toFixed(1)}s of ${cfg.zoneHold}s)`, score: 0 };
  }

  /** @type {ZoneDecision[]} */
  const scored = allowed.map((zone) => {
    let score = 0;
    /** @type {string[]} */
    const why = [];

    // Preference order in the template is a real signal, but a normalised one:
    // a long zone list must not let list position outweigh what is actually
    // in the frame.
    const rank = allowed.indexOf(zone);
    score += ((allowed.length - rank) / allowed.length) * 1.6;

    if (shot?.face && cfg.faceAvoidance) {
      const ov = zoneFaceOverlap(zone, shot.face, frame, template);
      if (ov > 0.01) {
        // Hero type is allowed to cross the subject when the style says so —
        // that is the "large word crossing behind the speaker" look.
        const allowedToCross = hasHero && cfg.heroMayOverlap;
        score -= ov * (allowedToCross ? 3 : 18);
        why.push(allowedToCross ? 'crosses face (permitted for hero)' : 'overlaps face');
      }
    }

    if (shot?.subject) {
      // Put type in the negative space the subject is not using.
      const anchor = ZONE_ANCHOR[zone];
      const subjectOffCentre = Math.abs(shot.subject.x) > 0.06;
      // Only a laterally-offset zone can fill lateral negative space. A
      // centred zone sits on top of the subject however far off-centre they
      // stand, so it must not collect this bonus.
      const zoneIsLateral = Math.abs(anchor.x) > 0.1;
      if (subjectOffCentre && zoneIsLateral && Math.sign(anchor.x) === Math.sign(-shot.subject.x)) {
        score += 2.2; why.push('fills negative space');
      }
      if (Math.abs(shot.subject.x) <= 0.06 && (zone === 'top' || zone === 'bottom' || zone === 'center')) {
        score += 0.8; why.push('subject centred');
      }
    }

    if (shot?.kind === 'drone' || shot?.kind === 'property') {
      if (zone === 'center' || zone === 'top') { score += 1.0; why.push('open landscape'); }
    }

    if (held?.zone === zone) {
      // Continuity is good; stasis is not. A zone that has carried several
      // phrases in a row accumulates fatigue, so the composition eventually
      // moves on purpose rather than sitting in one corner for a whole reel
      // or hopping at random.
      const run = held.runLength ?? 1;
      const fatigue = Math.max(0, run - 2) * 0.85;
      score += 0.9 - fatigue;
      why.push(run > 2 ? `held ${run} phrases` : 'continuity');
    }

    // Deterministic tie-break, seeded by content so it never changes between runs.
    score += hashUnit(`${phrase.id}:${zone}`) * 0.35;

    return { zone, score, reason: why.join(', ') || 'template preference' };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

/** @returns {number} 0..1 fraction of the zone's block area covered by the face box. */
function zoneFaceOverlap(zone, face, frame, template) {
  const block = zoneBlockRect(zone, frame, template);
  return rectOverlapRatio(block, face);
}

function overlapsFace(zone, face, frame, template) {
  return zoneFaceOverlap(zone, face, frame, template) > 0.08;
}

/** A conservative estimate of the rectangle a caption block occupies in a zone. */
function zoneBlockRect(zone, frame, template) {
  const a = ZONE_ANCHOR[zone];
  const live = liveArea(frame, template);
  const w = Math.min(template.hierarchy.maxWidth, live.w);
  const h = (template.scale.base * template.scale.emphasis * 1.9) * (Math.min(frame.width, frame.height) / frame.height) * template.hierarchy.maxLines;
  return { x: clampX(a.x, w, live), y: clampY(a.y, h, live), w, h };
}

const clampX = (x, w, live) => Math.min(live.x + live.w / 2 - w / 2, Math.max(live.x - live.w / 2 + w / 2, x));
const clampY = (y, h, live) => Math.min(live.y + live.h / 2 - h / 2, Math.max(live.y - live.h / 2 + h / 2, y));

/** @param {Rect} a @param {Rect} b @returns {number} */
export function rectOverlapRatio(a, b) {
  const ax0 = a.x - a.w / 2, ax1 = a.x + a.w / 2, ay0 = a.y - a.h / 2, ay1 = a.y + a.h / 2;
  const bx0 = b.x - b.w / 2, bx1 = b.x + b.w / 2, by0 = b.y - b.h / 2, by1 = b.y + b.h / 2;
  const ox = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
  const oy = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  const area = a.w * a.h;
  return area > 0 ? (ox * oy) / area : 0;
}

/* ------------------------------------------------------------------ *
 * Block layout
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} LayoutItem
 * @property {string} id
 * @property {string} text
 * @property {Level} level
 * @property {FontSpec} font
 * @property {number} size
 */

/**
 * @typedef {object} LaidOut
 * @property {string} id
 * @property {Point} position   Centre of the word's box, normalized.
 * @property {Rect} box
 * @property {number} size      Possibly reduced to fit.
 * @property {number} line
 */

/**
 * Lay a phrase's words out inside a zone.
 *
 * Words of different sizes share a baseline within a line, which is what
 * makes "small word + huge hero word" read as one designed line rather than
 * as two captions that happen to overlap.
 *
 * @param {LayoutItem[]} items
 * @param {Zone} zone
 * @param {Template} template
 * @param {Frame} frame
 * @param {{align?: "left"|"center"|"right"}} [opts]
 * @returns {{words: LaidOut[], block: Rect, lines: number}}
 */
export function layoutBlock(items, zone, template, frame, opts = {}) {
  const live = liveArea(template ? frame : frame, template);
  const maxWidthPx = Math.min(template.hierarchy.maxWidth, live.w) * frame.width;
  const align = opts.align ?? template.position.align;

  // Shrink any single word that cannot fit the frame on its own before
  // breaking lines, otherwise a long hero word forces a one-word line that
  // still overflows.
  const sized = items.map((it) => {
    const fit = fitToWidth(applyCasing(it.text, it.font.casing), it.font, it.size, maxWidthPx);
    return { ...it, size: fit.size, width: measureWidth(applyCasing(it.text, it.font.casing), it.font, fit.size) };
  });

  // Keeping lines (after a word's level changed): wrap only when a line
  // would leave the frame's live area, not at the style's narrower width.
  const wrapAt = opts.keepLines ? live.w * frame.width : maxWidthPx;

  // Greedy break, respecting maxLines.
  /** @type {Array<Array<typeof sized[number]>>} */
  const lines = [[]];
  let lineWidth = 0;
  for (const it of sized) {
    const gapPx = lines[lines.length - 1].length ? template.spacing.wordGap * it.size : 0;
    // The editor asked for a new line here: honoured whatever the width or line count.
    if (it.lineBreak && lines[lines.length - 1].length) {
      lines.push([]); lineWidth = 0;
    } else if (lineWidth + gapPx + it.width > wrapAt && lines[lines.length - 1].length
      && (opts.keepLines || lines.length < template.hierarchy.maxLines
        // An extra line beats a line that runs off the frame.
        || lineWidth + gapPx + it.width > live.w * frame.width)) {
      lines.push([]); lineWidth = 0;
    }
    const g = lines[lines.length - 1].length ? template.spacing.wordGap * it.size : 0;
    lines[lines.length - 1].push(it);
    lineWidth += g + it.width;
  }

  // A line that ends on "and" or "the" reads as a mistake even when the
  // measurements are perfect, so push a trailing function word down to join
  // the word it belongs to — but only when the line below has room.
  for (let li = 0; li < lines.length - 1; li++) {
    const line = lines[li], next = lines[li + 1];
    if (line.length < 2 || next[0]?.lineBreak) continue;    // never undo the editor's own break
    const tail = line[line.length - 1];
    if (!isFunctionWord(tail.text)) continue;
    const nextWidth = next.reduce((a, it, k) => a + it.width + (k ? template.spacing.wordGap * it.size : 0), 0);
    if (nextWidth + tail.width + template.spacing.wordGap * tail.size > maxWidthPx) continue;
    line.pop();
    next.unshift(tail);
  }

  // Vertical metrics: each line is as tall as its largest item.
  const lineMetrics = lines.map((line) => {
    const maxSize = Math.max(...line.map((i) => i.size), 1);
    const font = line.reduce((a, b) => (b.size > a.size ? b : a), line[0]).font;
    return { height: lineHeightOf(font, maxSize), cap: capHeightOf(font, maxSize), maxSize };
  });
  const gapPx = template.spacing.lineGap * Math.max(...lineMetrics.map((m) => m.maxSize), 1);
  const blockHeightPx = lineMetrics.reduce((a, m) => a + m.height, 0) + gapPx * (lines.length - 1);
  const blockWidthPx = Math.max(...lines.map((line) =>
    line.reduce((a, it, k) => a + it.width + (k ? template.spacing.wordGap * it.size : 0), 0)), 1);

  // Anchor, clamped into the live area.
  const anchor = ZONE_ANCHOR[zone] ?? ZONE_ANCHOR.center;
  const blockW = blockWidthPx / frame.width;
  const blockH = blockHeightPx / frame.height;
  const cx = clampX(anchor.x, blockW, live);
  const cy = clampY(anchor.y, blockH, live);

  /** @type {LaidOut[]} */
  const out = [];
  let yCursorPx = blockHeightPx / 2;   // top of the block, relative to its centre, +y up

  lines.forEach((line, li) => {
    const metrics = lineMetrics[li];
    const lineWidthPx = line.reduce((a, it, k) => a + it.width + (k ? template.spacing.wordGap * it.size : 0), 0);
    let xPx = align === 'center' ? -lineWidthPx / 2
      : align === 'right' ? blockWidthPx / 2 - lineWidthPx
        : -blockWidthPx / 2;

    // Baseline sits one cap height below the line's top edge.
    const baselineY = yCursorPx - metrics.height * 0.82;

    for (let k = 0; k < line.length; k++) {
      const it = line[k];
      if (k) xPx += template.spacing.wordGap * it.size;
      const capPx = capHeightOf(it.font, it.size);
      const centreYPx = baselineY + capPx / 2;
      out.push({
        id: it.id, size: it.size, line: li,
        position: { x: cx + (xPx + it.width / 2) / frame.width, y: cy + centreYPx / frame.height },
        box: {
          x: cx + (xPx + it.width / 2) / frame.width,
          y: cy + centreYPx / frame.height,
          w: it.width / frame.width,
          h: capPx / frame.height,
        },
      });
      xPx += it.width;
    }
    yCursorPx -= metrics.height + gapPx;
  });

  return { words: out, lines: lines.length, block: { x: cx, y: cy, w: blockW, h: blockH } };
}

/**
 * Nudge a laid-out block off the face box when the style asks for face
 * avoidance and the chosen zone still lands on the subject's features. Keeps
 * the block inside the live area, and gives up rather than pushing type
 * somewhere worse.
 *
 * @param {{words: LaidOut[], block: Rect}} layout
 * @param {Rect|undefined} face
 * @param {Template} template
 * @param {Frame} frame
 * @returns {{words: LaidOut[], block: Rect, nudged: boolean}}
 */
export function avoidFace(layout, face, template, frame) {
  if (!face || !template.position.faceAvoidance) return { ...layout, nudged: false };
  const overlap = rectOverlapRatio(layout.block, face);
  if (overlap < 0.06) return { ...layout, nudged: false };

  const live = liveArea(frame, template);
  const faceTop = face.y + face.h / 2, faceBottom = face.y - face.h / 2;
  const liveTop = live.y + live.h / 2, liveBottom = live.y - live.h / 2;

  const upShift = faceTop + layout.block.h / 2 + 0.02 - layout.block.y;
  const downShift = faceBottom - layout.block.h / 2 - 0.02 - layout.block.y;
  const canUp = layout.block.y + upShift + layout.block.h / 2 <= liveTop;
  const canDown = layout.block.y + downShift - layout.block.h / 2 >= liveBottom;

  /** @type {number|null} */
  let dy = null;
  if (canUp && canDown) dy = Math.abs(upShift) <= Math.abs(downShift) ? upShift : downShift;
  else if (canUp) dy = upShift;
  else if (canDown) dy = downShift;
  if (dy === null) return { ...layout, nudged: false };

  return {
    words: layout.words.map((w) => ({ ...w, position: { ...w.position, y: w.position.y + dy }, box: { ...w.box, y: w.box.y + dy } })),
    block: { ...layout.block, y: layout.block.y + dy },
    nudged: true,
  };
}

export { ZONE_ANCHOR, SAFE_INSETS };
