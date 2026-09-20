import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFCPTime, snapToFrame, timebaseFor, atLeastOneFrame, timecode } from '../src/core/time.js';

test('drop-frame rates use their proper timebase', () => {
  assert.deepEqual(timebaseFor(23.976), { timebase: 24000, frameDuration: 1001 });
  assert.deepEqual(timebaseFor(29.97), { timebase: 30000, frameDuration: 1001 });
  assert.deepEqual(timebaseFor(25), { timebase: 25, frameDuration: 1 });
});

test('times are exact rationals on a frame boundary', () => {
  assert.equal(toFCPTime(0, 30), '0s');
  assert.equal(toFCPTime(1.5, 25), '38/25s');
  assert.equal(toFCPTime(2, 23.976), '48048/24000s');
  for (const fps of [23.976, 24, 25, 29.97, 30, 60]) {
    const s = toFCPTime(3.14159, fps);
    const [n, d] = s.replace('s', '').split('/').map(Number);
    assert.ok(Number.isInteger(n) && Number.isInteger(d), `${fps} produced ${s}`);
  }
});

test('snapping is idempotent', () => {
  for (const fps of [24, 25, 30, 59.94]) {
    const once = snapToFrame(7.77777, fps);
    assert.equal(snapToFrame(once, fps), once);
  }
});

test('a clip is never shorter than one frame', () => {
  assert.ok(atLeastOneFrame(0, 30) >= 1 / 30 - 1e-9);
  assert.ok(atLeastOneFrame(0.001, 25) >= 1 / 25 - 1e-9);
});

test('timecode reads the way an editor expects', () => {
  assert.equal(timecode(74.321), '00:01:14.321');
});
