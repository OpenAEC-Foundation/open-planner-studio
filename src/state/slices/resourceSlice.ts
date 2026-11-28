import { isCostResource, isValidUnits, type Resource, type ResourceAssignment, type ResourceCurve } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { TimephasedContourPeriod } from '@/types/task';
import { generateId } from '@/utils/id';
import { sameValue } from '@/utils/sameValue';
import { syncProjectCalendar } from '../syncProjectCalendar';
import {
  clearTimephasedWindow, clearLevelingGaps, taskCalendarHoursPerDay, taskWorkMinutesOf, hourInputFinishBasis,
} from '@/utils/taskDefaults';
import {
  acceptedAssignmentPatch, acceptedCostAmount, acceptedCostResourcePatch, applyAssignmentCost, applyAssignmentPatch,
  contoursAfterEdit, insertAssignment, insertResource, isCostAssignment, purgeResource, relocateAssignment,
  removeAssignment, settleCostResourceFields,
} from '../assignmentMutations';
import {
  commitTrianglePlan, planWorkEdit,
  captureCalendarChange, settleCalendarChange, settleDurationAftermath, syncAssignmentWorkToContour,
} from '@/engine/work/workRuleApply';
import { notifyWorkRuleDurationsChanged } from '../taskTypesNotice';
import { assignmentsByTask, captureCalendarLibraryChange, settleCalendarLibraryChange, tasksOnCalendar } from '../calendarTasks';
import type { Task } from '@/types/task';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import { notifyOtherWorkChanged, type AssignmentEdit } from '../otherWorkNotice';
import { notifyForeignLinksDropped } from '../foreignLinksNotice';
import type { AppSliceFactory } from './types';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { AppState } from '../appStore';

export type NamedCalendar = WorkCalendar;

type CalendarLibraryState = Pick<AppState, 'calendars' | 'calendar' | 'project' | 'resources' | 'tasks'>;

function libraryCommitChanges(s: CalendarLibraryState, calendars: WorkCalendar[], projectCalendarId: string): boolean {
  if (!sameValue(s.calendars, calendars)) return true;
  const ids = new Set(calendars.map(c => c.id));
  const nextProjectId = ids.has(projectCalendarId) ? projectCalendarId : (calendars[0]?.id ?? s.project.calendarId);
  if (nextProjectId !== s.project.calendarId) return true;
  if (s.resources.some(r => r.calendarId && !ids.has(r.calendarId))) return true;
  if (s.tasks.some(t => t.calendarId && !ids.has(t.calendarId))) return true;
  const entry = calendars.find(c => c.id === nextProjectId);
  return !entry || !sameValue(s.calendar, entry);
}

export interface ResourceSlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  calendars: WorkCalendar[];
  addResource: (res: Omit<Resource, 'id'>) => string;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  removeResource: (id: string) => void;
  assignResource: (taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve, costAmount?: number) => void;
  setAssignmentCost: (assignmentId: string, amount: number | undefined) => void;
  updateAssignment: (assignmentId: string, updates: Partial<Pick<ResourceAssignment, 'unitsPerDay' | 'curve'>>) => void;
  unassignResource: (assignmentId: string) => void;
  setAssignmentWork: (assignmentId: string, remainingWorkMinutes: number) => void;
  setAssignmentContour: (assignmentId: string, periods: TimephasedContourPeriod[] | null) => void;
  moveAssignment: (assignmentId: string, newTaskId: string) => boolean;
  addCalendar: (cal: Omit<WorkCalendar, 'id'>) => string;
  updateCalendar: (id: string, updates: Partial<WorkCalendar>) => void;
  removeCalendar: (id: string) => void;
  commitCalendarLibrary: (calendars: WorkCalendar[], projectCalendarId: string) => boolean;
}

function workMinutesBefore(s: { calendars: WorkCalendar[]; calendar: WorkCalendar }, task: Task): number {
  return taskWorkMinutesOf(task, taskCalendarHoursPerDay(task, s.calendars, s.calendar));
}
export const createResourceSlice: AppSliceFactory<ResourceSlice> = (runtime) => (set, get, store) => ({
  resources: [],
  assignments: [],
  calendars: [],

  addResource: (res) => {
    const id = generateId('res');
    set((s) => {
      runtime.beginUndoable(s);
      insertResource(s, res, id);
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows();
    return id;
  },

  updateResource: (id, updates) => {
    set((s) => {
      const idx = s.resources.findIndex(r => r.id === id);
      if (idx < 0) return;
      let patch = updates;
      if ('maxUnits' in patch && !isValidUnits(patch.maxUnits)) {
        patch = { ...patch };
        delete patch.maxUnits;
      }
      patch = acceptedCostResourcePatch(s, s.resources[idx], patch).patch;
      if (Object.keys(patch).length === 0) return;
      runtime.beginUndoable(s);
      Object.assign(s.resources[idx], patch);
      settleCostResourceFields(s.resources[idx]);
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  removeResource: (id) => {
    let lostCount = 0;
    const before = get();
    set((s) => {
      if (!s.resources.some(r => r.id === id)) return;
      runtime.beginUndoable(s);
      const outcome = purgeResource(s, id, 'unset');
      lostCount = outcome.lostTaskIds.length;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
    });
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    notifyForeignLinksDropped(store, before, before.nextHistorySequence);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  assignResource: (taskId, resourceId, unitsPerDay, curve, costAmount) => {
    let lostTimephasedGuidance = false;
    let edit: AssignmentEdit | null = null;
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task || isSummaryTask(task)) return;
      const resource = s.resources.find(r => r.id === resourceId);
      if (!resource) return;
      if (task.isMilestone && !isCostResource(resource)) return;
      if (!isValidUnits(unitsPerDay)) return;
      const cost = isCostResource(resource);
      const amount = cost ? acceptedCostAmount(costAmount) : undefined;
      if (amount === false) return;
      if (s.assignments.some(a => a.taskId === taskId && a.resourceId === resourceId)) return;

      const sequence = s.nextHistorySequence;
      runtime.beginUndoable(s);
      const id = generateId('asgn');
      const outcome = insertAssignment(s, task, cost
        ? { id, taskId, resourceId, unitsPerDay: 1, ...(amount !== undefined ? { costAmount: amount } : {}) }
        : { id, taskId, resourceId, unitsPerDay, curve });
      lostTimephasedGuidance = outcome.lostTaskIds.length > 0;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
      edit = { sequence, taskId, assignmentId: id };
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    notifyOtherWorkChanged(store, edit);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  updateAssignment: (assignmentId, updates) => {
    let lostTimephasedGuidance = false;
    let edit: AssignmentEdit | null = null;
    set((s) => {
      const idx = s.assignments.findIndex(a => a.id === assignmentId);
      if (idx < 0) return;
      const patch = acceptedAssignmentPatch(updates, isCostAssignment(s, s.assignments[idx]));
      if (!patch) return;
      const sequence = s.nextHistorySequence;
      runtime.beginUndoable(s);
      const taskId = s.assignments[idx].taskId;
      const outcome = applyAssignmentPatch(s, s.assignments[idx], patch);
      lostTimephasedGuidance = outcome.lostTaskIds.length > 0;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
      edit = { sequence, taskId, assignmentId };
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    notifyOtherWorkChanged(store, edit);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  setAssignmentWork: (assignmentId, remainingWorkMinutes) => {
    let lostTimephasedGuidance = false;
    let edit: AssignmentEdit | null = null;
    set((s) => {
      const a = s.assignments.find(x => x.id === assignmentId);
      if (!a) return;
      if (isCostAssignment(s, a)) return;
      const task = s.tasks.find(t => t.id === a.taskId);
      if (!task) return;
      if (typeof remainingWorkMinutes !== 'number' || !Number.isFinite(remainingWorkMinutes) || remainingWorkMinutes <= 0) return;
      const oldWorkMinutes = workMinutesBefore(s, task);
      const finishBasis = hourInputFinishBasis(task);
      const plan = planWorkEdit(task, s.assignments, s, assignmentId, remainingWorkMinutes);
      if (!plan) return;
      const sequence = s.nextHistorySequence;
      runtime.beginUndoable(s);
      const settled = commitTrianglePlan(task, s.assignments, plan);
      s.taskTypesVisible = true;
      if (settled.durationChanged) lostTimephasedGuidance = settleDurationAftermath(task, s, oldWorkMinutes, finishBasis);
      runtime.finishMutation(s, { stale: settled.durationChanged });
      edit = { sequence, taskId: task.id, assignmentId };
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    notifyOtherWorkChanged(store, edit);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  setAssignmentContour: (assignmentId, periods) => {
    set((s) => {
      const a = s.assignments.find(x => x.id === assignmentId);
      if (!a) return;
      const task = s.tasks.find(t => t.id === a.taskId);
      if (!task) return;
      const edit = contoursAfterEdit(s, task, a, periods);
      if (!edit) return;
      runtime.beginUndoable(s);
      task.timephasedContours = edit.contours;
      syncAssignmentWorkToContour(a, periods);
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
  },

  setAssignmentCost: (assignmentId, amount) => {
    set((s) => {
      const a = s.assignments.find(x => x.id === assignmentId);
      if (!a || !isCostAssignment(s, a)) return;
      const accepted = acceptedCostAmount(amount);
      if (accepted === false || a.costAmount === accepted) return;
      runtime.beginUndoable(s);
      applyAssignmentCost(a, accepted);
      runtime.finishMutation(s);
    });
  },

  unassignResource: (assignmentId) => {
    let lostTimephasedGuidance = false;
    let edit: AssignmentEdit | null = null;
    set((s) => {
      const removed = s.assignments.find(a => a.id === assignmentId);
      if (!removed) return;

      const sequence = s.nextHistorySequence;
      runtime.beginUndoable(s);
      const taskId = removed.taskId;
      const outcome = removeAssignment(s, removed);
      lostTimephasedGuidance = outcome.lostTaskIds.length > 0;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
      edit = { sequence, taskId, assignmentId };
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    notifyOtherWorkChanged(store, edit);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  moveAssignment: (assignmentId, newTaskId) => {
    let moved = false;
    let lostCount = 0;
    set((s) => {
      const assignment = s.assignments.find(a => a.id === assignmentId);
      if (!assignment) return;
      const newTask = s.tasks.find(t => t.id === newTaskId);
      if (!newTask || isSummaryTask(newTask)) return;
      if (newTask.isMilestone && !isCostAssignment(s, assignment)) return;
      const alreadyOnTarget = s.assignments.some(
        a => a.taskId === newTaskId && a.resourceId === assignment.resourceId
      );
      if (alreadyOnTarget) return;

      runtime.beginUndoable(s);
      const outcome = relocateAssignment(s, assignment, newTask);
      lostCount = outcome.lostTaskIds.length;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
      moved = true;
    });
    if (moved && lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    if (moved) {
      get().recomputeResourceLoad();
      get().recomputeViewRows();
    }
    return moved;
  },

  addCalendar: (cal) => {
    const id = generateId('cal');
    set((s) => {
      runtime.beginUndoable(s);
      s.calendars.push({ ...cal, id });
      syncProjectCalendar(s);
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeResourceLoad();
  return id;
  },

  updateCalendar: (id, updates) => {
    let changed = 0;
    let lost = 0;
    set((s) => {
      const idx = s.calendars.findIndex(c => c.id === id);
      if (idx < 0) return;
      const current = s.calendars[idx] as unknown as Record<string, unknown>;
      if (Object.entries(updates).every(([k, v]) => sameValue(current[k], v))) return;
      runtime.beginUndoable(s);
      const byTask = assignmentsByTask(s.assignments);
      const affected = tasksOnCalendar(s, id).map(task => ({ task, before: captureCalendarChange(task, byTask.get(task.id) ?? [], s) }));
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      for (const { task, before } of affected) {
        const settled = settleCalendarChange(task, byTask.get(task.id) ?? [], before, s);
        if (settled.durationChanged) changed++;
        if (settled.timephasedLost) lost++;
      }
      const onlyName = Object.keys(updates).length === 1 && 'name' in updates;
      runtime.finishMutation(s, { stale: !onlyName });
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, changed);
    if (lost > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lost);
    get().recomputeResourceLoad();
  },

  removeCalendar: (id) => {
    let lostCount = 0;
    let changed = 0;
    set((s) => {
      if (!s.calendars.some(c => c.id === id)) return;
      runtime.beginUndoable(s);
      const k2 = captureCalendarLibraryChange(s);
      s.calendars = s.calendars.filter(c => c.id !== id);
      for (const r of s.resources) {
        if (r.calendarId === id) r.calendarId = undefined;
      }
      for (const t of s.tasks) {
        if (t.calendarId === id) {
          t.calendarId = undefined;
          if (clearTimephasedWindow(t)) lostCount++;
          clearLevelingGaps(t);
        }
      }
      if (s.project.calendarId === id) {
        const fallback = s.calendars[0];
        if (fallback) {
          s.project.calendarId = fallback.id;
          s.calendar = fallback;
        }
      }
      syncProjectCalendar(s);
      const settled = settleCalendarLibraryChange(s, k2);
      changed = settled.changed;
      lostCount += settled.lost;
      runtime.finishMutation(s, { stale: true });
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, changed);
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    get().recomputeResourceLoad();
  },

  commitCalendarLibrary: (calendars, projectCalendarId) => {
    let lostCount = 0;
    let changed = 0;
    let committed = false;
    set((s) => {
      if (!libraryCommitChanges(s, calendars, projectCalendarId)) return;
      committed = true;
      runtime.beginUndoable(s);
      const k2 = captureCalendarLibraryChange(s);
      s.calendars = calendars;
      const ids = new Set(calendars.map(c => c.id));
      for (const r of s.resources) {
        if (r.calendarId && !ids.has(r.calendarId)) r.calendarId = undefined;
      }
      for (const t of s.tasks) {
        if (t.calendarId && !ids.has(t.calendarId)) {
          t.calendarId = undefined;
          if (clearTimephasedWindow(t)) lostCount++;
          clearLevelingGaps(t);
        }
      }
      if (ids.has(projectCalendarId)) {
        s.project.calendarId = projectCalendarId;
      } else if (calendars[0]) {
        s.project.calendarId = calendars[0].id;
      }
      syncProjectCalendar(s);
      const settled = settleCalendarLibraryChange(s, k2);
      changed = settled.changed;
      lostCount += settled.lost;
      runtime.finishMutation(s, { stale: true });
    });
    if (!committed) return false;
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, changed);
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    get().recomputeResourceLoad();
    return true;
  },
});
