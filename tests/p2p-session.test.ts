/**
 * Regression tests for TransferSession over a MOCK WebRTC wire.
 * No real network is involved: two mock RTCPeerConnections are wired
 * together in-memory, exercising the real protocol code:
 * meta -> chunks (backpressure) -> SHA-256 verify -> ack -> done.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// --- localStorage mock (transfer history persistence) ---
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  },
};

type Listener = (ev: { data: unknown }) => void;

class MockChannel {
  readyState = 'connecting';
  binaryType = 'blob';
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  onopen: (() => void) | null = null;
  onmessage: Listener | null = null;
  onclose: (() => void) | null = null;
  listeners = new Map<string, Set<(ev: { data: unknown }) => void>>();
  private peer: MockChannel | null = null;

  pairWith(peer: MockChannel) {
    this.peer = peer;
    peer.peer = this;
  }

  addEventListener(type: string, cb: (ev: { data: unknown }) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb as (ev: { data: unknown }) => void);
  }

  removeEventListener(type: string, cb: (ev: { data: unknown }) => void) {
    this.listeners.get(type)?.delete(cb as (ev: { data: unknown }) => void);
  }

  open() {
    this.readyState = 'open';
    this.onopen?.();
    setTimeout(() => this.peer && this.peer.readyState === 'open' && this.peer.onopen?.(), 0);
  }

  send(data: unknown) {
    const d = data;
    setTimeout(() => {
      if (this.peer && this.peer.readyState === 'open') {
        this.peer.onmessage?.({ data: d });
        this.peer.listeners.get('message')?.forEach((cb) => cb({ data: d }));
      }
    }, 0);
  }

  close() {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    this.onclose?.();
    setTimeout(() => {
      if (!this.peer) return;
      this.peer.onclose?.();
      this.peer.listeners.get('close')?.forEach((cb) => cb({ data: null }));
    }, 0);
  }
}

class MockPC {
  static registry: MockPC[] = [];
  localDescription: { type: string; sdp: string } | null = null;
  connectionState = 'new';
  iceGatheringState = 'complete';
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((e: { channel: MockChannel }) => void) | null = null;
  private channel: MockChannel | null = null;
  private remoteSet = false;
  private static current: MockPC | null = null;

  constructor() {
    MockPC.registry.push(this);
    MockPC.current = this;
    setTimeout(() => this.maybeConnect(), 10);
  }

  createDataChannel() {
    this.channel = new MockChannel();
    return this.channel;
  }

  async createOffer() {
    return { type: 'offer' as const, sdp: 'v=0\r\na=ice-ufrag:x\r\na=fingerprint:sha-256 AA:BB\r\n' };
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'v=0\r\na=ice-ufrag:y\r\na=fingerprint:sha-256 CC:DD\r\n' };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription() {
    this.remoteSet = true;
    this.maybeConnect();
  }
  addEventListener() {}
  removeEventListener() {}

  private maybeConnect() {
    if (this.remoteSet && this.localDescription && this.connectionState !== 'connected') {
      this.connectionState = 'connected';
      this.onconnectionstatechange?.();
    }
  }

  /** Wire the sender's data channel to the receiver's ondatachannel handler. */
  static link() {
    const [a, b] = MockPC.registry;
    assert.ok(a?.channel, 'sender channel exists');
    const chanB = new MockChannel();
    a.channel!.pairWith(chanB);
    chanB.pairWith(a.channel!);
    b.ondatachannel?.({ channel: chanB });
    a.channel!.open();
    chanB.open();
  }

  close() {
    this.connectionState = 'closed';
  }
}

(globalThis as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = MockPC;

const lib = async () => await import('../lib/transfer/p2pSession.ts');
const p2p = async () => await import('../lib/transfer/p2p.ts');

type Events = Array<{ kind: string; payload?: unknown }>;

function makeFile(bytes: number): File {
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) arr[i] = i % 251;
  return new File([arr], 'test-video.webm', { type: 'video/webm' });
}

async function setupPair() {
  const { TransferSession } = await lib();
  MockPC.registry = [];
  const senderEvents: Events = [];
  const receiverEvents: Events = [];

  const sender = new TransferSession({
    role: 'sender',
    onEvent: (e) => senderEvents.push({ kind: e.type, payload: e }),
  });
  const receiver = new TransferSession({
    role: 'receiver',
    onEvent: (e) => receiverEvents.push({ kind: e.type, payload: e }),
  });

  await sender.createOffer();
  const offerCode = senderEvents.find((e) => e.kind === 'signal-ready')!.payload;
  const offer = (offerCode as unknown as { code: string }).code;

  await receiver.acceptOffer(offer);
  const answerCode = receiverEvents.find((e) => e.kind === 'signal-ready')!.payload;
  const answer = (answerCode as unknown as { code: string }).code;

  await sender.acceptAnswer(answer);
  await new Promise((r) => setTimeout(r, 50));
  MockPC.link();
  await new Promise((r) => setTimeout(r, 50));

  return { sender, receiver, senderEvents, receiverEvents };
}

test('P2P: full transfer with SHA-256 verification, ack, and history record', async () => {
  store.clear();
  const { sender, receiver, senderEvents, receiverEvents } = await setupPair();
  const file = makeFile(300 * 1024); // 300 KB = 5 chunks

  const sendDone = sender.sendFile(file);
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (receiverEvents.some((e) => e.kind === 'received')) {
        clearInterval(timer);
        resolve();
      }
    }, 20);
  });
  await sendDone;

  const received = receiverEvents.find((e) => e.kind === 'received')!.payload as {
    meta: { name: string; size: number };
    verified: boolean;
    blob: Blob;
  };
  assert.equal(received.meta.name, 'test-video.webm');
  assert.equal(received.meta.size, 300 * 1024);
  assert.equal(received.verified, true, 'SHA-256 matched');

  // Byte-for-byte content check
  const got = new Uint8Array(await received.blob.arrayBuffer());
  const want = new Uint8Array(await file.arrayBuffer());
  assert.equal(got.length, want.length);
  for (let i = 0; i < want.length; i += 997) assert.equal(got[i], want[i]);

  const sent = senderEvents.find((e) => e.kind === 'sent')!.payload as { verified: boolean };
  assert.equal(sent.verified, true, 'sender got the verified ack');

  const { getTransferHistory } = await p2p();
  const history = getTransferHistory();
  assert.equal(history.length, 2, 'sender + receiver records');
  assert.ok(history.every((h) => h.status === 'completed' && h.integrityVerified));

  sender.close();
  receiver.close();
});

test('P2P: tampered chunk fails integrity with an honest error', async () => {
  store.clear();
  // Corrupt bytes in flight: wrap the receiver channel delivery.
  const { sender, receiver, senderEvents, receiverEvents } = await setupPair();
  void senderEvents;

  // Tamper: intercept receiver channel messages and flip a byte in binary data.
  const receiverChannel = (receiver as unknown as { channel: MockChannel }).channel;
  const realOnMessage = receiverChannel.onmessage!;
  receiverChannel.onmessage = (ev) => {
    if (typeof ev.data !== 'string' && ev.data instanceof Uint8Array) {
      const u8 = ev.data;
      u8[0] ^= 0xff; // flip one byte in flight
      ev = { data: u8 };
    }
    realOnMessage(ev);
  };

  const file = makeFile(128 * 1024);
  await sender.sendFile(file).catch(() => {
    /* sender may report failure after the receiver's NACK; both are fine */
  });
  await new Promise((r) => setTimeout(r, 100));

  const received = receiverEvents.find((e) => e.kind === 'received')!.payload as { verified: boolean };
  assert.equal(received.verified, false, 'mismatch detected');
  const err = receiverEvents.find((e) => e.kind === 'error');
  assert.ok(err, 'honest error emitted');
  const { getTransferHistory } = await p2p();
  const failed = getTransferHistory().filter((h) => h.status === 'failed');
  assert.ok(failed.length >= 1, 'failed session recorded, never marked completed');

  sender.close();
  receiver.close();
});

test('P2P: sender cancellation mid-transfer stops cleanly and is recorded as cancelled', async () => {
  store.clear();
  const { sender, receiver, senderEvents, receiverEvents } = await setupPair();
  const file = makeFile(1024 * 1024); // 1 MB = 16 chunks

  // Simulate backpressure: every sent chunk inflates bufferedAmount past the
  // 1 MB pause threshold, and a timer drains it periodically. The send loop
  // therefore emits about one chunk per 20ms, letting cancel land mid-transfer.
  const senderChannel = (sender as unknown as { channel: MockChannel }).channel;
  let fakeBuffered = 0;
  Object.defineProperty(senderChannel, 'bufferedAmount', { get: () => fakeBuffered });
  const realSend = senderChannel.send.bind(senderChannel);
  senderChannel.send = (data: unknown) => {
    const size = typeof data === 'string' ? data.length : (data as Uint8Array).byteLength;
    fakeBuffered += size * 40;
    realSend(data);
  };
  const drain = () => {
    if (senderChannel.readyState !== 'open') return;
    fakeBuffered = 0;
    senderChannel.listeners.get('bufferedamountlow')?.forEach((cb) => cb({ data: null }));
    setTimeout(drain, 20);
  };
  setTimeout(drain, 20);

  const sendPromise = sender.sendFile(file);
  // Cancel once at least two chunks went out.
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      const p = senderEvents.find(
        (e) => e.kind === 'progress' && (e.payload as { bytes: number }).bytes >= 128 * 1024
      );
      if (p) {
        clearInterval(timer);
        sender.cancel();
        resolve();
      }
    }, 5);
  });
  await sendPromise.catch(() => {
    /* CANCELLED rejection expected */
  });

  assert.ok(senderEvents.some((e) => e.kind === 'status' && (e.payload as { status: string }).status === 'cancelled'), 'cancellation surfaced to the sender UI');
  const { getTransferHistory } = await p2p();
  const senderRecord = getTransferHistory().find((h) => h.role === 'sender');
  assert.equal(senderRecord?.status, 'cancelled');
  assert.equal(senderRecord?.integrityVerified, false, 'never presented as verified');

  // Receiver must NOT have a completed record.
  const receiverRecord = getTransferHistory().filter((h) => h.role === 'receiver' && h.status === 'completed');
  assert.equal(receiverRecord.length, 0, 'no fake completion on the receiver side');
  void receiverEvents;
  receiver.close();
});

test('P2P: invalid answer code is rejected with a clear message', async () => {
  const { TransferSession } = await lib();
  const events: Events = [];
  const sender = new TransferSession({ role: 'sender', onEvent: (e) => events.push({ kind: e.type }) });
  await sender.createOffer();
  await assert.rejects(sender.acceptAnswer('garbage-code'), /does not look like a valid answer code/);
  assert.equal(events.some((e) => e.kind === 'received'), false);
  sender.close();
});
