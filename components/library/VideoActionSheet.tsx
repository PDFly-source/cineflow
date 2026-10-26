'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Music4,
  ArrowRightLeft,
  Share2,
  ListPlus,
  PencilLine,
  EyeOff,
  Info,
  Trash2,
  X,
  Star,
  Check,
} from 'lucide-react';
import type { PlaybackRecord, PlaylistRecord } from '@/lib/storage/db';
import {
  getAllPlaylists,
  savePlaylist,
  renamePlaybackRecord,
  setHiddenRecord,
  updatePlaybackRecordFields,
} from '@/lib/storage/db';
import { getRecordTitle } from '@/lib/library/filters';
import { withRecordAdded, buildNewPlaylist } from '@/lib/library/playlistActions';
import { formatFileSize, formatTime, formatDate } from '@/lib/utils/formatters';

export interface VideoActionSheetProps {
  record: PlaybackRecord;
  onClose: () => void;
  onRecordChanged: (record: PlaybackRecord | null) => void;
  /** Opens the Video-to-MP3 flow for this record. */
  onConvertToMp3: (record: PlaybackRecord) => void;
  /** Opens the file-transfer flow for this record. */
  onTransfer: (record: PlaybackRecord) => void;
}

/**
 * Mobile-first bottom sheet with the record's 3-dot actions.
 * Escape/backdrop dismissal, focus management, safe-area spacing.
 */
export const VideoActionSheet: React.FC<VideoActionSheetProps> = ({
  record,
  onClose,
  onRecordChanged,
  onConvertToMp3,
  onTransfer,
}) => {
  const [panel, setPanel] = useState<'actions' | 'rename' | 'addto' | 'info' | 'delete'>('actions');
  const [renameValue, setRenameValue] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    if (panel === 'addto') {
      getAllPlaylists().then(setPlaylists);
    }
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, panel]);

  const runAndRefresh = async (fn: () => Promise<PlaybackRecord | null>) => {
    const updated = await fn();
    onRecordChanged(updated);
  };

  const handleAddToPlaylist = async (playlist: PlaylistRecord) => {
    const updated = withRecordAdded(playlist, record);
    if (updated) {
      await savePlaylist(updated);
    }
    setAddedTo(playlist.name);
  };

  const handleCreateAndAdd = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const pl: PlaylistRecord = buildNewPlaylist(name, record);
    await savePlaylist(pl);
    setNewPlaylistName('');
    setAddedTo(name);
    setPlaylists(await getAllPlaylists());
  };

  const handleShare = async () => {
    const title = getRecordTitle(record);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'CineFlow',
          text: `I'm watching "${title}" in CineFlow - a private, local-only video player.`,
        });
        return;
      } catch {
        /* user cancelled or share failed; fall through to clipboard */
      }
    }
    const text = `CineFlow - private local video player: ${title}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareNote('Copied to clipboard. (Your browser does not allow sharing the video file itself.)');
      } else {
        setShareNote('Sharing is not supported in this browser.');
      }
    } catch {
      setShareNote('Sharing is not supported in this browser.');
    }
  };

  const actions: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }> = [
    { key: 'mp3', icon: <Music4 className="w-4 h-4" />, label: 'Video to MP3', onClick: () => onConvertToMp3(record) },
    { key: 'transfer', icon: <ArrowRightLeft className="w-4 h-4" />, label: 'File Transfer', onClick: () => onTransfer(record) },
    { key: 'share', icon: <Share2 className="w-4 h-4" />, label: 'Share', onClick: handleShare },
    {
      key: 'addto',
      icon: <ListPlus className="w-4 h-4" />,
      label: 'Add to playlist',
      onClick: () => setPanel('addto'),
    },
    {
      key: 'rename',
      icon: <PencilLine className="w-4 h-4" />,
      label: 'Rename',
      onClick: () => {
        setRenameValue(record.displayName ?? record.fileName);
        setPanel('rename');
      },
    },
    { key: 'hide', icon: <EyeOff className="w-4 h-4" />, label: 'Hide from Library', onClick: () => runAndRefresh(() => setHiddenRecord(record.id, true)) },
    { key: 'info', icon: <Info className="w-4 h-4" />, label: 'Media info', onClick: () => setPanel('info') },
    {
      key: 'fav',
      icon: <Star className={`w-4 h-4 ${record.isFavorite ? 'fill-[var(--cy)] text-[var(--cy)]' : ''}`} />,
      label: record.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      onClick: () => runAndRefresh(() => updatePlaybackRecordFields(record.id, { isFavorite: !record.isFavorite })),
    },
    { key: 'delete', icon: <Trash2 className="w-4 h-4" />, label: 'Delete', onClick: () => setPanel('delete'), danger: true },
  ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${getRecordTitle(record)}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[28px] bg-[var(--es)] border-x border-t border-[var(--bd)] shadow-2xl pb-[calc(env(safe-area-inset-bottom)+12px)] animate-[sheet-up_.22s_ease-out]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Video actions</p>
            <p className="text-sm font-bold text-white truncate max-w-[280px]">{getRecordTitle(record)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close actions"
            className="tile w-10 h-10 shrink-0 text-[var(--t2)] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {panel === 'actions' && (
          <div className="px-3 pb-2 max-h-[60vh] overflow-y-auto">
            {shareNote && (
              <p className="mx-2 mb-2 rounded-xl bg-[var(--ss)] border border-[var(--bd)] px-3 py-2 text-xs text-[var(--t2)]">
                {shareNote}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {actions.map((a, i) => (
                <button
                  key={a.key}
                  ref={i === 0 ? firstButtonRef : undefined}
                  onClick={a.onClick}
                  className={`flex min-h-[52px] items-center gap-3 rounded-2xl border border-[var(--bd)] bg-[var(--ss)] px-4 py-3 text-sm font-semibold text-white transition hover:border-[var(--ev)] active:scale-[0.98] ${
                    a.danger ? 'text-[var(--er)]' : ''
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bd)]/40 text-[var(--cy)]">
                    {a.icon}
                  </span>
                  <span className="text-left leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
            <p className="px-2 pt-3 pb-1 text-[11px] leading-relaxed text-[var(--t3)]">
              Actions change only CineFlow&apos;s local records. Files on your device are never modified or uploaded.
            </p>
          </div>
        )}

        {panel === 'rename' && (
          <div className="px-5 pb-4">
            <label className="text-xs font-semibold text-[var(--t2)]" htmlFor="rename-input">
              New title
            </label>
            <input
              id="rename-input"
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value);
                setRenameError(null);
              }}
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--bd)] bg-[var(--ss)] px-4 text-sm text-white focus:border-[var(--bv)] focus:outline-none"
              placeholder="Enter a display name"
            />
            {renameError && <p className="mt-2 text-xs text-[var(--er)]">{renameError}</p>}
            <p className="mt-2 text-[11px] text-[var(--t3)]">
              This renames the entry inside CineFlow only. The file on your device keeps its original name.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setPanel('actions')} className="btn sec h-11 flex-1 text-sm">
                Back
              </button>
              <button
                onClick={async () => {
                  const v = renameValue.trim();
                  if (!v) {
                    setRenameError('Enter a name, or go back and use Delete instead.');
                    return;
                  }
                  await runAndRefresh(() => renamePlaybackRecord(record.id, v));
                  onClose();
                }}
                className="btn pri h-11 flex-1 text-sm"
              >
                Save name
              </button>
            </div>
          </div>
        )}

        {panel === 'addto' && (
          <div className="px-5 pb-4">
            <p className="text-sm font-bold text-white mb-1">Add to playlist</p>
            {addedTo && (
              <p className="mb-2 flex items-center gap-1.5 rounded-xl border border-[var(--bd)] bg-[var(--ss)] px-3 py-2 text-xs text-emerald-300">
                <Check className="w-3.5 h-3.5" /> Added to &quot;{addedTo}&quot;.
              </p>
            )}
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-[var(--bd)] divide-y divide-[var(--bd)]/60">
              {playlists.length === 0 && (
                <p className="px-4 py-3 text-xs text-[var(--t2)]">No playlists yet - create one below.</p>
              )}
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => handleAddToPlaylist(pl)}
                  className="flex w-full min-h-[48px] items-center justify-between px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ss)]"
                >
                  <span className="truncate">{pl.name}</span>
                  <span className="text-xs text-[var(--t3)]">{pl.items.length} items</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="New playlist name"
                aria-label="New playlist name"
                className="h-11 flex-1 rounded-2xl border border-[var(--bd)] bg-[var(--ss)] px-4 text-sm text-white placeholder-[var(--t3)] focus:border-[var(--bv)] focus:outline-none"
              />
              <button onClick={handleCreateAndAdd} className="btn pri h-11 px-4 text-sm">
                Create & add
              </button>
            </div>
            <button onClick={() => setPanel('actions')} className="btn sec mt-2 h-11 w-full text-sm">
              Back
            </button>
          </div>
        )}

        {panel === 'info' && (
          <div className="px-5 pb-4">
            <p className="text-sm font-bold text-white mb-2">Media info</p>
            <div className="rounded-2xl border border-[var(--bd)] bg-[var(--ss)] p-4 space-y-2 text-xs">
              <InfoRow label="Title" value={getRecordTitle(record)} />
              <InfoRow label="File name" value={record.fileName} />
              <InfoRow label="Size" value={formatFileSize(record.fileSize)} />
              <InfoRow label="Duration" value={record.duration > 0 ? formatTime(record.duration) : 'Unknown'} />
              <InfoRow label="Resolution" value={record.mediaInfo?.width ? `${record.mediaInfo.width} x ${record.mediaInfo.height}` : 'Not captured yet'} />
              <InfoRow label="Aspect ratio" value={record.mediaInfo?.aspectRatio ? record.mediaInfo.aspectRatio.toFixed(2) : 'Not captured yet'} />
              <InfoRow label="MIME / container" value={record.mediaInfo?.mimeType ?? 'Not captured yet'} />
              <InfoRow label="Last played" value={formatDate(record.lastPlayedAt)} />
              <InfoRow label="Progress" value={`${record.progressPercent}%`} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--t3)]">
              Details are captured from the file when it was last opened in the player. CineFlow never stores the video
              itself, so &quot;not captured&quot; means the file has not been played in this browser yet, and cached
              details do not prove the file is still on this device.
            </p>
            <button onClick={() => setPanel('actions')} className="btn sec mt-3 h-11 w-full text-sm">
              Back
            </button>
          </div>
        )}

        {panel === 'delete' && (
          <div className="px-5 pb-4">
            <p className="text-sm font-bold text-white">Remove from CineFlow?</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--t2)]">
              This deletes CineFlow&apos;s local record (history, progress, favorites, playlist entries may remain in
              playlists). The actual video file on your device is <span className="font-bold">not</span> deleted.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setPanel('actions')} className="btn sec h-11 flex-1 text-sm">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await runAndRefresh(async () => {
                    const { deletePlaybackRecord } = await import('@/lib/storage/db');
                    await deletePlaybackRecord(record.id);
                    return null;
                  });
                  onClose();
                }}
                className="btn dan h-11 flex-1 text-sm"
              >
                Remove entry
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes sheet-up {
          from {
            transform: translateY(24px);
            opacity: 0.6;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="text-[var(--t3)] shrink-0">{label}</span>
    <span className="text-white text-right font-medium break-all">{value}</span>
  </div>
);
