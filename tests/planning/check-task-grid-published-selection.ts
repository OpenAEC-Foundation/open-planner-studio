import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createEmptyGridSelection, reconcileGridSelection, syncActiveCellToPublishedTask, updateGridSelection,
  withSelectionAnchor, type GridSelectionState,
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
// Issue #899: React voert de updater pas bij de volgende render uit, als de refs al op de nieuwe
// rijen staan. Leest hij ze daar, dan kent de herstelregel de oude plek niet en springt de cursor
// naar de bovenste rij. De updater mag dus alleen de vooraf vastgelegde waarden gebruiken.
assert.ok(!/previous(Rows|Columns)Ref/.test(bodies[0][1]),
  'de synchronisatie-updater leest geen previousRowsRef/previousColumnsRef (die zijn dan al bijgewerkt)');
const columns = [taskColumnId('task.name'), taskColumnId('task.time.scheduleDuration')];
const runUpdater = new Function(
  'current', 'selectedTaskIds', 'publishedActiveTaskId', 'rowIndex', 'previousRows',
  'visibleColumnIds', 'previousColumns', 'createEmptyGridSelection', 'updateGridSelection',
  'reconcileGridSelection', 'syncActiveCellToPublishedTask', 'GHOST_ROW_KEY', 'preferredRowKey',
  'withSelectionAnchor', 'storeAnchorRowKey', 'anchorChanged', bodies[0][1],
) as (...args: unknown[]) => GridSelectionState;

function run(
  current: GridSelectionState, published: readonly string[], active: string | null, rows: TaskGridRowIndex,
  previousRows: TaskGridRowIndex = rows, storeAnchorRowKey: string | null = null, anchorChanged = false,
) {
  return runUpdater(current, published, active, rows, previousRows, columns, columns,
    createEmptyGridSelection, updateGridSelection, reconcileGridSelection, syncActiveCellToPublishedTask, GHOST_ROW_KEY,
    null, withSelectionAnchor, storeAnchorRowKey, anchorChanged);
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

// Issue #899: de cursor stond op c (derde van vijf); c verdwijnt (ingeklapt of verwijderd) en de store
// publiceert nog niets nieuws. De cursor gaat naar de rij op die plek (d), niet naar de bovenste.
{
  const five = createTaskGridRowIndex(['a', 'b', 'c', 'd', 'e'].map(id => row(id)));
  const withoutC = createTaskGridRowIndex(['a', 'b', 'd', 'e'].map(id => row(id)));
  const onC = updateGridSelection(createEmptyGridSelection(), { rowKey: 'c', columnId: columns[1] }, five, columns, 'replace');
  const after = run(onC, ['c'], 'c', withoutC, five);
  assert.equal(after.active?.rowKey, 'd', 'verdwenen rij ⇒ de rij op dezelfde plek, niet de bovenste');
  assert.equal(after.active?.columnId, columns[1], 'de kolom blijft');
}

// Review #1004, rondes 4 en 5: tijdlijn en lijst delen het Shift-anker van de store.
{
  const onB = updateGridSelection(
    updateGridSelection(createEmptyGridSelection(), first, rows, columns, 'replace'),
    { rowKey: 'b', columnId: columns[0] }, rows, columns, 'extend',
  );
  assert.equal(onB.anchor?.rowKey, 'a');
  // Een gewone klik in de tijdlijn op de cursorrij: nieuwe selectie, nieuw anker.
  const adopted = run(onB, ['b'], 'b', rows, rows, 'b', true);
  assert.equal(adopted.anchor?.rowKey, 'b', 'een gewone klik in de tijdlijn op de cursorrij is het nieuwe anker');
  assert.equal(adopted.active?.rowKey, 'b', 'de cursor blijft staan');
  // Een kader rond een andere rij, met gelijke selectie: alleen het anker is nieuw.
  assert.equal(run(onB, ['a', 'b'], 'b', rows, rows, 'c', true).anchor?.rowKey, 'c', 'een nieuw anker bij gelijke selectie');
  assert.equal(run(onB, ['a', 'b'], 'b', rows, rows, 'c', false).anchor?.rowKey, 'a',
    'een anker dat de lijst al kende, trekt haar eigen anker niet terug');
  // Shift-klik in de tijdlijn: de selectie verandert, het anker van de store blijft (ronde 5).
  const shifted = run(onB, ['a', 'b', 'c'], 'c', rows, rows, 'a', false);
  assert.equal(shifted.active?.rowKey, 'c', 'de cursor gaat naar de aangeklikte rij');
  assert.equal(shifted.anchor?.rowKey, 'a', 'het anker blijft dat van de store');
}

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
