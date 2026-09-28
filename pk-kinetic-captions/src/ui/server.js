/**
 * The local design interface.
 *
 * A Final Cut workflow extension would need Xcode and a signed macOS app
 * bundle; a local page needs neither, runs on the same machine beside Final
 * Cut, and can drive the same engine the CLI does. Every route here is a thin
 * wrapper over the public API — there is no logic in the UI layer, which is
 * what keeps the interface and the command line from drifting apart.
 *
 * It binds to loopback only. Nothing is uploaded anywhere.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingest } from '../transcript/ingest.js';
import { compose } from '../engine/compose.js';
import { renderFrame, renderContactSheet } from '../render/svg.js';
import { exportFCPXML } from '../export/fcpxml.js';
import { merge, validateTemplate, defaultTemplate } from '../templates/schema.js';
import { BUILTIN_TEMPLATES } from '../templates/builtin/index.js';
import * as store from '../templates/store.js';
import { exportTemplate, importTemplate } from '../templates/package.js';
import { loadBrand, saveBrand } from '../templates/brand.js';
import { renderThumbnail, renderSwatch } from '../templates/thumbnail.js';
import { INTERACTIONS, INTERACTION_ORDER } from '../engine/composite.js';
import { STYLES } from '../engine/motion.js';
import { FAMILIES, WEIGHT_ORDER, scanInstalledFamilies } from '../engine/fonts.js';
import { checkEnvironment } from '../export/install.js';
import { parseColour, toHex, generatePalette, harmonies, captureColour } from '../core/colour.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');
const SRC = path.resolve(HERE, '..');

/**
 * Engine modules that are safe to run in a browser: no Node imports at the
 * top level, no filesystem, no process. They are served under /lib so the
 * page can draw captions with the *same* renderer that writes the FCPXML,
 * instead of a second implementation that drifts from it.
 */
const BROWSER_SAFE = new Set([
  'render/svg.js', 'engine/motion.js', 'engine/fonts.js', 'core/colour.js',
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2',
};

/**
 * @param {{port?: number, host?: string, open?: boolean}} [opts]
 * @returns {Promise<{server: import('node:http').Server, url: string}>}
 */
export async function startServer(opts = {}) {
  const host = opts.host ?? '127.0.0.1';
  let port = opts.port ?? 7847;

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => sendJSON(res, 500, { error: err instanceof Error ? err.message : String(err) }));
  });

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      if (/** @type {any} */ (err).code === 'EADDRINUSE' && port < (opts.port ?? 7847) + 12) {
        port += 1;
        server.listen(port, host);
      } else reject(err);
    };
    server.on('error', onError);
    server.listen(port, host, () => { server.off('error', onError); resolve(undefined); });
  });

  // Read the port the OS actually bound. Passing 0 asks for any free port —
  // which the tests do — and reporting the requested one would be a lie.
  const bound = server.address();
  if (bound && typeof bound === 'object') port = bound.port;

  const url = `http://${host}:${port}/`;
  if (opts.open !== false) {
    console.log(`\n  PK Kinetic Captions\n  ${url}\n\n  Templates: ${store.paths().templates}\n  Ctrl-C to stop.\n`);
  }
  return { server, url };
}

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.pathname;

  if (route.startsWith('/api/')) {
    const body = req.method === 'POST' ? await readJSON(req) : {};
    return api(route, body, url, res);
  }

  if (route.startsWith('/lib/')) {
    const rel = route.slice('/lib/'.length);
    if (!BROWSER_SAFE.has(rel)) return send(res, 404, 'text/plain', 'Not a browser-safe module');
    try {
      return send(res, 200, MIME['.js'], await fs.readFile(path.join(SRC, rel)));
    } catch {
      return send(res, 404, 'text/plain', 'Not found');
    }
  }

  if (route === '/favicon.ico') {
    const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#08090a"/><rect x="10" y="10" width="12" height="12" rx="2" fill="#c9a84c" transform="rotate(45 16 16)"/></svg>`;
    return send(res, 200, MIME['.svg'], mark);
  }

  // Static files, with the directory traversal guard that every static
  // handler needs and half of them forget.
  const rel = route === '/' ? 'index.html' : route.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'text/plain', 'Forbidden');
  try {
    const data = await fs.readFile(file);
    return send(res, 200, MIME[path.extname(file)] ?? 'application/octet-stream', data);
  } catch {
    return send(res, 404, 'text/plain', 'Not found');
  }
}

async function api(route, body, url, res) {
  switch (route) {
    case '/api/state': return sendJSON(res, 200, await getState());

    case '/api/plan': {
      const { plan, template } = await planFrom(body);
      return sendJSON(res, 200, { plan, templateId: template.id, templateName: template.name, warnings: plan.warnings });
    }

    case '/api/render': {
      const { plan } = await planFrom(body);
      const svg = body.contactSheet
        ? renderContactSheet(plan, { count: body.count ?? 12, columns: body.columns ?? 4, plate: body.plate })
        : renderFrame(plan, { time: Number(body.time ?? 0), plate: body.plate, shot: body.shot ?? null, guides: !!body.guides, scale: 1 });
      return send(res, 200, MIME['.svg'], svg);
    }

    case '/api/thumbnail': {
      const t = await store.resolveTemplate(String(url.searchParams.get('id') ?? ''));
      if (!t) return send(res, 404, 'text/plain', 'No such template');
      const swatch = url.searchParams.get('swatch') === '1';
      return send(res, 200, MIME['.svg'], swatch ? renderSwatch(t) : renderThumbnail(t, { height: 720 }));
    }

    case '/api/template/save': {
      const template = await templateFrom(body);
      const { template: saved, file } = await store.saveTemplate(template, { name: body.name ?? template.name, overwrite: !!body.overwrite });
      await store.saveThumbnail(saved.id, renderThumbnail(saved));
      return sendJSON(res, 200, { template: saved, file, state: await getState() });
    }

    case '/api/template/update': {
      const template = await templateFrom(body);
      const saved = await store.updateTemplate(String(body.id), template);
      await store.saveThumbnail(saved.id, renderThumbnail(saved));
      return sendJSON(res, 200, { template: saved, state: await getState() });
    }

    case '/api/template/duplicate': {
      const saved = await store.duplicateTemplate(String(body.id), String(body.name));
      await store.saveThumbnail(saved.id, renderThumbnail(saved));
      return sendJSON(res, 200, { template: saved, state: await getState() });
    }

    case '/api/template/delete': {
      const ok = await store.deleteTemplate(String(body.id));
      return sendJSON(res, 200, { ok, state: await getState() });
    }

    case '/api/template/export': {
      const t = await store.resolveTemplate(String(body.id));
      if (!t) return sendJSON(res, 404, { error: 'No such template' });
      const file = await exportTemplate(t, String(body.destination || process.cwd()), { thumbnail: renderThumbnail(t, { height: 640 }) });
      return sendJSON(res, 200, { file });
    }

    case '/api/template/import': {
      const { template, notes } = await importTemplate(String(body.file), { rename: body.rename || undefined });
      await store.saveThumbnail(template.id, renderThumbnail(template));
      return sendJSON(res, 200, { template, notes, state: await getState() });
    }

    case '/api/brand': {
      const brand = body && Object.keys(body).length ? await saveBrand(body) : await loadBrand();
      return sendJSON(res, 200, { brand });
    }

    case '/api/palette': {
      const accent = toHex(parseColour(String(body.accent)));
      return sendJSON(res, 200, {
        accent,
        palette: mapHex(generatePalette(accent, { mood: body.mood ?? 'neutral' })),
        harmonies: mapHex(harmonies(accent)),
      });
    }

    case '/api/capture': {
      // The page samples the pixels (it can decode any image the browser can)
      // and posts them here, so the picker works for JPEG, HEIC-converted
      // stills and PNG alike without a decoder in this process.
      const pixels = Array.isArray(body.pixels) ? body.pixels : [];
      const r = captureColour(pixels, { minChroma: body.minChroma ?? 0.035 });
      return sendJSON(res, 200, { colour: toHex(r.colour), chromatic: r.chromatic, sampled: r.sampled });
    }

    case '/api/export': {
      const { plan, template } = await planFrom(body);
      const fcp = exportFCPXML(plan, { projectName: body.projectName || `${template.name} Captions`, profile: body.profile === 'pk' ? 'pk' : 'native' });
      const dir = path.resolve(String(body.out || path.join(process.cwd(), 'pk-captions')));
      await fs.mkdir(dir, { recursive: true });
      const stem = sanitise(body.stem || template.name);
      const file = path.join(dir, `${stem}.fcpxml`);
      await fs.writeFile(file, fcp.xml, 'utf8');
      return sendJSON(res, 200, { file, stats: fcp.stats, warnings: [...plan.warnings, ...fcp.warnings] });
    }

    case '/api/overrides/load': return sendJSON(res, 200, { overrides: await store.loadOverrides(String(body.project || 'default')) });
    case '/api/overrides/save': {
      const file = await store.saveOverrides(String(body.project || 'default'), body.overrides ?? {});
      return sendJSON(res, 200, { file });
    }

    default: return sendJSON(res, 404, { error: `No route ${route}` });
  }
}

/* ------------------------------------------------------------------ *
 * Shared request handling
 * ------------------------------------------------------------------ */

async function getState() {
  const { builtin, user, problems } = await store.listTemplates();
  const env = await checkEnvironment();
  return {
    builtin: builtin.map(summarise), user: user.map(summarise), problems,
    brand: await loadBrand(),
    defaults: defaultTemplate(),
    interactions: INTERACTION_ORDER.map((k) => ({ ...INTERACTIONS[k] })),
    animationStyles: Object.keys(STYLES),
    families: FAMILIES.map((f) => ({ family: f.family, classification: f.classification, weights: f.weights, widths: f.widths, italic: f.italic, systemMac: f.systemMac })),
    weights: WEIGHT_ORDER,
    environment: { platform: env.platform, isMac: env.isMac, storeRoot: env.storeRoot, pkTitleInstalled: env.pkTitleInstalled, fontNotes: env.notes },
    cwd: process.cwd(),
  };
}

const summarise = (t) => ({
  id: t.id, name: t.name, kind: t.kind, description: t.description, basedOn: t.basedOn,
  mood: t.mood, colours: t.colours, fonts: t.fonts, template: t,
});

/** Resolve the base template and layer the UI's edits over it. */
async function templateFrom(body) {
  const base = body.templateId ? await store.resolveTemplate(String(body.templateId)) : null;
  const template = merge(base ?? BUILTIN_TEMPLATES[5], body.patch ?? {});
  const check = validateTemplate(template);
  if (!check.ok) throw new Error(check.errors.join('; '));
  return template;
}

async function planFrom(body) {
  const template = await templateFrom(body);
  const transcript = body.transcript?.words
    ? body.transcript
    : ingest(String(body.text ?? ''), { format: body.format, wpm: body.wpm ?? 150 });

  const frame = {
    width: Number(body.frame?.width ?? 1080),
    height: Number(body.frame?.height ?? 1920),
    fps: Number(body.frame?.fps ?? 30),
    aspect: body.frame?.aspect ?? '9:16',
    safeArea: body.frame?.safeArea !== false,
  };

  const plan = compose({
    transcript, template, frame,
    shots: body.shots ?? undefined,
    overrides: body.overrides ?? undefined,
    corrections: body.corrections ?? undefined,
    accent: body.accent ? toHex(parseColour(String(body.accent))) : undefined,
    generatePaletteFromAccent: !!body.generatePalette,
    installedFonts: await scanInstalledFamilies(),
    capabilities: body.profile === 'pk' ? { blur: true, perCharacter: true, maskReveal: true } : undefined,
  });
  return { plan, template };
}

const mapHex = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toHex(/** @type {any} */ (v))]));
const sanitise = (s) => String(s).replace(/[^a-zA-Z0-9._ -]/g, '').trim() || 'captions';

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 32 * 1024 * 1024) { reject(new Error('Request too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error('Malformed JSON body')); } });
    req.on('error', reject);
  });
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const sendJSON = (res, status, obj) => send(res, status, MIME['.json'], JSON.stringify(obj));
