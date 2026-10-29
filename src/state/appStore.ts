// Compositie-root van de app: de ene gemounte appcontext. De fabriek zelf (slices samenstellen,
// `createAppStoreContext`) staat in `appStoreFactory.ts`, zodat headless code een eigen context kan
// bouwen zonder deze singleton te laden.
import { bindDefaultGridTransactionStore } from './gridTransaction';
import { mountedPendingTextEdits } from './pendingTextEdits';
import { createAppStoreContext } from './appStoreFactory';

export {
  createAppStoreContext, createAppStore,
  type AppState, type AppStore, type AppStoreContext, type ExportFormat,
} from './appStoreFactory';

/** De gemounte productinterface blijft exact één appcontext gebruiken. */
export const appStoreContext = createAppStoreContext({ pendingTextEdits: mountedPendingTextEdits });
export const useAppStore = appStoreContext.store;
bindDefaultGridTransactionStore(useAppStore.getState, useAppStore.setState);
