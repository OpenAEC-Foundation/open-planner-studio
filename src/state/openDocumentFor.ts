// #804, knownbug 1957: één bestand, één tabblad (besluit van de eigenaar, 21 november 2026). Opent de planner een
// bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad: de app gaat naar het tabblad dat al open
// is, met een melding. Dat tabblad verandert niet (taken, gewijzigd-stand, ongedaan maken) en wordt niet herladen, ook
// niet als het bestand buiten de app veranderde. Alleen met de featureflag `ifcForeignContent` (besluit T1 van de
// technisch beslisser): met de flag uit opent het bestand een tweede tabblad, zoals main.
//
// De toets staat op drie plekken, elk ná het parsen en vlak vóór `openAsDocument` (besluit T3): `openOpenedFile`
// (Openen, Recent, slepen, de dev-link), `openSiteChoice` (de site, ook via Recent) en `planner_import_schedule`.
// `openAsDocument` zelf blijft synchroon (contract van MCP en kern); de toets is asynchroon (`stat`, `isSameEntry`).
import type { FileRef } from '@/services/fileAccess';
import { sameEntry } from '@/services/fileAccess/foreignSourceTarget';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { openDocumentPathId, type WriteTargetState } from './ifcForeignGuard';
import type { AppState } from './appStoreFactory';
import type { NotifyInput } from './slices/types';

/**
 * Het open document waarvan `ref` het bestand is, of `null`. Het bestand van een document is zijn opslagdoel, dezelfde
 * voorrang als `saveTargetRef`: een site-id, anders een handle, anders een pad.
 *  - pad (desktop, headless MCP-server): de lus van de doelcontrole (`openDocumentPathId`): hetzelfde genormaliseerde
 *    pad, of dezelfde `dev`/`ino` (ook via een link). Windows levert geen `dev`/`ino`: daar alleen lexicaal.
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
): Promise<string | null> {
  if (!ref) return null;
  if (ref.kind === 'path') return openDocumentPathId(s, ref.path, identityFs, null);
  const documents = s.getOpenDocumentPayloads();
  if (ref.kind === 'site') return documents.find(({ payload }) => payload.siteFileId === ref.id)?.id ?? null;
  for (const { id, payload } of documents) {
    if (payload.fileHandle && !payload.siteFileId && await sameEntry(payload.fileHandle, ref.handle)) return id;
  }
  return null;
}

/** `openDocumentFor`, maar alleen met de flag aan; met de flag uit altijd `null` (zoals main). */
export function alreadyOpenDocumentId(
  s: WriteTargetState,
  ref: FileRef | null,
  identityFs: () => Promise<FileIdentityFs | undefined>,
): Promise<string | null> {
  return ifcForeignContentEnabled(s.ui.featureFlags) ? openDocumentFor(s, ref, identityFs) : Promise.resolve(null);
}

export const FILE_ALREADY_OPEN_NOTICE: NotifyInput = {
  severity: 'info',
  messageKey: 'notifications.fileAlreadyOpen',
  dedupeKey: 'file-already-open',
};

/**
 * Ga naar het tabblad `id` dat het bestand al open heeft, met de melding; synchroon, in dezelfde stap als waarin de
 * openroute anders zou activeren. `false` als dat document intussen gesloten is (tijdens het wachten van een
 * neerzetting): dan opent de route het bestand gewoon, zodat het niet stil verdwijnt.
 */
export function switchToOpenDocument(
  s: Pick<AppState, 'documents' | 'switchDocument' | 'notify'>,
  id: string,
): boolean {
  if (!s.documents.some((document) => document.id === id)) return false;
  s.switchDocument(id);
  s.notify(FILE_ALREADY_OPEN_NOTICE);
  return true;
}
