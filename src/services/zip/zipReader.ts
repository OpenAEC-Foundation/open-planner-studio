import { crc32 } from './crc32';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export class ZipValidationError extends Error {
  readonly bytesSeen?: number;
  constructor(message: string, bytesSeen?: number) {
    super(message);
    this.name = 'ZipValidationError';
    this.bytesSeen = bytesSeen;
  }
}

export class ZipCompressionUnsupportedError extends ZipValidationError {
  constructor() {
    super('Compressie niet ondersteund in deze omgeving');
    this.name = 'ZipCompressionUnsupportedError';
  }
}

export type ZipInflate = (compressed: Uint8Array, budget: number) => Promise<Uint8Array>;

export interface ZipReadOptions {
  inflate?: ZipInflate | null;
}

export interface ZipReadLimits {
  maxEntryBytes: number;
  maxTotalBytes: number;
  maxEntries: number;
  maxRatio: number;
}

export const EXTENSION_ZIP_LIMITS: ZipReadLimits = {
  maxEntryBytes: 24 * 1024 * 1024,
  maxTotalBytes: 48 * 1024 * 1024,
  maxEntries: 2048,
  maxRatio: 200,
};

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_DATA_DESC = 0x08074b50;

const ZIP64_U32 = 0xffffffff;
const ZIP64_U16 = 0xffff;

function rejectZip64(): never {
  throw new ZipValidationError('Zip64 wordt niet ondersteund');
}

export async function inflateRawBounded(
  compressed: Uint8Array,
  budget: number,
): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new ZipCompressionUnsupportedError();
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  void writer.write(compressed as Uint8Array<ArrayBuffer>).catch(() => {});
  void writer.close().catch(() => {});

  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
    if (totalLen > budget) {
      await reader.cancel().catch(() => {});
      throw new ZipValidationError(
        `Uitgepakte ZIP-data overschrijdt het budget van ${budget} bytes`,
        totalLen,
      );
    }
  }
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

function resolveInflate(opts: ZipReadOptions | undefined): ZipInflate {
  if (opts?.inflate === null) return () => Promise.reject(new ZipCompressionUnsupportedError());
  if (opts?.inflate !== undefined) return opts.inflate;
  return typeof DecompressionStream === 'undefined'
    ? () => Promise.reject(new ZipCompressionUnsupportedError())
    : inflateRawBounded;
}

function entryBudget(
  limits: ZipReadLimits,
  alreadyUnpacked: number,
  compSize: number,
): { budget: number; ratioBudget: number } {
  const absolute = Math.min(limits.maxEntryBytes, limits.maxTotalBytes - alreadyUnpacked);
  const ratioBudget = compSize * limits.maxRatio;
  return { budget: Math.max(0, Math.min(absolute, ratioBudget)), ratioBudget };
}

async function decompressEntry(
  method: number,
  compressed: Uint8Array<ArrayBuffer>,
  limits: ZipReadLimits,
  alreadyUnpacked: number,
  name: string,
  inflate: ZipInflate,
): Promise<Uint8Array> {
  const { budget, ratioBudget } = entryBudget(limits, alreadyUnpacked, compressed.length);

  if (method === 0) {
    if (compressed.length > budget) {
      throw new ZipValidationError(
        `ZIP-entry "${name}" overschrijdt de uitpaklimiet van ${budget} bytes`,
        compressed.length,
      );
    }
    return compressed;
  }
  if (method !== 8) throw new Error(`Niet-ondersteunde compressiemethode: ${method}`);

  try {
    return await inflate(compressed, budget);
  } catch (err) {
    if (err instanceof ZipCompressionUnsupportedError) throw err;
    if (err instanceof ZipValidationError) {
      const label = budget === ratioBudget && ratioBudget < limits.maxEntryBytes
        ? `ZIP-entry "${name}" overschrijdt het compressie-ratio-plafond van ${limits.maxRatio}x`
        : `ZIP-entry "${name}" overschrijdt de uitpaklimiet van ${budget} bytes`;
      throw new ZipValidationError(label, err.bytesSeen);
    }
    throw err;
  }
}

function verifyEntryCrc(expected: number, data: Uint8Array, name: string): void {
  const actual = crc32(data);
  if (actual !== expected) {
    throw new ZipValidationError(
      `Beschadigd archief: de CRC-32 van ZIP-entry "${name}" klopt niet `
      + `(vastgelegd 0x${expected.toString(16)}, berekend 0x${actual.toString(16)})`,
    );
  }
}

function assertSafeZipEntryName(name: string): void {
  if (name.length === 0 || name.startsWith('/') || name.includes('\\') || name.includes('\0')) {
    throw new ZipValidationError(`Onveilige ZIP-entrynaam: ${JSON.stringify(name)}`);
  }
  const path = name.endsWith('/') ? name.slice(0, -1) : name;
  const segments = path.split('/');
  if (path.length === 0 || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new ZipValidationError(`Onveilige ZIP-entrynaam: ${JSON.stringify(name)}`);
  }
}

function addZipPayloadSize(current: number, size: number, name: string, limits: ZipReadLimits): number {
  if (size > limits.maxEntryBytes) {
    throw new ZipValidationError(
      `ZIP-entry "${name}" overschrijdt de limiet van ${limits.maxEntryBytes} bytes`,
    );
  }
  const next = current + size;
  if (next > limits.maxTotalBytes) {
    throw new ZipValidationError(`ZIP-payload overschrijdt de limiet van ${limits.maxTotalBytes} bytes`);
  }
  return next;
}

function normalizeZipEntries(entries: ZipEntry[], stripTopDir: boolean): ZipEntry[] {
  const parts = entries.map((entry) => entry.name.split('/'));
  const sharedTopDir = stripTopDir && parts.length > 0
    && parts.every((segments) => segments.length > 1 && segments[0] === parts[0][0]);
  const seen = new Set<string>();

  return entries.map((entry, index) => {
    const name = sharedTopDir ? parts[index].slice(1).join('/') : entry.name;
    assertSafeZipEntryName(name);
    if (seen.has(name)) throw new ZipValidationError(`Dubbele ZIP-entrynaam na normalisatie: "${name}"`);
    seen.add(name);
    return { name, data: entry.data };
  });
}

export async function parseZipEntries(
  buffer: ArrayBuffer,
  limits: ZipReadLimits = EXTENSION_ZIP_LIMITS,
  select?: (name: string) => boolean,
  opts?: ZipReadOptions,
): Promise<ZipEntry[]> {
  const inflate = resolveInflate(opts);
  let viaCentral: ZipEntry[] | null = null;
  try {
    viaCentral = await parseViaCentralDirectory(buffer, limits, select, inflate);
  } catch (err) {
    if (err instanceof ZipValidationError) throw err;
    console.warn('[ZIP] Central-directory-lezing faalde, val terug op local-scan:', err);
  }
  const entries = viaCentral ?? await parseViaLocalHeaders(buffer, limits, select, inflate);
  return normalizeZipEntries(entries, select === undefined);
}

function findEocdOffset(view: DataView, byteLength: number): number {
  const minOffset = Math.max(0, byteLength - 0xffff - 22);
  for (let p = byteLength - 22; p >= minOffset; p--) {
    if (view.getUint32(p, true) === SIG_EOCD) return p;
  }
  return -1;
}

async function parseViaCentralDirectory(
  buffer: ArrayBuffer,
  limits: ZipReadLimits,
  select?: (name: string) => boolean,
  inflate: ZipInflate = inflateRawBounded,
): Promise<ZipEntry[] | null> {
  const view = new DataView(buffer);
  const eocd = findEocdOffset(view, buffer.byteLength);
  if (eocd < 0) return null;

  const total = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true);
  if (total === ZIP64_U16 || cd === ZIP64_U32) rejectZip64();
  if (total > limits.maxEntries) {
    throw new ZipValidationError(`ZIP bevat ${total} entries; het maximum is ${limits.maxEntries}`);
  }

  const entries: ZipEntry[] = [];
  let declaredTotal = 0;
  let actualTotal = 0;
  for (let i = 0; i < total; i++) {
    if (cd + 46 > buffer.byteLength || view.getUint32(cd, true) !== SIG_CENTRAL) break;

    const method = view.getUint16(cd + 10, true);
    const expectedCrc = view.getUint32(cd + 16, true);
    const compSize = view.getUint32(cd + 20, true);
    const uncompressedSize = view.getUint32(cd + 24, true);
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOffset = view.getUint32(cd + 42, true);
    if (compSize === ZIP64_U32 || uncompressedSize === ZIP64_U32 || localOffset === ZIP64_U32) {
      rejectZip64();
    }

    if (cd + 46 + nameLen + extraLen + commentLen > buffer.byteLength) {
      throw new ZipValidationError('ZIP central directory loopt buiten het bestand');
    }
    const name = new TextDecoder().decode(new Uint8Array(buffer, cd + 46, nameLen));
    cd += 46 + nameLen + extraLen + commentLen;

    assertSafeZipEntryName(name);

    if (name.endsWith('/')) continue;
    declaredTotal = addZipPayloadSize(declaredTotal, uncompressedSize, name, limits);
    if (select && !select(name)) continue;

    if (localOffset + 30 > buffer.byteLength || view.getUint32(localOffset, true) !== SIG_LOCAL) continue;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compSize > buffer.byteLength) {
      throw new ZipValidationError(`ZIP-entry "${name}" loopt buiten het bestand`);
    }

    const compressed = new Uint8Array(buffer, dataStart, compSize);
    const data = await decompressEntry(method, compressed, limits, actualTotal, name, inflate);
    verifyEntryCrc(expectedCrc, data, name);
    actualTotal = addZipPayloadSize(actualTotal, data.length, name, limits);
    entries.push({ name, data });
  }

  return entries;
}

async function parseViaLocalHeaders(
  buffer: ArrayBuffer,
  limits: ZipReadLimits,
  select?: (name: string) => boolean,
  inflate: ZipInflate = inflateRawBounded,
): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const entries: ZipEntry[] = [];
  let offset = 0;
  let declaredTotal = 0;
  let actualTotal = 0;
  let seenHeaders = 0;

  while (offset + 30 <= buffer.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== SIG_LOCAL) break;

    if (++seenHeaders > limits.maxEntries) {
      throw new ZipValidationError(`ZIP bevat meer dan ${limits.maxEntries} entries`);
    }

    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    let expectedCrc = view.getUint32(offset + 14, true);
    let crcKnown = (flags & 0x08) === 0;
    let compSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    if (compSize === ZIP64_U32 || uncompressedSize === ZIP64_U32) rejectZip64();
    if (offset + 30 + nameLen + extraLen > buffer.byteLength) {
      throw new ZipValidationError('ZIP local header loopt buiten het bestand');
    }
    const name = new TextDecoder().decode(new Uint8Array(buffer, offset + 30, nameLen));
    const dataOffset = offset + 30 + nameLen + extraLen;

    assertSafeZipEntryName(name);

    let dataDescLen = 0;
    if ((flags & 0x08) && compSize === 0) {
      const { dataLen, descLen } = scanDataDescriptor(view, buffer.byteLength, dataOffset);
      compSize = dataLen;
      dataDescLen = descLen;
      const descStart = dataOffset + dataLen;
      const crcAt = descStart + (descLen === 16 ? 4 : 0);
      if (descLen > 0 && crcAt + 4 <= buffer.byteLength) {
        expectedCrc = view.getUint32(crcAt, true);
        crcKnown = true;
      }
    }
    if (dataOffset + compSize > buffer.byteLength) {
      throw new ZipValidationError(`ZIP-entry "${name}" loopt buiten het bestand`);
    }

    if (!name.endsWith('/')) {
      if (uncompressedSize > 0) {
        declaredTotal = addZipPayloadSize(declaredTotal, uncompressedSize, name, limits);
      }
      if (!select || select(name)) {
        const compressed = new Uint8Array(buffer, dataOffset, compSize);
        const data = await decompressEntry(method, compressed, limits, actualTotal, name, inflate);
        if (crcKnown) verifyEntryCrc(expectedCrc, data, name);
        actualTotal = addZipPayloadSize(actualTotal, data.length, name, limits);
        entries.push({ name, data });
      }
    }

    offset = dataOffset + compSize + dataDescLen;
  }

  return entries;
}

function scanDataDescriptor(
  view: DataView,
  byteLength: number,
  dataOffset: number,
): { dataLen: number; descLen: number } {
  for (let p = dataOffset; p + 4 <= byteLength; p++) {
    const sig = view.getUint32(p, true);
    if (sig === SIG_DATA_DESC) {
      return { dataLen: p - dataOffset, descLen: 16 };
    }
    if (sig === SIG_LOCAL || sig === SIG_CENTRAL) {
      const dataLen = Math.max(0, p - dataOffset - 12);
      return { dataLen, descLen: 12 };
    }
  }
  return { dataLen: byteLength - dataOffset, descLen: 0 };
}
