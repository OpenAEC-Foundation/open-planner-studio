// Onthouden bestandshandvatten van bronbestanden in de browser (stap 1.8 van "relaties tussen projecten").
// Een koppeling die in de browser gekozen is, heeft geen pad; ze herkent haar bron op het project-id van de
// bron. Daarom onthoudt OPS het handvat in IndexedDB onder dat project-id, zoals de recente bestanden hun
// handvat onthouden (`recentFiles.ts`). Later lezen kost dan hoogstens één klik voor toestemming. Alleen
// Chromium geeft een handvat; andere browsers onthouden niets.
import { idbGetAll, idbPut } from '@/utils/idb';

const DB = 'ops-external-sources';
const STORE = 'handles';

interface StoredSourceHandle {
  /** Het project-id van de bron. */
  id: string;
  handle: FileSystemFileHandle;
}

/** Onthoudt het handvat van de bron met dit project-id; een ouder handvat voor dat project vervalt. */
export async function rememberExternalSourceHandle(projectId: string, handle: FileSystemFileHandle): Promise<void> {
  const id = projectId.trim();
  if (!id) return;
  const entry: StoredSourceHandle = { id, handle };
  await idbPut(DB, STORE, entry);
}

/** Het onthouden handvat per project-id. Een IDB-fout geeft een lege lijst (zie `idb.ts`). */
export async function loadExternalSourceHandles(): Promise<Map<string, FileSystemFileHandle>> {
  const all = await idbGetAll<StoredSourceHandle>(DB, STORE);
  return new Map(all.filter(entry => entry && typeof entry.id === 'string' && entry.handle).map(entry => [entry.id, entry.handle]));
}
