import type { Project } from '@/types/project';
import type { Task, TaskDurationUnit } from '@/types/task';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { effectiveWorkRule, workRuleApplies, writeDaysAsHours } from '@/engine/work/workRuleApply';

type ProfileFields = Pick<Project, 'schedulingProfile' | 'schedulingOptions'>;
type MeasureFields = ProfileFields & Pick<Project, 'defaultTaskDurationUnit'>;

export function defaultTaskMeasureLocked(project: ProfileFields): boolean {
  return effectiveSchedulingOptions(project).workdayDurationMeasure !== true;
}

export function defaultTaskMeasure(project: MeasureFields): TaskDurationUnit {
  return defaultTaskMeasureLocked(project) ? 'hours' : (project.defaultTaskDurationUnit ?? 'days');
}

export function newTaskTimeUnit(project: MeasureFields): TaskDurationUnit {
  return !defaultTaskMeasureLocked(project) && project.defaultTaskDurationUnit === 'hours' ? 'hours' : 'days';
}

export function settleNewTaskMeasure(
  task: Task,
  project: MeasureFields & Pick<Project, 'defaultWorkRule'>,
  measureGiven: boolean,
  hoursPerDay: number,
): boolean {
  if (task.time.durationUnit !== 'days' || task.isMilestone || task.time.durationType === 'ELAPSEDTIME') return false;
  const fixedWork = workRuleApplies(task) && effectiveWorkRule(task, project.defaultWorkRule) === 'FIXED_WORK';
  if (!fixedWork && (measureGiven || !defaultTaskMeasureLocked(project))) return false;
  return writeDaysAsHours(task.time, hoursPerDay);
}
