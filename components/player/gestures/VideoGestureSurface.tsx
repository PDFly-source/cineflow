'use client';

import React, { useEffect } from 'react';
import { useVideoGestures, UseVideoGesturesProps } from '@/hooks/use-video-gestures';
import { GestureFeedbackOverlay } from './GestureFeedbackOverlay';

export interface VideoGestureSurfaceProps extends UseVideoGesturesProps {
  onZoomChange?: (scale: number) => void;
  className?: string;
  children?: React.ReactNode;
}

export const VideoGestureSurface: React.FC<VideoGestureSurfaceProps> = (props) => {
  const { onZoomChange, className = '', children, ...gestureProps } = props;

  const {
    zoomScale,
    brightnessFeedback,
    volumeFeedback,
    seekFeedback,
    speedBoostFeedback,
    zoomFeedback,
    doubleTapRipples,
    resetZoom,
    handlers,
  } = useVideoGestures(gestureProps);

  useEffect(() => {
    onZoomChange?.(zoomScale);
  }, [zoomScale, onZoomChange]);

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
