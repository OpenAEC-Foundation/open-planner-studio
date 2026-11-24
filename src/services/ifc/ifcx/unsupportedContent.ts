import type { WriteIFCInput } from '../ifcWriter';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';
import {
  ASSIGNMENT_GROUPS, BASELINE_GROUPS, CALENDAR_GROUPS, carriedKeys, DOCUMENT_GROUPS, RESOURCE_GROUPS, SEQUENCE_GROUPS, TASK_GROUPS,
} from './fieldGroups';
import { BASELINE_TASK_KEYS_CARRIED } from './fields/baselineFields';
import { carriesValue } from './fieldTable';

function uncarriedKeys(object: object, carried: ReadonlySet<PropertyKey>): string[] {
  return Object.entries(object).filter(([key, value]) => !carried.has(key) && carriesValue(value)).map(([key]) => key);
}

const STEP_WRITER_INPUT_NOT_CARRIED = [
  'activityCodeTypes', 'customFieldDefs', 'libraryPool', 'xerSourceArchive', 'xer',
  'xerSourceProjectId', 'recordedSourceFormat', 'recoveryForeignSource', 'withheldTaskTimeFields', 'ifcLiteralCalendarIds',
] as const satisfies readonly (keyof WriteIFCInput)[];

export function unsupportedContent(input: WriteIFCInput): string[] {
  const found = new Set<string>();
  for (const key of STEP_WRITER_INPUT_NOT_CARRIED) if (carriesValue(input[key])) found.add(key);
  if (savedCustomTaskTypes(input.tasks, input.customTaskTypes ?? []).length > 0) found.add('customTaskTypes');
  if (input.importPristine === true) found.add('importPristine');
  if (input.minuteModelPending === true) found.add('minuteModelPending');

  const projectCarried = carriedKeys(DOCUMENT_GROUPS);
  for (const key of uncarriedKeys(input.project, projectCarried)) found.add(`project.${key}`);
  const calendarCarried = carriedKeys(CALENDAR_GROUPS);
  for (const calendar of [input.calendar, ...(input.resourceCalendars ?? [])]) {
    for (const key of uncarriedKeys(calendar, calendarCarried)) found.add(`calendar.${key}`);
  }
  const taskCarried = carriedKeys(TASK_GROUPS);
  const timeCarried = new Set<PropertyKey>(TASK_GROUPS.flatMap(group => group.carriesTime));
  for (const task of input.tasks) {
    for (const key of uncarriedKeys(task, taskCarried)) found.add(`task.${key}`);
    for (const key of uncarriedKeys(task.time, timeCarried)) found.add(`task.time.${key}`);
  }
  const sequenceCarried = carriedKeys(SEQUENCE_GROUPS);
  for (const sequence of input.sequences) {
    for (const key of uncarriedKeys(sequence, sequenceCarried)) found.add(`sequence.${key}`);
  }
  const resourceCarried = carriedKeys(RESOURCE_GROUPS);
  for (const resource of input.resources ?? []) {
    for (const key of uncarriedKeys(resource, resourceCarried)) found.add(`resource.${key}`);
  }
  const assignmentCarried = carriedKeys(ASSIGNMENT_GROUPS);
  for (const assignment of input.assignments ?? []) {
    for (const key of uncarriedKeys(assignment, assignmentCarried)) found.add(`assignment.${key}`);
  }
  const baselineCarried = carriedKeys(BASELINE_GROUPS);
  const rowCarried = new Set<PropertyKey>(BASELINE_TASK_KEYS_CARRIED);
  for (const baseline of input.baselines ?? []) {
    for (const key of uncarriedKeys(baseline, baselineCarried)) found.add(`baseline.${key}`);
    for (const row of baseline.tasks) for (const key of uncarriedKeys(row, rowCarried)) found.add(`baseline.tasks.${key}`);
  }
  return [...found];
}
