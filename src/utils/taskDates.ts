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

/**
 * Het nieuwe startanker na een bewerking van de GETOONDE start (eigenschappenpaneel, Taak bewerken,
 * Tabel-kolom Start): de invoer, maar alleen als die echt afwijkt van `shownStart`. Gelijk ⇒
 * `undefined` en het anker blijft staan. Anders legde elke commit van een ongewijzigd veld de
 * berekende start vast als nieuw anker — precies de drift die `applyCpmResult` ("BEWUST GEEN
 * scheduleStart-ANKER-drift") voorkomt.
 */
export function startAnchorAfterEdit(task: Task, value: string): string | undefined {
  return value !== shownStart(task) ? value : undefined;
}

/**
 * Overlapt de getoonde spanne van `task` het venster [fromDay, toDay]? De klassieke intervaltest
 * (start ≤ tot én einde ≥ van) met inclusieve grenzen, op DAGniveau: als tekst is
 * "2026-06-10T08:00" groter dan "2026-06-10", maar een uurtaak die op de tot-dag begint telt mee.
 * Eén test voor het "Actief tussen"-filter en de rapportvensters; een taak zonder datums weren
 * doet de aanroeper waar dat nodig is.
 */
export function shownSpanOverlapsDays(task: Task, fromDay: string, toDay: string): boolean {
  return shownStart(task).slice(0, 10) <= toDay.slice(0, 10)
    && shownFinish(task).slice(0, 10) >= fromDay.slice(0, 10);
}
