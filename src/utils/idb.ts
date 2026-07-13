/**
 * Piepklein rauw-IndexedDB-helpertje (spec §9). Generaliseert het open/get/put/getAll/delete-
 * patroon uit `src/extensions/extensionLoader.ts`. Elke database heeft één object-store met
 * `keyPath: 'id'`. ALLE toegang zit in try/catch: een IDB-fout (private-mode, quota, geblokkeerd)
 * mag de app-start nooit blokkeren — recents/recovery vallen dan stil terug op "leeg".
 */

const dbPromises = new Map<string, Promise<IDBDatabase>>();

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  const cacheKey = `${dbName}::${storeName}`;
  const existing = dbPromises.get(cacheKey);
  if (existing) return existing;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
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

/** Eén record op id. Bij een IDB-fout of ontbreken: undefined (stil). */
export async function idbGet<T>(dbName: string, storeName: string, id: string): Promise<T | undefined> {
  try {
    const db = await openDb(dbName, storeName);
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

/** Schrijf/vervang een record (moet een `id`-veld hebben). Faalt stil. */
export async function idbPut(dbName: string, storeName: string, value: { id: string } & Record<string, unknown>): Promise<void> {
  try {
    const db = await openDb(dbName, storeName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* stil falen (spec §10) */
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
