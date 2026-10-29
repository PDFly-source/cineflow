/**
 * Player chrome contract (v0.2.2).
 *
 * The player was re-laid out to match the reference player: title + back on top,
 * a Restore affordance above the centre cluster, timestamps flanking the
 * scrubber, and rotation in the bottom icon bar. These assertions pin the
 * structure so a restyle cannot silently drop the rotation entry point or
 * reintroduce duplicated timestamps.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'components/player/ControlsOverlay.tsx'), 'utf8');

describe('player chrome layout', () => {
  test('timestamps flank the scrubber exactly once', () => {
    assert.equal((src.match(/data-testid="player-current-time"/g) || []).length, 1);
    assert.equal((src.match(/data-testid="player-duration"/g) || []).length, 1);
    // the old "/" joined pair must be gone, not merely hidden
    assert.ok(!src.includes('{formatTime(currentTime)}</span>\n            <span className="text-[var(--t3)] mx-1">/</span>'),
      'duplicate slash-joined timestamp row still present');
  });

  test('a Restore control resets framing without touching playback', () => {
    const block = src.slice(src.indexOf('data-testid="player-restore"') - 700, src.indexOf('data-testid="player-restore"'));
    assert.match(block, /onResetZoom\(\)/, 'Restore must reset zoom');
    assert.match(block, /onResetOrientation\(\)/, 'Restore must reset orientation');
    assert.ok(!/onPlayPause|onSeek\(/.test(block), 'Restore must not pause or seek');
  });

  test('rotation is reachable from the bottom icon bar', () => {
    assert.match(src, /data-testid="player-rotate-screen"/, 'rotate-screen button missing');
    const block = src.slice(src.indexOf('data-testid="player-rotate-screen"') - 400, src.indexOf('data-testid="player-rotate-screen"'));
    assert.match(block, /onClick=\{onRotateScreen\}/, 'rotation button must call the real handler');
  });

  test('aspect ratio cycles through every supported fit mode', () => {
    assert.match(src, /data-testid="player-aspect"/);
    const order = src.match(/'contain', 'cover', 'fill', 'original', 'crop'/);
    assert.ok(order, 'fit-mode cycle missing or incomplete');
  });

  test('the centre cluster keeps skip, play and skip', () => {
    for (const label of ['Skip backward', 'Skip forward']) {
      assert.ok(src.includes(`aria-label={\`${label} \${seekInterval} seconds\`}`.replace('`', '`')) || src.includes(label), label + ' missing');
    }
    assert.ok(src.includes("aria-label={isPlaying ? 'Pause' : 'Play'}"), 'play/pause missing');
  });
});
