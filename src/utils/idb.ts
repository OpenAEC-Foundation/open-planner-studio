/**
 * Piepklein rauw-IndexedDB-helpertje. Elke database heeft één object-store met
 * `keyPath: 'id'`. ALLE toegang via de `idb*`-functies zit in try/catch: een IDB-fout (private-mode,
 * quota) geeft daar een stille terugval. Wie fouten wél moet zien (extensieopslag, crashherstel),
 * gebruikt alleen de verbinding: `openDb` / `openDbStores`. Die laatste weigert een geblokkeerde
 * upgrade expliciet; recovery geeft die fout door aan zijn centrale meldingsroute.
 */

const dbPromises = new Map<string, Promise<IDBDatabase>>();

/** De (gecachete) verbinding met `dbName`, met één object-store `storeName` (standaard keyPath
 *  `id`; de bibliotheek gebruikt `key`). Een versie-upgrade uit een andere tab of instantie sluit
 *  de verbinding; de volgende aanroep opent opnieuw. Gooit bij een openingsfout. */
export function openDb(dbName: string, storeName: string, keyPath = 'id'): Promise<IDBDatabase> {
  const cacheKey = `${dbName}::${storeName}`;
  const existing = dbPromises.get(cacheKey);
  if (existing) return existing;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Sluit de verbinding als een andere tab een versie-upgrade wil (voorkomt blocking).
      db.onversionchange = () => {
        db.close();
        dbPromises.delete(cacheKey);
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromises.delete(cacheKey);
      reject(req.error);
    };
  });
  dbPromises.set(cacheKey, p);
  return p;
}

/** Alleen schema-metadata; het aanmaken van een index herschrijft geen recordinhoud. */
export interface DbStoreIndex {
  storeName: string;
  name: string;
  keyPath: string;
}

/** Een andere verbinding houdt de aangevraagde schema-upgrade tegen; geen schema-/datafout. */
export class IndexedDbUpgradeBlockedError extends Error {
  constructor(readonly databaseName: string, readonly version: number) {
    super('IndexedDB-upgrade geblokkeerd door een open verbinding.');
    this.name = 'IndexedDbUpgradeBlockedError';
  }
}

/**
 * Verbinding met een database met MEERDERE object-stores (allemaal keyPath `id`) op een expliciete
 * versie. Alleen voor een database die uitsluitend via deze functie wordt geopend: `openDb` opent
 * altijd versie 1 en zou na een upgrade met `VersionError` falen. Gebruikt door crashherstel
 * (`ops-recovery` v3: snapshots + XER-archiefblobs en een index op recordsoort). Gooit bij een openingsfout,
 * ook direct bij een geblokkeerde upgrade; een late upgrade wordt dan afgebroken.
 */
export function openDbStores(
  dbName: string, version: number, storeNames: readonly string[], indexes: readonly DbStoreIndex[] = [],
): Promise<IDBDatabase> {
  const cacheKey = `${dbName}::v${version}::${storeNames.join('+')}::${JSON.stringify(indexes)}`;
  const existing = dbPromises.get(cacheKey);
  if (existing) return existing;
  const p: Promise<IDBDatabase> = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    let settled = false;
    // Een late gebeurtenis van deze aanvraag mag geen nieuwere cache-entry verwijderen.
    const forget = () => { if (dbPromises.get(cacheKey) === p) dbPromises.delete(cacheKey); };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      forget();
      reject(error);
    };
    req.onblocked = () => fail(new IndexedDbUpgradeBlockedError(dbName, version));
    req.onupgradeneeded = () => {
      // Een openaanvraag is niet annuleerbaar. Na een eerdere weigering géén late upgrade uitvoeren.
      if (settled) { req.transaction?.abort(); return; }
      const db = req.result;
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' });
      }
      for (const index of indexes) {
        const store = req.transaction!.objectStore(index.storeName);
        if (!store.indexNames.contains(index.name)) store.createIndex(index.name, index.keyPath);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Ook als een browser toch succes levert na blocked/reject: nooit uitleveren of open laten.
      if (settled) { db.close(); return; }
      try {
        for (const index of indexes) {
          const actual = db.transaction(index.storeName, 'readonly').objectStore(index.storeName).index(index.name);
          if (actual.keyPath !== index.keyPath || actual.unique) throw new Error('IndexedDB-index heeft een onverwachte definitie.');
        }
      } catch (error) {
        db.close();
        fail(error);
        return;
      }
      db.onversionchange = () => { db.close(); forget(); };
      db.onclose = forget;
      settled = true;
      resolve(db);
    };
    req.onerror = () => fail(req.error);
  });
  dbPromises.set(cacheKey, p);
  return p;
}

/** Alle records uit de store. Bij een IDB-fout: lege lijst (stil). */
export async function idbGetAll<T>(dbName: string, storeName: string): Promise<T[]> {
  try {
    const db = await openDb(dbName, storeName);
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Schrijf/vervang een record (moet een `id`-veld hebben). Faalt stil.
 *  Param bewust alleen `{ id: string }` (niet `& Record<string, unknown>`): interfaces krijgen
 *  geen impliciete index-signature en zouden anders niet toewijsbaar zijn — structural typing
 *  laat de overige velden gewoon toe. */
export async function idbPut(dbName: string, storeName: string, value: { id: string }): Promise<void> {
  try {
    const db = await openDb(dbName, storeName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* stil falen */
  }
}

/** Verwijder een record op id. Faalt stil. */
export async function idbDelete(dbName: string, storeName: string, id: string): Promise<void> {
  try {
    const db = await openDb(dbName, storeName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* stil falen */
  }
}
