'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  GestureType,
  BrightnessFeedbackState,
  VolumeFeedbackState,
  SeekFeedbackState,
  SpeedBoostFeedbackState,
  ZoomFeedbackState,
  DoubleTapFeedbackState,
  SENSITIVITY_PRESETS,
} from '@/types/gestures';
import { UserSettings } from '@/lib/storage/db';

export interface UseVideoGesturesProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  brightness: number;
  settings: UserSettings;
  isControlsVisible: boolean;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onBrightnessChange: (brightness: number) => void;
  onPlaybackSpeedChange: (speed: number) => void;
  onTogglePlay: () => void;
  onToggleControls: () => void;
  onResetControlsTimer: () => void;
}

export function useVideoGestures({
  videoRef,
  containerRef,
  duration,
  currentTime,
  volume,
  isMuted,
  playbackSpeed,
  brightness,
  settings,
  isControlsVisible,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onBrightnessChange,
  onPlaybackSpeedChange,
  onTogglePlay,
  onToggleControls,
  onResetControlsTimer,
}: UseVideoGesturesProps) {
  // Feedback States for HUD Overlays
  const [gestureState, setGestureState] = useState<GestureType>('idle');
  const [brightnessFeedback, setBrightnessFeedback] = useState<BrightnessFeedbackState>({
    level: brightness,
    visible: false,
  });
  const [volumeFeedback, setVolumeFeedback] = useState<VolumeFeedbackState>({
    level: volume,
    isMuted,
    visible: false,
    isProgrammaticDisabled: false,
  });
  const [seekFeedback, setSeekFeedback] = useState<SeekFeedbackState>({
    isDragging: false,
    startSeconds: 0,
    targetSeconds: 0,
    deltaSeconds: 0,
    duration: 0,
    direction: 'forward',
    visible: false,
  });
  const [speedBoostFeedback, setSpeedBoostFeedback] = useState<SpeedBoostFeedbackState>({
    active: false,
    speed: settings.longPressSpeed || 2.0,
    originalSpeed: playbackSpeed,
  });
  const [zoomFeedback, setZoomFeedback] = useState<ZoomFeedbackState>({
    scale: 1.0,
    visible: false,
  });
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [doubleTapRipples, setDoubleTapRipples] = useState<DoubleTapFeedbackState[]>([]);

  // Internal Gesture Tracking Refs
  const activePointersRef = useRef<Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }>>(
    new Map()
  );
  const gestureTypeRef = useRef<GestureType>('idle');
  const initialGestureSideRef = useRef<'left' | 'right' | 'center'>('center');
  const startValuesRef = useRef({
    brightness: 100,
    volume: 1.0,
    time: 0,
    speed: 1.0,
    initialPinchDistance: 0,
    initialZoomScale: 1.0,
  });
  const currentZoomScaleRef = useRef<number>(1.0);
  const pendingTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cumulativeDoubleTapRef = useRef<{
    side: 'left' | 'right' | 'center';
    count: number;
    lastTime: number;
  }>({
    side: 'center',
    count: 0,
    lastTime: 0,
  });

  // Haptic feedback trigger
  const triggerHaptic = useCallback(
    (pattern: number | number[] = 15) => {
      if (
        settings.hapticFeedback &&
        typeof window !== 'undefined' &&
        'vibrate' in navigator &&
        typeof navigator.vibrate === 'function'
      ) {
        try {
          navigator.vibrate(pattern);
        } catch {}
      }
    },
    [settings.hapticFeedback]
  );



  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (pendingTapTimerRef.current) clearTimeout(pendingTapTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Reset zoom action
  const resetZoom = useCallback(() => {
    currentZoomScaleRef.current = 1.0;
    setZoomScale(1.0);
    setZoomFeedback({ scale: 1.0, visible: true });
    setTimeout(() => {
      setZoomFeedback((prev) => (prev.scale === 1.0 ? { ...prev, visible: false } : prev));
    }, 1200);
  }, []);

  // Helper to determine touch zone
  const getHorizontalZone = (x: number, width: number): 'left' | 'right' | 'center' => {
    if (x < width * 0.35) return 'left';
    if (x > width * 0.65) return 'right';
    return 'center';
  };

  // Sensitivity configuration
  const sensitivity = SENSITIVITY_PRESETS[settings.gestureSensitivity || 'medium'];

  // POINTER DOWN
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!settings.gesturesEnabled) return;

      // Ignore secondary buttons (e.g. right click)
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      // Ignore if interaction originated on a form control or interactive element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('button') ||
          target.closest('input') ||
          target.closest('select') ||
          target.closest('[role="slider"]') ||
          target.closest('[data-no-gesture]'))
      ) {
        gestureTypeRef.current = 'control_interaction';
        return;
      }

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = Date.now();

      // Record pointer
      activePointersRef.current.set(e.pointerId, {
        x,
        y,
        startX: x,
        startY: y,
        startTime: now,
      });

      // MULTI-TOUCH PINCH DETECTION
      if (activePointersRef.current.size === 2 && settings.pinchZoomGesture) {
        // Cancel single tap and long press
        if (pendingTapTimerRef.current) clearTimeout(pendingTapTimerRef.current);
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

        const [p1, p2] = Array.from(activePointersRef.current.values());
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        startValuesRef.current.initialPinchDistance = dist;
        startValuesRef.current.initialZoomScale = currentZoomScaleRef.current;

        gestureTypeRef.current = 'pinch_zoom';
        setGestureState('pinch_zoom');
        setZoomFeedback({ scale: currentZoomScaleRef.current, visible: true });
        return;
      }

      if (activePointersRef.current.size > 2) return;

      // Capture pointer for continuous drag tracking outside container bounds
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}

      const zone = getHorizontalZone(x, rect.width);
      initialGestureSideRef.current = zone;

      startValuesRef.current.brightness = brightness;
      startValuesRef.current.volume = volume;
      startValuesRef.current.time = currentTime;
      startValuesRef.current.speed = playbackSpeed;

      gestureTypeRef.current = 'pending_tap';
      setGestureState('pending_tap');

      // Schedule LONG-PRESS speed boost if enabled
      if (settings.longPressBoostGesture) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          // If still in pending tap and hasn't moved beyond threshold
          if (gestureTypeRef.current === 'pending_tap') {
            gestureTypeRef.current = 'long_press_boost';
            setGestureState('long_press_boost');

            const boostSpeed = settings.longPressSpeed || 2.0;
            onPlaybackSpeedChange(boostSpeed);
            setSpeedBoostFeedback({
              active: true,
              speed: boostSpeed,
              originalSpeed: startValuesRef.current.speed,
            });
            triggerHaptic([25]);
          }
        }, 450);
      }
    },
    [
      settings.gesturesEnabled,
      settings.pinchZoomGesture,
      settings.longPressBoostGesture,
      settings.longPressSpeed,
      containerRef,
      brightness,
      volume,
      currentTime,
      playbackSpeed,
      onPlaybackSpeedChange,
      triggerHaptic,
    ]
  );

  // POINTER MOVE
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ptr = activePointersRef.current.get(e.pointerId);
      if (!ptr) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      ptr.x = currentX;
      ptr.y = currentY;

      // HANDLE TWO-FINGER PINCH ZOOM
      if (gestureTypeRef.current === 'pinch_zoom' && activePointersRef.current.size === 2) {
        const [p1, p2] = Array.from(activePointersRef.current.values());
        const newDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (startValuesRef.current.initialPinchDistance > 10) {
          const ratio = newDist / startValuesRef.current.initialPinchDistance;
          const rawScale = startValuesRef.current.initialZoomScale * ratio;
          const clamped = Math.max(1.0, Math.min(3.0, parseFloat(rawScale.toFixed(2))));
          currentZoomScaleRef.current = clamped;
          setZoomScale(clamped);
          setZoomFeedback({ scale: clamped, visible: true });
        }
        return;
      }

      // Check single pointer gestures
      const deltaX = currentX - ptr.startX;
      const deltaY = currentY - ptr.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Lock into gesture once slop is crossed
      if (gestureTypeRef.current === 'pending_tap') {
        if (absDeltaX > sensitivity.slop || absDeltaY > sensitivity.slop) {
          // Cancel long press
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          // Decide direction: Horizontal Seek vs Vertical Adjustment
          if (absDeltaX > absDeltaY * 1.2 && settings.horizontalSeekGesture && duration > 0) {
            // Horizontal Seek gesture locked
            gestureTypeRef.current = 'horizontal_seek';
            setGestureState('horizontal_seek');
            triggerHaptic(10);
          } else if (absDeltaY > absDeltaX * 1.2) {
            // Vertical gesture: Left half = Brightness, Right half = Volume
            if (ptr.startX < rect.width * 0.5 && settings.brightnessGesture) {
              gestureTypeRef.current = 'vertical_brightness';
              setGestureState('vertical_brightness');
            } else if (ptr.startX >= rect.width * 0.5 && settings.volumeGesture) {
              gestureTypeRef.current = 'vertical_volume';
              setGestureState('vertical_volume');
            }
          }
        }
      }

      // ACTIVE: HORIZONTAL SEEK GESTURE
      if (gestureTypeRef.current === 'horizontal_seek') {
        const seekRatio = sensitivity.seekRatio; // seconds per 100px
        const seekDelta = (deltaX / 100) * seekRatio;
        const targetSeconds = Math.max(0, Math.min(duration, startValuesRef.current.time + seekDelta));
        const diff = targetSeconds - startValuesRef.current.time;

        setSeekFeedback({
          isDragging: true,
          startSeconds: startValuesRef.current.time,
          targetSeconds,
          deltaSeconds: diff,
          duration,
          direction: diff >= 0 ? 'forward' : 'backward',
          visible: true,
        });
        return;
      }

      // ACTIVE: VERTICAL BRIGHTNESS GESTURE (Left side)
      if (gestureTypeRef.current === 'vertical_brightness') {
        // Dragging up (negative deltaY) increases brightness
        const verticalDelta = -deltaY;
        const changePercent = (verticalDelta / (rect.height * 0.75)) * 100;
        const newBrightness = Math.max(40, Math.min(160, Math.round(startValuesRef.current.brightness + changePercent)));

        onBrightnessChange(newBrightness);
        setBrightnessFeedback({
          level: newBrightness,
          visible: true,
        });
        return;
      }

      // ACTIVE: VERTICAL VOLUME GESTURE (Right side)
      if (gestureTypeRef.current === 'vertical_volume') {
        const verticalDelta = -deltaY;
        const changeRatio = verticalDelta / (rect.height * 0.75);
        const newVolume = Math.max(0, Math.min(1, startValuesRef.current.volume + changeRatio));

        // Test if programmatic volume is supported on this browser/device
        let isBlocked = false;
        if (videoRef.current) {
          try {
            const oldVol = videoRef.current.volume;
            videoRef.current.volume = newVolume;
            // On iOS Safari, assignment is silently ignored
            if (newVolume !== oldVol && videoRef.current.volume === oldVol) {
              isBlocked = true;
            }
          } catch {
            isBlocked = true;
          }
        }

        onVolumeChange(newVolume);
        setVolumeFeedback({
          level: newVolume,
          isMuted: newVolume === 0,
          visible: true,
          isProgrammaticDisabled: isBlocked,
        });
      }
    },
    [
      containerRef,
      sensitivity,
      settings.horizontalSeekGesture,
      settings.brightnessGesture,
      settings.volumeGesture,
      duration,
      triggerHaptic,
      onBrightnessChange,
      videoRef,
      onVolumeChange,
    ]
  );

  // POINTER UP / RELEASE
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ptr = activePointersRef.current.get(e.pointerId);
      activePointersRef.current.delete(e.pointerId);

      // Release pointer capture
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      // Cancel any active long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Restore speed if releasing from long-press boost
      if (gestureTypeRef.current === 'long_press_boost') {
        onPlaybackSpeedChange(startValuesRef.current.speed);
        setSpeedBoostFeedback({
          active: false,
          speed: startValuesRef.current.speed,
          originalSpeed: startValuesRef.current.speed,
        });
        gestureTypeRef.current = 'idle';
        setGestureState('idle');
        return;
      }

      // Commit horizontal seek on release
      if (gestureTypeRef.current === 'horizontal_seek') {
        const finalTarget = seekFeedback.targetSeconds;
        onSeek(finalTarget);
        setSeekFeedback((prev) => ({ ...prev, isDragging: false }));

        // Hide seek feedback smoothly after release
        setTimeout(() => {
          setSeekFeedback((prev) => (!prev.isDragging ? { ...prev, visible: false } : prev));
        }, 500);

        gestureTypeRef.current = 'idle';
        setGestureState('idle');
        onResetControlsTimer();
        return;
      }

      // Smoothly hide brightness & volume indicators
      if (gestureTypeRef.current === 'vertical_brightness') {
        setTimeout(() => {
          setBrightnessFeedback((prev) => ({ ...prev, visible: false }));
        }, 800);
        gestureTypeRef.current = 'idle';
        setGestureState('idle');
        onResetControlsTimer();
        return;
      }

      if (gestureTypeRef.current === 'vertical_volume') {
        setTimeout(() => {
          setVolumeFeedback((prev) => ({ ...prev, visible: false }));
        }, 800);
        gestureTypeRef.current = 'idle';
        setGestureState('idle');
        onResetControlsTimer();
        return;
      }

      if (gestureTypeRef.current === 'pinch_zoom') {
        if (activePointersRef.current.size === 0) {
          gestureTypeRef.current = 'idle';
          setGestureState('idle');
          setTimeout(() => {
            setZoomFeedback((prev) => ({ ...prev, visible: false }));
          }, 1200);
        }
        return;
      }

      // HANDLE TAP & DOUBLE TAP
      if (gestureTypeRef.current === 'pending_tap' && ptr) {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = ptr.startX;
        const y = ptr.startY;
        const zone = getHorizontalZone(x, rect.width);
        const now = Date.now();

        const timeSinceLastTap = now - cumulativeDoubleTapRef.current.lastTime;
        const isDoubleTap = timeSinceLastTap < 400 && zone === cumulativeDoubleTapRef.current.side;

        if (isDoubleTap && settings.doubleTapGesture) {
          // DOUBLE TAP RECOGNIZED
          if (pendingTapTimerRef.current) {
            clearTimeout(pendingTapTimerRef.current);
            pendingTapTimerRef.current = null;
          }

          gestureTypeRef.current = 'double_tap';
          setGestureState('double_tap');

          cumulativeDoubleTapRef.current.count += 1;
          cumulativeDoubleTapRef.current.lastTime = now;

          const baseInterval = settings.seekInterval || 10;
          const cumulativeDelta = baseInterval * cumulativeDoubleTapRef.current.count;

          if (zone === 'left') {
            // Seek backward
            onSeek(Math.max(0, currentTime - baseInterval));
            triggerHaptic([15, 40, 15]);

            // Add visual ripple
            const rippleId = now;
            setDoubleTapRipples((prev) => [
              ...prev,
              {
                id: rippleId,
                x,
                y,
                deltaSeconds: -cumulativeDelta,
                label: `-${cumulativeDelta}s`,
                side: 'left',
              },
            ]);

            setTimeout(() => {
              setDoubleTapRipples((prev) => prev.filter((r) => r.id !== rippleId));
            }, 800);
          } else if (zone === 'right') {
            // Seek forward
            onSeek(Math.min(duration, currentTime + baseInterval));
            triggerHaptic([15, 40, 15]);

            const rippleId = now;
            setDoubleTapRipples((prev) => [
              ...prev,
              {
                id: rippleId,
                x,
                y,
                deltaSeconds: cumulativeDelta,
                label: `+${cumulativeDelta}s`,
                side: 'right',
              },
            ]);

            setTimeout(() => {
              setDoubleTapRipples((prev) => prev.filter((r) => r.id !== rippleId));
            }, 800);
          } else {
            // Center zone double tap
            if (settings.centerDoubleTapAction === 'play_pause') {
              onTogglePlay();
              triggerHaptic(20);
            }
          }

          // Reset gesture state after a short settle
          setTimeout(() => {
            gestureTypeRef.current = 'idle';
            setGestureState('idle');
          }, 400);
        } else {
          // Potential SINGLE TAP: wait for double-tap timeout before firing
          cumulativeDoubleTapRef.current = {
            side: zone,
            count: 1,
            lastTime: now,
          };

          if (pendingTapTimerRef.current) clearTimeout(pendingTapTimerRef.current);
          pendingTapTimerRef.current = setTimeout(() => {
            // SINGLE TAP CONFIRMED
            gestureTypeRef.current = 'single_tap';
            setGestureState('single_tap');

            // Single tap toggles playback control HUD
            onToggleControls();
            onResetControlsTimer();

            gestureTypeRef.current = 'idle';
            setGestureState('idle');
            cumulativeDoubleTapRef.current.lastTime = 0;
          }, 260);
        }
      }
    },
    [
      containerRef,
      seekFeedback.targetSeconds,
      settings.doubleTapGesture,
      settings.seekInterval,
      settings.centerDoubleTapAction,
      currentTime,
      duration,
      onSeek,
      onTogglePlay,
      onToggleControls,
      onResetControlsTimer,
      onPlaybackSpeedChange,
      triggerHaptic,
    ]
  );

  // POINTER CANCEL
  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      activePointersRef.current.delete(e.pointerId);

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (pendingTapTimerRef.current) {
        clearTimeout(pendingTapTimerRef.current);
        pendingTapTimerRef.current = null;
      }

      if (gestureTypeRef.current === 'long_press_boost') {
        onPlaybackSpeedChange(startValuesRef.current.speed);
        setSpeedBoostFeedback({
          active: false,
          speed: startValuesRef.current.speed,
          originalSpeed: startValuesRef.current.speed,
        });
      }

      setBrightnessFeedback((prev) => ({ ...prev, visible: false }));
      setVolumeFeedback((prev) => ({ ...prev, visible: false }));
      setSeekFeedback((prev) => ({ ...prev, visible: false, isDragging: false }));
      setZoomFeedback((prev) => ({ ...prev, visible: false }));

      gestureTypeRef.current = 'idle';
      setGestureState('idle');
    },
    [onPlaybackSpeedChange]
  );

  const effectiveBrightnessFeedback: BrightnessFeedbackState = {
    level: brightnessFeedback.visible ? brightnessFeedback.level : brightness,
    visible: brightnessFeedback.visible,
  };
  const effectiveVolumeFeedback: VolumeFeedbackState = {
    level: volumeFeedback.visible ? volumeFeedback.level : volume,
    isMuted: volumeFeedback.visible ? volumeFeedback.isMuted : isMuted,
    visible: volumeFeedback.visible,
    isProgrammaticDisabled: volumeFeedback.isProgrammaticDisabled,
  };

  return {
    gestureState,
    zoomScale,
    brightnessFeedback: effectiveBrightnessFeedback,
    volumeFeedback: effectiveVolumeFeedback,
    seekFeedback,
    speedBoostFeedback,
    zoomFeedback,
    doubleTapRipples,
    resetZoom,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
