// #804: bronbytes staan los van ops-recovery v3, zodat een oudere release blijft herstellen.
import { recoveryBase } from '@/hooks/recoveryPaths';
import { openDbStores } from '@/utils/idb';

export const SOURCE_COPY_DB = `ops-ifc-sources.${recoveryBase}`;
const BYTES = 'sources';
const REFERENCES = 'references';

/** Alleen runtime-invoer; geen bytes of siteversie erbij in het herstelmanifest. */
export interface RecoverySourceCopy {
  readonly bytes: Uint8Array;
  readonly siteFileId: string | null;
  readonly siteFileVersion: string | null;
}
interface CopyReference {
  id: string;
  documentKey: string;
  sha256: string;
  siteFileId: string | null;
  siteFileVersion: string | null;
}
export const sourceCopyReferenceKey = (documentKey: string, sha256: string): string => `${documentKey}::${sha256}`;

// Een lees-/wisactie mag nooit een lege database aanmaken, ook niet met de flag uit.
// IDB kan een nog niet bestaande database alleen herkennen tijdens upgradeneeded: breek die af.
async function existingDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SOURCE_COPY_DB);
    let absent = false;
    let settled = false;
    request.onupgradeneeded = () => { absent = true; request.transaction!.abort(); };
    request.onblocked = () => { settled = true; reject(new Error('De opslag van IFC-bronkopieën is geblokkeerd.')); };
    request.onerror = () => { if (!settled) { settled = true; if (absent) resolve(null); else reject(request.error); } };
    request.onsuccess = () => {
      if (settled || absent) { request.result.close(); if (!settled) resolve(null); return; }
      settled = true;
      if (request.result.version !== 1) { request.result.close(); reject(new Error('Onbekende versie van de IFC-bronkopieën.')); return; }
      resolve(request.result);
    };
  });
}

/** Eén blob per sha256. Een kleine verwijzing beschermt ook een nog niet gecommit manifest:
 * andere tabbladen ruimen alleen hun eigen verwijzingen op. Bytes en verwijzing committen samen.
 */
export async function writeRecoverySourceCopy(documentKey: string, sha256: string, copy: RecoverySourceCopy): Promise<void> {
  const db = await openDbStores(SOURCE_COPY_DB, 1, [BYTES, REFERENCES]);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([BYTES, REFERENCES], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('De IFC-bronkopie is niet bewaard.'));
    const sourceStore = tx.objectStore(BYTES);
    // Alleen sleutels lezen; nooit de volledige bron teruglezen tijdens een bewerkingstick.
    const request = sourceStore.getAllKeys();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      try {
        if (!request.result.includes(sha256)) sourceStore.put({ id: sha256, bytes: copy.bytes });
        const reference: CopyReference = { id: sourceCopyReferenceKey(documentKey, sha256), documentKey, sha256,
          siteFileId: copy.siteFileId, siteFileVersion: copy.siteFileVersion };
        tx.objectStore(REFERENCES).put(reference);
      } catch (error) { reject(error); tx.abort(); }
    };
  });
}

/** De gewone herstelroute controleert hierna grootte én sha256, vóór zij een doel teruggeeft. */
export async function readRecoverySourceCopy(documentKey: string, sha256: string): Promise<RecoverySourceCopy | null> {
  const db = await existingDatabase();
  if (!db) return null;
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([BYTES, REFERENCES], 'readonly');
      const bytes = tx.objectStore(BYTES).get(sha256);
      const reference = tx.objectStore(REFERENCES).get(sourceCopyReferenceKey(documentKey, sha256));
      tx.onabort = tx.onerror = () => reject(tx.error);
      bytes.onerror = reference.onerror = () => reject(bytes.error ?? reference.error);
      let pending = 2;
      const done = () => {
        if (--pending) return;
        const value = bytes.result as { bytes?: unknown } | undefined;
        const target = reference.result as CopyReference | undefined;
        if (!(value?.bytes instanceof Uint8Array)) { resolve(null); return; }
        resolve({ bytes: value.bytes,
          siteFileId: typeof target?.siteFileId === 'string' ? target.siteFileId : null,
          siteFileVersion: typeof target?.siteFileVersion === 'string' ? target.siteFileVersion : null });
      };
      bytes.onsuccess = reference.onsuccess = done;
    });
  } finally { db.close(); }
}

/** Alleen aanroepen na een geslaagde manifestcommit/wisactie en een volledige manifestcontrole.
 * Onbekende herstelsets stoppen de aanroeper. Verwijzingen van andere sessies blijven staan,
 * ook tussen hun kopie en manifest. Pas zonder verwijzing én zonder manifest mag de blob weg.
 */
export async function cleanupRecoverySourceCopies(
  generations: ReadonlySet<string>, references: ReadonlySet<string>, hashes: ReadonlySet<string>,
): Promise<void> {
  const db = await existingDatabase();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([BYTES, REFERENCES], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error);
      const refs = tx.objectStore(REFERENCES).getAll();
      const keys = tx.objectStore(BYTES).getAllKeys();
      refs.onerror = keys.onerror = () => reject(refs.error ?? keys.error);
      let pending = 2;
      const done = () => {
        if (--pending) return;
        const keptHashes = new Set(hashes);
        let changed = false;
        const all = refs.result as CopyReference[];
        if (all.some(r => !r || typeof r.documentKey !== 'string' || !/^[0-9a-f]{64}$/.test(r.sha256)
          || r.id !== sourceCopyReferenceKey(r.documentKey, r.sha256))) { queueMicrotask(resolve); return; }
        for (const reference of all) {
          const generation = reference.documentKey.split('::')[0];
          if (generations.has(generation) && !references.has(reference.id)) {
            tx.objectStore(REFERENCES).delete(reference.id); changed = true;
          } else keptHashes.add(reference.sha256);
        }
        for (const key of keys.result) {
          if (typeof key === 'string' && /^[0-9a-f]{64}$/.test(key) && !keptHashes.has(key)) { tx.objectStore(BYTES).delete(key); changed = true; }
        }
        // De kleine headless dubbel voltooit alleen transacties met een write.
        if (!changed) queueMicrotask(resolve);
      };
      refs.onsuccess = keys.onsuccess = done;
    });
  } finally { db.close(); }
}
