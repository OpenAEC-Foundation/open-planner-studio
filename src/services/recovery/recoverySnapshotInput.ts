import { writeIFCWithChoices, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import type { XerSourceArchive } from '@/services/xerSourceArchive';
import { snapshotIdentities, type RecoverySnapshotIdentities } from './recoveryIdentity';

/** Uitsluitend clonebare writer-invoer; nooit een documentpayload met handles of archiefbytes. */
export interface RecoverySnapshotInput {
  input: Omit<WriteIFCInput, 'xerSourceArchive' | 'xer'>;
  archive?: Pick<XerSourceArchive, 'format' | 'byteLength' | 'sha256'> & { selectorValid: boolean };
  identities?: true | 'ifcx';
}

export function recoverySnapshotInput(source: IFCSaveSource, identities = false): RecoverySnapshotInput {
  const { xerSourceArchive: archive, xer, ...input } = buildWriteIFCInput(source, 'planOnly');
  const selector = xer?.sourceProjectId ?? input.xerSourceProjectId;
  // #804 fase 1a, fixronde 1: kwam het document uit een bestand met een vreemd deel, dan alleen de vingerafdruk (twee
  // getallen), nooit de bronbytes of de handle: deze invoer gaat naar de Worker.
  const mark = source.foreignSourceMark;
  return {
    input: {
      ...input, xerSourceProjectId: selector, xerSourceArchiveStorage: 'recovery-reference',
      ...(mark ? { recoveryForeignSource: { sha256: mark.sha256, byteLength: mark.byteLength } } : {}),
    },
    ...(archive ? { archive: {
      format: archive.format, byteLength: archive.byteLength, sha256: archive.sha256,
      selectorValid: !!(selector && archive.diagnostics.documentViews[selector]),
    } } : {}),
    ...(identities ? { identities: source.ifcxReferences ? 'ifcx' as const : true as const } : {}),
  };
}

export interface RecoverySnapshot {
  readonly ifc: string;
  readonly identities?: RecoverySnapshotIdentities;
}

export function serializeRecoveryInput(snapshot: RecoverySnapshotInput): string {
  return writeRecoverySnapshot(snapshot).ifc;
}

export function writeRecoverySnapshotParts({ input, archive }: RecoverySnapshotInput, writtenAt?: Date): {
  input: WriteIFCInput; ifc: string; issuedGlobalIds: ReadonlyMap<string, string>;
} {
  // De referentietak van de writer leest alleen deze velden en de geldigheid van de selector.
  // Bewust een smalle adapter: het volledige archief (bytes, readModel, diagnostics) wordt nooit
  // gekloond. Pariteitstests bewaken dat deze tak geen andere archiefvelden gaat gebruiken.
  const reference = archive ? {
    format: archive.format, byteLength: archive.byteLength, sha256: archive.sha256,
    diagnostics: { documentViews: archive.selectorValid && input.xerSourceProjectId
      ? { [input.xerSourceProjectId]: true } : {} },
  } as unknown as XerSourceArchive : undefined;
  const written = writeIFCWithChoices({ ...input, xerSourceArchive: reference }, writtenAt);
  return { input, ifc: written.content, issuedGlobalIds: written.issuedGlobalIds };
}

export function writeRecoverySnapshot(snapshot: RecoverySnapshotInput): RecoverySnapshot {
  const { input, ifc, issuedGlobalIds } = writeRecoverySnapshotParts(snapshot);
  const identities = snapshot.identities ? snapshotIdentities(input, issuedGlobalIds, ifc, snapshot.identities === 'ifcx') : undefined;
  return { ifc, ...(identities ? { identities } : {}) };
}

/** Dezelfde writer en referentie-invoer voor headless, fallback en worker. */
export function serializeRecoverySnapshot(source: IFCSaveSource): string {
  return serializeRecoveryInput(recoverySnapshotInput(source));
}
