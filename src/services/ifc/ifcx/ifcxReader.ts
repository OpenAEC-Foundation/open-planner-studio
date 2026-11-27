import type { ImportResult } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
import { ifcObjectSeed } from '../ifcWriter';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { hourRemainingDays } from '@/engine/taskMutationRules';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';
import { reconstructResourceIds } from '@/services/importNormalize';
import { checkValue, hasKey, readFields, VERSION_FORM } from './fieldTable';
import { globalIdOfPath, isIdentityPath } from './identityPath';
import { childrenInPlace } from './childOrder';
import { hourDurationIsDerived, objectLabels, serializeIfcx, type IfcxAttributes, type IfcxDocument } from './projection';
import type { IfcxModelReferences } from './modelReferences';
import type { ElementLink } from '../foreign/elementLinks';
import { ownFileFor, type CanonicalPlanning, type OwnFile } from './ownFile';
import { HEADER_VALUE } from './ownAttributes';
import { NODE_SHAPES, type NodeKind } from './nodes';
import { recordedFieldsOf } from './recordedFields';
import { DOCUMENT_FIELDS, emptyProject, type DocumentReadTarget } from './fields/documentFields';
import { emptyStructure } from './fields/structureFields';
import { CALENDAR_FIELDS, emptyCalendar, type CalendarReadTarget } from './fields/calendarFields';
import { emptyTask, remainingIsDerived, TASK_FIELDS, type TaskReadTarget } from './fields/taskFields';
import { emptySequence, SEQUENCE_FIELDS, type SequenceReadTarget } from './fields/sequenceFields';
import { emptyResource, RESOURCE_FIELDS, type ResourceReadTarget } from './fields/resourceFields';
import { ASSIGNMENT_FIELDS, emptyAssignment, type AssignmentReadTarget } from './fields/assignmentFields';
import { BASELINE_FIELDS, emptyBaseline, type BaselineReadTarget } from './fields/baselineFields';
import {
  attributeValueProblem, hasCanadianGeneration, schemaDefinitionProblems, usesLegacyDocumentSchema, type IfcxCheckProblem,
} from './schemaCheck';
import { legacyDocumentProjection } from './legacyDocument';
import { IfcxReadError, IfcxWriteRefusedError, type IfcxErrorPlace } from './ifcxErrors';
import {
  ATTRIBUTE, IFCX_VERSION, MODEL_PROFILE_VERSION, OPS_NAMESPACE, OWN_HEADER_ID_PREFIX, type IfcxAttributeName,
} from './profile';

export type IfcxImportResult = CanonicalPlanning & IfcxModelReferences;

export type IfcxClassification = 'own' | 'foreign' | 'not-ifcx' | 'unreadable';

interface Attributes extends ReadonlyMap<IfcxAttributeName, unknown> {
  get<K extends IfcxAttributeName>(name: K): IfcxAttributes[K];
}

interface IfcxNode {
  readonly path: string;
  readonly globalId: string;
  readonly attributes: Attributes;
}

const TOP_LEVEL_KEYS = new Set(['header', 'imports', 'schemas', 'data']);
const COMPARED_HEADER_KEYS = ['id', 'ifcxVersion', 'dataVersion', 'author'] as const;
const HEADER_KEYS = new Set<string>([...COMPARED_HEADER_KEYS, 'timestamp']);
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

function parseDocument(text: string): { document: Record<string, unknown>; profileVersion?: string } {
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
  const profileVersion = typeof document.header.id === 'string' && document.header.id.startsWith(OWN_HEADER_ID_PREFIX)
    ? ownProfileVersion(document.data) : undefined;
  for (const key of Object.keys(document)) if (!TOP_LEVEL_KEYS.has(key)) throw foreign(`Onbekend veld ${key} bovenin het bestand`);
  for (const key of Object.keys(document.header)) if (!HEADER_KEYS.has(key)) throw foreign(`Onbekend kopveld ${key}`);
  return { document, profileVersion };
}

function headerOf(document: Record<string, unknown>): { projectPath: string; projectGlobalId: string } {
  const header = document.header as Record<string, unknown>;
  if (typeof header.id !== 'string' || !header.id.startsWith(OWN_HEADER_ID_PREFIX)) {
    throw foreign(`Het bestand is niet door Open Planner Studio begonnen (${JSON.stringify(header.id)})`);
  }
  const problem = checkValue(HEADER_VALUE, header);
  if (problem) throw invalid(`Ongeldige kop: ${problem.kind === 'invalid' ? problem.detail : 'onbekend veld'}`, { field: `header.${problem.field}` });
  const projectPath = header.id.slice(OWN_HEADER_ID_PREFIX.length);
  if (!Array.isArray(document.imports)) throw invalid('Het bestand heeft geen lijst imports', { field: 'imports' });
  if (document.imports.length > 0) throw foreign('Het bestand importeert andere bestanden', { field: 'imports' });
  if (!isPlainObject(document.schemas)) throw invalid('Het bestand heeft geen schemas', { field: 'schemas' });
  return { projectPath, projectGlobalId: globalIdOfPath(projectPath)! };
}

function thrown(problem: IfcxCheckProblem): IfcxReadError {
  return new IfcxReadError(problem.code, problem.detail, problem.place);
}

function nodesOf(data: readonly unknown[]): IfcxNode[] {
  const nodes = new Map<string, { globalId: string; attributes: Map<IfcxAttributeName, unknown> }>();
  for (const entry of data) {
    if (!isPlainObject(entry) || typeof entry.path !== 'string') throw invalid('Een entry heeft geen pad');
    const path = entry.path;
    for (const key of Object.keys(entry)) if (!ENTRY_KEYS.has(key)) throw foreign(`Onbekend entryveld ${key}`, { path });
    if ('children' in entry) throw foreign('Het bestand gebruikt children', { path });
    if ('inherits' in entry) throw foreign('Het bestand gebruikt inherits', { path });
    if (!isPlainObject(entry.attributes)) throw foreign('Een entry zonder attributen', { path });
    const node = nodes.get(path) ?? { globalId: globalIdOfPath(path), attributes: new Map() };
    if (node.globalId === undefined) throw foreign('Een pad dat geen identiteitspad van Open Planner Studio is', { path });
    for (const [name, value] of Object.entries(entry.attributes)) {
      if (node.attributes.has(name as IfcxAttributeName)) throw foreign('Twee bijdragen van hetzelfde attribuut op één pad', { path, attribute: name });
      node.attributes.set(name as IfcxAttributeName, value);
    }
    nodes.set(path, { globalId: node.globalId, attributes: node.attributes });
  }
  return [...nodes].map(([path, node]) => ({ path, globalId: node.globalId, attributes: node.attributes as Attributes }));
}

function ownProfileVersion(data: readonly unknown[]): string | undefined {
  let workplan: { path: string; version: string } | undefined;
  for (const entry of data) {
    if (!isPlainObject(entry) || !isPlainObject(entry.attributes) || !hasKey(entry.attributes, ATTRIBUTE.document)) continue;
    if (workplan || !isPlainObject(entry.attributes[ATTRIBUTE.workplan]) || typeof entry.path !== 'string' || !isIdentityPath(entry.path)) return;
    const document = entry.attributes[ATTRIBUTE.document];
    const version = isPlainObject(document) ? document.formatVersion : undefined;
    if (typeof version !== 'string' || !VERSION_FORM.pattern.test(version)) return;
    workplan = { path: entry.path, version };
  }
  if (!workplan) return;
  const [knownMajor, knownMinor] = MODEL_PROFILE_VERSION.split('.').map(Number);
  const [major, minor] = workplan.version.split('.').map(Number);
  if (major > knownMajor || (major === knownMajor && minor > knownMinor)) {
    throw new IfcxReadError('newer-profile', `Profielversie ${workplan.version} is nieuwer dan deze app kent`,
      { path: workplan.path, attribute: ATTRIBUTE.document, field: 'formatVersion' });
  }
  return workplan.version;
}

function assertValues(nodes: readonly IfcxNode[], legacyDocument: boolean): void {
  for (const node of nodes) {
    for (const [name, value] of node.attributes) {
      const problem = attributeValueProblem(node.path, name, value, legacyDocument);
      if (problem) throw thrown(problem);
    }
  }
}

function assertSchemas(schemas: unknown, nodes: readonly IfcxNode[], legacyDocument: boolean): void {
  const used = new Set<string>(nodes.flatMap(node => [...node.attributes.keys()]));
  const canadianGeneration = nodes.some(node => hasCanadianGeneration(node.attributes.get(ATTRIBUTE.opsCalendar)));
  const [problem] = schemaDefinitionProblems(schemas, used, canadianGeneration, legacyDocument);
  if (problem) throw thrown(problem);
}

function kindOf(node: IfcxNode): NodeKind {
  for (const shape of NODE_SHAPES) {
    if (shape.attributes.size === node.attributes.size && [...node.attributes.keys()].every(name => shape.attributes.has(name))) return shape.kind;
  }
  throw foreign(`Een pad met attributen die samen geen planningsobject vormen: ${[...node.attributes.keys()].join(', ')}`, { path: node.path });
}

const shown = (value: unknown) => (value === undefined ? 'afwezig' : JSON.stringify(value));

interface FieldDifference {
  readonly field: string;
  readonly inFile: unknown;
  readonly wanted: unknown;
}

type Kind = 'extra' | 'changed' | 'missing';

const differenceKind = (inFile: unknown, wanted: unknown): Kind => (wanted === undefined ? 'extra' : inFile === undefined ? 'missing' : 'changed');

function fieldDifference(inFile: unknown, wanted: unknown, field: string, kind: Kind): FieldDifference | undefined {
  const at = (key: string) => (field ? `${field}.${key}` : key);
  if (isPlainObject(inFile) && isPlainObject(wanted)) {
    for (const key of new Set([...Object.keys(wanted), ...Object.keys(inFile)])) {
      const difference = fieldDifference(inFile[key], wanted[key], at(key), kind);
      if (difference) return difference;
    }
    return undefined;
  }
  if (Array.isArray(inFile) && Array.isArray(wanted)) {
    for (let i = 0; i < Math.max(inFile.length, wanted.length); i++) {
      const difference = fieldDifference(inFile[i], wanted[i], `${field}[${i}]`, kind);
      if (difference) return difference;
    }
    return undefined;
  }
  return inFile === wanted || differenceKind(inFile, wanted) !== kind ? undefined : { field, inFile, wanted };
}

type Entry = { readonly path: string; readonly attributes: Readonly<Record<string, unknown>> };

function sameValue(inFile: unknown, wanted: unknown): boolean {
  if (Array.isArray(wanted)) {
    if (!Array.isArray(inFile) || inFile.length !== wanted.length) return false;
    for (let i = 0; i < wanted.length; i++) if (!sameValue(inFile[i], wanted[i])) return false;
    return true;
  }
  if (isPlainObject(wanted)) {
    if (!isPlainObject(inFile)) return false;
    const keys = Object.keys(wanted);
    if (keys.length !== Object.keys(inFile).length) return false;
    for (const key of keys) if (!hasKey(inFile, key) || !sameValue(inFile[key], wanted[key])) return false;
    return true;
  }
  return inFile === wanted;
}

function sameFile(document: Record<string, unknown>, own: IfcxDocument): boolean {
  const header = document.header as Record<string, unknown>;
  return COMPARED_HEADER_KEYS.every(key => header[key] === own.header[key])
    && sameValue(document.schemas, own.schemas) && sameValue(document.data, own.data);
}

const preciseFirst = (names: readonly string[]) => [...names.filter(name => name.startsWith(OPS_NAMESPACE)), ...names.filter(name => !name.startsWith(OPS_NAMESPACE))];

interface Located {
  readonly place: IfcxErrorPlace;
  readonly detail: (objectAt: (path: string) => string) => string;
}

function firstDifference(document: Record<string, unknown>, own: IfcxDocument, kind: Kind): Located | undefined {
  const differs = (inFile: unknown, wanted: unknown) => inFile !== wanted && differenceKind(inFile, wanted) === kind;
  const header = document.header as Record<string, unknown>;
  for (const key of COMPARED_HEADER_KEYS) {
    if (!differs(header[key], own.header[key])) continue;
    return { place: { field: `header.${key}` }, detail: () => `Het project: de kop heeft ${key} ${shown(header[key])}, de eigen schrijver schrijft ${shown(own.header[key])}` };
  }
  const schemas = fieldDifference(document.schemas, own.schemas, '', kind);
  if (schemas) {
    return { place: { field: `schemas.${schemas.field}` }, detail: () => `De schema's: ${schemas.field} is ${shown(schemas.inFile)}, de eigen schrijver schrijft ${shown(schemas.wanted)}` };
  }
  const data = document.data as Entry[];
  for (let index = 0; index < Math.max(data.length, own.data.length); index++) {
    const inFile = data[index], wanted = own.data[index] as Entry | undefined;
    if (wanted === undefined) {
      if (kind !== 'extra') continue;
      return { place: { path: inFile.path }, detail: objectAt => `${objectAt(inFile.path)} schrijft de eigen schrijver niet` };
    }
    if (inFile === undefined) {
      if (kind !== 'missing') continue;
      return { place: { path: wanted.path }, detail: objectAt => `Het bestand mist ${objectAt(wanted.path)}` };
    }
    if (inFile.path !== wanted.path) {
      if (kind !== 'changed') continue;
      return { place: { path: inFile.path, field: 'path' }, detail: objectAt => `${objectAt(inFile.path)} staat op plaats ${index}, waar de eigen schrijver ${objectAt(wanted.path)} schrijft` };
    }
    for (const name of preciseFirst([...new Set([...Object.keys(wanted.attributes), ...Object.keys(inFile.attributes)])])) {
      const difference = fieldDifference(inFile.attributes[name], wanted.attributes[name], '', kind);
      if (!difference) continue;
      return {
        place: { path: inFile.path, attribute: name, ...(difference.field ? { field: difference.field } : {}) },
        detail: objectAt => `${objectAt(inFile.path)}: ${difference.field || name} is ${shown(difference.inFile)}, de eigen schrijver schrijft ${shown(difference.wanted)}`,
      };
    }
  }
  return undefined;
}

function writerRefusal<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (!(error instanceof IfcxWriteRefusedError)) throw error;
    throw invalid(`De eigen schrijver schrijft deze planning niet: ${error.message}`, error.place.path || error.place.field ? error.place : { field: error.fields[0] });
  }
}

function firstTextDifference(text: string, own: string): Located {
  let offset = 0;
  while (offset < text.length && text[offset] === own[offset]) offset++;
  const line = text.slice(text.lastIndexOf('\n', offset - 1) + 1, text.indexOf('\n', offset) === -1 ? text.length : text.indexOf('\n', offset));
  let path: string | undefined;
  try {
    const entry: unknown = JSON.parse(line.trim().replace(/,$/, ''));
    if (isPlainObject(entry) && typeof entry.path === 'string') path = entry.path;
  } catch { path = undefined; }
  return {
    place: { ...(path !== undefined ? { path } : {}), offset },
    detail: objectAt => `${path === undefined ? 'Het bestand' : objectAt(path)} is anders geschreven dan de eigen schrijver het schrijft, vanaf teken ${offset}`,
  };
}

function differenceFrom(text: string, document: Record<string, unknown>, own: OwnFile): Located | undefined {
  const ownText = serializeIfcx({ ...own.document, header: { ...own.document.header, timestamp: (document.header as Record<string, unknown>).timestamp as string } });
  if (sameFile(document, own.document) && ownText === text) return undefined;
  writerRefusal(own.assertAttributeValues);
  return firstDifference(document, own.document, 'extra') ?? firstDifference(document, own.document, 'changed')
    ?? firstDifference(document, own.document, 'missing') ?? (ownText === text ? undefined : firstTextDifference(text, ownText));
}

function assertOwnProjection(text: string, document: Record<string, unknown>, read: IfcxImportResult, legacyDocument: boolean, question: unknown): void {
  const own = writerRefusal(() => ownFileFor(read, new Date(0), 'deferred'));
  const expected = legacyDocument ? { ...own, document: legacyDocumentProjection(own.document, question) } : own;
  const difference = differenceFrom(text, document, expected);
  if (!difference) return;
  const labels = objectLabels(read, (kind, id) => read.ifcGlobalIds![ifcObjectSeed(kind, id)]);
  throw invalid(difference.detail(path => labels.get(path) ?? path), difference.place);
}

export function readIfcxText(text: string, checked = true): IfcxImportResult {
  const { document, profileVersion } = parseDocument(text);
  const header = headerOf(document);
  const nodes = nodesOf(document.data as unknown[]);
  const legacyDocument = profileVersion !== MODEL_PROFILE_VERSION && usesLegacyDocumentSchema(document.schemas);
  if (checked) assertValues(nodes, legacyDocument);
  assertSchemas(document.schemas, nodes, legacyDocument);
  const byKind = new Map<NodeKind, IfcxNode[]>();
  const kindAt = new Map<string, NodeKind>();
  for (const node of nodes) {
    const kind = kindOf(node);
    if (profileVersion !== MODEL_PROFILE_VERSION && (node.attributes.has(ATTRIBUTE.modelSource) || node.attributes.has(ATTRIBUTE.links))) {
      throw invalid('De bronverwijzing en bouwdeelkoppelingen vereisen profiel 1.2.0', { path: node.path, attribute: ATTRIBUTE.document, field: 'formatVersion' });
    }
    kindAt.set(node.path, kind);
    const list = byKind.get(kind);
    if (list) list.push(node); else byKind.set(kind, [node]);
  }
  const of = (kind: NodeKind) => byKind.get(kind) ?? [];
  const single = (kind: NodeKind) => (of(kind).length > 1 ? { path: of(kind)[1].path } : { field: 'data' });
  if (of('workplan').length !== 1) throw foreign(`Het bestand heeft ${of('workplan').length} werkplannen van Open Planner Studio`, single('workplan'));
  if (of('schedule').length !== 1) throw invalid(`Het bestand heeft ${of('schedule').length} werkschema's`, single('schedule'));
  const reference = (path: string | undefined, kind: NodeKind, place: IfcxErrorPlace): string | undefined => {
    if (path === undefined) return undefined;
    if (kindAt.get(path) !== kind) throw invalid(`Verwijzing naar ${path} is geen ${kind}`, place);
    return path;
  };

  const workplan = of('workplan')[0];
  const schedule = of('schedule')[0];
  const project = emptyProject();
  const documentTarget: DocumentReadTarget = {
    project, projectPath: header.projectPath, calendarPath: '', minuteModelPending: false, importPristine: false, literalCalendarPaths: [],
    structure: emptyStructure(),
    comparedBaselinePaths: [undefined, undefined], removedTasks: {},
  };
  const documentFields = workplan.attributes.get(ATTRIBUTE.document)!;
  const modelSource = workplan.attributes.get(ATTRIBUTE.modelSource);
  readFields(DOCUMENT_FIELDS, documentFields, documentTarget);
  const documentPlace = { path: workplan.path, attribute: ATTRIBUTE.document };

  const projectCalendarPath = reference(documentTarget.calendarPath, 'calendar', { ...documentPlace, field: 'calendar' })!;
  const calendarTargets: CalendarReadTarget[] = of('calendar').map(node => {
    const target: CalendarReadTarget = { calendar: emptyCalendar(), isProjectCalendar: node.path === projectCalendarPath, path: node.path };
    readFields(CALENDAR_FIELDS, node.attributes.get(ATTRIBUTE.opsCalendar)!, target);
    return target;
  });
  const calendarIdAt = new Map(calendarTargets.map(target => [target.path, target.calendar.id]));
  const projectCalendar = calendarTargets.find(target => target.isProjectCalendar)!.calendar;
  project.calendarId = projectCalendar.id;
  const resourceCalendars: WorkCalendar[] = calendarTargets.filter(target => !target.isProjectCalendar).map(target => target.calendar);
  const ifcLiteralCalendarIds = documentTarget.literalCalendarPaths.map((path, index) => calendarIdAt.get(
    reference(path, 'calendar', { ...documentPlace, field: `literalCalendars[${index}]` })!)!);

  const elementLinks = new Map<string, ElementLink[]>();
  const taskTargets: TaskReadTarget[] = of('task').map(node => {
    const target: TaskReadTarget = { task: emptyTask(), path: node.path, unrecorded: [] };
    readFields(TASK_FIELDS, node.attributes.get(ATTRIBUTE.opsTask)!, target);
    const links = node.attributes.get(ATTRIBUTE.links);
    if (links?.length) elementLinks.set(target.task.id, links.map(({ target }) => ({ direction: 'output', found: false, target })));
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
    const { task } = target;
    task.childIds = childrenInPlace(childrenOf.get(target.path) ?? [], child => child.place).map(child => child.task.id);
    const calendar = resolveCalendar(task.calendarId, resourceCalendars, projectCalendar);
    if (hourDurationIsDerived(task, calendar)) task.time.scheduleDuration = hourTaskScheduleDuration(task.time.durationMinutes!, calendar);
    if (remainingIsDerived(task.time)) task.time.remainingTime = hourRemainingDays(task.time, task.time.remainingMinutes!);
  }

  const sequenceTargets: SequenceReadTarget[] = of('sequence').map(node => {
    const target: SequenceReadTarget = { sequence: emptySequence(), path: node.path, predecessorPath: '', successorPath: '' };
    readFields(SEQUENCE_FIELDS, node.attributes.get(ATTRIBUTE.opsSequence)!, target);
    const place = { path: node.path, attribute: ATTRIBUTE.opsSequence };
    target.sequence.predecessorId = taskIdAt.get(reference(target.predecessorPath, 'task', { ...place, field: 'predecessor' })!)!;
    target.sequence.successorId = taskIdAt.get(reference(target.successorPath, 'task', { ...place, field: 'successor' })!)!;
    return target;
  });

  const resourceTargets: ResourceReadTarget[] = of('resource').map(node => {
    const target: ResourceReadTarget = { resource: emptyResource(), path: node.path };
    readFields(RESOURCE_FIELDS, node.attributes.get(ATTRIBUTE.opsResource)!, target);
    return target;
  });
  const resourceIdAt = new Map(resourceTargets.map(target => [target.path, target.resource.id]));
  for (const target of resourceTargets) {
    const place = { path: target.path, attribute: ATTRIBUTE.opsResource };
    const parentPath = reference(target.parentPath, 'resource', { ...place, field: 'parent' });
    if (parentPath !== undefined) target.resource.parentId = resourceIdAt.get(parentPath)!;
    const calendarPath = reference(target.calendarPath, 'calendar', { ...place, field: 'calendar' });
    if (calendarPath !== undefined) target.resource.calendarId = calendarIdAt.get(calendarPath)!;
  }

  const assignmentTargets: AssignmentReadTarget[] = of('assignment').map(node => {
    const target: AssignmentReadTarget = { assignment: emptyAssignment(), path: node.path, taskPath: '', resourcePath: '' };
    readFields(ASSIGNMENT_FIELDS, node.attributes.get(ATTRIBUTE.opsAssignment)!, target);
    const place = { path: node.path, attribute: ATTRIBUTE.opsAssignment };
    target.assignment.taskId = taskIdAt.get(reference(target.taskPath, 'task', { ...place, field: 'task' })!)!;
    target.assignment.resourceId = resourceIdAt.get(reference(target.resourcePath, 'resource', { ...place, field: 'resource' })!)!;
    return target;
  });

  const baselineTargets: BaselineReadTarget[] = of('baseline').map(node => {
    const target: BaselineReadTarget = { baseline: emptyBaseline(), path: node.path, rowTaskPaths: [] };
    readFields(BASELINE_FIELDS, node.attributes.get(ATTRIBUTE.opsBaseline)!, target);
    target.rowTaskPaths.forEach((path, index) => {
      const taskPath = reference(path, 'task', { path: node.path, attribute: ATTRIBUTE.opsBaseline, field: `tasks[${index}].task` });
      if (taskPath !== undefined) target.baseline.tasks[index].taskId = taskIdAt.get(taskPath)!;
    });
    return target;
  });
  const baselineIdAt = new Map(baselineTargets.map(target => [target.path, target.baseline.id]));
  const baselineIdOf = (path: string | undefined, field: string): string | null => {
    const at = reference(path, 'baseline', { ...documentPlace, field });
    return at === undefined ? null : baselineIdAt.get(at)!;
  };
  const activeBaselineId = baselineIdOf(documentTarget.activeBaselinePath, 'activeBaseline');
  const [comparedFirst, comparedSecond] = documentTarget.comparedBaselinePaths;
  const comparedBaselineIds: [string | null, string | null] = [
    baselineIdOf(comparedFirst, 'comparedBaselines.1'), baselineIdOf(comparedSecond, 'comparedBaselines.2'),
  ];

  const tasks = taskTargets.map(target => target.task);
  const sequences: Sequence[] = sequenceTargets.map(target => target.sequence);
  const resources = resourceTargets.map(target => target.resource);
  const assignments = assignmentTargets.map(target => target.assignment);
  reconstructResourceIds(tasks, assignments);
  const ifcGlobalIds: Record<string, string> = {
    [ifcObjectSeed('proj', project.id)]: header.projectGlobalId,
    [ifcObjectSeed('wp', project.id)]: workplan.globalId,
    [ifcObjectSeed('ws', project.id)]: schedule.globalId,
  };
  const globalIdAt = new Map(nodes.map(node => [node.path, node.globalId]));
  for (const target of calendarTargets) ifcGlobalIds[ifcObjectSeed('cal', target.calendar.id)] = globalIdAt.get(target.path)!;
  for (const target of taskTargets) ifcGlobalIds[ifcObjectSeed('task', target.task.id)] = globalIdAt.get(target.path)!;
  for (const target of sequenceTargets) ifcGlobalIds[ifcObjectSeed('seq', target.sequence.id)] = globalIdAt.get(target.path)!;
  for (const target of resourceTargets) ifcGlobalIds[ifcObjectSeed('res', target.resource.id)] = globalIdAt.get(target.path)!;
  for (const target of assignmentTargets) ifcGlobalIds[ifcObjectSeed('asgn', target.assignment.id)] = globalIdAt.get(target.path)!;
  for (const target of baselineTargets) ifcGlobalIds[ifcObjectSeed('bl', target.baseline.id)] = globalIdAt.get(target.path)!;

  const recordedFields: ImportResult['recordedFields'] = {};
  for (const target of taskTargets) recordedFields[target.task.id] = recordedFieldsOf(target.task, target.unrecorded);

  const read: IfcxImportResult = {
    project, calendar: projectCalendar, tasks, sequences, resources, assignments,
    ...(modelSource !== undefined ? { modelSource } : {}),
    ...(elementLinks.size ? { elementLinks } : {}),
    ...(documentTarget.timeModel !== undefined ? { timeModel: documentTarget.timeModel } : {}),
    ...(documentTarget.minuteModelPending ? { minuteModelPending: true } : {}),
    ...documentTarget.structure, resourceCalendars,
    baselines: baselineTargets.map(target => target.baseline), activeBaselineId, comparedBaselineIds,
    recordedFields, recordedTimesOrigin: 'ifc-own', importPristine: documentTarget.importPristine,
    ...(documentTarget.recordedSourceFormat !== undefined ? { recordedSourceFormat: documentTarget.recordedSourceFormat } : {}),
    ifcGlobalIds,
    ...(Object.keys(documentTarget.removedTasks).length > 0 ? { baselineOrphanGuids: documentTarget.removedTasks } : {}),
    ...(ifcLiteralCalendarIds.length > 0 ? { ifcLiteralCalendarIds } : {}),
  };
  if (checked) assertOwnProjection(text, document, read, legacyDocument, documentFields.ifcSchemaUnconfirmed);
  return read;
}

export function readIfcx(bytes: Uint8Array): IfcxImportResult {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw invalid('Het bestand begint met een UTF-8-BOM, die de eigen schrijver niet schrijft', { offset: 0 });
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new IfcxReadError('not-ifcx', 'Het bestand is geen UTF-8-tekst');
  }
  return readIfcxText(text);
}

export function classifyIfcx(bytes: Uint8Array): IfcxClassification {
  return classifyIfcxRead(() => readIfcx(bytes));
}

export function classifyIfcxRead(read: () => IfcxImportResult): IfcxClassification {
  try {
    read();
    return 'own';
  } catch (error) {
    if (!(error instanceof IfcxReadError)) return 'unreadable';
    if (error.code === 'foreign') return 'foreign';
    if (error.code === 'not-ifcx') return 'not-ifcx';
    return 'unreadable';
  }
}
