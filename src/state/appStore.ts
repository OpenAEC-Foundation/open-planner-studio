import { bindDefaultGridTransactionStore } from './gridTransaction';
import { mountedPendingTextEdits } from './pendingTextEdits';
import { createAppStoreContext } from './appStoreFactory';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';

export {
  createAppStoreContext, createAppStore,
  type AppState, type AppStore, type AppStoreContext, type ExportFormat,
} from './appStoreFactory';

const ifcSaveWorker = createIfcSaveWorker();

export const appStoreContext = createAppStoreContext({
  pendingTextEdits: mountedPendingTextEdits, ifcSaveCompute: ifcSaveWorker.compute, ifcxClassify: ifcSaveWorker.classifyIfcx,
});
export const useAppStore = appStoreContext.store;
bindDefaultGridTransactionStore(useAppStore.getState, useAppStore.setState);
