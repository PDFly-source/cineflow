/**
 * Real screen-orientation support for the mobile player (Phase 2.3, hardened
 * in Phase 3.0).
 *
 * Three routes are tried, in this order, and only a route that actually
 * succeeded is reported as success:
 *
 *   1. Native bridge (`window.AppMintlyNative.lockOrientation`) — the
 *      AppMintly APK wrapper sets the activity's requested orientation on the
 *      UI thread. This is the only route that works inside an Android
 *      WebView, which does not implement screen.orientation.lock().
 *   2. Screen Orientation API — on Android Chrome/PWAs `lock()` is only
 *      permitted from a user gesture while the document is fullscreen, so
 *      fullscreen is requested first and the lock is retried once after the
 *      fullscreen transition settles.
 *   3. Truthful fallback — when neither route works we say so; there is
 *      deliberately no CSS-transform fake rotation.
 */

export const ROTATE_SCREEN_FALLBACK_MESSAGE =
  'Rotate your phone to landscape; automatic rotation depends on device settings.';

export type OrientationTarget = 'portrait' | 'landscape';

/** Minimal shape of the parts of `screen.orientation` we use. */
export interface ScreenOrientationLike {
  type: string;
  lock?: (orientation: 'portrait' | 'landscape') => Promise<void>;
  unlock?: () => void;
}

/** Native orientation bridge exposed by the AppMintly APK wrapper. */
export interface NativeOrientationBridge {
  lockOrientation?: (orientation: 'landscape' | 'portrait' | 'auto') => boolean;
}

export function getScreenOrientation(): ScreenOrientationLike | null {
  if (typeof screen === 'undefined' || !screen.orientation) return null;
  return screen.orientation as ScreenOrientationLike;
}

/** Reads the native bridge if this build is running inside the AppMintly APK. */
export function getNativeOrientationBridge(): NativeOrientationBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { AppMintlyNative?: NativeOrientationBridge }).AppMintlyNative;
  if (!bridge || typeof bridge.lockOrientation !== 'function') return null;
  return bridge;
}

export function supportsOrientationLock(so: ScreenOrientationLike | null): boolean {
  return !!so && typeof so.lock === 'function';
}

export function isLandscapeType(type: string): boolean {
  return type.startsWith('landscape');
}

/**
 * Toggle target for the "Rotate screen" action: if the screen is currently
 * landscape, request portrait; otherwise request landscape.
 */
export function nextOrientationTarget(currentType: string): OrientationTarget {
  return isLandscapeType(currentType) ? 'portrait' : 'landscape';
}

export interface RequestRotationOptions {
  /** Native bridge override (tests / diagnostics). */
  native?: NativeOrientationBridge | null;
  /** Orientation object override (tests). */
  screenOrientation?: ScreenOrientationLike | null;
  /** How long to wait for the fullscreen transition to settle (ms). */
  settleMs?: number;
  /** Injectable delay (tests). */
  wait?: (ms: number) => Promise<void>;
}

export type RotationResult = 'locked' | 'fallback';

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function fullscreenActive(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

/** Resolves 'locked' only when a real route succeeded. */
export async function requestScreenRotation(
  fullscreenElement: () => Promise<void>,
  so: ScreenOrientationLike | null,
  options: RequestRotationOptions = {}
): Promise<RotationResult> {
  const { settleMs = 450, wait = defaultWait } = options;
  const screenOrientation = options.screenOrientation !== undefined ? options.screenOrientation : so;
  const currentType = screenOrientation?.type ?? 'portrait-primary';
  const target = nextOrientationTarget(currentType);

  // Route 1 — native APK bridge (works where the WebView has no lock()).
  const native = options.native !== undefined ? options.native : getNativeOrientationBridge();
  if (native && typeof native.lockOrientation === 'function') {
    try {
      if (native.lockOrientation(target)) return 'locked';
    } catch {
      // fall through to the web route
    }
  }

  // Route 2 — Screen Orientation API (fullscreen first, then lock).
  if (!supportsOrientationLock(screenOrientation) || !screenOrientation?.lock) return 'fallback';

  try {
    if (!fullscreenActive()) {
      await fullscreenElement();
    }
  } catch {
    // Fullscreen can be refused (iOS, embedded frames); still try the lock —
    // some browsers allow it outside fullscreen, and a refusal is honest.
  }

  if (!fullscreenActive()) {
    // Give the fullscreen transition a chance to settle before locking.
    await wait(settleMs);
  }

  try {
    await screenOrientation.lock(target);
    return 'locked';
  } catch {
    // One retry after a short settle: Android Chrome intermittently rejects
    // the first lock() issued in the same tick as the fullscreen request.
    try {
      await wait(150);
      await screenOrientation.lock(target);
      return 'locked';
    } catch {
      return 'fallback';
    }
  }
}

/**
 * Best-effort unlock when leaving rotation mode / fullscreen. Also releases a
 * native orientation override so the device returns to normal behaviour.
 */
export function releaseScreenOrientation(so: ScreenOrientationLike | null, native?: NativeOrientationBridge | null): void {
  try {
    so?.unlock?.();
  } catch {
    // Ignored: unlock is best-effort and may reject when nothing is locked.
  }
  const bridge = native !== undefined ? native : getNativeOrientationBridge();
  try {
    bridge?.lockOrientation?.('auto');
  } catch {
    // Ignored: same best-effort contract as above.
  }
}
