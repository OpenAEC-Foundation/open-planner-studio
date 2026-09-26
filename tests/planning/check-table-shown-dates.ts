// De Tabel toont Start en Einde uit DEZELFDE bron als Gantt, paneel en tooltip (`shownStart`/
// `shownFinish`), en een bewerking verzet alleen iets bij een ECHTE wijziging (audit "weergaven",
// bevinding 2). Tegen de echte store, de echte grid-adapter en de echte commitgrens van de
// celeditor (`commitTaskCellEditorValue` → `runGridMutation`), zoals `FullTaskGrid` die gebruikt.
//
// Vóór de fix stonden `task.time.scheduleStart`/`scheduleFinish` (de invoerankers) in de
// standaardset: de Tabel toonde voor een taak met een voorganger andere datums dan de Gantt-balk,
// en "Gepland einde" van een automatisch geplande taak accepteerde een waarde die na F5 niets deed.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { createTaskGridAdapter, type TaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { commitTaskCellEditorValue } from '@/components/task-grid/TaskCellEditor';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { createDefaultTaskGridPreferences } from '@/engine/taskGrid/preferences';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { signedWorkDaysBetween } from '@/engine/variance';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { shownFinish, shownStart, startAnchorAfterEdit } from '@/utils/taskDates';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

const S = () => useAppStore.getState();
const task = (id: string): Task => S().tasks.find(candidate => candidate.id === id)!;

/** Het raster zoals `FullTaskGrid` het bouwt: dezelfde domeininput, de store als commitdoel. */
function adapter(): TaskGridAdapter {
  const s = S();
  const engine = new CalendarEngine(s.calendar);
  return createTaskGridAdapter({
    surfaceId: 'full-task-grid',
    projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
    assignments: s.assignments, resources: s.resources, baselines: s.baselines,
    activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs,
    customTaskTypes: s.customTaskTypes, scheduleStale: s.scheduleStale,
    wbsAutoNumber: s.project.wbsAutoNumber === true, dateNotation: 'dmy',
    effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
    signedWorkDaysBetween: (a, b) => signedWorkDaysBetween(engine, a, b),
    labelForColumn: key => key,
    rows: s.viewRows,
    selectedTaskIds: [],
    callbacks: {
      onPrepareEdit: () => true,
      onCommitEdit: (_target, intents) => S().runGridMutation(intents),
    },
  });
}

function rowKey(taskId: string): string {
  const row = S().viewRows.find(candidate => candidate.kind === 'task' && candidate.task.id === taskId);
  return row && row.kind === 'task' ? row.rowKey : '';
}

function cell(taskId: string, column: string) {
  return adapter().getCell(rowKey(taskId), taskColumnId(column));
}

/** Typen in de celeditor en Enter: exact de commitgrens van `TaskCellEditor`. */
function type(taskId: string, column: string, text: string) {
  return commitTaskCellEditorValue({
    adapter: adapter(),
    cell: { rowKey: rowKey(taskId), columnId: taskColumnId(column) },
    text,
    messageForError: key => key,
  });
}

/** `2026-06-17` → `17-06-2026`, de dmy-notatie van de editor. */
const dmy = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;

function setup(): { a: string; b: string } {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Tabeldatums' });
  const a = S().addTask({ name: 'A', time: { scheduleDuration: 5 } as Task['time'] });
  const b = S().addTask({ name: 'B', time: { scheduleDuration: 3 } as Task['time'] });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  return { a, b };
}

// ── 1. De standaardset toont de getoonde datums; de invoerankers blijven kiesbaar ────────────────
{
  const defaults = createDefaultTaskGridPreferences({ projectId: 'p', activityCodeTypeIds: [], customFieldDefIds: [] });
  const ids = defaults.surfaces['full-task-grid'].columns.map(column => column.id as string);
  eq('Standaard-Tabel: Start en Einde in plaats van Geplande start/einde',
    ids.slice(0, 5), ['task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.start', 'task.time.finish']);
  ok('Standaard-Tabel bevat de invoerankers niet meer', !ids.includes('task.time.scheduleStart') && !ids.includes('task.time.scheduleFinish'));
  const registry = new Set(buildTaskColumnRegistry({ projectId: 'p', activityCodeTypes: [], customFieldDefs: [], baselines: [] })
    .map(column => column.id as string));
  ok('Geplande start/einde blijven kiesbare kolommen', registry.has('task.time.scheduleStart') && registry.has('task.time.scheduleFinish'));
}

// ── 2. Start/Einde = de datum van de Gantt-balk, ook als een voorganger de taak verschuift ──────
{
  const { b } = setup();
  const tb = task(b);
  ok('Opzet: B hangt achter A, dus getoonde start ≠ anker', shownStart(tb) !== tb.time.scheduleStart);
  eq('Start-cel: waarde = shownStart', cell(b, 'task.time.start')?.value, shownStart(tb));
  eq('Start-cel: tekst = getoonde datum', cell(b, 'task.time.start')?.text, dmy(shownStart(tb)));
  eq('Einde-cel: waarde = shownFinish', cell(b, 'task.time.finish')?.value, shownFinish(tb));
  eq('Einde-cel: tekst = getoonde datum', cell(b, 'task.time.finish')?.text, dmy(shownFinish(tb)));
}

// ── 3. Start bewerken schrijft het anker alleen bij een echte wijziging ─────────────────────────
{
  const { a, b } = setup();
  const before = task(b).time.scheduleStart;
  const shown = shownStart(task(b));
  const same = type(b, 'task.time.start', dmy(shown));
  eq('Start ongewijzigd teruggetypt: commit slaagt', same.ok, true);
  eq('Start ongewijzigd teruggetypt: anker blijft staan (geen drift naar de berekende datum)',
    task(b).time.scheduleStart, before);
  eq('Start ongewijzigd teruggetypt: planning niet verouderd', S().scheduleStale, false);
  eq('Gedeelde helper: gelijk aan getoonde start ⇒ geen nieuw anker', startAnchorAfterEdit(task(b), shown), undefined);
  eq('Gedeelde helper: andere datum ⇒ die datum wordt het anker', startAnchorAfterEdit(task(b), '2026-06-03'), '2026-06-03');

  const moved = type(a, 'task.time.start', '03-06-2026');
  eq('Start van A verzetten: commit slaagt', moved.ok, true);
  eq('Start van A verzetten: anker = ingevoerde datum', task(a).time.scheduleStart, '2026-06-03');
  S().runCPM();
  eq('Start van A na F5 = ingevoerde datum', shownStart(task(a)), '2026-06-03');
  eq('Start-cel van A na F5 toont de nieuwe datum', cell(a, 'task.time.start')?.text, '03-06-2026');
}

// ── 4. Einde bewerken verandert na F5 de planning (automatisch geplande taak) ────────────────────
{
  const { b } = setup();
  const start = shownStart(task(b));
  eq('Opzet: B loopt 08-06 t/m 10-06', [start, shownFinish(task(b))], ['2026-06-08', '2026-06-10']);
  const durationBefore = task(b).time.scheduleDuration;
  const same = type(b, 'task.time.finish', dmy(shownFinish(task(b))));
  eq('Einde ongewijzigd teruggetypt: commit slaagt', same.ok, true);
  eq('Einde ongewijzigd teruggetypt: duur blijft', task(b).time.scheduleDuration, durationBefore);
  eq('Einde ongewijzigd teruggetypt: planning niet verouderd', S().scheduleStale, false);

  const edited = type(b, 'task.time.finish', '17-06-2026');
  eq('Einde → 17-06: commit slaagt', edited.ok, true);
  eq('Einde → 17-06: duur = werkdagen van getoonde start t/m nieuw einde', task(b).time.scheduleDuration, 8);
  S().runCPM();
  eq('Einde na F5 = ingevoerde datum (Gantt-balk)', shownFinish(task(b)), '2026-06-17');
  eq('Start blijft na F5 gelijk', shownStart(task(b)), start);
  eq('Einde-cel na F5 toont de nieuwe datum', cell(b, 'task.time.finish')?.text, '17-06-2026');

  const before = type(b, 'task.time.finish', '01-06-2026');
  eq('Einde vóór de start: geweigerd', before.ok, false);
  eq('Einde vóór de start: eigen reden', !before.ok && before.error.message, 'taskGrid.validation.finishBeforeStart');
  eq('Einde vóór de start: planning onaangeroerd', shownFinish(task(b)), '2026-06-17');
}

// ── 5. "Gepland einde" is alleen-lezen voor niet-handmatige taken, met een duidelijke reden ────
{
  const { b } = setup();
  const finishCell = cell(b, 'task.time.scheduleFinish');
  eq('Gepland einde (automatisch gepland): alleen-lezen', finishCell?.readOnly, true);
  eq('Gepland einde (automatisch gepland): reden in de cel',
    finishCell?.readOnlyReason, 'taskGrid.validation.scheduleFinishNotManual');
  const before = task(b).time.scheduleFinish;
  const typed = type(b, 'task.time.scheduleFinish', '17-06-2026');
  eq('Gepland einde typen: geweigerd', typed.ok, false);
  eq('Gepland einde typen: reden = niet handmatig gepland', !typed.ok && typed.error.message, 'taskGrid.validation.scheduleFinishNotManual');
  eq('Gepland einde typen: niets gewijzigd', task(b).time.scheduleFinish, before);

  // Handmatig geplande taak: het ingevoerde einde IS de planning en blijft dus bewerkbaar.
  const m = S().addTask({ name: 'Handmatig', manuallyScheduled: true, time: { scheduleDuration: 3 } as Task['time'] });
  S().runCPM();
  eq('Gepland einde (handmatig): bewerkbaar', cell(m, 'task.time.scheduleFinish')?.readOnly, false);
  const manual = type(m, 'task.time.scheduleFinish', '12-06-2026');
  eq('Gepland einde (handmatig): commit slaagt', manual.ok, true);
  S().runCPM();
  eq('Gepland einde (handmatig) na F5 = ingevoerde datum', shownFinish(task(m)), '2026-06-12');

  // Einde van een handmatige taak schrijft hetzelfde anker.
  const viaFinish = type(m, 'task.time.finish', '15-06-2026');
  eq('Einde (handmatig): commit slaagt', viaFinish.ok, true);
  eq('Einde (handmatig): schrijft het ingevoerde einde', task(m).time.scheduleFinish, '2026-06-15');
  S().runCPM();
  eq('Einde (handmatig) na F5 = ingevoerde datum', shownFinish(task(m)), '2026-06-15');
}

// ── 6. Afgeleide datums (verzameltaak) zijn alleen-lezen, geen dode invoer ──────────────────────
{
  const { a } = setup();
  const phase = S().addTask({ name: 'Fase' });
  S().moveTask(a, phase);
  S().runCPM();
  eq('Einde van een verzameltaak: alleen-lezen', cell(phase, 'task.time.finish')?.readOnly, true);
  eq('Start van een verzameltaak: alleen-lezen', cell(phase, 'task.time.start')?.readOnly, true);
}

// ── 7. Urentaak: Einde zet de duur in werkminuten ───────────────────────────────────────────────
{
  S().newProject();
  S().setProject({ startDate: '2026-06-01', name: 'Uren' });
  useAppStore.setState(state => { state.ui.enableHourPlanning = true; });
  S().setCalendar({
    ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 8, workStartHour: 8, workEndHour: 16,
    workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }] } },
  } as unknown as WorkCalendar);
  const h = S().addTask({
    name: 'Uren', time: { durationUnit: 'hours', durationMinutes: 240, scheduleDuration: 0.5 } as Task['time'],
  });
  S().runCPM();
  const start = shownStart(task(h));
  eq('Opzet urentaak: start 01-06 08:00, einde 12:00', [start, shownFinish(task(h))], ['2026-06-01T08:00', '2026-06-01T12:00']);
  const edited = type(h, 'task.time.finish', '02-06-2026 10:00');
  eq('Urentaak Einde → 02-06 10:00: commit slaagt', edited.ok, true);
  eq('Urentaak Einde → 02-06 10:00: 8 + 2 werkuren', task(h).time.durationMinutes, 600);
  S().runCPM();
  eq('Urentaak Einde na F5 = ingevoerde tijd', shownFinish(task(h)), '2026-06-02T10:00');
}

if (diffs.length) {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  check-table-shown-dates: ${diffs.length}/${checks} afwijkingen`);
  process.exit(1);
}
console.log(`OK  check-table-shown-dates: ${checks} controles groen`);
