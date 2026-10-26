'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Music4, Upload, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  convertFileToMp3,
  estimateMp3SizeBytes,
  estimatePeakPcmBytes,
  MP3_BITRATES,
  type Mp3Bitrate,
  type Mp3ConvertResult,
  type Mp3Progress,
} from '@/lib/audio/mp3Converter';
import { formatFileSize, formatTime } from '@/lib/utils/formatters';

export interface Mp3ConverterModalProps {
  onClose: () => void;
  /** Optional record hint: user must still re-select the actual file (local-only app). */
  recordHint?: { fileName: string; fileSize: number };
}

const LARGE_FILE_BYTES = 150 * 1024 * 1024; // ~150 MB

export const Mp3ConverterModal: React.FC<Mp3ConverterModalProps> = ({ onClose, recordHint }) => {
  const [file, setFile] = useState<File | null>(null);
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(192);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<Mp3Progress | null>(null);
  const [result, setResult] = useState<Mp3ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !converting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, converting]);

  // Release the temporary download URL when leaving.
  useEffect(() => {
    return () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  const reset = (keepFile: boolean) => {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    setResult(null);
    setError(null);
    setProgress(null);
    if (!keepFile) setFile(null);
  };

  const handleConvert = async () => {
    if (!file) return;
    reset(true);
    setConverting(true);
    try {
      const res = await convertFileToMp3(file, {
        bitrate,
        onProgress: setProgress,
      });
      downloadUrlRef.current = URL.createObjectURL(res.blob);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed for an unknown reason.');
    } finally {
      setConverting(false);
    }
  };

  const estimated = file ? estimatePeakPcmBytes(Math.max(60, file.size / (1024 * 1024 * 1.5)), 44100, 2) : 0;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !converting && onClose()} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Convert video to MP3"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] border border-[var(--bd)] bg-[var(--es)] shadow-2xl max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+12px)]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 bg-[var(--es)] z-10">
          <div className="flex items-center gap-2.5">
            <div className="tile w-10 h-10"><Music4 className="w-5 h-5 text-[var(--cy)]" /></div>
            <div>
              <h2 className="text-base font-bold text-white">Video to MP3</h2>
              <p className="text-[11px] text-[var(--t3)]">Runs entirely on this device</p>
            </div>
          </div>
          <button onClick={() => !converting && onClose()} aria-label="Close converter" className="tile w-10 h-10 text-[var(--t2)] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <p className="text-xs leading-relaxed text-[var(--t2)]">
            CineFlow decodes the audio track of a file you choose and encodes a genuine MP3 with LAME. The original
            video is never modified and nothing is uploaded.
          </p>

          {recordHint && !file && (
            <p className="rounded-xl border border-[var(--bd)] bg-[var(--ss)] px-3 py-2 text-[11px] text-[var(--t2)]">
              Hint: you opened this for &quot;{recordHint.fileName}&quot;. Because CineFlow stores no copies of your
              videos, please re-select that file from your device below.
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts,.mp3,.wav,.m4a,.aac,.flac"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                reset(false);
                setFile(f);
              }
            }}
            className="hidden"
            aria-label="Select media file"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={converting}
            className="btn sec h-12 w-full text-sm"
          >
            <Upload className="w-4 h-4" />
            <span>{file ? 'Choose another file' : 'Select video or audio file'}</span>
          </button>

          {file && (
            <div className="rounded-xl border border-[var(--bd)] bg-[var(--ss)] px-3 py-2 text-xs text-white">
              <p className="font-semibold truncate">{file.name}</p>
              <p className="text-[var(--t3)]">{formatFileSize(file.size)}</p>
            </div>
          )}

          {file && file.size > LARGE_FILE_BYTES && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Large file. Decoding keeps the full audio in memory (roughly {formatFileSize(estimated)} peak); devices
              with little RAM may fail. The original video stays untouched either way.
            </p>
          )}

          <div>
            <p className="text-xs font-semibold text-[var(--t2)] mb-1.5">Quality (CBR)</p>
            <div className="flex gap-2">
              {MP3_BITRATES.map((b) => (
                <button
                  key={b}
                  onClick={() => !converting && setBitrate(b)}
                  aria-pressed={bitrate === b}
                  className={`chip flex-1 justify-center ${bitrate === b ? 'on' : ''}`}
                >
                  {b} kbps
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleConvert} disabled={!file || converting} className="btn pri h-12 w-full text-sm">
            {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music4 className="w-4 h-4" />}
            <span>{converting ? 'Converting…' : 'Convert to MP3'}</span>
          </button>

          {converting && progress && (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bd)]">
                <div
                  className="h-full rounded-full bg-[var(--bv)] transition-all"
                  style={{ width: `${Math.round(progress.percent)}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--t3)] capitalize">
                {progress.stage} · {Math.round(progress.percent)}%
              </p>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-[var(--er)]/40 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-200">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          {result && downloadUrlRef.current && (
            <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="w-4 h-4" /> MP3 ready ({formatFileSize(result.byteLength)})
              </p>
              <p className="text-[11px] text-[var(--t2)]">
                {formatTime(result.durationSeconds)} · {result.sampleRate} Hz · {result.channels === 2 ? 'stereo' : 'mono'} ·{' '}
                {result.bitrate} kbps · verified MP3 signature
              </p>
              <a
                href={downloadUrlRef.current}
                download={`${file?.name.replace(/\.[^.]+$/, '') ?? 'cineflow'}.mp3`}
                className="btn pri h-11 w-full text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Save MP3</span>
              </a>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-[var(--t3)]">
            Limitations: conversion speed and supported input codecs depend on this browser&apos;s decoder. If the
            audio track cannot be decoded (for example some AC-3 or MKV tracks), the exact reason is shown above. Nothing
            is ever presented as converted unless real MP3 bytes were produced and verified.
          </p>
        </div>
      </div>
    </div>
  );
};
