import type { IFCSaveSource } from '@/state/ifcSaveInput';
import { recoverySnapshotInput, serializeRecoverySnapshot, writeRecoverySnapshot, type RecoverySnapshot } from './recoverySnapshotInput';
import { saveRecovery } from './recoveryStore';
import type { RecoveryDeltaTracker, RecoverySourceDocument } from './recoveryDelta';
import { confirmRecordedPending } from './recoveryPendingSource';

export { serializeRecoverySnapshot };

export async function runRecoveryTick(
  tracker: RecoveryDeltaTracker,
  activeDocumentId: string | null,
  documents: readonly RecoverySourceDocument[],
  serialize: (source: IFCSaveSource, identities: boolean) => Promise<string | RecoverySnapshot> = async (source, identities) => writeRecoverySnapshot(recoverySnapshotInput(source, identities)),
  enabled: () => boolean = () => true,
  onSourceCopyFailure?: (documentId: string) => void,
): Promise<boolean> {
  return tracker.runExclusive(async () => {
    const retained = documents.filter(document => !document.source.ifcxReferences || document.ifcx?.references);
    const active = activeDocumentId && documents.some(doc => doc.id === activeDocumentId && doc.source.ifcxReferences && !doc.ifcx?.references)
      ? retained[0]?.id ?? null : activeDocumentId;
    try {
      if (!enabled()) return false;
      const save = await tracker.prepareAsync(active, retained, serialize);
      if (!save || !enabled()) return false;
      await saveRecovery({ ...save, onSourceCopyFailure });
      tracker.commit(active, retained);
      return true;
    } finally {
      confirmRecordedPending(id => documents.some(d => d.id === id && !d.sourceCopy)
        ? tracker.persistedIfcSource(id)?.pendingSha256 : undefined);
    }
  });
}
