/**
 * Playback decision engine: turns a MediaProbe + browser capability snapshot
 * into an honest, ordered playback plan.
 *
 * Principles:
 *  - Native playback of the ORIGINAL file is always preferred when plausible.
 *  - A conversion is offered (never automatic) only when it can genuinely
 *    fix the problem: remux for container issues (stream copy, zero quality
 *    loss), audio transcode for AC-3/E-AC-3/DTS/TrueHD, full transcode for
 *    HEVC on unsupported devices (slow, clearly warned).
 *  - Feasibility is honest: in-browser FFmpeg is a single-threaded wasm build;
 *    conversion output must fit in WebAssembly memory. Large files get native
 *    playback only, with a truthful explanation.
 */

import type { AudioCodecId, MediaProbe, VideoCodecId } from './container-probe';
import { probeAudioCodec, probeContainer, probeVideoCodec } from './capability-probe';

export type ConversionOp = 'remux-mp4' | 'audio-aac-transcode' | 'full-transcode-h264';

export interface PlaybackDecision {
  path: 'native' | 'attempt-native' | 'convert' | 'unsupported';
  /** Machine-readable root cause, stable for tests and UI copy. */
  reason: string;
  /** Human explanation shown in the compatibility dialog / diagnostics. */
  explanation: string;
  /** Ordered user-facing detail lines. */
  detail: string[];
  /** Set when path === 'convert'. */
  operation?: ConversionOp;
}

export interface CapabilitySnapshot {
  container: 'probably' | 'maybe' | 'no';
  video: Record<string, 'probably' | 'maybe' | 'no'>;
  audio: Record<string, 'probably' | 'maybe' | 'no'>;
}

export function snapshotCapabilities(probe: MediaProbe): CapabilitySnapshot {
  const audio: CapabilitySnapshot['audio'] = {};
  for (const t of probe.audioTracks) {
    if (!(t.codec in audio)) audio[t.codec] = probeAudioCodec(t.codec as AudioCodecId).canPlay;
  }
  const video: CapabilitySnapshot['video'] = {};
  for (const t of probe.videoTracks) {
    if (!(t.codec in video)) video[t.codec] = probeVideoCodec(t.codec as VideoCodecId).canPlay;
  }
  return { container: probeContainer(probe.container), video, audio };
}

const AUDIO_FIXABLE: AudioCodecId[] = ['ac3', 'eac3', 'dts', 'truehd', 'unknown'];

export function decidePlaybackPlan(probe: MediaProbe, caps: CapabilitySnapshot): PlaybackDecision {
  const vCodecs = probe.videoTracks.map((t) => t.codec as VideoCodecId);
  const aCodecs = probe.audioTracks.map((t) => t.codec as AudioCodecId);
  const primaryVideo = vCodecs[0];
  const primaryAudio = aCodecs[0];

  const videoNative =
    vCodecs.length === 0 || (primaryVideo !== undefined && caps.video[primaryVideo] !== 'no' && primaryVideo !== 'unknown');
  const audioNative =
    aCodecs.length === 0 || (primaryAudio !== undefined && caps.audio[primaryAudio] !== 'no' && primaryAudio !== 'unknown');
  const containerNative = caps.container !== 'no';

  // Case: everything the probe found is natively accepted — play the original.
  if (containerNative && videoNative && audioNative) {
    return {
      path: 'native',
      reason: 'native-supported',
      explanation: 'This file should play directly in your browser.',
      detail: [],
    };
  }

  // Container accepted but a codec inside is not — offer the matching fix.
  if (containerNative && !audioNative && primaryAudio && AUDIO_FIXABLE.includes(primaryAudio)) {
    return {
      path: 'convert',
      reason: 'audio-codec-unsupported',
      operation: 'audio-aac-transcode',
      explanation:
        'The video stream is fine, but this file uses ' + audioCodecName(primaryAudio) +
        ' audio, which this browser cannot decode. CineFlow can convert just the audio track to AAC locally — video is copied without re-encoding, so quality is unchanged.',
      detail: [
        'Video: copied 1:1 (no quality loss, fast)',
        'Audio: ' + audioCodecName(primaryAudio) + ' → AAC stereo/5.1 as configured by the file',
        'Runs on-device; nothing is uploaded',
      ],
    };
  }

  if (containerNative && !videoNative && primaryVideo) {
    // e.g. HEVC in an MP4 on a browser without HEVC
    return {
      path: 'convert',
      reason: 'video-codec-unsupported',
      operation: primaryVideo === 'h265' ? 'full-transcode-h264' : 'remux-mp4',
      explanation:
        'The container is supported but the video stream (' + videoCodecName(primaryVideo) +
        ') is not decodable by this browser. ' +
        (primaryVideo === 'h265'
          ? 'A full local transcode to H.264 is possible but slow on a phone — it re-encodes every frame.'
          : 'A local remux may resolve track layout issues.'),
      detail: primaryVideo === 'h265'
        ? ['Full re-encode: slow (often minutes per file, drains battery)', 'Original file is kept unchanged']
        : [],
    };
  }

  // Container unsupported (Matroska/AVI/...): decide by the tracks inside.
  if (!containerNative) {
    if (vCodecs.length === 0 && aCodecs.length === 0) {
      // Probe could not read tracks (large/buffered files, unusual layout).
      return {
        path: 'attempt-native',
        reason: 'container-unknown-tracks',
        explanation:
          'This is a ' + containerName(probe.container) + ' file and its track layout could not be read quickly. ' +
          'Playback will be attempted; if the browser fails, a local conversion can be offered.',
        detail: probe.notes,
      };
    }
    const fixableVideo = primaryVideo === 'h264';
    const audioIssue = !audioNative && primaryAudio !== undefined && AUDIO_FIXABLE.includes(primaryAudio);
    if (fixableVideo && audioIssue) {
      return {
        path: 'convert',
        reason: 'container-and-audio-unsupported',
        operation: 'audio-aac-transcode',
        explanation:
          'Browsers do not play ' + containerName(probe.container) + ' containers directly. The tracks inside are ' +
          videoCodecName(primaryVideo) + ' video + ' + audioCodecName(primaryAudio) +
          ' audio, so CineFlow can convert locally to MP4: video is copied 1:1 (no quality loss), and the audio track is re-encoded to AAC.',
        detail: [
          'Container: ' + containerName(probe.container) + ' → MP4 (track copy)',
          'Video: copied 1:1 (no quality loss)',
          'Audio: ' + audioCodecName(primaryAudio) + ' → AAC (re-encoded)',
          'Runs on-device; nothing is uploaded',
        ],
      };
    }
    if (fixableVideo && audioNative) {
      return {
        path: 'convert',
        reason: 'container-unsupported',
        operation: 'remux-mp4',
        explanation:
          'Browsers do not play ' + containerName(probe.container) + ' containers directly, but the tracks inside (' +
          videoCodecName(primaryVideo) + ' video' + (primaryAudio ? ' + ' + audioCodecName(primaryAudio) + ' audio' : '') +
          ') are compatible. CineFlow can remux locally to MP4 — every stream is copied 1:1, so quality and file size stay identical.',
        detail: [
          'Container: ' + containerName(probe.container) + ' → MP4',
          'Video + audio: copied 1:1 (no re-encoding, no quality loss)',
          'Runs on-device; nothing is uploaded',
        ],
      };
    }
    if (primaryVideo === 'h265' || (primaryVideo && !videoNative)) {
      return {
        path: 'convert',
        reason: 'container-and-video-unsupported',
        operation: 'full-transcode-h264',
        explanation:
          'This ' + containerName(probe.container) + ' file uses ' + videoCodecName(primaryVideo) +
          ' video, which this browser cannot decode. A local conversion to MP4/H.264 is possible, but it re-encodes every frame — on a phone this is slow, heats the device and drains battery.',
        detail: [
          'Full re-encode to H.264/AAC (slow)',
          'Original file is kept unchanged',
          'Feasible mainly for short/small clips',
        ],
      };
    }
    if (vCodecs.length === 0 && primaryAudio) {
      // Audio-only file in an unsupported container.
      const audioFix = AUDIO_FIXABLE.includes(primaryAudio);
      return {
        path: 'convert',
        reason: audioFix ? 'audio-container-unsupported' : 'audio-codec-unsupported',
        operation: 'audio-aac-transcode',
        explanation:
          'This is an audio file in a ' + containerName(probe.container) +
          ' container' + (audioFix ? ' with ' + audioCodecName(primaryAudio) + ' audio' : '') +
          ' that this browser cannot play directly. CineFlow can convert the audio locally to AAC/M4A.',
        detail: ['Audio re-encoded to AAC on-device', 'Original file is kept unchanged'],
      };
    }
    return {
      path: 'unsupported',
      reason: 'tracks-not-playable',
      explanation:
        'The tracks in this ' + containerName(probe.container) + ' file are not decodable by this browser, and no safe local conversion can fix them.',
      detail: [
        'Detected: ' + (vCodecs.map(videoCodecName).join(', ') || 'no video') + ' / ' + (aCodecs.map(audioCodecName).join(', ') || 'no audio'),
      ],
    };
  }

  // Unknown corner: attempt honestly rather than block playback.
  return {
    path: 'attempt-native',
    reason: 'unclear-compatibility',
    explanation: 'Compatibility is not fully known; native playback will be attempted first.',
    detail: probe.notes,
  };
}

export function videoCodecName(codec: VideoCodecId | string): string {
  switch (codec) {
    case 'h264': return 'H.264 (AVC)';
    case 'h265': return 'H.265 (HEVC)';
    case 'vp8': return 'VP8';
    case 'vp9': return 'VP9';
    case 'av1': return 'AV1';
    case 'mpeg4': return 'MPEG-4';
    case 'mpeg2': return 'MPEG-2';
    case 'theora': return 'Theora';
    default: return 'unknown codec';
  }
}

export function audioCodecName(codec: AudioCodecId | string): string {
  switch (codec) {
    case 'aac': return 'AAC';
    case 'ac3': return 'Dolby Digital AC-3';
    case 'eac3': return 'Dolby Digital Plus (E-AC-3)';
    case 'mp3': return 'MP3';
    case 'opus': return 'Opus';
    case 'vorbis': return 'Vorbis';
    case 'flac': return 'FLAC';
    case 'dts': return 'DTS';
    case 'truehd': return 'Dolby TrueHD';
    case 'pcm': return 'PCM';
    default: return 'unknown audio';
  }
}

function containerName(container: string): string {
  switch (container) {
    case 'matroska': return 'Matroska (MKV)';
    case 'webm': return 'WebM';
    case 'avi': return 'AVI';
    case 'mpeg-ts': return 'MPEG-TS';
    case 'ogg': return 'Ogg';
    default: return container.toUpperCase();
  }
}

/* ------------------------------------------------------------------ */
/* Conversion feasibility                                              */
/* ------------------------------------------------------------------ */

/**
 * In-browser conversion limits. The FFmpeg.wasm build is single-threaded
 * (GitHub Pages cannot serve the COOP/COEP headers multithreading needs) and
 * its WebAssembly heap caps below 4 GB. Input can stream from disk via
 * WORKERFS, but the OUTPUT file must fit in wasm memory alongside decoder
 * state. These caps are deliberately conservative for mobile.
 */
export const CONVERSION_LIMITS = {
  /** Output written into wasm memory: remux copies video 1:1, so output ≈ input. */
  remuxMaxInputBytes: 600 * 1024 * 1024,
  /** Audio-transcode output ≈ input (video is copied); audio decode is streamed. */
  audioTranscodeMaxInputBytes: 600 * 1024 * 1024,
  /** Full transcode: encoder state + input + output — small files only. */
  fullTranscodeMaxInputBytes: 300 * 1024 * 1024,
  /** Below this, remux usually finishes in seconds; above, warn honestly. */
  slowThresholdBytes: 250 * 1024 * 1024,
} as const;

export interface ConversionFeasibility {
  ok: boolean;
  /** Machine-readable refusal reason (empty when ok). */
  refusal?: 'too-large' | 'no-duration';
  explanation: string;
  /** Rough output size estimate when ok (bytes). */
  estimatedOutputBytes: number | null;
  /** Honest time hint. */
  timeHint: string;
}

export function deviceMemoryGB(): number | null {
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof dm === 'number' && dm > 0 ? dm : null;
}

export function assessFeasibility(op: ConversionOp, sizeBytes: number, durationSeconds: number | null): ConversionFeasibility {
  const lowMem = (deviceMemoryGB() ?? 4) <= 2;
  const scale = lowMem ? 0.5 : 1;
  const gb = (n: number) => n / 1024 ** 3;

  const cap =
    op === 'remux-mp4'
      ? CONVERSION_LIMITS.remuxMaxInputBytes * scale
      : op === 'audio-aac-transcode'
        ? CONVERSION_LIMITS.audioTranscodeMaxInputBytes * scale
        : CONVERSION_LIMITS.fullTranscodeMaxInputBytes * scale;

  if (op === 'full-transcode-h264') {
    if (sizeBytes > cap) {
      return {
        ok: false,
        refusal: 'too-large',
        explanation:
          'A full re-encode of this file (~' + gb(sizeBytes).toFixed(1) + ' GB) is not feasible in the browser: it would exceed WebAssembly memory limits and could take hours on a phone. It will play as-is only on devices that support the original codec.',
        estimatedOutputBytes: null,
        timeHint: '',
      };
    }
    const secondsPerMinute = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null;
    return {
      ok: true,
      explanation:
        'This file (~' + (sizeBytes / 1024 / 1024).toFixed(0) + ' MB' +
        (secondsPerMinute ? ', ' + secondsPerMinute + ' min' : '') +
        ') can be converted locally, but a full re-encode on a phone typically takes several times the clip length and warms the device.',
      estimatedOutputBytes: Math.round(sizeBytes * 0.45),
      timeHint: durationSeconds
        ? 'Rough estimate at wasm speed: ' + Math.max(2, Math.round((durationSeconds * 4) / 60)) + '–' + Math.max(5, Math.round((durationSeconds * 12) / 60)) + ' minutes'
        : 'Rough estimate: minutes to tens of minutes',
    };
  }

  if (sizeBytes > cap) {
    return {
      ok: false,
      refusal: 'too-large',
      explanation:
        'A local conversion of this ~' + gb(sizeBytes).toFixed(1) + ' GB file would have to write the full output into the browser\u2019s WebAssembly memory, which is not safe on this device. Native playback of the original file is used instead.',
      estimatedOutputBytes: null,
      timeHint: '',
    };
  }
  const slow = sizeBytes > CONVERSION_LIMITS.slowThresholdBytes;
  return {
    ok: true,
    explanation:
      'Streams are copied 1:1 (audio re-encoded only if needed), so quality is unchanged. Output stays on this device.' +
      (slow ? ' A file this size may take a minute or more and needs free memory.' : ''),
    estimatedOutputBytes: op === 'remux-mp4' ? sizeBytes : Math.round(sizeBytes * 0.9),
    timeHint: slow ? 'Likely 1–3 minutes' : 'Usually seconds to a minute',
  };
}
