'use client';

import React from 'react';
import { FastForward, Zap } from 'lucide-react';
import { SpeedBoostFeedbackState } from '@/types/gestures';

interface SpeedBoostIndicatorProps {
  state: SpeedBoostFeedbackState;
}

export const SpeedBoostIndicator: React.FC<SpeedBoostFeedbackStateProps> = ({ state }: { state: SpeedBoostFeedbackState }) => {
  if (!state.active) return null;

  return (
    <div
      className="pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2 animate-bounce-subtle"
      aria-live="polite"
      aria-label={`Fast forwarding at ${state.speed}x speed`}
    >
      <div className="flex items-center gap-2.5 rounded-full bg-indigo-600/90 backdrop-blur-md px-4 py-2 text-white shadow-2xl border border-indigo-400/40 ring-2 ring-indigo-500/20">
        <Zap className="w-4 h-4 text-amber-300 animate-pulse fill-amber-300" />
        <FastForward className="w-4 h-4 text-white" />
        <span className="font-mono text-sm font-bold tracking-wide">
          {state.speed.toFixed(1)}x SPEED
        </span>
        <span className="text-[10px] text-indigo-200 font-medium pl-1 border-l border-indigo-400/40">
          Hold to fast-forward
        </span>
      </div>
    </div>
  );
};

type SpeedBoostFeedbackStateProps = {
  state: SpeedBoostFeedbackState;
};
