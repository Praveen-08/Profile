/**
 * FCPXML exporter.
 *
 * Design decisions worth knowing before reading the code:
 *
 * **One title per word.** Every word has its own position, size, colour and
 * animation, so it needs its own clip. Packing a phrase into a single title
 * with several text runs would halve the clip count but hand line breaking
 * and word spacing to Final Cut's text engine, and the preview would stop
 * matching the timeline. A predictable design is worth the clips.
 *
 * **Geometry through `adjust-transform`, not Motion parameter keys.** The
 * usual way to place a title from FCPXML is a `<param>` carrying an opaque
 * key like `9999/10003/13260/...` that identifies a parameter inside the
 * Motion template. Those keys differ between templates and between Final Cut
 * versions, and when one is wrong the clip imports silently in the wrong
 * place. `adjust-transform` and `adjust-blend` are part of the FCPXML
 * language itself, so they are stable.
 *
 * **Easing is baked.** FCPXML keyframes only offer linear / ease / easeIn /
 * easeOut, which cannot express the curves the motion engine uses. Rather
 * than approximating, each transition is sampled and written as linear
 * keyframes, so the timeline reproduces the preview exactly.
 *
 * **Blend modes are real.** `<adjust-blend mode="difference">` is genuine
 * compositing, which is what the Difference look requires — not a colour
 * trick that happens to look similar on one shot.
 *
 * @typedef {import('../core/types.js').CaptionPlan} CaptionPlan
 * @typedef {import('../core/types.js').PlacedWord} PlacedWord
 */

import { toFCPTime, timebaseFor, snapToFrame } from '../core/time.js';
import { toFCPColour } from '../core/colour.js';
import { faceName, WEIGHT_NUMERIC } from '../engine/fonts.js';
import { sample } from '../engine/motion.js';

/**
 * Final Cut's own Basic Title. Present on every install, so the native profile
 * needs no installation. It lives under Bumper:Opener — the first version
 * pointed at Build In:Out, and Final Cut imported every title with "The item
 * could not be read".
 */
export const BASIC_TITLE_UID =
  '.../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti';

/** The PK template, once installed by `pkkc install`. */
export const PK_TITLE_UID =
  '~/Movies/Motion Templates.localized/Titles.localized/PK Visuals.localized/PK Kinetic Caption.localized/PK Kinetic Caption.moti';

/** Engine blend mode -> FCPXML `adjust-blend` mode. */
const BLEND_NAMES = {
  normal: 'normal', difference: 'difference', screen: 'screen', overlay: 'overlay',
  softLight: 'soft light', multiply: 'multiply',
  stencilAlpha: 'stencil alpha', silhouetteAlpha: 'silhouette alpha',
};

/**
 * @typedef {object} ExportOptions
 * @property {string} [projectName]
 * @property {string} [eventName]
 * @property {"native"|"pk"} [profile]   Stock Basic Title, or the installed PK template.
 * @property {number} [easingSamples]    Keyframes baked per transition.
 * @property {boolean} [includeGuideGap] Emit the spine gap that holds the titles.
 * @property {number} [duration]         Sequence duration; defaults to the plan's extent.
 */

/**
 * @param {CaptionPlan} plan
 * @param {ExportOptions} [opts]
 * @returns {{xml: string, stats: {titles: number, lanes: number, duration: number}, warnings: string[]}}
 */
export function exportFCPXML(plan, opts = {}) {
  const fps = plan.frame.fps;
  const profile = opts.profile ?? 'native';
  const samples = Math.max(2, opts.easingSamples ?? 8);
  /** @type {string[]} */
  const warnings = [];

  const words = plan.phrases.flatMap((p) => p.words).sort((a, b) => a.start - b.start || a.lane - b.lane);
  if (!words.length) warnings.push('The plan contains no words, so the exported project is empty.');

  const extent = words.length ? Math.max(...words.map((w) => w.end)) : 1;
  const duration = snapToFrame(opts.duration ?? extent + 1, fps);

  // FCP lanes must be positive integers above the storyline and negative
  // below it. The plan's lane numbers are per-phrase, so they are rebased
  // here into one global, collision-free ordering.
  const laneMap = assignGlobalLanes(words);
  const usedLanes = new Set([...laneMap.values()]);

  if (words.some((w) => w.motion.blur.some((k) => k.v > 0)) && profile === 'native') {
    warnings.push('This plan contains blur keyframes, which Final Cut\'s stock title cannot animate. They were not exported. Compose with capabilities.blur enabled only when exporting to the PK Motion title.');
  }
  if (words.some((w) => w.depth === 'background')) {
    warnings.push('This plan places type behind the subject. The exported project builds the layer stack; isolate the subject on the top copy of the shot using Final Cut\'s own masking, then the type sits behind them.');
  }
  if (words.length > 400) {
    warnings.push(`${words.length} title clips. That is a lot for one timeline — consider a higher caption density or a shorter selection if playback stutters.`);
  }

  const { timebase, frameDuration } = timebaseFor(fps);
  // Only name the format when it really is one of Final Cut's presets.
  // A wrong preset name on a vertical sequence makes FCP argue with the
  // width and height it was also given; width/height/frameDuration alone
  // are unambiguous.
  const formatName = standardFormatName(plan.frame, fps);
  const effectUID = profile === 'pk' ? PK_TITLE_UID : BASIC_TITLE_UID;
  const effectName = profile === 'pk' ? 'PK Kinetic Caption' : 'Basic Title';

  const titles = words.map((w, i) => renderTitle(w, i, laneMap.get(w.id) ?? 1, plan, samples, profile)).join('\n');
  void effectName;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    <format id="r1"${formatName ? ` name="${esc(formatName)}"` : ''} frameDuration="${frameDuration}/${timebase}s" width="${plan.frame.width}" height="${plan.frame.height}" colorSpace="1-1-1 (Rec. 709)"/>
    <effect id="r2" name="${esc(effectName)}" uid="${esc(effectUID)}"/>
  </resources>
  <library>
    <event name="${esc(opts.eventName ?? 'PK Kinetic Captions')}">
      <project name="${esc(opts.projectName ?? `${plan.templateName} Captions`)}">
        <sequence format="r1" duration="${toFCPTime(duration, fps)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
            <gap name="Captions" offset="0s" start="0s" duration="${toFCPTime(duration, fps)}">
${titles}
            </gap>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;

  return { xml, stats: { titles: words.length, lanes: usedLanes.size, duration }, warnings };
}

/* ------------------------------------------------------------------ *
 * One title
 * ------------------------------------------------------------------ */

/**
 * @param {PlacedWord} w
 * @param {number} index
 * @param {number} lane
 * @param {CaptionPlan} plan
 * @param {number} samples
 * @param {"native"|"pk"} profile
 */
function renderTitle(w, index, lane, plan, samples, profile) {
  const fps = plan.frame.fps;
  const life = w.end - w.start;
  const styleId = `ts${index + 1}`;

  const offset = toFCPTime(w.start, fps);
  const dur = toFCPTime(life, fps);

  // Normalized centre-origin (+y up) -> pixels from the centre of the frame.
  // Converted to Final Cut's units only when written; see fcpPosition.
  const baseX = w.position.x * plan.frame.width;
  const baseY = w.position.y * plan.frame.height;

  const transform = renderTransform(w, plan, baseX, baseY, life, fps, samples);
  const blend = renderBlend(w, life, fps, samples);
  const text = renderTextStyle(w, styleId, plan);

  // A dedicated video role lets the editor solo, hide or export every
  // caption in one click, which matters when there are two hundred of them.
  void profile;
  return `              <title ref="r2" lane="${lane}" offset="${offset}" name="${esc(`${w.level}: ${w.text}`)}" start="0s" duration="${dur}" role="PK Captions">
                <text>
                  <text-style ref="${styleId}">${esc(w.text)}</text-style>
                </text>
                <text-style-def id="${styleId}">
                  ${text}
                </text-style-def>
${transform}
${blend}
              </title>`;
}

/**
 * Pixels from the frame centre -> an FCPXML transform position, which is in
 * percent of the frame *height* (same orientation, +y up). Writing pixels put
 * every title far outside the frame: -407.7 was read as -407.7% of 1920px,
 * shown in Final Cut's inspector as X -7828.6px.
 */
function fcpPosition(xPx, yPx, plan) {
  const h = plan.frame.height;
  return `${num((xPx / h) * 100, 4)} ${num((yPx / h) * 100, 4)}`;
}

/** Position and scale, baked from the motion engine's curves. */
function renderTransform(w, plan, baseX, baseY, life, fps, samples) {
  const hasMove = w.motion.offsetX.length > 1 || w.motion.offsetY.length > 1;
  const hasScale = w.motion.scale.length > 1;

  if (!hasMove && !hasScale) {
    const s = w.motion.scale.length ? w.motion.scale[0].v : 1;
    return `                <adjust-transform position="${fcpPosition(baseX, baseY, plan)}" scale="${num(s, 5)} ${num(s, 5)}" anchor="0 0"/>`;
  }

  const times = keyTimes([...w.motion.offsetX, ...w.motion.offsetY, ...w.motion.scale], life, samples);
  const lines = ['                <adjust-transform anchor="0 0">'];

  if (hasMove) {
    lines.push('                  <param name="position">', '                    <keyframeAnimation>');
    for (const t of times) {
      const x = baseX + sample(w.motion.offsetX, t, 0) * plan.frame.height;
      const y = baseY + sample(w.motion.offsetY, t, 0) * plan.frame.height;
      lines.push(`                      <keyframe time="${toFCPTime(t, fps)}" value="${fcpPosition(x, y, plan)}" curve="linear"/>`);
    }
    lines.push('                    </keyframeAnimation>', '                  </param>');
  } else {
    lines.push(`                  <param name="position" value="${fcpPosition(baseX, baseY, plan)}"/>`);
  }

  if (hasScale) {
    lines.push('                  <param name="scale">', '                    <keyframeAnimation>');
    for (const t of times) {
      const s = sample(w.motion.scale, t, 1);
      lines.push(`                      <keyframe time="${toFCPTime(t, fps)}" value="${num(s, 5)} ${num(s, 5)}" curve="linear"/>`);
    }
    lines.push('                    </keyframeAnimation>', '                  </param>');
  }

  lines.push('                </adjust-transform>');
  return lines.join('\n');
}

/** Opacity and the compositing mode. */
function renderBlend(w, life, fps, samples) {
  const mode = BLEND_NAMES[w.blend] ?? 'normal';
  const modeAttr = mode === 'normal' ? '' : ` mode="${esc(mode)}"`;
  const times = keyTimes(w.motion.opacity, life, samples);

  if (times.length <= 1) {
    const v = w.motion.opacity.length ? w.motion.opacity[0].v : 1;
    return `                <adjust-blend${modeAttr} amount="${num(v, 4)}"/>`;
  }

  const frames = times
    .map((t) => `                      <keyframe time="${toFCPTime(t, fps)}" value="${num(clamp01(sample(w.motion.opacity, t, 1)), 4)}" curve="linear"/>`)
    .join('\n');

  return `                <adjust-blend${modeAttr}>
                  <param name="amount">
                    <keyframeAnimation>
${frames}
                    </keyframeAnimation>
                  </param>
                </adjust-blend>`;
}

/** Font, size, colour, and the decoration the style asked for. */
function renderTextStyle(w, styleId, plan) {
  const f = w.font;
  const face = faceName(f.family, f.weight, f.width, f.italic);
  // Final Cut measures title text against a 1080-line frame, whatever the
  // project's size: in a 1080x1920 vertical project a fontSize of 79 draws
  // 79 x 1920/1080 = 140px tall. Measured in Final Cut 12.2 — words overlapped
  // and heroes ran off both edges until every pixel value here was scaled back.
  const k = 1080 / plan.frame.height;
  const size = w.size * k;
  const attrs = [
    `font="${esc(f.family)}"`,
    `fontSize="${num(size, 1)}"`,
    `fontFace="${esc(face)}"`,
    `fontColor="${toFCPColour(w.colour)}"`,
    `bold="${WEIGHT_NUMERIC[f.weight] >= 600 ? 1 : 0}"`,
    `italic="${f.italic ? 1 : 0}"`,
    `alignment="center"`,
    `lineSpacing="${num((f.lineHeight - 1) * 100, 1)}"`,
  ];
  if (f.tracking) attrs.push(`kerning="${num(f.tracking / 1000 * size, 2)}"`);

  const d = w.decoration;
  if (d.outline.enabled && d.outline.width > 0) {
    attrs.push(`strokeColor="${toFCPColour(d.outline.colour)}"`, `strokeWidth="${num(d.outline.width * k, 2)}"`);
  }
  if (d.shadow.enabled && d.shadow.opacity > 0) {
    attrs.push(
      `shadowColor="${toFCPColour({ ...d.shadow.colour, a: d.shadow.opacity })}"`,
      `shadowOffset="${num(d.shadow.distance * k, 2)} ${num(d.shadow.angle, 1)}"`,
      `shadowBlurRadius="${num(d.shadow.blur * k, 1)}"`,
    );
  }
  return `<text-style ${attrs.join(' ')}/>`;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** @param {import('../core/types.js').Frame} frame @param {number} fps @returns {string|null} */
function standardFormatName(frame, fps) {
  const landscape = frame.width >= frame.height;
  if (!landscape) return null;
  const known = { 720: '720p', 1080: '1080p', 2160: '2160p' }[frame.height];
  if (!known) return null;
  const rate = Math.abs(fps - Math.round(fps)) < 0.01 ? String(Math.round(fps)) : fps.toFixed(2).replace('.', '');
  return `FFVideoFormat${known}${rate}`;
}

/**
 * Sample points for a baked channel: every declared keyframe time, plus
 * intermediate samples inside each segment so the curve shape survives being
 * written as linear keyframes.
 *
 * @param {import('../core/types.js').Keyframe[]} frames
 * @param {number} life
 * @param {number} samples
 * @returns {number[]}
 */
function keyTimes(frames, life, samples) {
  if (!frames.length) return [];
  const anchors = [...new Set(frames.map((k) => Math.min(life, Math.max(0, k.t))))].sort((a, b) => a - b);
  if (anchors.length === 1) return anchors;

  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    out.push(a);
    const span = b - a;
    // A segment whose endpoints hold the same value is flat, however it is
    // eased, so it needs no intermediate keyframes. Without this check a
    // one-second hold between the entrance and the exit would emit eight
    // identical keyframes per channel per word.
    const flat = Math.abs(sample(frames, a, 0) - sample(frames, b, 0)) < 1e-4
      && Math.abs(sample(frames, a + span / 2, 0) - sample(frames, a, 0)) < 1e-4;
    if (span > 1e-4 && !flat) {
      for (let s = 1; s < samples; s++) out.push(a + (span * s) / samples);
    }
  }
  out.push(anchors[anchors.length - 1]);
  return [...new Set(out.map((t) => Number(t.toFixed(5))))].sort((a, b) => a - b);
}

/**
 * Rebase per-phrase lanes into one global ordering.
 *
 * Final Cut lanes are a property of the whole timeline, not of a phrase, so
 * two phrases that both used "lane 1" would collide. Overlapping words are
 * given distinct lanes; words that never share the screen can reuse one,
 * which keeps the lane count low enough to stay navigable.
 *
 * @param {PlacedWord[]} words
 * @returns {Map<string, number>}
 */
export function assignGlobalLanes(words) {
  /** @type {Map<string, number>} */
  const out = new Map();

  for (const group of [words.filter((w) => w.depth === 'background'), words.filter((w) => w.depth !== 'background')]) {
    const below = group.length && group[0].depth === 'background';
    /** @type {number[]} */
    const laneFreeAt = [];
    // Within a phrase, the plan's own lane order decides who is in front.
    const ordered = [...group].sort((a, b) => a.start - b.start || a.lane - b.lane);

    for (const w of ordered) {
      let slot = laneFreeAt.findIndex((freeAt) => freeAt <= w.start + 1e-6);
      if (slot === -1) { slot = laneFreeAt.length; laneFreeAt.push(0); }
      laneFreeAt[slot] = w.end;
      out.set(w.id, below ? -(slot + 1) : slot + 1);
    }
  }
  return out;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v, d = 2) => Number(Number(v).toFixed(d)).toString();
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
