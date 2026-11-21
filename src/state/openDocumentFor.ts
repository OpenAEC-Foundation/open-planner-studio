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
import { readBytesFromRef, readFromRef, readOpenedPath, type FileRef, type OpenedFile } from '@/services/fileAccess';
import { projectFileWriteTurns } from '@/services/fileAccess/writeCoordinator';
import { sameEntry } from '@/services/fileAccess/foreignSourceTarget';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
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

export const FILE_ALREADY_OPEN_NOTICE: NotifyInput = {
  severity: 'info',
  messageKey: 'notifications.fileAlreadyOpen',
  dedupeKey: 'file-already-open',
};

/** Hoe vaak een openactie met `waitWhile` opnieuw kijkt. De poort van slepen leest ook de dialoogstapel buiten de store
 *  (`isAnyDialogOpen`), dus een abonnement op de store is niet genoeg. */
export const OPEN_WAIT_POLL_MS = 200;

type OpenState = Pick<AppState, 'getOpenDocumentPayloads' | 'switchDocument' | 'notify'>;

/** Het bestand van elk open tabblad: waar de uitkomst van de toets van afhangt. */
const tabFiles = (s: Pick<AppState, 'getOpenDocumentPayloads'>) =>
  s.getOpenDocumentPayloads().map(({ id, payload }) => ({ id, ...fileOf(payload) }));
const sameTabFiles = (a: ReturnType<typeof tabFiles>, b: ReturnType<typeof tabFiles>) => a.length === b.length
  && a.every((t, i) => t.id === b[i].id && t.filePath === b[i].filePath && t.fileHandle === b[i].fileHandle
    && t.siteFileId === b[i].siteFileId);

export interface OpenOrSwitchSteps {
  /** `projectFileWriteTurns()` van vóór het lezen van wat de route opent. */
  readonly writes: number;
  /** Wacht vóór het activeren zolang dit waar geeft (de poort van slepen en van een startbestand). */
  readonly waitWhile?: () => boolean;
  /** Synchroon, vlak vóór het wisselen of openen: mag de route nog iets doen (pauze, alleen-lezen van MCP)? */
  readonly ready?: () => boolean;
  /** Lees en parse het bestand opnieuw; zonder (de site) opent de route wat ze las. */
  readonly reread?: () => Promise<void>;
  /** Open het bestand in een eigen tabblad, synchroon; `false` als de route er toch van afziet. */
  readonly open: () => boolean;
}

/**
 * Knownbug 1957, met de flag `ifcForeignContent`: open `ref`, of ga naar het tabblad dat het al open heeft. De toets is
 * asynchroon (`stat`, `isSameEntry`); haar uitkomst geldt alleen zolang waar ze op rust niet veranderde (review #1121,
 * ronde 1 en 2): het bestand van elk tabblad, en geen schrijfbeurt sinds het lezen (`projectFileWriteTurns`). In één
 * synchrone stap na alle wachtmomenten, met het activeren:
 *  - kreeg een tabblad intussen een ander bestand, ging er een open of een dicht ⇒ de toets opnieuw;
 *  - een treffer ⇒ naar dat tabblad, met de melding; het houdt zijn inhoud;
 *  - geen treffer, maar wel een schrijfbeurt (bijvoorbeeld *Opslaan als* naar dit bestand in een tabblad dat daarna
 *    dichtging) ⇒ het gelezene kan oud zijn: opnieuw lezen en weer toetsen;
 *  - anders ⇒ openen (`open`).
 * `'switched'`, `'opened'`, of `'skipped'` als `ready` of `open` nee zei. Met de flag uit roept geen route dit aan.
 */
export async function openOrSwitch(
  get: () => OpenState,
  ref: FileRef,
  identityFs: () => Promise<FileIdentityFs | undefined>,
  steps: OpenOrSwitchSteps,
): Promise<'switched' | 'opened' | 'skipped'> {
  let writes = steps.writes;
  for (;;) {
    const tabs = tabFiles(get());
    const match = await openDocumentFor(get(), ref, identityFs);
    if (steps.waitWhile) while (steps.waitWhile()) await new Promise((resolve) => setTimeout(resolve, OPEN_WAIT_POLL_MS));
    // Vanaf hier synchroon tot en met het activeren.
    const s = get();
    if (!sameTabFiles(tabFiles(s), tabs)) continue;
    if (match) {
      if (steps.ready && !steps.ready()) return 'skipped';
      s.switchDocument(match.id);
      s.notify(FILE_ALREADY_OPEN_NOTICE);
      return 'switched';
    }
    if (steps.reread && projectFileWriteTurns() !== writes) {
      writes = projectFileWriteTurns();
      await steps.reread();
      continue;
    }
    if (steps.ready && !steps.ready()) return 'skipped';
    return steps.open() ? 'opened' : 'skipped';
  }
}

/** Lees `opened` opnieuw via zijn ref, met dezelfde bytekeuze (de leesroute van Recent). `null` zonder pad of handle. */
export async function rereadOpened(opened: OpenedFile): Promise<OpenedFile | null> {
  const ref = opened.ref;
  const asBytes = opened.bytes !== undefined;
  if (ref?.kind === 'path') return { ...await readOpenedPath(ref.path, asBytes), name: opened.name };
  if (ref?.kind !== 'handle') return null;
  const content = asBytes ? null : await readFromRef(ref);
  const bytes = asBytes ? await readBytesFromRef(ref) : null;
  if (content === null && bytes === null) throw new Error(`'${opened.name}' could not be read again`);
  return { name: opened.name, content: content ?? '', ...(bytes ? { bytes } : {}), ref };
}
