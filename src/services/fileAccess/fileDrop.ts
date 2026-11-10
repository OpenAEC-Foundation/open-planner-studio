// Slepen en neerzetten van bestanden in het venster (issue #771): de ontvangstkant. Desktop (Tauri)
// levert paden, de browser een `DataTransfer`. Beide worden hier hetzelfde: een lijst `DroppedFile`
// met de naam meteen en de inhoud pas bij `read()`. Daarna loopt elk bestand door de gewone openroute
// (`state/fileDrop.ts` → `openOpenedFile`), dus met dezelfde formaatherkenning, opslagdoelregel,
// meldingen en recente bestanden als Bestand → Openen.
import type { FileRef, OpenedFile } from './index';
import { openedFromFile } from './webBackend';
import { readOpenedTauriPath, type TauriOpenIO } from './tauriBackend';
import { basename } from '@/utils/filePath';
import { binaryExtensions, isReadableFileName, type FormatReadOptions } from '@/services/formatRegistry';

/** Eén gesleept bestand. De naam is er meteen (voor de keuze openen of weigeren), de inhoud pas bij
 *  `read()`: een geweigerd bestand wordt nooit gelezen. */
export interface DroppedFile {
  name: string;
  read(): Promise<OpenedFile>;
}

/** De delen van `DataTransfer` die hier gelezen worden; structureel, zodat de headless test een
 *  nep-object kan geven. */
export interface DataTransferLike {
  types: ArrayLike<string>;
  items?: ArrayLike<Pick<DataTransferItem, 'kind' | 'getAsFile' | 'getAsFileSystemHandle'>> | null;
  files?: ArrayLike<File> | null;
}

/** Sleept de gebruiker bestanden van buiten (en niet bijv. een kolomkop van de tabel)? Tijdens
 *  `dragover` zijn alleen de typen leesbaar, nog niet de bestanden zelf. */
export function dragCarriesFiles(dt: Pick<DataTransferLike, 'types'> | null | undefined): boolean {
  return !!dt && Array.from(dt.types).includes('Files');
}

/** De handle van een gesleept bestand, of `null`. De `catch` voorkomt een onafgehandelde weigering
 *  voor een bestand dat nooit gelezen wordt; de `try` vangt een browser die synchroon gooit (bijv.
 *  een `DataTransfer` die niet uit een echte sleep komt). */
function handleOf(item: Pick<DataTransferItem, 'getAsFileSystemHandle'>): Promise<FileSystemHandle | null> {
  if (typeof item.getAsFileSystemHandle !== 'function') return Promise.resolve(null);
  try {
    return item.getAsFileSystemHandle().catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

function webDroppedFile(file: File, handle: Promise<FileSystemHandle | null>, readOptions?: FormatReadOptions): DroppedFile {
  return {
    name: file.name,
    read: async () => {
      const h = await handle;
      // Alleen een bestandshandle is een opslagdoel; zonder handle (Firefox/Safari, of een geweigerde
      // vraag) is dit dezelfde vorm als de `<input type=file>`-terugval van de bestandskiezer.
      const ref: FileRef | null = h && h.kind === 'file' ? { kind: 'handle', handle: h as FileSystemFileHandle } : null;
      return openedFromFile(file, ref, { binaryExtensions: binaryExtensions(readOptions) });
    },
  };
}

/**
 * Browser: de bestanden uit een `drop`-event. Roep dit SYNCHROON aan in de handler: na het event
 * maakt de browser `items` leeg, en `getAsFileSystemHandle` werkt alleen tijdens het event.
 * Chromium geeft per bestand een handle (zoals de bestandskiezer), zodat een gesleept IFC-bestand
 * een opslagdoel en een plek in de recente bestanden krijgt. Een map of ander item zonder bestand
 * valt weg. `readOptions`: de leeskeuze van de open-actie (#804 fase 1a: IFC als bytes met de flag).
 */
export function droppedFilesFromDataTransfer(dt: DataTransferLike, readOptions?: FormatReadOptions): DroppedFile[] {
  const items = dt.items ? Array.from(dt.items) : [];
  if (items.length > 0) {
    const out: DroppedFile[] = [];
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;
      out.push(webDroppedFile(file, handleOf(item), readOptions));
    }
    return out;
  }
  return Array.from(dt.files ?? []).map((file) => webDroppedFile(file, Promise.resolve(null), readOptions));
}

/** Desktop: de paden uit Tauri's `drag-drop`-event. Tauri zet elk gesleept pad zelf in de
 *  fs-scope (plugin-fs, `RunEvent::WindowEvent(DragDrop::Drop)`), dus ook een bestand buiten de
 *  thuismap is leesbaar. Lezen gaat via dezelfde kern als de open-dialoog (`readOpenedTauriPath`):
 *  binaire formaten als bytes, en het pad als herbruikbare ref. */
export function droppedFilesFromPaths(paths: readonly string[], io: TauriOpenIO, readOptions?: FormatReadOptions): DroppedFile[] {
  return paths.map((path) => ({
    name: basename(path),
    read: () => readOpenedTauriPath(path, { binaryExtensions: binaryExtensions(readOptions) }, io),
  }));
}

/** Splits in wat de app kan openen (volgorde van neerzetten blijft) en de namen van de rest. */
export function splitDroppedFiles(files: readonly DroppedFile[]): { openable: DroppedFile[]; refused: string[] } {
  const openable: DroppedFile[] = [];
  const refused: string[] = [];
  for (const file of files) {
    if (isReadableFileName(file.name)) openable.push(file);
    else refused.push(file.name);
  }
  return { openable, refused };
}
