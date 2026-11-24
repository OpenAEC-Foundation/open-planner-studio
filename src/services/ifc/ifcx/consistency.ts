import type { WriteIFCInput } from '../ifcWriter';
import type { WorkCalendar } from '@/types/calendar';
import { writeFields } from './fieldTable';
import { CALENDAR_AREA } from './fieldGroups';
import { placesNeededForOrder, taskInParentCycle } from './childOrder';
import { resourceInconsistencies } from './resourceConsistency';

export interface Inconsistency {
  readonly field: string;
  readonly detail: string;
}

function duplicateOf(ids: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return undefined;
}

function writtenCalendar(calendar: WorkCalendar): string {
  const source = { calendar, isProjectCalendar: true, identity: { path: '' } };
  return JSON.stringify([writeFields(CALENDAR_AREA.planning, source), writeFields(CALENDAR_AREA.ops, source)]);
}

export function inconsistentContent(input: WriteIFCInput): Inconsistency[] {
  const found: Inconsistency[] = [];
  const add = (field: string, detail: string) => { found.push({ field, detail }); };
  const taskIds = input.tasks.map(task => task.id);
  const taskIdSet = new Set(taskIds);
  const duplicateTask = duplicateOf(taskIds);
  if (duplicateTask !== undefined) add('task.id', `Twee taken hebben het id ${duplicateTask}`);
  const duplicateSequence = duplicateOf(input.sequences.map(sequence => sequence.id));
  if (duplicateSequence !== undefined) add('sequence.id', `Twee relaties hebben het id ${duplicateSequence}`);

  const library = input.resourceCalendars ?? [];
  const duplicateCalendar = duplicateOf(library.map(calendar => calendar.id));
  if (duplicateCalendar !== undefined) add('calendar.id', `Twee kalenders in de bibliotheek hebben het id ${duplicateCalendar}`);
  const cacheEntry = library.find(calendar => calendar.id === input.calendar.id);
  if (cacheEntry && cacheEntry !== input.calendar && writtenCalendar(cacheEntry) !== writtenCalendar(input.calendar)) {
    add('resourceCalendars', `De bibliotheek heeft een andere kalender ${input.calendar.id} dan de projectkalender`);
  }
  if (input.project.calendarId !== input.calendar.id && library.some(calendar => calendar.id === input.project.calendarId)) {
    add('resourceCalendars', `De projectkalender ${input.project.calendarId} in de bibliotheek is niet de kalender van het project`);
  }

  for (const task of input.tasks) {
    if (task.parentId !== null && task.parentId !== undefined && !taskIdSet.has(task.parentId)) {
      add('task.parentId', `Taak ${task.id} hangt onder taak ${task.parentId}, die niet bestaat`);
    }
  }
  const cycle = taskInParentCycle(input.tasks);
  if (cycle !== undefined) add('task.parentId', `Taak ${cycle} is haar eigen voorouder`);
  const children = new Map<string, string[]>();
  for (const task of input.tasks) {
    if (task.parentId === null || task.parentId === undefined || !taskIdSet.has(task.parentId)) continue;
    const list = children.get(task.parentId);
    if (list) list.push(task.id); else children.set(task.parentId, [task.id]);
  }
  for (const task of input.tasks) {
    if (placesNeededForOrder(children.get(task.id) ?? [], task.childIds) === undefined) {
      add('task.childIds', `De kinderen van taak ${task.id} kloppen niet met de taken die haar als ouder noemen`);
      break;
    }
  }

  for (const sequence of input.sequences) {
    if (!taskIdSet.has(sequence.predecessorId)) add('sequence.predecessorId', `Relatie ${sequence.id} komt van een taak die niet bestaat`);
    if (!taskIdSet.has(sequence.successorId)) add('sequence.successorId', `Relatie ${sequence.id} gaat naar een taak die niet bestaat`);
  }
  found.push(...resourceInconsistencies(input));
  return found;
}
