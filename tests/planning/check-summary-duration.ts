// Issue #145 — de AFGELEIDE duur van een verzameltaak, headless tegen de ECHTE store.
//
// Gemeld gedrag: "on adding child task the summary task duration does not update. I used
// Calculate but no changes". Oorzaak: een verzameltaak komt nooit in de CPM-graaf (de solver
// krijgt alleen bladtaken), dus de rollup in `applyCpmResult` zette wél `earlyStart`/`earlyFinish`
// — waar de Gantt-balk op tekent — maar liet `scheduleDuration` staan op de waarde die de taak
// toevallig droeg (5 dagen uit `addTask`, of het getal uit het geïmporteerde `.mpp`).
//
// Onzichtbaar in een naïeve repropoging: een nieuwe taak én haar nieuwe kind krijgen allebei 5
// dagen vanaf de projectstart, dus de span is óók 5 dagen en het getal klopt bij toeval. De
// afwijking verschijnt pas bij een kind met een andere duur of start.
//
// De afleiding zelf is `duration.ts`s gedeelde `writeDerivedSpan` (ook de hammock-tak van
// `CPMSolver` gebruikt 'm). De cases hieronder bewaken juist wat de VERZAMELTAAK-kant daaraan
// toevoegt: welke kalender, welke rijen overgeslagen worden, en welke velden met rust blijven.
//
// Draait via run.sh, ook in de tijdzone-matrix (de afleiding telt werkdagen).
import './domStub';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { applyCpmResult } from '@/engine/scheduler/applyCpmResult';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { CellEditIntent, TaskColumnContext } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

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

/** De tekst die de Duur-kolom daadwerkelijk toont — de exacte leesweg van het taakgrid. */
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

/** Ouder met één kind van `days` werkdagen — het minimale gemelde scenario. */
function parentWithChild(days: number): { parent: string; child: string } {
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  setTime(child, { scheduleDuration: days });
  return { parent, child };
}

// ── 1. De gemelde bug: een kind met een langere duur ─────────────────────────────────────────
{
  reset();
  const { parent } = parentWithChild(10);
  S().runCPM();
  eq('De verzameltaak toont de span van haar kind', durationCellText(parent), '10d');
}

// ── 2. Tweede kind dat later start: de span rekt, de duur moet mee ───────────────────────────
{
  reset();
  const { parent } = parentWithChild(10);
  const second = S().addTask({ name: 'Kind2', parentId: parent });
  setTime(second, { scheduleStart: '2026-10-01' });
  S().runCPM();
  // 2026-09-01 t/m 2026-10-07 = 27 werkdagen in de standaardkalender (ma-vr, geen feestdagen).
  eq('De verzameltaak spant beide kinderen', durationCellText(parent), '27d');
}

// ── 3. Geneste verzameltaken rollen van binnen naar buiten op ────────────────────────────────
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

// ── 4. De projectkalender wint van een eigen taakkalender ────────────────────────────────────
// Een verzameltaak heeft geen eigen werk, dus haar taakkalender is betekenisloos (MS Project
// biedt dat veld op een samenvattingstaak niet eens aan). Rekende de afleiding in de EIGEN
// kalender, dan kreeg een fase met een 7-daagse kalender "14d" te zien terwijl haar enige kind
// over exact hetzelfde datumbereik "10d" is.
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

// ── 5. Uurproject: geen verdwenen werkdag ────────────────────────────────────────────────────
// De afleiding dispatcht op de KALENDER-modus, nooit op de eenheid die de taak toevallig draagt.
// Dat is een correctheidsvoorwaarde, geen stijlkeuze: `workMinutesBetween` telt half-open en mag
// alleen op échte instants, `workDaysBetween` telt inclusief en hoort bij date-only datums. Een
// eerdere versie van deze fix dispatchte op de taak-eenheid en liet daarmee stil één werkdag
// vallen zodra een uur-ouder dag-kinderen had.
{
  reset();
  const band = [{ start: 480, end: 720 }, { start: 780, end: 1020 }]; // 08:00-12:00 + 13:00-17:00
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

// ── 6. ELAPSEDTIME telt klokdagen, niet werkdagen ────────────────────────────────────────────
// Gepind tegen een BLADTAAK met dezelfde duur in plaats van tegen een met de hand geteld getal:
// de 24/7-conventie van dit project (`duration.ts`s `signedElapsedSpan`: rauwe klokspanne, geen
// inclusieve −1-correctie) hoort de norm te zijn, niet mijn hoofdrekenen.
{
  reset();
  const { parent } = parentWithChild(10);
  setTime(parent, { durationType: 'ELAPSEDTIME' });
  S().runCPM();
  const derived = task(parent).time.scheduleDuration;
  const span: [string, string] = [task(parent).time.earlyStart, task(parent).time.earlyFinish];

  // Dezelfde duur op een ELAPSEDTIME-BLADtaak moet exact dezelfde span opleveren.
  reset();
  const leaf = S().addTask({ name: 'Elapsed' });
  setTime(leaf, { durationType: 'ELAPSEDTIME', scheduleDuration: derived, scheduleStart: span[0] });
  S().runCPM();
  eq('ELAPSEDTIME-verzameltaak: de afgeleide duur reproduceert haar eigen span',
    [task(leaf).time.earlyStart, task(leaf).time.earlyFinish], span);
  ok('ELAPSEDTIME-verzameltaak telt klokdagen, niet de 10 werkdagen van haar kind', derived !== 10);
}

// ── 7. Een mijlpaal mét kinderen houdt haar ruit ─────────────────────────────────────────────
// `isZeroDurationMilestone` stuurt de ruit-tekening in `GanttRenderer`; een afgeleide duur zou die
// markering stil in een balk veranderen. MS Project staat "markeer als mijlpaal" op een
// samenvattingstaak gewoon toe, dus dit is geen onmogelijke toestand.
// Sinds audit taakmutaties §6 maken de GEBRUIKERSroutes zo'n taak niet meer (een mijlpaal die
// kinderen krijgt verliest zijn vlag; een fase wordt geen mijlpaal), maar een import kan hem nog
// steeds aanleveren. Daarom hier als fixture, zoals een ingelezen bestand hem neerzet.
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

// ── 8. `scheduleStart`/`scheduleFinish` blijven ONAANGERAAKT ─────────────────────────────────
// Die twee staan in `ifcTaskSlots.ts` geregistreerd als `RECORDED_INPUT_SLOT_KEYS` — "wat het
// bestand zei" — en `captureRecordedDates` leest ze als de datumlaag van issue #63, terwijl
// `showRecordedDates` ze niet herstelt. Ze hier meeschrijven laat "Datums zoals opgeslagen" op
// verzameltaakrijen twee elkaar tegensprekende kolommen tonen. Deze case pint de afwezigheid.
{
  reset();
  const { parent } = parentWithChild(10);
  const before: [string, string] = [task(parent).time.scheduleStart, task(parent).time.scheduleFinish];
  S().runCPM();
  eq('De afleiding raakt de opgeslagen datums van de verzameltaak niet aan',
    [task(parent).time.scheduleStart, task(parent).time.scheduleFinish], before);
  ok('…terwijl de duur wél is bijgewerkt', task(parent).time.scheduleDuration === 10);
}

// ── 9. Een handmatig geplande verzameltaak houdt haar eigen opgeslagen duur ──────────────────
// Z9b: een manual verzameltaak rolt NIET op — haar datums komen uit het bestand. Dan is er ook
// niets afgeleid, dus mag de afleiding haar duur niet overschrijven (de `.mpp`-fidelitypoort meet
// alleen start/finish en zou zo'n regressie niet zien).
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
    [3, '2026-09-01', '2026-09-03']);
}

// ── 10. De Duur-cel van een verzameltaak is niet bewerkbaar ──────────────────────────────────
// Het eigenschappenpaneel wist dit al (`TaskDurationField`s `derived`-vlag zet het veld op
// disabled); het taakgrid liep daarop achter en liet een afgeleide waarde overschrijven.
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

// ── 11. `solveProject` levert dezelfde afleiding op een KLOON ────────────────────────────────
// Het bezettingsoverzicht rekent slapende documenten efemeer door via `cloneTasksForSolve`. De
// afleiding moet daar net zo goed landen — en het origineel onaangeraakt laten.
{
  reset();
  const { parent } = parentWithChild(10);
  const clone = cloneTasksForSolve(S().tasks);
  solveProject({
    tasks: clone, sequences: S().sequences, calendar: S().calendar, calendars: S().calendars,
    projectStartDate: S().project.startDate,
  });
  eq('Efemere solve leidt af op de kloon en laat het origineel met rust',
    [clone.find(t => t.id === parent)!.time.scheduleDuration, task(parent).time.scheduleDuration],
    [10, 5]);
}

// Een corrupte `childIds`-kring (R → A → R) mag de rollup niet in een eindeloze recursie sturen:
// vóór de cyclusbewaking eindigde dit in "Maximum call stack size exceeded".
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

if (diffs.length === 0) {
  console.log(`OK  verzameltaak-duur (issue #145): ${checks} controles groen`);
} else {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  verzameltaak-duur (issue #145): ${diffs.length}/${checks} controles rood`);
  process.exit(1);
}
