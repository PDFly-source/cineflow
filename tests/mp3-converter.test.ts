import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMp3Signature,
  encodePcmToMp3,
  estimateMp3SizeBytes,
  estimatePeakPcmBytes,
  MP3_BITRATES,
} from '../lib/audio/mp3Converter.ts';

function sine(length: number, freq: number, sampleRate: number, amp = 0.5): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * amp;
  return out;
}

test('isMp3Signature accepts ID3 and MPEG frame sync, rejects other bytes', () => {
  assert.equal(isMp3Signature(new Uint8Array([0x49, 0x44, 0x33, 0x00])), true, 'ID3 tag');
  assert.equal(isMp3Signature(new Uint8Array([0xff, 0xe0, 0x00])), true, 'frame sync FF Ex');
  assert.equal(isMp3Signature(new Uint8Array([0xff, 0xfb, 0x90])), true, 'frame sync FF FB (real MP3)');
  assert.equal(isMp3Signature(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), false, 'EBML/webm rejected');
  assert.equal(isMp3Signature(new Uint8Array([0x52, 0x49, 0x46, 0x46])), false, 'RIFF/wav rejected');
  assert.equal(isMp3Signature(new Uint8Array([0xff, 0x60, 0x00])), false, 'broken sync rejected');
  assert.equal(isMp3Signature(new Uint8Array([0xff])), false, 'too short');
});

test('encodePcmToMp3 produces real MP3 bytes with valid signature (mono)', async () => {
  const sampleRate = 44100;
  // 0.5s of 440 Hz - crosses many 1152-sample blocks
  const pcm = sine(sampleRate / 2, 440, sampleRate);
  const mp3 = await encodePcmToMp3([pcm], sampleRate, 128);

  assert.ok(mp3.length > 1000, 'output has substantial size');
  assert.equal(isMp3Signature(mp3), true, 'starts with a valid MP3 signature');

  // Honest size sanity: 0.5s at 128kbps CBR is ~8000 bytes; allow header slack.
  const expected = estimateMp3SizeBytes(0.5, 128);
  assert.ok(mp3.length > expected * 0.6 && mp3.length < expected * 1.6, `size ${mp3.length} near expected ${expected}`);
});

test('encodePcmToMp3 stereo: two channels encode without error and stay near expected size', async () => {
  const sampleRate = 44100;
  const len = sampleRate; // 1s
  const mp3 = await encodePcmToMp3([sine(len, 440, sampleRate), sine(len, 553, sampleRate)], sampleRate, 192);
  assert.equal(isMp3Signature(mp3), true);
  const expected = estimateMp3SizeBytes(1, 192);
  assert.ok(mp3.length > expected * 0.6 && mp3.length < expected * 1.6);
});

test('encodePcmToMp3 reports progress and supports cancellation', async () => {
  const sampleRate = 44100;
  const pcm = sine(sampleRate * 2, 300, sampleRate);
  let sawEncoding = false;
  let maxPercent = 0;
  let cancelled = false;

  await assert.rejects(
    encodePcmToMp3([pcm], sampleRate, 128, {
      isCancelled: () => cancelled,
      onProgress: (p) => {
        if (p.stage === 'encoding') {
          sawEncoding = true;
          maxPercent = Math.max(maxPercent, p.percent);
          if (p.percent > 10) cancelled = true;
        }
      },
    }),
    (err: Error) => err.message === 'CANCELLED'
  );
  assert.ok(sawEncoding, 'encoding progress reported');
  assert.ok(maxPercent > 10, `progress passed 10% (got ${maxPercent.toFixed(1)}%)`);
});

test('estimateMp3SizeBytes and estimatePeakPcmBytes compute honest approximations', () => {
  assert.equal(estimateMp3SizeBytes(10, 128), 10 * 128000 / 8);
  assert.equal(estimateMp3SizeBytes(0, 320), 0);
  // 1 minute stereo: 60s * 44100 * 2ch * (4B Float32 + 2B Int16) = 31,752,000 B
  const peak = estimatePeakPcmBytes(60, 44100, 2);
  assert.ok(peak > 30_000_000 && peak < 34_000_000);
});

test('MP3_BITRATES offers only the supported CBR set', () => {
  assert.deepEqual([...MP3_BITRATES], [128, 192, 320]);
});
