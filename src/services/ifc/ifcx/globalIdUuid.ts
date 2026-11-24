import { OPS_NAME_UUID_NAMESPACE } from './profile';

const GLOBAL_ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const UUID_FORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const GLOBAL_ID_VALUE = new Int8Array(128).fill(-1);
for (let i = 0; i < GLOBAL_ID_CHARS.length; i++) GLOBAL_ID_VALUE[GLOBAL_ID_CHARS.charCodeAt(i)] = i;

function valueOfChar(text: string, index: number): number {
  const code = text.charCodeAt(index);
  return code < 128 ? GLOBAL_ID_VALUE[code] : -1;
}

export function isUuidPath(path: string): boolean {
  return UUID_FORM.test(path);
}

export function isCompactGlobalId(globalId: string): boolean {
  if (globalId.length !== 22) return false;
  const first = valueOfChar(globalId, 0);
  if (first < 0 || first > 3) return false;
  for (let i = 1; i < 22; i++) if (valueOfChar(globalId, i) < 0) return false;
  return true;
}

function uuidOfHex(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function compactGlobalIdToUuid(globalId: string): string {
  if (!isCompactGlobalId(globalId)) throw new Error(`Geen GlobalId van 128 bits: ${globalId}`);
  let hex = '';
  let buffer = valueOfChar(globalId, 0), bits = 2;
  for (let i = 1; i < 22; i++) {
    buffer = (buffer << 6) | valueOfChar(globalId, i);
    bits += 6;
    while (bits >= 4) {
      bits -= 4;
      hex += ((buffer >> bits) & 15).toString(16);
    }
    buffer &= (1 << bits) - 1;
  }
  return uuidOfHex(hex);
}

export function uuidToCompactGlobalId(uuid: string): string {
  if (!isUuidPath(uuid)) throw new Error(`Geen UUID: ${uuid}`);
  const hex = uuid.replace(/-/g, '');
  let out = '';
  let buffer = 0, bits = 0, width = 2;
  for (let i = 0; i < 32; i++) {
    buffer = (buffer << 4) | parseInt(hex[i], 16);
    bits += 4;
    while (bits >= width) {
      bits -= width;
      out += GLOBAL_ID_CHARS[(buffer >> bits) & ((1 << width) - 1)];
      width = 6;
    }
    buffer &= (1 << bits) - 1;
  }
  return out;
}

function sha1(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999]
        : i < 40 ? [b ^ c ^ d, 0x6ed9eba1]
          : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
            : [b ^ c ^ d, 0xca62c1d6];
      const next = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = next;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => outView.setUint32(i * 4, h));
  return out;
}

export function nameBasedUuid(name: string, namespace: string = OPS_NAME_UUID_NAMESPACE): string {
  const space = namespace.replace(/-/g, '');
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(16 + nameBytes.length);
  for (let i = 0; i < 16; i++) input[i] = parseInt(space.slice(i * 2, i * 2 + 2), 16);
  input.set(nameBytes, 16);
  const hash = sha1(input);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return uuidOfHex([...hash.slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join(''));
}

export interface IfcxIdentity {
  readonly path: string;
  readonly globalIdOutsidePath?: string;
}

export function identityOfGlobalId(globalId: string): IfcxIdentity {
  return isCompactGlobalId(globalId)
    ? { path: compactGlobalIdToUuid(globalId) }
    : { path: nameBasedUuid(globalId), globalIdOutsidePath: globalId };
}

export function globalIdOfIdentity(path: string, globalIdOutsidePath: string | undefined): string {
  return globalIdOutsidePath ?? uuidToCompactGlobalId(path);
}
