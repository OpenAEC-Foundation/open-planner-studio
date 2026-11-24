const GLOBAL_ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const UUID_FORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TEXT_PATH_PREFIX = 't-';
const TEXT_PATH_FORM = /^t-(?:[0-9a-f]{4})*$/;

const GLOBAL_ID_VALUE = new Int8Array(128).fill(-1);
for (let i = 0; i < GLOBAL_ID_CHARS.length; i++) GLOBAL_ID_VALUE[GLOBAL_ID_CHARS.charCodeAt(i)] = i;

function valueOfChar(text: string, index: number): number {
  const code = text.charCodeAt(index);
  return code < 128 ? GLOBAL_ID_VALUE[code] : -1;
}

export function isCompactGlobalId(globalId: string): boolean {
  if (globalId.length !== 22) return false;
  const first = valueOfChar(globalId, 0);
  if (first < 0 || first > 3) return false;
  for (let i = 1; i < 22; i++) if (valueOfChar(globalId, i) < 0) return false;
  return true;
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
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidToCompactGlobalId(uuid: string): string {
  if (!UUID_FORM.test(uuid)) throw new Error(`Geen UUID: ${uuid}`);
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

export function pathOfGlobalId(globalId: string): string {
  if (isCompactGlobalId(globalId)) return compactGlobalIdToUuid(globalId);
  let hex = '';
  for (let i = 0; i < globalId.length; i++) hex += globalId.charCodeAt(i).toString(16).padStart(4, '0');
  return `${TEXT_PATH_PREFIX}${hex}`;
}

export function globalIdOfPath(path: string): string | undefined {
  if (UUID_FORM.test(path)) return uuidToCompactGlobalId(path);
  if (!TEXT_PATH_FORM.test(path)) return undefined;
  let text = '';
  for (let i = TEXT_PATH_PREFIX.length; i < path.length; i += 4) text += String.fromCharCode(parseInt(path.slice(i, i + 4), 16));
  return isCompactGlobalId(text) ? undefined : text;
}

export function isIdentityPath(path: string): boolean {
  return globalIdOfPath(path) !== undefined;
}
