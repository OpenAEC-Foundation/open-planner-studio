import { idbGetAll, idbPut } from '@/utils/idb';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export type DependentFolderRef =
  | { kind: 'path'; path: string }
  | { kind: 'handle'; handle: FileSystemDirectoryHandle }
  | { kind: 'files'; files: File[] };

export interface DependentFolderFile {
  name: string;
  text: string;
}

export function canPickDirectoryInBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

function isIfcName(name: string): boolean {
  return name.toLowerCase().endsWith('.ifc');
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function pickFilesViaInput(): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.ifc';
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      resolve(files.length > 0 ? files : null);
    };
    input.click();
  });
}

export async function pickDependentFolder(
  start?: { path?: string; handle?: FileSystemDirectoryHandle | null },
): Promise<DependentFolderRef | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, multiple: false, ...(start?.path ? { defaultPath: start.path } : {}) });
    return typeof selected === 'string' && selected ? { kind: 'path', path: selected } : null;
  }
  if (canPickDirectoryInBrowser()) {
    try {
      const handle = await window.showDirectoryPicker!({
        mode: 'read', ...(start?.handle ? { startIn: start.handle } : { id: 'ops-dependent-projects' }),
      });
      return { kind: 'handle', handle };
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }
  const files = await pickFilesViaInput();
  return files ? { kind: 'files', files } : null;
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

export async function readDependentFolder(ref: DependentFolderRef): Promise<DependentFolderFile[]> {
  const out: DependentFolderFile[] = [];
  if (ref.kind === 'path') {
    const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(ref.path);
    for (const entry of entries) {
      if (!entry.isFile || !isIfcName(entry.name)) continue;
      try {
        out.push({ name: joinPath(ref.path, entry.name), text: await readTextFile(joinPath(ref.path, entry.name)) });
      } catch { }
    }
  } else if (ref.kind === 'handle') {
    for await (const entry of ref.handle.values()) {
      if (entry.kind !== 'file' || !isIfcName(entry.name)) continue;
      try {
        out.push({ name: entry.name, text: await (await (entry as FileSystemFileHandle).getFile()).text() });
      } catch { }
    }
  } else {
    for (const file of ref.files) {
      if (!isIfcName(file.name)) continue;
      try { out.push({ name: file.name, text: await file.text() }); } catch { }
    }
  }
  return out;
}

const DB = 'ops-dependent-folders';
const STORE = 'folders';

interface StoredFolder {
  id: string;
  handle: FileSystemDirectoryHandle;
}

export async function rememberDependentFolderHandle(projectId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  if (!projectId) return;
  const entry: StoredFolder = { id: projectId, handle };
  await idbPut(DB, STORE, entry);
}

export async function rememberedDependentFolderHandle(projectId: string): Promise<FileSystemDirectoryHandle | null> {
  if (!projectId || typeof indexedDB === 'undefined') return null;
  const all = await idbGetAll<StoredFolder>(DB, STORE);
  return all.find(entry => entry.id === projectId)?.handle ?? null;
}

export async function dependentFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    return (await handle.queryPermission?.({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
}
