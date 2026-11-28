import type { AppState } from '@/state/appStoreFactory';
import type { ImportLabels } from '@/services/importTypes';
import type { TauriOpenIO } from '@/services/fileAccess/tauriBackend';
import { droppedFilesFromPaths, type DroppedFile } from '@/services/fileAccess/fileDrop';
import type { FormatReadOptions } from '@/services/formatRegistry';
import { openDroppedFiles } from '@/state/fileDrop';
import { openDocumentIdForPath, openDocumentIdForPathText } from '@/state/ifcForeignGuard';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import { projectFileWriteTurns } from '@/services/fileAccess/writeCoordinator';

export const OPEN_FILES_EVENT = 'ops:open-files';
export const OPEN_FILES_READY_EVENT = 'ops:open-files-ready';

export interface LaunchFilesBus {
  listen(event: string, handler: (payload: unknown) => void): Promise<() => void>;
  emit(event: string): Promise<void>;
}

export function launchPaths(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter((p): p is string => typeof p === 'string' && p.length > 0);
}

export async function listenForLaunchFiles(bus: LaunchFilesBus, onPaths: (paths: string[]) => void): Promise<() => void> {
  const stop = await bus.listen(OPEN_FILES_EVENT, (payload) => {
    const paths = launchPaths(payload);
    if (paths.length > 0) onPaths(paths);
  });
  await bus.emit(OPEN_FILES_READY_EVENT);
  return stop;
}

interface LaunchFilesStore {
  getState(): Pick<AppState, 'openOpenedFile' | 'notify' | 'ui' | 'getOpenDocumentPayloads'>;
}

function openFilePath(store: LaunchFilesStore, id: string): string | null {
  return store.getState().getOpenDocumentPayloads().find((doc) => doc.id === id)?.payload.filePath ?? null;
}

export interface LaunchFileOptions {
  readOptions?: FormatReadOptions;
  identityFs?: () => Promise<FileIdentityFs | undefined>;
}

export async function openLaunchFiles(
  store: LaunchFilesStore,
  paths: readonly string[],
  io: TauriOpenIO,
  labels: ImportLabels,
  isBlocked: () => boolean,
  options: LaunchFileOptions = {},
): Promise<void> {
  const identityFs = options.identityFs ?? (async () => undefined);
  let pending: readonly string[] = paths;
  while (pending.length > 0) {
    const reread: string[] = [];
    const files = droppedFilesFromPaths(pending, io, options.readOptions).map((file, index): DroppedFile => {
      const path = pending[index];
      let writesAtRead = -1;
      let viaIdentity: { id: string; filePath: string } | null = null;
      return {
        name: file.name,
        read: async () => {
          writesAtRead = projectFileWriteTurns();
          const opened = await file.read();
          const pathsBefore = new Map(store.getState().getOpenDocumentPayloads().map((doc) => [doc.id, doc.payload.filePath]));
          const id = await openDocumentIdForPath(store.getState(), path, identityFs).catch(() => null);
          const filePath = id === null ? null : pathsBefore.get(id) ?? null;
          viaIdentity = id !== null && filePath !== null ? { id, filePath } : null;
          return opened;
        },
        existingDocument: () => {
          if (viaIdentity !== null && openFilePath(store, viaIdentity.id) === viaIdentity.filePath) return viaIdentity.id;
          return openDocumentIdForPathText(store.getState(), path);
        },
        stale: () => {
          if (projectFileWriteTurns() === writesAtRead) return false;
          reread.push(path);
          return true;
        },
      };
    });
    await openDroppedFiles(store, files, labels, isBlocked, { waitWhenBlocked: true, ...(options.readOptions?.ifcx ? { readOptions: { ifcx: true } } : {}) });
    pending = reread;
  }
}
