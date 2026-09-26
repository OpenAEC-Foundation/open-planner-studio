// De spelingsband eindigt op "Laatste einde" — op het scherm, in de afdruk en in het datumbereik
// van de afdruk (audit weergaven, bevinding 4).
//
// AANLEIDING. De band werd getekend als `totalFloat × zoom`: WERKdagen speling maal pixels per
// KALENDERdag. Over een weekend stopte de band daardoor dagen te vroeg (A met 10 wd speling en
// "Laatste einde" dinsdag 16-06 kreeg een band tot en met vrijdag 12-06), en in urenmodus schoot hij
// juist door tot diep in de nacht. De gids (`gids-kritiek-pad-analyse.md`) belooft "tot de laatste
// einddatum", en raster, paneel en MCP tonen `lateFinish`. Sindsdien leiden scherm, afdruk en het
// afdrukbereik de band-rand af uit één helper (`floatBandEnd`, `src/utils/taskDates.ts`).
//
// Deze batterij draait de ECHTE `GanttRenderer` (opnemende 2D-context) en de ECHTE `renderReport`
// (opnemende Draw2D) en meet de band tegen de x van het einde van de "Laatste einde"-dag (dagtaak)
// of het instant (urentaak).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import { PRINT_PALETTE } from '@/engine/renderer/themePalette';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';
import { parseDate, parseInstant, MS_PER_DAY } from '@/utils/dateUtils';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function near(label: string, actual: number | undefined, expected: number, tol = 0.01): void {
  checks++;
  if (actual === undefined || !Number.isFinite(actual) || Math.abs(actual - expected) > tol) {
    diffs.push(`${label}: kreeg ${actual === undefined ? 'geen waarde' : actual.toFixed(2)}, verwacht ${expected.toFixed(2)}`);
  }
}
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const dayAfter = (iso: string) => new Date(parseDate(iso).getTime() + MS_PER_DAY);

// ── Opnemende 2D-context voor de scherm-renderer ─────────────────────────────
interface Rect { x: number; w: number; fill: string }
function makeCtx(): { ctx: CanvasRenderingContext2D; rects: Rect[] } {
  const rects: Rect[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: (x: number, _y: number, w: number) => {
      rects.push({ x, w, fill: String((ctx as { fillStyle: string }).fillStyle) });
    },
    strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}
// Zelfde fallbackkleur als check-gantt-float-cull.ts: `--theme-bar-float` op 60% dekking.
const SCREEN_FLOAT = '#05966999';

function renderScreen(viewStartDate: string, zoom: number, extra: Record<string, unknown> = {}) {
  const { ctx, rects } = makeCtx();
  const st = S();
  const renderer = new GanttRenderer(ctx, {
    rows: st.viewRows, sequences: st.sequences, calendar: st.calendar,
    view: { ...st.view, viewStartDate, zoom, scrollX: 0, scrollY: 0 },
    selectedTaskIds: [], canvasWidth: 4000, canvasHeight: 400, rowHeight: 28, headerHeight: 60,
    ...extra,
  });
  renderer.render();
  const bands = rects.filter(r => r.fill.toUpperCase() === SCREEN_FLOAT);
  return { renderer, bands };
}

// ── Opnemende Draw2D voor de afdruk ──────────────────────────────────────────
interface RR { x: number; y: number; w: number; color: string }
function renderPrint(options: Partial<PrintOptions> = {}) {
  const rr: RR[] = [];
  const st: Record<string, unknown> = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left', textBaseline: 'alphabetic' };
  const noop = () => {};
  const d2d = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash: noop, fillRect: noop, strokeRect: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    closePath: noop, fill: noop, stroke: noop, fillText: noop,
    roundRect(x: number, y: number, w: number) { rr.push({ x, y, w, color: String(st.fillStyle) }); },
    measureText: (t: string) => ({ width: t.length * 6 }),
  } as unknown as Draw2D;
  const s = S();
  const result = renderReport(() => d2d, s.tasks, s.sequences, s.calendar, 'P', {
    showCritical: true, showFloat: true, showDeps: false, showWeekends: true, showLegend: false,
    showTaskNames: false, showCompletion: false, autoFit: false, customZoom: 20,
    paperSize: 'A3', orientation: 'landscape', companyName: '', barColorSelection: { mode: 'critical' },
    activityCodeTypes: [], customFieldDefs: [], dateNotation: 'dmy', rows: s.viewRows,
    ...options,
  } as PrintOptions);
  const floatColor = (PRINT_PALETTE.float + '40').toUpperCase();
  const band = rr.find(r => r.color.toUpperCase() === floatColor);
  return { rr, band, result };
}

// ── Scenario 1: dagtaken, speling over twee weekenden ────────────────────────
// A (2d) en B (12d) parallel, C na beide. A: ES ma 01-06, EF di 02-06, LF di 16-06, TF 10 wd.
function dayScenario(holidays: WorkCalendar['holidays'] = []): string {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Spelingsband' });
  const A = S().addTask({ name: 'Kort (speling)', time: { scheduleDuration: 2 } as TaskTime });
  const B = S().addTask({ name: 'Lang (kritiek)', time: { scheduleDuration: 12 } as TaskTime });
  const C = S().addTask({ name: 'Samenkomst', time: { scheduleDuration: 2 } as TaskTime });
  S().addSequence({ predecessorId: A, successorId: C, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: B, successorId: C, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  return A;
}

{
  const A = dayScenario();
  const a = S().tasks.find(t => t.id === A)!;
  eq('1 opzet: A heeft 10 wd speling en LF 16-06', [a.time.totalFloat, a.time.lateFinish, a.time.isCritical], [10, '2026-06-16', false]);

  // Scherm, kalender-as.
  const { renderer, bands } = renderScreen('2026-05-25', 30);
  eq('1a scherm: precies één spelingsband', bands.length, 1);
  near('1b scherm: band begint op de balkrand (einde van EF-dag 02-06)', bands[0]?.x, renderer.dateToX(dayAfter('2026-06-02')));
  near('1c scherm: band eindigt op het einde van de "Laatste einde"-dag (16-06)', bands[0] && bands[0].x + bands[0].w, renderer.dateToX(dayAfter(a.time.lateFinish)));

  // Scherm, gecomprimeerde werkdagen-as: daar klopte de oude breedte toevallig (10 wd = 10 kolommen);
  // dat moet zo blijven.
  const comp = renderScreen('2026-05-25', 30, { compressNonWorkdays: true });
  eq('1d scherm (werkdagen-as): precies één spelingsband', comp.bands.length, 1);
  near('1e scherm (werkdagen-as): band eindigt op het einde van de "Laatste einde"-dag',
    comp.bands[0] && comp.bands[0].x + comp.bands[0].w, comp.renderer.dateToX(dayAfter(a.time.lateFinish)));

  // Afdruk: de balk van A (2 kalenderdagen) is de meetlat.
  const p = renderPrint();
  const bar = p.rr.find(r => r !== p.band && p.band && Math.abs(r.y - p.band.y) < 12);
  checks++;
  if (!p.band || !bar) {
    diffs.push(`1f afdruk: band of balk van A niet gevonden (${p.rr.map(r => r.color).join(',')})`);
  } else {
    const pxPerDay = bar.w / 2;
    near('1f afdruk: band begint op de balkrand', p.band.x, bar.x + bar.w);
    // ES 01-06 → einde van LF-dag 16-06 = begin van 17-06 = 16 kalenderdagen.
    near('1g afdruk: band eindigt op het einde van de "Laatste einde"-dag', p.band.x + p.band.w, bar.x + 16 * pxPerDay);
  }
}

// ── Scenario 2: het datumbereik van de afdruk ────────────────────────────────
// Bouwvak tussen EF(A) en LF(A): LF ligt weken na EF + TF kalenderdagen. Met alleen de rij van A
// in de afdruk (WYSIWYG-filter) moet het bereik de hele band dragen — de band mag niet buiten de
// canvas lopen.
{
  const A = dayScenario([{ name: 'Bouwvak', startDate: '2026-06-08', endDate: '2026-06-26' }]);
  const a = S().tasks.find(t => t.id === A)!;
  eq('2 opzet: A heeft 10 wd speling en LF 07-07', [a.time.totalFloat, a.time.lateFinish], [10, '2026-07-07']);
  const onlyA = S().viewRows.filter(r => r.kind === 'task' && r.task.id === A);
  const p = renderPrint({ rows: onlyA });
  const bar = p.rr.find(r => r !== p.band && p.band && Math.abs(r.y - p.band.y) < 12);
  checks++;
  if (!p.band || !bar) {
    diffs.push('2a afdruk: band of balk van A niet gevonden');
  } else {
    const pxPerDay = bar.w / 2;
    // ES 01-06 → begin van 08-07 = 37 kalenderdagen.
    near('2a afdruk (bouwvak): band eindigt op het einde van de "Laatste einde"-dag', p.band.x + p.band.w, bar.x + 37 * pxPerDay);
    checks++;
    if (p.band.x + p.band.w > p.result.width + 0.01) {
      diffs.push(`2b afdruk (bouwvak): datumbereik draagt de band niet — band eindigt op ${(p.band.x + p.band.w).toFixed(1)}, canvas is ${p.result.width.toFixed(1)} breed`);
    }
  }
}

// ── Scenario 3: urentaken — de band eindigt op het LF-instant ────────────────
// 9-uurskalender, A 5h naast B 9h, C na beide: A EF 13:00, LF 17:00 (4 werkuren speling).
{
  S().newProject();
  S().setUI({ enableHourPlanning: true });
  const band9 = [{ start: 8 * 60, end: 17 * 60 }];
  S().setCalendar({
    ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 9, workStartHour: 8, workEndHour: 17,
    workTime: { byWeekday: { 1: band9, 2: band9, 3: band9, 4: band9, 5: band9, 6: [], 7: [] } },
  } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Spelingsband uren' });
  const HA = S().addTask({ name: 'A', time: { durationUnit: 'hours', durationMinutes: 300 } as TaskTime });
  const HB = S().addTask({ name: 'B', time: { durationUnit: 'hours', durationMinutes: 540 } as TaskTime });
  const HC = S().addTask({ name: 'C', time: { durationUnit: 'hours', durationMinutes: 240 } as TaskTime });
  S().addSequence({ predecessorId: HA, successorId: HC, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: HB, successorId: HC, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const ha = S().tasks.find(t => t.id === HA)!;
  eq('3 opzet: A EF 13:00, LF 17:00', [ha.time.earlyFinish, ha.time.lateFinish], ['2026-06-01T13:00', '2026-06-01T17:00']);
  const { renderer, bands } = renderScreen('2026-05-31', 240, { enableHourPlanning: true });
  eq('3a scherm (uren): precies één spelingsband', bands.length, 1);
  near('3b scherm (uren): band begint op het EF-instant', bands[0]?.x, renderer.dateToX(parseInstant(ha.time.earlyFinish)));
  near('3c scherm (uren): band eindigt op het LF-instant, niet in de nacht', bands[0] && bands[0].x + bands[0].w, renderer.dateToX(parseInstant(ha.time.lateFinish)));
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  float-band-end: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  float-band-end: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
