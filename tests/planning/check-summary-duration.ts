import './domStub';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { applyCpmResult, rollupSummaryTasks } from '@/engine/scheduler/applyCpmResult';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { CellEditIntent, TaskColumnContext } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { opsSolveInput } from './legacySolveOptions';

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

const S = () => useAppStore.getState();
const task = (id: string): Task => S().tasks.find(t => t.id === id)!;
const durationColumn = buildTaskColumnRegistry({
  projectId: 'issue-145', activityCodeTypes: [], customFieldDefs: [], baselines: [],
}).find(descriptor => String(descriptor.id) === 'task.time.scheduleDuration')!;

function durationCellText(id: string): string {
  const t = task(id);
  const raw = durationColumn.read(t, {} as TaskColumnContext);
  return durationColumn.format ? durationColumn.format(raw, t, {} as TaskColumnContext) : String(raw);
}

function setTime(id: string, patch: Partial<Task['time']>): void {
  S().updateTask(id, { time: { ...task(id).time, ...patch } });
}

function reset(startDate = '2026-09-01'): void {
  S().newProject();
  S().setProject({ startDate });
}

function parentWithChild(days: number): { parent: string; child: string } {
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  setTime(child, { scheduleDuration: days });
  return { parent, child };
}

{
  reset();
  const { parent } = parentWithChild(10);
  S().runCPM();
  eq('De verzameltaak toont de span van haar kind', durationCellText(parent), '10d');
}

{
  reset();
  const { parent } = parentWithChild(10);
  const second = S().addTask({ name: 'Kind2', parentId: parent });
  setTime(second, { scheduleStart: '2026-10-01' });
  S().runCPM();
  eq('De verzameltaak spant beide kinderen', durationCellText(parent), '27d');
}

{
  reset();
  const outer = S().addTask({ name: 'Buiten' });
  const inner = S().addTask({ name: 'Binnen' });
  S().indentTasks([inner]);
  const leaf = S().addTask({ name: 'Blad', parentId: inner });
  setTime(leaf, { scheduleDuration: 12 });
  S().runCPM();
  eq('Nesting: binnenste én buitenste volgen het blad',
    [durationCellText(inner), durationCellText(outer)], ['12d', '12d']);
}

{
  reset();
  const sevenDay: WorkCalendar = { ...S().calendar, id: 'cal7', name: '7-daags', workDays: [1, 2, 3, 4, 5, 6, 7] };
  useAppStore.setState(state => { state.calendars = [...state.calendars, sevenDay]; });
  const { parent, child } = parentWithChild(10);
  S().updateTask(parent, { calendarId: 'cal7' });
  S().runCPM();
  eq('Eigen taakkalender op de verzameltaak wordt genegeerd',
    [durationCellText(parent), durationCellText(child)], ['10d', '10d']);
}

{
  reset();
  const band = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];
  useAppStore.setState(state => {
    state.calendar = {
      ...state.calendar,
      workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
    } as WorkCalendar;
  });
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  setTime(child, { durationUnit: 'hours', durationMinutes: 16 * 60, scheduleStart: '2026-09-01T08:00' });
  S().runCPM();
  eq('Uurproject: het kind beslaat twee werkdagen',
    [task(child).time.earlyStart, task(child).time.earlyFinish],
    ['2026-09-01T08:00', '2026-09-02T17:00']);
  eq('Uurproject: de verzameltaak telt precies die 16 uur, geen 8',
    [task(parent).time.durationMinutes, task(parent).time.durationUnit], [960, 'hours']);
}

{
  reset();
  const { parent } = parentWithChild(10);
  setTime(parent, { durationType: 'ELAPSEDTIME' });
  S().runCPM();
  const derived = task(parent).time.scheduleDuration;
  const span: [string, string] = [task(parent).time.earlyStart, task(parent).time.earlyFinish];

  reset();
  const leaf = S().addTask({ name: 'Elapsed' });
  setTime(leaf, { durationType: 'ELAPSEDTIME', scheduleDuration: derived, scheduleStart: span[0] });
  S().runCPM();
  eq('ELAPSEDTIME-verzameltaak: de afgeleide duur reproduceert haar eigen span',
    [task(leaf).time.earlyStart, task(leaf).time.earlyFinish], span);
  ok('ELAPSEDTIME-verzameltaak telt klokdagen, niet de 10 werkdagen van haar kind', derived !== 10);
}

{
  reset();
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind', parentId: parent });
  useAppStore.setState((s) => { s.tasks.find(t => t.id === parent)!.isMilestone = true; });
  setTime(child, { scheduleDuration: 10 });
  setTime(parent, { scheduleDuration: 0 });
  S().runCPM();
  eq('Mijlpaal met kinderen houdt duur 0', task(parent).time.scheduleDuration, 0);
}

{
  reset();
  const { parent } = parentWithChild(10);
  const before: [string, string] = [task(parent).time.scheduleStart, task(parent).time.scheduleFinish];
  S().runCPM();
  eq('De afleiding raakt de opgeslagen datums van de verzameltaak niet aan',
    [task(parent).time.scheduleStart, task(parent).time.scheduleFinish], before);
  ok('…terwijl de duur wél is bijgewerkt', task(parent).time.scheduleDuration === 10);
}

{
  reset();
  const { parent } = parentWithChild(10);
  S().updateTask(parent, {
    manuallyScheduled: true,
    time: { ...task(parent).time, scheduleStart: '2026-09-01', scheduleFinish: '2026-09-03', scheduleDuration: 3 },
  });
  S().runCPM();
  eq('Manual verzameltaak houdt haar eigen duur en datums',
    [task(parent).time.scheduleDuration, task(parent).time.earlyStart, task(parent).time.earlyFinish],
    [3, "2026-09-01T07:00", "2026-09-03T16:00"]);
}

{
  reset();
  const { parent, child } = parentWithChild(10);
  S().runCPM();
  eq('Duur is read-only op een rij mét kinderen, bewerkbaar op een blad',
    typeof durationColumn.readOnly === 'function'
      ? [durationColumn.readOnly(task(parent), {} as TaskColumnContext),
         durationColumn.readOnly(task(child), {} as TaskColumnContext)]
      : null,
    [true, false]);
  const rejected = runGridMutation([{
    kind: 'cell-edit', taskId: parent,
    columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'],
    route: 'task-schedule', value: 3 * 8 * 60,
  } satisfies CellEditIntent]);
  eq('Een duurbewerking op een verzameltaak wordt geweigerd', rejected.ok, false);
}

{
  reset();
  const { parent } = parentWithChild(10);
  const clone = cloneTasksForSolve(S().tasks);
  solveProject(opsSolveInput({
    tasks: clone, sequences: S().sequences, calendar: S().calendar, calendars: S().calendars,
    projectStartDate: S().project.startDate,
  }));
  eq('Efemere solve leidt af op de kloon en laat het origineel met rust',
    [clone.find(t => t.id === parent)!.time.scheduleDuration, task(parent).time.scheduleDuration],
    [10, 5]);
}

{
  const base = S().tasks[0];
  const node = (id: string, parentId: string | null, childIds: string[]): Task => ({
    ...base, id, parentId, childIds, isHammock: undefined, manuallyScheduled: undefined,
    time: { ...base.time, earlyStart: '2026-03-02', earlyFinish: '2026-03-02' },
  });
  const cyclic = [node('R', null, ['A']), node('A', 'R', ['R', 'L']), node('L', 'A', [])];
  const result = {
    tasks: new Map([['L', {
      earlyStart: '2026-03-02', earlyFinish: '2026-03-06', lateStart: '2026-03-02', lateFinish: '2026-03-06',
      totalFloat: 0, freeFloat: 0, isCritical: true, interferingFloat: 0,
    }]]),
  } as unknown as CPMResult;
  let error: unknown = null;
  try {
    applyCpmResult(cyclic, result, { projectCalendar: S().calendar, calendars: [] });
  } catch (err) {
    error = err;
  }
  eq('Rollup over een childIds-kring eindigt zonder fout', error === null ? null : String(error), null);
  eq('Het blad krijgt zijn CPM-datums ondanks de kring', cyclic[2].time.earlyFinish, '2026-03-06');
  eq('De tussenlaag rolt het blad op', cyclic[1].time.earlyFinish, '2026-03-06');
}

{
  const base = S().tasks[0];
  const node = (id: string, parentId: string | null, childIds: string[]): Task => ({
    ...base, id, parentId, childIds, isSummary: childIds.length > 0,
    isHammock: undefined, manuallyScheduled: undefined,
    time: { ...base.time, earlyStart: '2026-03-02', earlyFinish: '2026-03-03' },
  });
  const r = node('R', null, ['A', 'B', 'M', 'ontbreekt']);
  const a = node('A', r.id, ['C']);
  const b = node('B', r.id, ['C']);
  const c = node('C', a.id, ['L']);
  const l = node('L', c.id, []);
  l.time.earlyStart = '2026-03-10'; l.time.earlyFinish = '2026-03-12';
  const m = node('M', r.id, ['C']);
  m.manuallyScheduled = true;
  m.time.scheduleStart = '2026-02-02'; m.time.scheduleFinish = '2026-02-04'; m.time.scheduleDuration = 3;
  const empty = { ...node('E', null, []), isSummary: true };
  const orphan = node('O', 'onbekende-ouder', ['L']);
  const nodes = [r, a, b, c, l, m, empty, orphan];
  const shape = JSON.stringify(nodes.map(t => [t.id, t.parentId, t.childIds, t.isSummary]));
  const emptyTime = JSON.stringify(empty.time);
  const orphanTime = JSON.stringify(orphan.time);
  const order: string[] = [];
  rollupSummaryTasks(nodes, { skip: t => { order.push(t.id); return t.id === 'A'; } });
  eq('Rollup bezoekt gedeelde fasen één keer, in de oorspronkelijke terugkeervolgorde', order, ['C', 'A', 'B', 'M', 'R', 'E']);
  eq('Kind onder overgeslagen fase wordt wel opgerold; gedeelde ouder ziet dat resultaat',
    [c.time.earlyFinish, a.time.earlyFinish, b.time.earlyFinish], ['2026-03-12', '2026-03-03', '2026-03-12']);
  eq('Handmatige fase houdt eigen datums en duur',
    [m.time.earlyStart, m.time.earlyFinish, m.time.scheduleDuration], ['2026-02-02', '2026-02-04', 3]);
  eq('Buitenste fase volgt de afgeronde kindresultaten', [r.time.earlyStart, r.time.earlyFinish], ['2026-02-02', '2026-03-12']);
  eq('Expliciet lege fase en wees houden hun bestandswaarden',
    [JSON.stringify(empty.time), JSON.stringify(orphan.time)], [emptyTime, orphanTime]);
  eq('Rollup verandert geen taakvolgorde, identiteiten, verwijzingen of fasemarkeringen',
    JSON.stringify(nodes.map(t => [t.id, t.parentId, t.childIds, t.isSummary])), shape);
}

if (diffs.length === 0) {
  console.log(`OK  verzameltaak-duur (issue #145): ${checks} controles groen`);
} else {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  verzameltaak-duur (issue #145): ${diffs.length}/${checks} controles rood`);
  process.exit(1);
}
