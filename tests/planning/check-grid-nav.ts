import {
  neighbourGridCell, isLastGridRow, controlKindOf, liveGridNavDirection, scrollDeltaToReveal,
  type GridControlKind, type GridDirection,
} from '@/utils/gridNavigation';
import { resolveTaskGridCommand } from '@/engine/taskGrid/navigation';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const rows = ['r1', 'r2', 'r3'];
const cols = ['name', 'type', 'maxUnits'] as const;
const nb = (rowId: string, field: string, d: GridDirection) =>
  neighbourGridCell(rows, cols, { rowId, field: field as typeof cols[number] }, d);

eq('midden ↓', nb('r2', 'type', 'down'), { rowId: 'r3', field: 'type' });
eq('midden ↑', nb('r2', 'type', 'up'), { rowId: 'r1', field: 'type' });
eq('midden →', nb('r2', 'type', 'right'), { rowId: 'r2', field: 'maxUnits' });
eq('midden ←', nb('r2', 'type', 'left'), { rowId: 'r2', field: 'name' });

eq('bovenrand ↑', nb('r1', 'name', 'up'), null);
eq('onderrand ↓', nb('r3', 'name', 'down'), null);
eq('linkerrand ←', nb('r2', 'name', 'left'), null);
eq('rechterrand →', nb('r2', 'maxUnits', 'right'), null);

eq('onbekende rij', nb('weg', 'name', 'down'), null);
eq('onbekend veld', nb('r2', 'weg', 'down'), null);

eq('enkele rij ↓', neighbourGridCell(['solo'], cols, { rowId: 'solo', field: 'name' }, 'down'), null);
eq('enkele rij ↑', neighbourGridCell(['solo'], cols, { rowId: 'solo', field: 'name' }, 'up'), null);
eq('lege kolomlijst', neighbourGridCell(rows, [], { rowId: 'r1', field: 'name' }, 'down'), null);
eq('lege rijenlijst', neighbourGridCell([], cols, { rowId: 'r1', field: 'name' }, 'down'), null);

eq('↓ houdt de kolom', nb('r1', 'maxUnits', 'down'), { rowId: 'r2', field: 'maxUnits' });
eq('→ houdt de rij', nb('r3', 'name', 'right'), { rowId: 'r3', field: 'type' });

eq('laatste rij', isLastGridRow(rows, 'r3'), true);
eq('niet de laatste rij', isLastGridRow(rows, 'r2'), false);
eq('lege lijst heeft geen laatste rij', isLastGridRow([], 'r1'), false);
eq('concept-rij is de laatste', isLastGridRow([...rows, '__draft'], '__draft'), true);
eq('met concept-rij is r3 niet meer de laatste', isLastGridRow([...rows, '__draft'], 'r3'), false);

eq('select', controlKindOf({ tagName: 'SELECT' }), 'select');
eq('textarea', controlKindOf({ tagName: 'TEXTAREA' }), 'text');
eq('input zonder type', controlKindOf({ tagName: 'INPUT' }), 'text');
eq('input text', controlKindOf({ tagName: 'INPUT', type: 'text' }), 'text');
eq('input number', controlKindOf({ tagName: 'INPUT', type: 'number' }), 'number');
eq('input checkbox', controlKindOf({ tagName: 'INPUT', type: 'checkbox' }), 'other');
eq('button', controlKindOf({ tagName: 'BUTTON' }), 'other');
eq('niets', controlKindOf(null), 'other');
eq('kleine letters tellen ook', controlKindOf({ tagName: 'input', type: 'NUMBER' }), 'number');

const dir = (key: string, control: GridControlKind, mod: Record<string, boolean> = {}) =>
  liveGridNavDirection({ key, ...mod }, control);

for (const control of ['text', 'number', 'select', 'other'] as GridControlKind[]) {
  eq(`Enter op ${control}`, dir('Enter', control), 'down');
  eq(`Shift+Enter op ${control}`, dir('Enter', control, { shiftKey: true }), 'up');
}

{
  const taskRows: ViewRow[] = ['t1', 't2', 't3', 't4'].map(id => ({
    kind: 'task', rowKey: id, task: { id } as Task, depth: 0, dimmed: false,
  }));
  taskRows.splice(2, 0, {
    kind: 'group', rowKey: 'groep', key: 'groep', label: 'Band', count: 2,
    depth: 0, levelIndex: 0, collapsed: false,
  });
  const taskColumns = [taskColumnId('name'), taskColumnId('duration'), taskColumnId('float')];
  const taskRowIndex = createTaskGridRowIndex(taskRows);
  const active = { rowKey: 't2', columnId: taskColumns[1] };
  const command = (
    key: string,
    options: {
      mode?: 'select' | 'edit'; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean;
      altKey?: boolean; activeCell?: typeof active; readOnly?: boolean; viewportHeight?: number;
    } = {},
  ) => resolveTaskGridCommand({
    event: {
      key, shiftKey: options.shiftKey, ctrlKey: options.ctrlKey, metaKey: options.metaKey,
      altKey: options.altKey,
    },
    mode: options.mode ?? 'select',
    active: options.activeCell ?? active,
    rowIndex: taskRowIndex,
    columns: taskColumns,
    rowHeight: 36,
    viewportHeight: options.viewportHeight ?? 72,
    isReadOnly: options.readOnly ? () => true : () => false,
  });

  eq('Taakgrid pijl omhoog', command('ArrowUp'), { kind: 'move', cell: { rowKey: 't1', columnId: taskColumns[1] }, extend: false });
  eq('Taakgrid pijl omlaag slaat groepskop over', command('ArrowDown'), { kind: 'move', cell: { rowKey: 't3', columnId: taskColumns[1] }, extend: false });
  eq('Taakgrid Shift+pijl breidt uit', command('ArrowRight', { shiftKey: true }), { kind: 'move', cell: { rowKey: 't2', columnId: taskColumns[2] }, extend: true });
  eq('Taakgrid pijl-links volgt de fysieke buur links', command('ArrowLeft'), { kind: 'move', cell: { rowKey: 't2', columnId: taskColumns[0] }, extend: false });
  eq('Taakgrid pijl-rechts volgt de fysieke buur rechts', command('ArrowRight'), { kind: 'move', cell: { rowKey: 't2', columnId: taskColumns[2] }, extend: false });
  eq('Taakgrid Home', command('Home'), { kind: 'move', cell: { rowKey: 't2', columnId: taskColumns[0] }, extend: false });
  eq('Taakgrid End', command('End'), { kind: 'move', cell: { rowKey: 't2', columnId: taskColumns[2] }, extend: false });
  eq('Taakgrid Ctrl+Home', command('Home', { ctrlKey: true }), { kind: 'move', cell: { rowKey: 't1', columnId: taskColumns[0] }, extend: false });
  eq('Taakgrid Cmd+End', command('End', { metaKey: true }), { kind: 'move', cell: { rowKey: 't4', columnId: taskColumns[2] }, extend: false });
  eq('Taakgrid PageDown telt fysieke groepskop in paginagrootte', command('PageDown'), { kind: 'move', cell: { rowKey: 't3', columnId: taskColumns[1] }, extend: false });
  eq('Taakgrid PageUp klemt boven', command('PageUp'), { kind: 'move', cell: { rowKey: 't1', columnId: taskColumns[1] }, extend: false });
  eq('Taakgrid Tab loopt door naar volgende taakrij',
    command('Tab', { activeCell: { rowKey: 't2', columnId: taskColumns[2] } }),
    { kind: 'move', cell: { rowKey: 't3', columnId: taskColumns[0] }, extend: false });
  eq('Taakgrid Shift+Tab loopt terug',
    command('Tab', { shiftKey: true, activeCell: { rowKey: 't2', columnId: taskColumns[0] } }),
    { kind: 'move', cell: { rowKey: 't1', columnId: taskColumns[2] }, extend: false });
  eq('Enter vanuit selectie start editor', command('Enter'), { kind: 'start-edit', cell: active });
  eq('F2 vanuit selectie start editor', command('F2'), { kind: 'start-edit', cell: active });
  eq('Enter op read-only geeft expliciet readonly', command('Enter', { readOnly: true }), { kind: 'readonly', cell: active });
  eq('F2 op read-only geeft expliciet readonly', command('F2', { readOnly: true }), { kind: 'readonly', cell: active });
  eq('Direct typen op read-only geeft expliciet readonly', command('x', { readOnly: true }), { kind: 'readonly', cell: active });
  eq('Pijl mag wel naar read-only kolom navigeren', command('ArrowRight', { readOnly: true }), { kind: 'move', cell: { rowKey: 't2', columnId: taskColumns[2] }, extend: false });
  eq('Enter vanuit editor commit en gaat omlaag', command('Enter', { mode: 'edit' }), { kind: 'commit-edit', cell: active, nextCell: { rowKey: 't3', columnId: taskColumns[1] } });
  eq('Shift+Enter vanuit editor commit en gaat omhoog', command('Enter', { mode: 'edit', shiftKey: true }), { kind: 'commit-edit', cell: active, nextCell: { rowKey: 't1', columnId: taskColumns[1] } });
  eq('Enter op laatste rij houdt cel actief',
    command('Enter', { mode: 'edit', activeCell: { rowKey: 't4', columnId: taskColumns[1] } }),
    { kind: 'commit-edit', cell: { rowKey: 't4', columnId: taskColumns[1] }, nextCell: { rowKey: 't4', columnId: taskColumns[1] } });
  eq('Escape vanuit editor annuleert', command('Escape', { mode: 'edit' }), { kind: 'cancel-edit', cell: active });
  eq('Delete vraagt atomaire leegmaak', command('Delete'), { kind: 'clear-cells' });
  eq('Backspace vraagt atomaire leegmaak', command('Backspace'), { kind: 'clear-cells' });
  eq('Direct typen start vervangende editor', command('x'), { kind: 'start-edit', cell: active, replacement: 'x' });

  eq('AltGr+@ (Ctrl+Alt samen) start typen-om-te-bewerken',
    command('@', { ctrlKey: true, altKey: true }), { kind: 'start-edit', cell: active, replacement: '@' });
  eq('macOS Option+e (kaal Alt) start typen-om-te-bewerken',
    command('e', { altKey: true }), { kind: 'start-edit', cell: active, replacement: 'e' });
  eq('Cmd+Option (metaKey erbij) blijft een commando, geen typen',
    command('e', { altKey: true, metaKey: true }), { kind: 'unhandled' });
  eq('Kale Ctrl zonder Alt blijft een commando, geen typen',
    command('c', { ctrlKey: true }), { kind: 'unhandled' });
  eq('Ctrl+C (kopiëren) blijft onaangeroerd een commando',
    command('c', { ctrlKey: true }), { kind: 'unhandled' });
  eq('Alt+ArrowLeft (geen afdrukbaar teken) blijft gereserveerd voor uitspringen',
    command('ArrowLeft', { altKey: true }), { kind: 'unhandled' });

  eq('Insert vraagt bewaakte taakinsert', command('Insert'), { kind: 'insert-task', anchorRowKey: 't2', targetColumnId: taskColumnId('task.name') });
  eq('Ctrl+pijl-links blijft voor bestaande structuurshortcut', command('ArrowLeft', { ctrlKey: true }), { kind: 'unhandled' });
  eq('Ctrl+pijl-rechts blijft voor bestaande structuurshortcut', command('ArrowRight', { ctrlKey: true }), { kind: 'unhandled' });
  eq('Cmd+pijl-links blijft voor bestaande structuurshortcut', command('ArrowLeft', { metaKey: true }), { kind: 'unhandled' });
  eq('Escape vanuit selectie geeft een expliciete uitgang naar de gridcontainer', command('Escape'), { kind: 'exit-to-container' });

  eq('Tab op de allerlaatste cel verlaat de grid',
    command('Tab', { activeCell: { rowKey: 't4', columnId: taskColumns[2] } }),
    { kind: 'unhandled' });
  eq('Shift+Tab op de allereerste cel verlaat de grid',
    command('Tab', { shiftKey: true, activeCell: { rowKey: 't1', columnId: taskColumns[0] } }),
    { kind: 'unhandled' });
  eq('Tab op de een-na-laatste kolom van de laatste rij blijft binnen de grid',
    command('Tab', { activeCell: { rowKey: 't4', columnId: taskColumns[1] } }),
    { kind: 'move', cell: { rowKey: 't4', columnId: taskColumns[2] }, extend: false });
  eq('Shift+Tab op de tweede cel van de eerste rij blijft binnen de grid',
    command('Tab', { shiftKey: true, activeCell: { rowKey: 't1', columnId: taskColumns[1] } }),
    { kind: 'move', cell: { rowKey: 't1', columnId: taskColumns[0] }, extend: false });
  eq('Geen actieve cel levert unhandled', resolveTaskGridCommand({
    event: { key: 'Enter' }, mode: 'select', active: null, rowIndex: taskRowIndex, columns: taskColumns,
    rowHeight: 36, viewportHeight: 72, isReadOnly: () => false,
  }), { kind: 'unhandled' });
  eq('Nul kolommen levert unhandled', resolveTaskGridCommand({
    event: { key: 'Enter' }, mode: 'select', active, rowIndex: taskRowIndex, columns: [],
    rowHeight: 36, viewportHeight: 72, isReadOnly: () => false,
  }), { kind: 'unhandled' });

  const perfRows: ViewRow[] = Array.from({ length: 50_000 }, (_, index) => ({
    kind: 'task', rowKey: `perf-${index}`, task: { id: `perf-task-${index}` } as Task,
    depth: 0, dimmed: false,
  }));
  const perfInput = {
    event: { key: 'ArrowDown' }, mode: 'select' as const,
    active: { rowKey: 'perf-25000', columnId: taskColumns[0] },
    rowIndex: createTaskGridRowIndex(perfRows), columns: taskColumns,
    rowHeight: 36, viewportHeight: 900, isReadOnly: () => false,
  };
  for (let index = 0; index < 20; index++) resolveTaskGridCommand(perfInput);
  const startedAt = performance.now();
  for (let index = 0; index < 1_000; index++) resolveTaskGridCommand(perfInput);
  const elapsed = performance.now() - startedAt;
  eq(`1.000 navigatiecommando's op 50.000 rijen blijven onder 100 ms (${elapsed.toFixed(1)} ms)`,
    elapsed < 100, true);
}

eq('↓ in tekst', dir('ArrowDown', 'text'), 'down');
eq('↑ in tekst', dir('ArrowUp', 'text'), 'up');
eq('↓ in select blijft de optiekeuze', dir('ArrowDown', 'select'), null);
eq('↑ in select blijft de optiekeuze', dir('ArrowUp', 'select'), null);
eq('↓ in number blijft de spinner', dir('ArrowDown', 'number'), null);
eq('↑ in number blijft de spinner', dir('ArrowUp', 'number'), null);
eq('↓ op overig', dir('ArrowDown', 'other'), null);

for (const mod of ['altKey', 'ctrlKey', 'metaKey']) {
  eq(`${mod}+Enter`, dir('Enter', 'text', { [mod]: true }), null);
  eq(`${mod}+↓`, dir('ArrowDown', 'text', { [mod]: true }), null);
}
eq('Shift+↓ in tekst', dir('ArrowDown', 'text', { shiftKey: true }), null);
eq('Shift+↑ in tekst', dir('ArrowUp', 'text', { shiftKey: true }), null);

for (const key of ['a', ' ', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Backspace']) {
  eq(`${key} is geen navigatie`, dir(key, 'text'), null);
}

{
  let cur: { rowId: string; field: string } | null = { rowId: 'r1', field: 'name' };
  const pad: string[] = [];
  const stap = (d: GridDirection, control: GridControlKind, key: string) => {
    const richting = liveGridNavDirection({ key, shiftKey: d === 'up' && key === 'Enter' }, control);
    if (!richting) { pad.push('(geen)'); return; }
    const next = cur && neighbourGridCell(rows, cols, cur as { rowId: string; field: typeof cols[number] }, richting);
    if (next) cur = next;
    pad.push(cur!.rowId);
  };
  stap('down', 'text', 'ArrowDown');
  stap('down', 'text', 'ArrowDown');
  stap('up', 'text', 'ArrowUp');
  stap('down', 'text', 'Enter');
  stap('up', 'text', 'Enter');
  eq('loop door de naamkolom', pad, ['r2', 'r3', 'r2', 'r3', 'r2']);
}

{
  const view = { top: 235, bottom: 863 };
  const HEAD = 23;
  const rij = (top: number) => ({ top, bottom: top + 32 });

  eq('rij midden in beeld', scrollDeltaToReveal(view, rij(500), HEAD), 0);
  eq('rij precies tegen de onderrand', scrollDeltaToReveal(view, rij(831), HEAD), 0);
  eq('rij precies onder de kopregel', scrollDeltaToReveal(view, rij(258), HEAD), 0);

  eq('rij net onder de vouw', scrollDeltaToReveal(view, rij(865), HEAD), 34);
  eq('rij ver onder de vouw', scrollDeltaToReveal(view, rij(1200), HEAD), 369);

  eq('rij onder de kopregel verstopt', scrollDeltaToReveal(view, rij(240), HEAD), -18);
  eq('rij helemaal boven de scroller', scrollDeltaToReveal(view, rij(100), HEAD), -158);
  eq('zelfde rij zonder sticky kop', scrollDeltaToReveal(view, rij(240), 0), 0);
  eq('sticky kop verandert de uitkomst', scrollDeltaToReveal(view, rij(250), HEAD) !== scrollDeltaToReveal(view, rij(250), 0), true);

  eq('te hoge rij, bovenkant boven de kop', scrollDeltaToReveal({ top: 0, bottom: 100 }, { top: 10, bottom: 400 }, 20), -10);
  eq('te hoge rij die te ver zou zakken', scrollDeltaToReveal({ top: 0, bottom: 100 }, { top: 50, bottom: 500 }, 20), 30);

  eq('rij vult het venster precies', scrollDeltaToReveal({ top: 0, bottom: 100 }, { top: 20, bottom: 100 }, 20), 0);
}

if (diffs.length === 0) {
  console.log(`OK  rasternavigatie: ${checks}/${checks} groen`);
  process.exit(0);
}
for (const d of diffs) console.log(`XX  ${d}`);
console.log(`XX  rasternavigatie: ${diffs.length}/${checks} FOUT`);
process.exit(1);
