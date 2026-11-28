import type { FileRef, OpenedFile } from './index';
import { openedFromFile } from './webBackend';
import { readOpenedTauriPath, readsPathAsBytes, type TauriOpenIO } from './tauriBackend';
import { basename } from '@/utils/filePath';
import { binaryExtensions, isReadableFileName, type FormatReadOptions } from '@/services/formatRegistry';

export interface DroppedFile {
  name: string;
  read(beforeRead?: (ref: Extract<FileRef, { kind: 'handle' }>) => void): Promise<OpenedFile>;
  existingDocument?: () => string | null;
  stale?: () => boolean;
}

export interface DataTransferLike {
  types: ArrayLike<string>;
  items?: ArrayLike<Pick<DataTransferItem, 'kind' | 'getAsFile' | 'getAsFileSystemHandle'>> | null;
  files?: ArrayLike<File> | null;
}

export function dragCarriesFiles(dt: Pick<DataTransferLike, 'types'> | null | undefined): boolean {
  return !!dt && Array.from(dt.types).includes('Files');
}

function handleOf(item: Pick<DataTransferItem, 'getAsFileSystemHandle'>): Promise<FileSystemHandle | null> {
  if (typeof item.getAsFileSystemHandle !== 'function') return Promise.resolve(null);
  try {
    return item.getAsFileSystemHandle().catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

function webDroppedFile(file: File, handle: Promise<FileSystemHandle | null>, readOptions?: FormatReadOptions): DroppedFile {
  return {
    name: file.name,
    read: async (beforeRead) => {
      const h = await handle;
      const ref = h && h.kind === 'file' ? { kind: 'handle', handle: h as FileSystemFileHandle } as const : null;
      if (ref) beforeRead?.(ref);
      return openedFromFile(file, ref, { binaryExtensions: binaryExtensions(readOptions) });
    },
  };
}

export function droppedFilesFromDataTransfer(dt: DataTransferLike, readOptions?: FormatReadOptions): DroppedFile[] {
  const items = dt.items ? Array.from(dt.items) : [];
  if (items.length > 0) {
    const out: DroppedFile[] = [];
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;
      out.push(webDroppedFile(file, handleOf(item), readOptions));
    }
    return out;
  }
  return Array.from(dt.files ?? []).map((file) => webDroppedFile(file, Promise.resolve(null), readOptions));
}

export function droppedFilesFromPaths(paths: readonly string[], io: TauriOpenIO, readOptions?: FormatReadOptions): DroppedFile[] {
  return paths.map((path) => ({
    name: basename(path),
    read: () => readOpenedTauriPath(path, readsPathAsBytes(path, { binaryExtensions: binaryExtensions(readOptions) }), io),
  }));
}

export function splitDroppedFiles(files: readonly DroppedFile[], readOptions?: FormatReadOptions): { openable: DroppedFile[]; refused: string[] } {
  const openable: DroppedFile[] = [];
  const refused: string[] = [];
  for (const file of files) {
    if (isReadableFileName(file.name, readOptions)) openable.push(file);
    else refused.push(file.name);
  }
  return { openable, refused };
}
