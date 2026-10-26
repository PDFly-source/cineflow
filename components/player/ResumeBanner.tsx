'use client';

import React from 'react';
import { Play, RotateCcw, X } from 'lucide-react';
import { formatTime } from '@/lib/utils/formatters';

interface ResumeBannerProps {
  savedTime: number;
  duration: number;
  onResume: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

export const ResumeBanner: React.FC<ResumeBannerProps> = ({
  savedTime,
  duration,
  onResume,
  onRestart,
  onDismiss,
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md rounded-2xl bg-slate-900/90 border border-indigo-500/30 p-4 shadow-2xl backdrop-blur-md text-white animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Resume Playback?</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              You previously stopped at <span className="font-mono text-indigo-300 font-medium">{formatTime(savedTime)}</span>
              {duration > 0 && ` of ${formatTime(duration)}`}.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Dismiss resume prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3.5 flex items-center justify-end gap-2.5">
        <button
          onClick={onRestart}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          Start from Beginning
        </button>
        <button
          onClick={onResume}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition-all active:scale-95"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Resume</span>
        </button>
      </div>
    </div>
  );
};
