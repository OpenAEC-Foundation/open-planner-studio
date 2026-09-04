import { appStoreContext, type AppState, type AppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';

/**
 * Bulk-acties over een lijst taak-ids als ÉÉN ongedaan-maakbare stap (issue #45, en de
 * gelijktrekking van lintknop/Delete/Backspace daarna).
 *
 * Bewust in `src/state/` en niet in de component-boom (naar het model van `relationActions.ts` en
 * `taskInsertActions.ts`): het contextmenu (`components/canvas/contextMenuScope.ts`), de lintknop
 * Verwijderen (`ribbonConfig.tsx`) én de Delete/Backspace-sneltoetsen (`shortcutRegistry.ts`)
 * draaien zo letterlijk dezelfde app-adapter. De kernfactory blijft tegelijk bruikbaar voor een
 * expliciete documentcontext zonder diens undo-metadata met de app-singleton te vermengen.
 */

export interface TaskBulkActions {
  applyToTaskIds(
    ids: readonly string[],
    run: (state: AppState, id: string) => void,
  ): void;
  deleteTasksBulk(ids: readonly string[]): void;
}

/** Bind taakbulkmutaties en hun batchruntime aan precies één storecontext. */
export function createTaskBulkActions(context: AppStoreContext): TaskBulkActions {
  const batch = createBatchTransactions(context);

  /**
   * Voer een per-taak-mutator uit over de hele lijst als ÉÉN ongedaan-maakbare stap.
   *
   * `run` ontvangt de actuele state van de gebonden context. Daarmee hoeft de callback geen store
   * te importeren en kan de factory niet stil de suppressie-/undometadata van een andere context
   * kiezen. Bij één taak wordt de mutator rechtstreeks aangeroepen: de onderliggende actie bewaart
   * dan haar bestaande no-op-guard en maakt geen lege undo-stap.
   */
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

  /**
   * Verwijder een lijst taken als één undo-stap. `deleteTask` verwijdert ook de hele subboom en
   * bijbehorende relaties/toewijzingen. De vaste id-kopie voorkomt dat selectiemutaties de lus
   * tijdens de handeling veranderen; een kind dat al met zijn ouder verdween is daarna een no-op.
   */
  function deleteTasksBulk(ids: readonly string[]): void {
    context.store.getState().deleteTasksBulk([...ids]);
  }

  return { applyToTaskIds, deleteTasksBulk };
}

/** Expliciete compatibiliteitsadapter voor de ene gemounte productinterface. */
export const appTaskBulkActions = createTaskBulkActions(appStoreContext);
