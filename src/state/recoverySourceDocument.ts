import { isTauri } from '@/utils/platform';
import type { DocumentPayload } from './documentContract';
import { recoverySaveTarget } from './ifcForeignGuard';
import { recoveryIfcSourceFields } from '@/services/recovery/recoveryIfcSource';
import { pendingIfcSourceSha256 } from '@/services/recovery/recoveryPendingSource';
import { foreignSourceTargetOf } from '@/services/ifc/foreign/foreignSourceMark';
import type { RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { ifcxModelSession } from '@/services/ifc/ifcxModelSession';
import { storeIfcxReferences } from '@/services/recovery/recoveryIfcx';
import { recentIdForHandle } from '@/services/fileAccess/recentFiles';

/** De momentopname voor de hook: actuele bronmetadata, nooit een hash uit de serialisatiecache. */
export function recoverySourceDocument(id: string, payload: DocumentPayload, enabled: boolean, withIfcx = false): RecoverySourceDocument {
  const references = withIfcx && payload.ifcxReferences;
  const model = references && ifcxModelSession(references)?.ref;
  const targetRecentId = references && payload.fileHandle && recentIdForHandle(payload.fileHandle);
  return {
    id,
    // Een inmiddels gewone planning (bijvoorbeeld een opgeslagen backup) heeft geen modelbron
    // meer nodig. Expliciet sourceMissing: false bewaart juist de doelbescherming van 9e;
    // oude manifesten/flag uit houden hun bestaande bron-ontbreekt-gedrag.
    source: enabled && payload.ifcSource && !payload.ifcSource.foreign && payload.foreignSourceMark?.sourceMissing === undefined
      ? { ...payload, foreignSourceMark: null } : payload,
    ...recoverySaveTarget(payload),
    ...recoveryIfcSourceFields(payload, enabled, pendingIfcSourceSha256(id)),
    ...(enabled && !isTauri() && payload.ifcSource?.foreign && !payload.foreignSourceMark?.sourceMissing
      && (payload.siteFileId || !payload.foreignSourceMark?.handle) ? { sourceCopy: {
        bytes: payload.ifcSource.bytes, siteFileId: payload.siteFileId, siteFileVersion: payload.siteFileVersion,
      } } : {}),
    foreignSource: foreignSourceTargetOf(payload.foreignSourceMark),
    isDirty: payload.isDirty, datesAsRecorded: payload.datesAsRecorded,
    ...(payload.fileFormat === 'ifcx' || references ? { ifcx: {
      known: payload.knownTargetFingerprint,
      ...(references && payload.fileFormat !== 'ifcx' ? { format: payload.fileFormat } : {}),
      ...(references ? { references: storeIfcxReferences(references) } : {}),
      ...(targetRecentId ? { targetRecentId } : {}),
      ...(model && model.kind !== 'handle' ? { modelLocation: model } : {}),
    } } : {}),
  };
}

export function unchangedIfcxSaveTargets(
  documents: readonly RecoverySourceDocument[], current: () => readonly { id: string; payload: DocumentPayload }[],
  enabled: boolean,
): boolean {
  const linked = documents.filter(doc => doc.ifcx?.references);
  if (!linked.length) return true;
  if (!enabled) return false;
  const open = new Map(current().map(doc => [doc.id, doc.payload]));
  return linked.every(doc => {
    const payload = open.get(doc.id);
    return payload && payload.ifcxReferences && payload.filePath === doc.filePath
      && (!payload.fileHandle || recentIdForHandle(payload.fileHandle) === doc.ifcx?.targetRecentId)
      && payload.knownTargetFingerprint === doc.ifcx?.known && payload.siteFileId === (doc.siteFileId ?? null)
      && payload.siteFileVersion === (doc.siteFileVersion ?? null);
  });
}
