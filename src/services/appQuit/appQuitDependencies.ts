import type { AppStoreContext } from '@/state/appStore';
import type { AppQuitDependencies } from './appQuitController';
import { closeProjectFileWrites } from '@/services/fileAccess/writeCoordinator';
import { claimShutdown } from './shutdownPhase';

export function appQuitDependencies(
  context: AppStoreContext,
  edges: Pick<AppQuitDependencies, 'stopRecovery' | 'clearRecovery' | 'destroyWindow'>,
): AppQuitDependencies {
  const { store, runtime } = context;
  return {
    finishPendingInput: () => runtime.finishPendingTextEdits(),
    listDocuments: () => store.getState().getOpenDocumentPayloads()
      .map(({ id, payload }) => ({ id, isDirty: payload.isDirty })),
    getPendingCloseDocId: () => store.getState().ui.pendingCloseDocId,
    setPendingCloseDocId: (id) => store.getState().setUI({ pendingCloseDocId: id }),
    setQuitPending: (pending) => store.getState().setUI({ appQuitPending: pending }),
    waitForSaves: () => store.getState().waitForSavesBeforeClose(),
    claimShutdown: () => claimShutdown('quit'),
    closeWrites: async () => {
      store.getState().setUI({ appClosing: true });
      const reopen = await closeProjectFileWrites();
      return () => {
        reopen();
        store.getState().setUI({ appClosing: false });
      };
    },
    watchFailures: () => {
      const errors = () => store.getState().ui.notifications.filter((n) => n.severity === 'error');
      const seen = new Set(errors());
      return () => errors().some((n) => !seen.has(n));
    },
    ...edges,
  };
}
