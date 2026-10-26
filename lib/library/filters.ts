import type { PlaybackRecord } from '@/lib/storage/db';

export type LibraryTab = 'recent' | 'favorites' | 'playlists' | 'sort';
export type LibrarySortOrder = 'recent' | 'name' | 'duration';

export interface LibraryFilterOptions {
  /** Active filter tab. 'favorites' shows only favorite records. */
  tab?: LibraryTab;
  /** Case-insensitive substring match against the display name (or file name). */
  searchQuery?: string;
  /** Sort order applied after filtering. */
  sortOrder?: LibrarySortOrder;
  /** When false (default), records marked hidden are excluded. */
  includeHidden?: boolean;
}

/** Returns the user-facing title for a record: explicit display name or file name. */
export function getRecordTitle(
  record: Pick<PlaybackRecord, 'fileName'> & Partial<Pick<PlaybackRecord, 'displayName'>>
): string {
  const dn = record.displayName?.trim();
  return dn ? dn : record.fileName;
}

/**
 * Pure, side-effect-free library filtering used by the Library page.
 * Kept as a pure function so it can be unit-tested without IndexedDB.
 */
export function filterLibraryRecords(
  records: PlaybackRecord[],
  options: LibraryFilterOptions = {}
): PlaybackRecord[] {
  const { tab = 'recent', searchQuery = '', sortOrder = 'recent', includeHidden = false } = options;

  const query = searchQuery.trim().toLowerCase();

  const filtered = records.filter((r) => {
    if (!includeHidden && r.hidden === true) return false;
    if (tab === 'favorites' && r.isFavorite !== true) return false;
    if (query) {
      const haystack = `${getRecordTitle(r)} ${r.fileName}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (sortOrder === 'name') return getRecordTitle(a).localeCompare(getRecordTitle(b));
    if (sortOrder === 'duration') return b.duration - a.duration;
    return b.lastPlayedAt - a.lastPlayedAt;
  });
}
