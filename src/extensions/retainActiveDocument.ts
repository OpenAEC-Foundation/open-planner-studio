import type { AppState, AppStore } from '@/state/appStore';
import { markDocumentEdited } from '@/state/documentEdited';
import type { ExtImportResult } from './extTypes';
import type { ImporterDefinition } from './types';
import type { ImportResult } from '@/services/importTypes';
import type { ProjectSchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import type { CustomTaskType } from '@/types/taskType';
import { withTaskTypeColors } from '@/services/taskTypes/customTaskTypeColors';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { COST_ASSIGNMENT_WORK_FIELDS, isCostResource, type ResourceAssignment } from '@/types/resource';
import { PUBLIC_SCHEDULING_OPTION_KEYS, fromExtImportResult } from './extMappers';
import { documentProjectCode } from '@/utils/documentProjectCode';

export const TASK_SOURCE_FIELDS = [
  'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow',
  'p6CompletePctType', 'p6ExpectedFinish', 'p6SuspendResume',
] as const satisfies readonly (keyof Task)[];
export const SEQUENCE_SOURCE_FIELDS = ['p6StartAtPredecessorFinishBoundary'] as const satisfies readonly (keyof Sequence)[];
export const CALENDAR_SOURCE_FIELDS = [
  'p6Source', 'p6NonWorkPenaltyDates', 'p6NonWorkPenaltyDatesState', 'generation', 'ifcTimePeriods',
] as const satisfies readonly (keyof WorkCalendar)[];
export const ASSIGNMENT_SOURCE_FIELDS = ['plannedUnitsPerDay'] as const satisfies readonly (keyof ResourceAssignment)[];

function withSourceFields<T extends { id: string }>(items: T[], own: readonly T[], fields: readonly (keyof T)[]): T[] {
  const byId = new Map(own.map((item) => [item.id, item]));
  return items.map((item) => {
    const source = byId.get(item.id);
    if (!source) return item;
    const extra: Partial<T> = {};
    for (const field of fields) if (source[field] !== undefined) extra[field] = source[field];
    return Object.keys(extra).length > 0 ? { ...item, ...extra } : item;
  });
}

function mergeCustomTaskTypes(
  fromExtension: readonly CustomTaskType[],
  own: readonly CustomTaskType[],
): CustomTaskType[] {
  const ids = new Set(fromExtension.map((t) => t.id.trim()));
  const names = new Set(fromExtension.map((t) => t.name.trim().toLocaleLowerCase()));
  const kept = own.filter((t) => !ids.has(t.id.trim()) && !names.has(t.name.trim().toLocaleLowerCase()));
  const ownColor = new Map(own.map((t) => [t.id.trim(), t.color]));
  return [
    ...withTaskTypeColors(fromExtension.map(({ id, name }) => ({ id, name, color: ownColor.get(id.trim()) })), kept),
    ...kept,
  ];
}

export type ActiveDocument = Pick<AppState,
  'project' | 'tasks' | 'sequences' | 'assignments' | 'customTaskTypes' | 'calendars' | 'baselines' | 'activeBaselineId' | 'activityCodeTypes' | 'customFieldDefs' | 'ifcGlobalIds'
  | 'ifcLiteralCalendarIds' | 'xerImportMetadata'>;

export function retainActiveDocument(loaded: ImportResult, active: ActiveDocument): ImportResult {

  const options: Record<string, unknown> = { ...active.project.schedulingOptions };
  for (const key of PUBLIC_SCHEDULING_OPTION_KEYS) delete options[key];
  Object.assign(options, loaded.project.schedulingOptions);
  const calendarId = loaded.project.calendarId === active.project.calendarId ? loaded.calendar.id : loaded.project.calendarId;
  const p6ProjectCode = documentProjectCode(active.project, active.xerImportMetadata);
  const project = {
    ...loaded.project,
    calendarId,
    schedulingProfile: active.project.schedulingProfile,
    schedulingOptions: Object.keys(options).length > 0 ? options as ProjectSchedulingOptions : undefined,
    ...(active.project.ifcSchema !== undefined ? { ifcSchema: active.project.ifcSchema } : {}),
    ...(active.project.ifcSchemaUnconfirmed !== undefined ? { ifcSchemaUnconfirmed: active.project.ifcSchemaUnconfirmed } : {}),
    ...(p6ProjectCode ? { p6ProjectCode } : {}),
    ...(active.project.dependentProjectsFolder ? { dependentProjectsFolder: active.project.dependentProjectsFolder } : {}),
    ...(active.project.anchorsFromOpenDocuments ? { anchorsFromOpenDocuments: true } : {}),
  };

  const [sent] = withSourceFields([loaded.calendar], active.calendars, CALENDAR_SOURCE_FIELDS);
  const own = active.calendars.some((c) => c.id === sent.id);
  const library = [...active.calendars.map((c) => (c.id === sent.id ? sent : c)), ...(own ? [] : [sent])];
  const calendar = library.find((c) => c.id === project.calendarId) ?? sent;
  const resourceCalendars = library.filter((c) => c.id !== calendar.id);

  return cleanDanglingReferences({
    ...loaded,
    project,
    tasks: withSourceFields(loaded.tasks, active.tasks, TASK_SOURCE_FIELDS),
    sequences: withSourceFields(loaded.sequences, active.sequences, SEQUENCE_SOURCE_FIELDS),
    assignments: withSourceFields(loaded.assignments, active.assignments, ASSIGNMENT_SOURCE_FIELDS),
    calendar,
    resourceCalendars,
    baselines: active.baselines,
    activeBaselineId: active.activeBaselineId,
    activityCodeTypes: active.activityCodeTypes,
    customFieldDefs: active.customFieldDefs,
    customTaskTypes: mergeCustomTaskTypes(loaded.customTaskTypes ?? [], active.customTaskTypes),
    ...(active.ifcGlobalIds ? { ifcGlobalIds: active.ifcGlobalIds } : {}),
    ...(active.ifcLiteralCalendarIds ? { ifcLiteralCalendarIds: active.ifcLiteralCalendarIds } : {}),
  });
}

export function cleanDanglingReferences(loaded: ImportResult): ImportResult {
  const calendarIds = new Set([loaded.calendar.id, ...(loaded.resourceCalendars ?? []).map((c) => c.id)]);
  const known = (id: string | undefined) => !id || calendarIds.has(id);
  return {
    ...loaded,
    resources: loaded.resources.map((r) => (known(r.calendarId) ? r : { ...r, calendarId: undefined })),
    tasks: loaded.tasks.map((t) => (known(t.calendarId) ? t : { ...t, calendarId: undefined })),
  };
}

function assertAssignmentsFitResources(loaded: ImportResult): void {
  const resourceById = new Map(loaded.resources.map((r) => [r.id, r] as const));
  for (const a of loaded.assignments) {
    const resource = resourceById.get(a.resourceId);
    if (!resource) continue;
    const where = `ExtImportResult.assignments['${a.id}']`;
    if (isCostResource(resource)) {
      const workField = COST_ASSIGNMENT_WORK_FIELDS.find((k) => a[k] !== undefined && !(k === 'curve' && a.curve === 'UNIFORM'));
      if (workField || a.unitsPerDay !== 1) {
        throw new Error(`${where}: kostenresource '${resource.id}' draagt geen ${workField ?? 'unitsPerDay ≠ 1'}`);
      }
    } else if (a.costAmount !== undefined) {
      throw new Error(`${where}: costAmount hoort alleen bij een kostenresource, niet bij '${resource.id}' (${resource.type})`);
    }
  }
}

export function loadExtensionProject(store: AppStore, result: ExtImportResult): void {
  const before = store.getState();
  const loaded = fromExtImportResult(result);
  assertAssignmentsFitResources(loaded);
  const sameProject = loaded.project.id === before.project.id;
  const autoSaveToFile = before.autoSaveToFile;
  before.loadState(sameProject ? retainActiveDocument(loaded, before) : loaded);
  store.getState().runCPM();
  store.setState((s) => {
    markDocumentEdited(s);
    if (sameProject) {
      s.autoSaveToFile = autoSaveToFile;
    } else {
      s.filePath = null;
      s.fileHandle = null;
      s.siteFileId = null;
      s.siteFileVersion = null;
    }
  });
}

export function openExtensionImport(store: AppStore, result: ExtImportResult, fileName: string): void {
  store.getState().openAsDocument(fromExtImportResult(result), { name: fileName, ref: null, saveTarget: false });
}

export async function importWithExtension(
  store: AppStore,
  importer: Pick<ImporterDefinition, 'name' | 'handler'>,
  file: File,
): Promise<boolean> {
  try {
    openExtensionImport(store, await importer.handler(file), file.name);
    return true;
  } catch (err) {
    console.error('[Extensies] Import mislukt:', err);
    store.getState().notify({
      severity: 'error',
      messageKey: 'notifications.extImportFailed',
      params: { name: importer.name },
      detail: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
