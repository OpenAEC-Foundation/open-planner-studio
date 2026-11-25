import type { PlannedProgressDates } from '@/engine/taskMutationRules';
import { constraintDateField, DayClockCache, normalizeTaskDateInput, normalizeTaskDates, taskDateContext, type TaskDateField } from './migrations/minuteModel';
import { workdayBoundaryLabel } from '@/engine/calendar/workdayRules';
import { normalizeActualDate } from '@/engine/taskMutationRules';
import { isElapsedTask } from '@/engine/scheduler/duration';
import { produce } from 'immer';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { resourceLoadInputsUnchanged } from './resourceLoadReuse';
import { deriveViewRows } from './slices/viewSlice';
import { buildTaskRelationIndex, type TaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import { buildTaskColumnRegistry, canonicalGridJson, readOnlyValidationCode } from '@/engine/taskGrid/taskColumnRegistry';
import {
  planTaskCellEdits,
  type TaskEditPlanEnvironment,
} from '@/engine/taskGrid/taskEditPlan';
import {
  applyTaskAssignmentPlan,
  planTaskAssignmentSet,
  type TaskAssignmentApplyIndexes,
} from '@/engine/taskGrid/assignmentPlan';
import { isHourModeCalendar } from '@/types/calendar';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { signedWorkDaysBetween } from '@/engine/variance';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { recordedGridBinding } from './recordedDatesSelectors';
import { createSnapshot, restoreSnapshot, type Snapshot } from './snapshot';
import { recordDocumentDataHistoryDelta } from './sessionHistory';
import { notifyTimephasedLoss } from './timephasedLossNotice';
import { startEditNotifications, type StartEditNotice } from './startConstraintNotice';
import { predecessorDrivenTaskIds } from '@/engine/startEditConstraint';
import { markDateMutation, snapshotsEqual } from './transaction';
import {
  captureCalendarChange, captureTriangle, remainingMinutesOf, settleAssignmentPlan, settleCalendarChange,
  settleDurationAftermath, settleDurationEdit, settleRuleChange, settleWorkEdit, type AssignmentSettleOp,
  captureProgressWork, settleProgressWork, type RecomputedRemainingWork,
} from '@/engine/work/workRuleApply';
import { remainingWorkRecomputedNotice } from './remainingWorkNotice';
import { contourKeepsWork, taskCalendarHoursPerDay, taskTriggerChanges, taskWorkMinutesOf } from '@/utils/taskDefaults';
import { generateId } from '@/utils/id';
import { sameValue } from '@/utils/sameValue';
import { actualStartQuestionFor, hasRecordedProgress } from '@/engine/progressEntry';
import { progressPlacementForBatch, progressPlannedDates } from './progressPlannedDates';
import { statusDateSetTodayNotice } from './progressEntryNotice';
import {
  applyRelationMutationPlan,
  isParsedRelationTokenArray,
  planRelationSet,
  planRelationSetInBatch,
  validateFinalRelationGraph,
  type RelationTokenError,
} from '@/engine/taskGrid/relationPlan';
import type { AppState } from './appStore';
import type { AppSlice, DeferredNotification } from './slices/types';
import type { Task } from '@/types/task';
import type {
  CellEditIntent,
  CellValidationError,
  GridIntent,
  GridResult,
  GridWriteIntent,
  AssignmentSetIntent,
  RelationSetIntent,
  TaskColumnContext,
  TaskColumnDescriptor,
} from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';
import { markDocumentEdited } from '@/state/documentEdited';
import { refusalNotice, refusedNamesLine } from './refusalNotice';

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
  skippedReadOnlyCount: number;
  skippedReadOnlyUntouchedTaskIds?: readonly string[];
  skippedReadOnlyPartialTaskIds?: readonly string[];
  label: string;
}

export interface GridMutationError {
  code: 'documentChanged' | 'stateChanged' | 'commitFailed' | 'reentrant';
  message: string;
}

export interface GridMutationOptions {
  progressEntry?: { today: string };
  recordHistory?: boolean;
}

export interface GridTransactionSlice {
  runGridMutation: (
    intents: readonly GridIntent[],
    options?: GridMutationOptions,
  ) => GridResult<void, readonly CellValidationError[]>;
}

type StoreGet = () => AppState;
type StoreSet = (recipe: (state: AppState) => void) => void;

let defaultStore: { get: StoreGet; set: StoreSet } | null = null;

export function bindDefaultGridTransactionStore(get: StoreGet, set: StoreSet): void {
  defaultStore = { get, set };
}

function getDefaultStore(): { get: StoreGet; set: StoreSet } {
  if (!defaultStore) throw new Error('De standaard gridtransactiestore is nog niet gekoppeld');
  return defaultStore;
}

function validationError(
  code: string,
  intent?: { taskId?: string; columnId?: CellEditIntent['columnId'] },
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
  const recordedDates = state.recordedDates;
  const datesAsRecorded = state.datesAsRecorded;
  const assignmentsByTaskId = new Map<string, AppState['assignments']>();
  for (const assignment of state.assignments) {
    const values = assignmentsByTaskId.get(assignment.taskId);
    if (values) values.push(assignment);
    else assignmentsByTaskId.set(assignment.taskId, [assignment]);
  }
  let projectEngine: CalendarEngine | undefined;
  const context: TaskColumnContext = {
    projectId: state.project.id,
    tasksById: new Map(state.tasks.map(task => [task.id, task])),
    relationIndex: buildTaskRelationIndex(state.tasks, state.sequences, state.cpmResult),
    assignmentsByTaskId,
    resourcesById: new Map(state.resources.map(resource => [resource.id, resource])),
    baselinesById: new Map(state.baselines.map(baseline => [baseline.id, baseline])),
    scheduleStale: state.scheduleStale,
    taskTypesUnlocked: state.ui.showTaskTypes || state.taskTypesVisible,
    wbsAutoNumber: state.project.wbsAutoNumber === true,
    effectiveHoursPerDay: task => effHoursPerDay(effectiveCalendarOf(
      task, state.calendar, state.calendars,
    )),
    signedWorkDaysBetween: (fromIso, toIso) => signedWorkDaysBetween(
      projectEngine ??= new CalendarEngine(state.calendar), fromIso, toIso,
    ),
    recordedMark: recordedGridBinding(recordedDates, datesAsRecorded).recordedMark,
  };
  const descriptors = buildTaskColumnRegistry({
    projectId: state.project.id,
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
    baselines: state.baselines,
    customTaskTypes: state.customTaskTypes,
  });
  return { descriptors: new Map(descriptors.map(descriptor => [descriptor.id, descriptor])), context };
}

function normalizeWrites(writes: readonly GridWriteIntent[]): GridResult<readonly GridWriteIntent[], readonly CellValidationError[]> {
  const unique: GridWriteIntent[] = [];
  const byTarget = new Map<string, GridWriteIntent>();
  const errors: CellValidationError[] = [];
  for (const write of writes) {
    const key = write.kind === 'cell-edit'
      ? `cell\u0000${write.taskId}\u0000${write.columnId}`
      : write.kind === 'assignment-set'
        ? `assignment\u0000${write.taskId}\u0000${write.columnId}`
        : `relation\u0000${write.taskId}\u0000${write.direction}`;
    const previous = byTarget.get(key);
    if (!previous) {
      byTarget.set(key, write);
      unique.push(write);
    } else if (canonicalGridJson(previous) !== canonicalGridJson(write)) {
      errors.push(validationError('conflictingDuplicate', { taskId: write.taskId }, write));
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: unique };
}

function orderWritesForDependentTransitions(
  writes: readonly GridWriteIntent[],
): readonly GridWriteIntent[] {
  const targets = new Map<string, boolean>();
  const hammockTargets = new Map<string, boolean>();
  const primaryConstraintTargets = new Map<string, string>();
  const secondaryConstraintTargets = new Map<string, string | undefined>();
  for (const write of writes) {
    if (write.kind !== 'cell-edit') continue;
    const columnId = String(write.columnId);
    if (columnId === 'task.isMilestone' && typeof write.value === 'boolean') {
      targets.set(write.taskId, write.value);
    } else if (columnId === 'task.isHammock' && typeof write.value === 'boolean') {
      hammockTargets.set(write.taskId, write.value);
    } else if (columnId === 'task.constraint.type' && typeof write.value === 'string') {
      primaryConstraintTargets.set(write.taskId, write.value);
    } else if (columnId === 'task.constraint2.type'
      && (write.value === undefined || typeof write.value === 'string')) {
      secondaryConstraintTargets.set(write.taskId, write.value);
    }
  }
  const assignmentTaskIds = new Set(writes.flatMap(write => (
    write.kind === 'assignment-set' ? [write.taskId] : []
  )));
  if (targets.size === 0 && hammockTargets.size === 0 && primaryConstraintTargets.size === 0
    && secondaryConstraintTargets.size === 0 && assignmentTaskIds.size === 0) return writes;

  const isEmptyDependentValue = (value: unknown): boolean => (
    value === undefined || value === '' || value === false
  );
  const filtered = writes.filter(write => {
    if (write.kind !== 'cell-edit' || !isEmptyDependentValue(write.value)) return true;
    const columnId = String(write.columnId);
    const primary = primaryConstraintTargets.get(write.taskId);
    if ((primary === 'ASAP' || primary === 'ALAP')
      && (columnId === 'task.constraint.date' || columnId === 'task.constraint.hard')) return false;
    if (primary !== undefined && primary !== 'MSO' && primary !== 'MFO'
      && columnId === 'task.constraint.hard') return false;
    const secondary = secondaryConstraintTargets.get(write.taskId);
    if ((secondary === undefined || secondary === 'ASAP' || secondary === 'ALAP')
      && secondaryConstraintTargets.has(write.taskId)
      && columnId === 'task.constraint2.date') return false;
    return true;
  });

  const ordered = [...filtered];
  const affectedTaskIds = new Set([
    ...targets.keys(), ...hammockTargets.keys(),
    ...primaryConstraintTargets.keys(), ...secondaryConstraintTargets.keys(),
    ...assignmentTaskIds,
  ]);
  const positionsByTaskId = new Map<string, number[]>();
  ordered.forEach((write, index) => {
    const existing = positionsByTaskId.get(write.taskId);
    if (existing) existing.push(index);
    else positionsByTaskId.set(write.taskId, [index]);
  });
  for (const taskId of affectedTaskIds) {
    const targetMilestone = targets.get(taskId);
    const targetHammock = hammockTargets.get(taskId);
    const positions = positionsByTaskId.get(taskId) ?? [];
    const taskWrites = positions.map(position => ordered[position]);
    const rank = (write: GridWriteIntent): number => {
      let value = 0;
      if (targetMilestone === true) {
        if (write.kind === 'assignment-set') value += write.tokens.length === 0 ? -100 : 10;
        if (write.kind === 'cell-edit' && String(write.columnId) === 'task.isHammock') {
          value += write.value === false || write.value === undefined ? -30 : 10;
        }
      }
      if (targetMilestone === undefined && targetHammock === true
        && write.kind === 'assignment-set') {
        value += write.tokens.length === 0 ? -30 : 10;
      }
      if ((targetMilestone === false || (targetMilestone === undefined && targetHammock === false))
        && write.kind === 'assignment-set') value += 10;
      if (write.kind === 'assignment-set') {
        if (String(write.columnId) === 'assignment.resources') value -= 20;
        else value += 20;
      }
      if (write.kind !== 'cell-edit') return value;
      const columnId = String(write.columnId);
      const isMilestoneMetadata = columnId === 'task.milestoneKind'
        || columnId === 'task.mandatory';
      if (targetMilestone === true) {
        if (columnId === 'task.time.scheduleDuration') value -= 30;
        if (columnId === 'task.isHammock' && (write.value === false || write.value === undefined)) value -= 40;
        if (columnId === 'task.isMilestone') value -= 20;
        if (isMilestoneMetadata) value += 10;
      } else if (targetMilestone === false) {
        if (isMilestoneMetadata) value -= 30;
        if (columnId === 'task.isMilestone') value -= 20;
      }
      if (targetMilestone === undefined && targetHammock !== undefined) {
        if (targetHammock === true && columnId === 'task.time.scheduleDuration') value -= 30;
        if (columnId === 'task.isHammock') value -= 20;
      }
      if (primaryConstraintTargets.has(taskId)) {
        if (columnId === 'task.constraint.type') value -= 10;
      }
      if (secondaryConstraintTargets.has(taskId)) {
        if (columnId === 'task.constraint2.type') value -= 10;
      }
      return value;
    };
    const ranked = taskWrites
      .map((write, index) => ({ write, index, rank: rank(write) }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map(item => item.write);
    positions.forEach((position, index) => { ordered[position] = ranked[index]; });
  }
  return ordered;
}

function applyAssignmentSet(
  state: AppState,
  intent: AssignmentSetIntent,
  assignmentsForTask: readonly AppState['assignments'][number][],
  tasksById: ReadonlyMap<string, AppState['tasks'][number]>,
  resourcesById: GridColumnRuntime['context']['resourcesById'],
  applyIndexes: TaskAssignmentApplyIndexes,
): GridResult<{ timephasedGuidanceLostTaskIds: readonly string[] }, readonly CellValidationError[]> {
  const columnId = String(intent.columnId);
  if (columnId !== 'assignment.resources'
    && columnId !== 'assignment.unitsPerDay'
    && columnId !== 'assignment.curve'
    && columnId !== 'assignment.remainingWork') {
    return { ok: false, errors: [validationError('plannerNotAvailable', intent, intent.tokens)] };
  }
  let tokens = intent.tokens;
  if (columnId !== 'assignment.resources') {
    const currentByResourceId = new Map(assignmentsForTask.map(assignment => [assignment.resourceId, assignment] as const));
    const incomingByResourceId = new Map(tokens.map(token => [token.resourceId, token] as const));
    if (currentByResourceId.size !== incomingByResourceId.size
      || [...currentByResourceId.keys()].some(resourceId => !incomingByResourceId.has(resourceId))) {
      return { ok: false, errors: [validationError('readOnly', intent, intent.tokens)] };
    }
    tokens = assignmentsForTask.map(assignment => {
      const incoming = incomingByResourceId.get(assignment.resourceId)!;
      return {
        assignmentId: assignment.id,
        resourceId: assignment.resourceId,
        unitsPerDay: columnId === 'assignment.unitsPerDay' ? incoming.unitsPerDay : assignment.unitsPerDay,
        ...(columnId === 'assignment.curve'
          ? (incoming.curve ? { curve: incoming.curve } : {})
          : (assignment.curve ? { curve: assignment.curve } : {})),
        ...(assignment.costAmount !== undefined ? { costAmount: assignment.costAmount } : {}),
      };
    });
  }
  const planned = planTaskAssignmentSet({
    taskId: intent.taskId,
    tokens,
    tasks: state.tasks,
    resources: state.resources,
    assignments: state.assignments,
    assignmentsForTask,
    tasksById,
    resourcesById,
  });
  if (!planned.ok) return planned;
  const task = tasksById.get(intent.taskId);
  const triangle = task ? captureTriangle(task, assignmentsForTask, state) : null;
  const oldWorkMinutes = task ? taskWorkMinutesOf(task, taskCalendarHoursPerDay(task, state.calendars, state.calendar)) : 0;
  const unitsBefore = new Map(assignmentsForTask.map(a => [a.id, a.unitsPerDay] as const));
  const applied = applyTaskAssignmentPlan(
    state, planned.value, () => generateId('asgn'), applyIndexes,
  );
  let lostTaskIds = applied.timephasedGuidanceLostTaskIds;
  if (task && triangle) {
    const ops: AssignmentSettleOp[] = [];
    for (const op of planned.value.operations) {
      if (op.kind === 'remove') ops.push({ kind: 'remove', assignmentId: op.assignmentId });
      else if (op.kind === 'update') {
        const before = unitsBefore.get(op.assignmentId);
        if (before !== undefined && before !== op.unitsPerDay) ops.push({ kind: 'update', assignmentId: op.assignmentId, unitsPerDay: op.unitsPerDay });
      } else {
        const added = (applyIndexes.assignmentsByTaskId.get(op.taskId) ?? []).find(a => a.resourceId === op.resourceId);
        if (added) ops.push({ kind: 'add', assignmentId: added.id, unitsPerDay: added.unitsPerDay, resourceId: added.resourceId });
      }
    }
    const settled = settleAssignmentPlan(task, state.assignments, triangle, ops);
    let durationChanged = settled.durationChanged;
    if (columnId === 'assignment.remainingWork') {
      const byId = new Map(assignmentsForTask.map(a => [a.id, a] as const));
      const byResource = new Map(assignmentsForTask.map(a => [a.resourceId, a] as const));
      const shownRemaining = remainingMinutesOf(task, { hoursPerDay: taskCalendarHoursPerDay(task, state.calendars, state.calendar) });
      for (const token of intent.tokens) {
        const current = (token.assignmentId ? byId.get(token.assignmentId) : undefined) ?? byResource.get(token.resourceId);
        const w = token.remainingWorkMinutes;
        if (!current || typeof w !== 'number' || !Number.isFinite(w) || w <= 0) continue;
        const shown = current.remainingWorkMinutes ?? shownRemaining * current.unitsPerDay;
        if (Math.abs(shown - w) < 1) continue;
        const live = state.assignments.find(a => a.id === current.id);
        if (!live) continue;
        const result = settleWorkEdit(task, state.assignments, state, live.id, w);
        if (result?.durationChanged) durationChanged = true;
        if (result) state.taskTypesVisible = true;
      }
    }
    if (durationChanged) {
      const lost = settleDurationAftermath(task, state, oldWorkMinutes, triangle.finishBasis);
      if (lost && !lostTaskIds.includes(task.id)) lostTaskIds = [...lostTaskIds, task.id];
      markDateMutation(state);
    }
  }
  return { ok: true, value: { timephasedGuidanceLostTaskIds: lostTaskIds } };
}

function relationCellErrors(errors: readonly RelationTokenError[], taskId?: string): CellValidationError[] {
  return errors.map(error => ({
    code: error.code,
    messageKey: error.messageKey,
    ...(taskId !== undefined ? { taskId } : {}),
    tokenIndex: error.tokenIndex,
    start: error.start,
    end: error.end,
    cycle: error.cycle,
    value: error.value,
  }));
}

function applyRelationSet(
  state: AppState,
  intent: RelationSetIntent,
  inBatch = false,
  relationIndex?: TaskRelationIndex,
): GridResult<{ changed: boolean }, readonly CellValidationError[]> {
  if (!isParsedRelationTokenArray(intent.value)) {
    return { ok: false, errors: [validationError('invalidRelationTokens', { taskId: intent.taskId }, intent.value)] };
  }
  const planned = (inBatch ? planRelationSetInBatch : planRelationSet)({
    tasks: state.tasks,
    sequences: state.sequences,
    ownerTaskId: intent.taskId,
    direction: intent.direction,
    tokens: intent.value,
    relationIndex,
  });
  if (!planned.ok) return { ok: false, errors: relationCellErrors(planned.errors, intent.taskId) };
  applyRelationMutationPlan(state, planned.value, {
    sequenceId: () => generateId('seq'),
    externalLinkId: () => generateId('extlink'),
  });
  if (planned.value.changed) markDateMutation(state);
  return { ok: true, value: { changed: planned.value.changed } };
}

export function buildTaskEditPlanEnvironment(state: AppState, task: Task): TaskEditPlanEnvironment {
  const effectiveCalendar = effectiveCalendarOf(task, state.calendar, state.calendars);
  return {
    projectId: state.project.id,
    wbsAutoNumber: state.project.wbsAutoNumber === true,
    statusDate: state.project.statusDate,
    calendarIds: new Set([state.calendar.id, ...state.calendars.map(calendar => calendar.id)]),
    effectiveHoursPerDay: effHoursPerDay(effectiveCalendar),
    hourMode: isHourModeCalendar(effectiveCalendar) === true,
    workdayDurationMeasure: effectiveSchedulingOptions(state.project).workdayDurationMeasure === true,
    effectiveCalendar,
    calendarFor: (calendarId) => resolveCalendar(calendarId, state.calendars, state.calendar),

    customTaskTypeIds: new Set(state.customTaskTypes.map(type => type.id)),
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
    contourKeepsWork: contourKeepsWork(task, state.project.defaultWorkRule),
    defaultWorkRule: state.project.defaultWorkRule,
  };
}

const TYPED_START_COLUMN_IDS: ReadonlySet<string> = new Set(['task.time.start', 'task.time.scheduleStart']);

function applyCellEdits(
  state: AppState,
  edits: readonly CellEditIntent[],
  runtime: GridColumnRuntime,
  taskIndexById: ReadonlyMap<string, number>,
  skipReadOnlyCells: boolean,
  startDrivenByPredecessor: (taskId: string) => boolean,
  plannedDates: (task: Task) => PlannedProgressDates | undefined,
  assignmentsForTask: readonly AppState['assignments'][number][] = [],
  statusDateOverride?: string,
  deferDurationCompletion?: boolean,
): GridResult<{
  timephasedGuidanceLost: boolean;
  skippedReadOnlyCount: number;
  startNotice?: StartEditNotice;
  progressStart?: string;
  recomputedWork?: readonly RecomputedRemainingWork[];
}, readonly CellValidationError[]> {
  const first = edits[0];
  if (!first) return { ok: true, value: { timephasedGuidanceLost: false, skippedReadOnlyCount: 0 } };
  const taskIndex = taskIndexById.get(first.taskId) ?? -1;
  const task = taskIndex >= 0 ? state.tasks[taskIndex] : undefined;
  if (!task) return { ok: false, errors: [validationError('taskNotFound', first, first.value)] };
  const validatedEdits: CellEditIntent[] = [];
  const calendarWrite = edits.find(edit => String(edit.columnId) === 'task.calendarId');
  const dateTask = calendarWrite ? { ...task, calendarId: calendarWrite.value as string | undefined } : task;
  const dateContext = taskDateContext(dateTask, new DayClockCache(state.calendar, state.calendars));
  let skippedReadOnlyCount = 0;
  for (const edit of edits) {
    const descriptor = runtime.descriptors.get(String(edit.columnId));
    if (!descriptor || !descriptor.available(runtime.context)) {
      return { ok: false, errors: [validationError('plannerNotAvailable', edit, edit.value)] };
    }
    if (descriptor.readOnly === true) {
      if (skipReadOnlyCells) { skippedReadOnlyCount++; continue; }
      return { ok: false, errors: [validationError('readOnly', edit, edit.value)] };
    }
    let value = edit.value;
    if (typeof value === 'string') {
      const column = String(edit.columnId);
      let field: TaskDateField | null = null;
      if (column === 'task.time.start') field = 'earlyStart';
      else if (column === 'task.time.finish') field = 'earlyFinish';
      else if (/^task\.time\.(scheduleStart|scheduleFinish|actualStart|actualFinish|resume|stop)$/.test(column)) {
        field = column.slice('task.time.'.length) as TaskDateField;
      } else if (column === 'task.deadline') field = 'deadline';
      else if (column === 'task.constraint.date' || column === 'task.constraint2.date') {
        const key = column === 'task.constraint.date' ? 'constraint' : 'constraint2';
        const type = edits.find(candidate => String(candidate.columnId) === `task.${key}.type`)?.value ?? task[key]?.type;
        if (typeof type === 'string') field = constraintDateField(type);
      }
      if (field === 'actualStart' || field === 'actualFinish') {
        value = normalizeActualDate(dateTask, field, value, state.project.statusDate,
          effectiveCalendarOf(dateTask, state.calendar, state.calendars)) ?? value;
      } else if (field) value = normalizeTaskDateInput(value, field, dateContext) ?? value;
    }
    if (descriptor.validate) {
      const validated = descriptor.validate(value, task, runtime.context);
      if (!validated.ok) {
        const error = validated.errors[0] ?? validationError('invalid', edit, value);
        return { ok: false, errors: [{ ...error, taskId: edit.taskId, columnId: edit.columnId, value }] };
      }
      value = validated.value;
    }
    validatedEdits.push({ ...edit, value });
  }

  const calendarEdit = validatedEdits.find(edit => String(edit.columnId) === 'task.calendarId');
  const taskForCalendar = calendarEdit
    ? { ...task, calendarId: calendarEdit.value as string | undefined }
    : task;
  const environment: TaskEditPlanEnvironment = {
    ...buildTaskEditPlanEnvironment(state, taskForCalendar),
    deferDurationCompletion,
    ...(statusDateOverride ? { statusDate: statusDateOverride } : {}),
    ...(validatedEdits.some(edit => TYPED_START_COLUMN_IDS.has(String(edit.columnId)))
      ? { startDrivenByPredecessor: startDrivenByPredecessor(task.id) }
      : {}),
  };

  let sharedProjectedTasksById: Map<string, AppState['tasks'][number]> | null = null;
  let sharedProjectedContext: TaskColumnContext | null = null;
  const ensureProjectedContext = (): { tasksById: Map<string, AppState['tasks'][number]>; context: TaskColumnContext } => {
    if (!sharedProjectedTasksById || !sharedProjectedContext) {
      sharedProjectedTasksById = new Map(runtime.context.tasksById);
      sharedProjectedContext = { ...runtime.context, tasksById: sharedProjectedTasksById };
    }
    return { tasksById: sharedProjectedTasksById, context: sharedProjectedContext };
  };

  const CONTROLLER_COLUMN_IDS = new Set([
    'task.isMilestone', 'task.isHammock', 'task.constraint.type', 'task.constraint2.type',
  ]);

  const skippedConditionalEdits = new Set<CellEditIntent>();
  let passFoundNewSkip = true;
  while (passFoundNewSkip) {
    passFoundNewSkip = false;
    const activeEdits = validatedEdits.filter(candidate => !skippedConditionalEdits.has(candidate));
    let sharedControllerStates: readonly { task: AppState['tasks'][number] }[] | null = null;
    const buildControllerStates = (excludeEdit: CellEditIntent): readonly { task: AppState['tasks'][number] }[] => {
      const controllerEdits = activeEdits.filter(
        candidate => candidate !== excludeEdit && CONTROLLER_COLUMN_IDS.has(String(candidate.columnId)),
      );
      const states: { task: AppState['tasks'][number] }[] = [{ task }];
      for (let prefixLength = 1; prefixLength <= controllerEdits.length; prefixLength++) {
        const projected = planTaskCellEdits(task, controllerEdits.slice(0, prefixLength), environment);
        if (projected.ok) states.push({ task: projected.value.task });
      }
      return states;
    };

    for (const edit of activeEdits) {
      const descriptor = runtime.descriptors.get(String(edit.columnId));
      if (!descriptor || typeof descriptor.readOnly !== 'function'
        || !descriptor.readOnly(task, runtime.context)) continue;
      const { tasksById: projectedTasksById, context: projectedContext } = ensureProjectedContext();

      if (!CONTROLLER_COLUMN_IDS.has(String(edit.columnId))) {
        if (!sharedControllerStates) sharedControllerStates = buildControllerStates(edit);
        let jointlyWritable = false;
        for (const state of sharedControllerStates) {
          projectedTasksById.set(task.id, state.task);
          if (!descriptor.readOnly(state.task, projectedContext)) { jointlyWritable = true; break; }
        }
        if (!jointlyWritable) {
          if (skipReadOnlyCells) { skippedConditionalEdits.add(edit); passFoundNewSkip = true; continue; }
          return { ok: false, errors: [validationError(readOnlyValidationCode(descriptor, task, runtime.context), edit, edit.value)] };
        }
        continue;
      }

      const otherEdits = activeEdits.filter(candidate => candidate !== edit);
      let jointlyWritable = false;
      for (let prefixLength = 1; prefixLength <= otherEdits.length; prefixLength++) {
        const projected = planTaskCellEdits(task, otherEdits.slice(0, prefixLength), environment);
        if (!projected.ok) continue;
        projectedTasksById.set(task.id, projected.value.task);
        if (!descriptor.readOnly(projected.value.task, projectedContext)) {
          jointlyWritable = true;
          break;
        }
      }
      if (!jointlyWritable) {
        if (skipReadOnlyCells) { skippedConditionalEdits.add(edit); passFoundNewSkip = true; continue; }
        return { ok: false, errors: [validationError(readOnlyValidationCode(descriptor, task, runtime.context), edit, edit.value)] };
      }
    }
  }
  skippedReadOnlyCount += skippedConditionalEdits.size;
  const finalEdits = skippedConditionalEdits.size > 0
    ? validatedEdits.filter(edit => !skippedConditionalEdits.has(edit))
    : validatedEdits;

  let changed = false;
  let timephasedGuidanceLost = false;
  let scheduleStale = false;
  let recomputedWork: readonly RecomputedRemainingWork[] = [];
  const calendarEdits = finalEdits.filter(edit => String(edit.columnId) === 'task.calendarId');
  if (calendarEdits.length > 0) {
    const before = captureCalendarChange(task, assignmentsForTask, state);
    const plannedCalendar = planTaskCellEdits(task, calendarEdits, environment);
    if (!plannedCalendar.ok) return plannedCalendar;
    if (plannedCalendar.value.changed) {
      changed = true;
      timephasedGuidanceLost ||= plannedCalendar.value.timephasedGuidanceLost;
      scheduleStale ||= plannedCalendar.value.scheduleStale;
      state.tasks[taskIndex] = plannedCalendar.value.task;
      timephasedGuidanceLost ||= settleCalendarChange(state.tasks[taskIndex], state.assignments, before, state).timephasedLost;
    }
  }
  const remainingEdits = calendarEdits.length > 0 ? finalEdits.filter(edit => !calendarEdits.includes(edit)) : finalEdits;
  const current = state.tasks[taskIndex];
  const triangle = captureTriangle(current, assignmentsForTask, state);
  const progressWork = captureProgressWork(current, state);
  const workRuleBefore = current.workRule;
  let progressStart: string | undefined;
  const planned = planTaskCellEdits(current, remainingEdits, {
    ...environment,
    plannedDates: edited => {
      const dates = plannedDates(edited);
      progressStart = dates?.earlyStart;
      return dates;
    },
  });
  if (!planned.ok) return planned;
  if (planned.value.changed) {
    changed = true;
    timephasedGuidanceLost ||= planned.value.timephasedGuidanceLost;
    scheduleStale ||= planned.value.scheduleStale;
    state.tasks[taskIndex] = planned.value.task;
    recomputedWork = settleDurationEdit(state.tasks[taskIndex], triangle).recomputedWork;
    settleProgressWork(state.tasks[taskIndex], state.assignments, progressWork);
    if (state.tasks[taskIndex].workRule !== workRuleBefore) {
      if (settleRuleChange(state.tasks[taskIndex], state.assignments, state, state.tasks[taskIndex].workRule).durationUnitChanged) {
        scheduleStale = true;
      }
      state.taskTypesVisible = true;
    }
  }
  if (changed && scheduleStale) markDateMutation(state);
  const snet = planned.value.task.constraint;
  const startNotice: StartEditNotice | undefined = planned.value.startBlocked
    ? { kind: 'blocked', name: planned.value.task.name, constraint: planned.value.startBlocked, taskId: planned.value.task.id,
      dateLabel: planned.value.startBlocked.date ? workdayBoundaryLabel(dateContext.clock, planned.value.startBlocked.date,
        constraintDateField(planned.value.startBlocked.type) === 'constraintFinish' ? 'end' : 'start') : undefined }
    : planned.value.changed && planned.value.startConstraint && snet?.date
      ? { kind: 'snet', name: planned.value.task.name, date: snet.date, change: planned.value.startConstraint,
        dateLabel: workdayBoundaryLabel(dateContext.clock, snet.date, 'start') }
      : undefined;
  return {
    ok: true,
    value: { timephasedGuidanceLost, skippedReadOnlyCount, startNotice, recomputedWork, progressStart },
  };
}

function plannedDatesForGrid(
  state: Readonly<AppState>,
  writes: readonly GridWriteIntent[],
  skipReadOnlyCells: boolean,
  today: string | undefined,
): (task: Task) => PlannedProgressDates | undefined {
  const placementWrites = writes.filter(write => write.kind !== 'cell-edit'
    || write.route === 'task-schedule' || write.route === 'task-constraint'
    || write.route === 'task-milestone' || write.route === 'task-hammock'
    || String(write.columnId) === 'task.workRule');
  const progressByTask = new Map<string, CellEditIntent[]>();
  for (const write of writes) {
    if (write.kind !== 'cell-edit' || write.route !== 'task-progress') continue;
    const group = progressByTask.get(write.taskId);
    if (group) group.push(write);
    else progressByTask.set(write.taskId, [write]);
  }
  const placement = placementWrites.length > 0 ? prepareGridWrites(state, [{
    kind: 'paste', writes: placementWrites, allowSkippingReadOnlyCells: skipReadOnlyCells,
  }], undefined, progressByTask) : undefined;
  const placed = placement?.ok ? placement.value.isolated : state;
  const base = progressPlannedDates(placed);
  const statusDate = placed.project.statusDate || today;
  const batch = progressPlacementForBatch(placed, new Set(progressByTask.keys()), statusDate);
  if (!batch) return base;

  const dates = new Map<string, PlannedProgressDates | undefined>();
  const tasksById = new Map(placed.tasks.map(task => [task.id, task]));
  const originalById = placed === state ? tasksById : new Map(state.tasks.map(task => [task.id, task]));
  for (const id of batch.order) {
    const edits = progressByTask.get(id)!;
    const before = tasksById.get(id)!;
    const original = originalById.get(id);
    const beforeDuration = original && original !== before && taskTriggerChanges(original, before).timeBase
      ? original.time : undefined;
    const environment = buildTaskEditPlanEnvironment(placed, before);
    const plan = planTaskCellEdits(before, edits, {
      ...environment,
      statusDate,
      plannedDates: task => {
        const placement = batch.plannedDates(task);
        dates.set(id, placement);
        return placement;
      },
    }, beforeDuration);
    if (!plan.ok || !plan.value.changed) continue;
    const after = plan.value.task;
    if (today && progressStartQuestion(before, after, edits, statusDate, placed, dates.get(id)?.earlyStart)) continue;
    batch.accept(before, after);
  }
  return task => dates.has(task.id) ? dates.get(task.id) : base(task);
}

function progressStartQuestion(
  before: Task, after: Task, edits: readonly CellEditIntent[], statusDate: string | undefined,
  state: Pick<AppState, 'calendar' | 'calendars'>, plannedStart: string | undefined,
) {
  const wrote = (columnId: string) => edits.some(edit => String(edit.columnId) === columnId && !!edit.value);
  return actualStartQuestionFor(before, after, statusDate, {
    actualStart: wrote('task.time.actualStart'),
    actualFinish: wrote('task.time.actualFinish'),
  }, isElapsedTask(after) ? undefined : resolveCalendar(after.calendarId, state.calendars, state.calendar),
  () => plannedStart);
}

function prepareGridWrites(
  state: Readonly<AppState>,
  intents: readonly GridIntent[],
  options?: GridMutationOptions,
  progressAfterPlacement?: ReadonlyMap<string, readonly CellEditIntent[]>,
): GridResult<Omit<PreparedGridMutation, 'derivedAfter' | 'before' | 'after'> & { isolated: AppState }, readonly CellValidationError[]> {
  const flattened = flattenIntents(intents);
  const normalized = normalizeWrites(flattened);
  if (!normalized.ok) return normalized;
  const orderedWrites = orderWritesForDependentTransitions(normalized.value);

  const progressTaskIds = new Set<string>();
  for (const write of orderedWrites) {
    if (write.kind === 'cell-edit' && write.route === 'task-progress') progressTaskIds.add(write.taskId);
  }
  const today = options?.progressEntry?.today;
  const plansStatusDateToday = !!today && !state.project.statusDate && progressTaskIds.size > 0;
  const entryStatusDate = today ? state.project.statusDate || today : undefined;
  const notifications: DeferredNotification[] = [];

  const skipReadOnlyCells = intents.some(
    intent => intent.kind === 'paste' && intent.allowSkippingReadOnlyCells === true,
  );
  const skippedReadOnlyFromPlanning = intents.reduce(
    (total, intent) => total + (intent.kind === 'paste' ? intent.skippedReadOnlyCount ?? 0 : 0),
    0,
  );

  let lookup: ((task: Task) => PlannedProgressDates | undefined) | undefined;
  const plannedDates = (task: Task): PlannedProgressDates | undefined => {
    lookup ??= plannedDatesForGrid(state, orderedWrites, skipReadOnlyCells, today);
    return lookup(task);
  };

  const runtime = buildGridColumnRuntime(state);
  let relationWriteCount = 0;
  for (const write of orderedWrites) {
    if (write.kind === 'relation-set') relationWriteCount++;
  }
  let errors: CellValidationError[] = [];
  const timephasedLossTaskIds = new Set<string>();
  const assignmentValidationTaskIds = new Set<string>();
  const appliedRelationWrites: RelationSetIntent[] = [];
  let skippedReadOnlyFromTransaction = 0;
  const skippedReadOnlyTaskIds = new Set<string>();
  const wroteTaskIds = new Set<string>();
  for (const intent of intents) {
    if (intent.kind === 'paste') for (const id of intent.skippedReadOnlyTaskIds ?? []) skippedReadOnlyTaskIds.add(id);
  }
  const startNotices: StartEditNotice[] = [];
  const recomputedWork: RecomputedRemainingWork[] = [];
  const isolated = produce(state as AppState, draft => {
    let predecessorDriven: ReadonlySet<string> | null = null;
    let relationsChanged = false;
    const startDrivenByPredecessor = (taskId: string): boolean => {
      predecessorDriven ??= relationsChanged
        ? predecessorDrivenTaskIds(draft.tasks, draft.sequences)
        : predecessorDrivenTaskIds(state.tasks, state.sequences);
      return predecessorDriven.has(taskId);
    };
    const draftTasksById = new Map(draft.tasks.map(task => [task.id, task] as const));
    const draftTaskIndexById = new Map(draft.tasks.map((task, index) => [task.id, index] as const));
    const draftAssignmentsByTaskId = new Map<string, AppState['assignments']>();
    for (const assignment of draft.assignments) {
      const current = draftAssignmentsByTaskId.get(assignment.taskId);
      if (current) current.push(assignment);
      else draftAssignmentsByTaskId.set(assignment.taskId, [assignment]);
    }
    const assignmentApplyIndexes: TaskAssignmentApplyIndexes = {
      assignmentsByTaskId: draftAssignmentsByTaskId,
      assignmentsById: new Map(draft.assignments.map(assignment => [assignment.id, assignment] as const)),
      usedAssignmentIds: new Set(draft.assignments.map(assignment => assignment.id)),
      tasksById: draftTasksById,
    };
    const cellWritesByTaskId = new Map<string, CellEditIntent[]>();
    for (const write of orderedWrites) {
      if (write.kind !== 'cell-edit') continue;
      const current = cellWritesByTaskId.get(write.taskId);
      if (current) current.push(write);
      else cellWritesByTaskId.set(write.taskId, [write]);
    }
    const appliedCellTaskIds = new Set<string>();
    const progressStarts = new Map<string, string>();
    for (const write of orderedWrites) {
      if (write.kind === 'cell-edit') {
        if (appliedCellTaskIds.has(write.taskId)) continue;
        appliedCellTaskIds.add(write.taskId);
        const taskWrites = cellWritesByTaskId.get(write.taskId) ?? [write];
        const applied = applyCellEdits(
          draft, taskWrites, runtime, draftTaskIndexById, skipReadOnlyCells, startDrivenByPredecessor, plannedDates,
          draftAssignmentsByTaskId.get(write.taskId) ?? [],
          plansStatusDateToday ? today : undefined,
          progressAfterPlacement?.has(write.taskId),
        );
        if (!applied.ok) errors.push(...applied.errors);
        else {
          const currentTaskIndex = draftTaskIndexById.get(write.taskId);
          if (currentTaskIndex !== undefined) {
            draftTasksById.set(write.taskId, draft.tasks[currentTaskIndex]);
          }
          if (applied.value.timephasedGuidanceLost) timephasedLossTaskIds.add(write.taskId);
          skippedReadOnlyFromTransaction += applied.value.skippedReadOnlyCount;
          if (applied.value.skippedReadOnlyCount > 0) skippedReadOnlyTaskIds.add(write.taskId);
          if (taskWrites.length > applied.value.skippedReadOnlyCount) wroteTaskIds.add(write.taskId);
          if (applied.value.startNotice) startNotices.push(applied.value.startNotice);
          if (applied.value.recomputedWork) recomputedWork.push(...applied.value.recomputedWork);
          if (applied.value.progressStart) progressStarts.set(write.taskId, applied.value.progressStart);
        }
        if (taskWrites.some(item => String(item.columnId) === 'task.isMilestone')) {
          assignmentValidationTaskIds.add(write.taskId);
        }
      } else if (write.kind === 'assignment-set') {
        wroteTaskIds.add(write.taskId);
        assignmentValidationTaskIds.add(write.taskId);
        const applied = applyAssignmentSet(
          draft,
          write,
          draftAssignmentsByTaskId.get(write.taskId) ?? [],
          draftTasksById,
          runtime.context.resourcesById,
          assignmentApplyIndexes,
        );
        if (!applied.ok) errors.push(...applied.errors);
        else for (const taskId of applied.value.timephasedGuidanceLostTaskIds) {
          timephasedLossTaskIds.add(taskId);
        }
      } else {
        wroteTaskIds.add(write.taskId);
        const applied = applyRelationSet(
          draft as AppState,
          write,
          true,
          relationWriteCount === 1 ? runtime.context.relationIndex : undefined,
        );
        if (!applied.ok) errors.push(...applied.errors);
        else {
          appliedRelationWrites.push(write);
          predecessorDriven = null;
          relationsChanged = true;
        }
      }
    }
    if (errors.length === 0 && appliedRelationWrites.length > 0) {
      const finalGraph = validateFinalRelationGraph({
        tasks: draft.tasks, sequences: draft.sequences, before: { tasks: state.tasks, sequences: state.sequences },
      });
      if (!finalGraph.ok) errors.push(...relationCellErrors(finalGraph.errors));
    }
    if (errors.length === 0) {
      for (const taskId of wroteTaskIds) {
        const task = draftTasksById.get(taskId);
        if (task) Object.assign(task, normalizeTaskDates(task, draft));
      }
    }
    if (errors.length === 0 && appliedRelationWrites.length > 1) {
      const finalRelationIndex = buildTaskRelationIndex(draft.tasks, draft.sequences, draft.cpmResult);
      for (const write of appliedRelationWrites) {
        if (!isParsedRelationTokenArray(write.value)) continue;
        const replay = planRelationSetInBatch({
          tasks: draft.tasks,
          sequences: draft.sequences,
          ownerTaskId: write.taskId,
          direction: write.direction,
          tokens: write.value,
          relationIndex: finalRelationIndex,
        });
        if (!replay.ok) {
          errors.push(...relationCellErrors(replay.errors, write.taskId));
        } else if (replay.value.changed) {
          errors.push(validationError('relationSetConflict', { taskId: write.taskId }, {
            direction: write.direction,
          }));
        }
      }
    }
    const beforeTasksById = today && errors.length === 0
      ? new Map(state.tasks.map(task => [task.id, task] as const))
      : null;
    if (beforeTasksById) {
      for (const taskId of progressTaskIds) {
        const before = beforeTasksById.get(taskId);
        const after = draftTasksById.get(taskId);
        if (!before || !after) continue;
        const writes = cellWritesByTaskId.get(taskId) ?? [];
        const question = progressStartQuestion(before, after, writes, entryStatusDate, draft, progressStarts.get(taskId));
        if (question) {
          errors.push(validationError('actualStartRequired', { taskId }, {
            statusDate: question.statusDate, latest: question.latest,
          }));
        }
      }
    }
    if (errors.length === 0 && plansStatusDateToday && beforeTasksById) {
      const keepsProgress = [...progressTaskIds].some(taskId => {
        const before = beforeTasksById.get(taskId);
        const after = draftTasksById.get(taskId);
        return !!before && !!after && !sameValue(before, after) && hasRecordedProgress(after.time);
      });
      if (keepsProgress) {
        draft.project.statusDate = today;
        draft.project.modifiedAt = new Date().toISOString();
        notifications.push(statusDateSetTodayNotice(today!, state.ui.dateNotation));
      }
    }
    if (errors.length === 0) {
      for (const taskId of assignmentValidationTaskIds) {
        const finalAssignments = draftAssignmentsByTaskId.get(taskId) ?? [];
        if (finalAssignments.length === 0) continue;
        const validated = planTaskAssignmentSet({
          taskId,
          tokens: finalAssignments.map(assignment => ({
            assignmentId: assignment.id,
            resourceId: assignment.resourceId,
            unitsPerDay: assignment.unitsPerDay,
            curve: assignment.curve,
          })),
          tasks: draft.tasks,
          resources: draft.resources,
          assignments: draft.assignments,
          tasksById: draftTasksById,
          resourcesById: runtime.context.resourcesById,
        });
        if (!validated.ok) errors.push(...validated.errors);
      }
    }
  });
  if (errors.length > 0) return { ok: false, errors };
  const workNotice = remainingWorkRecomputedNotice(recomputedWork);
  if (workNotice) notifications.push(workNotice);

  return {
    ok: true,
    value: {
      isolated,
      documentId: state.activeDocumentId,
      notifications: [...notifications, ...startEditNotifications(startNotices, state.ui.dateNotation, state.ui.timeNotation)],
      timephasedLossCount: timephasedLossTaskIds.size,
      skippedReadOnlyCount: skippedReadOnlyFromPlanning + skippedReadOnlyFromTransaction,
      skippedReadOnlyUntouchedTaskIds: [...skippedReadOnlyTaskIds].filter(id => !wroteTaskIds.has(id)),
      skippedReadOnlyPartialTaskIds: [...skippedReadOnlyTaskIds].filter(id => wroteTaskIds.has(id)),
      label: normalized.value.length === 1 ? 'Cel bewerken' : 'Cellen bewerken',
    },
  };
}

export function prepareGridMutation(
  state: Readonly<AppState>,
  intents: readonly GridIntent[],
  options?: GridMutationOptions,
): GridResult<PreparedGridMutation, readonly CellValidationError[]> {
  const prepared = prepareGridWrites(state, intents, options);
  if (!prepared.ok) return prepared;
  const { isolated, ...mutation } = prepared.value;
  let viewRows: readonly ViewRow[];
  let resourceLoadResult: ResourceLoadResult | null;
  try {
    viewRows = deriveViewRows(isolated);
    resourceLoadResult = state.resourceLoadResult !== null && resourceLoadInputsUnchanged(state, isolated)
      ? state.resourceLoadResult
      : computeReliableResourceLoad(
      isolated.cpmResult,
      isolated.resources,
      isolated.assignments,
      isolated.tasks,
      isolated.calendar,
      isolated.calendars,
      effectiveSchedulingOptions(isolated.project),
    );
  } catch (error) {
    return { ok: false, errors: [validationError('derivedCalculation', undefined, String(error))] };
  }
  return {
    ok: true,
    value: {
      ...mutation,
      before: createSnapshot(state as AppState),
      after: createSnapshot(isolated),
      derivedAfter: { viewRows, resourceLoadResult },
    },
  };
}

function commitPreparedAgainstStore(
  get: StoreGet,
  set: StoreSet,
  prepared: PreparedGridMutation,
  requireFreshBefore = false,
  recordHistory = true,
): GridResult<void, readonly GridMutationError[]> {
  if (get().activeDocumentId !== prepared.documentId) {
    return { ok: false, errors: [{ code: 'documentChanged', message: 'Het actieve document is gewijzigd' }] };
  }
  if (requireFreshBefore && !snapshotsEqual(createSnapshot(get()), prepared.before)) {
    return { ok: false, errors: [{ code: 'stateChanged', message: 'De documentdata is na prepare gewijzigd' }] };
  }
  const changed = !snapshotsEqual(prepared.before, prepared.after);
  if (changed) {
    try {
      set(state => {
        if (state.activeDocumentId !== prepared.documentId) throw new Error('Het actieve document is gewijzigd');
        restoreSnapshot(state, prepared.after);
        state.viewRows = [...prepared.derivedAfter.viewRows];
        state.resourceLoadResult = prepared.derivedAfter.resourceLoadResult;
        markDocumentEdited(state);
        if (recordHistory) {
          recordDocumentDataHistoryDelta(
            state, prepared.label, prepared.documentId, prepared.before, prepared.after,
          );
        }
      });
    } catch (error) {
      return { ok: false, errors: [{ code: 'commitFailed', message: (error as Error).message }] };
    }
  }
  for (const notification of prepared.notifications) get().notify(notification);
  if (changed && prepared.timephasedLossCount > 0) {
    notifyTimephasedLoss(get().notify, prepared.documentId, prepared.timephasedLossCount);
  }
  if (prepared.skippedReadOnlyCount > 0) {
    const tasks = get().tasks;
    const names = (ids: readonly string[] | undefined) => (ids ?? [])
      .map(id => tasks.find(task => task.id === id)?.name)
      .filter((name): name is string => !!name);
    get().notify(refusalNotice({
      messageKey: 'notifications.pasteSkippedReadOnly',
      params: { count: prepared.skippedReadOnlyCount },
      detailLines: [
        ...refusedNamesLine(names(prepared.skippedReadOnlyUntouchedTaskIds), 'untouched'),
        ...refusedNamesLine(names(prepared.skippedReadOnlyPartialTaskIds), 'notApplied'),
      ],
    }));
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
  options?: GridMutationOptions,
): GridResult<void, readonly CellValidationError[]> {
  if (runningStores.has(get)) {
    return { ok: false, errors: [validationError('reentrant')] };
  }
  runningStores.add(get);
  try {
    if (intents.length === 0) return { ok: true, value: undefined };
    const prepared = prepareGridMutation(get(), intents, options);
    if (!prepared.ok) return prepared;
    const committed = commitPreparedAgainstStore(get, set, prepared.value, false, options?.recordHistory ?? true);
    return committed.ok
      ? { ok: true, value: undefined }
      : { ok: false, errors: committed.errors.map(error => validationError(error.code)) };
  } finally {
    runningStores.delete(get);
  }
}

export function runGridMutation(
  intents: readonly GridIntent[],
  options?: GridMutationOptions,
): GridResult<void, readonly CellValidationError[]> {
  const store = getDefaultStore();
  return runGridMutationAgainstStore(store.get, store.set, intents, options);
}

export const createGridTransactionSlice: AppSlice<GridTransactionSlice> = (set, get) => ({
  runGridMutation: (intents, options) => runGridMutationAgainstStore(get, set as StoreSet, intents, options),
});
