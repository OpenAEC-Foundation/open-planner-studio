/**
 * Meerdere baselines (issue #741): de actieve referentie blijft eenduidig — regressiebatterij.
 *
 * Bewaakt (aanvulling op `check-baseline-vergelijking.ts`, die de strook zelf bewaakt):
 *  K3. ALLEEN DE ACTIEVE BASELINE TELT. Het afwijkingsrapport (`computeVariance`, zoals
 *      `VarianceReport.tsx`), de tabelrapporten met baselinegegevens (WBS-samenvatting, voortgang;
 *      context zoals `useTableReportSpec.tsx`), de MCP-leestools (`planner_compare_baseline`,
 *      `planner_analyze_delay`) en de MSPDI-export lezen de actieve baseline. Een vergelijkingsbaseline
 *      aan- of uitzetten verandert geen cijfer en geen byte. De baselinekolommen van de tabel horen
 *      vast bij hun eigen baseline (id in de kolom-id): ook die veranderen niet. Een taak die niet in
 *      de baseline staat, krijgt '—' (kopie leeg), geen 0 en geen datum van een andere baseline.
 *      Plus een bronpin: geen van die lezers kent `comparedBaselineIds`.
 *  K4. VOORSPELBAAR NA MUTATIES. Na een nieuwe taak, een verwijderde taak, een nieuwe mijlpaal en een
 *      verwijderde mijlpaal (en hun undo/redo) blijft de keuze (actief + vergelijking) gelijk, en
 *      geven Gantt (echte `GanttRenderer`), afdruk (echte `renderReport`), tabel en rapport hetzelfde
 *      beeld: nieuw = geen strook, '—' in de kolommen, status 'new'; verwijderd = geen rij, de
 *      baselines zelf onveranderd, status 'dropped'. Filter, zoom en het wisselen van tabblad
 *      veranderen de keuze niet; het filter haalt alleen rijen weg.
 */
import { makeMcpContext } from '../mcp/harness';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { getTool, registerAllTools } from '@/services/mcp/toolRegistry';
import type { McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { computeVariance } from '@/engine/variance';
import { computeWbsSummary } from '@/engine/reports/wbsSummary';
import { computeProgressReport } from '@/engine/reports/progressReport';
import type { ReportContext } from '@/engine/reports/reportCommon';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { baselineColumnId } from '@/engine/taskGrid/fieldIds';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { PRINT_PALETTE } from '@/engine/renderer/themePalette';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import { buildBaselineLayers, buildBaselineOverlay, comparisonOverlays, type Baseline } from '@/types/baseline';
import type { Task } from '@/types/task';
import type { TaskColumnContext } from '@/types/taskGrid';

// Node-shim (zelfde als check-baseline-vergelijking): readGanttPalette leest CSS-variabelen.
const g = globalThis as unknown as Record<string, unknown>;
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const S = () => useAppStore.getState();
let failures = 0;
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) { console.log(`   XX ${msg}`); failures++; } };
const eq = (got: unknown, want: unknown, msg: string) => ok(J(got) === J(want), `${msg}: verwacht ${J(want)}, kreeg ${J(got)}`);

registerAllTools();

// ── Lezers, precies zoals de app ze voedt ───────────────────────────────────────────────────────
/** `VarianceReport.tsx:24` en `useTableReportSpec.tsx:94`: de actieve baseline of null. */
const activeOf = (): Baseline | null => {
  const s = S();
  return s.activeBaselineId ? s.baselines.find(b => b.id === s.activeBaselineId) ?? null : null;
};
const currentEnd = () => (S().cpmResult && !S().cpmResult!.error ? S().cpmResult!.projectEnd : undefined);
const variance = () => computeVariance(S().tasks, activeOf(), new CalendarEngine(S().calendar), currentEnd());
const reportCtx = (): ReportContext => ({
  tasks: S().tasks, sequences: S().sequences, resources: S().resources, assignments: S().assignments,
  calendar: S().calendar, calendars: S().calendars, cpmResult: S().cpmResult,
  baseline: activeOf(), statusDate: S().project.statusDate, today: '2026-10-30',
});
async function mcp(name: string): Promise<unknown> {
  const res = await getTool(name)!.handler({}, makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId })) as McpToolResult;
  return res.ok ? (res as McpToolOk).data : { error: (res as { error?: unknown }).error };
}
/** MSPDI: per taaknaam het <Baseline>-blok (of null). */
function mspdiBaselines(): Record<string, string | null> {
  const s = S();
  const xml = writeMSPDI(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments, s.calendars, s.baselines, s.activeBaselineId);
  const out: Record<string, string | null> = {};
  for (const block of xml.split('<Task>').slice(1)) {
    const name = /<Name>([^<]*)<\/Name>/.exec(block)?.[1] ?? '?';
    out[name] = /<Baseline>[\s\S]*?<\/Baseline>/.exec(block)?.[0].replace(/\s+/g, '') ?? null;
  }
  return out;
}
const GRID_FIELDS = ['start', 'finish', 'duration', 'varianceStart', 'varianceFinish', 'varianceDuration'] as const;
/** Tabel: per baseline × veld × taak de getoonde tekst en de kopie, via de echte kolomregistry. */
function gridCells(): Record<string, [string, string]> {
  const s = S();
  const cal = new CalendarEngine(s.calendar);
  const ctx = {
    projectId: 'p', tasksById: new Map(s.tasks.map(t => [t.id, t])),
    baselinesById: new Map(s.baselines.map(b => [b.id, b])),
    labelForText: (k: string) => k,
    signedWorkDaysBetween: (a: string, b: string) => cal.signedWorkDaysBetween(new Date(a), new Date(b)),
  } as unknown as TaskColumnContext;
  const reg = buildTaskColumnRegistry({ projectId: 'p', activityCodeTypes: [], customFieldDefs: [], baselines: s.baselines });
  const out: Record<string, [string, string]> = {};
  for (const b of s.baselines) for (const f of GRID_FIELDS) {
    const col = reg.find(c => c.id === baselineColumnId('p', b.id, f))!;
    for (const t of s.tasks) {
      const v = col.read(t, ctx);
      out[`${b.name}/${f}/${t.name}`] = [String(col.format ? col.format(v, t, ctx) : v), String(col.copy ? col.copy(t, ctx) : '')];
    }
  }
  return out;
}
/** Alles wat een getal of datum uit een baseline toont, behalve de strook. */
async function referentieBeeld() {
  return {
    variance: variance(),
    wbs: computeWbsSummary(reportCtx(), { maxLevel: 0, includeActivities: true }),
    progress: computeProgressReport(reportCtx(), { period: { preset: 'project' }, nearCriticalDays: 5 }),
    compare: await mcp('planner_compare_baseline'),
    delay: await mcp('planner_analyze_delay'),
    mspdi: mspdiBaselines(),
    grid: gridCells(),
  };
}

// ── Strook: echte GanttRenderer en echte renderReport, met opnemende contexten ───────────────────
interface Fill { color: string; pts: [number, number][] }
const BASE_COLORS = new Set([PRINT_PALETTE.baseline, PRINT_PALETTE.baselineCompare1, PRINT_PALETTE.baselineCompare2]);
const cyOf = (pts: [number, number][]) => { const ys = pts.map(p => p[1]); return (Math.min(...ys) + Math.max(...ys)) / 2; };
function overlays() {
  const s = S();
  return {
    ov0: buildBaselineOverlay(s.baselines, s.activeBaselineId),
    comps: comparisonOverlays(buildBaselineLayers(s.baselines, s.activeBaselineId, s.comparedBaselineIds)),
  };
}
/** Scherm: per taaknaam de baselinekleuren in die rij (alleen rijen met een strook), plus de rijnamen. */
function screenStrips(): { rows: string[]; strips: Record<string, string[]> } {
  const fills: Fill[] = [];
  let path: [number, number][] = [];
  const st = { fillStyle: '', strokeStyle: '' };
  const noop = () => {};
  const ctx = {
    lineWidth: 1, font: '', textAlign: '', textBaseline: '', globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    set fillStyle(v: string) { st.fillStyle = v; }, get fillStyle() { return st.fillStyle; },
    set strokeStyle(v: string) { st.strokeStyle = v; }, get strokeStyle() { return st.strokeStyle; },
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: () => { path = []; }, closePath: noop,
    moveTo: (x: number, y: number) => { path.push([x, y]); }, lineTo: (x: number, y: number) => { path.push([x, y]); },
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop,
    fill: () => { fills.push({ color: st.fillStyle, pts: path }); },
    stroke: noop, save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  const s = S();
  const { ov0, comps } = overlays();
  const renderer = new GanttRenderer(ctx as unknown as CanvasRenderingContext2D, {
    rows: s.viewRows, sequences: [], calendar: s.calendar,
    view: { ...s.view, scrollX: 0, scrollY: 0 },
    selectedTaskIds: [], canvasWidth: 6000, canvasHeight: 600, rowHeight: 32, headerHeight: 60,
    showBaselineOverlay: true, baselineOverlay: ov0, baselineComparisons: comps,
    activityCodeTypes: [], customFieldDefs: [], taskTypeLabels: {}, barColorNoneLabel: '(geen)',
    resources: [], assignments: [],
  });
  renderer.render();
  const strips: Record<string, string[]> = {};
  for (const f of fills) {
    if (!BASE_COLORS.has(f.color) || f.pts.length < 3) continue;
    const task = renderer.getTaskAtY(cyOf(f.pts));
    if (!task) continue;
    const list = (strips[task.name] ??= []);
    if (!list.includes(f.color)) list.push(f.color);
  }
  for (const k of Object.keys(strips)) strips[k].sort();
  return { rows: s.viewRows.filter(r => r.kind === 'task').map(r => (r as { task: Task }).task.name), strips };
}
/** Afdruk: per strookrij (van boven naar onder) de baselinekleuren. */
function printStrips(tasks: Task[]): string[][] {
  const fills: Fill[] = [];
  let path: [number, number][] | null = null;
  const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const noop = () => {};
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash: noop, fillRect: noop, strokeRect: noop,
    beginPath() { path = []; }, moveTo(x, y) { (path ??= []).push([x, y]); }, lineTo(x, y) { (path ??= []).push([x, y]); },
    closePath: noop, fill() { if (path) fills.push({ color: st.fillStyle, pts: path }); path = null; },
    stroke() { path = null; }, roundRect: noop, fillText: noop,
    measureText: (t: string) => ({ width: t.length * 6 }),
  };
  const { ov0, comps } = overlays();
  const options = {
    showCritical: false, showFloat: false, showDeps: false, showWeekends: true, showLegend: false,
    showTaskNames: false, showCompletion: false, autoFit: false, customZoom: 22,
    paperSize: 'A3', orientation: 'landscape', companyName: 'Test',
    barColorSelection: { mode: 'critical' }, activityCodeTypes: [], customFieldDefs: [],
    taskTypeLabels: {}, barColorNoneLabel: '(geen)',
    showBaselineOverlay: true, baselineOverlay: ov0, baselineComparisons: comps,
    labels: { noTasks: '-', printed: '-', today: '-', statusDate: '-', progressDate: '-', legend: {}, tableHeaders: {} },
  } as unknown as PrintOptions;
  renderReport(() => d2d, tasks, [], S().calendar, 'P', options);
  const rows: { cy: number; colors: string[] }[] = [];
  for (const f of fills) {
    if (!BASE_COLORS.has(f.color) || f.pts.length < 3) continue;
    const cy = cyOf(f.pts);
    let row = rows.find(r => Math.abs(r.cy - cy) < 4);
    if (!row) rows.push(row = { cy, colors: [] });
    if (!row.colors.includes(f.color)) row.colors.push(f.color);
  }
  return rows.sort((a, b) => a.cy - b.cy).map(r => r.colors.sort());
}
/** Scherm = afdruk: dezelfde strookrijen in dezelfde volgorde met dezelfde kleuren. */
function checkScreenIsPrint(label: string) {
  const scr = screenStrips();
  const tasks = scr.rows.map(n => S().tasks.find(t => t.name === n)!);
  const want = scr.rows.filter(n => scr.strips[n]).map(n => scr.strips[n]);
  eq(printStrips(tasks), want, `${label}: afdruk tekent dezelfde strookrijen en kleuren als het scherm`);
  return scr;
}

// ══ Opzet: drie baselines met elk andere datums ══════════════════════════════════════════════════
S().newProject();
const tRuw = S().addTask({ name: 'Ruwbouw' });
const tAfb = S().addTask({ name: 'Afbouw' });
const tOpl = S().addTask({ name: 'Oplevering', isMilestone: true });
S().addSequence({ predecessorId: tRuw, successorId: tAfb, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: tAfb, successorId: tOpl, type: 'FINISH_START', lagDays: 0 });
const setDur = (id: string, d: number) => S().updateTask(id, { time: { ...S().tasks.find(t => t.id === id)!.time, scheduleDuration: d } });
setDur(tRuw, 5); setDur(tAfb, 5);
S().runCPM();
const blA = S().saveBaseline('A');
setDur(tRuw, 8); S().runCPM();
const blB = S().saveBaseline('B');
setDur(tAfb, 9); S().runCPM();
const blC = S().saveBaseline('C');
setDur(tRuw, 10); S().runCPM();          // huidig plan wijkt af van alle drie
S().setActiveBaseline(blA);
eq(S().activeBaselineId, blA, 'opzet: A is actief');
const baselinesJson = () => J(S().baselines);
const baselinesAtStart = baselinesJson();
const P = PRINT_PALETTE;

// ══ K3. Alleen de actieve baseline telt ═══════════════════════════════════════════════════════════
const zonder = await referentieBeeld();
eq((zonder.compare as { baselineId?: string }).baselineId, blA, 'K3 MCP compare_baseline meet tegen de actieve (A)');
eq((zonder.delay as { baselineId?: string }).baselineId, blA, 'K3 MCP analyze_delay meet tegen de actieve (A)');
const aRuw = S().baselines.find(b => b.id === blA)!.tasks.find(t => t.taskId === tRuw)!;
eq(zonder.variance.rows.find(r => r.taskId === tRuw)?.baselineFinish, aRuw.finish, 'K3 afwijkingsrapport: baseline-einde komt uit A');
// Per baseline een ander einde voor Ruwbouw en Afbouw: zo wijst elk cijfer één baseline aan.
const finishOf = (bl: string, task: string) => S().baselines.find(b => b.id === bl)!.tasks.find(t => t.taskId === task)!.finish.slice(0, 10);
ok(new Set([blA, blB, blC].map(b => finishOf(b, tAfb))).size === 3, 'K3 opzet: Afbouw heeft in A, B en C een ander einde');
const mspdiFinish = (block: string | null) => /<Finish>(\d{4}-\d{2}-\d{2})/.exec(block ?? '')?.[1];
eq(mspdiFinish(zonder.mspdi.Ruwbouw), finishOf(blA, tRuw), 'K3 MSPDI: <Baseline> van Ruwbouw heeft het einde uit A');
eq(mspdiFinish(zonder.mspdi.Afbouw), finishOf(blA, tAfb), 'K3 MSPDI: <Baseline> van Afbouw heeft het einde uit A');
const cmpAfb = (zonder.compare as { deviations: { taskId: string; baselineFinish?: string }[] }).deviations.find(r => r.taskId === tAfb);
eq(cmpAfb?.baselineFinish?.slice(0, 10), finishOf(blA, tAfb), 'K3 MCP compare_baseline: baseline-einde van Afbouw uit A');
const wbsAfb = (zonder.wbs as { rows: { taskId?: string; baselineFinish?: string }[] }).rows.find(r => r.taskId === tAfb);
eq(wbsAfb?.baselineFinish?.slice(0, 10), finishOf(blA, tAfb), 'K3 WBS-samenvatting: baseline-einde van Afbouw uit A');
ok(zonder.variance.rows.some(r => r.taskId === tRuw && r.deltaFinish !== 0), 'K3 opzet: Ruwbouw wijkt af van A (anders bewijst de vergelijking niets)');

S().toggleComparedBaseline(blB);
S().toggleComparedBaseline(blC);
eq(S().comparedBaselineIds, [blB, blC], 'K3 B en C staan in de vergelijking');
eq(S().activeBaselineId, blA, 'K3 vergelijking aan: A blijft actief');
const met = await referentieBeeld();
for (const k of Object.keys(zonder) as (keyof typeof zonder)[]) {
  eq(met[k], zonder[k], `K3 vergelijking aan verandert ${k} niet`);
}
// Wisselen van de actieve baseline doet wél iets (de vergelijking hierboven is dus niet loos).
S().setActiveBaseline(blC);
const metC = await referentieBeeld();
ok(J(metC.variance) !== J(zonder.variance), 'K3 controle: een andere actieve baseline verandert het afwijkingsrapport wel');
eq(metC.grid, zonder.grid, 'K3 tabelkolommen horen bij hun eigen baseline: actief wisselen verandert ze niet');
S().undo();
eq([S().activeBaselineId, S().comparedBaselineIds], [blA, [blB, blC]], 'K3 undo actief wisselen: A actief, B en C vergeleken');

// Bronpin: de lezers van de referentie kennen de vergelijkingskeuze niet.
for (const file of [
  'src/engine/variance.ts', 'src/components/panels/VarianceReport.tsx', 'src/components/panels/reports/useTableReportSpec.tsx',
  'src/engine/reports/reportCommon.ts', 'src/engine/reports/wbsSummary.ts', 'src/engine/reports/progressReport.ts',
  'src/services/mcp/tools/readTools.ts', 'src/services/mcp/tools/baselineTools.ts', 'src/services/msproject/mspdiWriter.ts',
  'src/engine/taskGrid/taskColumnRegistry.ts', 'src/services/csv/csvWriter.ts', 'src/services/p6/p6xmlWriter.ts',
]) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  ok(!/comparedBaselineIds|buildBaselineLayers|comparisonOverlays/.test(src), `K3 bronpin: ${file} leest geen vergelijkingsbaseline`);
}

// ══ K4. Nieuwe en verwijderde taken en mijlpalen ══════════════════════════════════════════════════
const keuze = () => [S().activeBaselineId, S().comparedBaselineIds];
const KEUZE = [blA, [blB, blC]];
const ALL3 = [P.baseline, P.baselineCompare1, P.baselineCompare2].sort();
{
  const scr = checkScreenIsPrint('K4 start');
  eq(scr.strips, { Ruwbouw: ALL3, Afbouw: ALL3, Oplevering: ALL3 }, 'K4 start: elke rij heeft een strook in alle drie de kleuren');
}

/** Een nieuwe taak/mijlpaal: overal leeg, nergens een verzonnen waarde. */
async function checkNew(name: string, label: string) {
  eq(keuze(), KEUZE, `${label}: keuze ongewijzigd`);
  eq(baselinesJson(), baselinesAtStart, `${label}: baselines zelf ongewijzigd`);
  const scr = checkScreenIsPrint(label);
  ok(scr.rows.includes(name), `${label}: de taak heeft een rij`);
  eq(scr.strips[name], undefined, `${label}: geen strook (geen baselinewaarde verzonnen)`);
  const b = await referentieBeeld();
  const id = S().tasks.find(t => t.name === name)!.id;
  const vr = b.variance.rows.find(r => r.taskId === id);
  eq([vr?.status, vr?.baselineStart, vr?.baselineFinish, vr?.deltaStart, vr?.deltaFinish],
    ['new', undefined, undefined, undefined, undefined], `${label}: afwijkingsrapport 'new' zonder baselinedatums of delta`);
  eq(b.mspdi[name], null, `${label}: MSPDI zonder <Baseline>`);
  for (const bl of ['A', 'B', 'C']) for (const f of GRID_FIELDS) {
    eq(b.grid[`${bl}/${f}/${name}`], ['—', ''], `${label}: tabelkolom ${bl}/${f} toont '—' en kopieert leeg`);
  }
  const wbsRow = (b.wbs as { rows: { taskId?: string; baselineStart?: string; baselineFinish?: string; finishVarianceDays?: number }[] }).rows.find(r => r.taskId === id);
  ok(!!wbsRow, `${label}: de taak staat in de WBS-samenvatting`);
  eq([wbsRow?.baselineStart, wbsRow?.baselineFinish, wbsRow?.finishVarianceDays], [undefined, undefined, undefined],
    `${label}: WBS-samenvatting zonder baselinedatums en zonder afwijking`);
  const cmpRow = (b.compare as { deviations?: { taskId: string; status: string; baselineFinish?: string }[] }).deviations?.find(r => r.taskId === id);
  eq([cmpRow?.status, cmpRow?.baselineFinish], ['new', undefined], `${label}: MCP compare_baseline 'new' zonder baselinedatum`);
}
/** Een verwijderde taak/mijlpaal: geen rij, de baselines houden haar, rapport meldt 'dropped'. */
async function checkDropped(id: string, name: string, label: string) {
  eq(keuze(), KEUZE, `${label}: keuze ongewijzigd`);
  eq(baselinesJson(), baselinesAtStart, `${label}: baselines zelf ongewijzigd (de taak blijft erin)`);
  const scr = checkScreenIsPrint(label);
  ok(!scr.rows.includes(name), `${label}: geen rij meer`);
  const b = await referentieBeeld();
  eq(b.variance.rows.find(r => r.taskId === id)?.status, 'dropped', `${label}: afwijkingsrapport meldt 'dropped'`);
  ok(!(name in b.mspdi), `${label}: niet in de MSPDI-export`);
  eq(Object.keys(scr.strips).sort(), scr.rows.filter(n => n !== name).sort(), `${label}: de overige rijen houden hun strook`);
}

const voor = await referentieBeeld();
// Nieuwe taak, met undo en redo.
const tNieuw = S().addTask({ name: 'Nieuw' });
S().runCPM();
await checkNew('Nieuw', 'K4 nieuwe taak');
S().undo();
eq(S().tasks.some(t => t.id === tNieuw), false, 'K4 undo nieuwe taak: taak weg');
eq(keuze(), KEUZE, 'K4 undo nieuwe taak: keuze ongewijzigd');
S().runCPM();
eq((await referentieBeeld()).variance, voor.variance, 'K4 undo nieuwe taak: afwijkingsrapport als vóór');
S().redo();
S().runCPM();
await checkNew('Nieuw', 'K4 redo nieuwe taak');
S().deleteTask(tNieuw);
S().runCPM();

// Nieuwe mijlpaal.
S().addTask({ name: 'Keuring', isMilestone: true });
S().runCPM();
await checkNew('Keuring', 'K4 nieuwe mijlpaal');
S().undo();
S().runCPM();
eq(keuze(), KEUZE, 'K4 undo nieuwe mijlpaal: keuze ongewijzigd');
S().redo();
S().runCPM();
await checkNew('Keuring', 'K4 redo nieuwe mijlpaal');
S().deleteTask(S().tasks.find(t => t.name === 'Keuring')!.id);
S().runCPM();
eq((await referentieBeeld()).variance, voor.variance, 'K4 opruimen: terug bij het startbeeld');

// Verwijderde taak, met undo en redo.
S().deleteTask(tAfb);
S().runCPM();
await checkDropped(tAfb, 'Afbouw', 'K4 verwijderde taak');
S().undo();
S().runCPM();
eq(keuze(), KEUZE, 'K4 undo verwijderde taak: keuze ongewijzigd');
eq(screenStrips().strips.Afbouw, ALL3, 'K4 undo verwijderde taak: strook terug in alle drie de kleuren');
eq((await referentieBeeld()).variance, voor.variance, 'K4 undo verwijderde taak: afwijkingsrapport als vóór');
S().redo();
S().runCPM();
await checkDropped(tAfb, 'Afbouw', 'K4 redo verwijderde taak');
S().undo();
S().runCPM();

// Verwijderde mijlpaal, met undo en redo.
S().deleteTask(tOpl);
S().runCPM();
await checkDropped(tOpl, 'Oplevering', 'K4 verwijderde mijlpaal');
S().undo();
S().runCPM();
eq(keuze(), KEUZE, 'K4 undo verwijderde mijlpaal: keuze ongewijzigd');
eq(screenStrips().strips.Oplevering, ALL3, 'K4 undo verwijderde mijlpaal: ruit terug in alle drie de kleuren');
S().redo();
S().runCPM();
await checkDropped(tOpl, 'Oplevering', 'K4 redo verwijderde mijlpaal');
S().undo();
S().runCPM();
eq(J(await referentieBeeld()), J(voor), 'K4 na alle undo: tabel, rapporten, MCP en export als vóór');

// ══ K4. Filter, zoom en tabbladen veranderen de keuze niet ═══════════════════════════════════════
{
  const before = screenStrips();
  S().setFilter({ kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'contains', value: 'Ruw' });
  eq(keuze(), KEUZE, 'K4 filter: keuze ongewijzigd');
  const f = checkScreenIsPrint('K4 filter');
  eq(f.rows, ['Ruwbouw'], 'K4 filter: alleen Ruwbouw zichtbaar');
  eq(f.strips, { Ruwbouw: before.strips.Ruwbouw }, 'K4 filter: Ruwbouw houdt dezelfde strook');
  eq(J(await referentieBeeld()), J(voor), 'K4 filter: tabel, rapporten, MCP en export veranderen niet');
  S().setFilter(null);
  eq(screenStrips(), before, 'K4 filter weg: hetzelfde beeld als vóór het filter');

  const zoom0 = S().view.zoom;
  S().setZoom(zoom0 * 3);
  ok(S().view.zoom !== zoom0, 'K4 zoom: de zoom is echt veranderd');
  eq(keuze(), KEUZE, 'K4 zoom: keuze ongewijzigd');
  eq(checkScreenIsPrint('K4 zoom').strips, before.strips, 'K4 zoom: dezelfde rijen met dezelfde kleuren');
  S().setZoom(zoom0);

  for (const tab of ['table', 'report', 'start'] as const) {
    S().setUI({ activeRibbonTab: tab });
    eq(keuze(), KEUZE, `K4 tabblad ${tab}: keuze ongewijzigd`);
  }
  eq(J(await referentieBeeld()), J(voor), 'K4 tabbladwissel: tabel, rapporten, MCP en export als vóór');
}

console.log(`check-baseline-referentie: ${checks} controles, ${failures} fout`);
if (failures > 0) process.exit(1);
