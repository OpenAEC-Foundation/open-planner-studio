import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Baseline, ComparedBaselineIds } from '@/types/baseline';
import { resourceIdsByTask } from '@/services/importNormalize';
import { readFields } from './fieldTable';
import { globalIdOfIdentity } from './globalIdUuid';
import { ASSIGNMENT_AREA, BASELINE_AREA, RESOURCE_AREA } from './fieldGroups';
import { emptyResource, type ResourceReadTarget } from './fields/resourceFields';
import { emptyAssignment, type AssignmentReadTarget } from './fields/assignmentFields';
import {
  baselineOf, emptyBaselineTarget, type BaselineReadTarget, type BaselineRowIdentity, type BaselineRowRead,
} from './fields/baselineFields';
import type { TaskReadTarget } from './fields/taskFields';
import { globalIdKey } from './stepGlobalIds';
import { IfcxReadError, type IfcxErrorPlace } from './ifcxErrors';
import { ATTRIBUTE, type IfcxAttributeName } from './profile';

export interface ResourceNode {
  readonly path: string;
  readonly attributes: ReadonlyMap<IfcxAttributeName, Record<string, unknown>>;
}

export interface ResourceReadContext {
  readonly nodes: (kind: 'resource' | 'assignment' | 'baseline') => readonly ResourceNode[];
  readonly reference: (path: string | undefined, kind: 'task' | 'calendar' | 'resource', place: IfcxErrorPlace) => string | undefined;
  readonly kindAt: (path: string) => string | undefined;
  readonly calendarIdAt: ReadonlyMap<string, string>;
  readonly taskTargets: readonly TaskReadTarget[];
  readonly assertIdentityPath: (path: string, globalIdOutsidePath: string | undefined, place: IfcxErrorPlace) => void;
}


export interface ResourceReadResult {
  readonly resources: Resource[];
  readonly assignments: ResourceAssignment[];
  readonly baselines: Baseline[];
  readonly activeBaselineId: string | null;
  readonly comparedBaselineIds: ComparedBaselineIds;
  readonly globalIds: Record<string, string>;
}

function invalid(detail: string, place?: IfcxErrorPlace): IfcxReadError {
  return new IfcxReadError('invalid', detail, place);
}

function readResources(context: ResourceReadContext): { targets: ResourceReadTarget[]; idAt: Map<string, string> } {
  const targets = context.nodes('resource').map(node => {
    const target: ResourceReadTarget = { resource: emptyResource(), path: node.path };
    readFields(RESOURCE_AREA.planning, node.attributes.get(ATTRIBUTE.resource)!, target);
    readFields(RESOURCE_AREA.ops, node.attributes.get(ATTRIBUTE.opsResource) ?? {}, target);
    context.assertIdentityPath(node.path, target.globalIdOutsidePath, { path: node.path, attribute: ATTRIBUTE.opsResource });
    return target;
  });
  const idAt = new Map(targets.map(target => [target.path, target.resource.id]));
  for (const target of targets) {
    const place = { path: target.path, attribute: ATTRIBUTE.resource };
    const crewPath = context.reference(target.crewPath, 'resource', { ...place, field: 'crew' });
    if (crewPath !== undefined) target.resource.parentId = idAt.get(crewPath)!;
    const calendarPath = context.reference(target.calendarPath, 'calendar', { ...place, field: 'calendar' });
    if (calendarPath !== undefined) target.resource.calendarId = context.calendarIdAt.get(calendarPath)!;
  }
  return { targets, idAt };
}

function readAssignments(context: ResourceReadContext, taskIdAt: ReadonlyMap<string, string>, resourceIdAt: ReadonlyMap<string, string>) {
  const targets = context.nodes('assignment').map(node => {
    const target: AssignmentReadTarget = { assignment: emptyAssignment(), path: node.path, taskPath: '', resourcePath: '', work: {} };
    readFields(ASSIGNMENT_AREA.planning, node.attributes.get(ATTRIBUTE.assignment)!, target);
    readFields(ASSIGNMENT_AREA.ops, node.attributes.get(ATTRIBUTE.opsAssignment) ?? {}, target);
    const place = { path: node.path, attribute: ATTRIBUTE.assignment };
    target.assignment.taskId = taskIdAt.get(context.reference(target.taskPath, 'task', { ...place, field: 'relatingProcess' })!)!;
    target.assignment.resourceId = resourceIdAt.get(context.reference(target.resourcePath, 'resource', { ...place, field: 'relatedResource' })!)!;
    context.assertIdentityPath(node.path, undefined, { path: node.path, attribute: ATTRIBUTE.opsAssignment });
    return target;
  });
  return targets;
}

function baselineChoice(targets: readonly BaselineReadTarget[]): { activeBaselineId: string | null; comparedBaselineIds: ComparedBaselineIds } {
  const active = targets.filter(target => target.active);
  if (active.length > 1) throw invalid('Het bestand heeft meer dan één actieve baseline', { path: active[1].path, attribute: ATTRIBUTE.opsBaseline, field: 'active' });
  const compared: ComparedBaselineIds = [null, null];
  for (const target of targets) {
    if (target.comparedSlot === undefined) continue;
    const place = { path: target.path, attribute: ATTRIBUTE.opsBaseline, field: 'comparedSlot' };
    if (target.active) throw invalid('De actieve baseline staat ook in de vergelijking', place);
    if (compared[target.comparedSlot - 1] !== null) throw invalid('Twee baselines op dezelfde vergelijkingsplaats', place);
    compared[target.comparedSlot - 1] = target.id;
  }
  return { activeBaselineId: active[0]?.id ?? null, comparedBaselineIds: compared };
}

function readBaselines(context: ResourceReadContext, taskIdAt: ReadonlyMap<string, string>, globalIds: Record<string, string>) {
  const targets = context.nodes('baseline').map(node => {
    const target = emptyBaselineTarget(node.path);
    readFields(BASELINE_AREA.planning, node.attributes.get(ATTRIBUTE.baseline)!, target);
    readFields(BASELINE_AREA.ops, node.attributes.get(ATTRIBUTE.opsBaseline) ?? {}, target);
    context.assertIdentityPath(node.path, target.globalIdOutsidePath, { path: node.path, attribute: ATTRIBUTE.opsBaseline });
    return target;
  });
  const liveTaskIds = new Set(taskIdAt.values());
  const baselines = targets.map(target => {
    const place = { path: target.path, attribute: ATTRIBUTE.opsBaseline, field: 'taskIds' };
    const identityAt = new Map<string, BaselineRowIdentity>();
    for (const identity of target.rowIdentities) {
      if (identityAt.has(identity.path)) throw invalid('Twee ids voor één baselinetaak', place);
      if (taskIdAt.has(identity.path)) throw invalid('Een eigen id voor een baselinetaak die bestaat', place);
      context.assertIdentityPath(identity.path, identity.globalId, place);
      identityAt.set(identity.path, identity);
    }
    const taskIdOfRow = (row: BaselineRowRead): string => {
      if (row.task === undefined) return '';
      const live = taskIdAt.get(row.task);
      if (live !== undefined) return live;
      const rowPlace = { path: target.path, attribute: ATTRIBUTE.baseline, field: 'tasks' };
      if (context.kindAt(row.task) !== undefined) throw invalid(`Een baselinetaak wijst naar ${row.task}, dat geen taak is`, rowPlace);
      const identity = identityAt.get(row.task);
      const id = identity?.id ?? row.task;
      if (liveTaskIds.has(id)) throw invalid(`Een verwijderde baselinetaak met het id van taak ${id}`, rowPlace);
      const guid = globalIdOfIdentity(row.task, identity?.globalId);
      const key = globalIdKey('task', id);
      if (globalIds[key] !== undefined && globalIds[key] !== guid) throw invalid(`Twee paden voor verwijderde baselinetaak ${id}`, rowPlace);
      globalIds[key] = guid;
      return id;
    };
    globalIds[globalIdKey('baseline', target.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
    return baselineOf(target, taskIdOfRow);
  });
  return { baselines, ...baselineChoice(targets) };
}

export function readResourceNodes(context: ResourceReadContext): ResourceReadResult {
  const globalIds: Record<string, string> = {};
  const taskIdAt = new Map(context.taskTargets.map(target => [target.path, target.task.id]));
  const { targets, idAt } = readResources(context);
  for (const target of targets) globalIds[globalIdKey('res', target.resource.id)] = globalIdOfIdentity(target.path, target.globalIdOutsidePath);
  const assignmentTargets = readAssignments(context, taskIdAt, idAt);
  for (const target of assignmentTargets) globalIds[globalIdKey('assignment', target.assignment.id)] = globalIdOfIdentity(target.path, undefined);
  const assignments = assignmentTargets.map(target => target.assignment);
  const assigned = resourceIdsByTask(assignments);
  for (const target of context.taskTargets) target.task.resourceIds = target.resourceIdsOverride ?? assigned.get(target.task.id) ?? [];
  const resources = targets.map(target => target.resource);
  const { baselines, activeBaselineId, comparedBaselineIds } = readBaselines(context, taskIdAt, globalIds);
  return { resources, assignments, baselines, activeBaselineId, comparedBaselineIds, globalIds };
}
