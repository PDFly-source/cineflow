'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Sun, Volume2, RotateCcw, RotateCw } from 'lucide-react';

interface GestureLayerProps {
  onTogglePlay: () => void;
  onDoubleTapSeek: (seconds: number) => void;
  onSingleTapToggle: () => void;
  onVolumeChangeByRatio: (ratio: number) => void;
  onBrightnessChangeByRatio: (ratio: number) => void;
  seekInterval: number;
  gesturesEnabled: boolean;
  brightnessEnabled: boolean;
  volumeEnabled: boolean;
  brightness: number; // 40 to 160 (%)
  volume: number; // 0 to 1
  children?: React.ReactNode;
}

export const GestureLayer: React.FC<GestureLayerProps> = ({
  onTogglePlay,
  onDoubleTapSeek,
  onSingleTapToggle,
  onVolumeChangeByRatio,
  onBrightnessChangeByRatio,
  seekInterval,
  gesturesEnabled,
  brightnessEnabled,
  volumeEnabled,
  brightness,
  volume,
  children,
}) => {
  // HUD state
  const [hudFeedback, setHudFeedback] = useState<{
    type: 'seek-left' | 'seek-right' | 'volume' | 'brightness';
    value?: string | number;
  } | null>(null);

  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapXRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Vertical drag tracking
  const touchStartRef = useRef<{ x: number; y: number; time: number; side: 'left' | 'right' } | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const triggerHud = useCallback((type: 'seek-left' | 'seek-right' | 'volume' | 'brightness', value?: string | number) => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    setHudFeedback({ type, value });
    hudTimerRef.current = setTimeout(() => {
      setHudFeedback(null);
    }, 800);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary touches/clicks
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const side = x < rect.width / 2 ? 'left' : 'right';

    touchStartRef.current = { x, y, time: Date.now(), side };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || !gesturesEnabled) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const deltaY = touchStartRef.current.y - (e.clientY - rect.top);
    const deltaX = Math.abs(touchStartRef.current.x - (e.clientX - rect.left));

    // If vertical movement exceeds threshold and is predominantly vertical
    if (Math.abs(deltaY) > 15 && Math.abs(deltaY) > deltaX) {
      isDraggingRef.current = true;
      const ratio = deltaY / (rect.height * 0.7);

      if (touchStartRef.current.side === 'left' && brightnessEnabled) {
        onBrightnessChangeByRatio(ratio);
        triggerHud('brightness', `${Math.round(brightness)}%`);
      } else if (touchStartRef.current.side === 'right' && volumeEnabled) {
        onVolumeChangeByRatio(ratio);
        triggerHud('volume', `${Math.round(volume * 100)}%`);
      }

      // Update baseline y for smooth delta
      touchStartRef.current.y = e.clientY - rect.top;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;

    if (isDraggingRef.current) {
      touchStartRef.current = null;
      isDraggingRef.current = false;
      return;
    }

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timeSinceLastTap = now - lastTapTimeRef.current;
    const distanceSinceLastTap = Math.abs(x - lastTapXRef.current);

    // Double tap detection (within 320ms and within 80px)
    if (gesturesEnabled && timeSinceLastTap < 320 && distanceSinceLastTap < 80) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }

      if (x < rect.width * 0.45) {
        // Double tap left -> seek backward
        onDoubleTapSeek(-seekInterval);
        triggerHud('seek-left', `-${seekInterval}s`);
      } else if (x > rect.width * 0.55) {
        // Double tap right -> seek forward
        onDoubleTapSeek(seekInterval);
        triggerHud('seek-right', `+${seekInterval}s`);
      } else {
        // Center double tap toggles play/pause
        onTogglePlay();
      }

      lastTapTimeRef.current = 0;
    } else {
      // Record potential single tap
      lastTapTimeRef.current = now;
      lastTapXRef.current = x;

      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        onTogglePlay();
        onSingleTapToggle();
      }, 200);
    }

    touchStartRef.current = null;
    isDraggingRef.current = false;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute inset-0 z-10 touch-none select-none cursor-pointer"
      aria-hidden="true"
    >
      {children}

      {/* Center HUD Feedback */}
      {hudFeedback && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/80 backdrop-blur-md px-6 py-4 text-white shadow-2xl border border-white/10 animate-fade-in">
            {hudFeedback.type === 'seek-left' && (
              <>
                <RotateCcw className="w-8 h-8 text-indigo-400 animate-pulse" />
                <span className="font-mono text-sm font-semibold">{hudFeedback.value}</span>
              </>
            )}
            {hudFeedback.type === 'seek-right' && (
              <>
                <RotateCw className="w-8 h-8 text-indigo-400 animate-pulse" />
                <span className="font-mono text-sm font-semibold">{hudFeedback.value}</span>
              </>
            )}
            {hudFeedback.type === 'brightness' && (
              <>
                <Sun className="w-8 h-8 text-amber-400" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-400">Brightness</span>
                  <span className="font-mono text-sm font-semibold">{hudFeedback.value}</span>
                </div>
              </>
            )}
            {hudFeedback.type === 'volume' && (
              <>
                <Volume2 className="w-8 h-8 text-cyan-400" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-400">Volume</span>
                  <span className="font-mono text-sm font-semibold">{hudFeedback.value}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
