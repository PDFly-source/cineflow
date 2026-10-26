'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ListMusic,
  Plus,
  Trash2,
  Download,
  Upload,
  Play,
  Film,
  FolderOpen,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  getAllPlaylists,
  savePlaylist,
  deletePlaylist,
  PlaylistRecord,
} from '@/lib/storage/db';
import { formatDate, formatFileSize, formatVideoTitle } from '@/lib/utils/formatters';
import { useMedia } from '@/context/MediaSessionContext';
import { useRouter } from 'next/navigation';
import { BrandHeader } from '@/components/brand/Logo';

export default function PlaylistsPage() {
  const router = useRouter();
  const { selectFiles } = useMedia();

  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistRecord | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // File pickers
  const importInputRef = useRef<HTMLInputElement>(null);
  const playFileInputRef = useRef<HTMLInputElement>(null);

  const loadPlaylists = async () => {
    const list = await getAllPlaylists();
    setPlaylists(list);
    if (list.length > 0 && !selectedPlaylist) {
      setSelectedPlaylist(list[0]);
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    getAllPlaylists().then((list) => {
      if (isSubscribed) {
        setPlaylists(list);
        if (list.length > 0) {
          setSelectedPlaylist((prev) => prev ?? list[0]);
        }
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    const newPl: PlaylistRecord = {
      id: `pl_${Date.now()}`,
      name: newPlaylistName.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [],
    };

    await savePlaylist(newPl);
    setNewPlaylistName('');
    setShowCreateModal(false);
    await loadPlaylists();
    setSelectedPlaylist(newPl);
  };

  const handleDeletePlaylist = async (id: string) => {
    await deletePlaylist(id);
    const updated = playlists.filter((p) => p.id !== id);
    setPlaylists(updated);
    if (selectedPlaylist?.id === id) {
      setSelectedPlaylist(updated.length > 0 ? updated[0] : null);
    }
  };

  const handleExportPlaylist = (playlist: PlaylistRecord) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(playlist, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${playlist.name.replace(/\s+/g, '_')}_playlist.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportPlaylistFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.name || !Array.isArray(parsed.items)) {
          throw new Error('Invalid playlist JSON schema');
        }

        const importedPl: PlaylistRecord = {
          id: `pl_${Date.now()}`,
          name: parsed.name,
          createdAt: parsed.createdAt || Date.now(),
          updatedAt: Date.now(),
          items: parsed.items,
        };

        await savePlaylist(importedPl);
        await loadPlaylists();
        setSelectedPlaylist(importedPl);
        setStatusMessage(`Successfully imported "${importedPl.name}"`);
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        setStatusMessage('Failed to import playlist: Invalid file.');
        setTimeout(() => setStatusMessage(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handlePlaySelectedFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      selectFiles(Array.from(files));
      router.push('/player');
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      <BrandHeader className="md:hidden" />

      {/* Hidden File Inputs */}
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportPlaylistFile}
        className="hidden"
      />
      <input
        ref={playFileInputRef}
        type="file"
        multiple
        accept="video/*,.mkv,.mp4,.webm,.mov,.avi"
        onChange={handlePlaySelectedFiles}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <ListMusic className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Playlists</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Organize queues, manage video sets, and export playlist backups locally.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Playlist</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-indigo-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Layout: Left Sidebar + Right Playlist Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Playlist List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Your Playlists ({playlists.length})
          </h2>

          {playlists.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-400">
              <p className="text-xs">No playlists created yet.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 text-xs text-indigo-400 hover:underline"
              >
                Create your first playlist
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.map((pl) => {
                const isSelected = selectedPlaylist?.id === pl.id;
                return (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedPlaylist(pl)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/40 text-white'
                        : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold truncate">{pl.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {pl.items.length} {pl.items.length === 1 ? 'video' : 'videos'} · {formatDate(pl.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportPlaylist(pl);
                        }}
                        title="Export playlist as JSON"
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(pl.id);
                        }}
                        title="Delete playlist"
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Playlist Details */}
        <div className="lg:col-span-2">
          {selectedPlaylist ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedPlaylist.name}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Created on {formatDate(selectedPlaylist.createdAt)} · {selectedPlaylist.items.length} videos
                  </p>
                </div>

                <button
                  onClick={() => playFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition shrink-0"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Select Files to Play</span>
                </button>
              </div>

              {/* Explanatory Notice */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-300">
                <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Browser security boundaries prevent web apps from accessing raw local disk files automatically after a restart.
                  To launch this playlist, tap <strong className="text-white">&quot;Select Files to Play&quot;</strong> and select your videos.
                </p>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Playlist Items
                </h3>

                {selectedPlaylist.items.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/30 rounded-xl border border-slate-800">
                    No videos registered in this playlist.
                    <p className="text-[11px] text-slate-600 mt-1">
                      You can add active videos into this playlist directly from the Player queue drawer.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950/40 border border-slate-800 overflow-hidden">
                    {selectedPlaylist.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3.5 hover:bg-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-slate-500 w-5">{idx + 1}.</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-200 truncate">
                              {formatVideoTitle(item.name)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {formatFileSize(item.size)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center rounded-2xl bg-slate-900/30 border border-slate-800 text-slate-500 text-xs">
              <ListMusic className="w-8 h-8 mb-2 opacity-40" />
              <span>Select or create a playlist from the left.</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold">New Playlist</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-2">
              <label className="text-xs text-slate-300">Playlist Name</label>
              <input
                type="text"
                placeholder="e.g., Computer Science Lectures"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
