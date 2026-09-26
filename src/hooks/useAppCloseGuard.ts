import { useEffect, type MutableRefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { clearRecovery } from '@/services/recovery/recoveryStore';
import { createAppQuitController } from '@/services/appQuit/appQuitController';

/**
 * Desktop-sluitbeveiliging (Tauri-only; de webbuild heeft `beforeunload` in `useAutoSave`).
 * Onderschept `CloseRequested` (titelbalkknop, Alt+F4, OS-menu) en laat `createAppQuitController`
 * de documenten met niet-opgeslagen wijzigingen langs de bestaande sluit-bevestiging lopen. Pas als
 * er niets meer openstaat worden de herstelsnapshots opgeruimd en gaat het venster echt dicht.
 * `autoSaveEnabled` is dezelfde poort als die van `useRecoveryRestore`/`useAutoSave`: dichtzetten
 * vóór het opruimen voorkomt dat een late crashherstel-schrijfactie de schone exit weer vervuilt.
 */
export function useAppCloseGuard(autoSaveEnabled: MutableRefObject<boolean>): void {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (disposed) return;
      const appWindow = getCurrentWindow();
      const controller = createAppQuitController({
        listDocuments: () => useAppStore.getState().getOpenDocumentPayloads()
          .map(({ id, payload }) => ({ id, isDirty: payload.isDirty })),
        getPendingCloseDocId: () => useAppStore.getState().ui.pendingCloseDocId,
        setPendingCloseDocId: (id) => useAppStore.getState().setUI({ pendingCloseDocId: id }),
        setQuitPending: (pending) => useAppStore.getState().setUI({ appQuitPending: pending }),
        stopRecovery: () => { autoSaveEnabled.current = false; },
        clearRecovery,
        destroyWindow: () => appWindow.destroy(),
      });
      unsubscribe = useAppStore.subscribe(() => { if (controller.active) controller.step(); });
      const stop = await appWindow.onCloseRequested((event) => {
        if (controller.requestQuit()) event.preventDefault();
      });
      if (disposed) stop();
      else unlisten = stop;
    })();

    return () => {
      disposed = true;
      unlisten?.();
      unsubscribe?.();
    };
  }, [autoSaveEnabled]);
}
