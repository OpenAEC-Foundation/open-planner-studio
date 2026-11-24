import type { WriteIFCInput } from '../ifcWriter';
import { normalizeComparedBaselines, type Baseline } from '@/types/baseline';
import { writeFields } from './fieldTable';
import { identityOfGlobalId, type IfcxIdentity } from './globalIdUuid';
import { derivedGlobalId, globalIdKey, libraryCalendarsWrittenByStep, type GlobalIdOf } from './stepGlobalIds';
import { ASSIGNMENT_AREA, BASELINE_AREA, RESOURCE_AREA } from './fieldGroups';
import type { BaselineRowIdentity } from './fields/baselineFields';
import type { Inconsistency } from './consistency';
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

function duplicateOf(ids: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return undefined;
}

export function resourceInconsistencies(input: WriteIFCInput): Inconsistency[] {
  const found: Inconsistency[] = [];
  const add = (field: string, detail: string) => { found.push({ field, detail }); };
  const baselines = input.baselines ?? [];
  const duplicates: [string | undefined, string, string][] = [
    [duplicateOf(input.resources.map(resource => resource.id)), 'resource.id', 'resources'],
    [duplicateOf(input.assignments.map(assignment => assignment.id)), 'assignment.id', 'toewijzingen'],
    [duplicateOf(baselines.map(baseline => baseline.id)), 'baseline.id', 'baselines'],
  ];
  for (const [duplicate, field, what] of duplicates) if (duplicate !== undefined) add(field, `Twee ${what} hebben het id ${duplicate}`);
  const calendarIds = new Set([input.calendar.id, ...libraryCalendarsWrittenByStep(input).map(calendar => calendar.id)]);
  const resourceIds = new Set(input.resources.map(resource => resource.id));
  for (const resource of input.resources) {
    if (resource.parentId !== undefined && !resourceIds.has(resource.parentId)) {
      add('resource.parentId', `Resource ${resource.id} hoort bij ploeg ${resource.parentId}, die niet bestaat`);
    }
    if (resource.calendarId !== undefined && !calendarIds.has(resource.calendarId)) {
      add('resource.calendarId', `Resource ${resource.id} heeft kalender ${resource.calendarId}, die niet bestaat`);
    }
  }
  const taskIds = new Set(input.tasks.map(task => task.id));
  for (const assignment of input.assignments) {
    if (!taskIds.has(assignment.taskId)) add('assignment.taskId', `Toewijzing ${assignment.id} hoort bij taak ${assignment.taskId}, die niet bestaat`);
    if (!resourceIds.has(assignment.resourceId)) {
      add('assignment.resourceId', `Toewijzing ${assignment.id} wijst resource ${assignment.resourceId} toe, die niet bestaat`);
    }
  }
  const active = input.activeBaselineId ?? null;
  if (active !== null && !baselines.some(baseline => baseline.id === active)) add('activeBaselineId', `De actieve baseline ${active} bestaat niet`);
  const compared: readonly (string | null)[] = input.comparedBaselineIds ?? [null, null];
  const kept = normalizeComparedBaselines(compared, baselines, active);
  if (kept[0] !== (compared[0] ?? null) || kept[1] !== (compared[1] ?? null)) {
    add('comparedBaselineIds', 'De vergelijking noemt een baseline die niet bestaat, de actieve, of twee keer dezelfde');
  }
  return found;
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
