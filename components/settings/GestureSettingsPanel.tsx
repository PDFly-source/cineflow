'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Smartphone,
  Sun,
  Volume2,
  FastForward,
  Rewind,
  Zap,
  ZoomIn,
  Play,
  RotateCcw,
  Vibrate,
  Sliders,
  HelpCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { UserSettings } from '@/lib/storage/db';
import { VideoGestureSurface } from '@/components/player/gestures/VideoGestureSurface';
import { useMedia } from '@/context/MediaSessionContext';

interface GestureSettingsPanelProps {
  settings?: UserSettings;
  updateSettings?: (partial: Partial<UserSettings>) => void;
}

export const GestureSettingsPanel: React.FC<GestureSettingsPanelProps> = ({
  settings: propSettings,
  updateSettings: propUpdateSettings,
}) => {
  const media = useMedia();
  const settings = propSettings || media.settings;
  const updateSettings = propUpdateSettings || media.updateSettings;

  // Playground simulation state
  const playgroundContainerRef = useRef<HTMLDivElement>(null);
  const playgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const [demoTime, setDemoTime] = useState<number>(35);
  const [demoDuration] = useState<number>(180);
  const [demoVolume, setDemoVolume] = useState<number>(0.8);
  const [demoMuted, setDemoMuted] = useState<boolean>(false);
  const [demoBrightness, setDemoBrightness] = useState<number>(100);
  const [demoSpeed, setDemoSpeed] = useState<number>(1.0);
  const [demoPlaying, setDemoPlaying] = useState<boolean>(true);
  const [demoZoom, setDemoZoom] = useState<number>(1.0);
  const [playgroundActiveTab, setPlaygroundActiveTab] = useState<'tutorial' | 'playground'>('playground');

  // Animation loop for sandbox canvas
  useEffect(() => {
    const canvas = playgroundCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const render = () => {
      frame++;
      const width = canvas.width;
      const height = canvas.height;

      // Dark cinematic background with subtle gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#111827');
      grad.addColorStop(1, '#0b0f19');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Moving grid lines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 32;
      const offset = (frame * 0.5) % gridSize;

      for (let x = offset; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = offset; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Animated glowing orb in center
      const centerX = width / 2;
      const centerY = height / 2;
      const orbRadius = 40 + Math.sin(frame * 0.05) * 8;

      const radialGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        5,
        centerX,
        centerY,
        orbRadius * 1.6
      );
      radialGrad.addColorStop(0, 'rgba(129, 140, 248, 0.9)');
      radialGrad.addColorStop(0.4, 'rgba(99, 102, 241, 0.4)');
      radialGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');

      ctx.fillStyle = radialGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Floating particles
      for (let i = 0; i < 6; i++) {
        const angle = (frame * 0.02) + (i * Math.PI) / 3;
        const dist = 70 + Math.sin(frame * 0.04 + i) * 15;
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;

        ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#a855f7';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Title & Sandbox Timecode
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CINEFLOW GESTURE SANDBOX', centerX, 36);

      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Interactive Touch & Pointer Surface', centerX, 54);

      // Playback Status Indicator
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = demoPlaying ? '#34d399' : '#f87171';
      ctx.fillText(demoPlaying ? '▶ PLAYING' : '⏸ PAUSED', centerX, height - 28);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [demoPlaying]);

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Touch & Gesture Engine</h2>
            <p className="text-xs text-slate-400">
              MX Player-inspired gestures for mobile swipe seeking, brightness, volume, and zoom.
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center gap-3 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-200">
            {settings.gesturesEnabled ? 'Gestures Active' : 'Gestures Disabled'}
          </span>
          <button
            onClick={() => updateSettings({ gesturesEnabled: !settings.gesturesEnabled })}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              settings.gesturesEnabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
            aria-label="Toggle all gestures"
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.gesturesEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Screen 3: Gesture Reference Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="card flex items-center gap-3 p-3 border-[var(--cy)]/40">
          <div className="tile">
            <Sun className="w-5 h-5 text-[var(--cy)]" />
          </div>
          <div className="text-xs text-[var(--t2)]">
            <strong className="block text-sm text-[var(--tx)]">Left swipe</strong>
            Brightness. Right swipe sets volume.
          </div>
        </div>

        <div className="card flex items-center gap-3 p-3">
          <div className="tile">
            <Rewind className="w-5 h-5 text-[var(--bv)]" />
          </div>
          <div className="text-xs text-[var(--t2)]">
            <strong className="block text-sm text-[var(--tx)]">Slide sideways</strong>
            Seek with a live time preview.
          </div>
        </div>

        <div className="card flex items-center gap-3 p-3">
          <div className="tile">
            <Zap className="w-5 h-5 text-[var(--ok)]" />
          </div>
          <div className="text-xs text-[var(--t2)]">
            <strong className="block text-sm text-[var(--tx)]">Double-tap or hold</strong>
            Skip 10s, or hold for 2× speed boost.
          </div>
        </div>

        <div className="card flex items-center gap-3 p-3">
          <div className="tile">
            <ZoomIn className="w-5 h-5 text-[var(--lav)]" />
          </div>
          <div className="text-xs text-[var(--t2)]">
            <strong className="block text-sm text-[var(--tx)]">Pinch</strong>
            Zoom to fill or fit the frame.
          </div>
        </div>
      </div>

      {/* Tabs: Interactive Guide vs Live Test Playground */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
        <button
          onClick={() => setPlaygroundActiveTab('playground')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            playgroundActiveTab === 'playground'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          <span>Interactive Gesture Sandbox</span>
        </button>

        <button
          onClick={() => setPlaygroundActiveTab('tutorial')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            playgroundActiveTab === 'tutorial'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>Gesture Map & Guide</span>
        </button>
      </div>

      {/* TAB 1: INTERACTIVE SANDBOX PLAYGROUND */}
      {playgroundActiveTab === 'playground' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Test gestures below (swipe left/right, swipe up/down, double-tap, hold, or pinch):
            </span>
            <span className="font-mono text-[11px] text-cyan-400">
              Brightness: {demoBrightness}% · Vol: {demoMuted ? 'Muted' : `${Math.round(demoVolume * 100)}%`} · Zoom: {demoZoom.toFixed(2)}x
            </span>
          </div>

          <div
            ref={playgroundContainerRef}
            className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-black border border-slate-700/80 shadow-2xl flex items-center justify-center select-none"
          >
            {/* Visual background canvas */}
            <canvas
              ref={playgroundCanvasRef}
              width={640}
              height={360}
              className="w-full h-full object-cover transition-[filter,transform] duration-150"
              style={{
                filter: `brightness(${demoBrightness}%)`,
                transform: demoZoom !== 1.0 ? `scale(${demoZoom})` : undefined,
                transformOrigin: 'center center',
              }}
            />

            {/* Live Gesture Engine Mounted Over Canvas Sandbox */}
            <VideoGestureSurface
              videoRef={{ current: null }}
              containerRef={playgroundContainerRef}
              duration={demoDuration}
              currentTime={demoTime}
              volume={demoVolume}
              isMuted={demoMuted}
              playbackSpeed={demoSpeed}
              brightness={demoBrightness}
              settings={settings}
              isControlsVisible={false}
              onSeek={(t) => setDemoTime(t)}
              onVolumeChange={(v) => {
                setDemoVolume(v);
                if (v > 0) setDemoMuted(false);
              }}
              onToggleMute={() => setDemoMuted((prev) => !prev)}
              onBrightnessChange={(b) => setDemoBrightness(b)}
              onPlaybackSpeedChange={(s) => setDemoSpeed(s)}
              onTogglePlay={() => setDemoPlaying((prev) => !prev)}
              onToggleControls={() => {}}
              onResetControlsTimer={() => {}}
              onZoomChange={(z) => setDemoZoom(z)}
            />
          </div>

          <p className="text-[11px] text-slate-500 leading-normal">
            💡 <strong className="text-slate-400">Try it out:</strong> Swipe vertically on the left half to adjust brightness, swipe vertically on the right half to change volume, swipe horizontally anywhere to scrub time, double-tap left or right to skip, long-press to boost speed to {settings.longPressSpeed || 2.0}x, and pinch with two fingers to zoom.
          </p>
        </div>
      )}

      {/* TAB 2: GESTURE MAP & DIAGRAM */}
      {playgroundActiveTab === 'tutorial' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
          {/* Left Zone */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Left Zone (0% - 35%)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px]">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>Swipe Up/Down: Adjust Brightness</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span>Double Tap: Jump Backward (-{settings.seekInterval || 10}s)</span>
              </li>
            </ul>
          </div>

          {/* Center Zone */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <Play className="w-4 h-4 text-indigo-400" />
              <span>Center Zone (35% - 65%)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px]">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                <span>Double Tap: Play / Pause toggle</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>Hold / Long Press: Fast Forward ({settings.longPressSpeed || 2.0}x)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span>Single Tap: Show / Hide UI Controls</span>
              </li>
            </ul>
          </div>

          {/* Right Zone */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Right Zone (65% - 100%)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px]">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                <span>Swipe Up/Down: Adjust Volume</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span>Double Tap: Jump Forward (+{settings.seekInterval || 10}s)</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* INDIVIDUAL GESTURE TOGGLES & CONFIGURATION */}
      <div className="pt-2 border-t border-slate-800 space-y-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Gesture Options & Sensitivities
        </h3>

        {/* 1. Horizontal Swipe Seeking */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <FastForward className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-xs font-medium text-slate-200">Horizontal Swipe Seeking</p>
            </div>
            <p className="text-[11px] text-slate-400">
              Swipe left or right across the screen to preview timecode and scrub
            </p>
          </div>
          <button
            onClick={() =>
              updateSettings({ horizontalSeekGesture: !settings.horizontalSeekGesture })
            }
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              settings.horizontalSeekGesture ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.horizontalSeekGesture ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 2. Left-Side Vertical Brightness */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-xs font-medium text-slate-200">Left-Side Vertical Brightness</p>
            </div>
            <p className="text-[11px] text-slate-400">
              Swipe vertically on the left half to adjust display filter (40% - 160%)
            </p>
          </div>
          <button
            onClick={() =>
              updateSettings({ brightnessGesture: !settings.brightnessGesture })
            }
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              settings.brightnessGesture ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.brightnessGesture ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 3. Right-Side Vertical Volume */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <p className="text-xs font-medium text-slate-200">Right-Side Vertical Volume</p>
            </div>
            <p className="text-[11px] text-slate-400">
              Swipe vertically on the right half to adjust HTML media volume
            </p>
          </div>
          <button
            onClick={() =>
              updateSettings({ volumeGesture: !settings.volumeGesture })
            }
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              settings.volumeGesture ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.volumeGesture ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 4. Double-Tap Seeking */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Rewind className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-xs font-medium text-slate-200">Double-Tap Seeking</p>
            </div>
            <p className="text-[11px] text-slate-400">
              Double-tap left half to rewind, right half to jump forward
            </p>
          </div>
          <button
            onClick={() =>
              updateSettings({ doubleTapGesture: !settings.doubleTapGesture })
            }
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              settings.doubleTapGesture ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.doubleTapGesture ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 5. Center Double-Tap Action */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Center Double-Tap Action</label>
            <p className="text-[11px] text-slate-500">Action when double-tapping the center area</p>
            <select
              value={settings.centerDoubleTapAction || 'play_pause'}
              onChange={(e) =>
                updateSettings({
                  centerDoubleTapAction: e.target.value as 'play_pause' | 'none',
                })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="play_pause">Toggle Play / Pause</option>
              <option value="none">No Action (Ignore)</option>
            </select>
          </div>

          {/* 6. Long Press Boost Speed */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Long-Press Speed Boost</label>
            <p className="text-[11px] text-slate-500">Playback rate when holding down on the video</p>
            <select
              value={settings.longPressSpeed || 2.0}
              onChange={(e) =>
                updateSettings({ longPressSpeed: parseFloat(e.target.value) })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={1.5}>1.5x Speed</option>
              <option value={2.0}>2.0x Speed (Standard)</option>
              <option value={2.5}>2.5x Speed</option>
              <option value={3.0}>3.0x Speed</option>
            </select>
          </div>
        </div>

        {/* 7. Sensitivity Preset & Haptic Feedback */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Gesture Sensitivity</label>
            <p className="text-[11px] text-slate-500">Distance required to trigger swipe gestures</p>
            <select
              value={settings.gestureSensitivity || 'medium'}
              onChange={(e) =>
                updateSettings({
                  gestureSensitivity: e.target.value as 'low' | 'medium' | 'high',
                })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="low">Low (Requires larger drags, prevents accidental swipes)</option>
              <option value="medium">Medium (Standard responsiveness)</option>
              <option value="high">High (Quick micro-swipes)</option>
            </select>
          </div>

          <div className="flex flex-col justify-end space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Vibrate className="w-3.5 h-3.5 text-cyan-400" />
                  <p className="text-xs font-medium text-slate-200">Haptic Vibration</p>
                </div>
                <p className="text-[11px] text-slate-500">Vibration pulses on mobile devices</p>
              </div>
              <button
                onClick={() =>
                  updateSettings({ hapticFeedback: !settings.hapticFeedback })
                }
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  settings.hapticFeedback ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    settings.hapticFeedback ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Disclaimer / Hardware Explanation Box */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Browser & Privacy Architecture Notes</span>
          </div>
          <p>
            • <strong>Brightness:</strong> The web browser cannot alter physical screen backlights for security and battery reasons. CineFlow applies high-performance GPU CSS display filtering (40% to 160%) natively inside the player view.
          </p>
          <p>
            • <strong>Volume:</strong> On mobile operating systems like iOS Safari, programmatic volume modification is restricted by Apple; CineFlow displays an informational alert indicating the device&apos;s physical volume buttons must be used.
          </p>
        </div>
      </div>
    </section>
  );
};
