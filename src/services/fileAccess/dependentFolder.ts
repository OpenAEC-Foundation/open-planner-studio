// De map met afhankelijke projecten kiezen en lezen (stap 1.11 van "relaties tussen projecten",
// keuze 7, `docs/relaties-tussen-projecten.md` §7.3). Alleen-lezen: OPS opent hier niets als document.
//
//  - Desktop (Tauri): een mapkiezer; OPS leest de `.ifc`-bestanden direct in die map (niet in submappen).
//    Het pad staat als projectinstelling in het IFC-bestand (`Project.dependentProjectsFolder`).
//  - Browser, Chromium: `showDirectoryPicker`. Het maphandvat staat in IndexedDB per project-id, zoals
//    de recente bestanden hun handvat bewaren. Op de achtergrond leest OPS hem alleen met toestemming
//    `granted` (`queryPermission`); de knop opent de mapkiezer, die bij de onthouden map begint.
//  - Andere browsers: een paar bestanden kiezen; niets onthouden.
import { idbDelete, idbGetAll, idbPut } from '@/utils/idb';
import { basename } from '@/utils/filePath';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Waar de afhankelijke projecten staan. */
export type DependentFolderRef =
  | { kind: 'path'; path: string }
  | { kind: 'handle'; handle: FileSystemDirectoryHandle }
  | { kind: 'files'; files: File[] };

/** Een gelezen bestand uit de map. */
export interface DependentFolderFile {
  name: string;
  text: string;
}

/** Of de browser een map kan kiezen (Chromium). */
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

/** Laat de planner een map (of in andere browsers: bestanden) kiezen. `null` ⇒ geannuleerd. */
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

/** De naam van de map of de bestanden, voor de tekst. */
export function dependentFolderLabel(ref: DependentFolderRef): string {
  if (ref.kind === 'path') return basename(ref.path) || ref.path;
  if (ref.kind === 'handle') return ref.handle.name;
  return ref.files.map(f => f.name).join(', ');
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

/**
 * Leest de `.ifc`-bestanden direct in de map, alleen-lezen. Een bestand dat niet te lezen is, slaat
 * OPS over. Een map die niet te lezen is (weg, geen toegang) geeft een fout.
 */
export async function readDependentFolder(ref: DependentFolderRef): Promise<DependentFolderFile[]> {
  const out: DependentFolderFile[] = [];
  if (ref.kind === 'path') {
    const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');
    const entries = await readDir(ref.path);
    for (const entry of entries) {
      if (!entry.isFile || !isIfcName(entry.name)) continue;
      try {
        out.push({ name: joinPath(ref.path, entry.name), text: await readTextFile(joinPath(ref.path, entry.name)) });
      } catch { /* onleesbaar bestand: overslaan */ }
    }
  } else if (ref.kind === 'handle') {
    for await (const entry of ref.handle.values()) {
      if (entry.kind !== 'file' || !isIfcName(entry.name)) continue;
      try {
        out.push({ name: entry.name, text: await (await (entry as FileSystemFileHandle).getFile()).text() });
      } catch { /* onleesbaar bestand: overslaan */ }
    }
  } else {
    for (const file of ref.files) {
      if (!isIfcName(file.name)) continue;
      try { out.push({ name: file.name, text: await file.text() }); } catch { /* overslaan */ }
    }
  }
  return out;
}

// ---- Het maphandvat per project-id (Chromium) ----

const DB = 'ops-dependent-folders';
const STORE = 'folders';

interface StoredFolder {
  /** Het project-id. */
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

export async function forgetDependentFolderHandle(projectId: string): Promise<void> {
  await idbDelete(DB, STORE, projectId);
}

/**
 * Mag OPS de map op de achtergrond lezen? Alleen met toestemming `granted`; deze functie vraagt niets
 * (`queryPermission`). Toestemming vragen mag alleen bij een klik: de knop opent daarom de mapkiezer,
 * en die geeft de toestemming voor de gekozen map.
 */
export async function dependentFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    return (await handle.queryPermission?.({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
}
