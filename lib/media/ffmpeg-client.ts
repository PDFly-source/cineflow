/**
 * FFmpeg.wasm client for CineFlow — on-demand local media conversion.
 *
 * - Core files are bundled with the app (public/ffmpeg/) and loaded lazily,
 *   only when a conversion is first requested. Nothing loads at app start.
 * - The core is the single-threaded @ffmpeg/core 0.12.10 build (GitHub Pages
 *   cannot serve the COOP/COEP headers the multithreaded build requires).
 *   Licensed GPL-2.0-or-later (includes libx264); see THIRD_PARTY_LICENSES.md.
 * - Input files are mounted via WORKERFS so the browser streams bytes from
 *   disk — a multi-GB input is never copied into JavaScript memory.
 * - Output must fit in WebAssembly memory; callers run assessFeasibility()
 *   before offering a conversion.
 * - The main thread never runs FFmpeg work: the class executes everything in
 *   its own Web Worker.
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg';

export type EngineStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface EngineInfo {
  status: EngineStatus;
  /** First line of `ffmpeg -version` once loaded. */
  version: string | null;
  /** Configuration string from the loaded build. */
  configuration: string | null;
  /** Encoder names present in the build (e.g. ['libx264', 'aac']). */
  encoders: string[];
  /** Decoder names present in the build. */
  decoders: string[];
}

interface Engine {
  ffmpeg: FFmpeg;
  info: EngineInfo;
}

let enginePromise: Promise<Engine> | null = null;

function coreUrls(): { coreURL: string; wasmURL: string } {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '') + '/ffmpeg';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    coreURL: origin + base + '/ffmpeg-core.js',
    wasmURL: origin + base + '/ffmpeg-core.wasm',
  };
}

const logBuffer: string[] = [];
let logListener: ((line: string) => void) | null = null;

function appendLog(line: string): void {
  logBuffer.push(line);
  if (logBuffer.length > 500) logBuffer.splice(0, logBuffer.length - 500);
  logListener?.(line);
}

/** Parses "time=HH:MM:SS.xx" progress lines into seconds. */
export function parseFfmpegTimeSeconds(line: string): number | null {
  const m = /time=\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function introspect(ffmpeg: FFmpeg): Promise<Pick<EngineInfo, 'version' | 'configuration' | 'encoders' | 'decoders'>> {
  const captured: string[] = [];
  logListener = (line) => captured.push(line);
  try {
    await ffmpeg.exec(['-hide_banner', '-version']);
    await ffmpeg.exec(['-hide_banner', '-encoders']);
    await ffmpeg.exec(['-hide_banner', '-decoders']);
  } finally {
    logListener = null;
  }
  const versionLine = captured.find((l) => l.startsWith('ffmpeg version')) ?? null;
  const configLine = captured.find((l) => l.trim().startsWith('configuration:')) ?? null;
  const listRe = /^\s+[A-Z.]{6}\s+([A-Za-z0-9_]+)\s/;
  const encIdx = captured.findIndex((l) => l.includes('Encoders:'));
  const decIdx = captured.findIndex((l) => l.includes('Decoders:'));
  const encoders: string[] = [];
  const decoders: string[] = [];
  for (let i = encIdx + 1; i < captured.length; i++) {
    const m = listRe.exec(captured[i]);
    if (m) {
      if (i < decIdx) encoders.push(m[1]);
      else decoders.push(m[1]);
    }
  }
  return { version: versionLine, configuration: configLine, encoders, decoders };
}

let engineStatus: EngineStatus = 'unloaded';

export function getEngineStatus(): EngineStatus {
  return engineStatus;
}

/** Loads the engine on first use; returns a cached singleton afterwards. */
export async function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    engineStatus = 'loading';
    enginePromise = (async (): Promise<Engine> => {
      const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
      const ffmpeg = new FFmpegClass();
      ffmpeg.on('log', ({ message }) => appendLog(message));
      const { coreURL, wasmURL } = coreUrls();
      try {
        await ffmpeg.load({ coreURL, wasmURL });
      } catch (err) {
        enginePromise = null;
        throw new Error(
          'Could not load the local FFmpeg engine (offline or memory limits). ' +
            'Reload the page once while online so the conversion engine can be cached, then try again.'
        );
      }
      const introspected = await introspect(ffmpeg);
      engineStatus = 'ready';
      const engine: Engine = { ffmpeg, info: { status: 'ready', ...introspected } };
      return engine;
    })().catch((err) => {
      enginePromise = null;
      engineStatus = 'error';
      throw err;
    });
  }
  return enginePromise;
}

export async function getEngineInfo(): Promise<EngineInfo> {
  const engine = await getEngine();
  return engine.info;
}

/** Recent log lines, useful for diagnosing failures in the UI. */
export function recentLog(): string[] {
  return logBuffer.slice(-40);
}

/**
 * Cancels any running conversion by terminating the engine worker.
 * The next getEngine() call reloads a fresh instance.
 */
export function cancelConversion(): void {
  if (!enginePromise) return;
  enginePromise.then((engine) => {
    try {
      engine.ffmpeg.terminate();
    } catch {
      // already dead
    }
  });
  enginePromise = null;
  engineStatus = 'unloaded';
}

/* ------------------------------------------------------------------ */
/* Execution with WORKERFS input and progress reporting                 */
/* ------------------------------------------------------------------ */

export interface RunOptions {
  file: File;
  /** Output-side FFmpeg args (applied after -i), e.g. ['-c:v', 'copy', '-c:a', 'aac']. */
  outputArgs: string[];
  /** Input-side args (before -i); rarely needed. */
  inputArgs?: string[];
  outputName: string;
  outputMime: string;
  /** Total duration for progress; null = indeterminate. */
  durationSeconds: number | null;
  onProgress?: (percent: number | null) => void;
  isCancelled?: () => boolean;
}

export interface RunResult {
  blob: Blob;
  /** Final ffmpeg log lines (for honest failure reporting). */
  logTail: string[];
}

/**
 * Runs one conversion. Input is mounted read-only via WORKERFS (streamed
 * from the File on disk); output is read back from MEMFS and returned as a
 * Blob living in normal browser storage (not wasm memory).
 */
export async function runConversion(opts: RunOptions): Promise<RunResult> {
  const engine = await getEngine();
  const { ffmpeg } = engine;
  const mountPoint = '/cineflow-input';
  let mounted = false;
  const tail: string[] = [];

  const progressHandler = ({ message }: { message: string }) => {
    tail.push(message);
    if (tail.length > 200) tail.shift();
    const sec = parseFfmpegTimeSeconds(message);
    if (sec !== null && opts.durationSeconds && opts.durationSeconds > 0) {
      opts.onProgress?.(Math.min(99, Math.round((sec / opts.durationSeconds) * 100)));
    }
  };
  ffmpeg.on('log', progressHandler);

  try {
    try {
      // @ts-expect-error FFFSType enum comes from the package at runtime.
      await ffmpeg.mount('WORKERFS', { files: [opts.file] }, mountPoint);
      mounted = true;
    } catch {
      // Fallback: write the input into MEMFS (small files only, callers gate size).
      const data = new Uint8Array(await opts.file.arrayBuffer());
      await ffmpeg.writeFile(mountPoint + '/' + opts.file.name, data);
      mounted = true;
    }

    let exitCode = 0;
    try {
      exitCode = await ffmpeg.exec([
        '-hide_banner',
        ...(opts.inputArgs ?? []),
        '-i',
        mountPoint + '/' + opts.file.name,
        ...opts.outputArgs,
        '-y',
        opts.outputName,
      ]);
    } catch (err) {
      if (opts.isCancelled?.()) {
        throw new DOMException('Conversion cancelled', 'AbortError');
      }
      throw err;
    }
    if (opts.isCancelled?.()) {
      throw new DOMException('Conversion cancelled', 'AbortError');
    }
    if (exitCode !== 0) {
      throw new Error('FFmpeg exited with code ' + exitCode);
    }

    const data = await ffmpeg.readFile(opts.outputName);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const blob = new Blob([bytes as unknown as BlobPart], { type: opts.outputMime });
    return { blob, logTail: tail };
  } finally {
    ffmpeg.off('log', progressHandler);
    try {
      if (mounted) await ffmpeg.unmount(mountPoint);
    } catch {
      // worker may be gone after cancel
    }
    try {
      await ffmpeg.deleteFile?.(opts.outputName);
    } catch {
      // optional cleanup
    }
  }
}
