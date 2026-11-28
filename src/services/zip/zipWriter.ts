import { crc32 } from './crc32';

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

const MAX_ENTRIES = 0xffff;
const MAX_U32 = 0xffffffff;

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

const DOS_TIME = 0x0000;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

const CONTENT_TYPES = '[Content_Types].xml';

const ASCII_NAME = /^[\x20-\x7e]+$/;

async function deflateViaCompressionStream(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  void writer.write(data as Uint8Array<ArrayBuffer>).catch(() => {});
  void writer.close().catch(() => {});

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) { out.set(chunk, pos); pos += chunk.length; }
  return out;
}

function assertWritableName(name: string): void {
  if (!ASCII_NAME.test(name)) {
    throw new Error(`ZIP-entrynaam moet printbare ASCII zijn: ${JSON.stringify(name)}`);
  }
  if (name.startsWith('/') || name.includes('\\')) {
    throw new Error(`Onveilige ZIP-entrynaam: ${JSON.stringify(name)}`);
  }
}

interface PreparedEntry {
  nameBytes: Uint8Array;
  method: number;
  crc: number;
  comp: Uint8Array;
  uncompressedSize: number;
}

export async function writeZip(
  files: readonly ZipFileInput[],
  opts: { deflate?: ((data: Uint8Array) => Promise<Uint8Array>) | null } = {},
): Promise<Uint8Array> {
  if (files.length > MAX_ENTRIES) {
    throw new Error(`ZIP kan maximaal ${MAX_ENTRIES} entries dragen, niet ${files.length}`);
  }

  const deflate = opts.deflate === undefined
    ? (typeof CompressionStream !== 'undefined' ? deflateViaCompressionStream : null)
    : opts.deflate;

  const ordered = [
    ...files.filter((file) => file.name === CONTENT_TYPES),
    ...files.filter((file) => file.name !== CONTENT_TYPES),
  ];

  const seen = new Set<string>();
  const prepared: PreparedEntry[] = [];
  for (const file of ordered) {
    assertWritableName(file.name);
    if (seen.has(file.name)) throw new Error(`Dubbele ZIP-entrynaam: ${JSON.stringify(file.name)}`);
    seen.add(file.name);
    if (file.data.length > MAX_U32) {
      throw new Error(`ZIP-entry "${file.name}" is te groot voor een 32-bits ZIP`);
    }

    let method = 0;
    let comp: Uint8Array = file.data;
    if (deflate && file.data.length > 0) {
      const deflated = await deflate(file.data);
      if (deflated.length < file.data.length) {
        method = 8;
        comp = deflated;
      }
    }

    prepared.push({
      nameBytes: new TextEncoder().encode(file.name),
      method,
      crc: crc32(file.data),
      comp,
      uncompressedSize: file.data.length,
    });
  }

  const localSize = prepared.reduce((sum, e) => sum + 30 + e.nameBytes.length + e.comp.length, 0);
  const centralSize = prepared.reduce((sum, e) => sum + 46 + e.nameBytes.length, 0);
  if (localSize > MAX_U32 || localSize + centralSize + 22 > MAX_U32) {
    throw new Error('ZIP is te groot voor het 32-bits formaat');
  }

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);

  const localOffsets: number[] = [];
  let pos = 0;
  for (const entry of prepared) {
    localOffsets.push(pos);
    view.setUint32(pos, SIG_LOCAL, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 0, true);
    view.setUint16(pos + 8, entry.method, true);
    view.setUint16(pos + 10, DOS_TIME, true);
    view.setUint16(pos + 12, DOS_DATE, true);
    view.setUint32(pos + 14, entry.crc, true);
    view.setUint32(pos + 18, entry.comp.length, true);
    view.setUint32(pos + 22, entry.uncompressedSize, true);
    view.setUint16(pos + 26, entry.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);
    out.set(entry.nameBytes, pos + 30);
    out.set(entry.comp, pos + 30 + entry.nameBytes.length);
    pos += 30 + entry.nameBytes.length + entry.comp.length;
  }

  const cdStart = pos;
  prepared.forEach((entry, index) => {
    view.setUint32(pos, SIG_CENTRAL, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, 0, true);
    view.setUint16(pos + 10, entry.method, true);
    view.setUint16(pos + 12, DOS_TIME, true);
    view.setUint16(pos + 14, DOS_DATE, true);
    view.setUint32(pos + 16, entry.crc, true);
    view.setUint32(pos + 20, entry.comp.length, true);
    view.setUint32(pos + 24, entry.uncompressedSize, true);
    view.setUint16(pos + 28, entry.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true);
    view.setUint16(pos + 32, 0, true);
    view.setUint16(pos + 34, 0, true);
    view.setUint16(pos + 36, 0, true);
    view.setUint32(pos + 38, 0, true);
    view.setUint32(pos + 42, localOffsets[index], true);
    out.set(entry.nameBytes, pos + 46);
    pos += 46 + entry.nameBytes.length;
  });

  view.setUint32(pos, SIG_EOCD, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, prepared.length, true);
  view.setUint16(pos + 10, prepared.length, true);
  view.setUint32(pos + 12, centralSize, true);
  view.setUint32(pos + 16, cdStart, true);
  view.setUint16(pos + 20, 0, true);

  return out;
}
