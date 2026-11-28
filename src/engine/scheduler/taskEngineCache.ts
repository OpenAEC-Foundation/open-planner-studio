import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';

export interface TaskEngineCache {
  readonly project: CalendarEngine;
  readonly forTask: (task: Pick<Task, 'calendarId'>) => CalendarEngine;
}

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
