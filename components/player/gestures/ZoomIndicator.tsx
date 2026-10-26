'use client';

import React from 'react';
import { ZoomIn, RotateCcw } from 'lucide-react';
import { ZoomFeedbackState } from '@/types/gestures';

interface ZoomIndicatorProps {
  state: ZoomFeedbackState;
  onResetZoom: () => void;
}

export const ZoomIndicator: React.FC<ZoomIndicatorProps> = ({ state, onResetZoom }) => {
  if (!state.visible && state.scale === 1.0) return null;

  return (
    <div
      className="absolute top-6 right-6 z-35 flex items-center gap-2 pointer-events-auto transition-opacity duration-200"
      aria-live="polite"
      aria-label={`Zoom scale ${state.scale.toFixed(2)}x`}
    >
      <div className="flex items-center gap-2 rounded-xl bg-black/85 backdrop-blur-md px-3 py-1.5 text-white shadow-xl border border-white/10 ring-1 ring-white/5">
        <ZoomIn className="w-4 h-4 text-cyan-400" />
        <span className="font-mono text-xs font-semibold text-cyan-200">
          {state.scale.toFixed(2)}x
        </span>

        {state.scale > 1.05 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResetZoom();
            }}
            className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 text-[10px] text-slate-200 font-medium transition"
            title="Reset Zoom to 1.0x"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};
