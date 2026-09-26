/**
 * Persistentie van de resourcebibliotheek. Pools zijn BEDRIJFSDATA, geen instellingen ⇒
 * NIET in localStorage. Browser: IndexedDB (patroon van het extensiesysteem, eigen database
 * `ops-library`). Desktop (Tauri): JSON-bestand in `appDataDir` (patroon van recoveryStore), buiten
 * de browserprofiel-levensduur. Export (libraryIfc) is het backupmechanisme.
 */
import { isTauri } from '@/utils/platform';
import type { CompanyLibrary } from '@/types/library';
import { createDefaultLibrary } from '@/types/library';
import { writeTextFileAtomic } from '@/services/fileAccess/atomicWrite';
import { openDb } from '@/utils/idb';

const LIBRARY_FILE = 'ops-library.json';

// ── IndexedDB (browser) ───────────────────────────────────────────────────────────────────────
const openLibraryDb = (): Promise<IDBDatabase> => openDb('ops-library', 'library', 'key');

async function loadWeb(): Promise<CompanyLibrary | null> {
  if (typeof indexedDB === 'undefined') return null; // headless Node (testbatterij) = no-op.
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', 'readonly');
    const req = tx.objectStore('library').get('library');
    req.onsuccess = () => resolve((req.result as { key: string; value: CompanyLibrary } | undefined)?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveWeb(lib: CompanyLibrary): Promise<void> {
  if (typeof indexedDB === 'undefined') return; // headless Node (testbatterij) = no-op; geen unhandled rejection.
  const db = await openLibraryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', 'readwrite');
    tx.objectStore('library').put({ key: 'library', value: lib });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── appDataDir-bestand (Tauri) ────────────────────────────────────────────────────────────────
async function loadTauri(): Promise<CompanyLibrary | null> {
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const path = await join(await appDataDir(), LIBRARY_FILE);
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readTextFile(path)) as CompanyLibrary;
  } catch {
    return null; // corrupt bestand: val terug op een verse bibliotheek i.p.v. crashen
  }
}

async function saveTauri(lib: CompanyLibrary): Promise<void> {
  const { mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  await mkdir(dir, { recursive: true }); // op een verse installatie bestaat de map nog niet
  // Schrijf-en-vervang: een afgekapt bestand na een crash leest `loadTauri` als corrupt, valt terug
  // op een VERSE bibliotheek, en de eerstvolgende save overschrijft dan de hele bibliotheek.
  await writeTextFileAtomic(dir, LIBRARY_FILE, JSON.stringify(lib));
}

// ── Publieke API ──────────────────────────────────────────────────────────────────────────────

/** Laad de opgeslagen bibliotheek; nog niets opgeslagen ⇒ een verse default-bibliotheek. */
export async function loadLibrary(): Promise<CompanyLibrary> {
  // Web-tak in try/catch (pariteit met loadTauri's graceful degradation): een IndexedDB-open-fout
  // (bijv. private mode) mag niet crashen ⇒ val terug op een verse bibliotheek.
  const loaded = isTauri() ? await loadTauri() : await loadWeb().catch(() => null);
  return loaded ?? createDefaultLibrary();
}

// Serialiseer schrijfacties: meerdere snelle mutaties (bijv. promote gevolgd door
// een pool-bewerking) roepen `saveLibrary` elk fire-and-forget aan; zonder serialisatie kan een
// tragere eerdere save na een snellere latere save landen en zo de nieuwste stand overschrijven met
// een oudere. `lastSave` is de interne kettingpromise — die MOET altijd resolven (nooit rejecten),
// anders slaat een mislukte save alle latere saves in de keten over. De promise die aan de caller
// wordt teruggegeven weerspiegelt wél het echte resultaat van déze save, zodat `persist()` in
// librarySlice zijn `.catch()` op een echte fout blijft vangen.
let lastSave: Promise<void> = Promise.resolve();

export function saveLibrary(lib: CompanyLibrary): Promise<void> {
  const run = () => (isTauri() ? saveTauri(lib) : saveWeb(lib));
  const result = lastSave.then(run, run);
  lastSave = result.catch(() => {});
  return result;
}
