/**
 * X6-corpuspoort. Het orakel leest %T/%F/%R direct uit de oorspronkelijke bytes, zonder een
 * productiemodule te importeren. Pas daarna mag de productiecatalogus worden vergeleken.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { readXER } from '@/services/xer/xerReader';
import { readXerCalendars } from '@/services/xer/xerCalendarData';
import { indexXerTaskResourceRows } from '@/services/xer/xerResourceAssignments';
import { buildXerResourceCatalog, materializeXerResources } from '@/services/xer/xerResources';
import { parseXerTables } from '@/services/xer/xerTables';

interface Pin {
  bytes: number;
  resources: number;
  rates: number;
  assignments: number;
  materialAssignments: number;
  curves: number;
  roles: number;
  maxParserMs: number;
  maxCatalogBuildMs: number;
  maxMaterializationMs: number;
  maxEndToEndMs: number;
  maxParserHeapBytes: number;
  maxCatalogBuildHeapBytes: number;
  maxMaterializationHeapBytes: number;
  maxEndToEndHeapBytes: number;
}

const PINS: Readonly<Record<string, Pin>> = {
  a2ef7b35c00d8cf8: {
    bytes: 1797989, resources: 92, rates: 91, assignments: 3575, materialAssignments: 85, curves: 0, roles: 2,
    maxParserMs: 1000, maxCatalogBuildMs: 1000, maxMaterializationMs: 1000, maxEndToEndMs: 3000,
    maxParserHeapBytes: 67108864, maxCatalogBuildHeapBytes: 33554432, maxMaterializationHeapBytes: 33554432, maxEndToEndHeapBytes: 134217728,
  },
  '2c1dce175b9f0781': {
    bytes: 18592333, resources: 179, rates: 55, assignments: 52640, materialAssignments: 10584, curves: 1, roles: 2,
    maxParserMs: 8000, maxCatalogBuildMs: 5000, maxMaterializationMs: 5000, maxEndToEndMs: 16000,
    maxParserHeapBytes: 402653184, maxCatalogBuildHeapBytes: 134217728, maxMaterializationHeapBytes: 134217728, maxEndToEndHeapBytes: 805306368,
  },
};

type DirectRow = Record<string, string>;
interface DirectRate {
  sourceId: string;
  kind: 'RESOURCE' | 'ROLE';
  entitySourceId: string;
  effectiveDate?: string;
  maxUnitsPerTime: number | null;
  costs: Array<number | null>;
}
interface DirectCurve { sourceId: string; rawPoints: string[]; numericPoints?: number[]; }
interface DirectScan {
  projectId: string;
  resources: number;
  rates: DirectRate[];
  assignments: Array<{ sourceId: string; taskId: string; entityKind: 'RESOURCE' | 'ROLE'; entitySourceId: string }>;
  materialAssignments: number;
  curves: DirectCurve[];
  roles: number;
  resourceCalendars: Array<{ sourceId: string; calendarSourceId?: string }>;
  rawAssignmentIds: string[];
}

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function present<T>(label: string, value: T | null | undefined): value is T {
  checks++;
  if (value === null || value === undefined) {
    diffs.push(`${label}: verplichte corpusdata ontbreekt`);
    return false;
  }
  return true;
}
function hash(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex').slice(0, 16); }
function files(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...files(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xer')) found.push(path);
  }
  return found;
}
function gc(): void {
  const force = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  if (typeof force !== 'function') throw new Error('X6-corpuspoort vereist node --expose-gc');
  force();
}
function measure<T>(work: () => T): { value: T; ms: number; heapBytes: number } {
  const before = process.memoryUsage().heapUsed;
  const start = performance.now();
  const value = work();
  const ms = performance.now() - start;
  // Alle vier fasen houden hun resultaat vast voor het onafhankelijke orakel. Daarom is dit een
  // live-heapdelta; een GC per fase zou die legitiem live grafiek scannen in plaats van meten.
  return { value, ms, heapBytes: Math.max(0, process.memoryUsage().heapUsed - before) };
}
function separator(raw: string, family: 'decimal' | 'group'): '.' | ',' | undefined {
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;
  if (value === '.' || value === 'period' || value === `d${family === 'decimal' ? 's' : 'g'}_period`) return '.';
  if (value === ',' || value === 'comma' || value === `d${family === 'decimal' ? 's' : 'g'}_comma`) return ',';
  throw new Error(`Onafhankelijke scanner kan CURRTYPE-token ${raw} niet duiden`);
}
function numberFormat(rows: ReadonlyMap<string, DirectRow[]>, currencyCode: string): { decimal: '.' | ','; group: '.' | ',' | null } {
  const currency = (rows.get('CURRTYPE') ?? []).find(row => row.curr_short_name?.trim().toLowerCase() === currencyCode.trim().toLowerCase());
  if (!currency) return { decimal: '.', group: null };
  const decimal = separator(currency.decimal_symbol || currency.decimal_symbol_type || '', 'decimal');
  const group = separator(currency.digit_group_symbol || currency.digit_group_symbol_type || '', 'group');
  if (!decimal || !group || decimal === group) throw new Error('Onafhankelijke scanner mist geldige CURRTYPE-separators');
  return { decimal, group };
}
function sourceNumber(raw: string | undefined, format: { decimal: '.' | ','; group: '.' | ',' | null }): number | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const normalized = (format.group ? value.split(format.group).join('') : value).replace(format.decimal, '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Onafhankelijke scanner kreeg ongeldig getal ${JSON.stringify(value)}`);
  return parsed;
}
/** Onafhankelijke tegenhanger van `normalizeCurveValues` (contourEngine.ts): 21 eindige,
 *  niet-negatieve punten met een positieve som over de indices 1..20, of `undefined`. Sinds de
 *  contour-engine-etappe is dit de ENIGE validatie die de productiecode nog doet (geen
 *  eigen XER-curve-familie-best-fit meer — die is verwijderd, zie xerResourceCurves.ts). */
function curveNumericPoints(points: readonly string[], format: { decimal: '.' | ','; group: '.' | ',' | null }): number[] | undefined {
  if (points.length !== 21) return undefined;
  const values: number[] = [];
  for (const point of points) {
    const value = sourceNumber(point, format);
    if (value === null || !Number.isFinite(value) || value < 0) return undefined;
    values.push(value);
  }
  const sum = values.slice(1).reduce((total, point) => total + point, 0);
  return sum > 0 ? values : undefined;
}
function scan(bytes: Uint8Array): DirectScan {
  const text = new TextDecoder().decode(bytes);
  const rows = new Map<string, DirectRow[]>();
  let table = '';
  let fields: string[] = [];
  let currencyCode = '';
  for (const line of text.split(/\r\n|\n|\r/)) {
    const values = line.split('\t');
    if (values[0] === 'ERMHDR') currencyCode = values[8] ?? '';
    if (values[0] === '%E') break;
    if (values[0] === '%T') { table = values[1] ?? ''; fields = []; continue; }
    if (values[0] === '%F') { fields = values.slice(1).map(field => field.trim().toLowerCase()); continue; }
    if (values[0] !== '%R' || fields.length === 0) continue;
    const row: DirectRow = {};
    fields.forEach((field, index) => { row[field] = values[index + 1] ?? ''; });
    const tableRows = rows.get(table);
    if (tableRows) tableRows.push(row);
    else rows.set(table, [row]);
  }
  const format = numberFormat(rows, currencyCode);
  const projectId = rows.get('PROJECT')?.[0]?.proj_id ?? '';
  const resources = rows.get('RSRC') ?? [];
  const roles = rows.get('ROLES') ?? [];
  const resourceTypes = new Map(resources.map(row => [row.rsrc_id, row.rsrc_type?.trim().toLowerCase()]));
  const assignmentRows = (rows.get('TASKRSRC') ?? []).filter(row => row.proj_id === projectId);
  const rateRows = [
    ...(rows.get('RSRCRATE') ?? []).map(row => ({ row, kind: 'RESOURCE' as const, id: 'rsrc_rate_id', entity: 'rsrc_id' })),
    ...(rows.get('ROLERATE') ?? []).map(row => ({ row, kind: 'ROLE' as const, id: 'role_rate_id', entity: 'role_id' })),
  ];
  return {
    projectId,
    resources: resources.length,
    rates: rateRows.map(({ row, kind, id, entity }) => ({
      sourceId: row[id] || '', kind, entitySourceId: row[entity] || '',
      ...(row.start_date?.trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ? { effectiveDate: row.start_date.trim().slice(0, 10) } : {}),
      maxUnitsPerTime: sourceNumber(row.max_qty_per_hr, format),
      costs: ['cost_per_qty', 'cost_per_qty2', 'cost_per_qty3', 'cost_per_qty4', 'cost_per_qty5'].map(field => sourceNumber(row[field], format)),
    })).sort((left, right) => left.kind.localeCompare(right.kind) || left.entitySourceId.localeCompare(right.entitySourceId) || left.sourceId.localeCompare(right.sourceId)),
    assignments: assignmentRows.map(row => ({ sourceId: row.taskrsrc_id || '', taskId: row.task_id || '', entityKind: row.rsrc_id?.trim() ? 'RESOURCE' as const : 'ROLE' as const, entitySourceId: row.rsrc_id?.trim() || row.role_id?.trim() || '' })),
    materialAssignments: assignmentRows.filter(row => resourceTypes.get(row.rsrc_id) === 'rt_mat').length,
    curves: (rows.get('RSRCCURVDATA') ?? []).map(row => {
      const rawPoints = Array.from({ length: 21 }, (_, index) => row[`pct_usage_${index}`] ?? '');
      const numericPoints = curveNumericPoints(rawPoints, format);
      return { sourceId: row.curv_id || '', rawPoints, ...(numericPoints ? { numericPoints } : {}) };
    }),
    roles: roles.length,
    resourceCalendars: resources.map(row => ({ sourceId: row.rsrc_id || '', ...(row.clndr_id?.trim() ? { calendarSourceId: row.clndr_id.trim() } : {}) })),
    rawAssignmentIds: (rows.get('TASKRSRC') ?? []).map(row => row.taskrsrc_id || ''),
  };
}
function exceeds(label: string, actual: number, maximum: number): void {
  checks++;
  if (actual > maximum) diffs.push(`${label}: ${actual.toFixed(1)} boven ${maximum}`);
}

const corpus = process.env.OPS_XER_CORPUS;
if (!corpus) console.log('OK X6 corpus: OPS_XER_CORPUS niet gezet — corpuspins overgeslagen');
else if (!existsSync(corpus)) eq('X6 corpusmap bestaat', false, true);
else {
  const targets = new Map<string, Uint8Array>();
  for (const file of files(corpus)) {
    const content = new Uint8Array(readFileSync(file));
    const digest = hash(content);
    if (PINS[digest]) targets.set(digest, content);
    if (targets.size === Object.keys(PINS).length) break;
  }
  for (const [digest, pin] of Object.entries(PINS)) {
    const content = targets.get(digest);
    eq(`${digest}: openbare corpuspin aanwezig`, Boolean(content), true);
    if (!content) continue;
    const source = scan(content);
    eq(`${digest}: onafhankelijke bytescan telt de volledige X6-bron`, { bytes: content.byteLength, resources: source.resources, rates: source.rates.length, assignments: source.assignments.length, materialAssignments: source.materialAssignments, curves: source.curves.length, roles: source.roles }, { bytes: pin.bytes, resources: pin.resources, rates: pin.rates, assignments: pin.assignments, materialAssignments: pin.materialAssignments, curves: pin.curves, roles: pin.roles });
    gc();
    const parser = measure(() => parseXerTables(content));
    const tables = parser.value;
    const calendarResult = readXerCalendars(tables);
    const projectRow = tables.tables.get('PROJECT')?.rows[0];
    const project = projectRow?.cells.proj_id;
    const projectCalendar = projectRow ? calendarResult.byId.get(projectRow.cells.clndr_id ?? '') ?? calendarResult.calendars[0] : undefined;
    if (!present(`${digest}: projectrij`, projectRow) || !present(`${digest}: project-id`, project) || !present(`${digest}: projectkalender`, projectCalendar)) continue;
    const availableCalendarIds = new Set(calendarResult.calendars.map(calendar => calendar.id));
    const catalogBuild = measure(() => buildXerResourceCatalog(tables, availableCalendarIds));
    const catalog = catalogBuild.value;
    const materialization = measure(() => materializeXerResources(catalog, tables, {
      projectId: project, projectCalendarId: projectCalendar.id, projectHoursPerDay: projectCalendar.hoursPerDay,
      availableCalendarIds, calendarHoursPerDay: new Map(calendarResult.calendars.map(calendar => [calendar.id, calendar.hoursPerDay])),
      taskIds: new Set((tables.tables.get('TASK')?.rows ?? []).filter(row => row.cells.proj_id === project).map(row => row.cells.task_id)),
    }, indexXerTaskResourceRows(tables).get(project) ?? []));
    const materialized = materialization.value;
    const endToEnd = measure(() => readXER(content));
    const catalogRates = catalog.rows.rates.map(rate => ({ sourceId: rate.sourceId, kind: rate.entity.kind, entitySourceId: rate.entity.sourceId, ...(rate.effectiveDate ? { effectiveDate: rate.effectiveDate } : {}), maxUnitsPerTime: rate.maxUnitsPerTime, costs: [...rate.costs] })).sort((left, right) => left.kind.localeCompare(right.kind) || left.entitySourceId.localeCompare(right.entitySourceId) || left.sourceId.localeCompare(right.sourceId));
    eq(`${digest}: exacte rates en ingangsdatums volgen de directe tabscan`, catalogRates, source.rates);
    eq(`${digest}: resourcekalenderverwijzingen volgen de directe RSRC-scan`, catalog.rows.resources.map(row => ({ sourceId: row.sourceId, ...(row.calendarSourceId ? { calendarSourceId: row.calendarSourceId } : {}) })), source.resourceCalendars);
    eq(`${digest}: projectpartitie bevat alleen de directe TASKRSRC-projectview`, materialized.sources.assignments.map(row => ({ sourceId: row.sourceId, taskId: row.taskSourceId, entityKind: row.entity.kind, entitySourceId: row.entity.sourceId })), source.assignments);
    eq(`${digest}: role-only TASKRSRC blijft role-only`, materialized.sources.assignments.filter(row => row.entity.kind === 'ROLE').map(row => row.sourceId), source.assignments.filter(row => row.entityKind === 'ROLE').map(row => row.sourceId));
    eq(`${digest}: 21 curvepunten en onafhankelijke normalisatievalidatie blijven behouden`, catalog.rows.curves.map(curve => ({ sourceId: curve.sourceId, rawPoints: [...curve.rawPoints], ...(curve.numericPoints ? { numericPoints: [...curve.numericPoints] } : {}) })), source.curves);
    const rawRowByAssignmentId = new Map(catalog.rows.assignments.map(row => [row.cells.taskrsrc_id, row]));
    eq(`${digest}: iedere projectbron behoudt de catalogus-raw-rowidentiteit`, materialized.sources.assignments.every(sourceAssignment => sourceAssignment.rawRow === rawRowByAssignmentId.get(sourceAssignment.sourceId)), true);
    eq(`${digest}: retained raw TASKRSRC-telling is volledig vóór projectfilter`, catalog.rows.assignments.map(row => row.cells.taskrsrc_id), source.rawAssignmentIds);
    exceeds(`${digest}: parser ms`, parser.ms, pin.maxParserMs);
    exceeds(`${digest}: catalogusbouw ms`, catalogBuild.ms, pin.maxCatalogBuildMs);
    exceeds(`${digest}: materialisatie ms`, materialization.ms, pin.maxMaterializationMs);
    exceeds(`${digest}: end-to-end readXER ms`, endToEnd.ms, pin.maxEndToEndMs);
    exceeds(`${digest}: parser heap`, parser.heapBytes, pin.maxParserHeapBytes);
    exceeds(`${digest}: catalogusbouw heap`, catalogBuild.heapBytes, pin.maxCatalogBuildHeapBytes);
    exceeds(`${digest}: materialisatie heap`, materialization.heapBytes, pin.maxMaterializationHeapBytes);
    exceeds(`${digest}: end-to-end readXER heap`, endToEnd.heapBytes, pin.maxEndToEndHeapBytes);
    console.log(`. X6 corpus ${digest}: parser ${parser.ms.toFixed(1)} ms/${parser.heapBytes} B; catalogusbouw ${catalogBuild.ms.toFixed(1)} ms/${catalogBuild.heapBytes} B; materialisatie ${materialization.ms.toFixed(1)} ms/${materialization.heapBytes} B; end-to-end ${endToEnd.ms.toFixed(1)} ms/${endToEnd.heapBytes} B`);
  }
}
if (diffs.length) { console.error(`XX X6 corpus (${checks} checks)\n${diffs.join('\n')}`); process.exitCode = 1; }
else console.log(`OK X6 corpus (${checks} checks)`);
