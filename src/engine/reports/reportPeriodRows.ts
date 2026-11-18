import type { Task } from '@/types/task';
import { leavesWithAncestors, type ViewRow } from '@/engine/view/visibleRows';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { ResolvedPeriod } from './reportingPeriod';
import { overlapsWindow, taskFinish, taskStart } from './reportCommon';

/**
 * De rijen van de Gantt-afdruk binnen een tijdvak (issue #997). Puur: geen React, geen store.
 *
 * Het Rapport-tabblad kent één tijdvak voor elke rijenbron (alle taken, zoals de weergave, een layout). Het tijdvak
 * werkt vóór groeperen en inklappen: *Zoals de weergave* en een layout geven het als `within` aan
 * `computeViewRows`, het resourcediagram als `window` aan `computeResourceGanttRows`, en *Alle taken* gaat door
 * `treeRowsInPeriod`. Daarna tekent de render met hetzelfde venster als `PrintOptions.timeWindow`: de tijdas loopt
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

/**
 * De boom van *Alle taken* binnen het tijdvak: de bladtaken die het tijdvak raken, met hun ouders erboven. Een fase
 * blijft dus staan zolang een van haar taken erin valt, ook als haar eigen (opgeslagen) spanne het tijdvak mist; een
 * fase zonder taak in het tijdvak valt weg. Dezelfde regel als `within` in `computeViewRows`, waar *Zoals de
 * weergave* en een layout door gaan.
 */
export function treeRowsInPeriod(tasks: readonly Task[], period: ResolvedPeriod): ViewRow[] {
  const selected = leavesWithAncestors(tasks, task => taskInPeriod(task, period));
  return taskTreeRows(tasks).filter(row => row.kind === 'task' && selected.has(row.task.id));
}

/**
 * Hoeveel bladtaken van de bron buiten het tijdvak vallen (de melding onder de keuze). `passes` is het filter van de
 * bron (de weergave of de layout); een taak die dat filter al niet haalt, telt niet mee.
 */
export function leavesOutsidePeriod(
  tasks: readonly Task[],
  period: ResolvedPeriod,
  passes: (leaf: Task) => boolean = () => true,
): number {
  let count = 0;
  for (const task of tasks) if (isLeafTask(task) && passes(task) && !taskInPeriod(task, period)) count++;
  return count;
}
