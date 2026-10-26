'use client';

import React from 'react';
import { X, Keyboard, Smartphone } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seekInterval: number;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose, seekInterval }) => {
  if (!isOpen) return null;

  const keyboardShortcuts = [
    { key: 'Space / K', desc: 'Play / Pause' },
    { key: `← / →`, desc: `Seek backward / forward (${seekInterval}s)` },
    { key: 'J / L', desc: 'Skip -10s / +10s' },
    { key: '↑ / ↓', desc: 'Volume up / down (5%)' },
    { key: 'M', desc: 'Mute / Unmute' },
    { key: 'F', desc: 'Toggle Fullscreen' },
    { key: 'P', desc: 'Picture-in-Picture (PiP)' },
    { key: 'C', desc: 'Toggle Subtitles' },
    { key: '[ / ]', desc: 'Decrease / Increase Speed' },
    { key: 'A', desc: 'Set A–B Loop Point A' },
    { key: 'B', desc: 'Set A–B Loop Point B' },
    { key: 'R', desc: 'Clear A–B Loop' },
    { key: 'Esc', desc: 'Exit Fullscreen or Close Dialog' },
  ];

  const gestureShortcuts = [
    { gesture: 'Left Side Vertical Swipe', desc: 'In-Player Brightness (40% - 160%)' },
    { gesture: 'Right Side Vertical Swipe', desc: 'Volume Adjustment (0% - 100%)' },
    { gesture: 'Horizontal Swipe Drag', desc: 'Fast Scrub Seek with Live HUD' },
    { gesture: 'Double-Tap Left / Right', desc: 'Cumulative seek (-10s / +10s)' },
    { gesture: 'Double-Tap Center', desc: 'Play / Pause Toggle' },
    { gesture: 'Press & Hold (Long-Press)', desc: '2.0x Temporary Speed Boost' },
    { gesture: 'Two-Finger Pinch', desc: 'Pinch-to-Zoom (1.0x - 3.0x)' },
    { gesture: 'Subtitle Vertical Drag', desc: 'Reposition Subtitle Height' },
    { gesture: 'Subtitle Horizontal Swipe', desc: 'Nudge Audio Sync Offset (±0.25s)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold">Controls & Shortcuts Guide</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shortcuts guide"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Keyboard section */}
        <div className="py-4 border-b border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Keyboard Shortcuts</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {keyboardShortcuts.map((sc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-800 text-xs"
              >
                <span className="text-slate-300">{sc.desc}</span>
                <kbd className="px-2 py-0.5 rounded-md bg-slate-700 font-mono text-[11px] font-semibold text-indigo-300 shadow-xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Gestures section */}
        <div className="py-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Touch & Gesture Controls</span>
          </h4>
          <div className="space-y-2">
            {gestureShortcuts.map((g, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-800 text-xs"
              >
                <span className="text-slate-300">{g.gesture}</span>
                <span className="text-indigo-300 text-right">{g.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
