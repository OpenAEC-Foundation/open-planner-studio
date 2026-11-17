import type { ForeignSourceFingerprint } from '@/services/ifc/foreign/foreignSourceMark';
import { parseForeignSourceFingerprint } from '@/services/ifc/foreign/foreignSourceMark';
import type { IFCSaveSource } from '@/state/ifcSaveInput';

/**
 * Knownbug 1131 stap 5 (ontwerp §4.10 stap 0): een lopende vervanging van het eigen bestand op de desktop. Het id is
 * dat van de hulpnamen `save-<id>.ops-save.tmp` en `<naam>.ops-vorige-<id>` naast het doel (`foreignSource.filePath`);
 * `vorigeSha256` is de versie die de app op het doel controleerde, `pendingSha256` de versie die er komt. Herstel zoekt
 * alleen naar bestanden met dit id (`settleReplaceRemnants`).
 */
export interface RecoveryPendingReplace {
  readonly id: string;
  readonly vorigeSha256: string;
  readonly pendingSha256: string;
}

/** Optionele documentmetadata. Oude lezers negeren dit veld; met `pendingReplace` wordt het manifest versie 6
 * (`recoveryManifestVersion`), zodat een oudere app het niet stil leest en overschrijft.
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
  /** Knownbug 1131 stap 5: de lopende vervanging op de desktop, met de namen van haar restbestanden. */
  readonly pendingReplace?: RecoveryPendingReplace;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Gelijk aan `is_helper_id` in `place_file.rs`. */
const HELPER_ID = /^[0-9a-z]{1,64}$/;

export function recoveryIfcSourceFields(
  source: IFCSaveSource, enabled: boolean, pendingSha256?: string, pendingReplace?: RecoveryPendingReplace,
): { ifcSource?: RecoveryIfcSource } {
  const current = source.ifcSource;
  if (!enabled || !current?.foreign || source.foreignSourceMark?.sourceMissing) return {};
  const handle = source.foreignSourceMark?.handle;
  return { ifcSource: { sha256: current.sha256, byteLength: current.bytes.length, foreign: true,
    ...(handle ? { handle } : {}),
    ...(pendingSha256 ? { pendingSha256 } : {}),
    ...(pendingReplace ? { pendingReplace } : {}),
  } };
}

function parsePendingReplace(raw: unknown): RecoveryPendingReplace | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const { id, vorigeSha256, pendingSha256 } = value;
  if (typeof id !== 'string' || !HELPER_ID.test(id)) return undefined;
  if (typeof vorigeSha256 !== 'string' || !SHA256_HEX.test(vorigeSha256)) return undefined;
  if (typeof pendingSha256 !== 'string' || !SHA256_HEX.test(pendingSha256)) return undefined;
  return { id, vorigeSha256, pendingSha256 };
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
  const pendingReplace = parsePendingReplace(value.pendingReplace);
  return { ifcSource: { ...fingerprint, foreign: true, ...(handle?.kind === 'file' ? { handle } : {}),
    ...(pendingSha256 ? { pendingSha256 } : {}),
    ...(pendingReplace ? { pendingReplace } : {}),
  } };
}

export function sameRecoveryIfcSource(a: { ifcSource?: RecoveryIfcSource }, b: { ifcSource?: RecoveryIfcSource }): boolean {
  const ra = a.ifcSource?.pendingReplace, rb = b.ifcSource?.pendingReplace;
  return a.ifcSource?.sha256 === b.ifcSource?.sha256
    && a.ifcSource?.byteLength === b.ifcSource?.byteLength
    && a.ifcSource?.handle === b.ifcSource?.handle
    && a.ifcSource?.pendingSha256 === b.ifcSource?.pendingSha256
    && ra?.id === rb?.id && ra?.vorigeSha256 === rb?.vorigeSha256 && ra?.pendingSha256 === rb?.pendingSha256;
}
