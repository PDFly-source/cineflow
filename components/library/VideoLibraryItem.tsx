'use client';

import React from 'react';
import { Play, Star, MoreVertical, Film } from 'lucide-react';
import type { PlaybackRecord } from '@/lib/storage/db';
import { getRecordTitle } from '@/lib/library/filters';
import { formatTime, formatFileSize, formatDate, formatVideoTitle } from '@/lib/utils/formatters';

export interface VideoLibraryItemProps {
  record: PlaybackRecord;
  /** Invoked when the row body is activated (opens the file picker to resume/replay). */
  onOpen: (record: PlaybackRecord) => void;
  /** Invoked for the 3-dot overflow menu. */
  onOpenMenu: (record: PlaybackRecord) => void;
  /** Invoked when the favorite star is toggled. */
  onToggleFavorite: (record: PlaybackRecord) => void;
}

/**
 * Reusable Library row for a playback record.
 * Local metadata only - CineFlow never stores video files, so opening a
 * record re-selects the file from the device.
 */
export const VideoLibraryItem: React.FC<VideoLibraryItemProps> = ({
  record,
  onOpen,
  onOpenMenu,
  onToggleFavorite,
}) => {
  const title = getRecordTitle(record);

  return (
    <div
      onClick={() => onOpen(record)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(record);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${title}`}
      className="flex items-center justify-between p-3.5 hover:bg-[var(--ss)] transition cursor-pointer focus:outline-none focus-visible:bg-[var(--ss)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="tile">
          {record.completed ? <Film className="w-4 h-4 text-[var(--cy)]" /> : <Play className="w-4 h-4 text-[var(--cy)]" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {formatVideoTitle(title)}
            {record.hidden === true && <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--t3)]">Hidden</span>}
          </p>
          <div
            className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-[var(--t3)]"
            aria-label={`Duration ${formatTime(record.duration)}, size ${formatFileSize(record.fileSize)}, last played ${formatDate(record.lastPlayedAt)}`}
          >
            <span className="text-[var(--t2)] font-semibold">{formatTime(record.duration)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatFileSize(record.fileSize)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(record.lastPlayedAt)}</span>
            {record.mediaInfo?.width ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="hidden min-[380px]:inline">{record.mediaInfo.width}×{record.mediaInfo.height}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="hidden min-[340px]:inline font-mono text-xs text-[var(--cy)] font-semibold tabular-nums">{record.progressPercent}%</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(record);
          }}
          aria-label={record.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          aria-pressed={record.isFavorite === true}
          className="grid h-11 w-11 place-items-center rounded-full text-[var(--t3)] hover:text-[var(--cy)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bv)]"
        >
          <Star className={`w-4 h-4 ${record.isFavorite ? 'fill-[var(--cy)] text-[var(--cy)]' : ''}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(record);
          }}
          aria-label={`More actions for ${title}`}
          className="grid h-11 w-11 place-items-center rounded-full text-[var(--t3)] hover:text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bv)]"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
