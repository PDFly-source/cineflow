/**
 * High-level, validated local conversion operations.
 * Every operation checks the actual FFmpeg build's encoders/decoders first,
 * streams the input via WORKERFS, reports honest progress, and VALIDATES the
 * output (re-probed with our own parser) before it is ever offered for
 * playback. The original file is never modified.
 */

import { probeMedia } from './container-probe';
import type { MediaProbe } from './container-probe';
import { cancelConversion, getEngine, runConversion } from './ffmpeg-client';
import type { ConversionOp } from './compatibility';
import { assessFeasibility } from './compatibility';
import type { ConversionFeasibility } from './compatibility';

export interface ConversionRequest {
  file: File;
  probe: MediaProbe;
  operation: ConversionOp;
  onProgress?: (percent: number | null) => void;
  isCancelled?: () => boolean;
}

export interface ConversionResult {
  blob: Blob;
  /** Playback-ready object URL the caller must revoke when done. */
  objectUrl: string;
  /** Fresh probe of the converted output (validation evidence). */
  outputProbe: MediaProbe;
  /** Byte size of the produced file. */
  outputBytes: number;
}

export interface ConversionRefusal {
  refused: true;
  reason: 'too-large' | 'no-duration' | 'missing-encoder' | 'missing-decoder';
  explanation: string;
}

export type ConversionOutcome = ConversionResult | ConversionRefusal;

function isRefusal(r: ConversionOutcome): r is ConversionRefusal {
  return (r as ConversionRefusal).refused === true;
}
export { isRefusal };

function baseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

function sanitizeForFs(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_');
}

/** FFmpeg output args per operation. Video is always stream-copied when possible. */
function outputArgsFor(op: ConversionOp): string[] {
  switch (op) {
    case 'remux-mp4':
      // Container change only: all streams copied 1:1, faststart for playback.
      return ['-c', 'copy', '-movflags', '+faststart'];
    case 'audio-aac-transcode':
      // Video copy 1:1; audio re-encoded to AAC. -map keeps all tracks.
      return ['-map', '0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
    case 'full-transcode-h264':
      return [
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '26',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
      ];
  }
}

export function requiredEncoders(op: ConversionOp): string[] {
  if (op === 'audio-aac-transcode') return ['aac'];
  if (op === 'full-transcode-h264') return ['libx264', 'aac'];
  return [];
}

export function requiredDecoders(op: ConversionOp, probe: MediaProbe): string[] {
  // The build must be able to DECODE whatever it re-encodes. Remux never decodes.
  if (op === 'remux-mp4') return [];
  const need: string[] = [];
  for (const t of [...probe.videoTracks, ...probe.audioTracks]) {
    if (op === 'full-transcode-h264' && t.type === 'video') need.push(t.codecRaw || String(t.codec));
    if (op === 'audio-aac-transcode' && t.type === 'audio') need.push(t.codecRaw || String(t.codec));
  }
  return need;
}

/** Maps our codec ids to the decoder name(s) the build must provide. */
function decoderNamesFor(rawCodec: string): string[] {
  const raw = rawCodec.toLowerCase();
  if (raw.includes('v_mpegh') || raw.includes('hevc') || raw === 'h265') return ['hevc'];
  if (raw.includes('v_mpeg4') || raw.includes('avc') || raw === 'h264') return ['h264'];
  if (raw === 'ac3' || raw.includes('a_ac3')) return ['ac3'];
  if (raw === 'eac3' || raw.includes('a_eac3')) return ['eac3'];
  if (raw.includes('a_dts')) return ['dts'];
  if (raw.includes('a_truehd')) return ['truehd'];
  if (raw.includes('a_aac')) return ['aac'];
  if (raw.includes('a_flac')) return ['flac'];
  if (raw.includes('a_vorbis')) return ['vorbis'];
  if (raw.includes('a_opus')) return ['opus'];
  if (raw.includes('a_mpeg')) return ['mp3'];
  return [];
}

/**
 * Runs one conversion. Throws DOMException('AbortError') on cancellation.
 * All other failures throw Error with an honest, user-readable message.
 */
export async function convertMedia(req: ConversionRequest): Promise<ConversionOutcome> {
  const { file, probe, operation } = req;

  // 1. Feasibility gate (size, memory model).
  const feasibility: ConversionFeasibility = assessFeasibility(operation, file.size, probe.durationSeconds);
  if (!feasibility.ok) {
    return { refused: true, reason: feasibility.refusal ?? 'too-large', explanation: feasibility.explanation };
  }

  // 2. Actual build capability check — never assume codecs are present.
  const engine = await getEngine();
  for (const enc of requiredEncoders(operation)) {
    if (!engine.info.encoders.includes(enc)) {
      return {
        refused: true,
        reason: 'missing-encoder',
        explanation:
          'The local conversion engine in this browser build does not include the "' + enc +
          '" encoder, so this conversion cannot run on-device. The original file is unchanged.',
      };
    }
  }
  for (const raw of requiredDecoders(operation, probe)) {
    const names = decoderNamesFor(raw);
    const missing = names.filter((n) => !engine.info.decoders.includes(n) && !engine.info.decoders.includes(n + '_decoder'));
    if (names.length > 0 && missing.length === names.length) {
      return {
        refused: true,
        reason: 'missing-decoder',
        explanation:
          'The local conversion engine cannot decode ' + raw + ' streams, so it cannot re-encode them. ' +
          'The original file is unchanged.',
      };
    }
  }

  // 3. Execute with progress + cancellation.
  const outputName = sanitizeForFs(baseName(file.name)) + '-cineflow.mp4';
  const result = await runConversion({
    file,
    outputArgs: outputArgsFor(operation),
    outputName,
    outputMime: 'video/mp4',
    durationSeconds: probe.durationSeconds,
    onProgress: req.onProgress,
    isCancelled: req.isCancelled,
  });

  // 4. Validate the output before offering playback.
  if (result.blob.size < 1024) {
    throw new Error('Conversion produced an empty or corrupt output; nothing was replaced. The original file is unchanged.');
  }
  const outFile = new File([result.blob], outputName, { type: 'video/mp4' });
  const outputProbe = await probeMedia(outFile);
  const hasTracks = outputProbe.videoTracks.length > 0 || outputProbe.audioTracks.length > 0;
  const hadAudio = probe.audioTracks.length > 0;
  const keptAudio = !hadAudio || outputProbe.audioTracks.length > 0;
  if (!hasTracks || !keptAudio) {
    throw new Error(
      'The converted file failed validation (' +
        (hasTracks ? 'audio track missing' : 'no playable tracks found') +
        ') and will not be used. The original file is unchanged.'
    );
  }

  return {
    blob: result.blob,
    objectUrl: URL.createObjectURL(result.blob),
    outputProbe,
    outputBytes: result.blob.size,
  };
}

/** Cancels the engine (terminate) — safe even when nothing runs. */
export function cancelMediaConversion(): void {
  cancelConversion();
}
