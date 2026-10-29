'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useMedia } from '@/context/MediaSessionContext';
import { ControlsOverlay } from './ControlsOverlay';
import { VideoGestureSurface } from './gestures/VideoGestureSurface';
import { SubtitleOverlay } from './SubtitleOverlay';
import { ResumeBanner } from './ResumeBanner';
import { SubtitlesModal } from './SubtitlesModal';
import { PlaylistDrawer } from './PlaylistDrawer';
import { ShortcutsModal } from './ShortcutsModal';
import { PlaybackDiagnosticsModal } from '@/components/diagnostics/PlaybackDiagnosticsModal';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import {
  DEFAULT_ORIENTATION,
  rotateClockwise,
  rotateCounterClockwise,
  rotate180,
  resetOrientation as resetOrientationState,
  composeTransform,
  rotationFitScale,
  type VideoOrientation,
} from '@/lib/player/orientation';
import {
  getScreenOrientation,
  isLandscapeViewport,
  releaseScreenOrientation,
  requestScreenRotation,
  ROTATE_SCREEN_FALLBACK_MESSAGE,
} from '@/lib/player/screen-orientation';
import { fitBiasScale, modeBaseBox } from '@/lib/player/display-modes';
import { type VideoZoomApi } from '@/components/player/gestures/VideoGestureSurface';
import { useMediaSession } from '@/hooks/use-media-session';
import { probeMedia } from '@/lib/media/container-probe';
import type { MediaProbe } from '@/lib/media/container-probe';
import { decidePlaybackPlan, snapshotCapabilities, assessFeasibility } from '@/lib/media/compatibility';
import type { PlaybackDecision } from '@/lib/media/compatibility';
import { convertMedia, cancelMediaConversion, isRefusal } from '@/lib/media/conversion';
import type { ConversionResult, ConversionRefusal } from '@/lib/media/conversion';
import { CompatibilityDialog } from './CompatibilityDialog';
import { Loader2, AlertCircle, FolderOpen, Film, Play, Sparkles, Activity, RefreshCw } from 'lucide-react';
import { VideoFitMode } from '@/lib/storage/db';
import { generateTestClipFile } from '@/lib/media/testClipGenerator';
import { createAudioEnhancer, type AudioEnhancer } from '@/lib/audio/enhancer';
import type { AudioPresetId, BandGains } from '@/lib/audio/presets';

export const VideoPlayer: React.FC = () => {
  const {
    currentItem,
    queue,
    currentIndex,
    nextTrack,
    prevTrack,
    loopMode,
    setLoopMode,
    fitMode,
    setFitMode,
    playbackSpeed,
    setPlaybackSpeed,
    abRepeat,
    setABPointA,
    setABPointB,
    clearABRepeat,
    toggleABRepeat,
    sleepTimerRemainingSeconds,
    setSleepTimer,
    isPrivateSession,
    setIsPrivateSession,
    isCurrentFavorite,
    toggleFavorite,
    playerProfile,
    setPlayerProfile,
    activeSubtitle,
    subtitleEnabled,
    setSubtitleOffset,
    settings,
    updateSettings,
    savedProgress,
    recordProgress,
    clearSavedProgress,
    selectFiles,
  } = useMedia();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedRanges, setBufferedRanges] = useState<{ start: number; end: number }[]>([]);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isGeneratingTest, setIsGeneratingTest] = useState<boolean>(false);

  // Phase 2.7 compatibility pipeline state
  type CompatPhase = 'probing' | 'silent' | 'offer' | 'converting' | 'ready' | 'failed';
  interface CompatState {
    mediaKey: string;
    phase: CompatPhase;
    probe: MediaProbe;
    decision: PlaybackDecision;
    progress: number | null;
    result?: ConversionResult;
    refusal?: ConversionRefusal;
    error?: string;
  }
  const [compat, setCompat] = useState<CompatState | null>(null);
  const compatCancelRef = useRef(false);
  // Converted copy for the CURRENT original (object URL we own and must revoke).
  const [convertedPlay, setConvertedPlay] = useState<{ mediaKey: string; objectUrl: string; name: string } | null>(null);
  const activeObjectUrl = convertedPlay && convertedPlay.mediaKey === currentItem?.id ? convertedPlay.objectUrl : currentItem?.objectUrl;

  // In-player brightness (40% to 160%)
  const [brightness, setBrightness] = useState<number>(100);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Visual video rotation - playback state is untouched.
  const [orientationState, setOrientationState] = useState<{ mediaUrl?: string; value: VideoOrientation }>({
    value: DEFAULT_ORIENTATION,
  });
  // Orientation belongs to the current media; switching files derives an upright view
  // without a reset effect.
  const orientation: VideoOrientation =
    orientationState.mediaUrl === currentItem?.objectUrl ? orientationState.value : DEFAULT_ORIENTATION;
  const applyOrientation = (next: VideoOrientation) =>
    setOrientationState({ mediaUrl: currentItem?.objectUrl, value: next });
  const [videoNaturalSize, setVideoNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Fullscreen & PiP
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPiPSupported] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return 'pictureInPictureEnabled' in document && !!document.pictureInPictureEnabled;
    }
    return false;
  });

  // Controls visibility & auto-hide
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [showSubtitlesModal, setShowSubtitlesModal] = useState<boolean>(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);

  // Fix 3: while Subtitle Studio is open the player navigation must stay
  // visible and usable — the studio is a docked panel, not a takeover, so
  // auto-hide is suspended instead of hidden behind a full-screen veil.
  const isControlsEffectivelyVisible = controlsVisible || !isPlaying || showSubtitlesModal;

  // Pause playback when sleep timer expires
  useEffect(() => {
    if (sleepTimerRemainingSeconds === 0) {
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [sleepTimerRemainingSeconds]);

  // Resume prompt dismissal tracking
  const [resumeDismissedFor, setResumeDismissedFor] = useState<string | null>(null);
  const shouldShowResume = Boolean(
    savedProgress &&
    savedProgress.id !== resumeDismissedFor &&
    savedProgress.currentTime > 5 &&
    savedProgress.currentTime < (savedProgress.duration - 10) &&
    settings.resumePlayback
  );

  // Fallback file input
  const filePickerRef = useRef<HTMLInputElement>(null);

  // Phase 2.7: probe compatibility whenever the current file changes.
  // Native playback is never blocked: probing runs in the background and only
  // opens a dialog when the decision engine says conversion is needed.
  useEffect(() => {
    if (!currentItem?.file) return;
    const mediaKey = currentItem.id;
    let cancelled = false;
    (async () => {
      try {
        const probe = await probeMedia(currentItem.file);
        if (cancelled) return;
        const caps = snapshotCapabilities(probe);
        const decision = decidePlaybackPlan(probe, caps);
        if (cancelled) return;
        if (decision.path === 'native') {
          setCompat(null);
          return;
        }
        const refusal =
          decision.path === 'convert' && decision.operation
            ? assessFeasibility(decision.operation, probe.sizeBytes, probe.durationSeconds)
            : null;
        const refuseObj: ConversionRefusal | undefined =
          refusal && !refusal.ok
            ? { refused: true, reason: refusal.refusal ?? 'too-large', explanation: refusal.explanation }
            : undefined;
        setCompat({
          mediaKey,
          phase: decision.path === 'convert' || decision.path === 'unsupported' ? 'offer' : 'silent',
          probe,
          decision,
          progress: null,
          refusal: refuseObj,
        });
      } catch {
        // Probing itself failed — stay silent; native attempt + error handler covers it.
        if (!cancelled) setCompat(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentItem?.id, currentItem?.file]);

  // Revoke a converted copy's object URL when it is replaced or dropped.
  useEffect(() => {
    const held = convertedPlay;
    return () => {
      if (held) {
        try {
          URL.revokeObjectURL(held.objectUrl);
        } catch {}
      }
    };
  }, [convertedPlay]);

  // Drop the converted copy when a different file becomes current.
  useEffect(() => {
    if (convertedPlay && convertedPlay.mediaKey !== currentItem?.id) {
      try {
        URL.revokeObjectURL(convertedPlay.objectUrl);
      } catch {}
      setConvertedPlay(null);
    }
  }, [currentItem?.id, convertedPlay]);

  // Auto-play / load media stream whenever the active source changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentItem || !activeObjectUrl) return;

    setPlaybackError(null);
    setIsBuffering(false);

    // Call load explicitly to reset decoder for the new objectUrl
    video.load();

    // Attempt autoplay since user selected or changed a video
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          // Autoplay blocked by browser policy without user gesture; user can click center Play
          console.log('Autoplay waiting for user gesture:', err.name);
          setIsPlaying(false);
        });
    }
  }, [currentItem, activeObjectUrl]);

  // Track container size so rotated video bounds can be computed without clipping.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      setContainerSize({ w: container.clientWidth, h: container.clientHeight });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Update loop attribute on video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = loopMode === 'one';
    }
  }, [loopMode]);

  // Update playback speed on video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Auto-hide controls timer trigger on user interaction
  const resetAutoHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);

    if (isPlaying) {
      autoHideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, settings.autoHideDelay || 3500);
    }
  }, [isPlaying, settings.autoHideDelay]);

  // When playback state changes, handle auto-hide timer without calling setState
  useEffect(() => {
    if (isPlaying && !showSubtitlesModal) {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, settings.autoHideDelay || 3500);
    } else {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    }
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [isPlaying, settings.autoHideDelay, showSubtitlesModal]);

  // --- Fix 4: local audio clarity chain (Web Audio, no network) ---
  const audioEnhancerRef = useRef<AudioEnhancer | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const audioGestureAllowedRef = useRef(false);

  const ensureAudioEnhancer = useCallback((): AudioEnhancer | null => {
    const el = videoRef.current;
    if (!el) return null;
    if (!audioEnhancerRef.current) {
      audioEnhancerRef.current = createAudioEnhancer(el);
    }
    return audioEnhancerRef.current;
  }, []);

  // Applied only from real user gestures (preset taps, play, band drags) so
  // an AudioContext can never block playback from starting.
  const applyAudioPreset = useCallback(
    async (id: AudioPresetId, bands?: BandGains) => {
      audioGestureAllowedRef.current = true;
      const enhancer = ensureAudioEnhancer();
      if (!enhancer) return;
      const ok = await enhancer.applyPreset(id, bands ?? settings.audioBands);
      if (!ok && id !== 'off') {
        setAudioNotice('Audio enhancement is not available in this browser. Playback continues with original audio.');
      } else {
        setAudioNotice(null);
      }
    },
    [ensureAudioEnhancer, settings.audioBands]
  );

  const handleAudioPresetChange = useCallback(
    (id: AudioPresetId) => {
      updateSettings({ audioPreset: id });
      void applyAudioPreset(id);
    },
    [applyAudioPreset, updateSettings]
  );

  const handleAudioBandChange = useCallback(
    (band: keyof BandGains, db: number) => {
      const next = { ...settings.audioBands, [band]: db };
      updateSettings({ audioPreset: 'custom', audioBands: next });
      void applyAudioPreset('custom', next);
    },
    [applyAudioPreset, settings.audioBands, updateSettings]
  );

  const handleAudioReset = useCallback(() => {
    const flat: BandGains = { low: 0, mid: 0, high: 0 };
    updateSettings({ audioPreset: 'off', audioBands: flat });
    audioGestureAllowedRef.current = true;
    void ensureAudioEnhancer()?.reset();
    setAudioNotice(null);
  }, [ensureAudioEnhancer, updateSettings]);

  // Re-apply a saved preset once the element exists and a gesture happened.
  useEffect(() => {
    if (!audioGestureAllowedRef.current) return;
    void applyAudioPreset(settings.audioPreset, settings.audioBands);
    // Only when the saved values change; gestures drive the first apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.audioPreset, settings.audioBands.low, settings.audioBands.mid, settings.audioBands.high]);

  useEffect(() => {
    return () => {
      audioEnhancerRef.current?.dispose();
      audioEnhancerRef.current = null;
    };
  }, []);

  // --- Real screen rotation (Screen Orientation API, Phase 2.3) ---
  const [rotateScreenNotice, setRotateScreenNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showRotateScreenNotice = useCallback((message: string) => {
    setRotateScreenNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setRotateScreenNotice(null), 5000);
  }, []);

  const enterPlayerFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    if (container.requestFullscreen) {
      await container.requestFullscreen();
    } else {
      (container as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
    }
  }, []);

  // User-gesture entry point: attempts a real orientation lock (fullscreen
  // first, as required by Android Chrome / installed PWAs). On any rejection
  // or missing support we show the truthful fallback message instead of
  // pretending the screen rotated.
  const rotationInFlightRef = useRef(false);
  // True while this page owns a real orientation lock (native or web). The
  // AppMintly APK applies the activity orientation natively and never fires
  // fullscreenchange, so a route change had nothing to release it: the whole
  // app stayed sideways after leaving the player.
  const orientationLockedRef = useRef(false);
  const rotateScreen = useCallback(async () => {
    // Single-flight: repeated taps while a rotation is in progress must never
    // stack fullscreen/lock requests (that is what caused orientation loops).
    if (rotationInFlightRef.current) return;
    rotationInFlightRef.current = true;
    try {
      const result = await requestScreenRotation(enterPlayerFullscreen, getScreenOrientation(), {
        landscapeHint: isLandscapeViewport(),
      });
      if (result === 'fallback') {
        showRotateScreenNotice(ROTATE_SCREEN_FALLBACK_MESSAGE);
      } else {
        // Real rotation happened: clear any stale fallback notice.
        orientationLockedRef.current = true;
        setRotateScreenNotice(null);
      }
    } finally {
      rotationInFlightRef.current = false;
    }
  }, [enterPlayerFullscreen, showRotateScreenNotice]);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const wasFullscreen = !!document.fullscreenElement;
      setIsFullscreen(wasFullscreen);
      // Leaving fullscreen also ends rotation mode: release the orientation
      // lock so the device returns to normal portrait behaviour.
      if (!wasFullscreen) releaseScreenOrientation(getScreenOrientation());
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // The player owns the orientation lock for as long as it is mounted. Leaving
  // the route (back to library/home, app backgrounded) must hand the device
  // back to normal orientation, otherwise the library stays stuck in
  // landscape. This is the path the APK actually takes: no fullscreenchange
  // ever fires for a native rotation.
  useEffect(() => {
    const release = () => {
      if (!orientationLockedRef.current) return;
      orientationLockedRef.current = false;
      releaseScreenOrientation(getScreenOrientation());
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') release();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', release);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, []);

  // Play / Pause toggle with browser policy fallback
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      setPlaybackError(null);
      // A tap on play is a valid gesture: safe to start audio processing now.
      audioGestureAllowedRef.current = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn('Playback initiation blocked:', err);
            // If prevented because of audio/autoplay policy, retry muted
            if (err.name === 'NotAllowedError') {
              video.muted = true;
              setIsMuted(true);
              video
                .play()
                .then(() => {
                  setIsPlaying(true);
                })
                .catch(() => {
                  setIsPlaying(false);
                });
            } else {
              setIsPlaying(false);
            }
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Seeking
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(time, duration || 0));
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const skipSeconds = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    seekTo(video.currentTime + delta);
  }, [seekTo]);

  // Volume
  const handleVolumeChange = useCallback((newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Gesture adjustments
  const handleBrightnessRatio = useCallback((deltaRatio: number) => {
    setBrightness((prev) => Math.max(40, Math.min(160, prev + deltaRatio * 100)));
  }, []);

  const handleVolumeRatio = useCallback((deltaRatio: number) => {
    handleVolumeChange(volume + deltaRatio);
  }, [volume, handleVolumeChange]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
        (container as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  // Picture in Picture
  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP request failed:', e);
    }
  }, []);

  // Loop toggle
  const toggleLoop = useCallback(() => {
    if (loopMode === 'none') setLoopMode('one');
    else if (loopMode === 'one') setLoopMode('all');
    else setLoopMode('none');
  }, [loopMode, setLoopMode]);

  // Keyboard shortcuts wiring
  useKeyboardShortcuts({
    onTogglePlay: togglePlayPause,
    onSeek: skipSeconds,
    onVolumeChange: (delta) => handleVolumeChange(volume + delta),
    onToggleMute: toggleMute,
    onToggleFullscreen: toggleFullscreen,
    onToggleSubtitles: () => setShowSubtitlesModal((prev) => !prev),
    onChangeSpeed: (delta) => {
      const nextSpeed = Math.max(0.25, Math.min(3.0, playbackSpeed + delta));
      setPlaybackSpeed(nextSpeed);
    },
    onSetABPointA: () => setABPointA(currentTime),
    onSetABPointB: () => setABPointB(currentTime),
    onClearABRepeat: clearABRepeat,
    onEscape: () => {
      if (showSubtitlesModal) setShowSubtitlesModal(false);
      else if (showPlaylistDrawer) setShowPlaylistDrawer(false);
      else if (showShortcutsModal) setShowShortcutsModal(false);
      else if (showDiagnosticsModal) setShowDiagnosticsModal(false);
      else if (document.fullscreenElement) document.exitFullscreen();
    },
    seekInterval: settings.seekInterval || 10,
    isEnabled: !!currentItem,
  });

  // MediaSession wiring
  useMediaSession({
    title: currentItem?.name,
    isPlaying,
    onPlay: () => videoRef.current?.play(),
    onPause: () => videoRef.current?.pause(),
    onSeekBackward: () => skipSeconds(-(settings.seekInterval || 10)),
    onSeekForward: () => skipSeconds(settings.seekInterval || 10),
    onPreviousTrack: currentIndex > 0 || loopMode === 'all' ? prevTrack : undefined,
    onNextTrack: currentIndex < queue.length - 1 || loopMode === 'all' ? nextTrack : undefined,
    onSeekTo: seekTo,
    duration,
    currentTime,
  });

  // Video element event listeners
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    // A-B Repeat Loop enforcement
    if (abRepeat.isActive && abRepeat.pointB !== null && abRepeat.pointA !== null) {
      if (video.currentTime >= abRepeat.pointB) {
        video.currentTime = abRepeat.pointA;
        setCurrentTime(abRepeat.pointA);
        return;
      }
    }

    // Save progress periodically (throttled every 5 seconds)
    if (Math.floor(video.currentTime) % 5 === 0) {
      recordProgress(video.currentTime, video.duration || duration);
    }

    // Update buffer ranges
    if (video.buffered && video.buffered.length > 0) {
      const ranges: { start: number; end: number }[] = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push({
          start: video.buffered.start(i),
          end: video.buffered.end(i),
        });
      }
      setBufferedRanges(ranges);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setVideoNaturalSize({ w: video.videoWidth || 0, h: video.videoHeight || 0 });
    setPlaybackError(null);
    setIsBuffering(false);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    // If the error bubbled from a <track> element, do NOT break video playback!
    if (e.target !== e.currentTarget) return;

    const video = videoRef.current;
    const mediaErr = video?.error;

    // MEDIA_ERR_ABORTED (1) occurs normally during load() or src change; ignore it
    if (!mediaErr || mediaErr.code === 1) return;

    let errorMsg = 'An error occurred while loading this video.';
    if (mediaErr.code === 2) {
      errorMsg = 'Device read error: Unable to read file data from device.';
    } else if (mediaErr.code === 3) {
      errorMsg = 'Video decode error: The file stream could not be decoded.';
    } else if (mediaErr.code === 4) {
      errorMsg =
        'Unsupported codec or container. Modern browsers natively support H.264/AAC MP4 and VP8/VP9 WebM. If your file is encoded in HEVC/H.265 or AC3 audio, please convert it to standard MP4/H.264.';
    }

    setPlaybackError(errorMsg);
    setIsBuffering(false);
    setIsPlaying(false);

    // Phase 2.7: on real decode failures, surface the compatibility pipeline.
    if (mediaErr.code === 3 || mediaErr.code === 4) {
      if (compat && compat.phase === 'silent') {
        // Probed earlier; open the offer now that native playback actually failed.
        setCompat({ ...compat, phase: 'offer' });
      } else if (!compat && currentItem?.file) {
        // Error came before/without a probe result — probe now.
        (async () => {
          try {
            const probe = await probeMedia(currentItem.file);
            const caps = snapshotCapabilities(probe);
            const decision = decidePlaybackPlan(probe, caps);
            const refusal =
              decision.path === 'convert' && decision.operation
                ? assessFeasibility(decision.operation, probe.sizeBytes, probe.durationSeconds)
                : null;
            setCompat({
              mediaKey: currentItem.id,
              phase: decision.path === 'convert' || decision.path === 'unsupported' ? 'offer' : 'silent',
              probe,
              decision,
              progress: null,
              refusal:
                refusal && !refusal.ok
                  ? { refused: true, reason: refusal.refusal ?? 'too-large', explanation: refusal.explanation }
                  : undefined,
            });
          } catch {
            // keep the plain error banner
          }
        })();
      }
    }
  };

  // --- Phase 2.7 conversion actions ---
  const handleStartConversion = () => {
    if (!compat || !compat.decision.operation || !currentItem?.file) return;
    compatCancelRef.current = false;
    setCompat({ ...compat, phase: 'converting', progress: null, error: undefined, refusal: undefined });
    (async () => {
      try {
        const outcome = await convertMedia({
          file: currentItem.file,
          probe: compat.probe,
          operation: compat.decision.operation!,
          onProgress: (pct) => setCompat((c) => (c && c.phase === 'converting' ? { ...c, progress: pct } : c)),
          isCancelled: () => compatCancelRef.current,
        });
        setCompat((c) => {
          if (!c) return c;
          if (isRefusal(outcome)) {
            return { ...c, phase: 'offer', refusal: outcome, progress: null };
          }
          return { ...c, phase: 'ready', result: outcome, progress: 100 };
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'AbortError' || compatCancelRef.current) {
          setCompat((c) => (c ? { ...c, phase: 'offer', progress: null } : c));
          return;
        }
        setCompat((c) =>
          c
            ? {
                ...c,
                phase: 'failed',
                progress: null,
                error:
                  err instanceof Error
                    ? err.message
                    : 'Conversion failed on this device. The original file is unchanged.',
              }
            : c
        );
      }
    })();
  };

  const handleCancelConversion = () => {
    compatCancelRef.current = true;
    cancelMediaConversion();
    setCompat((c) => (c ? { ...c, phase: 'offer', progress: null } : c));
  };

  const handlePlayConverted = () => {
    if (!compat?.result || !currentItem) return;
    setConvertedPlay((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev.objectUrl);
        } catch {}
      }
      return { mediaKey: currentItem.id, objectUrl: compat.result!.objectUrl, name: compat.result!.outputProbe.fileName ?? 'converted.mp4' };
    });
    setCompat(null);
    setPlaybackError(null);
  };

  const handleTryOriginal = () => {
    // Drop any converted copy and reload the original object URL.
    if (convertedPlay) {
      try {
        URL.revokeObjectURL(convertedPlay.objectUrl);
      } catch {}
      setConvertedPlay(null);
    }
    setCompat(null);
    setPlaybackError(null);
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => {});
    }
  };

  const handleDismissCompat = () => {
    setCompat(null);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      recordProgress(videoRef.current.duration, videoRef.current.duration);
    }
    if (loopMode === 'all' || currentIndex < queue.length - 1) {
      nextTrack();
    }
  };

  // Resume handlers
  const handleResume = () => {
    if (savedProgress && videoRef.current) {
      seekTo(savedProgress.currentTime);
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    if (savedProgress) setResumeDismissedFor(savedProgress.id);
    clearSavedProgress();
  };

  const handleRestart = () => {
    if (videoRef.current) {
      seekTo(0);
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    if (savedProgress) setResumeDismissedFor(savedProgress.id);
    clearSavedProgress();
  };

  // Display mode selection persists the preference (local settings only).
  const handleSetFitMode = useCallback((mode: VideoFitMode) => {
    setFitMode(mode);
    updateSettings({ defaultFit: mode });
  }, [setFitMode, updateSettings]);

  // Zoom commands from the display sheet (+/-/reset): direct imperative calls
  // into the gesture surface, so no command state round-trips through render.
  const zoomApiRef = useRef<VideoZoomApi | null>(null);
  const fireZoomCommand = useCallback((action: 'in' | 'out' | 'reset') => {
    if (!zoomApiRef.current) return;
    if (action === 'in') zoomApiRef.current.zoomIn();
    else if (action === 'out') zoomApiRef.current.zoomOut();
    else zoomApiRef.current.resetZoom();
  }, []);

  // Element box the current display mode renders at zoom 1 (pan clamping).
  const quarterRotated = orientation.rotate === 90 || orientation.rotate === 270;
  const videoBox = modeBaseBox(
    fitMode,
    { w: containerSize.w, h: containerSize.h },
    quarterRotated ? videoNaturalSize.h : videoNaturalSize.w,
    quarterRotated ? videoNaturalSize.w : videoNaturalSize.h
  );

  // Reset zoom + pan when the display mode changes or a different video opens
  // (default per spec: fresh view per video).
  useEffect(() => {
    zoomApiRef.current?.resetZoom();
  }, [fitMode, currentItem?.objectUrl]);

  // Video Fit Mode CSS class
  const getFitStyle = (): { className: string; style?: React.CSSProperties } => {
    switch (fitMode) {
      case 'cover':
        return { className: 'w-full h-full object-cover' };
      case 'crop':
        // Cover + fixed magnification (fitBiasScale) - still never distorts.
        return { className: 'w-full h-full object-cover' };
      case 'fill':
        return { className: 'w-full h-full object-fill' };
      case 'original':
        // Natural pixel size, shrunk only when larger than the viewport.
        return { className: 'max-w-full max-h-full w-auto h-auto m-auto' };
      case 'contain':
      default:
        return { className: 'w-full h-full object-contain' };
    }
  };

  const handleFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      selectFiles(Array.from(files));
      e.target.value = '';
    }
  };

  const handleGenerateTestClip = async () => {
    setIsGeneratingTest(true);
    try {
      const file = await generateTestClipFile();
      if (file) {
        selectFiles([file]);
      }
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // If no video is selected in the current session
  if (!currentItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto min-h-[60vh]">
        <input
          ref={filePickerRef}
          type="file"
          multiple
          accept="video/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts"
          onChange={handleFallbackFileSelect}
          className="hidden"
        />

        <div className="p-4 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-5 shadow-inner">
          <Film className="w-10 h-10" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">
          No Video Currently Selected
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Choose a video from your local device to begin watching in CineFlow&apos;s private cinematic player.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => filePickerRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-sm font-semibold text-white shadow-lg transition-all"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Open Video from Device</span>
          </button>

          <button
            onClick={handleGenerateTestClip}
            disabled={isGeneratingTest}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-sm font-semibold text-cyan-300 border border-slate-700 transition-all disabled:opacity-50"
          >
            {isGeneratingTest ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Generating Clip...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Generate Test Clip</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-xs text-slate-500 max-w-md">
          Supported container formats include MP4, WebM, and MKV with browser-compatible codecs (H.264, VP8/VP9, AV1).
        </div>
      </div>
    );
  }

  const fit = getFitStyle();

  return (
    <div
      ref={containerRef}
      onMouseMove={resetAutoHideTimer}
      className="relative flex-1 w-full bg-black overflow-hidden select-none flex items-center justify-center min-h-[280px] touch-none"
      style={{
        cursor: isControlsEffectivelyVisible ? 'default' : 'none',
      }}
    >
      {/* HTML5 Native Video Engine with key for clean remount */}
      <video
        key={activeObjectUrl}
        ref={videoRef}
        src={activeObjectUrl}
        preload="auto"
        playsInline
        className={`${fit.className} transition-[filter,transform] duration-150`}
        style={{
          filter:
            playerProfile === 'bedtime'
              ? `brightness(${Math.min(brightness, 85)}%) sepia(0.22) saturate(0.85)`
              : `brightness(${brightness}%)`,
          transform: composeTransform(
            orientation,
            zoomScale * fitBiasScale(fitMode) * rotationFitScale(videoNaturalSize.w, videoNaturalSize.h, containerSize.w, containerSize.h, orientation),
            pan
          ),
          transformOrigin: 'center center',
          ...fit.style,
        }}
        onPlay={() => {
          setIsPlaying(true);
          setPlaybackError(null);
        }}
        onPause={() => {
          setIsPlaying(false);
          if (videoRef.current) {
            recordProgress(videoRef.current.currentTime, videoRef.current.duration || duration);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={handleEnded}
        onError={handleVideoError}
      >
        {/* Native WebVTT track for native fullscreen/PiP */}
        {activeSubtitle?.vttBlobUrl && (
          <track
            src={activeSubtitle.vttBlobUrl}
            kind="subtitles"
            label="Local Subtitles"
            default={subtitleEnabled}
          />
        )}
      </video>

      {/* Center Play Button Overlay when paused */}
      {!isPlaying && !playbackError && (
        <button
          onClick={togglePlayPause}
          className="absolute z-25 flex items-center justify-center w-20 h-20 rounded-full bg-indigo-600/90 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white shadow-2xl backdrop-blur-md transition-all border border-indigo-400/40 pointer-events-auto"
          aria-label="Play video"
        >
          <Play className="w-10 h-10 fill-white ml-1.5" />
        </button>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !playbackError && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="flex items-center gap-2.5 rounded-2xl bg-black/70 px-4 py-3 text-white backdrop-blur-md">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs font-medium tracking-wide">Buffering...</span>
          </div>
        </div>
      )}

      {/* Phase 2.7 compatibility dialog (proactive + error-driven) */}
      {compat && compat.phase !== 'silent' && compat.phase !== 'probing' && !playbackError && (
        <CompatibilityDialog
          probe={compat.probe}
          decision={compat.decision}
          phase={compat.phase}
          progress={compat.progress}
          error={compat.error}
          refusal={compat.refusal}
          result={compat.result}
          estimatedSeconds={
            compat.decision.operation
              ? assessFeasibility(compat.decision.operation, compat.probe.sizeBytes, compat.probe.durationSeconds).timeHint ||
                assessFeasibility(compat.decision.operation, compat.probe.sizeBytes, compat.probe.durationSeconds).explanation
              : undefined
          }
          onConvert={handleStartConversion}
          onCancelConvert={handleCancelConversion}
          onPlayConverted={handlePlayConverted}
          onTryOriginal={handleTryOriginal}
          onChooseOther={() => {
            handleDismissCompat();
            filePickerRef.current?.click();
          }}
          onDismiss={handleDismissCompat}
        />
      )}

      {/* Converted-copy chip: honest badge with one tap back to the original */}
      {convertedPlay?.mediaKey === currentItem?.id && !playbackError && (
        <button
          onClick={handleTryOriginal}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-700/50 backdrop-blur text-[10px] font-medium text-cyan-300 flex items-center gap-1.5 hover:bg-cyan-900/80 transition"
          aria-label="Using converted copy. Tap to return to the original file."
        >
          <RefreshCw className="w-3 h-3" aria-hidden />
          Converted copy — tap for original
        </button>
      )}

      {/* Playback Error Banner with Diagnostics Quick Access */}
      {playbackError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-6 text-center">
          <div className="max-w-md rounded-2xl bg-slate-900 border border-red-500/30 p-6 text-slate-100 shadow-2xl">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-2">Playback Notice</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">{playbackError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={() => setShowDiagnosticsModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700 flex items-center gap-1.5 transition"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Diagnostics & Fix</span>
              </button>
              <button
                onClick={() => {
                  filePickerRef.current?.click();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
              >
                Choose Another File
              </button>
              <button
                onClick={handleGenerateTestClip}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow transition"
              >
                Play Test Clip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Synchronized Custom Subtitle Overlay */}
      {activeSubtitle && (
        <SubtitleOverlay
          cues={activeSubtitle.cues}
          currentTime={currentTime}
          isEnabled={subtitleEnabled}
          size={settings.subtitleSize}
          font={settings.subtitleFont}
          position={settings.subtitlePosition}
          color={settings.subtitleColor}
          bgOpacity={settings.subtitleBgOpacity}
          bottomOffset={isControlsEffectivelyVisible ? settings.subtitleBottomOffset + 64 : settings.subtitleBottomOffset}
          onAdjustBottomOffset={(val) => updateSettings({ subtitleBottomOffset: val })}
          onAdjustTimingOffset={(delta) =>
            setSubtitleOffset(activeSubtitle ? Number((activeSubtitle.offsetSeconds + delta).toFixed(3)) : delta)
          }
        />
      )}

      {/* Resume Banner Prompt */}
      {shouldShowResume && savedProgress && (
        <ResumeBanner
          savedTime={savedProgress.currentTime}
          duration={duration}
          onResume={handleResume}
          onRestart={handleRestart}
          onDismiss={() => setResumeDismissedFor(savedProgress.id)}
        />
      )}

      {/* Advanced Touch & Gesture Engine */}
      <VideoGestureSurface
        videoRef={videoRef}
        containerRef={containerRef}
        duration={duration}
        currentTime={currentTime}
        volume={volume}
        isMuted={isMuted}
        playbackSpeed={playbackSpeed}
        brightness={brightness}
        settings={settings}
        isControlsVisible={isControlsEffectivelyVisible}
        onSeek={seekTo}
        onVolumeChange={handleVolumeChange}
        onToggleMute={toggleMute}
        onBrightnessChange={setBrightness}
        onPlaybackSpeedChange={setPlaybackSpeed}
        onTogglePlay={togglePlayPause}
        onToggleControls={() => setControlsVisible((prev) => !prev)}
        onResetControlsTimer={resetAutoHideTimer}
        onZoomChange={setZoomScale}
        onPanChange={setPan}
        videoBox={videoBox}
        zoomApiRef={zoomApiRef}
      />

      {/* Controls Overlay */}
      <ControlsOverlay
        title={currentItem.name}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        bufferedRanges={bufferedRanges}
        volume={volume}
        isMuted={isMuted}
        playbackSpeed={playbackSpeed}
        fitMode={fitMode}
        loopMode={loopMode}
        seekInterval={settings.seekInterval || 10}
        isVisible={isControlsEffectivelyVisible}
        hasPrevTrack={currentIndex > 0 || loopMode === 'all'}
        hasNextTrack={currentIndex < queue.length - 1 || loopMode === 'all'}
        queueCount={queue.length}
        hasSubtitles={!!activeSubtitle}
        subtitlesActive={subtitleEnabled}
        abRepeat={abRepeat}
        onSetABPointA={() => setABPointA(currentTime)}
        onSetABPointB={() => setABPointB(currentTime)}
        onClearABRepeat={clearABRepeat}
        onToggleABRepeat={toggleABRepeat}
        sleepTimerRemainingSeconds={sleepTimerRemainingSeconds}
        onSetSleepTimer={setSleepTimer}
        isPrivateSession={isPrivateSession}
        onTogglePrivateSession={() => setIsPrivateSession(!isPrivateSession)}
        isCurrentFavorite={isCurrentFavorite}
        onToggleFavorite={toggleFavorite}
        playerProfile={playerProfile}
        onChangeProfile={setPlayerProfile}
        onOpenDiagnostics={() => setShowDiagnosticsModal(true)}
        onChangeSeekInterval={(interval) => updateSettings({ seekInterval: interval })}
        onPlayPause={togglePlayPause}
        onSeek={seekTo}
        onSkip={skipSeconds}
        onVolumeChange={handleVolumeChange}
        onToggleMute={toggleMute}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        onTogglePiP={togglePiP}
        isPiPSupported={isPiPSupported}
        onChangeSpeed={setPlaybackSpeed}
        onChangeFitMode={handleSetFitMode}
        zoomScale={zoomScale}
        onZoomIn={() => fireZoomCommand('in')}
        onZoomOut={() => fireZoomCommand('out')}
        onResetZoom={() => fireZoomCommand('reset')}
        onToggleLoop={toggleLoop}
        orientation={orientation}
        onRotateClockwise={() => applyOrientation(rotateClockwise(orientation))}
        onRotateCounterClockwise={() => applyOrientation(rotateCounterClockwise(orientation))}
        onRotate180={() => applyOrientation(rotate180(orientation))}
        onRotateScreen={rotateScreen}
        rotateScreenNotice={rotateScreenNotice}
        onResetOrientation={() => applyOrientation(resetOrientationState())}
        onPrevTrack={prevTrack}
        onNextTrack={nextTrack}
        audioPreset={settings.audioPreset}
        audioBands={settings.audioBands}
        audioNotice={audioNotice}
        onSetAudioPreset={handleAudioPresetChange}
        onSetAudioBand={handleAudioBandChange}
        onResetAudio={handleAudioReset}
        onOpenSubtitles={() => {
          setControlsVisible(true);
          setShowSubtitlesModal((prev) => !prev);
        }}
        onOpenPlaylist={() => setShowPlaylistDrawer(true)}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
      />

      {/* Modals & Drawers */}
      <SubtitlesModal
        isOpen={showSubtitlesModal}
        onClose={() => setShowSubtitlesModal(false)}
      />

      <PlaylistDrawer
        isOpen={showPlaylistDrawer}
        onClose={() => setShowPlaylistDrawer(false)}
      />

      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        seekInterval={settings.seekInterval || 10}
      />

      <PlaybackDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
      />
    </div>
  );
};
