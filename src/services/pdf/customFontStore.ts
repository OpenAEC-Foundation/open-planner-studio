import { openDb } from '@/utils/idb';

const DB_NAME = 'ops-report-font';
const STORE = 'fonts';
const RECORD_ID = 'custom';

export interface CustomFontRecord {
  id: typeof RECORD_ID;
  name: string;
  rev: number;
  regular: Uint8Array;
  bold: Uint8Array | null;
}

let cached: Promise<CustomFontRecord | null> | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === 'ops-reportSettings') cached = null;
  });
}

async function readRecord(): Promise<CustomFontRecord | null> {
  const db = await openDb(DB_NAME, STORE);
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD_ID);
    req.onsuccess = () => resolve((req.result as CustomFontRecord | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function getCustomFont({ fresh = false }: { fresh?: boolean } = {}): Promise<CustomFontRecord | null> {
  if (fresh) cached = null;
  cached ??= readRecord().catch(err => {
    console.warn('[customFontStore] Eigen lettertype niet te lezen:', err);
    cached = null;
    return null;
  });
  return cached;
}

export async function saveCustomFont(font: Pick<CustomFontRecord, 'name' | 'regular' | 'bold'>): Promise<CustomFontRecord> {
  const record: CustomFontRecord = { id: RECORD_ID, rev: Date.now(), ...font };
  const db = await openDb(DB_NAME, STORE);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Opslaan van het lettertype afgebroken'));
  });
  cached = Promise.resolve(record);
  return record;
}
