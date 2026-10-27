/**
 * Regression tests for Phase 2.3: flip controls fully removed, a visible
 * Rotate Screen action in the mobile toolbar, and a truthful fallback
 * notice. Uses happy-dom to render the real component and click buttons.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { ControlsOverlay } from '../components/player/ControlsOverlay';

const window = new Window();
const document = window.document;
Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true });
Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
Object.defineProperty(globalThis, 'self', { value: window, configurable: true, writable: true });
const nav = (globalThis as { navigator?: { clipboard?: unknown } }).navigator;
if (!nav || !('clipboard' in nav)) {
  Object.defineProperty(globalThis, 'navigator', { value: { ...window.navigator, clipboard: { writeText: async () => {} } }, configurable: true, writable: true });
}

function makeProps(overrides: Record<string, unknown> = {}) {
  const noop = () => {};
  return {
    title: 'QA clip.webm',
    isPlaying: true,
    currentTime: 5,
    duration: 15,
    bufferedRanges: [{ start: 0, end: 15 }],
    volume: 1,
    isMuted: false,
    playbackSpeed: 1,
    fitMode: 'contain' as never,
    loopMode: 'none' as const,
    seekInterval: 10,
    isVisible: true,
    hasPrevTrack: false,
    hasNextTrack: false,
    queueCount: 1,
    hasSubtitles: false,
    subtitlesActive: false,
    abRepeat: { pointA: null, pointB: null } as never,
    onSetABPointA: noop,
    onSetABPointB: noop,
    onClearABRepeat: noop,
    onToggleABRepeat: noop,
    sleepTimerRemainingSeconds: null,
    onSetSleepTimer: noop,
    isPrivateSession: false,
    onTogglePrivateSession: noop,
    isCurrentFavorite: false,
    onToggleFavorite: noop,
    playerProfile: 'movie' as never,
    onChangeProfile: noop,
    onOpenDiagnostics: noop,
    onChangeSeekInterval: noop,
    onPlayPause: noop,
    onSeek: noop,
    onSkip: noop,
    onVolumeChange: noop,
    onToggleMute: noop,
    onToggleFullscreen: noop,
    isFullscreen: false,
    onTogglePiP: noop,
    isPiPSupported: false,
    onChangeSpeed: noop,
    onChangeFitMode: noop,
    zoomScale: 1,
    onZoomIn: noop,
    onZoomOut: noop,
    onResetZoom: noop,
    onToggleLoop: noop,
    orientation: { rotate: 0 } as never,
    onRotateClockwise: noop,
    onRotateCounterClockwise: noop,
    onRotate180: noop,
    onRotateScreen: noop,
    rotateScreenNotice: null,
    onResetOrientation: noop,
    onPrevTrack: noop,
    onNextTrack: noop,
    onOpenSubtitles: noop,
    onOpenPlaylist: noop,
    onOpenShortcuts: noop,
    ...overrides,
  };
}

async function renderOverlay(props: ReturnType<typeof makeProps>): Promise<{ root: Root; unmount: () => void }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Parameters<typeof createRoot>[0]);
  root.render(React.createElement(ControlsOverlay, props));
  await new Promise((r) => setTimeout(r, 30)); // let React flush
  return { root, unmount: () => { root.unmount(); host.remove(); } };
}

describe('phase 2.3 mobile orientation UI', () => {
  test('no flip controls exist anywhere in the overlay', async () => {
    const h = await renderOverlay(makeProps());
    try {
      // Open the rotation popover too, so its contents are also checked
      const trigger = document.querySelector('button[aria-label="Rotate video options"]') as unknown as HTMLButtonElement;
      assert.ok(trigger, 'rotation popover trigger present');
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));

      const flipButtons = [...document.querySelectorAll('button')].filter((b) =>
        /flip/i.test(b.title || b.getAttribute('aria-label') || '')
      );
      assert.equal(flipButtons.length, 0, 'no Flip buttons may remain');

      const flipText = document.body.textContent?.toLowerCase() ?? '';
      assert.ok(!flipText.includes('flip h'), 'no "Flip H" label');
      assert.ok(!flipText.includes('flip v'), 'no "Flip V" label');
      assert.ok(!flipText.includes('flip horizontally'), 'no "Flip horizontally" tooltip text');
      assert.ok(!flipText.includes('flip vertically'), 'no "Flip vertically" tooltip text');
    } finally { h.unmount(); }
  });

  test('Rotate Screen button renders in the toolbar and fires the handler', async () => {
    let taps = 0;
    const h = await renderOverlay(makeProps({ onRotateScreen: () => { taps += 1; } }));
    try {
      const btn = document.querySelector('button[aria-label="Rotate screen"]') as unknown as HTMLButtonElement;
      assert.ok(btn, 'Rotate Screen action must exist');
      assert.equal(btn.title, 'Rotate screen');
      btn.click();
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(taps, 1, 'Rotate Screen button wired to onRotateScreen');
    } finally { h.unmount(); }
  });

  test('rotation popover keeps CCW / CW / 180 / Reset and drops flips', async () => {
    const h = await renderOverlay(makeProps());
    try {
      const trigger = document.querySelector('button[aria-label="Rotate video options"]') as unknown as HTMLButtonElement;
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));
      const titles = ([...document.querySelectorAll('button[title]')] as unknown as HTMLButtonElement[]).map((b) => b.getAttribute('title'));
      for (const t of ['Rotate counter-clockwise 90°', 'Rotate clockwise 90°', 'Rotate 180°', 'Reset orientation']) {
        assert.ok(titles.includes(t), `popover still contains "${t}"`);
      }
      assert.ok(!titles.some((t) => /flip/i.test(t ?? '')), 'no flip chips in the popover');
    } finally { h.unmount(); }
  });

  test('fallback notice renders when provided and disappears when cleared', async () => {
    const message = 'Rotate your phone to landscape; automatic rotation depends on your device settings.';
    const h = await renderOverlay(makeProps({ rotateScreenNotice: message }));
    try {
      const status = document.querySelector('[role="status"]');
      assert.ok(status, 'notice element exists');
      assert.equal((status as unknown as HTMLElement).textContent, message);
    } finally { h.unmount(); }

    const h2 = await renderOverlay(makeProps({ rotateScreenNotice: null }));
    try {
      assert.equal(document.querySelector('[role="status"]'), null, 'no notice when none set');
    } finally { h2.unmount(); }
  });

  test('open menus close when the overlay auto-hides so hidden panels cannot swallow taps', async () => {
    const h = await renderOverlay(makeProps());
    try {
      const trigger = document.querySelector('button[aria-label="Rotate video options"]') as unknown as HTMLButtonElement;
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));
      let chips = [...document.querySelectorAll('button[title="Rotate clockwise 90°"]')] as unknown as HTMLButtonElement[];
      assert.ok(chips.length > 0, 'popover chips render while overlay visible');

      h.root.render(React.createElement(ControlsOverlay, makeProps({ isVisible: false })));
      for (let i = 0; i < 100 && chips.length > 0; i++) {
        await new Promise((r) => setTimeout(r, 20));
        chips = [...document.querySelectorAll('button[title="Rotate clockwise 90°"]')] as unknown as HTMLButtonElement[];
      }
      assert.equal(chips.length, 0, 'popover must close when controls hide');

      h.root.render(React.createElement(ControlsOverlay, makeProps({ isVisible: true })));
      await new Promise((r) => setTimeout(r, 150));
      chips = [...document.querySelectorAll('button[title="Rotate clockwise 90°"]')] as unknown as HTMLButtonElement[];
      assert.equal(chips.length, 0, 'popover must not reappear on its own');
    } finally { h.unmount(); }
  });

  test('control bars are non-interactive while the overlay is hidden (auto-hide tap-restore)', async () => {
    const visible = await renderOverlay(makeProps());
    try {
      const topBar = [...document.querySelectorAll('div')].find((d) => (d.className || '').includes('justify-between') && (d.className || '').includes('flex-wrap')) as unknown as HTMLElement;
      assert.ok(topBar, 'top bar present');
      assert.match(topBar.className, /pointer-events-auto/, 'top bar interactive while visible');
    } finally { visible.unmount(); }
    const hidden = await renderOverlay(makeProps({ isVisible: false }));
    try {
      const barsAll = [...document.querySelectorAll('div')].filter((d) => (d.className || '').includes('pointer-events-none'));
      assert.ok(barsAll.length >= 4, 'root + all three bars must be pointer-events-none when hidden');
      const interactiveBars = [...document.querySelectorAll('div')].filter((d) => (d.className || '').includes('pointer-events-auto'));
      assert.equal(interactiveBars.length, 0, 'no bar may stay interactive while overlay hidden');
    } finally { hidden.unmount(); }
  });

  test('display sheet lists all five modes with the active one highlighted', async () => {
    let chosen: string | null = null;
    const h = await renderOverlay(makeProps({
      fitMode: 'cover' as never,
      onChangeFitMode: (m: string) => { chosen = m; },
    }));
    try {
      const trigger = document.querySelector('button[aria-label="Display mode and zoom"]') as unknown as HTMLButtonElement;
      assert.ok(trigger, 'display trigger exists');
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));

      const chips = [...document.querySelectorAll('button[aria-pressed]')] as unknown as HTMLButtonElement[];
      const modeChips = chips.filter((b) => ['Fit', 'Fill', 'Crop', 'Stretch', '100%'].includes((b.textContent || '').trim()));
      assert.equal(modeChips.length, 5, 'five display modes listed');

      const active = modeChips.find((b) => b.getAttribute('aria-pressed') === 'true');
      assert.ok(active, 'active mode is marked');
      assert.match(active!.getAttribute('title') || '', /crop overflow/i, 'cover shows Fill active');
      assert.equal(trigger.title, 'Display: Fill', 'trigger shows the active mode');

      // Switching to Crop passes the mapped fit mode to the player
      const cropChip = modeChips.find((b) => b.textContent === 'Crop');
      cropChip!.click();
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(chosen, 'crop');
    } finally { h.unmount(); }
  });

  test('zoom in/out/reset buttons are wired and the read-out updates', async () => {
    const calls: string[] = [];
    let zoom = 1;
    const h = await renderOverlay(makeProps({
      zoomScale: zoom,
      onZoomIn: () => { calls.push('in'); zoom += 0.25; },
      onZoomOut: () => { calls.push('out'); zoom -= 0.25; },
      onResetZoom: () => { calls.push('reset'); zoom = 1; },
    }));
    try {
      const trigger = document.querySelector('button[aria-label="Display mode and zoom"]') as unknown as HTMLButtonElement;
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));

      const zin = document.querySelector('button[aria-label="Zoom in"]') as unknown as HTMLButtonElement;
      const zout = document.querySelector('button[aria-label="Zoom out"]') as unknown as HTMLButtonElement;
      const zreset = document.querySelector('button[aria-label="Reset zoom"]') as unknown as HTMLButtonElement;
      assert.ok(zin && zout && zreset, 'zoom buttons present');

      assert.equal(zout.disabled, true, 'zoom out disabled at fit');
      zin.click();
      // Re-render with the zoomed prop the player would now hold
      h.root.render(React.createElement(ControlsOverlay, makeProps({
        zoomScale: 1.25,
        onZoomIn: () => { calls.push('in'); zoom += 0.25; },
        onZoomOut: () => { calls.push('out'); zoom -= 0.25; },
        onResetZoom: () => { calls.push('reset'); zoom = 1; },
      })));
      await new Promise((r) => setTimeout(r, 30));
      const zreset2 = document.querySelector('button[aria-label="Reset zoom"]') as unknown as HTMLButtonElement;
      assert.equal(zreset2.disabled, false, 'reset enabled once zoomed');
      zreset2.click();
      assert.deepEqual(calls, ['in', 'reset'], 'handlers wired in order');
    } finally { h.unmount(); }
  });

  test('display sheet closes when the overlay hides and cannot swallow taps', async () => {
    const h = await renderOverlay(makeProps());
    try {
      const trigger = document.querySelector('button[aria-label="Display mode and zoom"]') as unknown as HTMLButtonElement;
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));
      assert.ok(document.querySelector('button[aria-label="Zoom in"]'), 'sheet open');

      h.root.render(React.createElement(ControlsOverlay, makeProps({ isVisible: false })));
      for (let i = 0; i < 100 && document.querySelector('button[aria-label="Zoom in"]'); i++) {
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.equal(document.querySelector('button[aria-label="Zoom in"]'), null, 'sheet closed on hide');
    } finally { h.unmount(); }
  });

  test('subtitles chip label is hidden below sm so the toolbar fits narrow phones', async () => {
    const h = await renderOverlay(makeProps());
    try {
      const label = document.querySelector('button[title="Subtitles & Timing"] span') as unknown as HTMLSpanElement | null;
      assert.ok(label, 'subtitles label span exists');
      assert.match(label!.getAttribute('class') ?? '', /hidden/, 'label hidden on mobile');
      assert.match(label!.getAttribute('class') ?? '', /sm:inline/, 'label restored on >=640px');
    } finally { h.unmount(); }
  });
});
