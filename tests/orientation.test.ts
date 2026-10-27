import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ORIENTATION,
  rotateClockwise,
  rotateCounterClockwise,
  rotate180,
  resetOrientation,
  isRotatedQuarter,
  composeTransform,
  rotationFitScale,
} from '../lib/player/orientation.ts';

test('default orientation is upright', () => {
  assert.deepEqual(DEFAULT_ORIENTATION, { rotate: 0 });
});

test('rotateClockwise cycles 0 -> 90 -> 180 -> 270 -> 0', () => {
  let o = DEFAULT_ORIENTATION;
  assert.equal(rotateClockwise(o).rotate, 90);
  o = rotateClockwise(o);
  assert.equal(o.rotate, 90);
  o = rotateClockwise(o);
  assert.equal(o.rotate, 180);
  o = rotateClockwise(o);
  assert.equal(o.rotate, 270);
  o = rotateClockwise(o);
  assert.equal(o.rotate, 0);
});

test('rotateCounterClockwise goes 0 -> 270 -> 180 -> 90 -> 0', () => {
  let o = DEFAULT_ORIENTATION;
  o = rotateCounterClockwise(o);
  assert.equal(o.rotate, 270);
  o = rotateCounterClockwise(o);
  assert.equal(o.rotate, 180);
  o = rotateCounterClockwise(o);
  assert.equal(o.rotate, 90);
  o = rotateCounterClockwise(o);
  assert.equal(o.rotate, 0);
});

test('rotate180 adds 180 from any state and wraps correctly', () => {
  assert.equal(rotate180(DEFAULT_ORIENTATION).rotate, 180);
  const q: typeof DEFAULT_ORIENTATION = { rotate: 90 };
  assert.equal(rotate180(q).rotate, 270);
  const q2: typeof DEFAULT_ORIENTATION = { rotate: 270 };
  assert.equal(rotate180(q2).rotate, 90);
});

test('resetOrientation returns to defaults from any state', () => {
  assert.deepEqual(resetOrientation(), DEFAULT_ORIENTATION);
  // reset always produces a fresh object, never the same reference
  assert.notEqual(resetOrientation(), DEFAULT_ORIENTATION);
});

test('isRotatedQuarter detects 90/270 only', () => {
  assert.equal(isRotatedQuarter({ rotate: 90 }), true);
  assert.equal(isRotatedQuarter({ rotate: 270 }), true);
  assert.equal(isRotatedQuarter({ rotate: 0 }), false);
  assert.equal(isRotatedQuarter({ rotate: 180 }), false);
});

test('composeTransform builds deterministic transform strings', () => {
  assert.equal(composeTransform(DEFAULT_ORIENTATION, 1), 'none');
  assert.equal(composeTransform(DEFAULT_ORIENTATION, 1.5), 'scale(1.5)');
  const rot = { rotate: 90 as const };
  assert.equal(composeTransform(rot, 1), 'rotate(90deg)');
  assert.equal(composeTransform(rot, 2), 'scale(2) rotate(90deg)');
  const full = { rotate: 180 as const };
  assert.equal(composeTransform(full, 1), 'rotate(180deg)');
  assert.equal(composeTransform(full, 1.25), 'scale(1.25) rotate(180deg)');
});

test('rotationFitScale prevents clipping for quarter rotations', () => {
  // 16:9 landscape video rotated into a 16:9 landscape container:
  // footprint becomes 9 wide x 16 tall -> limited by container height.
  const s = rotationFitScale(1920, 1080, 1280, 720, { rotate: 90 });
  // min(1280/1080, 720/1920) = min(1.185, 0.375) -> capped at 1 gives 0.375
  assert.ok(Math.abs(s - 0.375) < 1e-9);

  // Same video in a tall (portrait) container fits without shrinking:
  // min(400/1080, 1600/1920) -> 0.37 but capped... use container 500x1000:
  const s2 = rotationFitScale(1920, 1080, 500, 1000, { rotate: 90 });
  // min(500/1080=0.463, 1000/1920=0.52) -> 0.463
  assert.ok(Math.abs(s2 - 500 / 1080) < 1e-9);

  // Non-quarter rotations need no adjustment.
  assert.equal(rotationFitScale(1920, 1080, 1280, 720, { rotate: 0 }), 1);
  assert.equal(rotationFitScale(1920, 1080, 1280, 720, { rotate: 180 }), 1);

  // Unknown dimensions fall back to 1 (no bogus scaling).
  assert.equal(rotationFitScale(0, 0, 1280, 720, { rotate: 90 }), 1);
  assert.equal(rotationFitScale(1920, 1080, 0, 0, { rotate: 270 }), 1);
});
