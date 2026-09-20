import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColour, toHex, toFCPColour, generatePalette, contrastRatio,
  captureColour, ensureContrast, toOKLCH, fromOKLCH, mix,
} from '../src/core/colour.js';

test('parses every colour notation an editor might paste', () => {
  assert.equal(toHex(parseColour('#14b8a6')), '#14b8a6');
  assert.equal(toHex(parseColour('14b8a6')), '#14b8a6');
  assert.equal(toHex(parseColour('#abc')), '#aabbcc');
  assert.equal(toHex(parseColour('rgb(20, 184, 166)')), '#14b8a6');
  assert.equal(parseColour('#14b8a680').a, 128 / 255);
  assert.throws(() => parseColour('teal-ish'));
});

test('FCPXML colours are space-separated floats', () => {
  assert.equal(toFCPColour({ r: 1, g: 0, b: 0.5, a: 1 }), '1 0 0.5 1');
});

test('OKLCH round-trips within a rounding step', () => {
  for (const hex of ['#14b8a6', '#c9a84c', '#ff3ea5', '#f0ede8', '#101010']) {
    const back = toHex(fromOKLCH(toOKLCH(parseColour(hex))));
    const d = [1, 3, 5].map((i) => Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16)));
    assert.ok(Math.max(...d) <= 2, `${hex} -> ${back}`);
  }
});

test('a generated palette stays readable and keeps the accent hue', () => {
  for (const accent of ['#14b8a6', '#c9a84c', '#ff3ea5', '#22d3ee']) {
    const p = generatePalette(accent, { mood: 'luxury' });
    assert.ok(contrastRatio(p.primary, { r: 0, g: 0, b: 0, a: 1 }) > 12, 'primary must read on dark footage');
    const dh = Math.abs(toOKLCH(p.accent).h - toOKLCH(parseColour(accent)).h);
    assert.ok(Math.min(dh, 360 - dh) < 6, 'the accent must keep its hue');
    assert.ok(toOKLCH(p.hero).L >= toOKLCH(p.accent).L - 0.01, 'hero should not be darker than the accent');
  }
});

test('colour capture finds the shirt, not the wall', () => {
  const px = [];
  for (let i = 0; i < 700; i++) px.push(128, 130, 127, 255);   // grey wall, the majority
  for (let i = 0; i < 300; i++) px.push(20, 184, 166, 255);    // teal shirt
  const r = captureColour(px);
  assert.equal(r.chromatic, true);
  assert.ok(Math.abs(toOKLCH(r.colour).h - toOKLCH(parseColour('#14b8a6')).h) < 12);
});

test('colour capture reports when a region has no colour in it', () => {
  const px = [];
  for (let i = 0; i < 400; i++) px.push(140, 140, 140, 255);
  assert.equal(captureColour(px).chromatic, false);
});

test('ensureContrast lifts a colour off its background without shifting hue', () => {
  const lifted = ensureContrast(parseColour('#333333'), parseColour('#2e2e2e'), 3);
  assert.ok(contrastRatio(lifted, parseColour('#2e2e2e')) >= 3);
});

test('mixing happens in a perceptual space, so a midpoint is not muddy', () => {
  const mid = mix(parseColour('#ffffff'), parseColour('#000000'), 0.5);
  const L = toOKLCH(mid).L;
  assert.ok(L > 0.45 && L < 0.65, `midpoint lightness was ${L}`);
});
