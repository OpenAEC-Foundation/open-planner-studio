import { ifcObjectSeed, type WriteIFCInput } from '../ifcWriter';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
import { writeFields } from './fieldTable';
import { identityOfGlobalId, type IfcxIdentity } from './globalIdUuid';
import { libraryCalendarsWrittenByStep } from './stepGlobalIds';
import { intendedGlobalIds, type GlobalIdOfObject } from './identity';
import { placesNeededForOrder } from './childOrder';
import { CALENDAR_AREA, DOCUMENT_AREA, SEQUENCE_AREA, TASK_AREA } from './fieldGroups';
import { SCHEDULE_FIELDS } from './fields/documentFields';
import { lagFromShared, sharedLagOf } from './fields/sequenceFields';
import { ownSchemas } from './ownAttributes';
import { taskWindow } from './dateProjection';
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

export function composeIfcxDocument(input: WriteIFCInput, writtenAt: Date, globalIdOf: GlobalIdOfObject): IfcxDocument {
  const { project } = input;
  const projectIdentity = identityOfGlobalId(globalIdOf('proj', project.id));
  const workplanIdentity = identityOfGlobalId(globalIdOf('wp', project.id));
  const scheduleIdentity = identityOfGlobalId(globalIdOf('ws', project.id));
  const headerAuthor = project.author || DEFAULT_HEADER_AUTHOR;

  const libraryPlace = (input.resourceCalendars ?? []).findIndex(calendar => calendar.id === input.calendar.id);
  const calendars: { calendar: WorkCalendar; isProjectCalendar: boolean; identity: IfcxIdentity; libraryPlace?: number }[] = [
    {
      calendar: input.calendar, isProjectCalendar: true, identity: identityOfGlobalId(globalIdOf('cal', input.calendar.id)),
      ...(libraryPlace >= 0 ? { libraryPlace } : {}),
    },
    ...libraryCalendarsWrittenByStep(input).filter(calendar => calendar.id !== input.calendar.id).map(calendar => ({
      calendar, isProjectCalendar: false, identity: identityOfGlobalId(globalIdOf('cal', calendar.id)),
    })),
  ];
  const calendarPathById = new Map<string, string>();
  for (const node of calendars) if (!calendarPathById.has(node.calendar.id)) calendarPathById.set(node.calendar.id, node.identity.path);

  const taskIdentities = input.tasks.map(task => identityOfGlobalId(globalIdOf('task', task.id)));
  const taskPathById = new Map<string, string>();
  input.tasks.forEach((task, index) => { if (!taskPathById.has(task.id)) taskPathById.set(task.id, taskIdentities[index].path); });
  const places = childPlaces(input.tasks, taskPathById);

  const data: IfcxEntry[] = [];
  const documentSource = {
    project, headerUuid: projectIdentity.path, headerAuthor,
    ...(projectIdentity.globalIdOutsidePath !== undefined ? { projectGlobalIdOutsidePath: projectIdentity.globalIdOutsidePath } : {}),
    ...(workplanIdentity.globalIdOutsidePath !== undefined ? { workplanGlobalIdOutsidePath: workplanIdentity.globalIdOutsidePath } : {}),
    ...(scheduleIdentity.globalIdOutsidePath !== undefined ? { scheduleGlobalIdOutsidePath: scheduleIdentity.globalIdOutsidePath } : {}),
    projectCalendarPath: calendars[0].identity.path,
  };
  data.push({ path: workplanIdentity.path, attributes: attributesOf([
    [ATTRIBUTE.workplan, writeFields(DOCUMENT_AREA.planning, documentSource)],
    [ATTRIBUTE.document, writeFields(DOCUMENT_AREA.ops, documentSource)],
  ]) });
  data.push({ path: scheduleIdentity.path, attributes: attributesOf([
    [ATTRIBUTE.schedule, writeFields(SCHEDULE_FIELDS, { workplanPath: workplanIdentity.path })],
  ]) });

  for (const node of calendars) {
    data.push({ path: node.identity.path, attributes: attributesOf([
      [ATTRIBUTE.calendar, writeFields(CALENDAR_AREA.planning, node)],
      [ATTRIBUTE.opsCalendar, writeFields(CALENDAR_AREA.ops, node)],
    ]) });
  }

  input.tasks.forEach((task, index) => {
    const parentPath = task.parentId === null || task.parentId === undefined ? undefined : taskPathById.get(task.parentId);
    const calendarPath = task.calendarId === undefined ? undefined : calendarPathById.get(task.calendarId);
    const place = places.get(task.id);
    const source = {
      task, identity: taskIdentities[index], span: taskWindow(task),
      ...(parentPath !== undefined ? { parentPath } : {}),
      ...(calendarPath !== undefined ? { calendarPath } : {}),
      ...(place !== undefined ? { place } : {}),
    };
    data.push({ path: source.identity.path, attributes: attributesOf([
      [ATTRIBUTE.activity, writeFields(TASK_AREA.planning, source)],
      [ATTRIBUTE.opsTask, writeFields(TASK_AREA.ops, source)],
    ]) });
  });

  for (const sequence of input.sequences) {
    const source = {
      sequence, identity: identityOfGlobalId(globalIdOf('seq', sequence.id)),
      predecessorPath: taskPathById.get(sequence.predecessorId)!, successorPath: taskPathById.get(sequence.successorId)!,
      ...sharedAndDerivedLag(sequence),
    };
    data.push({ path: source.identity.path, attributes: attributesOf([
      [ATTRIBUTE.sequence, writeFields(SEQUENCE_AREA.planning, source)],
      [ATTRIBUTE.opsSequence, writeFields(SEQUENCE_AREA.ops, source)],
    ]) });
  }

  const used = new Set<string>(data.flatMap(entry => Object.keys(entry.attributes)));
  return {
    header: {
      id: `${OWN_HEADER_ID_PREFIX}${projectIdentity.path}`, ifcxVersion: IFCX_VERSION, dataVersion: IFCX_DATA_VERSION,
      author: headerAuthor, timestamp: writtenAt.toISOString(),
    },
    imports: [],
    schemas: ownSchemas(used),
    data,
  };
}

function sharedAndDerivedLag(sequence: Sequence) {
  const shared = sharedLagOf(sequence);
  return { shared, derived: lagFromShared(shared) };
}

export function globalIdsOf(input: WriteIFCInput): GlobalIdOfObject {
  const intended = intendedGlobalIds(input);
  return (kind, id) => intended.get(ifcObjectSeed(kind, id))!;
}
