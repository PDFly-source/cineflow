'use client';

import React from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { DoubleTapFeedbackState } from '@/types/gestures';

interface TapRipplesProps {
  ripples: DoubleTapFeedbackState[];
}

export const TapRipples: React.FC<TapRipplesProps> = ({ ripples }) => {
  if (ripples.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {ripples.map((ripple) => {
        const isLeft = ripple.side === 'left';
        return (
          <div
            key={ripple.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center animate-ping-once"
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
            }}
          >
            {/* Circular expanding glow */}
            <div className="w-24 h-24 rounded-full bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center backdrop-blur-xs">
              <div className="flex flex-col items-center gap-1 text-white">
                {isLeft ? (
                  <RotateCcw className="w-6 h-6 text-indigo-300 animate-spin-reverse" />
                ) : (
                  <RotateCw className="w-6 h-6 text-indigo-300 animate-spin-slow" />
                )}
                <span className="font-mono text-xs font-bold text-indigo-200">
                  {ripple.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
