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

export async function bootstrapTaskGridPreferences(
  store: TaskGridBootstrapStore,
  dependencies: TaskGridBootstrapDependencies = {},
): Promise<TaskGridBootstrapOutcome> {
  const load = dependencies.load ?? loadTaskGridSettings;
  const save = dependencies.save ?? ((preferences: PersistedTaskGridPreferencesV1) => saveTaskGridPreferences(preferences, 'start'));
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
    await save(fallback);
    store.getState().hydrateTaskGridPreferences(fallback);
    return 'migrated';
  }

  store.getState().hydrateTaskGridPreferences(fallback, { autoWrite: false });
  return 'invalid-fallback';
}
