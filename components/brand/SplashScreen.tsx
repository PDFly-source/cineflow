'use client';

import React, { useState, useEffect } from 'react';
import { CineFlowLogo } from './Logo';

interface SplashScreenProps {
  onComplete?: () => void;
  autoDismissMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  autoDismissMs = 1200,
}) => {
  // Start hidden on both server and client so hydration always matches the
  // static export's HTML; decide whether to show in a post-mount effect.
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isFading, setIsFading] = useState<boolean>(false);

  useEffect(() => {
    // First visit in this tab? Show the splash once, then remember it.
    let alreadyShown = true;
    try {
      alreadyShown = !!sessionStorage.getItem('cineflow_splash_shown');
    } catch {
      // Private mode / storage disabled — skip the splash rather than loop it.
      alreadyShown = true;
    }
    if (alreadyShown) return;
    // Defer so the effect body itself stays render-free (lint: setState-in-effect).
    const t = setTimeout(() => setIsVisible(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, autoDismissMs);

    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      try {
        sessionStorage.setItem('cineflow_splash_shown', 'true');
      } catch {
        // Ignore quota/private mode restrictions
      }
      onComplete?.();
    }, autoDismissMs + 400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [isVisible, autoDismissMs, onComplete]);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="CineFlow Launch Screen"
      className={`fixed inset-0 z-50 flex w-screen flex-col items-center justify-center overflow-hidden bg-[var(--ob)] p-6 transition-opacity duration-400 select-none ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onClick={() => {
        setIsFading(true);
        setTimeout(() => {
          setIsVisible(false);
          sessionStorage.setItem('cineflow_splash_shown', 'true');
          onComplete?.();
        }, 200);
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center justify-center gap-8 text-center">
        <CineFlowLogo className="h-40 w-40 rounded-[28px] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_90px_rgba(105,85,255,0.28)] sm:h-44 sm:w-44" />
        <p className="text-xs sm:text-sm font-extrabold tracking-[0.22em] text-[var(--t2)] uppercase pt-4">
          YOUR VIDEOS. YOUR DEVICE. YOUR CONTROL.
        </p>
      </div>
    </aside>
  );
};
