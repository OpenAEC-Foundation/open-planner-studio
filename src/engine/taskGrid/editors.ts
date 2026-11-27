import { displayDate, displayDateTime, parsePersonalDate } from '@/utils/displayDate';
import { formatClock, parseClock } from '@/utils/displayTime';
import type { DateNotation, TimeNotation } from '@/types/view';
import type { CellValidationError, GridResult, TaskColumnContext, TaskColumnDescriptor } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import { constraintDateSide, isDateOnly, isInstant, type InstantSide } from '@/engine/calendar/workdayRules';
import { taskDateLabel } from '@/utils/taskDateLabel';

export interface TaskGridBooleanLabels {
  true: string;
  false: string;
}

export function opensListEditor(descriptor: TaskColumnDescriptor | undefined): boolean {
  return descriptor?.editorKind === 'boolean'
    || (descriptor?.editorKind === 'enum' && descriptor.editorOptions !== undefined);
}

function normalizeBooleanLabel(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function parseGridDate(text: string, notation: DateNotation): string | null {
  return parsePersonalDate(text, notation);
}

export function parseGridDateTime(text: string, notation: DateNotation): string | null {
  const value = text.trim();
  if (!value) return null;
  const match = /^(\S+?)(?:T|\s+)(\S.*)$/.exec(value);
  if (!match) return parseGridDate(value, notation);
  const date = parseGridDate(match[1], notation);
  const minutes = parseClock(match[2]);
  if (!date || minutes === undefined) return null;
  return `${date}T${formatClock(minutes, '24h')}`;
}

export function formatGridDate(iso: string | undefined, notation: DateNotation): string {
  return displayDate(iso, notation);
}

export function formatGridDateTime(iso: string | undefined, notation: DateNotation, timeNotation: TimeNotation): string {
  return displayDateTime(iso, notation, timeNotation);
}

function failure(code: string, value: unknown): GridResult<never, readonly CellValidationError[]> {
  return { ok: false, errors: [{ code, messageKey: `taskGrid.validation.${code}`, value }] };
}

export function parseGridEditorText(
  descriptor: TaskColumnDescriptor,
  text: string,
  task: Task,
  context: TaskColumnContext,
  notation: DateNotation,
  booleanLabels?: TaskGridBooleanLabels,
): GridResult<unknown, readonly CellValidationError[]> {
  if (!descriptor.parse) return failure('readOnly', text);
  if (descriptor.valueKind === 'boolean' && booleanLabels) {
    const source = normalizeBooleanLabel(text);
    const trueLabel = normalizeBooleanLabel(booleanLabels.true);
    const falseLabel = normalizeBooleanLabel(booleanLabels.false);
    if (trueLabel !== falseLabel && source === trueLabel) return descriptor.parse('true', task, context);
    if (trueLabel !== falseLabel && source === falseLabel) return descriptor.parse('false', task, context);
  }
  if (text.trim() === '' && (descriptor.valueKind === 'date' || descriptor.valueKind === 'datetime')) {
    return descriptor.parse('', task, context);
  }
  if (descriptor.valueKind === 'date') {
    const parsed = parseGridDate(text, notation);
    return parsed === null ? failure('date', text) : descriptor.parse(parsed, task, context);
  }
  if (descriptor.valueKind === 'datetime') {
    const parsed = parseGridDateTime(text, notation);
    return parsed === null
      ? failure('datetime', text)
      : descriptor.parse(keepShownMoment(descriptor, parsed, task, context), task, context);
  }
  return descriptor.parse(text, task, context);
}

function keepShownMoment(
  descriptor: TaskColumnDescriptor,
  parsed: string,
  task: Task,
  context: TaskColumnContext,
): string {
  if (!isDateOnly(parsed)) return parsed;
  const id = String(descriptor.id);
  if (id === 'task.constraint.date' || id === 'task.constraint2.date') return parsed;
  const current = descriptor.read(task, context);
  if (typeof current !== 'string' || !isInstant(current)) return parsed;
  return gridDateLabel(descriptor, task, context, current) === parsed ? current : parsed;
}

const OWN_START = new Set(['start', 'scheduleStart', 'earlyStart', 'lateStart', 'actualStart']);
const OWN_END = new Set(['finish', 'scheduleFinish', 'earlyFinish', 'lateFinish', 'actualFinish']);

export function gridTaskDateField(columnId: string, task: Task): { side: InstantSide; milestoneOwn: boolean } | null {
  const time = /^task\.time\.(\w+)$/.exec(columnId)?.[1];
  if (time && OWN_START.has(time)) return { side: 'start', milestoneOwn: true };
  if (time && OWN_END.has(time)) return { side: 'end', milestoneOwn: true };
  if (time === 'resume') return { side: 'start', milestoneOwn: false };
  if (time === 'stop' || columnId === 'task.deadline') return { side: 'end', milestoneOwn: false };
  const constraint = columnId === 'task.constraint.date' ? task.constraint
    : columnId === 'task.constraint2.date' ? task.constraint2 : undefined;
  if (constraint) return { side: constraintDateSide(constraint.type) ?? 'start', milestoneOwn: false };
  return null;
}

function gridDateLabel(
  descriptor: TaskColumnDescriptor,
  task: Task,
  context: TaskColumnContext,
  value: string,
): string {
  const calendar = context.effectiveCalendar?.(task);
  const field = gridTaskDateField(String(descriptor.id), task);
  return calendar && field
    ? taskDateLabel(task, value, field.side, calendar, { milestoneOwn: field.milestoneOwn }) : value;
}

export function copyGridEditorValue(
  descriptor: TaskColumnDescriptor,
  task: Task,
  context: TaskColumnContext,
  notation: DateNotation,
  booleanLabels?: TaskGridBooleanLabels,
): string {
  const value = descriptor.read(task, context);
  if (descriptor.valueKind === 'boolean' && typeof value === 'boolean' && booleanLabels) {
    return booleanLabels[value ? 'true' : 'false'];
  }
  if (descriptor.valueKind === 'date' && typeof value === 'string') return formatGridDate(value, notation);
  if (descriptor.valueKind === 'datetime' && typeof value === 'string') {
    return formatGridDateTime(gridDateLabel(descriptor, task, context, value), notation, context.timeNotation ?? '24h');
  }
  return descriptor.copy(task, context);
}
