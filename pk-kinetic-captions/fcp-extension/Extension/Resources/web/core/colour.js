/**
 * Colour engine.
 *
 * Everything is kept as sRGB 0..1 RGBA because that is what FCPXML wants and
 * what a browser canvas hands back. All *judgement* about colour — is this
 * readable, what harmonises with it, is it too hot for a luxury palette — is
 * made in OKLab, because judging lightness in sRGB produces the muddy,
 * over-saturated palettes that make auto-generated captions look cheap.
 *
 * @typedef {import('./types.js').RGBA} RGBA
 */

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/* ------------------------------------------------------------------ *
 * Parsing and formatting
 * ------------------------------------------------------------------ */

/**
 * Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, or a bare hex.
 * @param {string|RGBA} input
 * @returns {RGBA}
 */
export function parseColour(input) {
  if (input && typeof input === 'object') return normaliseRGBA(input);
  if (typeof input !== 'string') throw new TypeError(`Cannot parse colour: ${String(input)}`);
  const s = input.trim().toLowerCase();

  const fn = /^rgba?\(([^)]+)\)$/.exec(s);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b, a] = parts;
    return normaliseRGBA({
      r: channelFrom(r),
      g: channelFrom(g),
      b: channelFrom(b),
      a: a === undefined ? 1 : parseFloat(a) > 1 ? parseFloat(a) / 255 : parseFloat(a),
    });
  }

  let hex = s.startsWith('#') ? s.slice(1) : s;
  if (!/^[0-9a-f]+$/.test(hex)) throw new TypeError(`Not a colour: ${input}`);
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
  if (hex.length !== 6 && hex.length !== 8) throw new TypeError(`Not a colour: ${input}`);
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function channelFrom(token) {
  if (token.endsWith('%')) return clamp(parseFloat(token) / 100);
  const n = parseFloat(token);
  return clamp(n > 1 ? n / 255 : n);
}

/** @param {Partial<RGBA>} c @returns {RGBA} */
export function normaliseRGBA(c) {
  return { r: clamp(c.r ?? 0), g: clamp(c.g ?? 0), b: clamp(c.b ?? 0), a: clamp(c.a ?? 1) };
}

/** @param {RGBA} c @param {boolean} [withAlpha] @returns {string} */
export function toHex(c, withAlpha = false) {
  const h = (v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${withAlpha && c.a < 1 ? h(c.a) : ''}`;
}

/** FCPXML wants space-separated floats. @param {RGBA} c @returns {string} */
export function toFCPColour(c) {
  const f = (v) => Number(clamp(v).toFixed(6)).toString();
  return `${f(c.r)} ${f(c.g)} ${f(c.b)} ${f(c.a)}`;
}

/** @param {RGBA} c @returns {string} */
export function toCSS(c) {
  const b = (v) => Math.round(clamp(v) * 255);
  return c.a >= 1 ? `rgb(${b(c.r)},${b(c.g)},${b(c.b)})` : `rgba(${b(c.r)},${b(c.g)},${b(c.b)},${Number(c.a.toFixed(3))})`;
}

/** @param {RGBA} c @param {number} a @returns {RGBA} */
export const withAlpha = (c, a) => ({ ...c, a: clamp(a) });

/* ------------------------------------------------------------------ *
 * sRGB <-> linear <-> OKLab
 * ------------------------------------------------------------------ */

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toGamma = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** @param {RGBA} c @returns {{L:number,a:number,b:number}} */
export function toOKLab(c) {
  const r = toLinear(c.r), g = toLinear(c.g), bl = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** @param {{L:number,a:number,b:number}} lab @param {number} [alpha] @returns {RGBA} */
export function fromOKLab(lab, alpha = 1) {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return normaliseRGBA({
    r: toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  });
}

/** @param {RGBA} c @returns {{L:number,C:number,h:number}} h in degrees. */
export function toOKLCH(c) {
  const { L, a, b } = toOKLab(c);
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
}

/** @param {{L:number,C:number,h:number}} lch @param {number} [alpha] @returns {RGBA} */
export function fromOKLCH(lch, alpha = 1) {
  const rad = (lch.h * Math.PI) / 180;
  return fromOKLab({ L: clamp(lch.L), a: Math.cos(rad) * lch.C, b: Math.sin(rad) * lch.C }, alpha);
}

/* ------------------------------------------------------------------ *
 * Readability
 * ------------------------------------------------------------------ */

/** WCAG relative luminance. @param {RGBA} c @returns {number} */
export function luminance(c) {
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

/** WCAG contrast ratio, 1..21. @param {RGBA} a @param {RGBA} b @returns {number} */
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Nudge a colour's OKLab lightness until it reads against `against`, without
 * shifting hue. Captions sit over unpredictable footage, so this is used to
 * keep a captured accent legible rather than to force a fixed palette.
 *
 * @param {RGBA} colour
 * @param {RGBA} against
 * @param {number} [target] Minimum contrast ratio.
 * @returns {RGBA}
 */
export function ensureContrast(colour, against, target = 3.0) {
  if (contrastRatio(colour, against) >= target) return colour;
  const lch = toOKLCH(colour);
  const goUp = luminance(against) < 0.4;
  let best = colour, bestRatio = contrastRatio(colour, against);
  for (let i = 1; i <= 24; i++) {
    const L = clamp(lch.L + (goUp ? i : -i) * 0.02, 0.05, 0.99);
    const candidate = fromOKLCH({ ...lch, L });
    const ratio = contrastRatio(candidate, against);
    if (ratio > bestRatio) { best = candidate; bestRatio = ratio; }
    if (ratio >= target) return candidate;
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Palette generation
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} Palette
 * @property {RGBA} primary    Normal words.
 * @property {RGBA} accent     Emphasis words.
 * @property {RGBA} secondary  Supporting / de-emphasised words.
 * @property {RGBA} hero       Hero words.
 * @property {RGBA} neutral    Bars, rules, shadows.
 */

/**
 * Derive a full five-role palette from one accent. Deliberately conservative:
 * the primary stays a warm off-white (PK house rule — never pure #ffffff),
 * and the hero is the accent with a small lightness lift rather than a
 * different hue, so the result reads as one considered palette and not as
 * four colours that happened to be generated together.
 *
 * @param {RGBA|string} accentInput
 * @param {{mood?: "neutral"|"luxury"|"social", primary?: RGBA|string}} [opts]
 * @returns {Palette}
 */
export function generatePalette(accentInput, opts = {}) {
  const accent = parseColour(accentInput);
  const lch = toOKLCH(accent);
  const mood = opts.mood ?? 'neutral';

  // House off-white, warmed very slightly toward the accent hue so the
  // "white" text and the accent feel like they belong to one image.
  const primary = opts.primary
    ? parseColour(opts.primary)
    : fromOKLCH({ L: 0.965, C: Math.min(0.012, lch.C * 0.08), h: lch.h });

  const accentTuned = mood === 'luxury'
    ? fromOKLCH({ L: clamp(lch.L, 0.62, 0.86), C: Math.min(lch.C, 0.13), h: lch.h })
    : mood === 'social'
      ? fromOKLCH({ L: clamp(lch.L, 0.6, 0.88), C: Math.max(lch.C, 0.14), h: lch.h })
      : fromOKLCH({ L: clamp(lch.L, 0.58, 0.88), C: lch.C, h: lch.h });

  const at = toOKLCH(accentTuned);

  return {
    primary,
    accent: accentTuned,
    secondary: fromOKLCH({ L: 0.82, C: Math.min(0.02, at.C * 0.15), h: at.h }),
    hero: fromOKLCH({ L: clamp(at.L + 0.05, 0.5, 0.93), C: at.C * (mood === 'luxury' ? 1.0 : 1.08), h: at.h }),
    neutral: fromOKLCH({ L: 0.16, C: Math.min(0.015, at.C * 0.1), h: at.h }),
  };
}

/**
 * Harmonic partners for an accent — offered in the UI as suggestions, never
 * applied automatically.
 * @param {RGBA|string} accentInput
 * @returns {{complement:RGBA, analogousWarm:RGBA, analogousCool:RGBA, split:RGBA}}
 */
export function harmonies(accentInput) {
  const lch = toOKLCH(parseColour(accentInput));
  const at = (dh) => fromOKLCH({ ...lch, h: (lch.h + dh + 360) % 360 });
  return { complement: at(180), analogousWarm: at(-28), analogousCool: at(28), split: at(150) };
}

/* ------------------------------------------------------------------ *
 * Capture from video
 * ------------------------------------------------------------------ */

/**
 * Reduce a sampled region of a frame to the one colour a designer would
 * actually pull from it.
 *
 * Plain averaging turns a teal shirt against a grey wall into grey mud, so
 * this bins pixels in OKLab, drops near-greys and near-blacks, and returns
 * the most *chromatic* populated bin — which is what "capture the colour of
 * their shirt" means in practice. Falls back to the brightest bin when the
 * region genuinely has no colour in it.
 *
 * @param {Uint8Array|Uint8ClampedArray|number[]} rgba  Flat RGBA8 pixels.
 * @param {{minChroma?: number, sampleStep?: number}} [opts]
 * @returns {{colour: RGBA, chromatic: boolean, sampled: number}}
 */
export function captureColour(rgba, opts = {}) {
  const minChroma = opts.minChroma ?? 0.035;
  const step = Math.max(1, opts.sampleStep ?? 1) * 4;
  /** @type {Map<string, {L:number,a:number,b:number,n:number}>} */
  const bins = new Map();
  let sampled = 0;

  for (let i = 0; i + 3 < rgba.length; i += step) {
    const alpha = rgba[i + 3] / 255;
    if (alpha < 0.5) continue;
    const c = { r: rgba[i] / 255, g: rgba[i + 1] / 255, b: rgba[i + 2] / 255, a: 1 };
    const lab = toOKLab(c);
    if (lab.L < 0.08 || lab.L > 0.97) continue; // crushed blacks and blown highlights carry no hue
    sampled++;
    const key = `${Math.round(lab.L * 12)}:${Math.round(lab.a * 40)}:${Math.round(lab.b * 40)}`;
    const bin = bins.get(key);
    if (bin) { bin.L += lab.L; bin.a += lab.a; bin.b += lab.b; bin.n++; }
    else bins.set(key, { L: lab.L, a: lab.a, b: lab.b, n: 1 });
  }

  if (!sampled || bins.size === 0) return { colour: { r: 1, g: 1, b: 1, a: 1 }, chromatic: false, sampled };

  /** @type {{score:number, lab:{L:number,a:number,b:number}, chroma:number}|null} */
  let best = null;
  for (const bin of bins.values()) {
    const lab = { L: bin.L / bin.n, a: bin.a / bin.n, b: bin.b / bin.n };
    const chroma = Math.hypot(lab.a, lab.b);
    const weight = bin.n / sampled;
    // Population matters, but a small strongly-coloured area beats a large flat one.
    const score = weight * (0.25 + Math.min(chroma, 0.22) * 6);
    if (!best || score > best.score) best = { score, lab, chroma };
  }

  if (!best) return { colour: { r: 1, g: 1, b: 1, a: 1 }, chromatic: false, sampled };
  return { colour: fromOKLab(best.lab), chromatic: best.chroma >= minChroma, sampled };
}

/** @param {RGBA} a @param {RGBA} b @param {number} t @returns {RGBA} */
export function mix(a, b, t) {
  const la = toOKLab(a), lb = toOKLab(b);
  return fromOKLab(
    { L: la.L + (lb.L - la.L) * t, a: la.a + (lb.a - la.a) * t, b: la.b + (lb.b - la.b) * t },
    a.a + (b.a - a.a) * t,
  );
}
