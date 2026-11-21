// #804, knownbug 1957: één bestand, één tabblad (besluit van de eigenaar, 21 november 2026). Opent de planner een
// bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad: de app gaat naar het tabblad dat al open
// is, met een melding. Dat tabblad houdt zijn inhoud (taken, gewijzigd-stand, ongedaan maken), ook als het bestand
// buiten de app veranderde. Alleen met de featureflag `ifcForeignContent` (besluit T1 van de technisch beslisser): met
// de flag uit opent het bestand een tweede tabblad, zoals main.
//
// De toets staat op drie plekken, elk ná het parsen en vlak vóór `openAsDocument` (besluit T3): `openOpenedFile`
// (Openen, Recent, slepen, de dev-link), `openSiteChoice` (de site, ook via Recent) en `planner_import_schedule`.
// `openAsDocument` zelf blijft synchroon (contract van MCP en kern); de toets is asynchroon (`stat`, `isSameEntry`).
// Daarom kijkt de wissel vlak vóór het activeren synchroon of het gevonden tabblad nog hetzelfde bestand heeft
// (review #1121): *Opslaan als*, sluiten of hernoemen tijdens de toets of tijdens een wachtende neerzetting laat het
// gevraagde bestand dan gewoon openen, zoals main.
import type { FileRef } from '@/services/fileAccess';
import { sameEntry } from '@/services/fileAccess/foreignSourceTarget';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { openDocumentIdForPath, type WriteTargetState } from './ifcForeignGuard';
import type { AppState } from './appStoreFactory';
import type { DocumentPayload } from './documentContract';
import type { NotifyInput } from './slices/types';

type DocumentFile = Pick<DocumentPayload, 'filePath' | 'fileHandle' | 'siteFileId'>;

/** Wat de toets vond: het tabblad en het bestand dat het had toen de toets begon. */
export interface OpenDocumentMatch {
  readonly id: string;
  readonly file: DocumentFile;
}

const fileOf = ({ filePath, fileHandle, siteFileId }: DocumentFile): DocumentFile => ({ filePath, fileHandle, siteFileId });

/**
 * Het open document waarvan `ref` het bestand is, of `null`. Het bestand van een document is zijn opslagdoel, dezelfde
 * voorrang als `saveTargetRef`: een site-id, anders een handle, anders een pad.
 *  - pad (desktop, headless MCP-server): de lus van de doelcontrole (`openDocumentIdForPath`), met een betrouwbare
 *    `dev`/`ino` vóór het lexicale pad (een link is hetzelfde bestand; `maplink/../a.ifc` kan een ander zijn). Windows
 *    levert geen `dev`/`ino`: daar alleen lexicaal.
 *  - handle (browser): `isSameEntry`; een fout telt als een ander bestand.
 *  - site: hetzelfde id.
 * Een bestand van een formaat zonder opslagdoel (XER, CSV, MS Project, P6 XML) heeft geen doel in zijn tabblad, dus
 * telt dat tabblad nooit mee (vraag P2: zo'n bestand opent gewoon opnieuw). Twee kopieën met dezelfde inhoud zijn twee
 * bestanden: geen inhoudsvergelijking.
 */
export async function openDocumentFor(
  s: Pick<WriteTargetState, 'getOpenDocumentPayloads'>,
  ref: FileRef | null,
  identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<OpenDocumentMatch | null> {
  if (!ref) return null;
  // Synchroon vóór de eerste await, net als de lus van `openDocumentIdForPath`: het bestand van elk tabblad bij de start.
  const documents = s.getOpenDocumentPayloads();
  const match = (id: string | null) => {
    const found = id === null ? undefined : documents.find(d => d.id === id);
    return found ? { id: found.id, file: fileOf(found.payload) } : null;
  };
  if (ref.kind === 'path') return match(await openDocumentIdForPath(s, ref.path, identityFs, null, { identityFirst: true }));
  if (ref.kind === 'site') return match(documents.find(({ payload }) => payload.siteFileId === ref.id)?.id ?? null);
  for (const { id, payload } of documents) {
    if (payload.fileHandle && !payload.siteFileId && await sameEntry(payload.fileHandle, ref.handle)) return match(id);
  }
  return null;
}

/** `openDocumentFor`, alleen met de flag aan. Met de flag uit `null` zonder belofte, zodat de openroute geen await
 *  krijgt en precies main blijft. */
export function alreadyOpenDocument(
  s: WriteTargetState,
  ref: FileRef | null,
  identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<OpenDocumentMatch | null> | null {
  return ifcForeignContentEnabled(s.ui.featureFlags) ? openDocumentFor(s, ref, identityFs) : null;
}

export const FILE_ALREADY_OPEN_NOTICE: NotifyInput = {
  severity: 'info',
  messageKey: 'notifications.fileAlreadyOpen',
  dedupeKey: 'file-already-open',
};

/**
 * Ga naar het tabblad van `match`, met de melding; synchroon, in dezelfde stap als waarin de openroute anders zou
 * activeren. `false` als dat tabblad intussen gesloten is of een ander bestand heeft (*Opslaan als*, hernoemen): dan
 * opent de route het gevraagde bestand gewoon, zodat het niet stil verdwijnt en de app niet naar een ander bestand gaat.
 */
export function switchToOpenDocument(
  s: Pick<AppState, 'getOpenDocumentPayloads' | 'switchDocument' | 'notify'>,
  match: OpenDocumentMatch,
): boolean {
  const now = s.getOpenDocumentPayloads().find(d => d.id === match.id)?.payload;
  if (!now || now.filePath !== match.file.filePath || now.fileHandle !== match.file.fileHandle
    || now.siteFileId !== match.file.siteFileId) return false;
  s.switchDocument(match.id);
  s.notify(FILE_ALREADY_OPEN_NOTICE);
  return true;
}

