/**
 * Reading the frame out of a Final Cut timeline.
 *
 * The panel must design against the sequence's real dimensions and rate, not
 * a guess: type is sized from the frame's short edge, and every caption is
 * snapped to a frame boundary on export. Getting the rate wrong by 30 vs
 * 29.97 drifts a whole frame every 33 seconds.
 *
 * Kept separate from panel.js, which touches the DOM at module scope and so
 * cannot be imported by a test. This is pure, and is tested.
 */

/** @typedef {{width: number, height: number, fps: number, aspect: "9:16"|"16:9"|"4:5"|"1:1"}} Frame */

const ASPECTS = /** @type {const} */ ([['9:16', 9 / 16], ['4:5', 0.8], ['1:1', 1], ['16:9', 16 / 9]]);

/** @param {number} ratio @returns {Frame['aspect']} */
export function nearestAspect(ratio) {
  return [...ASPECTS].sort((a, b) => Math.abs(a[1] - ratio) - Math.abs(b[1] - ratio))[0][0];
}

/**
 * Pull width, height and frame rate out of a timeline's `<format>`.
 *
 * Attribute order is not guaranteed, so each is read on its own rather than
 * by matching them in sequence. A timeline can also declare several formats
 * — the sequence's is the one that matters, so that is preferred and the
 * first format is only a fallback.
 *
 * @param {string} xml
 * @param {Frame} fallback
 * @returns {Frame}
 */
export function frameFromFCPXML(xml, fallback) {
  const source = String(xml ?? '');

  // Prefer the format the sequence actually references. A dragged project
  // carries its compound clips' sequences too, listed before its own — and a
  // compound of audio only has a format with no frame rate at all. So: the
  // project's own sequence first, then the first sequence whose format has a
  // real size and rate, then the first format of any kind.
  const projectRef = /<project\b[^>]*>\s*<sequence\b[^>]*\bformat="([^"]+)"/.exec(source)?.[1];
  const sequenceRefs = [...source.matchAll(/<sequence\b[^>]*\bformat="([^"]+)"/g)].map((m) => m[1]);
  const usable = (tag) => tag && frameRate(tag) && /\bwidth="\d+"/.test(tag);
  const tag = (projectRef && findFormat(source, projectRef))
    || sequenceRefs.map((id) => findFormat(source, id)).find(usable)
    || (sequenceRefs[0] && findFormat(source, sequenceRefs[0]))
    || /<format\b[^>]*>/.exec(source)?.[0];
  if (!tag) return fallback;

  const width = number(/\bwidth="(\d+)"/.exec(tag)?.[1]);
  const height = number(/\bheight="(\d+)"/.exec(tag)?.[1]);
  const fps = frameRate(tag) ?? fallback.fps;

  if (!width || !height) return { ...fallback, fps };
  return { width, height, fps, aspect: nearestAspect(width / height) };
}

/** @param {string} xml @param {string} id */
function findFormat(xml, id) {
  for (const [tag] of xml.matchAll(/<format\b[^>]*>/g)) {
    if (new RegExp(`\\bid="${escapeId(id)}"`).test(tag)) return tag;
  }
  return null;
}

/**
 * `frameDuration` is a rational, and the awkward rates are the ones that
 * matter: 1001/30000 is 29.97, not 30.
 * @param {string} tag @returns {number|null}
 */
function frameRate(tag) {
  const m = /\bframeDuration="(\d+)\/(\d+)s"/.exec(tag);
  if (!m) return null;
  const duration = Number(m[1]), timebase = Number(m[2]);
  if (!duration || !timebase) return null;

  const exact = timebase / duration;
  // Snap to a real rate so 29.969999 does not become the export's timebase.
  const known = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120];
  const nearest = known.reduce((a, b) => (Math.abs(b - exact) < Math.abs(a - exact) ? b : a));
  return Math.abs(nearest - exact) < 0.05 ? nearest : Math.round(exact * 1000) / 1000;
}

const number = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const escapeId = (id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
