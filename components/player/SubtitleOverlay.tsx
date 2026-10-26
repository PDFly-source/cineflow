'use client';

import React, { useMemo, useState, useRef } from 'react';
import { SubtitleCue, getActiveCues } from '@/lib/subtitles/parser';
import { SubtitleSize, SubtitleFont, SubtitlePosition } from '@/lib/storage/db';

interface SubtitleOverlayProps {
  cues: SubtitleCue[];
  currentTime: number;
  isEnabled: boolean;
  size: SubtitleSize;
  font?: SubtitleFont;
  position?: SubtitlePosition;
  color: string;
  bgOpacity: number;
  bottomOffset: number;
  onAdjustBottomOffset?: (newOffset: number) => void;
  onAdjustTimingOffset?: (delta: number) => void;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  cues,
  currentTime,
  isEnabled,
  size,
  font = 'sans',
  position = 'bottom',
  color,
  bgOpacity,
  bottomOffset,
  onAdjustBottomOffset,
  onAdjustTimingOffset,
}) => {
  const [dragOffsetDelta, setDragOffsetDelta] = useState<number>(0);
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeCues = useMemo(() => {
    if (!isEnabled || !cues.length) return [];
    return getActiveCues(cues, currentTime);
  }, [cues, currentTime, isEnabled]);

  if (!isEnabled || activeCues.length === 0) return null;

  const sizeClasses: Record<SubtitleSize, string> = {
    small: 'text-sm sm:text-base leading-snug',
    medium: 'text-base sm:text-xl md:text-2xl leading-normal',
    large: 'text-lg sm:text-2xl md:text-3xl font-medium leading-normal',
    'extra-large': 'text-xl sm:text-3xl md:text-4xl font-semibold leading-relaxed',
  };

  const fontClasses: Record<SubtitleFont, string> = {
    sans: 'font-sans',
    serif: 'font-serif tracking-normal',
    mono: 'font-mono tracking-tight',
    rounded: 'font-sans font-semibold tracking-wide',
  };

  const effectiveOffset = Math.max(12, Math.min(240, bottomOffset + dragOffsetDelta));

  const showToast = (msg: string) => {
    setGestureFeedback(msg);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setGestureFeedback(null);
    }, 1500);
  };

  // Pointer gesture handlers for dragging subtitle position and horizontal timing swipe
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dragStartYRef.current = e.clientY;
    dragStartXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const deltaY = dragStartYRef.current - e.clientY;
    setDragOffsetDelta(deltaY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null || dragStartXRef.current === null) return;
    const deltaY = dragStartYRef.current - e.clientY;
    const deltaX = e.clientX - dragStartXRef.current;

    // Check if horizontal swipe for subtitle timing offset
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const offsetDelta = deltaX > 0 ? 0.25 : -0.25;
      if (onAdjustTimingOffset) {
        onAdjustTimingOffset(offsetDelta);
        showToast(deltaX > 0 ? 'Sync: +0.25s (delayed)' : 'Sync: -0.25s (advanced)');
      }
    } else if (Math.abs(deltaY) > 8 && onAdjustBottomOffset) {
      const finalOffset = Math.max(16, Math.min(220, bottomOffset + deltaY));
      onAdjustBottomOffset(Math.round(finalOffset));
      showToast(`Position: ${Math.round(finalOffset)}px`);
    }

    setDragOffsetDelta(0);
    dragStartYRef.current = null;
    dragStartXRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Determine positioning wrapper classes and style
  let positionStyle: React.CSSProperties = {};
  let alignmentClass = 'justify-end';

  if (position === 'top') {
    positionStyle = { top: `${effectiveOffset}px` };
    alignmentClass = 'justify-start';
  } else if (position === 'middle') {
    positionStyle = { top: '50%', transform: 'translateY(-50%)' };
    alignmentClass = 'justify-center';
  } else {
    // default bottom
    positionStyle = { bottom: `${effectiveOffset}px` };
    alignmentClass = 'justify-end';
  }

  return (
    <div
      className={`pointer-events-none absolute left-0 right-0 z-20 flex flex-col items-center px-4 text-center transition-all duration-75 select-none ${alignmentClass}`}
      style={positionStyle}
      aria-live="polite"
    >
      {gestureFeedback && (
        <div className="mb-2 px-3 py-1 rounded-full bg-slate-900/90 border border-indigo-500/50 text-indigo-300 text-xs font-mono font-medium shadow-lg backdrop-blur-md animate-fade-in pointer-events-none">
          {gestureFeedback}
        </div>
      )}

      {activeCues.map((cue) => (
        <div
          key={cue.id}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="Drag vertically to position, or swipe horizontally to shift timing"
          className="pointer-events-auto my-1 inline-block max-w-[90%] md:max-w-[78%] rounded-xl px-4 py-2 shadow-xl backdrop-blur-xs transition-colors cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-indigo-400/40"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
            color: color || '#ffffff',
            textShadow: '0 2px 4px rgba(0,0,0,0.85)',
          }}
        >
          <p
            className={`whitespace-pre-line text-balance ${sizeClasses[size] || sizeClasses.medium} ${fontClasses[font] || fontClasses.sans}`}
            dangerouslySetInnerHTML={{ __html: cue.text }}
          />
        </div>
      ))}
    </div>
  );
};
