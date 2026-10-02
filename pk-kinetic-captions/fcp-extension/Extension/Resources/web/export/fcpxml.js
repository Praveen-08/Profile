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
import { faceName, exportFamily, WEIGHT_NUMERIC } from '../engine/fonts.js';
import { sample } from '../engine/motion.js';
import { capHeightOf } from '../engine/typography.js';

/**
 * Final Cut's own Basic Title. Present on every install, so the native profile
 * needs no installation. It lives under Bumper:Opener — the first version
 * pointed at Build In:Out, and Final Cut imported every title with "The item
 * could not be read".
 */
export const BASIC_TITLE_UID =
  '.../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti';

/**
 * The PK template, once installed. This is the uid Final Cut itself writes
 * for a title in ~/Movies/Motion Templates.localized (read back from a
 * project that used it): relative to the templates folder, and with the
 * category and title folders unlocalized.
 */
export const PK_TITLE_UID =
  '~/Titles.localized/PK Visuals/PK Kinetic Caption/PK Kinetic Caption.moti';

/**
 * Published controls of the PK title, as Final Cut keys them: the title's
 * group (10005), its text layer (10011), the style channel (5), the style
 * object (10042), then the parameter's path inside the style. Read from a
 * project exported by Final Cut after setting each control in its inspector.
 */
const PK_KEY = '9999/10005/10011/5/10042';
export const PK_PARAMS = {
  fill: `${PK_KEY}/14/15`,            // "0 (Color)" | "1 (Gradient)"
  fillColor: `${PK_KEY}/14/16`,
  gradientStart: `${PK_KEY}/14/17/1/999140132/3`,
  gradientEnd: `${PK_KEY}/14/17/1/999140133/3`,
  glowColor: `${PK_KEY}/38/40`,
  glowOpacity: `${PK_KEY}/38/43`,
  glowBlur: `${PK_KEY}/38/44`,
  glowRadius: `${PK_KEY}/38/45`,
  outlineOpacity: `${PK_KEY}/30/35`,
  shadowOpacity: `${PK_KEY}/21/26`,
};

/**
 * Engine blend mode -> FCPXML `adjust-blend` mode, in Final Cut's own form:
 * the mode's position in the inspector's Blend Mode menu (separators counted)
 * and its name. A bare "difference" is silently ignored — the title imports as
 * Normal. Read back from Final Cut 12.2 for Screen (10), Difference (22) and
 * Stencil Alpha (25); the rest follow the same menu positions. Normal writes
 * no mode at all, as Final Cut does.
 */
const BLEND_NAMES = {
  normal: '', multiply: '4 (Multiply)', screen: '10 (Screen)', overlay: '14 (Overlay)',
  softLight: '15 (Soft Light)', difference: '22 (Difference)',
  stencilAlpha: '25 (Stencil Alpha)', silhouetteAlpha: '27 (Silhouette Alpha)',
};

/**
 * @typedef {object} ExportOptions
 * @property {string} [projectName]
 * @property {string} [eventName]
 * @property {"background"|"foreground"} [only]  Export just the words behind the agent, or just those in front.
 * @property {"native"|"pk"} [profile]   Stock Basic Title, or the installed PK template.
 * @property {number} [easingSamples]    Keyframes baked per transition.
 * @property {boolean} [includeGuideGap] Emit the spine gap that holds the titles.
 * @property {number} [duration]         Sequence duration; defaults to the plan's extent.
 * @property {"project"|"clip"} [as]     A project to import, or one compound clip to drop on a timeline.
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

  // `only` exports one layer: the words behind the agent, or those in front.
  // Each becomes its own clip, stacked in Final Cut either side of a masked
  // copy of the shot; inside it, every word is simply on top.
  const words = plan.phrases.flatMap((p) => p.words)
    .filter((w) => !opts.only || (opts.only === 'background') === (w.depth === 'background'))
    .map((w) => (opts.only ? { ...w, depth: /** @type {const} */ ('foreground') } : w))
    .sort((a, b) => a.start - b.start || a.lane - b.lane);
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
  if (profile === 'native' && words.some((w) => w.decoration.gradient?.enabled || w.decoration.glow.enabled)) {
    warnings.push('Gradient and glow need the PK Kinetic Caption title; Final Cut\'s Basic Title draws these words in their flat colour.');
  }
  if (profile === 'native' && words.some((w) => w.active)) {
    warnings.push('The active-word colour needs the PK Kinetic Caption title; with Basic Title those words keep one colour.');
  }
  if (words.some((w) => w.decoration.shine)) {
    warnings.push('Shine is drawn in the preview only for now; Final Cut shows these words without the sweep.');
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

  const name = opts.projectName ?? `${plan.templateName} Captions`;
  const seqDuration = toFCPTime(duration, fps);
  const sequence = `<sequence format="r1" duration="${seqDuration}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
            <gap name="Captions" offset="0s" start="0s" duration="${seqDuration}">
${titles}
            </gap>
          </spine>
        </sequence>`;
  const format = `<format id="r1"${formatName ? ` name="${esc(formatName)}"` : ''} frameDuration="${frameDuration}/${timebase}s" width="${plan.frame.width}" height="${plan.frame.height}" colorSpace="1-1-1 (Rec. 709)"/>`;
  const effect = `<effect id="r2" name="${esc(effectName)}" uid="${esc(effectUID)}"/>`;

  // "clip" is the shape Final Cut itself puts on the pasteboard when a
  // compound clip is dragged: the titles live in a <media> resource and one
  // top-level <ref-clip> points at it. No library, event or project, so a drop
  // lands on the timeline as a single clip instead of importing a new project.
  // The gap inside is transparent once the clip is connected above the video.
  const xml = opts.as === 'clip'
    ? `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    ${format}
    ${effect}
    <media id="r3" name="${esc(name)}">
        ${sequence}
    </media>
  </resources>
  <ref-clip ref="r3" name="${esc(name)}" duration="${seqDuration}"/>
</fcpxml>
`
    : `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    ${format}
    ${effect}
  </resources>
  <library>
    <event name="${esc(opts.eventName ?? 'PK Kinetic Captions')}">
      <project name="${esc(name)}">
        ${sequence}
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
  // A title's position is where its text's *baseline* sits (measured in
  // Final Cut 12.2: a centred word drew with its baseline on the frame's
  // centre). The plan positions the middle of the capitals, as the preview
  // draws them, so the baseline goes half a cap height lower.
  const baseY = w.position.y * plan.frame.height - capHeightOf(w.font, w.size) / 2;

  const crop = renderReveal(w, plan, life, fps, samples);
  const transform = renderTransform(w, plan, baseX, baseY, life, fps, samples);
  const blend = renderBlend(w, life, fps, samples);
  const text = renderTextStyle(w, styleId, plan);

  const params = profile === 'pk' ? renderPKParams(w, plan) : '';

  // A dedicated video role lets the editor solo, hide or export every
  // caption in one click, which matters when there are two hundred of them.
  return `              <title ref="r2" lane="${lane}" offset="${offset}" name="${esc(`${w.level}: ${w.text}`)}" start="0s" duration="${dur}" role="PK Captions">
${params}                <text>
                  <text-style ref="${styleId}">${esc(w.text)}</text-style>
                </text>
                <text-style-def id="${styleId}">
                  ${text}
                </text-style-def>
${crop}${transform}
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

  const times = keyTimes([...w.motion.offsetX, ...w.motion.offsetY, ...w.motion.scale], life, samples, fps);
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

  const rotation = w.motion.rotation ?? [];
  if (rotation.some((k) => Math.abs(k.v) > 1e-3)) {
    // Final Cut's rotation is in degrees, + anticlockwise — the engine's sense.
    lines.push('                  <param name="rotation">', '                    <keyframeAnimation>');
    for (const t of keyTimes(rotation, life, samples, fps)) {
      lines.push(`                      <keyframe time="${toFCPTime(t, fps)}" value="${num(sample(rotation, t, 0), 3)}" curve="linear"/>`);
    }
    lines.push('                    </keyframeAnimation>', '                  </param>');
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

/**
 * Typewriter: a trim crop whose right edge sweeps across the word, so its
 * letters are uncovered left to right. Crop values are in percent of the
 * frame height, like positions (read back from Final Cut's inspector).
 * @returns {string} the element and a newline, or '' when the word has no reveal
 */
function renderReveal(w, plan, life, fps, samples) {
  const reveal = w.motion.reveal ?? [];
  if (!reveal.some((k) => k.v < 0.999)) return '';
  const H = plan.frame.height;
  const halfFrame = plan.frame.width / 2;
  const wordW = w.box.w * plan.frame.width;
  // The crop applies before the transform, where the title's text still sits
  // centred in the frame — so the edges are measured from the centre, not
  // from where the word ends up. (Measured in Final Cut 12.2: using the
  // placed position cut words off the left half of the frame entirely.)
  const left = -wordW / 2 - w.size * 0.05;
  const span = wordW + w.size * 0.1;
  const frames = keyTimes(reveal, life, samples, fps).map((t) => {
    const edge = left + span * clamp01(sample(reveal, t, 1));
    const right = Math.max(0, halfFrame - edge) / H * 100;
    return `                        <keyframe time="${toFCPTime(t, fps)}" value="${num(right, 3)}" curve="linear"/>`;
  }).join('\n');
  return `                <adjust-crop mode="trim">
                  <trim-rect>
                    <param name="right">
                      <keyframeAnimation>
${frames}
                      </keyframeAnimation>
                    </param>
                  </trim-rect>
                </adjust-crop>
`;
}

/** Opacity and the compositing mode. */
function renderBlend(w, life, fps, samples) {
  const mode = BLEND_NAMES[w.blend] ?? '';
  const modeAttr = mode ? ` mode="${esc(mode)}"` : '';
  const times = keyTimes(w.motion.opacity, life, samples, fps);

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

/**
 * The PK title's own controls: gradient fill and glow, which a text-style
 * cannot express. Every control is written, on or off, because the template's
 * defaults have the glow, outline and shadow switched on.
 * @param {PlacedWord} w
 */
function renderPKParams(w, plan) {
  const d = w.decoration;
  const rgb = (c) => toFCPColour(c).split(' ').slice(0, 3).join(' ');
  const p = (name, key, value) => `                <param name="${name}" key="${key}" value="${value}"/>\n`;
  const g = d.gradient;
  let out = p('Fill', PK_PARAMS.fill, g?.enabled ? '1 (Gradient)' : '0 (Color)');
  if (w.active && !g?.enabled && w.active.until > 0) {
    // Active word: its own colour while spoken, then the usual one. A hold,
    // not a fade: the colour hands over on the frame the next word starts.
    const fps = plan.frame.fps;
    const until = w.active.until;
    out += `                <param name="Fill Color" key="${PK_PARAMS.fillColor}">
                  <keyframeAnimation>
                    <keyframe time="0s" value="${rgb(w.active.colour)}" curve="linear"/>
                    <keyframe time="${toFCPTime(Math.max(0, until - 1 / fps), fps)}" value="${rgb(w.active.colour)}" curve="linear"/>
                    <keyframe time="${toFCPTime(until, fps)}" value="${rgb(w.colour)}" curve="linear"/>
                  </keyframeAnimation>
                </param>\n`;
  }
  if (g?.enabled) {
    out += p('Gradient Start', PK_PARAMS.gradientStart, rgb(g.from));
    out += p('Gradient End', PK_PARAMS.gradientEnd, rgb(g.to));
  }
  out += p('Glow Opacity', PK_PARAMS.glowOpacity, d.glow.enabled ? num(Math.min(1, d.glow.intensity), 3) : '0');
  if (d.glow.enabled) {
    out += p('Glow Color', PK_PARAMS.glowColor, rgb(d.glow.colour));
    out += p('Glow Blur', PK_PARAMS.glowBlur, num(d.glow.radius, 1));
  }
  if (!(d.outline.enabled && d.outline.width > 0)) out += p('Outline Opacity', PK_PARAMS.outlineOpacity, '0');
  if (!(d.shadow.enabled && d.shadow.opacity > 0)) out += p('Shadow Opacity', PK_PARAMS.shadowOpacity, '0');
  return out;
}

/** Font, size, colour, and the decoration the style asked for. */
function renderTextStyle(w, styleId, plan) {
  const f = w.font;
  // The face the editor picked from the installed fonts wins: Final Cut
  // matches faces by exact name, and names vary by family ("ExtraBold",
  // "Heavy", "Black").
  const face = f.face ?? faceName(f.family, f.weight, f.width, f.italic);
  // Final Cut measures title text against a 1080-line frame, whatever the
  // project's size: in a 1080x1920 vertical project a fontSize of 79 draws
  // 79 x 1920/1080 = 140px tall. Measured in Final Cut 12.2 — words overlapped
  // and heroes ran off both edges until every pixel value here was scaled back.
  const k = 1080 / plan.frame.height;
  const size = w.size * k;
  const attrs = [
    // An exact face the editor picked belongs to the family they picked.
    `font="${esc(f.face ? f.family : exportFamily(f.family, f.width))}"`,
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
function keyTimes(frames, life, samples, fps) {
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
  // Final Cut keyframes sit on frames. Snap every time to its frame and keep
  // one per frame: two samples inside one frame would land on the same time
  // with different values, and a one-frame strobe (blink) needs each frame's
  // own value, not one interpolated across it.
  const snapped = fps ? out.map((t) => snapToFrame(t, fps)) : out;
  return [...new Set(snapped.map((t) => Number(t.toFixed(6))))].sort((a, b) => a - b);
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
