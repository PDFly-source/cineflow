'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  FileCode,
  Terminal,
} from 'lucide-react';
import { runPlaybackDiagnostics, DiagnosticsReport } from '@/lib/media/diagnostics';

interface PlaybackDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlaybackDiagnosticsModal: React.FC<PlaybackDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [report, setReport] = useState<DiagnosticsReport | null>(() => {
    if (typeof window !== 'undefined') {
      return runPlaybackDiagnostics();
    }
    return null;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'codecs' | 'system' | 'ffmpeg'>('codecs');

  const refreshDiagnostics = () => {
    setReport(runPlaybackDiagnostics());
  };

  if (!isOpen || !report) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Playback Capability Diagnostics</h2>
              <p className="text-xs text-slate-400">
                Live runtime inspection of browser decoders & hardware APIs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={refreshDiagnostics}
              title="Re-run diagnostic probe"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close diagnostics"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Scoreboard */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Fully Supported</span>
              <span className="text-sm font-bold text-emerald-300 font-mono">
                {report.supportedCount} Codecs
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Partial / Maybe</span>
              <span className="text-sm font-bold text-amber-300 font-mono">
                {report.results.filter((r) => r.status === 'partial').length} Formats
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-rose-500/20">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Unsupported</span>
              <span className="text-sm font-bold text-rose-300 font-mono">
                {report.unsupportedCount} Codecs
              </span>
            </div>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('codecs')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'codecs'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Video & Audio Codecs
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'system'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            System & Media APIs
          </button>
          <button
            onClick={() => setActiveTab('ffmpeg')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'ffmpeg'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Conversion Recipes (FFmpeg)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === 'codecs' && (
            <div className="space-y-2.5">
              {report.results.map((codec) => (
                <div
                  key={codec.id}
                  className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:border-slate-600 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {codec.status === 'supported' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {codec.status === 'partial' && (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      {codec.status === 'unsupported' && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-200">{codec.name}</span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold ${
                        codec.status === 'supported'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : codec.status === 'partial'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {codec.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mb-1.5 pl-6">
                    {codec.description}
                  </p>

                  <div className="pl-6 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="truncate max-w-[80%]">{codec.mimeType}</span>
                    <span>MSE: {codec.mseSupported ? 'YES' : 'NO'}</span>
                  </div>

                  {codec.solution && codec.status !== 'supported' && (
                    <div className="mt-2.5 ml-6 p-2 rounded-lg bg-slate-950/80 border border-slate-700/80 flex items-center justify-between gap-2">
                      <code className="text-[10px] text-cyan-300 font-mono truncate">{codec.solution}</code>
                      <button
                        onClick={() => copyToClipboard(codec.solution!, codec.id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 shrink-0 transition"
                      >
                        {copiedId === codec.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Command</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-2.5">
              {report.systemCapabilities.map((cap, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60"
                >
                  <div className="mt-0.5">
                    {cap.supported ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-200">{cap.name}</span>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          cap.supported ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {cap.supported ? 'ACTIVE & PERMITTED' : 'NOT EXPOSED BY BROWSER'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{cap.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'ffmpeg' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 leading-relaxed text-[11px]">
                <strong className="block mb-1 text-white">Why do some MKV / AC3 files play silently?</strong>
                Web browsers are sandboxed and cannot load system-level proprietary AC-3 (Dolby Digital) or DTS audio decoders without OS licensing. You can convert any video losslessly in 5–15 seconds using copy-streaming without re-encoding the video track.
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white">1. Instant Fast-Remux (MKV to MP4, Video Unaltered)</span>
                    <button
                      onClick={() =>
                        copyToClipboard('ffmpeg -i "input.mkv" -c:v copy -c:a aac -b:a 192k "output.mp4"', 'remux')
                      }
                      className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] flex items-center gap-1 transition"
                    >
                      {copiedId === 'remux' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Takes ~5 seconds. Video is untouched (no quality loss), only audio is converted to web-standard AAC.
                  </p>
                  <pre className="p-2.5 rounded bg-black/50 text-cyan-300 font-mono text-[11px] overflow-x-auto">
                    ffmpeg -i &quot;input.mkv&quot; -c:v copy -c:a aac -b:a 192k &quot;output.mp4&quot;
                  </pre>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white">2. Full Universal Web Encoding (H.265 to H.264)</span>
                    <button
                      onClick={() =>
                        copyToClipboard('ffmpeg -i "input.mkv" -c:v libx264 -crf 20 -preset fast -c:a aac -b:a 192k "universal.mp4"', 'h264')
                      }
                      className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] flex items-center gap-1 transition"
                    >
                      {copiedId === 'h264' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Guaranteed playback on all old phones, tablets, smart TVs, and browsers without HEVC restrictions.
                  </p>
                  <pre className="p-2.5 rounded bg-black/50 text-cyan-300 font-mono text-[11px] overflow-x-auto">
                    ffmpeg -i &quot;input.mkv&quot; -c:v libx264 -crf 20 -preset fast -c:a aac -b:a 192k &quot;universal.mp4&quot;
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[10px] truncate max-w-[60%]">
            Report generated: {report.timestamp}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
