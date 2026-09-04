import type { AppStoreContext } from '../appStore';
import { createSnapshot } from '../snapshot';

export interface BatchTransactions {
  withTransaction<T>(fn: () => T): T;
}

/** Bind de bestaande gedeeltelijk-committen batchsemantiek aan precies één storecontext. */
export function createBatchTransactions(context: AppStoreContext): BatchTransactions {
  const { store, runtime } = context;

  return {
    withTransaction<T>(fn: () => T): T {
      if (runtime.isBatchActive()) return fn();

      runtime.resetUndoCoalescing();
      const base = store.getState();
      const before = createSnapshot(base);
      const documentId = base.activeDocumentId;

      runtime.enterBatch();
      let result!: T;
      let thrown: unknown;
      let didThrow = false;
      try {
        result = fn();
      } catch (error) {
        didThrow = true;
        thrown = error;
      } finally {
        // Een callbackthrow behoudt de gedeeltelijke mutaties en de ene undo-stap, maar mag de
        // suppressie nooit laten hangen.
        runtime.exitBatch();
        store.setState((state) => {
          runtime.recordDocumentDataHistory(state, before, documentId, 'Bulkbewerking');
        });
      }
      if (didThrow) throw thrown;
      return result;
    },
  };
}
