import { normalizeRecordedTimes } from './minuteModelTransition';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import {
  applyRecordedTimesToTasks,
  captureRecordedDates,
  shiftedTaskIds,
  type RecordedDatesState,
  type RecordedTime,
} from '@/engine/scheduler/recordedDates';
import { computeViewRows, type ViewContext, type ViewRow, type ViewRowOpts } from '@/engine/view/visibleRows';
import { getNoneLabelValue, getResourceTypeLabelsValue } from '@/utils/noneLabel';
import type { Company, CompanyPool } from '@/types/library';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import {
  applyCalendarUpdate,
  applyResourceUpdate,
  classifyCalendarOnOpen,
  classifyResourceOnOpen,
} from '@/services/library';
import { markScheduleStale } from './transaction';
import type { DocumentPayload } from './documentContract';
import { isFreshImportOrigin } from './documentContract';
import { promoteProjectCalendarToLibrary, syncProjectCalendar } from './syncProjectCalendar';
import {
  NO_CALENDAR_LIBRARY_SETTLE, settleCalendarLibraryChangeOnPayload, type CalendarLibrarySettle,
} from './calendarTasks';

export type LibraryBoundaryMode = 'silent-switch' | 'open-boundary';

export interface BehindRefreshMaterialization {
  payload: DocumentPayload;
  calendarsChanged: number;
  resourcesChanged: number;
  workRuleSettle: CalendarLibrarySettle;
  invalidateRedoScope: boolean;
}

export interface LibraryBoundarySignals {
  refreshed: number;
  deviated: number;
  removed: number;
  showLibraryLinkDialog: boolean;
  libraryRefreshNotice: number | null;
}

export interface DocumentActivationMaterialization {
  payload: DocumentPayload;
  viewRows: readonly ViewRow[];
  resourceLoadResult: ResourceLoadResult | null;
  signals: LibraryBoundarySignals;
  workRuleSettle: CalendarLibrarySettle;
  invalidateRedoScope: boolean;
}

function activationPayload(payload: Readonly<DocumentPayload>): DocumentPayload {
  return {
    ...payload,
    calendars: [...payload.calendars],
    resources: [...payload.resources],
  };
}

const sameItems = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function keepUnchangedIdentity(payload: DocumentPayload, input: Readonly<DocumentPayload>): DocumentPayload {
  if (payload.calendars !== input.calendars && sameItems(payload.calendars, input.calendars)) payload.calendars = input.calendars;
  if (payload.resources !== input.resources && sameItems(payload.resources, input.resources)) payload.resources = input.resources;
  return payload;
}

function localPool(
  payload: Readonly<DocumentPayload>,
  companies: readonly Company[],
  pools: Readonly<Record<string, CompanyPool>>,
): CompanyPool | null {
  const companyId = payload.project.companyId;
  if (!companyId || !companies.some(company => company.id === companyId)) return null;
  return pools[companyId] ?? null;
}

export function materializeBehindOnlyRefresh(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
}): BehindRefreshMaterialization {
  const payload = activationPayload(input.payload);
  promoteProjectCalendarToLibrary(payload);
  syncProjectCalendar(payload);
  const pool = localPool(payload, input.companies, input.pools);
  if (!pool) {
    return {
      payload: keepUnchangedIdentity(payload, input.payload),
      calendarsChanged: 0, resourcesChanged: 0, workRuleSettle: NO_CALENDAR_LIBRARY_SETTLE, invalidateRedoScope: false,
    };
  }

  let resourcesChanged = 0;
  const resources = payload.resources.map(resource => {
    if (resource.libraryOrigin?.companyId !== pool.companyId) return resource;
    if (classifyResourceOnOpen(resource, pool) !== 'behind') return resource;
    resourcesChanged++;
    return applyResourceUpdate(resource, pool, payload.assignments);
  });
  if (resourcesChanged > 0) payload.resources = resources;

  let calendarsChanged = 0;
  let workRuleSettle = NO_CALENDAR_LIBRARY_SETTLE;
  const calendars = payload.calendars.map(calendar => {
    if (calendar.libraryOrigin?.companyId !== pool.companyId) return calendar;
    if (classifyCalendarOnOpen(calendar, pool) !== 'behind') return calendar;
    calendarsChanged++;
    return applyCalendarUpdate(calendar, pool);
  });
  if (calendarsChanged > 0) {
    const previous = { calendars: payload.calendars, calendar: payload.calendar, project: payload.project, resources: payload.resources };
    payload.calendars = calendars;
    syncProjectCalendar(payload);
    workRuleSettle = settleCalendarLibraryChangeOnPayload(payload, previous);
    markScheduleStale(payload);
    payload.recordedDates = recountShiftedAfterLibraryRefresh(payload);
  }

  return {
    payload: keepUnchangedIdentity(payload, input.payload),
    calendarsChanged,
    resourcesChanged,
    workRuleSettle,
    invalidateRedoScope: calendarsChanged + resourcesChanged > 0,
  };
}

export function recountShiftedAfterLibraryRefresh(
  doc: Readonly<Pick<DocumentPayload, 'project' | 'tasks' | 'sequences' | 'calendar' | 'calendars' | 'recordedDates'>>,
): RecordedDatesState | null {
  const recorded = doc.recordedDates;
  if (!recorded) return null;
  const tasks = cloneTasksForSolve(doc.tasks);
  const result = solveProject(solveInputFor(doc.project, tasks, doc.sequences, doc.calendar, doc.calendars));
  const next: RecordedDatesState = { ...recorded };
  if (result.error) {
    delete next.shifted;
    delete next.shiftedTaskIds;
  } else {
    const ids = shiftedTaskIds(tasks, recorded.times);
    next.shifted = ids.length;
    next.shiftedTaskIds = ids;
  }
  return next;
}

function countOpenBoundarySignals(
  payload: Readonly<DocumentPayload>,
  pool: CompanyPool | null,
): { deviated: number; removed: number } {
  if (!pool) return { deviated: 0, removed: 0 };
  let deviated = 0;
  let removed = 0;
  for (const resource of payload.resources) {
    if (resource.libraryOrigin?.companyId !== pool.companyId) continue;
    const status = classifyResourceOnOpen(resource, pool);
    if (status === 'deviated') deviated++;
    else if (status === 'removed') removed++;
  }
  for (const calendar of payload.calendars) {
    if (calendar.libraryOrigin?.companyId !== pool.companyId) continue;
    const status = classifyCalendarOnOpen(calendar, pool);
    if (status === 'deviated') deviated++;
    else if (status === 'removed') removed++;
  }
  return { deviated, removed };
}

function derivePayloadViewRows(payload: Readonly<DocumentPayload>): ViewRow[] {
  const opts: ViewRowOpts = {
    filter: payload.view.filter ?? null,
    group: payload.view.group ?? [],
    sort: payload.view.sort ?? [],
    collapsedTaskIds: new Set(payload.collapsedTaskIds),
    collapsedGroupKeys: new Set(payload.view.collapsedGroupKeys ?? []),
  };
  const ctx: ViewContext = {
    activityCodeTypes: payload.activityCodeTypes,
    customFieldDefs: payload.customFieldDefs,
    resources: payload.resources,
    assignments: payload.assignments,
    noneLabel: getNoneLabelValue(),
    resourceTypeLabels: getResourceTypeLabelsValue(),
  };
  return computeViewRows(payload.tasks, opts, ctx);
}

export function materializeLibraryBoundary(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
  mode: LibraryBoundaryMode;
}): DocumentActivationMaterialization {
  const pool = localPool(input.payload, input.companies, input.pools);
  const classified = input.mode === 'open-boundary'
    ? countOpenBoundarySignals(input.payload, pool)
    : { deviated: 0, removed: 0 };
  const refreshed = materializeBehindOnlyRefresh(input);
  const refreshedCount = refreshed.calendarsChanged + refreshed.resourcesChanged;
  const resourceLoadResult = computeReliableResourceLoad(
    refreshed.payload.cpmResult,
    refreshed.payload.resources,
    refreshed.payload.assignments,
    refreshed.payload.tasks,
    refreshed.payload.calendar,
    refreshed.payload.calendars,
    effectiveSchedulingOptions(refreshed.payload.project),
  );
  refreshed.payload.resourceLoadResult = resourceLoadResult;
  return {
    payload: refreshed.payload,
    viewRows: derivePayloadViewRows(refreshed.payload),
    resourceLoadResult,
    signals: {
      refreshed: refreshedCount,
      deviated: classified.deviated,
      removed: classified.removed,
      showLibraryLinkDialog: input.mode === 'open-boundary' && classified.deviated > 0,
      libraryRefreshNotice: refreshedCount > 0 ? refreshedCount : null,
    },
    workRuleSettle: refreshed.workRuleSettle,
    invalidateRedoScope: refreshed.invalidateRedoScope,
  };
}

export function prepareLoadedPayload(
  input: Readonly<DocumentPayload>,
  options: { recompute: boolean },
): DocumentPayload {
  const payload = activationPayload(input);
  promoteProjectCalendarToLibrary(payload);
  syncProjectCalendar(payload);
  if (!options.recompute || payload.cpmResult !== null) return payload;

  const originalTasks = payload.tasks;
  payload.tasks = cloneTasksForSolve(originalTasks);
  payload.cpmResult = solveProject(
    solveInputFor(payload.project, payload.tasks, payload.sequences, payload.calendar, payload.calendars), originalTasks);
  payload.scheduleStale = false;
  return payload;
}

type RecordedSourceInput = Pick<ImportResult, 'recordedFields' | 'recordedTimes' | 'recordedTimesOrigin' | 'recordedSourceFormat'>;

export function recordedDatesSource(
  parsed: Pick<ImportResult, 'recordedTimesOrigin' | 'recordedSourceFormat'>,
): { sourceFormat: NonNullable<RecordedDatesState['sourceFormat']>; scheduleLayer: boolean } | undefined {
  switch (parsed.recordedTimesOrigin) {
    case 'xer': case 'p6xml': case 'mspdi': case 'mpp':
      return { sourceFormat: parsed.recordedTimesOrigin, scheduleLayer: true };
    case 'xer-archive':
      return { sourceFormat: 'xer', scheduleLayer: true };
    case 'ifc':
      return { sourceFormat: 'ifc', scheduleLayer: false };
    case 'ifc-own':
      return parsed.recordedSourceFormat ? { sourceFormat: parsed.recordedSourceFormat, scheduleLayer: false } : undefined;
    default:
      return undefined;
  }
}

function captureAllowed(tasks: Task[], parsed: RecordedSourceInput, payload: Pick<DocumentPayload, 'calendar' | 'calendars'>,
  restoredMode = false) {
  const source = recordedDatesSource(parsed) ?? (restoredMode && parsed.recordedTimesOrigin === 'ifc-own'
    ? { sourceFormat: undefined, scheduleLayer: false } : undefined);
  if (!source) return undefined;
  const recorded = normalizeRecordedTimes({ ...payload, tasks }, captureRecordedDates(tasks, parsed.recordedFields, parsed.recordedTimes, { scheduleLayer: source.scheduleLayer }));
  return recorded.total > 0 ? { recorded, sourceFormat: source.sourceFormat } : undefined;
}

export function applyRecordedDatesOnLoad(
  rawTasks: Task[],
  prepared: DocumentPayload,
  parsed: RecordedSourceInput,
  restoredMode?: boolean,
): void {
  const allowed = captureAllowed(rawTasks, parsed, prepared, restoredMode);
  if (!allowed) return;
  const { recorded, sourceFormat } = allowed;
  const shiftedIds = shiftedTaskIds(prepared.tasks, recorded.times);
  const origin = parsed.recordedTimesOrigin;
  const autoEnter = shiftedIds.length > 0 && (
    isFreshImportOrigin(origin)
    || ((origin === 'ifc-own' || origin === 'xer-archive')
      && (prepared.importPristine === true || parsed.recordedSourceFormat !== undefined))
  );
  if (!(restoredMode ?? autoEnter)) return;
  prepared.recordedDates = {
    ...recorded, shifted: shiftedIds.length, shiftedTaskIds: shiftedIds, origin: parsed.recordedTimesOrigin, sourceFormat,
  };
  enterRecordedDatesMode(prepared, recorded.times);
  if (sourceFormat !== undefined) prepared.minuteModelPending = false;
}

function enterRecordedDatesMode(payload: DocumentPayload, times: Record<string, RecordedTime>): void {
  payload.cpmResult = applyRecordedTimesToTasks(payload.tasks, times, payload.calendar, payload.calendars);
  payload.datesAsRecorded = true;
  payload.scheduleStale = false;
}

export function applyRestoredRecordedMode(
  payload: DocumentPayload,
  parsed: RecordedSourceInput,
): void {
  const allowed = captureAllowed(payload.tasks, parsed, payload, true);
  if (!allowed) return;
  const { recorded, sourceFormat } = allowed;
  payload.recordedDates = { ...recorded, origin: parsed.recordedTimesOrigin, sourceFormat };
  for (const task of payload.tasks) {
    if (recorded.times[task.id]) continue;
    const present = parsed.recordedFields?.[task.id];
    if (!present || present.includes('earlyStart') || present.includes('earlyFinish')) continue;
    task.time.earlyStart = task.time.scheduleStart;
    task.time.earlyFinish = task.time.scheduleFinish;
    task.time.lateStart = task.time.scheduleStart;
    task.time.lateFinish = task.time.scheduleFinish;
  }
  enterRecordedDatesMode(payload, recorded.times);
  if (sourceFormat !== undefined) payload.minuteModelPending = false;
}
