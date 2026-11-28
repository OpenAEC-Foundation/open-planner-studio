import type { FileData, FileFilter, FileRef, OpenDialogOpts, OpenedFile, PickedSaveTarget, RefuseBeforePlace, SaveDialogOpts, SaveOutcome } from './index';
import { basename, extensionOf, withOneOfExtensions } from '@/utils/filePath';
import {
  isForbiddenPathError, writeUserFileTauri, writeNewUserBytesTauri,
} from '@/services/fileAccess/atomicWrite';
import { missingTarget, type FileIdentityFs } from './fileIdentity';
import { scanForeignTargetSource, type OwnBomVersion, type TargetForeignScan } from '@/services/ifc/foreign/targetForeignScan';
import { IFC_FOREIGN_SCAN_MAX_BYTES } from '@/services/ifc/foreign/foreignScan';
import { compareTargetChunks, TARGET_CHUNK_BYTES, type SourceTargetContent } from './sourceTargetContent';
import { compareKnownTarget } from './knownTargetContent';
import type { TargetFingerprint } from '@/state/documentContract';
import type { RemnantEvent } from './ownFileReplace';
import { whenProjectFileWritesIdle } from './writeCoordinator';

export async function fileIdentityFsTauri(): Promise<FileIdentityFs> {
  const { stat } = await import('@tauri-apps/plugin-fs');
  return { stat: (path) => stat(path) };
}

interface PathChunksTauri {
  next(): Promise<Uint8Array | null>;
  seek(offset: number): Promise<void>;
  close(): Promise<void>;
}

export async function seekToExactPosition(seek: (offset: number) => Promise<number>, offset: number): Promise<void> {
  const actual = await seek(offset);
  if (actual !== offset) throw new Error(`Terugspoelen mislukt: verwacht ${offset}, kreeg ${actual}`);
}

async function openPathChunksTauri(path: string): Promise<PathChunksTauri | null | 'unreadable'> {
  const { open, stat, SeekMode } = await import('@tauri-apps/plugin-fs');
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, { read: true });
  } catch {
    try { await stat(path); } catch (error) { if (missingTarget(error)) return null; }
    return 'unreadable';
  }
  return {
    next: async () => {
      const buffer = new Uint8Array(TARGET_CHUNK_BYTES);
      const n = await handle.read(buffer);
      return n === null || n === 0 ? null : buffer.subarray(0, n);
    },
    seek: (offset) => seekToExactPosition(n => handle.seek(n, SeekMode.Start), offset),
    close: async () => { try { await handle.close(); } catch { } },
  };
}

export async function scanTargetPathTauri(path: string, ownBomVersion: OwnBomVersion | null = null): Promise<TargetForeignScan | null> {
  const chunks = await openPathChunksTauri(path);
  if (chunks === null || chunks === 'unreadable') return chunks;
  return scanForeignTargetSource(chunks, { ownBomVersion });
}

export async function readTargetPathTauri(path: string): Promise<Uint8Array | null> {
  const chunks = await openPathChunksTauri(path);
  if (chunks === null) return null;
  if (chunks === 'unreadable') throw new Error(`Het bestaande doel ${path} is niet leesbaar.`);
  try {
    const parts: Uint8Array[] = [];
    let size = 0;
    for (let chunk = await chunks.next(); chunk !== null; chunk = await chunks.next()) {
      size += chunk.length;
      if (size > IFC_FOREIGN_SCAN_MAX_BYTES) throw new Error(`Het bestaande doel ${path} is te groot om te lezen.`);
      parts.push(chunk);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const part of parts) { bytes.set(part, at); at += part.length; }
    return bytes;
  } finally {
    await chunks.close();
  }
}

export async function sourceTargetContentOfPathTauri(path: string, expected: Uint8Array): Promise<SourceTargetContent> {
  const { stat } = await import('@tauri-apps/plugin-fs');
  try {
    if ((await stat(path)).size !== expected.length) return 'changed';
  } catch (error) {
    return missingTarget(error) ? 'missing' : 'unreadable';
  }
  const chunks = await openPathChunksTauri(path);
  if (chunks === null) return 'missing';
  if (chunks === 'unreadable') return 'unreadable';
  try {
    return await compareTargetChunks(chunks.next, expected);
  } catch {
    return 'unreadable';
  } finally {
    await chunks.close();
  }
}

export async function knownTargetContentOfPathTauri(path: string, known: TargetFingerprint): Promise<SourceTargetContent> {
  const { stat, readFile } = await import('@tauri-apps/plugin-fs');
  return compareKnownTarget({ size: async () => (await stat(path)).size, bytes: () => readFile(path), missing: missingTarget }, known);
}

export interface TauriOpenIO {
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  settle(path: string): Promise<RemnantEvent[]>;
}

export function readsPathAsBytes(path: string, opts: OpenDialogOpts | undefined): boolean {
  return (opts?.binaryExtensions ?? []).includes(extensionOf(path));
}

export class ReadAfterSettleError extends Error {
  constructor(readonly cause: unknown, readonly replaceRemnants: RemnantEvent[]) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ReadAfterSettleError';
  }
}

export async function readOpenedTauriPath(path: string, asBytes: boolean, io: TauriOpenIO): Promise<OpenedFile> {
  await whenProjectFileWritesIdle();
  const remnants = await io.settle(path);
  const replaceRemnants = remnants.length > 0 ? { replaceRemnants: remnants } : {};
  try {
    if (asBytes) {
      const bytes = await io.readFile(path);
      return { name: basename(path), content: '', bytes, ref: { kind: 'path', path }, ...replaceRemnants };
    }
    const content = await io.readTextFile(path);
    return { name: basename(path), content, ref: { kind: 'path', path }, ...replaceRemnants };
  } catch (error) {
    throw remnants.length > 0 ? new ReadAfterSettleError(error, remnants) : error;
  }
}

export async function pickOpenPathTauri(filters: FileFilter[]): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ multiple: false, filters });
  return selected ? selected as string : null;
}

export async function pickSavePathTauri(
  defaultName: string, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  let defaultPath = defaultName;
  if (opts?.preferDownloads) {
    try {
      const { downloadDir, join } = await import('@tauri-apps/api/path');
      defaultPath = await join(await downloadDir(), defaultName);
    } catch {
    }
  }
  const extensions = filters.flatMap(filter => filter.extensions);
  let picked = await save({ defaultPath, filters });
  while (picked) {
    const target = withOneOfExtensions(picked, extensions);
    if (target === picked || !(await needsOwnDialogRound(target))) return target;
    picked = await save({ defaultPath: target, filters });
  }
  return null;
}

async function needsOwnDialogRound(path: string): Promise<boolean> {
  const { exists } = await import('@tauri-apps/plugin-fs');
  try {
    return await exists(path);
  } catch (error) {
    if (isForbiddenPathError(error)) return true;
    throw error;
  }
}

export async function saveDataDialogTauri(
  defaultName: string, data: FileData, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  const savedPath = await pickSavePathTauri(defaultName, filters, opts);
  return savedPath ? saveDataToPathTauri(savedPath, data, opts) : null;
}

export async function saveDataToPathTauri(savedPath: string, data: FileData, opts?: SaveDialogOpts): Promise<SaveOutcome | null> {
  if (await opts?.refuseTarget?.({ kind: 'path', path: savedPath })) return null;
  if (!(await writeUserFileTauri(savedPath, data, opts?.refuseBeforePlace))) return null;
  return { ref: { kind: 'path', path: savedPath }, name: basename(savedPath) };
}

export async function saveToRefTauri(ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (ref.kind !== 'path') return false;
  return writeUserFileTauri(ref.path, data, refuseBeforePlace);
}

export async function saveNewBytesDialogTauri(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  const savedPath = await pickSavePathTauri(defaultName, filters, opts);
  if (!savedPath) return null;
  if (await opts.refuseTarget?.({ kind: 'path', path: savedPath })) return null;
  if (!(await writeNewUserBytesTauri(savedPath, bytes, opts.refuseBeforePlace))) return null;
  return { ref: { kind: 'path', path: savedPath }, name: basename(savedPath) };
}

export async function pickSaveTargetTauri(defaultName: string, filters: FileFilter[]): Promise<PickedSaveTarget | null> {
  const path = await pickSavePathTauri(defaultName, filters);
  return path ? { path, current: await existingRegularFileTauri(path) } : null;
}

async function existingRegularFileTauri(path: string): Promise<Uint8Array | 'unreadable' | null> {
  const seen = await observeRegularFileTauri(path);
  return seen === 'missing' ? null : seen;
}

export async function observeRegularFileTauri(path: string): Promise<Uint8Array | 'unreadable' | 'missing' | null> {
  const { lstat, readFile } = await import('@tauri-apps/plugin-fs');
  try { if (!(await lstat(path)).isFile) return null; } catch (error) { return missingTarget(error) ? 'missing' : null; }
  try { return await readFile(path); } catch { return 'unreadable'; }
}

export async function saveNewBytesToRefTauri(ref: FileRef, bytes: Uint8Array, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (ref.kind !== 'path') return false;
  return writeNewUserBytesTauri(ref.path, bytes, refuseBeforePlace);
}

export async function readFromRefTauri(ref: FileRef): Promise<string | null> {
  if (ref.kind !== 'path') return null;
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(ref.path);
}

export async function readBytesFromRefTauri(ref: FileRef): Promise<Uint8Array | null> {
  if (ref.kind !== 'path') return null;
  const { readFile } = await import('@tauri-apps/plugin-fs');
  return readFile(ref.path);
}
