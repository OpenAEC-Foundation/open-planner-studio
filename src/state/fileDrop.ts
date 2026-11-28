import type { AppState } from '@/state/appStoreFactory';
import type { ImportLabels } from '@/services/importTypes';
import { splitDroppedFiles, type DroppedFile } from '@/services/fileAccess/fileDrop';
import type { FormatReadOptions } from '@/services/formatRegistry';
import { openFailureNotices } from '@/state/slices/fileSlice';
import { looksUpOpenTab, startOpenLookup, type HandleRef, type OpenLookup } from '@/state/openDocumentFor';

export function fileNameList(names: readonly string[]): string {
  const MAX = 5;
  return names.length <= MAX ? names.join(', ') : `${names.slice(0, MAX).join(', ')}, …`;
}

interface FileDropStore {
  getState(): Pick<AppState, 'openOpenedFile' | 'notify' | 'ui' | 'getOpenDocumentPayloads'>;
}

export async function openDroppedFiles(
  store: FileDropStore,
  files: readonly DroppedFile[],
  labels: ImportLabels,
  isBlocked: () => boolean,
  options: { waitWhenBlocked?: boolean; readOptions?: FormatReadOptions } = {},
): Promise<void> {
  if (files.length === 0) return;
  if (!options.waitWhenBlocked && isBlocked()) {
    store.getState().notify({
      severity: 'error',
      messageKey: 'notifications.fileDropBlocked',
      params: { names: fileNameList(files.map((f) => f.name)) },
      dedupeKey: 'file-drop-blocked',
      replaceOnDedupe: true,
    });
    return;
  }
  const { openable, refused } = splitDroppedFiles(files, options.readOptions);
  if (refused.length > 0) {
    store.getState().notify({
      severity: 'error',
      messageKey: options.readOptions?.ifcx ? 'ifcx.fileDropRefused' : 'notifications.fileDropRefused',
      params: { names: fileNameList(refused) },
      helpArticleId: 'howto-bestand-openen-en-opslaan',
      dedupeKey: 'file-drop-refused',
      replaceOnDedupe: true,
    });
  }
  const waitWhile = () => isBlocked() || store.getState().ui.pendingFormatNotice !== null;
  const readOptions = options.readOptions;
  for (const file of openable) {
    let lookup: OpenLookup | null = null;
    const beforeRead = readOptions && looksUpOpenTab(readOptions, file.name)
      ? (ref: HandleRef) => { lookup = startOpenLookup(store.getState(), ref); }
      : undefined;
    let opened;
    try {
      opened = await file.read(beforeRead);
    } catch (err) {
      console.error('Failed to read dropped file:', err);
      for (const notice of openFailureNotices(err)) store.getState().notify(notice);
      continue;
    }
    await store.getState().openOpenedFile(opened, labels, {
      waitWhile, existingDocument: file.existingDocument, stale: file.stale, lookup,
    });
  }
}
