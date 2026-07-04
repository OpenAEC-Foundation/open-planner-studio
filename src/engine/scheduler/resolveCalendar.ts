import type { WorkCalendar } from '@/types/calendar';

/**
 * Los een (optionele) `calendarId` op tegen de gedeelde kalender-bibliotheek (fase 2.8a, §4.1).
 * `undefined` ⇒ de projectkalender; een onbekende id valt eveneens terug op de projectkalender
 * (dangling verwijzing, bv. na een verwijderde kalender). Gedeeld door de CPM-engine-cache, de
 * resource-leveler en de belasting-berekening zodat er één definitie bestaat.
 */
export function resolveCalendar(
  calendarId: string | undefined,
  registry: WorkCalendar[],
  projectCalendar: WorkCalendar,
): WorkCalendar {
  if (!calendarId) return projectCalendar;
  return registry.find((c) => c.id === calendarId) ?? projectCalendar;
}
