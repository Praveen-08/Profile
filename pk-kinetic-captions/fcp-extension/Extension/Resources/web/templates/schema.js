/**
 * Template schema — the design DNA.
 *
 * A template is the complete description of how a transcript becomes
 * typography. Every engine in src/engine reads from this and nothing else, so
 * a new style pack is a data file, not code. That is the whole point of the
 * architecture: PK Luxury Pack, PK Agent Pack and so on should never require
 * touching the engine.
 *
 * Templates are versioned and migrated on load, so a template saved today
 * still opens after the engine gains new fields.
 */

export const TEMPLATE_VERSION = 1;

/** @typedef {import('../core/types.js').FontSpec} FontSpec */
/** @typedef {import('../core/types.js').Level} Level */

/**
 * @typedef {object} Template
 * @property {string} id
 * @property {string} name
 * @property {number} version
 * @property {"builtin"|"user"} kind
 * @property {string} [basedOn]
 * @property {string} [description]
 * @property {"neutral"|"luxury"|"social"} mood
 * @property {Record<Level, FontSpec>} fonts
 * @property {{primary:string, accent:string, secondary:string, hero:string, neutral:string, pattern?:string[], patternScope?:"highlights"|"all"|"phrases"}} colours
 *   `pattern`: colours cycled in order — over highlighted words, every word, or
 *   whole phrases (`patternScope`). Empty means no pattern.
 * @property {{base:number, normal:number, emphasis:number, hero:number, minPt:number, maxPt:number}} scale  `base` is a normal word's cap height as a fraction of the frame's SHORT edge.
 * @property {{wordGap:number, lineGap:number, blockPadding:number}} spacing
 * @property {PositionConfig} position
 * @property {HierarchyConfig} hierarchy
 * @property {MotionConfig} motion
 * @property {InteractionConfig} interaction
 * @property {DecorationConfig} decoration
 * @property {RealEstateConfig} realEstate
 * @property {{author?:string, created?:string, updated?:string, notes?:string}} meta
 */

/**
 * @typedef {object} PositionConfig
 * @property {"static"|"dynamic"|"subjectAware"|"manual"} mode
 * @property {import('../core/types.js').Zone[]} zones     Zones this style is allowed to use, in preference order.
 * @property {import('../core/types.js').Zone} home        Where a static composition sits.
 * @property {boolean} safeArea
 * @property {number} margin            Fraction of the short edge kept clear.
 * @property {boolean} faceAvoidance
 * @property {boolean} heroMayOverlap   Hero type is allowed to cross the subject.
 * @property {number} zoneHold          Minimum seconds a zone is held before the engine may move.
 * @property {"left"|"center"|"right"} align
 */

/**
 * @typedef {object} HierarchyConfig
 * @property {"low"|"medium"|"high"} captionDensity
 * @property {"subtle"|"balanced"|"strong"} emphasisDensity
 * @property {boolean} autoEmphasis
 * @property {number} maxWordsPerPhrase
 * @property {number} maxLines
 * @property {number} maxHeroPerPhrase
 * @property {number} heroCooldown      Minimum seconds between hero words.
 * @property {number} maxWidth          Fraction of frame width type may occupy.
 * @property {boolean} stripTerminalPunctuation  Drop the full stop from promoted words.
 */

/**
 * @typedef {object} MotionConfig
 * @property {import('../core/types.js').AnimationStyle} style
 * @property {Record<Level, import('../core/types.js').InAnimation>} in
 * @property {Record<Level, import('../core/types.js').OutAnimation>} out
 * @property {boolean} perCharacterHero
 * @property {number} stagger           Seconds between successive words when they share a timestamp.
 * @property {number} speed             Multiplier on all durations.
 * @property {"spoken"|"phrase"} reveal Word-by-word as spoken, or the whole phrase at once.
 * @property {import('../core/types.js').InAnimation} [patternIn]   Entrance for words coloured by the colour pattern.
 * @property {import('../core/types.js').OutAnimation} [patternOut] Exit for words coloured by the colour pattern.
 * @property {Partial<Record<Level|"pattern", import('../engine/motion.js').MotionTune>>} [tune]  The editor's adjustments per group.
 * @property {number} hold              Seconds the phrase stays up after its last word ends.
 */

/**
 * @typedef {object} InteractionConfig
 * @property {import('../core/types.js').Interaction} preset
 * @property {import('../core/types.js').BlendMode} [blendOverride]
 * @property {import('../core/types.js').Interaction} [emphasisPreset]  Look for emphasis words, when it differs from the main text's.
 * @property {import('../core/types.js').Interaction} [heroPreset]
 * @property {boolean} heroBehindSubject
 */

/**
 * @typedef {object} DecorationConfig
 * @property {{enabled:boolean, width:number, colour:string|"text"}} outline
 * @property {{enabled:boolean, opacity:number, blur:number, distance:number, angle:number, colour:string}} shadow
 * @property {{enabled:boolean, intensity:number, radius:number, colour:string|"text"}} glow
 */

/**
 * @typedef {object} RealEstateConfig
 * @property {boolean} enabled
 * @property {boolean} collapse
 * @property {"full"|"short"} priceFormat
 * @property {number} conceptBoost      How hard concept matches push toward emphasis.
 */

/** @type {FontSpec} */
const BASE_FONT = {
  family: 'Helvetica Neue', weight: 'regular', italic: false,
  width: 'normal', casing: 'none', tracking: 0, lineHeight: 1.05,
};

/**
 * The complete default template. Every built-in style is a shallow set of
 * deviations from this, which is what keeps them consistent with each other.
 * @returns {Template}
 */
export function defaultTemplate() {
  return {
    id: 'pk-default', name: 'PK Default', version: TEMPLATE_VERSION, kind: 'builtin',
    description: 'Engine defaults.', mood: 'neutral',
    fonts: {
      normal: { ...BASE_FONT, weight: 'regular' },
      emphasis: { ...BASE_FONT, weight: 'bold', casing: 'upper', tracking: -10 },
      hero: { ...BASE_FONT, weight: 'black', casing: 'upper', tracking: -25 },
    },
    colours: { primary: '#f0ede8', accent: '#14b8a6', secondary: '#c9c6c1', hero: '#14b8a6', neutral: '#070707' },
    scale: { base: 0.048, normal: 1.0, emphasis: 1.4, hero: 2.2, minPt: 18, maxPt: 520 },
    spacing: { wordGap: 0.28, lineGap: 0.12, blockPadding: 0.02 },
    position: {
      mode: 'dynamic', zones: ['center', 'lowerLeft', 'lowerRight', 'upperLeft', 'upperRight'],
      home: 'center', safeArea: true, margin: 0.06, faceAvoidance: true,
      heroMayOverlap: true, zoneHold: 1.6, align: 'left',
    },
    hierarchy: {
      captionDensity: 'medium', emphasisDensity: 'balanced', autoEmphasis: true,
      maxWordsPerPhrase: 5, maxLines: 3, maxHeroPerPhrase: 1, heroCooldown: 2.4, maxWidth: 0.86, stripTerminalPunctuation: true,
    },
    motion: {
      style: 'smooth',
      in: { normal: 'fade', emphasis: 'rise', hero: 'scale' },
      out: { normal: 'fade', emphasis: 'fade', hero: 'scale' },
      perCharacterHero: false, stagger: 0.05, speed: 1, reveal: 'spoken', hold: 0.22,
    },
    interaction: { preset: 'clean', heroPreset: undefined, heroBehindSubject: false },
    decoration: {
      outline: { enabled: false, width: 2, colour: 'text' },
      shadow: { enabled: true, opacity: 0.35, blur: 12, distance: 4, angle: 315, colour: '#000000' },
      glow: { enabled: false, intensity: 0.3, radius: 18, colour: 'text' },
    },
    realEstate: { enabled: false, collapse: false, priceFormat: 'short', conceptBoost: 0.9 },
    meta: {},
  };
}

/* ------------------------------------------------------------------ *
 * Merge, validate, migrate
 * ------------------------------------------------------------------ */

/**
 * Deep-merge a partial over a base. Arrays replace rather than concatenate —
 * a style that declares two zones means exactly two zones.
 * @template T
 * @param {T} base @param {any} patch @returns {T}
 */
export function merge(base, patch) {
  if (patch === undefined || patch === null) return base;
  if (Array.isArray(patch) || typeof patch !== 'object') return patch;
  /** @type {any} */
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = k in out && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])
      ? merge(out[k], v) : (Array.isArray(v) ? [...v] : v);
  }
  return out;
}

/**
 * @param {Partial<Template> & {id:string, name:string}} patch
 * @returns {Template}
 */
export function defineTemplate(patch) {
  return merge(defaultTemplate(), patch);
}

const ENUMS = {
  mood: ['neutral', 'luxury', 'social'],
  'position.mode': ['static', 'dynamic', 'subjectAware', 'manual'],
  'hierarchy.captionDensity': ['low', 'medium', 'high'],
  'hierarchy.emphasisDensity': ['subtle', 'balanced', 'strong'],
  'motion.style': ['minimal', 'smooth', 'editorial', 'cinematic', 'luxury', 'punchy', 'energetic'],
  'interaction.preset': ['clean', 'invert', 'cinematic', 'ghost', 'editorial', 'knockout', 'luminous', 'ink'],
  'interaction.emphasisPreset': ['clean', 'invert', 'cinematic', 'ghost', 'editorial', 'knockout', 'luminous', 'ink'],
  'interaction.heroPreset': ['clean', 'invert', 'cinematic', 'ghost', 'editorial', 'knockout', 'luminous', 'ink'],
  'colours.patternScope': ['highlights', 'all', 'phrases'],
};

/**
 * @param {any} t
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}
 */
export function validateTemplate(t) {
  /** @type {string[]} */ const errors = [];
  /** @type {string[]} */ const warnings = [];
  const at = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), t);

  if (!t || typeof t !== 'object') return { ok: false, errors: ['Template is not an object.'], warnings };
  if (!t.id || typeof t.id !== 'string') errors.push('Missing id.');
  if (!t.name || typeof t.name !== 'string') errors.push('Missing name.');

  for (const [path, allowed] of Object.entries(ENUMS)) {
    const v = at(path);
    if (v !== undefined && !allowed.includes(v)) errors.push(`${path}: "${v}" is not one of ${allowed.join(', ')}.`);
  }

  for (const level of ['normal', 'emphasis', 'hero']) {
    const f = at(`fonts.${level}`);
    if (!f || !f.family) errors.push(`fonts.${level}.family is required.`);
  }
  for (const role of ['primary', 'accent', 'secondary', 'hero', 'neutral']) {
    const c = at(`colours.${role}`);
    if (typeof c !== 'string' || !/^#?[0-9a-fA-F]{3,8}$/.test(c)) errors.push(`colours.${role}: "${c}" is not a hex colour.`);
  }
  const pattern = at('colours.pattern');
  if (pattern !== undefined) {
    if (!Array.isArray(pattern)) errors.push('colours.pattern must be a list of hex colours.');
    else for (const c of pattern) {
      if (typeof c !== 'string' || !/^#?[0-9a-fA-F]{3,8}$/.test(c)) errors.push(`colours.pattern: "${c}" is not a hex colour.`);
    }
  }

  const s = at('scale');
  if (s) {
    if (!(s.base > 0 && s.base < 0.4)) errors.push('scale.base must be between 0 and 0.4 of frame height.');
    if (s.hero <= s.emphasis) warnings.push('scale.hero is not larger than scale.emphasis — hierarchy will read weakly.');
    if (s.emphasis <= s.normal) warnings.push('scale.emphasis is not larger than scale.normal — hierarchy will read weakly.');
  }

  const zones = at('position.zones');
  if (Array.isArray(zones) && zones.length === 0) errors.push('position.zones must list at least one zone.');
  if (at('hierarchy.maxWordsPerPhrase') < 1) errors.push('hierarchy.maxWordsPerPhrase must be at least 1.');

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Bring an older stored template up to the current shape. Unknown future
 * versions are accepted with a warning rather than refused, so a template
 * exported from a newer build still loads in a degraded but usable form.
 * @param {any} raw
 * @returns {{template: Template, migrated: boolean, notes: string[]}}
 */
export function migrateTemplate(raw) {
  /** @type {string[]} */ const notes = [];
  let migrated = false;
  const v = Number(raw?.version ?? 0);
  if (v === 0) { notes.push('Template had no version; assumed v1 layout.'); migrated = true; }
  if (v > TEMPLATE_VERSION) notes.push(`Template is v${v}, this engine is v${TEMPLATE_VERSION}. Unknown fields were kept but ignored.`);
  const template = merge(defaultTemplate(), { ...raw, version: TEMPLATE_VERSION });
  return { template, migrated, notes };
}

/** A stable content fingerprint — used for thumbnail caching and change detection. */
export function fingerprint(template) {
  const { meta, ...rest } = template;
  return JSON.stringify(rest, Object.keys(rest).sort());
}
