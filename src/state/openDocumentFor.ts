// #804, knownbug 1957: één bestand, één tabblad (besluit van de eigenaar, 21 november 2026). Opent de planner een
// bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad: de app gaat naar het tabblad dat al open
// is, met een melding. Dat tabblad houdt zijn inhoud (taken, gewijzigd-stand, ongedaan maken), ook als het bestand
// buiten de app veranderde. Alleen met de featureflag `ifcForeignContent` (besluit T1 van de technisch beslisser): met
// de flag uit opent het bestand een tweede tabblad, zoals main.
//
// Twee delen (besluit D van de technisch beslisser, review #1121 ronde 6): de PR voegt geen enkel wachtmoment toe aan de
// openactie, en de toets kijkt zelf niet naar de schijf.
//  - Browser: `startOpenLookup`, synchroon gestart vlak vóór het lezen, zonder dat iemand erop wacht. Hij legt het
//    bestand van elk tabblad vast en start `isSameEntry` voor alle tabbladen met een handle tegelijk.
//  - `existingDocument`, synchroon, ná het lezen en parsen, in dezelfde stap als het activeren. De uitkomst van de toets
//    telt alleen als zij er dan al is; anders alleen wat synchroon te zien is. Wat later binnenkomt, doet niets meer.
// De desktop vergelijkt alleen de letterlijke padtekst, synchroon in die stap (een link of een anders geschreven pad
// opent een tweede tabblad, zoals main: knownbug 2063). De site vergelijkt het id. Het startbestand (`openLaunchFiles`)
// houdt de toets van main.
import type { FileRef } from '@/services/fileAccess';
import { sameEntry } from '@/services/fileAccess/foreignSourceTarget';
import type { AppState } from './appStoreFactory';
import type { DocumentPayload } from './documentContract';
import type { NotifyInput } from './slices/types';

type Tabs = Pick<AppState, 'getOpenDocumentPayloads'>;
type TabFile = Pick<DocumentPayload, 'filePath' | 'fileHandle' | 'siteFileId'>;
/** Wat de toets kan vergelijken: een browserhandle. */
export type HandleRef = Extract<FileRef, { kind: 'handle' }>;

const sameTabFile = (a: TabFile, b: TabFile) =>
  a.filePath === b.filePath && a.fileHandle === b.fileHandle && a.siteFileId === b.siteFileId;

/** De toets van één openactie: het bestand van elk tabblad bij de start, en de uitkomst zodra die binnen is. */
export interface OpenLookup {
  readonly seen: ReadonlyMap<string, TabFile>;
  /** Is de uitkomst binnen? Een treffer zodra er één binnen is; "geen" pas als alle vergelijkingen binnen zijn. */
  readonly settled: boolean;
  readonly id: string | null;
}

/**
 * Start de toets en wacht er niet op: één momentopname van de tabbladen, en `isSameEntry` voor elk tabblad met een
 * handle (zonder site-id) tegelijk, in de richting `gevraagd.isSameEntry(tabblad)`. Een fout telt als een ander
 * bestand. Gooit nooit. Een bestand van een formaat zonder opslagdoel (XER, CSV, MS Project, P6 XML) toetst de aanroeper
 * niet (vraag P2). Twee kopieën met dezelfde inhoud zijn twee bestanden.
 */
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

/** Heeft dit tabblad `ref` als bestand, synchroon te zien? Pad: dezelfde letterlijke tekst (geen normalisatie: een
 *  genormaliseerd pad kan op POSIX een ander bestand zijn); handle: hetzelfde object; site: het id. */
function holds(ref: FileRef, payload: TabFile): boolean {
  if (ref.kind === 'site') return payload.siteFileId === ref.id;
  if (payload.siteFileId) return false;
  if (ref.kind === 'handle') return payload.fileHandle === ref.handle;
  return !payload.fileHandle && payload.filePath === ref.path;
}

/**
 * De eindbeslissing, synchroon, in dezelfde stap als het activeren: het open tabblad met `ref`, of `null`. Bij twijfel
 * geen treffer: een tweede tabblad is minder erg dan een verkeerde wissel.
 *  - Is de uitkomst van de toets binnen, dan telt haar tabblad als het nog open is en nog hetzelfde bestand heeft.
 *  - Een tabblad dat de toets niet zo zag (het ging pas open, of kreeg intussen een ander bestand, bijvoorbeeld via
 *    *Opslaan als*) telt als het `ref` synchroon zichtbaar heeft (`holds`). Een tabblad dat een binnengekomen toets wel
 *    zo zag, houdt haar uitkomst.
 * Is de uitkomst er nog niet, of was er geen toets (`lookup` `null`: de desktop, de site, of een route die het bestand
 * pas bij het lezen kent), dan telt elk tabblad via `holds`. Een tabblad dat intussen sloot, telt niet: dan opent het
 * bestand gewoon.
 */
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

/** Naar het tabblad `id`, met de melding; synchroon, in de stap van `existingDocument`. */
export function switchToOpenDocument(s: Pick<AppState, 'switchDocument' | 'notify'>, id: string): void {
  s.switchDocument(id);
  s.notify(FILE_ALREADY_OPEN_NOTICE);
}
