import type { WriteIFCInput } from '../ifcWriter';
import { isRunningAtFullCompletion } from '../ifcTaskSlots';
import { deriveSummaryStatus, normalizeImportedProgress, reconstructResourceIds } from '@/services/importNormalize';
import { emptyMissingScheduleDates, resolveMissingScheduleDates } from '@/services/importDates';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { canonicalizeBands } from '@/services/subdayIo';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

export type OpenedPlanning = Pick<WriteIFCInput, 'project' | 'calendar' | 'resourceCalendars' | 'tasks' | 'assignments'>;

function withCanonicalBands(calendar: WorkCalendar): WorkCalendar {
  if (!calendar.workTime && !calendar.workingExceptions?.some(exception => exception.bands)) return calendar;
  return {
    ...calendar,
    ...(calendar.workTime ? { workTime: canonicalizeBands(calendar.workTime.byWeekday).bands } : {}),
    ...(calendar.workingExceptions ? {
      workingExceptions: calendar.workingExceptions.map(exception => (exception.bands
        ? { ...exception, bands: canonicalizeBands({ 1: exception.bands }).bands.byWeekday[1] } : exception)),
    } : {}),
  };
}

export function normalizeAsOnOpen(planning: OpenedPlanning): void {
  planning.calendar = withCanonicalBands(planning.calendar);
  if (planning.resourceCalendars) planning.resourceCalendars = planning.resourceCalendars.map(withCanonicalBands);
  const { project, calendar, tasks } = planning;
  const resourceCalendars = planning.resourceCalendars ?? [];
  reconstructResourceIds(tasks, planning.assignments ?? []);
  for (const task of tasks) reconcileP6SuspendResume(task);
  const missing = emptyMissingScheduleDates();
  for (const task of tasks) {
    if (!task.time.scheduleStart) missing.start.add(task.id);
    if (!task.time.scheduleFinish) missing.finish.add(task.id);
  }
  resolveMissingScheduleDates(tasks, missing, project.startDate,
    task => resolveCalendar(task.calendarId, resourceCalendars, calendar));
  const runningAtFull = new Set(tasks.filter(isRunningAtFullCompletion).map(task => task.id));
  normalizeImportedProgress(tasks.filter(isLeafTask), project.statusDate, runningAtFull);
  deriveSummaryStatus(tasks);
}

function treeAsStepWritesIt(tasks: Task[]): void {
  const ids = new Set(tasks.map(task => task.id));
  const parentOf = new Map<string, string>();
  for (const task of tasks) {
    if (!isSummaryTask(task)) continue;
    for (const id of task.childIds) if (ids.has(id)) parentOf.set(id, task.id);
  }
  for (const task of tasks) {
    task.parentId = parentOf.get(task.id) ?? null;
    if (task.childIds.length > 0) task.childIds = [...new Set(task.childIds.filter(id => ids.has(id)))];
  }
}

function libraryAsStepWritesIt(input: OpenedPlanning): WorkCalendar[] | undefined {
  return input.resourceCalendars
    ?.filter(calendar => calendar.id === input.calendar.id || calendar.id !== input.project.calendarId)
    .map(calendar => (calendar.id === input.calendar.id ? input.calendar : calendar));
}

export function copyAsStepWritesIt<T extends OpenedPlanning>(input: T): T {
  const tasks = input.tasks.map(task => ({ ...task, time: { ...task.time } }));
  treeAsStepWritesIt(tasks);
  const resourceCalendars = libraryAsStepWritesIt(input);
  return { ...input, tasks, ...(resourceCalendars ? { resourceCalendars } : {}) };
}

export function normalizedCopy<T extends OpenedPlanning>(input: T): T {
  const copy = copyAsStepWritesIt(input);
  normalizeAsOnOpen(copy);
  return copy;
}
