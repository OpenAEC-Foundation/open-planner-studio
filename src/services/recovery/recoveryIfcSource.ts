import type { ForeignSourceFingerprint } from '@/services/ifc/foreign/foreignSourceMark';
import { parseForeignSourceFingerprint } from '@/services/ifc/foreign/foreignSourceMark';
import type { IFCSaveSource } from '@/state/ifcSaveInput';

/** Optionele documentmetadata binnen manifest v5. Oude lezers negeren dit veld.
 * Het pad/site-id staat uitsluitend in foreignSource; alleen de browserhandle mist daar nog.
 * Geen bronbytes, sessiekaart of pending: in 1c blijft het vorige lokale bestand onaangeroerd.
 */
export interface RecoveryIfcSource extends ForeignSourceFingerprint {
  readonly foreign: true;
  readonly handle?: FileSystemFileHandle;
}

export function recoveryIfcSourceFields(source: IFCSaveSource, enabled: boolean): { ifcSource?: RecoveryIfcSource } {
  const current = source.ifcSource;
  if (!enabled || !current?.foreign || source.foreignSourceMark?.sourceMissing) return {};
  const handle = source.foreignSourceMark?.handle;
  return { ifcSource: { sha256: current.sha256, byteLength: current.bytes.length, foreign: true,
    ...(handle ? { handle } : {}),
  } };
}

/** Een ongeldige verwijzing herstelt hoogstens de planning met de bestaande bronblokkade. */
export function ifcSourceMetaFields(record: object | null | undefined): { ifcSource?: RecoveryIfcSource } {
  const raw = (record as { ifcSource?: unknown } | null | undefined)?.ifcSource;
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as Record<string, unknown>;
  const fingerprint = parseForeignSourceFingerprint(value.sha256, value.byteLength);
  if (!fingerprint || value.foreign !== true) return {};
  const handle = value.handle as FileSystemFileHandle | undefined;
  return { ifcSource: { ...fingerprint, foreign: true, ...(handle?.kind === 'file' ? { handle } : {}) } };
}

export function sameRecoveryIfcSource(a: { ifcSource?: RecoveryIfcSource }, b: { ifcSource?: RecoveryIfcSource }): boolean {
  return a.ifcSource?.sha256 === b.ifcSource?.sha256
    && a.ifcSource?.byteLength === b.ifcSource?.byteLength
    && a.ifcSource?.handle === b.ifcSource?.handle;
}
