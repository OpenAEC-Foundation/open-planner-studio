import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import { holdAutoCalc } from '@/state/editHold';
import { countCriticalActivities } from '@/engine/scheduler/scheduleAnalysis';

const S = () => useAppStore.getState();

function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    ...over,
  });
}

function callOk(name: string, args: unknown = {}): any {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} niet geregistreerd`);
  const res = tool!.handler(args, makeCtx()) as McpToolResult;
  assert(res.ok, `tool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data;
}

function callErr(name: string, args: unknown = {}): McpToolResult {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} niet geregistreerd`);
  return tool!.handler(args, makeCtx()) as McpToolResult;
}

function loadBenchmark(size: number) {
  const gen = generateBenchmarkProject(size);
  S().applyLoadedProject(gen, { filePath: null, recompute: true });
  return gen;
}

const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];
function cleanProject(): void {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: [...CLEAN_WORKDAYS], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Schoon testproject' });
}

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

test('get_project_info: criticalTasks telt alleen bladtaken, zoals statusbalk en Rapportpaneel (audit weergaven 5)', () => {
  cleanProject();
  const f = S().addTask({ name: 'Fase ruwbouw', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const a = S().addTask({ name: 'A fundering', isMilestone: false, parentId: f, time: createDefaultTaskTime('2026-06-01', 5) });
  const b = S().addTask({ name: 'B wanden', isMilestone: false, parentId: f, time: createDefaultTaskTime('2026-06-01', 3) });
  S().addTask({ name: 'C bestelling', isMilestone: false, parentId: f, time: createDefaultTaskTime('2026-06-01', 2) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const fase = S().tasks.find((t) => t.id === f)!;
  assertEq(fase.time.isCritical, true, 'opzet: de fase draagt de opgerolde kritiek-vlag');
  assertEq(S().cpmResult!.criticalPath.length, 2, 'opzet: statusbalk telt 2 kritieke taken');

  const info = callOk('planner_get_project_info');
  assertEq(info.statistics.criticalTasks, S().cpmResult!.criticalPath.length, 'criticalTasks == statusbalk (cpmResult.criticalPath)');
  assertEq(info.statistics.criticalTasks, countCriticalActivities(S().tasks), 'criticalTasks == Rapportpaneel-teller');

  const lt = callOk('planner_list_tasks', { kritiek: true });
  assertEq(lt.total, 3, 'list_tasks({kritiek:true}) telt de fase mee');
  assertEq(lt.tasks.find((r: any) => r.id === f)?.summary, true, 'de fase-rij draagt summary:true');
  assert(/summary tasks|phases/i.test(getTool('planner_list_tasks')!.description), 'beschrijving noemt dat verzameltaken meetellen in `kritiek`');
  assert(/leaf tasks|activities/i.test(getTool('planner_get_project_info')!.description), 'beschrijving noemt dat criticalTasks alleen bladtaken telt');
});

test('get_project_overview: elke taak aanwezig; relatiegraaf compleet; verkorte notatie klopt', () => {
  cleanProject();
  const a = S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const b = S().addTask({ name: 'B', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().addTask({ name: 'C', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const seq = S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 2 });
  S().runCPM();

  const data = callOk('planner_get_project_overview');
  assertEq(data.taskCount, S().tasks.length, 'taskCount');
  assertEq(data.relationCount, 1, 'relationCount');
  const totalRels = data.tasks.reduce((acc: number, r: any) => acc + (r.rels ? r.rels.length : 0), 0);
  assertEq(totalRels, 1, 'relatiegraaf compleet: som van rels == relationCount');
  const aRow = data.tasks.find((r: any) => r.name === 'A');
  const bWbs = S().tasks.find((t) => t.id === b)!.wbsCode;
  assertEq(aRow.rels, [`→${bWbs} FS+2d #${seq}`], 'verkorte relatienotatie "→<wbs> FS+2d #<seqId>"');
  assertEq(aRow.id, a, 'elke overview-rij draagt het stabiele Task.id (H6)');
});

test('get_project_overview: rijen in boomvolgorde met depth en parentId (issue #159, vervolg)', () => {
  cleanProject();
  const r = S().addTask({ name: 'R', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 5) });
  const s1 = S().addTask({ name: 'S1', isMilestone: false, parentId: r, time: createDefaultTaskTime('2026-06-01', 3) });
  const a = S().addTask({ name: 'a', isMilestone: false, parentId: s1, time: createDefaultTaskTime('2026-06-01', 2) });
  S().runCPM();
  const data = callOk('planner_get_project_overview');
  const rows = data.tasks as any[];
  assertEq(rows.map((x) => x.name), ['R', 'S1', 'a'], 'rijen diepte-eerst');
  assertEq(rows.map((x) => x.depth ?? 1), [1, 2, 3], 'depth per geneste rij (wortel impliciet 1)');
  assertEq('depth' in rows[0], false, 'wortelrij draagt geen depth (compact)');
  assertEq(rows.map((x) => x.parentId ?? null), [null, r, s1], 'parentId is het stabiele Task.id');
  assertEq(rows[2].parent, S().tasks.find((t) => t.id === s1)!.wbsCode, '`parent` blijft de WBS-code (bestaande clients)');
  assertEq(rows[2].id, a, 'id blijft vooraan');
});

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
  const ids1 = new Set(p1.tasks.map((t: any) => t.id));
  const overlap = p2.tasks.filter((t: any) => ids1.has(t.id)).length;
  assertEq(overlap, 0, 'geen overlappende taken tussen pagina 1 en 2');
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

test('list_tasks van/tot: een urentaak die op de tot-dag begint telt mee (audit weergaven 6)', () => {
  cleanProject();
  const band = [{ start: 8 * 60, end: 16 * 60 }];
  S().setCalendar({
    ...S().calendar, hoursPerDay: 8, workStartHour: 8, workEndHour: 16,
    workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
  } as WorkCalendar);
  const hours = (min: number) => ({ ...createDefaultTaskTime('2026-06-01', 1), durationUnit: 'hours' as const, durationMinutes: min });
  const a = S().addTask({ name: 'A voorbereiden', isMilestone: false, parentId: null, time: hours(16 * 60) });
  const b = S().addTask({ name: 'B uitvoeren', isMilestone: false, parentId: null, time: hours(8 * 60) });
  S().addTask({ name: 'D later', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-08', 1) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const bt = S().tasks.find((t) => t.id === b)!;
  assertEq([bt.time.earlyStart, bt.time.earlyFinish], ['2026-06-03T08:00', '2026-06-03T16:00'], 'opzet: B loopt op wo 03-06');

  const names = (args: object) => callOk('planner_list_tasks', args).tasks.map((r: any) => r.name).sort();
  assertEq(names({ van: '2026-06-02', tot: '2026-06-03' }), ['A voorbereiden', 'B uitvoeren'], 'B begint op de tot-dag en telt mee');
  assertEq(names({ van: '2026-06-03', tot: '2026-06-03' }), ['B uitvoeren'], 'venster van één dag: alleen B');
  assertEq(names({ van: '2026-06-04', tot: '2026-06-05' }), [], 'na B: niets (D begint pas 08-06)');
});

test('list_tasks zonder_relaties: vindt precies de leaf-wezen (geen verzameltaken)', () => {
  cleanProject();
  const p = S().addTask({ name: 'P', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const q = S().addTask({ name: 'Q', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().addTask({ name: 'WEES', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const parent = S().addTask({ name: 'PARENT', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  S().addTask({ name: 'KIND', isMilestone: false, parentId: parent, time: createDefaultTaskTime('2026-06-01', 1) });
  S().addSequence({ predecessorId: p, successorId: q, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();

  const data = callOk('planner_list_tasks', { zonder_relaties: true, limit: 1000 });
  const foundNames = data.tasks.map((t: any) => t.name).sort();
  assertEq(foundNames, ['KIND', 'WEES'], 'precies de leaf-wezen, verzameltaak uitgesloten');
  assert(!data.tasks.some((t: any) => t.id === p || t.id === q), 'gelinkte taken zijn geen wees');
  const sub = S().addTask({ name: 'SUB', parentId: parent, time: createDefaultTaskTime('2026-06-01', 1) });
  S().addTask({ name: 'DIEP', parentId: sub, time: createDefaultTaskTime('2026-06-01', 1) });
  const names = () => callOk('planner_list_tasks', { zonder_relaties: true, limit: 1000 }).tasks.map((t: any) => t.name).sort();
  assertEq(names(), ['DIEP', 'KIND', 'WEES'], 'zonder faserelatie blijven de kinderen wezen');
  const incoming = S().addSequence({ predecessorId: p, successorId: parent, type: 'START_START', lagDays: 0 });
  if (!incoming) throw new Error('Faserelatie moet kunnen worden toegevoegd: incoming');
  assertEq(names(), ['WEES'], 'inkomende faserelatie verbindt alle afstammelingen');
  S().removeSequence(incoming);
  const outgoing = S().addSequence({ predecessorId: parent, successorId: q, type: 'FINISH_START', lagDays: 0 });
  if (!outgoing) throw new Error('Faserelatie moet kunnen worden toegevoegd: outgoing');
  assertEq(names(), ['WEES'], 'uitgaande faserelatie verbindt ook diep geneste kinderen');
  S().removeSequence(outgoing);
  const nested = S().addSequence({ predecessorId: sub, successorId: q, type: 'FINISH_START', lagDays: 0 });
  if (!nested) throw new Error('Faserelatie moet kunnen worden toegevoegd: nested');
  assertEq(names(), ['KIND', 'WEES'], 'relatie op subfase verbindt geen zustertak');
  S().removeSequence(nested);
  assertEq(names(), ['DIEP', 'KIND', 'WEES'], 'verwijderde relaties worden niet gecachet');
  const page = callOk('planner_list_tasks', { zonder_relaties: true, limit: 1 });
  assertEq(page.total, 3, 'paginatotaal telt de gefilterde wezen');
  assertEq(page.tasks.length, 1, 'paginering blijft werken');

});

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

test('get_task: begroot tempo naast het resttempo (plannedUnitsPerDay), alleen wanneer gezet', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Voorman', type: 'LABOR', description: '', maxUnits: 40 });
  const t = S().addTask({ name: 'P6-taak', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().assignResource(t, rId, 34);
  const zonder = callOk('planner_get_task', { taskId: t });
  assertEq('plannedUnitsPerDay' in zonder.assignments[0], false, 'zonder apart begroot tempo: geen veld');
  useAppStore.setState((s) => {
    const a = s.assignments.find((x) => x.taskId === t);
    if (a) a.plannedUnitsPerDay = 1.11111111111111;
  });
  const met = callOk('planner_get_task', { taskId: t });
  assertEq([met.assignments[0].unitsPerDay, met.assignments[0].plannedUnitsPerDay], [34, 1.11111111111111],
    'inzet = resttempo 34, begroot tempo 1,111 apart');
});

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
  assert(data.criticalTasks.every((t: any) => t.totalFloat <= 0), 'kritieke taken hebben tf ≤ 0');
});

test('get_critical_path: berekend zonder relaties is een bekende lege lijst', () => {
  cleanProject();
  const taskId = S().addTask({ name: 'Losse kritieke taak', time: createDefaultTaskTime('2026-06-01', 3) });
  S().runCPM();
  const data = callOk('planner_get_critical_path');
  assertEq(data.hasResult, true, 'geldige berekening');
  assertEq(data.drivingRelations, [], 'berekend zonder relaties blijft [], geen null');
  assertEq(data.criticalTasks.map((task: { id: string }) => task.id), [taskId], 'kritieke taak blijft beschikbaar');
  assertEq(data.note, undefined, 'geen onbekend-melding na een geldige berekening');
  const successorId = S().addTask({ name: 'Niet gedreven', time: createDefaultTaskTime('2026-06-01', 3) });
  S().addSequence({ predecessorId: taskId, successorId, type: 'START_START', lagDays: -1 });
  S().runCPM();
  assertEq(S().cpmResult!.drivingSequenceIds, [], 'opzet: de relatie drijft niet door de projectstart-vloer');
  assertEq(callOk('planner_get_critical_path').drivingRelations, [], 'ook met een relatie blijft berekend leeg []');
});

test('get_critical_path: ontbrekende of mislukte berekening geeft onbekende driving', () => {
  cleanProject();
  const release = holdAutoCalc();
  try {
    const missing = callOk('planner_get_critical_path');
    assertEq(missing.hasResult, false, 'nog geen resultaat tijdens een bewerking');
    assertEq(missing.drivingRelations, null, 'ontbrekend resultaat is onbekend');
    const a = S().addTask({ name: 'A' });
    const b = S().addTask({ name: 'B' });
    S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    useAppStore.setState(s => {
      s.sequences.push({ id: 'cycle', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
    });
    S().runCPM();
    const failed = callOk('planner_get_critical_path');
    assertEq(failed.hasResult, false, 'ongeldige berekening blijft ongeldig');
    assert(typeof failed.error === 'string', 'berekenfout blijft beschikbaar');
    assertEq(failed.drivingRelations, null, 'mislukte berekening is onbekend');
  } finally {
    release();
  }
});

test('list_resources: paginering + toewijzings-samenvatting kloppen', () => {
  loadBenchmark(500);
  const s = S();
  const all = callOk('planner_list_resources', { limit: 1000 });
  assertEq(all.total, s.resources.length, 'total == aantal resources');
  const p1 = callOk('planner_list_resources', { limit: 3, offset: 0 });
  assertEq(p1.resources.length, Math.min(3, s.resources.length), 'p1 grootte');
  assertEq(p1.has_more, s.resources.length > 3, 'has_more');
  const first = all.resources[0];
  const expectAsg = s.assignments.filter((a) => a.resourceId === first.id).length;
  const expectTasks = new Set(s.assignments.filter((a) => a.resourceId === first.id).map((a) => a.taskId)).size;
  assertEq(first.assignmentCount, expectAsg, 'assignmentCount');
  assertEq(first.assignedTaskCount, expectTasks, 'assignedTaskCount');
});

test('get_resource_histogram: stale ⇒ herrekent vers en meldt (recomputed:true)', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().assignResource(t1, rId, 2);
  S().runCPM();
  assertEq(S().scheduleStale, false, 'na runCPM niet stale');

  const cur = S().tasks.find((t) => t.id === t1)!;
  S().updateTask(t1, { time: { ...cur.time, scheduleDuration: 5 } });
  assertEq(S().scheduleStale, true, 'na updateTask stale');

  const data = callOk('planner_get_resource_histogram', { bucket: 'week', resourceIds: [rId] });
  assertEq(data.mode, 'detail', 'gescopte call ⇒ detail-modus');
  assertEq(data.recomputed, true, 'tool herrekende de verouderde planning');
  assert(typeof data.warning === 'string', 'tool meldt de herrekening in de data');
  assertEq(S().scheduleStale, false, 'na de tool is de planning vers');
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
  assert(data.resources.some((r: any) => r.peakLoad > 0), 'minstens één piek zichtbaar in het aggregaat');
  const bytes = JSON.stringify(data).length;
  console.log(`  [PAYLOAD] histogram aggregaat (ongescopt, 2500 taken) = ${(bytes / 1024).toFixed(1)} KB`);
  assert(bytes < 20 * 1024, `aggregaat-payload ruim < 20 KB (kreeg ${(bytes / 1024).toFixed(1)} KB)`);
});

test('get_resource_histogram: bucket maand ⇒ kalendermaanden (issue #119)', () => {
  const rId = S().resources[0].id;
  const data = callOk('planner_get_resource_histogram', { bucket: 'maand', resourceIds: [rId] });
  assertEq(data.bucket, 'maand', 'bucket-echo');
  const res = data.resources.find((r: any) => r.resourceId === rId);
  assert(!!res && res.buckets.length > 0, 'maandbuckets aanwezig');
  assert(res.buckets.every((b: any) => b.start.endsWith('-01')), 'elke maandbucket start op de 1e');
  assert(res.buckets.some((b: any) => b.load > 0), 'maandbucket met belasting');
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

test('get_resource_histogram: detail boven 10000 buckets ⇒ VALIDATION met uitweg, vóór het rekenen', () => {
  loadBenchmark(500);
  const rId = S().resources[0].id;
  const res = callErr('planner_get_resource_histogram', { bucket: 'dag', van: '1900-01-01', tot: '2100-12-31' });
  assert(!res.ok, 'te groot detail geeft een fout');
  if (!res.ok) {
    assertEq(res.code, 'VALIDATION', 'VALIDATION-code');
    assert(/limit 10000/.test(res.error) && /'week'\/'maand'/.test(res.error), `foutmelding noemt grens en uitweg (${res.error})`);
  }
  const ok = callOk('planner_get_resource_histogram', { bucket: 'dag', van: '2026-01-01', tot: '2026-12-31', resourceIds: [rId] });
  assertEq(ok.mode, 'detail', 'binnen de grens ⇒ detail');
  assertEq(ok.resources[0].buckets.length, 365, 'één bucket per dag');
});

test('get_calendars: projectkalender met volledige definitie, isProjectDefault + gebruikt-door', () => {
  loadBenchmark(100);
  const s = S();
  const data = callOk('planner_get_calendars');
  const def = data.calendars.find((c: any) => c.isProjectDefault);
  assert(!!def, 'een projectdefault-kalender aanwezig');
  assertEq(def.id, s.calendar.id, 'projectdefault-id == store-kalender');
  assertEq(def.workDays, s.calendar.workDays, 'werkdagen meegeleverd');
  assertEq(def.holidays.length, s.calendar.holidays.length, 'holidays volledig meegeleverd');
  assertEq(def.hoursPerDay, s.calendar.hoursPerDay, 'uren/dag');
  const leaves = s.tasks.filter((t) => t.childIds.length === 0).length;
  assertEq(def.usedByTasks, leaves + s.tasks.filter((t) => t.childIds.length > 0).length, 'gebruikt-door telt alle taken op de default');
});

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
  const curA = S().tasks.find((t) => t.id === a)!;
  S().updateTask(a, { time: { ...curA.time, scheduleDuration: 5 } });
  S().runCPM();
  const data = callOk('planner_compare_baseline');
  assert(data.deviationCount >= 1, 'minstens één afwijker');
  assert(data.deviations.every((r: any) => r.status !== 'onSchedule'), 'alleen afwijkers');
  assert(typeof data.projectEndDelta === 'number' && data.projectEndDelta > 0, 'projectEndDelta positief (later)');
});

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
  const a = S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const b = S().addTask({ name: 'B', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  const c = S().addTask({ name: 'C', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  S().saveBaseline('BL-cascade');

  const curA = S().tasks.find((t) => t.id === a)!;
  S().updateTask(a, { time: { ...curA.time, scheduleDuration: 7 } });
  S().runCPM();

  const data = callOk('planner_analyze_delay');
  assertEq(data.projectEndDeltaAvailable, true, 'projectEndDelta beschikbaar');
  assertEq(data.projectEndDelta, 5, 'opleveringseffect = +5 werkdagen (C-finish)');
  const shifters = data.criticalShifters;
  assert(shifters.length >= 3, 'minstens de 3 cascade-taken zijn kritieke schuivers');
  const sumDelta = shifters.reduce((acc: number, r: any) => acc + (r.deltaFinish ?? 0), 0);
  assert(sumDelta >= 15, `som van taakdelta's is minstens 15 (kreeg ${sumDelta})`);
  assert(sumDelta !== data.projectEndDelta, 'de som is NIET het opleveringseffect (geen dubbeltelling)');
  for (const id of [a, b, c]) {
    const r = shifters.find((x: any) => x.taskId === id);
    assert(!!r, `schuiver voor ${id} aanwezig`);
    assertEq(r.deltaFinish, 5, `taak ${id} schoof +5`);
  }
});

test('analyze_delay: baseline zonder projecteinde ⇒ expliciete melding i.p.v. 0', () => {
  cleanProject();
  S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().saveBaseline('BL-geen-einde');
  S().runCPM();
  const data = callOk('planner_analyze_delay');
  assertEq(data.projectEndDeltaAvailable, false, 'geen doorgerekend baseline-einde');
  assertEq(data.projectEndDelta, null, 'delta null, niet 0');
  assert(typeof data.note === 'string' && data.note.length > 0, 'expliciete melding aanwezig');
});

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

  const data = callOk('planner_get_project_overview');
  assertEq(data.tasks.length, 1, 'met de dialoog dicht leest dezelfde tool gewoon door');
});

test('payload-meting: overview / list_tasks(p1) / histogram op 2500 taken (rapport, geen assert)', () => {
  loadBenchmark(2500);
  const overview = callOk('planner_get_project_overview');
  const listP1 = callOk('planner_list_tasks', { limit: 50, offset: 0 });
  const histAgg = callOk('planner_get_resource_histogram');
  const histDetail = callOk('planner_get_resource_histogram', { bucket: 'week', resourceIds: [S().resources[0].id] });
  const kb = (o: unknown) => (JSON.stringify(o).length / 1024).toFixed(1);
  console.log(`  [PAYLOAD] 2500-taken-project:`);
  console.log(`  [PAYLOAD]   get_project_overview       = ${kb(overview)} KB  (${overview.tasks.length} taken, ${overview.relationCount} relaties)`);
  console.log(`  [PAYLOAD]   list_tasks (p1, 50)         = ${kb(listP1)} KB  (${listP1.tasks.length}/${listP1.total} taken)`);
  console.log(`  [PAYLOAD]   histogram AGGREGAAT (default) = ${kb(histAgg)} KB  (${histAgg.resources.length} resources)`);
  console.log(`  [PAYLOAD]   histogram DETAIL (1 resource, week) = ${kb(histDetail)} KB`);
  assert(overview.tasks.length > 2000, 'overview bevat de volledige boom (ongelimiteerd)');
});

test('optionele limit/offset: zonder beide hetzelfde antwoord, met een pagina total/has_more/next_offset', () => {
  cleanProject();
  const ids: string[] = [];
  for (let i = 0; i < 12; i++) {
    ids.push(S().addTask({ name: `K${i}`, isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) }));
    if (i > 0) S().addSequence({ predecessorId: ids[i - 1], successorId: ids[i], type: 'FINISH_START', lagDays: 0 });
  }
  S().runCPM();
  S().saveBaseline('BL-pagina');
  const first = S().tasks.find((t) => t.id === ids[0])!;
  S().updateTask(ids[0], { time: { ...first.time, scheduleDuration: 4 } });
  S().runCPM();

  const cases: [string, string, string | null][] = [
    ['planner_get_critical_path', 'criticalTasks', 'drivingRelations'],
    ['planner_compare_baseline', 'deviations', null],
    ['planner_analyze_delay', 'criticalShifters', null],
  ];
  for (const [tool, list, relations] of cases) {
    const all = callOk(tool);
    assertEq(all.total, undefined, `${tool}: zonder pagina geen total (antwoord ongewijzigd)`);
    assertEq(all.has_more, undefined, `${tool}: zonder pagina geen has_more`);
    assertEq(all[list].length, 12, `${tool}: zonder pagina de hele lijst`);
    const seen: unknown[] = [];
    const seenRel: unknown[] = [];
    let offset: number | null = 0;
    let pages = 0;
    while (offset !== null) {
      const page = callOk(tool, { limit: 5, offset });
      assertEq(page.total, 12, `${tool}: total`);
      assert(page[list].length <= 5, `${tool}: hoogstens limit per pagina`);
      seen.push(...page[list]);
      if (relations) seenRel.push(...page[relations]);
      offset = page.next_offset;
      assertEq(page.has_more, offset !== null, `${tool}: has_more volgt next_offset`);
      pages++;
    }
    assertEq(pages, 3, `${tool}: 12 in pagina's van 5`);
    assertEq(seen, all[list], `${tool}: de pagina's samen = de hele lijst`);
    if (relations) assertEq(seenRel, all[relations], `${tool}: elke relatie op precies één pagina`);
    assertEq(callOk(tool, { offset: 10 })[list].length, 2, `${tool}: alleen offset pagineert ook (default limit 50)`);
    const bad = callErr(tool, { limit: 0 });
    assertEq(bad.ok ? '' : bad.code, 'VALIDATION', `${tool}: limit 0 is een VALIDATION-fout`);
    const unknown = callErr(tool, { pagina: 1 });
    assertEq(unknown.ok ? '' : unknown.code, 'VALIDATION', `${tool}: een onbekende sleutel blijft een VALIDATION-fout`);
  }
});

await run();
