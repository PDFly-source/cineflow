'use client';

import React, { useState, useRef } from 'react';
import { X, Play, Trash2, ChevronUp, ChevronDown, Plus, Save, Shuffle, Film, Check } from 'lucide-react';
import { useMedia } from '@/context/MediaSessionContext';
import { formatFileSize, formatVideoTitle } from '@/lib/utils/formatters';
import { savePlaylist } from '@/lib/storage/db';

interface PlaylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({ isOpen, onClose }) => {
  const {
    queue,
    currentIndex,
    playIndex,
    removeQueueItem,
    reorderQueue,
    appendFiles,
    shuffleQueue,
    clearQueue,
  } = useMedia();

  const [playlistName, setPlaylistName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAppendFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      appendFiles(Array.from(files));
    }
  };

  const handleSavePlaylist = async () => {
    if (!playlistName.trim() || queue.length === 0) return;

    const record = {
      id: `pl_${Date.now()}`,
      name: playlistName.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: queue.map((item) => ({
        name: item.name,
        size: item.size,
        lastModified: item.lastModified,
      })),
    };

    await savePlaylist(record);
    setPlaylistName('');
    setShowSaveInput(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-5 flex flex-col justify-between shadow-2xl text-slate-100 animate-slide-left">
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-base font-semibold">Playback Queue</h3>
                <p className="text-xs text-slate-400">
                  {queue.length} {queue.length === 1 ? 'video' : 'videos'} loaded
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between gap-2 py-3 border-b border-slate-800">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,.mkv,.mp4,.webm,.mov,.avi"
              onChange={handleAppendFiles}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Videos</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={shuffleQueue}
                title="Shuffle Queue"
                disabled={queue.length <= 1}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowSaveInput(!showSaveInput)}
                title="Save as Playlist"
                disabled={queue.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 disabled:opacity-40 transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                onClick={clearQueue}
                title="Clear Entire Queue"
                disabled={queue.length === 0}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-300 text-slate-400 disabled:opacity-40 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Save Playlist Form */}
          {showSaveInput && (
            <div className="my-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
              <span className="text-xs font-medium text-slate-300">Save Queue as Playlist</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Playlist Name..."
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSavePlaylist}
                  disabled={!playlistName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="my-2 p-2 rounded-lg bg-emerald-950/80 border border-emerald-600/40 text-emerald-200 text-xs flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Playlist saved to local library!</span>
            </div>
          )}
        </div>

        {/* Scrollable Queue List */}
        <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 text-xs">
              <Film className="w-8 h-8 mb-2 opacity-40" />
              <span>No videos in queue.</span>
              <span className="text-[11px] text-slate-600 mt-1">Tap &quot;Add Videos&quot; to load files.</span>
            </div>
          ) : (
            queue.map((item, idx) => {
              const isPlaying = idx === currentIndex;
              return (
                <div
                  key={item.id + idx}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-colors ${
                    isPlaying
                      ? 'bg-indigo-950/40 border-indigo-500/40 text-white'
                      : 'bg-slate-850 hover:bg-slate-800/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <button
                    onClick={() => playIndex(idx)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                        isPlaying ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Play className={`w-3.5 h-3.5 ${isPlaying ? 'fill-white' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{formatVideoTitle(item.name)}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatFileSize(item.size)}</p>
                    </div>
                  </button>

                  {/* Ordering & delete */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => reorderQueue(idx, idx - 1)}
                      disabled={idx === 0}
                      aria-label="Move video up"
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-20"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => reorderQueue(idx, idx + 1)}
                      disabled={idx === queue.length - 1}
                      aria-label="Move video down"
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-20"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeQueueItem(idx)}
                      aria-label="Remove video from queue"
                      className="p-1 text-slate-400 hover:text-red-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500">
          Temporary in-memory queue. Videos remain securely on your device.
        </div>
      </div>
    </div>
  );
};
