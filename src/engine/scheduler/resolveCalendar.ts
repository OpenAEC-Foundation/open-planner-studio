import type { WorkCalendar } from '@/types/calendar';

export function resolveCalendar(
  calendarId: string | undefined,
  registry: WorkCalendar[],
  projectCalendar: WorkCalendar,
): WorkCalendar {
  if (!calendarId) return projectCalendar;
  return registry.find((c) => c.id === calendarId) ?? projectCalendar;
}
