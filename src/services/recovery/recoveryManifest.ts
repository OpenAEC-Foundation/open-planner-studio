import type { RecoveryManifestDoc } from '@/services/recovery/recoveryPaths';
import { ifcxEnabled } from '@/utils/featureFlags';
import { loadFeatureFlags } from '@/utils/settingsStore';

export const RECOVERY_MANIFEST_VERSION = 5;
const IFCX_REFERENCES_VERSION = 6;

export function recoveryManifestVersion(documents: readonly Pick<RecoveryManifestDoc, 'ifcx'>[]): number {
  return documents.some(doc => doc.ifcx?.references !== undefined) ? IFCX_REFERENCES_VERSION : RECOVERY_MANIFEST_VERSION;
}

export class RecoveryManifestError extends Error {
  constructor(readonly reason: 'invalid-version' | 'unsupported-version' | 'invalid-shape') {
    super(`Recovery: manifest geweigerd (${reason}).`);
    this.name = 'RecoveryManifestError';
  }
}

export function checkRecoveryManifestVersion(version: unknown): void {
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new RecoveryManifestError('invalid-version');
  }
  if (version > RECOVERY_MANIFEST_VERSION && !(version === IFCX_REFERENCES_VERSION && ifcxEnabled(loadFeatureFlags()))) {
    throw new RecoveryManifestError('unsupported-version');
  }
}

export function checkRecoveryDocumentIds(ids: unknown): asserts ids is string[] {
  if (!Array.isArray(ids)) throw new RecoveryManifestError('invalid-shape');
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string' || !id || seen.has(id)) throw new RecoveryManifestError('invalid-shape');
    seen.add(id);
  }
}

export function checkRecoveryDocuments(documents: unknown, version?: number): asserts documents is RecoveryManifestDoc[] {
  if (!Array.isArray(documents)) throw new RecoveryManifestError('invalid-shape');
  const ids: string[] = [];
  for (const document of documents) {
    if (!document || typeof document !== 'object') throw new RecoveryManifestError('invalid-shape');
    const record = document as Record<string, unknown>;
    if (typeof record.id !== 'string' || record.id.length === 0
      || typeof record.ifc !== 'string' || record.ifc.length === 0) throw new RecoveryManifestError('invalid-shape');
    if (version === IFCX_REFERENCES_VERSION && record.ifcx && typeof record.ifcx === 'object' && 'references' in record.ifcx
      && (typeof record.ifcx.references !== 'string' || !record.ifcx.references)) throw new RecoveryManifestError('invalid-shape');
    ids.push(record.id);
  }
  checkRecoveryDocumentIds(ids);
  if (version !== undefined && (version === IFCX_REFERENCES_VERSION) !== (recoveryManifestVersion(documents) === IFCX_REFERENCES_VERSION)) {
    throw new RecoveryManifestError('invalid-shape');
  }
}
