/**
 * Pure video-orientation state model for the player.
 * Rotation is a purely visual transform on the video element:
 * playback position, audio, subtitles and speed are untouched, and the
 * physical device orientation is never forced. Physical screen rotation
 * (Phase 2.3) is handled separately via the Screen Orientation API.
 */

export interface VideoOrientation {
  /** Clockwise rotation in degrees. */
  rotate: 0 | 90 | 180 | 270;
}

export const DEFAULT_ORIENTATION: VideoOrientation = { rotate: 0 };

type Quarter = 0 | 90 | 180 | 270;

function normalize(deg: number): Quarter {
  const mod = ((deg % 360) + 360) % 360;
  return mod as Quarter;
}

export function rotateClockwise(o: VideoOrientation): VideoOrientation {
  return { ...o, rotate: normalize(o.rotate + 90) };
}

export function rotateCounterClockwise(o: VideoOrientation): VideoOrientation {
  return { ...o, rotate: normalize(o.rotate - 90) };
}

export function rotate180(o: VideoOrientation): VideoOrientation {
  return { ...o, rotate: normalize(o.rotate + 180) };
}

export function resetOrientation(): VideoOrientation {
  return { ...DEFAULT_ORIENTATION };
}

export function isRotatedQuarter(o: VideoOrientation): boolean {
  return o.rotate === 90 || o.rotate === 270;
}

/**
 * Composes the CSS transform string for the video element.
 * Deterministic order: zoom scale first, then rotation.
 */
export function composeTransform(o: VideoOrientation, zoomScale = 1): string {
  const parts: string[] = [];
  if (zoomScale !== 1) parts.push(`scale(${zoomScale})`);
  if (o.rotate !== 0) parts.push(`rotate(${o.rotate}deg)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * Extra scale factor needed so a quarter-rotated video box stays fully
 * inside its container (no clipping). For 0/180-degree rotation the
 * element's own letterboxing (object-fit: contain) already guarantees fit.
 *
 * When rotated 90/270, the rendered box swaps width and height, so we scale
 * by min(containerW / boxH, containerH / boxW), capped at 1 (never upscale
 * beyond the original size to "fill" space).
 */
export function rotationFitScale(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
  o: VideoOrientation
): number {
  if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) return 1;
  if (!isRotatedQuarter(o)) return 1;
  // The element box keeps videoWidth x videoHeight; after a quarter rotation
  // its visual footprint becomes videoHeight x videoWidth.
  const scale = Math.min(containerWidth / videoHeight, containerHeight / videoWidth);
  return Math.min(1, scale);
}
