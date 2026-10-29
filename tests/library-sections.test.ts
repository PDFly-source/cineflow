/**
 * Fix 1 regression tests — Shorts vs Videos organisation.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORTS_MAX_SECONDS,
  classifyRecord,
  splitLibrarySections,
  sectionCaption,
} from '../lib/library/sections.ts';
import type { PlaybackRecord } from '../lib/storage/db.ts';

const rec = (id: string, duration: number): PlaybackRecord => ({
  id,
  fileName: `${id}.mp4`,
  fileSize: 1000,
  lastModified: 1,
  duration,
  currentTime: 0,
  progressPercent: 0,
  completed: false,
  lastPlayedAt: 0,
});

describe('Shorts vs Videos classification', () => {
  test('a clip at or under the limit is a Short', () => {
    assert.equal(SHORTS_MAX_SECONDS, 60);
    assert.equal(classifyRecord({ duration: 12 }), 'shorts');
    assert.equal(classifyRecord({ duration: 59.9 }), 'shorts');
    assert.equal(classifyRecord({ duration: 60 }), 'shorts');
  });

  test('a longer video is a Video', () => {
    assert.equal(classifyRecord({ duration: 61 }), 'videos');
    assert.equal(classifyRecord({ duration: 3600 }), 'videos');
  });

  test('unknown or invalid duration never becomes a Short', () => {
    assert.equal(classifyRecord({ duration: 0 }), 'videos');
    assert.equal(classifyRecord({ duration: -5 }), 'videos');
    assert.equal(classifyRecord({ duration: Number.NaN }), 'videos');
    assert.equal(classifyRecord({ duration: Number.POSITIVE_INFINITY }), 'videos');
  });

  test('classification ignores filenames containing "shorts"', () => {
    const longTitledShort = { ...rec('a', 600), fileName: 'my-shorts-compilation.mp4' };
    const realShort = { ...rec('b', 15), fileName: 'holiday.mp4' };
    assert.equal(classifyRecord(longTitledShort), 'videos');
    assert.equal(classifyRecord(realShort), 'shorts');
  });

  test('split keeps every record exactly once, in order, with no cross-contamination', () => {
    const list = [rec('s1', 10), rec('v1', 300), rec('s2', 45), rec('v2', 90), rec('u1', 0)];
    const { shorts, videos } = splitLibrarySections(list);
    assert.deepEqual(shorts.map((r) => r.id), ['s1', 's2']);
    assert.deepEqual(videos.map((r) => r.id), ['v1', 'v2', 'u1']);
    assert.equal(shorts.length + videos.length, list.length);
    const ids = [...shorts, ...videos].map((r) => r.id).sort();
    assert.deepEqual(ids, ['s1', 's2', 'u1', 'v1', 'v2']);
  });

  test('empty library and single-item libraries are safe', () => {
    assert.deepEqual(splitLibrarySections([]), { shorts: [], videos: [] });
    assert.deepEqual(splitLibrarySections([rec('only', 20)]).shorts.map((r) => r.id), ['only']);
    assert.deepEqual(splitLibrarySections([rec('only', 200)]).videos.map((r) => r.id), ['only']);
  });

  test('section captions state the rule used, not a guessed count', () => {
    assert.match(sectionCaption('shorts'), /60s/);
    assert.match(sectionCaption('videos'), /Longer videos/);
  });
});
