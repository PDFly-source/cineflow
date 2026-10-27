/**
 * Phase 2.3 unit tests for the real Screen Orientation integration.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROTATE_SCREEN_FALLBACK_MESSAGE,
  isLandscapeType,
  nextOrientationTarget,
  supportsOrientationLock,
  requestScreenRotation,
  releaseScreenOrientation,
} from '../lib/player/screen-orientation.ts';

describe('screen-orientation helpers', () => {
  test('isLandscapeType recognises landscape-primary/secondary only', () => {
    assert.equal(isLandscapeType('landscape-primary'), true);
    assert.equal(isLandscapeType('landscape-secondary'), true);
    assert.equal(isLandscapeType('portrait-primary'), false);
    assert.equal(isLandscapeType('portrait-secondary'), false);
    assert.equal(isLandscapeType(''), false);
  });

  test('nextOrientationTarget toggles portrait <-> landscape', () => {
    assert.equal(nextOrientationTarget('portrait-primary'), 'landscape');
    assert.equal(nextOrientationTarget('portrait-secondary'), 'landscape');
    assert.equal(nextOrientationTarget('landscape-primary'), 'portrait');
    assert.equal(nextOrientationTarget('landscape-secondary'), 'portrait');
  });

  test('supportsOrientationLock requires a lock function', () => {
    assert.equal(supportsOrientationLock({ type: 'portrait-primary', lock: async () => {}, unlock: () => {} }), true);
    assert.equal(supportsOrientationLock({ type: 'portrait-primary' }), false);
    assert.equal(supportsOrientationLock(null), false);
  });

  test('requestScreenRotation returns fallback when lock is unsupported', async () => {
    const result = await requestScreenRotation(async () => {}, { type: 'portrait-primary' });
    assert.equal(result, 'fallback', 'no lock function must mean fallback, never a fake success');
  });

  test('requestScreenRotation locks landscape after entering fullscreen from portrait', async () => {
    let fullscreenEntered = false;
    let locked: string | null = null;
    const so = {
      type: 'portrait-primary',
      lock: async (o: string) => { locked = o; },
      unlock: () => {},
    };
    const result = await requestScreenRotation(async () => { fullscreenEntered = true; }, so);
    assert.equal(result, 'locked');
    assert.equal(fullscreenEntered, true, 'fullscreen is requested before the lock');
    assert.equal(locked, 'landscape', 'portrait screen locks landscape');
  });

  test('requestScreenRotation does not re-request fullscreen when already fullscreen', async () => {
    (globalThis as { document?: unknown }).document = { fullscreenElement: {} };
    let fullscreenCalls = 0;
    const so = { type: 'landscape-primary', lock: async () => {}, unlock: () => {} };
    const result = await requestScreenRotation(async () => { fullscreenCalls += 1; }, so);
    assert.equal(result, 'locked');
    assert.equal(fullscreenCalls, 0, 'already fullscreen -> no extra request');
    assert.equal(fullscreenCalls, 0);
    (globalThis as { document?: unknown }).document = undefined;
  });

  test('requestScreenRotation returns fallback when the lock rejects (Android/PWA behaviour)', async () => {
    (globalThis as { document?: unknown }).document = { fullscreenElement: {} };
    const so = {
      type: 'portrait-primary',
      lock: async () => { throw new DOMException('not allowed', 'NotAllowedError'); },
      unlock: () => {},
    };
    const result = await requestScreenRotation(async () => {}, so);
    assert.equal(result, 'fallback', 'rejections must surface as fallback, not as success');
    (globalThis as { document?: unknown }).document = undefined;
  });

  test('releaseScreenOrientation is best-effort and never throws', () => {
    releaseScreenOrientation({ type: 'portrait-primary', unlock: () => { throw new Error('no lock'); } });
    releaseScreenOrientation({ type: 'portrait-primary' });
    releaseScreenOrientation(null);
  });

  test('fallback message is the agreed truthful copy', () => {
    assert.equal(
      ROTATE_SCREEN_FALLBACK_MESSAGE,
      'Rotate your phone to landscape; automatic rotation depends on your device settings.'
    );
  });
});
