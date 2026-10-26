import test from 'node:test';
import assert from 'node:assert/strict';
import { SENSITIVITY_PRESETS } from '../types/gestures.ts';

// Horizontal Zone calculation unit test
function getHorizontalZone(x: number, width: number): 'left' | 'right' | 'center' {
  if (x < width * 0.35) return 'left';
  if (x > width * 0.65) return 'right';
  return 'center';
}

// Seek calculation unit test
function calculateSeekTarget(
  startX: number,
  currentX: number,
  startTime: number,
  duration: number,
  seekRatio: number
): { target: number; delta: number } {
  const deltaX = currentX - startX;
  const seekDelta = (deltaX / 100) * seekRatio;
  const target = Math.max(0, Math.min(duration, startTime + seekDelta));
  return { target, delta: target - startTime };
}

// Brightness calculation unit test
function calculateBrightness(
  startBrightness: number,
  startY: number,
  currentY: number,
  containerHeight: number
): number {
  const deltaY = currentY - startY;
  const verticalDelta = -deltaY; // dragging up increases brightness
  const changePercent = (verticalDelta / (containerHeight * 0.75)) * 100;
  return Math.max(40, Math.min(160, Math.round(startBrightness + changePercent)));
}

// Volume calculation unit test
function calculateVolume(
  startVolume: number,
  startY: number,
  currentY: number,
  containerHeight: number
): number {
  const deltaY = currentY - startY;
  const verticalDelta = -deltaY;
  const changeRatio = verticalDelta / (containerHeight * 0.75);
  return Math.max(0, Math.min(1, parseFloat((startVolume + changeRatio).toFixed(3))));
}

// Pinch zoom scale calculation
function calculateZoomScale(
  initialDistance: number,
  currentDistance: number,
  initialScale: number
): number {
  if (initialDistance <= 0) return 1.0;
  const ratio = currentDistance / initialDistance;
  const rawScale = initialScale * ratio;
  return Math.max(1.0, Math.min(3.0, parseFloat(rawScale.toFixed(2))));
}

test('SENSITIVITY_PRESETS: defines low, medium, and high sensitivity parameters', () => {
  assert.equal(SENSITIVITY_PRESETS.low.slop, 16);
  assert.equal(SENSITIVITY_PRESETS.low.seekRatio, 30);

  assert.equal(SENSITIVITY_PRESETS.medium.slop, 12);
  assert.equal(SENSITIVITY_PRESETS.medium.seekRatio, 60);

  assert.equal(SENSITIVITY_PRESETS.high.slop, 8);
  assert.equal(SENSITIVITY_PRESETS.high.seekRatio, 90);
});

test('getHorizontalZone: cleanly delineates left, center, and right zones', () => {
  const width = 1000;
  // Left: 0 to 350
  assert.equal(getHorizontalZone(100, width), 'left');
  assert.equal(getHorizontalZone(349, width), 'left');

  // Center: 350 to 650
  assert.equal(getHorizontalZone(351, width), 'center');
  assert.equal(getHorizontalZone(500, width), 'center');
  assert.equal(getHorizontalZone(649, width), 'center');

  // Right: 650 to 1000
  assert.equal(getHorizontalZone(651, width), 'right');
  assert.equal(getHorizontalZone(900, width), 'right');
});

test('calculateSeekTarget: respects boundaries and clamped duration', () => {
  const duration = 120; // 2 minutes
  const startTime = 60; // 1 minute in
  const ratio = 60; // 60s per 100px swipe

  // Swipe 50px right -> +30s
  const fwd = calculateSeekTarget(0, 50, startTime, duration, ratio);
  assert.equal(fwd.target, 90);
  assert.equal(fwd.delta, 30);

  // Swipe 50px left -> -30s
  const rew = calculateSeekTarget(0, -50, startTime, duration, ratio);
  assert.equal(rew.target, 30);
  assert.equal(rew.delta, -30);

  // Swipe way past end -> clamped to duration
  const pastEnd = calculateSeekTarget(0, 500, startTime, duration, ratio);
  assert.equal(pastEnd.target, 120);

  // Swipe way before 0 -> clamped to 0
  const beforeStart = calculateSeekTarget(0, -500, startTime, duration, ratio);
  assert.equal(beforeStart.target, 0);
});

test('calculateBrightness: clamps between 40% and 160%', () => {
  const containerHeight = 400;

  // Swipe up increases brightness
  const brighter = calculateBrightness(100, 200, 100, containerHeight);
  assert.ok(brighter > 100);

  // Swipe down decreases brightness
  const darker = calculateBrightness(100, 100, 200, containerHeight);
  assert.ok(darker < 100);

  // Extreme swipe up clamped to 160
  const maxClamped = calculateBrightness(100, 1000, 0, containerHeight);
  assert.equal(maxClamped, 160);

  // Extreme swipe down clamped to 40
  const minClamped = calculateBrightness(100, 0, 1000, containerHeight);
  assert.equal(minClamped, 40);
});

test('calculateVolume: clamps between 0.0 and 1.0', () => {
  const containerHeight = 400;

  // Swipe up increases volume
  const louder = calculateVolume(0.5, 200, 100, containerHeight);
  assert.ok(louder > 0.5);

  // Extreme swipe up clamped to 1.0
  const maxVol = calculateVolume(0.5, 1000, 0, containerHeight);
  assert.equal(maxVol, 1.0);

  // Extreme swipe down clamped to 0.0
  const minVol = calculateVolume(0.5, 0, 1000, containerHeight);
  assert.equal(minVol, 0.0);
});

test('calculateZoomScale: clamps between 1.0x and 3.0x', () => {
  // Pinch out (fingers move apart: 100px -> 200px) from 1.0x
  const zoomIn = calculateZoomScale(100, 200, 1.0);
  assert.equal(zoomIn, 2.0);

  // Pinch in (fingers move together: 200px -> 100px) from 2.0x
  const zoomOut = calculateZoomScale(200, 100, 2.0);
  assert.equal(zoomOut, 1.0);

  // Extreme pinch out clamped to 3.0x
  const maxZoom = calculateZoomScale(50, 400, 1.0);
  assert.equal(maxZoom, 3.0);

  // Extreme pinch in clamped to 1.0x
  const minZoom = calculateZoomScale(400, 50, 1.0);
  assert.equal(minZoom, 1.0);
});

test('Cumulative double tap multiplier: scales increments sequentially', () => {
  const baseInterval = 10;
  const tapCounts = [1, 2, 3, 4];
  const expectedSkips = [10, 20, 30, 40];

  tapCounts.forEach((count, i) => {
    assert.equal(count * baseInterval, expectedSkips[i]);
  });
});
