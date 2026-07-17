/**
 * Host-SDK die een extensie binnenkrijgt via `require('open-planner-studio')`.
 *
 * In tegenstelling tot de per-extensie `ExtensionApi` (die `onLoad(api)` ontvangt en
 * permissie-checks + opruimen per extensie regelt) is de SDK GLOBAAL en STATELOOS:
 * alleen constanten, versie-info en pure helpers om geldige domeinobjecten te bouwen.
 * Niets hier muteert de store of omzeilt permissies — mutaties lopen via `api.data.*`.
 */
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
import { formatDate, parseDate, addBusinessDays } from '@/utils/dateUtils';
import { toExtProject, toExtCalendar, toExtTask, toExtTaskTime, fromExtTaskInput } from './extMappers';

const CATEGORIES: readonly ExtensionCategory[] = [
  'Import/Export',
  'Planning',
  'Reporting',
  'Utility',
  'Other',
];

const PERMISSIONS: readonly ExtensionPermission[] = KNOWN_PERMISSIONS;

export interface PlannerStudioSdk {
  /** App-versie (calendar-versioning, bv. '2026.4.0'). Vergelijk met manifest.minAppVersion. */
  readonly version: string;
  /** Geldige manifest-categorieën. */
  readonly categories: readonly ExtensionCategory[];
  /** Geldige manifest-permissies. */
  readonly permissions: readonly ExtensionPermission[];
  /** Namen van host-lifecycle-events; abonneer via `api.events.on(naam, cb)`. */
  readonly hostEvents: typeof HOST_EVENTS;

  /** Stateloze helpers die de conventies van de app volgen. */
  readonly utils: {
    generateId(prefix?: string): string;
    formatDate(date: Date): string;
    parseDate(iso: string): Date;
    addBusinessDays(date: Date, days: number): Date;
  };

  /** Fabrieksfuncties die volledige, geldige EXT-facing objecten opleveren (Ext*-DTO's). */
  readonly factory: {
    createProject(overrides?: Partial<ExtProject>): ExtProject;
    createCalendar(): ExtCalendar;
    createTask(partial: Partial<ExtTask> & { name: string }): ExtTask;
    /** Bouw een TaskTime met een gegeven startdatum (ISO) en duur in werkdagen. */
    createTaskTime(start: string, durationDays: number): ExtTaskTime;
    /** Lege ExtImportResult als startpunt voor een importer-handler. */
    emptyImportResult(overrides?: Partial<ExtImportResult>): ExtImportResult;
  };
}

/** Bouw een volledige (interne) Task met dezelfde defaults als de store-actie addTask. */
function buildInternalTask(partial: Partial<Task> & { name: string }): Task {
  const start = partial.time?.scheduleStart ?? formatDate(new Date());
  return {
    id: partial.id ?? generateId('task'),
    name: partial.name,
    description: partial.description ?? '',
    wbsCode: partial.wbsCode ?? '',
    taskType: partial.taskType ?? 'CONSTRUCTION',
    status: partial.status ?? 'NOT_STARTED',
    isMilestone: partial.isMilestone ?? false,
    priority: partial.priority ?? 0,
    parentId: partial.parentId ?? null,
    childIds: partial.childIds ?? [],
    time: partial.time ?? createDefaultTaskTime(start, partial.isMilestone ? 0 : 5),
    resourceIds: partial.resourceIds ?? [],
    color: partial.color,
  };
}

/** Ext-facing createTask: bouw intern (defaults) en map naar het publieke contract. */
function createExtTask(partial: Partial<ExtTask> & { name: string }): ExtTask {
  return toExtTask(buildInternalTask(fromExtTaskInput(partial)));
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

/** Bouw (eenmalig) de SDK-singleton. */
export function getExtensionSdk(): PlannerStudioSdk {
  if (sdk) return sdk;
  sdk = {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
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

/** Hang de SDK op window zodat `require('open-planner-studio')` en devtools 'm vinden. */
export function installExtensionSdk(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>).__openPlannerStudioSdk = getExtensionSdk();
}
