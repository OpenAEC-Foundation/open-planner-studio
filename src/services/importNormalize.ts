import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { ResourceAssignment } from '@/types/resource';
import type { ImportResult } from '@/services/importTypes';
import { applyRemainingDuration, defaultActualStart, normalizeLoadedActualDate } from '@/engine/taskMutationRules';
import { isDateOnly } from '@/engine/calendar/workdayRules';
import { orderActualsAfterDerivedFinish } from '@/engine/actualDatesOrder';
import { workRuleFromMsp, workRuleFromXerDurationType } from '@/engine/work/workRuleMapping';
import { minOf } from '@/utils/collections';

export function defaultImportedActualFinish(
  time: Pick<Task['time'], 'earlyFinish' | 'scheduleFinish'>,
  statusDate: string | undefined,
): string {
  return statusDate || time.earlyFinish || time.scheduleFinish;
}

export function deriveImportedWorkRules(tasks: Task[]): void {
  for (const task of tasks) {
    if (task.workRule) continue;
    const rule = task.mspTaskType
      ? workRuleFromMsp(task.mspTaskType, task.effortDriven)
      : workRuleFromXerDurationType(task.p6DurationType);
    if (rule) task.workRule = rule;
  }
}

export function normalizeImportedProgress(
  tasks: Task[],
  statusDate?: string,
  runningAtFullIds?: ReadonlySet<string>,
  calendar?: WorkCalendar,
): void {
  for (const task of tasks) {
    const t = task.time;

    if (!Number.isFinite(t.completion)) t.completion = 0;
    t.completion = Math.min(1, Math.max(0, t.completion));

    const hasProgress = !!(t.actualStart || t.actualFinish || t.completion > 0);
    if (!hasProgress) {
      task.status = 'NOT_STARTED';
      continue;
    }

    if (t.actualFinish) {
      t.completion = 1;
      if (!t.actualStart) t.actualStart = t.actualFinish;
      task.status = 'COMPLETED';
    } else if (t.completion >= 1 && runningAtFullIds?.has(task.id)) {
      t.completion = 1;
      task.status = 'STARTED';
      continue;
    } else if (t.completion >= 1) {
      t.completion = 1;
      const startWasDerived = !t.actualStart;
      if (startWasDerived) t.actualStart = defaultActualStart(t);
      t.actualFinish = defaultImportedActualFinish(t, statusDate);
      if (!startWasDerived && !isDateOnly(t.actualStart!)) {
        t.actualFinish = normalizeLoadedActualDate(task, 'actualFinish', t.actualFinish, statusDate, calendar);
      }
      orderActualsAfterDerivedFinish(t, statusDate, startWasDerived);
      task.status = 'COMPLETED';
    } else {
      task.status = 'STARTED';
    }

    applyRemainingDuration(task, true);
  }
}

export function rebuildWbsHierarchy(tasks: Task[]): void {
  const wbsToId = new Map<string, string>();
  for (const task of tasks) wbsToId.set(task.wbsCode, task.id);
  const byId = new Map<string, Task>();
  for (const task of tasks) if (!byId.has(task.id)) byId.set(task.id, task);
  const childSets = new Map<Task, Set<string>>();

  for (const task of tasks) {
    if (!task.wbsCode || !task.wbsCode.includes('.')) continue;
    const parts = task.wbsCode.split('.');
    parts.pop();
    const parentWbs = parts.join('.');
    const parentId = wbsToId.get(parentWbs);
    if (parentId) {
      task.parentId = parentId;
      const parent = byId.get(parentId);
      if (!parent) continue;
      let children = childSets.get(parent);
      if (!children) { children = new Set(parent.childIds); childSets.set(parent, children); }
      if (!children.has(task.id)) {
        parent.childIds.push(task.id);
        children.add(task.id);
      }
    }
  }
}

function outlineParents(tasks: readonly Task[], levels: readonly (number | undefined)[]): Map<string, string | null> | undefined {
  if (levels.length !== tasks.length || tasks.length === 0) return undefined;
  if (!levels.every(l => l !== undefined && Number.isInteger(l) && l >= 0)) return undefined;
  const shift = minOf(levels as number[]) === 0 ? 1 : 0;
  const parents = new Map<string, string | null>();
  const stack: { id: string; level: number }[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const level = levels[i]! + shift;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    parents.set(tasks[i].id, stack[stack.length - 1]?.id ?? null);
    stack.push({ id: tasks[i].id, level });
  }
  return parents;
}

function wbsParents(tasks: readonly Task[]): { parents: Map<string, string | null>; complete: boolean } {
  const wbsToId = new Map<string, string>();
  let unique = true;
  for (const t of tasks) {
    if (wbsToId.has(t.wbsCode)) unique = false;
    wbsToId.set(t.wbsCode, t.id);
  }
  const parents = new Map<string, string | null>();
  let dotted = 0;
  let resolved = 0;
  for (const t of tasks) {
    let parent: string | null = null;
    if (t.wbsCode && t.wbsCode.includes('.')) {
      dotted++;
      const parts = t.wbsCode.split('.');
      parts.pop();
      const p = wbsToId.get(parts.join('.'));
      if (p && p !== t.id) { parent = p; resolved++; }
    }
    parents.set(t.id, parent);
  }
  return { parents, complete: unique && dotted > 0 && resolved === dotted };
}

function applyParents(tasks: Task[], parents: Map<string, string | null>): void {
  const byId = new Map(tasks.map(t => [t.id, t]));
  for (const t of tasks) {
    const p = parents.get(t.id) ?? null;
    if (!p) continue;
    const parent = byId.get(p);
    if (!parent) continue;
    t.parentId = p;
    if (!parent.childIds.includes(t.id)) parent.childIds.push(t.id);
  }
}

export type ImportedHierarchySource = 'outline' | 'wbs';

export function rebuildImportedHierarchy(tasks: Task[], levels: readonly (number | undefined)[]): ImportedHierarchySource {
  const outline = outlineParents(tasks, levels);
  const wbs = wbsParents(tasks);
  const outlineUsable = outline !== undefined;
  const conflict = outlineUsable && wbs.complete
    && tasks.some(t => (outline.get(t.id) ?? null) !== (wbs.parents.get(t.id) ?? null));
  if (outlineUsable && !conflict) {
    applyParents(tasks, outline);
    return 'outline';
  }
  rebuildWbsHierarchy(tasks);
  return 'wbs';
}

export function reconstructResourceIds(tasks: Task[], assignments: ResourceAssignment[]): void {
  const byTask = new Map<string, Set<string>>();
  for (const a of assignments) {
    let ids = byTask.get(a.taskId);
    if (!ids) { ids = new Set(); byTask.set(a.taskId, ids); }
    ids.add(a.resourceId);
  }
  for (const t of tasks) {
    const ids = byTask.get(t.id);
    if (ids) t.resourceIds = [...ids];
  }
}

export function ensureUniqueImportIds(result: ImportResult): { result: ImportResult; renamed: number } {
  let renamed = 0;
  const unique = <T extends { id: string }>(
    items: readonly T[], used: Set<string>, onRename?: (from: string, to: string, item: T) => void,
  ): T[] => {
    let out: T[] | null = null;
    items.forEach((item, index) => {
      if (!used.has(item.id)) { used.add(item.id); return; }
      let id = item.id;
      for (let n = 2; used.has(id); n++) id = `${item.id}-dup-${n}`;
      used.add(id);
      renamed++;
      out ??= items.slice();
      out[index] = { ...item, id };
      onRename?.(item.id, id, item);
    });
    return out ?? (items as T[]);
  };
  const taskRenames: { from: string; to: string; parentId: string | null }[] = [];
  let tasks = unique(result.tasks, new Set(), (from, to, t) => taskRenames.push({ from, to, parentId: t.parentId }));
  if (taskRenames.length > 0) {
    const parentIndex = new Map<string, number>();
    tasks.forEach((t, i) => { if (!parentIndex.has(t.id)) parentIndex.set(t.id, i); });
    for (const r of taskRenames) {
      const pi = r.parentId === null ? undefined : parentIndex.get(r.parentId);
      if (pi === undefined) continue;
      const parent = tasks[pi];
      const childIds = [...parent.childIds];
      const first = childIds.indexOf(r.from);
      const second = first < 0 ? -1 : childIds.indexOf(r.from, first + 1);
      if (second >= 0) childIds[second] = r.to;
      else childIds.push(r.to);
      if (tasks === result.tasks) tasks = tasks.slice();
      tasks[pi] = { ...parent, childIds };
    }
  }
  const sequences = unique(result.sequences, new Set());
  const resources = unique(result.resources, new Set());
  const assignments = unique(result.assignments, new Set());
  const resourceCalendars = result.resourceCalendars
    ? unique(result.resourceCalendars, new Set([result.calendar.id]))
    : result.resourceCalendars;
  if (renamed === 0) return { result, renamed };
  return { result: { ...result, tasks, sequences, resources, assignments, resourceCalendars }, renamed };
}
