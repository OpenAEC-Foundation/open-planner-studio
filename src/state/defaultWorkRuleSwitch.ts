import type { Project } from '@/types/project';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import { settleDefaultRuleChange, type WorkRuleDeps } from '@/engine/work/workRuleApply';
import { assignmentsByTask } from './calendarTasks';

export interface DefaultWorkRuleSwitchState {
  project: Project;
  tasks: Task[];
  assignments: ResourceAssignment[];
  resources: Resource[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
}

export function settleDefaultWorkRuleSwitch(
  s: DefaultWorkRuleSwitchState,
  previousDefault: WorkRule | undefined,
): string[] {
  const nextDefault = s.project.defaultWorkRule;
  if ((previousDefault ?? DEFAULT_WORK_RULE) === (nextDefault ?? DEFAULT_WORK_RULE)) return [];
  const deps: WorkRuleDeps = {
    calendars: s.calendars, calendar: s.calendar, resources: s.resources,
    project: previousDefault !== undefined ? { defaultWorkRule: previousDefault } : {},
  };
  const byTask = assignmentsByTask(s.assignments);
  const toHours: string[] = [];
  for (const task of s.tasks) {
    if (settleDefaultRuleChange(task, byTask.get(task.id) ?? [], deps, nextDefault).durationUnitChanged) {
      toHours.push(task.id);
    }
  }
  return toHours;
}
