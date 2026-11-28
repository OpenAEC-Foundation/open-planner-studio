import type { Task } from '@/types/task';

const MAX_NAME = 40;

export function shortTaskName(name: string | undefined): string {
  return !name ? '?' : name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;
}

export function cycleLabel(tasks: readonly Task[], cycle: readonly string[]): string {
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  return cycle.map(id => shortTaskName(byId.get(id)?.name)).join(' → ');
}
