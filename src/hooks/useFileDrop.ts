import { useEffect, useState } from 'react';
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { isDocumentLeaveBlocked } from '@/hooks/keyboard/shortcutRegistry';
import {
  dragCarriesFiles, droppedFilesFromDataTransfer, droppedFilesFromPaths, type DroppedFile,
} from '@/services/fileAccess/fileDrop';
import { tauriOpenIO } from '@/services/fileAccess/tauriOpenPath';
import { readOptionsFor, type FormatReadOptions } from '@/services/formatRegistry';
import { openDroppedFiles } from '@/state/fileDrop';

const dropReadOptions = () => readOptionsFor(useAppStore.getState().ui.featureFlags);

export const FILE_DRAG_IDLE_MS = 1500;

function openDropped(files: DroppedFile[], readOptions: FormatReadOptions): void {
  void openDroppedFiles(
    useAppStore, files, buildImportLabels((key) => i18n.t(key, { ns: 'common' })), isDocumentLeaveBlocked, { readOptions },
  );
}

export function useFileDrop(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      let disposed = false;
      let unlisten: (() => void) | null = null;
      void (async () => {
        const [{ getCurrentWebview }, io] = await Promise.all([import('@tauri-apps/api/webview'), tauriOpenIO()]);
        if (disposed) return;
        const stop = await getCurrentWebview().onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === 'enter') {
            setActive(payload.paths.length > 0 && !isDocumentLeaveBlocked());
          } else if (payload.type === 'leave') {
            setActive(false);
          } else if (payload.type === 'drop') {
            setActive(false);
            const readOptions = dropReadOptions();
            openDropped(droppedFilesFromPaths(payload.paths, io, readOptions), readOptions);
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
      const readOptions = dropReadOptions();
      openDropped(droppedFilesFromDataTransfer(event.dataTransfer, readOptions), readOptions);
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
