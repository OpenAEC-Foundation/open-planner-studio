import { appStoreContext, type AppState, type AppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';

export interface TaskBulkActions {
  applyToTaskIds(
    ids: readonly string[],
    run: (state: AppState, id: string) => void,
  ): void;
  deleteTasksBulk(ids: readonly string[]): void;
  dissolveTasksBulk(ids: readonly string[]): void;
}

export function createTaskBulkActions(context: AppStoreContext): TaskBulkActions {
  const batch = createBatchTransactions(context);

  function applyToTaskIds(
    ids: readonly string[],
    run: (state: AppState, id: string) => void,
  ): void {
    if (ids.length === 0) return;
    const apply = (id: string) => run(context.store.getState(), id);
    if (ids.length === 1) {
      apply(ids[0]);
      return;
    }
    batch.withTransaction(() => {
      for (const id of ids) apply(id);
    });
  }

  function deleteTasksBulk(ids: readonly string[]): void {
    context.store.getState().deleteTasksBulk([...ids]);
  }

  function dissolveTasksBulk(ids: readonly string[]): void {
    context.store.getState().dissolveTasksBulk([...ids]);
  }

  return { applyToTaskIds, deleteTasksBulk, dissolveTasksBulk };
}

export const appTaskBulkActions = createTaskBulkActions(appStoreContext);
