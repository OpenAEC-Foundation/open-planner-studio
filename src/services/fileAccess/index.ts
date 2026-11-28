import { isTauri } from '@/utils/platform';
import {
  saveDataDialogTauri, saveToRefTauri, readFromRefTauri, readBytesFromRefTauri,
  fileIdentityFsTauri, scanTargetPathTauri, readTargetPathTauri, sourceTargetContentOfPathTauri, knownTargetContentOfPathTauri,
  saveNewBytesDialogTauri, saveNewBytesToRefTauri, pickSaveTargetTauri, pickSavePathTauri, saveDataToPathTauri,
} from './tauriBackend';
import { openFileDialogTauri, readOpenedPathTauri } from './tauriOpenPath';
import type { FileIdentityFs } from './fileIdentity';
import type { RemnantEvent } from './ownFileReplace';
import type { TargetReaders } from './foreignSourceTarget';
import { readSiteSourceFile } from './siteBackend';
import {
  openFileDialogWeb, saveDataDialogWeb, saveToRefWeb, saveToRefWithoutPromptWeb, canWriteToRefWithoutPromptWeb, readFromRefWeb, readBytesFromRefWeb,
  saveNewBytesDialogWeb, saveNewBytesToRefWeb, handleWritePermissionWeb, replaceHandleWithBytesWeb,
} from './webBackend';
import { siteStorageAvailable } from './siteHost';
import { sourceTargetContentOfHandle, type SourceTargetContent } from './sourceTargetContent';
import { knownTargetContentOfHandle } from './knownTargetContent';
import type { TargetFingerprint } from '@/state/documentContract';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export type FileRef =
  | { kind: 'path'; path: string }
  | { kind: 'handle'; handle: FileSystemFileHandle }
  | { kind: 'site'; id: string };

export interface SaveTargetFields {
  filePath: string | null;
  fileHandle: FileSystemFileHandle | null;
  siteFileId: string | null;
}

export function sameFileRef(a: FileRef, b: FileRef): boolean {
  if (a.kind === 'path' && b.kind === 'path') return a.path === b.path;
  if (a.kind === 'site' && b.kind === 'site') return a.id === b.id;
  return a.kind === 'handle' && b.kind === 'handle' && a.handle === b.handle;
}

export function saveTargetRef(doc: SaveTargetFields, tauri: boolean = isTauri()): FileRef | null {
  if (doc.siteFileId) return { kind: 'site', id: doc.siteFileId };
  if (doc.fileHandle) return { kind: 'handle', handle: doc.fileHandle };
  if (tauri && doc.filePath) return { kind: 'path', path: doc.filePath };
  return null;
}

export interface OpenedFile {
  name: string;
  content: string;
  bytes?: Uint8Array;
  ref: FileRef | null;
  replaceRemnants?: RemnantEvent[];
}

export interface OpenDialogOpts {
  binaryExtensions?: string[];
  beforeRead?: (ref: Extract<FileRef, { kind: 'handle' }>) => void;
}

export interface SaveDialogOpts {
  preferDownloads?: boolean;
  mime?: string;
  refuseTarget?: SaveTargetCheck | null;
  refuseDownload?: (() => boolean) | null;
  refuseBeforePlace?: RefuseBeforePlace | null;
}

export type SaveTargetCheck = (target: FileRef) => Promise<boolean>;

export type RefuseBeforePlace = () => boolean;

export type FileData = string | Uint8Array;

export type CheckedSaveDialogOpts = SaveDialogOpts & { refuseTarget: SaveTargetCheck | null };

export interface SaveOutcome {
  ref: FileRef | null;
  name: string;
  viaDownload?: boolean;
}

export function supportsHandles(): boolean {
  return isTauri() || (typeof window !== 'undefined' && 'showOpenFilePicker' in window);
}

export function supportsRecentFiles(): boolean {
  return supportsHandles() || siteStorageAvailable();
}

export function openFileDialog(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  return isTauri() ? openFileDialogTauri(filters, opts) : openFileDialogWeb(filters, opts);
}

export function fileIdentityFs(): Promise<FileIdentityFs | undefined> {
  return isTauri() ? fileIdentityFsTauri() : Promise.resolve(undefined);
}

export function writeTargetReaders(): TargetReaders {
  return {
    ...(isTauri() ? { scanPath: scanTargetPathTauri, readPath: readTargetPathTauri } : {}),
    ...(siteStorageAvailable() ? { readSite: async (id: string) => (await readSiteSourceFile(id)).bytes() } : {}),
  };
}

export type LocalTargetRef = Extract<FileRef, { kind: 'path' | 'handle' }>;

export function localTargetName(ref: LocalTargetRef): string {
  return ref.kind === 'path' ? ref.path : ref.handle.name;
}

export function sourceTargetContent(ref: LocalTargetRef, expected: Uint8Array): Promise<SourceTargetContent> {
  if (ref.kind === 'handle') return sourceTargetContentOfHandle(ref.handle, expected);
  if (!isTauri()) return Promise.reject(new Error('Een pad is in de browser geen doel om te vergelijken.'));
  return sourceTargetContentOfPathTauri(ref.path, expected);
}

export function knownTargetContent(ref: LocalTargetRef, known: TargetFingerprint): Promise<SourceTargetContent> {
  if (ref.kind === 'handle') return knownTargetContentOfHandle(ref.handle, known);
  if (!isTauri()) return Promise.reject(new Error('Een pad is in de browser geen doel om te vergelijken.'));
  return knownTargetContentOfPathTauri(ref.path, known);
}

export function handleWritePermission(ref: Extract<FileRef, { kind: 'handle' }>): Promise<boolean> {
  return handleWritePermissionWeb(ref.handle);
}
export function replaceHandleWithBytes(
  ref: Extract<FileRef, { kind: 'handle' }>, bytes: Uint8Array, stillSource: () => Promise<boolean>,
  refuseBeforePlace: RefuseBeforePlace,
): Promise<boolean> {
  return replaceHandleWithBytesWeb(ref.handle, bytes, stillSource, refuseBeforePlace);
}

export function saveDataDialog(
  defaultName: string, data: FileData, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return isTauri() ? saveDataDialogTauri(defaultName, data, filters, opts) : saveDataDialogWeb(defaultName, data, filters, opts);
}

export function saveFileDialog(
  defaultName: string, content: string, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return saveDataDialog(defaultName, content, filters, opts);
}

export function saveBytesDialog(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return saveDataDialog(defaultName, bytes, filters, opts);
}

export function saveNewBytesDialog(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts: CheckedSaveDialogOpts,
): Promise<SaveOutcome | null> {
  return isTauri()
    ? saveNewBytesDialogTauri(defaultName, bytes, filters, opts)
    : saveNewBytesDialogWeb(defaultName, bytes, opts);
}

export interface PickedSaveTarget {
  path: string;
  current: Uint8Array | 'unreadable' | null;
}

export function pickSaveTarget(defaultName: string, filters: FileFilter[]): Promise<PickedSaveTarget | null> {
  if (!isTauri()) return Promise.reject(new Error('De bestandskiezer zonder schrijven bestaat alleen op de desktop.'));
  return pickSaveTargetTauri(defaultName, filters);
}

export function pickSavePath(defaultName: string, filters: FileFilter[]): Promise<string | null> {
  if (!isTauri()) return Promise.reject(new Error('De bestandskiezer zonder schrijven bestaat alleen op de desktop.'));
  return pickSavePathTauri(defaultName, filters);
}

export function saveDataToPath(path: string, data: FileData, opts: CheckedSaveDialogOpts): Promise<SaveOutcome | null> {
  if (!isTauri()) return Promise.reject(new Error('Schrijven naar een gekozen pad bestaat alleen op de desktop.'));
  return saveDataToPathTauri(path, data, opts);
}

export function saveNewBytesToRef(ref: FileRef, bytes: Uint8Array, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveNewBytesToRefTauri(ref, bytes, refuseBeforePlace) : saveNewBytesToRefWeb(ref, bytes);
}

export function saveToRef(
  ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null, writeGranted = false,
): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveToRefTauri(ref, data, refuseBeforePlace) : saveToRefWeb(ref, data, refuseBeforePlace, writeGranted);
}

export function canWriteToRefWithoutPrompt(ref: FileRef): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? Promise.resolve(ref.kind === 'path') : canWriteToRefWithoutPromptWeb(ref);
}

export function saveToRefWithoutPrompt(ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (ref.kind === 'site') return Promise.resolve(false);
  return isTauri() ? saveToRefTauri(ref, data, refuseBeforePlace) : saveToRefWithoutPromptWeb(ref, data, refuseBeforePlace);
}

export function readFromRef(ref: FileRef): Promise<string | null> {
  if (ref.kind === 'site') return Promise.resolve(null);
  return isTauri() ? readFromRefTauri(ref) : readFromRefWeb(ref);
}

export function readOpenedPath(path: string, asBytes: boolean): Promise<OpenedFile> {
  return readOpenedPathTauri(path, asBytes);
}

export function readBytesFromRef(ref: FileRef): Promise<Uint8Array | null> {
  if (ref.kind === 'site') return Promise.resolve(null);
  return isTauri() ? readBytesFromRefTauri(ref) : readBytesFromRefWeb(ref);
}
