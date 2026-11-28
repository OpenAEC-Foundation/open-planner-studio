import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';
import {
  clearCostResourceFields, COST_RESOURCE_CLEARED_FIELDS, contourSiblings, costResourceIds, isCostResource, isValidCostAmount, isValidUnits, type Resource, type ResourceAssignment,
} from '@/types/resource';
import { contourIndexForAssignment } from '@/engine/contour/contourEngine';
import { nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import type { WorkCalendar } from '@/types/calendar';
import {
  hourInputFinishBasis, invalidateForAssignmentChange, taskCalendarHoursPerDay, taskWorkMinutesOf,
  type HourInputFinishBasis,
} from '@/utils/taskDefaults';
import {
  captureTriangle, settleAssignmentAdded, settleAssignmentRemoved, settleDurationAftermath, settleUnitsEdit,
  type CapturedTriangle, type WorkRuleDeps,
} from '@/engine/work/workRuleApply';

interface AssignmentState extends WorkRuleDeps {
  tasks: Task[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  calendars: WorkCalendar[];
  calendar: WorkCalendar;
}

export interface AssignmentChangeOutcome {
  lostTaskIds: string[];
  durationChanged: boolean;
}

interface AssignmentTaskCapture {
  task: Task;
  triangle: CapturedTriangle | null;
  oldWorkMinutes: number;
  finishBasis: HourInputFinishBasis;
}

function captureAssignmentTask(s: AssignmentState, task: Task): AssignmentTaskCapture {
  return {
    task,
    triangle: captureTriangle(task, s.assignments, s),
    oldWorkMinutes: taskWorkMinutesOf(task, taskCalendarHoursPerDay(task, s.calendars, s.calendar)),
    finishBasis: hourInputFinishBasis(task),
  };
}

class OutcomeBuilder {
  private readonly lost: string[] = [];
  durationChanged = false;

  settled(s: AssignmentState, c: AssignmentTaskCapture, durationChanged: boolean): void {
    if (!durationChanged) return;
    this.durationChanged = true;
    if (settleDurationAftermath(c.task, s, c.oldWorkMinutes, c.finishBasis)) this.markLost(c.task.id);
  }

  invalidate(task: Task): void {
    if (invalidateForAssignmentChange(task)) this.markLost(task.id);
  }

  private markLost(id: string): void {
    if (!this.lost.includes(id)) this.lost.push(id);
  }

  build(): AssignmentChangeOutcome {
    return { lostTaskIds: this.lost, durationChanged: this.durationChanged };
  }
}

export type AssignmentPatch = Partial<Pick<ResourceAssignment, 'unitsPerDay' | 'curve'>>;

export function crossesCostBoundary(current: Pick<Resource, 'type'>, nextType: Resource['type'] | undefined): boolean {
  return nextType !== undefined && nextType !== current.type && (current.type === 'COST' || nextType === 'COST');
}

export function resourceHasAssignments(s: Pick<AssignmentState, 'assignments'>, id: string): boolean {
  return s.assignments.some(a => a.resourceId === id);
}

export type CostResourcePatchRefusal =
  | 'typeChangeWithAssignments'
  | 'costResourceField';

export function acceptedCostResourcePatch(
  s: Pick<AssignmentState, 'assignments'>,
  resource: Resource,
  updates: Partial<Resource>,
): { patch: Partial<Resource>; refused: CostResourcePatchRefusal[] } {
  const refused: CostResourcePatchRefusal[] = [];
  let patch = updates;
  const drop = (key: keyof Resource) => {
    if (patch === updates) patch = { ...updates };
    delete patch[key];
  };
  if (crossesCostBoundary(resource, patch.type) && resourceHasAssignments(s, resource.id)) {
    drop('type');
    refused.push('typeChangeWithAssignments');
  }
  const effectiveType = patch.type ?? resource.type;
  if (effectiveType === 'COST') {
    let dropped = false;
    for (const key of COST_RESOURCE_CLEARED_FIELDS) {
      if (patch[key] !== undefined) { drop(key); dropped = true; }
    }
    if ('maxUnits' in patch && patch.maxUnits !== 1) { drop('maxUnits'); dropped = true; }
    if (dropped) refused.push('costResourceField');
  }
  return { patch, refused };
}

export function settleCostResourceFields(resource: Resource): void {
  if (isCostResource(resource)) clearCostResourceFields(resource);
}

export function isCostAssignment(s: Pick<AssignmentState, 'resources'>, assignment: Pick<ResourceAssignment, 'resourceId'>): boolean {
  return isCostResource(s.resources.find(r => r.id === assignment.resourceId));
}

export function acceptedCostAmount(amount: unknown): number | undefined | false {
  if (amount === undefined) return undefined;
  return isValidCostAmount(amount) ? amount : false;
}

export function applyAssignmentCost(assignment: ResourceAssignment, amount: number | undefined): boolean {
  if (assignment.costAmount === amount) return false;
  if (amount === undefined) delete assignment.costAmount;
  else assignment.costAmount = amount;
  return true;
}

export function insertResource(s: AssignmentState, res: Omit<Resource, 'id'>, id: string): void {
  const color = res.color ?? nextFreePaletteColor(s.resources);
  const resource: Resource = { ...res, id, color };
  settleCostResourceFields(resource);
  s.resources.push(resource);
}

export function purgeResource(s: AssignmentState, id: string, crewKey: 'unset' | 'delete'): AssignmentChangeOutcome {
  const captured = s.assignments
    .filter(a => a.resourceId === id)
    .flatMap((a) => {
      const task = s.tasks.find(t => t.id === a.taskId);
      return task ? [{ assignmentId: a.id, capture: captureAssignmentTask(s, task) }] : [];
    });
  const cost = isCostResource(s.resources.find(r => r.id === id));
  s.resources = s.resources.filter(r => r.id !== id);
  s.assignments = s.assignments.filter(a => a.resourceId !== id);
  const out = new OutcomeBuilder();
  for (const c of captured) {
    out.settled(s, c.capture, settleAssignmentRemoved(c.capture.task, s.assignments, c.capture.triangle, c.assignmentId).durationChanged);
  }
  const affected = new Set(captured.map(c => c.capture.task));
  for (const task of s.tasks) {
    const idx = task.resourceIds.indexOf(id);
    if (idx >= 0) task.resourceIds.splice(idx, 1);
    if (affected.has(task) && !cost) out.invalidate(task);
  }
  for (const r of s.resources) {
    if (r.parentId !== id) continue;
    if (crewKey === 'delete') delete r.parentId;
    else r.parentId = undefined;
  }
  return out.build();
}

export function pruneTaskResourceRef(s: AssignmentState, taskId: string, resourceId: string): void {
  if (s.assignments.some(a => a.taskId === taskId && a.resourceId === resourceId)) return;
  const task = s.tasks.find(t => t.id === taskId);
  const idx = task?.resourceIds.indexOf(resourceId) ?? -1;
  if (task && idx >= 0) task.resourceIds.splice(idx, 1);
}

export function insertAssignment(s: AssignmentState, task: Task, assignment: ResourceAssignment): AssignmentChangeOutcome {
  const capture = captureAssignmentTask(s, task);
  s.assignments.push(assignment);
  if (!task.resourceIds.includes(assignment.resourceId)) task.resourceIds.push(assignment.resourceId);
  const out = new OutcomeBuilder();
  out.settled(s, capture, settleAssignmentAdded(task, s.assignments, capture.triangle, assignment).durationChanged);
  if (!isCostAssignment(s, assignment)) out.invalidate(task);
  return out.build();
}

export function removeAssignment(s: AssignmentState, removed: ResourceAssignment): AssignmentChangeOutcome {
  const task = s.tasks.find(t => t.id === removed.taskId);
  const capture = task ? captureAssignmentTask(s, task) : null;
  s.assignments = s.assignments.filter(a => a.id !== removed.id);
  const out = new OutcomeBuilder();
  if (capture) out.settled(s, capture, settleAssignmentRemoved(capture.task, s.assignments, capture.triangle, removed.id).durationChanged);
  pruneTaskResourceRef(s, removed.taskId, removed.resourceId);
  if (task && !isCostAssignment(s, removed)) out.invalidate(task);
  return out.build();
}

export function relocateAssignment(s: AssignmentState, assignment: ResourceAssignment, newTask: Task): AssignmentChangeOutcome {
  const oldTaskId = assignment.taskId;
  const oldTask = s.tasks.find(t => t.id === oldTaskId);
  const oldCapture = oldTask ? captureAssignmentTask(s, oldTask) : null;
  const newCapture = captureAssignmentTask(s, newTask);
  assignment.taskId = newTask.id;
  const out = new OutcomeBuilder();
  if (oldCapture) out.settled(s, oldCapture, settleAssignmentRemoved(oldCapture.task, s.assignments, oldCapture.triangle, assignment.id).durationChanged);
  out.settled(s, newCapture, settleAssignmentAdded(newTask, s.assignments, newCapture.triangle, assignment).durationChanged);
  pruneTaskResourceRef(s, oldTaskId, assignment.resourceId);
  if (!newTask.resourceIds.includes(assignment.resourceId)) newTask.resourceIds.push(assignment.resourceId);
  if (!isCostAssignment(s, assignment)) {
    if (oldTask) out.invalidate(oldTask);
    out.invalidate(newTask);
  }
  return out.build();
}

export function acceptedAssignmentPatch(updates: AssignmentPatch, isCost = false): AssignmentPatch | null {
  if (isCost) return null;
  let patch = updates;
  if ('unitsPerDay' in patch && !isValidUnits(patch.unitsPerDay)) {
    patch = { ...patch };
    delete patch.unitsPerDay;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

export function applyAssignmentPatch(s: AssignmentState, assignment: ResourceAssignment, patch: AssignmentPatch): AssignmentChangeOutcome {
  const task = s.tasks.find(t => t.id === assignment.taskId);
  const capture = task && typeof patch.unitsPerDay === 'number' && patch.unitsPerDay !== assignment.unitsPerDay
    ? captureAssignmentTask(s, task)
    : null;
  Object.assign(assignment, patch);
  if ('curve' in patch) delete assignment.curveValues;
  const out = new OutcomeBuilder();
  if (capture) {
    out.settled(s, capture, settleUnitsEdit(capture.task, s.assignments, capture.triangle, assignment.id, assignment.unitsPerDay).durationChanged);
  }
  return out.build();
}

export function contoursAfterEdit(
  s: AssignmentState,
  task: Task,
  assignment: ResourceAssignment,
  periods: TimephasedContourPeriod[] | null,
): { contours: TaskTimephasedContour[] | undefined } | null {
  if (isCostAssignment(s, assignment)) return null;
  const siblings = contourSiblings(s.assignments.filter(x => x.taskId === assignment.taskId), costResourceIds(s.resources));
  const idx = contourIndexForAssignment(task.timephasedContours, siblings, assignment.id);
  if (periods === null && idx < 0) return null;
  const list = task.timephasedContours ? [...task.timephasedContours] : [];
  if (periods === null) {
    list.splice(idx, 1);
  } else if (idx >= 0) {
    list[idx] = { ...list[idx], resourceId: assignment.resourceId, periods };
  } else {
    list.push({ resourceUid: null, resourceId: assignment.resourceId, periods });
  }
  return { contours: list.length > 0 ? list : undefined };
}
