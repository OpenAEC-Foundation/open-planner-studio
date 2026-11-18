import type { ForeignSourceFingerprint } from '@/services/ifc/foreign/foreignSourceMark';
import { parseForeignSourceFingerprint } from '@/services/ifc/foreign/foreignSourceMark';
import type { IFCSaveSource } from '@/state/ifcSaveInput';

/** Optionele documentmetadata binnen manifest v5. Oude lezers negeren dit veld.
 * Het pad/site-id staat uitsluitend in foreignSource; alleen de browserhandle mist daar nog.
 * Geen bronbytes of sessiekaart.
 */
export interface RecoveryIfcSource extends ForeignSourceFingerprint {
  readonly foreign: true;
  readonly handle?: FileSystemFileHandle;
  /** Knownbug 1131 stap 1: de versie die tijdens een vervanging op het eigen doel komt (`recoveryPendingSource.ts`).
   * Het herstel aanvaardt dan ook een bron met deze sha256. Optioneel binnen v5 (besluit 16 november 2026, in plaats
   * van manifest 6): een oudere app negeert het veld en geeft na zo'n crash hoogstens "bron ontbreekt". */
  readonly pendingSha256?: string;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function recoveryIfcSourceFields(
  source: IFCSaveSource, enabled: boolean, pendingSha256?: string,
): { ifcSource?: RecoveryIfcSource } {
  const current = source.ifcSource;
  if (!enabled || !current?.foreign || source.foreignSourceMark?.sourceMissing) return {};
  const handle = source.foreignSourceMark?.handle;
  return { ifcSource: { sha256: current.sha256, byteLength: current.bytes.length, foreign: true,
    ...(handle ? { handle } : {}),
    ...(pendingSha256 ? { pendingSha256 } : {}),
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
  const pendingSha256 = typeof value.pendingSha256 === 'string' && SHA256_HEX.test(value.pendingSha256)
    ? value.pendingSha256 : undefined;
  return { ifcSource: { ...fingerprint, foreign: true, ...(handle?.kind === 'file' ? { handle } : {}),
    ...(pendingSha256 ? { pendingSha256 } : {}),
  } };
}

export function sameRecoveryIfcSource(a: { ifcSource?: RecoveryIfcSource }, b: { ifcSource?: RecoveryIfcSource }): boolean {
  return a.ifcSource?.sha256 === b.ifcSource?.sha256
    && a.ifcSource?.byteLength === b.ifcSource?.byteLength
    && a.ifcSource?.handle === b.ifcSource?.handle
    && a.ifcSource?.pendingSha256 === b.ifcSource?.pendingSha256;
}
