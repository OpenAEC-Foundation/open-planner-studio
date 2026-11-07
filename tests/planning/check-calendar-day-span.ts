// Kolom Kalenderdagen (issue #817, deel A; besluit eigenaar 2026-11-07).
//
// De telling: kalenderdagen van de GETOONDE startdag tot en met de GETOONDE einddag, weekenden en
// feestdagen inbegrepen. Inclusief tellen (zelfde dag = 1); een nulduur-mijlpaal en een taak met een
// einde dat niet na de start ligt = 0; geen start of einde = leeg. De dagen zijn de datumdelen van
// wat de kolommen Start en Einde tonen (regel B4), zodat het getal klopt met wat de planner ziet.
// Deze check legt de rekenregel (`taskCalendarDaySpan`) en de cel/kopieertekst in het raster vast.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { taskCalendarDaySpan } from '@/utils/calendarDaySpan';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { shownFinish, shownStart } from '@/utils/taskDates';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// ── Project op de standaardkalender (ma–vr 07:00–16:00), zonder feestdagen ──
const standard: WorkCalendar = { ...createDefaultCalendar(2026), holidays: [] };
S().newProject();
S().setCalendar(standard);
S().setProject({ startDate: '2026-11-02', name: 'Kalenderdagen' });

const A = S().addTask({ name: 'A ma + 10 werkdagen', time: { scheduleDuration: 10 } as TaskTime });
const F = S().addTask({ name: 'F fase' });
const P = S().addTask({ name: 'P voorbereiding 2 dagen', time: { scheduleDuration: 2 } as TaskTime });
const B = S().addTask({ name: 'B wo + 10 werkdagen', time: { scheduleDuration: 10 } as TaskTime });
const D = S().addTask({ name: 'D één dag', time: { scheduleDuration: 1 } as TaskTime });
const M = S().addTask({ name: 'M mijlpaal', isMilestone: true });
const E = S().addTask({ name: 'E kalendertijd 3 dagen', time: { scheduleDuration: 3, durationType: 'ELAPSEDTIME' } as TaskTime });
S().addSequence({ predecessorId: P, successorId: B, type: 'FINISH_START', lagDays: 0 });
S().runCPM();

const task = (id: string): Task => S().tasks.find(t => t.id === id)!;
const cal = (t: Task): WorkCalendar => effectiveCalendarOf(t, S().calendar, S().calendars);
const span = (id: string): number | undefined => taskCalendarDaySpan(task(id), cal(task(id)));

eq('A: start ma 2-11', shownStart(task(A)).slice(0, 10), '2026-11-02');
eq('A: einde vr 13-11', shownFinish(task(A)).slice(0, 10), '2026-11-13');
eq('A: ma 2-11 t/m vr 13-11 = 12', span(A), 12);
eq('B: start wo 4-11', shownStart(task(B)).slice(0, 10), '2026-11-04');
eq('B: einde di 17-11', shownFinish(task(B)).slice(0, 10), '2026-11-17');
eq('B: wo 4-11 t/m di 17-11 = 14', span(B), 14);
eq('D: start en einde op één dag = 1', span(D), 1);
eq('M: nulduur-mijlpaal = 0', span(M), 0);
eq('E: kalendertijd 3 dagen = 3 kalenderdagen', span(E), 3);

// ── Verzameltaak: P en B onder fase F; haar getoonde span is die van de kinderen ──
S().indentTasks([P, B]);
S().runCPM();
const phase = task(F);
if (phase.childIds.length === 2) {
  eq('F: fase ma 2-11 t/m di 17-11 = 16', span(F), 16);
} else {
  diffs.push(`F: fase heeft geen twee kinderen (${phase.childIds.length}); controleer de opbouw van de check`);
}

// ── Gestarte taak: de werkelijke start telt (vr 30-10), het einde blijft het berekende ──
const a = task(A);
const started: Task = { ...a, time: { ...a.time, actualStart: '2026-10-30T07:00', completion: 0.5 } };
eq('gestart: shownStart is de werkelijke start', shownStart(started), '2026-10-30T07:00');
eq('gestart: vr 30-10 t/m vr 13-11 = 15', taskCalendarDaySpan(started, standard), 15);

// ── Einde niet na start: 0; geen start of einde: leeg ──
// Besluit eigenaar 2026-11-07 (review PR #834): een taak zonder lengte is een moment en telt 0, niet 1,
// ook zonder mijlpaalvinkje. Zo staat er geen 1 naast "Duur 0d".
const flat: Task = { ...a, time: { ...a.time, earlyStart: '2026-11-03T10:00', earlyFinish: '2026-11-03T10:00' } };
eq('einde gelijk aan start (geen mijlpaal) = 0', taskCalendarDaySpan(flat, standard), 0);
const backwards: Task = { ...a, time: { ...a.time, earlyStart: '2026-11-05T10:00', earlyFinish: '2026-11-03T10:00' } };
eq('einde vóór start = 0', taskCalendarDaySpan(backwards, standard), 0);
const noDates: Task = { ...a, time: { ...a.time, earlyStart: '', scheduleStart: '', earlyFinish: '', scheduleFinish: '' } };
eq('geen start of einde = leeg', taskCalendarDaySpan(noDates, standard), undefined);
const noFinish: Task = { ...a, time: { ...a.time, earlyFinish: '', scheduleFinish: '' } };
eq('geen einde = leeg', taskCalendarDaySpan(noFinish, standard), undefined);

// ── Einde op de 24:00-grens: hoort bij de werkdag ervoor ──
const allDay = [{ start: 0, end: 24 * 60 }];
const day24: WorkCalendar = {
  ...standard, id: 'cal-24', name: '24 uur', workStartHour: 0, workEndHour: 24, hoursPerDay: 24,
  workTime: { byWeekday: { 1: allDay, 2: allDay, 3: allDay, 4: allDay, 5: allDay, 6: [], 7: [] } },
} as WorkCalendar;
const edge: Task = { ...a, time: { ...a.time, earlyStart: '2026-11-02T00:00', earlyFinish: '2026-11-07T00:00' } };
eq('24-uurskalender: einde za 00:00 is vr, ma t/m vr = 5', taskCalendarDaySpan(edge, day24), 5);
// Zonder kalender telt de kalendertijd-klok: een einde om 00:00 hoort bij de vorige dag.
const midnight: Task = { ...a, time: { ...a.time, earlyStart: '2026-11-02T07:00', earlyFinish: '2026-11-14T00:00' } };
eq('zonder kalender: einde za 00:00 is vr, ma t/m vr 13-11 = 12', taskCalendarDaySpan(midnight), 12);
// Een moment midden op de dag telt met zijn klokdatum.
const midday: Task = { ...a, time: { ...a.time, earlyStart: '2026-11-02T07:00', earlyFinish: '2026-11-04T12:00' } };
eq('einde wo 12:00 = ma t/m wo = 3', taskCalendarDaySpan(midday, standard), 3);

// ── Register: kolom bestaat, is berekend en alleen-lezen, en zit niet in de standaardset ──
const registry = buildTaskColumnRegistry({ projectId: S().project.id, activityCodeTypes: [], customFieldDefs: [], baselines: [] });
const descriptor = registry.find(column => column.id === taskColumnId('task.time.calendarDays'));
eq('register: kolom bestaat', descriptor !== undefined, true);
eq('register: categorie berekend', descriptor?.category, 'computed');
eq('register: alleen-lezen', descriptor?.readOnly, true);
eq('register: getal', descriptor?.valueKind, 'number');
eq('register: labelsleutel', descriptor?.labelKey, 'taskGrid.columns.calendarDays');

// ── Cel en kopieertekst zoals FullTaskGrid ze bouwt ──
function cell(taskId: string, column = 'task.time.calendarDays'): { text?: string; copyText?: string; readOnly?: boolean } {
  const s = S();
  const adapter = createTaskGridAdapter({
    projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
    assignments: s.assignments, resources: s.resources, baselines: s.baselines,
    activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
    scheduleStale: s.scheduleStale, wbsAutoNumber: false,
    effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
    effectiveCalendar: t => effectiveCalendarOf(t, s.calendar, s.calendars),
    labelForColumn: k => k,
    labelForText: k => k,
    dateNotation: 'dmy',
    numberLocale: 'nl',
    surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: [],
  });
  const row = s.viewRows.find(r => r.kind === 'task' && r.task.id === taskId)!;
  const c = adapter.getCell(row.rowKey, taskColumnId(column));
  return { text: c?.text, copyText: c?.copyText, readOnly: c?.readOnly };
}
eq('cel A: kaal getal', cell(A), { text: '12', copyText: '12', readOnly: true });
eq('cel M: mijlpaal 0', cell(M), { text: '0', copyText: '0', readOnly: true });
eq('cel F: fase', cell(F).text, '16');

// ── Het getal volgt de dagen die de cellen Start en Einde tonen (notatie dmy: dd-mm-jjjj) ──
const cellDay = (text: string | undefined): number => {
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(text ?? '');
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86_400_000 : NaN;
};
for (const [name, id] of [['A', A], ['B', B], ['D', D], ['E', E], ['F', F]] as const) {
  const startText = cell(id, 'task.time.start').text;
  const finishText = cell(id, 'task.time.finish').text;
  eq(`${name}: telling = Start-cel ${startText} t/m Einde-cel ${finishText}`,
    span(id), cellDay(finishText) - cellDay(startText) + 1);
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-calendar-day-span: ${diffs.length} fout(en) in ${checks} controles`);
  process.exit(1);
}
console.log(`check-calendar-day-span: ${checks} controles groen`);
