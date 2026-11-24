import { ifcObjectSeed } from '../ifcWriter';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effHoursPerDay } from '@/utils/taskDuration';
import { writeFields } from './fieldTable';
import { pathOfGlobalId } from './identityPath';
import { intendedGlobalIds, type GlobalIdOfObject, type PlanningModel } from './identity';
import { placesNeededForOrder } from './childOrder';
import { DOCUMENT_FIELDS, SCHEDULE_SHARED_FIELDS, WORKPLAN_SHARED_FIELDS, type DocumentWriteSource } from './fields/documentFields';
import { CALENDAR_FIELDS, CALENDAR_SHARED_FIELDS } from './fields/calendarFields';
import { TASK_FIELDS, TASK_SHARED_FIELDS, type TaskWriteSource } from './fields/taskFields';
import { SEQUENCE_FIELDS, SEQUENCE_SHARED_FIELDS, sharedLagOf } from './fields/sequenceFields';
import { ownSchemas } from './nodes';
import { taskWindow } from './dateProjection';
import { recordedFieldsOf } from './recordedFields';
import {
  ATTRIBUTE, DEFAULT_HEADER_AUTHOR, IFCX_DATA_VERSION, IFCX_VERSION, OWN_HEADER_ID_PREFIX, type IfcxAttributeName,
} from './profile';

export interface IfcxHeader {
  readonly id: string;
  readonly ifcxVersion: string;
  readonly dataVersion: string;
  readonly author: string;
  readonly timestamp: string;
}

export interface IfcxEntry {
  readonly path: string;
  readonly attributes: Readonly<Partial<Record<IfcxAttributeName, Record<string, unknown>>>>;
}

export interface IfcxDocument {
  readonly header: IfcxHeader;
  readonly imports: readonly never[];
  readonly schemas: Readonly<Record<string, { value: Record<string, unknown> }>>;
  readonly data: readonly IfcxEntry[];
}

function attributesOf(pairs: readonly [IfcxAttributeName, Record<string, unknown>][]): IfcxEntry['attributes'] {
  const out: Partial<Record<IfcxAttributeName, Record<string, unknown>>> = {};
  for (const [name, value] of pairs) if (Object.keys(value).length > 0) out[name] = value;
  return out;
}

function childPlaces(tasks: readonly Task[], taskPathById: ReadonlyMap<string, string>): Map<string, number> {
  const entryChildren = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentId === null || task.parentId === undefined || !taskPathById.has(task.parentId)) continue;
    const list = entryChildren.get(task.parentId) ?? [];
    list.push(task.id);
    entryChildren.set(task.parentId, list);
  }
  const places = new Map<string, number>();
  const seen = new Set<string>();
  for (const parent of tasks) {
    if (seen.has(parent.id)) continue;
    seen.add(parent.id);
    const needed = placesNeededForOrder(entryChildren.get(parent.id) ?? [], parent.childIds);
    for (const [id, place] of needed ?? []) places.set(id, place);
  }
  return places;
}

export function hourDurationIsDerived(task: Task, calendar: WorkCalendar): boolean {
  return task.time.durationUnit === 'hours' && task.time.durationMinutes !== undefined && effHoursPerDay(calendar) > 0;
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

export function composeIfcxDocument(input: PlanningModel, writtenAt: Date, globalIdOf: GlobalIdOfObject): IfcxDocument {
  const { project } = input;
  const projectPath = pathOfGlobalId(globalIdOf('proj', project.id));
  const workplanPath = pathOfGlobalId(globalIdOf('wp', project.id));
  const schedulePath = pathOfGlobalId(globalIdOf('ws', project.id));
  const resourceCalendars = input.resourceCalendars ?? [];

  const calendars: { calendar: WorkCalendar; isProjectCalendar: boolean; path: string }[] = [
    { calendar: input.calendar, isProjectCalendar: true, path: pathOfGlobalId(globalIdOf('cal', input.calendar.id)) },
    ...resourceCalendars.map(calendar => ({ calendar, isProjectCalendar: false, path: pathOfGlobalId(globalIdOf('cal', calendar.id)) })),
  ];
  const calendarPathById = new Map<string, string>();
  for (const node of calendars) if (!calendarPathById.has(node.calendar.id)) calendarPathById.set(node.calendar.id, node.path);

  const taskPaths = input.tasks.map(task => pathOfGlobalId(globalIdOf('task', task.id)));
  const taskPathById = new Map<string, string>();
  input.tasks.forEach((task, index) => { if (!taskPathById.has(task.id)) taskPathById.set(task.id, taskPaths[index]); });
  const places = childPlaces(input.tasks, taskPathById);

  const data: IfcxEntry[] = [];
  const documentSource: DocumentWriteSource = {
    project, projectPath, workplanPath, projectCalendarPath: calendars[0].path,
    ...(input.timeModel !== undefined ? { timeModel: input.timeModel } : {}),
    importPristine: input.importPristine === true,
    literalCalendarPaths: (input.ifcLiteralCalendarIds ?? []).flatMap(id => calendarPathById.get(id) ?? []),
  };
  data.push({ path: workplanPath, attributes: attributesOf([
    [ATTRIBUTE.workplan, writeFields(WORKPLAN_SHARED_FIELDS, documentSource)],
    [ATTRIBUTE.document, writeFields(DOCUMENT_FIELDS, documentSource)],
  ]) });
  data.push({ path: schedulePath, attributes: attributesOf([[ATTRIBUTE.schedule, writeFields(SCHEDULE_SHARED_FIELDS, documentSource)]]) });

  for (const node of calendars) {
    data.push({ path: node.path, attributes: attributesOf([
      [ATTRIBUTE.calendar, writeFields(CALENDAR_SHARED_FIELDS, node)],
      [ATTRIBUTE.opsCalendar, writeFields(CALENDAR_FIELDS, node)],
    ]) });
  }

  input.tasks.forEach((task, index) => {
    const parentPath = task.parentId === null || task.parentId === undefined ? undefined : taskPathById.get(task.parentId);
    const calendarPath = task.calendarId === undefined ? undefined : calendarPathById.get(task.calendarId);
    const place = places.get(task.id);
    const recorded = input.recordedFields?.[task.id];
    const source: TaskWriteSource = {
      task, path: taskPaths[index], span: taskWindow(task),
      derivesDays: hourDurationIsDerived(task, resolveCalendar(task.calendarId, resourceCalendars, input.calendar)),
      atDayEnd: input.milestonesAtDayEnd?.has(task.id) === true,
      ...(recorded !== undefined && !sameKeys(recorded, recordedFieldsOf(task)) ? { recorded } : {}),
      ...(parentPath !== undefined ? { parentPath } : {}),
      ...(calendarPath !== undefined ? { calendarPath } : {}),
      ...(place !== undefined ? { place } : {}),
    };
    data.push({ path: source.path, attributes: attributesOf([
      [ATTRIBUTE.activity, writeFields(TASK_SHARED_FIELDS, source)],
      [ATTRIBUTE.opsTask, writeFields(TASK_FIELDS, source)],
    ]) });
  });

  for (const sequence of input.sequences) {
    const source = {
      sequence, path: pathOfGlobalId(globalIdOf('seq', sequence.id)),
      predecessorPath: taskPathById.get(sequence.predecessorId)!, successorPath: taskPathById.get(sequence.successorId)!,
      shared: sharedLagOf(sequence),
    };
    data.push({ path: source.path, attributes: attributesOf([
      [ATTRIBUTE.sequence, writeFields(SEQUENCE_SHARED_FIELDS, source)],
      [ATTRIBUTE.opsSequence, writeFields(SEQUENCE_FIELDS, source)],
    ]) });
  }

  const used = new Set<string>(data.flatMap(entry => Object.keys(entry.attributes)));
  return {
    header: {
      id: `${OWN_HEADER_ID_PREFIX}${projectPath}`, ifcxVersion: IFCX_VERSION, dataVersion: IFCX_DATA_VERSION,
      author: project.author || DEFAULT_HEADER_AUTHOR, timestamp: writtenAt.toISOString(),
    },
    imports: [],
    schemas: ownSchemas(used),
    data,
  };
}

export function globalIdsOf(input: PlanningModel): GlobalIdOfObject {
  const intended = intendedGlobalIds(input);
  return (kind, id) => intended.get(ifcObjectSeed(kind, id))!;
}
