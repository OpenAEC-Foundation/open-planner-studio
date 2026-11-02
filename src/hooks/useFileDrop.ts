import { useEffect } from 'react';
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { isDocumentLeaveBlocked } from '@/hooks/keyboard/shortcutRegistry';
import {
  dragCarriesFiles, droppedFilesFromDataTransfer, droppedFilesFromPaths, type DroppedFile,
} from '@/services/fileAccess/fileDrop';
import { openDroppedFiles } from '@/state/fileDrop';

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
 * naar de gewone openroute (`state/fileDrop.ts`).
 *
 * - Desktop: Tauri vangt het slepen zelf op (`dragDropEnabled: true` in `tauri.conf.json`) en geeft
 *   paden; de webview krijgt dan geen HTML5-drop. Daarom hier alleen `onDragDropEvent`.
 * - Browser: `dragover`/`drop` op `window`, alleen voor een sleep met bestanden (niet de kolomkoppen
 *   van de tabel, die hun eigen HTML5-sleep hebben). `preventDefault` is nodig: anders opent de
 *   browser het bestand zelf en verlaat hij de app.
 */
export function useFileDrop(): void {
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
          if (event.payload.type === 'drop') openDropped(droppedFilesFromPaths(event.payload.paths, { readTextFile, readFile }));
        });
        if (disposed) stop();
        else unlisten = stop;
      })();
      return () => {
        disposed = true;
        unlisten?.();
      };
    }

    const onDragOver = (event: DragEvent) => {
      if (!dragCarriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = isDocumentLeaveBlocked() ? 'none' : 'copy';
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer || !dragCarriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      // Synchroon: na dit event zijn de bestanden en de handles niet meer te vragen.
      openDropped(droppedFilesFromDataTransfer(event.dataTransfer));
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);
}
