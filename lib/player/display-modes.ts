/**
 * MX Player-style display modes (Phase 2.4).
 *
 * Pure model: every mode maps onto the player's existing video fit
 * machinery (object-fit classes on the <video> element) plus an optional
 * transform scale. No backend, no cloud storage - the preferred mode is
 * persisted through the existing local settings system.
 *
 * Mode semantics (all AR-preserving unless stated):
 * - fit      : whole video visible, letterboxed when aspect differs.
 * - fill     : covers the viewport exactly, cropping the overflowing edges.
 * - crop     : like fill but magnified (CROP_BIAS) for a closer view; still
 *              covers the viewport and still never distorts.
 * - stretch  : fills both dimensions and DISTORTS the aspect ratio.
 *              The only distorting mode and always labelled as such.
 * - original : natural pixel size, shrunk only when it cannot fit the
 *              viewport ("100%" where practical).
 */

import type { VideoFitMode } from '@/lib/storage/db';

export type DisplayMode = 'fit' | 'fill' | 'crop' | 'stretch' | 'original';

/** Extra magnification that separates Crop from Fill. */
export const CROP_BIAS = 1.25;

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.25;

/** Zoom level applied by the double-tap toggle (configurable via settings). */
export const DEFAULT_DOUBLE_TAP_ZOOM = 2.0;

export interface DisplayModeOption {
  mode: DisplayMode;
  label: string;
  short: string;
  desc: string;
  distorts: boolean;
}

export const DISPLAY_MODES: DisplayModeOption[] = [
  {
    mode: 'fit',
    label: 'Fit Screen',
    short: 'Fit',
    desc: 'Show the entire video, letterboxed if needed',
    distorts: false,
  },
  {
    mode: 'fill',
    label: 'Fill Screen',
    short: 'Fill',
    desc: 'Fill the screen, crop overflow, no distortion',
    distorts: false,
  },
  {
    mode: 'crop',
    label: 'Crop',
    short: 'Crop',
    desc: `Cover with a ${CROP_BIAS}x closer view, no distortion`,
    distorts: false,
  },
  {
    mode: 'stretch',
    label: 'Stretch (distorts)',
    short: 'Stretch',
    desc: 'Fill both dimensions, aspect ratio WILL distort',
    distorts: true,
  },
  {
    mode: 'original',
    label: '100% (Original)',
    short: '100%',
    desc: 'Natural pixel size, shrunk only if larger than the screen',
    distorts: false,
  },
];

/** Display mode -> the persisted VideoFitMode used by the video element. */
export function displayModeToVideoFit(mode: DisplayMode): VideoFitMode {
  switch (mode) {
    case 'fit':
      return 'contain';
    case 'fill':
      return 'cover';
    case 'crop':
      return 'crop';
    case 'stretch':
      return 'fill';
    case 'original':
      return 'original';
  }
}

/** Inverse mapping so the UI can highlight the active mode. */
export function videoFitToDisplayMode(fit: VideoFitMode): DisplayMode {
  switch (fit) {
    case 'cover':
      return 'fill';
    case 'crop':
      return 'crop';
    case 'fill':
      return 'stretch';
    case 'original':
      return 'original';
    case 'contain':
    default:
      return 'fit';
  }
}

export function displayModeOption(mode: DisplayMode): DisplayModeOption {
  return DISPLAY_MODES.find((o) => o.mode === mode) ?? DISPLAY_MODES[0];
}

/** Scale multiplier a fit mode applies on top of the user zoom. */
export function fitBiasScale(fit: VideoFitMode): number {
  return fit === 'crop' ? CROP_BIAS : 1;
}

/** Clamp a zoom factor to the usable range. */
export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat(zoom.toFixed(2))));
}

/** One button step of zoom in (+1) or out (-1), clamped. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(zoom + direction * ZOOM_STEP);
}

/** Double-tap toggle target: zoomed in vs restored. */
export function doubleTapZoomTarget(currentZoom: number, zoomLevel: number): number {
  return currentZoom > 1 ? ZOOM_MIN : clampZoom(zoomLevel);
}

/**
 * Maximum pan (screen px) that keeps the zoomed video box inside the
 * container. The box is the element box the mode renders at zoom 1:
 * letterboxed content box for fit/original, container-sized for
 * fill/crop/stretch.
 */
export function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  videoBox: { w: number; h: number },
  container: { w: number; h: number }
): { x: number; y: number } {
  const maxX = Math.max(0, (zoom * videoBox.w - container.w) / 2);
  const maxY = Math.max(0, (zoom * videoBox.h - container.h) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, Math.round(pan.x))),
    y: Math.min(maxY, Math.max(-maxY, Math.round(pan.y))),
  };
}

/**
 * Element box (before zoom) a mode renders, used for pan clamping.
 * aspect = videoWidth / videoHeight (in the rotated frame the caller
 * already swaps dimensions).
 */
export function modeBaseBox(
  fit: VideoFitMode,
  container: { w: number; h: number },
  videoWidth: number,
  videoHeight: number
): { w: number; h: number } {
  if (!container.w || !container.h || !videoWidth || !videoHeight) return { w: container.w, h: container.h };
  const ar = videoWidth / videoHeight;
  switch (fit) {
    case 'cover':
    case 'crop':
    case 'fill':
      return { w: container.w, h: container.h };
    case 'original': {
      // Natural size, shrunk only when larger than the container.
      const scale = Math.min(1, container.w / videoWidth, container.h / videoHeight);
      return { w: videoWidth * scale, h: videoHeight * scale };
    }
    case 'contain':
    default: {
      const scale = Math.min(container.w / videoWidth, container.h / videoHeight);
      return { w: videoWidth * scale, h: videoHeight * scale };
    }
  }
}
