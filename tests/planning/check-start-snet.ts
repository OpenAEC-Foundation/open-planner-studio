// Een getypte startdatum op een taak MET voorganger wordt een beperking "Start niet eerder dan"
// (SNET), zoals in MS Project (besluit eigenaar, audit "weergaven" W2-vervolg). Vóór de fix schreef
// een startbewerking alleen het anker `scheduleStart`; de solver leest dat anker alleen voor een taak
// zónder voorganger, dus na F5 sprong de taak terug achter haar voorganger en verdween de invoer stil.
//
// Tegen de echte store, de echte grid-adapter en de echte commitgrens van de celeditor
// (`commitTaskCellEditorValue` → `runGridMutation`), zoals `FullTaskGrid` die gebruikt. Paneel en
// Taak bewerken zijn React-routes: die bewijst `tests/browser/start-snet.spec.ts` met echte events.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { createTaskGridAdapter, type TaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { commitTaskCellEditorValue } from '@/components/task-grid/TaskCellEditor';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { signedWorkDaysBetween } from '@/engine/variance';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { shownStart } from '@/utils/taskDates';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { CellEditIntent } from '@/types/taskGrid';
import { predecessorDrivenTaskIds, startConstraintAfterEdit } from '@/engine/startEditConstraint';
import { startConstraintNotification } from '@/state/startConstraintNotice';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const S = () => useAppStore.getState();
const task = (id: string): Task => S().tasks.find(candidate => candidate.id === id)!;
const notices = () => S().ui.notifications.map(n => ({ key: n.messageKey, params: n.params }));
const clearNotices = () => useAppStore.setState(state => { state.ui.notifications = []; });

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

/** Typen in de celeditor en Enter: exact de commitgrens van `TaskCellEditor`. */
function type(taskId: string, column: string, text: string) {
  return commitTaskCellEditorValue({
    adapter: adapter(),
    cell: { rowKey: rowKey(taskId), columnId: taskColumnId(column) },
    text,
    messageForError: key => key,
  });
}

/** A (5d) → B (3d) FS, projectstart ma 01-06-2026: B begint na F5 op ma 08-06. */
function setup(): { a: string; b: string } {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Start wordt SNET' });
  S().setUI({ dateNotation: 'dmy' });
  const a = S().addTask({ name: 'A', time: { scheduleDuration: 5 } as Task['time'] });
  const b = S().addTask({ name: 'B', time: { scheduleDuration: 3 } as Task['time'] });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  clearNotices();
  return { a, b };
}

// ── 1. Tabel-kolom Start op een taak met voorganger: de getypte datum wordt SNET ────────────────
{
  const { b } = setup();
  eq('Opzet: B begint na A op 08-06', shownStart(task(b)), '2026-06-08');
  const typed = type(b, 'task.time.start', '15-06-2026');
  eq('Start → 15-06: commit slaagt', typed.ok, true);
  eq('Start → 15-06: beperking SNET met de getypte datum', task(b).constraint, { type: 'SNET', date: '2026-06-15' });
  eq('Start → 15-06: anker = getypte datum', task(b).time.scheduleStart, '2026-06-15');
  eq('Start → 15-06: melding via het ene meldkanaal', notices(),
    [{ key: 'notifications.startSnetCreated', params: { name: 'B', date: '15-06-2026' } }]);
  S().runCPM();
  eq('Start na F5 = getypte datum (niet terug achter de voorganger)', shownStart(task(b)), '2026-06-15');

  // Undo: startbewerking + beperking zijn samen één stap.
  S().undo();
  eq('Undo (1×): beperking weg', task(b).constraint, undefined);
  eq('Undo (1×): anker terug', task(b).time.scheduleStart, '2026-06-01');
  S().redo();
  eq('Redo: beperking en anker samen terug', [task(b).constraint, task(b).time.scheduleStart],
    [{ type: 'SNET', date: '2026-06-15' }, '2026-06-15']);
}

// ── 2. Een datum vóór wat de voorganger toelaat: de voorganger wint ─────────────────────────────
{
  const { b } = setup();
  const typed = type(b, 'task.time.start', '03-06-2026');
  eq('Start → 03-06 (vóór A klaar is): commit slaagt', typed.ok, true);
  eq('Start → 03-06: toch SNET 03-06', task(b).constraint, { type: 'SNET', date: '2026-06-03' });
  S().runCPM();
  eq('Start → 03-06 na F5: de voorganger wint (08-06)', shownStart(task(b)), '2026-06-08');
}

// ── 3. Taak heeft al een SNET: de datum schuift mee ──────────────────────────────────────────────
{
  const { b } = setup();
  S().updateTask(b, { constraint: { type: 'SNET', date: '2026-06-10' } });
  S().runCPM();
  clearNotices();
  eq('Opzet: SNET 10-06 bepaalt de start', shownStart(task(b)), '2026-06-10');
  const typed = type(b, 'task.time.start', '17-06-2026');
  eq('Start → 17-06: commit slaagt', typed.ok, true);
  eq('Start → 17-06: SNET-datum bijgewerkt', task(b).constraint, { type: 'SNET', date: '2026-06-17' });
  eq('Start → 17-06: melding "bijgewerkt"', notices(),
    [{ key: 'notifications.startSnetUpdated', params: { name: 'B', date: '17-06-2026' } }]);
  S().runCPM();
  eq('Start na F5 = nieuwe SNET-datum', shownStart(task(b)), '2026-06-17');
}

// ── 4. Ander constrainttype: niet raden, beperking blijft staan (gedrag ongewijzigd) ─────────────
for (const constraint of [
  { type: 'MSO', date: '2026-06-10' },
  { type: 'FNLT', date: '2026-06-30' },
  { type: 'ALAP' },
] as const) {
  const { b } = setup();
  S().updateTask(b, { constraint: { ...constraint } });
  S().runCPM();
  clearNotices();
  const startBefore = shownStart(task(b));
  const typed = type(b, 'task.time.start', '17-06-2026');
  eq(`${constraint.type}: commit slaagt`, typed.ok, true);
  eq(`${constraint.type}: beperking onaangeroerd`, task(b).constraint, constraint);
  eq(`${constraint.type}: alleen het anker (zoals vóór deze wijziging)`, task(b).time.scheduleStart, '2026-06-17');
  eq(`${constraint.type}: geen SNET-melding`, notices(), []);
  S().runCPM();
  eq(`${constraint.type}: start na F5 ongewijzigd`, shownStart(task(b)), startBefore);
}

// ── 5. Taak zonder voorganger: alleen het anker, zoals altijd ───────────────────────────────────
{
  const { a } = setup();
  const typed = type(a, 'task.time.start', '03-06-2026');
  eq('Zonder voorganger: commit slaagt', typed.ok, true);
  eq('Zonder voorganger: geen beperking', task(a).constraint, undefined);
  eq('Zonder voorganger: anker = getypte datum', task(a).time.scheduleStart, '2026-06-03');
  eq('Zonder voorganger: geen SNET-melding', notices(), []);
  S().runCPM();
  eq('Zonder voorganger na F5: start = anker', shownStart(task(a)), '2026-06-03');
}

// ── 6. Ongewijzigd teruggetypt: niets, ook geen beperking ───────────────────────────────────────
{
  const { b } = setup();
  const typed = type(b, 'task.time.start', '08-06-2026');
  eq('Zelfde datum teruggetypt: commit slaagt', typed.ok, true);
  eq('Zelfde datum teruggetypt: geen beperking', task(b).constraint, undefined);
  eq('Zelfde datum teruggetypt: anker blijft', task(b).time.scheduleStart, '2026-06-01');
  eq('Zelfde datum teruggetypt: niet verouderd', S().scheduleStale, false);
}

// ── 7. Voorganger via de fase: een kind van een samenvatting mét voorganger telt mee ────────────
{
  const { a } = setup();
  const phase = S().addTask({ name: 'Fase' });
  const c = S().addTask({ name: 'C', time: { scheduleDuration: 2 } as Task['time'] });
  S().moveTask(c, phase);
  S().addSequence({ predecessorId: a, successorId: phase, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  clearNotices();
  eq('Opzet: C wacht via de fase op A', shownStart(task(c)), '2026-06-08');
  type(c, 'task.time.start', '15-06-2026');
  eq('Kind van fase met voorganger: SNET', task(c).constraint, { type: 'SNET', date: '2026-06-15' });
  S().runCPM();
  eq('Kind van fase na F5 = getypte datum', shownStart(task(c)), '2026-06-15');
}

// ── 8. Handmatig gepland: het anker IS de planning, geen beperking nodig ────────────────────────
{
  const { b } = setup();
  S().updateTask(b, { manuallyScheduled: true, time: { ...task(b).time, scheduleFinish: '2026-06-10' } });
  S().runCPM();
  clearNotices();
  type(b, 'task.time.start', '04-06-2026');
  eq('Handmatig gepland: geen beperking', task(b).constraint, undefined);
  eq('Handmatig gepland: anker = getypte datum', task(b).time.scheduleStart, '2026-06-04');
}

// ── 9. Kiesbare kolom Geplande start: dezelfde regel ────────────────────────────────────────────
{
  const { b } = setup();
  const typed = type(b, 'task.time.scheduleStart', '16-06-2026');
  eq('Geplande start → 16-06: commit slaagt', typed.ok, true);
  eq('Geplande start → 16-06: SNET', task(b).constraint, { type: 'SNET', date: '2026-06-16' });
  S().runCPM();
  eq('Geplande start na F5 = getypte datum', shownStart(task(b)), '2026-06-16');
}

// ── 10. Plakken over meerdere taken: één transactie, één melding met aantal ─────────────────────
{
  const { a, b } = setup();
  const c = S().addTask({ name: 'C', time: { scheduleDuration: 2 } as Task['time'] });
  S().addSequence({ predecessorId: a, successorId: c, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  clearNotices();
  const edit = (taskId: string, value: string): CellEditIntent => ({
    kind: 'cell-edit', taskId, columnId: taskColumnId('task.time.start'), route: 'task-schedule', value,
  });
  const pasted = S().runGridMutation([{ kind: 'paste', writes: [edit(b, '2026-06-15'), edit(c, '2026-06-16')] }]);
  eq('Plakken: slaagt', pasted.ok, true);
  eq('Plakken: beide taken SNET', [task(b).constraint, task(c).constraint],
    [{ type: 'SNET', date: '2026-06-15' }, { type: 'SNET', date: '2026-06-16' }]);
  eq('Plakken: één melding met aantal', notices(), [{ key: 'notifications.startSnetMany', params: { count: 2 } }]);
  S().undo();
  eq('Plakken: één undo-stap haalt beide beperkingen weg', [task(b).constraint, task(c).constraint], [undefined, undefined]);
}

// ── 11. Beperking in dezelfde bewerking expliciet gezet: die wint ───────────────────────────────
{
  const { b } = setup();
  const pasted = S().runGridMutation([{ kind: 'paste', writes: [
    { kind: 'cell-edit', taskId: b, columnId: taskColumnId('task.time.start'), route: 'task-schedule', value: '2026-06-15' },
    { kind: 'cell-edit', taskId: b, columnId: taskColumnId('task.constraint.type'), route: 'task-constraint', value: 'ASAP' },
  ] }]);
  eq('Start + Constraint ASAP in één rij: slaagt', pasted.ok, true);
  eq('Start + Constraint ASAP in één rij: de expliciete keuze wint', task(b).constraint, undefined);
  eq('Start + Constraint ASAP in één rij: geen SNET-melding', notices(), []);
}

// ── 12. De beperking overleeft opslaan/openen (IFC) ──────────────────────────────────────────────
{
  const { b } = setup();
  type(b, 'task.time.start', '15-06-2026');
  const back = readIFC(writeIFC(buildWriteIFCInput(S())));
  const reread = back.tasks.find(candidate => candidate.name === 'B');
  eq('IFC-round-trip: SNET met datum blijft', reread?.constraint, { type: 'SNET', date: '2026-06-15' });
  eq('IFC-round-trip: anker blijft', reread?.time.scheduleStart, '2026-06-15');
}

// ── 13. De gedeelde regel zelf: wanneer wel, wanneer niet ──────────────────────────────────────
{
  const { a, b } = setup();
  const base = task(b);
  const driven = predecessorDrivenTaskIds(S().tasks, S().sequences);
  eq('Voorgangerset: B wel, A niet', [driven.has(b), driven.has(a)], [true, false]);
  eq('Regel: ASAP + voorganger ⇒ nieuwe SNET',
    startConstraintAfterEdit(base, '2026-06-15', true), { constraint: { type: 'SNET', date: '2026-06-15' }, change: 'created' });
  eq('Regel: geen voorganger ⇒ niets', startConstraintAfterEdit(base, '2026-06-15', false), undefined);
  eq('Regel: SNET met dezelfde datum ⇒ niets',
    startConstraintAfterEdit({ ...base, constraint: { type: 'SNET', date: '2026-06-15' } }, '2026-06-15', true), undefined);
  eq('Regel: SNET ⇒ alleen de datum',
    startConstraintAfterEdit({ ...base, constraint: { type: 'SNET', date: '2026-06-10' } }, '2026-06-15', true),
    { constraint: { type: 'SNET', date: '2026-06-15' }, change: 'updated' });
  eq('Regel: gestart (werkelijke start) ⇒ niets',
    startConstraintAfterEdit({ ...base, time: { ...base.time, actualStart: '2026-06-08', completion: 0.2 } }, '2026-06-15', true), undefined);
  eq('Regel: hangmat ⇒ niets', startConstraintAfterEdit({ ...base, isHammock: true }, '2026-06-15', true), undefined);
  eq('Regel: samenvatting ⇒ niets', startConstraintAfterEdit({ ...base, childIds: [a] }, '2026-06-15', true), undefined);

  // De melding: één taak met naam en datum in de notatie van de gebruiker, meer taken met een aantal,
  // en altijd een "Lees meer" naar een gids die bestaat.
  eq('Melding: geen taken ⇒ geen melding', startConstraintNotification([], 'dmy'), null);
  eq('Melding: urentaak toont de tijd',
    startConstraintNotification([{ name: 'U', date: '2026-06-15T13:00', change: 'created' }], 'ymd')?.params,
    { name: 'U', date: '2026-06-15 13:00' });
  const help = startConstraintNotification([{ name: 'B', date: '2026-06-15', change: 'created' }], 'dmy')?.helpArticleId;
  const manifestPath = fileURLToPath(new URL('../../public/docs/manifest.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { articles: { id: string }[] };
  eq('Melding: "Lees meer" wijst naar een bestaande gids', manifest.articles.some(article => article.id === help), true);
}

if (diffs.length) {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  check-start-snet: ${diffs.length}/${checks} afwijkingen`);
  process.exit(1);
}
console.log(`OK  check-start-snet: ${checks} controles groen`);
