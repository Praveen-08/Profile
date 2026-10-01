/**
 * Which picture is on screen at a given moment of a dropped timeline.
 *
 * The preview draws captions over the editor's real footage, so it needs to
 * know, for any sequence time, which source file is showing and at what time
 * in that file. A Final Cut project rarely keeps its video in the spine:
 * typically the spine is one long gap and every shot is *connected* to it,
 * with times in the gap's own clock (which often starts at 01:00:00:00). So
 * this walks three clocks — sequence, parent, clip — the way Final Cut does.
 *
 * Pure, so it can be tested; panel.js does the drawing.
 */

/**
 * @typedef {object} Segment
 * @property {string} src        file:// URL of the source media.
 * @property {number} start      Sequence seconds where it begins.
 * @property {number} end        Sequence seconds where it ends.
 * @property {number} srcStart   Source seconds shown at `start`.
 * @property {number} lane       0 for the spine; higher draws on top.
 * @property {boolean} still     An image rather than a movie.
 */

/** @param {string|null|undefined} t `12012/24000s` or `4s` -> seconds. */
export function seconds(t) {
  if (!t) return 0;
  const s = String(t).trim().replace(/s$/, '');
  if (s.includes('/')) { const [n, d] = s.split('/').map(Number); return d ? n / d : 0; }
  return Number(s) || 0;
}

/**
 * A small tolerant XML tree: enough for FCPXML's elements and attributes.
 * @param {string} xml
 */
export function parseTree(xml) {
  /** @type {any} */
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, closing, name, rawAttrs, selfClose] = m;
    if (closing) {
      while (stack.length > 1 && stack.pop().name !== name) { /* tolerate */ }
      continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = decode(a[2]);
    const node = { name, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** @param {any} node @param {string} name */
const find = (node, name) => {
  for (const c of node.children) {
    if (c.name === name) return c;
    const hit = find(c, name);
    if (hit) return hit;
  }
  return null;
};

const STILL = /\.(png|jpe?g|heic|tiff?|gif|bmp|webp)$/i;
const CLIPS = new Set(['asset-clip', 'clip', 'video', 'sync-clip', 'ref-clip', 'gap', 'title', 'audio', 'mc-clip', 'caption']);

/**
 * The video segments of the timeline in a dropped FCPXML.
 * @param {string} xml
 * @returns {Segment[]}
 */
export function videoSegments(xml) {
  const tree = parseTree(String(xml ?? ''));

  /** @type {Map<string, {src: string, hasVideo: boolean}>} */
  const assets = new Map();
  (function collect(node) {
    for (const c of node.children) {
      if (c.name === 'asset') {
        const rep = c.children.find((x) => x.name === 'media-rep');
        const src = rep?.attrs.src ?? c.attrs.src;
        if (src) assets.set(c.attrs.id, { src, hasVideo: c.attrs.hasVideo === '1' || STILL.test(src) });
      }
      collect(c);
    }
  })(tree);

  // The project's own sequence; else the first one (a dragged compound clip).
  const project = find(tree, 'project');
  const sequence = project ? find(project, 'sequence') : find(tree, 'sequence');
  const spine = sequence && find(sequence, 'spine');
  if (!spine) return [];

  /** @type {Segment[]} */
  const out = [];

  /**
   * @param {any} node   a clip-like element
   * @param {number} at  sequence seconds where the element's offset point sits
   *                     (for a spine item, its offset; for a connected one,
   *                     mapped through its parent's clock)
   * @param {number} lane
   */
  function visit(node, at, lane) {
    if (node.attrs.enabled === '0') return;
    const dur = seconds(node.attrs.duration);
    const localStart = seconds(node.attrs.start);
    const media = mediaOf(node);
    if (media && dur > 0) {
      out.push({
        src: media.src, start: at, end: at + dur,
        srcStart: media.still ? 0 : media.offsetIn + localStart, lane, still: media.still,
      });
    }
    // Connected children live in this element's clock.
    for (const child of node.children) {
      if (!CLIPS.has(child.name) || child.attrs.lane === undefined) continue;
      const childLane = Number(child.attrs.lane);
      if (childLane <= 0) continue;                       // below the storyline: not on top
      const childAt = at + (seconds(child.attrs.offset) - localStart);
      visit(child, childAt, lane + childLane);
    }
  }

  /** The source a clip shows, and where in that source its local time 0 sits. */
  function mediaOf(node) {
    if ((node.name === 'asset-clip' || node.name === 'video') && assets.get(node.attrs.ref)?.hasVideo) {
      const a = /** @type {any} */ (assets.get(node.attrs.ref));
      return { src: a.src, still: STILL.test(a.src), offsetIn: 0 };
    }
    if (node.name === 'clip') {
      const v = node.children.find((c) => c.name === 'video' && c.attrs.lane === undefined);
      const a = v && assets.get(v.attrs.ref);
      if (a?.hasVideo) {
        // A clip's local time t shows its <video> at v.start + (t - v.offset).
        return { src: a.src, still: STILL.test(a.src), offsetIn: seconds(v.attrs.start) - seconds(v.attrs.offset) };
      }
    }
    return null;
  }

  for (const item of spine.children) {
    if (!CLIPS.has(item.name)) continue;
    visit(item, seconds(item.attrs.offset), 0);
  }
  return out.sort((a, b) => a.start - b.start || a.lane - b.lane);
}

/**
 * The picture on top at sequence time t, and the source time to show.
 * @param {Segment[]} segments @param {number} t
 * @returns {{src: string, time: number, still: boolean}|null}
 */
export function pictureAt(segments, t) {
  let best = null;
  for (const s of segments) {
    if (t >= s.start && t < s.end && (!best || s.lane >= best.lane)) best = s;
  }
  return best ? { src: best.src, time: best.srcStart + (t - best.start), still: best.still } : null;
}
