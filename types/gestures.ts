export type GestureType =
  | 'idle'
  | 'pending_tap'
  | 'single_tap'
  | 'double_tap'
  | 'horizontal_seek'
  | 'vertical_brightness'
  | 'vertical_volume'
  | 'long_press_boost'
  | 'pinch_zoom'
  | 'pan'
  | 'control_interaction';

export interface GesturePointer {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  side: 'left' | 'right' | 'center';
}

export interface BrightnessFeedbackState {
  level: number; // 40 to 160 (%)
  visible: boolean;
}

export interface VolumeFeedbackState {
  level: number; // 0 to 1
  isMuted: boolean;
  visible: boolean;
  isProgrammaticDisabled: boolean; // When browser/OS blocks programmatic volume
}

export interface SeekFeedbackState {
  isDragging: boolean;
  startSeconds: number;
  targetSeconds: number;
  deltaSeconds: number;
  duration: number;
  direction: 'forward' | 'backward';
  visible: boolean;
}

export interface SpeedBoostFeedbackState {
  active: boolean;
  speed: number;
  originalSpeed: number;
}

export interface ZoomFeedbackState {
  scale: number; // 1.0 to 3.0
  visible: boolean;
}

export interface DoubleTapFeedbackState {
  id: number;
  x: number;
  y: number;
  deltaSeconds: number;
  label: string;
  side: 'left' | 'right' | 'center';
}

export interface GestureSensitivityConfig {
  slop: number; // Movement required to lock gesture (pixels)
  seekRatio: number; // Sensitivity of horizontal seek (seconds per 100px)
  verticalRatio: number; // Sensitivity of volume/brightness (units per 100px)
}

export const SENSITIVITY_PRESETS: Record<'low' | 'medium' | 'high', GestureSensitivityConfig> = {
  low: {
    slop: 16,
    seekRatio: 30, // 30s per 100px swipe
    verticalRatio: 0.15,
  },
  medium: {
    slop: 12,
    seekRatio: 60, // 60s per 100px swipe
    verticalRatio: 0.22,
  },
  high: {
    slop: 8,
    seekRatio: 90, // 90s per 100px swipe
    verticalRatio: 0.32,
  },
};
