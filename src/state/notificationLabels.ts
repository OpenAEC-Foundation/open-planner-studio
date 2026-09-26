// Taaknamen in een melding — één plek voor het afkappen, zodat "Relatie aangemaakt: …" en een
// geweigerde kring (relatie of verhanging) dezelfde namen tonen.
import type { Task } from '@/types/task';

/** Namen in een melding blijven leesbaar: langere taaknamen worden afgekapt. */
const MAX_NAME = 40;

export function shortTaskName(name: string | undefined): string {
  return !name ? '?' : name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;
}

/** Een kring als taaknamen: "Fundering → Keuring → Fundering". */
export function cycleLabel(tasks: readonly Task[], cycle: readonly string[]): string {
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  return cycle.map(id => shortTaskName(byId.get(id)?.name)).join(' → ');
}
