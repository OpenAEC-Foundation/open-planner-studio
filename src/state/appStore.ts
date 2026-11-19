// Compositie-root van de app: de ene gemounte appcontext. De fabriek zelf (slices samenstellen,
// `createAppStoreContext`) staat in `appStoreFactory.ts`, zodat headless code een eigen context kan
// bouwen zonder deze singleton te laden.
import { bindDefaultGridTransactionStore } from './gridTransaction';
import { mountedPendingTextEdits } from './pendingTextEdits';
import { createAppStoreContext } from './appStoreFactory';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';

export {
  createAppStoreContext, createAppStore,
  type AppState, type AppStore, type AppStoreContext, type ExportFormat,
} from './appStoreFactory';

/** #804 stap 5 en 6: de ene opslagworker van de gemounte app. Hij start bij de eerste IFC-opslag of -export van een
 *  document (de gewone writer of de merge) en blijft daarna voor de sessie; de opslagroutes krijgen alleen zijn
 *  berekenfunctie. Automatisch opslaan rekent er ook mee (`useAutoSave.ts`). */
const ifcSaveWorker = createIfcSaveWorker();

/** De gemounte productinterface blijft exact één appcontext gebruiken. */
export const appStoreContext = createAppStoreContext({
  pendingTextEdits: mountedPendingTextEdits, ifcSaveCompute: ifcSaveWorker.compute,
});
export const useAppStore = appStoreContext.store;
bindDefaultGridTransactionStore(useAppStore.getState, useAppStore.setState);
