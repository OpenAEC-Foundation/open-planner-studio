// Taak T18 — de tien LEESTOOLS (spec §Tool-set Lezen, regels 67-80). Draait headless tegen de ECHTE
// Zustand-store: een realistisch project via `generateBenchmarkProject` in de store geladen +
// runCPM, plus enkele kleine gecontroleerde projecten voor de precisie-cases (wezen, cascade,
// stale-histogram). Per tool minstens één INHOUDELIJKE case (waarde-asserts, geen bestaan-check).
//
// Aan het eind: de payload-meting (geen poort) — JSON-groottes van overview/list_tasks(p1)/
// histogram(week) op het 2500-taken-benchmarkproject, gerapporteerd via console.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();

/** Verse leest-ctx (drift/pauze niet relevant voor leestools). */
function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    ...over,
  });
}

/** Roep een geregistreerde tool op naam aan en verwacht ok:true; geeft de `data` terug (getypeerd los). */
function callOk(name: string, args: unknown = {}): any {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} niet geregistreerd`);
  const res = tool!.handler(args, makeCtx()) as McpToolResult;
  assert(res.ok, `tool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data;
}

/** Roep een tool aan en verwacht een fout met een specifieke code. */
function callErr(name: string, args: unknown = {}): McpToolResult {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} niet geregistreerd`);
  return tool!.handler(args, makeCtx()) as McpToolResult;
}

/** Laad het benchmark-project in de store + runCPM. Retourneert de gegenereerde data (voor id's). */
function loadBenchmark(size: number) {
  const gen = generateBenchmarkProject(size);
  S().applyLoadedProject(gen, { filePath: null, recompute: true });
  return gen;
}

const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];
/** Schoon ma-vr-project vanaf 2026-06-01 (maandag), zonder feestdagen. */
function cleanProject(): void {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: [...CLEAN_WORKDAYS], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Schoon testproject' });
}

// =================================================================================================
// Registratie: alle leestools aanwezig met planner_-prefix + readOnly-annotatie
// =================================================================================================
test('registratie: alle leestools met planner_-prefix, description en readOnlyHint:true', () => {
  const names = [
    'planner_get_project_info', 'planner_get_project_overview', 'planner_list_tasks',
    'planner_get_task', 'planner_get_critical_path', 'planner_list_resources',
    'planner_get_resource_histogram', 'planner_get_calendars', 'planner_compare_baseline',
    'planner_analyze_delay', 'planner_inspect_xer_provenance',
  ];
  for (const n of names) {
    const t = getTool(n);
    assert(!!t, `tool ${n} ontbreekt in de registry`);
    assert(t!.name.startsWith('planner_'), `${n} mist de prefix`);
    assert(t!.description.trim().length > 20, `${n} mist een zinvolle description`);
    assertEq(t!.annotations.readOnlyHint, true, `${n} moet readOnlyHint:true dragen`);
    assertEq(t!.annotations.openWorldHint, false, `${n} moet openWorldHint:false dragen`);
    assertEq(t!.kind, 'read', `${n} moet kind:'read' hebben`);
  }
});

// =================================================================================================
// 1) planner_get_project_info — statistieken kloppen tegen de store
// =================================================================================================
test('get_project_info: aantallen kloppen exact met de store', () => {
  loadBenchmark(100);
  const s = S();
  const data = callOk('planner_get_project_info');
  const leaves = s.tasks.filter((t) => t.childIds.length === 0).length;
  const summaries = s.tasks.filter((t) => t.childIds.length > 0).length;
  const milestones = s.tasks.filter((t) => t.isMilestone).length;
  assertEq(data.statistics.totalTasks, s.tasks.length, 'totalTasks');
  assertEq(data.statistics.leafTasks, leaves, 'leafTasks');
  assertEq(data.statistics.summaryTasks, summaries, 'summaryTasks');
  assertEq(data.statistics.milestones, milestones, 'milestones');
  assertEq(data.statistics.relations, s.sequences.length, 'relations');
  assertEq(data.statistics.resources, s.resources.length, 'resources');
  assertEq(data.statistics.assignments, s.assignments.length, 'assignments');
  assertEq(data.schedule.scheduleStale, false, 'na runCPM is scheduleStale false');
  assertEq(data.schedule.projectEnd, s.cpmResult!.projectEnd, 'projectEnd spiegelt cpmResult');
  assertEq(data.calendar.id, s.calendar.id, 'kalender-samenvatting id');
  assertEq(data.project.name, s.project.name, 'projectnaam');
});

// =================================================================================================
// 2) planner_get_project_overview — volledige relatiegraaf, verkorte notatie
// =================================================================================================
test('get_project_overview: elke taak aanwezig; relatiegraaf compleet; verkorte notatie klopt', () => {
  cleanProject();
  // A (2d) → B (3d, FS+2d) ; C los.
  const a = S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const b = S().addTask({ name: 'B', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().addTask({ name: 'C', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const seq = S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 2 });
  S().runCPM();

  const data = callOk('planner_get_project_overview');
  assertEq(data.taskCount, S().tasks.length, 'taskCount');
  assertEq(data.relationCount, 1, 'relationCount');
  // Som van alle `rels`-arrays == aantal relaties (elke relatie precies één keer, bij de voorganger).
  const totalRels = data.tasks.reduce((acc: number, r: any) => acc + (r.rels ? r.rels.length : 0), 0);
  assertEq(totalRels, 1, 'relatiegraaf compleet: som van rels == relationCount');
  const aRow = data.tasks.find((r: any) => r.name === 'A');
  const bWbs = S().tasks.find((t) => t.id === b)!.wbsCode;
  // De notatie draagt sinds auditbevinding H6 het sequence-id als `#`-suffix, zodat
  // remove_dependencies (die op sequence-id's werkt) uit deze ENE call gevoed kan worden.
  assertEq(aRow.rels, [`→${bWbs} FS+2d #${seq}`], 'verkorte relatienotatie "→<wbs> FS+2d #<seqId>"');
  assertEq(aRow.id, a, 'elke overview-rij draagt het stabiele Task.id (H6)');
});

// =================================================================================================
// 3) planner_list_tasks — paginering (total/has_more/next_offset over 2 pagina's)
// =================================================================================================
test('list_tasks: paginering klopt over twee pagina\'s', () => {
  loadBenchmark(100);
  const total = S().tasks.length;
  const p1 = callOk('planner_list_tasks', { limit: 30, offset: 0 });
  assertEq(p1.total, total, 'p1.total == totaal aantal taken');
  assertEq(p1.tasks.length, 30, 'p1 levert precies 30 rijen');
  assertEq(p1.has_more, true, 'p1.has_more true');
  assertEq(p1.next_offset, 30, 'p1.next_offset == 30');
  const p2 = callOk('planner_list_tasks', { limit: 30, offset: p1.next_offset });
  assertEq(p2.total, total, 'p2.total gelijk');
  // Geen overlap tussen pagina 1 en 2.
  const ids1 = new Set(p1.tasks.map((t: any) => t.id));
  const overlap = p2.tasks.filter((t: any) => ids1.has(t.id)).length;
  assertEq(overlap, 0, 'geen overlappende taken tussen pagina 1 en 2');
  // Laatste pagina: next_offset null zodra alles op is.
  const last = callOk('planner_list_tasks', { limit: total, offset: 0 });
  assertEq(last.has_more, false, 'volledige pagina ⇒ has_more false');
  assertEq(last.next_offset, null, 'volledige pagina ⇒ next_offset null');
});

test('list_tasks: kritiek-filter levert alleen kritieke taken', () => {
  loadBenchmark(100);
  const data = callOk('planner_list_tasks', { kritiek: true, limit: 1000 });
  const crit = S().tasks.filter((t) => t.time.isCritical).length;
  assertEq(data.total, crit, 'total == aantal kritieke taken');
  assert(data.tasks.every((t: any) => t.crit === true), 'elke rij is kritiek');
});

// =================================================================================================
// 3b) planner_list_tasks — zonder_relaties vindt PRECIES de wezen
// =================================================================================================
test('list_tasks zonder_relaties: vindt precies de leaf-wezen (geen verzameltaken)', () => {
  cleanProject();
  // Twee gelinkte leaves (P→Q) + één losse leaf (WEES) + een verzameltaak met kind (geen relatie).
  const p = S().addTask({ name: 'P', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const q = S().addTask({ name: 'Q', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().addTask({ name: 'WEES', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const parent = S().addTask({ name: 'PARENT', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  S().addTask({ name: 'KIND', isMilestone: false, parentId: parent, time: createDefaultTaskTime('2026-06-01', 1) });
  S().addSequence({ predecessorId: p, successorId: q, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();

  const data = callOk('planner_list_tasks', { zonder_relaties: true, limit: 1000 });
  const foundNames = data.tasks.map((t: any) => t.name).sort();
  // WEES en KIND zijn beide leaves zonder relatie; PARENT is een verzameltaak (uitgesloten).
  assertEq(foundNames, ['KIND', 'WEES'], 'precies de leaf-wezen, verzameltaak uitgesloten');
  assert(!data.tasks.some((t: any) => t.id === p || t.id === q), 'gelinkte taken zijn geen wees');
});

// =================================================================================================
// 4) planner_get_task — detail incl. assignments/relaties
// =================================================================================================
test('get_task: detail incl. assignments (resource/units/curve) + voorganger/opvolger', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'CREW', description: '', maxUnits: 3 });
  const a = S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const b = S().addTask({ name: 'B', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 4) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 1 });
  S().assignResource(b, rId, 2, 'FRONT_LOADED');
  S().runCPM();

  const data = callOk('planner_get_task', { taskId: b });
  assertEq(data.id, b, 'id');
  assertEq(data.duration, 4, 'duur');
  assertEq(data.assignments.length, 1, 'één toewijzing');
  assertEq(data.assignments[0].resourceId, rId, 'toewijzing resourceId');
  assertEq(data.assignments[0].unitsPerDay, 2, 'toewijzing units/dag');
  assertEq(data.assignments[0].curve, 'FRONT_LOADED', 'toewijzing curve');
  assertEq(data.assignments[0].resourceName, 'Ploeg', 'toewijzing resource-naam');
  assertEq(data.predecessors.length, 1, 'één voorganger');
  assertEq(data.predecessors[0].taskId, a, 'voorganger id');
  assertEq(data.predecessors[0].type, 'FS', 'voorganger type-afkorting');
  assertEq(data.predecessors[0].lag, '+1d', 'voorganger lag-label');
  assertEq(data.calendar.isProjectDefault, true, 'kalender is projectdefault');
});

// F5 (spec-review-fixronde op 526af9f9, plan-Z14 regel ~470) — leeskant-rand: .mpp-importvelden
// moeten via de MCP-bridge leesbaar zijn. `manuallyScheduled`/`splitGaps`/`levelingDelayMinutes`
// bestonden al als Task-veld maar ontbraken in `planner_get_task`; `mspTaskType`/`effortDriven`/
// `timephasedContours` zijn Z14b-nieuw. Compact-optioneel: gezet ⇒ aanwezig, ongezet ⇒ afwezig.
test('get_task: .mpp-importvelden (manuallyScheduled/splitGaps/levelingDelayMinutes/mspTaskType/effortDriven/timephasedContours)', () => {
  cleanProject();
  const c = S().addTask({ name: 'C', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 5) });
  S().updateTask(c, {
    manuallyScheduled: true,
    splitGaps: [{ afterMinutes: 60, gapMinutes: 30 }],
    levelingDelayMinutes: 15,
    mspTaskType: 'FIXED_DURATION',
    effortDriven: true,
    timephasedContours: [{ resourceUid: 7, periods: [{ afterMinutes: 0, minutes: 120, workMinutes: 120, kind: 'actual' }] }],
  });
  S().runCPM();

  const data = callOk('planner_get_task', { taskId: c });
  assertEq(data.manuallyScheduled, true, 'manuallyScheduled aanwezig en juist');
  assertEq(data.splitGaps, [{ afterMinutes: 60, gapMinutes: 30 }], 'splitGaps aanwezig en juist');
  assertEq(data.levelingDelayMinutes, 15, 'levelingDelayMinutes aanwezig en juist');
  assertEq(data.mspTaskType, 'FIXED_DURATION', 'mspTaskType aanwezig en juist');
  assertEq(data.effortDriven, true, 'effortDriven aanwezig en juist');
  assertEq(data.timephasedContours, [{ resourceUid: 7, periods: [{ afterMinutes: 0, minutes: 120, workMinutes: 120, kind: 'actual' }] }],
    'timephasedContours aanwezig en juist');

  // Negatieve zijde: een taak ZONDER deze velden draagt ze niet (compact-optioneel, geen `false`/
  // lege-array-ruis in de payload).
  const d = S().addTask({ name: 'D', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().runCPM();
  const dataD = callOk('planner_get_task', { taskId: d });
  assert(!('manuallyScheduled' in dataD), 'D: manuallyScheduled afwezig');
  assert(!('splitGaps' in dataD), 'D: splitGaps afwezig');
  assert(!('levelingDelayMinutes' in dataD), 'D: levelingDelayMinutes afwezig');
  assert(!('mspTaskType' in dataD), 'D: mspTaskType afwezig');
  assert(!('effortDriven' in dataD), 'D: effortDriven afwezig');
  assert(!('timephasedContours' in dataD), 'D: timephasedContours afwezig');
});

test('get_task: onbekend id ⇒ nette NOT_FOUND', () => {
  cleanProject();
  const res = callErr('planner_get_task', { taskId: 'bestaat-niet' });
  assert(!res.ok, 'moet falen');
  assertEq(res.ok ? '' : res.code, 'NOT_FOUND', 'code NOT_FOUND');
});

test('get_task: custom taaktype leest stabiele id plus projectsnapshotnaam en toont een ontbrekende naam eerlijk', () => {
  cleanProject();
  S().ensureProjectTaskType({ id: 'ops-read-type', name: 'Engineering' });
  const known = S().addTask({
    name: 'Custom bekend', taskType: 'USERDEFINED', customTaskTypeId: 'ops-read-type',
    time: createDefaultTaskTime('2026-06-01', 1),
  });
  const orphan = S().addTask({
    name: 'Custom wees', taskType: 'USERDEFINED', customTaskTypeId: 'ops-read-orphan',
    time: createDefaultTaskTime('2026-06-02', 1),
  });
  assertEq(callOk('planner_get_task', { taskId: known }).customTaskType,
    { id: 'ops-read-type', name: 'Engineering' }, 'bekende projectsnapshot is volledig leesbaar');
  assertEq(callOk('planner_get_task', { taskId: orphan }).customTaskType,
    { id: 'ops-read-orphan', name: null }, 'ontbrekende catalogentry degradeert niet naar CONSTRUCTION');
});

// =================================================================================================
// 5) planner_get_critical_path — driving-paren allebei kritiek
// =================================================================================================
test('get_critical_path: driving-relaties hebben BEIDE eindpunten kritiek', () => {
  loadBenchmark(500);
  const data = callOk('planner_get_critical_path');
  assert(data.hasResult, 'planningsresultaat aanwezig');
  assert(data.criticalTasks.length > 0, 'niet-lege kritieke set');
  const critIds = new Set(data.criticalTasks.map((t: any) => t.id));
  for (const rel of data.drivingRelations) {
    assert(critIds.has(rel.predId), `driving-relatie ${rel.seqId}: voorganger niet kritiek`);
    assert(critIds.has(rel.succId), `driving-relatie ${rel.seqId}: opvolger niet kritiek`);
  }
  assertEq(data.pathsMode, 'merged', 'zonder floatPaths ⇒ merged');
  assert(!('criticalPaths' in data), 'criticalPaths ontbreekt in merged-modus');
  // Elke kritieke taak heeft float ≤ 0 (kritiek-definitie).
  assert(data.criticalTasks.every((t: any) => t.totalFloat <= 0), 'kritieke taken hebben tf ≤ 0');
});

// =================================================================================================
// 6) planner_list_resources — paginering + toewijzings-samenvatting
// =================================================================================================
test('list_resources: paginering + toewijzings-samenvatting kloppen', () => {
  loadBenchmark(500);
  const s = S();
  const all = callOk('planner_list_resources', { limit: 1000 });
  assertEq(all.total, s.resources.length, 'total == aantal resources');
  // Paginering: 1e pagina van 3.
  const p1 = callOk('planner_list_resources', { limit: 3, offset: 0 });
  assertEq(p1.resources.length, Math.min(3, s.resources.length), 'p1 grootte');
  assertEq(p1.has_more, s.resources.length > 3, 'has_more');
  // Toewijzings-samenvatting van de eerste resource klopt met de store.
  const first = all.resources[0];
  const expectAsg = s.assignments.filter((a) => a.resourceId === first.id).length;
  const expectTasks = new Set(s.assignments.filter((a) => a.resourceId === first.id).map((a) => a.taskId)).size;
  assertEq(first.assignmentCount, expectAsg, 'assignmentCount');
  assertEq(first.assignedTaskCount, expectTasks, 'assignedTaskCount');
});

// =================================================================================================
// 7) planner_get_resource_histogram — stale ⇒ tool herrekent en meldt
// =================================================================================================
test('get_resource_histogram: stale ⇒ herrekent vers en meldt (recomputed:true)', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().assignResource(t1, rId, 2);
  S().runCPM();
  assertEq(S().scheduleStale, false, 'na runCPM niet stale');

  // Muteer zonder recompute ⇒ scheduleStale wordt true.
  const cur = S().tasks.find((t) => t.id === t1)!;
  S().updateTask(t1, { time: { ...cur.time, scheduleDuration: 5 } });
  assertEq(S().scheduleStale, true, 'na updateTask stale');

  // Gescopt op resourceIds ⇒ volledig bucket-detail (mode:"detail"), óók bij een verouderde planning.
  const data = callOk('planner_get_resource_histogram', { bucket: 'week', resourceIds: [rId] });
  assertEq(data.mode, 'detail', 'gescopte call ⇒ detail-modus');
  assertEq(data.recomputed, true, 'tool herrekende de verouderde planning');
  assert(typeof data.warning === 'string', 'tool meldt de herrekening in de data');
  assertEq(S().scheduleStale, false, 'na de tool is de planning vers');
  // De verlengde taak (5 dagen @ 2 units) belast de resource; er is minstens één bucket met load.
  const res = data.resources.find((r: any) => r.resourceId === rId);
  assert(!!res && res.buckets.some((b: any) => b.load > 0), 'histogram toont belasting');
});

test('get_resource_histogram: niet-stale ⇒ recomputed:false, geen warning', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Solo', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().assignResource(t1, rId, 1);
  S().runCPM();
  const data = callOk('planner_get_resource_histogram', { bucket: 'week' });
  assertEq(data.recomputed, false, 'verse planning ⇒ recomputed false');
  assert(!('warning' in data), 'geen warning bij verse planning');
});

// ── T18b: detail-op-aanvraag ─────────────────────────────────────────────────────────────────────
test('get_resource_histogram: ongescopt (geen venster/resourceIds) ⇒ aggregaat, klein, pieken zichtbaar', () => {
  loadBenchmark(2500);
  const data = callOk('planner_get_resource_histogram');
  assertEq(data.mode, 'aggregate', 'ongescopte call ⇒ aggregaat-modus');
  assertEq(data.detailAvailable, true, 'detailAvailable:true');
  assert(typeof data.hint === 'string' && data.hint.length > 0, 'hint aanwezig');
  assertEq(data.resources.length, S().resources.length, 'aggregaat per resource');
  for (const r of data.resources) {
    assert(!('buckets' in r), 'aggregaat bevat GEEN bucket-arrays');
    assert(typeof r.peakLoad === 'number', 'peakLoad aanwezig');
    assert('peakDate' in r, 'peakDate aanwezig');
    assert(typeof r.overallocatedDayCount === 'number', 'overallocatedDayCount aanwezig');
    assert(typeof r.capacitySum === 'number', 'capacitySum aanwezig');
    assert('spanStart' in r && 'spanEnd' in r, 'spanne aanwezig');
  }
  // Pieken worden nooit verborgen: minstens één resource heeft een positieve peakLoad op dit project.
  assert(data.resources.some((r: any) => r.peakLoad > 0), 'minstens één piek zichtbaar in het aggregaat');
  const bytes = JSON.stringify(data).length;
  console.log(`  [PAYLOAD] histogram aggregaat (ongescopt, 2500 taken) = ${(bytes / 1024).toFixed(1)} KB`);
  assert(bytes < 20 * 1024, `aggregaat-payload ruim < 20 KB (kreeg ${(bytes / 1024).toFixed(1)} KB)`);
});

test('get_resource_histogram: gescopt op resourceIds ⇒ volledig detail met bucket-arrays', () => {
  loadBenchmark(500);
  const rId = S().resources[0].id;
  const data = callOk('planner_get_resource_histogram', { bucket: 'week', resourceIds: [rId] });
  assertEq(data.mode, 'detail', 'gescopt ⇒ detail-modus');
  assertEq(data.resources.length, 1, 'alleen de gevraagde resource');
  assertEq(data.resources[0].resourceId, rId, 'juiste resource');
  assert(Array.isArray(data.resources[0].buckets) && data.resources[0].buckets.length > 0, 'bucket-arrays aanwezig');
});

// =================================================================================================
// 8) planner_get_calendars — volledige definitie + gebruikt-door + isProjectDefault
// =================================================================================================
test('get_calendars: projectkalender met volledige definitie, isProjectDefault + gebruikt-door', () => {
  loadBenchmark(100);
  const s = S();
  const data = callOk('planner_get_calendars');
  const def = data.calendars.find((c: any) => c.isProjectDefault);
  assert(!!def, 'een projectdefault-kalender aanwezig');
  assertEq(def.id, s.calendar.id, 'projectdefault-id == store-kalender');
  // Volledige WorkCalendar-definitie: werkdagen + holidays present (benchmark heeft feestdagen).
  assertEq(def.workDays, s.calendar.workDays, 'werkdagen meegeleverd');
  assertEq(def.holidays.length, s.calendar.holidays.length, 'holidays volledig meegeleverd');
  assertEq(def.hoursPerDay, s.calendar.hoursPerDay, 'uren/dag');
  // Alle leaf-taken vallen op de projectkalender (benchmark zet geen per-taak-kalender).
  const leaves = s.tasks.filter((t) => t.childIds.length === 0).length;
  assertEq(def.usedByTasks, leaves + s.tasks.filter((t) => t.childIds.length > 0).length, 'gebruikt-door telt alle taken op de default');
});

// =================================================================================================
// 9) planner_compare_baseline — zonder baseline ⇒ VALIDATION-fout
// =================================================================================================
test('compare_baseline: geen actieve baseline ⇒ nette VALIDATION-fout', () => {
  cleanProject();
  S().addTask({ name: 'X', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().runCPM();
  const res = callErr('planner_compare_baseline');
  assert(!res.ok, 'moet falen zonder baseline');
  assertEq(res.ok ? '' : res.code, 'VALIDATION', 'code VALIDATION');
});

test('compare_baseline: levert alleen afwijkers + projectEndDelta', () => {
  cleanProject();
  const a = S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const b = S().addTask({ name: 'B', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  S().saveBaseline('BL0');
  // Verleng A ⇒ B schuift mee; beide afwijken.
  const curA = S().tasks.find((t) => t.id === a)!;
  S().updateTask(a, { time: { ...curA.time, scheduleDuration: 5 } });
  S().runCPM();
  const data = callOk('planner_compare_baseline');
  assert(data.deviationCount >= 1, 'minstens één afwijker');
  assert(data.deviations.every((r: any) => r.status !== 'onSchedule'), 'alleen afwijkers');
  assert(typeof data.projectEndDelta === 'number' && data.projectEndDelta > 0, 'projectEndDelta positief (later)');
});

// =================================================================================================
// 10) planner_analyze_delay — projectEndDelta is GÉÉN som van taakdelta's (cascade)
// =================================================================================================
test('analyze_delay: geen baseline ⇒ VALIDATION-fout', () => {
  cleanProject();
  S().addTask({ name: 'X', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().runCPM();
  const res = callErr('planner_analyze_delay');
  assert(!res.ok, 'moet falen zonder baseline');
  assertEq(res.ok ? '' : res.code, 'VALIDATION', 'code VALIDATION');
});

test('analyze_delay: projectEndDelta = opleveringseffect, NIET de som van de 3 cascade-delta\'s', () => {
  cleanProject();
  // Cascade A→B→C (FS, 2 werkdagen elk). Baseline. Verleng A met +5 ⇒ A,B,C schuiven elk +5 (som 15),
  // maar het projecteinde (C's finish) schuift maar +5.
  const a = S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const b = S().addTask({ name: 'B', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const c = S().addTask({ name: 'C', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  S().saveBaseline('BL-cascade');

  const curA = S().tasks.find((t) => t.id === a)!;
  S().updateTask(a, { time: { ...curA.time, scheduleDuration: 7 } }); // +5 werkdagen
  S().runCPM();

  const data = callOk('planner_analyze_delay');
  assertEq(data.projectEndDeltaAvailable, true, 'projectEndDelta beschikbaar');
  assertEq(data.projectEndDelta, 5, 'opleveringseffect = +5 werkdagen (C-finish)');
  // De drie schuivers hebben elk deltaFinish +5; hun som (15) ≠ het opleveringseffect (5).
  const shifters = data.criticalShifters;
  assert(shifters.length >= 3, 'minstens de 3 cascade-taken zijn kritieke schuivers');
  const sumDelta = shifters.reduce((acc: number, r: any) => acc + (r.deltaFinish ?? 0), 0);
  assert(sumDelta >= 15, `som van taakdelta's is minstens 15 (kreeg ${sumDelta})`);
  assert(sumDelta !== data.projectEndDelta, 'de som is NIET het opleveringseffect (geen dubbeltelling)');
  // Elke individuele schuiver van de keten schoof +5.
  for (const id of [a, b, c]) {
    const r = shifters.find((x: any) => x.taskId === id);
    assert(!!r, `schuiver voor ${id} aanwezig`);
    assertEq(r.deltaFinish, 5, `taak ${id} schoof +5`);
  }
});

test('analyze_delay: baseline zonder projecteinde ⇒ expliciete melding i.p.v. 0', () => {
  cleanProject();
  S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  // GEEN runCPM vóór de baseline ⇒ cpmResult null ⇒ baseline.projectEnd == ''.
  S().saveBaseline('BL-geen-einde');
  S().runCPM();
  const data = callOk('planner_analyze_delay');
  assertEq(data.projectEndDeltaAvailable, false, 'geen doorgerekend baseline-einde');
  assertEq(data.projectEndDelta, null, 'delta null, niet 0');
  assert(typeof data.note === 'string' && data.note.length > 0, 'expliciete melding aanwezig');
});

// =================================================================================================
// DIALOOG-GUARD op de T18-leestools — GEDEELDE implementatie (eindintegratie)
//
// De `readTool`-wikkel had een eigen, derde kopie van de dialoog-guard die de blokkerende vlag NIET
// benoemde. Sinds de eindintegratie delegeert hij naar `runReadTool` in runtime.ts. Deze case pint
// dat vast: een leestool weigert mét de VLAGNAAM in de fout — precies zoals de document-/bestands-
// tools (cases-doc-file.ts §10) en de runtime-wikkels (cases-runtime.ts §2) dat al deden.
// =================================================================================================
test('leestool: open dialoog ⇒ DIALOG_OPEN en de fout BENOEMT de blokkerende vlag', () => {
  cleanProject();
  S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().runCPM();

  useAppStore.setState((s) => { s.ui.showNewProjectDialog = true; });
  try {
    const res = callErr('planner_get_project_overview');
    assert(!res.ok, 'een leestool hoort te wachten op een open modaal (halve staat)');
    if (res.ok) return;
    assertEq(res.code, 'DIALOG_OPEN', 'code hoort DIALOG_OPEN te zijn');
    assert(
      res.error.includes('showNewProjectDialog'),
      `de fout hoort de vlag-naam te noemen (gedeelde guard), kreeg: ${res.error}`,
    );
  } finally {
    useAppStore.setState((s) => { s.ui.showNewProjectDialog = false; });
  }

  // Dialoog dicht ⇒ dezelfde call slaagt weer: bewijst dat de vlag de oorzaak was, niet de staat.
  const data = callOk('planner_get_project_overview');
  assertEq(data.tasks.length, 1, 'met de dialoog dicht leest dezelfde tool gewoon door');
});

// =================================================================================================
// PAYLOAD-METING (geen poort) — JSON-groottes op het 2500-taken-benchmarkproject
// =================================================================================================
test('payload-meting: overview / list_tasks(p1) / histogram op 2500 taken (rapport, geen assert)', () => {
  loadBenchmark(2500);
  const overview = callOk('planner_get_project_overview');
  const listP1 = callOk('planner_list_tasks', { limit: 50, offset: 0 });
  const histAgg = callOk('planner_get_resource_histogram'); // ongescopt ⇒ aggregaat (nieuwe default)
  const histDetail = callOk('planner_get_resource_histogram', { bucket: 'week', resourceIds: [S().resources[0].id] });
  const kb = (o: unknown) => (JSON.stringify(o).length / 1024).toFixed(1);
  console.log(`  [PAYLOAD] 2500-taken-project:`);
  console.log(`  [PAYLOAD]   get_project_overview       = ${kb(overview)} KB  (${overview.tasks.length} taken, ${overview.relationCount} relaties)`);
  console.log(`  [PAYLOAD]   list_tasks (p1, 50)         = ${kb(listP1)} KB  (${listP1.tasks.length}/${listP1.total} taken)`);
  console.log(`  [PAYLOAD]   histogram AGGREGAAT (default) = ${kb(histAgg)} KB  (${histAgg.resources.length} resources)`);
  console.log(`  [PAYLOAD]   histogram DETAIL (1 resource, week) = ${kb(histDetail)} KB`);
  assert(overview.tasks.length > 2000, 'overview bevat de volledige boom (ongelimiteerd)');
});

await run();
