import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Task } from '@/types/task';
import type { CellValidationError, GridResult, TaskAssignmentToken } from '@/types/taskGrid';
import { clearTimephasedDurationWalks, clearTimephasedWindow } from '@/utils/taskDefaults';

const RESOURCE_CURVES: readonly ResourceCurve[] = [
  'UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK', 'DOUBLE_PEAK', 'TURTLE',
];

export type AssignmentPlanOperation =
  | {
      kind: 'add';
      taskId: string;
      resourceId: string;
      unitsPerDay: number;
      curve?: ResourceCurve;
    }
  | {
      kind: 'update';
      assignmentId: string;
      unitsPerDay: number;
      /** Vereist veld: undefined betekent een bestaande curve echt wissen. */
      curve: ResourceCurve | undefined;
    }
  | {
      kind: 'remove';
      assignmentId: string;
      taskId: string;
      resourceId: string;
    };

export interface TaskAssignmentPlan {
  operations: readonly AssignmentPlanOperation[];
  touchedTaskIds: readonly string[];
  membershipChangedTaskIds: readonly string[];
}

export interface PlanTaskAssignmentSetInput {
  taskId: string;
  tokens: readonly TaskAssignmentToken[];
  tasks: readonly Task[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
  tasksById?: ReadonlyMap<string, Task>;
  resourcesById?: ReadonlyMap<string, Resource>;
  /** Adapter-/transactie-index: voorkomt een volledige assignmentscan per bewerkte cel. */
  assignmentsForTask?: readonly ResourceAssignment[];
}

export interface MutableTaskAssignmentState {
  tasks: Task[];
  assignments: ResourceAssignment[];
}

export interface AppliedTaskAssignmentPlan {
  timephasedGuidanceLostTaskIds: readonly string[];
}

export interface TaskAssignmentApplyIndexes {
  assignmentsByTaskId: Map<string, ResourceAssignment[]>;
  assignmentsById: Map<string, ResourceAssignment>;
  usedAssignmentIds: Set<string>;
  tasksById: ReadonlyMap<string, Task>;
}

function failure(
  code: string,
  taskId: string,
  value?: unknown,
): GridResult<never, readonly CellValidationError[]> {
  return {
    ok: false,
    errors: [{ code, messageKey: `taskGrid.validation.${code}`, taskId, value }],
  };
}

function validUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Vergelijkt één volledige gewenste tokenverzameling met de bestaande assignments van de taak.
 * De planner muteert niets en genereert geen ids; de geïsoleerde gridtransactie doet dat pas bij
 * het toepassen van een geldige add-operatie.
 */
export function planTaskAssignmentSet({
  taskId,
  tokens,
  tasks,
  resources,
  assignments,
  assignmentsForTask,
  tasksById,
  resourcesById,
}: PlanTaskAssignmentSetInput): GridResult<TaskAssignmentPlan, readonly CellValidationError[]> {
  const task = tasksById?.get(taskId) ?? tasks.find(candidate => candidate.id === taskId);
  if (!task) return failure('assignmentTaskNotFound', taskId);
  if (task.isMilestone || task.childIds.length > 0) {
    return failure('assignmentTaskUnavailable', taskId);
  }

  const resourceIndex = resourcesById ?? new Map(resources.map(resource => [resource.id, resource] as const));
  const current: ResourceAssignment[] = assignmentsForTask ? [...assignmentsForTask] : [];
  if (!assignmentsForTask) {
    for (const assignment of assignments) {
      if (assignment.taskId === taskId) current.push(assignment);
    }
  }
  const currentById = new Map<string, ResourceAssignment>();
  const currentByResourceId = new Map<string, ResourceAssignment>();
  for (const assignment of current) {
    if (currentById.has(assignment.id)) return failure('assignmentDuplicateId', taskId, assignment.id);
    if (currentByResourceId.has(assignment.resourceId)) {
      return failure('assignmentDuplicateResource', taskId, assignment.resourceId);
    }
    currentById.set(assignment.id, assignment);
    currentByResourceId.set(assignment.resourceId, assignment);
  }

  const desiredResourceIds = new Set<string>();
  const desiredAssignmentIds = new Set<string>();
  const retainedAssignmentIds = new Set<string>();
  const tokenOperations: AssignmentPlanOperation[] = [];
  for (const token of tokens as readonly Partial<TaskAssignmentToken>[]) {
    if (typeof token.resourceId !== 'string' || !resourceIndex.has(token.resourceId)) {
      return failure('assignmentResourceNotFound', taskId, token);
    }
    if (!validUnits(token.unitsPerDay)) return failure('assignmentUnits', taskId, token);
    if (token.curve !== undefined && !RESOURCE_CURVES.includes(token.curve)) {
      return failure('assignmentCurve', taskId, token);
    }
    const desiredCurve = token.curve === 'UNIFORM' ? undefined : token.curve;
    if (desiredResourceIds.has(token.resourceId)) {
      return failure('assignmentDuplicateResource', taskId, token.resourceId);
    }
    desiredResourceIds.add(token.resourceId);

    let existing: ResourceAssignment | undefined;
    if (token.assignmentId !== undefined) {
      if (typeof token.assignmentId !== 'string' || desiredAssignmentIds.has(token.assignmentId)) {
        return failure('assignmentDuplicateId', taskId, token.assignmentId);
      }
      desiredAssignmentIds.add(token.assignmentId);
      existing = currentById.get(token.assignmentId);
      if (!existing || existing.resourceId !== token.resourceId) {
        return failure('assignmentIdentity', taskId, token);
      }
    } else {
      existing = currentByResourceId.get(token.resourceId);
    }

    if (!existing) {
      tokenOperations.push({
        kind: 'add', taskId, resourceId: token.resourceId,
        unitsPerDay: token.unitsPerDay, curve: desiredCurve,
      });
      continue;
    }
    retainedAssignmentIds.add(existing.id);
    if (existing.unitsPerDay !== token.unitsPerDay || existing.curve !== desiredCurve) {
      tokenOperations.push({
        kind: 'update', assignmentId: existing.id,
        unitsPerDay: token.unitsPerDay, curve: desiredCurve,
      });
    }
  }

  const removals: AssignmentPlanOperation[] = current
    .filter(assignment => !retainedAssignmentIds.has(assignment.id))
    .map(assignment => ({
      kind: 'remove' as const,
      assignmentId: assignment.id,
      taskId: assignment.taskId,
      resourceId: assignment.resourceId,
    }));
  const operations = [...removals, ...tokenOperations];
  const changed = operations.length > 0;
  const membershipChanged = operations.some(operation => operation.kind !== 'update');
  return {
    ok: true,
    value: {
      operations,
      touchedTaskIds: changed ? [taskId] : [],
      membershipChangedTaskIds: membershipChanged ? [taskId] : [],
    },
  };
}

/** Past een reeds volledig gevalideerd plan op een geïsoleerde documentdraft toe. */
export function applyTaskAssignmentPlan(
  state: MutableTaskAssignmentState,
  plan: TaskAssignmentPlan,
  createAssignmentId: () => string,
  indexes?: TaskAssignmentApplyIndexes,
): AppliedTaskAssignmentPlan {
  let applyIndexes = indexes;
  if (!applyIndexes) {
    const assignmentsByTaskId = new Map<string, ResourceAssignment[]>();
    const assignmentsById = new Map<string, ResourceAssignment>();
    const usedAssignmentIds = new Set<string>();
    for (const assignment of state.assignments) {
      assignmentsById.set(assignment.id, assignment);
      usedAssignmentIds.add(assignment.id);
      const current = assignmentsByTaskId.get(assignment.taskId);
      if (current) current.push(assignment);
      else assignmentsByTaskId.set(assignment.taskId, [assignment]);
    }
    applyIndexes = {
      assignmentsByTaskId,
      assignmentsById,
      usedAssignmentIds,
      tasksById: new Map(state.tasks.map(task => [task.id, task] as const)),
    };
  }
  const { assignmentsByTaskId, assignmentsById, usedAssignmentIds, tasksById } = applyIndexes;
  const nextId = (): string => {
    let id = createAssignmentId();
    while (usedAssignmentIds.has(id)) id = createAssignmentId();
    usedAssignmentIds.add(id);
    return id;
  };

  const removedIds = new Set<string>();
  const removedByTaskId = new Map<string, Set<string>>();
  for (const operation of plan.operations) {
    if (operation.kind === 'remove') {
      removedIds.add(operation.assignmentId);
      const current = removedByTaskId.get(operation.taskId);
      if (current) current.add(operation.assignmentId);
      else removedByTaskId.set(operation.taskId, new Set([operation.assignmentId]));
    } else if (operation.kind === 'update') {
      const assignment = assignmentsById.get(operation.assignmentId);
      if (!assignment) continue;
      assignment.unitsPerDay = operation.unitsPerDay;
      assignment.curve = operation.curve;
    }
  }
  if (removedIds.size > 0) {
    const retained: ResourceAssignment[] = [];
    for (const assignment of state.assignments) {
      if (removedIds.has(assignment.id)) assignmentsById.delete(assignment.id);
      else retained.push(assignment);
    }
    state.assignments = retained;
    for (const [taskId, taskRemovedIds] of removedByTaskId) {
      const next: ResourceAssignment[] = [];
      for (const assignment of assignmentsByTaskId.get(taskId) ?? []) {
        if (!taskRemovedIds.has(assignment.id)) next.push(assignment);
      }
      assignmentsByTaskId.set(taskId, next);
    }
  }
  for (const operation of plan.operations) {
    if (operation.kind === 'add') {
      const assignment: ResourceAssignment = {
        id: nextId(), taskId: operation.taskId, resourceId: operation.resourceId,
        unitsPerDay: operation.unitsPerDay, curve: operation.curve,
      };
      state.assignments.push(assignment);
      assignmentsById.set(assignment.id, assignment);
      const taskAssignments = assignmentsByTaskId.get(operation.taskId);
      if (taskAssignments) taskAssignments.push(assignment);
      else assignmentsByTaskId.set(operation.taskId, [assignment]);
    }
  }

  for (const taskId of plan.touchedTaskIds) {
    const task = tasksById.get(taskId);
    if (!task) continue;
    const resourceIds = new Set(
      (assignmentsByTaskId.get(taskId) ?? []).map(assignment => assignment.resourceId),
    );
    task.resourceIds = [...resourceIds];
  }

  const timephasedGuidanceLostTaskIds: string[] = [];
  for (const taskId of plan.membershipChangedTaskIds) {
    const task = tasksById.get(taskId);
    if (!task) continue;
    const clearedWindow = clearTimephasedWindow(task);
    const clearedWalks = clearTimephasedDurationWalks(task);
    if (clearedWindow || clearedWalks) timephasedGuidanceLostTaskIds.push(taskId);
  }
  return { timephasedGuidanceLostTaskIds };
}
