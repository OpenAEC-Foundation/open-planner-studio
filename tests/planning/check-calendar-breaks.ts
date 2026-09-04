// K2 — eenvoudig scalar-pauzepatroon. Dit bewaakt de ene gedeelde afleiding, IFC-round-trip en
// document/undo-gedrag; de browsertest bewaakt vervolgens de bedieningsvorm zelf.
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { calendarForEngine, effectiveWorkTimeBands, scalarBreakIssue } from '@/utils/effectiveWorkTime';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultProject } from '@/state/defaults';
import { createAppStoreContext } from '@/state/appStore';
import type { WorkCalendar } from '@/types/calendar';

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function equal(label: string, got: unknown, want: unknown): void {
  checks++;
  if (got !== want) failures.push(`${label}: verwacht ${String(want)}, kreeg ${String(got)}`);
}

function scalar(patch: Partial<WorkCalendar> = {}): WorkCalendar {
  return {
    id: 'break-cal', name: 'Pauzekalender', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [], ...patch,
  };
}

const lunch = scalar({ simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60 });
same('07-16 + 12:00/60m leidt twee verwachte banden af', effectiveWorkTimeBands(lunch)?.byWeekday[1], [
  { start: 420, end: 720 }, { start: 780, end: 960 },
]);

const halfHour = scalar({
  workStartHour: 9, workEndHour: 17, hoursPerDay: 7.5,
  simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 30,
});
same('09-17 + 12:00/30m leidt twee verwachte banden af', effectiveWorkTimeBands(halfHour)?.byWeekday[1], [
  { start: 540, end: 720 }, { start: 750, end: 1020 },
]);
same('duur 0 is expliciet één doorlopende band', effectiveWorkTimeBands(scalar({
  simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 0,
}))?.byWeekday[1], [{ start: 420, end: 960 }]);
same('legacy scalar zonder velden houdt de historische middagafleiding', effectiveWorkTimeBands(scalar())?.byWeekday[1], [
  { start: 420, end: 720 }, { start: 780, end: 960 },
]);

const manual = scalar({
  simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60,
  workTime: { byWeekday: {
    1: [{ start: 480, end: 720 }, { start: 750, end: 960 }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [],
  } },
});
same('expliciete weekbanden blijven absoluut leidend', effectiveWorkTimeBands(manual)?.byWeekday[1], [
  { start: 480, end: 720 }, { start: 750, end: 960 },
]);
equal('pauze buiten werkdag wordt afgewezen', scalarBreakIssue(420, 960, 930, 60), 'outsideWorkingDay');
equal('pauze die hele dag inneemt wordt afgewezen', scalarBreakIssue(420, 960, 420, 540), 'consumesWorkingDay');

const engine = new CalendarEngine(calendarForEngine(lunch));
equal('urentaakberekening slaat lunch over', formatInstant(
  engine.addWorkMinutes(parseInstant('2026-07-06T11:00'), 120),
  'hour',
), '2026-07-06T14:00');

const project = { ...createDefaultProject(), calendarId: lunch.id, startDate: '2026-07-06' };
const ifc = writeIFC({ project, calendar: lunch, tasks: [], sequences: [], resources: [], assignments: [] });
equal('IFC schrijft pauzebegin als expliciete metadata', ifc.includes("'SimpleBreakStart'"), true);
equal('IFC schrijft pauzeduur als expliciete metadata', ifc.includes("'SimpleBreakDuration'"), true);
const reloaded = readIFC(ifc).calendar;
same('IFC round-trip behoudt pauzepatroon', {
  start: reloaded.simpleBreakStartMinute, duration: reloaded.simpleBreakDurationMinutes,
}, { start: 720, duration: 60 });
same('IFC round-trip behoudt effectieve lunchbanden', effectiveWorkTimeBands(reloaded)?.byWeekday[1], [
  { start: 420, end: 720 }, { start: 780, end: 960 },
]);

const store = createAppStoreContext().store;
const initial = createDefaultCalendar();
store.getState().setCalendar({ ...initial, simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60 });
equal('store houdt pauzeduur vast', store.getState().calendar.simpleBreakDurationMinutes, 60);
store.getState().undo();
equal('undo herstelt kalender zonder nieuwe velden', store.getState().calendar.simpleBreakDurationMinutes, undefined);
store.getState().redo();
equal('redo herstelt pauzeduur', store.getState().calendar.simpleBreakDurationMinutes, 60);
const firstDoc = store.getState().activeDocumentId;
store.getState().newDocument();
store.getState().switchDocument(firstDoc);
equal('documentwissel bewaart pauzepatroon', store.getState().calendar.simpleBreakStartMinute, 720);

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`OK calendar-breaks: ${checks} controles groen`);
}
