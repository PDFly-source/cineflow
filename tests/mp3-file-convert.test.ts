/**
 * Regression tests for convertFileToMp3 with a MOCKED WebAudio AudioContext.
 * These exercise the full file->decode->encode->verify path in Node,
 * with the decoder stubbed. Real LAME encoding still runs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// --- Mock WebAudio environment (must exist before importing the lib) ---
let closeCount = 0;
let decodeCalls = 0;
let decodeImpl: (raw: ArrayBuffer) => AudioBuffer = () => makeBuffer(2, 44100, 44100);

function makeBuffer(channels: number, sampleRate: number, length: number): AudioBuffer {
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    const ch = new Float32Array(length);
    for (let i = 0; i < length; i++) ch[i] = Math.sin((2 * Math.PI * (440 + c * 110) * i) / sampleRate) * 0.4;
    data.push(ch);
  }
  return {
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: (c: number) => data[c],
  } as unknown as AudioBuffer;
}

class MockAudioContext {
  sampleRate = 44100;
  decodeAudioData(raw: ArrayBuffer): Promise<AudioBuffer> {
    decodeCalls++;
    void raw;
    return Promise.resolve().then(() => decodeImpl(raw));
  }
  close(): Promise<void> {
    closeCount++;
    return Promise.resolve();
  }
}

(globalThis as unknown as { window: unknown }).window = { AudioContext: MockAudioContext };

// Loaded lazily (after the window mock exists) because tests run as CJS without top-level await.
const lib = async () => await import('../lib/audio/mp3Converter.ts');

function fakeFile(name = 'clip.webm'): File {
  return new File([new Uint8Array(2048)], name, { type: 'video/webm' });
}

test('convertFileToMp3: full mocked path produces a real MP3 and closes the decoder', async () => {
  closeCount = 0;
  decodeImpl = () => makeBuffer(2, 44100, 44100); // 1s stereo
  const { convertFileToMp3 } = await lib();
  const res = await convertFileToMp3(fakeFile(), { bitrate: 128 });
  const { isMp3Signature } = await lib();
  assert.equal(isMp3Signature(new Uint8Array(await res.blob.arrayBuffer())), true, 'real MP3 bytes');
  assert.equal(res.channels, 2);
  assert.equal(res.sampleRate, 44100);
  assert.ok(Math.abs(res.durationSeconds - 1) < 0.01);
  assert.ok(res.byteLength > 4000, `substantial output (~${res.byteLength}B for 1s @128kbps)`);
  assert.equal(closeCount, 1, 'AudioContext closed exactly once (memory cleanup)');
  assert.equal(decodeCalls, 1);
});

test('convertFileToMp3: undecodable input yields the honest codec error', async () => {
  decodeImpl = () => {
    throw new Error('unsupported codec');
  };
  const { convertFileToMp3 } = await lib();
  await assert.rejects(
    convertFileToMp3(fakeFile('weird.mkv')),
    (err: Error) =>
      err.message.includes('could not decode the audio from "weird.mkv"') &&
      err.message.includes('Nothing was uploaded') === false // no accidental claims
  );
  assert.ok(closeCount >= 1, 'decoder still cleaned up after the failure');
});

test('convertFileToMp3: zero-length decoded audio is rejected honestly', async () => {
  decodeImpl = () => makeBuffer(1, 44100, 0);
  const { convertFileToMp3 } = await lib();
  await assert.rejects(convertFileToMp3(fakeFile()), /no decodable audio/);
});

test('convertFileToMp3: cancellation mid-encode rejects with CANCELLED and produces nothing', async () => {
  decodeImpl = () => makeBuffer(2, 44100, 44100 * 3); // 3s: several blocks
  const { convertFileToMp3 } = await lib();
  let cancelled = false;
  const progressStages: string[] = [];
  await assert.rejects(
    convertFileToMp3(fakeFile(), {
      bitrate: 192,
      isCancelled: () => cancelled,
      onProgress: (p) => {
        progressStages.push(p.stage);
        if (p.stage === 'encoding' && p.percent > 5) cancelled = true;
      },
    }),
    (err: Error) => err.message === 'CANCELLED'
  );
  assert.ok(progressStages.includes('decoding'), 'decoding stage reported');
  assert.ok(progressStages.includes('encoding'), 'encoding stage reported');
  assert.equal(closeCount >= 1, true, 'decoder cleaned up after cancel');
});
