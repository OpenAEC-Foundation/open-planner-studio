import { replaceWithRecoveryPending } from '@/services/recovery/recoveryPendingSource';
import {
  linkedOwnFile, replaceHelpersGone, replaceOwnFileBytes, tauriOwnFileReplaceFs,
  type OwnFileReplaceFs, type OwnFileReplaceOutcome, type RemnantEvent,
} from '@/services/fileAccess/ownFileReplace';
import { tauriReplaceRecords, whileReplaceRuns, type ReplaceRecordStore } from '@/services/fileAccess/replaceRecords';
import { userFileHelperId } from '@/services/fileAccess/atomicWrite';
import { replaceHandleWithBytes, sourceTargetContent, type FileRef, type RefuseBeforePlace } from '@/services/fileAccess';
import type { SourceTargetContent } from '@/services/fileAccess/sourceTargetContent';
import { replaceCopyLabel } from '@/i18n/replaceCopyName';
import {
  EXPORT_REPLACE_NEW_TARGET_ONLY_NOTICE, EXPORT_REPLACE_NOT_RECORDED_NOTICE, EXPORT_REPLACE_TARGET_CHANGED_NOTICE,
  EXPORT_REPLACE_TARGET_GONE_NOTICE, IFC_EXPORT_CHANGED_WHILE_WAITING_NOTICE, IFC_FOREIGN_PLACE_UNKNOWN_NOTICE, IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE,
  IFC_FOREIGN_SAVE_BLOCKED_NOTICE, IFC_FOREIGN_TARGET_CHANGED_NOTICE, IFC_FOREIGN_TARGET_GONE_NOTICE,
} from './ifcForeignGuard';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

export type OwnPathReplaceResult = OwnFileReplaceOutcome | { code: 'not-recorded' }
  | { code: 'stopped' };

export interface OwnPathReplaceInput {
  documentId: string | null;
  path: string;
  prepared: { bytes: Uint8Array; sha256: string };
  source: { bytes: Uint8Array; sha256: string };
  commit: () => void;
  stopBeforeWrite: () => Promise<boolean>;
  refuseBeforePlace: RefuseBeforePlace;
  planningChanged?: () => boolean;
  replaceAllowed?: () => boolean;
  fs?: OwnFileReplaceFs;
  records?: ReplaceRecordStore;
  now?: Date;
}

export async function replaceOwnPathWithRecovery(input: OwnPathReplaceInput): Promise<OwnPathReplaceResult> {
  const fs = input.fs ?? await tauriOwnFileReplaceFs();
  const target = await linkedOwnFile(fs, input.path);
  if (target.linked) return { code: 'save-as-only', why: 'linked target' };
  const records = input.records ?? await tauriReplaceRecords();
  const id = userFileHelperId();
  return whileReplaceRuns(id, async () => {
    try {
      await records.write({ id, path: input.path, vorigeSha256: input.source.sha256, pendingSha256: input.prepared.sha256 });
    } catch (error) {
      console.error('Herstelrecord van de vervanging niet vastgelegd:', input.path, error);
      return { code: 'not-recorded' };
    }
    let outcome: OwnFileReplaceOutcome | undefined;
    let nothingWritten = false;
    const steps = {
      replace: async () => {
        if (await input.stopBeforeWrite()) {
          outcome = { code: 'stopped' };
          nothingWritten = true;
          return false;
        }
        outcome = await replaceOwnFileBytes(fs, {
          path: input.path, id, bytes: input.prepared.bytes, source: input.source.bytes,
          ...(target.mode === undefined ? {} : { mode: target.mode }), label: replaceCopyLabel(input.now),
          refuseBeforePlace: input.refuseBeforePlace,
          planningChanged: input.planningChanged, replaceAllowed: input.replaceAllowed,
        });
        nothingWritten = outcome.code === 'save-as-only' && outcome.nothingWritten === true;
        return outcome.code === 'replaced';
      },
      commit: input.commit,
    };
    const recorded = input.documentId !== null
      ? await replaceWithRecoveryPending(input.documentId, input.prepared.sha256, steps)
      : await steps.replace() ? (steps.commit(), 'replaced' as const) : 'not-replaced' as const;
    if (recorded === 'not-recorded' || nothingWritten
      || (outcome!.code !== 'unknown' && await replaceHelpersGone(fs, input.path, id))) {
      await records.remove(id).catch(error => console.error('Herstelrecord van de vervanging niet gewist:', error));
    }
    return recorded === 'not-recorded' ? { code: 'not-recorded' } : outcome!;
  });
}

export type OwnHandleReplaceResult = { code: 'replaced' } | { code: 'not-recorded' }
  | { code: 'target-changed'; content: Exclude<SourceTargetContent, 'same'> }
  | { code: 'stopped' };

export async function replaceOwnHandleWithRecovery(input: {
  documentId: string;
  ref: Extract<FileRef, { kind: 'handle' }>;
  prepared: { bytes: Uint8Array; sha256: string };
  source: Uint8Array;
  stopBeforeWrite: () => boolean;
  refuseBeforePlace: RefuseBeforePlace;
  commit: () => void;
}): Promise<OwnHandleReplaceResult> {
  let changed: Exclude<SourceTargetContent, 'same'> | undefined;
  const outcome = await replaceWithRecoveryPending(input.documentId, input.prepared.sha256, {
    replace: async () => {
      if (input.stopBeforeWrite()) return false;
      return replaceHandleWithBytes(input.ref, input.prepared.bytes, async () => {
        const content = await sourceTargetContent(input.ref, input.source);
        if (content !== 'same') changed = content;
        return content === 'same';
      }, input.refuseBeforePlace);
    },
    commit: input.commit,
  });
  if (outcome === 'replaced') return { code: 'replaced' };
  if (outcome === 'not-recorded') return { code: 'not-recorded' };
  return changed ? { code: 'target-changed', content: changed } : { code: 'stopped' };
}

export function ownPathReplaceNotices(result: OwnPathReplaceResult, path: string): NotifyInput[] {
  switch (result.code) {
    case 'replaced': return [
      ...(result.otherVersion ? [otherVersionNotice(path, result.otherVersion)] : []),
      ...(result.leftOver ? [leftOverNotice(path, result.leftOver)] : []),
    ];
    case 'not-recorded': return [IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE];
    case 'stopped': return [];
    case 'planning-changed': return [IFC_EXPORT_CHANGED_WHILE_WAITING_NOTICE];
    case 'replace-withdrawn': return [IFC_FOREIGN_SAVE_BLOCKED_NOTICE];
    case 'target-changed': return [result.content === 'changed' ? IFC_FOREIGN_TARGET_CHANGED_NOTICE : IFC_FOREIGN_TARGET_GONE_NOTICE];
    case 'save-as-only': return [refusalNotice({
      messageKey: 'notifications.ifcForeignReplaceSaveAsOnly', detail: result.why, dedupeKey: 'ifc-foreign-replace-save-as-only',
    })];
    case 'failed': return [{
      severity: 'error', messageKey: 'notifications.ifcForeignReplaceFailed', detail: result.detail,
      dedupeKey: 'ifc-foreign-replace-failed', replaceOnDedupe: true,
    }];
    case 'unknown': return [IFC_FOREIGN_PLACE_UNKNOWN_NOTICE];
    case 'target-taken': return [{
      severity: 'error', messageKey: 'notifications.ifcForeignReplaceTargetTaken',
      params: { target: result.target, temp: result.temp, previous: result.previous },
    }];
    case 'previous-stranded': return [{
      severity: 'error', messageKey: 'notifications.ifcForeignReplacePreviousStranded',
      params: { previous: result.previous }, detail: result.detail,
    }];
  }
}

export function exportReplaceNotices(result: OwnPathReplaceResult, path: string): NotifyInput[] {
  switch (result.code) {
    case 'not-recorded': return [EXPORT_REPLACE_NOT_RECORDED_NOTICE];
    case 'target-changed': return [result.content === 'changed' ? EXPORT_REPLACE_TARGET_CHANGED_NOTICE : EXPORT_REPLACE_TARGET_GONE_NOTICE];
    case 'save-as-only': return [EXPORT_REPLACE_NEW_TARGET_ONLY_NOTICE];
    case 'failed': return [exportReplaceFailedNotice(result.detail)];
    case 'target-taken': return [{
      severity: 'error', messageKey: 'notifications.exportReplaceTargetTaken',
      params: { target: result.target, temp: result.temp, previous: result.previous },
    }];
    case 'previous-stranded': return [{
      severity: 'error', messageKey: 'notifications.exportReplacePreviousStranded',
      params: { previous: result.previous }, detail: result.detail,
    }];
    case 'replaced':
    case 'stopped':
    case 'planning-changed':
    case 'replace-withdrawn':
    case 'unknown': return ownPathReplaceNotices(result, path);
  }
}

export const exportReplaceFailedNotice = (detail: string | undefined): NotifyInput => ({
  severity: 'error', messageKey: 'notifications.exportReplaceFailed', detail,
  dedupeKey: 'export-replace-failed', replaceOnDedupe: true,
});

const otherVersionNotice = (file: string, copy: string): NotifyInput => ({
  severity: 'error', messageKey: 'notifications.ifcForeignReplaceOtherVersion', params: { file, copy },
});
const leftOverNotice = (file: string, path: string): NotifyInput => ({
  severity: 'error', messageKey: 'notifications.ifcForeignReplaceLeftOver', params: { file, path },
  dedupeKey: `ifc-foreign-replace-left-over:${path}`, replaceOnDedupe: true,
});

export function remnantNotices(events: readonly RemnantEvent[]): NotifyInput[] {
  return events.map((event): NotifyInput => event.kind === 'unsaved-schedule'
    ? { severity: 'error', messageKey: 'notifications.ifcForeignReplaceUnsavedCopy', params: { file: event.target, copy: event.copy } }
    : leftOverNotice(event.target, event.path));
}
