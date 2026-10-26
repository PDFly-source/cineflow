'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Film,
  Search,
  Plus,
  Play,
  Trash2,
  Star,
  Clock,
  ListMusic,
  ArrowUpDown,
  FolderOpen,
} from 'lucide-react';
import {
  getAllPlaybackRecords,
  deletePlaybackRecord,
  savePlaybackRecord,
  PlaybackRecord,
} from '@/lib/storage/db';
import { formatTime, formatFileSize, formatDate, formatVideoTitle } from '@/lib/utils/formatters';
import { useMedia } from '@/context/MediaSessionContext';
import { BrandHeader } from '@/components/brand/Logo';
import { EmptyStateCard } from '@/components/ui/EmptyStateCard';

export default function LibraryPage() {
  const router = useRouter();
  const { selectFiles, settings, updateSettings, isPrivateSession, setIsPrivateSession } = useMedia();

  const [records, setRecords] = useState<PlaybackRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'playlists' | 'sort'>('recent');
  const [sortOrder, setSortOrder] = useState<'recent' | 'name' | 'duration'>('recent');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDelete = async (id: string) => {
    await deletePlaybackRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      selectFiles(Array.from(files));
      router.push('/player');
    }
  };

  // Filtered records
  const filteredRecords = records
    .filter((r) => {
      const matchesSearch = r.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'recent') return b.lastPlayedAt - a.lastPlayedAt;
      if (sortOrder === 'name') return a.fileName.localeCompare(b.fileName);
      if (sortOrder === 'duration') return b.duration - a.duration;
      return 0;
    });

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
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

      <BrandHeader className="md:hidden" />

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
        <Search className="w-4 h-4 text-[var(--t3)] absolute left-4 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your videos"
          className="w-full h-12 rounded-[25px] bg-[var(--es)] border border-[var(--bd)] pl-11 pr-4 text-sm text-[var(--tx)] placeholder-[var(--t3)] focus:border-[var(--bv)] focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 text-xs text-[var(--t3)] hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter Tabs (Screen 4: Recent, Favorites, Playlists, Sort) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
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
          <h2 className="text-lg font-bold text-white mb-1.5">Nothing selected yet</h2>
          <p className="text-xs sm:text-sm text-[var(--t2)] max-w-md leading-relaxed mb-6">
            Pick the videos you want here. CineFlow only sees files you choose, then shows duration and resolution.
          </p>
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
            <div
              key={item.id}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-between p-3.5 hover:bg-[var(--ss)] transition cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="tile">
                  <Play className="w-4 h-4 text-[var(--cy)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                    {formatVideoTitle(item.fileName)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--t3)] mt-0.5">
                    <span>{formatTime(item.duration)}</span>
                    <span>·</span>
                    <span>{formatFileSize(item.fileSize)}</span>
                    <span>·</span>
                    <span>{formatDate(item.lastPlayedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs text-[var(--cy)] font-semibold">
                  {item.progressPercent}%
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  className="p-1.5 text-[var(--t3)] hover:text-[var(--er)] transition"
                  title="Remove from library"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
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
    </div>
  );
}
