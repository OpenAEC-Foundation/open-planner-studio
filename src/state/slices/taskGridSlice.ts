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
import type { ColumnConfig } from '@/types/view';

export interface PendingLegacyTaskGridColumns {
  projectId: string;
  columns: readonly ColumnConfig[];
}

export interface TaskGridSlice {
  /** App-globaal en gebruikersgebonden; nooit onderdeel van een documentpayload. */
  taskGridSurfaces: Record<TaskGridSurfaceId, TaskGridSurfacePreferences>;
  /** Eén gedeelde MRU voor de pluskiezer op beide taakgridoppervlakken. */
  recentTaskColumns: TaskColumnId[];
  hydrateTaskGridPreferences: (preferences: PersistedTaskGridPreferencesV1) => void;
  setTaskGridColumns: (surface: TaskGridSurfaceId, columns: readonly TaskGridColumnPreference[]) => void;
  setTaskGridScrollX: (surface: TaskGridSurfaceId, scrollX: number) => void;
  recordRecentTaskColumn: (id: TaskColumnId) => void;
  applyTaskGridLayoutColumns: (columns: readonly TaskGridColumnPreference[]) => void;
  /** Tijdelijke, store-lokale migratiebron. Staat bewust niet als dataveld in AppState. */
  stageLegacyTaskGridColumns: (projectId: string, columns: readonly ColumnConfig[] | undefined) => void;
  peekPendingLegacyTaskGridColumns: () => PendingLegacyTaskGridColumns | null;
}

function payloadFromState(state: Pick<TaskGridSlice, 'taskGridSurfaces' | 'recentTaskColumns'>): PersistedTaskGridPreferencesV1 {
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

export const createTaskGridSlice: AppSlice<TaskGridSlice> = (set, get) => {
  // Per store-instantie, buiten de serialiseerbare Zustand-state. `hydratePayload` kan hierdoor de
  // oude actieve `view.columns` veilig weg-normaliseren zonder de eenmalige migratiebron te verliezen.
  // Na een expliciete nieuwe voorkeur of een bootstrap-hydrate is de bron definitief irrelevant.
  let preferencesReady = false;
  let pendingLegacyColumns: PendingLegacyTaskGridColumns | null = null;

  const markPreferencesReady = () => {
    preferencesReady = true;
    pendingLegacyColumns = null;
  };

  return {
    taskGridSurfaces: initial.surfaces,
    recentTaskColumns: initial.recent,

    hydrateTaskGridPreferences: (preferences) => {
      const normalized = cloneTaskGridPreferences(preferences);
      markPreferencesReady();
      set((state) => {
        state.taskGridSurfaces = normalized.surfaces;
        state.recentTaskColumns = normalized.recent;
        // Een oude actieve documentpayload kan deze key runtime nog dragen. De migratie heeft hem
        // vóór deze call gelezen; vanaf hier mag hij niet opnieuw door capturePayload meereizen.
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
        persisted = payloadFromState(state);
      });
      if (persisted) void saveTaskGridPreferences(persisted);
    },

    setTaskGridScrollX: (surface, scrollX) => {
      const normalized = normalizeTaskGridScrollX(scrollX);
      if (normalized === null) return;
      markPreferencesReady();
      let persisted: PersistedTaskGridPreferencesV1 | null = null;
      set((state) => {
        state.taskGridSurfaces[surface].scrollX = normalized;
        persisted = payloadFromState(state);
      });
      if (persisted) void saveTaskGridPreferences(persisted);
    },

    recordRecentTaskColumn: (id) => {
      markPreferencesReady();
      let persisted: PersistedTaskGridPreferencesV1 | null = null;
      set((state) => {
        state.recentTaskColumns = recordRecentTaskColumnId(state.recentTaskColumns, id);
        persisted = payloadFromState(state);
      });
      if (persisted) void saveTaskGridPreferences(persisted);
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
