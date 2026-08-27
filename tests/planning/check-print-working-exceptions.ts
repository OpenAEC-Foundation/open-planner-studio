/**
 * Print-voorbeeld & werkende uitzonderingen (fase 3.8, T13-§T2-afwijking, LAAG-7-afnemer).
 *
 * ACHTERGROND. `src/services/print/printPreview.ts` bouwde vóór deze taak een EIGEN, lokale
 * `holidaySet` uit `calendar.holidays` en gebruikte daarnaast een hardgecodeerde
 * `dow === 6 || dow === 7`-weekend-check voor de grid-shading — beide genegeerden
 * `calendar.workingExceptions` (fase 3.8, T2) volledig. Een ingeroosterde werkende zaterdag
 * (bv. een MS Project-import met een `WorkingException`) kreeg zo alsnog de grijze
 * weekend-arcering in het rapport, terwijl de Gantt-canvas (`GanttRenderer`, die al via
 * `CalendarEngine.isWorkDay` tekent) het correct als werkdag toont — printvoorbeeld en scherm
 * liepen uit elkaar. De fix vervangt beide ad-hoc controles door één `CalendarEngine`-instantie
 * (dezelfde bron van waarheid als de solver), zodat `workingExceptions`' precedentie
 * (uitzondering > holiday > gewoon weekpatroon) ook hier geldt.
 *
 * Deze check draait `renderReport` met een OPNEMENDE Draw2D (patroon `check-today-label.ts`) en
 * leest de gevulde rechthoeken op de kolom-x van specifieke datums terug, per kleur
 * (`PRINT_PALETTE.gridWeekend` vs. `gridHoliday` vs. geen van beide).
 */
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
    noTasks: '-', printed: '-', legend: {} as any, tableHeaders: { rowNum: '#' } as any,
    page: '-', of: '-', today: '-',
  }, locale: 'nl', reportFontScale: 100,
} as PrintOptions;

/** Telt hoe vaak elke shading-kleur voorkomt over het hele (met -7/+14 dagen OPGEVULDE, zie
 *  `renderReport`'s `addCalendarDays(minDate,-7)`/`addCalendarDays(maxDate,14)`) venster. Bewust
 *  GEEN poging om de exacte x-kolom van één specifieke datum te reconstrueren (dat zou `zoom`/
 *  `minDate` — beide niet extern zichtbaar — moeten herhalen, en zo'n duplicaat kan zelf afdrijven
 *  van de echte berekening). In plaats daarvan vergelijken de cases hieronder PAREN met en zonder
 *  de te testen uitzondering over IDENTIEKE taak-vensters — de padding-bijdrage is dan voor beide
 *  leden van elk paar gelijk en valt weg in het verschil. Alleen de holiday-telling in geval 3/4
 *  hieronder is een kale `1`: dat is de enige holiday in de hele kalender, dus padding kan er geen
 *  bijmaken. */
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

// ── 1+2. Werkende zaterdag: PAAR met/zonder workingException op HETZELFDE taak-venster. De
//    padding (-7/+14 kalenderdagen) is voor beide leden identiek, dus het verschil isoleert exact
//    het effect van de uitzondering: precies 1 dag minder weekend-shading, 0 holiday-verschil. ───
console.log('-- print-workingExceptions: werkende zaterdag krijgt geen weekend-arcering --');
{
  const window: [string, string] = ['2026-07-06', '2026-07-12']; // ma .. zo, één weekend (za 11, zo 12) erin
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

// ── 3+4. Precedentie: PAAR met/zonder workingException op DEZELFDE holiday-datum, zelfde venster
//    (geen weekend erin, ma 6 .. vr 10) — isoleert het precedentie-effect op de holiday-shading. ──
console.log('-- print-workingExceptions: workingException wint van holiday (precedentie) --');
{
  const window: [string, string] = ['2026-07-06', '2026-07-10']; // ma .. vr, geen weekend in dit venster
  const holidays = [{ name: 'Feestdag (wo 8 juli)', startDate: '2026-07-08', endDate: '2026-07-08' }];
  const calHolOnly: WorkCalendar = { ...CAL_BASE, holidays };
  const calHolExc: WorkCalendar = {
    ...CAL_BASE, holidays,
    workingExceptions: [{ name: 'Toch werkend (precedentie)', startDate: '2026-07-08', endDate: '2026-07-08' }],
  };
  const holOnly = shadeCounts(record([task('t1', ...window)], calHolOnly, options).rects);
  const holExc = shadeCounts(record([task('t1', ...window)], calHolExc, options).rects);
  // Controle (bewijst dat test 4 niet toevallig 0 holiday-vlakken geeft): zónder de workingException
  // is wo 8 de ENIGE holiday in de hele kalender, dus dit is een kale `1` — padding kan er geen
  // bijmaken (er zijn geen andere holidays om in het opgevulde venster te vallen).
  eq('controle: 1 holiday-vlak (wo 8, geen uitzondering)', holOnly.holiday, 1);
  eq('precedentie: 0 holiday-vlakken (uitzondering wint van de holiday)', holExc.holiday, 0);
  eq('precedentie: weekend-telling ongewijzigd t.o.v. de holiday-only-controle (wo 8 is geen weekenddag)', holExc.weekend, holOnly.weekend);
}

if (failures > 0) {
  console.log(`\nXX print-workingExceptions: ${failures} probleem(en)`);
  process.exit(1);
}
console.log('\nOK  print-workingExceptions: alles groen');
