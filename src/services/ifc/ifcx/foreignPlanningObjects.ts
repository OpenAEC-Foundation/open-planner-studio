import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';
import { IFC_TO_RESOURCE_TYPE, RESOURCE_TYPE_TO_IFC } from '../ifcConstants';
import { ifcObjectSeed, type IfcObjectKind } from '../ifcWriter';
import { parseIfcDuration } from '../isoDuration';
import { hasKey, readFields, type IfcxField } from './fieldTable';
import { BASELINE_FIELDS, emptyBaseline, type BaselineReadTarget } from './fields/baselineFields';
import { CALENDAR_FIELDS, type CalendarReadTarget } from './fields/calendarFields';
import { RESOURCE_FIELDS, emptyResource, type ResourceReadTarget } from './fields/resourceFields';
import { SEQUENCE_FIELDS, emptySequence, sharedLagOf, type SequenceReadTarget } from './fields/sequenceFields';
import { ASSIGNMENT_FIELDS, emptyAssignment, type AssignmentReadTarget } from './fields/assignmentFields';
import { invalidField, type SourceNode } from './foreignPlanningSource';
import { uuidToCompactGlobalId } from './identityPath';
import { uuidOfSourcePath } from './pathUuid';
import { ATTRIBUTE } from './profile';
import type { WorkCalendar } from '@/types/calendar';
import type { NodeKind } from './nodes';

const objectKinds = {
  workplan: 'wp', schedule: 'ws', task: 'task', resource: 'res', calendar: 'cal', assignment: 'asgn', baseline: 'bl', sequence: 'seq',
} as const satisfies Record<NodeKind, IfcObjectKind>;

function byKind(): Record<NodeKind, Map<string, string>> {
  return { workplan: new Map(), schedule: new Map(), task: new Map(), resource: new Map(), calendar: new Map(),
    assignment: new Map(), baseline: new Map(), sequence: new Map() };
}

export class PlanningIdentities {
  readonly paths = byKind();
  readonly globalIds: Record<string, string> = {};
  private readonly ids = byKind();
  private readonly usedUuids = new Set<string>();

  add(kind: NodeKind, path: string, preferred?: string): string {
    const previous = this.ids[kind].get(path);
    if (previous !== undefined) return previous;
    let uuid = uuidOfSourcePath(path);
    const base = preferred ?? uuid;
    let id = base;
    for (let duplicate = 2; this.paths[kind].has(id); duplicate++) id = `${base}-dup-${duplicate}`;
    for (let duplicate = 2; this.usedUuids.has(uuid); duplicate++) uuid = uuidOfSourcePath(`${path}#${kind}-dup-${duplicate}`);
    this.usedUuids.add(uuid);
    this.globalIds[ifcObjectSeed(objectKinds[kind], id)] = uuidToCompactGlobalId(uuid);
    this.ids[kind].set(path, id);
    this.paths[kind].set(id, path);
    return id;
  }

  reference(kind: NodeKind, target: unknown, node: SourceNode, attribute: string, field: string): string {
    const id = typeof target === 'string' ? this.ids[kind].get(target) : undefined;
    return id ?? invalidField({ path: node.path, attribute, field }, `Geen ${kind} op het opgegeven pad`);
  }

  baselineTask(path: string, orphanGuids: Record<string, string>): string {
    const existing = this.ids.task.get(path);
    if (existing !== undefined) return existing;
    const id = this.add('task', path);
    orphanGuids[id] = this.globalIds[ifcObjectSeed('task', id)];
    return id;
  }
}

export function supplied<W, R>(fields: readonly IfcxField<W, R>[], values: Record<string, unknown>, target: R): void {
  readFields(fields.filter(field => hasKey(values, field.key)), values, target);
}

export function readCalendar(node: SourceNode, isProjectCalendar: boolean, defaults: WorkCalendar, ids: PlanningIdentities) {
  const shared = node.attributes.get(ATTRIBUTE.calendar)!;
  const ops = node.attributes.get(ATTRIBUTE.opsCalendar) ?? {};
  const calendar: WorkCalendar = { ...defaults, name: '', description: '', workDays: [...defaults.workDays], holidays: [] };
  delete calendar.generation;
  const target: CalendarReadTarget = { calendar, path: node.path, isProjectCalendar };
  supplied(CALENDAR_FIELDS, ops, target);
  supplied(CALENDAR_FIELDS, {
    ...shared, ...(shared.exceptionTimes === undefined ? {} : { holidays: shared.exceptionTimes }),
    ...(typeof shared.predefinedType === 'string' ? { shift: shared.predefinedType.replace(/SHIFT$/, '') } : {}),
  }, target);
  calendar.id = ids.add('calendar', node.path, isProjectCalendar ? DEFAULT_CALENDAR_ID : ops.id as string | undefined);
  return calendar;
}

export function readResources(nodes: SourceNode[], ids: PlanningIdentities) {
  const targets = nodes.map(node => {
    const shared = node.attributes.get(ATTRIBUTE.resource)!;
    const ops = node.attributes.get(ATTRIBUTE.opsResource) ?? {};
    const resource = emptyResource();
    const target: ResourceReadTarget = { resource, path: node.path };
    supplied(RESOURCE_FIELDS, ops, target);
    supplied(RESOURCE_FIELDS, shared, target);
    if (typeof shared.resourceClass === 'string' && RESOURCE_TYPE_TO_IFC[resource.type] !== shared.resourceClass.toUpperCase()) {
      resource.type = IFC_TO_RESOURCE_TYPE[shared.resourceClass.toUpperCase()]!;
    }
    resource.id = ids.add('resource', node.path, ops.id as string | undefined);
    return { target, node };
  });
  return targets.map(({ target, node }) => {
    const { resource, parentPath, calendarPath } = target;
    if (parentPath) resource.parentId = ids.reference('resource', parentPath, node, ATTRIBUTE.opsResource, 'parent');
    if (calendarPath) resource.calendarId = ids.reference('calendar', calendarPath, node, ATTRIBUTE.opsResource, 'calendar');
    return resource;
  });
}

export function readSequence(node: SourceNode, ids: PlanningIdentities) {
  const shared = node.attributes.get(ATTRIBUTE.sequence)!;
  const ops = node.attributes.get(ATTRIBUTE.opsSequence) ?? {};
  const sequence = emptySequence();
  const target: SequenceReadTarget = { sequence, path: node.path, predecessorPath: '', successorPath: '' };
  supplied(SEQUENCE_FIELDS, ops, target);
  sequence.id = ids.add('sequence', node.path, ops.id as string | undefined);
  sequence.predecessorId = ids.reference('task', shared.relatingProcess ?? target.predecessorPath, node, ATTRIBUTE.sequence, 'relatingProcess');
  sequence.successorId = ids.reference('task', shared.relatedProcess ?? target.successorPath, node, ATTRIBUTE.sequence, 'relatedProcess');
  if (shared.sequenceType !== undefined) sequence.type = shared.sequenceType as typeof sequence.type;
  if (shared.lagDurationType !== undefined) sequence.lagUnit = shared.lagDurationType as typeof sequence.lagUnit;
  const lag = sharedLagOf(sequence);
  if (typeof shared.timeLagRatio === 'number' && shared.timeLagRatio !== lag.timeLagRatio) {
    sequence.lagPercent = shared.timeLagRatio * 100;
    sequence.lagDays = 0;
    delete sequence.lagMinutes;
  } else if (typeof shared.timeLag === 'string' && shared.timeLag !== lag.timeLag) {
    let duration;
    try { duration = parseIfcDuration(shared.timeLag); }
    catch { return invalidField({ path: node.path, attribute: ATTRIBUTE.sequence, field: 'timeLag' }, 'Ongeldige relatieduur'); }
    sequence.lagDays = duration.days;
    delete sequence.lagPercent;
    if (duration.timeMinutes !== null) sequence.lagMinutes = duration.timeMinutes;
    else delete sequence.lagMinutes;
  }
  return sequence;
}

export function readAssignment(node: SourceNode, ids: PlanningIdentities) {
  const shared = node.attributes.get(ATTRIBUTE.assignment)!;
  const ops = node.attributes.get(ATTRIBUTE.opsAssignment) ?? {};
  const assignment = emptyAssignment();
  const target: AssignmentReadTarget = { assignment, path: node.path, taskPath: '', resourcePath: '' };
  supplied(ASSIGNMENT_FIELDS, ops, target);
  assignment.id = ids.add('assignment', node.path, ops.id as string | undefined);
  assignment.taskId = ids.reference('task', shared.relatingProcess ?? target.taskPath, node, ATTRIBUTE.assignment, 'relatingProcess');
  assignment.resourceId = ids.reference('resource', shared.relatedResource ?? target.resourcePath, node, ATTRIBUTE.assignment, 'relatedResource');
  if (shared.scheduleUsage !== undefined) assignment.unitsPerDay = shared.scheduleUsage as number;
  if (shared.scheduleContour !== undefined) assignment.curve = shared.scheduleContour as typeof assignment.curve;
  return assignment;
}

export function sharedMoment(shared: unknown, precise: string): string {
  return typeof shared === 'string' && precise.slice(0, 10) !== shared ? shared + 'T00:00' : precise;
}

export function readBaseline(node: SourceNode, ids: PlanningIdentities, starts: Map<string, string>, orphanGuids: Record<string, string>) {
  const shared = node.attributes.get(ATTRIBUTE.baseline)!;
  const ops = node.attributes.get(ATTRIBUTE.opsBaseline) ?? {};
  const baseline = emptyBaseline();
  const target: BaselineReadTarget = { baseline, path: node.path, rowTaskPaths: [] };
  supplied(BASELINE_FIELDS, ops, target);
  baseline.id = ids.add('baseline', node.path, ops.id as string | undefined);
  if (shared.name !== undefined) baseline.name = shared.name as string;
  baseline.projectEnd = sharedMoment(shared.finish, baseline.projectEnd);
  if (typeof shared.start === 'string') starts.set(baseline.id, shared.start);
  target.rowTaskPaths.forEach((path, index) => {
    if (path !== undefined) baseline.tasks[index].taskId = ids.baselineTask(path, orphanGuids);
  });
  return baseline;
}
