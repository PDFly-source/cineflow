/**
 * Genuine local MP3 encoding for CineFlow.
 * - Decodes the audio track of a user-selected file via WebAudio (browser support dependent).
 * - Encodes real MPEG Layer III bytes with lamejs. Never renames other formats to .mp3.
 * - Runs entirely on-device; nothing is uploaded. The source file is never modified.
 */

export type Mp3Bitrate = 128 | 192 | 320;
export const MP3_BITRATES: readonly Mp3Bitrate[] = [128, 192, 320] as const;

export interface Mp3Progress {
  stage: 'decoding' | 'encoding' | 'finalizing';
  /** 0..100; monotonic within a stage. */
  percent: number;
}

export interface Mp3ConvertOptions {
  bitrate?: Mp3Bitrate;
  onProgress?: (p: Mp3Progress) => void;
  /** Set to true to stop encoding as soon as possible. */
  isCancelled?: () => boolean;
}

export interface Mp3ConvertResult {
  blob: Blob;
  /** Duration of the decoded audio, in seconds. */
  durationSeconds: number;
  sampleRate: number;
  channels: 1 | 2;
  bitrate: Mp3Bitrate;
  byteLength: number;
}

/** MP3 output is ~bitrate/8 bytes per second; used for honest size estimates. */
export function estimateMp3SizeBytes(durationSeconds: number, bitrate: Mp3Bitrate): number {
  return Math.max(0, Math.round((durationSeconds * bitrate * 1000) / 8));
}

/**
 * Honest high-level memory estimate for decode+encode of a media file:
 * decoded PCM is ~ sampleRate * channels * 4 bytes/s (Float32), plus
 * Int16 conversion copies. This is an approximation, not a guarantee.
 */
export function estimatePeakPcmBytes(durationSeconds: number, sampleRate = 44100, channels = 2): number {
  return Math.max(0, Math.round(durationSeconds * sampleRate * channels * (4 + 2)));
}

/**
 * True when the bytes begin with an MP3 signature: either an ID3v2 tag or an
 * MPEG audio frame sync (0xFF Ex / 0xFF Fx). Used to verify encoder output.
 */
export function isMp3Signature(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // "ID3"
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0; // MPEG frame sync
}

const BLOCK_SIZE = 1152; // MP3 frame samples per channel

type EncoderCtor = new (channels: 1 | 2, sampleRate: number, kbps: number) => {
  encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array | Int8Array;
  flush(): Uint8Array | Int8Array;
};

let encoderCtorPromise: Promise<EncoderCtor> | null = null;

function loadMp3Encoder(): Promise<EncoderCtor> {
  if (!encoderCtorPromise) {
    encoderCtorPromise = (async () => {
      const mod: { Mp3Encoder?: EncoderCtor } = await import('@breezystack/lamejs');
      if (mod.Mp3Encoder) return mod.Mp3Encoder;
      // Test/Node fallback: the package's "require" target is an IIFE without
      // exports, so load the ESM dist file directly. Variable specifier with
      // webpackIgnore keeps bundlers from resolving this at build time.
      const fallbackSpecifier = '@breezystack/lamejs/dist/lamejs.js';
      const direct = (await import(/* webpackIgnore: true */ fallbackSpecifier)) as { Mp3Encoder?: EncoderCtor };
      if (!direct.Mp3Encoder) throw new Error('MP3 encoder unavailable');
      return direct.Mp3Encoder;
    })();
  }
  return encoderCtorPromise;
}

function floatToInt16Block(src: Float32Array, start: number, count: number): Int16Array {
  const out = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const s = Math.max(-1, Math.min(1, src[start + i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Encodes planar Float32 PCM channels into MP3 bytes. Pure w.r.t. inputs;
 * returns the concatenated output.
 */
export async function encodePcmToMp3(
  channels: Float32Array[],
  sampleRate: number,
  bitrate: Mp3Bitrate,
  options: Pick<Mp3ConvertOptions, 'onProgress' | 'isCancelled'> = {}
): Promise<Uint8Array> {
  if (channels.length === 0) throw new Error('No audio channels to encode');
  const chCount: 1 | 2 = channels.length >= 2 ? 2 : 1;
  const length = channels[0].length;
  const Encoder = await loadMp3Encoder();
  const encoder = new Encoder(chCount, sampleRate, bitrate);
  const out: Uint8Array[] = [];
  let total = 0;

  for (let offset = 0; offset < length; offset += BLOCK_SIZE) {
    if (options.isCancelled?.()) throw new Error('CANCELLED');
    const count = Math.min(BLOCK_SIZE, length - offset);
    const left = floatToInt16Block(channels[0], offset, count);
    const block = chCount === 2 ? encoder.encodeBuffer(left, floatToInt16Block(channels[1], offset, count)) : encoder.encodeBuffer(left);
    if (block && block.length > 0) {
      const u8 = new Uint8Array(block.buffer, block.byteOffset, block.byteLength);
      out.push(u8);
      total += u8.length;
    }
    options.onProgress?.({ stage: 'encoding', percent: Math.min(100, (offset / length) * 100) });
  }
  const tail = encoder.flush();
  if (tail && tail.length > 0) {
    const u8 = new Uint8Array(tail.buffer, tail.byteOffset, tail.byteLength);
    out.push(u8);
    total += u8.length;
  }
  options.onProgress?.({ stage: 'finalizing', percent: 100 });

  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of out) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

/**
 * Converts a user-selected media file's audio track to a real MP3 Blob.
 * Throws with an honest, user-readable message when the browser cannot
 * decode the input (codec/container unsupported) or when cancelled.
 */
export async function convertFileToMp3(file: File, options: Mp3ConvertOptions = {}): Promise<Mp3ConvertResult> {
  const bitrate = options.bitrate ?? 192;
  const AudioCtx: typeof AudioContext | undefined =
    typeof window !== 'undefined' ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
  if (!AudioCtx) throw new Error('WebAudio is not available in this environment.');

  options.onProgress?.({ stage: 'decoding', percent: 0 });
  const ctx = new AudioCtx();
  try {
    const raw = await file.arrayBuffer();
    let decoded: AudioBuffer;
    try {
      decoded = await ctx.decodeAudioData(raw);
    } catch {
      throw new Error(
        `This browser could not decode the audio from "${file.name}". ` +
          'Some codecs/containers (for example AC-3 or certain MKV tracks) cannot be decoded by the browser. ' +
          'Try a different file or convert the source format first.'
      );
    }
    if (!decoded.length) throw new Error('The file contains no decodable audio.');

    const chCount: 1 | 2 = decoded.numberOfChannels >= 2 ? 2 : 1;
    const channels: Float32Array[] = [];
    channels.push(decoded.getChannelData(0));
    if (chCount === 2) channels.push(decoded.getChannelData(1));

    const mp3Bytes = await encodePcmToMp3(channels, decoded.sampleRate, bitrate, options);
    if (!isMp3Signature(mp3Bytes)) {
      throw new Error('Encoder output failed the MP3 signature check. Nothing was saved.');
    }

    return {
      blob: new Blob([mp3Bytes.buffer as ArrayBuffer], { type: 'audio/mpeg' }),
      durationSeconds: decoded.duration,
      sampleRate: decoded.sampleRate,
      channels: chCount,
      bitrate,
      byteLength: mp3Bytes.length,
    };
  } finally {
    // Release decoder resources. Source file is untouched.
    ctx.close().catch(() => {});
  }
}
