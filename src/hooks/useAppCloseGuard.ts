import { useEffect, type MutableRefObject } from 'react';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { clearOwnRecovery } from '@/services/recovery/recoveryStore';
import { createAppQuitController } from '@/services/appQuit/appQuitController';
import { appQuitDependencies } from '@/services/appQuit/appQuitDependencies';
import { getMcpDiscoveryWriter } from '@/services/mcp/discoveryFiles';

/**
 * Desktop-sluitbeveiliging (Tauri-only; de webbuild heeft `beforeunload` in `useAutoSave`).
 * Onderschept `CloseRequested` (titelbalkknop, Alt+F4, OS-menu) en laat `createAppQuitController`
 * de documenten met niet-opgeslagen wijzigingen langs de bestaande sluit-bevestiging lopen. Pas als
 * er niets meer openstaat worden de eigen herstelsnapshots opgeruimd en gaat het venster echt dicht.
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
      const controller = createAppQuitController(appQuitDependencies(appStoreContext, {
        stopRecovery: () => { autoSaveEnabled.current = false; },
        // Alleen de eigen snapshots: wat de gebruiker in het herstelvenster uitstelde, of dat nog
        // niet eens is aangeboden, blijft voor de volgende start staan.
        clearRecovery: clearOwnRecovery,
        destroyWindow: async () => {
          // Ontdekkingsbestanden voor de MCP-plugin weghalen (best effort; de writer vangt zijn
          // eigen fouten). Na een crash herkent de plugin een achtergebleven bestand aan het pid.
          // Hoogstens 1,5 s: het sluiten mag nooit op een hangende schrijfactie wachten.
          const shutdown = getMcpDiscoveryWriter()?.shutdown();
          if (shutdown) await Promise.race([shutdown, new Promise((resolve) => { setTimeout(resolve, 1500); })]);
          await appWindow.destroy();
        },
      }));
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
