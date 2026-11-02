import { useEffect, useRef, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { linuxEnvironment } from '@/utils/linuxEnvironment';
import { readOpenedTauriPath } from '@/services/fileAccess/tauriBackend';
import { binaryExtensions } from '@/services/formatRegistry';
import { buildImportLabels } from '@/i18n/importLabels';
import { flushRecoveryNow } from '@/services/recovery/recoveryFlush';
import { createManagedShutdown } from '@/services/appQuit/managedShutdown';
import { stopMcpServer } from '@/services/mcp/server';

export function useLinuxEnvironment(ready: boolean, autoSaveEnabled: MutableRefObject<boolean>): void {
  const { t } = useTranslation('common');
  const opened = useRef(false);
  useEffect(() => {
    const path = linuxEnvironment()?.initialFile;
    if (!ready || opened.current || !path) return;
    opened.current = true;
    void (async () => {
      try {
        const io = await import('@tauri-apps/plugin-fs');
        const file = await readOpenedTauriPath(path, { binaryExtensions: binaryExtensions() }, io);
        await useAppStore.getState().openOpenedFile(file, buildImportLabels(t));
      } catch (error) {
        useAppStore.getState().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: String(error) });
      }
    })();
  }, [ready, t]);

  useEffect(() => {
    if (!linuxEnvironment()?.managed) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void (async () => {
      const { listen, emit } = await import('@tauri-apps/api/event');
      if (disposed) return;
      const shutdown = createManagedShutdown({
        finishInput: async () => {
          await stopMcpServer();
          appStoreContext.runtime.finishPendingTextEdits();
        },
        freeze: () => {
          document.body.inert = true;
          useAppStore.getState().setUI({ aiPaused: true, appQuitPending: true });
        },
        flush: async () => {
          const dirty = useAppStore.getState().getOpenDocumentPayloads().some(d => d.payload.isDirty);
          if (dirty && !autoSaveEnabled.current) throw new Error('Herstelkeuze nog niet afgehandeld');
          await flushRecoveryNow();
        },
        confirm: () => emit('openaec://shutdown-complete'),
      });
      const unlisten = await listen('openaec://shutdown', () => {
        void shutdown().catch(error => console.error('OpenAEC Linux: herstelopslag bij afsluiten mislukt:', error));
      });
      if (disposed) unlisten();
      else stop = unlisten;
    })();
    return () => { disposed = true; stop?.(); };
  }, [autoSaveEnabled]);
}
