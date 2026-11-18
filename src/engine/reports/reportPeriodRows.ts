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
 * Alleen de rijen die het tijdvak raken, met hun ouders erboven.
 * - Een taakrij blijft als haar eigen spanne het tijdvak raakt.
 * - Een ingeklapte mijlpalenreeks houdt alleen de mijlpalen in het tijdvak, en valt weg als er geen over is.
 * - Een ingeklapte groepsband blijft staan zoals hij is: zijn rijen staan er niet, dus de afdruk kan ze niet wegen.
 * - Een rij die blijft, houdt haar ouders (de rijen erboven met een kleinere diepte): de groepsband waar ze onder
 *   valt, en ook een fase waarvan de eigen spanne het tijdvak mist (een fase met opgeslagen datums hoeft haar
 *   kinderen niet te omsluiten). Een groepsband zonder blijvende rij eronder valt weg.
 * - De telling van een open groepsband wordt het aantal taakrijen dat eronder blijft, plus de telling van een
 *   ingeklapte band eronder.
 */
export function rowsInPeriod(rows: readonly ViewRow[], period: ResolvedPeriod): PeriodRowsResult {
  const kept: (ViewRow | null)[] = rows.map(() => null);
  const open: number[] = [];
  rows.forEach((row, i) => {
    while (open.length > 0 && rows[open[open.length - 1]].depth >= row.depth) open.pop();
    let own: ViewRow | null = null;
    if (row.kind === 'task') {
      if (taskInPeriod(row.task, period)) own = row;
    } else if (row.kind === 'milestones') {
      const tasks = row.tasks.filter(task => taskInPeriod(task, period));
      if (tasks.length > 0) own = tasks.length === row.tasks.length ? row : { ...row, tasks };
    } else if (row.collapsed) {
      own = row;
    }
    if (own) {
      kept[i] = own;
      // De ouders, van dichtbij naar ver; een ouder die al blijft, heeft zijn eigen ouders al meegenomen.
      for (let k = open.length - 1; k >= 0 && !kept[open[k]]; k--) kept[open[k]] = rows[open[k]];
    }
    open.push(i);
  });

  // Tellingen van de open groepsbanden.
  const result: ViewRow[] = [];
  const bands: { index: number; depth: number; count: number }[] = [];
  const close = (depth: number) => {
    while (bands.length > 0 && bands[bands.length - 1].depth >= depth) {
      const band = bands.pop()!;
      const row = result[band.index];
      if (row.kind === 'group' && row.count !== band.count) result[band.index] = { ...row, count: band.count };
    }
  };
  const onPaper = new Set<string>();
  for (const row of kept) {
    if (!row) continue;
    close(row.depth);
    const counted = row.kind === 'task' ? 1 : row.kind === 'milestones' ? row.tasks.length : row.collapsed ? row.count : 0;
    for (const band of bands) band.count += counted;
    if (row.kind === 'group' && !row.collapsed) bands.push({ index: result.length, depth: row.depth, count: 0 });
    if (row.kind === 'task') onPaper.add(row.task.id);
    else if (row.kind === 'milestones') for (const task of row.tasks) onPaper.add(task.id);
    result.push(row);
  }
  close(-Infinity);

  const outside = new Set<string>();
  for (const row of rows) {
    if (row.kind === 'task' && !onPaper.has(row.task.id)) outside.add(row.task.id);
    else if (row.kind === 'milestones') for (const task of row.tasks) if (!onPaper.has(task.id)) outside.add(task.id);
  }
  return { rows: result, outsidePeriod: outside.size };
}
