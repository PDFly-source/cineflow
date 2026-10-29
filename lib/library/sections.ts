/**
 * Fix 1 — Shorts vs Videos organisation (Phase 3.0).
 *
 * Classification rule (documented, deterministic, and NOT filename based):
 * a record is a **Short** when its *actual probed duration* is known and is
 * at or below SHORTS_MAX_SECONDS. Everything else — long videos, and any
 * record whose duration could not be read yet — is a **Video**. Unknown
 * duration never silently becomes a Short, because that would show a
 * 40-minute film in the Shorts strip while metadata is still loading.
 *
 * The library already stores `duration` from a real load/probe
 * (lib/storage/db.ts → PlaybackRecord.duration), so no extra media reads
 * are needed and the split is pure and testable.
 */
import type { PlaybackRecord } from '@/lib/storage/db';

/** Maximum duration (seconds) for short-form content. */
export const SHORTS_MAX_SECONDS = 60;

export type LibrarySection = 'shorts' | 'videos';

export interface LibrarySections {
  shorts: PlaybackRecord[];
  videos: PlaybackRecord[];
}

/**
 * Classifies a single record. Only a known, positive duration <= the limit
 * counts as a Short.
 */
export function classifyRecord(record: Pick<PlaybackRecord, 'duration'>): LibrarySection {
  const d = record.duration;
  if (!Number.isFinite(d) || d <= 0) return 'videos';
  return d <= SHORTS_MAX_SECONDS ? 'shorts' : 'videos';
}

/**
 * Splits an already filtered/sorted record list into the two sections.
 * Order inside each section is preserved exactly, so the active sort order
 * and favourites/search filtering keep working untouched.
 */
export function splitLibrarySections(records: PlaybackRecord[]): LibrarySections {
  const shorts: PlaybackRecord[] = [];
  const videos: PlaybackRecord[] = [];
  for (const r of records) {
    if (classifyRecord(r) === 'shorts') shorts.push(r);
    else videos.push(r);
  }
  return { shorts, videos };
}

/** Short, honest section caption (never claims data we do not have). */
export function sectionCaption(section: LibrarySection): string {
  return section === 'shorts'
    ? `Up to ${SHORTS_MAX_SECONDS}s · tap to play`
    : 'Longer videos · tap to play';
}
