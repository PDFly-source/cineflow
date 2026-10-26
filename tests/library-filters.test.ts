import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLibraryRecords, getRecordTitle } from '../lib/library/filters.ts';
import type { PlaybackRecord } from '../lib/storage/db.ts';

function makeRecord(overrides: Partial<PlaybackRecord> & { id: string }): PlaybackRecord {
  return {
    fileName: `${overrides.id}.mp4`,
    fileSize: 1000,
    lastModified: 1,
    duration: 60,
    currentTime: 0,
    progressPercent: 0,
    completed: false,
    lastPlayedAt: Date.now(),
    ...overrides,
  } as PlaybackRecord;
}

test('filterLibraryRecords: favorites tab shows only favorite records', () => {
  const records = [
    makeRecord({ id: 'a', isFavorite: true, lastPlayedAt: 300 }),
    makeRecord({ id: 'b', isFavorite: false, lastPlayedAt: 200 }),
    makeRecord({ id: 'c', isFavorite: true, lastPlayedAt: 100 }),
  ];

  const favorites = filterLibraryRecords(records, { tab: 'favorites' });
  assert.equal(favorites.length, 2);
  assert.ok(favorites.every((r) => r.isFavorite === true));
  assert.ok(favorites.some((r) => r.id === 'a'));
  assert.ok(favorites.some((r) => r.id === 'c'));
});

test('filterLibraryRecords: favorites tab with no favorites returns empty list', () => {
  const records = [
    makeRecord({ id: 'a', isFavorite: false }),
    makeRecord({ id: 'b' }),
  ];
  assert.equal(filterLibraryRecords(records, { tab: 'favorites' }).length, 0);
});

test('filterLibraryRecords: recent tab keeps favorites and non-favorites', () => {
  const records = [
    makeRecord({ id: 'a', isFavorite: true }),
    makeRecord({ id: 'b', isFavorite: false }),
  ];
  assert.equal(filterLibraryRecords(records, { tab: 'recent' }).length, 2);
});

test('filterLibraryRecords: search matches display name or file name case-insensitively', () => {
  const records = [
    makeRecord({ id: 'a', fileName: 'holiday.mp4', displayName: 'Goa Trip' }),
    makeRecord({ id: 'b', fileName: 'HOLIDAY-beach.webm' }),
  ];
  const byDisplay = filterLibraryRecords(records, { searchQuery: 'goa trip' });
  assert.equal(byDisplay.length, 1);
  assert.equal(byDisplay[0].id, 'a');

  const byFile = filterLibraryRecords(records, { searchQuery: 'holiday' });
  assert.equal(byFile.length, 2);
});

test('filterLibraryRecords: sort orders work as specified', () => {
  const records = [
    makeRecord({ id: 'z', fileName: 'alpha.mp4', duration: 10, lastPlayedAt: 1 }),
    makeRecord({ id: 'y', fileName: 'beta.mp4', duration: 120, lastPlayedAt: 3 }),
    makeRecord({ id: 'x', fileName: 'gamma.mp4', duration: 60, lastPlayedAt: 2 }),
  ];

  const byRecent = filterLibraryRecords(records, { sortOrder: 'recent' });
  assert.deepEqual(byRecent.map((r) => r.id), ['y', 'x', 'z']);

  const byName = filterLibraryRecords(records, { sortOrder: 'name' });
  assert.deepEqual(byName.map((r) => r.id), ['z', 'y', 'x']);

  const byDuration = filterLibraryRecords(records, { sortOrder: 'duration' });
  assert.deepEqual(byDuration.map((r) => r.id), ['y', 'x', 'z']);
});

test('filterLibraryRecords: hidden records are excluded by default and included on demand', () => {
  const records = [
    makeRecord({ id: 'a' }),
    makeRecord({ id: 'b', hidden: true }),
  ];
  assert.equal(filterLibraryRecords(records).length, 1);
  assert.equal(filterLibraryRecords(records, { includeHidden: true }).length, 2);
});

test('getRecordTitle: display name wins when set, file name otherwise', () => {
  assert.equal(getRecordTitle({ fileName: 'f.mp4', displayName: 'Custom' }), 'Custom');
  assert.equal(getRecordTitle({ fileName: 'f.mp4', displayName: '   ' }), 'f.mp4');
  assert.equal(getRecordTitle({ fileName: 'f.mp4' }), 'f.mp4');
});
