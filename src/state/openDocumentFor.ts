// #804, knownbug 1957: één bestand, één tabblad (besluit van de eigenaar, 21 november 2026). Opent de planner een
// bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad: de app gaat naar het tabblad dat al open
// is, met een melding. Dat tabblad houdt zijn inhoud (taken, gewijzigd-stand, ongedaan maken), ook als het bestand
// buiten de app veranderde. Alleen met de featureflag `ifcForeignContent` (besluit T1 van de technisch beslisser): met
// de flag uit opent het bestand een tweede tabblad, zoals main.
//
// Twee delen (route A van de technisch beslisser, review #1121 ronde 3; T3 gewijzigd voor het asynchrone deel):
//  - `lookupOpenDocument`, asynchroon (`stat`, `isSameEntry`), in het leesvenster: direct na het lezen, vóór het parsen,
//    zoals de startroute van main (#1091) dat doet. Het onthoudt het gevonden tabblad en het bestand van elk tabblad.
//  - `existingDocument`, synchroon, ná het parsen, in dezelfde stap als het activeren. Zo kan er tussen de beslissing en
//    het wisselen of openen niets gebeuren (geen opslag, geen tweede openactie).
// De startroute (`openLaunchFiles`) houdt haar eigen toets en `existingDocument`, zoals main.
import type { FileRef } from '@/services/fileAccess';
import { sameEntry, samePath } from '@/services/fileAccess/foreignSourceTarget';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import { openDocumentIdForPath, type WriteTargetState } from './ifcForeignGuard';
import type { AppState } from './appStoreFactory';
import type { DocumentPayload } from './documentContract';
import type { NotifyInput } from './slices/types';

type Tabs = Pick<WriteTargetState, 'getOpenDocumentPayloads'>;
type TabFile = Pick<DocumentPayload, 'filePath' | 'fileHandle' | 'siteFileId'>;

const sameTabFile = (a: TabFile, b: TabFile) =>
  a.filePath === b.filePath && a.fileHandle === b.fileHandle && a.siteFileId === b.siteFileId;

/**
 * Het open document waarvan `ref` het bestand is, of `null`. Het bestand van een document is zijn opslagdoel, dezelfde
 * voorrang als `saveTargetRef`: een site-id, anders een handle, anders een pad.
 *  - pad (desktop): de lus van de doelcontrole (`openDocumentIdForPath`), met een betrouwbare `dev`/`ino` vóór het
 *    lexicale pad (een link is hetzelfde bestand; `maplink/../a.ifc` kan een ander zijn). Windows levert geen
 *    `dev`/`ino`: daar alleen lexicaal (knownbug 2040).
 *  - handle (browser): `isSameEntry`; een fout telt als een ander bestand.
 *  - site: hetzelfde id.
 * Een bestand van een formaat zonder opslagdoel (XER, CSV, MS Project, P6 XML) heeft geen doel in zijn tabblad, dus
 * telt dat tabblad nooit mee (vraag P2: zo'n bestand opent gewoon opnieuw). Twee kopieën met dezelfde inhoud zijn twee
 * bestanden: geen inhoudsvergelijking.
 */
export async function openDocumentFor(s: Tabs, ref: FileRef, identityFs: () => Promise<FileIdentityFs | undefined>): Promise<string | null> {
  if (ref.kind === 'path') return openDocumentIdForPath(s, ref.path, identityFs, null, { identityFirst: true });
  const documents = s.getOpenDocumentPayloads();
  if (ref.kind === 'site') return documents.find(({ payload }) => payload.siteFileId === ref.id)?.id ?? null;
  for (const { id, payload } of documents) {
    if (payload.fileHandle && !payload.siteFileId && await sameEntry(payload.fileHandle, ref.handle)) return id;
  }
  return null;
}

/** Wat de toets in het leesvenster vond: het tabblad (of `null`) en het bestand van elk tabblad op dat moment. */
export interface OpenLookup {
  readonly id: string | null;
  readonly seen: ReadonlyMap<string, TabFile>;
}

/** De toets in het leesvenster: direct na het lezen, vóór het parsen. Eén momentopname van de tabbladen. */
export async function lookupOpenDocument(
  s: Tabs,
  ref: FileRef,
  identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<OpenLookup> {
  const documents = s.getOpenDocumentPayloads();
  const seen = new Map(documents.map(({ id, payload }) => [id, { filePath: payload.filePath, fileHandle: payload.fileHandle, siteFileId: payload.siteFileId }]));
  return { id: await openDocumentFor({ getOpenDocumentPayloads: () => documents }, ref, identityFs), seen };
}

/** Heeft dit tabblad `ref` als bestand, synchroon te zien? Pad: lexicaal; handle: hetzelfde object; site: het id. */
function holds(ref: FileRef, payload: TabFile): boolean {
  if (ref.kind === 'site') return payload.siteFileId === ref.id;
  if (payload.siteFileId) return false;
  if (ref.kind === 'handle') return payload.fileHandle === ref.handle;
  return !payload.fileHandle && !!payload.filePath && samePath(ref.path, payload.filePath);
}

/**
 * De eindbeslissing, synchroon, in dezelfde stap als het activeren: het open tabblad met `ref`, of `null`.
 *  - Het tabblad van de toets telt als het nog open is en nog hetzelfde bestand heeft.
 *  - Een tabblad dat de toets niet zo zag (het ging pas open, of kreeg intussen een ander bestand, bijvoorbeeld via
 *    *Opslaan als*) telt als het `ref` synchroon zichtbaar heeft (`holds`). Een tabblad dat de toets wel zo zag, houdt
 *    haar uitkomst: een betrouwbaar verschil (`dev`/`ino`) wordt niet alsnog een lexicale treffer.
 * Zonder toets (`lookup` `null`, de site) telt elk tabblad via `holds`.
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
