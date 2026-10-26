'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  HardDrive,
  Trash2,
  Check,
  AlertTriangle,
  Sliders,
  Shield,
  Activity,
  Film,
  Download,
  Upload,
} from 'lucide-react';
import { useMedia } from '@/context/MediaSessionContext';
import {
  getStorageEstimate,
  StorageEstimateResult,
  exportAllData,
  importData,
  clearAllLocalData,
  resetSettingsToDefault,
  DEFAULT_SETTINGS,
} from '@/lib/storage/db';
import { BrandHeader } from '@/components/brand/Logo';
import { GestureSettingsPanel } from '@/components/settings/GestureSettingsPanel';

export default function SettingsPage() {
  const { settings, updateSettings, isPrivateSession, setIsPrivateSession } = useMedia();

  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateResult>({
    usageBytes: 0,
    quotaBytes: 0,
    percentageUsed: 0,
    isAvailable: false,
  });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showGestureAdvanced, setShowGestureAdvanced] = useState<boolean>(false);

  useEffect(() => {
    getStorageEstimate().then(setStorageEstimate);
  }, []);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportBackup = async () => {
    const json = await exportAllData();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cineflow_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('Backup exported successfully.');
  };

  const handleClearAllData = async () => {
    await clearAllLocalData();
    updateSettings(DEFAULT_SETTINGS);
    setShowClearConfirm(false);
    showNotification('All local data cleared from this browser.');
    getStorageEstimate().then(setStorageEstimate);
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
      <BrandHeader className="md:hidden" />

      {/* Header (Screen 6) */}
      <div className="flex items-center justify-between h-11">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Settings</h1>
        {statusMessage && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[rgba(66,214,160,0.18)] text-[var(--ok)] animate-fade-in">
            {statusMessage}
          </span>
        )}
      </div>

      {/* Card 1: Player & Gesture Configuration (Screen 6) */}
      <div className="card p-1 sm:p-2 divide-y divide-[var(--bd)]/60 text-sm font-semibold">
        {/* Gestures Toggle */}
        <div className="row px-3 justify-between">
          <div>
            <span>Gestures</span>
            <div className="text-xs text-[var(--t3)] font-normal">
              Swipe brightness, volume & seek
            </div>
          </div>
          <div
            onClick={() => updateSettings({ gesturesEnabled: !settings.gesturesEnabled })}
            className={`tg ${settings.gesturesEnabled ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.gesturesEnabled}
            tabIndex={0}
          />
        </div>

        {/* Default Speed */}
        <div className="row px-3 justify-between">
          <div>Default speed</div>
          <div className="seg">
            {[1.0, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => updateSettings({ defaultSpeed: spd })}
                className={settings.defaultSpeed === spd ? 'on' : ''}
              >
                <span>{spd}×</span>
              </button>
            ))}
          </div>
        </div>

        {/* Seek Interval */}
        <div className="row px-3 justify-between">
          <div>Seek interval</div>
          <div className="seg">
            {[5, 10, 30].map((sec) => (
              <button
                key={sec}
                onClick={() => updateSettings({ seekInterval: sec })}
                className={settings.seekInterval === sec ? 'on' : ''}
              >
                <span>{sec}s</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resume Playback */}
        <div className="row px-3 justify-between">
          <div>Resume playback</div>
          <div
            onClick={() => updateSettings({ resumePlayback: !settings.resumePlayback })}
            className={`tg ${settings.resumePlayback ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.resumePlayback}
            tabIndex={0}
          />
        </div>

        {/* Private Session */}
        <div className="row px-3 justify-between">
          <div>Private session</div>
          <div
            onClick={() => setIsPrivateSession(!isPrivateSession)}
            className={`tg ${isPrivateSession ? 'on' : ''}`}
            role="switch"
            aria-checked={isPrivateSession}
            tabIndex={0}
          />
        </div>

        {/* Theme */}
        <div className="row px-3 justify-between">
          <div>Theme</div>
          <div className="seg">
            <button className="on">
              <span>Dark</span>
            </button>
            <button className="opacity-60">
              <span>Auto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Privacy & Browser Support (Screen 6) */}
      <div className="card p-1 sm:p-2 divide-y divide-[var(--bd)]/60 text-sm font-semibold">
        <div className="row px-3 justify-between">
          <div>
            <span>Privacy</span>
            <div className="text-xs text-[var(--t3)] font-normal">
              No uploads, no tracking, zero telemetry
            </div>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-[rgba(66,214,160,0.14)] text-[var(--ok)]">
            Local
          </span>
        </div>

        <div className="row px-3 justify-between">
          <div>
            <span>Browser support</span>
            <div className="text-xs text-[var(--t3)] font-normal">
              HTML5 video · IndexedDB · file picker
            </div>
          </div>
          <Link
            href="/diagnostics"
            className="text-xs font-semibold text-[var(--cy)] hover:underline"
          >
            Diagnostics &rarr;
          </Link>
        </div>
      </div>

      {/* Card 3: Clear Local Data (Screen 6) */}
      <div className="card bg-[var(--ss)] border-[#36456A] p-4 rounded-[26px]">
        <i className="block w-9 h-1 rounded-full bg-[var(--t3)] mx-auto mb-2.5 opacity-60" />
        <b className="text-sm sm:text-base font-bold text-white block">Clear local data</b>
        <p className="text-xs text-[var(--t2)] mt-1 mb-3.5 leading-relaxed">
          Removes saved positions and subtitle offsets from this browser. No video files will ever be touched.
        </p>

        {showClearConfirm ? (
          <div className="space-y-2 pt-1">
            <div className="p-3 rounded-xl bg-[rgba(255,107,122,0.1)] border border-[var(--er)]/40 text-xs text-[var(--er)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Are you sure? This will delete all local history and saved progress.</span>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn flex-1 h-11 bg-[var(--es)] border border-[var(--bd)] text-xs text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="btn flex-1 h-11 bg-[rgba(255,107,122,0.2)] border border-[var(--er)] text-xs text-[var(--er)] font-bold hover:bg-[rgba(255,107,122,0.3)]"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <button
              onClick={handleExportBackup}
              className="btn flex-1 h-11 bg-[var(--es)] border border-[var(--bd)] text-xs text-white hover:border-[var(--bv)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Backup</span>
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="btn flex-1 h-11 bg-[rgba(255,107,122,0.16)] border border-[var(--er)] text-xs text-[var(--er)] font-bold hover:bg-[rgba(255,107,122,0.25)]"
            >
              Clear data
            </button>
          </div>
        )}
      </div>

      {/* Advanced Gesture Sensitivity Accordion */}
      <div className="card p-4">
        <button
          onClick={() => setShowGestureAdvanced(!showGestureAdvanced)}
          className="w-full flex items-center justify-between text-left text-sm font-bold text-white"
        >
          <span className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--cy)]" />
            <span>Gesture Sensitivity & Controls Guide</span>
          </span>
          <span className="text-xs text-[var(--lav)]">
            {showGestureAdvanced ? 'Hide' : 'Configure'}
          </span>
        </button>

        {showGestureAdvanced && (
          <div className="mt-4 pt-3 border-t border-[var(--bd)]">
            <GestureSettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
