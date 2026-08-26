import type { ExternalLink, ExternalSourceRef } from '@/types/task';

export type ExternalDirection = ExternalLink['direction'];
export type ExternalRelationType = ExternalLink['relType'];

export interface ExternalRelationOrigin {
  ownerTaskId: string;
  direction: ExternalDirection;
  linkId: string;
}

export interface ExternalRelationClipboardV1 {
  v: 1;
  origin: ExternalRelationOrigin;
  sourceProjectKey: string;
  sourceRef: ExternalSourceRef;
  relType: ExternalRelationType;
  lagDays?: number;
  lagMinutes?: number;
  anchorDate: string;
  sourceMissing: boolean;
}

export type ExternalLag =
  | { lagDays: number; lagMinutes?: never }
  | { lagDays?: never; lagMinutes: number };

type ExternalLagFields = Pick<ExternalLink, 'lagDays' | 'lagMinutes'>;

export interface ParsedExternalRelationClipboard {
  origin: ExternalRelationOrigin;
  sourceProjectKey: string;
  sourceRef: ExternalSourceRef;
  relType: ExternalRelationType;
  lag: ExternalLag;
  anchorDate: string;
  sourceMissing: boolean;
  copiedRelType: ExternalRelationType;
  copiedLag: ExternalLag;
}

export type ExternalRelationClipboardResult =
  | { ok: true; value: ParsedExternalRelationClipboard }
  | { ok: false; code: string; message: string };

const MAX_ID_LENGTH = 512;
const MAX_NAME_LENGTH = 4_096;
const MAX_PATH_LENGTH = 8_192;
const MAX_DATE_LENGTH = 64;
const MAX_PAYLOAD_LENGTH = 32_768;
const MAX_LAG_ABS = 1_000_000_000;
const TOKEN_MARKER = ' ⟦OPS-EXT/1:';
const TOKEN_END = '⟧';

function failure(code: string, message: string): ExternalRelationClipboardResult {
  return { ok: false, code, message };
}

function lowercaseAscii(value: string): string {
  return value.replace(/[A-Z]/g, letter => letter.toLowerCase());
}

function resolveSegments(parts: readonly string[], protectedCount: number): string[] | null {
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (result.length <= protectedCount) return null;
      result.pop();
      continue;
    }
    result.push(part);
  }
  return result;
}

/**
 * Platformonafhankelijke, uitsluitend lexicale identiteit voor externe bronpaden. Het originele
 * pad blijft elders bewaard voor tonen en lezen; deze vorm is alleen voor vergelijken en hashen.
 */
export function normalizeExternalSourcePath(filePath: string): string | null {
  if (!filePath || filePath.includes('\0')) return null;

  const isDrivePath = /^[A-Za-z]:[\\/]/.test(filePath);
  const isUncPath = /^(?:\\\\|\/\/)/.test(filePath);

  if (isDrivePath) {
    const slashed = filePath.replace(/\\/g, '/');
    const drive = lowercaseAscii(slashed.slice(0, 2));
    const segments = resolveSegments(slashed.slice(3).split('/'), 0);
    if (!segments) return null;
    const suffix = lowercaseAscii(segments.join('/'));
    return suffix ? `${drive}/${suffix}` : `${drive}/`;
  }

  if (isUncPath) {
    const slashed = filePath.replace(/\\/g, '/');
    const raw = slashed.slice(2).split('/').filter(Boolean);
    if (raw.length < 2 || raw[0] === '.' || raw[0] === '..' || raw[1] === '.' || raw[1] === '..') {
      return null;
    }
    const segments = resolveSegments(raw, 2);
    if (!segments || segments.length < 2) return null;
    return `//${lowercaseAscii(segments.join('/'))}`;
  }

  if (!filePath.startsWith('/')) return null;
  const segments = resolveSegments(filePath.slice(1).split('/'), 0);
  if (!segments) return null;
  return segments.length ? `/${segments.join('/')}` : '/';
}

// Synchronous SHA-256 keeps sourceProjectKey usable in clipboard formatters, pure planners and
// refresh matching without browser-only async Web Crypto or Node-only imports.
function sha256HexUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLengthHigh = Math.floor(bitLength / 0x1_0000_0000);
  const bitLengthLow = bitLength >>> 0;
  view.setUint32(paddedLength - 8, bitLengthHigh, false);
  view.setUint32(paddedLength - 4, bitLengthLow, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const w = new Uint32Array(64);
  const rotateRight = (n: number, bits: number) => (n >>> bits) | (n << (32 - bits));

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
      const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + choose + k[i] + w[i]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, word => word.toString(16).padStart(8, '0')).join('');
}

export function externalSourcePathKey(filePath: string | undefined): string | null {
  if (filePath === undefined) return null;
  const normalized = normalizeExternalSourcePath(filePath);
  return normalized === null ? null : `path-sha256:${sha256HexUtf8(normalized)}`;
}

export function sourceProjectKeyFor(sourceRef: ExternalSourceRef, origin: ExternalRelationOrigin): string {
  if (sourceRef.projectId.trim()) return `project:${sourceRef.projectId}`;
  return externalSourcePathKey(sourceRef.filePath) ?? `id-only:${origin.ownerTaskId}:${origin.linkId}`;
}

function trimNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

export function parseExternalLagInput(input: string): ExternalLag | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized) return { lagDays: 0 };
  const match = normalized.match(/^([+-]?\d+(?:[.,]\d+)?)(d|u|h)?$/);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || Math.abs(value) > MAX_LAG_ABS) return null;
  const suffix = match[2] ?? 'd';
  const storedValue = Math.round(suffix === 'u' || suffix === 'h' ? value * 60 : value);
  if (!Number.isSafeInteger(storedValue) || Math.abs(storedValue) > MAX_LAG_ABS) return null;
  return suffix === 'u' || suffix === 'h' ? { lagMinutes: storedValue } : { lagDays: storedValue };
}

function canonicalLag(lag: ExternalLagFields): ExternalLag {
  if (typeof lag.lagMinutes === 'number' && Number.isFinite(lag.lagMinutes) && lag.lagMinutes !== 0) {
    return { lagMinutes: Math.round(lag.lagMinutes) };
  }
  if (typeof lag.lagDays === 'number' && Number.isFinite(lag.lagDays)) {
    return { lagDays: Math.round(lag.lagDays) };
  }
  return { lagDays: 0 };
}

export function formatExternalLagShort(lag: ExternalLagFields): string {
  const canonical = canonicalLag(lag);
  if (canonical.lagMinutes !== undefined) {
    const hours = canonical.lagMinutes / 60;
    return hours === 0 ? '' : `${hours > 0 ? '+' : ''}${trimNumber(hours)}u`;
  }
  const days = canonical.lagDays ?? 0;
  return days === 0 ? '' : `${days > 0 ? '+' : ''}${days}d`;
}

/**
 * Welke zijde van de brontaak het bevroren anker voedt. Bij een voorganger is dat het eerste
 * typekarakter; bij een opvolger het tweede: FS/FF versus SS/SF, respectievelijk FS/SS versus FF/SF.
 */
export function externalSourceSide(
  direction: ExternalDirection,
  relType: ExternalRelationType,
): 'start' | 'finish' {
  const sourceLetter = direction === 'predecessor' ? relType[0] : relType[1];
  return sourceLetter === 'F' ? 'finish' : 'start';
}

export function externalAnchorSideIsCompatible(
  copiedDirection: ExternalDirection,
  copiedType: ExternalRelationType,
  targetDirection: ExternalDirection,
  targetType: ExternalRelationType,
): boolean {
  return externalSourceSide(copiedDirection, copiedType) === externalSourceSide(targetDirection, targetType);
}

function quoteRelationTokenPart(value: string): string {
  if (value && !/[,/"\\]/.test(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function canonicalExternalSourceLabel(sourceRef: ExternalSourceRef): string {
  const project = sourceRef.projectName || sourceRef.projectId;
  const task = sourceRef.taskName || sourceRef.taskId;
  return `${quoteRelationTokenPart(project)} / ${quoteRelationTokenPart(task)}`;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string | null {
  if (!value || value.length > MAX_PAYLOAD_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    return null;
  }
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return encodeBase64Url(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
}

function orderedSourceRef(sourceRef: ExternalSourceRef): ExternalSourceRef {
  return {
    projectId: sourceRef.projectId,
    ...(sourceRef.projectName !== undefined ? { projectName: sourceRef.projectName } : {}),
    taskId: sourceRef.taskId,
    ...(sourceRef.taskName !== undefined ? { taskName: sourceRef.taskName } : {}),
    ...(sourceRef.filePath !== undefined ? { filePath: sourceRef.filePath } : {}),
  };
}

function orderedPayload(payload: ExternalRelationClipboardV1): ExternalRelationClipboardV1 {
  return {
    v: 1,
    origin: {
      ownerTaskId: payload.origin.ownerTaskId,
      direction: payload.origin.direction,
      linkId: payload.origin.linkId,
    },
    sourceProjectKey: payload.sourceProjectKey,
    sourceRef: orderedSourceRef(payload.sourceRef),
    relType: payload.relType,
    ...(payload.lagMinutes !== undefined
      ? { lagMinutes: payload.lagMinutes }
      : { lagDays: payload.lagDays ?? 0 }),
    anchorDate: payload.anchorDate,
    sourceMissing: payload.sourceMissing,
  };
}

function payloadJson(payload: ExternalRelationClipboardV1): string {
  return JSON.stringify(orderedPayload(payload));
}

export function formatExternalRelationClipboard(ownerTaskId: string, link: ExternalLink): string {
  const origin: ExternalRelationOrigin = { ownerTaskId, direction: link.direction, linkId: link.id };
  const lag = canonicalLag(link);
  const payload: ExternalRelationClipboardV1 = {
    v: 1,
    origin,
    sourceProjectKey: sourceProjectKeyFor(link.sourceRef, origin),
    sourceRef: orderedSourceRef(link.sourceRef),
    relType: link.relType,
    ...lag,
    anchorDate: link.anchorDate,
    sourceMissing: link.sourceMissing,
  };
  const visible = `${canonicalExternalSourceLabel(link.sourceRef)} ${link.relType}${formatExternalLagShort(lag)}`;
  return `${visible}${TOKEN_MARKER}${encodeBase64Url(payloadJson(payload))}${TOKEN_END}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function validString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.length > 0)
    && !Array.from(value).some(character => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
}

function validIsoAnchor(value: string): boolean {
  if (value.length > MAX_DATE_LENGTH) return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:Z|([+-])(\d{2}):(\d{2}))?)?$/,
  );
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return false;
  if (match[4] === undefined) return true;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[8] !== undefined) {
    const offsetHour = Number(match[9]);
    const offsetMinute = Number(match[10]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return true;
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parsePayload(json: string): ExternalRelationClipboardV1 | null {
  let value: unknown;
  try { value = JSON.parse(json); } catch { return null; }
  if (!isPlainRecord(value)) return null;
  const lagKey = hasOwn(value, 'lagMinutes') ? 'lagMinutes' : 'lagDays';
  if (!hasExactKeys(value, [
    'v', 'origin', 'sourceProjectKey', 'sourceRef', 'relType', lagKey, 'anchorDate', 'sourceMissing',
  ])) return null;
  if (value.v !== 1 || !isPlainRecord(value.origin) || !isPlainRecord(value.sourceRef)) return null;
  if (!hasExactKeys(value.origin, ['ownerTaskId', 'direction', 'linkId'])) return null;
  if (!validString(value.origin.ownerTaskId, MAX_ID_LENGTH)
    || (value.origin.direction !== 'predecessor' && value.origin.direction !== 'successor')
    || !validString(value.origin.linkId, MAX_ID_LENGTH)) return null;

  const sourceKeys = Object.keys(value.sourceRef);
  const expectedSourceKeys = [
    'projectId',
    ...(hasOwn(value.sourceRef, 'projectName') ? ['projectName'] : []),
    'taskId',
    ...(hasOwn(value.sourceRef, 'taskName') ? ['taskName'] : []),
    ...(hasOwn(value.sourceRef, 'filePath') ? ['filePath'] : []),
  ];
  if (sourceKeys.length !== expectedSourceKeys.length
    || !sourceKeys.every((key, index) => key === expectedSourceKeys[index])) return null;
  if (!validString(value.sourceRef.projectId, MAX_ID_LENGTH, true)
    || !validString(value.sourceRef.taskId, MAX_ID_LENGTH)) return null;
  if (hasOwn(value.sourceRef, 'projectName')
    && !validString(value.sourceRef.projectName, MAX_NAME_LENGTH, true)) return null;
  if (hasOwn(value.sourceRef, 'taskName')
    && !validString(value.sourceRef.taskName, MAX_NAME_LENGTH, true)) return null;
  if (hasOwn(value.sourceRef, 'filePath')
    && !validString(value.sourceRef.filePath, MAX_PATH_LENGTH, true)) return null;
  if (!validString(value.sourceProjectKey, MAX_PATH_LENGTH + MAX_ID_LENGTH)
    || !['FS', 'SS', 'FF', 'SF'].includes(String(value.relType))
    || !validString(value.anchorDate, MAX_DATE_LENGTH)
    || !validIsoAnchor(value.anchorDate)
    || typeof value.sourceMissing !== 'boolean') return null;
  const lag = value[lagKey];
  if (typeof lag !== 'number' || !Number.isSafeInteger(lag) || Math.abs(lag) > MAX_LAG_ABS) return null;

  const parsed = value as unknown as ExternalRelationClipboardV1;
  return payloadJson(parsed) === json ? parsed : null;
}

export function parseExternalRelationClipboard(
  text: string,
  target: { ownerTaskId: string; direction: ExternalDirection },
): ExternalRelationClipboardResult {
  const markerIndex = text.lastIndexOf(TOKEN_MARKER);
  if (markerIndex < 0 || !text.endsWith(TOKEN_END)) {
    return failure('missingExternalPayload', 'Externe relatie mist de technische OPS-EXT/1-suffix.');
  }
  const encoded = text.slice(markerIndex + TOKEN_MARKER.length, -TOKEN_END.length);
  const json = decodeBase64Url(encoded);
  if (json === null) return failure('invalidExternalPayload', 'De externe-relatiesuffix is ongeldig.');
  const payload = parsePayload(json);
  if (!payload) return failure('invalidExternalPayload', 'De externe-relatiesuffix heeft een ongeldig schema.');

  const expectedKey = sourceProjectKeyFor(payload.sourceRef, payload.origin);
  if (payload.sourceProjectKey !== expectedKey) {
    return failure('sourceProjectKeyMismatch', 'De technische bronidentiteit klopt niet met de bronverwijzing.');
  }
  if (payload.sourceProjectKey.startsWith('id-only:')
    && (target.ownerTaskId !== payload.origin.ownerTaskId || target.direction !== payload.origin.direction)) {
    return failure('idOnlyExternalRelation', 'Deze oude externe relatie kan alleen in dezelfde cel worden teruggeplaatst.');
  }

  const visible = text.slice(0, markerIndex);
  const expectedSourceLabel = `${canonicalExternalSourceLabel(payload.sourceRef)} `;
  if (!visible.startsWith(expectedSourceLabel)) {
    return failure('externalSourceLabelChanged', 'Een externe bron wisselen kan alleen via Externe relatie toevoegen.');
  }
  const visibleRelation = visible.slice(expectedSourceLabel.length);
  const relationMatch = visibleRelation.match(/^(FS|SS|FF|SF)(.*)$/);
  if (!relationMatch) return failure('invalidExternalRelation', 'Het externe relatietype is ongeldig.');
  const relType = relationMatch[1] as ExternalRelationType;
  const lag = parseExternalLagInput(relationMatch[2]);
  if (!lag) {
    return failure('unsupportedExternalLag', 'Externe relaties ondersteunen alleen vaste werkdag- of werktijdlag.');
  }
  if (!externalAnchorSideIsCompatible(payload.origin.direction, payload.relType, target.direction, relType)) {
    return failure('externalAnchorSideChanged', 'Deze type- of richtingwijziging vereist een nieuw bronanker.');
  }
  const copiedLag = payload.lagMinutes !== undefined
    ? { lagMinutes: payload.lagMinutes }
    : { lagDays: payload.lagDays ?? 0 };
  return {
    ok: true,
    value: {
      origin: payload.origin,
      sourceProjectKey: payload.sourceProjectKey,
      sourceRef: payload.sourceRef,
      relType,
      lag,
      anchorDate: payload.anchorDate,
      sourceMissing: payload.sourceMissing,
      copiedRelType: payload.relType,
      copiedLag,
    },
  };
}
