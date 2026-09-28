// Audit 2026-09-26 — schaal van de solver-grafiekstappen, via de ECHTE `solveProject`:
//  1. `detectCycle` liep recursief (`dfsVisit`) en klapte bij een lineaire keten van ~6000 taken op
//     `RangeError: Maximum call stack size exceeded`. Nu iteratief met exact dezelfde bezoekvolgorde.
//  2. De cyclusmelding na een lange keten blijft dezelfde kring (zelfde ids, zelfde volgorde).
//  3. `topologicalSort` was O(n²) (`queue.shift()` + `result.includes`); de uitkomst moet identiek
//     blijven — hier bewaakt via de eind-datums van een keten plus losse taken.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { solveProject } from '@/engine/scheduler/solveProject';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { opsSolveInput } from './legacySolveOptions';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const START = '2026-03-02';
const mkTask = (id: string): Task => ({
  id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(START, 1),
});
const fs = (a: string, b: string): Sequence => ({ id: `s-${a}-${b}`, predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });

function chain(n: number, extra: Sequence[] = [], isolated = 0): { tasks: Task[]; sequences: Sequence[] } {
  const tasks: Task[] = [];
  const sequences: Sequence[] = [];
  for (let i = 0; i < n; i++) {
    tasks.push(mkTask(`t${i}`));
    if (i > 0) sequences.push(fs(`t${i - 1}`, `t${i}`));
  }
  for (let i = 0; i < isolated; i++) tasks.push(mkTask(`los${i}`));
  return { tasks, sequences: [...sequences, ...extra] };
}

const calendar = createDefaultCalendar();
const N = 12000;

// 1. Lange keten zonder kring: geen crash, geen fout, laatste taak ná de eerste.
{
  const { tasks, sequences } = chain(N, [], 3);
  let err: unknown = null;
  let result: ReturnType<typeof solveProject> | null = null;
  try {
    result = solveProject(opsSolveInput({ tasks, sequences, calendar, calendars: [calendar], projectStartDate: START }));
  } catch (e) { err = e; }
  eq(`1 keten van ${N} taken: geen exceptie`, err === null ? null : String(err), null);
  eq('1 geen solver-fout', result?.error ?? null, null);
  eq(`1 projectduur = ${N} werkdagen (elke schakel telt)`, result?.projectDuration, N);
  eq('1 losse taken rekenen mee (topologische rest)', tasks[N].time.scheduleStart, START);
}

// 2. Kring aan het eind van een lange keten: dezelfde, volledige kringmelding.
{
  const { tasks, sequences } = chain(N, [fs(`t${N - 1}`, `t${N - 3}`)]);
  let err: unknown = null;
  let result: ReturnType<typeof solveProject> | null = null;
  try {
    result = solveProject(opsSolveInput({ tasks, sequences, calendar, calendars: [calendar], projectStartDate: START }));
  } catch (e) { err = e; }
  eq('2 kring na lange keten: geen exceptie', err === null ? null : String(err), null);
  eq('2 kring gemeld met de drie betrokken taken', result?.cycleTaskIds, [`t${N - 3}`, `t${N - 2}`, `t${N - 1}`]);
}

if (diffs.length === 0) {
  console.log(`OK  lange-keten: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  lange-keten: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
