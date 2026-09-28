// Bulkbewerkingen op schaal — headless tegen de ECHTE store. Een contextmenu-bulkactie (prioriteit,
// kalender, voortgang over de selectie) en bulkverwijderen waren O(selectie × taken): per taak een
// volledige rijenafleiding, een Immer-proxy per doorlopen taak bij het zoeken, en per wortel een
// lineaire zoektocht door de boom. Gemeten op 8000 taken vóór de fix: prioriteit op 2000 taken 33 s,
// alles verwijderen 91 s. Deze batterij pint:
//  A. een bulkactie levert exact dezelfde taken én `viewRows` als dezelfde acties los na elkaar
//     (de rijen worden in een batch pas aan het einde afgeleid), en undo/redo herstellen beide;
//  B. `removeTaskSubtrees` met index is gelijk aan de oude per-wortelroute op willekeurige bossen
//     (geneste wortels, onbekende ids, een corrupte kring in `childIds`);
//  C. de schaal (ruime grenzen, zodat een trage CI-runner niet flappert).
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore, appStoreContext } from '@/state/appStore';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { createTaskBulkActions } from '@/state/taskBulkActions';
import { removeTaskSubtrees } from '@/state/taskTree';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';

const S = () => useAppStore.getState();
const bulk = createTaskBulkActions(appStoreContext);
const fails: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  checks++;
  if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`);
};
// Met een echte tweede kalender van zes uur per dag en werk op de toewijzingen, zodat een
// kalenderwissel via de werkregel ook de toewijzingen raakt (review 2026-09-28: met een niet-bestaande
// kalender en toewijzingen zonder werk toetste de 'kalender'-op dat pad niet).
const load = (size: number, seed: number) => {
  const project = generateBenchmarkProject(size, { seed });
  const zes = { ...project.calendar, id: 'cal-zes', name: 'Zes uur', workEndHour: project.calendar.workStartHour + 6, hoursPerDay: 6 };
  S().applyLoadedProject({
    ...project,
    resourceCalendars: [...(project.resourceCalendars ?? []), zes],
    assignments: project.assignments.map((a) => ({ ...a, plannedWorkMinutes: 2400, remainingWorkMinutes: 2400 })),
  }, { filePath: null, recompute: false });
};
const leafIds = () => S().tasks.filter((t) => t.childIds.length === 0).map((t) => t.id);
const view = () => JSON.stringify({ tasks: S().tasks, assignments: S().assignments, rows: S().viewRows.map((r) => (r.kind === 'task' ? `${r.rowKey}:${r.depth}` : r.rowKey)) });

// ── A. bulk = los na elkaar (taken + rijen), undo/redo ────────────────────────────────────────────
type Op = { label: string; run: (s: ReturnType<typeof S>, id: string) => void };
const ops: Op[] = [
  { label: 'prioriteit', run: (s, id) => s.updateTask(id, { priority: 42 }) },
  { label: 'kalender', run: (s, id) => s.setTaskCalendar(id, 'cal-zes') },
  { label: 'voortgang', run: (s, id) => { s.enterTaskProgress(id, { field: 'completion', value: 0.25 }, { today: '2026-03-02' }); } },
  { label: 'naam (sorteersleutel)', run: (s, id) => s.updateTask(id, { name: `Z ${id}` }) },
];
for (const op of ops) {
  load(300, 11);
  const ids = leafIds().filter((_, i) => i % 3 === 0);
  for (const id of ids) op.run(S(), id);
  const loose = view();
  load(300, 11);
  const before = view();
  bulk.applyToTaskIds(ids, (s, id) => op.run(s, id));
  const after = view();
  ok(`A ${op.label}: bulk gelijk aan los (taken + rijen)`, after === loose);
  ok(`A ${op.label}: de bulk verandert echt iets`, after !== before);
  S().undo();
  ok(`A ${op.label}: undo herstelt taken + rijen`, view() === before);
  S().redo();
  ok(`A ${op.label}: redo geeft taken + rijen van na de bulk`, view() === after);
}
// Bulkverwijderen: rijen na afloop gelijk aan losse deleteTask-aanroepen.
{
  load(300, 12);
  const ids = S().tasks.filter((_, i) => i % 7 === 2).map((t) => t.id);
  for (const id of ids) S().deleteTask(id);
  const loose = view();
  load(300, 12);
  bulk.deleteTasksBulk(ids);
  ok('A verwijderen: bulk gelijk aan los (taken + rijen)', view() === loose);
}

// ── B. removeTaskSubtrees tegen de oude per-wortelroute ──────────────────────────────────────────
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type RemovalState = { tasks: Task[]; sequences: Sequence[]; assignments: ResourceAssignment[]; selectedTaskIds: string[]; activeTaskId: string | null };
function oldRemove(s: RemovalState, rootIds: readonly string[]): Set<string> {
  const detach = (tasks: Task[], id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task?.parentId) return;
    const parent = tasks.find((t) => t.id === task.parentId);
    if (parent) parent.childIds = parent.childIds.filter((cid) => cid !== id);
  };
  const collect = (tasks: Task[], rootId: string) => {
    const out: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id); out.push(id);
      const t = tasks.find((x) => x.id === id);
      if (t) for (const cid of t.childIds) walk(cid);
    };
    walk(rootId);
    return out;
  };
  const removeIds = new Set<string>();
  for (const id of rootIds) {
    detach(s.tasks, id);
    for (const sid of collect(s.tasks, id)) removeIds.add(sid);
  }
  s.tasks = s.tasks.filter((t) => !removeIds.has(t.id));
  s.sequences = s.sequences.filter((q) => !removeIds.has(q.predecessorId) && !removeIds.has(q.successorId));
  s.assignments = s.assignments.filter((a) => !removeIds.has(a.taskId));
  s.selectedTaskIds = s.selectedTaskIds.filter((sid) => !removeIds.has(sid));
  if (s.activeTaskId && removeIds.has(s.activeTaskId)) s.activeTaskId = s.selectedTaskIds[0] ?? null;
  return removeIds;
}
let bCases = 0;
for (let seed = 1; seed <= 400; seed++) {
  const rnd = mulberry32(seed);
  const n = 1 + Math.floor(rnd() * 40);
  const tasks = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `t${i}`, parentId: undefined as string | undefined, childIds: [] as string[] }));
  for (let i = 1; i < n; i++) {
    if (rnd() < 0.7) {
      const p = tasks[Math.floor(rnd() * i)];
      tasks[i].parentId = p.id;
      p.childIds.push(tasks[i].id);
    }
  }
  if (n > 3 && rnd() < 0.1) tasks[1].childIds.push(tasks[0].id); // corrupte kring
  const sequences = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, predecessorId: `t${Math.floor(rnd() * n)}`, successorId: `t${Math.floor(rnd() * n)}` }));
  const assignments = Array.from({ length: n }, (_, i) => ({ id: `a${i}`, taskId: `t${Math.floor(rnd() * n)}`, resourceId: 'r' }));
  const selectedTaskIds = tasks.filter(() => rnd() < 0.3).map((t) => t.id);
  const roots = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => (rnd() < 0.1 ? 'onbekend' : `t${Math.floor(rnd() * n)}`));
  const mk = (): RemovalState => JSON.parse(JSON.stringify({ tasks, sequences, assignments, selectedTaskIds, activeTaskId: selectedTaskIds[0] ?? 't0' }));
  const a = mk();
  const b = mk();
  const ra = [...oldRemove(a, roots)];
  const rb = [...removeTaskSubtrees(b, roots)];
  bCases++;
  if (JSON.stringify([ra, a]) !== JSON.stringify([rb, b])) { ok(`B seed ${seed}: gelijk aan de oude route`, false); break; }
}
ok(`B ${bCases} willekeurige bossen gelijk aan de oude route`, bCases === 400);

// ── C. schaal ────────────────────────────────────────────────────────────────────────────────────
const time = (fn: () => void) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
load(8000, 3);
const leaves = leafIds();
const msPrio = time(() => bulk.applyToTaskIds(leaves.slice(0, 2000), (s, id) => s.updateTask(id, { priority: 7 })));
const msCal = time(() => bulk.applyToTaskIds(leaves.slice(0, 2000), (s, id) => s.setTaskCalendar(id, 'x')));
const msProg = time(() => bulk.applyToTaskIds(leaves.slice(0, 2000), (s, id) => { s.enterTaskProgress(id, { field: 'completion', value: 0.5 }, { today: '2026-03-02' }); }));
load(8000, 3);
const msDel = time(() => bulk.deleteTasksBulk(S().tasks.map((t) => t.id)));
ok('C alles verwijderen laat niets achter', S().tasks.length === 0 && S().viewRows.length === 0);
console.log(`   8000 taken: prioriteit ×2000 ${msPrio.toFixed(0)} ms, kalender ×2000 ${msCal.toFixed(0)} ms, voortgang ×2000 ${msProg.toFixed(0)} ms, alles verwijderen ${msDel.toFixed(0)} ms`);
ok('C prioriteit op 2000 taken < 15 s', msPrio < 15000, `${msPrio.toFixed(0)} ms`);
ok('C kalender op 2000 taken < 15 s', msCal < 15000, `${msCal.toFixed(0)} ms`);
ok('C voortgang op 2000 taken < 15 s', msProg < 15000, `${msProg.toFixed(0)} ms`);
ok('C alles verwijderen < 5 s', msDel < 5000, `${msDel.toFixed(0)} ms`);

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-bulk-scale: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-bulk-scale: ${checks}/${checks} groen`);
