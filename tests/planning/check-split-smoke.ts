// check-split-smoke.ts — rooktests voor de oppervlakken die de critreview van het splits-ontwerp NIET
// naliep (issue #146, spec §"Niet gecontroleerd door de review"): print/PDF, de tabelrapporten, de
// verzameltaak-rollup en baseline/variance, elk met een GEBRUIKERSsplit (`source: 'user'`) die via de
// echte store-actie `setTaskSplits` is gemaakt. Ze lezen `splitWalk`/de solver-uitkomst en horen door
// deze etappe niet te veranderen — dit bestand maakt van die aanname een poort. Kleine asserties,
// geen nieuwe engine-logica; de diepe render-/wandel-semantiek staat in `check-split-bar-render.ts`
// en `check-split-walk.ts`.
//
// Scenario (dagkalender, ma–vr): Fase ⟶ { U 4d, T 10d }, projectstart ma 2026-06-01. Baseline B0
// vóór de split; daarna T = 5d werk · 3d pauze · 5d werk, doorgerekend. T eindigt dan op wo
// 2026-06-17 (13 werkdagen) in plaats van vr 2026-06-12.
//
// Draait via run.sh. Exit 0 = alles groen.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import { computeWbsSummary, computeProgressReport, remainingDays, type ReportContext } from '@/engine/reports';
import { computeVariance } from '@/engine/variance';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';

const S = () => useAppStore.getState();
let checks = 0;
const diffs: string[] = [];
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};
const attempt = <T>(label: string, fn: () => T): T | undefined => {
  try { return fn(); } catch (e) { checks++; diffs.push(`${label} gooit: ${String(e)}`); return undefined; }
};

// ── Opzet ────────────────────────────────────────────────────────────────────
S().newProject();
S().setProject({ name: 'Splits-rooktest', startDate: '2026-06-01' });
const fase = S().addTask({ name: 'Fase' });
const leaf = (name: string, days: number) => {
  const id = S().addTask({ name, parentId: fase });
  const cur = S().tasks.find(t => t.id === id)!;
  S().updateTask(id, { time: { ...cur.time, scheduleDuration: days } });
  return id;
};
const U = leaf('U kort', 4);
const T = leaf('T metselwerk', 10);
S().runCPM();
S().saveBaseline('B0');
S().setActiveBaseline(S().baselines[0].id);
const task = (id: string) => S().tasks.find(t => t.id === id)!;
eq('opzet: T eindigt zonder split op vr 06-12', task(T).time.earlyFinish, '2026-06-12');

const refusal = S().setTaskSplits(T, [
  { kind: 'work', minutes: 2400 }, { kind: 'gap', minutes: 1440, source: 'user' }, { kind: 'work', minutes: 2400 },
]);
eq('opzet: setTaskSplits weigert niet', refusal, null);
S().runCPM();
eq('opzet: gebruikersgat staat op T', task(T).splitGaps, [{ afterMinutes: 2400, gapMinutes: 1440, source: 'user' }]);
eq('opzet: T eindigt na de pauze op wo 06-17', task(T).time.earlyFinish, '2026-06-17');

// ── (a) print/PDF: segmenten getekend, geen throw ────────────────────────────
function makeD2D(): { d2d: Draw2D; count(): number } {
  let rects = 0;
  let pending = false;
  const stv = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const d2d: Draw2D = {
    get font() { return stv.font; }, set font(v) { stv.font = v; },
    get fillStyle() { return stv.fillStyle; }, set fillStyle(v) { stv.fillStyle = v; },
    get strokeStyle() { return stv.strokeStyle; }, set strokeStyle(v) { stv.strokeStyle = v; },
    get lineWidth() { return stv.lineWidth; }, set lineWidth(v) { stv.lineWidth = v; },
    get textAlign() { return stv.textAlign; }, set textAlign(v) { stv.textAlign = v; },
    get textBaseline() { return stv.textBaseline; }, set textBaseline(v) { stv.textBaseline = v; },
    setLineDash() {}, fillRect() {}, strokeRect() {},
    beginPath() { pending = false; }, moveTo() {}, lineTo() {}, closePath() {},
    fill() { if (pending) { rects++; pending = false; } }, stroke() {},
    roundRect() { pending = true; },
    fillText() {}, measureText(t) { return { width: t.length * 6 }; },
  };
  return { d2d, count: () => rects };
}
const printOptions = {
  showCritical: true, showFloat: false, showDeps: true, showWeekends: true,
  showLegend: false, showTaskNames: true, showCompletion: true,
  autoFit: true, customZoom: 1, paperSize: 'A4', orientation: 'landscape',
  companyName: '', labels: { noTasks: '-', printed: '-', legend: {}, tableHeaders: {}, today: '-' },
  locale: 'nl', reportFontScale: 100,
} as unknown as PrintOptions;
{
  const only = makeD2D();
  attempt('print: renderReport met alleen T', () => renderReport(() => only.d2d, [task(T)], [], S().calendar, 'P', printOptions));
  eq('print: T tekent als 2 stukken (2 roundRects)', only.count(), 2);
  const all = makeD2D();
  attempt('print: renderReport met het hele project', () => renderReport(() => all.d2d, S().tasks, S().sequences, S().calendar, 'P', printOptions));
  ok('print: het hele project tekent iets', all.count() >= 3);
}

// ── (b) rapporten: duur = werkduur, de pauze telt niet mee ───────────────────
const s = S();
const ctx: ReportContext = {
  tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
  calendar: s.calendar, calendars: s.calendars, cpmResult: s.cpmResult,
  baseline: s.baselines.find(b => b.id === s.activeBaselineId) ?? null,
  statusDate: '2026-06-01', today: '2026-06-01',
};
{
  const wbs = attempt('WBS-samenvatting', () => computeWbsSummary(ctx, { maxLevel: 0, includeActivities: true }));
  const row = wbs?.rows.find(r => r.taskId === T);
  eq('WBS: T heeft 10 werkdagen duur, niet 13', row?.durationDays, 10);
  eq('WBS: T eindigt op 06-17', row?.finish.slice(0, 10), '2026-06-17');
  eq('WBS: T wijkt 3 werkdagen af van B0', row?.finishVarianceDays, 3);
  attempt('voortgangsrapport', () => computeProgressReport(ctx, { period: { preset: 'next4Weeks' }, nearCriticalDays: 5 }));
  eq('voortgang: resterend werk van T = 10 werkdagen (geen pauze)', remainingDays(ctx, task(T)), 10);
}

// ── (c) verzameltaak-rollup: de ouder eindigt op het einde van het laatste stuk ─
eq('rollup: Fase eindigt waar het laatste stuk van T eindigt', task(fase).time.earlyFinish, task(T).time.earlyFinish);
eq('rollup: Fase start op de projectstart', task(fase).time.earlyStart?.slice(0, 10), '2026-06-01');
ok('rollup: U verandert niet door de split van T', task(U).time.earlyFinish === '2026-06-04');

// ── (d) baseline/variance: einddata vergeleken, geen throw ───────────────────
{
  const engine = new CalendarEngine(calendarForEngine(S().calendar));
  const v = attempt('variance', () => computeVariance(S().tasks as Task[], ctx.baseline, engine, S().cpmResult?.projectEnd));
  const row = v?.rows.find(r => r.taskId === T);
  eq('variance: T start gelijk aan B0', row?.deltaStart, 0);
  eq('variance: T eindigt 3 werkdagen later dan B0', row?.deltaFinish, 3);
  eq('variance: projecteinde 3 werkdagen later', v?.projectEndDelta, 3);
  eq('variance: U ongewijzigd', v?.rows.find(r => r.taskId === U)?.deltaFinish, 0);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  split-smoke: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  split-smoke: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
