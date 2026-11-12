/**
 * Native-shell detection for the AppMintly Android WebView wrapper.
 *
 * The wrapper registers `AppMintlyNative` with `addJavascriptInterface` before
 * it calls `loadUrl`, so the object exists while the page's own modules are
 * still being evaluated. That lets the app suppress its HTML splash without a
 * frame of it ever reaching the screen.
 *
 * The check is deliberately fail-open: a browser has no bridge, and a bridge
 * that throws or returns anything other than `true` is treated the same way, so
 * a broken wrapper can never leave a blank launch. Only a positive answer from
 * the shipped bridge suppresses the splash.
 */

export type NativeBridgeLike =
  | { isNativeApp?: () => boolean }
  | undefined
  | null;

/** True only when the injected bridge explicitly reports the native app. */
export function isNativeAppShell(bridge: NativeBridgeLike): boolean {
  try {
    return typeof bridge?.isNativeApp === 'function' && bridge.isNativeApp() === true;
  } catch {
    return false;
  }
}

/** The bridge as the page sees it; undefined in a browser or during SSR. */
export function readNativeBridge(): NativeBridgeLike {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { AppMintlyNative?: NativeBridgeLike }).AppMintlyNative;
}

/**
 * Decided once, at module load, exactly like the shipped Niramay fix: the
 * decision cannot flip after hydration, so the splash never mounts late.
 */
export const IS_NATIVE_SHELL: boolean = isNativeAppShell(readNativeBridge());
