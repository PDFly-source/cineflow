import type { PlaybackRecord, PlaylistRecord } from '@/lib/storage/db';

export interface PlaylistItemRefLite {
  name: string;
  size: number;
  lastModified: number;
  duration?: number;
}

/**
 * Appends a playback record to a playlist copy.
 * Returns null when the record is already in the playlist (no duplicates).
 */
export function withRecordAdded(
  playlist: PlaylistRecord,
  record: PlaybackRecord
): PlaylistRecord | null {
  const already = playlist.items.some(
    (it) => it.name === record.fileName && it.size === record.fileSize && it.lastModified === record.lastModified
  );
  if (already) return null;
  return {
    ...playlist,
    items: [
      ...playlist.items,
      { name: record.fileName, size: record.fileSize, lastModified: record.lastModified, duration: record.duration },
    ],
    updatedAt: Date.now(),
  };
}

/** Builds a new playlist record containing exactly one item. */
export function buildNewPlaylist(name: string, record: PlaybackRecord): PlaylistRecord {
  const now = Date.now();
  return {
    id: `pl_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    items: [
      { name: record.fileName, size: record.fileSize, lastModified: record.lastModified, duration: record.duration },
    ],
  };
}

/** Renames a playlist record copy (used by playlist rename). */
export function renamePlaylist(playlist: PlaylistRecord, name: string): PlaylistRecord {
  const trimmed = name.trim().slice(0, 120);
  return { ...playlist, name: trimmed, updatedAt: Date.now() };
}
