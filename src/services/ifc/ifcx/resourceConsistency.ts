import { normalizeComparedBaselines } from '@/types/baseline';
import {
  COST_ASSIGNMENT_WORK_FIELDS, COST_RESOURCE_CLEARED_FIELDS, isCostResource, isValidCostAmount, type Resource, type ResourceAssignment,
} from '@/types/resource';
import type { Inconsistency } from './consistency';
import type { PlanningModel } from './identity';

export function baselineChoiceProblems(model: PlanningModel): Inconsistency[] {
  const found: Inconsistency[] = [];
  const baselines = model.baselines ?? [];
  const active = model.activeBaselineId ?? null;
  if (active !== null && !baselines.some(baseline => baseline.id === active)) {
    found.push({ field: 'activeBaselineId', detail: `De actieve baseline ${active} bestaat niet` });
  }
  const compared: readonly (string | null)[] = model.comparedBaselineIds ?? [null, null];
  const kept = normalizeComparedBaselines(compared, baselines, active);
  if (compared.length !== 2 || kept[0] !== compared[0] || kept[1] !== compared[1]) {
    found.push({ field: 'comparedBaselineIds', detail: 'De vergelijking noemt een baseline die niet bestaat, de actieve, of twee keer dezelfde' });
  }
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
