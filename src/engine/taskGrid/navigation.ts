import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { GridKeyEventLike } from '@/utils/gridNavigation';
import type { TaskColumnId } from '@/types/taskGrid';
import type { GridCellAddress } from './selection';

/** Het minimale rijcontract dat navigatie nodig heeft; zowel TaskGridRowIndex als een generieke
 *  DOM-gridindex kan dit leveren zonder elkaars domeinmodel te importeren. */
export interface TaskGridNavigationIndex {
  readonly taskRows: readonly { rowKey: string }[];
  readonly taskIndexByRowKey: ReadonlyMap<string, number>;
  readonly taskAbsoluteIndices: readonly number[];
}

export interface TaskGridCommandInput {
  event: GridKeyEventLike;
  mode: 'select' | 'edit';
  active: GridCellAddress | null;
  rowIndex: TaskGridNavigationIndex;
  columns: readonly TaskColumnId[];
  rowHeight: number;
  viewportHeight: number;
  isReadOnly: (cell: GridCellAddress) => boolean;
}

export type TaskGridCommand =
  | { kind: 'move'; cell: GridCellAddress; extend: boolean }
  | { kind: 'start-edit'; cell: GridCellAddress; replacement?: string }
  | { kind: 'readonly'; cell: GridCellAddress }
  | { kind: 'commit-edit'; cell: GridCellAddress; nextCell: GridCellAddress }
  | { kind: 'cancel-edit'; cell: GridCellAddress }
  | { kind: 'clear-cells' }
  | { kind: 'insert-task'; anchorRowKey: string; targetColumnId: TaskColumnId }
  | { kind: 'exit-to-container' }
  | { kind: 'unhandled' };

function startEdit(input: TaskGridCommandInput, replacement?: string): TaskGridCommand {
  const cell = input.active!;
  return input.isReadOnly(cell)
    ? { kind: 'readonly', cell }
    : replacement === undefined
      ? { kind: 'start-edit', cell }
      : { kind: 'start-edit', cell, replacement };
}

export function resolveTaskGridCommand(input: TaskGridCommandInput): TaskGridCommand {
  const { event, active, columns } = input;
  const rows = input.rowIndex.taskRows;
  if (!active || columns.length === 0 || rows.length === 0) return { kind: 'unhandled' };
  const rowIndex = input.rowIndex.taskIndexByRowKey.get(active.rowKey) ?? -1;
  const columnIndex = columns.indexOf(active.columnId);
  // AltGr (fysiek: Ctrl+Alt tegelijk, gerapporteerd als event.ctrlKey === event.altKey === true)
  // en macOS Option leveren op NL/DE/PL-indelingen resp. op de Mac afdrukbare tekens op (@, €, [,
  // \, |, …) die de browser als één-teken `event.key` doorgeeft. Zonder deze uitzondering bailt de
  // regel hieronder op `event.altKey` en start typen-om-te-bewerken daar nooit. Cmd+Alt (macOS) en
  // kale Ctrl blijven wél gereserveerd voor commando's — alleen de combinatie die typografisch een
  // letterlijk teken oplevert (nooit met metaKey) krijgt deze uitzondering, en alleen wanneer
  // `event.key` daadwerkelijk één teken is (anders is het een navigatietoets, geen letter/cijfer).
  const isAltTypingCombo = event.key.length === 1 && event.altKey && !event.metaKey;
  if (rowIndex < 0 || columnIndex < 0 || (event.altKey && !isAltTypingCombo)) return { kind: 'unhandled' };

  if (input.mode === 'edit') {
    if (event.key === 'Escape') return { kind: 'cancel-edit', cell: active };
    if (event.key === 'Enter') {
      const delta = event.shiftKey ? -1 : 1;
      const nextRow = rows[Math.max(0, Math.min(rows.length - 1, rowIndex + delta))];
      return {
        kind: 'commit-edit',
        cell: active,
        nextCell: { rowKey: nextRow.rowKey, columnId: active.columnId },
      };
    }
    return { kind: 'unhandled' };
  }

  // WCAG 2.1.2: Escape in selectmodus (er is geen editor open — die tak hierboven vangt Escape
  // tijdens edit al af) geeft een expliciete, altijd beschikbare uitgang uit de grid. De actieve
  // cel blijft de logische selectie, maar de browserfocus verhuist naar de gridcontainer (die
  // buiten de normale taborde staat), zodat een daaropvolgende Tab niet eerst weer door de cellen
  // hoeft te lopen maar meteen het grid verlaat.
  if (event.key === 'Escape') return { kind: 'exit-to-container' };

  const hasCommandModifier = event.ctrlKey || event.metaKey;
  if (hasCommandModifier && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    return { kind: 'unhandled' };
  }

  const move = (
    nextRowIndex: number,
    nextColumnIndex: number,
    extend = event.shiftKey === true,
  ): TaskGridCommand => ({
    kind: 'move',
    cell: {
      rowKey: rows[Math.max(0, Math.min(rows.length - 1, nextRowIndex))].rowKey,
      columnId: columns[Math.max(0, Math.min(columns.length - 1, nextColumnIndex))],
    },
    extend,
  });

  if (event.key === 'ArrowUp' && !hasCommandModifier) return move(rowIndex - 1, columnIndex);
  if (event.key === 'ArrowDown' && !hasCommandModifier) return move(rowIndex + 1, columnIndex);
  if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !hasCommandModifier) {
    // De kolomstrook en pinning blijven als productcontract fysiek links-naar-rechts, ook wanneer
    // de celinhoud RTL is. Pijlen volgen daarom de visuele buur; Tab hieronder volgt de DOM-volgorde.
    const columnDelta = event.key === 'ArrowLeft' ? -1 : 1;
    return move(rowIndex, columnIndex + columnDelta);
  }
  if (event.key === 'Home') return hasCommandModifier ? move(0, 0) : move(rowIndex, 0);
  if (event.key === 'End') {
    return hasCommandModifier
      ? move(rows.length - 1, columns.length - 1)
      : move(rowIndex, columns.length - 1);
  }
  if ((event.key === 'PageUp' || event.key === 'PageDown') && !hasCommandModifier) {
    const pageRows = Math.max(1, Math.floor(input.viewportHeight / input.rowHeight));
    const currentAbsolute = input.rowIndex.taskAbsoluteIndices[rowIndex];
    const targetAbsolute = currentAbsolute + (event.key === 'PageUp' ? -pageRows : pageRows);
    const positions = input.rowIndex.taskAbsoluteIndices;
    let low = 0;
    let high = positions.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (positions[middle] < targetAbsolute) low = middle + 1;
      else high = middle;
    }
    const targetTaskIndex = event.key === 'PageUp'
      ? Math.max(0, low < positions.length && positions[low] === targetAbsolute ? low : low - 1)
      : Math.min(rows.length - 1, low);
    return move(targetTaskIndex, columnIndex);
  }
  if (event.key === 'Tab' && !hasCommandModifier) {
    // WCAG 2.1.2 (geen toetsenbordval): op de allerlaatste cel geeft Tab, en op de allereerste cel
    // geeft Shift+Tab, 'unhandled' terug in plaats van op de eigen positie te klemmen. Zonder deze
    // uitzondering annuleert DataGridCore altijd `preventDefault`/`stopPropagation` (zie
    // `dispatchDataGridKeyCommand`) en kan de browserfocus de grid nooit verlaten via Tab.
    const linear = rowIndex * columns.length + columnIndex + (event.shiftKey ? -1 : 1);
    if (linear < 0 || linear > rows.length * columns.length - 1) return { kind: 'unhandled' };
    return move(Math.floor(linear / columns.length), linear % columns.length, false);
  }
  if ((event.key === 'Enter' || event.key === 'F2') && !hasCommandModifier) return startEdit(input);
  if ((event.key === 'Delete' || event.key === 'Backspace') && !hasCommandModifier) return { kind: 'clear-cells' };
  if (event.key === 'Insert' && !hasCommandModifier) {
    return { kind: 'insert-task', anchorRowKey: active.rowKey, targetColumnId: taskColumnId('task.name') };
  }
  // AltGr rapporteert ctrlKey===true (dus hasCommandModifier===true) — die combinatie mag hier
  // dus NIET via `!hasCommandModifier` worden geblokkeerd zolang `isAltTypingCombo` al vaststelt
  // dat dit een letterlijk teken is en geen commando (metaKey is daar altijd uitgesloten).
  if ((!hasCommandModifier && !event.altKey && event.key.length === 1) || isAltTypingCombo) {
    return startEdit(input, event.key);
  }
  return { kind: 'unhandled' };
}
