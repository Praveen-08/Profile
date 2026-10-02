/**
 * The composer — transcript in, fully designed CaptionPlan out.
 *
 * This is the only place the engines are wired together, and it is
 * deliberately linear and side-effect free: the same inputs always produce
 * the same plan, which is what makes "re-generate" safe for an editor who has
 * already made manual overrides.
 *
 * Order matters and is not arbitrary:
 *   normalise -> score -> phrase -> assign levels -> type -> colour
 *   -> position -> motion -> composite
 *
 * Scoring runs before phrasing because good phrase breaks depend on knowing
 * which words are important; level *assignment* runs after phrasing because
 * hero budgets are per-phrase.
 *
 * @typedef {import('../core/types.js').Transcript} Transcript
 * @typedef {import('../core/types.js').CaptionPlan} CaptionPlan
 * @typedef {import('../core/types.js').PlacedWord} PlacedWord
 * @typedef {import('../core/types.js').PlacedPhrase} PlacedPhrase
 * @typedef {import('../core/types.js').Frame} Frame
 * @typedef {import('../core/types.js').ShotAnalysis} ShotAnalysis
 * @typedef {import('../core/types.js').OverrideMap} OverrideMap
 * @typedef {import('../core/types.js').Level} Level
 * @typedef {import('../core/types.js').Zone} Zone
 * @typedef {import('../templates/schema.js').Template} Template
 */

import { normalize } from '../transcript/normalize.js';
import { scoreWords, assignLevels } from './emphasis.js';
import { groupPhrases } from './phrasing.js';
import { resolveTypography, capHeightOf, applyCasing } from './typography.js';
import { layoutBlock, avoidFace, chooseZone, liveArea } from './layout.js';
import { buildMotion } from './motion.js';
import { resolveInteraction, adaptColourForBlend, assignLanes, INTERACTIONS } from './composite.js';
import { parseColour, generatePalette, ensureContrast, toHex } from '../core/colour.js';
import { validateTemplate } from '../templates/schema.js';
import { snapToFrame, atLeastOneFrame } from '../core/time.js';

/**
 * @typedef {object} ComposeOptions
 * @property {Transcript} transcript
 * @property {Template} template
 * @property {Frame} frame
 * @property {ShotAnalysis[]} [shots]        Optional per-shot picture analysis.
 * @property {OverrideMap} [overrides]
 * @property {string} [accent]               Overrides the template accent for this render only.
 * @property {boolean} [generatePaletteFromAccent]
 * @property {Set<string>|null} [installedFonts]
 * @property {Record<string,string>} [corrections]
 * @property {RenderCapabilities} [capabilities]  What the destination can actually render.
 */

/**
 * What the chosen export target supports.
 *
 * The preview is only useful if it is honest. Final Cut's stock title can
 * animate position, scale, opacity and blend mode, but it cannot animate
 * blur without an additional effect — so by default the composer does not
 * put blur in the plan at all, rather than showing the editor a blur-to-sharp
 * entrance that their timeline will not reproduce. The PK Motion title
 * profile turns it back on.
 *
 * @typedef {object} RenderCapabilities
 * @property {boolean} [blur]
 * @property {boolean} [perCharacter]
 * @property {boolean} [maskReveal]
 */

/**
 * @param {ComposeOptions} opts
 * @returns {CaptionPlan}
 */
export function compose(opts) {
  const { template, frame } = opts;
  const overrides = opts.overrides ?? {};
  /** @type {{blur: boolean, perCharacter: boolean, maskReveal: boolean}} */
  const caps = Object.assign({ blur: false, perCharacter: false, maskReveal: false }, opts.capabilities);
  /** @type {string[]} */
  const warnings = [];

  const check = validateTemplate(template);
  if (!check.ok) throw new Error(`Template "${template.name}" is invalid:\n  - ${check.errors.join('\n  - ')}`);
  warnings.push(...check.warnings);

  /* 1 — normalise ------------------------------------------------- */
  const { transcript, changes } = normalize(opts.transcript, {
    realEstate: template.realEstate.enabled,
    collapse: template.realEstate.enabled && template.realEstate.collapse,
    priceFormat: template.realEstate.priceFormat,
    corrections: opts.corrections,
  });
  if (changes.length) warnings.push(`${changes.length} text normalisation${changes.length === 1 ? '' : 's'} applied.`);

  // Editor text overrides land after normalisation so they always win.
  let words = transcript.words.map((w) => {
    const o = overrides[w.id];
    if (!o) return w;
    return {
      ...w,
      text: o.text ?? w.text,
      start: o.start ?? w.start,
      end: o.end ?? w.end,
    };
  }).filter((w) => !overrides[w.id]?.hidden);

  if (!words.length) {
    return emptyPlan(template, frame, ['Transcript contains no words.']);
  }
  words = [...words].sort((a, b) => a.start - b.start);

  /* 2 — score ------------------------------------------------------ */
  const scores = scoreWords(words, template);

  /* 3 — phrase ----------------------------------------------------- */
  // The editor's own caption breaks: start a new caption at a word, or keep
  // it with the caption before.
  const breaks = new Map(words.map((w, i) => [i, overrides[w.id]?.breakBefore]).filter(([, b]) => b === 'caption' || b === 'join'));
  const phrases = groupPhrases(words, template, { scores, breaks });

  /* 4 — levels ----------------------------------------------------- */
  const levels = assignLevels(phrases, scores, template, overrides);

  /* 5 — type ------------------------------------------------------- */
  const type = resolveTypography(template, frame, opts.installedFonts ?? null);
  warnings.push(...type.warnings);

  /* 6 — colour ----------------------------------------------------- */
  const palette = resolvePalette(template, opts);

  // A colour pattern cycles a list of colours in reading order — over the
  // highlighted words, over every word, or phrase by phrase. Counted, never
  // random, so the same transcript always gets the same colours.
  const pattern = (template.colours.pattern ?? []).map((c) => parseColour(c));
  const scope = template.colours.patternScope ?? 'highlights';
  let patternIndex = 0;
  /** @param {Level} level @param {number} phraseIndex */
  const patternColour = (level, phraseIndex) => {
    if (!pattern.length) return null;
    if (scope === 'phrases') return pattern[phraseIndex % pattern.length];
    if (scope === 'highlights' && level === 'normal') return null;
    return pattern[patternIndex++ % pattern.length];
  };

  /* 7..9 — place, animate, composite ------------------------------- */
  /** @type {PlacedPhrase[]} */
  const placed = [];
  /** @type {{zone: Zone, since: number, runLength: number}|null} */
  let held = null;

  for (let pi = 0; pi < phrases.length; pi++) {
    const phrase = phrases[pi];
    const nextPhrase = phrases[pi + 1];
    const shot = shotAt(opts.shots, phrase.start, phrase.end);
    const phraseLevels = phrase.words.map((w) => levels.get(w.id)?.level ?? 'normal');
    const hasHero = phraseLevels.includes('hero');

    const decision = chooseZone(phrase, template, frame, shot, held, hasHero);
    const manualZone = phrase.words.map((w) => overrides[w.id]?.position).find(Boolean);
    const zone = decision.zone;
    held = (held && held.zone === zone)
      ? { zone, since: held.since, runLength: held.runLength + 1 }
      : { zone, since: phrase.start, runLength: 1 };

    // Each word's style, resolved once, in reading order (the colour pattern
    // counts as it goes): its level, then its group, then the pattern and the
    // hook if it belongs to them, then the word's own settings.
    const inHook = Boolean(template.hook?.enabled) && phrase.start < (template.hook?.seconds ?? 3);
    const styles = phrase.words.map((w, i) => {
      const level = /** @type {Level} */ (phraseLevels[i]);
      const o = overrides[w.id] ?? {};
      const g = template.groups ?? {};
      const base = (level === 'normal' ? g.normal : g.highlight) ?? {};
      const pattern = o.colour ? null : patternColour(level, pi);
      const layers = [base, pattern ? g.pattern ?? {} : {}, inHook ? g.hook ?? {} : {}, o];
      /** @type {import('../core/types.js').WordOverride} */
      const e = Object.assign({}, ...layers);
      e.tune = Object.assign({}, template.motion.tune?.[level] ?? {}, ...(pattern ? [template.motion.tune?.pattern ?? {}] : []), ...layers.map((l) => l.tune ?? {}));
      // Colour: the word's, the hook's, the pattern's, then its group's.
      const colourSource = o.colour ?? (inHook ? g.hook?.colour : undefined) ?? (pattern ? null : base.colour);
      // A word's own size is applied around the word, after layout: resizing
      // one word must not reflow the others. Group sizes still lay out.
      const layoutScale = Object.assign({}, ...layers.slice(0, -1)).scale ?? 1;
      const ownScale = (e.scale ?? 1) / layoutScale;
      return { level, o, e, pattern, inHook, colourSource, layoutScale, ownScale };
    });

    // Build layout items, applying per-word scale and font overrides.
    const items = phrase.words.map((w, i) => {
      const { level, e, layoutScale } = styles[i];
      /** @type {import('../core/types.js').FontSpec} */
      const font = {
        ...type.fonts[level],
        ...(e.fontFamily ? { family: e.fontFamily } : {}),
        ...(e.fontWeight ? { weight: e.fontWeight } : {}),
        ...(e.italic !== undefined ? { italic: e.italic } : {}),
        ...(e.casing ? { casing: e.casing } : {}),
        // The exact installed face, when the editor picked one; a family change
        // without a face falls back to the weight-derived name.
        ...(e.fontFace ? { face: e.fontFace } : {}),
      };
      return { id: w.id, text: w.text, level, font, size: type.sizes[level] * layoutScale, lineBreak: i > 0 && overrides[w.id]?.breakBefore === 'line' };
    });

    const raw = layoutBlock(items, zone, template, frame);
    const adjusted = template.position.faceAvoidance && !(hasHero && template.position.heroMayOverlap)
      ? avoidFace(raw, shot?.face, template, frame)
      : { ...raw, nudged: false };
    if (adjusted.nudged) warnings.push(`Phrase ${phrase.index + 1}: nudged clear of the face.`);

    const byId = new Map(adjusted.words.map((w) => [w.id, w]));

    /** @type {PlacedWord[]} */
    const placedWords = [];

    // Hold the phrase after its last word, but never let two phrases sit on
    // screen together long enough to read as clutter. Sharing a zone with the
    // next phrase means type would land on type, so the overlap there is
    // trimmed to a short crossfade.
    const nextZone = nextPhrase
      ? chooseZone(nextPhrase, template, frame, shotAt(opts.shots, nextPhrase.start, nextPhrase.end), held,
          nextPhrase.words.some((w) => levels.get(w.id)?.level === 'hero')).zone
      : null;
    const maxOverlap = nextZone === zone ? 0.10 : 0.26;
    const ceiling = nextPhrase ? nextPhrase.start + maxOverlap : Infinity;
    const phraseEnd = Math.min(phrase.end + template.motion.hold, Math.max(phrase.end + 0.02, ceiling));

    // When each word appears. Word by word it is when it is said; a word set
    // to appear with the one before takes that word's moment (so a run of
    // them lands together), and a whole-phrase reveal starts every word at once.
    /** @type {number[]} */
    const appears = [];
    phrase.words.forEach((w, i) => {
      const together = i > 0 && (styles[i].o.withPrevious ?? styles[i].e.withPrevious);
      appears.push(template.motion.reveal === 'phrase' ? phrase.start : together ? appears[i - 1] : w.start);
    });

    for (let i = 0; i < phrase.words.length; i++) {
      const w = phrase.words[i];
      const { level, o, e, pattern: fromPattern, colourSource, ownScale } = styles[i];
      const laidOut = byId.get(w.id);
      if (!laidOut) continue;
      // The word's own size, grown or shrunk about its centre — never wider
      // than the style lets a line be.
      const k = Math.min(ownScale, Math.min(template.hierarchy.maxWidth, liveArea(frame, template).w) / Math.max(laidOut.box.w, 1e-6));
      const laid = k === 1 ? laidOut : {
        ...laidOut, size: laidOut.size * k,
        box: { ...laidOut.box, w: laidOut.box.w * k, h: laidOut.box.h * k },
      };

      const item = items[i];
      const start = snapToFrame(appears[i], frame.fps);
      const end = snapToFrame(phraseEnd, frame.fps);
      const life = atLeastOneFrame(Math.max(end - start, 2 / frame.fps), frame.fps);

      const resolved = resolveInteraction(level, template, { depthOverride: e.depth });
      // A word can carry its own look — one word in Difference in a clean line.
      const interaction = e.look && INTERACTIONS[e.look] ? { ...resolved, blend: INTERACTIONS[e.look].blend } : resolved;
      let colour = colourSource ? parseColour(colourSource) : (fromPattern ?? palette[level]);
      // A colour the editor picked is theirs; the blend guard only adjusts
      // colours the engine chose.
      if (!colourSource && !fromPattern) {
        const adapted = adaptColourForBlend(colour, interaction.blend);
        if (adapted.note && !warnings.includes(adapted.note)) warnings.push(adapted.note);
        colour = adapted.colour;
      }

      const capFraction = capHeightOf(item.font, laid.size) / frame.height;

      placedWords.push({
        id: w.id,
        text: displayText(w.text, level, item.font, template),
        level, start, end: start + life,
        font: item.font,
        size: laid.size,
        colour,
        decoration: resolveDecoration(template, colour, laid.size, type.sizes.normal, e),
        position: o.position ?? laid.position,
        box: o.position ? { ...laid.box, x: o.position.x, y: o.position.y } : laid.box,
        // Where the word sat before its own resize: what placing the phrase as
        // a whole goes by, so one bigger word does not move the rest.
        layoutBox: laidOut.box,
        motion: withOpacity(buildMotion({
          level, template, life, capFraction, capabilities: caps,
          inOverride: e.inAnimation ?? (fromPattern ? template.motion.patternIn : undefined),
          outOverride: e.outAnimation ?? (fromPattern ? template.motion.patternOut : undefined),
          tune: e.tune,
          letters: [...w.text].length,
        }), e.opacity),
        depth: interaction.depth,
        blend: interaction.blend,
        // Active word: its own colour while it is being said, then the usual one.
        ...(e.activeColour ? { active: { colour: parseColour(e.activeColour), until: Math.max(0, snapToFrame(w.end, frame.fps) - start) } } : {}),
        lane: 0,
        overridden: Object.keys(o).length > 0,
      });
    }

    spanLineGradients(placedWords, styles.map((s) => s.e), phrase.words.map((w) => w.id));

    const lanes = assignLanes(placedWords.map((w) => ({ id: w.id, level: w.level, size: w.size, depth: w.depth })));
    for (const w of placedWords) w.lane = lanes.get(w.id) ?? 1;

    if (manualZone) warnings.push(`Phrase ${phrase.index + 1}: contains a manual position override.`);

    placed.push({
      id: phrase.id, index: phrase.index, zone,
      start: Math.min(...placedWords.map((w) => w.start)),
      end: Math.max(...placedWords.map((w) => w.end)),
      words: placedWords,
      breakReason: phrase.breakReason,
    });
  }

  return {
    templateId: template.id,
    templateName: template.name,
    frame,
    phrases: placed,
    stats: computeStats(placed),
    warnings: [...new Set(warnings)],
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * A promoted word is a graphic, and a graphic does not carry a full stop.
 * Commas and stops are dropped from emphasis and hero words; question and
 * exclamation marks are kept because they carry tone the type cannot.
 *
 * @param {string} text @param {Level} level
 * @param {import('../core/types.js').FontSpec} font @param {Template} template
 * @returns {string}
 */
function displayText(text, level, font, template) {
  let t = text;
  if (level !== 'normal' && template.hierarchy.stripTerminalPunctuation) {
    t = t.replace(/[.,;:]+$/, '');
  }
  return applyCasing(t, font.casing);
}

/** @param {Template} template @param {ComposeOptions} opts */
function resolvePalette(template, opts) {
  const base = {
    normal: parseColour(template.colours.primary),
    emphasis: parseColour(template.colours.accent),
    hero: parseColour(template.colours.hero),
  };
  if (!opts.accent) return base;

  const accent = parseColour(opts.accent);
  if (opts.generatePaletteFromAccent) {
    const generated = generatePalette(accent, { mood: template.mood });
    return { normal: generated.primary, emphasis: generated.accent, hero: generated.hero };
  }
  // Swap only the accent-derived roles; the primary is the style's own.
  return { normal: base.normal, emphasis: accent, hero: accent };
}

/**
 * @param {Template} t
 * @param {import('../core/types.js').RGBA} colour
 * @param {number} size
 * @param {number} baseSize
 * @param {import('../core/types.js').WordOverride} [e]  The word's own gradient, glow and shine.
 * @returns {import('../core/types.js').Decoration}
 */
function resolveDecoration(t, colour, size, baseSize, e = {}) {
  const d = t.decoration;
  // Decoration is specified at the normal word's size and scales with the
  // word, otherwise a hero word gets a shadow that reads as a hairline.
  const k = baseSize > 0 ? size / baseSize : 1;
  const ref = (v) => (v === 'text' ? colour : parseColour(v));
  return {
    outline: { enabled: d.outline.enabled, width: d.outline.width * k, colour: ref(d.outline.colour) },
    shadow: {
      enabled: d.shadow.enabled, opacity: d.shadow.opacity, blur: d.shadow.blur * k,
      distance: d.shadow.distance * k, angle: d.shadow.angle, colour: parseColour(d.shadow.colour),
    },
    glow: {
      enabled: e.glow?.enabled ?? d.glow.enabled,
      intensity: e.glow?.intensity ?? d.glow.intensity,
      radius: (e.glow?.radius ?? d.glow.radius) * k,
      colour: ref(e.glow?.colour ?? d.glow.colour),
    },
    gradient: e.gradient?.enabled
      ? { enabled: true, from: parseColour(e.gradient.from), to: parseColour(e.gradient.to), angle: e.gradient.angle ?? 0 }
      : { enabled: false, from: colour, to: colour, angle: 0 },
    shine: !!e.shine,
  };
}

/**
 * A gradient set to run across the whole line is cut into one slice per word:
 * each word takes the part of the line's gradient that lies under it, so the
 * line reads as one sweep of colour (red on the first word, blue on the last).
 * @param {PlacedWord[]} words
 * @param {import('../core/types.js').WordOverride[]} effective  Each word's resolved style, by phrase order.
 * @param {string[]} order  The phrase's word ids, matching `effective`.
 */
function spanLineGradients(words, effective, order) {
  const lineOf = (w) => Math.round(w.position.y * 400);
  const spec = new Map(order.map((id, i) => [id, effective[i]?.gradient]));
  /** @type {Map<number, PlacedWord[]>} */
  const lines = new Map();
  for (const w of words) {
    const g = spec.get(w.id);
    if (!g?.enabled || g.span !== 'line') continue;
    const key = lineOf(w);
    lines.set(key, [...(lines.get(key) ?? []), w]);
  }
  const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 });
  for (const line of lines.values()) {
    const left = Math.min(...line.map((w) => w.position.x - w.box.w / 2));
    const right = Math.max(...line.map((w) => w.position.x + w.box.w / 2));
    const span = Math.max(1e-6, right - left);
    for (const w of line) {
      const g = /** @type {any} */ (spec.get(w.id));
      const from = parseColour(g.from), to = parseColour(g.to);
      const t0 = (w.position.x - w.box.w / 2 - left) / span;
      const t1 = (w.position.x + w.box.w / 2 - left) / span;
      w.decoration.gradient = { enabled: true, from: mix(from, to, t0), to: mix(from, to, t1), angle: 0 };
    }
  }
}

/** @param {ShotAnalysis[]|undefined} shots @param {number} start @param {number} end */
function shotAt(shots, start, end) {
  if (!shots?.length) return null;
  const mid = (start + end) / 2;
  return shots.find((s) => mid >= s.start && mid < s.end)
    ?? shots.find((s) => start < s.end && s.start < end)
    ?? null;
}

/** @param {PlacedPhrase[]} phrases */
function computeStats(phrases) {
  const words = phrases.flatMap((p) => p.words);
  /** @type {Record<Level, number>} */
  const byLevel = { normal: 0, emphasis: 0, hero: 0 };
  for (const w of words) byLevel[w.level]++;
  const duration = words.length ? Math.max(...words.map((w) => w.end)) - Math.min(...words.map((w) => w.start)) : 0;
  return {
    words: words.length, phrases: phrases.length, byLevel,
    emphasisRatio: words.length ? (byLevel.emphasis + byLevel.hero) / words.length : 0,
    duration,
  };
}

/** @param {Template} t @param {Frame} f @param {string[]} warnings @returns {CaptionPlan} */
function emptyPlan(t, f, warnings) {
  return {
    templateId: t.id, templateName: t.name, frame: f, phrases: [],
    stats: { words: 0, phrases: 0, byLevel: { normal: 0, emphasis: 0, hero: 0 }, emphasisRatio: 0, duration: 0 },
    warnings,
  };
}

/**
 * A compact, human-readable dump of a plan — what the CLI prints and what the
 * word editor lists.
 * @param {CaptionPlan} plan @returns {string}
 */
export function describePlan(plan) {
  const lines = [
    `${plan.templateName}  ·  ${plan.frame.width}x${plan.frame.height} ${plan.frame.aspect} @ ${plan.frame.fps}fps`,
    `${plan.stats.words} words  ·  ${plan.stats.phrases} phrases  ·  ` +
    `${plan.stats.byLevel.normal} normal / ${plan.stats.byLevel.emphasis} emphasis / ${plan.stats.byLevel.hero} hero  ` +
    `(${Math.round(plan.stats.emphasisRatio * 100)}% promoted)`,
    '',
  ];
  for (const p of plan.phrases) {
    lines.push(`  ${String(p.index + 1).padStart(3)}. [${p.zone}] ${p.start.toFixed(2)}–${p.end.toFixed(2)}s`);
    lines.push(`       ${p.words.map((w) => (w.level === 'hero' ? `«${w.text}»` : w.level === 'emphasis' ? `*${w.text}*` : w.text)).join(' ')}`);
  }
  if (plan.warnings.length) {
    lines.push('', '  Notes:');
    for (const w of plan.warnings) lines.push(`    · ${w}`);
  }
  return lines.join('\n');
}

/**
 * Scale a word's whole opacity curve, so a word set to 60% still fades in and
 * out — to 60% rather than to full.
 * @param {import('../core/types.js').WordMotion} motion @param {number|undefined} opacity
 */
function withOpacity(motion, opacity) {
  if (opacity === undefined || opacity >= 1) return motion;
  const k = Math.max(0, opacity);
  const curve = motion.opacity.length ? motion.opacity : [{ t: 0, v: 1 }];
  return { ...motion, opacity: curve.map((f) => ({ ...f, v: f.v * k })) };
}
