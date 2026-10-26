/**
 * Serverless peer-to-peer file transfer for CineFlow.
 *
 * WebRTC DataChannel with MANUAL signaling: the two peers exchange
 * offer/answer codes out-of-band (copy/paste, QR, any messaging app).
 * There is no signaling server, no storage, and no relay of our own.
 *
 * Honest limitations (surfaced in the UI as well):
 * - Both peers must be online and exchange codes manually.
 * - NAT/firewalls may block direct connections; if the browser's built-in
 *   ICE/STUN candidates fail, the transfer fails with a clear error.
 * - Receiving keeps chunks in memory until complete; very large files are
 *   limited by the receiving device's available RAM.
 */

export type TransferRole = 'sender' | 'receiver';

export type TransferSessionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'transferring'
  | 'verifying'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface FileMeta {
  name: string;
  size: number;
  mime: string;
  /** SHA-256 hex of the whole file, computed by the sender. */
  sha256: string;
}

export const CHUNK_SIZE = 64 * 1024; // 64 KiB per DataChannel message
export const BUFFER_HIGH = 1 * 1024 * 1024; // pause sending above 1 MB buffered
export const BUFFER_LOW = 256 * 1024; // resume when drained below 256 KB

/** Number of chunks needed for a file of `size` bytes. */
export function chunkCount(size: number, chunkSize = CHUNK_SIZE): number {
  if (size <= 0) return 0;
  return Math.ceil(size / chunkSize);
}

/** Verifies a SHA-256 hex string looks valid (64 hex chars). */
export function isSha256Hex(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

/** Computes the SHA-256 digest of bytes as lowercase hex. */
export async function sha256Of(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface SavedTransferSession {
  id: string;
  role: TransferRole;
  fileName: string;
  fileSize: number;
  status: 'completed' | 'cancelled' | 'failed';
  /** True only when the receiver's SHA-256 matched the sender's. */
  integrityVerified: boolean;
  startedAt: number;
  endedAt: number;
}

const TRANSFERS_KEY = 'cf_transfers';

/** Reads the real transfer history (only sessions that actually ran). */
export function getTransferHistory(): SavedTransferSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TRANSFERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) => s && typeof s.id === 'string' && typeof s.fileName === 'string' && typeof s.endedAt === 'number'
    );
  } catch {
    return [];
  }
}

/** Appends a session record to the real history. */
export function addTransferRecord(session: SavedTransferSession): void {
  if (typeof window === 'undefined') return;
  const list = getTransferHistory();
  list.push(session);
  try {
    window.localStorage.setItem(TRANSFERS_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // Quota or privacy mode: history is best-effort.
  }
}

export function clearTransferHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TRANSFERS_KEY);
  } catch {
    /* ignore */
  }
}

/** Strips a pasted signaling code of whitespace/newlines (they break copy/paste). */
export function normalizeSignalCode(raw: string): string {
  return raw.replace(/\s+/g, '');
}

/**
 * Encodes an RTCSessionDescription to a compact base64 copy/paste code.
 * (atob/btoa are available in every browser CineFlow supports.)
 */
export function encodeSignal(desc: RTCSessionDescriptionInit): string {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp });
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/** Decodes a copy/paste code back to a session description; null when invalid. */
export function decodeSignal(code: string): RTCSessionDescriptionInit | null {
  try {
    const normalized = normalizeSignalCode(code);
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { t?: RTCSdpType; s?: string };
    if (!json.t || !json.s) return null;
    return { type: json.t, sdp: json.s };
  } catch {
    return null;
  }
}

/** Minimal sanity check for a signaling code (decodes to an SDP). */
export function looksLikeSignalCode(raw: string): boolean {
  return decodeSignal(raw) !== null;
}
