// Issue #145 — de AFGELEIDE duur en datums van een verzameltaak, headless tegen de ECHTE store.
//
// Gemeld gedrag: "on adding child task the summary task duration does not update. I used
// Calculate but no changes". Oorzaak: een verzameltaak komt nooit in de CPM-graaf (de solver
// krijgt alleen bladtaken), dus de rollup in `applyCpmResult` zette wél `earlyStart`/`earlyFinish`
// — waar de Gantt-balk op tekent — maar liet `scheduleDuration`/`scheduleStart`/`scheduleFinish`
// staan op de waarde die de taak toevallig droeg (5 dagen uit `addTask`, of het getal uit het
// geïmporteerde `.mpp`). Berekenen/F5 hielp niet, want dát is precies dit pad.
//
// Waarom dit onzichtbaar is in een naïeve repropoging (case 1 hieronder): een nieuwe taak én haar
// nieuwe kind krijgen allebei 5 dagen vanaf de projectstart, dus de span is óók 5 dagen en het
// getal klopt bij toeval. De afwijking verschijnt pas bij een kind met een andere duur of start.
//
// Draait via run.sh (en in de tijdzone-matrix: de afleiding telt werkdagen).
import './domStub';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { CellEditIntent, TaskColumnContext } from '@/types/taskGrid';
import type { Task } from '@/types/task';

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

const registry = buildTaskColumnRegistry({
  projectId: 'issue-145', activityCodeTypes: [], customFieldDefs: [], baselines: [],
});
const column = (id: string) => registry.find(descriptor => String(descriptor.id) === id)!;

/** De tekst die de Duur-kolom daadwerkelijk toont — de exacte leesweg van het taakgrid. */
function durationCellText(id: string): string {
  const descriptor = column('task.time.scheduleDuration');
  const t = task(id);
  const raw = descriptor.read(t, {} as TaskColumnContext);
  return descriptor.format ? descriptor.format(raw, t, {} as TaskColumnContext) : String(raw);
}

function setDurationDays(id: string, days: number): void {
  const result = runGridMutation([{
    kind: 'cell-edit', taskId: id,
    columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'],
    route: 'task-schedule', value: days * 8 * 60,
  } satisfies CellEditIntent]);
  ok(`duur van ${id} op ${days}d zetten slaagt`, result.ok);
}

function reset(startDate: string): void {
  S().newProject();
  S().setProject({ startDate });
}

// ── 1. De naïeve repropoging: alles op de default van 5 dagen ────────────────────────────────
// Deze case bestaat om te documenteren WAAROM de bug lang onopgemerkt bleef, en om te bewijzen dat
// de fix het toevallig-kloppende geval niet stuk maakt.
{
  reset('2026-09-01');
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  S().runCPM();
  eq('Gelijke default-duur: de verzameltaak toont nog steeds 5d', durationCellText(parent), '5d');
  eq('Gelijke default-duur: de span is ook echt 5 werkdagen',
    [task(parent).time.earlyStart, task(parent).time.earlyFinish], ['2026-09-01', '2026-09-07']);
}

// ── 2. De gemelde bug: een kind met een langere duur ─────────────────────────────────────────
{
  reset('2026-09-01');
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  setDurationDays(child, 10);
  S().runCPM();
  eq('Langer kind: de verzameltaak toont de span van haar kind', durationCellText(parent), '10d');
  eq('Langer kind: duur en opgerolde span spreken elkaar niet tegen',
    [task(parent).time.scheduleDuration, task(parent).time.earlyStart, task(parent).time.earlyFinish],
    [10, '2026-09-01', '2026-09-14']);
  eq('Langer kind: de eigen datums van de verzameltaak volgen de rollup',
    [task(parent).time.scheduleStart, task(parent).time.scheduleFinish],
    ['2026-09-01', '2026-09-14']);
}

// ── 3. Tweede kind dat later start: de span rekt, de duur moet mee ───────────────────────────
{
  reset('2026-09-01');
  const parent = S().addTask({ name: 'Fase' });
  const first = S().addTask({ name: 'Kind1' });
  S().indentTasks([first]);
  setDurationDays(first, 10);
  const second = S().addTask({ name: 'Kind2', parentId: parent });
  const secondTime = { ...task(second).time, scheduleStart: '2026-10-01' };
  S().updateTask(second, { time: secondTime });
  S().runCPM();
  // 2026-09-01 t/m 2026-10-07 = 27 werkdagen in de standaardkalender (ma-vr, geen feestdagen).
  eq('Tweede kind: de verzameltaak spant beide kinderen', durationCellText(parent), '27d');
  eq('Tweede kind: opgerolde span', [task(parent).time.earlyStart, task(parent).time.earlyFinish],
    ['2026-09-01', '2026-10-07']);
}

// ── 4. Geneste verzameltaken rollen van binnen naar buiten op ────────────────────────────────
{
  reset('2026-09-01');
  const outer = S().addTask({ name: 'Buiten' });
  const inner = S().addTask({ name: 'Binnen' });
  S().indentTasks([inner]);
  const leaf = S().addTask({ name: 'Blad', parentId: inner });
  setDurationDays(leaf, 12);
  S().runCPM();
  eq('Nesting: de binnenste verzameltaak volgt haar blad', durationCellText(inner), '12d');
  eq('Nesting: de buitenste verzameltaak volgt de binnenste', durationCellText(outer), '12d');
}

// ── 5. Een taak die GEEN verzameltaak meer is, plant weer als bladtaak ───────────────────────
// Uitspringen van het laatste kind maakt van de ouder weer een bladtaak. De afgeleide duur BLIJFT
// dan staan (10d, niet de 5d van vóór het inspringen) en de solver plant er weer gewoon op — er is
// geen apart "eigen duur"-veld om naar terug te vallen, en dat hoeft ook niet: `scheduleDuration`
// ís het duurveld van de taak, of ze nu kinderen heeft of niet. Deze case pint dat de overgang
// geen halfslachtige toestand achterlaat (afgeleide duur + niet meer opgerolde datums).
{
  reset('2026-09-01');
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  setDurationDays(child, 10);
  S().runCPM();
  eq('Vóór uitspringen is de ouder een verzameltaak van 10d', durationCellText(parent), '10d');
  S().outdentTasks([child]);
  S().runCPM();
  eq('Na uitspringen plant de ex-ouder weer als blad, op de duur die hij draagt',
    [task(parent).time.earlyStart, task(parent).time.earlyFinish], ['2026-09-01', '2026-09-14']);
  ok('Na uitspringen heeft de ex-ouder geen kinderen meer', task(parent).childIds.length === 0);
}

// ── 6. De Duur-cel van een verzameltaak is niet bewerkbaar ───────────────────────────────────
// Het eigenschappenpaneel wist dit al (`TaskDurationField`s `derived`-vlag zet het veld op
// disabled); het taakgrid liep daar op achter en liet een afgeleide waarde overschrijven.
{
  reset('2026-09-01');
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  S().runCPM();
  const descriptor = column('task.time.scheduleDuration');
  ok('readOnly is een functie (conditioneel, niet hard)', typeof descriptor.readOnly === 'function');
  eq('Duur is read-only op een rij mét kinderen',
    typeof descriptor.readOnly === 'function'
      ? descriptor.readOnly(task(parent), {} as TaskColumnContext) : null, true);
  eq('Duur blijft bewerkbaar op een bladtaak',
    typeof descriptor.readOnly === 'function'
      ? descriptor.readOnly(task(child), {} as TaskColumnContext) : null, false);
  const rejected = runGridMutation([{
    kind: 'cell-edit', taskId: parent,
    columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'],
    route: 'task-schedule', value: 3 * 8 * 60,
  } satisfies CellEditIntent]);
  eq('Een duurbewerking op een verzameltaak wordt geweigerd', rejected.ok, false);
}

// ── 7. Een handmatig geplande verzameltaak houdt haar eigen opgeslagen duur ──────────────────
// Z9b: een manual verzameltaak rolt NIET op — haar datums komen uit het bestand. Dan is er ook
// niets afgeleid, dus mag de afleiding haar duur niet overschrijven (de `.mpp`-fidelitypoort meet
// alleen start/finish en zou zo'n regressie niet zien).
{
  reset('2026-09-01');
  const parent = S().addTask({ name: 'Manual fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  setDurationDays(child, 10);
  S().updateTask(parent, {
    manuallyScheduled: true,
    time: { ...task(parent).time, scheduleStart: '2026-09-01', scheduleFinish: '2026-09-03', scheduleDuration: 3 },
  });
  S().runCPM();
  eq('Manual verzameltaak houdt haar eigen duur', task(parent).time.scheduleDuration, 3);
  eq('Manual verzameltaak houdt haar eigen datums',
    [task(parent).time.scheduleStart, task(parent).time.scheduleFinish], ['2026-09-01', '2026-09-03']);
  eq('Manual verzameltaak plant op haar eigen datums, niet op die van het kind',
    [task(parent).time.earlyStart, task(parent).time.earlyFinish], ['2026-09-01', '2026-09-03']);
}

// ── 8. `solveProject` levert dezelfde afleiding op een KLOON ─────────────────────────────────
// Het bezettingsoverzicht rekent slapende documenten efemeer door via `cloneTasksForSolve`. De
// afleiding moet daar net zo goed landen — en het origineel onaangeraakt laten.
{
  reset('2026-09-01');
  const parent = S().addTask({ name: 'Fase' });
  const child = S().addTask({ name: 'Kind' });
  S().indentTasks([child]);
  setDurationDays(child, 10);
  const clone = cloneTasksForSolve(S().tasks);
  const calendar = S().calendar ?? createDefaultCalendar();
  solveProject({
    tasks: clone, sequences: S().sequences, calendar, calendars: S().calendars,
    projectStartDate: S().project.startDate,
  });
  const clonedParent = clone.find(t => t.id === parent)!;
  eq('Efemere solve leidt de duur op de kloon af', clonedParent.time.scheduleDuration, 10);
  eq('Efemere solve laat het origineel met rust', task(parent).time.scheduleDuration, 5);
}

if (diffs.length === 0) {
  console.log(`OK  verzameltaak-duur (issue #145): ${checks} controles groen`);
} else {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  verzameltaak-duur (issue #145): ${diffs.length}/${checks} controles rood`);
  process.exit(1);
}
