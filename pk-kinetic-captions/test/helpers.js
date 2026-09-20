import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Point the template store at a throwaway directory. Tests must never touch
 * the editor's real templates.
 */
export async function withTempStore(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pkkc-test-'));
  const previous = process.env.PKKC_HOME;
  process.env.PKKC_HOME = dir;
  try { return await fn(dir); }
  finally {
    process.env.PKKC_HOME = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export const FRAME_916 = { width: 1080, height: 1920, fps: 30, aspect: '9:16', safeArea: true };
export const FRAME_169 = { width: 1920, height: 1080, fps: 25, aspect: '16:9', safeArea: false };

export const AGENT_SCRIPT =
  "I've always been competitive in sports, business and real estate. "
  + "If I'm doing it, I want to do it properly. That is how we win listings.";

export const LISTING_SCRIPT =
  'Welcome to 42 Harbour Road. This architectural home offers four bedrooms, '
  + 'two bathrooms and a double garage, set on six hundred and fifty square metres '
  + 'of freehold land with uninterrupted sea views. Priced at one point nine five million dollars.';

export const TALKING_HEAD_SHOTS = [{
  start: 0, end: 60, kind: 'talkingHead',
  face: { x: 0.10, y: 0.20, w: 0.22, h: 0.16 },
  subject: { x: 0.18, y: -0.05, w: 0.50, h: 0.80 },
}];

export const allWords = (plan) => plan.phrases.flatMap((p) => p.words);
