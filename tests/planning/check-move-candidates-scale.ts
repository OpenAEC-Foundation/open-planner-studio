import './domStub';
import { createMoveCandidateLookup } from '@/components/task-sections/moveCandidates';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { createLargeSchedule, countsOf } from './largeScheduleFixture';

const fails: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  checks++;
  if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`);
};
const relaxed = process.env.OPS_RELAX_PERF === '1';

function reference(tasks: Task[], assignments: ResourceAssignment[], taskId: string, resourceId: string): string[] {
  return tasks.filter(t =>
    t.id !== taskId && !t.isMilestone && isLeafTask(t)
    && !assignments.some(a => a.taskId === t.id && a.resourceId === resourceId),
  ).map(t => t.id);
}

class BudgetExceeded extends Error {}

function counted<T>(items: T[], budget: number): { proxy: T[]; reads: () => number } {
  let reads = 0;
  const proxy = new Proxy(items, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        reads++;
        if (reads > budget) throw new BudgetExceeded(`meer dan ${budget} elementen gelezen`);
      }
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  return { proxy, reads: () => reads };
}

{
  const small = createLargeSchedule({ tasks: 300, assignmentsPerTask: 3, sequences: 300 });
  const lookup = createMoveCandidateLookup(small.tasks, small.assignments);
  let compared = 0;
  for (const a of small.assignments) {
    const want = reference(small.tasks, small.assignments, a.taskId, a.resourceId);
    const got = lookup.list(a.taskId, a.resourceId).map(t => t.id);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      ok(`1 kandidaten gelijk aan de oude regel (${a.taskId}/${a.resourceId})`, false, `kreeg ${got.length}, verwacht ${want.length}`);
      break;
    }
    ok(`1 has() volgt list() (${a.taskId}/${a.resourceId})`, lookup.has(a.taskId, a.resourceId) === want.length > 0);
    compared++;
  }
  ok('1 er is echt vergeleken', compared === small.assignments.length && compared > 300, String(compared));
  const leaves = small.tasks.filter(t => isLeafTask(t) && !t.isMilestone);
  const everywhere = leaves.map((t, i) => ({ id: `all-${i}`, taskId: t.id, resourceId: 'res-overal', unitsPerDay: 1 }));
  const full = createMoveCandidateLookup(small.tasks, [...small.assignments, ...everywhere]);
  ok('1 resource op elke bladtaak ⇒ geen kandidaten (has)', full.has(leaves[0].id, 'res-overal') === false);
  ok('1 resource op elke bladtaak ⇒ geen kandidaten (list)', full.list(leaves[0].id, 'res-overal').length === 0);
}

const big = createLargeSchedule();
const counts = countsOf(big);
ok('opzet: ±7.000 taken', counts.tasks >= 6_900 && counts.tasks <= 7_100, String(counts.tasks));
ok('opzet: ≥ 48.000 toewijzingen', counts.assignments >= 48_000, String(counts.assignments));
ok('opzet: ≥ 10.000 relaties', counts.sequences >= 10_000, String(counts.sequences));

const selected = big.tasks.find(t => isLeafTask(t) && !t.isMilestone && t.resourceIds.length >= 9)!;
const rows = big.assignments.filter(a => a.taskId === selected.id);
ok('opzet: geselecteerde taak heeft negen toewijzingsrijen', rows.length >= 9, String(rows.length));

{
  const assignmentBudget = 2 * big.assignments.length;
  const a = counted(big.assignments, assignmentBudget);
  const t = counted(big.tasks, Number.MAX_SAFE_INTEGER);
  const started = performance.now();
  let hasReads = 0;
  try {
    const lookup = createMoveCandidateLookup(t.proxy, a.proxy);
    const tasksBeforeHas = t.reads();
    for (const row of rows) lookup.has(selected.id, row.resourceId);
    hasReads = t.reads() - tasksBeforeHas;
    for (const row of rows) lookup.list(selected.id, row.resourceId);
    ok(`2 toewijzingen gelezen ≤ 2 × ${big.assignments.length}`, a.reads() <= assignmentBudget, String(a.reads()));
  } catch (error) {
    ok(`2 toewijzingen gelezen ≤ 2 × ${big.assignments.length}`, false, String(error instanceof BudgetExceeded ? error.message : error));
  }
  const elapsed = performance.now() - started;
  ok('3 has() stopt vroeg (leest < 25 % van de taken per rij)', hasReads > 0 && hasReads < rows.length * big.tasks.length / 4,
    `${hasReads} taakelementen voor ${rows.length} rijen`);
  if (!relaxed) ok('4 index + negen rijen + negen lijsten < 1.500 ms (via proxy)', elapsed < 1_500, `${elapsed.toFixed(0)} ms`);
}

{
  const started = performance.now();
  const lookup = createMoveCandidateLookup(big.tasks, big.assignments);
  for (const row of rows) lookup.has(selected.id, row.resourceId);
  const elapsed = performance.now() - started;
  if (!relaxed) ok('4 index + `has` per rij < 150 ms', elapsed < 150, `${elapsed.toFixed(0)} ms`);
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`move-candidates-scale: ${fails.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`move-candidates-scale: ${checks} checks groen`);
