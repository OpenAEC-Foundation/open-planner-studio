import type { IfcSource } from './ifcSource';

export interface ForeignSourceFingerprint {
  readonly sha256: string;
  readonly byteLength: number;
}

export interface ForeignSourceTarget {
  readonly sourceMissing?: boolean;
  readonly filePath: string | null;
  readonly siteFileId: string | null;
}

export interface ForeignSourceRecord extends ForeignSourceFingerprint {
  readonly target?: ForeignSourceTarget;
}

export interface ForeignSourceMark extends ForeignSourceFingerprint, ForeignSourceTarget {
  readonly handle: FileSystemFileHandle | null;
  readonly sourceMissing?: boolean;
}

export function foreignSourceMarkFor(
  source: IfcSource | null | undefined,
  target: { filePath: string | null; siteFileId: string | null; fileHandle: FileSystemFileHandle | null },
): ForeignSourceMark | null {
  if (!source?.foreign) return null;
  return {
    sha256: source.sha256,
    byteLength: source.bytes.length,
    filePath: target.filePath,
    siteFileId: target.siteFileId,
    handle: target.fileHandle,
  };
}

export function parseForeignSourceFingerprint(sha256: unknown, byteLength: unknown): ForeignSourceFingerprint | null {
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) return null;
  if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength < 0) return null;
  return { sha256, byteLength };
}

export function parseForeignSourceTarget(raw: unknown): ForeignSourceTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const { filePath, siteFileId, sourceMissing } = raw as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
  return { filePath: text(filePath), siteFileId: text(siteFileId),
    ...(sourceMissing === false ? { sourceMissing: false } : {}),
  };
}

export function foreignSourceTargetOf(mark: ForeignSourceMark | null | undefined): ForeignSourceTarget | null {
  return mark ? { filePath: mark.filePath, siteFileId: mark.siteFileId,
    ...(mark.sourceMissing === false ? { sourceMissing: false } : {}),
  } : null;
}

export function sameForeignSourceTarget(a: ForeignSourceTarget | null | undefined, b: ForeignSourceTarget | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.filePath === b.filePath && a.siteFileId === b.siteFileId && a.sourceMissing === b.sourceMissing;
}

export function foreignSourceMarkFromRecovery(
  fingerprint: ForeignSourceFingerprint | null | undefined,
  target: ForeignSourceTarget | null | undefined,
): ForeignSourceMark | null {
  if (!fingerprint) return null;
  return {
    sha256: fingerprint.sha256,
    byteLength: fingerprint.byteLength,
    filePath: target?.filePath ?? null,
    siteFileId: target?.siteFileId ?? null,
    handle: null,
    ...(target?.sourceMissing === false ? { sourceMissing: false } : {}),
  };
}

export function foreignSourceBackupRecord(mark: ForeignSourceMark | null | undefined): ForeignSourceRecord | undefined {
  if (!mark || mark.sourceMissing === false) return undefined;
  return { sha256: mark.sha256, byteLength: mark.byteLength, target: { filePath: mark.filePath, siteFileId: mark.siteFileId } };
}

export function foreignSourceMarkFromRecord(record: ForeignSourceRecord | null | undefined): ForeignSourceMark | null {
  return record ? foreignSourceMarkFromRecovery(record, record.target ?? null) : null;
}
