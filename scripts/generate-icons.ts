import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPngBuffer(width: number, height: number, iconType: 'app' | 'maskable') {
  // RGBA 8-bit per channel
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.42;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background: Deep charcoal gradient (#0e131f to #171d2d)
      const gradT = y / height;
      let bgR = Math.round(14 + gradT * 9);
      let bgG = Math.round(19 + gradT * 10);
      let bgB = Math.round(31 + gradT * 14);

      // Icon: Play triangle + film reel arcs in violet & cyan
      // Play triangle coordinates
      // centered slightly shifted right
      const triWidth = width * 0.32;
      const triHeight = height * 0.34;
      const triLeft = cx - triWidth * 0.36;
      const triRight = cx + triWidth * 0.64;
      const triTop = cy - triHeight / 2;
      const triBottom = cy + triHeight / 2;

      let inTriangle = false;
      if (x >= triLeft && x <= triRight && y >= triTop && y <= triBottom) {
        const localX = (x - triLeft) / (triRight - triLeft);
        const halfHAtX = (1 - localX) * (triHeight / 2);
        if (Math.abs(y - cy) <= halfHAtX) {
          inTriangle = true;
        }
      }

      // Outer cinematic ring
      const ringOuter = width * 0.40;
      const ringInner = width * 0.36;
      const inRing = dist >= ringInner && dist <= ringOuter;

      if (inTriangle) {
        // Gradient from cyan (#06b6d4) to violet (#8b5cf6)
        const t = (x - triLeft) / triWidth;
        const rVal = Math.round(6 * (1 - t) + 139 * t);
        const gVal = Math.round(182 * (1 - t) + 92 * t);
        const bVal = Math.round(212 * (1 - t) + 246 * t);
        rawData[offset++] = rVal;
        rawData[offset++] = gVal;
        rawData[offset++] = bVal;
        rawData[offset++] = 255;
      } else if (inRing) {
        // Subtle glowing border
        rawData[offset++] = 99;
        rawData[offset++] = 102;
        rawData[offset++] = 241;
        rawData[offset++] = 220;
      } else {
        rawData[offset++] = bgR;
        rawData[offset++] = bgG;
        rawData[offset++] = bgB;
        rawData[offset++] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type: string, data: Buffer): Buffer {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcData);
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPngBuffer(192, 192, 'app'));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPngBuffer(512, 512, 'app'));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, 'app'));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPngBuffer(32, 32, 'app'));
console.log('Icons generated successfully.');
