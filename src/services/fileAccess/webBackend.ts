import type { FileFilter, FileRef, OpenedFile, SaveOutcome } from './index';

const hasFSA = (): boolean => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** Onze FileFilter[] → de picker `types`-vorm (accept: MIME → extensies met punt). */
function toAcceptTypes(filters: FileFilter[]): FilePickerAcceptType[] {
  return filters.map((f) => ({
    description: f.name,
    accept: { 'application/octet-stream': f.extensions.map((e) => `.${e}`) },
  }));
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

// ---- Fallback (Firefox/Safari): <input type=file> + blob-download ----

function openViaInput(filters: FileFilter[]): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const content = await file.text();
      resolve({ name: file.name, content, ref: null });
    };
    input.click();
  });
}

function downloadBlob(name: string, content: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Publieke web-backend ----

export async function openFileDialogWeb(filters: FileFilter[]): Promise<OpenedFile | null> {
  if (hasFSA()) {
    try {
      const [handle] = await window.showOpenFilePicker!({ multiple: false, types: toAcceptTypes(filters) });
      const file = await handle.getFile();
      const content = await file.text();
      return { name: file.name, content, ref: { kind: 'handle', handle } };
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }
  return openViaInput(filters);
}

export async function saveFileDialogWeb(defaultName: string, content: string, filters: FileFilter[]): Promise<SaveOutcome | null> {
  if (hasFSA()) {
    try {
      const handle = await window.showSaveFilePicker!({ suggestedName: defaultName, types: toAcceptTypes(filters) });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      const file = await handle.getFile();
      return { ref: { kind: 'handle', handle }, name: file.name };
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }
  // Fallback: download; geen herbruikbare ref.
  downloadBlob(defaultName, content);
  return { ref: null, name: defaultName };
}

export async function saveToRefWeb(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind !== 'handle') return false;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  // In-place opslaan vereist readwrite; showOpenFilePicker geeft alleen read (spec §3.2).
  try {
    if ((await handle.queryPermission?.(opts)) !== 'granted') {
      if ((await handle.requestPermission?.(opts)) !== 'granted') return false;
    }
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function readFromRefWeb(ref: FileRef): Promise<string | null> {
  if (ref.kind !== 'handle') return null;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  try {
    if ((await handle.queryPermission?.(opts)) !== 'granted') {
      if ((await handle.requestPermission?.(opts)) !== 'granted') return null;
    }
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}
