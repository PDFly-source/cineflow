/**
 * Fix 2 regression tests — real screen rotation, native bridge first.
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
  getNativeOrientationBridge,
} from '../lib/player/screen-orientation.ts';

const noWait = async () => {};

describe('screen-orientation helpers', () => {
  test('isLandscapeType recognises landscape-primary/secondary only', () => {
    assert.equal(isLandscapeType('landscape-primary'), true);
    assert.equal(isLandscapeType('landscape-secondary'), true);
    assert.equal(isLandscapeType('portrait-primary'), false);
    assert.equal(isLandscapeType(''), false);
  });

  test('nextOrientationTarget toggles portrait <-> landscape', () => {
    assert.equal(nextOrientationTarget('portrait-primary'), 'landscape');
    assert.equal(nextOrientationTarget('landscape-primary'), 'portrait');
  });

  test('supportsOrientationLock requires a lock function', () => {
    assert.equal(supportsOrientationLock({ type: 'portrait-primary', lock: async () => {} }), true);
    assert.equal(supportsOrientationLock({ type: 'portrait-primary' }), false);
    assert.equal(supportsOrientationLock(null), false);
  });

  test('fallback message does not claim the screen rotated', () => {
    assert.match(ROTATE_SCREEN_FALLBACK_MESSAGE, /Rotate your phone/i);
    assert.doesNotMatch(ROTATE_SCREEN_FALLBACK_MESSAGE, /rotated|done|success/i);
  });
});

describe('requestScreenRotation — native bridge (APK)', () => {
  test('uses the native bridge first and reports success without touching the web API', async () => {
    const calls: string[] = [];
    let fullscreenCalls = 0;
    const native = { lockOrientation: (o: string) => { calls.push(o); return true; } };
    const so = { type: 'portrait-primary', lock: async () => { calls.push('web-lock'); }, unlock: () => {} };
    const result = await requestScreenRotation(
      async () => { fullscreenCalls += 1; },
      so,
      { native, wait: noWait }
    );
    assert.equal(result, 'locked');
    assert.deepEqual(calls, ['landscape'], 'native landscape requested, web lock not used');
    assert.equal(fullscreenCalls, 0, 'native route does not need fullscreen');
  });

  test('native refusal falls through to the web route (never a fake success)', async () => {
    let locked: string | null = null;
    const native = { lockOrientation: () => false };
    const so = { type: 'portrait-primary', lock: async (o: string) => { locked = o; }, unlock: () => {} };
    const result = await requestScreenRotation(async () => {}, so, { native, wait: noWait });
    assert.equal(result, 'locked');
    assert.equal(locked, 'landscape');
  });

  test('portrait target when currently landscape', async () => {
    const targets: string[] = [];
    const native = { lockOrientation: (o: string) => { targets.push(o); return true; } };
    const result = await requestScreenRotation(async () => {}, { type: 'landscape-primary' }, { native, wait: noWait });
    assert.equal(result, 'locked');
    assert.deepEqual(targets, ['portrait']);
  });
});

describe('requestScreenRotation — web API', () => {
  test('returns fallback when lock is unsupported and no native bridge exists', async () => {
    const result = await requestScreenRotation(async () => {}, { type: 'portrait-primary' }, { native: null, wait: noWait });
    assert.equal(result, 'fallback', 'no lock function must mean fallback, never a fake success');
  });

  test('enters fullscreen from the gesture, then locks landscape', async () => {
    let fullscreenEntered = false;
    let locked: string | null = null;
    const so = { type: 'portrait-primary', lock: async (o: string) => { locked = o; }, unlock: () => {} };
    const result = await requestScreenRotation(
      async () => { fullscreenEntered = true; },
      so,
      { native: null, wait: noWait }
    );
    assert.equal(result, 'locked');
    assert.equal(fullscreenEntered, true, 'fullscreen requested before the lock');
    assert.equal(locked, 'landscape');
  });

  test('retries the lock once when the first attempt is rejected', async () => {
    let attempts = 0;
    const so = {
      type: 'portrait-primary',
      lock: async () => { attempts += 1; if (attempts === 1) throw new Error('NotSupportedError'); },
      unlock: () => {},
    };
    const result = await requestScreenRotation(async () => {}, so, { native: null, wait: noWait });
    assert.equal(result, 'locked');
    assert.equal(attempts, 2, 'exactly one retry');
  });

  test('two rejections return fallback (honest)', async () => {
    let attempts = 0;
    const so = { type: 'portrait-primary', lock: async () => { attempts += 1; throw new Error('no'); }, unlock: () => {} };
    const result = await requestScreenRotation(async () => {}, so, { native: null, wait: noWait });
    assert.equal(result, 'fallback');
    assert.equal(attempts, 2);
  });

  test('a rejected fullscreen request does not abort the lock attempt', async () => {
    let locked = false;
    const so = { type: 'portrait-primary', lock: async () => { locked = true; }, unlock: () => {} };
    const result = await requestScreenRotation(async () => { throw new Error('fullscreen denied'); }, so, { native: null, wait: noWait });
    assert.equal(result, 'locked');
    assert.equal(locked, true);
  });

  test('waits for the fullscreen transition before locking', async () => {
    const order: string[] = [];
    const so = { type: 'portrait-primary', lock: async () => { order.push('lock'); }, unlock: () => {} };
    await requestScreenRotation(async () => { order.push('fullscreen'); }, so, {
      native: null,
      wait: async () => { order.push('settle'); },
    });
    assert.deepEqual(order, ['fullscreen', 'settle', 'lock']);
  });
});

describe('releaseScreenOrientation', () => {
  test('unlocks the web API and returns a native override to auto', () => {
    let webUnlocked = false;
    const targets: string[] = [];
    releaseScreenOrientation({ type: 'landscape-primary', unlock: () => { webUnlocked = true; } }, {
      lockOrientation: (o: string) => { targets.push(o); return true; },
    });
    assert.equal(webUnlocked, true);
    assert.deepEqual(targets, ['auto']);
  });

  test('never throws when unlock is unavailable or rejects', () => {
    assert.doesNotThrow(() => releaseScreenOrientation(null, null));
    assert.doesNotThrow(() => releaseScreenOrientation({ type: 'x', unlock: () => { throw new Error('nope'); } }, null));
  });
});

describe('getNativeOrientationBridge', () => {
  test('returns null outside the APK / without the lockOrientation method', () => {
    assert.equal(getNativeOrientationBridge(), null);
    (globalThis as { window?: unknown }).window = { AppMintlyNative: {} };
    assert.equal(getNativeOrientationBridge(), null);
    (globalThis as { window?: unknown }).window = {
      AppMintlyNative: { lockOrientation: () => true },
    };
    assert.ok(getNativeOrientationBridge());
    delete (globalThis as { window?: unknown }).window;
  });
});
