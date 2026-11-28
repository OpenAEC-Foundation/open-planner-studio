import type { FileFilter, OpenDialogOpts, OpenedFile } from './index';
import { pickOpenPathTauri, readOpenedTauriPath, readsPathAsBytes, type TauriOpenIO } from './tauriBackend';
import { settlePendingReplaces } from './replaceRecords';

export async function tauriOpenIO(): Promise<TauriOpenIO> {
  const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  return { readTextFile, readFile, settle: path => settlePendingReplaces({ path }) };
}

export async function readOpenedPathTauri(path: string, asBytes: boolean): Promise<OpenedFile> {
  return readOpenedTauriPath(path, asBytes, await tauriOpenIO());
}

export async function openFileDialogTauri(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  const path = await pickOpenPathTauri(filters);
  return path === null ? null : readOpenedPathTauri(path, readsPathAsBytes(path, opts));
}
