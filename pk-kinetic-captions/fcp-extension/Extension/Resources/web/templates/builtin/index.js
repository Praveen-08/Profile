/**
 * Built-in styles.
 *
 * Each is a small set of deviations from the engine default, which is what
 * keeps them recognisably one family rather than six unrelated presets. Read
 * top to bottom they also document the design system: the same eight knobs
 * produce a fashion-editorial look, a luxury property look and a bold social
 * look without any style-specific code.
 *
 * Built-ins are protected — the store refuses to overwrite or delete them.
 * "Duplicate" is how an editor makes one their own.
 */

import { defineTemplate } from '../schema.js';

/** Fashion-editorial: clean sans support, serif italic hero, huge size contrast. */
export const PK_EDITORIAL = defineTemplate({
  id: 'pk-editorial', name: 'PK Editorial', kind: 'builtin', mood: 'neutral',
  description: 'Small clean sans supporting words against an oversized serif italic hero. Magazine typography over video.',
  fonts: {
    normal: { family: 'Helvetica Neue', weight: 'light', italic: false, width: 'normal', casing: 'none', tracking: 4, lineHeight: 1.12 },
    emphasis: { family: 'Helvetica Neue', weight: 'bold', italic: false, width: 'normal', casing: 'upper', tracking: 18, lineHeight: 1.05 },
    hero: { family: 'Didot', weight: 'regular', italic: true, width: 'normal', casing: 'none', tracking: -18, lineHeight: 0.92 },
  },
  colours: { primary: '#f4f2ee', accent: '#9fd8e0', secondary: '#c2c8cc', hero: '#ffffff', neutral: '#0a0a0a' },
  scale: { base: 0.056, normal: 1.0, emphasis: 1.30, hero: 3.2, minPt: 16, maxPt: 620 },
  spacing: { wordGap: 0.30, lineGap: 0.05, blockPadding: 0.02 },
  position: {
    mode: 'subjectAware', zones: ['center', 'upperLeft', 'lowerRight', 'lowerLeft', 'upperRight'],
    home: 'center', safeArea: true, margin: 0.05, faceAvoidance: true,
    heroMayOverlap: true, zoneHold: 2.2, align: 'left',
  },
  hierarchy: {
    captionDensity: 'low', emphasisDensity: 'subtle', autoEmphasis: true,
    maxWordsPerPhrase: 4, maxLines: 3, maxHeroPerPhrase: 1, heroCooldown: 3.0, maxWidth: 0.94,
    stripTerminalPunctuation: true,
  },
  motion: {
    style: 'editorial',
    in: { normal: 'fade', emphasis: 'rise', hero: 'scale' },
    out: { normal: 'fade', emphasis: 'fade', hero: 'scale' },
    perCharacterHero: false, stagger: 0.06, speed: 1, reveal: 'spoken', hold: 0.30,
  },
  interaction: { preset: 'clean', heroPreset: 'clean', heroBehindSubject: true },
  decoration: {
    outline: { enabled: false, width: 2, colour: 'text' },
    shadow: { enabled: true, opacity: 0.28, blur: 20, distance: 3, angle: 315, colour: '#000000' },
    glow: { enabled: false, intensity: 0.2, radius: 20, colour: 'text' },
  },
  realEstate: { enabled: false, collapse: false, priceFormat: 'short', conceptBoost: 0.9 },
});

/** Luxury property: thin sans, elegant serif, gold, almost no motion. */
export const PK_LUXURY = defineTemplate({
  id: 'pk-luxury', name: 'PK Luxury', kind: 'builtin', mood: 'luxury',
  description: 'Thin sans and an elegant serif in warm gold. Wide spacing, slow motion, deliberate restraint.',
  fonts: {
    normal: { family: 'Avenir Next', weight: 'extralight', italic: false, width: 'normal', casing: 'upper', tracking: 120, lineHeight: 1.35 },
    emphasis: { family: 'Avenir Next', weight: 'medium', italic: false, width: 'normal', casing: 'upper', tracking: 90, lineHeight: 1.2 },
    hero: { family: 'Cormorant Garamond', weight: 'light', italic: false, width: 'normal', casing: 'none', tracking: -6, lineHeight: 0.98 },
  },
  colours: { primary: '#f0ede8', accent: '#c9a84c', secondary: '#a9a49b', hero: '#dfc278', neutral: '#070707' },
  scale: { base: 0.038, normal: 1.0, emphasis: 1.35, hero: 4.0, minPt: 14, maxPt: 560 },
  spacing: { wordGap: 0.42, lineGap: 0.32, blockPadding: 0.03 },
  position: {
    mode: 'dynamic', zones: ['center', 'bottom', 'lowerLeft', 'top'],
    home: 'center', safeArea: true, margin: 0.09, faceAvoidance: true,
    heroMayOverlap: false, zoneHold: 4.0, align: 'center',
  },
  hierarchy: {
    captionDensity: 'low', emphasisDensity: 'subtle', autoEmphasis: true,
    maxWordsPerPhrase: 3, maxLines: 2, maxHeroPerPhrase: 1, heroCooldown: 5.0, maxWidth: 0.80,
    stripTerminalPunctuation: true,
  },
  motion: {
    style: 'luxury',
    in: { normal: 'fade', emphasis: 'fade', hero: 'scale' },
    out: { normal: 'fade', emphasis: 'fade', hero: 'fade' },
    perCharacterHero: false, stagger: 0.10, speed: 1, reveal: 'phrase', hold: 0.6,
  },
  interaction: { preset: 'clean', heroPreset: 'clean', heroBehindSubject: false },
  decoration: {
    outline: { enabled: false, width: 1.5, colour: 'text' },
    shadow: { enabled: true, opacity: 0.22, blur: 26, distance: 0, angle: 270, colour: '#000000' },
    glow: { enabled: false, intensity: 0.15, radius: 24, colour: 'text' },
  },
  realEstate: { enabled: true, collapse: true, priceFormat: 'short', conceptBoost: 1.0 },
});

/** Modern creator: geometric sans, bold emphasis, one strong accent. */
export const PK_MODERN = defineTemplate({
  id: 'pk-modern', name: 'PK Modern', kind: 'builtin', mood: 'social',
  description: 'Geometric sans throughout, heavy emphasis, one strong accent colour. Clean and contemporary.',
  fonts: {
    normal: { family: 'Avenir Next', weight: 'medium', italic: false, width: 'normal', casing: 'none', tracking: -6, lineHeight: 1.08 },
    emphasis: { family: 'Avenir Next', weight: 'bold', italic: false, width: 'normal', casing: 'upper', tracking: -14, lineHeight: 1.0 },
    hero: { family: 'Avenir Next', weight: 'extrabold', italic: false, width: 'condensed', casing: 'upper', tracking: -30, lineHeight: 0.94 },
  },
  colours: { primary: '#ffffff', accent: '#22d3ee', secondary: '#b8c4c8', hero: '#ffffff', neutral: '#0b0b0d' },
  scale: { base: 0.060, normal: 1.0, emphasis: 1.35, hero: 2.5, minPt: 18, maxPt: 520 },
  spacing: { wordGap: 0.24, lineGap: 0.10, blockPadding: 0.02 },
  position: {
    mode: 'subjectAware', zones: ['center', 'lowerLeft', 'lowerRight', 'upperLeft', 'upperRight'],
    home: 'center', safeArea: true, margin: 0.06, faceAvoidance: true,
    heroMayOverlap: false, zoneHold: 1.8, align: 'left',
  },
  hierarchy: {
    captionDensity: 'medium', emphasisDensity: 'balanced', autoEmphasis: true,
    maxWordsPerPhrase: 5, maxLines: 3, maxHeroPerPhrase: 1, heroCooldown: 2.2, maxWidth: 0.88,
    stripTerminalPunctuation: true,
  },
  motion: {
    style: 'smooth',
    in: { normal: 'fade', emphasis: 'rise', hero: 'scale' },
    out: { normal: 'fade', emphasis: 'fade', hero: 'shrink' },
    perCharacterHero: false, stagger: 0.04, speed: 1, reveal: 'spoken', hold: 0.20,
  },
  interaction: { preset: 'clean', heroPreset: 'clean', heroBehindSubject: false },
  decoration: {
    outline: { enabled: false, width: 2, colour: 'text' },
    shadow: { enabled: true, opacity: 0.38, blur: 14, distance: 4, angle: 315, colour: '#000000' },
    glow: { enabled: false, intensity: 0.25, radius: 16, colour: 'text' },
  },
  realEstate: { enabled: false, collapse: false, priceFormat: 'short', conceptBoost: 0.9 },
});

/** Minimal: white, quiet, nothing to distract from the picture. */
export const PK_MINIMAL = defineTemplate({
  id: 'pk-minimal', name: 'PK Minimal', kind: 'builtin', mood: 'neutral',
  description: 'White type, one weight step, almost no movement and no effects. For footage that should carry the film.',
  fonts: {
    normal: { family: 'Helvetica Neue', weight: 'light', italic: false, width: 'normal', casing: 'none', tracking: 8, lineHeight: 1.2 },
    emphasis: { family: 'Helvetica Neue', weight: 'regular', italic: false, width: 'normal', casing: 'none', tracking: 8, lineHeight: 1.2 },
    hero: { family: 'Helvetica Neue', weight: 'medium', italic: false, width: 'normal', casing: 'none', tracking: 2, lineHeight: 1.1 },
  },
  colours: { primary: '#ffffff', accent: '#ffffff', secondary: '#cfcfcf', hero: '#ffffff', neutral: '#000000' },
  scale: { base: 0.044, normal: 1.0, emphasis: 1.20, hero: 1.9, minPt: 14, maxPt: 360 },
  spacing: { wordGap: 0.30, lineGap: 0.22, blockPadding: 0.02 },
  position: {
    mode: 'static', zones: ['bottom'], home: 'bottom', safeArea: true, margin: 0.08,
    faceAvoidance: false, heroMayOverlap: false, zoneHold: 99, align: 'center',
  },
  hierarchy: {
    captionDensity: 'medium', emphasisDensity: 'subtle', autoEmphasis: true,
    maxWordsPerPhrase: 6, maxLines: 2, maxHeroPerPhrase: 1, heroCooldown: 6.0, maxWidth: 0.78,
    stripTerminalPunctuation: false,
  },
  motion: {
    style: 'minimal',
    in: { normal: 'fade', emphasis: 'fade', hero: 'fade' },
    out: { normal: 'fade', emphasis: 'fade', hero: 'fade' },
    perCharacterHero: false, stagger: 0, speed: 1, reveal: 'phrase', hold: 0.25,
  },
  interaction: { preset: 'clean', heroPreset: 'clean', heroBehindSubject: false },
  decoration: {
    outline: { enabled: false, width: 1, colour: 'text' },
    shadow: { enabled: true, opacity: 0.30, blur: 16, distance: 0, angle: 270, colour: '#000000' },
    glow: { enabled: false, intensity: 0, radius: 0, colour: 'text' },
  },
  realEstate: { enabled: false, collapse: false, priceFormat: 'full', conceptBoost: 0.8 },
});

/** Bold social: heavy sans, big scale jumps, fast. */
export const PK_BOLD = defineTemplate({
  id: 'pk-bold', name: 'PK Bold', kind: 'builtin', mood: 'social',
  description: 'Hair-thin supporting words against heavy condensed type. Hierarchy is carried by weight and scale alone, so it works over any footage — add colour by capturing an accent.',
  fonts: {
    normal: { family: 'Helvetica Neue', weight: 'thin', italic: false, width: 'normal', casing: 'none', tracking: 10, lineHeight: 1.1 },
    emphasis: { family: 'Helvetica Neue', weight: 'bold', italic: false, width: 'normal', casing: 'upper', tracking: -18, lineHeight: 0.98 },
    hero: { family: 'Helvetica Neue', weight: 'black', italic: false, width: 'condensed', casing: 'upper', tracking: -34, lineHeight: 0.9 },
  },
  colours: { primary: '#ffffff', accent: '#ffffff', secondary: '#dcdcdc', hero: '#ffffff', neutral: '#000000' },
  scale: { base: 0.054, normal: 1.0, emphasis: 1.7, hero: 3.1, minPt: 16, maxPt: 620 },
  spacing: { wordGap: 0.32, lineGap: 0.04, blockPadding: 0.02 },
  position: {
    mode: 'dynamic', zones: ['center', 'upperLeft', 'lowerRight', 'lowerLeft', 'upperRight'],
    home: 'center', safeArea: true, margin: 0.05, faceAvoidance: true,
    heroMayOverlap: true, zoneHold: 1.2, align: 'left',
  },
  hierarchy: {
    captionDensity: 'low', emphasisDensity: 'strong', autoEmphasis: true,
    maxWordsPerPhrase: 4, maxLines: 3, maxHeroPerPhrase: 1, heroCooldown: 1.8, maxWidth: 0.92,
    stripTerminalPunctuation: true,
  },
  motion: {
    style: 'punchy',
    in: { normal: 'fade', emphasis: 'rise', hero: 'pop' },
    out: { normal: 'fade', emphasis: 'shrink', hero: 'shrink' },
    perCharacterHero: false, stagger: 0.03, speed: 1, reveal: 'spoken', hold: 0.14,
  },
  interaction: { preset: 'clean', heroPreset: 'clean', heroBehindSubject: false },
  decoration: {
    outline: { enabled: false, width: 3, colour: 'text' },
    shadow: { enabled: true, opacity: 0.30, blur: 10, distance: 5, angle: 315, colour: '#000000' },
    glow: { enabled: false, intensity: 0.2, radius: 12, colour: 'text' },
  },
  realEstate: { enabled: false, collapse: false, priceFormat: 'short', conceptBoost: 0.9 },
});

/** Listing and agent video: figures and features do the work. */
export const PK_REAL_ESTATE = defineTemplate({
  id: 'pk-real-estate', name: 'PK Real Estate', kind: 'builtin', mood: 'neutral',
  description: 'Built for listing and agent video. Prices, bedrooms, land and location are promoted automatically and set as figures.',
  fonts: {
    normal: { family: 'Avenir Next', weight: 'regular', italic: false, width: 'normal', casing: 'none', tracking: 0, lineHeight: 1.12 },
    emphasis: { family: 'Avenir Next', weight: 'bold', italic: false, width: 'normal', casing: 'upper', tracking: 20, lineHeight: 1.02 },
    hero: { family: 'Avenir Next', weight: 'extrabold', italic: false, width: 'condensed', casing: 'upper', tracking: -22, lineHeight: 0.95 },
  },
  colours: { primary: '#f7f6f3', accent: '#c9a84c', secondary: '#b6b2ab', hero: '#ffffff', neutral: '#0a0a0a' },
  scale: { base: 0.052, normal: 1.0, emphasis: 1.45, hero: 2.8, minPt: 16, maxPt: 560 },
  spacing: { wordGap: 0.26, lineGap: 0.12, blockPadding: 0.02 },
  position: {
    mode: 'subjectAware', zones: ['lowerLeft', 'center', 'lowerRight', 'upperLeft', 'bottom'],
    home: 'lowerLeft', safeArea: true, margin: 0.06, faceAvoidance: true,
    heroMayOverlap: false, zoneHold: 2.4, align: 'left',
  },
  hierarchy: {
    captionDensity: 'medium', emphasisDensity: 'balanced', autoEmphasis: true,
    maxWordsPerPhrase: 5, maxLines: 3, maxHeroPerPhrase: 1, heroCooldown: 2.6, maxWidth: 0.86,
    stripTerminalPunctuation: true,
  },
  motion: {
    style: 'cinematic',
    in: { normal: 'fade', emphasis: 'rise', hero: 'scale' },
    out: { normal: 'fade', emphasis: 'fade', hero: 'fade' },
    perCharacterHero: false, stagger: 0.05, speed: 1, reveal: 'spoken', hold: 0.35,
  },
  interaction: { preset: 'clean', heroPreset: 'clean', heroBehindSubject: false },
  decoration: {
    outline: { enabled: false, width: 2, colour: 'text' },
    shadow: { enabled: true, opacity: 0.34, blur: 18, distance: 4, angle: 315, colour: '#000000' },
    glow: { enabled: false, intensity: 0.2, radius: 16, colour: 'text' },
  },
  realEstate: { enabled: true, collapse: true, priceFormat: 'short', conceptBoost: 1.0 },
});

/** @type {import('../schema.js').Template[]} */
export const BUILTIN_TEMPLATES = [
  PK_EDITORIAL, PK_LUXURY, PK_MODERN, PK_MINIMAL, PK_BOLD, PK_REAL_ESTATE,
];

/** @type {Set<string>} */
export const BUILTIN_IDS = new Set(BUILTIN_TEMPLATES.map((t) => t.id));

/** @param {string} id @returns {import('../schema.js').Template|undefined} */
export const builtinById = (id) => BUILTIN_TEMPLATES.find((t) => t.id === id);
