// De desktop opent een lokaal pad (de dialoog, neerzetten en Recent) via één kern, `readOpenedTauriPath`: eerst een
// onafgeronde vervanging van dat pad afhandelen (knownbug 1131 stap 5, `settlePendingReplaces`), dan pas lezen. Hier de
// echte invulling; een eigen module, omdat `replaceRecords` via `ownFileReplace` zelf `tauriBackend` gebruikt.
import type { FileFilter, OpenDialogOpts, OpenedFile } from './index';
import { pickOpenPathTauri, readOpenedTauriPath, type TauriOpenIO } from './tauriBackend';
import { settlePendingReplaces } from './replaceRecords';

/** De echte `TauriOpenIO`: plugin-fs en het afhandelen van herstelrecords. */
export async function tauriOpenIO(): Promise<TauriOpenIO> {
  const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  return { readTextFile, readFile, settle: path => settlePendingReplaces({ path }) };
}

/** Een lokaal pad lezen om het te openen (Recent). */
export async function readOpenedPathTauri(path: string, opts?: OpenDialogOpts): Promise<OpenedFile> {
  return readOpenedTauriPath(path, opts, await tauriOpenIO());
}

/** Bestand → Openen op de desktop. */
export async function openFileDialogTauri(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  const path = await pickOpenPathTauri(filters);
  return path === null ? null : readOpenedPathTauri(path, opts);
}
