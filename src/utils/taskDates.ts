import type { Task } from '@/types/task';

/**
 * De getoonde start van een taak: de CPM-datum (`earlyStart`), en vóór de eerste berekening de
 * opgeslagen `scheduleStart`. Dezelfde keuze in Gantt, raster, filters, rapporten en variance.
 * (De Gantt-viewport kent daarnaast nog een terugval op de late datum: `resolveTaskStart`.)
 */
export function shownStart(task: Task): string {
  return task.time.earlyStart || task.time.scheduleStart;
}

/** Het getoonde einde van een taak: `earlyFinish`, anders de opgeslagen `scheduleFinish`. */
export function shownFinish(task: Task): string {
  return task.time.earlyFinish || task.time.scheduleFinish;
}
