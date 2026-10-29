/**
 * Fix 3 regression tests — Subtitle Studio must never hide player navigation,
 * must have no X close button, and must keep a reliable dismissal path.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const modal = readFileSync(path.join(root, 'components/player/SubtitlesModal.tsx'), 'utf8');
const player = readFileSync(path.join(root, 'components/player/VideoPlayer.tsx'), 'utf8');

describe('Subtitle Studio markup contract', () => {
  test('the X close button is gone (no Close button, no X icon import)', () => {
    assert.doesNotMatch(modal, /aria-label="Close"/, 'no generic close (X) button');
    assert.doesNotMatch(modal, /<X\s/, 'no X icon element rendered');
    assert.doesNotMatch(modal, /import \{[^}]*\bX\b[^}]*\} from 'lucide-react'/, 'X icon not imported');
  });

  test('a discoverable Done affordance replaces the X', () => {
    assert.match(modal, /Done/, 'explicit Done button');
    assert.match(modal, /data-testid="subtitle-studio-panel"/, 'panel is addressable for tests/a11y');
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-label="Subtitle Studio"/);
  });

  test('the panel is docked, not a full-screen veil over the controls', () => {
    assert.doesNotMatch(modal, /fixed inset-0[^"]*bg-black\/80/, 'no opaque full-screen scrim');
    assert.match(modal, /bottom-\[88px\]/, 'panel and click-catcher stop above the control strip');
    assert.match(modal, /data-testid="subtitle-studio-backdrop"/);
  });

  test('Reset touches subtitle settings only and never closes the panel', () => {
    const resetBody = modal.slice(modal.indexOf('const handleResetSettings'), modal.indexOf('// Subtitle styling mappings'));
    assert.match(resetBody, /updateSettings\(/, 'reset updates subtitle settings');
    assert.doesNotMatch(resetBody, /onClose\(/, 'reset must not close the studio');
  });

  test('Escape and Android back both dismiss the studio; focus is restored', () => {
    assert.match(modal, /e\.key === 'Escape'/, 'Escape closes');
    assert.match(modal, /addEventListener\('popstate'/, 'back button closes');
    assert.match(modal, /previouslyFocused\?\.focus/, 'focus returns to the CC button');
  });

  test('taps inside the panel never reach the player surface', () => {
    assert.match(modal, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/, 'inner clicks stopped');
  });
});

describe('player keeps navigation alive while the studio is open', () => {
  test('controls are forced visible while the studio is open', () => {
    assert.match(
      player,
      /const isControlsEffectivelyVisible = controlsVisible \|\| !isPlaying \|\| showSubtitlesModal;/,
      'studio open pins the controls'
    );
  });

  test('auto-hide is suspended while the studio is open', () => {
    assert.match(player, /if \(isPlaying && !showSubtitlesModal\)/, 'timer does not hide controls under the panel');
    assert.match(player, /\[isPlaying, settings\.autoHideDelay, showSubtitlesModal\]/, 'effect re-runs on studio state');
  });

  test('the CC chip toggles the studio open and closed', () => {
    const ccHandler = player.slice(player.indexOf('onOpenSubtitles={() => {'), player.indexOf('onOpenSubtitles={() => {') + 160);
    assert.match(ccHandler, /setShowSubtitlesModal\(\(prev\) => !prev\)/, 'second tap closes');
    assert.match(ccHandler, /setControlsVisible\(true\)/, 'opening restores controls');
  });
});
