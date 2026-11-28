import { renderReport, PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { PRINT_PALETTE } from '@/engine/renderer/themePalette';

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) fail(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const truthy = (label: string, cond: boolean) => {
  if (!cond) fail(`${label}: verwacht waar, kreeg onwaar`);
};

interface RectEv { x: number; y: number; w: number; h: number; fillStyle: string; }

function record(tasks: Task[], calendar: WorkCalendar, options: PrintOptions) {
  const rects: RectEv[] = [];
  const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, fillStyle: st.fillStyle }); },
    strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, roundRect() {},
    fillText() {}, measureText(t) { return { width: t.length * 6 }; },
  };
  const dims = renderReport(() => d2d, tasks, [], calendar, 'P', options);
  return { rects, dims };
}

const task = (id: string, from: string, to: string): Task => ({
  id, name: 'Taak ' + id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  childIds: [], predecessorIds: [], successorIds: [], resourceIds: [], progress: 0,
  time: {
    durationType: 'WORKTIME', scheduleDuration: 1,
    scheduleStart: from, scheduleFinish: to,
    earlyStart: from, earlyFinish: to,
    lateStart: from, lateFinish: to,
    freeFloat: 0, totalFloat: 0, isCritical: true,
  },
} as unknown as Task);

const options: PrintOptions = {
  showCritical: true, showFloat: false, showDeps: false, showWeekends: true,
  showLegend: false, showTaskNames: true, showCompletion: false,
  autoFit: true, customZoom: 1, paperSize: 'A4', orientation: 'landscape',
  companyName: '', labels: {
    noTasks: '-', printed: '-', legend: {} as any, tableHeaders: {} as any,
    today: '-',
  }, locale: 'nl', reportFontScale: 100,
} as PrintOptions;

function shadeCounts(rects: RectEv[]) {
  let weekend = 0, holiday = 0;
  for (const r of rects) {
    if (r.fillStyle === PRINT_PALETTE.gridWeekend) weekend++;
    else if (r.fillStyle === PRINT_PALETTE.gridHoliday) holiday++;
  }
  return { weekend, holiday };
}

const CAL_BASE: Omit<WorkCalendar, 'holidays' | 'workingExceptions'> = {
  id: 'cal', name: 'std', description: '',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
};

console.log('-- print-workingExceptions: werkende zaterdag krijgt geen weekend-arcering --');
{
  const window: [string, string] = ['2026-07-06', '2026-07-12'];
  const calCtrl: WorkCalendar = { ...CAL_BASE, holidays: [] };
  const calExc: WorkCalendar = {
    ...CAL_BASE, holidays: [],
    workingExceptions: [{ name: 'Werkende zaterdag', startDate: '2026-07-11', endDate: '2026-07-11' }],
  };
  const ctrl = shadeCounts(record([task('t1', ...window)], calCtrl, options).rects);
  const exc = shadeCounts(record([task('t1', ...window)], calExc, options).rects);
  truthy('controle heeft minstens 1 weekend-vlak (anders is dit paar zinloos)', ctrl.weekend > 0);
  eq('werkende zaterdag: exact 1 weekend-vlak minder dan de controle (za 11 is nu werkdag)', exc.weekend, ctrl.weekend - 1);
  eq('werkende zaterdag: holiday-telling ongewijzigd (0, geen holidays in dit paar)', exc.holiday, ctrl.holiday);
}

console.log('-- print-workingExceptions: workingException wint van holiday (precedentie) --');
{
  const window: [string, string] = ['2026-07-06', '2026-07-10'];
  const holidays = [{ name: 'Feestdag (wo 8 juli)', startDate: '2026-07-08', endDate: '2026-07-08' }];
  const calHolOnly: WorkCalendar = { ...CAL_BASE, holidays };
  const calHolExc: WorkCalendar = {
    ...CAL_BASE, holidays,
    workingExceptions: [{ name: 'Toch werkend (precedentie)', startDate: '2026-07-08', endDate: '2026-07-08' }],
  };
  const holOnly = shadeCounts(record([task('t1', ...window)], calHolOnly, options).rects);
  const holExc = shadeCounts(record([task('t1', ...window)], calHolExc, options).rects);
  eq('controle: 1 holiday-vlak (wo 8, geen uitzondering)', holOnly.holiday, 1);
  eq('precedentie: 0 holiday-vlakken (uitzondering wint van de holiday)', holExc.holiday, 0);
  eq('precedentie: weekend-telling ongewijzigd t.o.v. de holiday-only-controle (wo 8 is geen weekenddag)', holExc.weekend, holOnly.weekend);
}

if (failures > 0) {
  console.log(`\nXX print-workingExceptions: ${failures} probleem(en)`);
  process.exit(1);
}
console.log('\nOK  print-workingExceptions: alles groen');
