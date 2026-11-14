import { isTauri } from '@/utils/platform';
import type { DocumentPayload } from './documentContract';
import { recoverySaveTarget } from './ifcForeignGuard';
import { recoveryIfcSourceFields } from '@/services/recovery/recoveryIfcSource';
import { foreignSourceTargetOf } from '@/services/ifc/foreign/foreignSourceMark';
import type { RecoverySourceDocument } from '@/services/recovery/recoveryDelta';

/** De momentopname voor de hook: actuele bronmetadata, nooit een hash uit de serialisatiecache. */
export function recoverySourceDocument(id: string, payload: DocumentPayload, enabled: boolean): RecoverySourceDocument {
  return {
    id,
    // Een inmiddels gewone planning (bijvoorbeeld een opgeslagen backup) heeft geen modelbron
    // meer nodig. Oude manifesten/flag uit houden hun bestaande bron-ontbreekt-gedrag.
    source: enabled && payload.ifcSource && !payload.ifcSource.foreign && !payload.foreignSourceMark?.sourceMissing
      ? { ...payload, foreignSourceMark: null } : payload,
    ...recoverySaveTarget(payload),
    ...recoveryIfcSourceFields(payload, enabled),
    ...(enabled && !isTauri() && payload.ifcSource?.foreign && !payload.foreignSourceMark?.sourceMissing
      && (payload.siteFileId || !payload.foreignSourceMark?.handle) ? { sourceCopy: {
        bytes: payload.ifcSource.bytes, siteFileId: payload.siteFileId, siteFileVersion: payload.siteFileVersion,
      } } : {}),
    foreignSource: foreignSourceTargetOf(payload.foreignSourceMark),
    isDirty: payload.isDirty, datesAsRecorded: payload.datesAsRecorded,
  };
}
