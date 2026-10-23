import { displayDate, displayDateTime, parsePersonalDate } from '@/utils/displayDate';
import { formatClock, parseClock } from '@/utils/displayTime';
import type { DateNotation, TimeNotation } from '@/types/view';
import type { CellValidationError, GridResult, TaskColumnContext, TaskColumnDescriptor } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import { blocksClock, ELAPSED_CLOCK, workdayBoundaryLabel } from '@/engine/calendar/workdayRules';
import { isElapsedTask, isZeroDurationMilestone } from '@/engine/scheduler/duration';

export interface TaskGridBooleanLabels {
  true: string;
  false: string;
}

function normalizeBooleanLabel(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/** Parse precies de persoonlijke volgorde; ISO blijft in iedere notatie als uitwisselvorm geldig. */
export function parseGridDate(text: string, notation: DateNotation): string | null {
  return parsePersonalDate(text, notation);
}

/**
 * Datum met optionele tijd. De tijd volgt de tijdparser (`parseClock`): `13:00`, `1300`, `1:00 PM`
 * en `1 pm` zijn allemaal geldig, in beide tijdnotaties. De uitkomst is altijd ISO, 24 uur.
 */
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

/** Adapter rond de registryparser: alleen datumweergave wordt vóór de domeinparser naar ISO vertaald. */
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
    return parsed === null ? failure('datetime', text) : descriptor.parse(parsed, task, context);
  }
  return descriptor.parse(text, task, context);
}

/** Klembord volgt persoonlijke datumnotatie; alle overige canonieke vormen blijven bij de registry. */
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
    const calendar = context.effectiveCalendar?.(task);
    const column = String(descriptor.id);
    const taskDate = /^task\.time\.(start|finish|scheduleStart|scheduleFinish|earlyStart|earlyFinish|lateStart|lateFinish|actualStart|actualFinish|resume|stop)$/.test(column);
    const side = isZeroDurationMilestone(task)
      ? task.milestoneKind === 'FINISH' ? 'end' : 'start'
      : /finish|stop/i.test(column) ? 'end' : 'start';
    const label = calendar && taskDate
      ? workdayBoundaryLabel(isElapsedTask(task) ? ELAPSED_CLOCK : blocksClock(calendar), value, side) : value;
    return formatGridDateTime(label, notation, context.timeNotation ?? '24h');
  }
  return descriptor.copy(task, context);
}
