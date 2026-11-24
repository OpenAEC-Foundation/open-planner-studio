import type { WriteIFCInput } from '../ifcWriter';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';
import { CALENDAR_GROUPS, carriedKeys, DOCUMENT_GROUPS, SEQUENCE_GROUPS, TASK_GROUPS } from './fieldGroups';

function carriesValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function uncarriedKeys(object: object, carried: ReadonlySet<PropertyKey>): string[] {
  return Object.entries(object).filter(([key, value]) => !carried.has(key) && carriesValue(value)).map(([key]) => key);
}

const STEP_WRITER_INPUT_NOT_CARRIED = [
  'resources', 'assignments', 'activityCodeTypes', 'customFieldDefs', 'baselines', 'libraryPool', 'xerSourceArchive', 'xer',
  'xerSourceProjectId', 'recordedSourceFormat', 'recoveryForeignSource', 'withheldTaskTimeFields', 'ifcLiteralCalendarIds',
] as const satisfies readonly (keyof WriteIFCInput)[];

export function unsupportedContent(input: WriteIFCInput): string[] {
  const found = new Set<string>();
  for (const key of STEP_WRITER_INPUT_NOT_CARRIED) if (carriesValue(input[key])) found.add(key);
  if (input.activeBaselineId !== undefined && input.activeBaselineId !== null) found.add('activeBaselineId');
  if (input.comparedBaselineIds?.some(id => id !== null)) found.add('comparedBaselineIds');
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
  return [...found];
}
