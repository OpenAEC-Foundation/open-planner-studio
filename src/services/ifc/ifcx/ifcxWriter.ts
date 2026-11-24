import type { WriteIFCInput } from '../ifcWriter';
import { planningCanon, planningDifference } from '../foreign/planningCanon';
import { shownFinish, shownStart } from '@/utils/taskDates';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { writeFields } from './fieldTable';
import { identityOfGlobalId, type IfcxIdentity } from './globalIdUuid';
import { libraryCalendarsWrittenByStep, stepGlobalIdsFor } from './stepGlobalIds';
import { placesNeededForOrder } from './childOrder';
import { projectSpan } from './dateProjection';
import { CALENDAR_GROUPS, DOCUMENT_GROUPS, opsFields, planningFields, SEQUENCE_GROUPS, TASK_GROUPS } from './fieldGroups';
import { SCHEDULE_FIELDS } from './fields/documentFields';
import { ownSchemas } from './ownAttributes';
import { unsupportedContent } from './unsupportedContent';
import { IfcxWriteRefusedError } from './ifcxErrors';
import {
  ATTRIBUTE, DEFAULT_HEADER_AUTHOR, IFCX_DATA_VERSION, IFCX_VERSION, OWN_HEADER_ID_PREFIX, type IfcxAttributeName,
} from './profile';
import { readIfcxText } from './ifcxReader';

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

function refused(detail: string, field: string): IfcxWriteRefusedError {
  return new IfcxWriteRefusedError('unsupported', detail, [field]);
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

export function buildIfcxDocument(input: WriteIFCInput, writtenAt: Date): IfcxDocument {
  const { project } = input;
  const globalIdOf = stepGlobalIdsFor(input);
  const projectIdentity = identityOfGlobalId(globalIdOf('proj', project.id));
  const workplanIdentity = identityOfGlobalId(globalIdOf('wp', project.id));
  const scheduleIdentity = identityOfGlobalId(globalIdOf('ws', project.id));
  if (workplanIdentity.globalIdOutsidePath !== undefined || scheduleIdentity.globalIdOutsidePath !== undefined) {
    throw refused('Het werkplan of werkschema heeft geen GlobalId van 128 bits', 'ifcGlobalIds.wp');
  }
  const headerAuthor = project.author || DEFAULT_HEADER_AUTHOR;

  const calendars: { calendar: WorkCalendar; isProjectCalendar: boolean; identity: IfcxIdentity }[] = [
    { calendar: input.calendar, isProjectCalendar: true, identity: identityOfGlobalId(globalIdOf('cal', input.calendar.id)) },
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
    projectCalendarPath: calendars[0].identity.path, projectCalendarId: input.calendar.id,
  };
  data.push({ path: workplanIdentity.path, attributes: attributesOf([
    [ATTRIBUTE.workplan, writeFields(planningFields(DOCUMENT_GROUPS), documentSource)],
    [ATTRIBUTE.document, writeFields(opsFields(DOCUMENT_GROUPS), documentSource)],
  ]) });
  data.push({ path: scheduleIdentity.path, attributes: attributesOf([
    [ATTRIBUTE.schedule, writeFields(SCHEDULE_FIELDS, { workplanPath: workplanIdentity.path })],
  ]) });

  for (const node of calendars) {
    data.push({ path: node.identity.path, attributes: attributesOf([
      [ATTRIBUTE.calendar, writeFields(planningFields(CALENDAR_GROUPS), node)],
      [ATTRIBUTE.opsCalendar, writeFields(opsFields(CALENDAR_GROUPS), node)],
    ]) });
  }

  input.tasks.forEach((task, index) => {
    const parentPath = task.parentId === null || task.parentId === undefined ? undefined : taskPathById.get(task.parentId);
    if (task.parentId !== null && task.parentId !== undefined && parentPath === undefined) {
      throw refused(`Taak ${task.id} hangt onder een taak die niet bestaat`, 'task.parentId');
    }
    const calendarPath = task.calendarId === undefined ? undefined : calendarPathById.get(task.calendarId);
    const place = places.get(task.id);
    const source = {
      task, identity: taskIdentities[index], span: projectSpan(shownStart(task), shownFinish(task)),
      ...(parentPath !== undefined ? { parentPath } : {}),
      ...(calendarPath !== undefined ? { calendarPath } : {}),
      ...(place !== undefined ? { place } : {}),
    };
    data.push({ path: source.identity.path, attributes: attributesOf([
      [ATTRIBUTE.activity, writeFields(planningFields(TASK_GROUPS), source)],
      [ATTRIBUTE.opsTask, writeFields(opsFields(TASK_GROUPS), source)],
    ]) });
  });

  for (const sequence of input.sequences) {
    const predecessorPath = taskPathById.get(sequence.predecessorId);
    const successorPath = taskPathById.get(sequence.successorId);
    if (predecessorPath === undefined || successorPath === undefined) {
      throw refused(`Relatie ${sequence.id} wijst naar een taak die niet bestaat`, 'sequence.predecessorId');
    }
    const source = { sequence, identity: identityOfGlobalId(globalIdOf('seq', sequence.id)), predecessorPath, successorPath };
    data.push({ path: source.identity.path, attributes: attributesOf([
      [ATTRIBUTE.sequence, writeFields(planningFields(SEQUENCE_GROUPS), source)],
      [ATTRIBUTE.opsSequence, writeFields(opsFields(SEQUENCE_GROUPS), source)],
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

function indented(json: string): string {
  return json.replace(/\n/g, '\n  ');
}

export function serializeIfcx(document: IfcxDocument): string {
  return [
    '{',
    `  "header": ${indented(JSON.stringify(document.header, null, 2))},`,
    `  "imports": [],`,
    `  "schemas": ${indented(JSON.stringify(document.schemas, null, 2))},`,
    '  "data": [',
    document.data.map(entry => `    ${JSON.stringify(entry)}`).join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function writeIfcx(input: WriteIFCInput, writtenAt: Date = new Date()): string {
  const unsupported = unsupportedContent(input);
  if (unsupported.length > 0) {
    throw new IfcxWriteRefusedError('unsupported', `IFCX draagt deze gegevens nog niet: ${unsupported.join(', ')}`, unsupported);
  }
  const text = serializeIfcx(buildIfcxDocument(input, writtenAt));
  let reread;
  try {
    reread = readIfcxText(text);
  } catch (error) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer leest niet terug: ${messageOf(error)}`);
  }
  if (planningCanon(reread) !== planningCanon(input)) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer geeft een andere planning: ${planningDifference(input, reread)}`);
  }
  return text;
}
