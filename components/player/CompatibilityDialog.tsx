'use client';

/**
 * Compatibility dialog: explains why the browser cannot play the selected
 * file and offers honest local fixes (remux / audio transcode / full
 * transcode) with estimates, progress, cancellation and validated results.
 * The original file is never modified, and the user can always go back to it.
 */

import React from 'react';
import { AlertTriangle, Check, ChevronDown, FileVideo, Loader2, RefreshCw, X, Zap } from 'lucide-react';
import type { MediaProbe } from '@/lib/media/container-probe';
import type { PlaybackDecision } from '@/lib/media/compatibility';
import { audioCodecName, videoCodecName } from '@/lib/media/compatibility';
import type { ConversionResult, ConversionRefusal } from '@/lib/media/conversion';

export interface CompatibilityDialogProps {
  probe: MediaProbe;
  decision: PlaybackDecision;
  phase: 'offer' | 'converting' | 'ready' | 'failed';
  progress: number | null;
  error?: string | null;
  refusal?: ConversionRefusal | null;
  result?: ConversionResult | null;
  estimatedSeconds?: string;
  onConvert: () => void;
  onCancelConvert: () => void;
  onPlayConverted: () => void;
  onTryOriginal: () => void;
  onChooseOther: () => void;
  onDismiss: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(0) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

export function CompatibilityDialog(props: CompatibilityDialogProps) {
  const { probe, decision, phase, progress, error, refusal, result } = props;

  const vLabel = probe.videoTracks.length ? probe.videoTracks.map((t) => videoCodecName(t.codec)).join(' + ') : 'no video track';
  const aLabel = probe.audioTracks.length ? probe.audioTracks.map((t) => audioCodecName(t.codec)).join(' + ') : 'no audio track';

  return (
    <div
      className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Compatibility options"
    >
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white leading-snug">
                {phase === 'ready' ? 'Converted copy ready' : phase === 'converting' ? 'Converting on your device…' : 'This file needs a small fix'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{probe.fileName}</p>
            </div>
          </div>
          <button
            onClick={props.onDismiss}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Detected media facts */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-2.5">
              <p className="text-slate-500 mb-0.5">Container</p>
              <p className="text-slate-200 font-medium">{probe.container.toUpperCase()}</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-2.5">
              <p className="text-slate-500 mb-0.5">Size</p>
              <p className="text-slate-200 font-medium">{formatBytes(probe.sizeBytes)}</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-2.5">
              <p className="text-slate-500 mb-0.5">Video</p>
              <p className="text-slate-200 font-medium">{vLabel}</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-2.5">
              <p className="text-slate-500 mb-0.5">Audio</p>
              <p className="text-slate-200 font-medium">{aLabel}</p>
            </div>
          </div>

          {/* Explanation */}
          <p className="text-xs text-slate-300 leading-relaxed">{decision.explanation}</p>
          {decision.detail.length > 0 && (
            <ul className="space-y-1">
              {decision.detail.map((d, i) => (
                <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                  <Zap className="w-3 h-3 mt-0.5 text-cyan-500/70 shrink-0" aria-hidden />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Failure states */}
          {refusal && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-[11px] text-amber-300 leading-relaxed">{refusal.explanation}</p>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-[11px] text-red-300 leading-relaxed">{error}</p>
              <p className="text-[11px] text-slate-500 mt-1">Your original file was not changed.</p>
            </div>
          )}

          {/* Converting */}
          {phase === 'converting' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" aria-hidden />
                <span>{progress !== null ? progress + '% complete' : 'Working…'}</span>
                <span className="text-slate-500">on-device, nothing uploaded</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={progress ?? undefined} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: (progress ?? 0) + '%' }}
                />
              </div>
              <button
                onClick={props.onCancelConvert}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
              >
                Cancel conversion
              </button>
            </div>
          )}

          {/* Result ready */}
          {phase === 'ready' && result && (
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" aria-hidden />
                <div className="text-[11px] text-emerald-200 leading-relaxed">
                  <p className="font-medium text-emerald-300">Converted copy validated</p>
                  <p className="mt-0.5">
                    {result.outputProbe.videoTracks.length ? videoCodecName(result.outputProbe.videoTracks[0].codec) + ' video' : ''}
                    {result.outputProbe.audioTracks.length ? ' + ' + audioCodecName(result.outputProbe.audioTracks[0].codec) + ' audio' : ''} ·{' '}
                    {formatBytes(result.outputBytes)}
                    {result.outputProbe.durationSeconds ? ' · ' + Math.round(result.outputProbe.durationSeconds) + 's' : ''}
                  </p>
                  <p className="mt-0.5 text-emerald-400/70">Your original file is unchanged and stays on this device.</p>
                </div>
              </div>
              <button
                onClick={props.onPlayConverted}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
              >
                <FileVideo className="w-4 h-4" aria-hidden />
                Play converted copy
              </button>
              <button onClick={props.onTryOriginal} className="w-full text-[11px] text-slate-500 hover:text-slate-300 transition py-1">
                Keep trying the original instead
              </button>
            </div>
          )}

          {/* Offer actions */}
          {(phase === 'offer' || phase === 'failed') && (
            <div className="space-y-2.5">
              {decision.operation && !refusal && (
                <button
                  onClick={props.onConvert}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                  {decision.operation === 'remux-mp4'
                    ? 'Convert locally (stream copy, keeps quality)'
                    : decision.operation === 'audio-aac-transcode'
                      ? 'Convert audio to AAC locally'
                      : 'Convert to H.264 locally (slow)'}
                </button>
              )}
              {props.estimatedSeconds && decision.operation && !refusal && (
                <p className="text-center text-[11px] text-slate-500">{props.estimatedSeconds}</p>
              )}
              {phase === 'failed' && !error && (
                <button onClick={props.onConvert} className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Try conversion again
                </button>
              )}
              <button
                onClick={props.onTryOriginal}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
              >
                Try playing the original anyway
              </button>
              <button onClick={props.onChooseOther} className="w-full py-2 rounded-xl hover:bg-slate-800 text-xs text-slate-400 hover:text-slate-200 transition">
                Choose a different file
              </button>
            </div>
          )}
        </div>

        {/* Honest footer */}
        <div className="px-4 pb-4 flex items-center gap-1.5 text-[10px] text-slate-600">
          <ChevronDown className="w-3 h-3" aria-hidden />
          <span>
            Conversions run entirely on this device with FFmpeg (WebAssembly). Real decoding still depends on your device;
            capability checks are estimates.
          </span>
        </div>
      </div>
    </div>
  );
}
