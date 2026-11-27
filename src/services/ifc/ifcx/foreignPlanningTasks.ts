import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { recordedTaskTime, type RecordedTime } from '@/engine/scheduler/recordedDates';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { isPinnedComplete } from '@/engine/scheduler/duration';
import { hourRemainingDays } from '@/engine/taskMutationRules';
import { MS_PER_DAY, parseInstant } from '@/utils/dateUtils';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';
import { shownFinish, shownStart } from '@/utils/taskDates';
import type { ElementLink } from '../foreign/elementLinks';
import { ALL_RECORDED_SLOT_KEYS, type RecordedFieldKey } from '../ifcTaskSlots';
import { emptyTask, derivedTaskStatus, remainingIsDerived, TASK_FIELDS, type TaskReadTarget } from './fields/taskFields';
import { childrenInPlace } from './childOrder';
import { taskWindow } from './dateProjection';
import { PlanningIdentities, supplied } from './foreignPlanningObjects';
import type { SourceNode } from './foreignPlanningSource';
import { ATTRIBUTE } from './profile';
import { hourDurationIsDerived } from './projection';

function readTask(node: SourceNode, ids: PlanningIdentities) {
  const shared = node.attributes.get(ATTRIBUTE.activity)!;
  const ops = node.attributes.get(ATTRIBUTE.opsTask);
  const task = emptyTask();
  const target: TaskReadTarget = { task, path: node.path, unrecorded: [] };
  if (ops) supplied(TASK_FIELDS, ops, target);
  supplied(TASK_FIELDS, {
    ...shared,
    ...(shared.identification !== undefined ? { wbsCode: shared.identification } : {}),
    ...(shared.predefinedType !== undefined ? { taskType: shared.predefinedType } : {}),
  }, target);
  task.id = ids.add('task', node.path, ops?.id as string | undefined);
  task.name = (shared.name as string | undefined) ?? node.label ?? task.name;
  task.status = derivedTaskStatus(task.time);
  return { node, target, task, shared, ops };
}

function readWindow(row: ReturnType<typeof readTask>, calendar: WorkCalendar) {
  const { task, shared, ops, target } = row;
  const { time } = task;
  const projected = taskWindow(task);
  const start = shownStart(task);
  const finish = shownFinish(task);
  if (!start && !finish) {
    task.manuallyScheduled = true;
    time.durationType = 'ELAPSEDTIME';
  }
  const sharedStart = shared.start as string | undefined;
  const sharedEnd = shared.endExclusive as string | undefined;
  const changedStart = projected.start !== sharedStart;
  const changedEnd = projected.endExclusive !== sharedEnd;
  const useSharedStart = changedStart || (sharedStart !== undefined && !start.includes('T'));
  const useSharedEnd = changedEnd || (sharedEnd !== undefined && !finish.includes('T'));
  const readStart = useSharedStart ? (sharedStart ? sharedStart + 'T00:00' : '') : start;
  const readFinish = useSharedEnd ? (sharedEnd ? sharedEnd + 'T00:00' : '') : finish;
  const precise = ops?.time as Record<string, unknown> | undefined;
  const recorded = new Set<RecordedFieldKey>(ALL_RECORDED_SLOT_KEYS.filter(key =>
    precise?.[key] !== undefined && precise[key] !== '' && !target.unrecorded.includes(key)));
  const convert = !task.manuallyScheduled && ((!!start && changedStart) || (!!finish && changedEnd));
  if (useSharedStart || useSharedEnd) {
    if (changedStart || changedEnd) task.manuallyScheduled = true;
    time.scheduleStart = readStart;
    time.scheduleFinish = readFinish;
    if (useSharedStart) {
      if (time.earlyStart) time.earlyStart = time.scheduleStart;
      if (time.actualStart || isPinnedComplete(time)) time.actualStart = time.scheduleStart;
      if (sharedStart) recorded.add('scheduleStart');
      else {
        recorded.delete('scheduleStart');
        recorded.delete('earlyStart');
      }
    }
    if (useSharedEnd) {
      if (time.earlyFinish) time.earlyFinish = time.scheduleFinish;
      if (isPinnedComplete(time)) time.actualFinish = time.scheduleFinish;
      if (sharedEnd) recorded.add('scheduleFinish');
      else {
        recorded.delete('scheduleFinish');
        recorded.delete('earlyFinish');
      }
    }
    if (time.scheduleStart && time.scheduleFinish) {
      const from = parseInstant(time.scheduleStart), to = parseInstant(time.scheduleFinish);
      if (time.durationType === 'ELAPSEDTIME') {
        time.scheduleDuration = Math.max(0, (to.getTime() - from.getTime()) / MS_PER_DAY);
        if (time.durationUnit === 'hours') time.durationMinutes = time.scheduleDuration * 24 * 60;
      } else {
        const minutes = Math.max(0, new CalendarEngine(calendar).workMinutesBetween(from, to));
        time.scheduleDuration = hourTaskScheduleDuration(minutes, calendar);
        if (time.durationUnit === 'hours') time.durationMinutes = minutes;
      }
    }
  } else if (hourDurationIsDerived(task, calendar)) {
    time.scheduleDuration = hourTaskScheduleDuration(time.durationMinutes!, calendar);
  }
  if (remainingIsDerived(time)) time.remainingTime = hourRemainingDays(time, time.remainingMinutes!);
  const hasStart = recorded.has('earlyStart') || recorded.has('scheduleStart');
  const hasFinish = recorded.has('earlyFinish') || recorded.has('scheduleFinish');
  const recordedTime = hasStart && hasFinish ? recordedTaskTime(task, recorded, readStart, readFinish) : undefined;
  return { recorded: ALL_RECORDED_SLOT_KEYS.filter(key => recorded.has(key)), recordedTime, convert };
}

export function readTasks(nodes: SourceNode[], ids: PlanningIdentities, projectCalendar: WorkCalendar, calendars: WorkCalendar[]) {
  const rows = nodes.map(node => readTask(node, ids));
  const groups = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const { task, node, target } = row;
    if (target.parentPath !== undefined) task.parentId = ids.reference('task', target.parentPath, node, ATTRIBUTE.activity, 'parent');
    if (target.calendarPath !== undefined) task.calendarId = ids.reference('calendar', target.calendarPath, node, ATTRIBUTE.activity, 'calendar');
    const group = groups.get(task.parentId);
    if (group) group.push(row);
    else groups.set(task.parentId, [row]);
  }
  const ordered = (parent: string | null) => childrenInPlace(groups.get(parent) ?? [], row => row.target.place);
  const roots = ordered(null);
  const elementLinks = new Map<string, ElementLink[]>();
  const recordedFields: Record<string, RecordedFieldKey[]> = Object.create(null);
  const recordedTimes: Record<string, RecordedTime> = Object.create(null);
  let convertedToManual = 0;
  let root = 0;
  const tasks = rows.map(row => {
    const { task, node } = row;
    task.childIds = ordered(task.id).map(child => child.task.id);
    const { recorded, recordedTime, convert } = readWindow(row, resolveCalendar(task.calendarId, calendars, projectCalendar));
    recordedFields[task.id] = recorded;
    if (recordedTime) recordedTimes[task.id] = recordedTime;
    if (convert) convertedToManual++;
    if (node.links.length) elementLinks.set(task.id, node.links.map(target => ({ direction: 'output', target, found: false })));
    return task.parentId === null ? roots[root++].task : task;
  });
  return { tasks, elementLinks, recordedFields, recordedTimes, convertedToManual };
}
