/**
 * PK Kinetic Captions — core data model.
 *
 * The pipeline is a series of pure transforms over these shapes:
 *
 *   Transcript --phrasing--> Phrase[] --emphasis--> hierarchy
 *              --typography/palette--> styled words
 *              --layout--> placed words
 *              --motion--> keyframed words
 *              --composite--> layered CaptionPlan
 *              --export--> FCPXML / SVG
 *
 * Nothing in this file executes. It is the shared vocabulary.
 */

/* ------------------------------------------------------------------ *
 * Transcript
 * ------------------------------------------------------------------ */

/**
 * A single spoken word with its own timing. Word-level timing is what makes
 * kinetic typography possible — sentence-level timing is not enough.
 *
 * @typedef {object} Word
 * @property {string} id            Stable id, used for overrides that survive re-generation.
 * @property {string} text          Display text (may have been normalized from `spoken`).
 * @property {string} spoken        The original transcribed token, never lost.
 * @property {number} start         Seconds from the start of the timeline.
 * @property {number} end           Seconds.
 * @property {number} [confidence]  0..1 from the transcription engine, if known.
 * @property {string} [concept]     Real-estate concept key, e.g. "PRICE", "BEDROOMS".
 * @property {boolean} [normalized] True when `text` !== `spoken` (e.g. "four" -> "4").
 */

/**
 * @typedef {object} Transcript
 * @property {Word[]} words
 * @property {string} [source]      Where it came from: "srt" | "vtt" | "whisper" | ...
 * @property {number} [fps]
 */

/* ------------------------------------------------------------------ *
 * Hierarchy
 * ------------------------------------------------------------------ */

/**
 * The three levels the whole design system pivots on.
 * @typedef {"normal"|"emphasis"|"hero"} Level
 */

/** @type {Level[]} */
export const LEVELS = ['normal', 'emphasis', 'hero'];

/** @type {Record<Level, number>} */
export const LEVEL_RANK = { normal: 0, emphasis: 1, hero: 2 };

/* ------------------------------------------------------------------ *
 * Phrasing
 * ------------------------------------------------------------------ */

/**
 * A visual phrase — one on-screen caption unit. Not a sentence, not a
 * fixed word count: a designed group.
 *
 * @typedef {object} Phrase
 * @property {string} id
 * @property {number} index
 * @property {Word[]} words
 * @property {number} start
 * @property {number} end
 * @property {string} [breakReason]  Why the phrase ended here — for debugging the phrasing engine.
 */

/* ------------------------------------------------------------------ *
 * Styling
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} FontSpec
 * @property {string} family        PostScript-friendly family name, e.g. "Helvetica Neue".
 * @property {FontWeight} weight
 * @property {boolean} italic
 * @property {string} [face]          Exact installed face name, when known; wins on export.
 * @property {FontWidth} width
 * @property {"upper"|"lower"|"title"|"none"} casing
 * @property {number} tracking      Tracking in 1/1000 em, FCP-style.
 * @property {number} lineHeight    Multiplier of point size.
 */

/**
 * @typedef {"thin"|"extralight"|"light"|"regular"|"medium"|"semibold"|"bold"|"extrabold"|"black"} FontWeight
 * @typedef {"condensed"|"normal"|"expanded"} FontWidth
 */

/**
 * An RGBA colour in linear-ish sRGB 0..1, which is how FCPXML wants it.
 * @typedef {{r:number,g:number,b:number,a:number}} RGBA
 */

/**
 * @typedef {object} Decoration
 * @property {{enabled:boolean,width:number,colour:RGBA}} outline
 * @property {{enabled:boolean,opacity:number,blur:number,distance:number,angle:number,colour:RGBA}} shadow
 * @property {{enabled:boolean,intensity:number,radius:number,colour:RGBA}} glow
 * @property {{enabled:boolean,from:RGBA,to:RGBA,angle:number}} gradient
 * @property {boolean} shine
 */

/**
 * A two-stop gradient fill. `angle` is in degrees: 0 runs left to right,
 * 90 bottom to top. Colours are hex.
 * `span: 'line'` runs one gradient across the whole line instead of each word.
 * @typedef {{enabled:boolean, from:string, to:string, angle?:number, span?:'word'|'line'}} GradientFill
 */

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

/**
 * Normalized frame coordinates. Origin is frame centre, +x right, +y up,
 * the range is -0.5..0.5 on each axis. Resolution-independent by design so
 * one plan renders correctly at 1080p and 4K, 9:16 and 16:9.
 * @typedef {{x:number,y:number}} Point
 */

/** @typedef {{x:number,y:number,w:number,h:number}} Rect   Centre-origin rect, normalized. */

/**
 * @typedef {"top"|"upperLeft"|"upperRight"|"center"|"lowerLeft"|"lowerRight"|"bottom"} Zone
 */

/** @type {Zone[]} */
export const ZONES = ['top', 'upperLeft', 'upperRight', 'center', 'lowerLeft', 'lowerRight', 'bottom'];

/**
 * What the engine knows about the picture under the type. Every field is
 * optional — the engine degrades gracefully to a static composition when
 * nothing is known.
 *
 * @typedef {object} ShotAnalysis
 * @property {number} start
 * @property {number} end
 * @property {"talkingHead"|"property"|"drone"|"lifestyle"|"unknown"} [kind]
 * @property {Rect} [face]      Primary face box, normalized.
 * @property {Rect} [subject]   Primary subject/body box, normalized.
 * @property {RGBA} [subjectColour]  Dominant clothing/subject colour.
 */

/* ------------------------------------------------------------------ *
 * Motion
 * ------------------------------------------------------------------ */

/**
 * @typedef {"fade"|"rise"|"slide"|"scale"|"pop"|"blur"|"stretch"|"rotate"|"typewriter"|"dissolve"|"type"|"reveal"|"maskReveal"} InAnimation
 * @typedef {"fade"|"dissolve"|"scale"|"slide"|"blur"|"shrink"|"maskExit"} OutAnimation
 * @typedef {"minimal"|"smooth"|"editorial"|"cinematic"|"luxury"|"punchy"|"energetic"} AnimationStyle
 */

/**
 * A resolved animation channel. Times are seconds relative to the word's
 * own on-screen life, values are absolute.
 * @typedef {object} Keyframe
 * @property {number} t
 * @property {number} v
 * @property {[number,number,number,number]} [ease]  Cubic bezier control points into this keyframe.
 */

/**
 * @typedef {object} WordMotion
 * @property {Keyframe[]} opacity
 * @property {Keyframe[]} scale
 * @property {Keyframe[]} offsetX
 * @property {Keyframe[]} offsetY
 * @property {Keyframe[]} blur
 * @property {Keyframe[]} [rotation]  Degrees, + anticlockwise.
 * @property {Keyframe[]} [reveal]    Fraction of the word shown, left to right (typewriter).
 * @property {number} inDuration
 * @property {number} outDuration
 * @property {InAnimation} inAnimation
 * @property {OutAnimation} outAnimation
 * @property {boolean} perCharacter
 */

/* ------------------------------------------------------------------ *
 * Compositing
 * ------------------------------------------------------------------ */

/**
 * The creative names the editor sees, mapped to real compositing behaviour
 * by src/engine/composite.js. Beginners pick a mood; advanced users can set
 * the underlying blend mode directly.
 * @typedef {"clean"|"invert"|"cinematic"|"ghost"|"editorial"|"knockout"|"luminous"|"ink"} Interaction
 */

/** @typedef {"normal"|"difference"|"screen"|"overlay"|"softLight"|"multiply"|"stencilAlpha"|"silhouetteAlpha"} BlendMode */

/** @typedef {"foreground"|"background"} Depth */

/* ------------------------------------------------------------------ *
 * The plan
 * ------------------------------------------------------------------ */

/**
 * A fully designed word, ready to render. This is the output of the design
 * engine and the input to every exporter.
 *
 * @typedef {object} PlacedWord
 * @property {string} id
 * @property {string} text
 * @property {Level} level
 * @property {number} start
 * @property {number} end
 * @property {FontSpec} font
 * @property {number} size        Point size at the plan's reference height.
 * @property {RGBA} colour
 * @property {Decoration} decoration
 * @property {Point} position     Anchor point of the word, normalized.
 * @property {Rect} box           Measured bounding box, normalized.
 * @property {WordMotion} motion
 * @property {{colour: RGBA, until: number}} [active]  Colour while spoken; `until` is seconds from the word's start.
 * @property {Depth} depth
 * @property {BlendMode} blend
 * @property {number} lane        Render order within its depth. Higher draws later.
 * @property {boolean} overridden Whether an editor override touched this word.
 */

/**
 * @typedef {object} PlacedPhrase
 * @property {string} id
 * @property {number} index
 * @property {number} start
 * @property {number} end
 * @property {Zone} zone
 * @property {PlacedWord[]} words
 * @property {string} [breakReason]
 */

/**
 * @typedef {object} CaptionPlan
 * @property {string} templateId
 * @property {string} templateName
 * @property {Frame} frame
 * @property {PlacedPhrase[]} phrases
 * @property {PlanStats} stats
 * @property {string[]} warnings
 */

/**
 * @typedef {object} Frame
 * @property {number} width
 * @property {number} height
 * @property {number} fps
 * @property {"9:16"|"16:9"|"4:5"|"1:1"} aspect
 * @property {boolean} safeArea
 */

/**
 * @typedef {object} PlanStats
 * @property {number} words
 * @property {number} phrases
 * @property {Record<Level, number>} byLevel
 * @property {number} emphasisRatio
 * @property {number} duration
 */

/* ------------------------------------------------------------------ *
 * Overrides
 * ------------------------------------------------------------------ */

/**
 * A local, per-word deviation from the template. Overrides are stored
 * separately from the template so that changing the template never loses
 * them, and clearing them restores template behaviour exactly.
 *
 * @typedef {object} WordOverride
 * @property {Level} [level]
 * @property {string} [text]
 * @property {number} [start]
 * @property {number} [end]
 * @property {string} [colour]     Hex.
 * @property {string} [fontFamily]
 * @property {FontWeight} [fontWeight]
 * @property {boolean} [italic]
 * @property {"none"|"upper"|"lower"|"title"} [casing]
 * @property {string} [fontFace]   Exact face name as installed ("ExtraBold Italic"); used on export.
 * @property {number} [scale]      Multiplier on the level's scale.
 * @property {number} [opacity]    0–1, applied across the word's whole fade.
 * @property {Point} [position]    Absolute override, normalized.
 * @property {InAnimation} [inAnimation]
 * @property {OutAnimation} [outAnimation]
 * @property {Depth} [depth]
 * @property {Interaction} [look]  This word's own look (blend), whatever its level's is.
 * @property {import('../engine/motion.js').MotionTune} [tune]  This word's own animation adjustments.
 * @property {GradientFill} [gradient]  A two-colour fill instead of the flat colour.
 * @property {{enabled:boolean, colour?:string, intensity?:number, radius?:number}} [glow]  Glow, over the style's.
 * @property {boolean} [shine]     A light sweep across the word as it lands.
 * @property {string} [activeColour]  Hex. The colour while the word is being spoken; it settles to its usual colour after.
 * @property {boolean} [withPrevious]  Appears at the same moment as the word before it, instead of when it is said.
 * @property {'caption'|'line'|'join'} [breakBefore]  Before this word: start a new caption, start a new line, or stay with the caption before.
 * @property {boolean} [hidden]
 */

/** @typedef {Record<string, WordOverride>} OverrideMap  Keyed by word id. */

export {};
