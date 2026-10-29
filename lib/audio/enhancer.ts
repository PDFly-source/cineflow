/**
 * Fix 4 — local-only audio enhancement chain (Phase 3.0).
 *
 * Design constraints, in order:
 *  - Never block playback. Everything is created lazily and any failure
 *    leaves the untouched <video> audio path working.
 *  - Never touch the network. The graph is source -> filters -> limiter ->
 *    destination, all in-page. No capture, no upload, no recording.
 *  - Never exceed device limits. Gains are capped (±10 dB) and a compressor
 *    + headroom trim keeps peaks away from clipping.
 *  - Survive lifecycle: AudioContext suspension, source re-creation on track
 *    changes (a media element can only be captured once, so the graph is
 *    cached per element), and orientation/seek/pause do not rebuild it.
 */
import {
  AUDIO_PRESETS,
  clampGain,
  getPreset,
  headroomDb,
  normalizeGains,
  type AudioPresetId,
  type BandGains,
} from './presets';

export interface AudioEnhancer {
  /** Applies a preset (and its bands). Safe to call before any gesture. */
  applyPreset: (id: AudioPresetId, customGains?: BandGains) => Promise<boolean>;
  /** Adjusts one band of the custom curve. */
  setBand: (band: keyof BandGains, db: number) => Promise<boolean>;
  /** Restores the flat/original signal. */
  reset: () => Promise<void>;
  /** True once a real graph is running for this element. */
  isActive: () => boolean;
  /** Current effective gains (for UI parity). */
  getGains: () => BandGains;
  /** Releases the context (route change / unmount). */
  dispose: () => void;
}

type AnyAudioContext = AudioContext;

const graphCache = new WeakMap<HTMLMediaElement, { ctx: AnyAudioContext; source: MediaElementAudioSourceNode }>();

const INERT: AudioEnhancer = {
  applyPreset: async () => false,
  setBand: async () => false,
  reset: async () => {},
  isActive: () => false,
  getGains: () => ({ low: 0, mid: 0, high: 0 }),
  dispose: () => {},
};

function getAudioContextCtor(): (new () => AnyAudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: new () => AnyAudioContext; webkitAudioContext?: new () => AnyAudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Builds an enhancer bound to one media element. Returns an inert enhancer
 * when Web Audio is unavailable, so callers never branch on support.
 */
export function createAudioEnhancer(element: HTMLMediaElement | null): AudioEnhancer {
  if (!element) return INERT;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return INERT;

  let ctx: AnyAudioContext | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let highpass: BiquadFilterNode | null = null;
  let low: BiquadFilterNode | null = null;
  let mid: BiquadFilterNode | null = null;
  let high: BiquadFilterNode | null = null;
  let preamp: GainNode | null = null;
  let limiter: DynamicsCompressorNode | null = null;
  let gains: BandGains = { low: 0, mid: 0, high: 0 };
  let active = false;
  let disposed = false;

  const build = (): boolean => {
    if (disposed) return false;
    if (ctx && source) return true;
    try {
      const cached = graphCache.get(element);
      if (cached) {
        ctx = cached.ctx;
        source = cached.source;
      } else {
        ctx = new Ctor();
        // A media element may only ever be captured once; cache the pair so
        // a second enhancer (e.g. after a re-render) reuses the same graph.
        source = ctx.createMediaElementSource(element);
        graphCache.set(element, { ctx, source });
      }
      highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 20;
      highpass.Q.value = 0.7;

      low = ctx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = 200;

      mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1500;
      mid.Q.value = 0.9;

      high = ctx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = 4500;

      preamp = ctx.createGain();
      preamp.gain.value = 1;

      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;

      source.connect(highpass);
      highpass.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(preamp);
      preamp.connect(limiter);
      limiter.connect(ctx.destination);
      return true;
    } catch {
      // Any failure: fall back to the element's own audio output.
      try {
        ctx?.close?.();
      } catch {
        /* ignore */
      }
      ctx = null;
      source = null;
      return false;
    }
  };

  const resume = async () => {
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Suspended contexts resume on the next user gesture; audio still
        // plays through the graph once allowed, and never breaks playback.
      }
    }
  };

  const setGains = async (next: BandGains, highpassHz?: number) => {
    gains = normalizeGains(next);
    const noChange = gains.low === 0 && gains.mid === 0 && gains.high === 0 && !highpassHz;
    if (noChange) {
      // Bypass: leave the element's native audio path alone.
      if (active && ctx && highpass && low && mid && high && preamp) {
        low.gain.value = 0;
        mid.gain.value = 0;
        high.gain.value = 0;
        highpass.frequency.value = 20;
        preamp.gain.value = 1;
      }
      return true;
    }
    if (!build()) return false;
    await resume();
    if (!ctx || !low || !mid || !high || !highpass || !preamp) return false;
    try {
      low.gain.value = clampGain(gains.low);
      mid.gain.value = clampGain(gains.mid);
      high.gain.value = clampGain(gains.high);
      highpass.frequency.value = Math.min(200, Math.max(20, highpassHz ?? 20));
      preamp.gain.value = Math.pow(10, headroomDb(gains) / 20);
      active = true;
      return true;
    } catch {
      return false;
    }
  };

  return {
    async applyPreset(id, customGains) {
      if (id === 'custom') return setGains(customGains ?? gains);
      const preset = getPreset(id);
      if (!preset) return false;
      return setGains(preset.gains, preset.highpassHz);
    },
    async setBand(band, db) {
      const next = { ...gains, [band]: clampGain(db) };
      return setGains(next);
    },
    async reset() {
      await setGains({ low: 0, mid: 0, high: 0 });
      active = false;
    },
    isActive: () => active,
    getGains: () => ({ ...gains }),
    dispose() {
      disposed = true;
      active = false;
      try {
        ctx?.close?.();
      } catch {
        // ignore
      }
      ctx = null;
      source = null;
      highpass = low = mid = high = null;
      preamp = limiter = null;
    },
  };
}

export { AUDIO_PRESETS };
