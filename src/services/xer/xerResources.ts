/** Zelfstandige XER-resourcekern. Broncatalogus is bestandsbreed; projectprojecties blijven mutable. */

import type { Resource, ResourceType } from '@/types/resource';
import type {
  XerEntityIdentity, XerResourceIssue, XerResourceRateSource, XerResourceReadContext,
  XerResourceReadResult, XerResourceSource, XerRoleSource,
} from './xerResourceTypes';
import { parseXerNumber, XerImportError, type XerRow, type XerTables } from './xerTables';
import { readXerResourceCurves } from './xerResourceCurves';
import { readXerResourceAssignments } from './xerResourceAssignments';

export type {
  XerEntityIdentity, XerResourceIssue, XerResourceCurveSource, XerResourceRateSource,
  XerResourceReadContext, XerResourceReadResult, XerResourceSource, XerRoleSource, XerTaskResourceSource,
} from './xerResourceTypes';

export interface XerResourceCatalog {
  resources: Resource[];
  identities: XerEntityIdentity[];
  rows: {
    resources: XerResourceSource[];
    roles: XerRoleSource[];
    rates: XerResourceRateSource[];
    curves: ReturnType<typeof readXerResourceCurves>['sources'];
    assignments: XerRow[];
  };
  issues: XerResourceIssue[];
}

function resourceInternalId(sourceId: string): string { return `xer-resource:${sourceId}`; }
function roleInternalId(sourceId: string): string { return `xer-role:${sourceId}`; }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function numberOf(tables: XerTables, row: XerRow, table: 'RSRC' | 'RSRCRATE' | 'ROLERATE', field: string): number | null {
  try { return parseXerNumber(row.cells[field] ?? '', tables.numberFormat); } catch (error) {
    if (error instanceof XerImportError) {
      throw new XerImportError(error.xerCode, error.message,
        { table, field, line: row.line, encoding: tables.report.encoding });
    }
    throw error;
  }
}
function assertUniqueSourceIds(rows: readonly XerRow[], table: 'RSRC' | 'ROLES', field: string): void {
  const firstLineById = new Map<string, number>();
  for (const row of rows) {
    const sourceId = row.cells[field]?.trim() ?? '';
    if (!sourceId) throw new XerImportError('XER_MISSING_REQUIRED_VALUE',
      `${table}.${field} bevat een lege bronidentiteit op regel ${row.line}.`,
      { table, field, missingValues: [field], line: row.line });
    const firstLine = firstLineById.get(sourceId);
    if (firstLine !== undefined) throw new XerImportError('XER_DUPLICATE_ID',
      `${table}.${field} bevat dubbele id '${sourceId}' op regels ${firstLine} en ${row.line}.`,
      { table, field, line: row.line, lines: [firstLine, row.line] });
    firstLineById.set(sourceId, row.line);
  }
}
function effectiveDate(raw: string): string | undefined { return raw.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/)?.[1]; }
function resourceType(row: XerRow, sourceId: string, issues: XerResourceIssue[]): ResourceType {
  const raw = row.cells.rsrc_type?.trim().toLowerCase() ?? '';
  if (raw === 'rt_labor') return 'LABOR';
  if (raw === 'rt_mat') return 'MATERIAL';
  if (raw === 'rt_equip') {
    issues.push({ code: 'XER_RESOURCE_NONLABOR_FALLBACK', table: 'RSRC', line: row.line, sourceId, fallback: 'EQUIPMENT' });
    return 'EQUIPMENT';
  }
  issues.push({ code: 'XER_RESOURCE_TYPE_FALLBACK', table: 'RSRC', line: row.line, sourceId, fallback: 'LABOR' });
  return 'LABOR';
}
function mapRoles(rows: readonly XerRow[], roleIds: ReadonlySet<string>, issues: XerResourceIssue[]): {
  identities: XerEntityIdentity[]; sources: XerRoleSource[];
} {
  const identities: XerEntityIdentity[] = [];
  const sources: XerRoleSource[] = [];
  for (const row of rows) {
    const sourceId = row.cells.role_id.trim();
    const parentSourceId = row.cells.parent_role_id?.trim() || undefined;
    if (parentSourceId && !roleIds.has(parentSourceId)) issues.push({ code: 'XER_ROLE_PARENT_MISSING', table: 'ROLES', line: row.line, sourceId, fallback: 'RELATION_OMITTED' });
    identities.push({ kind: 'ROLE', sourceId, internalId: roleInternalId(sourceId), line: row.line });
    sources.push({ rawRow: row, sourceId, internalId: roleInternalId(sourceId), line: row.line,
      name: row.cells.role_name?.trim() ?? '', shortName: row.cells.role_short_name?.trim() ?? '', description: row.cells.role_descr ?? '',
      ...(parentSourceId && roleIds.has(parentSourceId) ? { parentSourceId } : {}) });
  }
  return { identities, sources };
}
function readRatesForKind(tables: XerTables, kind: 'RESOURCE' | 'ROLE', ownerIds: ReadonlySet<string>, issues: XerResourceIssue[]): XerResourceRateSource[] {
  const table = kind === 'RESOURCE' ? 'RSRCRATE' as const : 'ROLERATE' as const;
  const idField = kind === 'RESOURCE' ? 'rsrc_rate_id' : 'role_rate_id';
  const entityField = kind === 'RESOURCE' ? 'rsrc_id' : 'role_id';
  return (tables.tables.get(table)?.rows ?? []).map(row => {
    const sourceId = row.cells[idField]?.trim() || `line-${row.line}`;
    const entitySourceId = row.cells[entityField]?.trim() ?? '';
    if (!ownerIds.has(entitySourceId)) issues.push({ code: kind === 'RESOURCE' ? 'XER_RESOURCE_RATE_OWNER_MISSING' : 'XER_ROLE_RATE_OWNER_MISSING', table, line: row.line, sourceId, fallback: 'RELATION_OMITTED' });
    const costs: XerResourceRateSource['costs'] = [
      numberOf(tables, row, table, 'cost_per_qty'), numberOf(tables, row, table, 'cost_per_qty2'),
      numberOf(tables, row, table, 'cost_per_qty3'), numberOf(tables, row, table, 'cost_per_qty4'), numberOf(tables, row, table, 'cost_per_qty5'),
    ];
    const date = effectiveDate(row.cells.start_date ?? '');
    return { rawRow: row, sourceId, internalId: `xer-${kind === 'RESOURCE' ? 'resource' : 'role'}-rate:${sourceId}:${row.line}`,
      entity: { kind, sourceId: entitySourceId, internalId: kind === 'RESOURCE' ? resourceInternalId(entitySourceId) : roleInternalId(entitySourceId) },
      line: row.line, ...(date ? { effectiveDate: date } : {}), maxUnitsPerTime: numberOf(tables, row, table, 'max_qty_per_hr'), costs };
  });
}
function freezeArray<T>(items: T[]): T[] { Object.freeze(items); return items; }

/** Bouw één bestandsbrede, immutable broncatalogus. TASKRSRC-rijen worden niet hier geprojecteerd. */
export function buildXerResourceCatalog(tables: XerTables, availableCalendarIds: ReadonlySet<string>): XerResourceCatalog {
  const resourceRows = tables.tables.get('RSRC')?.rows ?? [];
  const roleRows = tables.tables.get('ROLES')?.rows ?? [];
  assertUniqueSourceIds(resourceRows, 'RSRC', 'rsrc_id');
  assertUniqueSourceIds(roleRows, 'ROLES', 'role_id');
  const issues: XerResourceIssue[] = [];
  const resourceIds = new Set(resourceRows.map(row => row.cells.rsrc_id.trim()));
  const roleIds = new Set(roleRows.map(row => row.cells.role_id.trim()));
  const rates = [...readRatesForKind(tables, 'RESOURCE', resourceIds, issues), ...readRatesForKind(tables, 'ROLE', roleIds, issues)]
    .sort((left, right) => compareText(left.entity.kind, right.entity.kind) || compareText(left.entity.sourceId, right.entity.sourceId) || compareText(left.effectiveDate ?? '', right.effectiveDate ?? '') || left.line - right.line);
  const ratesByResource = new Map<string, XerResourceRateSource[]>();
  for (const rate of rates) if (rate.entity.kind === 'RESOURCE') ratesByResource.set(rate.entity.sourceId, [...(ratesByResource.get(rate.entity.sourceId) ?? []), rate]);
  const unitById = new Map((tables.tables.get('UMEASURE')?.rows ?? []).map(row => [row.cells.unit_id?.trim() ?? '', row.cells.unit_abbrev?.trim() || row.cells.unit_name?.trim() || '']));
  const identities: XerEntityIdentity[] = [];
  const sources: XerResourceSource[] = [];
  const resources: Resource[] = [];
  for (const row of resourceRows) {
    const sourceId = row.cells.rsrc_id.trim(); const internalId = resourceInternalId(sourceId);
    identities.push({ kind: 'RESOURCE', sourceId, internalId, line: row.line });
    const parentSourceId = row.cells.parent_rsrc_id?.trim() || undefined;
    const defaultRoleSourceId = row.cells.role_id?.trim() || undefined;
    const calendarSourceId = row.cells.clndr_id?.trim() || undefined;
    if (parentSourceId && !resourceIds.has(parentSourceId)) issues.push({ code: 'XER_RESOURCE_PARENT_MISSING', table: 'RSRC', line: row.line, sourceId, fallback: 'RELATION_OMITTED' });
    if (defaultRoleSourceId && !roleIds.has(defaultRoleSourceId)) issues.push({ code: 'XER_RESOURCE_DEFAULT_ROLE_MISSING', table: 'RSRC', line: row.line, sourceId, fallback: 'RELATION_OMITTED' });
    if (calendarSourceId && !availableCalendarIds.has(calendarSourceId)) issues.push({ code: 'XER_RESOURCE_CALENDAR_MISSING', table: 'RSRC', line: row.line, sourceId, fallback: 'PROJECT_CALENDAR' });
    const relatedRates = ratesByResource.get(sourceId) ?? [];
    const flatRate = relatedRates.find(rate => rate.costs[0] !== null);
    const sourceMaxUnits = numberOf(tables, row, 'RSRC', 'def_qty_per_hr');
    const availabilitySteps = relatedRates.flatMap(rate => rate.effectiveDate && rate.maxUnitsPerTime !== null && rate.maxUnitsPerTime >= 0 ? [{ from: rate.effectiveDate, maxUnits: rate.maxUnitsPerTime }] : []);
    const unitSourceId = row.cells.unit_id?.trim() || undefined;
    const unitOfMeasure = unitSourceId ? unitById.get(unitSourceId) : undefined;
    resources.push({ id: internalId, name: row.cells.rsrc_name?.trim() || row.cells.rsrc_short_name?.trim() || sourceId,
      type: resourceType(row, sourceId, issues), description: row.cells.rsrc_notes ?? '', maxUnits: sourceMaxUnits !== null && sourceMaxUnits >= 0 ? sourceMaxUnits : 0,
      ...(calendarSourceId && availableCalendarIds.has(calendarSourceId) ? { calendarId: calendarSourceId } : {}), ...(unitOfMeasure ? { unitOfMeasure } : {}),
      ...(flatRate?.costs[0] !== null && flatRate?.costs[0] !== undefined ? { costPerHour: flatRate.costs[0] } : {}), ...(availabilitySteps.length ? { availabilitySteps } : {}),
      ...(parentSourceId && resourceIds.has(parentSourceId) ? { parentId: resourceInternalId(parentSourceId) } : {}) });
    sources.push({ rawRow: row, sourceId, internalId, line: row.line, rawType: row.cells.rsrc_type?.trim() ?? '',
      ...(parentSourceId && resourceIds.has(parentSourceId) ? { parentSourceId } : {}), ...(calendarSourceId ? { calendarSourceId } : {}),
      ...(defaultRoleSourceId && roleIds.has(defaultRoleSourceId) ? { defaultRoleSourceId } : {}), ...(unitSourceId ? { unitSourceId } : {}) });
  }
  const roles = mapRoles(roleRows, roleIds, issues);
  const curves = readXerResourceCurves(tables);
  issues.push(...curves.issues);
  return Object.freeze({ resources: freezeArray(resources), identities: freezeArray([...identities, ...roles.identities]),
    rows: Object.freeze({ resources: freezeArray(sources), roles: freezeArray(roles.sources), rates: freezeArray(rates), curves: freezeArray(curves.sources), assignments: freezeArray([...(tables.tables.get('TASKRSRC')?.rows ?? [])]) }),
    issues: freezeArray(issues) });
}

/** Projectbound: kopieert uitsluitend de mutable projectprojectie en leest alleen zijn lineair gevonden TASKRSRC-rijen. */
export function materializeXerResources(catalog: XerResourceCatalog, tables: XerTables, context: XerResourceReadContext, assignmentRows: readonly XerRow[]): XerResourceReadResult {
  const resources = structuredClone(catalog.resources) as Resource[];
  const assignments = readXerResourceAssignments(tables, context, resources, catalog.rows.resources, catalog.rows.roles, catalog.rows.rates, catalog.rows.curves, assignmentRows);
  return { resources: [...resources, ...assignments.roleResources], assignments: assignments.assignments, identities: [...catalog.identities],
    sources: { resources: [...catalog.rows.resources], roles: [...catalog.rows.roles], rates: [...catalog.rows.rates], curves: [...catalog.rows.curves], assignments: assignments.sources },
    issues: [...catalog.issues, ...assignments.issues] };
}
