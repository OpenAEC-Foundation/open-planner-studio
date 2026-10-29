import type { RecoveryManifestDoc } from '@/hooks/recoveryPaths';

/** 1/2: stabiele snapshots; 3: generaties; 4: datumstand; 5: XER-archiefverwijzing. */
export const RECOVERY_MANIFEST_VERSION = 5;

export class RecoveryManifestError extends Error {
  constructor(readonly reason: 'invalid-version' | 'unsupported-version' | 'invalid-shape') {
    super(`Recovery: manifest geweigerd (${reason}).`);
    this.name = 'RecoveryManifestError';
  }
}

/** Geen migratie: alleen de werkelijk geschreven versies zijn leesbaar. */
export function checkRecoveryManifestVersion(version: unknown): void {
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new RecoveryManifestError('invalid-version');
  }
  if (version > RECOVERY_MANIFEST_VERSION) throw new RecoveryManifestError('unsupported-version');
}

/** Eén manifest mag een document maar één keer vertegenwoordigen, ook in de oude docIds-vorm. */
export function checkRecoveryDocumentIds(ids: unknown): asserts ids is string[] {
  if (!Array.isArray(ids)) throw new RecoveryManifestError('invalid-shape');
  const seen = new Set<string>();
  // for…of bezoekt ook ontbrekende posities (als undefined); some/map slaan die over.
  for (const id of ids) {
    if (typeof id !== 'string' || !id || seen.has(id)) throw new RecoveryManifestError('invalid-shape');
    seen.add(id);
  }
}

/** Identiteiten zijn nodig om metadata en bytes te koppelen; optionele sitevelden blijven tolerant. */
export function checkRecoveryDocuments(documents: unknown): asserts documents is RecoveryManifestDoc[] {
  if (!Array.isArray(documents)) throw new RecoveryManifestError('invalid-shape');
  const ids: string[] = [];
  for (const document of documents) {
    if (!document || typeof document !== 'object') throw new RecoveryManifestError('invalid-shape');
    const record = document as Record<string, unknown>;
    if (typeof record.id !== 'string' || record.id.length === 0
      || typeof record.ifc !== 'string' || record.ifc.length === 0) throw new RecoveryManifestError('invalid-shape');
    ids.push(record.id);
  }
  checkRecoveryDocumentIds(ids);
}
