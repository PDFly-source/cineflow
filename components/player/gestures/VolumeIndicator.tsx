'use client';

import React from 'react';
import { Volume2, Volume1, VolumeX, AlertCircle } from 'lucide-react';
import { VolumeFeedbackState } from '@/types/gestures';

interface VolumeIndicatorProps {
  state: VolumeFeedbackState;
}

export const VolumeIndicator: React.FC<VolumeIndicatorProps> = ({ state }) => {
  if (!state.visible) return null;

  const percent = state.isMuted ? 0 : Math.round(state.level * 100);

  const VolumeIcon =
    state.isMuted || percent === 0 ? VolumeX : percent < 50 ? Volume1 : Volume2;

  return (
    <div
      className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 z-35 flex items-center gap-3 transition-all duration-200"
      aria-live="polite"
      aria-label={`Volume ${percent} percent`}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--ob)]/90 backdrop-blur-md px-3.5 py-4 text-white shadow-2xl border border-[var(--bd)] ring-1 ring-white/5 max-w-[130px]">
        <div className="rnd gl w-11 h-11 rounded-xl text-[var(--cy)]">
          <VolumeIcon className="w-5 h-5 animate-pulse" />
        </div>

        {/* Vertical Level Bar (Screen 3) */}
        <div className="relative w-2 h-28 rounded-full bg-white/20 overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
            style={{
              height: `${percent}%`,
              background: state.isMuted || percent === 0
                ? '#4b5563'
                : 'linear-gradient(0deg, var(--cy), var(--bv))',
            }}
          />
        </div>

        {/* Percentage or Muted Label */}
        <div className="flex flex-col items-center text-center">
          <span
            className={`font-mono text-xs font-bold ${
              state.isMuted || percent === 0 ? 'text-[var(--er)]' : 'text-[var(--tx)]'
            }`}
          >
            {state.isMuted ? 'MUTED' : `${percent}%`}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-[var(--t2)] font-semibold">Volume</span>
        </div>

        {/* OS Restriction Warning (e.g., iOS Safari) */}
        {state.isProgrammaticDisabled && (
          <div className="flex items-center gap-1 mt-1 text-[9px] text-[var(--wa)] leading-tight bg-[var(--ss)] p-1 rounded-md">
            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
            <span>Use hardware buttons on this device</span>
          </div>
        )}
      </div>
    </div>
  );
};
