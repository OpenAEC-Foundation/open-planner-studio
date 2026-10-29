import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createEmptyGridSelection, reconcileGridSelection, syncActiveCellToPublishedTask, updateGridSelection,
  type GridSelectionState,
} from '@/engine/taskGrid/selection';
import { createTaskGridRowIndex, type TaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { GHOST_ROW_KEY } from '@/engine/taskGrid/ghostRow';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

// Voer de ECHTE setSelection-updater uit, zonder een productie-API alleen voor tests te maken.
// Een verplaatste/meervoudige callback faalt expliciet. De browsertest bewaakt React en toetsen.
const source = readFileSync('src/components/task-grid/FullTaskGrid.tsx', 'utf8');
const bodies = [...source.matchAll(/setSelection\(current => \{([\s\S]*?)\n    \}\);/g)];
assert.equal(bodies.length, 1, 'precies één synchronisatie-updater in TaskGridSurface');
const columns = [taskColumnId('task.name'), taskColumnId('task.time.scheduleDuration')];
const runUpdater = new Function(
  'current', 'selectedTaskIds', 'publishedActiveTaskId', 'rowIndex', 'previousRowsRef',
  'visibleColumnIds', 'previousColumnsRef', 'createEmptyGridSelection', 'updateGridSelection',
  'reconcileGridSelection', 'syncActiveCellToPublishedTask', 'GHOST_ROW_KEY', bodies[0][1],
) as (...args: unknown[]) => GridSelectionState;

function run(current: GridSelectionState, published: readonly string[], active: string | null, rows: TaskGridRowIndex) {
  return runUpdater(current, published, active, rows, { current: rows }, columns, { current: columns },
    createEmptyGridSelection, updateGridSelection, reconcileGridSelection, syncActiveCellToPublishedTask, GHOST_ROW_KEY);
}
const row = (id: string, rowKey = id): ViewRow => ({
  kind: 'task', rowKey, task: { id } as Task, depth: 0, dimmed: false,
});
const rows = createTaskGridRowIndex([row('a'), row('b'), row('c')]);
const first = { rowKey: 'a', columnId: columns[0] };
const last = { rowKey: 'c', columnId: columns[1] };
const selection = updateGridSelection(
  updateGridSelection(createEmptyGridSelection(), first, rows, columns, 'replace'), last, rows, columns, 'extend',
);
assert.deepEqual(run(createEmptyGridSelection(), [], null, rows),
  updateGridSelection(createEmptyGridSelection(), first, rows, columns, 'replace'));
assert.deepEqual(run(createEmptyGridSelection(), ['a', 'b'], 'b', rows),
  updateGridSelection(createEmptyGridSelection(), { ...first, rowKey: 'b' }, rows, columns, 'replace'));
assert.deepEqual(run(createEmptyGridSelection(), [], null, createTaskGridRowIndex([])), createEmptyGridSelection());

// Alle kleine lijsten, inclusief lege lijsten, andere volgorde en asymmetrische duplicaten.
// [a,a] tegenover [a,b] is bewust gelijk volgens het oude contract; de omkering is dat niet.
const lists: string[][] = [[]];
let level: string[][] = [[]];
for (let length = 1; length <= 3; length++) {
  level = level.flatMap(prefix => ['a', 'b', 'c'].map(id => [...prefix, id]));
  lists.push(...level);
}
let cases = 0;
for (const ids of lists) for (const published of lists) for (const active of ['c', 'b', null]) {
  const current = Object.freeze({ ...selection, selectedTaskIds: Object.freeze([...ids]) });
  const rhs = Object.freeze([...published]);
  const before = JSON.stringify([current, rhs]);
  const reconciled = reconcileGridSelection(current, rows, rows, columns, columns);
  const same = ids.length === published.length && ids.every(id => published.includes(id));
  const expected = same && current.activeTaskId === active ? reconciled
    : syncActiveCellToPublishedTask(reconciled, active, rhs, rows, columns);
  const result = run(current, rhs, active, rows);
  assert.deepEqual(result, expected);
  if (same && current.activeTaskId === active && reconciled === current) assert.equal(result, current);
  assert.equal(JSON.stringify([current, rhs]), before, 'geen mutatie of deduplicatie van invoer');
  cases++;
}

// De tweede occurrence mag niet naar de eerste springen doordat de membershiptest te streng is.
const grouped = createTaskGridRowIndex([
  { kind: 'group', rowKey: 'g1', key: 'g1', label: 'Een', count: 1, depth: 0, levelIndex: 0, collapsed: false },
  row('a', 'g1/a'),
  { kind: 'group', rowKey: 'g2', key: 'g2', label: 'Twee', count: 2, depth: 0, levelIndex: 0, collapsed: false },
  row('b', 'g2/b'), row('a', 'g2/a'),
]);
const groupedSelection = updateGridSelection(
  updateGridSelection(createEmptyGridSelection(), { ...first, rowKey: 'g1/a' }, grouped, columns, 'replace'),
  { ...last, rowKey: 'g2/a' }, grouped, columns, 'extend',
);
assert.equal(run(groupedSelection, ['b', 'a'], 'a', grouped), groupedSelection,
  'volgorde-onafhankelijke membership behoudt object, cel, anker, bereik en tweede occurrence');

const budgets = [];
for (const count of [1_000, 5_000, 10_000]) {
  const ids = Array.from({ length: count }, (_, i) => `taak-${i}`);
  const index = createTaskGridRowIndex(ids.map(id => row(id)));
  const current = updateGridSelection(
    updateGridSelection(createEmptyGridSelection(), { ...first, rowKey: ids[0] }, index, columns, 'replace'),
    { ...last, rowKey: ids[count - 1] }, index, columns, 'extend',
  );
  let reads = 0;
  const published = new Proxy([...ids], {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads++;
      return Reflect.get(target, property, receiver);
    },
  });
  const result = run(current, published, current.activeTaskId, index);
  assert.equal(result, current, 'identieke selectie houdt exact dezelfde referentie');
  // De proxy telt gelezen RHS-items, geen tijden: de oude includes-loop is deterministisch kwadratisch.
  if (process.env.OPS_SELECTION_BASELINE === '1') assert.equal(reads, count * (count + 1) / 2);
  else assert.ok(reads <= count, `${count} ids: ${reads} RHS-lezingen overschrijden het lineaire budget`);
  budgets.push({ count, rhsReads: reads, outputSha256: createHash('sha256').update(JSON.stringify(result)).digest('hex') });
}
const report = { cases, budgets };
if (process.env.OPS_SELECTION_CONTRACT_OUT) {
  writeFileSync(process.env.OPS_SELECTION_CONTRACT_OUT, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`OK TaskGridSurface publicatieselectie: ${cases} randgevallen; ${JSON.stringify(budgets)}`);
