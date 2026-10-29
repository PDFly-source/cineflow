/**
 * Fix 4 — audio clarity presets (Phase 3.0).
 *
 * Pure data + math only: no Web Audio here, so the presets can be unit
 * tested. Gains are in dB and deliberately small: software EQ cannot make a
 * phone louder than its hardware, and we never claim it does. Every boost is
 * paired with a headroom cut so the chain does not clip.
 */

export type AudioPresetId = 'off' | 'normal' | 'voice' | 'balanced' | 'bass-reduced' | 'custom';

export type AudioBand = 'low' | 'mid' | 'high';

export const AUDIO_BANDS: AudioBand[] = ['low', 'mid', 'high'];

export interface BandGains {
  low: number;
  mid: number;
  high: number;
}

export interface AudioPreset {
  id: AudioPresetId;
  label: string;
  /** One-line, honest description of what the preset does. */
  description: string;
  gains: BandGains;
  /** Optional high-pass cut (Hz) used to drop rumble / boom. */
  highpassHz?: number;
}

/** Hard limits: beyond ±10 dB this stops being clarity and starts distortion. */
export const MAX_BAND_GAIN_DB = 10;
export const MIN_BAND_GAIN_DB = -12;

export const FLAT_GAINS: BandGains = { low: 0, mid: 0, high: 0 };

export const AUDIO_PRESETS: AudioPreset[] = [
  {
    id: 'off',
    label: 'Off',
    description: 'Original audio, no processing at all.',
    gains: { ...FLAT_GAINS },
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'Flat response with a safety limiter, nothing boosted.',
    gains: { ...FLAT_GAINS },
  },
  {
    id: 'voice',
    label: 'Voice Clarity',
    description: 'Lifts speech presence and trims low rumble for dialogue.',
    gains: { low: -4, mid: 5, high: 1 },
    highpassHz: 90,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Gentle lift at both ends so quiet phone speakers sound fuller.',
    gains: { low: 2, mid: 1, high: 2 },
  },
  {
    id: 'bass-reduced',
    label: 'Bass Reduction',
    description: 'Cuts boomy low end so mid detail comes through on small speakers.',
    gains: { low: -8, mid: 2, high: 0 },
    highpassHz: 120,
  },
];

export function getPreset(id: AudioPresetId): AudioPreset | undefined {
  return AUDIO_PRESETS.find((p) => p.id === id);
}

export function clampGain(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(MAX_BAND_GAIN_DB, Math.max(MIN_BAND_GAIN_DB, db));
}

export function normalizeGains(gains: Partial<BandGains> | undefined): BandGains {
  return {
    low: clampGain(gains?.low ?? 0),
    mid: clampGain(gains?.mid ?? 0),
    high: clampGain(gains?.high ?? 0),
  };
}

/**
 * Pre-amp (negative dB) so a boosted band cannot push the mix into clipping.
 * A boost of +5 dB yields roughly -2.5 dB of headroom; flat presets get 0.
 */
export function headroomDb(gains: BandGains): number {
  const maxBoost = Math.max(0, gains.low, gains.mid, gains.high);
  if (maxBoost <= 0) return 0;
  return -Math.min(6, maxBoost * 0.5);
}

/** True when the preset should bypass Web Audio entirely. */
export function isBypassed(id: AudioPresetId): boolean {
  return id === 'off';
}

/** Whether the chain would actually change the signal (used for UI honesty). */
export function hasAudibleChange(gains: BandGains): boolean {
  return Math.abs(gains.low) > 0.01 || Math.abs(gains.mid) > 0.01 || Math.abs(gains.high) > 0.01;
}
