import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import type { XerSourceArchive } from '@/services/xerSourceArchive';

/** Uitsluitend clonebare writer-invoer; nooit een documentpayload met handles of archiefbytes. */
export interface RecoverySnapshotInput {
  input: Omit<WriteIFCInput, 'xerSourceArchive' | 'xer'>;
  archive?: Pick<XerSourceArchive, 'format' | 'byteLength' | 'sha256'> & { selectorValid: boolean };
}

export function recoverySnapshotInput(source: IFCSaveSource): RecoverySnapshotInput {
  const { xerSourceArchive: archive, xer, ...input } = buildWriteIFCInput(source);
  const selector = xer?.sourceProjectId ?? input.xerSourceProjectId;
  return {
    input: { ...input, xerSourceProjectId: selector, xerSourceArchiveStorage: 'recovery-reference' },
    ...(archive ? { archive: {
      format: archive.format, byteLength: archive.byteLength, sha256: archive.sha256,
      selectorValid: !!(selector && archive.diagnostics.documentViews[selector]),
    } } : {}),
  };
}

export function serializeRecoveryInput({ input, archive }: RecoverySnapshotInput): string {
  // De referentietak van de writer leest alleen deze velden en de geldigheid van de selector.
  // Bewust een smalle adapter: het volledige archief (bytes, readModel, diagnostics) wordt nooit
  // gekloond. Pariteitstests bewaken dat deze tak geen andere archiefvelden gaat gebruiken.
  const reference = archive ? {
    format: archive.format, byteLength: archive.byteLength, sha256: archive.sha256,
    diagnostics: { documentViews: archive.selectorValid && input.xerSourceProjectId
      ? { [input.xerSourceProjectId]: true } : {} },
  } as unknown as XerSourceArchive : undefined;
  return writeIFC({ ...input, xerSourceArchive: reference });
}

/** Dezelfde writer en referentie-invoer voor headless, fallback en worker. */
export function serializeRecoverySnapshot(source: IFCSaveSource): string {
  return serializeRecoveryInput(recoverySnapshotInput(source));
}
