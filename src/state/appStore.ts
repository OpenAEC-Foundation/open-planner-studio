// Compositie-root van de app: de ene gemounte appcontext. De fabriek zelf (slices samenstellen,
// `createAppStoreContext`) staat in `appStoreFactory.ts`, zodat headless code een eigen context kan
// bouwen zonder deze singleton te laden.
import { bindDefaultGridTransactionStore } from './gridTransaction';
import { mountedPendingTextEdits } from './pendingTextEdits';
import { createAppStoreContext } from './appStoreFactory';
import { createIfcSaveWorker, mergesInWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';

export {
  createAppStoreContext, createAppStore,
  type AppState, type AppStore, type AppStoreContext, type ExportFormat,
} from './appStoreFactory';

/** #804 stap 5: de ene opslagworker van de gemounte app. Hij start pas bij de eerste merge (een document met een
 *  gebouwmodel, flag aan) en blijft daarna voor de sessie; de opslagroutes krijgen alleen zijn berekenfunctie. */
const ifcSaveWorker = createIfcSaveWorker();

/** De gemounte productinterface blijft exact één appcontext gebruiken. */
export const appStoreContext = createAppStoreContext({
  pendingTextEdits: mountedPendingTextEdits, ifcSaveCompute: mergesInWorker(ifcSaveWorker.compute),
});
export const useAppStore = appStoreContext.store;
bindDefaultGridTransactionStore(useAppStore.getState, useAppStore.setState);
