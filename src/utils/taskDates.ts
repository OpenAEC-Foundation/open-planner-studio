import type { Task } from '@/types/task';
import { MS_PER_DAY, parseDate, parseInstant } from '@/utils/dateUtils';

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

/**
 * Het EXCLUSIEVE einde van een einddatum op de tijdas — dezelfde regel als de Gantt-balk
 * (`GanttRenderer.barGeometry`): een datum zonder tijd (`JJJJ-MM-DD`) loopt tot het einde van die
 * dag, dus tot het begin van de volgende; een datum met tijd (`…THH:mm`) eindigt op dat instant.
 * Zo zijn een dag- en een uur-einde als tijdstippen vergelijkbaar: als tekst sorteert
 * "2026-06-05T13:00" ná "2026-06-05", terwijl de dag pas om middernacht eindigt.
 */
export function finishInstant(iso: string): Date {
  return iso.includes('T') ? parseInstant(iso) : new Date(parseDate(iso).getTime() + MS_PER_DAY);
}

/**
 * Waar de spelingsband van een taak eindigt: op het einde van "Laatste einde" (`lateFinish`),
 * met de balkregel van {@link finishInstant}. `null` = geen band (geen positieve speling, kritiek,
 * of nog geen late datum). Eén bron voor de scherm-Gantt, de afdruk en het datumbereik van de
 * afdruk — de band was `totalFloat × zoom`, dus WERKdagen maal pixels per KALENDERdag, en stopte
 * over een weekend dagen vóór "Laatste einde" (in urenmodus schoot hij juist door).
 *
 * `dayGranular`: de afdruk tekent elke balk op dagniveau (`parseDate` + één dag); daar telt alleen
 * de dag van `lateFinish`, zodat de band op dezelfde dagrand eindigt als de balk.
 */
export function floatBandEnd(task: Task, dayGranular = false): Date | null {
  const { totalFloat, isCritical, lateFinish } = task.time;
  if (!(totalFloat > 0) || isCritical || !lateFinish) return null;
  const end = finishInstant(dayGranular ? lateFinish.slice(0, 10) : lateFinish);
  return Number.isNaN(end.getTime()) ? null : end;
}
