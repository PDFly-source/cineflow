'use client';

import React, { useRef, useState } from 'react';
import { X, Upload, RotateCcw, Check, Type, FileText, AlertCircle } from 'lucide-react';
import { useMedia } from '@/context/MediaSessionContext';
import { parseSubtitleFile } from '@/lib/subtitles/parser';
import { SubtitleSize } from '@/lib/storage/db';

interface SubtitlesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_PRESETS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Warning Yellow', value: '#FFC66D' },
  { label: 'Cinematic Cyan', value: '#35D8F2' },
  { label: 'Mint Green', value: '#42D6A0' },
];

export const SubtitlesModal: React.FC<SubtitlesModalProps> = ({ isOpen, onClose }) => {
  const {
    activeSubtitle,
    subtitleEnabled,
    setSubtitleEnabled,
    loadSubtitleFile,
    setSubtitleOffset,
    clearSubtitle,
    settings,
    updateSettings,
  } = useMedia();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCheckingFile, setIsCheckingFile] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    setIsCheckingFile(true);
    try {
      // Validate with the real parser before loading so invalid files get a clear message.
      const text = await file.text();
      const probe = parseSubtitleFile(text, file.name, 0);
      if (probe.cues.length === 0) {
        setLoadError(
          `"${file.name}" contains no usable subtitle cues. Make sure it is a valid .srt or .vtt file with "HH:MM:SS,mmm --> HH:MM:SS,mmm" time lines.`
        );
        e.target.value = '';
        return;
      }
      const ok = await loadSubtitleFile(file);
      if (!ok) {
        setLoadError(`Could not load "${file.name}". The file may be unreadable or encoded in an unsupported charset.`);
      }
    } catch {
      setLoadError(`Could not read "${file.name}". Try re-saving it as UTF-8 .srt or .vtt.`);
    } finally {
      setIsCheckingFile(false);
      e.target.value = '';
    }
  };

  const handleAdjustOffset = (delta: number) => {
    const current = activeSubtitle?.offsetSeconds || 0;
    setSubtitleOffset(Number((current + delta).toFixed(2)));
  };

  const handleResetSettings = () => {
    updateSettings({
      subtitleSize: 'medium',
      subtitleColor: '#ffffff',
      subtitleBgOpacity: 0.65,
      subtitleTextShadow: true,
      subtitleFont: 'sans',
      subtitlePosition: 'bottom',
    });
    setSubtitleOffset(0);
  };

  // Subtitle styling mappings for the live preview scene
  const fontSizeMap: Record<SubtitleSize, string> = {
    small: 'text-xs',
    medium: 'text-sm sm:text-base',
    large: 'text-base sm:text-lg',
    'extra-large': 'text-lg sm:text-xl font-bold',
  };

  const fontFamilyMap: Record<string, string> = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono',
    rounded: 'font-sans tracking-wider font-semibold',
  };

  const bgOpacityPct = Math.round((settings.subtitleBgOpacity ?? 0.65) * 100);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] rounded-[32px] bg-[var(--es)] border border-[var(--bd)] shadow-2xl text-[var(--tx)] my-auto select-none overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden Subtitle File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload Subtitle File"
        />

        {/* Header (Screen 5) */}
        <div className="sticky top-0 z-10 flex items-center justify-between pb-3 px-5 pt-5 -mx-5 bg-[var(--es)]/95 backdrop-blur-sm rounded-t-[32px]">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-tight text-white">Subtitle Studio</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetSettings}
              className="text-xs font-bold text-[var(--lav)] hover:text-white transition-colors"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rnd gl w-8 h-8 text-[var(--t2)] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-6">
        {/* Live Preview Scene (Screen 5) */}
        <div className="scene h-44 rounded-2xl border border-[#34416A] mb-3 relative flex items-center justify-center p-4">
          <div className="shade pointer-events-none" />
          <div
            className={`relative z-10 text-center transition-all px-3 py-1.5 rounded-lg ${
              fontSizeMap[settings.subtitleSize]
            } ${fontFamilyMap[settings.subtitleFont || 'sans']}`}
            style={{
              color: settings.subtitleColor,
              backgroundColor: `rgba(0, 0, 0, ${settings.subtitleBgOpacity ?? 0.65})`,
              textShadow: settings.subtitleTextShadow
                ? '0 2px 4px rgba(0,0,0,0.9), 0 0 2px #000'
                : 'none',
              alignSelf: settings.subtitlePosition === 'top' ? 'flex-start' : 'flex-end',
            }}
          >
            Some light is worth the climb.
          </div>
        </div>

        {/* Subtitle File Picker Card (Screen 5) */}
        <div className="card flex items-center gap-3 p-3 mb-3">
          <div className="tile">
            <FileText className="w-5 h-5 text-[var(--cy)]" />
          </div>
          <div className="flex-1 min-w-0">
            <strong className="block text-sm font-semibold text-white truncate">
              {activeSubtitle ? activeSubtitle.fileName || 'Loaded Subtitle' : 'No subtitle loaded'}
            </strong>
            <p className="text-xs text-[var(--t2)]">
              {activeSubtitle
                ? `${activeSubtitle.cues.length} cues · ${activeSubtitle.format.toUpperCase()}`
                : '.srt and .vtt files'}
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="chip on shrink-0 text-xs font-bold"
          >
            {activeSubtitle ? 'Replace' : 'Choose'}
          </button>
          {activeSubtitle && (
            <button
              onClick={clearSubtitle}
              className="chip shrink-0 text-xs text-[var(--er)] hover:border-[var(--er)]"
              title="Remove subtitles"
            >
              Clear
            </button>
          )}
        </div>

        {/* Load error — real parser feedback, no silent failures */}
        {loadError && (
          <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-950/40 p-3 text-left">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-red-200">{loadError}</p>
          </div>
        )}

        {/* Configuration Rows Card (Screen 5) */}
        <div className="card p-1 sm:p-2 divide-y divide-[var(--bd)]/60 text-sm font-semibold">
          {/* Size */}
          <div className="row px-3 justify-between">
            <div>Size</div>
            <div className="seg">
              {(['small', 'medium', 'large', 'extra-large'] as SubtitleSize[]).map((sz, i) => (
                <button
                  key={sz}
                  onClick={() => updateSettings({ subtitleSize: sz })}
                  className={settings.subtitleSize === sz ? 'on' : ''}
                >
                  {['S', 'M', 'L', 'XL'][i]}
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div className="row px-3 justify-between">
            <div>Font</div>
            <div className="seg">
              {(['sans', 'serif', 'mono'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => updateSettings({ subtitleFont: f })}
                  className={settings.subtitleFont === f ? 'on' : ''}
                >
                  <span className="capitalize">{f}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="row px-3 justify-between">
            <div>Color</div>
            <div className="flex items-center gap-2.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => updateSettings({ subtitleColor: c.value })}
                  style={{
                    backgroundColor: c.value,
                    boxShadow: settings.subtitleColor === c.value ? '0 0 0 3px var(--ev)' : 'none',
                  }}
                  className="dot transition-transform hover:scale-110"
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          {/* Background Opacity */}
          <div className="row px-3 justify-between gap-4">
            <div className="shrink-0 w-24">Background</div>
            <div className="flex-1 flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.subtitleBgOpacity ?? 0.65}
                onChange={(e) =>
                  updateSettings({ subtitleBgOpacity: parseFloat(e.target.value) })
                }
                className="w-full accent-[var(--ev)] cursor-pointer h-1.5 rounded-full bg-[var(--ss)]"
                aria-label="Subtitle Background Opacity"
              />
              <span className="font-mono text-xs text-[var(--t2)] shrink-0 w-8 text-right">
                {bgOpacityPct}%
              </span>
            </div>
          </div>

          {/* Outline */}
          <div className="row px-3 justify-between">
            <div>Outline & Shadow</div>
            <div
              onClick={() => updateSettings({ subtitleTextShadow: !settings.subtitleTextShadow })}
              className={`tg ${settings.subtitleTextShadow ? 'on' : ''}`}
              role="switch"
              aria-checked={settings.subtitleTextShadow}
              tabIndex={0}
            />
          </div>

          {/* Position */}
          <div className="row px-3 justify-between">
            <div>Position</div>
            <div className="seg">
              {(['top', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => updateSettings({ subtitlePosition: pos })}
                  className={settings.subtitlePosition === pos ? 'on' : ''}
                >
                  <span className="capitalize">{pos}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sync offset */}
          <div className="row px-3 justify-between">
            <div>Sync offset</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAdjustOffset(-0.5)}
                className="chip text-xs hover:border-[var(--ev)] px-2.5 h-8 font-mono"
              >
                − 0.5s
              </button>
              <span className="font-mono text-xs text-[var(--cy)] font-bold px-1 min-w-10 text-center">
                {(activeSubtitle?.offsetSeconds || 0).toFixed(1)}s
              </span>
              <button
                onClick={() => handleAdjustOffset(0.5)}
                className="chip text-xs hover:border-[var(--ev)] px-2.5 h-8 font-mono"
              >
                + 0.5s
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
