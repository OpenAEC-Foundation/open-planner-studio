import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { ResolvedPeriod } from './reportingPeriod';
import { overlapsWindow, taskFinish, taskStart } from './reportCommon';

/**
 * De rijen van de Gantt-afdruk binnen een tijdvak (issue #997). Puur: geen React, geen store.
 *
 * Het Rapport-tabblad kent één tijdvak voor elke rijenbron (alle taken, zoals de weergave, een layout). Het
 * resourcediagram filtert zijn rijen zelf (`computeResourceGanttRows` met `window`); de andere bronnen gaan door
 * deze functie. Daarna tekent de render met hetzelfde venster als `PrintOptions.timeWindow`: de tijdas loopt
 * precies over het tijdvak en een balk die over de rand loopt, wordt daar afgekapt.
 */

/**
 * De volledige takenboom als rijen: wortels in lijstvolgorde met hun kinderen eronder, daarna de taken zonder
 * gevonden ouder (of in een ouderkring) op diepte 0. Dezelfde volgorde als het scherm in boommodus; de afdruk
 * gebruikt hem als er geen rijenlijst is (`buildPrintRows`).
 */
export function taskTreeRows(tasks: readonly Task[]): ViewRow[] {
  // Eén keer indexeren i.p.v. per taak `tasks.filter`: dat was O(n²) en draait per render-venster (1–3 per
  // pagina) plus bij meten. Kindvolgorde = lijstvolgorde.
  const childrenOf = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = childrenOf.get(t.parentId);
    if (list) list.push(t);
    else childrenOf.set(t.parentId, [t]);
  }
  const rows: ViewRow[] = [];
  const placed = new Set<string>();
  const push = (task: Task, depth: number) => rows.push({ kind: 'task', rowKey: task.id, task, depth, dimmed: false });
  const addRecursive = (task: Task, depth: number) => {
    if (placed.has(task.id)) return;
    placed.add(task.id);
    push(task, depth);
    for (const child of childrenOf.get(task.id) ?? []) addRecursive(child, depth + 1);
  };
  for (const root of tasks) if (!root.parentId) addRecursive(root, 0);
  for (const task of tasks) {
    if (!placed.has(task.id)) {
      placed.add(task.id);
      push(task, 0);
    }
  }
  return rows;
}

/** Raakt de getoonde spanne van de taak het tijdvak? Een taak zonder datums valt erbuiten (zoals het resourcediagram). */
export function taskInPeriod(task: Task, period: ResolvedPeriod): boolean {
  return !!taskStart(task) && !!taskFinish(task) && overlapsWindow(task, period.from, period.to);
}

export interface PeriodRowsResult {
  rows: ViewRow[];
  /** Aantal verschillende taken dat buiten het tijdvak valt en daarom niet op het papier staat. */
  outsidePeriod: number;
}

/**
 * Alleen de rijen die het tijdvak raken.
 * - Een taakrij blijft als haar eigen spanne het tijdvak raakt; een fase dus ook als een van haar kinderen erin
 *   valt (haar spanne omvat die van de kinderen).
 * - Een ingeklapte mijlpalenreeks houdt alleen de mijlpalen in het tijdvak, en valt weg als er geen over is.
 * - Een groepsband blijft alleen als er onder hem nog een rij staat; zijn telling wordt het aantal taakrijen
 *   eronder. Een ingeklapte band (zijn rijen staan er niet) blijft staan zoals hij is.
 */
export function rowsInPeriod(rows: readonly ViewRow[], period: ResolvedPeriod): PeriodRowsResult {
  const outside = new Set<string>();
  const inside = (task: Task): boolean => {
    if (taskInPeriod(task, period)) return true;
    outside.add(task.id);
    return false;
  };
  const kept: ViewRow[] = [];
  for (const row of rows) {
    if (row.kind === 'task') {
      if (inside(row.task)) kept.push(row);
    } else if (row.kind === 'milestones') {
      const tasks = row.tasks.filter(inside);
      if (tasks.length === row.tasks.length) kept.push(row);
      else if (tasks.length > 0) kept.push({ ...row, tasks });
    } else {
      kept.push(row);
    }
  }
  // Banden zonder rijen eronder weg, van achter naar voren: een band telt de taakrijen tot de volgende rij op
  // zijn eigen of een hoger niveau.
  const result: (ViewRow | null)[] = [];
  const open: { index: number; depth: number; count: number; hasRows: boolean }[] = [];
  const close = (depth: number) => {
    while (open.length > 0 && open[open.length - 1].depth >= depth) {
      const band = open.pop()!;
      const row = result[band.index];
      if (!row || row.kind !== 'group') continue;
      if (!band.hasRows && !row.collapsed) result[band.index] = null;
      else if (!row.collapsed && row.count !== band.count) result[band.index] = { ...row, count: band.count };
    }
  };
  for (const row of kept) {
    close(row.depth);
    if (row.kind === 'group') {
      open.push({ index: result.length, depth: row.depth, count: 0, hasRows: false });
    } else {
      const taskRows = row.kind === 'milestones' ? row.tasks.length : 1;
      for (const band of open) { band.hasRows = true; band.count += taskRows; }
    }
    result.push(row);
  }
  close(-Infinity);
  return { rows: result.filter((row): row is ViewRow => row !== null), outsidePeriod: outside.size };
}
