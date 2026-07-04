import type { WorkCalendar } from '@/types/calendar';

/** Minimale vorm die `syncProjectCalendar` nodig heeft (subset van AppState) — vermijdt een
 *  circulaire import op de volledige store-type. */
interface CalendarCacheState {
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  project: { calendarId: string };
}

/**
 * Normatieve invariant (fase 2.8a, §9.1): `s.calendar` is de GEDENORMALISEERDE cache van de
 * bibliotheek-entry met id `project.calendarId`. Deze helper zet hem daar altijd gelijk aan —
 * verplicht ná elke restore (undo/redo/hydratePayload/switchDocument) én ná bibliotheek-CRUD/
 * default-switch, zodat de cache nooit uit sync drift.
 *
 * Fallback: ontbreekt de entry (bv. een pre-2.8a-snapshot of een project waarvan de kalender nog
 * niet in de bibliotheek staat), dan blijft de huidige `s.calendar` staan — nooit stil vervangen.
 */
export function syncProjectCalendar(s: CalendarCacheState): void {
  const entry = s.calendars.find((c) => c.id === s.project.calendarId);
  if (entry) s.calendar = entry;
}
