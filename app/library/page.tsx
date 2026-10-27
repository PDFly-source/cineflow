'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Film,
  Search,
  Plus,
  ListMusic,
  ArrowUpDown,
  FolderOpen,
  X,
} from 'lucide-react';
import {
  getAllPlaybackRecords,
  deletePlaybackRecord,
  savePlaybackRecord,
} from '@/lib/storage/db';
import { formatTime, formatFileSize, formatDate, formatVideoTitle } from '@/lib/utils/formatters';
import { filterLibraryRecords, getRecordTitle } from '@/lib/library/filters';
import { useMedia } from '@/context/MediaSessionContext';
import { EmptyStateCard } from '@/components/ui/EmptyStateCard';
import { VideoLibraryItem } from '@/components/library/VideoLibraryItem';
import { VideoActionSheet } from '@/components/library/VideoActionSheet';
import { Mp3ConverterModal } from '@/components/library/Mp3ConverterModal';
import { TransferModal } from '@/components/transfer/TransferModal';
import { updatePlaybackRecordFields, type PlaybackRecord } from '@/lib/storage/db';

export default function LibraryPage() {
  const router = useRouter();
  const { selectFiles, settings, updateSettings, isPrivateSession, setIsPrivateSession } = useMedia();

  const [records, setRecords] = useState<PlaybackRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'playlists' | 'sort'>('recent');
  const [sortOrder, setSortOrder] = useState<'recent' | 'name' | 'duration'>('recent');
  const [sheetRecord, setSheetRecord] = useState<PlaybackRecord | null>(null);
  const [mp3RecordHint, setMp3RecordHint] = useState<{ fileName: string; fileSize: number } | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isSubscribed = true;
    getAllPlaybackRecords().then((list) => {
      if (isSubscribed) {
        setRecords(list);
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Deep link from the header Search action: /library?focus=search
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('focus') === 'search') {
      searchInputRef.current?.focus();
    }
  }, []);

  const refreshRecords = async () => {
    setRecords(await getAllPlaybackRecords());
  };

  const handleDelete = async (id: string) => {
    await deletePlaybackRecord(id);
    await refreshRecords();
  };

  const handleRecordChanged = async (updated: PlaybackRecord | null) => {
    if (updated === null) {
      // Entry was deleted from the sheet
      await refreshRecords();
      return;
    }
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleToggleFavorite = async (record: PlaybackRecord) => {
    const updated = await updatePlaybackRecordFields(record.id, { isFavorite: !record.isFavorite });
    if (updated) {
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (sheetRecord?.id === updated.id) setSheetRecord(updated);
    }
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      selectFiles(Array.from(files));
      router.push('/player');
    }
  };

  // Filtered records (favorites tab actually filters by isFavorite; hidden excluded)
  const filteredRecords = filterLibraryRecords(records, {
    tab: activeTab,
    searchQuery,
    sortOrder,
  });

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 nav-clearance">
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts"
        onChange={handleSelectFiles}
        className="hidden"
        aria-label="Import Videos"
      />

      {/* Header (Screen 4) */}
      <div className="flex items-center justify-between h-11">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Library</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="chip on flex items-center gap-1.5 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Import</span>
        </button>
      </div>

      {/* Search Bar (Screen 4) */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-[var(--t3)] absolute left-3.5 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your videos"
          aria-label="Search your videos"
          className="w-full h-11 sm:h-12 rounded-[22px] bg-[var(--es)] border border-[var(--bd)] pl-11 pr-4 text-sm text-[var(--tx)] placeholder-[var(--t3)] focus:border-[var(--bv)] focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 grid h-8 w-8 place-items-center rounded-full text-[var(--t3)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bv)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs (Screen 4: Recent, Favorites, Playlists, Sort) */}
      <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Library filters">
        <button
          onClick={() => setActiveTab('recent')}
          className={`chip ${activeTab === 'recent' ? 'on' : ''}`}
        >
          Recent
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`chip ${activeTab === 'favorites' ? 'on' : ''}`}
        >
          Favorites
        </button>
        <Link href="/playlists" className="chip hover:border-[var(--ev)]">
          Playlists
        </Link>
        <button
          onClick={() => {
            const next = sortOrder === 'recent' ? 'name' : sortOrder === 'name' ? 'duration' : 'recent';
            setSortOrder(next);
          }}
          className="chip flex items-center gap-1 text-[var(--t2)]"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span className="capitalize">{sortOrder}</span>
        </button>
      </div>

      {/* Empty State or Video List */}
      {filteredRecords.length === 0 ? (
        <div className="card text-center py-10 px-6 sm:px-10 flex flex-col items-center">
          <div className="tile w-16 h-16 rounded-[22px] mb-4 flex items-center justify-center">
            <Film className="w-8 h-8 text-[var(--cy)]" />
          </div>
          {activeTab === 'favorites' ? (
            <>
              <h2 className="text-lg font-bold text-white mb-1.5">No favorites yet</h2>
              <p className="text-xs sm:text-sm text-[var(--t2)] max-w-md leading-relaxed mb-6">
                Star videos from the Library or the player toolbar to see them here.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1.5">Nothing selected yet</h2>
              <p className="text-xs sm:text-sm text-[var(--t2)] max-w-md leading-relaxed mb-6">
                Pick the videos you want here. CineFlow only sees files you choose, then shows duration and resolution.
              </p>
            </>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn pri w-full max-w-xs h-12"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Select videos</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[var(--bd)] rounded-2xl bg-[var(--es)] border border-[var(--bd)] overflow-hidden">
          {filteredRecords.map((item) => (
            <VideoLibraryItem
              key={item.id}
              record={item}
              onOpen={() => fileInputRef.current?.click()}
              onOpenMenu={(r) => setSheetRecord(r)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Notice banner (honest limitations) */}
      {notice && (
        <div className="card p-4 text-sm text-[var(--t2)]" role="status">
          {notice}
        </div>
      )}

      {/* Playlist Empty Card (Screen 4) */}
      <EmptyStateCard
        icon={<ListMusic className="w-5 h-5 text-[var(--bv)]" />}
        title="No playlists"
        description="Select several videos to build a queue."
        actionLabel="Build"
        onAction={() => fileInputRef.current?.click()}
      />

      {/* Quick Playback & Privacy Preferences Card (Screen 4) */}
      <div className="card p-1 sm:p-2 divide-y divide-[var(--bd)]/60 text-sm font-semibold">
        <div className="row px-3 justify-between">
          <div>Resume playback</div>
          <div
            onClick={() => updateSettings({ resumePlayback: !settings.resumePlayback })}
            className={`tg ${settings.resumePlayback ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.resumePlayback}
            tabIndex={0}
          />
        </div>

        <div className="row px-3 justify-between">
          <div>Private session</div>
          <div
            onClick={() => setIsPrivateSession(!isPrivateSession)}
            className={`tg ${isPrivateSession ? 'on' : ''}`}
            role="switch"
            aria-checked={isPrivateSession}
            tabIndex={0}
          />
        </div>
      </div>

      {/* 3-dot action sheet */}
      {sheetRecord && (
        <VideoActionSheet
          record={sheetRecord}
          onClose={() => setSheetRecord(null)}
          onRecordChanged={handleRecordChanged}
          onConvertToMp3={(r) => {
            setSheetRecord(null);
            setMp3RecordHint({ fileName: r.fileName, fileSize: r.fileSize });
          }}
          onTransfer={() => {
            setSheetRecord(null);
            setShowTransfer(true);
          }}
        />
      )}

      {/* Video to MP3 converter */}
      {mp3RecordHint && (
        <Mp3ConverterModal recordHint={mp3RecordHint} onClose={() => setMp3RecordHint(null)} />
      )}

      {/* Device-to-device transfer */}
      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} />}
    </div>
  );
}
