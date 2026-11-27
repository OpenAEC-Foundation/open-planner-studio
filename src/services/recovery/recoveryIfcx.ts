import type { RecoveryIfcxMark, TargetFingerprint } from '@/state/documentContract';
import type { IfcxModelReferences } from '@/services/ifc/ifcx/modelReferences';
import { RecoveryManifestError } from './recoveryManifest';

const encoded = new WeakMap<IfcxModelReferences, string>();

export function storeIfcxReferences(references: IfcxModelReferences): string {
  const cached = encoded.get(references);
  if (cached) return cached;
  const stored = JSON.stringify(references, (_key, value: unknown) => value instanceof Map ? { $map: [...value] } : value);
  encoded.set(references, stored);
  return stored;
}

export function readIfcxReferences(stored: string): IfcxModelReferences {
  const fields = JSON.parse(stored, (_key, value) =>
    value && typeof value === 'object' && Object.keys(value).length === 1 && Array.isArray(value.$map)
      ? new Map(value.$map) : value) as IfcxModelReferences;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)
    || (fields.elementLinks !== undefined && !(fields.elementLinks instanceof Map))) throw new RecoveryManifestError('invalid-shape');
  return fields;
}

export function ifcxMetaFields(record: object | null | undefined): { ifcx?: RecoveryIfcxMark } {
  const value = (record as { ifcx?: unknown } | null | undefined)?.ifcx;
  if (typeof value !== 'object' || value === null) return {};
  const { known, references, targetRecentId, modelLocation, format } = value as RecoveryIfcxMark;
  return { ifcx: { known: fingerprintOf(known), ...(references ? {
    references, ...(format === 'ifc' ? { format } : {}), ...(targetRecentId ? { targetRecentId } : {}), ...(modelLocation ? { modelLocation } : {}),
  } : {}) } };
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
  return !!a.ifcx === !!b.ifcx && x?.sha256 === y?.sha256 && x?.byteLength === y?.byteLength && x?.origin === y?.origin
    && a.ifcx?.references === b.ifcx?.references && a.ifcx?.targetRecentId === b.ifcx?.targetRecentId
    && a.ifcx?.modelLocation === b.ifcx?.modelLocation && a.ifcx?.format === b.ifcx?.format;
}
