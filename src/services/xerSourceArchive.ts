/**
 * De onveranderde brontekst van een geïmporteerd XER-bestand. Dit is bewust
 * een algemene service: de IFC-laag moet het archief kunnen verwerken zonder
 * de lazy XER-parserchunk te laden.
 */

export const XER_SOURCE_ARCHIVE_SCHEMA_VERSION = 1;
export const XER_SOURCE_ARCHIVE_CHUNK_BYTES = 196_608;

export type XerSourceArchiveEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
export type XerSourceArchiveBom = 'utf-8' | 'utf-16le' | 'utf-16be' | 'none';
export type XerSourceArchiveNewline = 'crlf' | 'lf' | 'cr' | 'mixed' | 'none';

export interface XerSourceArchive {
  readonly schemaVersion: typeof XER_SOURCE_ARCHIVE_SCHEMA_VERSION;
  readonly format: 'primavera-p6-xer';
  readonly byteLength: number;
  readonly sha256: string;
  readonly encoding: XerSourceArchiveEncoding;
  readonly bom: XerSourceArchiveBom;
  readonly newline: XerSourceArchiveNewline;
  readonly byteChunks: readonly string[];
  readonly diagnostics: Readonly<Record<string, unknown>>;
}

export interface XerSourceArchivePresentation {
  readonly schemaVersion?: typeof XER_SOURCE_ARCHIVE_SCHEMA_VERSION;
  readonly format?: 'primavera-p6-xer';
  readonly encoding: XerSourceArchiveEncoding;
  readonly bom: XerSourceArchiveBom;
  readonly newline: XerSourceArchiveNewline;
  readonly diagnostics: Record<string, unknown>;
}

/**
 * Maakt één gedeeld, diep onveranderlijk archief. De diagnostics worden eerst
 * gekopieerd zodat een invoeralias de bewaarde importdiagnostiek nooit later
 * kan wijzigen.
 */
export function createXerSourceArchive(
  bytes: Uint8Array,
  presentation: XerSourceArchivePresentation,
): XerSourceArchive {
  const byteChunks: string[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += XER_SOURCE_ARCHIVE_CHUNK_BYTES) {
    byteChunks.push(bytesToBase64(bytes.subarray(offset, offset + XER_SOURCE_ARCHIVE_CHUNK_BYTES)));
  }

  const copiedDiagnostics = cloneDiagnostics(presentation.diagnostics);
  return deepFreeze({
    schemaVersion: presentation.schemaVersion ?? XER_SOURCE_ARCHIVE_SCHEMA_VERSION,
    format: 'primavera-p6-xer' as const,
    byteLength: bytes.byteLength,
    sha256: sha256Hex(bytes),
    encoding: presentation.encoding,
    bom: presentation.bom,
    newline: presentation.newline,
    byteChunks,
    diagnostics: copiedDiagnostics,
  });
}

export function decodeXerSourceArchive(archive: XerSourceArchive): Uint8Array {
  const chunks = archive.byteChunks.map(decodeXerBase64Chunk);
  const result = new Uint8Array(archive.byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (offset !== archive.byteLength) {
    throw new Error('XER-bronarchief heeft een ongeldige byteLength.');
  }
  return result;
}

export function decodeXerBase64Chunk(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('XER-bronarchief bevat ongeldige base64.');
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function detectXerSourcePresentation(bytes: Uint8Array): XerSourceArchivePresentation {
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const text = new TextDecoder('latin1').decode(bytes);
  const crlf = /\r\n/.test(text);
  const lf = /(^|[^\r])\n/.test(text);
  const cr = /\r(?!\n)/.test(text);
  const lineKinds = Number(crlf) + Number(lf) + Number(cr);
  return {
    encoding: hasUtf8Bom ? 'utf-8' : 'windows-1252',
    bom: hasUtf8Bom ? 'utf-8' : 'none',
    newline: lineKinds === 0 ? 'none' : lineKinds > 1 ? 'mixed' : crlf ? 'crlf' : lf ? 'lf' : 'cr',
    diagnostics: {},
  };
}

/**
 * Synchrone SHA-256 zonder omgevingsafhankelijke crypto-import. Deze functie
 * is klein maar volledig; XER-archivering moet in browser en Node identiek
 * zijn.
 */
export function sha256Hex(input: Uint8Array): string {
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotateRight = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  const processBlock = (block: Uint8Array) => {
    const schedule = new Uint32Array(64);
    for (let index = 0; index < 16; index += 1) {
      const offset = index * 4;
      schedule[index] = ((block[offset] << 24) | (block[offset + 1] << 16) | (block[offset + 2] << 8) | block[offset + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = schedule[index - 15];
      const b = schedule[index - 2];
      schedule[index] = (((rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3)) + schedule[index - 7]
        + (rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10)) + schedule[index - 16]) | 0);
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choose + constants[index] + schedule[index]) | 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) | 0;
      h = g; g = f; f = e; e = (d + temporary1) | 0;
      d = c; c = b; b = a; a = (temporary1 + temporary2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  };
  let offset = 0;
  while (offset + 64 <= input.byteLength) {
    processBlock(input.subarray(offset, offset + 64));
    offset += 64;
  }
  const tail = new Uint8Array(input.byteLength - offset + 128);
  tail.set(input.subarray(offset));
  tail[input.byteLength - offset] = 0x80;
  const bitLength = BigInt(input.byteLength) * 8n;
  const lengthOffset = input.byteLength - offset < 56 ? 56 : 120;
  for (let index = 0; index < 8; index += 1) {
    tail[lengthOffset + 7 - index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
  }
  processBlock(tail.subarray(0, 64));
  if (lengthOffset === 120) processBlock(tail.subarray(64, 128));
  return hash.map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function cloneDiagnostics(diagnostics: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(diagnostics);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
