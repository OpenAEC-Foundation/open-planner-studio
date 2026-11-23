// Een bestand meegeven bij het starten (issue #1091): `OpenPlannerStudio.exe C:\werk\plan.ifc`, of een
// dubbelklik op een bestand dat de gebruiker zelf aan de app heeft gekoppeld. Rust leest de paden uit de
// opdrachtregel van de eerste start en van elke tweede start (`src-tauri/src/launch_files.rs`, de
// single-instance-callback) en houdt ze vast tot de webview meldt dat hij luistert. Er is geen command
// voor: de paden komen als event, het klaarsignaal is een event terug.
//
// Elk pad gaat door dezelfde route als een neergezet bestand (`state/fileDrop.ts`), en die is gelijk aan
// Bestand → Openen: formaatherkenning, opslagdoel, Recent, een eigen tabblad naast een project met
// wijzigingen, en de gewone melding bij een pad dat niet bestaat of een formaat dat de app niet opent. Een bestand
// dat al in een tabblad staat, opent niet nog eens: de app wisselt naar dat tabblad.
// Lezen gaat via plugin-fs en dus binnen de fs-scope; buiten de thuismap mag dat niet (knownbug 2030).
import type { AppState } from '@/state/appStoreFactory';
import type { ImportLabels } from '@/services/importTypes';
import type { TauriOpenIO } from '@/services/fileAccess/tauriBackend';
import { droppedFilesFromPaths, type DroppedFile } from '@/services/fileAccess/fileDrop';
import type { FormatReadOptions } from '@/services/formatRegistry';
import { openDroppedFiles } from '@/state/fileDrop';
import { openDocumentIdForPath, openDocumentIdForPathText } from '@/state/ifcForeignGuard';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import { projectFileWriteTurns } from '@/services/fileAccess/writeCoordinator';

/** Rust → webview: een lijst paden om te openen. Dezelfde naam staat in `src-tauri/src/launch_files.rs`. */
export const OPEN_FILES_EVENT = 'ops:open-files';
/** Webview → Rust: er luistert nu iemand; stuur wat er klaarligt. Dezelfde naam staat in Rust. */
export const OPEN_FILES_READY_EVENT = 'ops:open-files-ready';

/** De delen van `@tauri-apps/api/event` die hier nodig zijn; een nep-object in de test. */
export interface LaunchFilesBus {
  listen(event: string, handler: (payload: unknown) => void): Promise<() => void>;
  emit(event: string): Promise<void>;
}

/** De paden uit een event: alleen een lijst met niet-lege tekst telt. */
export function launchPaths(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter((p): p is string => typeof p === 'string' && p.length > 0);
}

/** Eerst luisteren, dan pas klaar melden: Rust stuurt wat klaarligt direct na het klaarsignaal. */
export async function listenForLaunchFiles(bus: LaunchFilesBus, onPaths: (paths: string[]) => void): Promise<() => void> {
  const stop = await bus.listen(OPEN_FILES_EVENT, (payload) => {
    const paths = launchPaths(payload);
    if (paths.length > 0) onPaths(paths);
  });
  await bus.emit(OPEN_FILES_READY_EVENT);
  return stop;
}

interface LaunchFilesStore {
  getState(): Pick<AppState, 'openOpenedFile' | 'notify' | 'ui' | 'getOpenDocumentPayloads'>;
}

/** Het pad van het open document `id` als lokaal bestand, of `null` (dicht, geen pad). */
function openFilePath(store: LaunchFilesStore, id: string): string | null {
  return store.getState().getOpenDocumentPayloads().find((doc) => doc.id === id)?.payload.filePath ?? null;
}

export interface LaunchFileOptions {
  readOptions?: FormatReadOptions;
  identityFs?: () => Promise<FileIdentityFs | undefined>;
}

/**
 * Open de meegegeven paden door de route van een neergezet bestand: lezen, wachten zolang de poort dicht is (het
 * welkomstvenster bij de eerste start, een open dialoog; hier geen weigering), dan activeren. Een formaat dat de app niet
 * opent, krijgt de gewone melding met alle namen.
 *
 * Twee beslissingen vallen pas in de synchrone stap van het activeren, met de stand van dat moment (review van #1116):
 * - Staat het bestand dan al in een tabblad, dan wisselt de app daarheen in plaats van het nog eens te openen: twee
 *   tabbladen die naar één bestand schrijven, overschrijven elkaars werk (knownbug 1957). Een tabblad dat tijdens het
 *   lezen of wachten openging (een tweede start, slepen) telt mee, een tabblad dat intussen dichtging niet (ronde 3).
 *   Vergelijken gaat op de padtekst en, voor een link, op de bestandsidentiteit die direct na het lezen is opgezocht
 *   (een `stat` past niet in de synchrone stap; grens: knownbug 2032).
 * - Begon er sinds het lezen een schrijfbeurt (`projectFileWriteTurns`), dan activeert de app niets en leest ze het
 *   bestand opnieuw: *Opslaan* in de sluitvraag kan intussen een nieuwere versie naar hetzelfde bestand geschreven
 *   hebben, en de oude versie met hetzelfde opslagdoel zou die bij de volgende Ctrl+S stil overschrijven (ronde 4).
 *   Dat werkt alleen omdat elke schrijver naar een bestand dat de app opent door die ene rij gaat
 *   (`runProjectFileWrite`); wat er nog buiten schrijft, is intern of zeldzaam (knownbug 2033).
 *
 * Een pad dat het besturingssysteem niet leest (ook een onopgeloste `..`), stopt al bij het lezen.
 */
export async function openLaunchFiles(
  store: LaunchFilesStore,
  paths: readonly string[],
  io: TauriOpenIO,
  labels: ImportLabels,
  isBlocked: () => boolean,
  options: LaunchFileOptions = {},
): Promise<void> {
  const identityFs = options.identityFs ?? (async () => undefined);
  let pending: readonly string[] = paths;
  while (pending.length > 0) {
    const reread: string[] = [];
    const files = droppedFilesFromPaths(pending, io, options.readOptions).map((file, index): DroppedFile => {
      const path = pending[index];
      let writesAtRead = -1;
      let viaIdentity: { id: string; filePath: string } | null = null;
      return {
        name: file.name,
        read: async () => {
          // De teller vóór het hele lezen, dus ook vóór het wachten op de schrijfrij en vóór `settle`: een beurt die
          // daarna begint, kan het bestand vervangen nadat het gelezen is, en geeft dan een tweede lezing (ronde 6). Een
          // beurt die al liep, wacht `readOpenedTauriPath` eerst af. Liever één lezing te veel dan een oude versie.
          writesAtRead = projectFileWriteTurns();
          const opened = await file.read();
          // De paden van de tabbladen vóór de controle: wisselt een tabblad tijdens de `stat` van naam, dan telt het niet.
          const pathsBefore = new Map(store.getState().getOpenDocumentPayloads().map((doc) => [doc.id, doc.payload.filePath]));
          const id = await openDocumentIdForPath(store.getState(), path, identityFs).catch(() => null);
          const filePath = id === null ? null : pathsBefore.get(id) ?? null;
          viaIdentity = id !== null && filePath !== null ? { id, filePath } : null;
          return opened;
        },
        existingDocument: () => {
          // Het tabblad van de identiteitscontrole telt alleen als het nog open is én nog naar hetzelfde bestand wijst
          // (niet na *Opslaan als* naar een andere naam).
          if (viaIdentity !== null && openFilePath(store, viaIdentity.id) === viaIdentity.filePath) return viaIdentity.id;
          return openDocumentIdForPathText(store.getState(), path);
        },
        stale: () => {
          if (projectFileWriteTurns() === writesAtRead) return false;
          reread.push(path);
          return true;
        },
      };
    });
    await openDroppedFiles(store, files, labels, isBlocked, { waitWhenBlocked: true });
    pending = reread;
  }
}
