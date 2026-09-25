// Eén duur-celtekst voor taakraster, Gantt-afdruk/PDF en tooltip (audit weergaven, bevinding 7).
//
// AANLEIDING. Drie formatters voor dezelfde "Duur":
//  - tooltip en balklabels: `formatTaskDurationDisplay` — eigen taakeenheid + instelling Duurweergave;
//  - taakraster: een eigen tekst in de eigen eenheid, ZONDER Duurweergave (met "Altijd uren" bleef
//    een dagtaak "2d" terwijl de tooltip "18h(2d)" zei);
//  - Gantt-afdruk: altijd `scheduleDuration` in dagen — een urentaak van 5h stond op de PDF als "0,56d".
// De gids belooft: "In Automatisch zie je altijd de gekozen taakeenheid". Nu lezen alle drie
// `formatTaskDurationText` (via `formatTaskDurationDisplay` voor tooltip en afdruk), met het
// decimaalteken van de app-taal. De afdrukkolom wordt gemeten op exact de tekst die getekend wordt.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { effectiveCalendarOf, effHoursPerDay, formatTaskDurationDisplay } from '@/utils/taskDuration';
import {
  buildPrintRows, measureTableColumnWidths, renderReport, type PrintOptions,
} from '@/services/print/printPreview';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';
import type { DurationDisplay } from '@/types/view';
import type { DurationSuffixes } from '@/utils/durationFormat';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const LOCALE = 'nl';
const SUFFIXES: DurationSuffixes = { day: 'd', hour: 'h', minute: 'm' };

// ── Project: 9-uurskalender, een urentaak van 5h, een dagtaak van 2d en een mijlpaal ──
S().newProject();
S().setUI({ enableHourPlanning: true });
const band = [{ start: 8 * 60, end: 17 * 60 }];
S().setCalendar({
  ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 9, workStartHour: 8, workEndHour: 17,
  workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
} as WorkCalendar);
S().setProject({ startDate: '2026-06-01', name: 'Duurtekst' });
const A = S().addTask({ name: 'A stelwerk', time: { durationUnit: 'hours', durationMinutes: 5 * 60 } as TaskTime });
const D = S().addTask({ name: 'D dagtaak', time: { scheduleDuration: 2 } as TaskTime });
const M = S().addTask({ name: 'M oplevering', isMilestone: true });
S().runCPM();

/** De rastercel zoals FullTaskGrid hem bouwt (zelfde domeininput). */
function gridCell(taskId: string, display: DurationDisplay): string | undefined {
  const s = S();
  const adapter = createTaskGridAdapter({
    projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
    assignments: s.assignments, resources: s.resources, baselines: s.baselines,
    activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
    scheduleStale: s.scheduleStale, wbsAutoNumber: false,
    effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
    labelForColumn: k => k,
    labelForText: k => ({ 'duration.suffixDay': SUFFIXES.day, 'duration.suffixHour': SUFFIXES.hour, 'duration.suffixMinute': SUFFIXES.minute } as Record<string, string>)[k] ?? k,
    durationDisplay: display,
    numberLocale: LOCALE,
    surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: [],
  });
  const row = s.viewRows.find(r => r.kind === 'task' && r.task.id === taskId)!;
  return adapter.getCell(row.rowKey, taskColumnId('task.time.scheduleDuration'))?.text;
}

/** De tooltiptekst: dezelfde aanroep als `TaskTooltipContent`. */
function tooltip(taskId: string, display: DurationDisplay): string {
  const s = S();
  const task = s.tasks.find(t => t.id === taskId)!;
  return formatTaskDurationDisplay(task, effectiveCalendarOf(task, s.calendar, s.calendars), display, true, SUFFIXES, LOCALE);
}

/** De Duur-cel per taak in de Gantt-afdruk, plus wat het paneel voor die kolom meet. Zoals in
 *  `ReportPanel`: eerst meten, dan de gemeten breedtes aan de render geven. */
function print(display: DurationDisplay): { drawn: Map<string, string>; measured: Set<string> } {
  const s = S();
  const measured = new Set<string>();
  const columnWidths = measureTableColumnWidths(
    buildPrintRows(s.tasks, s.viewRows),
    { showCompletion: false, dateNotation: 'dmy', numberLocale: LOCALE, durationDisplay: display, durationSuffixes: SUFFIXES, calendar: s.calendar, calendars: s.calendars } as Parameters<typeof measureTableColumnWidths>[1],
    text => { measured.add(text); return text.length * 6; },
  );
  const options = {
    showCritical: true, showFloat: false, showDeps: false, showWeekends: true, showLegend: false,
    showTaskNames: false, showCompletion: false, autoFit: false, customZoom: 20,
    paperSize: 'A3', orientation: 'landscape', companyName: '', barColorSelection: { mode: 'critical' },
    activityCodeTypes: [], customFieldDefs: [], dateNotation: 'dmy', rows: s.viewRows,
    numberLocale: LOCALE, durationDisplay: display, durationSuffixes: SUFFIXES, calendars: s.calendars,
    columnWidths,
  } as unknown as PrintOptions;
  const texts: { text: string; x: number; y: number }[] = [];
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
    closePath: noop, fill: noop, stroke: noop, roundRect: noop,
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y }); },
    measureText: (t: string) => ({ width: t.length * 6 }),
  } as unknown as Draw2D;
  const result = renderReport(() => d2d, s.tasks, s.sequences, s.calendar, 'P', options);
  const drawn = new Map<string, string>();
  for (const task of s.tasks) {
    const nameCell = texts.filter(t => t.text === task.name && t.x < result.tableWidth).sort((a, b) => a.x - b.x)[0];
    if (!nameCell) continue;
    // Tabelrij zonder Volt.-kolom: WBS | naam | duur | start | einde.
    const row = texts.filter(t => Math.abs(t.y - nameCell.y) < 0.5 && t.x < result.tableWidth).sort((a, b) => a.x - b.x);
    drawn.set(task.id, row[2]?.text ?? '<geen duurcel>');
  }
  return { drawn, measured };
}

const expected: Record<DurationDisplay, Record<string, string>> = {
  // Automatisch: altijd de gekozen taakeenheid.
  auto: { [A]: '5h', [D]: '2d', [M]: '0d' },
  // Altijd uren: de dagtaak als uren, met de bron erachter (zoals de tooltip al deed).
  hours: { [A]: '5h', [D]: '18h(2d)', [M]: '0d' },
  // Altijd dagen: de urentaak als dagen met het decimaalteken van de taal.
  days: { [A]: '0,56d(5h)', [D]: '2d', [M]: '0d' },
};
const names: Record<string, string> = { [A]: 'urentaak 5h', [D]: 'dagtaak 2d', [M]: 'mijlpaal' };

for (const display of ['auto', 'hours', 'days'] as DurationDisplay[]) {
  const p = print(display);
  for (const id of [A, D, M]) {
    const want = expected[display][id];
    eq(`${display}: raster ${names[id]}`, gridCell(id, display), want);
    eq(`${display}: tooltip ${names[id]}`, tooltip(id, display), want);
    eq(`${display}: afdruk ${names[id]}`, p.drawn.get(id), want);
    eq(`${display}: afdrukkolom meet de getekende tekst (${names[id]})`, p.measured.has(p.drawn.get(id) ?? ''), true);
  }
}

if (diffs.length === 0) {
  console.log(`OK  duration-cell-text: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  duration-cell-text: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
