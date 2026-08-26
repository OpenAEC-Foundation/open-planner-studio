import { produce } from 'immer';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { deriveViewRows } from './slices/viewSlice';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import { buildTaskColumnRegistry, canonicalGridJson } from '@/engine/taskGrid/taskColumnRegistry';
import { planTaskCellEdit } from '@/engine/taskGrid/taskEditPlan';
import { isHourCalendar } from '@/services/subdayIo';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { createSnapshot, restoreSnapshot, type Snapshot } from './snapshot';
import { recordDocumentDataHistoryDelta } from './sessionHistory';
import { notifyTimephasedLoss } from './timephasedLossNotice';
import { markScheduleStale } from './transaction';
import type { AppState } from './appStore';
import type { AppSlice, DeferredNotification } from './slices/types';
import type {
  CellEditIntent,
  CellValidationError,
  GridIntent,
  GridResult,
  GridWriteIntent,
  TaskColumnContext,
  TaskColumnDescriptor,
} from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';

export interface PreparedGridMutation {
  documentId: string;
  before: Snapshot;
  after: Snapshot;
  derivedAfter: {
    viewRows: readonly ViewRow[];
    resourceLoadResult: ResourceLoadResult | null;
  };
  notifications: readonly DeferredNotification[];
  timephasedLossCount: number;
  label: string;
}

export interface GridMutationError {
  code: 'documentChanged' | 'stateChanged' | 'commitFailed' | 'reentrant';
  message: string;
}

export interface GridTransactionSlice {
  runGridMutation: (
    intents: readonly GridIntent[],
  ) => GridResult<void, readonly CellValidationError[]>;
}

type StoreGet = () => AppState;
type StoreSet = (recipe: (state: AppState) => void) => void;

let defaultStore: { get: StoreGet; set: StoreSet } | null = null;

/** Bind uitsluitend de publieke singletonwrappers; iedere storeslice houdt zijn eigen get/set. */
export function bindDefaultGridTransactionStore(get: StoreGet, set: StoreSet): void {
  defaultStore = { get, set };
}

function getDefaultStore(): { get: StoreGet; set: StoreSet } {
  if (!defaultStore) throw new Error('De standaard gridtransactiestore is nog niet gekoppeld');
  return defaultStore;
}

function validationError(
  code: string,
  intent?: Partial<CellEditIntent>,
  value?: unknown,
): CellValidationError {
  return {
    code,
    messageKey: `taskGrid.validation.${code}`,
    taskId: intent?.taskId,
    columnId: intent?.columnId,
    value,
  };
}

function flattenIntents(intents: readonly GridIntent[]): GridWriteIntent[] {
  const writes: GridWriteIntent[] = [];
  for (const intent of intents) {
    if (intent.kind === 'paste') writes.push(...intent.writes);
    else writes.push(intent);
  }
  return writes;
}

interface GridColumnRuntime {
  descriptors: ReadonlyMap<string, TaskColumnDescriptor>;
  context: TaskColumnContext;
}

function buildGridColumnRuntime(state: Readonly<AppState>): GridColumnRuntime {
  const assignmentsByTaskId = new Map<string, AppState['assignments']>();
  for (const assignment of state.assignments) {
    const values = assignmentsByTaskId.get(assignment.taskId);
    if (values) values.push(assignment);
    else assignmentsByTaskId.set(assignment.taskId, [assignment]);
  }
  const context: TaskColumnContext = {
    projectId: state.project.id,
    tasksById: new Map(state.tasks.map(task => [task.id, task])),
    relationIndex: buildTaskRelationIndex(state.tasks, state.sequences),
    assignmentsByTaskId,
    resourcesById: new Map(state.resources.map(resource => [resource.id, resource])),
    baselinesById: new Map(state.baselines.map(baseline => [baseline.id, baseline])),
    scheduleStale: state.scheduleStale,
    wbsAutoNumber: state.project.wbsAutoNumber === true,
    effectiveHoursPerDay: task => effHoursPerDay(effectiveCalendarOf(
      task, state.calendar, state.calendars,
    )),
  };
  const descriptors = buildTaskColumnRegistry({
    projectId: state.project.id,
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
    baselines: state.baselines,
  });
  return { descriptors: new Map(descriptors.map(descriptor => [descriptor.id, descriptor])), context };
}

function normalizeEdits(edits: readonly CellEditIntent[]): GridResult<readonly CellEditIntent[], readonly CellValidationError[]> {
  const byTarget = new Map<string, CellEditIntent>();
  const errors: CellValidationError[] = [];
  for (const edit of edits) {
    const key = `${edit.taskId}\u0000${edit.columnId}`;
    const previous = byTarget.get(key);
    if (!previous) {
      byTarget.set(key, edit);
      continue;
    }
    if (canonicalGridJson(previous.value) !== canonicalGridJson(edit.value)) {
      errors.push(validationError('conflictingDuplicate', edit, edit.value));
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: [...byTarget.values()] };
}

function applyCellEdit(
  state: AppState,
  edit: CellEditIntent,
  runtime: GridColumnRuntime,
): GridResult<{ timephasedGuidanceLost: boolean }, readonly CellValidationError[]> {
  const taskIndex = state.tasks.findIndex(candidate => candidate.id === edit.taskId);
  const task = state.tasks[taskIndex];
  if (!task) return { ok: false, errors: [validationError('taskNotFound', edit, edit.value)] };
  const columnId = String(edit.columnId);
  const descriptor = runtime.descriptors.get(columnId);
  if (!descriptor || !descriptor.available(runtime.context)) {
    return { ok: false, errors: [validationError('plannerNotAvailable', edit, edit.value)] };
  }
  const readOnly = typeof descriptor.readOnly === 'function'
    ? descriptor.readOnly(task, runtime.context)
    : descriptor.readOnly;
  if (readOnly) return { ok: false, errors: [validationError('readOnly', edit, edit.value)] };
  let value = edit.value;
  if (descriptor.validate) {
    const validated = descriptor.validate(value, task, runtime.context);
    if (!validated.ok) {
      const error = validated.errors[0] ?? validationError('invalid', edit, value);
      return { ok: false, errors: [{ ...error, taskId: edit.taskId, columnId: edit.columnId, value }] };
    }
    value = validated.value;
  }

  const effectiveCalendar = effectiveCalendarOf(task, state.calendar, state.calendars);
  const planned = planTaskCellEdit(task, { ...edit, value }, {
    projectId: state.project.id,
    wbsAutoNumber: state.project.wbsAutoNumber === true,
    statusDate: state.project.statusDate,
    calendarIds: new Set([state.calendar.id, ...state.calendars.map(calendar => calendar.id)]),
    effectiveHoursPerDay: effHoursPerDay(effectiveCalendar),
    hourMode: isHourCalendar(effectiveCalendar) === true,
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
  });
  if (!planned.ok) return planned;
  if (planned.value.changed) {
    state.tasks[taskIndex] = planned.value.task;
    if (planned.value.scheduleStale) {
      if (state.datesAsRecorded) {
        state.datesAsRecorded = false;
        state.recordedDates = null;
      }
      markScheduleStale(state);
    }
  }
  return {
    ok: true,
    value: { timephasedGuidanceLost: planned.value.timephasedGuidanceLost },
  };
}

function snapshotsShareAllFields(left: Snapshot, right: Snapshot): boolean {
  for (const key of Object.keys(left) as (keyof Snapshot)[]) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

export function prepareGridMutation(
  state: Readonly<AppState>,
  intents: readonly GridIntent[],
): GridResult<PreparedGridMutation, readonly CellValidationError[]> {
  const flattened = flattenIntents(intents);
  const unavailable = flattened.find(intent => intent.kind !== 'cell-edit');
  if (unavailable) {
    return {
      ok: false,
      errors: [validationError('plannerNotAvailable', { taskId: unavailable.taskId }, unavailable)],
    };
  }
  const normalized = normalizeEdits(flattened as CellEditIntent[]);
  if (!normalized.ok) return normalized;

  const runtime = buildGridColumnRuntime(state);
  const before = createSnapshot(state as AppState);
  let errors: CellValidationError[] = [];
  const timephasedLossTaskIds = new Set<string>();
  const isolated = produce(state as AppState, draft => {
    for (const edit of normalized.value) {
      const applied = applyCellEdit(draft, edit, runtime);
      if (!applied.ok) errors.push(...applied.errors);
      else if (applied.value.timephasedGuidanceLost) timephasedLossTaskIds.add(edit.taskId);
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const after = createSnapshot(isolated);
  let viewRows: readonly ViewRow[];
  let resourceLoadResult: ResourceLoadResult | null;
  try {
    viewRows = deriveViewRows(isolated);
    resourceLoadResult = computeReliableResourceLoad(
      after.cpmResult,
      isolated.resources,
      isolated.assignments,
      isolated.tasks,
      isolated.calendar,
      isolated.calendars,
    );
  } catch (error) {
    return { ok: false, errors: [validationError('derivedCalculation', undefined, String(error))] };
  }
  return {
    ok: true,
    value: {
      documentId: state.activeDocumentId,
      before,
      after,
      derivedAfter: { viewRows, resourceLoadResult },
      notifications: [],
      timephasedLossCount: timephasedLossTaskIds.size,
      label: normalized.value.length === 1 ? 'Cel bewerken' : 'Cellen bewerken',
    },
  };
}

function commitPreparedAgainstStore(
  get: StoreGet,
  set: StoreSet,
  prepared: PreparedGridMutation,
  requireFreshBefore = false,
): GridResult<void, readonly GridMutationError[]> {
  if (get().activeDocumentId !== prepared.documentId) {
    return { ok: false, errors: [{ code: 'documentChanged', message: 'Het actieve document is gewijzigd' }] };
  }
  // Alleen de rechtstreeks geëxporteerde test-/diagnosenaad kan tussen prepare en commit worden
  // vastgehouden. De normale wrapper is synchroon en slaat deze onnodige hotpathcheck over.
  if (requireFreshBefore && !snapshotsShareAllFields(createSnapshot(get()), prepared.before)) {
    return { ok: false, errors: [{ code: 'stateChanged', message: 'De documentdata is na prepare gewijzigd' }] };
  }
  const changed = !snapshotsShareAllFields(prepared.before, prepared.after);
  if (changed) {
    try {
      set(state => {
        if (state.activeDocumentId !== prepared.documentId) throw new Error('Het actieve document is gewijzigd');
        restoreSnapshot(state, prepared.after);
        state.viewRows = [...prepared.derivedAfter.viewRows];
        state.resourceLoadResult = prepared.derivedAfter.resourceLoadResult;
        state.isDirty = true;
        recordDocumentDataHistoryDelta(
          state, prepared.label, prepared.documentId, prepared.before, prepared.after,
        );
      });
    } catch (error) {
      return { ok: false, errors: [{ code: 'commitFailed', message: (error as Error).message }] };
    }
  }
  for (const notification of prepared.notifications) get().notify(notification);
  if (changed && prepared.timephasedLossCount > 0) {
    notifyTimephasedLoss(get().notify, prepared.documentId, prepared.timephasedLossCount);
  }
  return { ok: true, value: undefined };
}

export function commitPreparedGridMutation(
  prepared: PreparedGridMutation,
): GridResult<void, readonly GridMutationError[]> {
  const store = getDefaultStore();
  return commitPreparedAgainstStore(store.get, store.set, prepared, true);
}

const runningStores = new WeakSet<StoreGet>();

function runGridMutationAgainstStore(
  get: StoreGet,
  set: StoreSet,
  intents: readonly GridIntent[],
): GridResult<void, readonly CellValidationError[]> {
  if (runningStores.has(get)) {
    return { ok: false, errors: [validationError('reentrant')] };
  }
  runningStores.add(get);
  try {
    if (intents.length === 0) return { ok: true, value: undefined };
    const prepared = prepareGridMutation(get(), intents);
    if (!prepared.ok) return prepared;
    const committed = commitPreparedAgainstStore(get, set, prepared.value);
    return committed.ok
      ? { ok: true, value: undefined }
      : { ok: false, errors: committed.errors.map(error => validationError(error.code)) };
  } finally {
    runningStores.delete(get);
  }
}

export function runGridMutation(
  intents: readonly GridIntent[],
): GridResult<void, readonly CellValidationError[]> {
  const store = getDefaultStore();
  return runGridMutationAgainstStore(store.get, store.set, intents);
}

export const createGridTransactionSlice: AppSlice<GridTransactionSlice> = (set, get) => ({
  runGridMutation: intents => runGridMutationAgainstStore(get, set as StoreSet, intents),
});
