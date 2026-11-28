import type { AppStoreContext } from '../appStore';
import { createSnapshot } from '../snapshot';

export interface BatchTransactions {
  withTransaction<T>(fn: () => T, label?: string): T;
}

export function createBatchTransactions(context: AppStoreContext): BatchTransactions {
  const { store, runtime } = context;

  return {
    withTransaction<T>(fn: () => T, label = 'Bulkbewerking'): T {
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
        runtime.exitBatch();
        if (runtime.takeDeferredViewRows()) store.getState().recomputeViewRows();
        store.setState((state) => {
          runtime.recordDocumentDataHistory(state, before, documentId, label);
        });
      }
      if (didThrow) throw thrown;
      return result;
    },
  };
}
