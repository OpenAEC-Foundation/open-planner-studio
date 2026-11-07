import { useEffect, useState } from 'react';
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { isDocumentLeaveBlocked } from '@/hooks/keyboard/shortcutRegistry';
import {
  dragCarriesFiles, droppedFilesFromDataTransfer, droppedFilesFromPaths, type DroppedFile,
} from '@/services/fileAccess/fileDrop';
import { openDroppedFiles } from '@/state/fileDrop';

/** Zonder `dragover` gaat de laag na deze tijd weg. De browser stuurt `dragover` ook bij een
 *  stilstaande muis, minstens om de 550 ms (HTML-sleepmodel: 350 ± 200 ms); dit vangt een gemiste
 *  `dragleave` op, bijv. van een element dat tijdens het slepen uit de pagina verdween. */
export const FILE_DRAG_IDLE_MS = 1500;

/** Dezelfde poort als Ctrl+O (`useKeyboardShortcuts`): geen documentwissel zolang een dialoog of
 *  vraag openstaat (ook de site-, schema-, start- en samenvattingsvraag, zie `blockingDialogs.ts`) of
 *  Backstage → Projectinfo een niet-toegepaste draft bewaakt. */
function openDropped(files: DroppedFile[]): void {
  void openDroppedFiles(
    useAppStore, files, buildImportLabels((key) => i18n.t(key, { ns: 'common' })), isDocumentLeaveBlocked,
  );
}

/**
 * Slepen en neerzetten van bestanden in het venster (issue #771): ontvangt de bestanden en stuurt ze
 * naar de gewone openroute (`state/fileDrop.ts`). Geeft terug of de laag "Laat los om te openen"
 * zichtbaar moet zijn: tijdens een sleep met bestanden boven het venster, en niet zolang de poort
 * dicht is (dan opent loslaten niets, dus de laag zou iets beloven wat niet gebeurt).
 *
 * - Desktop: Tauri vangt het slepen zelf op (`dragDropEnabled: true` in `tauri.conf.json`) en geeft
 *   paden; de webview krijgt dan geen HTML5-drop. Daarom hier alleen `onDragDropEvent`.
 * - Browser: `dragenter`/`dragover`/`dragleave`/`drop` op `window`, alleen voor een sleep met
 *   bestanden (niet de kolomkoppen van de tabel, die hun eigen HTML5-sleep hebben). `preventDefault`
 *   is nodig: anders opent de browser het bestand zelf en verlaat hij de app. Met de poort dicht zet
 *   `dropEffect = 'none'` de verbodscursor en levert de browser geen `drop`.
 */
export function useFileDrop(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      let disposed = false;
      let unlisten: (() => void) | null = null;
      void (async () => {
        const [{ getCurrentWebview }, { readTextFile, readFile }] = await Promise.all([
          import('@tauri-apps/api/webview'), import('@tauri-apps/plugin-fs'),
        ]);
        if (disposed) return;
        const stop = await getCurrentWebview().onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === 'enter') {
            setActive(payload.paths.length > 0 && !isDocumentLeaveBlocked());
          } else if (payload.type === 'leave') {
            setActive(false);
          } else if (payload.type === 'drop') {
            setActive(false);
            openDropped(droppedFilesFromPaths(payload.paths, { readTextFile, readFile }));
          }
        });
        if (disposed) stop();
        else unlisten = stop;
      })();
      return () => {
        disposed = true;
        unlisten?.();
      };
    }

    // `dragenter`/`dragleave` komen per element; de teller staat pas op 0 als de sleep het venster
    // verliet (of werd afgebroken met Esc, dan stuurt de browser ook `dragleave`).
    let depth = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
      depth = 0;
      clearTimeout(idle);
      setActive(false);
    };
    const stillDragging = () => {
      clearTimeout(idle);
      idle = setTimeout(hide, FILE_DRAG_IDLE_MS);
    };
    const onDragEnter = (event: DragEvent) => {
      if (!dragCarriesFiles(event.dataTransfer)) return;
      depth += 1;
      setActive(!isDocumentLeaveBlocked());
      stillDragging();
    };
    const onDragOver = (event: DragEvent) => {
      if (!dragCarriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      const blocked = isDocumentLeaveBlocked();
      if (event.dataTransfer) event.dataTransfer.dropEffect = blocked ? 'none' : 'copy';
      setActive(!blocked);
      stillDragging();
    };
    const onDragLeave = (event: DragEvent) => {
      if (!dragCarriesFiles(event.dataTransfer)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) hide();
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer || !dragCarriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      hide();
      // Synchroon: na dit event zijn de bestanden en de handles niet meer te vragen.
      openDropped(droppedFilesFromDataTransfer(event.dataTransfer));
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      clearTimeout(idle);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return active;
}
