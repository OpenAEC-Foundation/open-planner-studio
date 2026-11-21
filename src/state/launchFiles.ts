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
import { droppedFilesFromPaths } from '@/services/fileAccess/fileDrop';
import { isReadableFileName, type FormatReadOptions } from '@/services/formatRegistry';
import { basename } from '@/utils/filePath';
import { openDroppedFiles } from '@/state/fileDrop';
import { openDocumentIdForPath } from '@/state/ifcForeignGuard';
import { OPEN_WAIT_POLL_MS } from '@/state/slices/fileSlice';
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

/** Een pad met een `..` dat Rust niet kon oplossen (de map bestaat niet, `launch_files.rs`). Het besturingssysteem leest
 *  het niet; de tekstvergelijking met een open tabblad zou `weg/..` wel wegstrepen. Zo'n pad gaat dus rechtstreeks door
 *  de leesroute, met de gewone leesfout. */
const UNRESOLVED_PARENT = /(^|[\\/])\.\.([\\/]|$)/;

/**
 * Open de meegegeven paden, één voor één, door de route van een neergezet bestand. Een dichte poort (het
 * welkomstvenster bij de eerste start, een open dialoog) weigert hier niet: het bestand wacht tot de poort open is.
 * Een formaat dat de app niet opent, geeft één melding met alle namen, vóór het openen (zoals bij neerzetten).
 *
 * Staat een bestand al in een tabblad (dezelfde vergelijking als de opslagcontrole: pad of bestandsidentiteit), dan
 * opent de app het niet nog eens maar wisselt ze naar dat tabblad, pas als de poort open is: twee tabbladen die naar
 * één bestand schrijven, overschrijven elkaars werk (knownbug 1957, review van #1116). Omdat de paden één voor één
 * gaan, ziet elk pad de tabbladen die de paden ervóór openden; [`createLaunchFileOpener`] doet hetzelfde over events heen.
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
  const route = (some: readonly string[]) => openDroppedFiles(
    store, droppedFilesFromPaths(some, io, options.readOptions), labels, isBlocked, { waitWhenBlocked: true });
  const readable = paths.filter((path) => isReadableFileName(basename(path)));
  if (readable.length < paths.length) await route(paths.filter((path) => !readable.includes(path)));
  for (const path of readable) {
    const openId = UNRESOLVED_PARENT.test(path) ? null : await openDocumentIdForPath(store.getState(), path, identityFs);
    if (openId === null) {
      await route([path]);
      continue;
    }
    while (isBlocked()) await new Promise((resolve) => setTimeout(resolve, OPEN_WAIT_POLL_MS));
    if (store.getState().getOpenDocumentPayloads().some(({ id }) => id === openId)) store.getState().switchDocument(openId);
  }
}

export interface LaunchFileOptions {
  readOptions?: FormatReadOptions;
  identityFs?: () => Promise<FileIdentityFs | undefined>;
}

/**
 * Eén wachtrij voor alle startevents (de eerste start en elke tweede start): `open` begint pas aan een event als het
 * vorige helemaal klaar is. Anders zien twee dubbelklikken op hetzelfde bestand, terwijl het eerste nog gelezen wordt of
 * op het welkomstvenster wacht, allebei nog geen tabblad, en opent het bestand twee keer (review ronde 2 van #1116).
 */
export function createLaunchFileOpener(
  open: (paths: readonly string[]) => Promise<void>,
): (paths: readonly string[]) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (paths) => {
    tail = tail.then(() => open(paths)).catch((err: unknown) => console.error('Failed to open launch files:', err));
    return tail;
  };
}
