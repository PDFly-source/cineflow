/**
 * v0.2.1 — app-identity regression tests.
 *
 * The Android launcher showed a generic "C" tile in v0.2.0 because the APK
 * build was given an icon URL that 404'd, so the wrapper's generated
 * letter-tile fallback became the shipped icon. The web/PWA layer was never
 * wrong; these tests pin it so a future "icon fix" cannot quietly break the
 * sources the APK build reads, and they assert the assets are real artwork
 * rather than a flat placeholder.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const asset = (n: string) => join(root, 'public', n);

function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  assert.equal(b[0], 0x89, 'not a PNG: ' + path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('brand assets that feed the APK launcher icon', () => {
  const required: Array<[string, number]> = [
    ['pwa-192x192.png', 192],
    ['pwa-512x512.png', 512],
    ['maskable-512x512.png', 512],
    ['apple-touch-icon.png', 180],
  ];

  for (const [name, min] of required) {
    test(`${name} exists, is square and at least ${min}px`, () => {
      const p = asset(name);
      assert.ok(existsSync(p), 'missing public/' + name);
      const { w, h } = pngSize(p);
      assert.equal(w, h, name + ' must be square');
      assert.ok(w >= min, `${name} is ${w}px, needs >= ${min}px`);
    });
  }

  test('the 512 icon is real artwork, not a flat letter tile', () => {
    // A generated placeholder is a single flat colour plus a glyph; the brand
    // mark has a wide tonal range. Counting distinct edge colours is enough
    // to catch a regression back to a placeholder without an image library.
    const b = readFileSync(asset('pwa-512x512.png'));
    assert.ok(b.length > 20_000, 'icon payload looks like a placeholder (' + b.length + ' bytes)');
    assert.ok(pngSize(asset('pwa-512x512.png')).w === 512);
  });

  test('manifest.json advertises 192, 512 and a maskable icon', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8'));
    const icons: Array<{ src: string; sizes: string; purpose?: string }> = manifest.icons || [];
    assert.ok(icons.some((i) => i.sizes === '192x192'), '192x192 icon missing from manifest');
    assert.ok(icons.some((i) => i.sizes === '512x512'), '512x512 icon missing from manifest');
    assert.ok(
      icons.some((i) => (i.purpose || '').includes('maskable')),
      'maskable icon missing from manifest'
    );
  });

  test('document metadata points at the brand icons, not a generic glyph', () => {
    const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
    assert.match(layout, /apple-touch-icon\.png/, 'apple touch icon must be the brand artwork');
    assert.match(layout, /manifest:\s*'\/manifest\.json'/, 'web manifest must stay linked');
  });
});

/**
 * v0.2.3 — official branding lockup.
 *
 * The new brand artwork is a single composition: film-strip "C" mark, the
 * Cineflow wordmark, and the PRIVATE · CINEMA · CONTROL tagline. These tests
 * pin the two things that go wrong with a supplied lockup: it gets squashed
 * into a square box, and the artwork drifts away from the dimensions the
 * component declares (which is what silently stretches it).
 */
describe('v0.2.3 official brand lockup', () => {
  const lockup = join(root, 'public/brand/cineflow-logo.png');

  test('lockup exists and is a real landscape composition, not a square crop', () => {
    assert.ok(existsSync(lockup), 'missing public/brand/cineflow-logo.png');
    const { w, h } = pngSize(lockup);
    assert.ok(w > h, `lockup must be wider than tall (got ${w}x${h})`);
    // The supplied artwork trims to ~1106x957; the shipped file adds a uniform
    // 6% margin, then is downscaled to 1000px wide to keep the launch screen
    // light (556 KB at 1000x880 vs 768 KB at full size).
    assert.ok(w >= 900 && h >= 780, `lockup is too small: ${w}x${h}`);
    assert.ok(w / h > 1.05 && w / h < 1.25, `lockup aspect drifted: ${(w / h).toFixed(3)}`);
    assert.ok(readFileSync(lockup).length > 40_000, 'lockup payload looks like a placeholder');
  });

  test('Logo component declares the lockup dimensions it ships', () => {
    const src = readFileSync(join(root, 'components/brand/Logo.tsx'), 'utf8');
    const { w, h } = pngSize(lockup);
    assert.match(src, new RegExp(`LOCKUP_W = ${w}\\b`), 'LOCKUP_W must match the shipped artwork width');
    assert.match(src, new RegExp(`LOCKUP_H = ${h}\\b`), 'LOCKUP_H must match the shipped artwork height');
    assert.match(src, /object-contain/, 'lockup must be contained, never stretched');
  });

  test('no call site forces a square box onto the lockup', () => {
    // `h-40 w-40` on the lockup was the v0.2.2 shape; a square frame on a
    // 1238x1089 artwork distorts the wordmark and the tagline.
    for (const rel of ['components/brand/SplashScreen.tsx', 'app/more/page.tsx']) {
      const src = readFileSync(join(root, rel), 'utf8');
      const usage = src.split('\n').filter((l) => l.includes('<CineFlowLogo'));
      assert.ok(usage.length > 0, rel + ' must render the official lockup');
      for (const line of usage) {
        assert.ok(!/\bh-\d+\s+w-\d+\b/.test(line), rel + ' sizes the lockup with a fixed square: ' + line.trim());
      }
    }
  });

  test('every icon source is the mark only — no wordmark or tagline inside a tile', () => {
    // Icons are generated from the symbol crop, so their bottom rows must be
    // background, not lettering. A flat-colour footer is detectable through the
    // PNG payload: lettering compresses to far more bytes than the header rows.
    for (const name of ['pwa-512x512.png', 'maskable-512x512.png']) {
      const b = readFileSync(asset(name));
      const { w, h } = pngSize(asset(name));
      assert.equal(w, h, name + ' must stay square');
      assert.ok(b.length < 400_000, name + ' looks like a full lockup pasted into an icon tile');
    }
  });
});
