// #804, knownbug 1957: één bestand, één tabblad (besluit van de eigenaar, 21 november 2026). Opent de planner een
// bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad: de app gaat naar het tabblad dat al open
// is, met een melding. Dat tabblad houdt zijn inhoud (taken, gewijzigd-stand, ongedaan maken), ook als het bestand
// buiten de app veranderde. Alleen met de featureflag `ifcForeignContent` (besluit T1 van de technisch beslisser): met
// de flag uit opent het bestand een tweede tabblad, zoals main.
//
// Twee delen (route B van de technisch beslisser, review #1121 ronde 4): geen wachtmoment van deze PR tussen het
// binnenkomen van de bytes en het activeren.
//  - `lookupOpenDocument`, asynchroon (`stat`, `isSameEntry`), vóór het lezen: de aanroeper kent het pad of de handle
//    al (Openen, Recent, slepen, `planner_import_schedule`). Het onthoudt het gevonden tabblad en het bestand van elk
//    tabblad op dat moment.
//  - `existingDocument`, synchroon, ná het lezen en parsen, in dezelfde stap als het activeren.
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
/** Wat de toets vóór het lezen kan vergelijken: een lokaal pad of een browserhandle. */
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
 *  - handle (browser): `isSameEntry`; een fout telt als een ander bestand.
 * Een bestand van een formaat zonder opslagdoel (XER, CSV, MS Project, P6 XML) heeft geen doel in zijn tabblad, dus
 * telt dat tabblad nooit mee (vraag P2). Twee kopieën met dezelfde inhoud zijn twee bestanden.
 */
export async function openDocumentFor(
  tabs: readonly OpenTab[], ref: LocalRef, identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<string | null> {
  if (ref.kind === 'handle') {
    for (const { id, payload } of tabs) {
      if (payload.fileHandle && !payload.siteFileId && await sameEntry(payload.fileHandle, ref.handle)) return id;
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
    if (wanted && other && other !== 'missing') {
      if (wanted.dev === other.dev && wanted.ino === other.ino) return tab.id;
    } else if (samePath(ref.path, tab.path)) {
      return tab.id;
    }
  }
  return null;
}

/** Wat de toets vóór het lezen vond: het tabblad (of `null`) en het bestand van elk tabblad op dat moment. */
export interface OpenLookup {
  readonly id: string | null;
  readonly seen: ReadonlyMap<string, TabFile>;
}

/** De toets vóór het lezen: één momentopname van de tabbladen. Gooit nooit; een fout is "geen treffer". */
export async function lookupOpenDocument(
  s: Tabs, ref: LocalRef, identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<OpenLookup> {
  const tabs = s.getOpenDocumentPayloads().map(({ id, payload }) => ({
    id, payload: { filePath: payload.filePath, fileHandle: payload.fileHandle, siteFileId: payload.siteFileId },
  }));
  const seen = new Map(tabs.map(({ id, payload }) => [id, payload]));
  return { id: await openDocumentFor(tabs, ref, identityFs).catch(() => null), seen };
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
 * De eindbeslissing, synchroon, in dezelfde stap als het activeren: het open tabblad met `ref`, of `null`.
 *  - Het tabblad van de toets telt als het nog open is en nog hetzelfde bestand heeft.
 *  - Een tabblad dat de toets niet zo zag (het ging pas open, of kreeg intussen een ander bestand, bijvoorbeeld via
 *    *Opslaan als*) telt als het `ref` synchroon zichtbaar heeft (`holds`). Een tabblad dat de toets wel zo zag, houdt
 *    haar uitkomst.
 * Zonder toets (`lookup` `null`: de site, of een route die het bestand pas bij het lezen kent) telt elk tabblad via
 * `holds`. Een tabblad dat intussen sloot, telt niet: dan opent het bestand gewoon.
 */
export function existingDocument(s: Tabs, ref: FileRef, lookup: OpenLookup | null): string | null {
  const documents = s.getOpenDocumentPayloads();
  const seenAsNow = (id: string, payload: TabFile) => {
    const before = lookup?.seen.get(id);
    return !!before && sameTabFile(before, payload);
  };
  const found = lookup?.id == null ? undefined : documents.find(({ id }) => id === lookup.id);
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
