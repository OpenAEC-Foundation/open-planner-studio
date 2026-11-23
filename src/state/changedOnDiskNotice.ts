import type { StoreApi } from 'zustand';
import type { AppState } from './appStoreFactory';
import type { DocumentPayload } from './documentContract';

export type ChangedOnDiskStore = Pick<StoreApi<AppState>, 'getState' | 'subscribe'>;

type TabTarget = Pick<DocumentPayload, 'filePath' | 'fileHandle' | 'siteFileId' | 'siteFileVersion' | 'knownTargetFingerprint'>;

export const changedOnDiskNoticeKey = (documentId: string) => `file-changed-on-disk:${documentId}`;

function targetOf(s: AppState, documentId: string): TabTarget | null {
  if (s.activeDocumentId === documentId) return s;
  return s.documents.find(document => document.id === documentId)?.payload ?? null;
}

function sameTarget(a: TabTarget, b: TabTarget): boolean {
  return a.filePath === b.filePath && a.fileHandle === b.fileHandle && a.siteFileId === b.siteFileId
    && a.siteFileVersion === b.siteFileVersion
    && a.knownTargetFingerprint?.sha256 === b.knownTargetFingerprint?.sha256
    && a.knownTargetFingerprint?.byteLength === b.knownTargetFingerprint?.byteLength;
}

const targetCopy = (t: TabTarget): TabTarget => ({
  filePath: t.filePath, fileHandle: t.fileHandle, siteFileId: t.siteFileId, siteFileVersion: t.siteFileVersion,
  knownTargetFingerprint: t.knownTargetFingerprint,
});

export function dismissChangedOnDiskNotice(s: Pick<AppState, 'ui' | 'dismissNotification'>, documentId: string): void {
  const notice = s.ui.notifications.find(n => n.dedupeKey === changedOnDiskNoticeKey(documentId));
  if (notice) s.dismissNotification(notice.id);
}

function watchNotice(store: ChangedOnDiskStore, documentId: string, shown: TabTarget): void {
  const key = changedOnDiskNoticeKey(documentId);
  const stop = store.subscribe((s) => {
    const notice = s.ui.notifications.find(n => n.dedupeKey === key);
    if (!notice) { stop(); return; }
    const now = targetOf(s, documentId);
    if (now && sameTarget(now, shown)) return;
    stop();
    s.dismissNotification(notice.id);
  });
}

export function notifyChangedOnDisk(store: ChangedOnDiskStore, documentId: string, name: string): void {
  const s = store.getState();
  const target = targetOf(s, documentId);
  if (!target) return;
  const key = changedOnDiskNoticeKey(documentId);
  const watched = s.ui.notifications.some(n => n.dedupeKey === key);
  s.notify({
    severity: 'info',
    sticky: true,
    messageKey: 'notifications.fileChangedOnDisk',
    params: { name },
    dedupeKey: key,
    replaceOnDedupe: true,
    action: { kind: 'loadNewVersion', documentId, labelKey: 'notifications.actions.loadNewVersion' },
  });
  if (!watched) watchNotice(store, documentId, targetCopy(target));
}
