import type { Task } from '@/types/task';
import type { WorkRule } from '@/types/workRule';
import { durationEditKeepsWorkOf, remainingMinutesOf } from './workRuleApply';
import { storedWorkDeviates } from './workDeviation';

export function assignmentWorkDeviation(
  task: Task,
  unitsPerDay: number,
  storedRemainingMinutes: number | undefined,
  hoursPerDay: number,
  contoured: boolean,
): { stored: number; derived: number } | null {
  if (storedRemainingMinutes === undefined || contoured) return null;
  const derived = remainingMinutesOf(task, { hoursPerDay }) * unitsPerDay;
  const stored = storedRemainingMinutes;
  if (!storedWorkDeviates(stored, derived)) return null;
  const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
  return { stored: hours(stored), derived: hours(derived) };
}

export function workDeviationEffectKey(
  task: Pick<Task, 'workRule' | 'mspTaskType' | 'effortDriven'>,
  defaultWorkRule: WorkRule | undefined,
): 'properties.assignments.workDeviatesKeepsWork' | 'properties.assignments.workDeviatesFollowsDuration' {
  return durationEditKeepsWorkOf(task, defaultWorkRule)
    ? 'properties.assignments.workDeviatesKeepsWork'
    : 'properties.assignments.workDeviatesFollowsDuration';
}
