'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { DISPLAY_MODES, displayModeOption, displayModeToVideoFit, videoFitToDisplayMode, ZOOM_MIN, ZOOM_MAX } from '@/lib/player/display-modes';
import { AUDIO_PRESETS, MIN_BAND_GAIN_DB, MAX_BAND_GAIN_DB, AUDIO_BANDS, type AudioPresetId, type BandGains } from '@/lib/audio/presets';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Smartphone,
  Scaling,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Repeat,
  Repeat1,
  Subtitles,
  ListMusic,
  HelpCircle,
  SkipBack,
  SkipForward,
  Ratio,
  ArrowLeft,
  Moon,
  Shield,
  Star,
  Activity,
  Compass,
  Film,
  GraduationCap,
  Clock,
  Check,
} from 'lucide-react';
import { formatTime, formatVideoTitle } from '@/lib/utils/formatters';
import { type VideoOrientation } from '@/lib/player/orientation';
import { VideoFitMode, PlayerProfile } from '@/lib/storage/db';
import { LoopMode, ABRepeatState } from '@/context/MediaSessionContext';

interface ControlsOverlayProps {
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedRanges: { start: number; end: number }[];
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  fitMode: VideoFitMode;
  loopMode: LoopMode;
  seekInterval: number;
  isVisible: boolean;
  hasPrevTrack: boolean;
  hasNextTrack: boolean;
  queueCount: number;
  hasSubtitles: boolean;
  subtitlesActive: boolean;

  // A-B Repeat
  abRepeat: ABRepeatState;
  onSetABPointA: () => void;
  onSetABPointB: () => void;
  onClearABRepeat: () => void;
  onToggleABRepeat: () => void;

  // Sleep Timer
  sleepTimerRemainingSeconds: number | null;
  onSetSleepTimer: (minutes: number | null) => void;

  // Private Session & Favorites
  isPrivateSession: boolean;
  onTogglePrivateSession: () => void;
  isCurrentFavorite: boolean;
  onToggleFavorite: () => void;

  // Profiles & Diagnostics
  playerProfile: PlayerProfile;
  onChangeProfile: (profile: PlayerProfile) => void;
  onOpenDiagnostics: () => void;
  onChangeSeekInterval: (interval: number) => void;

  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkip: (delta: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onTogglePiP: () => void;
  isPiPSupported: boolean;
  onChangeSpeed: (speed: number) => void;
  onChangeFitMode: (mode: VideoFitMode) => void;
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleLoop: () => void;
  orientation: VideoOrientation;
  onRotateClockwise: () => void;
  onRotateCounterClockwise: () => void;
  onRotate180: () => void;
  onRotateScreen: () => void;
  rotateScreenNotice: string | null;
  onResetOrientation: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onOpenSubtitles: () => void;
  /** Fix 4: local audio clarity controls. */
  audioPreset: AudioPresetId;
  audioBands: BandGains;
  audioNotice: string | null;
  onSetAudioPreset: (id: AudioPresetId) => void;
  onSetAudioBand: (band: keyof BandGains, db: number) => void;
  onResetAudio: () => void;
  onOpenPlaylist: () => void;
  onOpenShortcuts: () => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const SLEEP_OPTIONS = [
  { label: 'Off', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
  { label: '90 min', minutes: 90 },
];

const PROFILE_OPTIONS: { profile: PlayerProfile; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    profile: 'movie',
    label: 'Cinema Mode',
    icon: <Film className="w-4 h-4 text-[var(--cy)]" />,
    desc: 'Theatrical natural colors, standard speed & sleek auto-hide',
  },
  {
    profile: 'lecture',
    label: 'Lecture / Study',
    icon: <GraduationCap className="w-4 h-4 text-[var(--wa)]" />,
    desc: '1.25x speed default, 5s seek & prominent subtitles',
  },
  {
    profile: 'bedtime',
    label: 'Bedtime Mode',
    icon: <Moon className="w-4 h-4 text-[var(--lav)]" />,
    desc: 'Warm blue-light filter, 75% max brightness & auto sleep timer',
  },
];

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  title,
  isPlaying,
  currentTime,
  duration,
  bufferedRanges,
  volume,
  isMuted,
  playbackSpeed,
  fitMode,
  loopMode,
  seekInterval,
  isVisible,
  hasPrevTrack,
  hasNextTrack,
  queueCount,
  hasSubtitles,
  subtitlesActive,
  abRepeat,
  onSetABPointA,
  onSetABPointB,
  onClearABRepeat,
  onToggleABRepeat,
  sleepTimerRemainingSeconds,
  onSetSleepTimer,
  isPrivateSession,
  onTogglePrivateSession,
  isCurrentFavorite,
  onToggleFavorite,
  playerProfile,
  onChangeProfile,
  onOpenDiagnostics,
  onChangeSeekInterval,
  onPlayPause,
  onSeek,
  onSkip,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  isFullscreen,
  onTogglePiP,
  isPiPSupported,
  onChangeSpeed,
  onChangeFitMode,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleLoop,
  orientation,
  onRotateClockwise,
  onRotateCounterClockwise,
  onRotate180,
  onRotateScreen,
  rotateScreenNotice,
  onResetOrientation,
  onPrevTrack,
  onNextTrack,
  onOpenSubtitles,
  audioPreset,
  audioBands,
  audioNotice,
  onSetAudioPreset,
  onSetAudioBand,
  onResetAudio,
  onOpenPlaylist,
  onOpenShortcuts,
}) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [orientationMenuOpen, setOrientationMenuOpen] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showFitMenu, setShowFitMenu] = useState(false);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showABMenu, setShowABMenu] = useState(false);
  const scrubBarRef = useRef<HTMLDivElement>(null);

  // Close every open menu when the overlay auto-hides so a menu cannot
  // reappear stale when the controls come back.
  // Render-phase reset (no effect) per React's "reset state on prop change".
  const [wasVisible, setWasVisible] = useState(isVisible);
  if (wasVisible !== isVisible) {
    setWasVisible(isVisible);
    if (!isVisible) {
      setOrientationMenuOpen(false);
      setShowSpeedMenu(false);
      setShowFitMenu(false);
      setDisplayMenuOpen(false);
      setShowSleepMenu(false);
      setShowProfileMenu(false);
      setShowABMenu(false);
    }
  }
  const [isScrubbing, setIsScrubbing] = useState(false);

  const seekToClientX = (clientX: number) => {
    if (!scrubBarRef.current || duration <= 0) return;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    onSeek(percentage * duration);
  };

  const effectiveProgress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // A-B Repeat position calculations on timeline
  const abPointAPct = abRepeat.pointA !== null && duration > 0 ? (abRepeat.pointA / duration) * 100 : null;
  const abPointBPct = abRepeat.pointB !== null && duration > 0 ? (abRepeat.pointB / duration) * 100 : null;

  const handleScrubMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubBarRef.current || duration <= 0) return;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    setHoverTime(percentage * duration);
    setHoverPosition(x);
  };

  const handleScrubMouseLeave = () => {
    setHoverTime(null);
  };

  const closeAllMenus = () => {
    setShowSpeedMenu(false);
    setShowFitMenu(false);
    setDisplayMenuOpen(false);
    setShowSleepMenu(false);
    setShowProfileMenu(false);
    setShowABMenu(false);
  };

  const formatSleepTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={closeAllMenus}
      className={`absolute inset-0 z-20 flex flex-col justify-between pt-4 px-4 sm:pt-7 sm:px-7 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] transition-opacity duration-300 pointer-events-none ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Rotate-screen fallback notice (truthful message, no fake rotation) */}
      {rotateScreenNotice && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-24 left-1/2 z-30 -translate-x-1/2 max-w-[86%] rounded-2xl border border-[var(--bd)] bg-[var(--dn)]/95 px-4 py-2 text-center text-xs leading-relaxed text-white shadow-xl backdrop-blur-md"
        >
          {rotateScreenNotice}
        </div>
      )}

      {/* Top Bar (Screen 2) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${isVisible ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="rnd gl text-white hover:border-[var(--bv)] transition-colors shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <b className="block text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
              {formatVideoTitle(title)}
            </b>
            <div className="text-xs text-[var(--t2)] flex items-center gap-1.5 mt-0.5">
              <span>Local file</span>
              {isPrivateSession && (
                <>
                  <span>·</span>
                  <span className="text-[var(--cy)] font-semibold flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Private
                  </span>
                </>
              )}
              {sleepTimerRemainingSeconds !== null && (
                <>
                  <span>·</span>
                  <span className="text-[var(--lav)] font-mono flex items-center gap-1">
                    <Moon className="w-3 h-3" /> {formatSleepTime(sleepTimerRemainingSeconds)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Right Tool Buttons */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Subtitles Chip (Screen 2: chip gl 'Subtitles EN') */}
          <button
            onClick={onOpenSubtitles}
            className="chip gl text-white hover:border-[var(--bv)] text-xs h-9 px-3"
            title="Subtitles & Timing"
            aria-label="Subtitles & Timing"
          >
            <Subtitles className="w-3.5 h-3.5 text-[var(--cy)]" />
            <span className="hidden sm:inline">{hasSubtitles && subtitlesActive ? 'Subtitles On' : 'Subtitles'}</span>
          </button>

          {/* Queue Drawer Button (Screen 2: rnd gl) */}
          <button
            onClick={onOpenPlaylist}
            className="rnd gl text-white hover:border-[var(--bv)] relative"
            title="Queue & Playlist"
            aria-label="Playlist Queue"
          >
            <ListMusic className="w-5 h-5" />
            {queueCount > 1 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ev)] px-1 text-[10px] font-bold text-white">
                {queueCount}
              </span>
            )}
          </button>

          {/* Loop Toggle: none -> one -> all */}
          <button
            onClick={onToggleLoop}
            title={
              loopMode === 'one'
                ? 'Loop: this video'
                : loopMode === 'all'
                ? 'Loop: whole queue'
                : 'Loop: off'
            }
            aria-label={`Loop mode: ${
              loopMode === 'one' ? 'this video' : loopMode === 'all' ? 'whole queue' : 'off'
            }`}
            className="rnd gl text-white hover:border-[var(--bv)]"
          >
            {loopMode === 'one' ? (
              <Repeat1 className="w-4 h-4 text-[var(--cy)]" />
            ) : (
              <Repeat className={`w-4 h-4 ${loopMode === 'all' ? 'text-[var(--bv)]' : 'text-slate-400'}`} />
            )}
          </button>

          {/* Rotate Screen: real device rotation via the Screen Orientation API */}
          <button
            onClick={onRotateScreen}
            title="Rotate screen"
            aria-label="Rotate screen"
            className="rnd gl text-white hover:border-[var(--bv)]"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Audio clarity (Fix 4): local, preset-based, with a safe reset */}
          <div className="relative">
            <button
              onClick={() => setAudioMenuOpen((v) => !v)}
              title={`Audio clarity: ${AUDIO_PRESETS.find((p) => p.id === audioPreset)?.label ?? 'Off'}`}
              aria-label="Audio clarity and equalizer"
              aria-expanded={audioMenuOpen}
              className={`rnd gl text-white hover:border-[var(--bv)] ${
                audioPreset !== 'off' ? 'border-[var(--cy)]' : ''
              }`}
            >
              <SlidersHorizontal className={`w-4 h-4 ${audioPreset !== 'off' ? 'text-[var(--cy)]' : 'text-slate-400'}`} />
            </button>
            {audioMenuOpen && (
              <div
                className="absolute top-12 right-0 z-20 w-64 rounded-2xl border border-[var(--bd)] bg-[var(--es)]/95 backdrop-blur-xl p-2 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="group"
                aria-label="Audio clarity presets"
              >
                <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">
                  Audio clarity (on this device)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {AUDIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => onSetAudioPreset(preset.id)}
                      aria-pressed={audioPreset === preset.id}
                      title={preset.description}
                      className={`chip gl text-[11px] h-9 px-2 justify-center ${
                        audioPreset === preset.id ? 'text-[var(--cy)] border-[var(--cy)]' : 'text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="px-2 pt-2 pb-1 text-[10px] leading-relaxed text-[var(--t3)]">
                  {AUDIO_PRESETS.find((p) => p.id === audioPreset)?.description ??
                    'Custom curve applied locally.'}
                </p>
                <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">
                  Custom bands (dB)
                </p>
                <div className="space-y-1 px-1 pb-1">
                  {AUDIO_BANDS.map((band) => (
                    <label key={band} className="flex items-center gap-2 text-[10px] font-semibold text-[var(--t2)] capitalize">
                      <span className="w-8">{band}</span>
                      <input
                        type="range"
                        min={MIN_BAND_GAIN_DB}
                        max={MAX_BAND_GAIN_DB}
                        step={1}
                        value={audioBands[band]}
                        onChange={(e) => onSetAudioBand(band, Number(e.target.value))}
                        className="flex-1 accent-[var(--cy)]"
                        aria-label={`${band} band gain in decibels`}
                      />
                      <span className="w-9 text-right font-mono text-[var(--cy)]">
                        {audioBands[band] > 0 ? '+' : ''}
                        {audioBands[band]}
                      </span>
                    </label>
                  ))}
                  <button
                    onClick={onResetAudio}
                    className="chip gl text-white text-[11px] h-8 w-full justify-center mt-1"
                    aria-label="Reset audio to original, unprocessed sound"
                  >
                    Reset audio
                  </button>
                  <p className="pt-1 text-[10px] leading-relaxed text-[var(--t3)]">
                    Local processing only. Equalizer gain is capped so it cannot exceed your device volume.
                  </p>
                </div>
                {audioNotice && (
                  <p className="mt-1 rounded-lg bg-[var(--es)] px-2 py-1.5 text-[10px] leading-relaxed text-[var(--lav)]" role="status">
                    {audioNotice}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Display modes & zoom (MX Player-style sheet) */}
          <div className="relative">
            {(() => {
              const activeDisplay = displayModeOption(videoFitToDisplayMode(fitMode));
              return (
                <button
                  onClick={() => setDisplayMenuOpen((v) => !v)}
                  title={`Display: ${activeDisplay.short}`}
                  aria-label="Display mode and zoom"
                  aria-expanded={displayMenuOpen}
                  className={`rnd gl text-white hover:border-[var(--bv)] ${activeDisplay.mode !== 'fit' ? 'border-[var(--cy)]' : ''}`}
                >
                  <Scaling className="w-4 h-4" />
                </button>
              );
            })()}
            {displayMenuOpen && (
              <div
                className="absolute top-12 right-0 z-20 w-60 rounded-2xl border border-[var(--bd)] bg-[var(--es)]/95 backdrop-blur-xl p-2 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">
                  Display · {displayModeOption(videoFitToDisplayMode(fitMode)).short}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {DISPLAY_MODES.map((opt) => (
                    <button
                      key={opt.mode}
                      onClick={() => onChangeFitMode(displayModeToVideoFit(opt.mode))}
                      aria-pressed={fitMode === displayModeToVideoFit(opt.mode)}
                      title={opt.desc}
                      className={`chip gl text-[11px] h-9 px-2 justify-center ${
                        fitMode === displayModeToVideoFit(opt.mode) ? 'text-[var(--cy)] border-[var(--cy)]' : 'text-white'
                      }`}
                    >
                      {opt.short}
                    </button>
                  ))}
                </div>
                <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">Zoom</p>
                <div className="flex items-center gap-1.5 px-1 pb-1">
                  <button
                    onClick={onZoomOut}
                    disabled={zoomScale <= ZOOM_MIN}
                    title="Zoom out"
                    aria-label="Zoom out"
                    className="rnd gl text-white hover:border-[var(--bv)] disabled:opacity-40"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center text-xs font-semibold text-white" aria-live="polite">
                    {zoomScale.toFixed(2)}&times;
                  </span>
                  <button
                    onClick={onZoomIn}
                    disabled={zoomScale >= ZOOM_MAX}
                    title="Zoom in"
                    aria-label="Zoom in"
                    className="rnd gl text-white hover:border-[var(--bv)] disabled:opacity-40"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onResetZoom}
                    disabled={zoomScale === ZOOM_MIN}
                    title="Reset zoom"
                    aria-label="Reset zoom"
                    className="chip gl text-white text-[11px] h-9 px-2 justify-center disabled:opacity-40"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Video rotation popover (purely visual) */}
          <div className="relative">
            <button
              onClick={() => setOrientationMenuOpen((v) => !v)}
              title="Rotate video"
              aria-label="Rotate video options"
              aria-expanded={orientationMenuOpen}
              className={`rnd gl text-white hover:border-[var(--bv)] ${orientation.rotate !== 0 ? 'border-[var(--cy)]' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${orientation.rotate !== 0 ? 'text-[var(--cy)]' : 'text-slate-400'}`} />
            </button>
            {orientationMenuOpen && (
              <div
                className="absolute top-12 right-0 z-20 w-52 rounded-2xl border border-[var(--bd)] bg-[var(--es)]/95 backdrop-blur-xl p-2 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">
                  Rotate video (visual only)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={onRotateCounterClockwise} className="chip gl text-white text-[11px] h-9 px-2 justify-center" title="Rotate counter-clockwise 90°">
                    <RotateCcw className="w-3.5 h-3.5" /> CCW 90°
                  </button>
                  <button onClick={onRotateClockwise} className="chip gl text-white text-[11px] h-9 px-2 justify-center" title="Rotate clockwise 90°">
                    <RotateCw className="w-3.5 h-3.5" /> CW 90°
                  </button>
                  <button onClick={onRotate180} className="chip gl text-white text-[11px] h-9 px-2 justify-center" title="Rotate 180°">
                    <RotateCw className="w-3.5 h-3.5" /> 180°
                  </button>
                  <button onClick={onResetOrientation} className="chip gl text-white text-[11px] h-9 px-2 justify-center" title="Reset orientation">
                    Reset
                  </button>
                </div>
                <p className="px-2 pt-2 pb-1 text-[10px] leading-relaxed text-[var(--t3)]">
                  Playback, subtitles and zoom are not affected. Screen orientation is not forced.
                </p>
              </div>
            )}
          </div>

          {/* Favorite Toggle */}
          <button
            onClick={onToggleFavorite}
            title={isCurrentFavorite ? 'Favorited' : 'Add to favorites'}
            className="rnd gl text-white hover:border-[var(--bv)]"
          >
            <Star
              className={`w-4 h-4 ${
                isCurrentFavorite
                  ? 'fill-[var(--wa)] text-[var(--wa)]'
                  : 'text-slate-400 hover:text-[var(--wa)]'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Center Controls (Screen 2: Skip Back, Big Play, Skip Forward) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`${isVisible ? "pointer-events-auto" : "pointer-events-none"} flex items-center justify-center gap-10 sm:gap-14 select-none my-auto`}
      >
        <button
          onClick={() => onSkip(-seekInterval)}
          aria-label={`Skip backward ${seekInterval} seconds`}
          className="rnd gl text-white hover:scale-105 active:scale-95 transition-transform"
          title={`-${seekInterval}s`}
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Big Circular Play Button (Screen 2: bigp) */}
        <button
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="bigp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 text-white fill-white" />
          ) : (
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          )}
        </button>

        <button
          onClick={() => onSkip(seekInterval)}
          aria-label={`Skip forward ${seekInterval} seconds`}
          className="rnd gl text-white hover:scale-105 active:scale-95 transition-transform"
          title={`+${seekInterval}s`}
        >
          <RotateCw className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Controls (Screen 2: Scrubber, Timestamps, Speed, Volume, Fullscreen) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`${isVisible ? "pointer-events-auto" : "pointer-events-none"} flex flex-col gap-3 select-none`}
      >
        {/* Scrubber Timeline (Screen 2: .sl with cyan-to-violet gradient) */}
        <div
          ref={scrubBarRef}
          onMouseMove={handleScrubMouseMove}
          onMouseLeave={handleScrubMouseLeave}
          onPointerDown={(e) => {
            e.preventDefault();
            setIsScrubbing(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            seekToClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (isScrubbing) seekToClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            setIsScrubbing(false);
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerCancel={(e) => {
            setIsScrubbing(false);
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
          }}
          className="relative py-3.5 sm:py-2.5 flex items-center cursor-pointer group touch-none"
          role="slider"
          aria-label="Seek Video"
          aria-valuemin={0}
          aria-valuemax={duration || 100}
          aria-valuenow={currentTime}
          tabIndex={0}
        >
          {/* Base track */}
          <div className="w-full h-2 sm:h-1.5 sm:group-hover:h-2.5 rounded-full bg-white/20 relative overflow-hidden transition-all">
            {/* Buffered ranges */}
            {duration > 0 &&
              bufferedRanges.map((range, idx) => {
                const left = (range.start / duration) * 100;
                const width = ((range.end - range.start) / duration) * 100;
                return (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 bg-white/25 rounded-full"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                );
              })}

            {/* A-B Repeat Loop Highlight */}
            {abPointAPct !== null && abPointBPct !== null && (
              <div
                className={`absolute top-0 bottom-0 rounded-full ${
                  abRepeat.isActive ? 'bg-[var(--wa)]/60' : 'bg-[var(--ev)]/30'
                }`}
                style={{
                  left: `${abPointAPct}%`,
                  width: `${Math.max(0, abPointBPct - abPointAPct)}%`,
                }}
              />
            )}

            {/* Cyan-to-Violet gradient progress */}
            <div
              className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-75"
              style={{
                width: `${effectiveProgress}%`,
                background: 'linear-gradient(90deg, var(--cy), var(--bv))',
              }}
            />
          </div>

          {/* White Glowing Knob Thumb (Screen 2) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 sm:w-3.5 sm:h-3.5 rounded-full bg-white shadow-[0_0_0_4px_rgba(105,85,255,0.45)] pointer-events-none transition-transform ${isScrubbing ? "scale-125" : "sm:group-hover:scale-125"}`}
            style={{ left: `calc(${effectiveProgress}% - 7px)` }}
          />

          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute bottom-6 -translate-x-1/2 pointer-events-none rounded-md bg-[var(--dn)] border border-[var(--bd)] px-2 py-0.5 text-[11px] font-mono text-white shadow-xl"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--t2)]">
          {/* Time: 12:41 / 36:08 */}
          <div className="font-mono text-xs sm:text-sm text-[var(--tx)]">
            <span>{formatTime(currentTime)}</span>
            <span className="text-[var(--t3)] mx-1">/</span>
            <span className="text-[var(--t2)]">{formatTime(duration)}</span>
          </div>

          <div className="flex-1" />

          {/* Speed Chip (Screen 2: chip gl '1.25x') */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSpeedMenu(!showSpeedMenu);
                setShowFitMenu(false);
                setShowSleepMenu(false);
                setShowProfileMenu(false);
                setShowABMenu(false);
              }}
              className="chip gl text-white hover:border-[var(--bv)] text-xs h-9 px-3"
              title="Playback Speed"
            >
              {playbackSpeed}×
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-11 right-0 z-50 w-36 rounded-2xl bg-[var(--dn)] border border-[var(--bd)] p-2 shadow-2xl text-[var(--tx)]">
                <div className="px-2 py-1 text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">
                  Speed
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1 max-h-48 overflow-y-auto">
                  {SPEED_OPTIONS.map((spd) => (
                    <button
                      key={spd}
                      onClick={() => {
                        onChangeSpeed(spd);
                        setShowSpeedMenu(false);
                      }}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium text-center transition ${
                        playbackSpeed === spd
                          ? 'bg-[var(--ev)] text-white font-bold'
                          : 'hover:bg-[var(--ss)] text-[var(--t2)]'
                      }`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Volume Button (Screen 2: rnd gl) */}
          <button
            onClick={onToggleMute}
            className="rnd gl text-white hover:border-[var(--bv)]"
            title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            aria-label="Volume"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-[var(--er)]" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          {/* PiP Button */}
          {isPiPSupported && (
            <button
              onClick={onTogglePiP}
              className="rnd gl text-white hover:border-[var(--bv)] hidden sm:grid"
              title="Picture in Picture"
              aria-label="Picture-in-Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen Button (Screen 2: rnd gl) */}
          <button
            onClick={onToggleFullscreen}
            className="rnd gl text-white hover:border-[var(--bv)]"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label="Fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
