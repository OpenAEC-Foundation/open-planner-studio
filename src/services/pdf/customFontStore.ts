// De kopie van het eigen rapportlettertype (issue #770, besluit Ethan 14 november 2026).
//
// WAAROM een kopie van de bytes en niet het pad of de naam: de voorvertoning en de PDF moeten op dezelfde
// bytes meten en tekenen, en in de browser is een lettertype van de computer alleen na een toestemmingsvraag
// te lezen (Chrome/Edge). Met een kopie werkt het rapport bij elke start meteen, in de desktopapp en de
// browser hetzelfde, ook als het lettertype later van de computer verdwijnt. Is de kopie weg (opslag gewist,
// privévenster), dan valt het rapport terug op Inter met één melding (`useCustomReportFontGuard`).
//
// Eén plek, één lettertype: een nieuwe keuze vervangt de vorige. Op dit apparaat, nooit in het IFC-bestand.
import { openDb } from '@/utils/idb';

const DB_NAME = 'ops-report-font';
const STORE = 'fonts';
const RECORD_ID = 'custom';

export interface CustomFontRecord {
  id: typeof RECORD_ID;
  /** De familienaam, voor de keuzelijst en de melding. */
  name: string;
  /** Versie: verandert bij elke nieuwe keuze, zodat scherm en meting de nieuwe bytes laden. */
  rev: number;
  /** Losse lettertypebestanden (een face uit een collectie is er al uit gehaald). */
  regular: Uint8Array;
  /** `null`: geen vette variant; vette tekst staat dan in de gewone letter (besluit 3a). */
  bold: Uint8Array | null;
}

let cached: Promise<CustomFontRecord | null> | null = null;

// Een ander venster koos een ander eigen lettertype: het schrijft eerst de bytes en dan de rapportinstellingen
// (`ops-reportSettings`, met de nieuwe versie). Die instelling meldt de browser hier met een `storage`-event; dan
// is de kopie in dit venster verouderd en leest de volgende aanvraag opnieuw (review Sol #946, ronde 1). Zonder
// dit hield dit venster de oude bytes vast en schreef de controle de oude versie terug.
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

/**
 * Het eigen lettertype, of `null` als er geen is of de opslag niet te lezen is. Wijst nooit af. `fresh`: lees de
 * opslag opnieuw in plaats van de kopie van dit venster (voor de controle die de instellingen bijwerkt).
 */
export function getCustomFont({ fresh = false }: { fresh?: boolean } = {}): Promise<CustomFontRecord | null> {
  if (fresh) cached = null;
  cached ??= readRecord().catch(err => {
    console.warn('[customFontStore] Eigen lettertype niet te lezen:', err);
    cached = null;
    return null;
  });
  return cached;
}

/** Bewaart een nieuw eigen lettertype (vervangt het vorige). Gooit als de opslag het niet aanneemt. */
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
