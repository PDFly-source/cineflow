'use client';

import React from 'react';
import { SplashScreen } from './SplashScreen';
import { IS_NATIVE_SHELL } from './native-shell';

/**
 * Decides whether this platform gets a web splash at all.
 *
 * Native app users see the CineFlowSplashView drawn by the Android wrapper, so
 * mounting the HTML splash on top of it would show the brand animation twice and
 * (until this mount existed) with broken artwork. Browsers and installed PWAs
 * keep the web splash exactly as before.
 */
export function SplashScreenMount() {
  if (IS_NATIVE_SHELL) return null;
  return <SplashScreen />;
}
