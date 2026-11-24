import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
import { ALL_RECORDED_SLOT_KEYS, type RecordedFieldKey } from '../ifcTaskSlots';
import { ifcGuid128, ifcObjectSeed } from '../ifcWriter';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { checkValue, readFields } from './fieldTable';
import { globalIdOfIdentity, isUuidPath } from './globalIdUuid';
import { childrenInPlace } from './childOrder';
import { momentOfSharedDate, projectSpan } from './dateProjection';
import { CALENDAR_GROUPS, DOCUMENT_GROUPS, opsFields, planningFields, SEQUENCE_GROUPS, TASK_GROUPS } from './fieldGroups';
import { SCHEDULE_FIELDS, emptyProject, type DocumentReadTarget } from './fields/documentFields';
import { emptyCalendar, type CalendarReadTarget } from './fields/calendarFields';
import { emptyTask, type TaskReadTarget } from './fields/taskFields';
import { emptySequence, type SequenceReadTarget } from './fields/sequenceFields';
import { isOwnAttributeName, OWN_ATTRIBUTE_VALUES } from './ownAttributes';
import { IfcxReadError, type IfcxErrorPlace } from './ifcxErrors';
import {
  ATTRIBUTE, IFCX_VERSION, OPS_NAMESPACE, OPS_PROFILE_MAJOR, OWN_HEADER_ID_PREFIX, type IfcxAttributeName,
} from './profile';

export type IfcxImportResult = ImportResult & { readonly ifcxSharedDatesApplied?: number };

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
  { kind: 'sequence', required: [ATTRIBUTE.sequence], optional: [ATTRIBUTE.opsSequence] },
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

function headerOf(document: Record<string, unknown>): { uuid: string; author: string } {
  const header = document.header as Record<string, unknown>;
  if (typeof header.id !== 'string' || !header.id.startsWith(OWN_HEADER_ID_PREFIX)) {
    throw foreign(`Het bestand is niet door Open Planner Studio begonnen (${JSON.stringify(header.id)})`);
  }
  const uuid = header.id.slice(OWN_HEADER_ID_PREFIX.length);
  if (!isUuidPath(uuid)) throw invalid(`De kop draagt geen project-UUID: ${header.id}`, { field: 'header.id' });
  if (typeof header.author !== 'string') throw invalid('De kop heeft geen auteur', { field: 'header.author' });
  if (document.imports !== undefined) {
    if (!Array.isArray(document.imports)) throw invalid('imports is geen lijst', { field: 'imports' });
    if (document.imports.length > 0) throw foreign('Het bestand importeert andere bestanden');
  }
  if (document.schemas !== undefined && !isPlainObject(document.schemas)) throw invalid('schemas is geen object', { field: 'schemas' });
  return { uuid, author: header.author };
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
      if (!isOwnAttributeName(name)) {
        throw name.startsWith(OPS_NAMESPACE)
          ? new IfcxReadError('newer-profile', 'Een attribuut van een nieuwere Open Planner Studio', { path, attribute: name })
          : foreign('Een attribuut dat Open Planner Studio niet schrijft', { path, attribute: name });
      }
      if (attributes.has(name)) throw foreign('Twee bijdragen van hetzelfde attribuut op één pad', { path, attribute: name });
      attributes.set(name, value as Record<string, unknown>);
    }
    nodes.set(path, attributes);
  }
  return [...nodes].map(([path, attributes]) => ({ path, attributes }));
}

function assertProfileVersion(nodes: readonly IfcxNode[]): void {
  for (const node of nodes) {
    const document = node.attributes.get(ATTRIBUTE.document);
    const version = isPlainObject(document) ? document.formatVersion : undefined;
    const major = typeof version === 'string' ? /^(\d+)\./.exec(version)?.[1] : undefined;
    if (major !== undefined && Number(major) > OPS_PROFILE_MAJOR) {
      throw new IfcxReadError('newer-profile', `Profielversie ${version} is nieuwer dan deze app kent`, { path: node.path, attribute: ATTRIBUTE.document });
    }
  }
}

function assertValues(nodes: readonly IfcxNode[]): void {
  for (const node of nodes) {
    for (const [name, value] of node.attributes) {
      const problem = checkValue(OWN_ATTRIBUTE_VALUES.get(name)!, value, '');
      if (!problem) continue;
      const place = { path: node.path, attribute: name, field: problem.field };
      if (problem.kind === 'invalid') throw invalid(`Ongeldige waarde: ${problem.detail}`, place);
      throw name.startsWith(OPS_NAMESPACE)
        ? new IfcxReadError('newer-profile', 'Een veld van een nieuwere Open Planner Studio', place)
        : foreign('Een veld dat Open Planner Studio niet schrijft', place);
    }
  }
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

function applySharedSpan(task: Task, span: TaskReadTarget['span']): boolean {
  let changed = false;
  if (span.start !== undefined && projectSpan(shownStart(task), shownFinish(task)).start !== span.start) {
    const moment = momentOfSharedDate(span.start);
    task.time.scheduleStart = task.time.earlyStart = task.time.lateStart = moment;
    changed = true;
  }
  if (span.endExclusive !== undefined && projectSpan(shownStart(task), shownFinish(task)).endExclusive !== span.endExclusive) {
    const moment = task.isMilestone ? task.time.scheduleStart : momentOfSharedDate(span.endExclusive);
    task.time.scheduleFinish = task.time.earlyFinish = task.time.lateFinish = moment;
    changed = true;
  }
  if (changed) task.manuallyScheduled = true;
  return changed;
}

export function readIfcxText(text: string): IfcxImportResult {
  const document = parseDocument(text);
  const header = headerOf(document);
  const nodes = nodesOf(document.data as unknown[]);
  assertProfileVersion(nodes);
  assertValues(nodes);
  const byKind = new Map<NodeKind, IfcxNode[]>();
  const kindAt = new Map<string, NodeKind>();
  for (const node of nodes) {
    const kind = kindOf(node);
    kindAt.set(node.path, kind);
    byKind.set(kind, [...(byKind.get(kind) ?? []), node]);
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
  const documentTarget: DocumentReadTarget = { project, headerUuid: header.uuid, headerAuthor: header.author, formatVersion: '' };
  readFields(planningFields(DOCUMENT_GROUPS), workplan.attributes.get(ATTRIBUTE.workplan)!, documentTarget);
  readFields(opsFields(DOCUMENT_GROUPS), workplan.attributes.get(ATTRIBUTE.document)!, documentTarget);
  const schedule = of('schedule')[0];
  const scheduleTarget: { workplanPath?: string } = {};
  readFields(SCHEDULE_FIELDS, schedule.attributes.get(ATTRIBUTE.schedule)!, scheduleTarget);
  if (scheduleTarget.workplanPath !== workplan.path) {
    throw invalid('Het werkschema hoort niet bij het werkplan', { path: schedule.path, attribute: ATTRIBUTE.schedule, field: 'workplan' });
  }

  const calendarNodes = of('calendar');
  const projectCalendarPath = reference(documentTarget.calendarPath, 'calendar', { path: workplan.path, attribute: ATTRIBUTE.workplan, field: 'calendar' })
    ?? calendarNodes[0]?.path;
  if (projectCalendarPath === undefined) throw invalid('Het bestand heeft geen kalender');
  const calendarTargets: CalendarReadTarget[] = calendarNodes.map(node => {
    const target: CalendarReadTarget = { calendar: emptyCalendar(), isProjectCalendar: node.path === projectCalendarPath, path: node.path };
    readFields(planningFields(CALENDAR_GROUPS), node.attributes.get(ATTRIBUTE.calendar)!, target);
    readFields(opsFields(CALENDAR_GROUPS), node.attributes.get(ATTRIBUTE.opsCalendar)!, target);
    return target;
  });
  const calendarIdAt = new Map(calendarTargets.map(target => [target.path, target.calendar.id]));
  const projectCalendar = calendarTargets.find(target => target.isProjectCalendar)!.calendar;
  project.calendarId = documentTarget.calendarIdOverride ?? projectCalendar.id;

  const taskTargets: TaskReadTarget[] = of('task').map(node => {
    const target: TaskReadTarget = { task: emptyTask(), path: node.path, span: {} };
    readFields(planningFields(TASK_GROUPS), node.attributes.get(ATTRIBUTE.activity)!, target);
    readFields(opsFields(TASK_GROUPS), node.attributes.get(ATTRIBUTE.opsTask)!, target);
    return target;
  });
  const taskIdAt = new Map(taskTargets.map(target => [target.path, target.task.id]));
  const childrenOf = new Map<string, TaskReadTarget[]>();
  for (const target of taskTargets) {
    const place = { path: target.path, attribute: ATTRIBUTE.activity };
    const parentPath = reference(target.parentPath, 'task', { ...place, field: 'parent' });
    target.task.parentId = parentPath === undefined ? null : taskIdAt.get(parentPath)!;
    if (parentPath !== undefined) childrenOf.set(parentPath, [...(childrenOf.get(parentPath) ?? []), target]);
    const calendarPath = reference(target.calendarPath, 'calendar', { ...place, field: 'calendar' });
    if (calendarPath !== undefined) target.task.calendarId = calendarIdAt.get(calendarPath)!;
  }
  for (const target of taskTargets) {
    target.task.childIds = childrenInPlace(childrenOf.get(target.path) ?? [], child => child.place).map(child => child.task.id);
  }
  let sharedDatesApplied = 0;
  for (const target of taskTargets) if (applySharedSpan(target.task, target.span)) sharedDatesApplied++;

  const sequenceTargets: SequenceReadTarget[] = of('sequence').map(node => {
    const target: SequenceReadTarget = { sequence: emptySequence(), path: node.path, predecessorPath: '', successorPath: '', shared: {} };
    readFields(planningFields(SEQUENCE_GROUPS), node.attributes.get(ATTRIBUTE.sequence)!, target);
    readFields(opsFields(SEQUENCE_GROUPS), node.attributes.get(ATTRIBUTE.opsSequence) ?? {}, target);
    const place = { path: node.path, attribute: ATTRIBUTE.sequence };
    target.sequence.predecessorId = taskIdAt.get(reference(target.predecessorPath, 'task', { ...place, field: 'relatingProcess' })!)!;
    target.sequence.successorId = taskIdAt.get(reference(target.successorPath, 'task', { ...place, field: 'relatedProcess' })!)!;
    return target;
  });

  const tasks = taskTargets.map(target => target.task);
  const sequences: Sequence[] = sequenceTargets.map(target => target.sequence);
  const resourceCalendars: WorkCalendar[] = calendarTargets.filter(target => !target.isProjectCalendar).map(target => target.calendar);
  const ifcGlobalIds: Record<string, string> = {
    [ifcObjectSeed('proj', project.id)]: globalIdOfIdentity(header.uuid, documentTarget.projectGlobalIdOutsidePath),
  };
  for (const target of calendarTargets) {
    ifcGlobalIds[ifcObjectSeed('cal', target.calendar.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
  }
  for (const target of taskTargets) ifcGlobalIds[ifcObjectSeed('task', target.task.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
  for (const target of sequenceTargets) {
    ifcGlobalIds[ifcObjectSeed('seq', target.sequence.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
  }
  for (const [kind, node] of [['wp', workplan], ['ws', schedule]] as const) {
    const seed = ifcObjectSeed(kind, project.id);
    const globalId = globalIdOfIdentity(node.path, undefined);
    if (globalId !== ifcGuid128(seed)) ifcGlobalIds[seed] = globalId;
  }

  return {
    project, calendar: projectCalendar, tasks, sequences, resources: [], assignments: [],
    timeModel: MINUTE_MODEL_TIME_MODEL,
    activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [], resourceCalendars,
    baselines: [], activeBaselineId: null, comparedBaselineIds: [null, null],
    recordedFields: recordedFieldsOf(tasks), recordedTimesOrigin: 'ifc-own',
    ifcGlobalIds,
    ...(sharedDatesApplied > 0 ? { ifcxSharedDatesApplied: sharedDatesApplied } : {}),
  };
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
