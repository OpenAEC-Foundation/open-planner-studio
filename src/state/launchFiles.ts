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
  getState(): Pick<AppState, 'openOpenedFile' | 'notify' | 'ui' | 'getOpenDocumentPayloads' | 'switchDocument'>;
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
 * Staat het bestand op het moment van activeren al in een tabblad, dan wisselt de app daarheen in plaats van het nog
 * eens te openen: twee tabbladen die naar één bestand schrijven, overschrijven elkaars werk (knownbug 1957). Die
 * beslissing valt pas in de synchrone stap van het activeren (`existingDocument`), met de tabbladen van dat moment
 * (review van #1116, ronde 3): een tabblad dat tijdens het lezen of wachten openging (een tweede start, slepen) telt
 * mee, een tabblad dat intussen dichtging (Niet opslaan in de sluitvraag) niet. Vergelijken gaat op de padtekst en,
 * voor een link, op de bestandsidentiteit, die direct na het lezen wordt opgezocht (een `stat` past niet in de
 * synchrone stap). Een pad dat het besturingssysteem niet leest (ook een onopgeloste `..`), stopt al bij het lezen.
 */
export function openLaunchFiles(
  store: LaunchFilesStore,
  paths: readonly string[],
  io: TauriOpenIO,
  labels: ImportLabels,
  isBlocked: () => boolean,
  options: LaunchFileOptions = {},
): Promise<void> {
  const identityFs = options.identityFs ?? (async () => undefined);
  const files = droppedFilesFromPaths(paths, io, options.readOptions).map((file, index): DroppedFile => {
    const path = paths[index];
    let viaIdentity: string | null = null;
    return {
      name: file.name,
      read: async () => {
        const opened = await file.read();
        viaIdentity = await openDocumentIdForPath(store.getState(), path, identityFs).catch(() => null);
        return opened;
      },
      existingDocument: () => {
        const open = store.getState().getOpenDocumentPayloads();
        if (viaIdentity !== null && open.some(({ id }) => id === viaIdentity)) return viaIdentity;
        return openDocumentIdForPathText(store.getState(), path);
      },
    };
  });
  return openDroppedFiles(store, files, labels, isBlocked, { waitWhenBlocked: true });
}
