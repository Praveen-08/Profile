/**
 * PK Kinetic Captions — public API.
 *
 * `compose()` is the whole product in one call: transcript plus template in,
 * a fully designed caption plan out. Everything else here is either an input
 * to that (ingest, templates) or an output from it (FCPXML, SVG).
 */

export { ingest, detectFormat } from './transcript/ingest.js';
export { normalize } from './transcript/normalize.js';

export { compose, describePlan } from './engine/compose.js';
export { scoreWords, assignLevels } from './engine/emphasis.js';
export { groupPhrases } from './engine/phrasing.js';
export { resolveTypography, measureWidth, applyCasing } from './engine/typography.js';
export { chooseZone, layoutBlock, liveArea } from './engine/layout.js';
export { buildMotion, STYLES, EASING, sample } from './engine/motion.js';
export { INTERACTIONS, INTERACTION_ORDER, resolveInteraction } from './engine/composite.js';
export { FAMILIES, resolveFamily, resolveWeight, faceName } from './engine/fonts.js';

export { defaultTemplate, defineTemplate, validateTemplate, migrateTemplate, merge } from './templates/schema.js';
export { BUILTIN_TEMPLATES, builtinById } from './templates/builtin/index.js';
export * as store from './templates/store.js';
export { exportTemplate, importTemplate, readPackage, PACKAGE_EXTENSION } from './templates/package.js';
export { loadBrand, saveBrand, applyBrand, defaultBrand } from './templates/brand.js';
export { renderThumbnail, renderSwatch } from './templates/thumbnail.js';

export { renderFrame, renderContactSheet } from './render/svg.js';
export { exportFCPXML } from './export/fcpxml.js';
export { checkEnvironment, install } from './export/install.js';

export { parseColour, toHex, toCSS, generatePalette, captureColour, harmonies, contrastRatio } from './core/colour.js';
export { LEVELS, ZONES } from './core/types.js';
