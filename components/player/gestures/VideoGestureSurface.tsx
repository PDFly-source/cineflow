'use client';

import React, { useEffect, useState } from 'react';
import { useVideoGestures, UseVideoGesturesProps } from '@/hooks/use-video-gestures';
import { GestureFeedbackOverlay } from './GestureFeedbackOverlay';

/** Imperative zoom API the player's toolbar buttons can call directly. */
export interface VideoZoomApi {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export interface VideoGestureSurfaceProps extends UseVideoGesturesProps {
  onZoomChange?: (scale: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
  /** Assigned by the surface; call from UI button handlers. */
  zoomApiRef?: React.MutableRefObject<VideoZoomApi | null>;
  className?: string;
  children?: React.ReactNode;
}

export const VideoGestureSurface: React.FC<VideoGestureSurfaceProps> = (props) => {
  const { onZoomChange, onPanChange, zoomApiRef, videoBox, className = '', children, ...gestureProps } = props;

  const {
    zoomScale,
    applyZoom,
    resetZoom,
    brightnessFeedback,
    volumeFeedback,
    seekFeedback,
    speedBoostFeedback,
    zoomFeedback,
    doubleTapRipples,
    handlers,
  } = useVideoGestures({ ...gestureProps, videoBox, onPanChange });

  useEffect(() => {
    onZoomChange?.(zoomScale);
  }, [zoomScale, onZoomChange]);

  // Expose imperative zoom control for the display sheet buttons. Assigned in
  // an effect (never during render) and cleared on unmount.
  useEffect(() => {
    if (!zoomApiRef) return;
    zoomApiRef.current = {
      zoomIn: () => applyZoom(zoomScale + 0.25),
      zoomOut: () => applyZoom(zoomScale - 0.25),
      resetZoom,
    };
    return () => { zoomApiRef.current = null; };
  }, [zoomApiRef, applyZoom, resetZoom, zoomScale]);

  return (
    <div
      {...handlers}
      className={`absolute inset-0 z-10 touch-none select-none cursor-pointer ${className}`}
      aria-hidden="true"
    >
      {children}

      <GestureFeedbackOverlay
        brightnessState={brightnessFeedback}
        volumeState={volumeFeedback}
        seekState={seekFeedback}
        speedBoostState={speedBoostFeedback}
        zoomState={zoomFeedback}
        doubleTapRipples={doubleTapRipples}
        onResetZoom={resetZoom}
      />
    </div>
  );
};

export { useVideoGestures };
export type { UseVideoGesturesProps };
