'use client';

import React, { useState, useEffect } from 'react';
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
import { runPlaybackDiagnostics, DiagnosticsReport } from '@/lib/media/diagnostics';

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticsReport | null>(() => {
    if (typeof window !== 'undefined') {
      return runPlaybackDiagnostics();
    }
    return null;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshReport = () => {
    setReport(runPlaybackDiagnostics());
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
                <div className="pl-6 text-[10px] font-mono text-slate-500">
                  <span>MIME: {codec.mimeType}</span>
                </div>

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
            If your video plays without sound (common with AC-3 / DTS tracks from Blu-ray or TV rips), you do not need to re-encode the entire video. Running this single FFmpeg command copies the video bitstream byte-for-byte and converts only the audio stream to AAC in 5 to 10 seconds:
          </p>
          <pre className="p-3 rounded-xl bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto border border-slate-800">
            ffmpeg -i &quot;video.mkv&quot; -c:v copy -c:a aac -b:a 192k &quot;video.mp4&quot;
          </pre>
        </div>
      </div>
    </div>
  );
}
