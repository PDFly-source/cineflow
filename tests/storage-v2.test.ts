import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  DB_NAME,
  savePlaybackRecord,
  getPlaybackRecord,
  getAllPlaybackRecords,
  updatePlaybackRecordFields,
  renamePlaybackRecord,
  setHiddenRecord,
  getHiddenRecords,
  getVisibleRecords,
  cacheMediaInfo,
  deletePlaybackRecord,
  type PlaybackRecord,
} from '../lib/storage/db.ts';

function makeRecord(overrides: Partial<PlaybackRecord> & { id: string }): PlaybackRecord {
  return {
    fileName: `${overrides.id}.mp4`,
    fileSize: 1000,
    lastModified: 1,
    duration: 90,
    currentTime: 0,
    progressPercent: 0,
    completed: false,
    lastPlayedAt: Date.now(),
    ...overrides,
  };
}

/** Deletes and re-creates the database to exercise a specific version path. */
async function resetDatabase() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

test('v1 record survives v2 migration without data loss', async () => {
  await resetDatabase();

  // 1) Open at v1: create the database with the OLD version and a v1-shaped record.
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('playback_history')) {
        const store = db.createObjectStore('playback_history', { keyPath: 'id' });
        store.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
        store.createIndex('completed', 'completed', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('playback_history', 'readwrite');
      const v1Record = makeRecord({ id: 'legacy_key', isFavorite: true, lastPlayedAt: 500, currentTime: 33.5 });
      // v1 record deliberately has NO v2 fields.
      tx.objectStore('playback_history').put(v1Record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });

  // 2) Any db.ts call now triggers the v1 -> v2 upgrade (version 2, new indexes).
  const legacy = await getPlaybackRecord('legacy_key');
  assert.ok(legacy, 'v1 record must be readable after migration');
  assert.equal(legacy.isFavorite, true, 'favorite flag preserved');
  assert.equal(legacy.currentTime, 33.5, 'position preserved');
  assert.equal(legacy.displayName, undefined, 'v2 field reads as undefined on legacy record');
  assert.equal(legacy.hidden, undefined);

  // 3) The v2 indexes exist.
  const db2 = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const store = db2.transaction('playback_history').objectStore('playback_history');
  assert.ok(store.indexNames.contains('hidden'), 'hidden index created');
  assert.ok(store.indexNames.contains('isFavorite'), 'isFavorite index created');
  assert.ok(store.indexNames.contains('lastPlayedAt'), 'v1 index preserved');
  db2.close();
});

test('v2 CRUD helpers: rename, hide, cache info, delete', async () => {
  await resetDatabase();

  const rec = makeRecord({ id: 'crud_key', fileName: 'video.mp4' });
  await savePlaybackRecord(rec);

  // Rename: only the local display name changes; fileName untouched.
  const renamed = await renamePlaybackRecord('crud_key', 'My Holiday');
  assert.ok(renamed);
  assert.equal(renamed.displayName, 'My Holiday');
  assert.equal(renamed.fileName, 'video.mp4');
  const fetched = await getPlaybackRecord('crud_key');
  assert.equal(fetched?.displayName, 'My Holiday');

  // Clearing rename resets to undefined.
  await renamePlaybackRecord('crud_key', '   ');
  assert.equal((await getPlaybackRecord('crud_key'))?.displayName, undefined);

  // Hide / unhide.
  await setHiddenRecord('crud_key', true);
  let all = await getAllPlaybackRecords();
  assert.equal(all.filter((r) => r.id === 'crud_key')[0]?.hidden, true);
  const hidden = await getHiddenRecords();
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].id, 'crud_key');
  let visible = await getVisibleRecords();
  assert.equal(visible.length, 0);

  await setHiddenRecord('crud_key', false);
  hidden_all: {
    assert.equal((await getHiddenRecords()).length, 0);
    break hidden_all;
  }
  visible = await getVisibleRecords();
  assert.equal(visible.length, 1);

  // Cache media info (small values only).
  await cacheMediaInfo('crud_key', { width: 1920, height: 1080, aspectRatio: 16 / 9, mimeType: 'video/mp4', container: 'mp4' });
  const withInfo = await getPlaybackRecord('crud_key');
  assert.equal(withInfo?.mediaInfo?.width, 1920);
  assert.equal(withInfo?.mediaInfo?.height, 1080);
  assert.ok(withInfo?.mediaInfo?.capturedAt, 'capture timestamp recorded');

  // Partial field update via generic helper.
  await updatePlaybackRecordFields('crud_key', { isFavorite: true });
  assert.equal((await getPlaybackRecord('crud_key'))?.isFavorite, true);

  // Update on unknown key returns null, creates nothing.
  const missing = await updatePlaybackRecordFields('nope', { hidden: true });
  assert.equal(missing, null);
  assert.equal((await getAllPlaybackRecords()).length, 1);

  // Delete.
  await deletePlaybackRecord('crud_key');
  assert.equal(await getPlaybackRecord('crud_key'), null);
});
