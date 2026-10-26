'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Film,
  Play,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  ListMusic,
  ArrowRight,
  Upload,
  Check,
  Sparkles,
  Loader2,
  Activity,
  FileText,
  Clock,
} from 'lucide-react';
import { useMedia } from '@/context/MediaSessionContext';
import {
  getAllPlaybackRecords,
  getAllPlaylists,
  PlaybackRecord,
  PlaylistRecord,
  deletePlaybackRecord,
} from '@/lib/storage/db';
import { formatTime, formatFileSize, formatDate, formatVideoTitle } from '@/lib/utils/formatters';
import { PWAInstallButton } from '@/components/app-shell/PWAInstallButton';
import { generateTestClipFile } from '@/lib/media/testClipGenerator';
import { BrandHeader } from '@/components/brand/Logo';
import { EmptyStateCard } from '@/components/ui/EmptyStateCard';

export default function HomePage() {
  const router = useRouter();
  const { selectFiles, currentItem } = useMedia();

  const [history, setHistory] = useState<PlaybackRecord[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isGeneratingTest, setIsGeneratingTest] = useState<boolean>(false);

  // File inputs
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Reload history and playlists from IndexedDB
  useEffect(() => {
    let isSubscribed = true;
    Promise.all([getAllPlaybackRecords(), getAllPlaylists()])
      .then(([h, p]) => {
        if (isSubscribed) {
          setHistory(h);
          setPlaylists(p);
        }
      })
      .finally(() => {
        if (isSubscribed) {
          setIsLoading(false);
        }
      });
    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    selectFiles(files);
    router.push('/player');
  };

  const handleGenerateTestClip = async () => {
    setIsGeneratingTest(true);
    try {
      const file = await generateTestClipFile();
      if (file) {
        selectFiles([file]);
        router.push('/player');
      }
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deletePlaybackRecord(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  // Continue Watching: items that have progress > 5s and not completed
  const continueWatching = history.filter(
    (item) => !item.completed && item.currentTime > 5 && item.currentTime < item.duration - 5
  );

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 nav-clearance">
      {/* Hidden File Pickers */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="video/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
        aria-label="Select single video"
      />
      <input
        ref={multiFileInputRef}
        type="file"
        multiple
        accept="video/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
        aria-label="Select multiple videos"
      />

      {/* Brand Header for mobile / subview */}
      <BrandHeader className="md:hidden" />

      {/* Hero Vector Mountain Sunset Scene (Screen 1) */}
      <section className="relative overflow-hidden rounded-[30px] border border-[#34416A] scene min-h-[440px] flex flex-col justify-between p-6 sm:p-8 shadow-2xl">
        <div className="shade pointer-events-none" />

        {/* Top Floating Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="chip gl text-xs text-white h-8 border-white/20">
            <ShieldCheck className="w-4 h-4 text-[var(--cy)]" />
            <span>Runs on your device</span>
          </span>

          <PWAInstallButton className="hidden sm:flex" />
        </div>

        {/* Bottom Hero Content */}
        <div className="relative z-10 space-y-4 pt-12">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.08] text-balance">
            Your Videos.<br />Your Device.<br />Your Control.
          </h1>

          <p className="text-sm sm:text-base text-[#D3D9EA] leading-relaxed max-w-xl">
            Private, cinema-grade playback with zero uploads and zero tracking.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => singleFileInputRef.current?.click()}
              className="btn pri flex-1 h-[52px]"
            >
              <FolderOpen className="w-5 h-5" />
              <span>Open Video</span>
            </button>

            <button
              onClick={() => multiFileInputRef.current?.click()}
              className="btn gl flex-1 h-[52px] text-sm text-[var(--tx)] hover:bg-white/10"
            >
              <Upload className="w-4 h-4 text-[var(--t2)]" />
              <span>Open Multiple Videos</span>
            </button>

            <button
              onClick={handleGenerateTestClip}
              disabled={isGeneratingTest}
              className="btn gl h-[52px] px-4 text-xs text-[var(--cy)] hover:bg-white/10 disabled:opacity-50"
              title="Generate client-side test clip"
            >
              {isGeneratingTest ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--cy)]" />
              ) : (
                <Sparkles className="w-4 h-4 text-[var(--cy)]" />
              )}
              <span className="sm:inline">{isGeneratingTest ? 'Generating...' : 'Test Clip'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Drag & Drop Zone Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => multiFileInputRef.current?.click()}
        className={`card flex items-center gap-3 p-3.5 sm:p-4 border-dashed cursor-pointer transition-all ${
          isDragOver
            ? 'border-[var(--ev)] bg-[var(--es)]/80 scale-[1.01]'
            : 'border-[var(--bd)] hover:border-[var(--bv)]'
        }`}
      >
        <div className="tile">
          <Film className="w-5 h-5 text-[var(--bv)]" />
        </div>
        <div className="flex-1 min-w-0">
          <strong className="block text-sm font-semibold text-[var(--tx)]">Drop videos here</strong>
          <p className="text-xs text-[var(--t2)]">MP4 · WebM · MKV · MOV · Local files only</p>
        </div>
        <span className="chip on shrink-0 text-xs">Browse</span>
      </div>

      {/* Bento Grid Cells */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Cell 1 (Tall): Continue Watching or Genuine Empty State */}
        <div className="cell flex flex-col justify-between min-h-[120px]">
          <div>
            <b>
              <Play className="w-4 h-4 text-[var(--cy)] fill-[var(--cy)]" />
              <span>Continue</span>
            </b>
            {continueWatching.length === 0 ? (
              <p className="text-xs text-[var(--t2)] mt-1">
                Nothing in progress. Start a video and it resumes here.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {continueWatching.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => singleFileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-[var(--dn)]/90 border border-[var(--bd)] hover:border-[var(--ev)] transition cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {formatVideoTitle(item.fileName)}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--t3)] mt-0.5">
                        <span>{formatTime(item.currentTime)}</span>
                        <span>/</span>
                        <span>{formatTime(item.duration)}</span>
                        <span>·</span>
                        <span className="text-[var(--cy)]">{item.progressPercent}%</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--ev)] shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {continueWatching.length > 0 && (
            <div className="pt-2 text-[11px] text-[var(--cy)] font-medium">
              Select file to resume where you left off
            </div>
          )}
        </div>

        {/* Right Column Bento Cells */}
        <div className="grid grid-cols-1 gap-3">
          <div className="cell flex items-center justify-between">
            <div>
              <b className="text-[var(--lav)]">
                <HardDrive className="w-4 h-4 text-[var(--lav)]" />
                <span className="text-[var(--tx)]">Stored locally</span>
              </b>
              <p className="text-xs text-[var(--t2)]">IndexedDB only. Zero cloud persistence.</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-[rgba(66,214,160,0.14)] text-[var(--ok)]">
              Device
            </span>
          </div>

          <div className="cell flex items-center justify-between">
            <div>
              <b style={{ color: 'var(--ok)' }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--ok)' }} />
                <span className="text-[var(--tx)]">SRT · VTT</span>
              </b>
              <p className="text-xs text-[var(--t2)]">Live sync, styling studio & timing offset.</p>
            </div>
            <Link href="/library" className="chip text-xs hover:border-[var(--ev)]">
              Studio
            </Link>
          </div>
        </div>
      </div>

      {/* Return to Active Video Pill if video is in session */}
      {currentItem && (
        <div className="card flex items-center justify-between p-3.5 bg-gradient-to-r from-[var(--es)] to-[var(--ss)] border-[var(--bv)]/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="tile">
              <Play className="w-4 h-4 text-[var(--cy)] fill-[var(--cy)]" />
            </div>
            <div className="min-w-0">
              <strong className="block text-sm font-semibold text-white truncate">
                {formatVideoTitle(currentItem.name)}
              </strong>
              <p className="text-xs text-[var(--t2)]">Playing in local session</p>
            </div>
          </div>
          <Link href="/player" className="btn pri h-9 px-4 text-xs">
            Return to Player
          </Link>
        </div>
      )}

      {/* Recent Playback History Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--cy)]" />
            <span>Recent Playback History</span>
          </h2>
          {history.length > 0 && (
            <Link
              href="/library"
              className="text-xs font-semibold text-[var(--lav)] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Full Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-xs text-[var(--t3)] card">
            Checking device storage...
          </div>
        ) : history.length === 0 ? (
          <EmptyStateCard
            icon={<Film className="w-5 h-5 text-[var(--bv)]" />}
            title="No recent videos"
            description="Open a video to start your local playback history."
            actionLabel="Open"
            onAction={() => singleFileInputRef.current?.click()}
          />
        ) : (
          <div className="divide-y divide-[var(--bd)] rounded-2xl bg-[var(--es)]/70 border border-[var(--bd)] overflow-hidden">
            {history.slice(0, 4).map((item) => (
              <div
                key={item.id}
                onClick={() => singleFileInputRef.current?.click()}
                className="flex items-center justify-between p-3.5 hover:bg-[var(--ss)] transition-colors cursor-pointer"
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
                  {item.completed ? (
                    <span className="text-xs text-[var(--ok)] flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Watched</span>
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-[var(--cy)] font-semibold">
                      {item.progressPercent}%
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                    aria-label="Remove item"
                    className="p-1.5 text-[var(--t3)] hover:text-[var(--er)] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Saved Playlists Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-[var(--lav)]" />
            <span>Saved Playlists</span>
          </h2>
          <Link
            href="/playlists"
            className="text-xs font-semibold text-[var(--lav)] hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>Manage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {playlists.length === 0 ? (
          <EmptyStateCard
            icon={<ListMusic className="w-5 h-5 text-[var(--bv)]" />}
            title="No playlists"
            description="Select several videos to build an offline queue."
            actionLabel="Create"
            onAction={() => multiFileInputRef.current?.click()}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {playlists.slice(0, 2).map((pl) => (
              <Link
                key={pl.id}
                href="/playlists"
                className="card hover:border-[var(--ev)] transition flex flex-col justify-between p-3.5"
              >
                <div>
                  <h3 className="text-sm font-semibold text-white truncate">{pl.name}</h3>
                  <p className="text-xs text-[var(--t2)] mt-0.5">
                    {pl.items.length} {pl.items.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <div className="mt-3 text-[11px] text-[var(--t3)] flex items-center justify-between">
                  <span>Updated {formatDate(pl.updatedAt)}</span>
                  <span className="text-[var(--cy)] font-semibold">Open &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Privacy & Diagnostics Strip */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--t2)] border-[var(--bd)]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--ok)]" />
          <span>Zero cloud uploads · No tracking pixels · 100% private local playback</span>
        </div>
        <Link
          href="/diagnostics"
          className="text-[var(--cy)] hover:underline flex items-center gap-1 font-semibold"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Hardware Decoders</span>
        </Link>
      </div>
    </div>
  );
}
