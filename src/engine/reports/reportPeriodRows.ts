import type { Task } from '@/types/task';
import { leavesWithAncestors, type ViewRow } from '@/engine/view/visibleRows';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { ResolvedPeriod } from './reportingPeriod';
import { overlapsWindow, taskFinish, taskStart } from './reportCommon';

export function taskTreeRows(tasks: readonly Task[]): ViewRow[] {
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

export function taskInPeriod(task: Task, period: ResolvedPeriod): boolean {
  return !!taskStart(task) && !!taskFinish(task) && overlapsWindow(task, period.from, period.to);
}

export function treeRowsInPeriod(tasks: readonly Task[], period: ResolvedPeriod): ViewRow[] {
  const selected = leavesWithAncestors(tasks, task => taskInPeriod(task, period));
  return taskTreeRows(tasks).filter(row => row.kind === 'task' && selected.has(row.task.id));
}

export function leavesOutsidePeriod(
  tasks: readonly Task[],
  period: ResolvedPeriod,
  passes: (leaf: Task) => boolean = () => true,
): number {
  let count = 0;
  for (const task of tasks) if (isLeafTask(task) && passes(task) && !taskInPeriod(task, period)) count++;
  return count;
}
