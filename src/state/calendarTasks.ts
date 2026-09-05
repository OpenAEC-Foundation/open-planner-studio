import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';

type CalendarState = { tasks: Task[]; calendars: WorkCalendar[]; calendar: WorkCalendar; project: { calendarId: string } };

/**
 * K2 (eigenaarsbesluit 2026-09-05): de taken waarvan de EFFECTIEVE kalender `calendarId` is —
 * dezelfde opzoeking als de motor (`resolveCalendar`: eigen kalender, anders — óók bij een
 * bungelende verwijzing, reviewbevinding F9 — de projectkalender). Gedeeld door
 * `resourceSlice.updateCalendar` en de MCP-tweeling `draft.updateCalendar`.
 */
export function tasksOnCalendar(s: CalendarState, calendarId: string): Task[] {
  return s.tasks.filter((t) => resolveCalendar(t.calendarId, s.calendars, s.calendar).id === calendarId);
}

/**
 * De taken die de PROJECTkalender volgen: geen eigen kalender, of een verwijzing naar een kalender
 * die niet (meer) in de bibliotheek staat. Dat zijn precies de taken die meebewegen bij
 * `projectSlice.setProjectCalendar` — een taak die de oude projectkalender expliciet als eigen
 * kalender heeft, houdt die en hoort hier dus niet bij.
 */
export function tasksFollowingProjectCalendar(s: Pick<CalendarState, 'tasks' | 'calendars'>): Task[] {
  return s.tasks.filter((t) => t.calendarId === undefined || !s.calendars.some((c) => c.id === t.calendarId));
}
