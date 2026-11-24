import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
import { ALL_RECORDED_SLOT_KEYS, type RecordedFieldKey } from '../ifcTaskSlots';
import { ifcObjectSeed } from '../ifcWriter';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { checkValue, readFields } from './fieldTable';
import { globalIdOfIdentity, isUuidPath, nameBasedUuid } from './globalIdUuid';
import { childrenInPlace } from './childOrder';
import { identityProblems } from './identity';
import { stepRoundtrip } from './stepRoundtrip';
import { composeIfcxDocument, globalIdsOf, type IfcxDocument } from './projection';
import { HEADER_VALUE } from './ownAttributes';
import { CALENDAR_AREA, DOCUMENT_AREA, SEQUENCE_AREA, TASK_AREA } from './fieldGroups';
import { SCHEDULE_FIELDS, emptyProject, type DocumentReadTarget } from './fields/documentFields';
import { emptyCalendar, type CalendarReadTarget } from './fields/calendarFields';
import { emptyTask, type TaskReadTarget } from './fields/taskFields';
import { emptySequence, type SequenceReadTarget } from './fields/sequenceFields';
import { attributeValueProblem, schemaDefinitionProblems, type IfcxCheckProblem } from './schemaCheck';
import { IfcxReadError, type IfcxErrorPlace } from './ifcxErrors';
import {
  ATTRIBUTE, IFCX_VERSION, OPS_PROFILE_MAJOR, OWN_HEADER_ID_PREFIX, type IfcxAttributeName,
} from './profile';

export type IfcxImportResult = ImportResult;

export type IfcxClassification = 'own' | 'foreign' | 'not-ifcx' | 'unreadable';

type Attributes = Map<IfcxAttributeName, Record<string, unknown>>;

interface IfcxNode {
  readonly path: string;
  readonly attributes: Attributes;
}

type NodeKind = 'workplan' | 'schedule' | 'calendar' | 'task' | 'sequence';

const NODE_SHAPES: readonly { kind: NodeKind; required: readonly IfcxAttributeName[]; optional: readonly IfcxAttributeName[] }[] = [
  { kind: 'workplan', required: [ATTRIBUTE.workplan, ATTRIBUTE.document], optional: [] },
  { kind: 'schedule', required: [ATTRIBUTE.schedule], optional: [] },
  { kind: 'calendar', required: [ATTRIBUTE.calendar, ATTRIBUTE.opsCalendar], optional: [] },
  { kind: 'task', required: [ATTRIBUTE.activity, ATTRIBUTE.opsTask], optional: [] },
  { kind: 'sequence', required: [ATTRIBUTE.sequence, ATTRIBUTE.opsSequence], optional: [] },
];

const TOP_LEVEL_KEYS = new Set(['header', 'imports', 'schemas', 'data']);
const HEADER_KEYS = new Set(['id', 'ifcxVersion', 'dataVersion', 'author', 'timestamp']);
const ENTRY_KEYS = new Set(['path', 'attributes', 'children', 'inherits']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function foreign(detail: string, place?: IfcxErrorPlace): IfcxReadError {
  return new IfcxReadError('foreign', detail, place);
}

function invalid(detail: string, place?: IfcxErrorPlace): IfcxReadError {
  return new IfcxReadError('invalid', detail, place);
}

function parseDocument(text: string): Record<string, unknown> {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new IfcxReadError('not-ifcx', 'Het bestand is geen JSON');
  }
  if (!isPlainObject(document) || !isPlainObject(document.header) || typeof document.header.ifcxVersion !== 'string'
    || !Array.isArray(document.data)) {
    throw new IfcxReadError('not-ifcx', 'Het bestand heeft geen IFCX-kop en -data');
  }
  if (document.header.ifcxVersion !== IFCX_VERSION) {
    throw new IfcxReadError('version', `Onbekende IFCX-versie ${JSON.stringify(document.header.ifcxVersion)}`);
  }
  for (const key of Object.keys(document)) if (!TOP_LEVEL_KEYS.has(key)) throw foreign(`Onbekend veld ${key} bovenin het bestand`);
  for (const key of Object.keys(document.header)) if (!HEADER_KEYS.has(key)) throw foreign(`Onbekend kopveld ${key}`);
  return document;
}

function headerOf(document: Record<string, unknown>): { uuid: string; fields: Record<string, unknown> } {
  const header = document.header as Record<string, unknown>;
  if (typeof header.id !== 'string' || !header.id.startsWith(OWN_HEADER_ID_PREFIX)) {
    throw foreign(`Het bestand is niet door Open Planner Studio begonnen (${JSON.stringify(header.id)})`);
  }
  const problem = checkValue(HEADER_VALUE, header);
  if (problem) throw invalid(`Ongeldige kop: ${problem.kind === 'invalid' ? problem.detail : 'onbekend veld'}`, { field: `header.${problem.field}` });
  const uuid = header.id.slice(OWN_HEADER_ID_PREFIX.length);
  if (!Array.isArray(document.imports)) throw invalid('Het bestand heeft geen lijst imports', { field: 'imports' });
  if (document.imports.length > 0) throw foreign('Het bestand importeert andere bestanden');
  if (!isPlainObject(document.schemas)) throw invalid('Het bestand heeft geen schemas', { field: 'schemas' });
  return { uuid, fields: header };
}

function thrown(problem: IfcxCheckProblem): IfcxReadError {
  return new IfcxReadError(problem.code, problem.detail, problem.place);
}

function nodesOf(data: readonly unknown[]): IfcxNode[] {
  const nodes = new Map<string, Attributes>();
  for (const entry of data) {
    if (!isPlainObject(entry) || typeof entry.path !== 'string') throw invalid('Een entry heeft geen pad');
    const path = entry.path;
    for (const key of Object.keys(entry)) if (!ENTRY_KEYS.has(key)) throw foreign(`Onbekend entryveld ${key}`, { path });
    if ('children' in entry) throw foreign('Het bestand gebruikt children', { path });
    if ('inherits' in entry) throw foreign('Het bestand gebruikt inherits', { path });
    if (!isPlainObject(entry.attributes)) throw foreign('Een entry zonder attributen', { path });
    if (!isUuidPath(path)) throw foreign('Een pad dat geen UUID is', { path });
    const attributes = nodes.get(path) ?? new Map();
    for (const [name, value] of Object.entries(entry.attributes)) {
      if (attributes.has(name as IfcxAttributeName)) throw foreign('Twee bijdragen van hetzelfde attribuut op één pad', { path, attribute: name });
      attributes.set(name as IfcxAttributeName, value as Record<string, unknown>);
    }
    nodes.set(path, attributes);
  }
  return [...nodes].map(([path, attributes]) => ({ path, attributes }));
}

function assertProfileVersion(nodes: readonly IfcxNode[]): void {
  for (const node of nodes) {
    const document = node.attributes.get(ATTRIBUTE.document);
    if (document === undefined) continue;
    const version = isPlainObject(document) ? document.formatVersion : undefined;
    if (typeof version !== 'string') throw invalid('Het bestand noemt geen profielversie', { path: node.path, attribute: ATTRIBUTE.document, field: 'formatVersion' });
    const major = typeof version === 'string' ? /^(\d+)\./.exec(version)?.[1] : undefined;
    if (major !== undefined && Number(major) > OPS_PROFILE_MAJOR) {
      throw new IfcxReadError('newer-profile', `Profielversie ${version} is nieuwer dan deze app kent`, { path: node.path, attribute: ATTRIBUTE.document });
    }
  }
}

function assertValues(nodes: readonly IfcxNode[]): void {
  for (const node of nodes) {
    for (const [name, value] of node.attributes) {
      const problem = attributeValueProblem(node.path, name, value);
      if (problem) throw thrown(problem);
    }
  }
}

function assertIdentityPath(path: string, globalIdOutsidePath: string | undefined, place: IfcxErrorPlace): void {
  if (globalIdOutsidePath !== undefined && nameBasedUuid(globalIdOutsidePath) !== path) {
    throw invalid('Het pad hoort niet bij de GlobalId die het object draagt', { ...place, field: 'globalId' });
  }
}

function assertSchemas(schemas: unknown, nodes: readonly IfcxNode[]): void {
  const used = new Set<string>(nodes.flatMap(node => [...node.attributes.keys()]));
  const [problem] = schemaDefinitionProblems(schemas, used);
  if (problem) throw thrown(problem);
}

function kindOf(node: IfcxNode): NodeKind {
  for (const shape of NODE_SHAPES) {
    if (!shape.required.every(name => node.attributes.has(name))) continue;
    const allowed = new Set([...shape.required, ...shape.optional]);
    if ([...node.attributes.keys()].every(name => allowed.has(name))) return shape.kind;
  }
  throw foreign(`Een pad met attributen die samen geen planningsobject vormen: ${[...node.attributes.keys()].join(', ')}`, { path: node.path });
}

function recordedFieldsOf(tasks: readonly Task[]): Record<string, RecordedFieldKey[]> {
  const out: Record<string, RecordedFieldKey[]> = {};
  for (const task of tasks) {
    out[task.id] = ALL_RECORDED_SLOT_KEYS.filter(key => {
      const value = task.time[key];
      return typeof value === 'string' ? value !== '' : value !== undefined;
    });
  }
  return out;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => sameValue(a[key], b[key]));
  }
  return a === b;
}

const shown = (value: unknown) => (value === undefined ? 'afwezig' : JSON.stringify(value));

function assertProjection(
  header: Record<string, unknown>, nodes: readonly IfcxNode[], projected: IfcxDocument, objectAt: (path: string) => string,
): void {
  for (const key of ['id', 'dataVersion', 'author'] as const) {
    if (header[key] !== projected.header[key]) {
      throw invalid(`De kop past niet bij de planning: ${key} is ${shown(header[key])}, de planning geeft ${shown(projected.header[key])}`, { field: `header.${key}` });
    }
  }
  const expected = new Map(projected.data.map(entry => [entry.path, entry.attributes]));
  for (const node of nodes) {
    const attributes = expected.get(node.path);
    if (!attributes) throw invalid(`${objectAt(node.path)} hoort niet bij de planning die het bestand beschrijft`, { path: node.path });
    for (const name of new Set([...node.attributes.keys(), ...Object.keys(attributes) as IfcxAttributeName[]])) {
      const inFile = node.attributes.get(name) ?? {};
      const wanted = attributes[name] ?? {};
      for (const field of new Set([...Object.keys(inFile), ...Object.keys(wanted)])) {
        if (sameValue(inFile[field], wanted[field])) continue;
        throw invalid(`${objectAt(node.path)}: ${field} is ${shown(inFile[field])}, de precieze gegevens geven ${shown(wanted[field])}`, { path: node.path, attribute: name, field });
      }
    }
  }
  if (expected.size !== nodes.length) throw invalid('Het bestand mist een object van de planning');
}

export function readIfcxText(text: string, checked = true): IfcxImportResult {
  const document = parseDocument(text);
  const header = headerOf(document);
  const nodes = nodesOf(document.data as unknown[]);
  assertProfileVersion(nodes);
  if (checked) assertValues(nodes);
  assertSchemas(document.schemas, nodes);
  const byKind = new Map<NodeKind, IfcxNode[]>();
  const kindAt = new Map<string, NodeKind>();
  for (const node of nodes) {
    const kind = kindOf(node);
    kindAt.set(node.path, kind);
    const list = byKind.get(kind);
    if (list) list.push(node); else byKind.set(kind, [node]);
  }
  const of = (kind: NodeKind) => byKind.get(kind) ?? [];
  if (of('workplan').length !== 1) throw foreign(`Het bestand heeft ${of('workplan').length} werkplannen van Open Planner Studio`);
  if (of('schedule').length !== 1) throw invalid(`Het bestand heeft ${of('schedule').length} werkschema's`);
  const reference = (path: string | undefined, kind: NodeKind, place: IfcxErrorPlace): string | undefined => {
    if (path === undefined) return undefined;
    if (kindAt.get(path) !== kind) throw invalid(`Verwijzing naar ${path} is geen ${kind}`, place);
    return path;
  };

  const workplan = of('workplan')[0];
  const project = emptyProject();
  const documentTarget: DocumentReadTarget = { project, headerUuid: header.uuid, formatVersion: '', calendarPath: '' };
  readFields(DOCUMENT_AREA.planning, workplan.attributes.get(ATTRIBUTE.workplan)!, documentTarget);
  readFields(DOCUMENT_AREA.ops, workplan.attributes.get(ATTRIBUTE.document)!, documentTarget);
  const documentPlace = { path: workplan.path, attribute: ATTRIBUTE.document };
  assertIdentityPath(header.uuid, documentTarget.projectGlobalIdOutsidePath, documentPlace);
  assertIdentityPath(workplan.path, documentTarget.workplanGlobalIdOutsidePath, documentPlace);
  const schedule = of('schedule')[0];
  assertIdentityPath(schedule.path, documentTarget.scheduleGlobalIdOutsidePath, documentPlace);
  const scheduleTarget: { workplanPath?: string } = {};
  readFields(SCHEDULE_FIELDS, schedule.attributes.get(ATTRIBUTE.schedule)!, scheduleTarget);
  if (scheduleTarget.workplanPath !== workplan.path) {
    throw invalid('Het werkschema hoort niet bij het werkplan', { path: schedule.path, attribute: ATTRIBUTE.schedule, field: 'workplan' });
  }

  const projectCalendarPath = reference(documentTarget.calendarPath, 'calendar', { ...documentPlace, field: 'calendar' })!;
  const calendarTargets: CalendarReadTarget[] = of('calendar').map(node => {
    const target: CalendarReadTarget = { calendar: emptyCalendar(), isProjectCalendar: node.path === projectCalendarPath, path: node.path };
    readFields(CALENDAR_AREA.planning, node.attributes.get(ATTRIBUTE.calendar)!, target);
    readFields(CALENDAR_AREA.ops, node.attributes.get(ATTRIBUTE.opsCalendar)!, target);
    assertIdentityPath(node.path, target.globalIdOutsidePath, { path: node.path, attribute: ATTRIBUTE.opsCalendar });
    return target;
  });
  const calendarIdAt = new Map(calendarTargets.map(target => [target.path, target.calendar.id]));
  const projectCalendar = calendarTargets.find(target => target.isProjectCalendar)!.calendar;
  project.calendarId = projectCalendar.id;
  const resourceCalendars: WorkCalendar[] = calendarTargets.filter(target => !target.isProjectCalendar).map(target => target.calendar);

  const taskTargets: TaskReadTarget[] = of('task').map(node => {
    const target: TaskReadTarget = { task: emptyTask(), path: node.path };
    readFields(TASK_AREA.planning, node.attributes.get(ATTRIBUTE.activity)!, target);
    readFields(TASK_AREA.ops, node.attributes.get(ATTRIBUTE.opsTask)!, target);
    assertIdentityPath(node.path, target.globalIdOutsidePath, { path: node.path, attribute: ATTRIBUTE.opsTask });
    return target;
  });
  const taskIdAt = new Map(taskTargets.map(target => [target.path, target.task.id]));
  const childrenOf = new Map<string, TaskReadTarget[]>();
  for (const target of taskTargets) {
    const place = { path: target.path, attribute: ATTRIBUTE.opsTask };
    const parentPath = reference(target.parentPath, 'task', { ...place, field: 'parent' });
    target.task.parentId = parentPath === undefined ? null : taskIdAt.get(parentPath)!;
    if (parentPath !== undefined) {
      const siblings = childrenOf.get(parentPath);
      if (siblings) siblings.push(target); else childrenOf.set(parentPath, [target]);
    }
    const calendarPath = reference(target.calendarPath, 'calendar', { ...place, field: 'calendar' });
    if (calendarPath !== undefined) target.task.calendarId = calendarIdAt.get(calendarPath)!;
  }
  for (const target of taskTargets) {
    target.task.childIds = childrenInPlace(childrenOf.get(target.path) ?? [], child => child.place).map(child => child.task.id);
  }

  const sequenceTargets: SequenceReadTarget[] = of('sequence').map(node => {
    const target: SequenceReadTarget = { sequence: emptySequence(), path: node.path, predecessorPath: '', successorPath: '' };
    readFields(SEQUENCE_AREA.planning, node.attributes.get(ATTRIBUTE.sequence)!, target);
    readFields(SEQUENCE_AREA.ops, node.attributes.get(ATTRIBUTE.opsSequence)!, target);
    const place = { path: node.path, attribute: ATTRIBUTE.opsSequence };
    target.sequence.predecessorId = taskIdAt.get(reference(target.predecessorPath, 'task', { ...place, field: 'predecessor' })!)!;
    target.sequence.successorId = taskIdAt.get(reference(target.successorPath, 'task', { ...place, field: 'successor' })!)!;
    assertIdentityPath(node.path, target.globalIdOutsidePath, { path: node.path, attribute: ATTRIBUTE.opsSequence });
    return target;
  });

  const tasks = taskTargets.map(target => target.task);
  const sequences: Sequence[] = sequenceTargets.map(target => target.sequence);
  const ifcGlobalIds: Record<string, string> = {
    [ifcObjectSeed('proj', project.id)]: globalIdOfIdentity(header.uuid, documentTarget.projectGlobalIdOutsidePath),
    [ifcObjectSeed('wp', project.id)]: globalIdOfIdentity(workplan.path, documentTarget.workplanGlobalIdOutsidePath),
    [ifcObjectSeed('ws', project.id)]: globalIdOfIdentity(schedule.path, documentTarget.scheduleGlobalIdOutsidePath),
  };
  for (const target of calendarTargets) {
    ifcGlobalIds[ifcObjectSeed('cal', target.calendar.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
  }
  for (const target of taskTargets) ifcGlobalIds[ifcObjectSeed('task', target.task.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
  for (const target of sequenceTargets) {
    ifcGlobalIds[ifcObjectSeed('seq', target.sequence.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
  }

  const read: IfcxImportResult = {
    project, calendar: projectCalendar, tasks, sequences, resources: [], assignments: [],
    timeModel: MINUTE_MODEL_TIME_MODEL,
    activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [], resourceCalendars,
    baselines: [], activeBaselineId: null, comparedBaselineIds: [null, null],
    recordedFields: recordedFieldsOf(tasks), recordedTimesOrigin: 'ifc-own',
    ifcGlobalIds,
  };
  const [problem] = identityProblems(read, (kind, id) => ifcGlobalIds[ifcObjectSeed(kind, id)]);
  if (problem) throw invalid(problem.detail, { field: problem.field });
  if (!checked) return read;
  const objects = new Map<string, string>([[workplan.path, 'het werkplan'], [schedule.path, 'het werkschema']]);
  for (const target of calendarTargets) objects.set(target.path, `kalender ${target.calendar.id}`);
  for (const target of taskTargets) objects.set(target.path, `taak ${target.task.id} (${target.task.name})`);
  for (const target of sequenceTargets) objects.set(target.path, `relatie ${target.sequence.id}`);
  assertProjection(header.fields, nodes, composeIfcxDocument(read, new Date(0), globalIdsOf(read)), path => objects.get(path) ?? path);
  return stepRoundtrip(read);
}

export function readIfcx(bytes: Uint8Array): IfcxImportResult {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new IfcxReadError('not-ifcx', 'Het bestand is geen UTF-8-tekst');
  }
  return readIfcxText(text);
}

export function classifyIfcx(bytes: Uint8Array): IfcxClassification {
  try {
    readIfcx(bytes);
    return 'own';
  } catch (error) {
    if (!(error instanceof IfcxReadError)) return 'unreadable';
    if (error.code === 'foreign') return 'foreign';
    if (error.code === 'not-ifcx') return 'not-ifcx';
    return 'unreadable';
  }
}
