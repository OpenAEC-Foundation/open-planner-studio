// De wandeling zelf leeft in `engine/scheduler/splitWalk.ts` (één bron voor renderer, print,
// lastlezer en nivelleerder — zie dat moduleheader voor de as-semantiek, dag/uur-modus-keuze,
// overlap-samenvoeging en taakeinde-klem). Deze module is de import-plek voor de tekenpaden
// (`GanttRenderer`, `printPreview`, het paneel Onderbrekingen).
//
// Een ECHTE split (`Task.splitGaps`, uit een
// .mpp-import afgeleid) tekent ALTIJD gesplitst — een werkonderbreking is DATA, geen
// weergavevoorkeur. `barSplitMode`/`shouldSplit` (GanttRenderer) blijven daarom UITSLUITEND de
// kalender-necking sturen (de calendar-only "toon werkblokken"-weergave); een taak met
// `splitGaps` bereikt die tak nooit. Deze module weet niets van `barSplitMode` — dat blijft aan
// de aanroeper.
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { taskCountsInWorkdays } from '@/engine/scheduler/conventions/durationMeasure';
import { computeSplitSegments, type SplitSegmentBounds } from '@/engine/scheduler/splitWalk';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { finishInstant, shownFinish, shownStart } from '@/utils/taskDates';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

export { computeSplitSegments, type SplitSegmentBounds };

/**
 * De maat van de split-as van een taak (alleen uren §3.14, F3c): dagslots (`'workdays'`) als de taak in de
 * dagenmaat telt, anders werkminuten (`true`). Dezelfde vraag als de solver en de gedeelde plaatsing
 * (`taskCountsInWorkdays`): onder het P6- en het MSP-profiel telt een dagtaak in werkminuten.
 */
export function taskSplitMeasure(task: Task, workdayDurationMeasure: boolean): true | 'workdays' {
  return taskCountsInWorkdays(task, { workdayDurationMeasure }) ? 'workdays' : true;
}

const splitEngines = new WeakMap<WorkCalendar, CalendarEngine>();

/** De engine van de split-wandeling: de werkblokken van de kalender, ook een dagkalender
 *  (`calendarForEngine`), zoals de motor. Eén per kalenderobject. */
export function splitEngineFor(calendar: WorkCalendar): CalendarEngine {
  let engine = splitEngines.get(calendar);
  if (!engine) {
    engine = new CalendarEngine(calendarForEngine(calendar));
    splitEngines.set(calendar, engine);
  }
  return engine;
}

/**
 * De stukken van een taak met `splitGaps` zoals de Gantt ze tekent: van de getoonde start tot het getoonde
 * einde (`shownStart`/`shownFinish`, met de rollupregel van `finishInstant`), in de maat van de taak, op de
 * kalender van de taak. Tussengrenzen zijn EXCLUSIEF (zie `splitWalk.ts`). Een taak met alleen datums (van
 * vóór het minutenmodel) loopt in hele werkdagen. `null` zonder leesbare datums.
 */
export function taskSplitSegments(
  task: Task,
  calendar: WorkCalendar,
  workdayDurationMeasure: boolean,
): SplitSegmentBounds[] | null {
  const startStr = shownStart(task) || '';
  const endStr = shownFinish(task) || '';
  if (!startStr || !endStr) return null;
  const instants = startStr.includes('T') || endStr.includes('T');
  const start = instants ? parseInstant(startStr) : parseDate(startStr);
  const end = instants ? finishInstant(endStr) : parseDate(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const measure = instants ? taskSplitMeasure(task, workdayDurationMeasure) : false;
  return computeSplitSegments(task.splitGaps, start, end, measure, splitEngineFor(calendar));
}
