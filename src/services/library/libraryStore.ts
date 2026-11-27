import { isTauri } from '@/utils/platform';
import type { CompanyLibrary } from '@/types/library';
import { createDefaultLibrary } from '@/types/library';
import { writeTextFileAtomic } from '@/services/fileAccess/atomicWrite';
import { openDb } from '@/utils/idb';

const LIBRARY_FILE = 'ops-library.json';

const openLibraryDb = (): Promise<IDBDatabase> => openDb('ops-library', 'library', 'key');

async function loadWeb(): Promise<CompanyLibrary | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', 'readonly');
    const req = tx.objectStore('library').get('library');
    req.onsuccess = () => resolve((req.result as { key: string; value: CompanyLibrary } | undefined)?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveWeb(lib: CompanyLibrary): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', 'readwrite');
    tx.objectStore('library').put({ key: 'library', value: lib });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadTauri(): Promise<CompanyLibrary | null> {
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const path = await join(await appDataDir(), LIBRARY_FILE);
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readTextFile(path)) as CompanyLibrary;
  } catch {
    return null;
  }
}

async function saveTauri(lib: CompanyLibrary): Promise<void> {
  const { mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  await mkdir(dir, { recursive: true });
  await writeTextFileAtomic(dir, LIBRARY_FILE, JSON.stringify(lib));
}

export async function loadLibrary(): Promise<CompanyLibrary> {
  const loaded = isTauri() ? await loadTauri() : await loadWeb().catch(() => null);
  return loaded ?? createDefaultLibrary();
}

let lastSave: Promise<void> = Promise.resolve();

export function saveLibrary(lib: CompanyLibrary): Promise<void> {
  const run = () => (isTauri() ? saveTauri(lib) : saveWeb(lib));
  const result = lastSave.then(run, run);
  lastSave = result.catch(() => {});
  return result;
}
