/** TASKRSRC-mapping met veldspecifieke P6-schalen en bron-id-indexen. */

import type { Resource, ResourceAssignment } from '@/types/resource';
import type {
  XerAssignmentCostsSource, XerAssignmentQuantitiesSource, XerAssignmentUnitScale,
  XerReadonly, XerResourceCurveSource, XerResourceIssue, XerResourceRateSource,
  XerResourceReadContext, XerResourceSource, XerRoleSource, XerTaskResourceSource,
} from './xerResourceTypes';
import { parseXerNumber, XerImportError, type XerRow, type XerTables } from './xerTables';
import {
  deriveXerAssignmentSkipExpectation,
  xerAssignmentSourceId,
} from './xerAssignmentProvenance';

// MPXJ's XerUnitsHelper gebruikt 1.000.000 als afrondingsprecisie voor P6-werkhoeveelheden.
// Dit is geen deler voor *_qty_per_hr: OPS gebruikt daar net als XER 1 = 100%.
const P6_WORK_QUANTITY_PRECISION = 1_000_000;

function numberOf(tables: XerTables, row: XerRow, field: string): number | null {
  try { return parseXerNumber(row.cells[field] ?? '', tables.numberFormat); } catch (error) {
    if (error instanceof XerImportError) {
      throw new XerImportError(error.xerCode, error.message,
        { table: 'TASKRSRC', field, line: row.line, encoding: tables.report.encoding });
    }
    throw error;
  }
}

function presentNumber(target: Record<string, number>, key: string, value: number | null): void {
  if (value !== null) target[key] = value;
}
function workQuantityOf(tables: XerTables, row: XerRow, field: string): number | null {
  const value = numberOf(tables, row, field);
  return value === null ? null : Math.round(value * P6_WORK_QUANTITY_PRECISION) / P6_WORK_QUANTITY_PRECISION;
}
function quantitiesOf(tables: XerTables, row: XerRow): XerAssignmentQuantitiesSource {
  const result: Record<string, number> = {};
  presentNumber(result, 'remaining', workQuantityOf(tables, row, 'remain_qty'));
  presentNumber(result, 'target', workQuantityOf(tables, row, 'target_qty'));
  presentNumber(result, 'actualRegular', workQuantityOf(tables, row, 'act_reg_qty'));
  presentNumber(result, 'actualOvertime', workQuantityOf(tables, row, 'act_ot_qty'));
  presentNumber(result, 'thisPeriod', workQuantityOf(tables, row, 'act_this_per_qty'));
  presentNumber(result, 'remainingPerHour', numberOf(tables, row, 'remain_qty_per_hr'));
  presentNumber(result, 'targetPerHour', numberOf(tables, row, 'target_qty_per_hr'));
  return result;
}
function costsOf(tables: XerTables, row: XerRow): XerAssignmentCostsSource {
  const result: Record<string, number> = {};
  presentNumber(result, 'perQuantity', numberOf(tables, row, 'cost_per_qty'));
  presentNumber(result, 'target', numberOf(tables, row, 'target_cost'));
  presentNumber(result, 'remaining', numberOf(tables, row, 'remain_cost'));
  presentNumber(result, 'actualRegular', numberOf(tables, row, 'act_reg_cost'));
  presentNumber(result, 'actualOvertime', numberOf(tables, row, 'act_ot_cost'));
  presentNumber(result, 'thisPeriod', numberOf(tables, row, 'act_this_per_cost'));
  return result;
}
function rawCurvesOf(row: XerRow): XerTaskResourceSource['rawCurves'] {
  const result: XerTaskResourceSource['rawCurves'] = {};
  if (row.cells.target_crv?.trim()) result.target = row.cells.target_crv;
  if (row.cells.remain_crv?.trim()) result.remaining = row.cells.remain_crv;
  if (row.cells.actual_crv?.trim()) result.actual = row.cells.actual_crv;
  return result;
}
function assertUniqueAssignmentIds(rows: readonly XerRow[]): void {
  const firstLineById = new Map<string, number>();
  for (const row of rows) {
    const sourceId = row.cells.taskrsrc_id?.trim();
    if (!sourceId) continue;
    const firstLine = firstLineById.get(sourceId);
    if (firstLine !== undefined) {
      throw new XerImportError('XER_DUPLICATE_ID',
        `TASKRSRC.taskrsrc_id bevat dubbele id '${sourceId}' op regels ${firstLine} en ${row.line}.`,
        { table: 'TASKRSRC', field: 'taskrsrc_id', line: row.line, lines: [firstLine, row.line] });
    }
    firstLineById.set(sourceId, row.line);
  }
}
function assignmentRate(quantities: XerAssignmentQuantitiesSource): number {
  if ((quantities.targetPerHour ?? 0) > 0) return quantities.targetPerHour as number;
  return quantities.remainingPerHour ?? quantities.targetPerHour ?? 0;
}
function unitsPerDay(rawRate: number, resource: Resource, context: XerResourceReadContext): {
  value: number; scale: XerAssignmentUnitScale;
} {
  if (resource.type === 'MATERIAL') {
    const hoursPerDay = resource.calendarId
      ? context.calendarHoursPerDay.get(resource.calendarId) ?? context.projectHoursPerDay
      : context.projectHoursPerDay;
    return { value: rawRate * hoursPerDay, scale: 'MATERIAL_PER_HOUR' };
  }
  return { value: rawRate, scale: 'DIRECT_FRACTION' };
}

/** Eén lineaire partitionering; rijen zonder proj_id blijven alleen in de retained catalogus. */
export function indexXerTaskResourceRows(tables: XerTables): ReadonlyMap<string, readonly XerRow[]> {
  const byProject = new Map<string, XerRow[]>();
  for (const row of tables.tables.get('TASKRSRC')?.rows ?? []) {
    const projectId = row.cells.proj_id?.trim();
    if (!projectId) continue;
    const current = byProject.get(projectId) ?? [];
    current.push(row);
    byProject.set(projectId, current);
  }
  for (const rows of byProject.values()) Object.freeze(rows);
  return byProject;
}

export function readXerResourceAssignments(
  tables: XerTables, context: XerResourceReadContext, resources: readonly Resource[],
  resourceSources: readonly XerReadonly<XerResourceSource>[], roles: readonly XerReadonly<XerRoleSource>[],
  rates: readonly XerReadonly<XerResourceRateSource>[], curves: readonly XerReadonly<XerResourceCurveSource>[],
  rows: readonly XerRow[] = [],
): { assignments: ResourceAssignment[]; roleResources: Resource[]; sources: XerTaskResourceSource[]; issues: XerResourceIssue[] } {
  assertUniqueAssignmentIds(rows);
  const resourceSourceById = new Map(resourceSources.map(source => [source.sourceId, source]));
  const resourceByInternalId = new Map(resources.map(resource => [resource.id, resource]));
  const roleById = new Map(roles.map(role => [role.sourceId, role]));
  const availableResourceSourceIds = new Set(resourceSources
    .filter(source => resourceByInternalId.has(source.internalId))
    .map(source => source.sourceId));
  const availableRoleSourceIds = new Set(roleById.keys());
  const roleRatesById = new Map<string, XerReadonly<XerResourceRateSource>[]>();
  for (const rate of rates) {
    if (rate.entity.kind !== 'ROLE') continue;
    const current = roleRatesById.get(rate.entity.sourceId) ?? [];
    current.push(rate); roleRatesById.set(rate.entity.sourceId, current);
  }
  const curveById = new Map(curves.map(curve => [curve.sourceId, curve]));
  const roleResourceById = new Map<string, Resource>();
  const assignments: ResourceAssignment[] = [];
  const sources: XerTaskResourceSource[] = [];
  const issues: XerResourceIssue[] = [];
  for (const row of rows) {
    const projectSourceId = row.cells.proj_id?.trim() || undefined;
    const sourceId = xerAssignmentSourceId(row.cells, row.line);
    const taskSourceId = row.cells.task_id.trim();
    const resourceSourceId = row.cells.rsrc_id?.trim() || undefined;
    const roleSourceId = row.cells.role_id?.trim() || undefined;
    const entitySourceId = resourceSourceId ?? roleSourceId ?? '';
    const entityKind = resourceSourceId ? 'RESOURCE' as const : 'ROLE' as const;
    const entityInternalId = `${entityKind === 'RESOURCE' ? 'xer-resource' : 'xer-role'}:${entitySourceId}`;
    const skipExpectation = deriveXerAssignmentSkipExpectation(
      row.cells,
      availableResourceSourceIds,
      availableRoleSourceIds,
      context.taskIds,
    );
    const quantities = quantitiesOf(tables, row);
    const assignedRole = resourceSourceId && roleSourceId ? roleById.get(roleSourceId) : undefined;
    if (resourceSourceId && roleSourceId && !assignedRole) {
      issues.push({ code: 'XER_ASSIGNMENT_ASSIGNED_ROLE_MISSING', table: 'TASKRSRC', line: row.line,
        sourceId, fallback: 'RELATION_OMITTED' });
    }
    const sourceBase = { rawRow: row, sourceId, internalId: `xer-assignment:${sourceId}`, taskSourceId,
      ...(projectSourceId ? { projectSourceId } : {}), line: row.line,
      entity: { kind: entityKind, sourceId: entitySourceId, internalId: entityInternalId },
      ...(assignedRole ? { assignedRole: { kind: 'ROLE' as const, sourceId: assignedRole.sourceId, internalId: assignedRole.internalId } } : {}),
      quantities, ...(row.cells.curv_id?.trim() ? { curveSourceId: row.cells.curv_id.trim() } : {}),
      rawCurves: rawCurvesOf(row), costs: costsOf(tables, row),
      ...(row.cells.rate_type?.trim() ? { rateType: row.cells.rate_type.trim() } : {}),
      ...(row.cells.cost_per_qty_source_type?.trim() ? { costSourceType: row.cells.cost_per_qty_source_type.trim() } : {}),
      ...(row.cells.rsrc_type?.trim() ? { rawResourceType: row.cells.rsrc_type.trim() } : {}),
    };
    let resource: Resource | undefined;
    if (entityKind === 'RESOURCE') {
      const source = resourceSourceById.get(entitySourceId);
      resource = source ? resourceByInternalId.get(source.internalId) : undefined;
      if (skipExpectation === 'XER_ASSIGNMENT_RESOURCE_MISSING') {
        sources.push({ ...sourceBase, unitScale: 'DIRECT_FRACTION' });
        issues.push({ code: 'XER_ASSIGNMENT_RESOURCE_MISSING', table: 'TASKRSRC', line: row.line, sourceId, fallback: 'SKIPPED' });
        continue;
      }
      if (!resource) throw new Error(`XER-resource-index mist '${entitySourceId}' na provenancevalidatie.`);
    } else {
      const role = roleById.get(entitySourceId);
      if (skipExpectation === 'XER_ASSIGNMENT_ROLE_MISSING') {
        sources.push({ ...sourceBase, unitScale: 'DIRECT_FRACTION' });
        issues.push({ code: 'XER_ASSIGNMENT_ROLE_MISSING', table: 'TASKRSRC', line: row.line, sourceId, fallback: 'SKIPPED' });
        continue;
      }
      if (!role) throw new Error(`XER-role-index mist '${entitySourceId}' na provenancevalidatie.`);
      resource = roleResourceById.get(role.internalId);
      if (!resource) {
        const roleRates = roleRatesById.get(role.sourceId) ?? [];
        const flatRate = roleRates.find(rate => rate.costs[0] !== null);
        const availabilitySteps = roleRates.flatMap(rate => rate.effectiveDate && rate.maxUnitsPerTime !== null && rate.maxUnitsPerTime >= 0
          ? [{ from: rate.effectiveDate, maxUnits: rate.maxUnitsPerTime }] : []);
        resource = { id: role.internalId, name: role.name || role.shortName || role.sourceId, type: 'LABOR', description: role.description,
          maxUnits: 0, ...(flatRate?.costs[0] !== null && flatRate?.costs[0] !== undefined ? { costPerHour: flatRate.costs[0] } : {}),
          ...(availabilitySteps.length > 0 ? { availabilitySteps } : {}), ...(role.parentSourceId ? { parentId: `xer-role:${role.parentSourceId}` } : {}) };
        roleResourceById.set(role.internalId, resource);
      }
    }
    const scaled = unitsPerDay(assignmentRate(quantities), resource, context);
    sources.push({ ...sourceBase, unitScale: scaled.scale });
    if (skipExpectation === 'XER_ASSIGNMENT_TASK_MISSING') {
      issues.push({ code: 'XER_ASSIGNMENT_TASK_MISSING', table: 'TASKRSRC', line: row.line, sourceId, fallback: 'SKIPPED' });
      continue;
    }
    const curveSourceId = row.cells.curv_id?.trim() || undefined;
    const curve = curveSourceId ? curveById.get(curveSourceId) : undefined;
    if (curveSourceId && !curve) issues.push({ code: 'XER_ASSIGNMENT_CURVE_MISSING', table: 'TASKRSRC', line: row.line, sourceId, fallback: 'UNIFORM' });
    assignments.push({ id: `xer-assignment:${sourceId}`, taskId: taskSourceId, resourceId: resource.id, unitsPerDay: scaled.value,
      ...(curve?.bestFit && curve.bestFit !== 'UNIFORM' ? { curve: curve.bestFit } : {}) });
  }
  return { assignments, roleResources: Array.from(roleResourceById.values()), sources, issues };
}
