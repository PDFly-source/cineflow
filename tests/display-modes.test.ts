/**
 * Phase 2.4 regression tests: MX Player-style display modes and zoom math.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPLAY_MODES,
  CROP_BIAS,
  ZOOM_MIN,
  ZOOM_MAX,
  displayModeToVideoFit,
  videoFitToDisplayMode,
  fitBiasScale,
  clampZoom,
  stepZoom,
  doubleTapZoomTarget,
  clampPan,
  modeBaseBox,
} from '../lib/player/display-modes.ts';

describe('display mode model', () => {
  test('all five modes are defined with labels and distinct UI keys', () => {
    assert.equal(DISPLAY_MODES.length, 5);
    const shorts = DISPLAY_MODES.map((o) => o.short);
    assert.equal(new Set(shorts).size, 5, 'shorts must be unique');
    for (const o of DISPLAY_MODES) {
      assert.ok(o.label && o.desc, `${o.mode} has label and description`);
    }
  });

  test('only Stretch distorts the aspect ratio and is labelled as such', () => {
    const distorting = DISPLAY_MODES.filter((o) => o.distorts);
    assert.deepEqual(distorting.map((o) => o.mode), ['stretch']);
    assert.match(DISPLAY_MODES.find((o) => o.mode === 'stretch')!.label, /distort/i);
  });

  test('mode <-> fit mapping is a lossless cycle', () => {
    for (const o of DISPLAY_MODES) {
      const fit = displayModeToVideoFit(o.mode);
      assert.equal(videoFitToDisplayMode(fit), o.mode, `${o.mode} round-trips`);
    }
  });

  test('Fit, Fill, Crop and Stretch map to distinct element behaviour', () => {
    const fits = ['fit', 'fill', 'crop', 'stretch'].map((m) => displayModeToVideoFit(m as never));
    // Fit shows the entire video (contain); Fill/Crop cover; Stretch fills both axes.
    assert.equal(fits[0], 'contain');
    assert.equal(fits[1], 'cover');
    assert.equal(fits[2], 'crop');
    assert.equal(fits[3], 'fill');
    // Crop differs from Fill by a magnification bias, never by distortion.
    assert.equal(fitBiasScale('crop'), CROP_BIAS);
    assert.equal(fitBiasScale('cover'), 1);
    assert.ok(fitBiasScale('crop') > fitBiasScale('cover'), 'Crop must be visibly closer than Fill');
  });

  test('zoom clamps and steps stay in the usable range', () => {
    assert.equal(clampZoom(0.2), ZOOM_MIN);
    assert.equal(clampZoom(9), ZOOM_MAX);
    assert.equal(stepZoom(1, -1), ZOOM_MIN, 'cannot zoom below fit');
    assert.equal(stepZoom(3, 1), ZOOM_MAX);
    assert.equal(stepZoom(1, 1), 1.25);
  });

  test('double-tap zoom toggle alternates between fit and the configured level', () => {
    assert.equal(doubleTapZoomTarget(1, 2), 2);
    assert.equal(doubleTapZoomTarget(2, 2), 1);
    assert.equal(doubleTapZoomTarget(1.5, 2), 1, 'any zoomed state toggles back to fit');
    // Configured level is clamped into the usable range.
    assert.equal(doubleTapZoomTarget(1, 99), ZOOM_MAX);
  });

  test('modeBaseBox: contain letterboxes, cover/crop/fill fill, original is 1:1', () => {
    const container = { w: 1000, h: 500 };
    // 16:9 video in a 2:1 container:
    const fitBox = modeBaseBox('contain', container, 1600, 900);
    assert.ok(Math.abs(fitBox.w - 888.89) < 0.1 && fitBox.h === 500, 'fit letterboxes width');
    assert.ok(fitBox.w < container.w, 'contain never crops');
    assert.deepEqual(modeBaseBox('cover', container, 1600, 900), { w: 1000, h: 500 }, 'fill covers');
    assert.deepEqual(modeBaseBox('crop', container, 1600, 900), { w: 1000, h: 500 });
    assert.deepEqual(modeBaseBox('fill', container, 1600, 900), { w: 1000, h: 500 });
    // 640x360 video smaller than container: original stays 1:1...
    assert.deepEqual(modeBaseBox('original', container, 640, 360), { w: 640, h: 360 });
    // ...and shrinks only when larger than the viewport.
    const shrunk = modeBaseBox('original', container, 4000, 3000);
    assert.ok(Math.abs(shrunk.w - 666.67) < 0.1 && shrunk.h === 500, 'oversized original shrinks to fit');
  });

  test('clampPan keeps the zoomed content inside the container', () => {
    const container = { w: 400, h: 800 };
    const box = { w: 400, h: 225 }; // letterboxed 16:9
    // At 2x the content is 800 wide -> max pan 200.
    assert.deepEqual(clampPan({ x: 500, y: 0 }, 2, box, container), { x: 200, y: 0 });
    assert.deepEqual(clampPan({ x: -500, y: 0 }, 2, box, container), { x: -200, y: 0 });
    // No overflow in y at 2x (450 < 800): pan y clamps to 0.
    assert.deepEqual(clampPan({ x: 0, y: 300 }, 2, box, container), { x: 0, y: 0 });
    // At zoom 1 no panning at all (video stays centred).
    assert.deepEqual(clampPan({ x: 100, y: 100 }, 1, box, container), { x: 0, y: 0 });
  });
});
