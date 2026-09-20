/**
 * A very small argument parser.
 *
 * Adding a dependency for this would mean an editor cannot install the
 * plugin without a working npm, which is exactly the kind of friction the
 * product is supposed to remove.
 */

/**
 * @param {string[]} argv
 * @returns {{command: string, positional: string[], flags: Record<string, any>}}
 */
export function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  /** @type {string[]} */ const positional = [];
  /** @type {Record<string, any>} */ const flags = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--') { positional.push(...rest.slice(i + 1)); break; }
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      const key = camel(eq === -1 ? token.slice(2) : token.slice(2, eq));
      let value;
      if (eq !== -1) value = token.slice(eq + 1);
      else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) value = rest[++i];
      else value = true;

      if (/^no[A-Z]/.test(key) && value === true) {
        flags[key[2].toLowerCase() + key.slice(3)] = false;
      } else if (flags[key] !== undefined) {
        flags[key] = Array.isArray(flags[key]) ? [...flags[key], value] : [flags[key], value];
      } else {
        flags[key] = value;
      }
    } else positional.push(token);
  }
  return { command, positional, flags };
}

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** @param {any} v @param {number} fallback @returns {number} */
export const numberOr = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** @param {any} v @param {readonly string[]} allowed @param {string} name @returns {any} */
export function oneOf(v, allowed, name) {
  if (v === undefined || v === true) return undefined;
  const s = String(v).toLowerCase();
  const hit = allowed.find((a) => a.toLowerCase() === s);
  if (!hit) throw new Error(`--${name} must be one of: ${allowed.join(', ')} (got "${v}")`);
  return hit;
}
