import type { FileFilter, FileRef, OpenDialogOpts, OpenedFile, SaveOutcome } from './index';
import { ensureExtension, extensionOf } from '@/utils/filePath';

const basename = (p: string): string => p.split(/[\\/]/).pop() || p;

export interface TauriOpenIO {
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

/** Injecteerbare kern van de Tauri-openroute: bewaakt vooral dat binaire bronformaten nooit via
 * `readTextFile` lopen en hun oorspronkelijke bytes dus behouden. */
export async function readOpenedTauriPath(
  path: string,
  opts: OpenDialogOpts | undefined,
  io: TauriOpenIO,
): Promise<OpenedFile> {
  const isBinary = (opts?.binaryExtensions ?? []).includes(extensionOf(path));
  if (isBinary) {
    const bytes = await io.readFile(path);
    return { name: basename(path), content: '', bytes, ref: { kind: 'path', path } };
  }
  const content = await io.readTextFile(path);
  return { name: basename(path), content, ref: { kind: 'path', path } };
}

export async function openFileDialogTauri(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ multiple: false, filters });
  if (!selected) return null;
  const path = selected as string;
  const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  return readOpenedTauriPath(path, opts, { readTextFile, readFile });
}

export async function saveFileDialogTauri(defaultName: string, content: string, filters: FileFilter[]): Promise<SaveOutcome | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const picked = await save({ defaultPath: defaultName, filters });
  if (!picked) return null;
  // Linux/GTK plakt de filter-extensie niet automatisch → normaliseren (net als de oude code).
  const ext = filters[0]?.extensions[0] ?? '';
  const savedPath = ext ? ensureExtension(picked, ext) : picked;
  await writeTextFile(savedPath, content);
  return { ref: { kind: 'path', path: savedPath }, name: basename(savedPath) };
}

export async function saveToRefTauri(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind !== 'path') return false;
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(ref.path, content);
  return true;
}

export async function readFromRefTauri(ref: FileRef): Promise<string | null> {
  if (ref.kind !== 'path') return null;
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return await readTextFile(ref.path);
  } catch {
    return null;
  }
}

export async function readBytesFromRefTauri(ref: FileRef): Promise<Uint8Array | null> {
  if (ref.kind !== 'path') return null;
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    return await readFile(ref.path);
  } catch {
    return null;
  }
}
