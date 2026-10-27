// F2: verwachtingen volgen D1/D2/D7 op laad- en invoergrenzen (§4.2, §7.2).
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
import {
  computedStart, finishIsActual, shownFinish, shownStart, startAnchorAfterEdit, startIsActual,
} from '@/utils/taskDates';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { selectProfile } from '@/state/schedulingProfileDraft';
import { saveTaskDialog } from '@/state/taskDialogSave';
import { sourceAnchorDate } from '@/engine/externalLinks';
import type { ExternalLink } from '@/types/task';
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
    effectiveCalendar: t => effectiveCalendarOf(t, s.calendar, s.calendars),
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
  eq('Start van A verzetten: anker = ingevoerde datum', task(a).time.scheduleStart, "2026-06-03T07:00");
  S().runCPM();
  eq('Start van A na F5 = ingevoerde datum', shownStart(task(a)), "2026-06-03T07:00");
  eq('Start-cel van A na F5 toont de nieuwe datum', cell(a, 'task.time.start')?.text, '03-06-2026');
}

// ── 4. Einde bewerken verandert na F5 de planning (automatisch geplande taak) ────────────────────
{
  const { b } = setup();
  const start = shownStart(task(b));
  eq('Opzet: B loopt 08-06 t/m 10-06', [start, shownFinish(task(b))], ["2026-06-08T07:00", "2026-06-10T16:00"]);
  const durationBefore = task(b).time.scheduleDuration;
  const same = type(b, 'task.time.finish', dmy(shownFinish(task(b))));
  eq('Einde ongewijzigd teruggetypt: commit slaagt', same.ok, true);
  eq('Einde ongewijzigd teruggetypt: duur blijft', task(b).time.scheduleDuration, durationBefore);
  eq('Einde ongewijzigd teruggetypt: planning niet verouderd', S().scheduleStale, false);

  const edited = type(b, 'task.time.finish', '17-06-2026');
  eq('Einde → 17-06: commit slaagt', edited.ok, true);
  eq('Einde → 17-06: duur = werkdagen van getoonde start t/m nieuw einde', task(b).time.scheduleDuration, 8);
  S().runCPM();
  eq('Einde na F5 = ingevoerde datum (Gantt-balk)', shownFinish(task(b)), "2026-06-17T16:00");
  eq('Start blijft na F5 gelijk', shownStart(task(b)), start);
  eq('Einde-cel na F5 toont de nieuwe datum', cell(b, 'task.time.finish')?.text, '17-06-2026');

  const before = type(b, 'task.time.finish', '01-06-2026');
  eq('Einde vóór de start: geweigerd', before.ok, false);
  eq('Einde vóór de start: eigen reden', !before.ok && before.error.message, 'taskGrid.validation.finishBeforeStart');
  eq('Einde vóór de start: planning onaangeroerd', shownFinish(task(b)), "2026-06-17T16:00");
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
  eq('Gepland einde (handmatig) na F5 = ingevoerde datum', shownFinish(task(m)), "2026-06-12T16:00");

  // Einde van een handmatige taak schrijft hetzelfde anker.
  const viaFinish = type(m, 'task.time.finish', '15-06-2026');
  eq('Einde (handmatig): commit slaagt', viaFinish.ok, true);
  eq('Einde (handmatig): schrijft het ingevoerde einde', task(m).time.scheduleFinish, "2026-06-15T16:00");
  S().runCPM();
  eq('Einde (handmatig) na F5 = ingevoerde datum', shownFinish(task(m)), "2026-06-15T16:00");
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

// ── 8–11. Werkelijke datums (eigenaarsbesluit 2026-10-12, optie 1) ──────────────────────────────
// "Zoals Primavera. Een taak die klaar is, staat op de dagen waarop hij echt gebeurde. Een taak die
// bezig is, begint op de dag waarop hij echt begon. Dat blijft zo, ook na opnieuw berekenen. Je kunt
// dan voor zo'n taak geen nieuwe begindatum meer intypen." Een XER met een voltooide taak (C1,
// fysiek %), een lopende (L1) en een niet-gestarte opvolger (N1); statusdatum ma 02-03 08:00.
// Onder het P6-profiel zet A19 de rekenstart van L1 op de statusdatum en C5 die van C1 ook; onder
// OPS pint de solver de rekenstart op de werkelijke start. De GETOONDE datums zijn in beide gelijk.
function actualsCalendar(): string {
  const day = (n: number) => `(0||${n}()(${n >= 2 && n <= 6 ? '(0||0(s|08:00|f|17:00)())' : ''}))`;
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
}
const ACTUALS_XER = [
  'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${actualsCalendar()}`,
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
  '%R\tP1\tVoortgang\tC1\t2026-03-02 08:00\t2026-01-05 08:00\t2026-06-30 17:00',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  '%R\tTC\tP1\tC1\tC1\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Phys\t90\t0\t2026-01-05 08:00\t2026-01-16 17:00\t2026-01-05 08:00\t2026-01-16 17:00',
  '%R\tTL\tP1\tC1\tL1\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t90\t45\t2026-02-23 08:00\t2026-03-06 17:00\t2026-02-23 08:00\t',
  '%R\tTN\tP1\tC1\tN1\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-03-09 08:00\t2026-03-13 17:00\t\t',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tTN\tTL\tP1\tP1\tPR_FS\t0',
  '%E',
].join('\n');
function openActualsXer(): void {
  const opened: ImportResult | ReturnType<typeof readXER> = readXER(new TextEncoder().encode(ACTUALS_XER));
  if (isMultiDocumentImport(opened)) throw new Error('fixture moet één project openen');
  S().newProject();
  S().applyOpenedImport(opened, { filePath: null, recompute: true });
}
const byCode = (code: string): Task => S().tasks.find(candidate => candidate.wbsCode === code)!;
function switchProfile(baseId: 'p6' | 'ops'): void {
  const s = S();
  s.applySchedulingSettings({
    profile: selectProfile(s.project.schedulingProfile, `builtin:${baseId}`, []),
    options: s.project.schedulingOptions,
  });
}

for (const profile of ['p6', 'ops'] as const) {
  openActualsXer();
  if (profile === 'ops') switchProfile('ops');
  const tag = profile === 'p6' ? 'P6' : 'OPS';
  eq(`8.${tag} opzet: profiel`, S().project.schedulingProfile?.baseId ?? 'ops', profile);
  eq(`8.${tag} opzet: niet in de modus "datums zoals opgeslagen"`, S().datesAsRecorded, false);
  const c1 = byCode('C1');
  const l1 = byCode('L1');
  const n1 = byCode('N1');
  // De rekendatums verschillen per profiel (motor ongewijzigd) …
  if (profile === 'p6') {
    eq('8.P6 rekenstart van de lopende taak = statusdatum (A19)', l1.time.earlyStart, '2026-03-02T08:00');
    ok('8.P6 rekenstart van de voltooide taak ≠ werkelijke start (C5)', c1.time.earlyStart !== c1.time.actualStart);
  } else {
    eq('8.OPS rekenstart van de lopende taak = werkelijke start', l1.time.earlyStart, '2026-02-23T08:00');
  }
  // … de GETOONDE datums niet.
  eq(`8.${tag} voltooid: Start = werkelijke start`, shownStart(c1), '2026-01-05T08:00');
  eq(`8.${tag} voltooid: Einde = werkelijk einde`, shownFinish(c1), '2026-01-16T17:00');
  eq(`8.${tag} lopend: Start = werkelijke start`, shownStart(l1), '2026-02-23T08:00');
  eq(`8.${tag} lopend: Einde = berekend (rest)einde`, shownFinish(l1), l1.time.earlyFinish);
  eq(`8.${tag} niet gestart: Start = rekenstart`, shownStart(n1), n1.time.earlyStart);
  eq(`8.${tag} Tabel-kolom Start (voltooid) = werkelijke start`, cell(c1.id, 'task.time.start')?.value, '2026-01-05T08:00');
  eq(`8.${tag} Tabel-kolom Einde (voltooid) = werkelijk einde`, cell(c1.id, 'task.time.finish')?.value, '2026-01-16T17:00');
  eq(`8.${tag} Tabel-kolom Start (lopend) = werkelijke start`, cell(l1.id, 'task.time.start')?.value, '2026-02-23T08:00');
  eq(`8.${tag} kolom Vroegste start blijft de rekenstart`, cell(l1.id, 'task.time.earlyStart')?.value, l1.time.earlyStart);
  // Na herberekenen blijft het zo.
  S().runCPM();
  eq(`8.${tag} na F5: getoonde datums ongewijzigd`,
    [shownStart(byCode('C1')), shownFinish(byCode('C1')), shownStart(byCode('L1'))],
    ['2026-01-05T08:00', '2026-01-16T17:00', '2026-02-23T08:00']);

  // ── 9. Bewerken: Start van een gestarte en Einde van een voltooide taak zijn alleen-lezen ──
  eq(`9.${tag} predicaten`, [startIsActual(c1), finishIsActual(c1), startIsActual(l1), finishIsActual(l1), startIsActual(n1)],
    [true, true, true, false, false]);
  eq(`9.${tag} Start lopend: alleen-lezen`, cell(l1.id, 'task.time.start')?.readOnly, true);
  eq(`9.${tag} Start lopend: met de reden startIsActual`, cell(l1.id, 'task.time.start')?.readOnlyReason, 'taskGrid.validation.startIsActual');
  eq(`9.${tag} Einde lopend: bewerkbaar`, cell(l1.id, 'task.time.finish')?.readOnly, false);
  eq(`9.${tag} Start voltooid: alleen-lezen`, cell(c1.id, 'task.time.start')?.readOnly, true);
  eq(`9.${tag} Einde voltooid: alleen-lezen met de reden finishIsActual`,
    [cell(c1.id, 'task.time.finish')?.readOnly, cell(c1.id, 'task.time.finish')?.readOnlyReason], [true, 'taskGrid.validation.finishIsActual']);
  eq(`9.${tag} Start niet gestart: bewerkbaar`, cell(n1.id, 'task.time.start')?.readOnly, false);
  const before = JSON.stringify(S().tasks);
  eq(`9.${tag} typen in Start (lopend) wordt geweigerd`, type(l1.id, 'task.time.start', '16-02-2026').ok, false);
  eq(`9.${tag} typen in Einde (voltooid) wordt geweigerd`, type(c1.id, 'task.time.finish', '23-01-2026').ok, false);
  ok(`9.${tag} geweigerd typen verandert niets (geen anker, geen constraint)`, JSON.stringify(S().tasks) === before);
  eq(`9.${tag} gedeelde helper: de getoonde werkelijke start is geen nieuw anker`, startAnchorAfterEdit(l1, shownStart(l1)), undefined);
  // Taak bewerken → Opslaan met het (alleen-lezen) startveld: geen stil anker.
  const anchorBefore = byCode('L1').time.scheduleStart;
  saveTaskDialog({ editingTaskId: l1.id, draft: { ...byCode('L1'), name: 'Lopend (hernoemd)' }, startDate: shownStart(byCode('L1')) });
  eq(`9.${tag} Taak bewerken → Opslaan: naam opgeslagen`, byCode('L1').name, 'Lopend (hernoemd)');
  eq(`9.${tag} Taak bewerken → Opslaan: anker ongewijzigd`, byCode('L1').time.scheduleStart, anchorBefore);
  eq(`9.${tag} Taak bewerken → Opslaan: geen constraint`, byCode('L1').constraint, l1.constraint);

  // ── 10. Basislijn en afwijking volgen de getoonde datums; het koppelanker de rekendatum ──
  S().saveBaseline('BL');
  const bl = S().baselines[S().baselines.length - 1]!;
  eq(`10.${tag} basislijn: lopende taak met haar werkelijke start`, bl.tasks.find(t => t.taskId === l1.id)?.start, '2026-02-23T08:00');
  eq(`10.${tag} basislijn: voltooide taak op haar werkelijke datums`,
    [bl.tasks.find(t => t.taskId === c1.id)?.start, bl.tasks.find(t => t.taskId === c1.id)?.finish], ['2026-01-05T08:00', '2026-01-16T17:00']);
  const link: ExternalLink = {
    id: 'x', direction: 'predecessor', relType: 'SS', anchorDate: '', sourceMissing: false,
    sourceRef: { projectId: 'p', taskId: l1.id },
  };
  eq(`10.${tag} extern koppelanker = rekenstart (voedt een andere berekening)`, sourceAnchorDate(link, byCode('L1')), computedStart(byCode('L1')));
}

// ── 11. Verzameltaak: de fasebalk omsluit elk kind ─────────────────────────────────────────────
// Zonder statusdatum kan een niet-gestart kind vóór de werkelijke start van een gestart broertje
// liggen. De fase begint dan op het vroegste van beide, niet op haar (opgerolde) werkelijke start.
{
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Fase' });
  const phase = S().addTask({ name: 'Fase' });
  const x = S().addTask({ name: 'X', parentId: phase, time: { scheduleDuration: 5, scheduleStart: '2026-06-08' } as Task['time'] });
  const y = S().addTask({ name: 'Y', parentId: phase, time: { scheduleDuration: 3 } as Task['time'] });
  S().setActualStart(x, '2026-06-10');
  S().runCPM();
  eq('11 opzet: X gestart op 10-06, Y begint 01-06', [shownStart(task(x)), shownStart(task(y))], ["2026-06-10T07:00", "2026-06-01T07:00"]);
  eq('11 opzet: de fase draagt de opgerolde werkelijke start 10-06', task(phase).time.actualStart, "2026-06-10T07:00");
  eq('11 de fase begint op het vroegste kind (01-06), niet op haar werkelijke start', shownStart(task(phase)), "2026-06-01T07:00");
  eq('11 de fase is geen blad: Start volgt de kinderen (derivedDates), niet startIsActual', startIsActual(task(phase)), false);
}

if (diffs.length) {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  check-table-shown-dates: ${diffs.length}/${checks} afwijkingen`);
  process.exit(1);
}
console.log(`OK  check-table-shown-dates: ${checks} controles groen`);
