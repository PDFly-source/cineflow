'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Music4,
  EyeOff,
  Settings as SettingsIcon,
  ShieldCheck,
  Activity,
  Smartphone,
  MessageSquareWarning,
  Info,
  Trash2,
  Eye,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import { TransferModal } from '@/components/transfer/TransferModal';
import { Mp3ConverterModal } from '@/components/library/Mp3ConverterModal';
import {
  getHiddenRecords,
  setHiddenRecord,
  deletePlaybackRecord,
  type PlaybackRecord,
} from '@/lib/storage/db';
import {
  getTransferHistory,
  clearTransferHistory,
  type SavedTransferSession,
} from '@/lib/transfer/p2p';
import { formatFileSize, formatTime } from '@/lib/utils/formatters';
import packageInfo from '@/package.json';

export default function MorePage() {
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMp3, setShowMp3] = useState(false);
  const [hidden, setHidden] = useState<PlaybackRecord[]>([]);
  const [transfers, setTransfers] = useState<SavedTransferSession[]>([]);

  // Reload after actions (event handlers may set state directly).
  const refresh = useCallback(() => {
    getHiddenRecords().then(setHidden).catch(() => setHidden([]));
    setTransfers(getTransferHistory());
  }, []);

  // Initial load: all state updates go through async callbacks, never synchronously.
  useEffect(() => {
    let alive = true;
    getHiddenRecords()
      .then((h) => {
        if (alive) setHidden(h);
      })
      .catch(() => {
        if (alive) setHidden([]);
      });
    Promise.resolve().then(() => {
      if (alive) setTransfers(getTransferHistory());
    });
    return () => {
      alive = false;
    };
  }, []);

  const unhide = async (key: string) => {
    await setHiddenRecord(key, false);
    refresh();
  };

  const removeRecord = async (key: string) => {
    // Deletes only CineFlow's local record; the actual video file on the device is untouched.
    await deletePlaybackRecord(key);
    refresh();
  };

  const recordName = (r: PlaybackRecord) => r.displayName || r.fileName;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8 nav-clearance">

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">More</h1>
        <p className="text-sm text-[var(--t3)] mt-1">
          Tools and utilities that work entirely on this device.
        </p>
      </div>

      {/* Tools */}
      <section aria-labelledby="more-tools">
        <h2 id="more-tools" className="sec-h">Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => setShowTransfer(true)} className="tilebtn">
            <div className="tile"><ArrowLeftRight className="w-5 h-5 text-[var(--cy)]" /></div>
            <div className="text-left min-w-0">
              <p className="font-semibold text-white text-sm">File Transfer</p>
              <p className="text-[11px] text-[var(--t3)]">Send videos device-to-device, no server</p>
            </div>
          </button>
          <button onClick={() => setShowMp3(true)} className="tilebtn">
            <div className="tile"><Music4 className="w-5 h-5 text-[var(--cy)]" /></div>
            <div className="text-left min-w-0">
              <p className="font-semibold text-white text-sm">Video to MP3</p>
              <p className="text-[11px] text-[var(--t3)]">Encode real MP3 audio locally</p>
            </div>
          </button>
        </div>
      </section>

      {/* Transfer Management */}
      <section aria-labelledby="more-transfers">
        <div className="flex items-center justify-between">
          <h2 id="more-transfers" className="sec-h">Transfer Management</h2>
          {transfers.length > 0 && (
            <button
              onClick={() => {
                clearTransferHistory();
                setTransfers([]);
              }}
              className="text-[11px] text-[var(--t3)] hover:text-red-400 underline underline-offset-2"
            >
              Clear history
            </button>
          )}
        </div>
        {transfers.length === 0 ? (
          <p className="rounded-2xl border border-[var(--bd)] bg-[var(--ss)] px-4 py-3 text-xs text-[var(--t2)]">
            No transfers yet. Real sessions appear here after you complete one via File Transfer.
          </p>
        ) : (
          <ul className="space-y-2">
            {transfers
              .slice()
              .reverse()
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--bd)] bg-[var(--ss)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      {t.role === 'sender' ? 'Sent' : 'Received'} · {t.fileName}
                    </p>
                    <p className="text-[11px] text-[var(--t3)]">
                      {formatFileSize(t.fileSize)} · {new Date(t.endedAt).toLocaleString()} · {t.status}
                    </p>
                  </div>
                  {t.status === 'completed' && t.integrityVerified ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--t3)]">
                      <ShieldAlert className="w-3.5 h-3.5" /> {t.status}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Hidden videos */}
      <section aria-labelledby="more-hidden">
        <h2 id="more-hidden" className="sec-h">Hidden Videos</h2>
        {hidden.length === 0 ? (
          <p className="rounded-2xl border border-[var(--bd)] bg-[var(--ss)] px-4 py-3 text-xs text-[var(--t2)]">
            Nothing is hidden. Videos you hide from the Library (3-dot menu) can be restored here. Hiding never
            touches the actual file on your device.
          </p>
        ) : (
          <ul className="space-y-2">
            {hidden.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--bd)] bg-[var(--ss)] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{recordName(r)}</p>
                  <p className="text-[11px] text-[var(--t3)]">{formatFileSize(r.fileSize)} · last played {r.lastPlayedAt ? new Date(r.lastPlayedAt).toLocaleDateString() : 'never'}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => unhide(r.id)} title="Unhide" aria-label={`Unhide ${recordName(r)}`} className="tile w-9 h-9">
                    <Eye className="w-4 h-4 text-[var(--cy)]" />
                  </button>
                  <button onClick={() => removeRecord(r.id)} title="Delete local record (file is untouched)" aria-label={`Delete local record for ${recordName(r)}`} className="tile w-9 h-9 hover:border-red-500/50">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* App sections */}
      <section aria-labelledby="more-app">
        <h2 id="more-app" className="sec-h">App</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/settings" className="tilebtn">
            <div className="tile"><SettingsIcon className="w-5 h-5 text-[var(--bv)]" /></div>
            <p className="font-semibold text-white text-sm">Settings</p>
          </Link>
          <Link href="/privacy" className="tilebtn">
            <div className="tile"><ShieldCheck className="w-5 h-5 text-emerald-400" /></div>
            <p className="font-semibold text-white text-sm">Privacy</p>
          </Link>
          <Link href="/diagnostics" className="tilebtn">
            <div className="tile"><Activity className="w-5 h-5 text-[var(--cy)]" /></div>
            <p className="font-semibold text-white text-sm">Diagnostics</p>
          </Link>
        </div>
      </section>

      {/* Widgets - honest capabilities */}
      <section aria-labelledby="more-widgets">
        <h2 id="more-widgets" className="sec-h">Widgets &amp; Home Screen</h2>
        <div className="rounded-2xl border border-[var(--bd)] bg-[var(--ss)] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[var(--cy)]" />
            <p className="text-xs font-semibold text-white">Add CineFlow to your home screen</p>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--t2)]">
            CineFlow is a web app (PWA). Use the <strong>Install App</strong> button in the header (or your
            browser&apos;s &quot;Add to Home screen&quot;) for a full-screen app icon. Because it is a web app, it
            cannot provide native Android/iOS home-screen widgets, lock-screen controls, or background audio; those
            need a native shell. Everything promised here is what the web app genuinely does.
          </p>
        </div>
      </section>

      {/* Feedback & Help */}
      <section aria-labelledby="more-help">
        <h2 id="more-help" className="sec-h">Feedback &amp; Help</h2>
        <a
          href="https://github.com/PDFly-source/cineflow/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="tilebtn"
        >
          <div className="tile"><MessageSquareWarning className="w-5 h-5 text-[var(--ev)]" /></div>
          <div className="text-left min-w-0">
            <p className="font-semibold text-white text-sm">Report an issue or suggest a feature</p>
            <p className="text-[11px] text-[var(--t3)]">GitHub issues · public repository</p>
          </div>
        </a>
      </section>

      {/* About */}
      <section aria-labelledby="more-about">
        <h2 id="more-about" className="sec-h">About</h2>
        <div className="rounded-2xl border border-[var(--bd)] bg-[var(--ss)] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--t3)]" />
            <p className="text-xs font-semibold text-white">CineFlow v{packageInfo.version}</p>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--t2)]">
            A privacy-first, local-only video player. Your videos never leave this device: playback, subtitles,
            playlists, MP3 conversion and device-to-device transfer all run in your browser. There is no server,
            no account, and no tracking.
          </p>
        </div>
      </section>

      {showTransfer && <TransferModal onClose={() => { setShowTransfer(false); refresh(); }} />}
      {showMp3 && <Mp3ConverterModal onClose={() => setShowMp3(false)} />}
    </div>
  );
}
