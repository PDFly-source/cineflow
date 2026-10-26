'use client';

import React from 'react';
import {
  BrightnessFeedbackState,
  VolumeFeedbackState,
  SeekFeedbackState,
  SpeedBoostFeedbackState,
  ZoomFeedbackState,
  DoubleTapFeedbackState,
} from '@/types/gestures';
import { BrightnessIndicator } from './BrightnessIndicator';
import { VolumeIndicator } from './VolumeIndicator';
import { SeekFeedback } from './SeekFeedback';
import { SpeedBoostIndicator } from './SpeedBoostIndicator';
import { ZoomIndicator } from './ZoomIndicator';
import { TapRipples } from './TapRipples';

interface GestureFeedbackOverlayProps {
  brightnessState: BrightnessFeedbackState;
  volumeState: VolumeFeedbackState;
  seekState: SeekFeedbackState;
  speedBoostState: SpeedBoostFeedbackState;
  zoomState: ZoomFeedbackState;
  doubleTapRipples: DoubleTapFeedbackState[];
  onResetZoom: () => void;
}

export const GestureFeedbackOverlay: React.FC<GestureFeedbackOverlayProps> = ({
  brightnessState,
  volumeState,
  seekState,
  speedBoostState,
  zoomState,
  doubleTapRipples,
  onResetZoom,
}) => {
  return (
    <>
      <BrightnessIndicator state={brightnessState} />
      <VolumeIndicator state={volumeState} />
      <SeekFeedback state={seekState} />
      <SpeedBoostIndicator state={speedBoostState} />
      <ZoomIndicator state={zoomState} onResetZoom={onResetZoom} />
      <TapRipples ripples={doubleTapRipples} />
    </>
  );
};
