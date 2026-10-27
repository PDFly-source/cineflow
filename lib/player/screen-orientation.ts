/**
 * Real screen-orientation support for the mobile player (Phase 2.3).
 *
 * The Screen Orientation API locks the actual device screen orientation.
 * On Android Chrome and installed PWAs, `screen.orientation.lock()` is only
 * permitted from a user gesture while the document is fullscreen, so the
 * player enters fullscreen first and only then requests the lock.
 *
 * There is deliberately NO CSS-transform fallback here: when locking is
 * unsupported or rejected we tell the user the truth instead of pretending
 * the screen rotated.
 */

export const ROTATE_SCREEN_FALLBACK_MESSAGE =
  'Rotate your phone to landscape; automatic rotation depends on your device settings.';

/** Minimal shape of the parts of `screen.orientation` we use. */
export interface ScreenOrientationLike {
  type: string;
  lock?: (orientation: 'portrait' | 'landscape') => Promise<void>;
  unlock?: () => void;
}

export function getScreenOrientation(): ScreenOrientationLike | null {
  if (typeof screen === 'undefined' || !screen.orientation) return null;
  return screen.orientation as ScreenOrientationLike;
}

export function supportsOrientationLock(so: ScreenOrientationLike | null): boolean {
  return !!so && typeof so.lock === 'function';
}

export function isLandscapeType(type: string): boolean {
  return type.startsWith('landscape');
}

/**
 * Toggle target for the "Rotate screen" action: if the screen is currently
 * landscape (or we cannot tell), request landscape so the video fills the
 * wide screen; if it is already landscape, return to portrait.
 */
export function nextOrientationTarget(currentType: string): 'portrait' | 'landscape' {
  return isLandscapeType(currentType) ? 'portrait' : 'landscape';
}

/**
 * Attempts a real orientation lock. Must be called from a user gesture.
 * Returns 'locked' when the browser accepted the lock, 'fallback' when the
 * API is unsupported or rejected (the caller should then show
 * ROTATE_SCREEN_FALLBACK_MESSAGE). Never resolves to 'locked' unless the
 * device really agreed to lock.
 */
export async function requestScreenRotation(
  fullscreenElement: () => Promise<void>,
  so: ScreenOrientationLike | null
): Promise<'locked' | 'fallback'> {
  if (!supportsOrientationLock(so) || !so!.lock) return 'fallback';
  try {
    // Orientation lock requires a fullscreen document on Android Chrome/PWAs.
    const isFullscreen = typeof document !== 'undefined' && !!document.fullscreenElement;
    if (!isFullscreen) {
      await fullscreenElement();
    }
    await so!.lock(nextOrientationTarget(so!.type));
    return 'locked';
  } catch {
    return 'fallback';
  }
}

/**
 * Best-effort unlock when leaving rotation mode / fullscreen. The browser
 * unlocks automatically when fullscreen exits; this clears our own intent
 * and tolerates any rejection.
 */
export function releaseScreenOrientation(so: ScreenOrientationLike | null): void {
  try {
    so?.unlock?.();
  } catch {
    // Ignored: unlock is best-effort and may reject when nothing is locked.
  }
}
