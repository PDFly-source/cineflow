'use client';

import React, { useState, useEffect } from 'react';

// The site is served from a project path on GitHub Pages, so every asset URL
// needs the base path. A plain <img> is not rewritten by Next.js.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface SplashScreenProps {
  onComplete?: () => void;
  autoDismissMs?: number;
}

/**
 * Brand splash - artwork approved by the owner: film strips frame the screen,
 * the mark turns in 3D, the wordmark rises. The sequence lands at ~1.7s, so the
 * default hold is 1900ms.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  autoDismissMs = 1900,
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
      // Private mode / storage disabled - skip the splash rather than loop it.
      alreadyShown = true;
    }
    if (alreadyShown) return;
    // Defer so the effect body itself stays render-free (lint: setState-in-effect).
    const t = setTimeout(() => setIsVisible(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const fadeTimer = setTimeout(() => setIsFading(true), autoDismissMs);
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      try {
        sessionStorage.setItem('cineflow_splash_shown', 'true');
      } catch {
        // Storage unavailable - the splash simply reappears next load.
      }
      onComplete?.();
    }, autoDismissMs + 350);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [isVisible, autoDismissMs, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`cfs-root cfs-a6 cfs-go${isFading ? ' is-fading' : ''}`}
      aria-hidden="true"
      data-splash="cineflow"
    >
      <div className="cfs-fs cfs-f1" />
      <div className="cfs-fs cfs-f2" />
      <div className="cfs-ctr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cfs-mk" src={`${BASE_PATH}/brand/splash/mark.jpg`} alt="" width={135} height={137} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cfs-tx" src={`${BASE_PATH}/brand/splash/wordmark.jpg`} alt="Cineflow" width={215} height={54} />
      </div>
    </div>
  );
};
