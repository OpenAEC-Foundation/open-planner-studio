// F4b (spec "alleen uren" §3.12, B8, B1a, B2): wat een planner als duur typt.
//
//  - "5d" is in het OPS-profiel de dagenmaat, "40u" de urenmaat; onder P6/MSP is "d" de urenmaat.
//  - Een kaal getal houdt de maat van de taak, in de eenheid die het veld toont.
//  - Breuken ("2,5", "2.5d", "1,5u") zijn voor iedereen te typen (de schakelaar Urenplanning is weg).
//  - Vast werk is altijd urenmaat: "5d" wordt 5 × de werktijd per dag (B1a).
//  - Een eenheidswissel houdt het eindmoment, ook met een breuk (B1).
// Paneel, dialoog en raster delen `parseTaskDurationInput`; het raster leest hem via de Duur-kolom.
import './domStub';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { parseDuration } from '@/utils/durationFormat';
import {
  convertTaskDurationUnit, formatTaskDurationInput, parseTaskDurationInput, type ParsedTaskDuration,
} from '@/utils/taskDurationInput';
import { effectiveDurationDisplay, formatTaskDurationText, profileCountsWorkdays } from '@/utils/taskDuration';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import type { TaskColumnContext } from '@/types/taskGrid';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

const days = (n: number, explicitUnit = true): ParsedTaskDuration => ({ unit: 'days', scheduleDuration: n, explicitUnit });
const hours = (minutes: number, explicitUnit = true): ParsedTaskDuration => ({ unit: 'hours', durationMinutes: minutes, explicitUnit });

// ── 1. B8 in het OPS-profiel (dagenmaat aan) ─────────────────────────────────────────────────────
const OPS = { dayMeasure: true, hoursPerDay: 8 } as const;
same('OPS "5d" = dagenmaat 5', parseTaskDurationInput('5d', 'hours', OPS), days(5));
same('OPS "40u" = urenmaat 40 u', parseTaskDurationInput('40u', 'days', OPS), hours(2400));
same('OPS "40h" = urenmaat 40 u', parseTaskDurationInput('40h', 'days', OPS), hours(2400));
same('OPS kaal "3" op een dagenmaat-taak = 3 d', parseTaskDurationInput('3', 'days', OPS), days(3, false));
same('OPS kaal "3" op een urenmaat-taak = 3 u', parseTaskDurationInput('3', 'hours', OPS), hours(180, false));
// Breuken (B2: voor iedereen), met punt en komma.
same('breuk "2,5d"', parseTaskDurationInput('2,5d', 'days', OPS), days(2.5));
same('breuk "2.5d"', parseTaskDurationInput('2.5d', 'days', OPS), days(2.5));
same('breuk kaal "2,5" op een dagenmaat-taak', parseTaskDurationInput('2,5', 'days', OPS), days(2.5, false));
same('breuk "0,25 days"', parseTaskDurationInput('0,25 days', 'hours', OPS), days(0.25));
same('breuk "1,5u" = 90 min', parseTaskDurationInput('1,5u', 'days', OPS), hours(90));
same('"2h 30m" = 150 min', parseTaskDurationInput('2h 30m', 'days', OPS), hours(150));
same('zes decimalen: "1,2345678d"', parseTaskDurationInput('1,2345678d', 'days', OPS), days(1.234568));
same('negatief geweigerd', parseTaskDurationInput('-2,5d', 'days', OPS), null);
same('onzin geweigerd', parseTaskDurationInput('2,5,5d', 'days', OPS), null);
same('onveilig groot geweigerd', parseTaskDurationInput('999999999999999999999d', 'days', OPS), null);
// Zonder context leest de parser zoals het OPS-profiel.
same('zonder context "5d" = dagenmaat', parseTaskDurationInput('5d', 'hours'), days(5));

// ── 2. B8 onder P6/MSP (dagenmaat uit): "d" is de urenmaat ───────────────────────────────────────
const P6 = { dayMeasure: false, hoursPerDay: 8 } as const;
same('P6 "5d" = urenmaat 5 × 8 u', parseTaskDurationInput('5d', 'days', P6), hours(2400));
same('P6 "2,5d" = 20 u', parseTaskDurationInput('2,5d', 'hours', P6), hours(1200));
same('P6 "5d" op 7,5 u per dag = 37,5 u', parseTaskDurationInput('5d', 'hours', { dayMeasure: false, hoursPerDay: 7.5 }), hours(2250));
same('P6 kaal "3" houdt de dagenmaat van de taak', parseTaskDurationInput('3', 'days', P6), days(3, false));
same('P6 kaal "3" op een urentaak die in d getoond wordt = 24 u',
  parseTaskDurationInput('3', 'hours', { ...P6, shownUnit: 'days' }), hours(1440, false));
same('P6 kaal "12" op een dagtaak die in u getoond wordt = 1,5 d',
  parseTaskDurationInput('12', 'days', { ...P6, shownUnit: 'hours' }), days(1.5, false));

// ── 3. Profielregels: welk profiel telt de dagenmaat, en B9 ──────────────────────────────────────
same('OPS-profiel telt de dagenmaat', profileCountsWorkdays({ schedulingProfile: { baseId: 'ops', id: 'ops', name: '', overrides: {} } }), true);
same('zonder profiel (nieuw OPS-project) telt de dagenmaat', profileCountsWorkdays({}), true);
same('P6-profiel telt geen dagenmaat', profileCountsWorkdays({ schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} } }), false);
same('MSP-profiel telt geen dagenmaat', profileCountsWorkdays({ schedulingProfile: { baseId: 'msproject', id: 'msproject', name: '', overrides: {} } }), false);
same('B9: Altijd uren telt niet in OPS', effectiveDurationDisplay('hours', true), 'auto');
same('B9: Altijd uren werkt onder P6', effectiveDurationDisplay('hours', false), 'hours');

// ── 4. Bewerktekst ───────────────────────────────────────────────────────────────────────────────
function task(time: Partial<Task['time']>, extra: Partial<Task> = {}): Task {
  return {
    id: 't', name: 'T', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], activityCodes: {}, customFields: {},
    time: { ...createDefaultTaskTime('2026-06-01T07:00', 5), ...time },
    ...extra,
  } as Task;
}
const day25 = task({ durationUnit: 'days', scheduleDuration: 2.5 });
const hour40 = task({ durationUnit: 'hours', durationMinutes: 2400, scheduleDuration: 5 });
same('bewerktekst 2,5 d', formatTaskDurationInput(day25), '2.5');
same('bewerktekst zonder floatruis', formatTaskDurationInput(task({ durationUnit: 'days', scheduleDuration: 0.1 + 0.2 })), '0.3');
same('bewerktekst 40 u', formatTaskDurationInput(hour40), '40');
same('bewerktekst 40 u in d getoond (P6, Altijd dagen)', formatTaskDurationInput(hour40, { shownUnit: 'days', hoursPerDay: 8 }), '5');
same('weergave 2,5 d in nl', formatTaskDurationText(day25, 8, { locale: 'nl', suffixes: { day: 'd', hour: 'u', minute: 'm' } }), '2,5d');

// ── 5. De Duur-kolom van het raster leest dezelfde regel ─────────────────────────────────────────
const registry = buildTaskColumnRegistry({ projectId: 'p', activityCodeTypes: [], customFieldDefs: [], baselines: [] });
const durationColumn = registry.find(d => String(d.id) === 'task.time.scheduleDuration')!;
function gridContext(workdayDurationMeasure: boolean, durationDisplay: 'auto' | 'days' | 'hours' = 'auto'): TaskColumnContext {
  return {
    projectId: 'p', tasksById: new Map(), relationIndex: { byTaskId: new Map() } as unknown as TaskColumnContext['relationIndex'],
    assignmentsByTaskId: new Map(), resourcesById: new Map(), baselinesById: new Map(), scheduleStale: false,
    effectiveHoursPerDay: () => 8, workdayDurationMeasure, durationDisplay, numberLocale: 'nl',
  };
}
const gridParse = (text: string, t: Task, ctx: TaskColumnContext) => {
  const r = durationColumn.parse!(text, t, ctx);
  return r.ok ? r.value : null;
};
same('raster OPS "2,5" op een dagenmaat-taak', gridParse('2,5', day25, gridContext(true)), days(2.5, false));
same('raster OPS "5d" op een urenmaat-taak', gridParse('5d', hour40, gridContext(true)), days(5));
same('raster P6 "5d" = 40 u', gridParse('5d', day25, gridContext(false)), hours(2400));
same('raster P6 Altijd dagen: kaal "3" op een urentaak = 24 u', gridParse('3', hour40, gridContext(false, 'days')), hours(1440, false));
same('raster legacy "2d 4u" blijft minuten', gridParse('2d 4u', day25, gridContext(true)), 1200);
same('raster bewerktekst in nl', durationColumn.editText!(day25, gridContext(true)), '2,5');
same('raster bewerktekst P6 Altijd dagen op een urentaak', durationColumn.editText!(hour40, gridContext(false, 'days')), '5');
same('raster kopieertekst 2,5 d', durationColumn.copy(day25, gridContext(true)), '2.5d');
same('raster kopieertekst onder P6: een dagenmaat-taak gaat als uren', durationColumn.copy(day25, gridContext(false)), '20h');
const validated = durationColumn.validate!(days(2.5), day25, gridContext(true));
same('raster validatie laat een breuk door', validated.ok, true);

// ── 6. Samengestelde invoer (`parseDuration`) leest breuken ──────────────────────────────────────
same('parseDuration "2.5d"', parseDuration('2.5d', 8), 1200);
same('parseDuration "1,5u"', parseDuration('1,5u', 8), 90);
same('parseDuration kaal "2.5"', parseDuration('2.5', 8), 1200);
same('parseDuration "1,5d 2u"', parseDuration('1,5d 2u', 8), 840);
same('parseDuration "4h30" blijft fout', parseDuration('4h30', 8), null);

// ── 7. B1a in de store: vast werk is altijd urenmaat ─────────────────────────────────────────────
const weekdays = (b: { start: number; end: number }[], fri = b): WorkTimeBands => ({ byWeekday: { 1: b, 2: b, 3: b, 4: b, 5: fri, 6: [], 7: [] } });
const sample: WorkCalendar = {
  id: 'cal-week', name: 'Voorbeeldweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [],
  workTime: weekdays([{ start: 420, end: 720 }, { start: 780, end: 960 }], [{ start: 420, end: 720 }, { start: 780, end: 840 }]),
};
{
  const { store } = createAppStoreContext();
  store.getState().setCalendar(sample);
  const id = store.getState().addTask({ name: 'Vast werk' });
  store.getState().updateTask(id, { workRule: 'FIXED_WORK' });
  const before = store.getState().tasks.find(t => t.id === id)!;
  const parsed = parseTaskDurationInput('5d', before.time.durationUnit, { dayMeasure: true, hoursPerDay: 8 })!;
  // Dezelfde patch als het duurveld (`TaskDurationField.apply`).
  store.getState().updateTask(id, { time: { ...before.time, durationUnit: 'days', scheduleDuration: parsed.scheduleDuration!, durationMinutes: undefined } });
  const after = store.getState().tasks.find(t => t.id === id)!;
  same('B1a: "5d" bij vast werk wordt urenmaat', after.time.durationUnit, 'hours');
  same('B1a: "5d" bij vast werk = 5 × 8 u', after.time.durationMinutes, 2400);
  same('B1a: weergave daarna "40u"', formatTaskDurationText(after, 8, { suffixes: { day: 'd', hour: 'u', minute: 'm' } }), '40u');
}
{
  const { store } = createAppStoreContext();
  store.getState().setCalendar(sample);
  const id = store.getState().addTask({ name: 'Dagenmaat' });
  const before = store.getState().tasks.find(t => t.id === id)!;
  store.getState().updateTask(id, { time: { ...before.time, durationUnit: 'days', scheduleDuration: 2.5, durationMinutes: undefined } });
  const after = store.getState().tasks.find(t => t.id === id)!;
  same('store bewaart een breuk in de dagenmaat', [after.time.durationUnit, after.time.scheduleDuration], ['days', 2.5]);
}

// ── 8. Een eenheidswissel houdt het eindmoment (B1: een breuk mag) ───────────────────────────────
const engine = new CalendarEngine(calendarForEngine(sample));
same('voorbeeldweek: werktijd per dag', engine.hoursPerDay, 8);
same('dagen ⇒ uren: 5 d vanaf ma 07:00 = 38 u (korte vrijdag)',
  convertTaskDurationUnit(task({ durationUnit: 'days', scheduleDuration: 5 }), 'hours', sample), hours(2280));
same('dagen ⇒ uren: 2,5 d vanaf ma 07:00 = 20 u',
  convertTaskDurationUnit(task({ durationUnit: 'days', scheduleDuration: 2.5 }), 'hours', sample), hours(1200));
same('uren ⇒ dagen: 12 u vanaf ma 07:00 = 1,5 d',
  convertTaskDurationUnit(task({ durationUnit: 'hours', durationMinutes: 720, scheduleDuration: 1.5 }), 'days', sample), days(1.5));
same('uren ⇒ dagen: 24 u vanaf di 11:00 = 3,166667 d (vr telt 6 u)',
  convertTaskDurationUnit(task({ durationUnit: 'hours', durationMinutes: 1440, scheduleDuration: 3,
    scheduleStart: '2026-06-02T11:00', earlyStart: '2026-06-02T11:00' }), 'days', sample), days(3.166667));
const standard: WorkCalendar = { id: 'std', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [] };
same('scalaire standaardkalender: 12 u ⇒ 1,5 d (geen blokkade meer)',
  convertTaskDurationUnit(task({ durationUnit: 'hours', durationMinutes: 720, scheduleDuration: 1.5 }), 'days', standard), days(1.5));

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ${f}`);
  console.log(`\n${failures.length}/${checks} F4b-maatinvoerchecks mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b-maatinvoer: ${checks} checks groen.`);
