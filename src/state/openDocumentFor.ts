import type { FileRef } from '@/services/fileAccess';
import { sameEntry } from '@/services/fileAccess/foreignSourceTarget';
import { isMultiDocumentImport, type OpenedImport } from '@/services/importTypes';
import type { AppState } from './appStoreFactory';
import type { DocumentPayload, TargetFingerprint } from './documentContract';
import { notifyChangedOnDisk, type ChangedOnDiskStore } from './changedOnDiskNotice';

type Tabs = Pick<AppState, 'getOpenDocumentPayloads'>;
type TabFile = Pick<DocumentPayload, 'filePath' | 'fileHandle' | 'siteFileId' | 'siteFileVersion' | 'knownTargetFingerprint'>;
export type HandleRef = Extract<FileRef, { kind: 'handle' }>;

export interface OpenLookup {
  readonly hits: readonly { readonly id: string; readonly handle: FileSystemFileHandle }[];
}

export function startOpenLookup(s: Tabs, ref: HandleRef): OpenLookup {
  const hits: { id: string; handle: FileSystemFileHandle }[] = [];
  for (const { id, payload } of s.getOpenDocumentPayloads()) {
    const handle = payload.fileHandle;
    if (!handle || payload.siteFileId) continue;
    void sameEntry(ref.handle, handle).then((same) => { if (same) hits.push({ id, handle }); });
  }
  return { hits };
}

export type ReadVersion =
  | { readonly kind: 'site'; readonly version: string }
  | { readonly kind: 'bytes'; readonly fingerprint: TargetFingerprint };

export function readVersionOf(ref: FileRef, parsed: OpenedImport, siteVersion?: string | null): ReadVersion | null {
  if (ref.kind === 'site') return siteVersion ? { kind: 'site', version: siteVersion } : null;
  const source = isMultiDocumentImport(parsed) ? undefined : parsed.ifcSource;
  return source ? { kind: 'bytes', fingerprint: { sha256: source.sha256, byteLength: source.bytes.byteLength } } : null;
}

function holds(ref: FileRef, id: string, payload: TabFile, lookup: OpenLookup | null): boolean {
  if (ref.kind === 'site') return payload.siteFileId === ref.id;
  if (payload.siteFileId) return false;
  if (ref.kind === 'handle') {
    return payload.fileHandle === ref.handle
      || (!!payload.fileHandle && !!lookup?.hits.some(hit => hit.id === id && hit.handle === payload.fileHandle));
  }
  return !payload.fileHandle && payload.filePath === ref.path;
}

function sameVersion(tab: TabFile, read: ReadVersion | null): boolean | null {
  if (read === null) return null;
  if (read.kind === 'site') return tab.siteFileVersion ? tab.siteFileVersion === read.version : null;
  const known = tab.knownTargetFingerprint;
  if (!known) return null;
  return known.sha256 === read.fingerprint.sha256 && known.byteLength === read.fingerprint.byteLength;
}

export interface OpenTab {
  readonly id: string;
  readonly changedOnDisk: boolean;
}

export function openTabFor(s: Tabs, ref: FileRef, lookup: OpenLookup | null, read: ReadVersion | null): OpenTab | null {
  let changed: string | null = null;
  for (const { id, payload } of s.getOpenDocumentPayloads()) {
    if (!holds(ref, id, payload, lookup)) continue;
    const same = sameVersion(payload, read);
    if (same) return { id, changedOnDisk: false };
    if (same === false) changed ??= id;
  }
  return changed === null ? null : { id: changed, changedOnDisk: true };
}

export function launchTabFor(s: Tabs, id: string, read: ReadVersion | null): OpenTab {
  const payload = s.getOpenDocumentPayloads().find(document => document.id === id)?.payload;
  return { id, changedOnDisk: !!payload && sameVersion(payload, read) === false };
}

export function switchToOpenDocument(store: ChangedOnDiskStore, tab: OpenTab, name: string): void {
  store.getState().switchDocument(tab.id);
  if (tab.changedOnDisk) notifyChangedOnDisk(store, tab.id, name);
}
