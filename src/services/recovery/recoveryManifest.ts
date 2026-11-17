import type { RecoveryManifestDoc } from '@/hooks/recoveryPaths';

/** 1/2: stabiele snapshots; 3: generaties; 4: datumstand; 5: XER-archiefverwijzing. De gewone schrijfversie. */
export const RECOVERY_MANIFEST_VERSION = 5;
/**
 * 6: versie 5 plus `ifcSource.pendingReplace` (knownbug 1131 stap 5, ontwerp §4.10 stap 0). Alleen een manifest met een
 * lopende vervanging op de desktop krijgt dit nummer; de rest blijft 5, zodat een oudere app gewoon herstelt. Een
 * oudere app weigert versie 6 hardop (sessiemelding, geen schrijf- of wisactie op dat manifest), in plaats van het veld
 * stil te laten vallen en daarmee de restbestanden onvindbaar te maken.
 */
export const RECOVERY_MANIFEST_REPLACE_VERSION = 6;

/** De versie voor een manifest met deze documenten. */
export function recoveryManifestVersion(documents: readonly { ifcSource?: { pendingReplace?: unknown } }[]): number {
  return documents.some(d => d.ifcSource?.pendingReplace) ? RECOVERY_MANIFEST_REPLACE_VERSION : RECOVERY_MANIFEST_VERSION;
}

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
  if (version > RECOVERY_MANIFEST_REPLACE_VERSION) throw new RecoveryManifestError('unsupported-version');
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
