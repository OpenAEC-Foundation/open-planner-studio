import { idbGetAll, idbPut } from '@/utils/idb';

const DB = 'ops-external-sources';
const STORE = 'handles';

interface StoredSourceHandle {
  id: string;
  handle: FileSystemFileHandle;
}

export async function rememberExternalSourceHandle(projectId: string, handle: FileSystemFileHandle): Promise<void> {
  const id = projectId.trim();
  if (!id) return;
  const entry: StoredSourceHandle = { id, handle };
  await idbPut(DB, STORE, entry);
}

export async function loadExternalSourceHandles(): Promise<Map<string, FileSystemFileHandle>> {
  const all = await idbGetAll<StoredSourceHandle>(DB, STORE);
  return new Map(all.filter(entry => entry && typeof entry.id === 'string' && entry.handle).map(entry => [entry.id, entry.handle]));
}
