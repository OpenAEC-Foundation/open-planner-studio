import type { FileRef } from '@/services/fileAccess';
import { sameEntry } from '@/services/fileAccess/foreignSourceTarget';
import type { AppState } from './appStoreFactory';
import type { DocumentPayload } from './documentContract';
import type { NotifyInput } from './slices/types';

type Tabs = Pick<AppState, 'getOpenDocumentPayloads'>;
type TabFile = Pick<DocumentPayload, 'filePath' | 'fileHandle' | 'siteFileId'>;
export type HandleRef = Extract<FileRef, { kind: 'handle' }>;

const sameTabFile = (a: TabFile, b: TabFile) =>
  a.filePath === b.filePath && a.fileHandle === b.fileHandle && a.siteFileId === b.siteFileId;

export interface OpenLookup {
  readonly seen: ReadonlyMap<string, TabFile>;
  readonly settled: boolean;
  readonly id: string | null;
}

export function startOpenLookup(s: Tabs, ref: HandleRef): OpenLookup {
  const tabs = s.getOpenDocumentPayloads().map(({ id, payload }) => ({
    id, payload: { filePath: payload.filePath, fileHandle: payload.fileHandle, siteFileId: payload.siteFileId },
  }));
  const lookup = { seen: new Map(tabs.map(({ id, payload }) => [id, payload])), settled: false, id: null as string | null };
  const candidates = tabs.filter(({ payload }) => payload.fileHandle && !payload.siteFileId);
  let pending = candidates.length;
  if (pending === 0) lookup.settled = true;
  for (const { id, payload } of candidates) {
    void sameEntry(ref.handle, payload.fileHandle!).then((same) => {
      pending--;
      if (lookup.settled) return;
      if (same) lookup.id = id;
      if (same || pending === 0) lookup.settled = true;
    });
  }
  return lookup;
}

function holds(ref: FileRef, payload: TabFile): boolean {
  if (ref.kind === 'site') return payload.siteFileId === ref.id;
  if (payload.siteFileId) return false;
  if (ref.kind === 'handle') return payload.fileHandle === ref.handle;
  return !payload.fileHandle && payload.filePath === ref.path;
}

export function existingDocument(s: Tabs, ref: FileRef, lookup: OpenLookup | null): string | null {
  const documents = s.getOpenDocumentPayloads();
  const settled = lookup?.settled ? lookup : null;
  const seenAsNow = (id: string, payload: TabFile) => {
    const before = settled?.seen.get(id);
    return !!before && sameTabFile(before, payload);
  };
  const found = settled?.id == null ? undefined : documents.find(({ id }) => id === settled.id);
  if (found && seenAsNow(found.id, found.payload)) return found.id;
  return documents.find(({ id, payload }) => !seenAsNow(id, payload) && holds(ref, payload))?.id ?? null;
}

const FILE_ALREADY_OPEN_NOTICE: NotifyInput = {
  severity: 'info',
  messageKey: 'notifications.fileAlreadyOpen',
  dedupeKey: 'file-already-open',
};

export function switchToOpenDocument(s: Pick<AppState, 'switchDocument' | 'notify'>, id: string): void {
  s.switchDocument(id);
  s.notify(FILE_ALREADY_OPEN_NOTICE);
}
