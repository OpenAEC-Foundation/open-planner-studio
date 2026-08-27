import type { AppStoreContext } from '../appStore';

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
      store.setState((state) => {
        runtime.pushUndoSnapshot(state, base);
        state.redoStack = [];
      });

      runtime.enterBatch();
      try {
        return fn();
      } finally {
        // Een callbackthrow behoudt de gedeeltelijke mutaties en de ene undo-stap, maar mag de
        // suppressie nooit laten hangen.
        runtime.exitBatch();
      }
    },
  };
}
