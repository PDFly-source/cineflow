'use client';

import React, { useState } from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string; variant?: 'button' | 'banner' }> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [hasDismissedBanner, setHasDismissedBanner] = useState(false);

  // If already running in standalone mode, do not show install CTA
  if (isInstalled) {
    return null;
  }

  if (variant === 'banner') {
    if (hasDismissedBanner || (!isInstallable && !isIOS)) return null;

    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-100">Install CineFlow App</span>
                <span className="text-[11px] text-indigo-300 font-mono bg-indigo-500/10 px-2 py-0.5 rounded">PWA</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Run CineFlow in a distraction-free window with offline shell support. Videos stay 100% on your device.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInstallable && (
              <button
                onClick={install}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Install Now
              </button>
            )}
            {isIOS && (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-lg border border-slate-700 flex items-center gap-1.5"
              >
                <Share className="w-3.5 h-3.5" />
                Add to Home Screen
              </button>
            )}
            <button
              onClick={() => setHasDismissedBanner(true)}
              aria-label="Dismiss banner"
              className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iOS Guided Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold">Install on iOS</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4 my-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">1. Open Safari Share Menu</p>
                    <p className="text-xs text-slate-400">Tap the Share button at the bottom of the Safari toolbar.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">2. Add to Home Screen</p>
                    <p className="text-xs text-slate-400">Scroll down and tap &quot;Add to Home Screen&quot; to launch in standalone mode.</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Button variant (for headers/menus)
  if (isInstallable) {
    return (
      <button
        onClick={install}
        aria-label="Install CineFlow progressive web app"
        className={`flex items-center gap-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-colors ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-indigo-400" />
        <span className="whitespace-nowrap">Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition ${className}`}
        >
          <Share className="w-3.5 h-3.5 text-slate-400" />
          <span className="whitespace-nowrap">Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold">Install on iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4 my-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">1. Tap Share in Safari</p>
                    <p className="text-xs text-slate-400">Located in the bottom toolbar of Safari.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">2. Tap &quot;Add to Home Screen&quot;</p>
                    <p className="text-xs text-slate-400">Enjoy standalone fullscreen playback without address bar.</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
