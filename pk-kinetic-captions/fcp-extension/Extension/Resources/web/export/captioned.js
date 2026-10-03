/**
 * A copy of the editor's own project with the captions already on it.
 *
 * Dragging a captions clip onto the timeline means lining it up with the
 * project's first frame by eye, and a few frames off is visible on every word.
 * Instead this takes the project exactly as Final Cut sent it to the panel,
 * adds the captions (as one compound clip, the same one the drag makes)
 * connected at the project's start, and names the result "… — captions". The
 * original project is never touched; Final Cut imports this one beside it.
 *
 * String surgery rather than re-serialising, so everything Final Cut wrote —
 * effects, masks, keyframes, roles, metadata — goes back byte for byte.
 */

import { seconds } from '../transcript/fcpxml-tree.js';

/** Children that come after a clip's connected clips (FCPXML 1.11–1.14 DTD). */
const AFTER_ANCHORS = new Set([
  'marker', 'chapter-marker', 'rating', 'keyword', 'analysis-marker',
  'audio-channel-source', 'audio-role-source', 'sync-source',
  'filter-video', 'filter-video-mask', 'filter-audio', 'metadata', 'reserved',
]);
const TIMED = new Set(['asset-clip', 'clip', 'video', 'sync-clip', 'ref-clip', 'mc-clip', 'gap', 'title', 'audio', 'audition']);

/**
 * @param {string} projectXml  the FCPXML Final Cut gave the panel (a project)
 * @param {string | {xml: string, lane: number, name: string, inline?: boolean}[]} clips
 *   With `inline`, the clip's titles go straight onto the project timeline —
 *   each word its own title, selectable and editable in Final Cut — on lanes
 *   from `lane` up, instead of one compound clip.
 *   exportFCPXML(plan, { as: 'clip' }) — or several, each on its own lane
 *   (the words behind the agent below a gap for the masked shot, the rest above)
 * @param {{name?: string, lane?: number, projectName?: string}} [opts]
 * @returns {string}
 */
export function captionedProject(projectXml, clips, opts = {}) {
  const src = String(projectXml);
  const projectAt = src.search(/<project\b/);
  if (projectAt < 0) throw new Error('That drop was not a project. Drag the project itself from the browser to make a captioned copy.');
  const list = typeof clips === 'string' ? [{ xml: clips, lane: opts.lane ?? 9, name: opts.name ?? 'PK Captions' }] : clips;

  // Each clip's resources, with ids that cannot collide with the project's
  // or each other's: resource ids and title style ids are document-wide.
  const resources = [];
  const anchors = [];
  /** @type {{titles: string, lane: number}[]} */
  const inlined = [];
  list.forEach((c, i) => {
    const resMatch = /<resources>([\s\S]*?)<\/resources>/.exec(c.xml);
    const refMatch = /<ref-clip\b[^>]*\bref="(r\d+)"[^>]*\bduration="([^"]+)"[^>]*\/>/.exec(c.xml);
    if (!resMatch || !refMatch) throw new Error('No captions to add.');
    const p = `pk${i}`;
    const rename = (s) => s.replace(/\b(id|ref|format)="r(\d+)"/g, `$1="${p}r$2"`).replace(/\b(id|ref)="ts(\d+)"/g, `$1="${p}ts$2"`);
    if (c.inline) {
      // The titles themselves, out of the clip's own storyline; only the
      // resources they use (format, title effect) come along.
      const gap = /<gap\b[^>]*>([\s\S]*)<\/gap>/.exec(c.xml);
      const res = rename(resMatch[1]).replace(/<media\b[\s\S]*?<\/media>/, '').trim();
      resources.push(res);
      inlined.push({ titles: rename(gap ? gap[1] : ''), lane: c.lane });
      return;
    }
    resources.push(rename(resMatch[1]).trim());
    anchors.push({ id: `${p}r${refMatch[1].slice(1)}`, duration: refMatch[2], lane: c.lane, name: c.name });
  });

  // The project's sequence, its start, and the first item of its storyline.
  const seqOpen = /<sequence\b[^>]*>/.exec(src.slice(projectAt));
  if (!seqOpen) throw new Error('The project has no sequence.');
  const tcStart = seconds(/\btcStart="([^"]+)"/.exec(seqOpen[0])?.[1]);
  const spineAt = src.indexOf('<spine', projectAt + seqOpen.index);
  if (spineAt < 0) throw new Error('The project has no storyline.');
  const spineOpenEnd = src.indexOf('>', spineAt) + 1;
  const first = firstElementAfter(src, spineOpenEnd, TIMED);
  if (!first) throw new Error('The project’s storyline is empty.');

  // The clips' offset, in the first item's own clock, for the project's
  // first frame: item.start + (tcStart - item.offset). Usually the first item
  // starts the project, and then its own start is exactly that: keep Final
  // Cut's rational for it.
  const offset = seconds(first.attrs.start) + (tcStart - seconds(first.attrs.offset));
  const exact = Math.abs(seconds(first.attrs.offset) - tcStart) < 1e-9 ? (first.attrs.start ?? '0s') : null;
  let anchorXml = anchors.map((a) =>
    `<ref-clip ref="${a.id}" lane="${a.lane}" offset="${exact ?? fcpTime(offset)}" name="${esc(a.name)}" duration="${a.duration}"/>`).join('');

  // Inlined titles: each one's offset moved from the captions' clock (0 at
  // the project's first frame) into the first item's, exactly — as rationals,
  // so every word stays on its frame — and its lane lifted above `lane`.
  const base = rational(exact ?? fcpTime(offset));
  for (const { titles, lane } of inlined) {
    anchorXml += titles.replace(/<title\b([^>]*)>/g, (m, attrs) => {
      let a = attrs.replace(/\boffset="([^"]+)"/, (o, v) => `offset="${ratString(ratAdd(base, rational(v)))}"`);
      a = a.replace(/\blane="(-?\d+)"/, (l, v) => `lane="${lane + Math.max(0, Number(v) - 1)}"`);
      return `<title${a}>`;
    });
  }

  let out = src;
  // Into the first item: before any child that must come after connected
  // clips, else before its closing tag.
  if (first.selfClosing) {
    const open = out.slice(first.start, first.end).replace(/\s*\/>$/, '>');
    out = out.slice(0, first.start) + open + anchorXml + `</${first.name}>` + out.slice(first.end);
  } else {
    const at = insertionPoint(out, first);
    out = out.slice(0, at) + anchorXml + out.slice(at);
  }

  const resClose = out.indexOf('</resources>');
  if (resClose < 0) throw new Error('The project has no resources.');
  out = out.slice(0, resClose) + resources.join('\n') + '\n' + out.slice(resClose);

  // A new project beside the original: a new name, no uid of the original's.
  out = out.replace(/<project\b([^>]*)>/, (m, attrs) => {
    let a = attrs.replace(/\s(uid|modDate|id)="[^"]*"/g, '');
    a = a.replace(/\bname="([^"]*)"/, (n, v) => `name="${esc(opts.projectName ?? `${unesc(v)} — captions`)}"`);
    return `<project${a}>`;
  });
  return out;
}

/** The first element of a set after `from`, with where its tag ends. */
function firstElementAfter(src, from, names) {
  const re = /<([A-Za-z][\w-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(src))) {
    if (!names.has(m[1])) continue;
    const attrs = {};
    for (const a of m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = a[2];
    return { name: m[1], attrs, start: m.index, end: m.index + m[0].length, selfClosing: m[3] === '/' };
  }
  return null;
}

/** Where a connected clip may go inside an open element, per the DTD. */
function insertionPoint(src, el) {
  const re = /<(\/?)([A-Za-z][\w-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  re.lastIndex = el.end;
  let depth = 0;
  let m;
  while ((m = re.exec(src))) {
    const [, closing, name, , self] = m;
    if (closing) {
      if (depth === 0) return m.index;             // the element's own closing tag
      depth--;
      continue;
    }
    if (depth === 0 && AFTER_ANCHORS.has(name)) return m.index;
    if (!self) depth++;
  }
  throw new Error('Could not read the project’s storyline.');
}

/** Seconds as an FCPXML time (exact for whole frames at the usual rates). */
function fcpTime(t) {
  const n = Math.round(t * 240000);
  return n % 240000 === 0 ? `${n / 240000}s` : `${n}/240000s`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** FCPXML time "N/Ds" or "Ns" as an exact rational [n, d]. */
function rational(t) {
  const s = String(t).trim().replace(/s$/, '');
  if (s.includes('/')) { const [n, d] = s.split('/').map(Number); return [n, d]; }
  if (/^-?\d+$/.test(s)) return [Number(s), 1];
  const k = 240000;                                    // a decimal: to a fine timebase
  return [Math.round(Number(s) * k), k];
}
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function ratAdd([a, b], [c, d]) {
  const n = a * d + c * b, m = b * d;
  const g = gcd(n, m) || 1;
  return [n / g, m / g];
}
const ratString = ([n, d]) => (n === 0 ? '0s' : d === 1 ? `${n}s` : `${n}/${d}s`);

