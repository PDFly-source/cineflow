import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkCount,
  isSha256Hex,
  sha256Of,
  normalizeSignalCode,
  encodeSignal,
  decodeSignal,
  looksLikeSignalCode,
  CHUNK_SIZE,
  BUFFER_HIGH,
  BUFFER_LOW,
} from '../lib/transfer/p2p.ts';

test('chunkCount computes honest chunk math', () => {
  assert.equal(chunkCount(0), 0);
  assert.equal(chunkCount(1), 1);
  assert.equal(chunkCount(CHUNK_SIZE), 1);
  assert.equal(chunkCount(CHUNK_SIZE + 1), 2);
  assert.equal(chunkCount(5 * CHUNK_SIZE), 5);
  assert.equal(chunkCount(10 * 1024 * 1024), Math.ceil((10 * 1024 * 1024) / CHUNK_SIZE));
});

test('backpressure thresholds are ordered and sane', () => {
  assert.ok(BUFFER_LOW < BUFFER_HIGH, 'resume threshold below pause threshold');
  assert.ok(CHUNK_SIZE <= BUFFER_LOW, 'chunk smaller than resume threshold');
});

test('isSha256Hex validates format strictly', () => {
  const good = 'a'.repeat(64);
  assert.equal(isSha256Hex(good), true);
  assert.equal(isSha256Hex(good.toUpperCase()), true);
  assert.equal(isSha256Hex('a'.repeat(63)), false);
  assert.equal(isSha256Hex('a'.repeat(65)), false);
  assert.equal(isSha256Hex('z'.repeat(64)), false, 'non-hex chars rejected');
  assert.equal(isSha256Hex(''), false);
});

test('sha256Of matches known digests and is lowercase hex', async () => {
  // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  const empty = await sha256Of(new Uint8Array(0));
  assert.equal(empty, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
  const abc = await sha256Of(new TextEncoder().encode('abc'));
  assert.equal(abc, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(isSha256Hex(abc), true);
});

test('signal codes round-trip and reject garbage', () => {
  const desc = {
    type: 'offer' as RTCSdpType,
    sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\na=ice-ufrag:abcd\r\na=fingerprint:sha-256 AA:BB\r\n',
  };
  const code = encodeSignal(desc);
  assert.ok(code.length > 100, 'code is compact but substantial');
  const back = decodeSignal(code);
  assert.ok(back);
  assert.equal(back.type, 'offer');
  assert.equal(back.sdp, desc.sdp);

  // Whitespace/newlines in pasted codes are tolerated.
  const spaced = code.slice(0, 50) + '\n  ' + code.slice(50);
  assert.equal(decodeSignal(spaced)?.type, 'offer');

  assert.equal(decodeSignal('not a code'), null);
  assert.equal(decodeSignal(''), null);
  assert.equal(looksLikeSignalCode('shortstring'), false);
  assert.equal(looksLikeSignalCode(code), true);
});
