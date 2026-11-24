import type { WriteIFCInput } from '../ifcWriter';
import type { Baseline } from '@/types/baseline';
import { writeFields } from './fieldTable';
import { identityOfGlobalId, type IfcxIdentity } from './globalIdUuid';
import { derivedGlobalId, globalIdKey, type GlobalIdOf } from './stepGlobalIds';
import { ASSIGNMENT_AREA, BASELINE_AREA, RESOURCE_AREA } from './fieldGroups';
import type { BaselineRowIdentity } from './fields/baselineFields';
import { ATTRIBUTE, type IfcxAttributeName } from './profile';

export interface ResourceEntryLinks {
  readonly globalIdOf: GlobalIdOf;
  readonly taskPathById: ReadonlyMap<string, string>;
  readonly calendarPathById: ReadonlyMap<string, string>;
}

export interface PendingEntry {
  readonly path: string;
  readonly attributes: readonly [IfcxAttributeName, Record<string, unknown>][];
}

export function resourceGlobalIds(input: WriteIFCInput, globalIdOf: GlobalIdOf): Record<string, string> {
  const out: Record<string, string> = {};
  for (const resource of input.resources) out[globalIdKey('res', resource.id)] = globalIdOf('res', resource.id);
  const liveTaskIds = new Set(input.tasks.map(task => task.id));
  const keepIfIssued = (kind: 'baseline' | 'task', id: string) => {
    const guid = globalIdOf(kind, id);
    if (guid !== derivedGlobalId(kind, id, input.project.id)) out[globalIdKey(kind, id)] = guid;
  };
  for (const baseline of input.baselines ?? []) {
    keepIfIssued('baseline', baseline.id);
    for (const row of baseline.tasks) if (row.taskId && !liveTaskIds.has(row.taskId)) keepIfIssued('task', row.taskId);
  }
  return out;
}

function rowIdentities(baseline: Baseline, rowIdentity: readonly (IfcxIdentity | undefined)[], live: ReadonlyMap<string, string>): BaselineRowIdentity[] {
  const out = new Map<string, BaselineRowIdentity>();
  baseline.tasks.forEach((row, index) => {
    const identity = rowIdentity[index];
    if (identity === undefined || live.has(row.taskId) || out.has(identity.path)) return;
    const id = row.taskId !== identity.path ? row.taskId : undefined;
    if (id === undefined && identity.globalIdOutsidePath === undefined) return;
    out.set(identity.path, {
      path: identity.path, ...(id !== undefined ? { id } : {}),
      ...(identity.globalIdOutsidePath !== undefined ? { globalId: identity.globalIdOutsidePath } : {}),
    });
  });
  return [...out.values()];
}

export function resourceEntries(input: WriteIFCInput, links: ResourceEntryLinks): PendingEntry[] {
  const baselines = input.baselines ?? [];
  const entries: PendingEntry[] = [];

  const resourceIdentities = input.resources.map(resource => identityOfGlobalId(links.globalIdOf('res', resource.id)));
  const resourcePathById = new Map(input.resources.map((resource, index) => [resource.id, resourceIdentities[index].path]));
  input.resources.forEach((resource, index) => {
    const source = {
      resource, identity: resourceIdentities[index],
      ...(resource.parentId !== undefined ? { crewPath: resourcePathById.get(resource.parentId)! } : {}),
      ...(resource.calendarId !== undefined ? { calendarPath: links.calendarPathById.get(resource.calendarId)! } : {}),
    };
    entries.push({ path: source.identity.path, attributes: [
      [ATTRIBUTE.resource, writeFields(RESOURCE_AREA.planning, source)],
      [ATTRIBUTE.opsResource, writeFields(RESOURCE_AREA.ops, source)],
    ] });
  });

  for (const assignment of input.assignments) {
    const source = {
      assignment, identity: identityOfGlobalId(links.globalIdOf('assignment', assignment.id)),
      taskPath: links.taskPathById.get(assignment.taskId)!, resourcePath: resourcePathById.get(assignment.resourceId)!,
    };
    entries.push({ path: source.identity.path, attributes: [
      [ATTRIBUTE.assignment, writeFields(ASSIGNMENT_AREA.planning, source)],
      [ATTRIBUTE.opsAssignment, writeFields(ASSIGNMENT_AREA.ops, source)],
    ] });
  }

  const compared: readonly (string | null)[] = input.comparedBaselineIds ?? [null, null];
  for (const baseline of baselines) {
    const rowIdentity = baseline.tasks.map(row => (row.taskId ? identityOfGlobalId(links.globalIdOf('task', row.taskId)) : undefined));
    const comparedAt = compared.indexOf(baseline.id);
    const source = {
      baseline, identity: identityOfGlobalId(links.globalIdOf('baseline', baseline.id)),
      rowPaths: rowIdentity.map(identity => identity?.path), rowIdentities: rowIdentities(baseline, rowIdentity, links.taskPathById),
      active: baseline.id === input.activeBaselineId,
      ...(comparedAt >= 0 ? { comparedSlot: (comparedAt + 1) as 1 | 2 } : {}),
    };
    entries.push({ path: source.identity.path, attributes: [
      [ATTRIBUTE.baseline, writeFields(BASELINE_AREA.planning, source)],
      [ATTRIBUTE.opsBaseline, writeFields(BASELINE_AREA.ops, source)],
    ] });
  }
  return entries;
}
