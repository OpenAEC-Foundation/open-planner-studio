import type { RecoveryIfcxMark, TargetFingerprint } from '@/state/documentContract';

export function ifcxMetaFields(record: object | null | undefined): { ifcx?: RecoveryIfcxMark } {
  const value = (record as { ifcx?: unknown } | null | undefined)?.ifcx;
  if (typeof value !== 'object' || value === null) return {};
  return { ifcx: { known: fingerprintOf((value as { known?: unknown }).known) } };
}

function fingerprintOf(value: unknown): TargetFingerprint | null {
  if (typeof value !== 'object' || value === null) return null;
  const { sha256, byteLength, origin } = value as Record<string, unknown>;
  return typeof sha256 === 'string' && sha256.length > 0 && typeof byteLength === 'number' && Number.isSafeInteger(byteLength)
    && byteLength >= 0 && (origin === 'opened' || origin === 'written') ? { sha256, byteLength, origin } : null;
}

export function sameRecoveryIfcx(a: { ifcx?: RecoveryIfcxMark }, b: { ifcx?: RecoveryIfcxMark }): boolean {
  const x = a.ifcx?.known ?? null;
  const y = b.ifcx?.known ?? null;
  return !!a.ifcx === !!b.ifcx && x?.sha256 === y?.sha256 && x?.byteLength === y?.byteLength && x?.origin === y?.origin;
}
