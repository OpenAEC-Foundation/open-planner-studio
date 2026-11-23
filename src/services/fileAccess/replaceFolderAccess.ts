import { isForbiddenPathError, userFileDir, userFileTempPath } from './atomicWrite';

export type FolderAccessAsker = (folder: string) => Promise<boolean>;

const cancel: FolderAccessAsker = () => Promise.resolve(false);
let asker: FolderAccessAsker = cancel;

export function setFolderAccessAsker(fn: FolderAccessAsker): void { asker = fn; }
export function resetFolderAccessAsker(): void { asker = cancel; }

export function replaceFolder(path: string): string {
  const dir = userFileDir(path), trimmed = dir.replace(/[\\/]$/, '');
  return trimmed === '' || /^[a-z]:$/i.test(trimmed) ? dir : trimmed;
}

async function helperAllowed(path: string): Promise<boolean> {
  const { exists } = await import('@tauri-apps/plugin-fs');
  try {
    await exists(userFileTempPath(path));
    return true;
  } catch (error) {
    return !isForbiddenPathError(error);
  }
}

const restoredRecursively = (folder: string) => folder.endsWith('**');

export async function requestReplaceFolderAccessTauri(path: string): Promise<boolean> {
  if (await helperAllowed(path)) return true;
  const folder = replaceFolder(path);
  if (restoredRecursively(folder)) return true;
  if (!(await asker(folder))) return false;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const chosen = await open({ directory: true, multiple: false, recursive: false, defaultPath: folder });
  return chosen !== null && await helperAllowed(path);
}
