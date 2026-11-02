// Slepen en neerzetten van bestanden in het venster (issue #771): de ontvangstkant. Desktop (Tauri)
// levert paden, de browser een `DataTransfer`. Beide worden hier hetzelfde: een lijst `DroppedFile`
// met de naam meteen en de inhoud pas bij `read()`. Daarna loopt elk bestand door de gewone openroute
// (`state/fileDrop.ts` → `openOpenedFile`), dus met dezelfde formaatherkenning, opslagdoelregel,
// meldingen en recente bestanden als Bestand → Openen.
import type { FileRef, OpenedFile } from './index';
import { openedFromFile } from './webBackend';
import { readOpenedTauriPath, type TauriOpenIO } from './tauriBackend';
import { basename } from '@/utils/filePath';
import { binaryExtensions, isReadableFileName } from '@/services/formatRegistry';

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

function webDroppedFile(file: File, handle: Promise<FileSystemHandle | null>): DroppedFile {
  return {
    name: file.name,
    read: async () => {
      const h = await handle;
      // Alleen een bestandshandle is een opslagdoel; zonder handle (Firefox/Safari, of een geweigerde
      // vraag) is dit dezelfde vorm als de `<input type=file>`-terugval van de bestandskiezer.
      const ref: FileRef | null = h && h.kind === 'file' ? { kind: 'handle', handle: h as FileSystemFileHandle } : null;
      return openedFromFile(file, ref, { binaryExtensions: binaryExtensions() });
    },
  };
}

/**
 * Browser: de bestanden uit een `drop`-event. Roep dit SYNCHROON aan in de handler: na het event
 * maakt de browser `items` leeg, en `getAsFileSystemHandle` werkt alleen tijdens het event.
 * Chromium geeft per bestand een handle (zoals de bestandskiezer), zodat een gesleept IFC-bestand
 * een opslagdoel en een plek in de recente bestanden krijgt. Een map of ander item zonder bestand
 * valt weg.
 */
export function droppedFilesFromDataTransfer(dt: DataTransferLike): DroppedFile[] {
  const items = dt.items ? Array.from(dt.items) : [];
  if (items.length > 0) {
    const out: DroppedFile[] = [];
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;
      const handle = typeof item.getAsFileSystemHandle === 'function'
        // De `catch` voorkomt een onafgehandelde weigering voor een bestand dat nooit gelezen wordt.
        ? item.getAsFileSystemHandle().catch(() => null)
        : Promise.resolve(null);
      out.push(webDroppedFile(file, handle));
    }
    return out;
  }
  return Array.from(dt.files ?? []).map((file) => webDroppedFile(file, Promise.resolve(null)));
}

/** Desktop: de paden uit Tauri's `drag-drop`-event. Tauri zet elk gesleept pad zelf in de
 *  fs-scope (plugin-fs, `RunEvent::WindowEvent(DragDrop::Drop)`), dus ook een bestand buiten de
 *  thuismap is leesbaar. Lezen gaat via dezelfde kern als de open-dialoog (`readOpenedTauriPath`):
 *  binaire formaten als bytes, en het pad als herbruikbare ref. */
export function droppedFilesFromPaths(paths: readonly string[], io: TauriOpenIO): DroppedFile[] {
  return paths.map((path) => ({
    name: basename(path),
    read: () => readOpenedTauriPath(path, { binaryExtensions: binaryExtensions() }, io),
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
