'use client';

import React from 'react';
import { FastForward, Rewind } from 'lucide-react';
import { SeekFeedbackState } from '@/types/gestures';
import { formatTime } from '@/lib/utils/formatters';

interface SeekFeedbackProps {
  state: SeekFeedbackState;
}

export const SeekFeedback: React.FC<SeekFeedbackProps> = ({ state }) => {
  if (!state.visible) return null;

  const isForward = state.direction === 'forward';
  const absDelta = Math.abs(Math.round(state.deltaSeconds));
  const formattedTarget = formatTime(state.targetSeconds);
  const formattedDuration = formatTime(state.duration);
  const progressRatio = state.duration > 0 ? (state.targetSeconds / state.duration) * 100 : 0;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-35 flex items-center justify-center transition-opacity duration-150"
      aria-live="polite"
      aria-label={`Seeking to ${formattedTarget}`}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-black/90 backdrop-blur-md px-6 py-4 text-white shadow-2xl border border-white/10 ring-1 ring-white/5 min-w-[220px] max-w-sm">
        {/* Direction Icon & Delta */}
        <div className="flex items-center gap-2">
          {isForward ? (
            <>
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <FastForward className="w-6 h-6 animate-pulse" />
              </div>
              <span className="font-mono text-base font-bold text-indigo-300">
                +{absDelta}s
              </span>
            </>
          ) : (
            <>
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Rewind className="w-6 h-6 animate-pulse" />
              </div>
              <span className="font-mono text-base font-bold text-indigo-300">
                -{absDelta}s
              </span>
            </>
          )}
        </div>

        {/* Target Time Preview */}
        <div className="flex items-baseline gap-1 font-mono">
          <span className="text-xl font-bold tracking-tight text-white">{formattedTarget}</span>
          <span className="text-xs text-slate-400">/ {formattedDuration}</span>
        </div>

        {/* Scrubber Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden relative border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-75"
            style={{ width: `${Math.max(0, Math.min(100, progressRatio))}%` }}
          />
        </div>

        <span className="text-[10px] text-slate-400 font-medium">
          {state.isDragging ? 'Release to seek' : 'Seeking...'}
        </span>
      </div>
    </div>
  );
};
