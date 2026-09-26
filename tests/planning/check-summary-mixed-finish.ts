// Verzameltaak met een DAGkind en een URENkind: einde oprollen als tijdstip (audit weergaven, bevinding 10).
//
// AANLEIDING. `applyCpmResult` rolde `earlyFinish`/`lateFinish` van een fase op als STRING-max.
// "2026-06-05T13:00" sorteert ná "2026-06-05", maar een dagtaak die op 05-06 eindigt loopt tot het
// einde van die dag. De fase eindigde daardoor om 13:00 en haar balk was korter dan haar eigen kind.
// Sindsdien vergelijkt de rollup einden als tijdstippen met de balkregel (`finishInstant`: datum
// zonder tijd = einde van die dag), en leest de Gantt-balk een datum zonder tijd in een uur-balk ook
// zo — anders tekende een fase met een uur-start en een dag-einde (ook vóór deze fix al mogelijk)
// een dag te kort. De afgeleide faseduur rekent in een uur-projectkalender met hetzelfde einde.
//
// Draait via run.sh (ook in de tijdzone-matrix). Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';
import { finishInstant } from '@/utils/taskDates';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function near(label: string, actual: number | undefined, expected: number | undefined, tol = 0.01): void {
  checks++;
  if (actual === undefined || expected === undefined || Math.abs(actual - expected) > tol) {
    diffs.push(`${label}: kreeg ${actual?.toFixed(2)}, verwacht ${expected?.toFixed(2)}`);
  }
}

const band8 = [{ start: 8 * 60, end: 16 * 60 }];
const hourCalendarFields = {
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: band8, 2: band8, 3: band8, 4: band8, 5: band8, 6: [], 7: [] } },
};
const taskOf = (id: string) => S().tasks.find(t => t.id === id)!;

// De samenvattingsbalk is geen sleepbare balk (`getTaskBarRect` geeft er null voor), dus lees hem
// uit de tekening: de afgeronde rechthoek in de samenvattingskleur.
const SUMMARY_FILL = '#475569';
function render() {
  const rects: { x: number; w: number; fill: string }[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    fillRect: noop,
    roundRect: (x: number, _y: number, w: number) => { rects.push({ x, w, fill: String((ctx as { fillStyle: string }).fillStyle) }); },
    strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    arcTo: noop, ellipse: noop, rect: noop, fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop, setLineDash: noop, getLineDash: () => [], fillText: noop,
    strokeText: noop, measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }), quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  const st = S();
  const renderer = new GanttRenderer(ctx as unknown as CanvasRenderingContext2D, {
    rows: st.viewRows, sequences: st.sequences, calendar: st.calendar,
    view: { ...st.view, viewStartDate: '2026-05-28', zoom: 48, scrollX: 0, scrollY: 0 },
    selectedTaskIds: [], canvasWidth: 3000, canvasHeight: 400, rowHeight: 28, headerHeight: 60,
    enableHourPlanning: true,
  });
  renderer.render();
  const summary = rects.find(r => r.fill.toUpperCase() === SUMMARY_FILL);
  return { renderer, summaryRight: summary ? summary.x + summary.w : undefined };
}

// ── 1. Dagkind en urenkind eindigen op dezelfde dag (het gerapporteerde geval) ──
{
  S().newProject();
  S().setUI({ enableHourPlanning: true });
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Gemengde fase' });
  const hourCal = S().addCalendar({ name: 'Kraan (uren)', description: '', ...hourCalendarFields } as Omit<WorkCalendar, 'id'>);
  const F = S().addTask({ name: 'Fase' });
  const D = S().addTask({ name: 'Dagtaak', parentId: F, time: { scheduleDuration: 5 } as TaskTime });
  const H = S().addTask({ name: 'Urentaak', parentId: F, calendarId: hourCal, time: { durationUnit: 'hours', durationMinutes: 37 * 60 } as TaskTime });
  S().runCPM();
  eq('1 opzet: dagkind eindigt 05-06, urenkind 05-06 13:00',
    [taskOf(D).time.earlyFinish, taskOf(H).time.earlyFinish], ['2026-06-05', '2026-06-05T13:00']);
  const f = taskOf(F);
  eq('1a fase-einde = het einde van de dag van het dagkind', f.time.earlyFinish, '2026-06-05');
  // Laatste einde: het latere van de twee late einden, als tijdstip.
  const lateD = taskOf(D).time.lateFinish;
  const lateH = taskOf(H).time.lateFinish;
  const latestLate = finishInstant(lateD) >= finishInstant(lateH) ? lateD : lateH;
  eq('1b fase-Laatste einde = het laatste late einde als tijdstip', f.time.lateFinish, latestLate);
  eq('1c afgeleide faseduur blijft 5d', [f.time.durationUnit, f.time.scheduleDuration], ['days', 5]);
  const { renderer, summaryRight } = render();
  near('1d fasebalk eindigt waar de balk van het dagkind eindigt', summaryRight, renderer.getTaskBarRect(D)?.right);
}

// ── 2. Fase met een uur-START en een dag-EINDE (ook vóór de fix al mogelijk) ──
// H (1 werkdag op de uurkalender) op ma 01-06, D (4d) daarna. Fase: ES "…T08:00", EF = einde van D (zonder tijd).
{
  S().newProject();
  S().setUI({ enableHourPlanning: true });
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Gemengde fase 2' });
  const hourCal = S().addCalendar({ name: 'Kraan (uren)', description: '', ...hourCalendarFields } as Omit<WorkCalendar, 'id'>);
  const F = S().addTask({ name: 'Fase' });
  const H = S().addTask({ name: 'Urentaak', parentId: F, calendarId: hourCal, time: { durationUnit: 'hours', durationMinutes: 8 * 60 } as TaskTime });
  const D = S().addTask({ name: 'Dagtaak', parentId: F, time: { scheduleDuration: 4 } as TaskTime });
  S().addSequence({ predecessorId: H, successorId: D, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const f = taskOf(F);
  eq('2 opzet: fase start met tijd en eindigt zonder tijd (op het einde van het dagkind)',
    [f.time.earlyStart, f.time.earlyFinish.includes('T'), f.time.earlyFinish], ['2026-06-01T08:00', false, taskOf(D).time.earlyFinish]);
  const { renderer, summaryRight } = render();
  near('2a fasebalk eindigt waar de balk van het dagkind eindigt (niet een dag eerder)', summaryRight, renderer.getTaskBarRect(D)?.right);
}

// ── 3. Uur-PROJECTkalender, dagkind op een eigen dagkalender ─────────────────
// De afgeleide faseduur rekent in de projectkalender (uren): tot het einde van de dag van het
// dagkind is dat 5 × 8 = 40 uur, niet 37 (einde urenkind) en niet 32 (dag-einde als middernacht).
{
  S().newProject();
  S().setUI({ enableHourPlanning: true });
  S().setCalendar({ ...S().calendar, ...hourCalendarFields } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Gemengde fase 3' });
  const dayCal = S().addCalendar({ name: 'Dagen', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] } as Omit<WorkCalendar, 'id'>);
  const F = S().addTask({ name: 'Fase' });
  const D = S().addTask({ name: 'Dagtaak', parentId: F, calendarId: dayCal, time: { scheduleDuration: 5 } as TaskTime });
  const H = S().addTask({ name: 'Urentaak', parentId: F, time: { durationUnit: 'hours', durationMinutes: 37 * 60 } as TaskTime });
  S().runCPM();
  eq('3 opzet: dagkind eindigt 05-06, urenkind 05-06 13:00',
    [taskOf(D).time.earlyFinish, taskOf(H).time.earlyFinish], ['2026-06-05', '2026-06-05T13:00']);
  const f = taskOf(F);
  eq('3a fase-einde = het einde van de dag van het dagkind', f.time.earlyFinish, '2026-06-05');
  eq('3b afgeleide faseduur (uur-projectkalender) = 40 uur', [f.time.durationUnit, f.time.durationMinutes], ['hours', 40 * 60]);
}

if (diffs.length === 0) {
  console.log(`OK  summary-mixed-finish: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  summary-mixed-finish: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
