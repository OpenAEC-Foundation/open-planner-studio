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
import { unrecordedOf } from './recordedFields';
import { SEQUENCE_FIELDS, SEQUENCE_SHARED_FIELDS, sharedLagOf } from './fields/sequenceFields';
import { RESOURCE_FIELDS, RESOURCE_SHARED_FIELDS } from './fields/resourceFields';
import { ASSIGNMENT_FIELDS, ASSIGNMENT_SHARED_FIELDS } from './fields/assignmentFields';
import { BASELINE_FIELDS, BASELINE_SHARED_FIELDS } from './fields/baselineFields';
import { ownSchemas } from './nodes';
import { taskWindow } from './dateProjection';
import {
  ATTRIBUTE, CANADIAN_CALENDAR_PROFILE_VERSION, DEFAULT_HEADER_AUTHOR, IFCX_DATA_VERSION, IFCX_VERSION,
  OPS_PROFILE_VERSION, OWN_HEADER_ID_PREFIX, type IfcxAttributeName,
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

function pathsById<T extends { readonly id: string }>(items: readonly T[], pathOf: (item: T) => string): Map<string, string> {
  const out = new Map<string, string>();
  for (const item of items) if (!out.has(item.id)) out.set(item.id, pathOf(item));
  return out;
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
  const canadianGeneration = calendars.some(({ calendar }) => calendar.generation?.ruleSetId === 'CA');
  const calendarPathById = new Map<string, string>();
  for (const node of calendars) if (!calendarPathById.has(node.calendar.id)) calendarPathById.set(node.calendar.id, node.path);

  const taskPaths = input.tasks.map(task => pathOfGlobalId(globalIdOf('task', task.id)));
  const taskPathById = new Map<string, string>();
  input.tasks.forEach((task, index) => { if (!taskPathById.has(task.id)) taskPathById.set(task.id, taskPaths[index]); });
  const places = childPlaces(input.tasks, taskPathById);
  const resources = input.resources ?? [];
  const resourcePathById = pathsById(resources, resource => pathOfGlobalId(globalIdOf('res', resource.id)));
  const baselines = input.baselines ?? [];
  const baselinePathById = pathsById(baselines, baseline => pathOfGlobalId(globalIdOf('bl', baseline.id)));
  const [comparedFirst, comparedSecond] = input.comparedBaselineIds ?? [null, null];
  const baselinePath = (id: string | null | undefined) => (id ? baselinePathById.get(id) : undefined);

  const data: IfcxEntry[] = [];
  const documentSource: DocumentWriteSource = {
    formatVersion: canadianGeneration ? CANADIAN_CALENDAR_PROFILE_VERSION : OPS_PROFILE_VERSION,
    project, projectPath, workplanPath, projectCalendarPath: calendars[0].path,
    ...(input.timeModel !== undefined ? { timeModel: input.timeModel } : {}),
    minuteModelPending: input.minuteModelPending === true,
    importPristine: input.importPristine === true,
    literalCalendarPaths: (input.ifcLiteralCalendarIds ?? []).flatMap(id => calendarPathById.get(id) ?? []),
    structure: {
      activityCodeTypes: input.activityCodeTypes ?? [], customFieldDefs: input.customFieldDefs ?? [], customTaskTypes: input.customTaskTypes ?? [],
    },
    ...(input.recordedSourceFormat !== undefined ? { recordedSourceFormat: input.recordedSourceFormat } : {}),
    ...(baselinePath(input.activeBaselineId) !== undefined ? { activeBaselinePath: baselinePath(input.activeBaselineId) } : {}),
    comparedBaselinePaths: [baselinePath(comparedFirst), baselinePath(comparedSecond)],
    removedTasks: input.baselineOrphanGuids ?? {},
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
    const source: TaskWriteSource = {
      task, path: taskPaths[index], span: taskWindow(task),
      derivesDays: hourDurationIsDerived(task, resolveCalendar(task.calendarId, resourceCalendars, input.calendar)),
      unrecorded: unrecordedOf(task, input.recordedFields?.[task.id]),
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

  for (const resource of resources) {
    const parentPath = resource.parentId === undefined ? undefined : resourcePathById.get(resource.parentId);
    const calendarPath = resource.calendarId === undefined ? undefined : calendarPathById.get(resource.calendarId);
    const source = {
      resource, path: resourcePathById.get(resource.id)!,
      ...(parentPath !== undefined ? { parentPath } : {}),
      ...(calendarPath !== undefined ? { calendarPath } : {}),
    };
    data.push({ path: source.path, attributes: attributesOf([
      [ATTRIBUTE.resource, writeFields(RESOURCE_SHARED_FIELDS, source)],
      [ATTRIBUTE.opsResource, writeFields(RESOURCE_FIELDS, source)],
    ]) });
  }

  for (const assignment of input.assignments ?? []) {
    const source = {
      assignment, path: pathOfGlobalId(globalIdOf('asgn', assignment.id)),
      taskPath: taskPathById.get(assignment.taskId)!, resourcePath: resourcePathById.get(assignment.resourceId)!,
    };
    data.push({ path: source.path, attributes: attributesOf([
      [ATTRIBUTE.assignment, writeFields(ASSIGNMENT_SHARED_FIELDS, source)],
      [ATTRIBUTE.opsAssignment, writeFields(ASSIGNMENT_FIELDS, source)],
    ]) });
  }

  for (const baseline of baselines) {
    const source = { baseline, path: baselinePathById.get(baseline.id)!, taskPathById };
    data.push({ path: source.path, attributes: attributesOf([
      [ATTRIBUTE.baseline, writeFields(BASELINE_SHARED_FIELDS, source)],
      [ATTRIBUTE.opsBaseline, writeFields(BASELINE_FIELDS, source)],
    ]) });
  }

  const used = new Set<string>(data.flatMap(entry => Object.keys(entry.attributes)));
  return {
    header: {
      id: `${OWN_HEADER_ID_PREFIX}${projectPath}`, ifcxVersion: IFCX_VERSION, dataVersion: IFCX_DATA_VERSION,
      author: project.author || DEFAULT_HEADER_AUTHOR, timestamp: writtenAt.toISOString(),
    },
    imports: [],
    schemas: ownSchemas(used, canadianGeneration),
    data,
  };
}

export function objectLabels(input: PlanningModel, globalIdOf: GlobalIdOfObject): Map<string, string> {
  const labels = new Map<string, string>([
    [pathOfGlobalId(globalIdOf('wp', input.project.id)), 'het werkplan'],
    [pathOfGlobalId(globalIdOf('ws', input.project.id)), 'het werkschema'],
  ]);
  for (const calendar of [input.calendar, ...(input.resourceCalendars ?? [])]) labels.set(pathOfGlobalId(globalIdOf('cal', calendar.id)), `kalender ${calendar.id}`);
  for (const task of input.tasks) labels.set(pathOfGlobalId(globalIdOf('task', task.id)), `taak ${task.id} (${task.name})`);
  for (const sequence of input.sequences) labels.set(pathOfGlobalId(globalIdOf('seq', sequence.id)), `relatie ${sequence.id}`);
  for (const resource of input.resources ?? []) labels.set(pathOfGlobalId(globalIdOf('res', resource.id)), `resource ${resource.id} (${resource.name})`);
  for (const assignment of input.assignments ?? []) labels.set(pathOfGlobalId(globalIdOf('asgn', assignment.id)), `toewijzing ${assignment.id}`);
  for (const baseline of input.baselines ?? []) labels.set(pathOfGlobalId(globalIdOf('bl', baseline.id)), `baseline ${baseline.id} (${baseline.name})`);
  return labels;
}

export function globalIdsOf(input: PlanningModel): GlobalIdOfObject {
  const intended = intendedGlobalIds(input);
  return (kind, id) => intended.get(ifcObjectSeed(kind, id))!;
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
