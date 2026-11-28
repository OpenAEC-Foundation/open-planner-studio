import { useEffect, type MutableRefObject } from 'react';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { clearOwnRecovery } from '@/services/recovery/recoveryStore';
import { clearRecoveryNow } from '@/services/recovery/recoveryFlush';
import { createAppQuitController } from '@/services/appQuit/appQuitController';
import { appQuitDependencies } from '@/services/appQuit/appQuitDependencies';
import { getMcpDiscoveryWriter } from '@/services/mcp/discoveryFiles';

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
        stopRecovery: () => {
          const before = autoSaveEnabled.current;
          autoSaveEnabled.current = false;
          return () => { autoSaveEnabled.current = before; };
        },
        clearRecovery: () => clearRecoveryNow() ?? clearOwnRecovery(),
        destroyWindow: async () => {
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
