import type { WorkCalendar } from '@/types/calendar';

interface CalendarCacheState {
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  project: { calendarId: string };
}

export function syncProjectCalendar(s: CalendarCacheState): void {
  const entry = s.calendars.find((c) => c.id === s.project.calendarId);
  if (entry) s.calendar = entry;
  else promoteProjectCalendarToLibrary(s);
}

export function refreshProjectCalendarCache(s: CalendarCacheState): void {
  s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? s.calendar;
}

export function promoteProjectCalendarToLibrary(s: CalendarCacheState): void {
  if (s.calendars.some((c) => c.id === s.project.calendarId)) return;
  s.calendars = [...s.calendars, { ...s.calendar, name: s.calendar.name || 'Projectkalender' }];
}
