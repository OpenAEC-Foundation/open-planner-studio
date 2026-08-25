/**
 * X6-corpuspoort. De orakelscan leest tabs rechtstreeks uit de bytes en importeert geen
 * productiemodule; de tweede meting gebruikt de echte X6-kern met dezelfde catalogus/partitionering
 * als readXER. Alleen anonieme bytehashes worden gelogd.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
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
  maxCoreMs: number;
  maxParserHeapBytes: number;
  maxCoreHeapBytes: number;
}

const PINS: Readonly<Record<string, Pin>> = {
  a2ef7b35c00d8cf8: { bytes: 1797989, resources: 92, rates: 91, assignments: 3575, materialAssignments: 85, curves: 0, roles: 2, maxParserMs: 1000, maxCoreMs: 1000, maxParserHeapBytes: 67108864, maxCoreHeapBytes: 16777216 },
  '2c1dce175b9f0781': { bytes: 18592333, resources: 179, rates: 55, assignments: 52640, materialAssignments: 10584, curves: 1, roles: 2, maxParserMs: 8000, maxCoreMs: 5000, maxParserHeapBytes: 402653184, maxCoreHeapBytes: 67108864 },
};
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
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
function scan(bytes: Uint8Array): Record<string, number> {
  const text = new TextDecoder().decode(bytes);
  let table = '';
  let fields: string[] = [];
  const rows = new Map<string, Array<Record<string, string>>>();
  for (const line of text.split(/\r\n|\n|\r/)) {
    const values = line.split('\t');
    if (values[0] === '%E') break;
    if (values[0] === '%T') { table = values[1] ?? ''; fields = []; continue; }
    if (values[0] === '%F') { fields = values.slice(1); continue; }
    if (values[0] !== '%R' || fields.length === 0) continue;
    const row: Record<string, string> = {};
    for (let index = 0; index < fields.length; index++) row[fields[index]] = values[index + 1] ?? '';
    rows.set(table, [...(rows.get(table) ?? []), row]);
  }
  const project = rows.get('PROJECT')?.[0]?.proj_id ?? '';
  const resourceTypes = new Map((rows.get('RSRC') ?? []).map(row => [row.rsrc_id, row.rsrc_type?.toLowerCase()]));
  const assignments = (rows.get('TASKRSRC') ?? []).filter(row => !row.proj_id || row.proj_id === project);
  return {
    resources: (rows.get('RSRC') ?? []).length,
    rates: (rows.get('RSRCRATE') ?? []).length + (rows.get('ROLERATE') ?? []).length,
    assignments: assignments.length,
    materialAssignments: assignments.filter(row => resourceTypes.get(row.rsrc_id) === 'rt_mat').length,
    curves: (rows.get('RSRCCURVDATA') ?? []).length,
    roles: (rows.get('ROLES') ?? []).length,
  };
}
function gc(): void {
  const force = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  if (typeof force !== 'function') throw new Error('X6-corpuspoort vereist node --expose-gc');
  force();
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
    eq(`${digest}: onafhankelijke tabscan`, { bytes: content.byteLength, ...scan(content) }, {
      bytes: pin.bytes, resources: pin.resources, rates: pin.rates, assignments: pin.assignments,
      materialAssignments: pin.materialAssignments, curves: pin.curves, roles: pin.roles,
    });
    gc(); const parserHeap = process.memoryUsage().heapUsed; const parserStart = performance.now();
    const tables = parseXerTables(content);
    const parserMs = performance.now() - parserStart; gc(); const parserDelta = Math.max(0, process.memoryUsage().heapUsed - parserHeap);
    const calendarResult = readXerCalendars(tables);
    const projectRow = tables.tables.get('PROJECT')?.rows[0];
    const project = projectRow?.cells.proj_id ?? '';
    const projectCalendar = calendarResult.byId.get(projectRow?.cells.clndr_id ?? '') ?? calendarResult.calendars[0];
    if (!projectCalendar) { eq(`${digest}: projectkalender bestaat`, false, true); continue; }
    const availableCalendarIds = new Set(calendarResult.calendars.map(calendar => calendar.id));
    const catalog = buildXerResourceCatalog(tables, availableCalendarIds);
    gc(); const coreHeap = process.memoryUsage().heapUsed; const coreStart = performance.now();
    const materialized = materializeXerResources(catalog, tables, {
      projectId: project, projectCalendarId: projectCalendar.id, projectHoursPerDay: projectCalendar.hoursPerDay,
      availableCalendarIds, calendarHoursPerDay: new Map(calendarResult.calendars.map(calendar => [calendar.id, calendar.hoursPerDay])),
      taskIds: new Set((tables.tables.get('TASK')?.rows ?? []).filter(row => row.cells.proj_id === project).map(row => row.cells.task_id)),
    }, indexXerTaskResourceRows(tables).get(project) ?? []);
    const coreMs = performance.now() - coreStart; gc(); const coreDelta = Math.max(0, process.memoryUsage().heapUsed - coreHeap);
    const actual = {
      resources: catalog.rows.resources.length, rates: catalog.rows.rates.length, assignments: materialized.assignments.length,
      materialAssignments: materialized.assignments.filter(assignment => materialized.resources.find(resource => resource.id === assignment.resourceId)?.type === 'MATERIAL').length,
      curves: catalog.rows.curves.length, roles: catalog.rows.roles.length,
    };
    eq(`${digest}: productiecatalogus en lineaire projectprojectie volgen het onafhankelijke orakel`, actual, scan(content));
    checks += 4;
    if (parserMs > pin.maxParserMs) diffs.push(`${digest}: parser ${parserMs.toFixed(1)} ms boven ${pin.maxParserMs} ms`);
    if (coreMs > pin.maxCoreMs) diffs.push(`${digest}: X6-kern ${coreMs.toFixed(1)} ms boven ${pin.maxCoreMs} ms`);
    if (parserDelta > pin.maxParserHeapBytes) diffs.push(`${digest}: parserheap ${parserDelta} boven ${pin.maxParserHeapBytes}`);
    if (coreDelta > pin.maxCoreHeapBytes) diffs.push(`${digest}: kernheap ${coreDelta} boven ${pin.maxCoreHeapBytes}`);
    console.log(`. X6 corpus ${digest}: parser ${parserMs.toFixed(1)} ms/${parserDelta} B; kern ${coreMs.toFixed(1)} ms/${coreDelta} B`);
  }
}
if (diffs.length) { console.error(`XX X6 corpus (${checks} checks)\n${diffs.join('\n')}`); process.exitCode = 1; }
else console.log(`OK X6 corpus (${checks} checks)`);
