/**
 * Browser capability probing for codecs and containers.
 *
 * Wraps HTMLMediaElement.canPlayType() and (where available)
 * navigator.mediaCapabilities.decodingInfo(). All results are treated as
 * ESTIMATES: a positive string does not prove every real file decodes
 * (profile, level, and hardware limits still matter). The playback pipeline
 * always attempts native playback first when the plan says so.
 */

import type { AudioCodecId, ContainerFormat, VideoCodecId } from './container-probe';

export type CanPlayLevel = 'probably' | 'maybe' | 'no';

export interface VideoCodecCapability {
  codec: VideoCodecId;
  /** Best canPlayType answer across representative profiles. */
  canPlay: CanPlayLevel;
  mimeUsed: string;
}

export interface AudioCodecCapability {
  codec: AudioCodecId;
  canPlay: CanPlayLevel;
  mimeUsed: string;
}

const VIDEO_MIME: Record<VideoCodecId, string[]> = {
  h264: [
    'video/mp4; codecs="avc1.42E01E"', // Baseline
    'video/mp4; codecs="avc1.4D401F"', // Main
    'video/mp4; codecs="avc1.640034"', // High
  ],
  h265: [
    'video/mp4; codecs="hvc1.1.6.L93.B0"', // Main
    'video/mp4; codecs="hvc1.2.4.L153.B0"', // Main10 — hardware dependent
  ],
  vp8: ['video/webm; codecs="vp8"'],
  vp9: ['video/webm; codecs="vp9"'],
  av1: ['video/mp4; codecs="av01.0.05M.08"'],
  mpeg4: [], // no universal web MIME
  mpeg2: [],
  theora: [],
  unknown: [],
};

const AUDIO_MIME: Record<AudioCodecId, string[]> = {
  aac: ['audio/mp4; codecs="mp4a.40.2"', 'audio/mp4; codecs="mp4a.40.5"'],
  mp3: ['audio/mpeg'],
  opus: ['audio/webm; codecs="opus"', 'audio/mp4; codecs="opus"'],
  vorbis: ['audio/webm; codecs="vorbis"', 'audio/ogg; codecs="vorbis"'],
  flac: ['audio/flac'],
  ac3: [], // no browser MIME registration — treated as unsupported
  eac3: [],
  dts: [],
  truehd: [],
  pcm: ['audio/wav'],
  unknown: [],
};

const CONTAINER_MIME: Record<ContainerFormat, string | null> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4a: 'audio/mp4',
  webm: 'video/webm',
  matroska: 'video/x-matroska',
  avi: 'video/x-msvideo',
  'mpeg-ts': 'video/mp2t',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  unknown: null,
};

function canPlayType(mime: string): CanPlayLevel {
  if (typeof document === 'undefined' || !document.createElement) return 'no';
  try {
    const v = document.createElement('video');
    const answer = v.canPlayType(mime);
    return answer === 'probably' ? 'probably' : answer === 'maybe' ? 'maybe' : 'no';
  } catch {
    return 'no';
  }
}

function bestOf(mimes: string[]): { canPlay: CanPlayLevel; mimeUsed: string } {
  let best: CanPlayLevel = 'no';
  let used = '';
  const rank: Record<CanPlayLevel, number> = { no: 0, maybe: 1, probably: 2 };
  for (const m of mimes) {
    const r = canPlayType(m);
    if (rank[r] > rank[best]) {
      best = r;
      used = m;
    }
  }
  return { canPlay: best, mimeUsed: used };
}

export function probeVideoCodec(codec: VideoCodecId): VideoCodecCapability {
  const { canPlay, mimeUsed } = bestOf(VIDEO_MIME[codec]);
  return { codec, canPlay, mimeUsed };
}

export function probeAudioCodec(codec: AudioCodecId): AudioCodecCapability {
  const { canPlay, mimeUsed } = bestOf(AUDIO_MIME[codec]);
  return { codec, canPlay, mimeUsed };
}

export function probeContainer(container: ContainerFormat): CanPlayLevel {
  const mime = CONTAINER_MIME[container];
  if (!mime) return 'no';
  return canPlayType(mime);
}

/** MIME string for the best-guess type of a probed file (used for the <video> element). */
export function mimeForContainer(container: ContainerFormat): string {
  return CONTAINER_MIME[container] ?? 'video/mp4';
}

export interface DecodingInfoResult {
  supported: boolean;
  smooth: boolean;
  powerEfficient: boolean;
}

/**
 * navigator.mediaCapabilities.decodingInfo() — deeper, config-aware check.
 * Returns null when the API is unavailable (older browsers / some WebViews).
 */
export async function decodingInfo(
  video: { contentType: string; width?: number; height?: number; bitrate?: number; framerate?: number },
  audio?: { contentType: string; bitrate?: number }
): Promise<DecodingInfoResult | null> {
  const mc = (navigator as Navigator & { mediaCapabilities?: MediaCapabilities }).mediaCapabilities;
  if (!mc) return null;
  try {
    const res = await mc.decodingInfo({
      type: 'file',
      video: {
        contentType: video.contentType,
        width: video.width ?? 1920,
        height: video.height ?? 1080,
        bitrate: video.bitrate ?? 8_000_000,
        framerate: video.framerate ?? 30,
      },
      ...(audio ? { audio: { contentType: audio.contentType, bitrate: audio.bitrate ?? 192_000 } } : {}),
    });
    return { supported: res.supported, smooth: !!res.smooth, powerEfficient: !!res.powerEfficient };
  } catch {
    return null;
  }
}
