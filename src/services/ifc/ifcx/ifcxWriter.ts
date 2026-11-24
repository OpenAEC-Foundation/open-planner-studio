import { ifcObjectSeed, type WriteIFCInput } from '../ifcWriter';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { checkValue, writeFields } from './fieldTable';
import { identityOfGlobalId, type IfcxIdentity } from './globalIdUuid';
import { libraryCalendarsWrittenByStep } from './stepGlobalIds';
import { intendedGlobalIds, type GlobalIdOfObject } from './identity';
import { placesNeededForOrder } from './childOrder';
import { CALENDAR_AREA, DOCUMENT_AREA, SEQUENCE_AREA, TASK_AREA } from './fieldGroups';
import { SCHEDULE_FIELDS } from './fields/documentFields';
import { HEADER_VALUE, ownSchemas } from './ownAttributes';
import { attributeValueProblem } from './schemaCheck';
import { unsupportedContent } from './unsupportedContent';
import { attributeRuleProblem, inconsistentContent } from './consistency';
import { taskWindow } from './dateProjection';
import { selfCheckDifferences } from './selfCheck';
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

function refused(code: 'unsupported' | 'inconsistent' | 'invalid', details: readonly string[], fields: readonly string[]): IfcxWriteRefusedError {
  return new IfcxWriteRefusedError(code, details.join('; '), [...new Set(fields)]);
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

function invalidValuesIn(document: IfcxDocument): IfcxWriteRefusedError | undefined {
  const header = checkValue(HEADER_VALUE, document.header);
  if (header) return refused('invalid', [`Ongeldige kop: ${header.kind === 'invalid' ? header.detail : 'onbekend veld'}`], [`header.${header.field}`]);
  for (const entry of document.data) {
    for (const [name, value] of Object.entries(entry.attributes) as [IfcxAttributeName, Record<string, unknown>][]) {
      const problem = attributeValueProblem(entry.path, name, value);
      if (problem) return refused('invalid', [`${name}: ${problem.detail}`], [`${name}.${problem.place.field ?? ''}`]);
      const rule = attributeRuleProblem(name, value);
      if (rule) return refused('invalid', [`${name}: ${rule.detail}`], [`${name}.${rule.field}`]);
    }
  }
  return undefined;
}

export function buildIfcxDocument(input: WriteIFCInput, writtenAt: Date): IfcxDocument {
  if (Number.isNaN(writtenAt.getTime())) throw refused('invalid', ['Het moment van schrijven is geen geldige datum'], ['header.timestamp']);
  let document: IfcxDocument;
  try {
    const intended = intendedGlobalIds(input);
    const globalIdOf: GlobalIdOfObject = (kind, id) => intended.get(ifcObjectSeed(kind, id))!;
    const inconsistencies = inconsistentContent(input, globalIdOf);
    if (inconsistencies.length > 0) {
      throw refused('inconsistent', inconsistencies.map(item => item.detail), inconsistencies.map(item => item.field));
    }
    document = composeIfcxDocument(input, writtenAt, globalIdOf);
  } catch (error) {
    if (error instanceof IfcxWriteRefusedError) throw error;
    throw refused('invalid', [`De planning heeft een vorm die de writer niet kan schrijven: ${messageOf(error)}`], ['planning']);
  }
  const invalid = invalidValuesIn(document);
  if (invalid) throw invalid;
  return document;
}

function composeIfcxDocument(input: WriteIFCInput, writtenAt: Date, globalIdOf: GlobalIdOfObject): IfcxDocument {
  const { project } = input;
  const projectIdentity = identityOfGlobalId(globalIdOf('proj', project.id));
  const workplanIdentity = identityOfGlobalId(globalIdOf('wp', project.id));
  const scheduleIdentity = identityOfGlobalId(globalIdOf('ws', project.id));
  for (const [kind, identity] of [['wp', workplanIdentity], ['ws', scheduleIdentity]] as const) {
    if (identity.globalIdOutsidePath !== undefined) {
      throw refused('unsupported', [`De GlobalId van het ${kind === 'wp' ? 'werkplan' : 'werkschema'} heeft geen 128-bitsvorm`], [`ifcGlobalIds.${kind}`]);
    }
  }
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
    projectCalendarPath: calendars[0].identity.path, projectCalendarId: input.calendar.id,
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
    reread = readIfcxText(text, false);
  } catch (error) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer leest niet terug: ${messageOf(error)}`);
  }
  const differences = selfCheckDifferences(input, reread);
  if (differences.length > 0) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer geeft een andere planning: ${differences.join('; ')}`,
      differences.map(difference => difference.slice(0, difference.indexOf(': '))));
  }
  return text;
}
