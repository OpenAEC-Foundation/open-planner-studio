import { current, isDraft } from 'immer';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';

function plainView(tasks: readonly Task[]): readonly Task[] {
  return isDraft(tasks) ? (current(tasks as Task[]) as readonly Task[]) : tasks;
}

export function flattenOrder(tasks: readonly Task[]): readonly Task[] {
  tasks = plainView(tasks);
  const out: Task[] = [];
  const seen = new Set<string>();
  const childrenByParent = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parentId != null) {
      const list = childrenByParent.get(t.parentId);
      if (list) list.push(t);
      else childrenByParent.set(t.parentId, [t]);
    }
  }
  const addBranch = (root: Task) => {
    const stack = [root];
    while (stack.length > 0) {
      const task = stack.pop()!;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      out.push(task);
      const kids = childrenByParent.get(task.id);
      if (kids) for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
  };
  for (const root of tasks) {
    if (!root.parentId) addBranch(root);
  }
  for (const task of tasks) {
    if (!seen.has(task.id)) addBranch(task);
  }
  return out;
}

export function deriveWbsCodes(tasks: readonly Task[]): Map<string, string> {
  const codes = new Map<string, string>();
  const childCount = new Map<string | null, number>();
  for (const task of flattenOrder(tasks)) {
    const parentCode = task.parentId ? codes.get(task.parentId) : undefined;
    const siblingKey = parentCode !== undefined ? task.parentId : null;
    const n = (childCount.get(siblingKey) ?? 0) + 1;
    childCount.set(siblingKey, n);
    codes.set(task.id, parentCode !== undefined ? `${parentCode}.${n}` : String(n));
  }
  return codes;
}

export function applyWbsNumbering(tasks: Task[]): void {
  const view = plainView(tasks);
  const codes = deriveWbsCodes(view);
  for (let i = 0; i < view.length; i++) {
    const code = codes.get(view[i].id);
    if (code !== undefined && code !== view[i].wbsCode) tasks[i].wbsCode = code;
  }
}

export function inferWbsAutoNumberOnOpen(project: Project, tasks: readonly Task[]): Project {
  if (project.wbsAutoNumber !== undefined) return project;
  const codes = deriveWbsCodes(tasks);
  if (!tasks.every(task => codes.get(task.id) === task.wbsCode)) return project;
  return { ...project, wbsAutoNumber: true };
}

export function taskDepths(tasks: readonly Task[]): Map<string, number> {
  const depth = new Map<string, number>();
  for (const t of flattenOrder(tasks)) {
    const parentDepth = t.parentId ? depth.get(t.parentId) : undefined;
    depth.set(t.id, parentDepth !== undefined ? parentDepth + 1 : 1);
  }
  return depth;
}

export function* ancestorIds(id: string, parentOf: (id: string) => string | null | undefined): Generator<string> {
  const seen = new Set<string>([id]);
  for (let p = parentOf(id); p && !seen.has(p); p = parentOf(p)) {
    seen.add(p);
    yield p;
  }
}
