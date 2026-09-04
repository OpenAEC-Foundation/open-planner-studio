import type { AppState } from './appStore';
import type { ColumnConfig } from '@/types/view';
import type { PersistedTaskGridPreferencesV1 } from '@/types/taskGrid';
import type { TaskGridPreferencesLoadResult } from '@/utils/settingsStore';
import { saveTaskGridPreferences } from '@/utils/settingsStore';
import { loadTaskGridSettings } from '@/utils/settingsRegistry';
import {
  cloneTaskGridPreferences,
  createDefaultTaskGridPreferences,
  legacyDocumentColumnsToTaskGridPreferences,
} from '@/engine/taskGrid/preferences';

export interface TaskGridBootstrapStore {
  getState: () => AppState;
}

export interface TaskGridBootstrapDependencies {
  load?: (
    defaults: PersistedTaskGridPreferencesV1,
  ) => Promise<TaskGridPreferencesLoadResult>;
  save?: (preferences: PersistedTaskGridPreferencesV1) => Promise<void>;
}

export type TaskGridBootstrapOutcome = 'valid' | 'migrated' | 'invalid-fallback';

function sourceSnapshot(state: AppState): {
  defaults: PersistedTaskGridPreferencesV1;
  legacy: { projectId: string; columns: readonly ColumnConfig[] } | null;
} {
  const defaults = createDefaultTaskGridPreferences({
    projectId: state.project.id,
    activityCodeTypeIds: state.activityCodeTypes.map(type => type.id),
    customFieldDefIds: state.customFieldDefs.map(def => def.id),
  });
  const directLegacyColumns = (state.view as typeof state.view & {
    columns?: ColumnConfig[];
  }).columns;
  return {
    defaults,
    legacy: directLegacyColumns !== undefined
      ? { projectId: state.project.id, columns: directLegacyColumns }
      : state.peekPendingLegacyTaskGridColumns(),
  };
}

/**
 * De ene uitvoerbare bootstrapketen voor persoonlijke taakgridvoorkeuren. De React-hook roept deze
 * functie rechtstreeks aan; de headless regressietest dus ook — geen nagebouwde migratielogica.
 *
 * De loader krijgt eerst defaults uit één coherent snapshot. Blijkt daarna dat migratie/fallback
 * nodig is, dan wordt de bron opnieuw atomair gelezen; een kunstmatig trage loader plus een
 * documentwissel kan de legacykolommen zo nooit aan het inmiddels verkeerde actieve project binden.
 */
export async function bootstrapTaskGridPreferences(
  store: TaskGridBootstrapStore,
  dependencies: TaskGridBootstrapDependencies = {},
): Promise<TaskGridBootstrapOutcome> {
  const load = dependencies.load ?? loadTaskGridSettings;
  const save = dependencies.save ?? saveTaskGridPreferences;
  const result = await load(sourceSnapshot(store.getState()).defaults);
  if (result.status === 'valid') {
    store.getState().hydrateTaskGridPreferences(result.value);
    return 'valid';
  }

  const currentSource = sourceSnapshot(store.getState());
  const fallback = cloneTaskGridPreferences(currentSource.defaults);
  if (result.status === 'missing') {
    if (currentSource.legacy) {
      fallback.surfaces['full-task-grid'].columns =
        legacyDocumentColumnsToTaskGridPreferences(
          currentSource.legacy.columns, currentSource.legacy.projectId,
        );
    }
    // Als dit faalt, wordt hydrate niet bereikt en blijft de tijdelijke legacybron beschikbaar.
    await save(fallback);
    store.getState().hydrateTaskGridPreferences(fallback);
    return 'migrated';
  }

  // Een bestaande maar corrupte/nieuwere raw key heeft voorrang op oude documentkolommen. De raw
  // waarde blijft onaangeroerd; alleen de in-memory toestand valt veilig terug op defaults.
  store.getState().hydrateTaskGridPreferences(fallback);
  return 'invalid-fallback';
}
