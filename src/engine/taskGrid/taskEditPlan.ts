import { validateConstraintPair } from '@/engine/scheduler/constraintValidation';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { decodeDynamicTaskColumnId } from '@/engine/taskGrid/fieldIds';
import {
  applyProgressInvariants,
  assignTaskActivityCode,
  assignTaskCustomField,
  isActualPastStatusDate,
} from '@/engine/taskMutationRules';
import type { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import type {
  ConstraintType,
  MilestoneKind,
  Task,
  TaskStatus,
  TaskType,
} from '@/types/task';
import type {
  CellEditIntent,
  CellValidationError,
  GridResult,
} from '@/types/taskGrid';
import { parseInstant } from '@/utils/dateUtils';
import {
  clearTimephasedDurationWalks,
  clearTimephasedWindow,
  timephasedDurationWalksHaveFrozenWork,
} from '@/utils/taskDefaults';

const TASK_TYPES: readonly TaskType[] = [
  'CONSTRUCTION', 'INSTALLATION', 'DEMOLITION', 'LOGISTIC', 'ATTENDANCE',
  'MOVE', 'RENOVATION', 'MAINTENANCE', 'USERDEFINED',
];
const TASK_STATUSES: readonly TaskStatus[] = ['NOT_STARTED', 'STARTED', 'COMPLETED'];
const MILESTONE_KINDS: readonly MilestoneKind[] = ['START', 'FINISH'];
const CONSTRAINT_TYPES: readonly ConstraintType[] = [
  'ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO',
];

export interface TaskEditPlanEnvironment {
  projectId: string;
  wbsAutoNumber: boolean;
  statusDate?: string;
  calendarIds: ReadonlySet<string>;
  effectiveHoursPerDay: number;
  hourMode: boolean;
  activityCodeTypes: readonly ActivityCodeType[];
  customFieldDefs: readonly CustomFieldDef[];
}

export interface PlannedTaskEdit {
  task: Task;
  changed: boolean;
  timephasedGuidanceLost: boolean;
  scheduleStale: boolean;
}

function failure(
  code: string,
  edit: CellEditIntent,
  value: unknown = edit.value,
): GridResult<never, readonly CellValidationError[]> {
  return {
    ok: false,
    errors: [{
      code,
      messageKey: `taskGrid.validation.${code}`,
      taskId: edit.taskId,
      columnId: edit.columnId,
      value,
    }],
  };
}

function cloneTaskForEdit(task: Task): Task {
  return {
    ...task,
    time: { ...task.time },
    activityCodes: task.activityCodes ? { ...task.activityCodes } : undefined,
    customFields: task.customFields ? { ...task.customFields } : undefined,
    notes: task.notes ? task.notes.map(note => ({ ...note })) : undefined,
    constraint: task.constraint ? { ...task.constraint } : undefined,
    constraint2: task.constraint2 ? { ...task.constraint2 } : undefined,
  };
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function optionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

function expectedRoute(columnId: string): CellEditIntent['route'] | null {
  if (columnId.startsWith('activity-code:')) return 'activity-code';
  if (columnId.startsWith('custom-field:')) return 'custom-field';
  if (columnId === 'task.status' || columnId.startsWith('task.time.actual')
    || columnId === 'task.time.remainingTime' || columnId === 'task.time.completion') {
    return 'task-progress';
  }
  if (columnId === 'task.isMilestone' || columnId === 'task.milestoneKind'
    || columnId === 'task.mandatory') return 'task-milestone';
  if (columnId.startsWith('task.constraint') || columnId === 'task.deadline') return 'task-constraint';
  if (columnId === 'task.isHammock') return 'task-hammock';
  if (columnId === 'task.calendarId' || columnId.startsWith('task.time.schedule')
    || columnId === 'task.time.durationType') return 'task-schedule';
  if (columnId === 'task.name' || columnId === 'task.description' || columnId === 'task.wbsCode'
    || columnId === 'task.taskType' || columnId === 'task.priority' || columnId === 'task.color'
    || columnId === 'task.notes') {
    return 'task-field';
  }
  return null;
}

function clearScheduleGuidance(task: Task, clearFrozenWalks: boolean): boolean {
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = clearFrozenWalks && timephasedDurationWalksHaveFrozenWork(task)
    ? clearTimephasedDurationWalks(task)
    : false;
  return clearedWindow || clearedWalks;
}

function applyTaskField(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  if (id === 'task.name') {
    if (typeof edit.value !== 'string' || !edit.value.trim()) return failure('required', edit);
    task.name = edit.value;
  } else if (id === 'task.description') {
    if (typeof edit.value !== 'string') return failure('text', edit);
    task.description = edit.value;
  } else if (id === 'task.wbsCode') {
    if (environment.wbsAutoNumber) return failure('readOnly', edit);
    if (typeof edit.value !== 'string' || !edit.value.trim()) return failure('required', edit);
    task.wbsCode = edit.value;
  } else if (id === 'task.taskType') {
    if (typeof edit.value !== 'string' || !TASK_TYPES.includes(edit.value as TaskType)) {
      return failure('enum', edit);
    }
    task.taskType = edit.value as TaskType;
  } else if (id === 'task.priority') {
    if (!finite(edit.value) || !Number.isInteger(edit.value) || edit.value < 0 || edit.value > 1000) {
      return failure('range', edit);
    }
    task.priority = edit.value;
  } else if (id === 'task.color') {
    if (!optionalString(edit.value)) return failure('color', edit);
    task.color = edit.value;
  } else if (id === 'task.notes') {
    if (typeof edit.value !== 'string') return failure('text', edit);
    if ((task.notes?.length ?? 0) > 1) return failure('readOnly', edit);
    if (task.notes?.[0]) task.notes[0].text = edit.value;
    else if (edit.value !== '') {
      task.notes = [{ id: `grid-note:${task.id}`, text: edit.value, done: false }];
    }
  } else {
    return failure('plannerNotAvailable', edit);
  }
  return { ok: true, value: undefined };
}

function applyScheduleEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<boolean, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  let lost = false;
  if (id === 'task.time.durationType') {
    if (edit.value !== 'WORKTIME' && edit.value !== 'ELAPSEDTIME') return failure('enum', edit);
    if (task.time.durationType !== edit.value) {
      task.time.durationType = edit.value;
      lost = clearScheduleGuidance(task, true);
    }
  } else if (id === 'task.time.scheduleDuration') {
    if (!finite(edit.value) || edit.value < 0) return failure('duration', edit);
    if (task.isHammock) return failure('readOnly', edit);
    const hoursPerDay = environment.effectiveHoursPerDay;
    if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) return failure('calendarHours', edit);
    const days = edit.value / (hoursPerDay * 60);
    if (task.time.scheduleDuration !== days
      || (environment.hourMode ? task.time.durationMinutes !== edit.value : task.time.durationMinutes !== undefined)) {
      task.time.scheduleDuration = days;
      if (environment.hourMode) task.time.durationMinutes = edit.value;
      else delete task.time.durationMinutes;
      lost = clearScheduleGuidance(task, true);
    }
  } else if (id === 'task.time.scheduleStart' || id === 'task.time.scheduleFinish') {
    if (!optionalString(edit.value)) return failure('date', edit);
    const key = id === 'task.time.scheduleStart' ? 'scheduleStart' : 'scheduleFinish';
    if (edit.value === undefined) return failure('required', edit);
    if (task.time[key] !== edit.value) {
      task.time[key] = edit.value;
      lost = clearScheduleGuidance(task, true);
    }
  } else if (id === 'task.calendarId') {
    if (!optionalString(edit.value)) return failure('calendar', edit);
    if (edit.value !== undefined && !environment.calendarIds.has(edit.value)) {
      return failure('calendarNotFound', edit);
    }
    if (task.calendarId !== edit.value) {
      task.calendarId = edit.value;
      lost = clearScheduleGuidance(task, false);
    }
  } else {
    return failure('plannerNotAvailable', edit);
  }
  return { ok: true, value: lost };
}

function applyMilestoneEdit(
  task: Task,
  edit: CellEditIntent,
): GridResult<boolean, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  let scheduleChanged = false;
  if (id === 'task.isMilestone') {
    if (typeof edit.value !== 'boolean') return failure('boolean', edit);
    if (task.isMilestone !== edit.value) {
      const transition = taskMilestoneTransition(task, edit.value);
      scheduleChanged = transition.time !== undefined
        && (task.time.scheduleDuration !== transition.time.scheduleDuration
          || task.time.durationMinutes !== transition.time.durationMinutes);
      const { time, ...fields } = transition;
      Object.assign(task, fields);
      if (time) task.time = time;
    }
  } else if (id === 'task.milestoneKind') {
    if (!task.isMilestone) return failure('milestoneRequired', edit);
    if (edit.value !== undefined
      && (typeof edit.value !== 'string' || !MILESTONE_KINDS.includes(edit.value as MilestoneKind))) {
      return failure('enum', edit);
    }
    task.milestoneKind = edit.value as MilestoneKind | undefined;
  } else if (id === 'task.mandatory') {
    if (!task.isMilestone) return failure('milestoneRequired', edit);
    if (!optionalBoolean(edit.value)) return failure('boolean', edit);
    task.mandatory = edit.value || undefined;
  } else {
    return failure('plannerNotAvailable', edit);
  }
  return { ok: true, value: scheduleChanged ? clearScheduleGuidance(task, true) : false };
}

function applyStatus(task: Task, status: TaskStatus, statusDate: string | undefined): void {
  if (status === 'NOT_STARTED') {
    task.time.completion = 0;
    task.time.actualStart = undefined;
    task.time.actualFinish = undefined;
  } else if (status === 'STARTED') {
    if (task.time.completion >= 1) task.time.completion = 0;
    task.time.actualFinish = undefined;
    task.time.actualStart ||= task.time.earlyStart || task.time.scheduleStart;
  } else {
    task.time.completion = 1;
  }
  applyProgressInvariants(task, statusDate);
}

function applyProgressEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  if (id === 'task.status') {
    if (typeof edit.value !== 'string' || !TASK_STATUSES.includes(edit.value as TaskStatus)) {
      return failure('enum', edit);
    }
    applyStatus(task, edit.value as TaskStatus, environment.statusDate);
  } else if (id === 'task.time.completion') {
    if (!finite(edit.value) || edit.value < 0 || edit.value > 1) return failure('percentage', edit);
    task.time.completion = edit.value;
    if (edit.value > 0 && !task.time.actualStart) {
      task.time.actualStart = task.time.earlyStart || task.time.scheduleStart;
    }
    if (edit.value < 1) task.time.actualFinish = undefined;
    applyProgressInvariants(task, environment.statusDate);
  } else if (id === 'task.time.actualStart' || id === 'task.time.actualFinish') {
    if (!optionalString(edit.value)) return failure('date', edit);
    if (edit.value && environment.statusDate
      && isActualPastStatusDate(edit.value, environment.statusDate)) {
      return failure('actualAfterStatusDate', edit);
    }
    if (id === 'task.time.actualStart') task.time.actualStart = edit.value || undefined;
    else {
      task.time.actualFinish = edit.value || undefined;
      if (!edit.value && task.time.completion >= 1) task.time.completion = 0;
    }
    if (task.time.actualStart && task.time.actualFinish
      && parseInstant(task.time.actualFinish).getTime() < parseInstant(task.time.actualStart).getTime()) {
      return failure('actualFinishBeforeStart', edit);
    }
    applyProgressInvariants(task, environment.statusDate);
  } else if (id === 'task.time.actualDuration' || id === 'task.time.remainingTime') {
    if (edit.value !== undefined && (!finite(edit.value) || edit.value < 0)) {
      return failure('duration', edit);
    }
    const hoursPerDay = environment.effectiveHoursPerDay;
    if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) return failure('calendarHours', edit);
    if (edit.value === undefined) {
      if (id === 'task.time.actualDuration') task.time.actualDuration = undefined;
      else {
        task.time.remainingTime = undefined;
        task.time.remainingMinutes = undefined;
      }
      applyProgressInvariants(task, environment.statusDate);
      return { ok: true, value: undefined };
    }
    const days = edit.value / (hoursPerDay * 60);
    const total = environment.hourMode
      ? task.time.durationMinutes ?? task.time.scheduleDuration * hoursPerDay * 60
      : task.time.scheduleDuration;
    const ownValue = environment.hourMode ? edit.value : days;
    if (id === 'task.time.actualDuration') {
      task.time.actualDuration = days;
      task.time.completion = total > 0 ? Math.max(0, Math.min(1, ownValue / total)) : 1;
    } else {
      task.time.remainingTime = days;
      if (environment.hourMode) task.time.remainingMinutes = edit.value;
      else task.time.remainingMinutes = undefined;
      task.time.completion = total > 0 ? Math.max(0, Math.min(1, 1 - ownValue / total)) : 1;
    }
    if (task.time.completion > 0 && !task.time.actualStart) {
      task.time.actualStart = task.time.earlyStart || task.time.scheduleStart;
    }
    if (task.time.completion < 1) task.time.actualFinish = undefined;
    applyProgressInvariants(task, environment.statusDate);
    if (id === 'task.time.remainingTime') {
      task.time.remainingTime = days;
      if (environment.hourMode) task.time.remainingMinutes = edit.value;
    }
  } else {
    return failure('plannerNotAvailable', edit);
  }
  return { ok: true, value: undefined };
}

function nextConstraintType(
  task: Task,
  edit: CellEditIntent,
  secondary: boolean,
): GridResult<void, readonly CellValidationError[]> {
  if (edit.value !== undefined
    && (typeof edit.value !== 'string' || !CONSTRAINT_TYPES.includes(edit.value as ConstraintType))) {
    return failure('enum', edit);
  }
  const value = edit.value as ConstraintType | undefined;
  if (secondary) {
    task.constraint2 = value === undefined
      ? undefined
      : { type: value, date: task.constraint2?.date ?? task.time.scheduleStart };
  } else if (value === 'ASAP' || value === undefined) {
    task.constraint = undefined;
    task.constraint2 = undefined;
  } else if (value === 'ALAP') {
    task.constraint = { type: value };
    task.constraint2 = undefined;
  } else {
    const hard = value === 'MSO' || value === 'MFO' ? task.constraint?.hard : undefined;
    task.constraint = { type: value, date: task.constraint?.date ?? task.time.scheduleStart, hard };
  }
  return { ok: true, value: undefined };
}

function applyConstraintEdit(
  task: Task,
  edit: CellEditIntent,
  validatePair = true,
): GridResult<void, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  let result: GridResult<void, readonly CellValidationError[]> = { ok: true, value: undefined };
  if (id === 'task.constraint.type') result = nextConstraintType(task, edit, false);
  else if (id === 'task.constraint2.type') result = nextConstraintType(task, edit, true);
  else if (id === 'task.constraint.date') {
    if (!task.constraint || task.constraint.type === 'ASAP' || task.constraint.type === 'ALAP') {
      return failure('constraintDateUnavailable', edit);
    }
    if (!optionalString(edit.value) || edit.value === undefined) return failure('required', edit);
    task.constraint.date = edit.value;
  } else if (id === 'task.constraint2.date') {
    if (!task.constraint2) return failure('constraintDateUnavailable', edit);
    if (!optionalString(edit.value) || edit.value === undefined) return failure('required', edit);
    task.constraint2.date = edit.value;
  } else if (id === 'task.constraint.hard') {
    if (typeof edit.value !== 'boolean') return failure('boolean', edit);
    if (!task.constraint || (task.constraint.type !== 'MSO' && task.constraint.type !== 'MFO')) {
      return failure('constraintHardUnavailable', edit);
    }
    task.constraint.hard = edit.value || undefined;
  } else if (id === 'task.deadline') {
    if (!optionalString(edit.value)) return failure('date', edit);
    task.deadline = edit.value;
  } else return failure('plannerNotAvailable', edit);
  if (!result.ok) return result;
  if (validatePair) {
    const pair = validateConstraintPair(task.constraint, task.constraint2);
    if (!pair.ok) return failure(`constraintPair.${pair.issues[0]}`, edit, pair.issues);
  }
  return { ok: true, value: undefined };
}

function applyProgressEdits(
  task: Task,
  edits: readonly CellEditIntent[],
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const byId = new Map(edits.map(edit => [String(edit.columnId), edit] as const));
  const first = edits[0]!;
  const statusEdit = byId.get('task.status');
  const completionEdit = byId.get('task.time.completion');
  const actualStartEdit = byId.get('task.time.actualStart');
  const actualFinishEdit = byId.get('task.time.actualFinish');
  const actualDurationEdit = byId.get('task.time.actualDuration');
  const remainingEdit = byId.get('task.time.remainingTime');

  if (statusEdit && (typeof statusEdit.value !== 'string'
    || !TASK_STATUSES.includes(statusEdit.value as TaskStatus))) return failure('enum', statusEdit);
  if (completionEdit && (!finite(completionEdit.value)
    || completionEdit.value < 0 || completionEdit.value > 1)) return failure('percentage', completionEdit);
  for (const edit of [actualStartEdit, actualFinishEdit]) {
    if (!edit) continue;
    if (!optionalString(edit.value)) return failure('date', edit);
    if (edit.value && environment.statusDate && isActualPastStatusDate(edit.value, environment.statusDate)) {
      return failure('actualAfterStatusDate', edit);
    }
  }
  for (const edit of [actualDurationEdit, remainingEdit]) {
    if (edit && edit.value !== undefined && (!finite(edit.value) || edit.value < 0)) {
      return failure('duration', edit);
    }
  }
  if ((actualDurationEdit || remainingEdit)
    && (!Number.isFinite(environment.effectiveHoursPerDay) || environment.effectiveHoursPerDay <= 0)) {
    return failure('calendarHours', actualDurationEdit ?? remainingEdit ?? first);
  }

  const hoursPerDay = environment.effectiveHoursPerDay;
  const total = environment.hourMode
    ? task.time.durationMinutes ?? task.time.scheduleDuration * hoursPerDay * 60
    : task.time.scheduleDuration;
  const toDays = (value: number): number => value / (hoursPerDay * 60);
  let desiredCompletion = completionEdit ? completionEdit.value as number : undefined;
  const derivedCompletions: number[] = [];
  if (actualDurationEdit?.value !== undefined) {
    const own = environment.hourMode ? actualDurationEdit.value as number : toDays(actualDurationEdit.value as number);
    derivedCompletions.push(total > 0 ? Math.max(0, Math.min(1, own / total)) : 1);
  }
  if (remainingEdit?.value !== undefined) {
    const own = environment.hourMode ? remainingEdit.value as number : toDays(remainingEdit.value as number);
    derivedCompletions.push(total > 0 ? Math.max(0, Math.min(1, 1 - own / total)) : 1);
  }
  if (derivedCompletions.some(value => Math.abs(value - derivedCompletions[0]!) > 1e-9)
    || (desiredCompletion !== undefined
      && derivedCompletions.some(value => Math.abs(value - desiredCompletion!) > 1e-9))) {
    return failure('conflictingProgressInputs', completionEdit ?? actualDurationEdit ?? remainingEdit ?? first);
  }
  desiredCompletion ??= derivedCompletions[0];

  const desiredStatus = statusEdit?.value as TaskStatus | undefined;
  let desiredActualStart = actualStartEdit ? (actualStartEdit.value as string | undefined) || undefined : task.time.actualStart;
  let desiredActualFinish = actualFinishEdit ? (actualFinishEdit.value as string | undefined) || undefined : task.time.actualFinish;
  // Niet meegeschreven actuals zijn geen expliciete gewenste invoer. Een completion/status-write
  // moet ze in een brede paste precies zo kunnen canonicaliseren als bij een enkelvoudige edit.
  if (!actualFinishEdit && ((desiredCompletion !== undefined && desiredCompletion < 1)
    || desiredStatus === 'STARTED' || desiredStatus === 'NOT_STARTED')) {
    desiredActualFinish = undefined;
  }
  if (!actualStartEdit && desiredStatus === 'NOT_STARTED') desiredActualStart = undefined;
  if (desiredActualFinish) {
    if ((desiredCompletion !== undefined && desiredCompletion !== 1)
      || (desiredStatus !== undefined && desiredStatus !== 'COMPLETED')) {
      return failure('conflictingProgressInputs', actualFinishEdit ?? completionEdit ?? statusEdit ?? first);
    }
    desiredCompletion = 1;
  }
  if (desiredStatus === 'COMPLETED') {
    if ((desiredCompletion !== undefined && desiredCompletion !== 1)
      || (actualFinishEdit && !desiredActualFinish)) {
      return failure('conflictingProgressInputs', statusEdit!);
    }
    desiredCompletion = 1;
  } else if (desiredStatus === 'NOT_STARTED') {
    if ((desiredCompletion !== undefined && desiredCompletion !== 0)
      || (actualStartEdit && !!desiredActualStart) || (actualFinishEdit && !!desiredActualFinish)) {
      return failure('conflictingProgressInputs', statusEdit!);
    }
    desiredCompletion = 0;
  } else if (desiredStatus === 'STARTED') {
    if ((desiredCompletion !== undefined && desiredCompletion >= 1) || desiredActualFinish) {
      return failure('conflictingProgressInputs', statusEdit!);
    }
    desiredCompletion ??= task.time.completion >= 1 ? 0 : task.time.completion;
  }
  if (desiredActualStart && desiredActualFinish
    && parseInstant(desiredActualFinish).getTime() < parseInstant(desiredActualStart).getTime()) {
    return failure('actualFinishBeforeStart', actualFinishEdit ?? actualStartEdit ?? first);
  }

  if (actualDurationEdit) {
    task.time.actualDuration = actualDurationEdit.value === undefined
      ? undefined
      : toDays(actualDurationEdit.value as number);
  }
  if (remainingEdit) {
    task.time.remainingTime = remainingEdit.value === undefined
      ? undefined
      : toDays(remainingEdit.value as number);
    task.time.remainingMinutes = environment.hourMode && remainingEdit.value !== undefined
      ? remainingEdit.value as number
      : undefined;
  }
  if (actualStartEdit) task.time.actualStart = desiredActualStart;
  if (actualFinishEdit) task.time.actualFinish = desiredActualFinish;
  if (desiredCompletion !== undefined) {
    task.time.completion = desiredCompletion;
    if (desiredCompletion > 0 && !task.time.actualStart) {
      task.time.actualStart = task.time.earlyStart || task.time.scheduleStart;
    }
    if (desiredCompletion < 1 && !actualFinishEdit) task.time.actualFinish = undefined;
  }
  if (desiredStatus === 'NOT_STARTED') {
    task.time.actualStart = undefined;
    task.time.actualFinish = undefined;
  } else if (desiredStatus === 'STARTED') {
    task.time.actualFinish = undefined;
    task.time.actualStart ||= task.time.earlyStart || task.time.scheduleStart;
  }
  applyProgressInvariants(task, environment.statusDate);
  if (remainingEdit) {
    task.time.remainingTime = remainingEdit.value === undefined
      ? undefined
      : toDays(remainingEdit.value as number);
    task.time.remainingMinutes = environment.hourMode && remainingEdit.value !== undefined
      ? remainingEdit.value as number
      : undefined;
  }
  if (desiredStatus !== undefined && task.status !== desiredStatus) {
    return failure('conflictingProgressInputs', statusEdit!);
  }
  return { ok: true, value: undefined };
}

function applyDynamicEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const decoded = decodeDynamicTaskColumnId(String(edit.columnId));
  if (!decoded || decoded.projectId !== environment.projectId) return failure('projectMismatch', edit);
  if (decoded.kind === 'activity-code') {
    if (edit.route !== 'activity-code') return failure('routeMismatch', edit);
    const type = environment.activityCodeTypes.find(candidate => candidate.id === decoded.typeId);
    if (!type) return failure('activityCodeTypeNotFound', edit);
    if (edit.value !== undefined
      && (typeof edit.value !== 'string' || !type.values.some(value => value.id === edit.value))) {
      return failure('activityCode', edit);
    }
    assignTaskActivityCode(task, decoded.typeId, edit.value);
    return { ok: true, value: undefined };
  }
  if (decoded.kind === 'custom-field') {
    if (edit.route !== 'custom-field') return failure('routeMismatch', edit);
    const def = environment.customFieldDefs.find(candidate => candidate.id === decoded.defId);
    if (!def) return failure('customFieldNotFound', edit);
    if (!validCustomFieldValue(def, edit.value)) return failure('customFieldType', edit);
    assignTaskCustomField(task, decoded.defId, edit.value as CustomFieldValue | undefined);
    return { ok: true, value: undefined };
  }
  return failure('readOnly', edit);
}

function validCustomFieldValue(def: CustomFieldDef, value: unknown): boolean {
  if (value === undefined) return true;
  if (def.type === 'text' || def.type === 'date') return typeof value === 'string';
  if (def.type === 'boolean') return typeof value === 'boolean';
  if (def.type === 'integer') return finite(value) && Number.isInteger(value);
  return finite(value);
}

/**
 * Plant één reeds door de descriptor geparseerde celwrite tegen een losstaande taakkopie.
 * De invoertaak blijft byte-voor-byte ongemoeid; de transactie publiceert de uitkomst pas nadat
 * alle intents in dezelfde geïsoleerde draft geldig zijn bevonden.
 */
/** Alles wat één celwrite oplevert, BEHALVE `changed` — die vergelijking is een volledige
 * `JSON.stringify(task)` van beide kanten en dus verreweg de duurste stap hier. Losgetrokken van
 * `planTaskCellEdit` omdat `planTaskCellEdits` (meervoud) deze functie per deelwrite in een lus
 * aanroept zonder ooit naar `changed` te kijken (zie daar) — die tussentijdse `changed`-berekening
 * was dus zuiver verspilde rekentijd, gemeten als de dominante kost achter de bulk-plak-bevriezing
 * uit de eindreview (2.000 taken × 27 kolommen). `planTaskCellEdit` blijft voor externe aanroepers
 * de volledige, ongewijzigde vorm — inclusief `changed` — leveren. */
function applyOneCellEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<Omit<PlannedTaskEdit, 'changed'>, readonly CellValidationError[]> {
  if (task.id !== edit.taskId) return failure('taskMismatch', edit);
  const id = String(edit.columnId);
  const expected = expectedRoute(id);
  if (!expected) return failure('plannerNotAvailable', edit);
  if (expected !== edit.route) return failure('routeMismatch', edit);
  const next = cloneTaskForEdit(task);
  let result: GridResult<unknown, readonly CellValidationError[]>;
  let timephasedGuidanceLost = false;
  if (edit.route === 'task-field') result = applyTaskField(next, edit, environment);
  else if (edit.route === 'task-schedule') {
    const scheduleResult = applyScheduleEdit(next, edit, environment);
    result = scheduleResult;
    if (scheduleResult.ok) timephasedGuidanceLost = scheduleResult.value;
  } else if (edit.route === 'task-milestone') {
    const milestoneResult = applyMilestoneEdit(next, edit);
    result = milestoneResult;
    if (milestoneResult.ok) timephasedGuidanceLost = milestoneResult.value;
  } else if (edit.route === 'task-progress') result = applyProgressEdit(next, edit, environment);
  else if (edit.route === 'task-constraint') result = applyConstraintEdit(next, edit);
  else if (edit.route === 'task-hammock') {
    if (typeof edit.value !== 'boolean') result = failure('boolean', edit);
    else if (edit.value && (next.isMilestone || next.childIds.length > 0)) {
      result = failure('hammockUnavailable', edit);
    } else {
      next.isHammock = edit.value || undefined;
      result = { ok: true, value: undefined };
    }
  } else result = applyDynamicEdit(next, edit, environment);
  if (!result.ok) return result;
  const scheduleStale = edit.route === 'task-schedule'
    || edit.route === 'task-progress'
    || edit.route === 'task-milestone'
    || edit.route === 'task-constraint'
    || edit.route === 'task-hammock'
    || String(edit.columnId) === 'task.priority';
  return { ok: true, value: { task: next, timephasedGuidanceLost, scheduleStale } };
}

export function planTaskCellEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
  const applied = applyOneCellEdit(task, edit, environment);
  if (!applied.ok) return applied;
  return {
    ok: true,
    value: {
      ...applied.value,
      changed: JSON.stringify(task) !== JSON.stringify(applied.value.task),
    },
  };
}

/**
 * Plant alle celwrites van één taak als één gewenste taaktoestand. Constraintparen en
 * voortgangsvelden worden pas na de volledige groep gecanonicaliseerd en gevalideerd; hun
 * tijdelijke tussenstanden zijn geen gebruikersdata en mogen de uitkomst niet bepalen.
 */
export function planTaskCellEdits(
  task: Task,
  edits: readonly CellEditIntent[],
  environment: TaskEditPlanEnvironment,
): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
  if (edits.length === 0) {
    return {
      ok: true,
      value: { task, changed: false, timephasedGuidanceLost: false, scheduleStale: false },
    };
  }
  if (edits.length === 1) return planTaskCellEdit(task, edits[0], environment);
  for (const edit of edits) {
    if (task.id !== edit.taskId) return failure('taskMismatch', edit);
    const expected = expectedRoute(String(edit.columnId));
    if (!expected) return failure('plannerNotAvailable', edit);
    if (expected !== edit.route) return failure('routeMismatch', edit);
  }

  let next = cloneTaskForEdit(task);
  let timephasedGuidanceLost = false;
  let scheduleStale = false;
  const constraintEdits = edits.filter(edit => edit.route === 'task-constraint');
  const progressEdits = edits.filter(edit => edit.route === 'task-progress');
  for (const edit of edits) {
    if (edit.route === 'task-constraint' || edit.route === 'task-progress') continue;
    // applyOneCellEdit, niet planTaskCellEdit: deze lus keek nooit naar `.changed` van een
    // tussenstap, dus de dure JSON.stringify-vergelijking hierboven was hier pure verspilling.
    const planned = applyOneCellEdit(next, edit, environment);
    if (!planned.ok) return planned;
    next = planned.value.task;
    timephasedGuidanceLost ||= planned.value.timephasedGuidanceLost;
    scheduleStale ||= planned.value.scheduleStale;
  }
  if (constraintEdits.length > 0) {
    const constraintRank = (edit: CellEditIntent): number => {
      const id = String(edit.columnId);
      if (id === 'task.constraint.type') return 0;
      if (id === 'task.constraint2.type') return 1;
      if (id === 'task.constraint.date') return 2;
      if (id === 'task.constraint2.date') return 3;
      if (id === 'task.constraint.hard') return 4;
      return 5;
    };
    const ordered = constraintEdits
      .map((edit, index) => ({ edit, index, rank: constraintRank(edit) }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map(item => item.edit);
    for (const edit of ordered) {
      const applied = applyConstraintEdit(next, edit, false);
      if (!applied.ok) return applied;
    }
    const pair = validateConstraintPair(next.constraint, next.constraint2);
    if (!pair.ok) {
      return failure(`constraintPair.${pair.issues[0]}`, ordered[ordered.length - 1], pair.issues);
    }
    scheduleStale = true;
  }
  if (progressEdits.length > 0) {
    const applied = applyProgressEdits(next, progressEdits, environment);
    if (!applied.ok) return applied;
    scheduleStale = true;
  }
  return {
    ok: true,
    value: {
      task: next,
      changed: JSON.stringify(task) !== JSON.stringify(next),
      timephasedGuidanceLost,
      scheduleStale,
    },
  };
}
