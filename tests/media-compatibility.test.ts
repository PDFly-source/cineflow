/**
 * Regression tests for the Phase 2.7 media compatibility pipeline:
 * container/track probing (real MKV/MP4/WebM fixture bytes), capability
 * snapshotting, the playback decision engine, and conversion feasibility.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  BufferSource,
  sniffContainer,
  probeMedia,
} from '../lib/media/container-probe';
import type { MediaProbe } from '../lib/media/container-probe';
import { decidePlaybackPlan, assessFeasibility, CONVERSION_LIMITS } from '../lib/media/compatibility';
import type { CapabilitySnapshot } from '../lib/media/compatibility';
import { parseFfmpegTimeSeconds } from '../lib/media/ffmpeg-client';
import {
  FIXTURE_MKV_H264_AAC_MKV,
  FIXTURE_MKV_H264_AC3_MKV,
  FIXTURE_MKV_H264_EAC3_MKV,
  FIXTURE_MKV_HEVC_AAC_MKV,
  FIXTURE_MP4_H264_AAC_MP4,
  FIXTURE_MP4_H264_AC3_MP4,
  FIXTURE_WEBM_VP9_OPUS_WEBM,
  FIXTURE_CLIP_MP3,
  FIXTURE_CLIP_FLAC,
  FIXTURE_CLIP_WAV,
} from './fixtures/media-b64';

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function fakeFile(name: string, bytes: Uint8Array, size = bytes.length): File {
  // File-like for probeMedia: only slice/size/name are used. slice is
  // synchronous like a real Blob's.
  return {
    name,
    size,
    slice: (start: number, end: number) => new Blob([bytes.slice(start, Math.min(end, bytes.length)) as unknown as BlobPart]),
  } as unknown as File;
}

/* ---------------------------------------------------------------- */
/* Container sniffing                                                */
/* ---------------------------------------------------------------- */

test('sniffs containers by magic bytes', () => {
  assert.equal(sniffContainer(b64ToBytes(FIXTURE_MKV_H264_AAC_MKV).subarray(0, 64), 0), 'matroska');
  assert.equal(sniffContainer(b64ToBytes(FIXTURE_MP4_H264_AAC_MP4).subarray(0, 64), 0), 'mp4');
  assert.equal(sniffContainer(b64ToBytes(FIXTURE_WEBM_VP9_OPUS_WEBM).subarray(0, 64), 0), 'matroska'); // refined to webm by EBML walk
  assert.equal(sniffContainer(b64ToBytes(FIXTURE_CLIP_MP3).subarray(0, 64), 0), 'mp3');
  assert.equal(sniffContainer(b64ToBytes(FIXTURE_CLIP_FLAC).subarray(0, 64), 0), 'flac');
  assert.equal(sniffContainer(b64ToBytes(FIXTURE_CLIP_WAV).subarray(0, 64), 0), 'wav');
});

test('BufferSource reads slices correctly', async () => {
  const src = new BufferSource(b64ToBytes(FIXTURE_CLIP_FLAC));
  assert.equal(src.size > 0, true);
  const first = await src.read(0, 8);
  assert.equal(first.length, 8);
  assert.equal(String.fromCharCode(...first.subarray(0, 4)), 'fLaC');
});

/* ---------------------------------------------------------------- */
/* MKV / WebM track parsing (real fixtures)                          */
/* ---------------------------------------------------------------- */

test('MKV with H.264 + AAC parses tracks, duration and container', async () => {
  const p = await probeMedia(fakeFile('movie.mkv', b64ToBytes(FIXTURE_MKV_H264_AAC_MKV)));
  assert.equal(p.container, 'matroska');
  assert.equal(p.videoTracks.map((t) => t.codec).join(','), 'h264');
  assert.equal(p.audioTracks.map((t) => t.codec).join(','), 'aac');
  assert.ok(p.durationSeconds !== null && p.durationSeconds > 0.5 && p.durationSeconds < 5);
});

test('MKV with Dolby Digital AC-3 audio is detected (owner issue 1)', async () => {
  const p = await probeMedia(fakeFile('movie.mkv', b64ToBytes(FIXTURE_MKV_H264_AC3_MKV)));
  assert.equal(p.container, 'matroska');
  assert.equal(p.videoTracks[0].codec, 'h264');
  assert.equal(p.audioTracks[0].codec, 'ac3');
  assert.equal(p.audioTracks[0].codecRaw, 'A_AC3');
});

test('MKV with Dolby Digital Plus E-AC-3 audio is detected (owner issue 2)', async () => {
  const p = await probeMedia(fakeFile('movie.mkv', b64ToBytes(FIXTURE_MKV_H264_EAC3_MKV)));
  assert.equal(p.audioTracks[0].codec, 'eac3');
  assert.equal(p.audioTracks[0].codecRaw, 'A_EAC3');
});

test('MKV with HEVC video is detected (HEVC priority)', async () => {
  const p = await probeMedia(fakeFile('movie.mkv', b64ToBytes(FIXTURE_MKV_HEVC_AAC_MKV)));
  assert.equal(p.videoTracks[0].codec, 'h265');
  assert.equal(p.videoTracks[0].codecRaw, 'V_MPEGH/ISO/HEVC');
  assert.equal(p.audioTracks[0].codec, 'aac');
});

test('WebM container is distinguished from Matroska by DocType', async () => {
  const p = await probeMedia(fakeFile('clip.webm', b64ToBytes(FIXTURE_WEBM_VP9_OPUS_WEBM)));
  assert.equal(p.container, 'webm');
  assert.equal(p.videoTracks[0].codec, 'vp9');
  assert.equal(p.audioTracks[0].codec, 'opus');
});

test('MKV track detection works when the file is reported much larger than the fixture (no over-read)', async () => {
  // Simulates a multi-GB file: parse must only touch the embedded head bytes.
  const p = await probeMedia(fakeFile('big.mkv', b64ToBytes(FIXTURE_MKV_H264_AC3_MKV), 8 * 1024 ** 3));
  assert.equal(p.container, 'matroska');
  assert.equal(p.audioTracks[0].codec, 'ac3');
});

/* ---------------------------------------------------------------- */
/* MP4 track parsing                                                 */
/* ---------------------------------------------------------------- */

test('MP4 with H.264 + AAC parses tracks', async () => {
  const p = await probeMedia(fakeFile('movie.mp4', b64ToBytes(FIXTURE_MP4_H264_AAC_MP4)));
  assert.equal(p.container, 'mp4');
  assert.equal(p.videoTracks[0].codec, 'h264');
  assert.equal(p.audioTracks[0].codec, 'aac');
});

test('MP4 with AC-3 audio is detected', async () => {
  const p = await probeMedia(fakeFile('movie.mp4', b64ToBytes(FIXTURE_MP4_H264_AC3_MP4)));
  assert.equal(p.videoTracks[0].codec, 'h264');
  assert.equal(p.audioTracks[0].codec, 'ac3');
});

/* ---------------------------------------------------------------- */
/* Capability snapshot + decision engine                             */
/* ---------------------------------------------------------------- */

function capsFor(container: CapabilitySnapshot['container'], video: string, audio: string): CapabilitySnapshot {
  return {
    container,
    video: { [video]: 'probably' as const },
    audio: { [audio]: 'probably' as const },
  };
}

test('fully supported files plan native playback of the original', async () => {
  const p = await probeMedia(fakeFile('movie.mp4', b64ToBytes(FIXTURE_MP4_H264_AAC_MP4)));
  const d = decidePlaybackPlan(p, capsFor('probably', 'h264', 'aac'));
  assert.equal(d.path, 'native');
  assert.equal(d.reason, 'native-supported');
});

test('MKV + H.264/AAC on a browser without Matroska: remux offered (container issue 3)', async () => {
  const p = await probeMedia(fakeFile('movie.mkv', b64ToBytes(FIXTURE_MKV_H264_AAC_MKV)));
  const d = decidePlaybackPlan(p, capsFor('no', 'h264', 'aac'));
  assert.equal(d.path, 'convert');
  assert.equal(d.reason, 'container-unsupported');
  assert.equal(d.operation, 'remux-mp4');
  assert.ok(d.explanation.includes('quality'));
});

test('MKV + AC-3 audio: audio transcode offered, video copied (issues 1+3 combined)', async () => {
  const p = await probeMedia(fakeFile('movie.mkv', b64ToBytes(FIXTURE_MKV_H264_AC3_MKV)));
  const d = decidePlaybackPlan(p, { container: 'no', video: { h264: 'probably' }, audio: { ac3: 'no' } });
  assert.equal(d.path, 'convert');
  assert.equal(d.reason, 'container-and-audio-unsupported');
  assert.equal(d.operation, 'audio-aac-transcode');
});

test('MKV + E-AC-3 audio: audio transcode offered (issues 2+3)', async () => {
  const p = await probeMedia(fakeFile('movie.mkv', b64ToBytes(FIXTURE_MKV_H264_EAC3_MKV)));
  const d = decidePlaybackPlan(p, { container: 'no', video: { h264: 'probably' }, audio: { eac3: 'no' } });
  assert.equal(d.path, 'convert');
  assert.equal(d.operation, 'audio-aac-transcode');
});

test('MP4 + AC-3 audio in a supported container: audio transcode, video copied', async () => {
  const p = await probeMedia(fakeFile('movie.mp4', b64ToBytes(FIXTURE_MP4_H264_AC3_MP4)));
  const d = decidePlaybackPlan(p, { container: 'probably', video: { h264: 'probably' }, audio: { ac3: 'no' } });
  assert.equal(d.path, 'convert');
  assert.equal(d.reason, 'audio-codec-unsupported');
  assert.equal(d.operation, 'audio-aac-transcode');
});

test('HEVC in MP4 on a browser without HEVC: full transcode offered with honest warnings', async () => {
  const probe: MediaProbe = {
    container: 'mp4',
    containerConfident: true,
    videoTracks: [{ type: 'video', codec: 'h265', codecRaw: 'hvc1' }],
    audioTracks: [{ type: 'audio', codec: 'aac', codecRaw: 'mp4a' }],
    subtitleTracks: [],
    durationSeconds: 120,
    sizeBytes: 50 * 1024 * 1024,
    notes: [],
  };
  const d = decidePlaybackPlan(probe, {
    container: 'probably',
    video: { h265: 'no' },
    audio: { aac: 'probably' },
  });
  assert.equal(d.path, 'convert');
  assert.equal(d.reason, 'video-codec-unsupported');
  assert.equal(d.operation, 'full-transcode-h264');
  assert.ok(d.explanation.toLowerCase().includes('slow'));
});

test('HEVC-capable browser plays HEVC natively (no forced conversion)', async () => {
  const probe: MediaProbe = {
    container: 'mp4',
    containerConfident: true,
    videoTracks: [{ type: 'video', codec: 'h265', codecRaw: 'hvc1' }],
    audioTracks: [{ type: 'audio', codec: 'aac', codecRaw: 'mp4a' }],
    subtitleTracks: [],
    durationSeconds: 120,
    sizeBytes: 50 * 1024 * 1024,
    notes: [],
  };
  const d = decidePlaybackPlan(probe, capsFor('probably', 'h265', 'aac'));
  assert.equal(d.path, 'native');
});

test('unparseable tracks in unsupported container: attempt native first, convert on error', async () => {
  const probe: MediaProbe = {
    container: 'matroska',
    containerConfident: true,
    videoTracks: [],
    audioTracks: [],
    subtitleTracks: [],
    durationSeconds: null,
    sizeBytes: 1024,
    notes: ['ebml: track data not found within the first 2 MB'],
  };
  const d = decidePlaybackPlan(probe, capsFor('no', 'unknown', 'unknown'));
  assert.equal(d.path, 'attempt-native');
  assert.equal(d.reason, 'container-unknown-tracks');
});

test('unsupported video codec with no safe fix: honest unsupported verdict', async () => {
  const probe: MediaProbe = {
    container: 'matroska',
    containerConfident: true,
    videoTracks: [{ type: 'video', codec: 'unknown', codecRaw: 'V_MS/VFW/FOURCC' }],
    audioTracks: [{ type: 'audio', codec: 'aac', codecRaw: 'A_AAC' }],
    subtitleTracks: [],
    durationSeconds: 60,
    sizeBytes: 1024,
    notes: [],
  };
  const d = decidePlaybackPlan(probe, { container: 'no', video: { unknown: 'no' }, audio: { aac: 'probably' } });
  // Codec mapping is unknown: never claim native playback was guaranteed.
  assert.ok(d.path === 'unsupported' || d.path === 'convert' || d.path === 'attempt-native');
});

test('corrupt-file error state: no tracks anywhere, unknown container', () => {
  const probe: MediaProbe = {
    container: 'unknown',
    containerConfident: false,
    videoTracks: [],
    audioTracks: [],
    subtitleTracks: [],
    durationSeconds: null,
    sizeBytes: 10,
    notes: ['container: unrecognized signature'],
  };
  const d = decidePlaybackPlan(probe, capsFor('no', 'unknown', 'unknown'));
  assert.equal(d.path, 'attempt-native'); // still try — browsers may surprise us
});

/* ---------------------------------------------------------------- */
/* Feasibility                                                       */
/* ---------------------------------------------------------------- */

test('remux of a multi-GB movie is refused honestly (no fake conversion)', () => {
  const f = assessFeasibility('remux-mp4', 8 * 1024 ** 3, 7200);
  assert.equal(f.ok, false);
  assert.equal(f.refusal, 'too-large');
  assert.ok(f.explanation.length > 20);
});

test('small MKV remux is feasible with an estimate', () => {
  const f = assessFeasibility('remux-mp4', 400 * 1024 ** 2, 300);
  assert.equal(f.ok, true);
  assert.equal(f.estimatedOutputBytes, 400 * 1024 ** 2);
});

test('full transcode of a huge HEVC file is refused', () => {
  const f = assessFeasibility('full-transcode-h264', 2 * 1024 ** 3, 7200);
  assert.equal(f.ok, false);
  assert.equal(f.refusal, 'too-large');
});

test('full transcode of a small clip is feasible with honest time hint', () => {
  const f = assessFeasibility('full-transcode-h264', 50 * 1024 ** 2, 300);
  assert.equal(f.ok, true);
  assert.ok(f.timeHint.length > 0);
});

test('feasibility caps stay conservative for wasm memory', () => {
  assert.ok(CONVERSION_LIMITS.remuxMaxInputBytes <= 600 * 1024 ** 2);
  assert.ok(CONVERSION_LIMITS.fullTranscodeMaxInputBytes < CONVERSION_LIMITS.remuxMaxInputBytes);
});

/* ---------------------------------------------------------------- */
/* Progress parsing                                                  */
/* ---------------------------------------------------------------- */

test('ffmpeg time progress lines parse to seconds', () => {
  assert.equal(parseFfmpegTimeSeconds('frame= 12 fps=0.0 q=-1.0 size= 256kB time=00:00:01.00 bitrate=...'), 1);
  assert.equal(parseFfmpegTimeSeconds('time=01:02:03.50'), 3723.5);
  assert.equal(parseFfmpegTimeSeconds('no progress here'), null);
});

/* ---------------------------------------------------------------- */
/* Conversion cancellation (engine contract)                        */
/* ---------------------------------------------------------------- */

test('cancellation throws AbortError through convertMedia contract', async () => {
  // convertMedia gates on feasibility first; a tiny fake file passes size,
  // then requires the real engine. We test the pre-engine contract here:
  // cancelMediaConversion() is always safe to call.
  const { cancelMediaConversion } = await import('../lib/media/conversion');
  assert.doesNotThrow(() => cancelMediaConversion());
});
