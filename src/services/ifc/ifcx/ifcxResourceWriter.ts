import type { WriteIFCInput } from '../ifcWriter';
import { normalizeComparedBaselines, type Baseline } from '@/types/baseline';
import { writeFields } from './fieldTable';
import { identityOfGlobalId, type IfcxIdentity } from './globalIdUuid';
import type { GlobalIdOf } from './stepGlobalIds';
import { ASSIGNMENT_AREA, BASELINE_AREA, RESOURCE_AREA } from './fieldGroups';
import type { BaselineRowIdentity } from './fields/baselineFields';
import { IfcxWriteRefusedError } from './ifcxErrors';
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

function refused(detail: string, field: string): IfcxWriteRefusedError {
  return new IfcxWriteRefusedError('unsupported', detail, [field]);
}

function assertUniqueIds(items: readonly { id: string }[], field: string, what: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw refused(`Twee ${what} met id ${item.id}`, field);
    seen.add(item.id);
  }
}

function assertBaselineChoice(input: WriteIFCInput, baselines: readonly Baseline[]): void {
  const active = input.activeBaselineId ?? null;
  if (active !== null && !baselines.some(baseline => baseline.id === active)) {
    throw refused(`De actieve baseline ${active} bestaat niet`, 'activeBaselineId');
  }
  const compared: readonly (string | null)[] = input.comparedBaselineIds ?? [null, null];
  const kept = normalizeComparedBaselines(compared, [...baselines], active);
  if (kept[0] !== (compared[0] ?? null) || kept[1] !== (compared[1] ?? null)) {
    throw refused('De vergelijkingsbaselines bestaan niet, zijn dubbel of bevatten de actieve baseline', 'comparedBaselineIds');
  }
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
  assertUniqueIds(input.resources, 'resource.id', 'resources');
  assertUniqueIds(input.assignments, 'assignment.id', 'toewijzingen');
  assertUniqueIds(baselines, 'baseline.id', 'baselines');
  assertBaselineChoice(input, baselines);
  const entries: PendingEntry[] = [];

  const resourceIdentities = input.resources.map(resource => identityOfGlobalId(links.globalIdOf('res', resource.id)));
  const resourcePathById = new Map(input.resources.map((resource, index) => [resource.id, resourceIdentities[index].path]));
  input.resources.forEach((resource, index) => {
    const crewPath = resource.parentId === undefined ? undefined : resourcePathById.get(resource.parentId);
    if (resource.parentId !== undefined && crewPath === undefined) {
      throw refused(`Resource ${resource.id} hoort bij een ploeg die niet bestaat`, 'resource.parentId');
    }
    const calendarPath = resource.calendarId === undefined ? undefined : links.calendarPathById.get(resource.calendarId);
    if (resource.calendarId !== undefined && calendarPath === undefined) {
      throw refused(`Resource ${resource.id} heeft een kalender die niet bestaat`, 'resource.calendarId');
    }
    const source = {
      resource, identity: resourceIdentities[index],
      ...(crewPath !== undefined ? { crewPath } : {}), ...(calendarPath !== undefined ? { calendarPath } : {}),
    };
    entries.push({ path: source.identity.path, attributes: [
      [ATTRIBUTE.resource, writeFields(RESOURCE_AREA.planning, source)],
      [ATTRIBUTE.opsResource, writeFields(RESOURCE_AREA.ops, source)],
    ] });
  });

  for (const assignment of input.assignments) {
    const taskPath = links.taskPathById.get(assignment.taskId);
    if (taskPath === undefined) throw refused(`Toewijzing ${assignment.id} hoort bij een taak die niet bestaat`, 'assignment.taskId');
    const resourcePath = resourcePathById.get(assignment.resourceId);
    if (resourcePath === undefined) throw refused(`Toewijzing ${assignment.id} wijst een resource toe die niet bestaat`, 'assignment.resourceId');
    const source = { assignment, identity: identityOfGlobalId(links.globalIdOf('assignment', assignment.id)), taskPath, resourcePath };
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
