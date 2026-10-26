'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Download, Copy, Check, Loader2, ArrowLeftRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { TransferSession, type P2PEvent } from '@/lib/transfer/p2pSession';
import type { FileMeta, TransferSessionStatus } from '@/lib/transfer/p2p';
import { formatFileSize } from '@/lib/utils/formatters';

export interface TransferModalProps {
  onClose: () => void;
}

type Mode = 'send' | 'receive';

const LIMITS = [
  'Both devices must exchange codes manually (paste them via any chat app).',
  'Transfers go device-to-device over WebRTC; no server of ours is involved.',
  'Strict networks may block the direct link; the exact failure is shown if so.',
  'The receiver keeps the file in memory until you save it; very large files may fail on low-RAM devices.',
];

export const TransferModal: React.FC<TransferModalProps> = ({ onClose }) => {
  const [mode, setMode] = useState<Mode>('send');
  const [status, setStatus] = useState<TransferSessionStatus>('idle');
  const [detail, setDetail] = useState<string | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [theirCode, setTheirCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState<{ bytes: number; total: number } | null>(null);
  const [incoming, setIncoming] = useState<FileMeta | null>(null);
  const [receivedBlob, setReceivedBlob] = useState<{ blob: Blob; meta: FileMeta; verified: boolean } | null>(null);
  const [sentVerified, setSentVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<TransferSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiveUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
      if (receiveUrlRef.current) URL.revokeObjectURL(receiveUrlRef.current);
    };
  }, []);

  const handleEvent = (e: P2PEvent) => {
    switch (e.type) {
      case 'status':
        setStatus(e.status);
        setDetail(e.detail ?? null);
        break;
      case 'signal-ready':
        setMyCode(e.code);
        break;
      case 'meta':
        setIncoming(e.meta);
        setReceivedBlob(null);
        setProgress({ bytes: 0, total: e.meta.size });
        break;
      case 'progress':
        setProgress({ bytes: e.bytes, total: e.total });
        break;
      case 'received':
        setReceivedBlob({ blob: e.blob, meta: e.meta, verified: e.verified });
        if (receiveUrlRef.current) URL.revokeObjectURL(receiveUrlRef.current);
        receiveUrlRef.current = URL.createObjectURL(e.blob);
        break;
      case 'sent':
        setSentVerified(e.verified);
        break;
      case 'error':
        setError(e.message);
        setBusy(false);
        break;
    }
  };

  const freshSession = () => {
    sessionRef.current?.close();
    const s = new TransferSession({ role: mode === 'send' ? 'sender' : 'receiver', onEvent: handleEvent });
    sessionRef.current = s;
    return s;
  };

  const startSend = async () => {
    setError(null);
    setMyCode(null);
    setProgress(null);
    setStatus('connecting');
    setBusy(true);
    try {
      await freshSession().createOffer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the connection.');
      setStatus('failed');
    } finally {
      setBusy(false);
    }
  };

  const connectAsSender = async () => {
    setError(null);
    setBusy(true);
    try {
      await sessionRef.current?.acceptAnswer(theirCode.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid answer code.');
    } finally {
      setBusy(false);
    }
  };

  const startReceive = async () => {
    setError(null);
    setMyCode(null);
    setReceivedBlob(null);
    setIncoming(null);
    setBusy(true);
    setStatus('connecting');
    try {
      await freshSession().acceptOffer(theirCode.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid offer code.');
      setStatus('failed');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  const sendFile = async (f: File) => {
    setError(null);
    setSentVerified(null);
    setBusy(true);
    try {
      await sessionRef.current?.sendFile(f);
    } catch (err) {
      if (err instanceof Error && err.message === 'CANCELLED') {
        setStatus('cancelled');
        setDetail('Transfer cancelled.');
      } else {
        setError(err instanceof Error ? err.message : 'Transfer failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard copy was blocked; select the code text and copy manually.');
    }
  };

  const connected = status === 'connected';
  const transferring = status === 'transferring' || status === 'verifying';
  const pct = progress && progress.total > 0 ? Math.round((progress.bytes / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !transferring && onClose()} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Device-to-device transfer"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] border border-[var(--bd)] bg-[var(--es)] shadow-2xl max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+12px)]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 bg-[var(--es)] z-10">
          <div className="flex items-center gap-2.5">
            <div className="tile w-10 h-10"><ArrowLeftRight className="w-5 h-5 text-[var(--cy)]" /></div>
            <div>
              <h2 className="text-base font-bold text-white">Send / Receive</h2>
              <p className="text-[11px] text-[var(--t3)]">Device-to-device, no server involved</p>
            </div>
          </div>
          <button onClick={() => !transferring && onClose()} aria-label="Close transfer" className="tile w-10 h-10 text-[var(--t2)] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('send')}
              disabled={transferring}
              aria-pressed={mode === 'send'}
              className={`chip justify-center ${mode === 'send' ? 'on' : ''}`}
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
            <button
              onClick={() => setMode('receive')}
              disabled={transferring}
              aria-pressed={mode === 'receive'}
              className={`chip justify-center ${mode === 'receive' ? 'on' : ''}`}
            >
              <Download className="w-3.5 h-3.5" /> Receive
            </button>
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-[var(--er)]/40 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-200">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          {mode === 'send' ? (
            <div className="space-y-3">
              {!myCode && (
                <button onClick={startSend} disabled={busy} className="btn pri h-12 w-full text-sm">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{busy ? 'Preparing…' : '1. Create offer code'}</span>
                </button>
              )}
              {myCode && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--t2)]">
                    1. Send this offer code to the other device (paste it in any chat app):
                  </p>
                  <textarea
                    readOnly
                    value={myCode}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Your offer code"
                    className="h-24 w-full rounded-xl border border-[var(--bd)] bg-[var(--ss)] p-2 font-mono text-[10px] text-[var(--t2)]"
                  />
                  <button onClick={copyCode} className="btn sec h-10 w-full text-xs">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy offer code'}</span>
                  </button>
                  <p className="text-[11px] text-[var(--t2)]">2. Paste the answer code you receive back:</p>
                  <textarea
                    value={theirCode}
                    onChange={(e) => setTheirCode(e.target.value)}
                    placeholder="Paste answer code here…"
                    aria-label="Answer code"
                    className="h-16 w-full rounded-xl border border-[var(--bd)] bg-[var(--ss)] p-2 font-mono text-[10px] text-white placeholder:text-[var(--t3)]"
                  />
                  <button onClick={connectAsSender} disabled={busy || connected} className="btn sec h-11 w-full text-xs">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{connected ? 'Connected' : '3. Connect'}</span>
                  </button>
                </div>
              )}
              {connected && (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) sendFile(f);
                    }}
                    className="hidden"
                    aria-label="File to send"
                  />
                  <button onClick={pickFile} disabled={busy} className="btn pri h-12 w-full text-sm">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{busy ? 'Sending…' : 'Choose file to send'}</span>
                  </button>
                  {sentVerified === true && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                      <ShieldCheck className="w-4 h-4" /> Sent and verified by the receiver (SHA-256 match).
                    </p>
                  )}
                  {sentVerified === false && (
                    <p className="text-[11px] text-amber-300">
                      Sent, but the receiver did not confirm an integrity match (it may still be verifying).
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-[var(--t2)]">1. Paste the offer code the sender gave you:</p>
              <textarea
                value={theirCode}
                onChange={(e) => setTheirCode(e.target.value)}
                placeholder="Paste offer code here…"
                aria-label="Offer code"
                className="h-16 w-full rounded-xl border border-[var(--bd)] bg-[var(--ss)] p-2 font-mono text-[10px] text-white placeholder:text-[var(--t3)]"
              />
              {!myCode && (
                <button onClick={startReceive} disabled={busy} className="btn pri h-12 w-full text-sm">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{busy ? 'Preparing…' : '2. Create answer code'}</span>
                </button>
              )}
              {myCode && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--t2)]">3. Send this answer code back to the sender:</p>
                  <textarea
                    readOnly
                    value={myCode}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Your answer code"
                    className="h-24 w-full rounded-xl border border-[var(--bd)] bg-[var(--ss)] p-2 font-mono text-[10px] text-[var(--t2)]"
                  />
                  <button onClick={copyCode} className="btn sec h-10 w-full text-xs">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy answer code'}</span>
                  </button>
                  <p className="text-[11px] text-[var(--t3)]">
                    {connected ? 'Connected. Waiting for the file…' : 'Waiting for the sender to connect…'}
                  </p>
                </div>
              )}
              {incoming && (
                <div className="rounded-xl border border-[var(--bd)] bg-[var(--ss)] px-3 py-2 text-xs text-white">
                  <p className="font-semibold truncate">{incoming.name}</p>
                  <p className="text-[var(--t3)]">{formatFileSize(incoming.size)} · SHA-256 declared</p>
                </div>
              )}
              {receivedBlob && receiveUrlRef.current && (
                <div className="space-y-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <ShieldCheck className="w-4 h-4" />
                    {receivedBlob.verified ? 'Verified (SHA-256 match)' : 'Received, but checksum mismatch!'}
                  </p>
                  <a
                    href={receiveUrlRef.current}
                    download={receivedBlob.meta.name}
                    className="btn pri h-11 w-full text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save file</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {progress && (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bd)]">
                <div className="h-full rounded-full bg-[var(--bv)] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-[var(--t3)]">
                {formatFileSize(progress.bytes)} / {formatFileSize(progress.total)} · {pct}%
                {status === 'verifying' ? ' · verifying checksum…' : ''}
              </p>
            </div>
          )}

          {detail && !error && <p className="text-[11px] text-[var(--t3)]">{detail}</p>}

          <div className="rounded-2xl border border-[var(--bd)] bg-[var(--ss)] p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">How it works / limits</p>
            <ul className="space-y-1">
              {LIMITS.map((l) => (
                <li key={l} className="text-[10px] leading-relaxed text-[var(--t2)]">• {l}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
