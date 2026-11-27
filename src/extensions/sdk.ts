import type { ExtensionCategory, ExtensionPermission } from './types';
import type {
  ExtProject,
  ExtCalendar,
  ExtTask,
  ExtTaskTime,
  ExtImportResult,
} from './extTypes';
import { HOST_EVENTS } from '@/services/extensionEvents';
import { KNOWN_PERMISSIONS } from './permissions';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { generateId } from '@/utils/id';
import { formatDate, parseDate, addBusinessDays, localTodayIso } from '@/utils/dateUtils';
import { toExtProject, toExtCalendar, toExtTask, toExtTaskTime, fromExtTaskInput } from './extMappers';
import { EXTENSION_API_VERSION } from './apiVersion';

const CATEGORIES: readonly ExtensionCategory[] = [
  'Import/Export',
  'Planning',
  'Reporting',
  'Utility',
  'Fonts',
  'Other',
];

const PERMISSIONS: readonly ExtensionPermission[] = KNOWN_PERMISSIONS;

export interface PlannerStudioSdk {
  readonly version: string;
  readonly apiVersion: string;
  readonly categories: readonly ExtensionCategory[];
  readonly permissions: readonly ExtensionPermission[];
  readonly hostEvents: typeof HOST_EVENTS;

  readonly utils: {
    generateId(prefix?: string): string;
    formatDate(date: Date): string;
    parseDate(iso: string): Date;
    addBusinessDays(date: Date, days: number): Date;
  };

  readonly factory: {
    createProject(overrides?: Partial<ExtProject>): ExtProject;
    createCalendar(): ExtCalendar;
    createTask(partial: Partial<ExtTask> & { name: string }): ExtTask;
    createTaskTime(start: string, durationDays: number): ExtTaskTime;
    emptyImportResult(overrides?: Partial<ExtImportResult>): ExtImportResult;
  };
}

function buildInternalTask(partial: Partial<Task> & { name: string }): Task {
  const start = partial.time?.scheduleStart ?? localTodayIso();
  return {
    id: partial.id ?? generateId('task'),
    name: partial.name,
    description: partial.description ?? '',
    wbsCode: partial.wbsCode ?? '',
    taskType: partial.taskType ?? 'CONSTRUCTION',
    customTaskTypeId: partial.customTaskTypeId,
    status: partial.status ?? 'NOT_STARTED',
    isMilestone: partial.isMilestone ?? false,
    priority: partial.priority ?? 0,
    parentId: partial.parentId ?? null,
    childIds: partial.childIds ?? [],
    isSummary: partial.isSummary,
    time: partial.time ?? createDefaultTaskTime(start, partial.isMilestone ? 0 : 5),
    resourceIds: partial.resourceIds ?? [],
    color: partial.color,
  };
}

function createExtTask(partial: Partial<ExtTask> & { name: string }): ExtTask {
  const custom = partial.customTaskType;
  const definition = custom?.id.trim() && custom.name?.trim()
    ? { id: custom.id.trim(), name: custom.name.trim() }
    : undefined;
  return toExtTask(buildInternalTask(fromExtTaskInput(partial)), definition);
}

function emptyImportResult(overrides?: Partial<ExtImportResult>): ExtImportResult {
  return {
    project: toExtProject(createDefaultProject()),
    calendar: toExtCalendar(createDefaultCalendar()),
    tasks: [],
    sequences: [],
    resources: [],
    assignments: [],
    ...overrides,
  };
}

let sdk: PlannerStudioSdk | null = null;

export function getExtensionSdk(): PlannerStudioSdk {
  if (sdk) return sdk;
  sdk = {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    apiVersion: EXTENSION_API_VERSION,
    categories: CATEGORIES,
    permissions: PERMISSIONS,
    hostEvents: HOST_EVENTS,
    utils: { generateId, formatDate, parseDate, addBusinessDays },
    factory: {
      createProject: (overrides) => ({ ...toExtProject(createDefaultProject()), ...overrides }),
      createCalendar: () => toExtCalendar(createDefaultCalendar()),
      createTask: createExtTask,
      createTaskTime: (start, durationDays) => toExtTaskTime(createDefaultTaskTime(start, durationDays)),
      emptyImportResult,
    },
  };
  return sdk;
}

export function installExtensionSdk(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>).__openPlannerStudioSdk = getExtensionSdk();
}
