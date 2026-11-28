import type { AppSlice } from './types';
import type {
  PersistedTaskGridPreferencesV1,
  TaskColumnId,
  TaskGridColumnPreference,
  TaskGridSurfaceId,
  TaskGridSurfacePreferences,
} from '@/types/taskGrid';
import {
  cloneTaskGridPreferences,
  createDefaultTaskGridPreferences,
  normalizeTaskGridColumnPreferences,
  normalizeTaskGridScrollX,
  recordRecentTaskColumnId,
  resolveLayoutColumnsForProject,
} from '@/engine/taskGrid/preferences';
import { saveTaskGridPreferences } from '@/utils/settingsStore';
import { siteHostSettingWriteHeld, type SettingWriteOrigin } from '@/services/fileAccess/siteHostSettings';
import type { ColumnConfig } from '@/types/view';
import { recordGridPreferenceHistoryDelta } from '../sessionHistory';

export interface PendingLegacyTaskGridColumns {
  projectId: string;
  columns: readonly ColumnConfig[];
}

export interface TaskGridSlice {
  taskGridSurfaces: Record<TaskGridSurfaceId, TaskGridSurfacePreferences>;
  recentTaskColumns: TaskColumnId[];
  taskGridAutoWriteAllowed: boolean;
  hydrateTaskGridPreferences: (
    preferences: PersistedTaskGridPreferencesV1,
    options?: { autoWrite?: boolean },
  ) => void;
  applyAutoFitTaskGridColumns: (surface: TaskGridSurfaceId, columns: readonly TaskGridColumnPreference[]) => void;
  setTaskGridColumns: (surface: TaskGridSurfaceId, columns: readonly TaskGridColumnPreference[]) => void;
  commitTaskGridColumns: (
    surface: TaskGridSurfaceId,
    label: string,
    columns: readonly TaskGridColumnPreference[],
  ) => void;
  setTaskGridScrollX: (surface: TaskGridSurfaceId, scrollX: number) => void;
  recordRecentTaskColumn: (id: TaskColumnId) => void;
  applyTaskGridLayoutColumns: (columns: readonly TaskGridColumnPreference[]) => void;
  stageLegacyTaskGridColumns: (projectId: string, columns: readonly ColumnConfig[] | undefined) => void;
  peekPendingLegacyTaskGridColumns: () => PendingLegacyTaskGridColumns | null;
}

export function persistedTaskGridPreferences(
  state: Pick<TaskGridSlice, 'taskGridSurfaces' | 'recentTaskColumns'>,
): PersistedTaskGridPreferencesV1 {
  return {
    version: 1,
    surfaces: {
      'gantt-task-grid': {
        columns: state.taskGridSurfaces['gantt-task-grid'].columns.map(column => ({ ...column })),
        scrollX: state.taskGridSurfaces['gantt-task-grid'].scrollX,
      },
      'full-task-grid': {
        columns: state.taskGridSurfaces['full-task-grid'].columns.map(column => ({ ...column })),
        scrollX: state.taskGridSurfaces['full-task-grid'].scrollX,
      },
    },
    recent: [...state.recentTaskColumns],
  };
}

const initial = createDefaultTaskGridPreferences({
  projectId: '', activityCodeTypeIds: [], customFieldDefIds: [],
});

const TASK_GRID_SCROLL_PERSIST_DELAY_MS = 120;

export const createTaskGridSlice: AppSlice<TaskGridSlice> = (set, get) => {
  let preferencesReady = false;
  let pendingLegacyColumns: PendingLegacyTaskGridColumns | null = null;
  let scrollPersistenceTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelScheduledScrollPersistence = () => {
    if (scrollPersistenceTimer === null) return;
    clearTimeout(scrollPersistenceTimer);
    scrollPersistenceTimer = null;
  };

  const persistImmediately = (
    preferences: PersistedTaskGridPreferencesV1,
    origin: SettingWriteOrigin = 'user',
  ) => {
    cancelScheduledScrollPersistence();
    void saveTaskGridPreferences(preferences, origin);
  };

  const scheduleScrollPersistence = () => {
    cancelScheduledScrollPersistence();
    scrollPersistenceTimer = setTimeout(() => {
      scrollPersistenceTimer = null;
      void saveTaskGridPreferences(persistedTaskGridPreferences(get()));
    }, TASK_GRID_SCROLL_PERSIST_DELAY_MS);
  };

  const markPreferencesReady = () => {
    preferencesReady = true;
    pendingLegacyColumns = null;
  };

  return {
    taskGridSurfaces: initial.surfaces,
    recentTaskColumns: initial.recent,
    taskGridAutoWriteAllowed: false,

    hydrateTaskGridPreferences: (preferences, options) => {
      const normalized = cloneTaskGridPreferences(preferences);
      cancelScheduledScrollPersistence();
      markPreferencesReady();
      set((state) => {
        state.taskGridAutoWriteAllowed = options?.autoWrite !== false;
        state.taskGridSurfaces = normalized.surfaces;
        state.recentTaskColumns = normalized.recent;
        delete (state.view as typeof state.view & { columns?: unknown }).columns;
      });
    },

    setTaskGridColumns: (surface, columns) => {
      const normalized = normalizeTaskGridColumnPreferences(columns);
      if (normalized === null) return;
      markPreferencesReady();
      let persisted: PersistedTaskGridPreferencesV1 | null = null;
      set((state) => {
        state.taskGridSurfaces[surface].columns = normalized;
        persisted = persistedTaskGridPreferences(state);
      });
      if (persisted) persistImmediately(persisted);
    },

    applyAutoFitTaskGridColumns: (surface, columns) => {
      if (!get().taskGridAutoWriteAllowed) return;
      if (siteHostSettingWriteHeld('ops-taskGridPreferences')) return;
      const normalized = normalizeTaskGridColumnPreferences(columns);
      if (normalized === null) return;
      let persisted: PersistedTaskGridPreferencesV1 | null = null;
      set((state) => {
        state.taskGridSurfaces[surface].columns = normalized;
        persisted = persistedTaskGridPreferences(state);
      });
      if (persisted) persistImmediately(persisted, 'start');
    },

    commitTaskGridColumns: (surface, label, columns) => {
      const normalized = normalizeTaskGridColumnPreferences(columns);
      if (normalized === null) return;
      let persisted: PersistedTaskGridPreferencesV1 | null = null;
      let recorded = false;
      set((state) => {
        const before = state.taskGridSurfaces[surface];
        const after: TaskGridSurfacePreferences = {
          columns: normalized.map(column => ({ ...column })),
          scrollX: before.scrollX,
        };
        recorded = recordGridPreferenceHistoryDelta(state, label, surface, before, after) !== null;
        if (!recorded) return;
        state.taskGridSurfaces[surface] = after;
        persisted = persistedTaskGridPreferences(state);
      });
      if (!recorded) return;
      markPreferencesReady();
      if (persisted) persistImmediately(persisted);
    },

    setTaskGridScrollX: (surface, scrollX) => {
      const normalized = normalizeTaskGridScrollX(scrollX);
      if (normalized === null) return;
      markPreferencesReady();
      set((state) => {
        state.taskGridSurfaces[surface].scrollX = normalized;
      });
      scheduleScrollPersistence();
    },

    recordRecentTaskColumn: (id) => {
      markPreferencesReady();
      let persisted: PersistedTaskGridPreferencesV1 | null = null;
      set((state) => {
        state.recentTaskColumns = recordRecentTaskColumnId(state.recentTaskColumns, id);
        persisted = persistedTaskGridPreferences(state);
      });
      if (persisted) persistImmediately(persisted);
    },

    applyTaskGridLayoutColumns: (columns) => {
      const state = get();
      const surface: TaskGridSurfaceId = state.ui.activeRibbonTab === 'table'
        ? 'full-task-grid'
        : 'gantt-task-grid';
      const resolved = resolveLayoutColumnsForProject(columns, {
        projectId: state.project.id,
        activityCodeTypeIds: state.activityCodeTypes.map(type => type.id),
        customFieldDefIds: state.customFieldDefs.map(def => def.id),
      });
      state.setTaskGridColumns(surface, resolved);
    },

    stageLegacyTaskGridColumns: (projectId, columns) => {
      if (preferencesReady) return;
      pendingLegacyColumns = columns === undefined ? null : { projectId, columns };
    },

    peekPendingLegacyTaskGridColumns: () => pendingLegacyColumns && ({
      projectId: pendingLegacyColumns.projectId,
      columns: pendingLegacyColumns.columns.map(column => ({
        ...column,
        field: { ...column.field },
      })),
    }),
  };
};
