import type { AppStoreContext } from '@/state/appStore';
import type { AppQuitDependencies } from './appQuitController';

/**
 * De randen van `createAppQuitController` voor één storecontext. Los van `useAppCloseGuard`, zodat
 * de echte route (open invoer afronden → dirty-controle → sluitvraag) headless te toetsen is
 * (`tests/planning/check-app-quit.ts`); de hook voegt alleen het Tauri-venster toe.
 */
export function appQuitDependencies(
  context: AppStoreContext,
  edges: Pick<AppQuitDependencies, 'stopRecovery' | 'clearRecovery' | 'destroyWindow'>,
): AppQuitDependencies {
  const { store, runtime } = context;
  return {
    // Open veldinvoer zonder blur eerst afronden (review #401): anders ziet de dirty-controle hem
    // niet en gaat hij zonder sluitvraag verloren.
    finishPendingInput: () => runtime.finishPendingTextEdits(),
    listDocuments: () => store.getState().getOpenDocumentPayloads()
      .map(({ id, payload }) => ({ id, isDirty: payload.isDirty })),
    getPendingCloseDocId: () => store.getState().ui.pendingCloseDocId,
    setPendingCloseDocId: (id) => store.getState().setUI({ pendingCloseDocId: id }),
    setQuitPending: (pending) => store.getState().setUI({ appQuitPending: pending }),
    waitForSaves: () => store.getState().waitForSavesBeforeClose(),
    // Elke mislukte of geweigerde opslag meldt zich rood. Een nieuwe melding is een nieuw object, en een samengevouwen
    // herhaling ("×2") vervangt het object van de bestaande (Immer); beide tellen dus als nieuw.
    watchFailures: () => {
      const errors = () => store.getState().ui.notifications.filter((n) => n.severity === 'error');
      const seen = new Set(errors());
      return () => errors().some((n) => !seen.has(n));
    },
    ...edges,
  };
}
