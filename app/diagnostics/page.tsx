'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { runPlaybackDiagnostics, augmentWithDecodingInfo, DiagnosticsReport } from '@/lib/media/diagnostics';
import { probeMedia } from '@/lib/media/container-probe';
import type { MediaProbe } from '@/lib/media/container-probe';
import { decidePlaybackPlan, snapshotCapabilities, statusLabelFor } from '@/lib/media/compatibility';
import { getEngineInfo } from '@/lib/media/ffmpeg-client';
import type { EngineInfo } from '@/lib/media/ffmpeg-client';
import { FileVideo, FlaskConical } from 'lucide-react';

export default function DiagnosticsPage() {
  // Initialize null on both server and client (SSR-safe), then fill in an
  // effect so hydration always matches the static export's server HTML.
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fileProbe, setFileProbe] = useState<MediaProbe | null>(null);
  const [filePlan, setFilePlan] = useState<ReturnType<typeof decidePlaybackPlan> | null>(null);
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const fileTestRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer so the effect body stays render-free (lint: setState-in-effect).
    queueMicrotask(() => {
      if (cancelled) return;
      const initial = runPlaybackDiagnostics();
      setReport(initial);
      augmentWithDecodingInfo(initial).then((aug) => {
        if (!cancelled) setReport(aug);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshReport = () => {
    setReport(runPlaybackDiagnostics());
  };

  const handleTestFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileProbe(null);
    setFilePlan(null);
    const probe = await probeMedia(file);
    const decision = decidePlaybackPlan(probe, snapshotCapabilities(probe));
    setFileProbe(probe);
    setFilePlan(decision);
  };

  const handleCheckEngine = async () => {
    setEngineLoading(true);
    try {
      const info = await getEngineInfo();
      setEngineInfo(info);
    } catch {
      setEngineInfo({ status: 'error', version: null, configuration: null, encoders: [], decoders: [] });
    } finally {
      setEngineLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 nav-clearance">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to CineFlow Home</span>
          </Link>

          <button
            onClick={refreshReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-run Probe</span>
          </button>
        </div>

        {/* Title */}
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Browser Hardware & Media Diagnostics</h1>
            <p className="text-sm text-slate-400 mt-1">
              Honest runtime capability detection for HTML5 video, audio decoders, and browser APIs.
            </p>
          </div>
        </div>

        {/* Scorecard */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Supported Codecs
              </span>
              <span className="text-xl font-bold text-emerald-300 font-mono">
                {report.supportedCount} Formats
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Partial Support
              </span>
              <span className="text-xl font-bold text-amber-300 font-mono">
                {report.results.filter((r) => r.status === 'partial').length} Formats
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/20 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-rose-400" />
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Unsupported
              </span>
              <span className="text-xl font-bold text-rose-300 font-mono">
                {report.unsupportedCount} Formats
              </span>
            </div>
          </div>
        </div>

        {/* System Capabilities */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Web Platform APIs</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.systemCapabilities.map((cap, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5"
              >
                <div className="mt-0.5">
                  {cap.supported ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">{cap.name}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        cap.supported
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {cap.supported ? 'AVAILABLE' : 'UNAVAILABLE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{cap.notes}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase 2.7: Test Selected File */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-cyan-400" />
            <span>Test a Real File (most reliable)</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            MIME-string checks are estimates: a &quot;supported&quot; label does not prove every file decodes
            (profiles, levels and hardware limits still matter). Testing an actual file reads its
            container and track codecs locally and gives the playback recommendation the player uses.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <input
              ref={fileTestRef}
              type="file"
              accept="video/*,audio/*,.mkv,.mp4,.webm,.mov,.avi,.ts,.flac,.mp3,.wav"
              onChange={handleTestFile}
              className="hidden"
              aria-label="Select a media file to test"
            />
            <button
              onClick={() => fileTestRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition flex items-center gap-1.5"
            >
              <FileVideo className="w-3.5 h-3.5" aria-hidden />
              Test selected file
            </button>
          </div>

          {fileProbe && filePlan && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5" role="status">
              <p className="text-xs font-semibold text-slate-200">
                {fileProbe.fileName} · {fileProbe.container.toUpperCase()} ·{' '}
                {fileProbe.videoTracks.length ? fileProbe.videoTracks.map((t) => t.codecRaw || t.codec).join(' + ') : 'no video'} /{' '}
                {fileProbe.audioTracks.length ? fileProbe.audioTracks.map((t) => t.codecRaw || t.codec).join(' + ') : 'no audio'}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">{filePlan.explanation}</p>
              <span
                className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  filePlan.path === 'native'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : filePlan.path === 'convert'
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                      : filePlan.path === 'attempt-native'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                Status: {statusLabelFor(filePlan)}
              </span>
            </div>
          )}
        </div>

        {/* Phase 2.7: Local conversion engine */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Local Conversion Engine</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            CineFlow bundles FFmpeg (WebAssembly, single-threaded) to fix incompatible files on-device.
            It loads only when first used, runs in a worker, and never uploads anything. The engine is
            licensed GPL-2.0-or-later (see THIRD_PARTY_LICENSES.md).
          </p>
          {!engineInfo ? (
            <button
              onClick={handleCheckEngine}
              disabled={engineLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition disabled:opacity-60"
            >
              {engineLoading ? 'Loading engine…' : 'Load engine & show actual build capabilities'}
            </button>
          ) : (
            <div className="space-y-2 text-[11px]">
              <p className="text-slate-300 font-mono break-words">{engineInfo.version ?? 'engine unavailable in this browser'}</p>
              {engineInfo.encoders.length > 0 && (
                <p className="text-slate-400">
                  Encoders present: <span className="text-emerald-400 font-mono">{engineInfo.encoders.filter((e) => ['libx264', 'aac', 'libmp3lame', 'flac', 'libvpx-vp9'].includes(e)).join(', ')}</span>
                </p>
              )}
              {engineInfo.decoders.length > 0 && (
                <>
                  <p className="text-slate-400">
                    Dolby/DTS audio decoders: <span className="text-emerald-400 font-mono">
                      {['ac3', 'eac3', 'dca', 'truehd'].map((d) => d + (engineInfo.decoders.includes(d) ? '✓' : '✗')).join(' ')}
                    </span>
                    <span className="text-slate-500"> (dca = DTS)</span>
                  </p>
                  <p className="text-slate-400">
                    Video decoders for local re-encoding: <span className="text-emerald-400 font-mono">
                      {['h264', 'hevc', 'vp9', 'mpeg4'].map((d) => d + (engineInfo.decoders.includes(d) ? '✓' : '✗')).join(' ')}
                    </span>
                  </p>
                </>
              )}
              <p className="text-slate-500">
                Actual decoding still depends on this device; conversion feasibility is checked per file before it runs.
              </p>
            </div>
          )}
        </div>

        {/* Codec Breakdown */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white">Tested Media Encodings</h2>
          <div className="space-y-3">
            {report.results.map((codec) => (
              <div
                key={codec.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {codec.status === 'supported' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {codec.status === 'partial' && (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    {codec.status === 'unsupported' && (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="text-sm font-semibold text-white">{codec.name}</span>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                      codec.status === 'supported'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : codec.status === 'partial'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {codec.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed pl-6">{codec.description}</p>
                <div className="pl-6 text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>MIME: {codec.mimeType}</span>
                  {codec.decoding && (
                    <span className="text-slate-500">
                      decodingInfo: supported={String(codec.decoding.supported)} smooth={String(codec.decoding.smooth)} powerEfficient={String(codec.decoding.powerEfficient)}
                    </span>
                  )}
                </div>
                {codec.localFallback && codec.status !== 'supported' && (
                  <div className="pl-6">
                    <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase">
                      Fixable on-device: {codec.localFallback}
                    </span>
                  </div>
                )}

                {codec.solution && codec.status !== 'supported' && (
                  <div className="mt-2 ml-6 p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-between gap-3">
                    <code className="text-[11px] text-cyan-300 font-mono truncate">{codec.solution}</code>
                    <button
                      onClick={() => copyToClipboard(codec.solution!, codec.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 shrink-0 transition"
                    >
                      {copiedId === codec.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Command</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* FFmpeg Explanations */}
        <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-3 text-xs leading-relaxed text-slate-300">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Lossless Fast-Remux Guide (MKV to MP4)</span>
          </h3>
          <p>
            If your video plays without sound (common with AC-3 / DTS tracks from Blu-ray or TV rips), you do not need to re-encode the entire video. The player now offers this automatically — the video bitstream is copied byte-for-byte and only the audio stream is converted to AAC, on-device. The equivalent command, for reference:
          </p>
          <pre className="p-3 rounded-xl bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto border border-slate-800">
            ffmpeg -i &quot;video.mkv&quot; -c:v copy -c:a aac -b:a 192k &quot;video.mp4&quot;
          </pre>
        </div>
      </div>
    </div>
  );
}
