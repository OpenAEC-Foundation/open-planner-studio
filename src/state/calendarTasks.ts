import { produce } from 'immer';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { ResourceAssignment } from '@/types/resource';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import {
  captureCalendarChange, settleCalendarChange, type CalendarCapture, type WorkRuleDeps,
} from '@/engine/work/workRuleApply';
import type { NotifyInput } from './slices/types';
import { notifyWorkRuleDurationsChanged } from './taskTypesNotice';
import { notifyTimephasedLoss } from './timephasedLossNotice';

type CalendarState = { tasks: Task[]; calendars: WorkCalendar[]; calendar: WorkCalendar; project: { calendarId: string } };

export function tasksOnCalendar(s: CalendarState, calendarId: string): Task[] {
  return s.tasks.filter((t) => resolveCalendar(t.calendarId, s.calendars, s.calendar).id === calendarId);
}

export function tasksFollowingProjectCalendar(s: Pick<CalendarState, 'tasks' | 'calendars'>): Task[] {
  return s.tasks.filter((t) => t.calendarId === undefined || !s.calendars.some((c) => c.id === t.calendarId));
}

export function assignmentsByTask(assignments: readonly ResourceAssignment[]): Map<string, ResourceAssignment[]> {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    let list = byTask.get(a.taskId);
    if (!list) { list = []; byTask.set(a.taskId, list); }
    list.push(a);
  }
  return byTask;
}

const NONE: readonly ResourceAssignment[] = [];

type LibraryState = WorkRuleDeps & { tasks: Task[]; assignments: ResourceAssignment[] };

export interface CalendarLibraryCapture {
  entries: Array<{ task: Task; before: CalendarCapture }>;
}

export function captureCalendarLibraryChange(s: LibraryState): CalendarLibraryCapture {
  const byTask = assignmentsByTask(s.assignments);
  return { entries: s.tasks.map((task) => ({ task, before: captureCalendarChange(task, byTask.get(task.id) ?? NONE, s) })) };
}

export interface CalendarLibrarySettle {
  changed: number;
  lost: number;
  changedTaskIds: string[];
  lostTaskIds: string[];
}

export function settleCalendarLibraryChange(s: LibraryState, captured: CalendarLibraryCapture): CalendarLibrarySettle {
  const changedTaskIds: string[] = [];
  const lostTaskIds: string[] = [];
  const byTask = assignmentsByTask(s.assignments);
  for (const { task, before } of captured.entries) {
    const settled = settleCalendarChange(task, byTask.get(task.id) ?? [], before, s);
    if (settled.durationChanged) changedTaskIds.push(task.id);
    if (settled.timephasedLost) lostTaskIds.push(task.id);
  }
  return { changed: changedTaskIds.length, lost: lostTaskIds.length, changedTaskIds, lostTaskIds };
}

export const NO_CALENDAR_LIBRARY_SETTLE: CalendarLibrarySettle = { changed: 0, lost: 0, changedTaskIds: [], lostTaskIds: [] };

export function applyCalendarLibraryChange<T extends LibraryState>(s: T, mutate: (s: T) => void): CalendarLibrarySettle {
  const captured = captureCalendarLibraryChange(s);
  mutate(s);
  return settleCalendarLibraryChange(s, captured);
}

export function settleCalendarLibraryChangeOnPayload(
  payload: LibraryState,
  previous: WorkRuleDeps,
): CalendarLibrarySettle {
  let settled = NO_CALENDAR_LIBRARY_SETTLE;
  const next = produce({ tasks: payload.tasks, assignments: payload.assignments }, (d) => {
    const captured = captureCalendarLibraryChange({ ...previous, tasks: d.tasks, assignments: d.assignments });
    settled = settleCalendarLibraryChange({ ...payload, tasks: d.tasks, assignments: d.assignments }, captured);
  });
  payload.tasks = next.tasks;
  payload.assignments = next.assignments;
  return settled;
}

export function mergeCalendarLibrarySettle(a: CalendarLibrarySettle, b: CalendarLibrarySettle): CalendarLibrarySettle {
  const changedTaskIds = [...new Set([...a.changedTaskIds, ...b.changedTaskIds])];
  const lostTaskIds = [...new Set([...a.lostTaskIds, ...b.lostTaskIds])];
  return { changed: changedTaskIds.length, lost: lostTaskIds.length, changedTaskIds, lostTaskIds };
}

export function notifyCalendarLibrarySettle(
  notify: (n: NotifyInput) => void,
  docId: string,
  settled: Pick<CalendarLibrarySettle, 'changed' | 'lost'>,
): void {
  notifyWorkRuleDurationsChanged(notify, settled.changed);
  notifyTimephasedLoss(notify, docId, settled.lost);
}
