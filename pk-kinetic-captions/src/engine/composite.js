/**
 * Text / video interaction.
 *
 * The brief asks for two things that pull in opposite directions: the editor
 * should pick a mood ("Invert", "Ghost"), and the result should be a real
 * compositing operation rather than a colour trick. So this module is a
 * mapping layer — creative preset in, genuine FCP blend mode and layer
 * arrangement out — plus the design guardrails each mode needs.
 *
 * The Difference look in particular is implemented as an actual blend on the
 * title clip (`<adjust-blend mode="difference">` in the exported FCPXML), not
 * by inverting the text colour, exactly as required.
 *
 * @typedef {import('../core/types.js').Interaction} Interaction
 * @typedef {import('../core/types.js').BlendMode} BlendMode
 * @typedef {import('../core/types.js').Depth} Depth
 * @typedef {import('../core/types.js').Level} Level
 * @typedef {import('../core/types.js').RGBA} RGBA
 * @typedef {import('../templates/schema.js').Template} Template
 */

import { contrastRatio, toOKLCH, fromOKLCH, parseColour } from '../core/colour.js';

/**
 * @typedef {object} InteractionSpec
 * @property {Interaction} preset
 * @property {string} label          What the editor sees.
 * @property {BlendMode} blend       The actual compositing mode.
 * @property {number} opacity        Layer opacity the look depends on.
 * @property {boolean} colourMatters False when the blend makes text colour largely irrelevant.
 * @property {boolean} needsHighContrast
 * @property {string} description
 */

/** @type {Record<Interaction, InteractionSpec>} */
export const INTERACTIONS = {
  clean: {
    preset: 'clean', label: 'Clean', blend: 'normal', opacity: 1,
    colourMatters: true, needsHighContrast: false,
    description: 'Type sits on top of the picture. The safe default.',
  },
  invert: {
    preset: 'invert', label: 'Invert', blend: 'difference', opacity: 1,
    colourMatters: false, needsHighContrast: false,
    description: 'Type inverts whatever is behind it. Reads on any footage, and changes as the shot changes.',
  },
  cinematic: {
    preset: 'cinematic', label: 'Cinematic', blend: 'overlay', opacity: 1,
    colourMatters: true, needsHighContrast: true,
    description: 'Type takes on the contrast of the shot. Rich on graded footage, weak on flat footage.',
  },
  ghost: {
    preset: 'ghost', label: 'Ghost', blend: 'screen', opacity: 0.72,
    colourMatters: true, needsHighContrast: false,
    description: 'Type glows out of the picture and disappears over highlights.',
  },
  editorial: {
    preset: 'editorial', label: 'Editorial', blend: 'softLight', opacity: 1,
    colourMatters: true, needsHighContrast: true,
    description: 'Type tints into the picture. Magazine-like, deliberately understated.',
  },
  knockout: {
    preset: 'knockout', label: 'Knockout', blend: 'stencilAlpha', opacity: 1,
    colourMatters: false, needsHighContrast: false,
    description: 'The picture shows through the letterforms and everything else is cut away.',
  },
  luminous: {
    preset: 'luminous', label: 'Luminous', blend: 'screen', opacity: 1,
    colourMatters: true, needsHighContrast: false,
    description: 'Type adds light to the picture. Strong over dark interiors and twilight.',
  },
  ink: {
    preset: 'ink', label: 'Ink', blend: 'multiply', opacity: 1,
    colourMatters: true, needsHighContrast: true,
    description: 'Type darkens the picture. Use dark type over bright walls, sky or sand.',
  },
};

/** Ordered for the UI — the four an editor reaches for first, then the rest. */
export const INTERACTION_ORDER = /** @type {Interaction[]} */ ([
  'clean', 'invert', 'cinematic', 'ghost', 'editorial', 'knockout', 'luminous', 'ink',
]);

/**
 * Resolve the interaction for one word.
 *
 * @param {Level} level
 * @param {Template} template
 * @param {{depthOverride?: Depth}} [opts]
 * @returns {{spec: InteractionSpec, blend: BlendMode, depth: Depth, opacity: number}}
 */
export function resolveInteraction(level, template, opts = {}) {
  const cfg = template.interaction;
  const preset = (level === 'hero' && cfg.heroPreset) ? cfg.heroPreset : cfg.preset;
  const spec = INTERACTIONS[preset] ?? INTERACTIONS.clean;
  const blend = cfg.blendOverride ?? spec.blend;

  const depth = opts.depthOverride
    ?? (level === 'hero' && cfg.heroBehindSubject ? 'background' : 'foreground');

  return { spec, blend, depth, opacity: spec.opacity };
}

/**
 * Some blends make the chosen colour irrelevant or actively wrong. Rather
 * than silently ignoring the palette, adapt the colour so the look still
 * reads, and say what was done.
 *
 * @param {RGBA} colour
 * @param {BlendMode} blend
 * @returns {{colour: RGBA, note?: string}}
 */
export function adaptColourForBlend(colour, blend) {
  switch (blend) {
    case 'difference':
      // Difference against mid-grey is nearly invisible. Pushing the colour
      // bright keeps the inversion strong across the whole tonal range.
      if (contrastRatio(colour, { r: 0.5, g: 0.5, b: 0.5, a: 1 }) < 1.8) {
        const lch = toOKLCH(colour);
        return { colour: fromOKLCH({ ...lch, L: Math.max(0.9, lch.L) }, colour.a), note: 'Brightened for Invert: mid-tone colours barely differ from the footage under them.' };
      }
      return { colour };
    case 'multiply': {
      // Multiply only darkens; a near-white colour does nothing at all.
      const lch = toOKLCH(colour);
      if (lch.L > 0.75) return { colour: fromOKLCH({ ...lch, L: 0.3 }, colour.a), note: 'Darkened for Ink: Multiply cannot lighten, so pale type would vanish.' };
      return { colour };
    }
    case 'screen': {
      const lch = toOKLCH(colour);
      if (lch.L < 0.35) return { colour: fromOKLCH({ ...lch, L: 0.72 }, colour.a), note: 'Lightened for Ghost/Luminous: Screen cannot darken, so dark type would vanish.' };
      return { colour };
    }
    case 'stencilAlpha':
    case 'silhouetteAlpha':
      return { colour: { r: 1, g: 1, b: 1, a: 1 }, note: 'Knockout uses the letterform as a matte, so the text colour has no effect.' };
    default:
      return { colour };
  }
}

/* ------------------------------------------------------------------ *
 * Layering
 * ------------------------------------------------------------------ */

/**
 * Assign render lanes.
 *
 * Within a phrase the largest word goes furthest back, so a hero word never
 * covers the supporting words that give it context — the overlap in the
 * reference material always reads with the small type in front.
 *
 * Background words get negative lanes; the exporter turns those into FCP
 * lanes beneath the video, with a masked copy of the picture above them.
 *
 * @param {Array<{id:string, level:Level, size:number, depth:Depth}>} words
 * @returns {Map<string, number>}
 */
export function assignLanes(words) {
  /** @type {Map<string, number>} */
  const lanes = new Map();

  const background = words.filter((w) => w.depth === 'background').sort((a, b) => b.size - a.size);
  background.forEach((w, i) => lanes.set(w.id, -(background.length - i)));

  const foreground = words.filter((w) => w.depth !== 'background').sort((a, b) => b.size - a.size);
  foreground.forEach((w, i) => lanes.set(w.id, i + 1));

  return lanes;
}

/**
 * Whether this plan needs the behind-subject layer sandwich building at all.
 * @param {Array<{depth:Depth}>} words @returns {boolean}
 */
export const needsSubjectIsolation = (words) => words.some((w) => w.depth === 'background');
