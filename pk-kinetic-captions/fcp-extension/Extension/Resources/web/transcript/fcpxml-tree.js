/**
 * Where things sit on a Final Cut timeline, in project seconds.
 *
 * A caption's `offset` is not a project time. Final Cut connects captions
 * (and mCaptions titles) to a clip, and the offset is in *that clip's* clock:
 * its own media time, which starts at the clip's `start`, not at zero. The
 * clip in turn sits in its parent's clock, and a project's spine usually
 * starts at 01:00:00:00. Reading offsets as they are put words minutes or an
 * hour away from where they are said.
 *
 * So this walks the three clocks the way Final Cut does — project, parent,
 * clip — and reports every element's start as seconds from the start of the
 * project (its `tcStart`), the time the panel's preview and export use.
 *
 * Pure, so it can be tested and run in the panel's web view.
 */

/** @param {string|null|undefined} t `12012/24000s` or `4s` -> seconds. */
export function seconds(t) {
  if (!t) return 0;
  const s = String(t).trim().replace(/s$/, '');
  if (s.includes('/')) { const [n, d] = s.split('/').map(Number); return d ? n / d : 0; }
  return Number(s) || 0;
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&amp;/g, '&');

/**
 * A small tolerant XML tree: elements, attributes, and each element's own
 * text (what sits directly inside it).
 * @param {string} xml
 */
export function parseTree(xml) {
  /** @type {any} */
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)|<!\[CDATA\[[\s\S]*?\]\]>|<[!?][\s\S]*?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, closing, name, rawAttrs, selfClose, text] = m;
    if (text !== undefined) { stack[stack.length - 1].text += decode(text); continue; }
    if (!name) continue;
    if (closing) {
      while (stack.length > 1 && stack.pop().name !== name) { /* tolerate */ }
      continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = decode(a[2]);
    const node = { name, attrs, children: [], text: '' };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

/** @param {any} node @param {string} name */
export function find(node, name) {
  for (const c of node.children) {
    if (c.name === name) return c;
    const hit = find(c, name);
    if (hit) return hit;
  }
  return null;
}

/** All text inside a node, depth first. */
export function textOf(node) {
  return node.text + node.children.map(textOf).join(' ');
}

/** Elements that take up time on a timeline. */
const TIMED = new Set(['asset-clip', 'clip', 'video', 'audio', 'sync-clip', 'ref-clip', 'mc-clip', 'gap', 'title', 'caption', 'spine', 'transition']);

/**
 * Every timed element of the project (or, for a dragged compound clip, its
 * sequence), with where it starts in project seconds.
 *
 * @param {string} xml
 * @returns {{node: any, at: number, lane: number}[]}
 */
export function timelineItems(xml) {
  const tree = parseTree(String(xml ?? ''));
  const project = find(tree, 'project');
  const sequence = project ? find(project, 'sequence') : find(tree, 'sequence');
  const spine = sequence && find(sequence, 'spine');
  if (!spine) return [];
  const origin = seconds(sequence.attrs.tcStart);

  /** @type {{node: any, at: number, lane: number}[]} */
  const out = [];

  /**
   * @param {any} node   an element on the timeline
   * @param {(t: number) => number} clock  maps a time in the parent's clock to project seconds
   * @param {number} lane
   */
  function visit(node, clock, lane) {
    const at = clock(seconds(node.attrs.offset));
    out.push({ node, at, lane });
    // A storyline's items run in the same clock the storyline sits in;
    // anything connected to a clip runs in that clip's clock, which shows
    // its time `start` at `at`.
    const localStart = seconds(node.attrs.start);
    const inner = node.name === 'spine' ? clock : (t) => at + (t - localStart);
    for (const child of node.children) {
      if (!TIMED.has(child.name) || child.attrs.offset === undefined) continue;
      visit(child, inner, lane + (node.name === 'spine' ? 0 : Number(child.attrs.lane ?? 0)));
    }
  }

  const top = (t) => t - origin;
  for (const item of spine.children) {
    if (TIMED.has(item.name)) visit(item, top, 0);
  }
  return out;
}
