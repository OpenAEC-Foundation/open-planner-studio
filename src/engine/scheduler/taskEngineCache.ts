import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';

export interface TaskEngineCache {
  /** Engine van de projectkalender — ook die van elke taak zonder `calendarId`. */
  readonly project: CalendarEngine;
  /** Engine van de TAAKkalender van `task`. */
  readonly forTask: (task: Pick<Task, 'calendarId'>) => CalendarEngine;
}

/**
 * Kalender-engines per TAAKkalender — spiegelt `CPMSolver.calendarFor`
 * (`resolveCalendar(task.calendarId, registry, projectCalendar)`): dezelfde bron (`task.calendarId`)
 * en dezelfde fallback (geen/onbekende id ⇒ projectkalender), dus de engine waarmee de CPM de duur
 * en de splits van de taak rekent. Gecachet per calendarId, zodat taken op dezelfde kalender geen
 * nieuwe `CalendarEngine` per taak bouwen; maak per berekening een verse cache.
 *
 * Gedeeld door de resourcebelasting, het histogram, de nivelleerder en de rapporten (B1c-W0.1) —
 * één definitie, geen tweede die stil kan afdrijven. Anders dan `CPMSolver.engineForCal` gaat
 * ELKE kalender door `calendarForEngine` (effectieve uurbanden), ook voor dagtaken; voor dagvragen
 * maakt dat geen verschil.
 */
export function createTaskEngineCache(registry: WorkCalendar[], projectCalendar: WorkCalendar): TaskEngineCache {
  const project = new CalendarEngine(calendarForEngine(projectCalendar));
  const cache = new Map<string, CalendarEngine>([['', project]]);
  const forTask = (task: Pick<Task, 'calendarId'>): CalendarEngine => {
    const key = task.calendarId ?? '';
    let eng = cache.get(key);
    if (!eng) {
      eng = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, registry, projectCalendar)));
      cache.set(key, eng);
    }
    return eng;
  };
  return { project, forTask };
}
