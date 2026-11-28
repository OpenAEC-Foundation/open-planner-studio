import type { Project } from '@/types/project';
import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { workRuleFromMsp, workRuleFromXerDurationType } from '@/engine/work/workRuleMapping';

export function hasTaskTypeData(
  tasks: readonly Pick<Task, 'workRule' | 'mspTaskType' | 'p6DurationType'>[],
  assignments: readonly Pick<ResourceAssignment, 'plannedWorkMinutes' | 'actualWorkMinutes' | 'remainingWorkMinutes'>[],
  project?: Pick<Project, 'defaultWorkRule'>,
): boolean {
  if (project?.defaultWorkRule !== undefined) return true;
  if (tasks.some((t) => t.workRule !== undefined || t.mspTaskType !== undefined || t.p6DurationType !== undefined)) return true;
  return assignments.some((a) =>
    a.plannedWorkMinutes !== undefined || a.actualWorkMinutes !== undefined || a.remainingWorkMinutes !== undefined);
}

export function taskTypesNeedNotice(
  tasks: readonly Pick<Task, 'workRule' | 'mspTaskType' | 'effortDriven' | 'p6DurationType'>[],
  assignments: readonly Pick<ResourceAssignment, 'plannedWorkMinutes' | 'actualWorkMinutes' | 'remainingWorkMinutes'>[],
  project?: Pick<Project, 'defaultWorkRule'>,
): boolean {
  if (project?.defaultWorkRule !== undefined) return true;
  if (assignments.some((a) =>
    a.plannedWorkMinutes !== undefined || a.actualWorkMinutes !== undefined || a.remainingWorkMinutes !== undefined)) return true;
  return tasks.some((t) => {
    if (t.workRule === undefined) return false;
    const derived = t.mspTaskType
      ? workRuleFromMsp(t.mspTaskType, t.effortDriven)
      : workRuleFromXerDurationType(t.p6DurationType);
    return derived !== t.workRule;
  });
}

export function taskTypesUnlocked(state: { ui: { showTaskTypes: boolean }; taskTypesVisible: boolean }): boolean {
  return state.ui.showTaskTypes || state.taskTypesVisible;
}
