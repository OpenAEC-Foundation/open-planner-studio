import type { FileFilter, FileRef, OpenedFile, SaveOutcome } from './index';
import { ensureExtension } from '@/utils/filePath';

const basename = (p: string): string => p.split(/[\\/]/).pop() || p;

export async function openFileDialogTauri(filters: FileFilter[]): Promise<OpenedFile | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const selected = await open({ multiple: false, filters });
  if (!selected) return null;
  const path = selected as string;
  const content = await readTextFile(path);
  return { name: basename(path), content, ref: { kind: 'path', path } };
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
