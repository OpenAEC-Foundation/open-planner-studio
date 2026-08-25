import type { ColumnConfig, FieldRef } from '@/types/view';
import type {
  PersistedTaskGridPreferencesV1,
  TaskColumnId,
  TaskGridColumnPreference,
  TaskGridSurfaceId,
  TaskGridSurfacePreferences,
} from '@/types/taskGrid';
import {
  activityCodeColumnId,
  customFieldColumnId,
  decodeDynamicTaskColumnId,
  decodeTaskColumnIdSegment,
  encodeTaskColumnIdSegment,
  taskColumnId,
} from '@/engine/taskGrid/fieldIds';

export const TASK_GRID_COLUMN_MIN_WIDTH = 40;
/** Alleen een corruptiegrens. Auto-fit heeft later zijn eigen UX-grens van 480 px. */
export const TASK_GRID_COLUMN_MAX_WIDTH = 2000;
export const TASK_GRID_RECENT_LIMIT = 10;

export interface TaskGridProjectFields {
  projectId: string;
  activityCodeTypeIds: readonly string[];
  customFieldDefIds: readonly string[];
}

interface LegacyColumnLike {
  field: unknown;
  visible: boolean;
  width: number;
}

const BUILTIN_TO_COLUMN_ID = {
  wbsCode: 'task.wbsCode',
  name: 'task.name',
  duration: 'task.time.scheduleDuration',
  start: 'task.time.scheduleStart',
  finish: 'task.time.scheduleFinish',
  totalFloat: 'task.time.totalFloat',
  isCritical: 'task.time.isCritical',
  completion: 'task.time.completion',
  taskType: 'task.taskType',
  isMilestone: 'task.isMilestone',
  freeFloat: 'task.time.freeFloat',
  interferingFloat: 'task.time.interferingFloat',
  isNearCritical: 'task.time.isNearCritical',
  floatPath: 'task.time.floatPath',
} as const;

const COLUMN_ID_TO_BUILTIN = new Map<string, keyof typeof BUILTIN_TO_COLUMN_ID>(
  Object.entries(BUILTIN_TO_COLUMN_ID).map(([key, id]) => [id, key as keyof typeof BUILTIN_TO_COLUMN_ID]),
);

function column(id: string, width: number): TaskGridColumnPreference {
  return { id: taskColumnId(id), width, pinned: false };
}

function cloneSurface(surface: TaskGridSurfacePreferences): TaskGridSurfacePreferences {
  return { columns: surface.columns.map(item => ({ ...item })), scrollX: surface.scrollX };
}

export function cloneTaskGridPreferences(
  preferences: PersistedTaskGridPreferencesV1,
): PersistedTaskGridPreferencesV1 {
  return {
    version: 1,
    surfaces: {
      'gantt-task-grid': cloneSurface(preferences.surfaces['gantt-task-grid']),
      'full-task-grid': cloneSurface(preferences.surfaces['full-task-grid']),
    },
    recent: [...preferences.recent],
  };
}

export function createDefaultTaskGridPreferences(
  fields: TaskGridProjectFields,
): PersistedTaskGridPreferencesV1 {
  const fullColumns: TaskGridColumnPreference[] = [
    column('task.wbsCode', 60),
    column('task.name', 240),
    column('task.time.scheduleDuration', 60),
    column('task.time.scheduleStart', 100),
    column('task.time.scheduleFinish', 100),
    column('task.taskType', 80),
    column('task.time.isCritical', 50),
    column('task.time.totalFloat', 50),
    column('task.time.completion', 60),
  ];
  if (fields.projectId) {
    fullColumns.push(
      ...fields.activityCodeTypeIds.flatMap(id => {
        const columnId = safeActivityCodeColumnId(fields.projectId, id);
        return columnId ? [{ id: columnId, width: 90, pinned: false }] : [];
      }),
      ...fields.customFieldDefIds.flatMap(id => {
        const columnId = safeCustomFieldColumnId(fields.projectId, id);
        return columnId ? [{ id: columnId, width: 90, pinned: false }] : [];
      }),
    );
  }
  return {
    version: 1,
    surfaces: {
      'gantt-task-grid': {
        columns: [
          column('task.wbsCode', 60),
          column('task.name', 240),
          column('task.time.scheduleDuration', 60),
        ],
        scrollX: 0,
      },
      'full-task-grid': { columns: fullColumns, scrollX: 0 },
    },
    recent: [],
  };
}

function validTaskColumnId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x1F || code === 0x7F) return false;
  }
  return true;
}

export function normalizeTaskGridColumnPreferences(
  raw: unknown,
): TaskGridColumnPreference[] | null {
  if (!Array.isArray(raw)) return null;
  const result: TaskGridColumnPreference[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const candidate = item as Record<string, unknown>;
    if (!validTaskColumnId(candidate.id)
      || typeof candidate.width !== 'number'
      || !Number.isFinite(candidate.width)
      || typeof candidate.pinned !== 'boolean') return null;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    result.push({
      id: taskColumnId(candidate.id),
      width: Math.min(TASK_GRID_COLUMN_MAX_WIDTH,
        Math.max(TASK_GRID_COLUMN_MIN_WIDTH, Math.round(candidate.width))),
      pinned: candidate.pinned,
    });
  }
  return result;
}

export function normalizeTaskGridScrollX(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : null;
}

function normalizeSurface(raw: unknown, fallback: TaskGridSurfacePreferences): TaskGridSurfacePreferences {
  if (!raw || typeof raw !== 'object') return cloneSurface(fallback);
  const candidate = raw as Record<string, unknown>;
  const columns = normalizeTaskGridColumnPreferences(candidate.columns);
  const scrollX = normalizeTaskGridScrollX(candidate.scrollX);
  return columns === null || scrollX === null
    ? cloneSurface(fallback)
    : { columns, scrollX };
}

function normalizeRecent(raw: unknown): TaskColumnId[] {
  if (!Array.isArray(raw)) return [];
  const result: TaskColumnId[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (!validTaskColumnId(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(taskColumnId(id));
    if (result.length === TASK_GRID_RECENT_LIMIT) break;
  }
  return result;
}

export function normalizePersistedTaskGridPreferences(
  raw: unknown,
  defaults: PersistedTaskGridPreferencesV1,
): PersistedTaskGridPreferencesV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== 1 || !candidate.surfaces || typeof candidate.surfaces !== 'object') return null;
  const surfaces = candidate.surfaces as Record<string, unknown>;
  return {
    version: 1,
    surfaces: {
      'gantt-task-grid': normalizeSurface(
        surfaces['gantt-task-grid'], defaults.surfaces['gantt-task-grid'],
      ),
      'full-task-grid': normalizeSurface(
        surfaces['full-task-grid'], defaults.surfaces['full-task-grid'],
      ),
    },
    recent: normalizeRecent(candidate.recent),
  };
}

export function recordRecentTaskColumnId(
  recent: readonly TaskColumnId[],
  id: TaskColumnId,
): TaskColumnId[] {
  return [id, ...recent.filter(candidate => candidate !== id)].slice(0, TASK_GRID_RECENT_LIMIT);
}

export function visibleTaskGridColumns(
  surface: TaskGridSurfacePreferences,
  availableIds: ReadonlySet<TaskColumnId>,
): TaskGridColumnPreference[] {
  return surface.columns.filter(column => availableIds.has(column.id));
}

export function fieldRefToTaskColumnId(
  field: FieldRef,
  projectId: string,
): TaskColumnId | null {
  if (field.src === 'builtin') {
    const id = BUILTIN_TO_COLUMN_ID[field.key as keyof typeof BUILTIN_TO_COLUMN_ID];
    return id ? taskColumnId(id) : null;
  }
  if (field.src === 'resource') return taskColumnId('assignment.resources');
  if (!projectId) return null;
  return field.src === 'activityCode'
    ? safeActivityCodeColumnId(projectId, field.typeId)
    : safeCustomFieldColumnId(projectId, field.defId);
}

function safeActivityCodeColumnId(projectId: string, typeId: string): TaskColumnId | null {
  if (!projectId || !typeId) return null;
  try {
    return activityCodeColumnId(projectId, typeId);
  } catch {
    return null;
  }
}

function safeCustomFieldColumnId(projectId: string, defId: string): TaskColumnId | null {
  if (!projectId || !defId) return null;
  try {
    return customFieldColumnId(projectId, defId);
  } catch {
    return null;
  }
}

function isKnownFieldRef(field: unknown): field is FieldRef {
  if (!field || typeof field !== 'object') return false;
  const candidate = field as Record<string, unknown>;
  if (candidate.src === 'resource') return true;
  if (candidate.src === 'builtin') return typeof candidate.key === 'string' && candidate.key.length > 0;
  if (candidate.src === 'activityCode') return typeof candidate.typeId === 'string' && candidate.typeId.length > 0;
  if (candidate.src === 'customField') return typeof candidate.defId === 'string' && candidate.defId.length > 0;
  return false;
}

/** Canonieke JSON voor een onbekende oude FieldRef. Zo blijft de identiteit behouden zonder dat
 *  deze app hoeft te raden wat een toekomstige of extensie-eigen veldvorm betekent. */
function canonicalJson(value: unknown): string | null {
  const ancestors = new Set<object>();
  const normalize = (candidate: unknown): unknown => {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') return candidate;
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) throw new TypeError('niet-eindig getal');
      return candidate;
    }
    if (Array.isArray(candidate)) {
      if (ancestors.has(candidate)) throw new TypeError('cyclische waarde');
      ancestors.add(candidate);
      const result = candidate.map(normalize);
      ancestors.delete(candidate);
      return result;
    }
    if (!candidate || typeof candidate !== 'object') throw new TypeError('geen JSON-waarde');
    if (ancestors.has(candidate)) throw new TypeError('cyclische waarde');
    ancestors.add(candidate);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(candidate).sort()) {
      result[key] = normalize((candidate as Record<string, unknown>)[key]);
    }
    ancestors.delete(candidate);
    return result;
  };
  try {
    return JSON.stringify(normalize(value));
  } catch {
    return null;
  }
}

function unknownLegacyFieldColumnId(field: unknown): TaskColumnId | null {
  if (!field || typeof field !== 'object') return null;
  const src = (field as Record<string, unknown>).src;
  if (!validTaskColumnId(src)) return null;
  const canonical = canonicalJson(field);
  if (!canonical) return null;
  return taskColumnId(`legacy-field:${encodeTaskColumnIdSegment(canonical)}`);
}

function legacyOpaqueColumnId(field: unknown): TaskColumnId | null {
  if (isKnownFieldRef(field)) {
    if (field.src === 'activityCode') {
      try {
        return taskColumnId(`legacy-activity-code:${encodeTaskColumnIdSegment(field.typeId)}`);
      } catch {
        return unknownLegacyFieldColumnId(field);
      }
    }
    if (field.src === 'customField') {
      try {
        return taskColumnId(`legacy-custom-field:${encodeTaskColumnIdSegment(field.defId)}`);
      } catch {
        return unknownLegacyFieldColumnId(field);
      }
    }
    const knownId = fieldRefToTaskColumnId(field, '');
    return knownId ?? unknownLegacyFieldColumnId(field);
  }
  return unknownLegacyFieldColumnId(field);
}

function migrateLegacyColumns(
  columns: readonly LegacyColumnLike[],
  resolve: (field: unknown) => TaskColumnId | null,
): TaskGridColumnPreference[] {
  const result: TaskGridColumnPreference[] = [];
  const seen = new Set<string>();
  for (const legacy of columns) {
    if (!legacy || typeof legacy !== 'object'
      || legacy.visible !== true
      || typeof legacy.width !== 'number'
      || !Number.isFinite(legacy.width)) continue;
    const id = resolve(legacy.field);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      width: Math.min(TASK_GRID_COLUMN_MAX_WIDTH,
        Math.max(TASK_GRID_COLUMN_MIN_WIDTH, Math.round(legacy.width))),
      pinned: false,
    });
  }
  return result;
}

export function legacyDocumentColumnsToTaskGridPreferences(
  columns: readonly ColumnConfig[],
  projectId: string,
): TaskGridColumnPreference[] {
  return migrateLegacyColumns(columns, field => isKnownFieldRef(field)
    ? fieldRefToTaskColumnId(field, projectId)
    : null);
}

export function legacyLayoutColumnsToTaskGridPreferences(
  columns: readonly LegacyColumnLike[],
): TaskGridColumnPreference[] {
  return migrateLegacyColumns(columns, legacyOpaqueColumnId);
}

function decodeLegacyId(id: string, prefix: string): string | null {
  return id.startsWith(prefix) ? decodeTaskColumnIdSegment(id.slice(prefix.length)) : null;
}

export function resolveLayoutColumnsForProject(
  columns: readonly TaskGridColumnPreference[],
  fields: TaskGridProjectFields,
): TaskGridColumnPreference[] {
  const activityCodes = new Set(fields.activityCodeTypeIds);
  const customFields = new Set(fields.customFieldDefIds);
  return columns.map(columnPreference => {
    const activityCodeId = decodeLegacyId(columnPreference.id, 'legacy-activity-code:');
    if (activityCodeId !== null && activityCodes.has(activityCodeId)) {
      const resolved = safeActivityCodeColumnId(fields.projectId, activityCodeId);
      if (resolved) return { ...columnPreference, id: resolved };
    }
    const customFieldId = decodeLegacyId(columnPreference.id, 'legacy-custom-field:');
    if (customFieldId !== null && customFields.has(customFieldId)) {
      const resolved = safeCustomFieldColumnId(fields.projectId, customFieldId);
      if (resolved) return { ...columnPreference, id: resolved };
    }
    return { ...columnPreference };
  });
}

export function taskColumnIdToLegacyFieldRef(
  id: TaskColumnId,
  fields: TaskGridProjectFields,
): FieldRef | null {
  const builtin = COLUMN_ID_TO_BUILTIN.get(id);
  if (builtin) return { src: 'builtin', key: builtin };
  if (id === 'assignment.resources') return { src: 'resource' };
  const dynamic = decodeDynamicTaskColumnId(id);
  if (dynamic?.kind === 'activity-code'
    && dynamic.projectId === fields.projectId
    && fields.activityCodeTypeIds.includes(dynamic.typeId)) {
    return { src: 'activityCode', typeId: dynamic.typeId };
  }
  if (dynamic?.kind === 'custom-field'
    && dynamic.projectId === fields.projectId
    && fields.customFieldDefIds.includes(dynamic.defId)) {
    return { src: 'customField', defId: dynamic.defId };
  }
  return null;
}

export function taskGridSurfaceForRibbonTab(activeRibbonTab: string): TaskGridSurfaceId {
  return activeRibbonTab === 'table' ? 'full-task-grid' : 'gantt-task-grid';
}
