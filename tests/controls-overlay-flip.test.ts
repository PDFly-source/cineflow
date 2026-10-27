/**
 * Regression tests for Phase 2.2: Flip H / Flip V must be visible toolbar
 * buttons on mobile (not only inside the "Rotate & flip" popover).
 * Uses happy-dom to render the real component and click the real buttons.
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
    onToggleLoop: noop,
    orientation: { rotate: 0, flipH: false, flipV: false } as never,
    onRotateClockwise: noop,
    onRotateCounterClockwise: noop,
    onRotate180: noop,
    onFlipHorizontal: noop,
    onFlipVertical: noop,
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

function toolbarFlipButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button[aria-label="Flip horizontally"], button[aria-label="Flip vertically"]')] as unknown as HTMLButtonElement[];
}

describe('mobile flip toolbar buttons', () => {
  test('Flip H and Flip V render as direct toolbar buttons (not popover-only)', async () => {
    const h = await renderOverlay(makeProps());
    try {
      const btns = toolbarFlipButtons();
      assert.equal(btns.length, 2, 'both flip buttons must exist in the toolbar');
      // They must sit in the top bar tool cluster, above the popover (y < 200 in source order test: popover only renders when opened)
      const chip = [...document.querySelectorAll('button[title="Subtitles & Timing"]')] as unknown as HTMLButtonElement[];
      assert.equal(chip.length, 1);
      const subs = chip[0];
      const all = [...document.querySelectorAll('button')] as unknown as HTMLButtonElement[];
      assert.ok(all.indexOf(subs) < all.indexOf(btns[0]), 'flip buttons come after the subtitles chip in the toolbar');
      assert.ok(all.indexOf(btns[0]) < all.indexOf(btns[1]));
      // not aria-pressed when orientation is clean
      assert.equal(btns[0].getAttribute('aria-pressed'), 'false');
      assert.equal(btns[1].getAttribute('aria-pressed'), 'false');
    } finally { h.unmount(); }
  });

  test('clicking the toolbar buttons fires the flip handlers', async () => {
    let flipsH = 0;
    let flipsV = 0;
    const h = await renderOverlay(makeProps({
      onFlipHorizontal: () => { flipsH += 1; },
      onFlipVertical: () => { flipsV += 1; },
    }));
    try {
      const [bh, bv] = toolbarFlipButtons();
      bh.click();
      bv.click();
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(flipsH, 1, 'Flip H button wired to onFlipHorizontal');
      assert.equal(flipsV, 1, 'Flip V button wired to onFlipVertical');
    } finally { h.unmount(); }
  });

  test('active flips are reflected via aria-pressed on the toolbar buttons', async () => {
    const h = await renderOverlay(makeProps({
      orientation: { rotate: 90, flipH: true, flipV: true },
    }));
    try {
      const [bh, bv] = toolbarFlipButtons();
      assert.equal(bh.getAttribute('aria-pressed'), 'true');
      assert.equal(bv.getAttribute('aria-pressed'), 'true');
    } finally { h.unmount(); }
  });

  test('popover still offers rotate/flip/reset and shares the same state', async () => {
    const h = await renderOverlay(makeProps());
    try {
      const trigger = document.querySelector('button[aria-label="Rotate and flip options"]') as unknown as HTMLButtonElement | null;
      assert.ok(trigger, 'popover trigger still present');
      trigger!.click();
      await new Promise((r) => setTimeout(r, 20));
      const chips = ([...document.querySelectorAll('button[title]')] as unknown as HTMLButtonElement[]).map((b) => b.getAttribute('title'));
      for (const t of ['Rotate clockwise 90°', 'Rotate counter-clockwise 90°', 'Rotate 180°', 'Flip horizontally', 'Flip vertically', 'Reset orientation']) {
        assert.ok(chips.includes(t), `popover still contains "${t}"`);
      }
    } finally { h.unmount(); }
  });

  test('open menus close when the overlay auto-hides so hidden panels cannot swallow taps', async () => {
    const h = await renderOverlay(makeProps());
    try {
      // Open the orientation popover
      const trigger = document.querySelector('button[aria-label="Rotate and flip options"]') as unknown as HTMLButtonElement;
      assert.ok(trigger, 'popover trigger present');
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));
      let chips = [...document.querySelectorAll('button[title="Rotate clockwise 90°"]')] as unknown as HTMLButtonElement[];
      assert.ok(chips.length > 0, 'popover chips render while overlay visible');

      // Simulate auto-hide: re-render with isVisible=false and wait for the effect
      h.root.render(React.createElement(ControlsOverlay, makeProps({ isVisible: false })));
      for (let i = 0; i < 100 && chips.length > 0; i++) {
        await new Promise((r) => setTimeout(r, 20));
        chips = [...document.querySelectorAll('button[title="Rotate clockwise 90°"]')] as unknown as HTMLButtonElement[];
      }
      assert.equal(chips.length, 0, 'popover must close when controls hide');

      // And it must stay closed when controls return
      h.root.render(React.createElement(ControlsOverlay, makeProps({ isVisible: true })));
      await new Promise((r) => setTimeout(r, 150));
      chips = [...document.querySelectorAll('button[title="Rotate clockwise 90°"]')] as unknown as HTMLButtonElement[];
      assert.equal(chips.length, 0, 'popover must not reappear on its own');
    } finally { h.unmount(); }
  });

  test('control bars are non-interactive while the overlay is hidden (auto-hide tap-restore)', async () => {
    // While hidden, taps must fall through to the gesture surface instead of
    // hitting invisible bar buttons (which caused mystery pauses/seeks).
    const visible = await renderOverlay(makeProps());
    try {
      const topBar = [...document.querySelectorAll('div')].find((d) => (d.className || '').includes('justify-between') && (d.className || '').includes('flex-wrap')) as unknown as HTMLElement;
      assert.ok(topBar, 'top bar present');
      assert.match(topBar.className, /pointer-events-auto/, 'top bar interactive while visible');
    } finally { visible.unmount(); }
    const hidden = await renderOverlay(makeProps({ isVisible: false }));
    try {
      const bars = [...document.querySelectorAll('div.pointer-events-none')].filter((d) => (d.className || '').includes('justify-between') || (d.className || '').includes('flex-col gap-3'));
      const barsAll = [...document.querySelectorAll('div')].filter((d) => (d.className || '').includes('pointer-events-none'));
      assert.ok(barsAll.length >= 4, 'root + all three bars must be pointer-events-none when hidden');
      const interactiveBars = [...document.querySelectorAll('div')].filter((d) => (d.className || '').includes('pointer-events-auto'));
      assert.equal(interactiveBars.length, 0, 'no bar may stay interactive while overlay hidden');
      assert.ok(bars.length >= 2, 'top and bottom bars present and non-interactive');
    } finally { hidden.unmount(); }
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
