'use client';

/**
 * Browser-only WebRTC transfer session engine.
 * Wraps RTCPeerConnection + DataChannel with manual signaling codes,
 * chunked sends with backpressure, and SHA-256 integrity verification.
 */
import {
  CHUNK_SIZE,
  BUFFER_HIGH,
  BUFFER_LOW,
  sha256Of,
  encodeSignal,
  decodeSignal,
  looksLikeSignalCode,
  addTransferRecord,
  type FileMeta,
  type TransferRole,
  type TransferSessionStatus,
} from './p2p';

export type P2PEvent =
  | { type: 'status'; status: TransferSessionStatus; detail?: string }
  | { type: 'signal-ready'; code: string }
  | { type: 'meta'; meta: FileMeta }
  | { type: 'progress'; bytes: number; total: number }
  | { type: 'received'; blob: Blob; meta: FileMeta; verified: boolean }
  | { type: 'sent'; verified: boolean }
  | { type: 'error'; message: string };

export interface P2PConstraints {
  role: TransferRole;
  onEvent: (e: P2PEvent) => void;
}

export class TransferSession {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private role: TransferRole;
  private onEvent: (e: P2PEvent) => void;
  private cancelled = false;
  private sending = false;

  // Receiver state
  private incomingMeta: FileMeta | null = null;
  private parts: Uint8Array[] = [];
  private receivedBytes = 0;
  private startedAt = 0;
  private currentName = '';
  private totalBytes = 0;

  constructor({ role, onEvent }: P2PConstraints) {
    this.role = role;
    this.onEvent = onEvent;
  }

  private emit(e: P2PEvent) {
    try {
      this.onEvent(e);
    } catch {
      /* listener errors never break the transfer */
    }
  }

  private status(status: TransferSessionStatus, detail?: string) {
    this.emit({ type: 'status', status, detail });
  }

  private newPC(): RTCPeerConnection {
    // Only public Google STUN; no server of ours is involved.
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') this.status('connected');
      else if (st === 'failed') this.fail('Connection failed. Your network or firewall blocked the direct link.');
      else if (st === 'disconnected' || st === 'closed') {
        if (!this.cancelled) this.fail('Peer disconnected before finishing.');
      }
    };
    return pc;
  }

  /** SENDER: create the offer code to paste to the receiver. */
  async createOffer(): Promise<void> {
    this.pc = this.newPC();
    this.setupChannel(this.pc.createDataChannel('cineflow-transfer'));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIce(this.pc);
    this.emit({ type: 'signal-ready', code: encodeSignal(this.pc.localDescription!) });
    this.status('connecting', 'Waiting for the answer code from the receiver…');
  }

  /** SENDER: paste the receiver's answer code. */
  async acceptAnswer(answerCode: string): Promise<void> {
    if (!this.pc) throw new Error('Create the offer first.');
    const desc = decodeSignal(answerCode);
    if (!desc || desc.type !== 'answer') throw new Error('That does not look like a valid answer code.');
    await this.pc.setRemoteDescription(desc);
  }

  /** RECEIVER: paste the sender's offer code, get an answer code back. */
  async acceptOffer(offerCode: string): Promise<void> {
    if (!looksLikeSignalCode(offerCode)) throw new Error('That does not look like a valid offer code.');
    this.pc = this.newPC();
    this.pc.ondatachannel = (e) => this.setupChannel(e.channel);
    const desc = decodeSignal(offerCode)!;
    await this.pc.setRemoteDescription(desc);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitForIce(this.pc);
    this.emit({ type: 'signal-ready', code: encodeSignal(this.pc.localDescription!) });
    this.status('connecting', 'Send the answer code back to the sender…');
  }

  private async waitForIce(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
    if (pc.iceGatheringState === 'complete') return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(finish, timeoutMs);
      function finish() {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
      function check() {
        if (pc.iceGatheringState === 'complete') finish();
      }
      pc.addEventListener('icegatheringstatechange', check);
    });
  }

  private setupChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      this.status('connected');
      if (this.role === 'sender') this.status('connected', 'Connected. Choose a file to send.');
    };
    channel.onmessage = (e) => this.onChannelMessage(e.data);
    channel.onclose = () => {
      if (!this.cancelled) {
        if (this.role === 'receiver' && this.incomingMeta && this.receivedBytes >= this.incomingMeta.size) {
          this.finishReceive();
        } else if (this.role !== 'receiver' || !this.incomingMeta) {
          this.fail('Channel closed unexpectedly.');
        }
      }
    };
  }

  private onChannelMessage(data: unknown) {
    if (typeof data === 'string') {
      const msg = JSON.parse(data) as
        | { kind: 'meta'; meta: FileMeta }
        | { kind: 'accept' }
        | { kind: 'reject'; reason: string }
        | { kind: 'done' };
      if (msg.kind === 'meta') {
        this.incomingMeta = msg.meta;
        this.parts = [];
        this.receivedBytes = 0;
        this.startedAt = Date.now();
        this.currentName = msg.meta.name;
        this.emit({ type: 'meta', meta: msg.meta });
        this.status('transferring');
        // Auto-accept: CineFlow is user-driven; the receiver explicitly
        // started a receive session and sees live progress.
        this.channel?.send(JSON.stringify({ kind: 'accept' }));
      } else if (msg.kind === 'done') {
        this.finishReceive();
      } else if (msg.kind === 'reject') {
        this.fail(`Receiver declined: ${msg.reason}`);
        this.record('cancelled', false);
      }
      return;
    }
    // Binary chunk
    if (!this.incomingMeta) return;
    const chunk = new Uint8Array(data as ArrayBuffer);
    this.parts.push(chunk);
    this.receivedBytes += chunk.byteLength;
    this.emit({ type: 'progress', bytes: this.receivedBytes, total: this.incomingMeta.size });
    if (this.receivedBytes >= this.incomingMeta.size) {
      // All expected bytes are in: verify immediately. Waiting for the
      // sender's "done" would deadlock (the sender waits for our ack first).
      void this.finishReceive();
    }
  }

  /** RECEIVER: verify integrity and hand the file over. */
  private async finishReceive(): Promise<void> {
    if (!this.incomingMeta) return;
    const meta = this.incomingMeta;
    this.incomingMeta = null;
    try {
      this.status('verifying');
      const merged = new Uint8Array(this.receivedBytes);
      let pos = 0;
      for (const p of this.parts) {
        merged.set(p, pos);
        pos += p.length;
      }
      this.parts = [];
      const digest = await sha256Of(merged);
      const verified = digest === meta.sha256;
      const blob = new Blob([merged.buffer as ArrayBuffer], { type: meta.mime || 'application/octet-stream' });
      this.emit({ type: 'received', blob, meta, verified });
      // Acknowledge verification to the sender (honest "verified" state both sides).
      try {
        this.channel?.send(JSON.stringify({ kind: 'ack', ok: verified, sha: digest }));
      } catch {
        /* channel may already be closing; the UI already has the result */
      }
      if (!verified) {
        this.fail('Integrity check failed: the received bytes did not match the sender\'s checksum.');
        this.record('failed', false);
        return;
      }
      this.status('completed', 'Transfer complete and verified.');
      this.record('completed', true);
    } catch (err) {
      this.fail(`Could not finish the received file: ${err instanceof Error ? err.message : 'unknown error'}`);
      this.record('failed', false);
    }
  }

  /** SENDER: send a file with backpressure and integrity metadata. */
  async sendFile(file: File): Promise<void> {
    const channel = this.channel;
    if (!channel || channel.readyState !== 'open') throw new Error('Wait for the connection to open first.');
    if (this.sending) throw new Error('A file is already being sent.');
    this.sending = true;
    this.startedAt = Date.now();
    this.currentName = file.name;
    this.totalBytes = file.size;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const sha256 = await sha256Of(buf);
      const meta: FileMeta = { name: file.name, size: file.size, mime: file.type || 'application/octet-stream', sha256 };
      channel.send(JSON.stringify({ kind: 'meta', meta }));
      this.status('transferring');
      let offset = 0;
      while (offset < file.size) {
        if (this.cancelled) {
          this.record('cancelled', false);
          throw new Error('CANCELLED');
        }
        if (channel.readyState !== 'open') throw new Error('Connection lost mid-transfer.');
        if (channel.bufferedAmount > BUFFER_HIGH) {
          await this.waitForDrain(channel);
          continue;
        }
        const end = Math.min(offset + CHUNK_SIZE, file.size);
        channel.send(buf.subarray(offset, end) as unknown as ArrayBuffer);
        offset = end;
        this.emit({ type: 'progress', bytes: offset, total: file.size });
      }
      // Wait for the receiver's final ack so "sent" is honest.
      const ack = await this.waitAck(channel);
      channel.send(JSON.stringify({ kind: 'done' }));
      this.status('completed', ack ? 'Transfer complete and verified.' : 'Transfer finished; integrity pending.');
      this.record('completed', ack);
      this.emit({ type: 'sent', verified: ack });
    } finally {
      this.sending = false;
    }
  }

  private ackResolve: ((v: boolean) => void) | null = null;

  private async waitAck(channel: RTCDataChannel): Promise<boolean> {
    // The receiver replies {kind:'ack', sha} after verification.
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 30000);
      this.ackResolve = (verified) => {
        clearTimeout(timeout);
        resolve(verified);
      };
      if (!this.ackHandlerInstalled) {
        this.ackHandlerInstalled = true;
        channel.addEventListener('message', (e) => {
          if (typeof e.data === 'string' && e.data.includes('"kind":"ack"')) {
            this.ackResolve?.(e.data.includes('"ok":true'));
          }
        });
      }
    });
  }
  private ackHandlerInstalled = false;

  private waitForDrain(channel: RTCDataChannel): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        channel.removeEventListener('bufferedamountlow', done);
        clearInterval(timer);
        resolve();
      };
      // A closed/cancelled channel never fires bufferedamountlow and its
      // bufferedAmount never drains - unblock so cancel/disconnect cannot hang.
      const check = () => {
        if (channel.bufferedAmount <= BUFFER_LOW || channel.readyState !== 'open') done();
      };
      channel.bufferedAmountLowThreshold = BUFFER_LOW;
      channel.addEventListener('bufferedamountlow', done);
      // Safety poll in case the event never fires.
      const timer = setInterval(check, 250);
      setTimeout(() => clearInterval(timer), 60000);
    });
  }

  private fail(message: string) {
    if (this.cancelled) return;
    this.status('failed', message);
    this.emit({ type: 'error', message });
  }

  private record(status: 'completed' | 'cancelled' | 'failed', verified: boolean) {
    if (!this.currentName) return;
    addTransferRecord({
      id: `tf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: this.role,
      fileName: this.currentName,
      fileSize: this.role === 'sender' ? this.totalBytes : this.receivedBytes,
      status,
      integrityVerified: verified,
      startedAt: this.startedAt || Date.now(),
      endedAt: Date.now(),
    });
  }

  cancel(): void {
    this.cancelled = true;
    try {
      this.channel?.close();
      this.pc?.close();
    } catch {
      /* already closed */
    }
    this.status('cancelled');
  }

  close(): void {
    try {
      this.channel?.close();
      this.pc?.close();
    } catch {
      /* already closed */
    }
  }
}

