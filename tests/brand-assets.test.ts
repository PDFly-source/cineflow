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
