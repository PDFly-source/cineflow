'use client';

import React from 'react';
import { Sun, SunDim, SunMedium } from 'lucide-react';
import { BrightnessFeedbackState } from '@/types/gestures';

interface BrightnessIndicatorProps {
  state: BrightnessFeedbackState;
}

export const BrightnessIndicator: React.FC<BrightnessIndicatorProps> = ({ state }) => {
  if (!state.visible) return null;

  const percent = Math.round(state.level);
  // Clamped ratio for progress bar (40% to 160% mapped to 0% to 100%)
  const barPercent = Math.max(0, Math.min(100, Math.round(((percent - 40) / 120) * 100)));

  const SunIcon = percent < 75 ? SunDim : percent > 125 ? Sun : SunMedium;

  return (
    <div
      className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 z-35 flex items-center gap-3 transition-all duration-200"
      aria-live="polite"
      aria-label={`Brightness ${percent} percent`}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--ob)]/90 backdrop-blur-md px-3.5 py-4 text-white shadow-2xl border border-[var(--bd)] ring-1 ring-white/5">
        <div className="rnd gl w-11 h-11 rounded-xl text-[var(--cy)]">
          <SunIcon className="w-5 h-5 animate-pulse" />
        </div>

        {/* Vertical Level Bar (Screen 3) */}
        <div className="relative w-2 h-28 rounded-full bg-white/20 overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
            style={{
              height: `${barPercent}%`,
              background: 'linear-gradient(0deg, var(--cy), var(--bv))',
            }}
          />
        </div>

        {/* Percentage Label */}
        <div className="flex flex-col items-center">
          <span className="font-mono text-xs font-bold text-[var(--tx)]">{percent}%</span>
          <span className="text-[9px] uppercase tracking-wider text-[var(--t2)] font-semibold">Brightness</span>
        </div>
      </div>
    </div>
  );
};
