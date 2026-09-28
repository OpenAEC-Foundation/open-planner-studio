// Navigatie op de werkdagen-as ("alleen werkdagen tonen", issue #21 punt 5): Ctrl+Home
// (`computeScrollToDate`) en de minimap (`MiniMapRenderer`) moeten in AS-dagen rekenen, net als de
// Gantt. Vroeger telden beide kalenderdagen: Ctrl+Home sprong per weekend twee dagen te ver, en het
// minimapkader (uit `scrollX / zoom`, werkdagen) stond naast de balken (kalenderdagen).
//
// Draait via run.sh. Exit 0 = alles groen.
import { computeScrollToDate, computeEffectiveViewStart, computeFitToProject, axisDayDistance } from '@/utils/ganttViewport';
import { MiniMapRenderer } from '@/engine/renderer/MiniMapRenderer';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { parseDate, diffCalendarDays, addCalendarDays } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';

let checks = 0;
const fails: string[] = [];
const ok = (label: string, cond: boolean, detail = '') => { checks++; if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`); };

const calendar = { ...createDefaultCalendar(2026), holidays: [] }; // ma–vr, zonder feestdagen
const task = (id: string, es: string, ef: string) => ({
  id, name: id, childIds: [], time: { earlyStart: es, earlyFinish: ef, scheduleStart: es, scheduleFinish: ef, scheduleDuration: 10 },
} as unknown as Task);
const t1 = task('t1', '2026-03-02', '2026-03-13');
const t2 = task('t2', '2026-03-16', '2026-03-27');
const zoom = 20;
const origin = '2026-03-02'; // maandag, vóór de marge van drie as-dagen

// ── Ctrl+Home ──
const base = { tasks: [t1, t2], view: { viewStartDate: origin, zoom }, project: {}, calendar };
const target = '2026-03-16'; // twee weken later: 14 kalenderdagen, 10 werkdagen
const off = computeScrollToDate(target, { ...base, ui: { compressNonWorkdays: false } });
const on = computeScrollToDate(target, { ...base, ui: { compressNonWorkdays: true } });
const legacy = computeScrollToDate(target, { tasks: base.tasks, view: base.view, project: {} });
// De effectieve oorsprong ligt vóór de eerste taak (`computeEffectiveViewStart`); tel vanaf daar.
const eff = parseDate(computeEffectiveViewStart(base.tasks, origin));
const calDays = diffCalendarDays(eff, parseDate(target));
let workDays = 0;
for (let d = eff; d < parseDate(target); d = addCalendarDays(d, 1)) if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) workDays++;
ok('opzet: er ligt minstens één weekend tussen oorsprong en doel', calDays - workDays >= 2, `${calDays}/${workDays}`);
ok('Ctrl+Home kalender-as: (kalenderdagen − 3) × zoom', off === (calDays - 3) * zoom, `${off} vs ${(calDays - 3) * zoom}`);
ok('Ctrl+Home zonder kalender/ui-velden: ongewijzigd kalenderdagen', legacy === off, String(legacy));
ok('Ctrl+Home werkdagen-as: (werkdagen − 3) × zoom', on === (workDays - 3) * zoom, `${on} vs ${(workDays - 3) * zoom}`);

// ── Ctrl+0 (fit) ──
// Project 2026-03-02 .. 2026-03-27: 26 kalenderdagen, 20 werkdagen. Oorsprong 14 kalenderdagen
// (10 werkdagen) vóór de start. Op de werkdagen-as moet de fit in werkdagen rekenen, anders zet hij
// een te lage zoom én een scroll die de eerste dagen van het project uit beeld schuift.
{
  const width = 400;
  const fitCal = computeFitToProject([t1, t2], width, false, false, [], axisDayDistance(calendar, false))!;
  const fitWork = computeFitToProject([t1, t2], width, false, false, [], axisDayDistance(calendar, true))!;
  const fitLegacy = computeFitToProject([t1, t2], width, false, false)!;
  ok('fit kalender-as ongewijzigd t.o.v. de oude aanroep', JSON.stringify(fitCal) === JSON.stringify(fitLegacy));
  ok('fit kalender-as: zoom = breedte / 26 dagen', Math.abs(fitCal.zoom - width / 26) < 1e-9, String(fitCal.zoom));
  ok('fit werkdagen-as: zoom = breedte / 20 werkdagen', Math.abs(fitWork.zoom - width / 20) < 1e-9, String(fitWork.zoom));
  const effStart = parseDate(computeEffectiveViewStart([t1, t2], '2026-03-02'));
  const padWork = axisDayDistance(calendar, true)(effStart, parseDate('2026-03-02'));
  ok('fit werkdagen-as: scroll = oorsprongsmarge in werkdagen × zoom', Math.abs(fitWork.scrollX - padWork * fitWork.zoom) < 1e-9 && padWork === 10,
    `${fitWork.scrollX} / ${padWork}`);
}

// ── Minimap ──
const rows = [t1, t2].map((t) => ({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: false })) as unknown as ViewRow[];
const axis = resolveGanttAxis({ calendar: new CalendarEngine(calendar), compressNonWorkdays: true, origin: parseDate(origin), chartOriginX: 0, zoom, scrollX: 0 });
const originIdx = axis.dayIndexOf(parseDate(origin));
const axisDayOf = (d: Date) => axis.dayIndexOf(d) - originIdx;
const scrollX = axisDayOf(parseDate('2026-03-16')) * zoom; // het hoofdvenster begint op t2
const recorded: Array<{ x: number; w: number; fill: string }> = [];
const st = { fillStyle: '' };
const noop = () => {};
const ctx = {
  get fillStyle() { return st.fillStyle; }, set fillStyle(v: string) { st.fillStyle = v; },
  strokeStyle: '', lineWidth: 1,
  fillRect: (x: number, _y: number, w: number) => { recorded.push({ x, w, fill: st.fillStyle }); },
  strokeRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
} as unknown as CanvasRenderingContext2D;
const palette = { bg: '#000001', bar: '#000002', critical: '#000003', frame: '#000004', border: '#000005' };
const mini = new MiniMapRenderer(ctx, { rows, canvasWidth: 400, canvasHeight: 40, originDate: origin, scrollX, zoom, chartWidth: 100, palette, axisDayOf });
mini.render();
const bars = recorded.filter((r) => r.fill === palette.bar);
const frame = mini.frameBounds();
ok('minimap: twee balken en een kader', bars.length === 2 && frame !== null, `${bars.length}`);
if (bars.length === 2 && frame) {
  ok('minimap werkdagen-as: kader begint op de balk van t2', Math.abs(frame.x - bars[1].x) < 0.01, `kader ${frame.x.toFixed(2)}, balk ${bars[1].x.toFixed(2)}`);
  ok('minimap werkdagen-as: de twee balken zijn even breed (10 werkdagen elk)', Math.abs(bars[0].w - bars[1].w) < 0.01);
}
// Klik op de balkstart van t2 → dezelfde scrollX terug.
const day = mini.miniXToDay(bars[1]?.x ?? 0);
ok('minimap werkdagen-as: klik op balkstart t2 ⇒ as-dag van t2', day !== null && Math.abs(day * zoom - scrollX) < 1e-6, String(day));

// Gecachte dagindeling (bevroren rijen, zoals uit de store): zelfde balken als het verse pad, en een
// andere oorsprong of as-functie geeft géén verouderde indeling.
{
  const frozen = Object.freeze([...rows]) as ViewRow[];
  const barsOf = (opts: { originDate: string; axisDayOf?: (d: Date) => number }) => {
    recorded.length = 0;
    new MiniMapRenderer(ctx, { rows: frozen, canvasWidth: 400, canvasHeight: 40, scrollX, zoom, chartWidth: 100, palette, ...opts }).render();
    return JSON.stringify(recorded.filter((r) => r.fill === palette.bar));
  };
  const fresh = (opts: { originDate: string; axisDayOf?: (d: Date) => number }) => {
    recorded.length = 0;
    new MiniMapRenderer(ctx, { rows: [...rows], canvasWidth: 400, canvasHeight: 40, scrollX, zoom, chartWidth: 100, palette, ...opts }).render();
    return JSON.stringify(recorded.filter((r) => r.fill === palette.bar));
  };
  const a1 = barsOf({ originDate: origin, axisDayOf });
  const a2 = barsOf({ originDate: origin, axisDayOf });
  ok('minimap-cache: tweede render gelijk aan de eerste en aan het verse pad', a1 === a2 && a1 === fresh({ originDate: origin, axisDayOf }));
  ok('minimap-cache: kalender-as na werkdagen-as niet verouderd', barsOf({ originDate: origin }) === fresh({ originDate: origin }));
  ok('minimap-cache: andere oorsprong niet verouderd', barsOf({ originDate: '2026-02-23' }) === fresh({ originDate: '2026-02-23' }));
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-workday-axis-nav: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-workday-axis-nav: ${checks}/${checks} groen`);
