/**
 * Animation engine.
 *
 * Motion is word-aware and hierarchy-aware: a normal word should barely
 * announce itself, a hero word should land. But the brief is equally clear
 * about what to avoid — no random bounce, no elastic gimmickry unless the
 * editor deliberately picks an energetic style. So overshoot is a property of
 * the *style*, not a default, and it is zero in four of the seven styles.
 *
 * Everything is expressed as keyframes with explicit cubic-bezier easing, so
 * the SVG preview, the FCPXML exporter and the Motion template all animate
 * identically rather than each approximating the intent.
 *
 * @typedef {import('../core/types.js').Level} Level
 * @typedef {import('../core/types.js').Keyframe} Keyframe
 * @typedef {import('../core/types.js').WordMotion} WordMotion
 * @typedef {import('../core/types.js').InAnimation} InAnimation
 * @typedef {import('../core/types.js').OutAnimation} OutAnimation
 * @typedef {import('../core/types.js').AnimationStyle} AnimationStyle
 * @typedef {import('../templates/schema.js').Template} Template
 */

/** @type {Record<string, [number,number,number,number]>} */
export const EASING = {
  linear: [0, 0, 1, 1],
  out: [0.22, 1, 0.36, 1],            // expo-ish out — the workhorse
  outSoft: [0.25, 0.46, 0.45, 0.94],
  outSlow: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  // Sine in-out: the gentle S of a cross dissolve, no snap at either end.
  dissolve: [0.37, 0, 0.63, 1],
  in: [0.64, 0, 0.78, 0],
  back: [0.34, 1.4, 0.64, 1],         // restrained overshoot
  backHard: [0.34, 1.7, 0.5, 1],
};

/**
 * What an editor can adjust on an animation, on top of the style's feel.
 * @typedef {object} MotionTune
 * @property {number} [inDuration]   Seconds.
 * @property {number} [outDuration]  Seconds.
 * @property {number} [distance]     Multiplier on the style's travel; 0 keeps the word still.
 * @property {"up"|"down"|"left"|"right"} [direction]  Where the word travels to as it enters.
 * @property {keyof EASING} [ease]    Entrance curve.
 * @property {keyof EASING} [outEase] Exit curve.
 * @property {number} [scaleFrom]    Starting scale for scale and pop entrances.
 * @property {number} [rotateFrom]   Starting angle in degrees for the rotate entrance (+ is anticlockwise).
 * @property {number} [stayThrough]  Captions after its own that the word stays on screen through (0–3).
 */

/**
 * @typedef {object} StyleProfile
 * @property {number} inDur       Base in-duration for a normal word, seconds.
 * @property {number} outDur
 * @property {keyof EASING} inEase
 * @property {keyof EASING} outEase
 * @property {number} rise        Rise/slide distance as a fraction of the word's cap height.
 * @property {number} scaleFrom   Starting scale for scale-type entrances.
 * @property {number} blur        Entry blur in points at normal size.
 * @property {number} heroDur     Multiplier on hero durations.
 * @property {number} emphasisDur Multiplier on emphasis durations.
 * @property {number} overshoot   0 means none. Only energetic/punchy use it.
 */

/** @type {Record<AnimationStyle, StyleProfile>} */
export const STYLES = {
  minimal: { inDur: 0.16, outDur: 0.14, inEase: 'outSoft', outEase: 'linear', rise: 0, scaleFrom: 1, blur: 0, heroDur: 1.15, emphasisDur: 1.0, overshoot: 0 },
  smooth: { inDur: 0.30, outDur: 0.22, inEase: 'out', outEase: 'inOut', rise: 0.18, scaleFrom: 0.97, blur: 0, heroDur: 1.3, emphasisDur: 1.1, overshoot: 0 },
  editorial: { inDur: 0.46, outDur: 0.30, inEase: 'outSlow', outEase: 'inOut', rise: 0.26, scaleFrom: 0.955, blur: 4, heroDur: 1.45, emphasisDur: 1.15, overshoot: 0 },
  cinematic: { inDur: 0.62, outDur: 0.42, inEase: 'outSlow', outEase: 'inOut', rise: 0.14, scaleFrom: 0.94, blur: 9, heroDur: 1.5, emphasisDur: 1.2, overshoot: 0 },
  luxury: { inDur: 0.80, outDur: 0.55, inEase: 'outSlow', outEase: 'inOut', rise: 0.10, scaleFrom: 0.975, blur: 3, heroDur: 1.35, emphasisDur: 1.15, overshoot: 0 },
  punchy: { inDur: 0.20, outDur: 0.14, inEase: 'back', outEase: 'in', rise: 0.30, scaleFrom: 0.88, blur: 0, heroDur: 1.1, emphasisDur: 1.0, overshoot: 0.03 },
  energetic: { inDur: 0.15, outDur: 0.11, inEase: 'backHard', outEase: 'in', rise: 0.42, scaleFrom: 0.78, blur: 0, heroDur: 1.0, emphasisDur: 0.95, overshoot: 0.07 },
};

/**
 * Exit curves must accelerate, not decelerate. An ease-OUT curve applied to a
 * fade-out dumps most of the opacity in the first few frames and then lingers
 * near zero — the word appears to blink off. Every style therefore uses an
 * ease-in or ease-in-out curve on the way out, which is why `outEase` above
 * never names one of the `out*` curves.
 */

/**
 * Build the motion for one word.
 *
 * @param {object} args
 * @param {Level} args.level
 * @param {Template} args.template
 * @param {number} args.life          Total seconds the word is on screen.
 * @param {number} args.capFraction   The word's cap height as a fraction of frame height, for distance scaling.
 * @param {InAnimation} [args.inOverride]
 * @param {OutAnimation} [args.outOverride]
 * @param {{blur?: boolean, perCharacter?: boolean, maskReveal?: boolean}} [args.capabilities]
 * @param {MotionTune} [args.tune]    Editor's adjustments; anything unset keeps the style's value.
 * @param {number} [args.letters]    Characters in the word, which paces the typewriter.
 * @param {number} [args.fps]        Frame rate: a blink switches on whole frames.
 * @returns {WordMotion}
 */
export function buildMotion({ level, template, life, capFraction, inOverride, outOverride, capabilities, tune = {}, letters = 6, fps = 30 }) {
  const caps = { blur: true, perCharacter: true, maskReveal: true, ...(capabilities ?? {}) };
  const style = STYLES[template.motion.style] ?? STYLES.smooth;
  const speed = template.motion.speed || 1;
  const levelDur = level === 'hero' ? style.heroDur : level === 'emphasis' ? style.emphasisDur : 1;

  let inAnimation = inOverride ?? template.motion.in[level] ?? 'fade';
  let outAnimation = outOverride ?? template.motion.out[level] ?? 'fade';

  // Degrade to the nearest animation the destination can actually render,
  // rather than emitting keyframes it will ignore.
  if (!caps.blur && inAnimation === 'blur') inAnimation = 'scale';
  if (!caps.blur && outAnimation === 'blur') outAnimation = 'fade';
  if (!caps.maskReveal && (inAnimation === 'reveal' || inAnimation === 'maskReveal')) inAnimation = 'rise';
  // 'maskExit' (Cut) needs no mask: it is no keyframes at all.

  // Entry and exit must fit inside the word's life and still leave a real
  // hold in the middle — a word that is always either arriving or leaving is
  // never actually read. At most 35% of its life goes to each, so at least
  // 30% is spent fully on screen.
  const budget = Math.max(0.05, life * 0.35);
  // A typewriter is paced by its letters (~28 a second) unless the editor set a time.
  // A cross dissolve wants time to read as a dissolve rather than a blink.
  const DISSOLVE = 0.4 / speed;
  // A blink is counted in frames: eight by default (on, off, on, off …).
  const BLINK = 8 / fps;
  const natural = inAnimation === 'typewriter' ? Math.max(0.12, letters * 0.036)
    : inAnimation === 'dissolve' ? DISSOLVE : inAnimation === 'blink' ? BLINK : style.inDur * levelDur / speed;
  const inDuration = Math.min(tune.inDuration ?? natural, budget);
  const outDuration = Math.min(tune.outDuration ?? (outAnimation === 'dissolve' ? DISSOLVE : outAnimation === 'blink' ? BLINK : style.outDur * levelDur / speed), budget);
  const outStart = Math.max(inDuration + Math.min(0.04, life * 0.05), life - outDuration);

  // Movement distance scales with the word's own size, so a hero word travels
  // proportionally further than a normal one without any extra configuration.
  // A style with no travel (Minimal) still moves when the editor asks for distance.
  const baseRise = style.rise || 0.18;
  const dist = (tune.distance === undefined ? style.rise : baseRise * tune.distance)
    * capFraction * (level === 'hero' ? 1.35 : level === 'emphasis' ? 1.15 : 1);
  const scaleFrom = tune.scaleFrom ?? (level === 'hero' ? 1 - (1 - style.scaleFrom) * 1.8 : style.scaleFrom);
  // Unit vector of where the word comes FROM, in the engine's +y-up space.
  const from = tune.direction ? DIRECTIONS[tune.direction] : null;

  /** @type {Keyframe[]} */ const opacity = [];
  /** @type {Keyframe[]} */ const scale = [];
  /** @type {Keyframe[]} */ const offsetX = [];
  /** @type {Keyframe[]} */ const offsetY = [];
  /** @type {Keyframe[]} */ const blur = [];
  /** @type {Keyframe[]} */ const rotation = [];
  /** @type {Keyframe[]} */ const reveal = [];

  const ein = EASING[tune.ease ?? style.inEase] ?? EASING[style.inEase];
  // Exits must accelerate (see above), so only the accelerating curves are taken.
  const eout = EASING[['in', 'inOut', 'linear'].includes(tune.outEase ?? '') ? tune.outEase : style.outEase];
  const effectiveStyle = caps.blur ? style : { ...style, blur: 0 };

  // --- in ---
  applyIn(inAnimation, { opacity, scale, offsetX, offsetY, blur, rotation, reveal }, { inDuration, dist, scaleFrom, style: effectiveStyle, ein, level, from, rotateFrom: tune.rotateFrom, fps });

  // Overshoot is additive and tiny, and only exists in the two styles that
  // declare it — this is the "no cheap animation" rule made structural.
  if (style.overshoot > 0 && (inAnimation === 'pop' || inAnimation === 'scale')) {
    scale.splice(1, 0, { t: inDuration * 0.7, v: 1 + style.overshoot, ease: ein });
  }

  // --- out ---
  applyOut(outAnimation, { opacity, scale, offsetX, offsetY, blur }, { outStart, life, outDuration, dist, style: effectiveStyle, eout, from, fps });

  return {
    opacity: dedupe(opacity), scale: dedupe(scale), offsetX: dedupe(offsetX),
    offsetY: dedupe(offsetY), blur: dedupe(blur), rotation: dedupe(rotation), reveal: dedupe(reveal),
    inDuration, outDuration, inAnimation, outAnimation,
    perCharacter: caps.perCharacter && level === 'hero' && template.motion.perCharacterHero,
  };
}

/**
 * Overshoot is only ever meaningful on scale and position. Applied to opacity
 * or blur it produces values outside their legal range, which renders as a
 * flash — so those channels always get the non-overshooting equivalent.
 * @param {[number,number,number,number]} ease
 */
function settled(ease) {
  return ease === EASING.back || ease === EASING.backHard ? EASING.out : ease;
}

/** Where a word starts, as a unit vector, for each direction it can travel to. */
const DIRECTIONS = {
  up: { x: 0, y: -1 },        // starts below, rises
  down: { x: 0, y: 1 },       // starts above, drops
  left: { x: 1.6, y: 0 },     // starts right, moves left
  right: { x: -1.6, y: 0 },   // starts left, moves right
};

function applyIn(kind, ch, { inDuration, dist, scaleFrom, style, ein, level, from, rotateFrom, fps = 30 }) {
  const safe = settled(ein);
  const fadeIn = () => { ch.opacity.push({ t: 0, v: 0 }, { t: inDuration, v: 1, ease: safe }); };
  /** Travel in from `dir` (or the animation's own default) by `amount` of dist. */
  const travel = (fallback, amount) => {
    const d = from ?? fallback;
    if (d.x) ch.offsetX.push({ t: 0, v: d.x * dist * amount }, { t: inDuration, v: 0, ease: ein });
    if (d.y) ch.offsetY.push({ t: 0, v: d.y * dist * amount }, { t: inDuration, v: 0, ease: ein });
  };

  switch (kind) {
    case 'fade': fadeIn(); if (from) travel(from, 1); break;
    case 'rise':
      fadeIn();
      travel(DIRECTIONS.up, 1);
      break;
    case 'slide':
      fadeIn();
      travel(DIRECTIONS.right, 1);
      break;
    case 'scale':
      fadeIn();
      ch.scale.push({ t: 0, v: scaleFrom }, { t: inDuration, v: 1, ease: ein });
      if (from) travel(from, 1);
      break;
    case 'pop':
      ch.opacity.push({ t: 0, v: 0 }, { t: inDuration * 0.45, v: 1, ease: safe });
      ch.scale.push({ t: 0, v: Math.min(scaleFrom, 0.86) }, { t: inDuration, v: 1, ease: EASING.back });
      if (from) travel(from, 1);
      break;
    case 'blur':
      fadeIn();
      ch.blur.push({ t: 0, v: Math.max(style.blur, 8) }, { t: inDuration, v: 0, ease: safe });
      break;
    case 'stretch':
      fadeIn();
      ch.scale.push({ t: 0, v: scaleFrom * 0.9 }, { t: inDuration, v: 1, ease: ein });
      travel(DIRECTIONS.up, 0.5);
      break;
    case 'blink': {
      // A strobe: visible one frame, gone the next, a few times, then it
      // stays. Keyframes sit on frame boundaries, so every rendered frame is
      // fully on or fully off — never a fade between.
      // At least on-off-on; never longer than the time the entrance has.
      const n = Math.max(2, Math.round(inDuration * fps));
      for (let k = 0; k < n; k++) ch.opacity.push({ t: k / fps, v: k % 2 === 0 ? 1 : 0, ease: EASING.linear });
      ch.opacity.push({ t: n / fps, v: 1, ease: EASING.linear });
      break;
    }
    case 'dissolve':
      // A cross dissolve: opacity only, on a gentle S-curve. No movement,
      // no scale, no blur — the word simply appears.
      ch.opacity.push({ t: 0, v: 0 }, { t: inDuration, v: 1, ease: EASING.dissolve });
      break;
    case 'rotate':
      // Swings in about its centre while it grows into place — the turn and
      // the scale share one curve so the word lands as a single movement.
      fadeIn();
      ch.rotation.push({ t: 0, v: rotateFrom ?? 14 }, { t: inDuration, v: 0, ease: ein });
      ch.scale.push({ t: 0, v: Math.min(scaleFrom, 0.9) }, { t: inDuration, v: 1, ease: ein });
      if (from) travel(from, 1);
      break;
    case 'typewriter':
      // Letters appear left to right at an even pace: `reveal` is the
      // fraction of the word shown. Linear on purpose — typing does not ease.
      ch.opacity.push({ t: 0, v: 1 });
      ch.reveal.push({ t: 0, v: 0 }, { t: inDuration, v: 1, ease: EASING.linear });
      break;
    case 'type':
    case 'reveal':
    case 'maskReveal':
      // Reveal is a mask animation; the channel form is a hard opacity step so
      // that any renderer without masking still shows the word at the right
      // instant rather than fading it in wrongly.
      ch.opacity.push({ t: 0, v: 0 }, { t: Math.min(0.02, inDuration), v: 1, ease: EASING.linear });
      travel(DIRECTIONS.up, 0.35);
      break;
    default: fadeIn();
  }

  if (style.blur > 0 && kind !== 'blur' && kind !== 'dissolve' && level !== 'normal') {
    ch.blur.push({ t: 0, v: style.blur }, { t: inDuration, v: 0, ease: safe });
  }
}

function applyOut(kind, ch, { outStart, life, outDuration, dist, style, eout, from, fps = 30 }) {
  const safe = settled(eout);
  const fadeOut = () => { ch.opacity.push({ t: outStart, v: 1, ease: EASING.linear }, { t: life, v: 0, ease: safe }); };

  switch (kind) {
    case 'fade': fadeOut(); break;
    case 'dissolve':
      ch.opacity.push({ t: outStart, v: 1, ease: EASING.linear }, { t: life, v: 0, ease: EASING.dissolve });
      break;
    case 'blink': {
      // The same strobe on the way out, ending gone.
      const n = Math.max(2, Math.min(Math.round((life - outStart) * fps), Math.floor(life * fps)));
      const from0 = Math.max(0, life - n / fps);
      for (let k = 0; k < n; k++) ch.opacity.push({ t: from0 + k / fps, v: k % 2 === 0 ? 1 : 0, ease: EASING.linear });
      ch.opacity.push({ t: life, v: 0, ease: EASING.linear });
      break;
    }
    case 'scale':
      fadeOut();
      ch.scale.push({ t: outStart, v: 1, ease: EASING.linear }, { t: life, v: 1.04, ease: eout });
      break;
    case 'shrink':
      fadeOut();
      ch.scale.push({ t: outStart, v: 1, ease: EASING.linear }, { t: life, v: 0.94, ease: eout });
      break;
    case 'slide': {
      fadeOut();
      // Leave the way it was travelling: the opposite of where it came from.
      const d = from ? { x: -from.x, y: -from.y } : { x: 0.75, y: 0 };
      if (d.x) ch.offsetX.push({ t: outStart, v: 0, ease: EASING.linear }, { t: life, v: d.x * dist * 1.6, ease: eout });
      if (d.y) ch.offsetY.push({ t: outStart, v: 0, ease: EASING.linear }, { t: life, v: d.y * dist * 1.6, ease: eout });
      break;
    }
    case 'blur':
      fadeOut();
      ch.blur.push({ t: outStart, v: 0, ease: EASING.linear }, { t: life, v: Math.max(style.blur, 8), ease: safe });
      break;
    case 'maskExit':
      // A cut: no keyframes at all — the word is on until its clip ends. So a
      // title lengthened in Final Cut stays on for the new length instead of
      // vanishing at a baked-in time.
      break;
    default: fadeOut();
  }
}

/** Keyframes can collide at t=0 or t=life when in and out overlap; keep the last write. */
function dedupe(frames) {
  const sorted = [...frames].sort((a, b) => a.t - b.t);
  /** @type {Keyframe[]} */
  const out = [];
  for (const f of sorted) {
    if (out.length && Math.abs(out[out.length - 1].t - f.t) < 1e-6) out[out.length - 1] = f;
    else out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Sampling
 * ------------------------------------------------------------------ */

/** Cubic bezier solved for y given x, Newton then bisection. Standard CSS timing semantics. */
export function bezier(p, x) {
  const [x1, y1, x2, y2] = p;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = sampleX(t) - x;
    if (Math.abs(d) < 1e-6) break;
    const dv = sampleDX(t);
    if (Math.abs(dv) < 1e-6) break;
    t -= d / dv;
  }
  if (t < 0 || t > 1) {
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (sampleX(t) < x) lo = t; else hi = t;
    }
  }
  return ((ay * t + by) * t + cy) * t;
}

/**
 * Value of a keyframe channel at time t (seconds into the word's life).
 * @param {Keyframe[]} frames @param {number} t @param {number} fallback @returns {number}
 */
export function sample(frames, t, fallback) {
  if (!frames.length) return fallback;
  if (t <= frames[0].t) return frames[0].v;
  const last = frames[frames.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (t <= b.t) {
      const span = b.t - a.t;
      if (span <= 0) return b.v;
      const p = bezier(b.ease ?? EASING.linear, (t - a.t) / span);
      return a.v + (b.v - a.v) * p;
    }
  }
  return last.v;
}
