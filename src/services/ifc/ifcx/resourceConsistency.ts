import type { WriteIFCInput } from '../ifcWriter';
import { normalizeComparedBaselines } from '@/types/baseline';
import {
  COST_ASSIGNMENT_WORK_FIELDS, COST_RESOURCE_CLEARED_FIELDS, isCostResource, isValidCostAmount, type Resource, type ResourceAssignment,
} from '@/types/resource';
import { libraryCalendarsWrittenByStep } from './stepGlobalIds';
import type { Inconsistency } from './consistency';

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
  found.push(...costInconsistencies(input.resources, input.assignments));
  return found;
}

export function costInconsistencies(resources: readonly Resource[], assignments: readonly ResourceAssignment[]): Inconsistency[] {
  const found: Inconsistency[] = [];
  const add = (field: string, detail: string) => { found.push({ field, detail }); };
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  for (const resource of resources) {
    if (!isCostResource(resource)) continue;
    for (const key of [...COST_RESOURCE_CLEARED_FIELDS, 'availability'] as const) {
      if (resource[key] !== undefined) add(`resource.${key}`, `Kostenresource ${resource.id} heeft ${key}, wat een kostenresource niet draagt`);
    }
    if (resource.maxUnits !== 1) add('resource.maxUnits', `Kostenresource ${resource.id} heeft een capaciteit anders dan 1`);
  }
  for (const assignment of assignments) {
    const resource = byId.get(assignment.resourceId);
    if (resource === undefined) continue;
    if (isCostResource(resource)) {
      for (const key of COST_ASSIGNMENT_WORK_FIELDS) {
        if (assignment[key] !== undefined) add(`assignment.${key}`, `Kostentoewijzing ${assignment.id} heeft ${key}, wat een kostentoewijzing niet draagt`);
      }
      if (assignment.unitsPerDay !== 1) add('assignment.unitsPerDay', `Kostentoewijzing ${assignment.id} heeft een inzet anders dan 1`);
      if (assignment.costAmount !== undefined && !isValidCostAmount(assignment.costAmount)) {
        add('assignment.costAmount', `Kostentoewijzing ${assignment.id} heeft een bedrag dat geen eindig getal van 0 of meer is`);
      }
    } else if (assignment.costAmount !== undefined) {
      add('assignment.costAmount', `Toewijzing ${assignment.id} van een werkresource heeft een bedrag`);
    }
  }
  return found;
}
