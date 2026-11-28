import type { FileData, FileFilter, FileRef, OpenDialogOpts, OpenedFile, RefuseBeforePlace, SaveDialogOpts, SaveOutcome } from './index';
import { extensionOf } from '@/utils/filePath';
import { bytesBlob, ByteWriteError } from './byteWrite';

const hasFSA = (): boolean => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

function toAcceptTypes(filters: FileFilter[]): FilePickerAcceptType[] {
  return filters.map((f) => ({
    description: f.name,
    accept: { 'application/octet-stream': f.extensions.map((e) => `.${e}`) },
  }));
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function isNotAllowedRefusal(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotAllowedError';
}

function isSecurityRefusal(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'SecurityError';
}

function isPlatformRefusal(err: unknown): boolean {
  return isNotAllowedRefusal(err) || isSecurityRefusal(err);
}

function featurePolicyBlocksFSA(): boolean {
  const fp = typeof document !== 'undefined' ? document.featurePolicy : undefined;
  if (!fp || typeof fp.allowsFeature !== 'function') return false;
  try {
    return fp.allowsFeature('file-system-access') === false;
  } catch {
    return false;
  }
}

let platformRefusesWrites = false;

export function webWriteRefusedByPlatform(): boolean {
  return platformRefusesWrites;
}

export function resetWebWriteRefusalForTests(): void {
  platformRefusesWrites = false;
}

let platformRefusesReads = false;

export function webReadRefusedByPlatform(): boolean {
  return platformRefusesReads;
}

export function resetWebReadRefusalForTests(): void {
  platformRefusesReads = false;
}

export async function openedFromFile(file: File, ref: FileRef | null, opts?: OpenDialogOpts): Promise<OpenedFile> {
  if ((opts?.binaryExtensions ?? []).includes(extensionOf(file.name))) {
    return { name: file.name, content: '', bytes: new Uint8Array(await file.arrayBuffer()), ref };
  }
  return { name: file.name, content: await file.text(), ref };
}

function openViaInput(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await openedFromFile(file, null, opts) : null);
    };
    input.click();
  });
}

function downloadBlob(name: string, content: string | Uint8Array | Blob, mime?: string): void {
  const blob = new Blob([content as BlobPart], { type: mime ?? 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveNewBytesDialogWeb(
  defaultName: string, bytes: Uint8Array, opts: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  if (opts.refuseDownload?.()) return null;
  try { downloadBlob(defaultName, bytesBlob(bytes, opts.mime ?? 'application/octet-stream'), opts.mime); }
  catch (error) { throw new ByteWriteError('download', error); }
  return { ref: null, name: defaultName, viaDownload: true };
}

export async function saveNewBytesToRefWeb(ref: FileRef, _bytes: Uint8Array): Promise<boolean> {
  if (ref.kind !== 'handle') return false;
  throw new ByteWriteError('handle-not-exclusive');
}

export async function handleWritePermissionWeb(handle: FileSystemFileHandle): Promise<boolean> {
  if (platformRefusesWrites) return false;
  try {
    return await readwriteGranted(handle);
  } catch (err) {
    if (!isAbort(err) && !isPlatformRefusal(err)) throw err;
    if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

export async function replaceHandleWithBytesWeb(
  handle: FileSystemFileHandle, bytes: Uint8Array, stillSource: () => Promise<boolean>, refuseBeforePlace: RefuseBeforePlace,
): Promise<boolean> {
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes as BufferSource);
  } catch (error) {
    await writable.abort().catch(() => { });
    throw new ByteWriteError('write', error);
  }
  let same: boolean;
  try { same = await stillSource(); }
  catch (error) { await writable.abort().catch(() => {}); throw error; }
  if (!same || refuseBeforePlace()) {
    await writable.abort();
    return false;
  }
  try { await writable.close(); } catch (error) { throw new ByteWriteError('close', error); }
  return true;
}

export interface PickedWebFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

function pickViaInput(filters: FileFilter[], multiple: boolean): Promise<PickedWebFile[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      resolve(files.length > 0 ? files.map((file) => ({ file, handle: null })) : null);
    };
    input.click();
  });
}

export async function pickFilesWeb(filters: FileFilter[], multiple: boolean): Promise<PickedWebFile[] | null> {
  if (hasFSA() && !platformRefusesReads && !featurePolicyBlocksFSA()) {
    try {
      const handles = await window.showOpenFilePicker!({ multiple, types: toAcceptTypes(filters) });
      const picked: PickedWebFile[] = [];
      for (const handle of handles) picked.push({ file: await handle.getFile(), handle });
      return picked.length > 0 ? picked : null;
    } catch (err) {
      if (isAbort(err)) return null;
      if (isPlatformRefusal(err)) {
        platformRefusesReads = true;
        return pickViaInput(filters, multiple);
      }
      throw err;
    }
  }
  return pickViaInput(filters, multiple);
}

export async function fileFromHandleWeb(handle: FileSystemFileHandle, prompt: boolean): Promise<File | null> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  try {
    let state = await handle.queryPermission?.(opts);
    if (state === undefined) state = 'granted';
    if (state === 'prompt' && prompt) state = await handle.requestPermission?.(opts);
    if (state !== 'granted') return null;
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function openFileDialogWeb(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  if (hasFSA() && !platformRefusesReads && !featurePolicyBlocksFSA()) {
    try {
      const [handle] = await window.showOpenFilePicker!({ multiple: false, types: toAcceptTypes(filters) });
      const ref = { kind: 'handle', handle } as const;
      opts?.beforeRead?.(ref);
      return await openedFromFile(await handle.getFile(), ref, opts);
    } catch (err) {
      if (isAbort(err)) return null;
      if (isPlatformRefusal(err)) {
        platformRefusesReads = true;
        return openViaInput(filters, opts);
      }
      throw err;
    }
  }
  return openViaInput(filters, opts);
}

export async function saveDataDialogWeb(
  defaultName: string, data: FileData, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  if (hasFSA() && !platformRefusesWrites && !featurePolicyBlocksFSA()) {
    try {
      const handle = await window.showSaveFilePicker!({
        suggestedName: defaultName,
        types: toAcceptTypes(filters),
        ...(opts?.preferDownloads ? { startIn: 'downloads' as const } : {}),
      });
      if (await opts?.refuseTarget?.({ kind: 'handle', handle })) return null;
      if (!(await writeThroughHandle(handle, data, opts?.refuseBeforePlace))) return null;
      return { ref: { kind: 'handle', handle }, name: handle.name };
    } catch (err) {
      if (isAbort(err)) return null;
      if (!isPlatformRefusal(err)) throw err;
      if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    }
  }
  if (opts?.refuseDownload?.()) return null;
  downloadBlob(defaultName, data, opts?.mime);
  return { ref: null, name: defaultName, viaDownload: true };
}

async function writeThroughHandle(
  handle: FileSystemFileHandle, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null,
): Promise<boolean> {
  const writable = await handle.createWritable();
  await writable.write(data as FileSystemWriteChunkType);
  if (refuseBeforePlace?.()) {
    await writable.abort().catch(() => { });
    return false;
  }
  await writable.close();
  return true;
}

async function readwriteGranted(handle: FileSystemFileHandle): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  return (await handle.requestPermission?.(opts)) === 'granted';
}

export async function saveToRefWeb(
  ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null, writeGranted = false,
): Promise<boolean> {
  if (ref.kind !== 'handle') return false;
  if (platformRefusesWrites) return false;
  const { handle } = ref;
  try {
    if (!writeGranted && !(await readwriteGranted(handle))) return false;
    return await writeThroughHandle(handle, data, refuseBeforePlace);
  } catch (err) {
    if (!isAbort(err) && !isPlatformRefusal(err)) throw err;
    if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

export async function canWriteToRefWithoutPromptWeb(ref: FileRef): Promise<boolean> {
  if (ref.kind !== 'handle' || platformRefusesWrites) return false;
  try {
    return (await ref.handle.queryPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

export async function saveToRefWithoutPromptWeb(ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (!await canWriteToRefWithoutPromptWeb(ref) || ref.kind !== 'handle') return false;
  try {
    return await writeThroughHandle(ref.handle, data, refuseBeforePlace);
  } catch (err) {
    if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

async function readRefWeb<T>(ref: FileRef, extract: (file: File) => Promise<T>): Promise<T | null> {
  if (ref.kind !== 'handle') return null;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  if ((await handle.queryPermission?.(opts)) !== 'granted') {
    if ((await handle.requestPermission?.(opts)) !== 'granted') return null;
  }
  const file = await handle.getFile();
  return extract(file);
}

export function readFromRefWeb(ref: FileRef): Promise<string | null> {
  return readRefWeb(ref, (file) => file.text());
}

export function readBytesFromRefWeb(ref: FileRef): Promise<Uint8Array | null> {
  return readRefWeb(ref, async (file) => new Uint8Array(await file.arrayBuffer()));
}
