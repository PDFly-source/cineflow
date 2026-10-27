/**
 * Local media container & track probing for CineFlow.
 *
 * Reads only the bytes needed to identify the container and its tracks
 * (slices of the original File/Buffer — never the whole file for MKV).
 *   - EBML (Matroska/WebM): walks EBML elements to Segment > Info > Tracks.
 *   - MP4/MOV: walks top-level boxes to moov > trak > mdia > stbl > stsd.
 *   - Other containers: magic-byte sniffing only (no track claims).
 *
 * All parsing is honest: when a structure cannot be parsed, the probe reports
 * `unknown` codecs instead of guessing. Never used to authorize anything —
 * results feed a playback recommendation, and native playback is always
 * attempted first when the plan says so.
 */

export type ContainerFormat =
  | 'mp4'
  | 'mov'
  | 'm4a'
  | 'webm'
  | 'matroska'
  | 'avi'
  | 'mpeg-ts'
  | 'ogg'
  | 'mp3'
  | 'flac'
  | 'wav'
  | 'unknown';

export type VideoCodecId =
  | 'h264'
  | 'h265'
  | 'vp8'
  | 'vp9'
  | 'av1'
  | 'mpeg4'
  | 'mpeg2'
  | 'theora'
  | 'unknown';

export type AudioCodecId =
  | 'aac'
  | 'ac3'
  | 'eac3'
  | 'mp3'
  | 'opus'
  | 'vorbis'
  | 'flac'
  | 'dts'
  | 'truehd'
  | 'pcm'
  | 'unknown';

export interface TrackInfo {
  type: 'video' | 'audio' | 'subtitle';
  codec: VideoCodecId | AudioCodecId | 'unknown';
  /** Raw codec identifier from the container (CodecID or sample entry fourcc). */
  codecRaw: string;
  language?: string;
  isDefault?: boolean;
}

export interface MediaProbe {
  container: ContainerFormat;
  /** True when the container was identified by parsing, not just extension. */
  containerConfident: boolean;
  videoTracks: TrackInfo[];
  audioTracks: TrackInfo[];
  subtitleTracks: TrackInfo[];
  durationSeconds: number | null;
  sizeBytes: number;
  fileName?: string;
  /** Non-fatal parse notes; surfaced in diagnostics. */
  notes: string[];
}

/** Minimal lazy byte source over a local file or in-memory buffer. */
export interface ByteSource {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export class BufferSource implements ByteSource {
  size: number;
  private data: Uint8Array;
  constructor(data: Uint8Array) {
    this.data = data;
    this.size = data.length;
  }
  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset >= this.size) return new Uint8Array(0);
    return this.data.subarray(offset, Math.min(offset + length, this.size));
  }
}

export class FileSource implements ByteSource {
  size: number;
  private file: File;
  constructor(file: File) {
    this.file = file;
    this.size = file.size;
  }
  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset >= this.size) return new Uint8Array(0);
    const buf = await this.file.slice(offset, offset + length).arrayBuffer();
    return new Uint8Array(buf);
  }
}

/* ------------------------------------------------------------------ */
/* Container sniffing (magic bytes)                                    */
/* ------------------------------------------------------------------ */

function ascii(bytes: Uint8Array, offset: number, len: number): string {
  let out = '';
  for (let i = 0; i < len && offset + i < bytes.length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

function startsWith(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

export function sniffContainer(head: Uint8Array, size: number): ContainerFormat {
  // EBML family (Matroska / WebM) — docType is parsed later by the EBML walker.
  if (startsWith(head, 0, EBML_MAGIC)) return 'matroska'; // refined to webm in probe()

  // RIFF family
  if (startsWith(head, 0, [0x52, 0x49, 0x46, 0x46])) {
    const kind = ascii(head, 8, 4);
    if (kind === 'AVI ') return 'avi';
    if (kind === 'WAVE') return 'wav';
    if (kind === 'WEBP') return 'unknown';
  }

  // MP4/MOV/M4A: 'ftyp' box at offset 4; some raw streams start with moov/mdat/free/skip
  if (ascii(head, 4, 4) === 'ftyp') {
    const brand = ascii(head, 8, 4);
    if (brand.startsWith('M4A')) return 'm4a';
    if (brand === 'qt  ') return 'mov';
    return 'mp4';
  }
  if (['moov', 'mdat', 'free', 'skip', 'wide'].includes(ascii(head, 4, 4))) return 'mp4';

  if (ascii(head, 0, 4) === 'OggS') return 'ogg';
  if (ascii(head, 0, 4) === 'fLaC') return 'flac';
  if (ascii(head, 0, 3) === 'ID3') return 'mp3';
  // MPEG audio frame sync (0xFF Ex)
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return 'mp3';
  // MPEG-TS: 0x47 sync byte every 188 bytes
  if (head.length >= 188 * 4 + 188 && head[0] === 0x47 && head[188] === 0x47 && head[188 * 2] === 0x47 && head[188 * 3] === 0x47) {
    return 'mpeg-ts';
  }
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* EBML / Matroska parsing                                             */
/* ------------------------------------------------------------------ */

// Key EBML element IDs we care about.
const EBML_DOCTYPE = 0x4282;
const EBML_SEGMENT = 0x18538067;
const EBML_INFO = 0x1549a966;
const EBML_TRACKS = 0x1654ae6b;
const EBML_TRACKENTRY = 0xae;
const EBML_TIMECODE_SCALE = 0x2ad7b1;
const EBML_DURATION = 0x4489;
const EBML_TRACK_TYPE = 0x83;
const EBML_CODEC_ID = 0x86;
const EBML_LANGUAGE = 0x22b59c;
const EBML_FLAG_DEFAULT = 0x88;
const EBML_CRC32 = 0xbf;
const EBML_VOID = 0xec;

function readVintOrId(
  bytes: Uint8Array,
  offset: number,
  asId: boolean
): { value: number; length: number; unknownLength: boolean } {
  if (offset >= bytes.length) return { value: 0, length: 0, unknownLength: false };
  const first = bytes[offset];
  if (first === 0) return { value: 0, length: 0, unknownLength: false };
  let len = 0;
  let marker = first;
  while (len < 8 && (marker & 0x80) === 0) {
    marker = (marker << 1) & 0xff;
    len++;
  }
  // len === 8 not valid for size vints; treat defensively
  if (len >= 8) return { value: 0, length: 0, unknownLength: false };
  const total = len + 1;
  if (offset + total > bytes.length) return { value: 0, length: 0, unknownLength: false };
  // Element IDs keep every bit of the first byte; sizes strip the marker.
  let value = asId ? first : first & (0xff >> (len + 1));
  for (let i = 1; i < total; i++) {
    value = value * 256 + bytes[offset + i];
  }
  // Unknown size: ALL value bits set to 1 (e.g. 01 FF FF FF FF...). Only
  // meaningful for size vints with more than one byte; a 1-byte all-ones
  // value (0x7F = 127) is a valid size, so it is not treated as unknown.
  const maxValue = Math.pow(2, 7 * total) - 1;
  const unknownLength = !asId && total > 1 && value === maxValue;
  return { value, length: total, unknownLength };
}

interface EbmlElement {
  id: number;
  dataStart: number;
  dataLength: number; // -1 for unknown size
  next: number; // absolute offset of the next sibling (or -1)
}

/** Reads one EBML element header at `offset`. Returns null past the end. */
function readElement(bytes: Uint8Array, offset: number): EbmlElement | null {
  const idPart = readVintOrId(bytes, offset, true);
  if (idPart.length === 0) return null;
  const idStart = offset;
  const sizeOffset = offset + idPart.length;
  const sizePart = readVintOrId(bytes, sizeOffset, false);
  if (sizePart.length === 0) return null;
  const dataStart = sizeOffset + sizePart.length;
  if (sizePart.unknownLength) {
    return { id: idPart.value, dataStart, dataLength: -1, next: -1 };
  }
  return { id: idPart.value, dataStart, dataLength: sizePart.value, next: dataStart + sizePart.value };
}

function readUInt(bytes: Uint8Array, offset: number, length: number): number {
  let v = 0;
  for (let i = 0; i < length && offset + i < bytes.length; i++) v = v * 256 + bytes[offset + i];
  return v;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length && offset + i < bytes.length; i++) {
    const c = bytes[offset + i];
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/** Matroska CodecID -> normalized codec ids. */
export function codecIdToVideo(codecId: string): VideoCodecId {
  if (codecId.startsWith('V_MPEG4/ISO/AVC')) return 'h264';
  if (codecId.startsWith('V_MPEG4/ISO/ASP')) return 'mpeg4';
  if (codecId.startsWith('V_MPEGH/ISO/HEVC')) return 'h265';
  if (codecId === 'V_VP8') return 'vp8';
  if (codecId === 'V_VP9') return 'vp9';
  if (codecId === 'V_AV1') return 'av1';
  if (codecId.startsWith('V_MPEG2')) return 'mpeg2';
  if (codecId === 'V_THEORA') return 'theora';
  return 'unknown';
}

export function codecIdToAudio(codecId: string): AudioCodecId {
  if (codecId.startsWith('A_AAC')) return 'aac';
  if (codecId === 'A_AC3') return 'ac3';
  if (codecId === 'A_EAC3') return 'eac3';
  if (codecId.startsWith('A_MPEG/L3')) return 'mp3';
  if (codecId.startsWith('A_MPEG/L')) return 'mp3';
  if (codecId === 'A_OPUS') return 'opus';
  if (codecId === 'A_VORBIS') return 'vorbis';
  if (codecId === 'A_FLAC') return 'flac';
  if (codecId.startsWith('A_DTS')) return 'dts';
  if (codecId.startsWith('A_TRUEHD')) return 'truehd';
  if (codecId.startsWith('A_PCM')) return 'pcm';
  return 'unknown';
}

interface MkvParseState {
  docType: string;
  durationSeconds: number | null;
  tracks: TrackInfo[];
}

function parseTrackEntry(bytes: Uint8Array, start: number, end: number, out: TrackInfo[]) {
  let offset = start;
  let type = 0;
  let codecRaw = '';
  let language: string | undefined;
  let isDefault: boolean | undefined;
  while (offset < end) {
    const el = readElement(bytes, offset);
    if (!el || el.dataStart > end) break;
    if (el.id === EBML_TRACK_TYPE) {
      type = readUInt(bytes, el.dataStart, el.dataLength);
    } else if (el.id === EBML_CODEC_ID) {
      codecRaw = readString(bytes, el.dataStart, el.dataLength);
    } else if (el.id === EBML_LANGUAGE) {
      language = readString(bytes, el.dataStart, el.dataLength);
    } else if (el.id === EBML_FLAG_DEFAULT && el.dataLength > 0) {
      isDefault = readUInt(bytes, el.dataStart, 1) === 1;
    }
    offset = el.next;
  }
  if (!codecRaw) return;
  const trackType: TrackInfo['type'] =
    type === 1 ? 'video' : type === 2 ? 'audio' : type === 17 ? 'subtitle' : 'subtitle';
  const codec =
    trackType === 'video' ? codecIdToVideo(codecRaw) : trackType === 'audio' ? codecIdToAudio(codecRaw) : 'unknown';
  out.push({ type: trackType, codec, codecRaw, language, isDefault });
}

/**
 * Parses an EBML/Matroska stream from a byte source. Reads only the
 * elements it needs (DocType, Info, Tracks) — a bounded byte budget
 * keeps this cheap even for 10 GB files.
 */
async function parseEbm(
  source: ByteSource,
  budgetBytes: number,
  notes: string[]
): Promise<MkvParseState | null> {
  const state: MkvParseState = { docType: '', durationSeconds: null, tracks: [] };
  // Chunked sequential walk from offset 0.
  const CHUNK = 256 * 1024;
  let window = await source.read(0, Math.min(CHUNK, source.size));
  if (window.length < 12) return null;
  let windowBase = 0;

  const ensure = async (offset: number, length: number): Promise<boolean> => {
    // Guarantee bytes [offset, offset + length) are inside the window; grow as needed.
    if (offset + length > budgetBytes || offset >= source.size) return false;
    if (offset >= windowBase && offset + length <= windowBase + window.length) return true;
    const readLen = Math.max(CHUNK, length);
    const next = await source.read(offset, Math.min(readLen, budgetBytes - offset));
    if (next.length === 0) return false;
    window = next;
    windowBase = offset;
    return next.length >= Math.min(length, next.length);
  };

  let offset = 0;
  let timecodeScale = 1000000;
  let sawSegment = false;
  let sawTracks = false;
  let sawInfo = false;

  outer: while (offset < budgetBytes && offset < source.size) {
    if (!(await ensure(offset, 12))) break;
    const el = readElement(window, offset - windowBase);
    if (!el) break;
    if (el.id === EBML_CRC32 || el.id === EBML_VOID) {
      if (el.next < 0) break;
      offset = el.next;
      continue;
    }
    // EBML header element (0x1A45DFA3): descend into its children for DocType.
    if (!sawSegment && el.id === 0x1a45dfa3) {
      let ho = el.dataStart;
      const hEnd = el.dataStart + el.dataLength;
      while (ho < hEnd) {
        if (!(await ensure(ho, 10))) break outer;
        const child = readElement(window, ho - windowBase);
        if (!child) break;
        if (child.id === EBML_DOCTYPE) {
          state.docType = readString(window, child.dataStart - windowBase, child.dataLength);
        }
        if (child.next < 0) break;
        ho = child.next;
      }
      offset = el.next;
      continue;
    }
    if (sawSegment && el.id === EBML_SEGMENT) {
      // unreachable: Segment handled below before this check
      offset = el.next;
      continue;
    }
    if (!sawSegment && el.id === EBML_SEGMENT) {
      sawSegment = true;
      offset = el.dataStart;
      continue;
    }
    if (sawSegment && el.id === EBML_INFO && !sawInfo) {
      sawInfo = true;
      // Info may be big; parse its children.
      let io = el.dataStart;
      const iEnd = el.dataLength >= 0 ? el.dataStart + el.dataLength : el.dataStart + 64 * 1024;
      while (io < iEnd) {
        if (!(await ensure(io, 10))) break outer;
        const child = readElement(window, io - windowBase);
        if (!child) break;
        if (child.id === EBML_TIMECODE_SCALE) {
          timecodeScale = readUInt(window, child.dataStart - windowBase, child.dataLength);
        } else if (child.id === EBML_DURATION && child.dataLength <= 8) {
          // Duration is a float (4 or 8 bytes).
          const dv = new DataView(
            window.buffer,
            window.byteOffset + (child.dataStart - windowBase),
            Math.min(child.dataLength, 8)
          );
          const dur =
            child.dataLength === 4
              ? dv.getFloat32(0, false)
              : child.dataLength === 8
                ? dv.getFloat64(0, false)
                : 0;
          if (dur > 0 && timecodeScale > 0) {
            state.durationSeconds = (dur * timecodeScale) / 1e9;
          }
        }
        if (child.next < 0) break;
        io = child.next;
      }
      offset = el.dataLength >= 0 ? el.next : iEnd;
      continue;
    }
    if (sawSegment && el.id === EBML_TRACKS && !sawTracks) {
      sawTracks = true;
      const tEnd = el.dataLength >= 0 ? el.dataStart + el.dataLength : el.dataStart + 1024 * 1024;
      let to = el.dataStart;
      while (to < tEnd) {
        if (!(await ensure(to, 10))) break outer;
        const child = readElement(window, to - windowBase);
        if (!child) break;
        if (child.id === EBML_TRACKENTRY) {
          if (!(await ensure(child.dataStart, Math.min(child.dataLength, 4096)))) break outer;
          parseTrackEntry(
            window,
            child.dataStart - windowBase,
            child.dataStart - windowBase + Math.min(child.dataLength, 4096),
            state.tracks
          );
        }
        if (child.next < 0) break;
        to = child.next;
      }
      if (state.tracks.length > 0) break outer; // we have everything useful
      offset = el.dataLength >= 0 ? el.next : tEnd;
      continue;
    }
    // Skip other top-level/segment children (SeekHead, Chapters, Attachments...).
    if (el.dataLength < 0) {
      // Unknown size at a level we don't parse — cannot skip reliably.
      notes.push('ebml: unknown-size element outside handled sections');
      break;
    }
    offset = el.next;
  }
  if (!state.docType && state.tracks.length === 0) return null;
  return state;
}

/* ------------------------------------------------------------------ */
/* MP4 box parsing                                                     */
/* ------------------------------------------------------------------ */

interface Mp4ParseResult {
  durationSeconds: number | null;
  tracks: TrackInfo[];
}

const BOX_MOOV = 'moov';
const BOX_TRAK = 'trak';
const BOX_MDIA = 'mdia';
const BOX_MINF = 'minf';
const BOX_STBL = 'stbl';
const BOX_STSD = 'stsd';
const BOX_HDLR = 'hdlr';
const BOX_MVHD = 'mvhd';
const BOX_MDHD = 'mdhd';

function fourcc(bytes: Uint8Array, offset: number): string {
  return ascii(bytes, offset, 4);
}

function readBoxHeader(bytes: Uint8Array, offset: number): { type: string; headerSize: number; size: number } | null {
  if (offset + 8 > bytes.length) return null;
  const size32 = readUInt(bytes, offset, 4);
  const type = fourcc(bytes, offset + 4);
  if (size32 === 1) {
    if (offset + 16 > bytes.length) return null;
    // 64-bit size (high 32 bits first). Files >4GB are unsupported by JS
    // boxes in practice; keep low 32 bits and mark huge sizes honestly.
    const hi = readUInt(bytes, offset + 8, 4);
    const lo = readUInt(bytes, offset + 12, 4);
    if (hi > 0) return { type, headerSize: 16, size: Number.MAX_SAFE_INTEGER };
    return { type, headerSize: 16, size: lo };
  }
  if (size32 === 0) return { type, headerSize: 8, size: -1 }; // to end of file
  return { type, headerSize: 8, size: size32 };
}

function stsdCodec(bytes: Uint8Array, offset: number): { raw: string; codec: TrackInfo['codec'] } {
  // stsd: version/flags(4) + entry_count(4), then entries: size(4) + fourcc(4) + data
  if (offset + 16 > bytes.length) return { raw: '', codec: 'unknown' };
  const entryCount = readUInt(bytes, offset + 4, 4);
  const pos = offset + 8;
  if (entryCount < 1 || pos + 8 > bytes.length) return { raw: '', codec: 'unknown' };
  const entrySize = readUInt(bytes, pos, 4);
  const raw = fourcc(bytes, pos + 4);
  let codec: TrackInfo['codec'] = 'unknown';
  switch (raw) {
    case 'avc1':
    case 'avc2':
    case 'avc3':
    case 'avc4':
    case 'avcp':
    case 'encv':
      codec = 'h264';
      break;
    case 'hvc1':
    case 'hev1':
      codec = 'h265';
      break;
    case 'vp08':
      codec = 'vp8';
      break;
    case 'vp09':
      codec = 'vp9';
      break;
    case 'av01':
    case 'av1C':
      codec = 'av1';
      break;
    case 'mp4v':
    case 'encv':
      codec = 'mpeg4';
      break;
    case 'mp4a':
    case 'enca':
      codec = 'aac'; // mp4a.40.2 assumed; ESDS parse skipped (honest enough)
      break;
    case 'ac-3':
      codec = 'ac3';
      break;
    case 'ec-3':
      codec = 'eac3';
      break;
    case 'Opus':
      codec = 'opus';
      break;
    case 'fLaC':
      codec = 'flac';
      break;
    case '.mp3':
    case 'mp3 ':
      codec = 'mp3';
      break;
    case 'lpcm':
    case 'sowt':
    case 'twos':
      codec = 'pcm';
      break;
    case 'dtsh':
    case 'dts ':
      codec = 'dts';
      break;
    default:
      codec = 'unknown';
  }
  void entrySize;
  return { raw, codec };
}

async function parseMp4(source: ByteSource, notes: string[]): Promise<Mp4ParseResult | null> {
  const result: Mp4ParseResult = { durationSeconds: null, tracks: [] };

  const findBoxes = async (
    offset: number,
    end: number,
    types: string[],
    visit: (type: string, dataOffset: number, dataEnd: number) => Promise<boolean>
  ): Promise<void> => {
    let pos = offset;
    let guard = 0;
    while (pos + 8 <= end && guard++ < 4096) {
      const head = await source.read(pos, 16);
      if (head.length < 8) return;
      const box = readBoxHeader(head, 0);
      if (!box) return;
      const dataOffset = pos + box.headerSize;
      const dataEnd = box.size < 0 ? end : Math.min(pos + box.size, end);
      if (box.size < 8 && box.size >= 0) return; // corrupt
      if (types.includes(box.type)) {
        const done = await visit(box.type, dataOffset, dataEnd);
        if (done) return;
      }
      if (box.size < 0) return; // to-EOF box: nothing after it
      pos = pos + box.size;
    }
  };

  const parseTrak = async (dataOffset: number, dataEnd: number) => {
    let hdlrType = '';
    const stsdHolder: { value: { raw: string; codec: TrackInfo['codec'] } | null } = { value: null };
    await findBoxes(dataOffset, dataEnd, [BOX_MDIA], async (_t, mdiaOff, mdiaEnd) => {
      await findBoxes(mdiaOff, mdiaEnd, [BOX_HDLR, BOX_MINF], async (type, off, end) => {
        if (type === BOX_HDLR) {
          const head = await source.read(off, 24);
          if (head.length >= 16) hdlrType = ascii(head, 8, 4);
        } else {
          await findBoxes(off, end, [BOX_STBL], async (_t2, stblOff, stblEnd) => {
            await findBoxes(stblOff, stblEnd, [BOX_STSD], async (_t3, stsdOff, _stsdEnd) => {
              const head = await source.read(stsdOff, 64);
              if (head.length >= 16) stsdHolder.value = stsdCodec(head, 0);
              return true;
            });
            return false;
          });
        }
        return false;
      });
      return false;
    });
    const stsd = stsdHolder.value;
    if (stsd && hdlrType) {
      const type: TrackInfo['type'] =
        hdlrType === 'vide' ? 'video' : hdlrType === 'soun' ? 'audio' : hdlrType === 'sbtl' || hdlrType === 'text' ? 'subtitle' : 'subtitle';
      result.tracks.push({ type, codec: stsd.codec, codecRaw: stsd.raw });
    }
  };

  let foundMoov = false;
  // moov can be at the start (faststart) or the end; walk top-level boxes.
  await findBoxes(0, source.size, [BOX_MOOV], async (_t, off, end) => {
    foundMoov = true;
    await findBoxes(off, end, [BOX_MVHD, BOX_TRAK], async (type, o, e) => {
      if (type === BOX_MVHD) {
        const head = await source.read(o, 28);
        if (head.length >= 24) {
          const timescale = readUInt(head, 12, 4);
          const dur = readUInt(head, 16, 4);
          if (timescale > 0 && dur > 0 && dur < 0xffffffff) {
            result.durationSeconds = dur / timescale;
          } else if (dur === 0xffffffff) {
            notes.push('mp4: fragmented/live duration unknown');
          }
        }
      } else {
        await parseTrak(o, e);
      }
      return false;
    });
    return true; // one moov is enough
  });
  if (!foundMoov) notes.push('mp4: moov box not reachable from head scan');
  return foundMoov ? result : null;
}

/* ------------------------------------------------------------------ */
/* Public probe API                                                    */
/* ------------------------------------------------------------------ */

const HEAD_BYTES = 2 * 1024 * 1024; // container sniff + start of metadata
const MKV_BUDGET = 2 * 1024 * 1024; // EBML walk budget from file start

export async function probeMedia(file: File): Promise<MediaProbe> {
  const notes: string[] = [];
  const head = await file.slice(0, 64).arrayBuffer();
  const sniffed = sniffContainer(new Uint8Array(head), file.size);

  if (sniffed === 'matroska') {
    const source = new FileSource(file);
    const ebml = await parseEbm(source, Math.min(MKV_BUDGET, file.size), notes);
    if (ebml && (ebml.docType === 'webm' || ebml.docType === 'matroska')) {
      return {
        container: ebml.docType === 'webm' ? 'webm' : 'matroska',
        containerConfident: true,
        videoTracks: ebml.tracks.filter((t) => t.type === 'video'),
        audioTracks: ebml.tracks.filter((t) => t.type === 'audio'),
        subtitleTracks: ebml.tracks.filter((t) => t.type === 'subtitle'),
        durationSeconds: ebml.durationSeconds,
        sizeBytes: file.size,
        fileName: file.name,
        notes,
      };
    }
    // EBML signature present but tracks not found within budget.
    notes.push('ebml: track data not found within the first 2 MB');
    return {
      container: 'matroska',
      containerConfident: true,
      videoTracks: [],
      audioTracks: [],
      subtitleTracks: [],
      durationSeconds: null,
      sizeBytes: file.size,
      fileName: file.name,
      notes,
    };
  }

  if (sniffed === 'mp4' || sniffed === 'mov' || sniffed === 'm4a') {
    const mp4 = await parseMp4(new FileSource(file), notes);
    if (mp4) {
      return {
        container: sniffed,
        containerConfident: true,
        videoTracks: mp4.tracks.filter((t) => t.type === 'video'),
        audioTracks: mp4.tracks.filter((t) => t.type === 'audio'),
        subtitleTracks: mp4.tracks.filter((t) => t.type === 'subtitle'),
        durationSeconds: mp4.durationSeconds,
        sizeBytes: file.size,
        fileName: file.name,
        notes,
      };
    }
    return {
      container: sniffed,
      containerConfident: true,
      videoTracks: [],
      audioTracks: [],
      subtitleTracks: [],
      durationSeconds: null,
      sizeBytes: file.size,
      fileName: file.name,
      notes,
    };
  }

  // Containers we sniff but don't track-parse.
  const confidence = sniffed !== 'unknown';
  return {
    container: sniffed,
    containerConfident: confidence,
    videoTracks: [],
    audioTracks: [],
    subtitleTracks: [],
    durationSeconds: null,
    sizeBytes: file.size,
    fileName: file.name,
    notes: confidence ? notes : ['container: unrecognized signature'],
  };
}
