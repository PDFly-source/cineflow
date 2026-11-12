import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { isNativeAppShell } from '../components/brand/native-shell';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

test('the splash is suppressed only on a positive native-bridge answer', () => {
  // The four states that decide whether a launch shows the web splash. The app
  // (bridge present and true) must not mount it; everything else must, so a
  // broken or absent bridge can never blank a browser launch.
  assert.equal(isNativeAppShell({ isNativeApp: () => true }), true, 'native app suppresses');
  assert.equal(isNativeAppShell({ isNativeApp: () => false }), false, 'bridge saying false keeps it');
  assert.equal(isNativeAppShell(undefined), false, 'no bridge (browser/SSR) keeps it');
  assert.equal(isNativeAppShell(null), false, 'null bridge keeps it');
  assert.equal(isNativeAppShell({}), false, 'bridge without the method keeps it');
  assert.equal(
    isNativeAppShell({ isNativeApp: () => { throw new Error('bridge down'); } }),
    false,
    'a throwing bridge keeps it',
  );
  // A non-boolean truthy answer is not consent.
  assert.equal(isNativeAppShell({ isNativeApp: () => 'yes' as unknown as boolean }), false);
});

test('the layout mounts the gate, not the splash directly', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /import \{ SplashScreenMount \} from '@\/components\/brand\/SplashScreenMount'/);
  assert.match(layout, /<SplashScreenMount \/>/);
  assert.doesNotMatch(layout, /<SplashScreen \/>/, 'the splash must not be mounted unconditionally');
});

test('the gate returns null for the native shell and the splash otherwise', () => {
  const mount = read('components/brand/SplashScreenMount.tsx');
  assert.match(mount, /if \(IS_NATIVE_SHELL\) return null;/);
  assert.match(mount, /return <SplashScreen \/>;/);
  assert.match(mount, /import \{ IS_NATIVE_SHELL \} from '\.\/native-shell'/);
});

test('the decision is made at module load, before hydration can flip it', () => {
  const shell = read('components/brand/native-shell.ts');
  assert.match(shell, /export const IS_NATIVE_SHELL: boolean = isNativeAppShell\(readNativeBridge\(\)\)/);
  assert.match(shell, /typeof window === 'undefined'/, 'SSR/static export must be handled');
  assert.match(shell, /catch \{/, 'a throwing bridge must fail open');
});

test('every splash artwork URL is base-path aware for /cineflow', () => {
  const splash = read('components/brand/SplashScreen.tsx');
  assert.match(splash, /const BASE_PATH = process\.env\.NEXT_PUBLIC_BASE_PATH \?\? '';/);
  // both images are resolved through the base path, never root-absolute
  assert.match(splash, /src=\{`\$\{BASE_PATH\}\/brand\/splash\/mark\.jpg`\}/);
  assert.match(splash, /src=\{`\$\{BASE_PATH\}\/brand\/splash\/wordmark\.jpg`\}/);
  assert.doesNotMatch(splash, /src="\/brand\/splash\//, 'root-absolute splash paths 404 under /cineflow');
  // the intrinsic artwork aspect is preserved (420x426 and 620x155)
  assert.match(splash, /width=\{135\} height=\{137\}/);
  assert.match(splash, /width=\{215\} height=\{54\}/);
});

test('browser splash behaviour is untouched (timing, session gate, markup)', () => {
  const splash = read('components/brand/SplashScreen.tsx');
  assert.match(splash, /autoDismissMs = 1900/);
  assert.match(splash, /autoDismissMs \+ 350/);
  assert.match(splash, /sessionStorage\.getItem\('cineflow_splash_shown'\)/);
  assert.match(splash, /sessionStorage\.setItem\('cineflow_splash_shown', 'true'\)/);
  assert.match(splash, /cfs-root cfs-a6 cfs-go/);
  assert.match(splash, /data-splash="cineflow"/);
});

test('the reference design has no progress bar and keeps its film strips', () => {
  const splash = read('components/brand/SplashScreen.tsx');
  const css = read('app/globals.css');
  assert.doesNotMatch(splash, /className="cfs-pb|class="pb"|progress/i, 'no progress bar may be added');
  assert.match(splash, /cfs-fs cfs-f1/);
  assert.match(splash, /cfs-fs cfs-f2/);
  assert.match(css, /linear-gradient\(160deg,\s*#f5f7ff,\s*#ede8ff\)/i);
  assert.match(css, /\.cfs-fs\{[^}]*#141a4a/i);
  assert.match(css, /repeating-linear-gradient\(90deg,\s*#eef0ff/i);
  assert.match(css, /prefers-reduced-motion/);
});
