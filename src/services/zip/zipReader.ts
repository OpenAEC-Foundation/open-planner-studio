/**
 * Minimale ZIP-**lezer** (stored + deflate), gelift uit `src/extensions/extensionService.ts`
 * (issue #27, etappe 3, X2). Puur: geen store, geen React, geen `@tauri-apps/*`, geen
 * module-level muteerbare state. `extensionService` is sindsdien gewoon een afnemer.
 *
 * Dit bestand is in deze stap een LETTERLIJKE verplaatsing; het enige verschil met de
 * extensieversie is dat de twee `MAX_ZIP_*`-constanten velden van een injecteerbare
 * `ZipReadLimits` zijn geworden. De hardening (uitpakbudget per chunk, `maxEntries`,
 * Zip64-weigering, `select`) volgt in de stap hierna, zodat de extensiechecks eerst
 * ongewijzigd groen kunnen bewijzen dat de lift gedragsneutraal is.
 */

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

export interface ZipReadLimits {
  /** Per entry, ná uitpakken. */
  maxEntryBytes: number;
  /** Som over alle entries, ná uitpakken. */
  maxTotalBytes: number;
  /** Aantal entries dat we überhaupt bekijken. */
  maxEntries: number;
  /** Uitgepakt ÷ ingepakt per entry — de goedkope vroege uitstap. */
  maxRatio: number;
}

/** De limieten waarmee de extensie-installatie altijd al werkte (24/48 MiB), plus de twee nieuwe. */
export const EXTENSION_ZIP_LIMITS: ZipReadLimits = {
  maxEntryBytes: 24 * 1024 * 1024,
  maxTotalBytes: 48 * 1024 * 1024,
  maxEntries: 2048,
  maxRatio: 200,
};

const SIG_LOCAL = 0x04034b50;       // local file header
const SIG_CENTRAL = 0x02014b50;     // central directory file header
const SIG_EOCD = 0x06054b50;        // end of central directory
const SIG_DATA_DESC = 0x08074b50;   // optional data descriptor

/** Inflate ruwe deflate-data via de browser-native DecompressionStream. */
async function inflateRaw(compressed: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  void writer.write(compressed);
  void writer.close();

  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

async function decompressEntry(method: number, compressed: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (method === 0) return compressed;       // stored
  if (method === 8) return inflateRaw(compressed); // deflate
  throw new Error(`Niet-ondersteunde compressiemethode: ${method}`);
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

/** Strip uitsluitend één topmap wanneer iedere bestandsentry exact diezelfde topmap deelt. */
function normalizeZipEntries(entries: ZipEntry[]): ZipEntry[] {
  const parts = entries.map((entry) => entry.name.split('/'));
  const sharedTopDir = parts.length > 0
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

/**
 * Parse ZIP-entries. Primair via de CENTRAL DIRECTORY (betrouwbare maten, lost het
 * data-descriptor-overshoot-probleem op); valt terug op een local-header-scan als de
 * EOCD ontbreekt of de central-directory-lezing faalt.
 */
export async function parseZipEntries(
  buffer: ArrayBuffer,
  limits: ZipReadLimits = EXTENSION_ZIP_LIMITS,
): Promise<ZipEntry[]> {
  let viaCentral: ZipEntry[] | null = null;
  try {
    viaCentral = await parseViaCentralDirectory(buffer, limits);
  } catch (err) {
    if (err instanceof ZipValidationError) throw err;
    console.warn('[ZIP] Central-directory-lezing faalde, val terug op local-scan:', err);
  }
  const entries = viaCentral ?? await parseViaLocalHeaders(buffer, limits);
  return normalizeZipEntries(entries);
}

/** Zoek de End Of Central Directory-record (scan achterwaarts; comment is meestal leeg). */
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
): Promise<ZipEntry[] | null> {
  const view = new DataView(buffer);
  const eocd = findEocdOffset(view, buffer.byteLength);
  if (eocd < 0) return null;

  const total = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true); // offset van central directory

  const entries: ZipEntry[] = [];
  let declaredTotal = 0;
  let actualTotal = 0;
  for (let i = 0; i < total; i++) {
    if (cd + 4 > buffer.byteLength || view.getUint32(cd, true) !== SIG_CENTRAL) break;

    const method = view.getUint16(cd + 10, true);
    const compSize = view.getUint32(cd + 20, true);
    const uncompressedSize = view.getUint32(cd + 24, true);
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOffset = view.getUint32(cd + 42, true);

    const name = new TextDecoder().decode(new Uint8Array(buffer, cd + 46, nameLen));
    cd += 46 + nameLen + extraLen + commentLen;

    assertSafeZipEntryName(name);

    if (name.endsWith('/')) continue; // map
    declaredTotal = addZipPayloadSize(declaredTotal, uncompressedSize, name, limits);

    // Lees het local file header om de exacte datastart te vinden (extra-veld kan afwijken).
    if (view.getUint32(localOffset, true) !== SIG_LOCAL) continue;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;

    const compressed = new Uint8Array(buffer, dataStart, compSize);
    const data = await decompressEntry(method, compressed);
    actualTotal = addZipPayloadSize(actualTotal, data.length, name, limits);
    entries.push({ name, data });
  }

  return entries;
}

/** Fallback: lineaire scan over local file headers (voor ZIP's zonder bruikbare EOCD). */
async function parseViaLocalHeaders(
  buffer: ArrayBuffer,
  limits: ZipReadLimits,
): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const entries: ZipEntry[] = [];
  let offset = 0;
  let declaredTotal = 0;
  let actualTotal = 0;

  while (offset + 4 <= buffer.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== SIG_LOCAL) break;

    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    let compSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, offset + 30, nameLen));
    const dataOffset = offset + 30 + nameLen + extraLen;

    assertSafeZipEntryName(name);

    // Bit 3 (0x08): grootte staat in een data descriptor ná de data. dataDescLen = het
    // aantal bytes vanaf de data tot (en met) de descriptor; compSize = data ervóór.
    let dataDescLen = 0;
    if ((flags & 0x08) && compSize === 0) {
      const { dataLen, descLen } = scanDataDescriptor(view, buffer.byteLength, dataOffset);
      compSize = dataLen;
      dataDescLen = descLen;
    }

    if (!name.endsWith('/')) {
      if (uncompressedSize > 0) {
        declaredTotal = addZipPayloadSize(declaredTotal, uncompressedSize, name, limits);
      }
      const compressed = new Uint8Array(buffer, dataOffset, compSize);
      const data = await decompressEntry(method, compressed);
      actualTotal = addZipPayloadSize(actualTotal, data.length, name, limits);
      entries.push({ name, data });
    }

    offset = dataOffset + compSize + dataDescLen;
  }

  return entries;
}

/** Voor een bit-3-entry: vind het einde van de data en de lengte van de descriptor.
 *  Lost de eerdere 12-byte-overshoot op door de descriptor mee te bepalen i.p.v.
 *  altijd 12 bytes op te tellen. */
function scanDataDescriptor(
  view: DataView,
  byteLength: number,
  dataOffset: number,
): { dataLen: number; descLen: number } {
  for (let p = dataOffset; p + 4 <= byteLength; p++) {
    const sig = view.getUint32(p, true);
    if (sig === SIG_DATA_DESC) {
      // Descriptor mét signatuur: sig(4) + crc(4) + comp(4) + uncomp(4) = 16 bytes.
      return { dataLen: p - dataOffset, descLen: 16 };
    }
    if (sig === SIG_LOCAL || sig === SIG_CENTRAL) {
      // Volgende header bereikt: de descriptor zónder signatuur (12 bytes) zit
      // vóór deze header, dus die hoort nog bij de huidige entry.
      const dataLen = Math.max(0, p - dataOffset - 12);
      return { dataLen, descLen: 12 };
    }
  }
  return { dataLen: byteLength - dataOffset, descLen: 0 };
}
