// #804, knownbug 1957: één bestand, één tabblad (besluit van de eigenaar, 21 november 2026). Opent de planner een
// bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad: de app gaat naar het tabblad dat al open
// is, met een melding. Dat tabblad houdt zijn inhoud (taken, gewijzigd-stand, ongedaan maken), ook als het bestand
// buiten de app veranderde. Alleen met de featureflag `ifcForeignContent` (besluit T1 van de technisch beslisser): met
// de flag uit opent het bestand een tweede tabblad, zoals main.
//
// Twee delen (route P van de technisch beslisser, review #1121 ronde 5): de PR voegt geen enkel wachtmoment toe aan de
// openactie.
//  - `startOpenLookup`, synchroon gestart bij het begin van het lezen, zonder dat iemand erop wacht: de aanroeper kent
//    het pad of de handle al (Openen, Recent, slepen, `planner_import_schedule`). Hij legt het bestand van elk tabblad
//    vast en vult de uitkomst (`stat`, `isSameEntry`) later in.
//  - `existingDocument`, synchroon, ná het lezen en parsen, in dezelfde stap als het activeren. De uitkomst van de toets
//    telt alleen als zij er dan al is; anders alleen wat synchroon te zien is. Wat later binnenkomt, doet niets meer.
// De site vergelijkt alleen het id, synchroon, na het parsen. Het startbestand (`openLaunchFiles`) houdt de toets van
// main.
import type { FileRef } from '@/services/fileAccess';
import { sameEntry, samePath } from '@/services/fileAccess/foreignSourceTarget';
import { missingTarget, usableIdentity, type FileIdentityFs, type FileIdentityInfo } from '@/services/fileAccess/fileIdentity';
import type { AppState } from './appStoreFactory';
import type { DocumentPayload } from './documentContract';
import type { NotifyInput } from './slices/types';

type Tabs = Pick<AppState, 'getOpenDocumentPayloads'>;
type TabFile = Pick<DocumentPayload, 'filePath' | 'fileHandle' | 'siteFileId'>;
type OpenTab = { readonly id: string; readonly payload: TabFile };
/** Wat de toets kan vergelijken: een lokaal pad of een browserhandle. */
export type LocalRef = Extract<FileRef, { kind: 'path' | 'handle' }>;

const sameTabFile = (a: TabFile, b: TabFile) =>
  a.filePath === b.filePath && a.fileHandle === b.fileHandle && a.siteFileId === b.siteFileId;

/** De identiteit van `path`: `'missing'` als er aantoonbaar niets staat, `null` als ze onbekend of onbruikbaar is. */
async function identityOf(fs: FileIdentityFs, path: string): Promise<FileIdentityInfo | 'missing' | null> {
  try {
    const info = await fs.stat(path);
    return usableIdentity(info) ? info : null;
  } catch (error) {
    return missingTarget(error) ? 'missing' : null;
  }
}

/**
 * Het open tabblad waarvan `ref` het bestand is, of `null`. Het bestand van een tabblad is zijn opslagdoel, dezelfde
 * voorrang als `saveTargetRef`: een site-id, anders een handle, anders een pad.
 *  - pad (desktop): een betrouwbare `dev`/`ino` gaat voor op het pad (een link is hetzelfde bestand; `maplink/../a.ifc`
 *    kan een ander zijn). Zonder betrouwbare identiteit, zoals op Windows, het genormaliseerde pad (knownbug 2040). Een
 *    pad waar aantoonbaar niets staat, is van geen tabblad. De identiteit van `ref` wordt één keer opgehaald.
 *  - handle (browser): alleen een tabblad met dezelfde bestandsnaam krijgt `isSameEntry`; een fout telt als een ander
 *    bestand.
 * Een bestand van een formaat zonder opslagdoel (XER, CSV, MS Project, P6 XML) heeft geen doel in zijn tabblad, dus
 * telt dat tabblad nooit mee (vraag P2). Twee kopieën met dezelfde inhoud zijn twee bestanden.
 */
export async function openDocumentFor(
  tabs: readonly OpenTab[], ref: LocalRef, identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<string | null> {
  if (ref.kind === 'handle') {
    // Eerst synchroon op naam voorsorteren: dezelfde entry heeft altijd dezelfde naam (WHATWG File System: `isSameEntry`
    // vergelijkt de locator, `name` is het laatste deel van zijn pad). De treffer komt alleen van `isSameEntry`.
    for (const { id, payload } of tabs) {
      if (payload.fileHandle && !payload.siteFileId && payload.fileHandle.name === ref.handle.name
        && await sameEntry(payload.fileHandle, ref.handle)) return id;
    }
    return null;
  }
  const paths = tabs.flatMap(({ id, payload }) =>
    payload.filePath && !payload.fileHandle && !payload.siteFileId ? [{ id, path: payload.filePath }] : []);
  if (paths.length === 0) return null;
  let fs: FileIdentityFs | undefined;
  try { fs = await identityFs(); } catch { fs = undefined; }
  const wanted = fs ? await identityOf(fs, ref.path) : null;
  if (wanted === 'missing') return null;
  for (const tab of paths) {
    if (tab.path === ref.path) return tab.id;
    const other = fs && wanted ? await identityOf(fs, tab.path) : null;
    // Op het pad van dit tabblad staat aantoonbaar niets (bijvoorbeeld een verdwenen alias): niet dit bestand, en niet
    // terugvallen op de padtekst.
    if (other === 'missing') continue;
    if (wanted && other) {
      if (wanted.dev === other.dev && wanted.ino === other.ino) return tab.id;
    } else if (samePath(ref.path, tab.path)) {
      return tab.id;
    }
  }
  return null;
}

/** De toets van één openactie: het bestand van elk tabblad bij de start, en de uitkomst zodra die binnen is. */
export interface OpenLookup {
  readonly seen: ReadonlyMap<string, TabFile>;
  /** Is de uitkomst binnen? Een fout laat dit onwaar: dan telt alleen wat synchroon te zien is. */
  readonly settled: boolean;
  readonly id: string | null;
}

/**
 * Start de toets en wacht er niet op: één momentopname van de tabbladen, de vergelijking loopt ernaast. Gooit nooit.
 * De aanroeper geeft het object door aan `existingDocument`; wat later binnenkomt, leest niemand meer.
 */
export function startOpenLookup(s: Tabs, ref: LocalRef, identityFs: () => Promise<FileIdentityFs | undefined>): OpenLookup {
  const tabs = s.getOpenDocumentPayloads().map(({ id, payload }) => ({
    id, payload: { filePath: payload.filePath, fileHandle: payload.fileHandle, siteFileId: payload.siteFileId },
  }));
  const lookup = { seen: new Map(tabs.map(({ id, payload }) => [id, payload])), settled: false, id: null as string | null };
  void openDocumentFor(tabs, ref, identityFs).then((id) => { lookup.id = id; lookup.settled = true; }, () => {});
  return lookup;
}

/** Heeft dit tabblad `ref` als bestand, synchroon te zien? Pad: dezelfde letterlijke tekst (een genormaliseerd pad kan
 *  op POSIX een ander bestand zijn); handle: hetzelfde object; site: het id. */
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
 * Is de uitkomst er nog niet, faalde de toets, of was er geen (`lookup` `null`: de site, of een route die het bestand
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

export const FILE_ALREADY_OPEN_NOTICE: NotifyInput = {
  severity: 'info',
  messageKey: 'notifications.fileAlreadyOpen',
  dedupeKey: 'file-already-open',
};

/** Naar het tabblad `id`, met de melding; synchroon, in de stap van `existingDocument`. */
export function switchToOpenDocument(s: Pick<AppState, 'switchDocument' | 'notify'>, id: string): void {
  s.switchDocument(id);
  s.notify(FILE_ALREADY_OPEN_NOTICE);
}
