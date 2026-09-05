import type { Task } from '@/types/task';

/**
 * K2 (eigenaarsbesluit 2026-09-05): de taken waarvan de EFFECTIEVE kalender `calendarId` is — een
 * eigen taakkalender, of geen eigen kalender terwijl `calendarId` de projectkalender is. Gedeeld door
 * `resourceSlice.updateCalendar`, `projectSlice.setProjectCalendar` en de MCP-tweeling.
 */
export function tasksOnCalendar(
  s: { tasks: Task[]; project: { calendarId: string } },
  calendarId: string,
): Task[] {
  return s.tasks.filter((t) => t.calendarId === calendarId || (t.calendarId === undefined && s.project.calendarId === calendarId));
}
