/**
 * Fix 4 regression tests — local audio clarity presets and the Web Audio
 * chain. No network, no capture; a missing/blocked AudioContext must leave
 * normal playback working.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_PRESETS,
  MAX_BAND_GAIN_DB,
  MIN_BAND_GAIN_DB,
  clampGain,
  getPreset,
  hasAudibleChange,
  headroomDb,
  isBypassed,
  normalizeGains,
} from '../lib/audio/presets.ts';

describe('audio presets (pure)', () => {
  test('the required presets exist and every one is described honestly', () => {
    const ids = AUDIO_PRESETS.map((p) => p.id);
    for (const required of ['off', 'normal', 'voice', 'balanced', 'bass-reduced'] as const) {
      assert.ok(ids.includes(required), `preset ${required} exists`);
    }
    for (const preset of AUDIO_PRESETS) {
      assert.ok(preset.description.length > 10, `${preset.id} has a real description`);
      assert.doesNotMatch(preset.description, /louder|boost volume|increase volume/i, 'no false volume claims');
    }
  });

  test('normal is flat, voice lifts mids and cuts lows, bass-reduced cuts lows hardest', () => {
    assert.deepEqual(getPreset('normal')!.gains, { low: 0, mid: 0, high: 0 });
    const voice = getPreset('voice')!;
    assert.ok(voice.gains.mid > 0 && voice.gains.low < 0);
    assert.ok(voice.highpassHz! >= 80);
    const bassCut = getPreset('bass-reduced')!;
    assert.ok(bassCut.gains.low < voice.gains.low);
  });

  test('gains clamp to the safe window (no extreme amplification)', () => {
    assert.equal(clampGain(99), MAX_BAND_GAIN_DB);
    assert.equal(clampGain(-99), MIN_BAND_GAIN_DB);
    assert.equal(clampGain(Number.NaN), 0);
    assert.deepEqual(normalizeGains({ low: 50, mid: -50, high: 3 }), {
      low: MAX_BAND_GAIN_DB,
      mid: MIN_BAND_GAIN_DB,
      high: 3,
    });
  });

  test('boosts get headroom so the mix cannot clip', () => {
    assert.equal(headroomDb({ low: 0, mid: 0, high: 0 }), 0, 'flat presets get no trim');
    const trimmed = headroomDb({ low: 0, mid: 6, high: 0 });
    assert.ok(trimmed < 0, 'a boost is paired with a negative pre-amp');
    assert.ok(trimmed >= -6, 'trim stays small and predictable');
  });

  test('bypass and audibility flags are accurate', () => {
    assert.equal(isBypassed('off'), true);
    assert.equal(isBypassed('voice'), false);
    assert.equal(hasAudibleChange({ low: 0, mid: 0, high: 0 }), false);
    assert.equal(hasAudibleChange({ low: 0, mid: 2, high: 0 }), true);
  });
});

// ---- Web Audio chain with a mocked AudioContext -------------------------

class MockParam {
  value = 0;
}
class MockNode {
  type = '';
  frequency = new MockParam();
  Q = new MockParam();
  gain = new MockParam();
  threshold = new MockParam();
  knee = new MockParam();
  ratio = new MockParam();
  attack = new MockParam();
  release = new MockParam();
  connections: MockNode[] = [];
  connect(node: MockNode) {
    this.connections.push(node);
    return node;
  }
}
class MockAudioContext {
  static instances = 0;
  state = 'running';
  destination = new MockNode();
  sourceCreated = 0;
  resumed = 0;
  closed = 0;
  constructor() {
    MockAudioContext.instances += 1;
  }
  createMediaElementSource() {
    this.sourceCreated += 1;
    if (this.sourceCreated > 1) throw new Error('element already captured');
    return new MockNode();
  }
  createBiquadFilter() {
    return new MockNode();
  }
  createGain() {
    return new MockNode();
  }
  createDynamicsCompressor() {
    return new MockNode();
  }
  async resume() {
    this.resumed += 1;
    this.state = 'running';
  }
  async close() {
    this.closed += 1;
  }
}

const fakeElement = () => ({ tagName: 'VIDEO' }) as unknown as HTMLMediaElement;

describe('createAudioEnhancer', () => {
  test('without Web Audio support it is inert and playback is untouched', async () => {
    const { createAudioEnhancer } = await import('../lib/audio/enhancer.ts');
    const enhancer = createAudioEnhancer(null);
    assert.equal(await enhancer.applyPreset('voice'), false);
    assert.equal(enhancer.isActive(), false);
    assert.doesNotThrow(() => enhancer.dispose());
  });

  test('applying a preset builds one graph, resumes the context and sets real gains', async () => {
    (globalThis as { window?: unknown }).window = { AudioContext: MockAudioContext };
    const { createAudioEnhancer } = await import('../lib/audio/enhancer.ts');
    const before = MockAudioContext.instances;
    const enhancer = createAudioEnhancer(fakeElement());
    const ok = await enhancer.applyPreset('voice');
    assert.equal(ok, true);
    assert.equal(MockAudioContext.instances, before + 1, 'exactly one AudioContext');
    assert.equal(enhancer.isActive(), true);
    assert.deepEqual(enhancer.getGains(), getPreset('voice')!.gains);
    enhancer.dispose();
  });

  test('the same element is never captured twice (re-render safety)', async () => {
    (globalThis as { window?: unknown }).window = { AudioContext: MockAudioContext };
    const { createAudioEnhancer } = await import('../lib/audio/enhancer.ts');
    const el = fakeElement();
    const first = createAudioEnhancer(el);
    assert.equal(await first.applyPreset('balanced'), true);
    first.dispose();
    const second = createAudioEnhancer(el);
    assert.equal(await second.applyPreset('voice'), true, 'second enhancer reuses the cached graph');
    second.dispose();
  });

  test('band edits clamp to the safe window', async () => {
    (globalThis as { window?: unknown }).window = { AudioContext: MockAudioContext };
    const { createAudioEnhancer } = await import('../lib/audio/enhancer.ts');
    const enhancer = createAudioEnhancer(fakeElement());
    await enhancer.setBand('mid', 99);
    assert.equal(enhancer.getGains().mid, MAX_BAND_GAIN_DB);
    await enhancer.setBand('mid', -99);
    assert.equal(enhancer.getGains().mid, MIN_BAND_GAIN_DB);
    enhancer.dispose();
  });

  test('off/reset return to the untouched signal and leave the element playing', async () => {
    (globalThis as { window?: unknown }).window = { AudioContext: MockAudioContext };
    const { createAudioEnhancer } = await import('../lib/audio/enhancer.ts');
    const enhancer = createAudioEnhancer(fakeElement());
    await enhancer.applyPreset('voice');
    await enhancer.applyPreset('off');
    assert.deepEqual(enhancer.getGains(), { low: 0, mid: 0, high: 0 });
    await enhancer.reset();
    assert.equal(enhancer.isActive(), false);
    enhancer.dispose();
  });

  test('a throwing AudioContext never breaks playback', async () => {
    class BrokenContext extends MockAudioContext {
      createMediaElementSource(): MockNode {
        throw new Error('SecurityError: cannot capture');
      }
    }
    (globalThis as { window?: unknown }).window = { AudioContext: BrokenContext };
    const { createAudioEnhancer } = await import('../lib/audio/enhancer.ts');
    const enhancer = createAudioEnhancer(fakeElement());
    const ok = await enhancer.applyPreset('voice');
    assert.equal(ok, false, 'reports failure honestly');
    assert.equal(enhancer.isActive(), false);
    enhancer.dispose();
  });
});
