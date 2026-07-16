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
 * Fallback: ontbreekt de entry (bv. een undo die de bibliotheek-entry weer wegneemt terwijl
 * `project.calendarId` er nog naar wijst — de "undo-orphan", QA fase 2.8a) dan promoveren we de
 * huidige `s.calendar`-cache terug tot bibliotheek-entry onder dat id (`promoteProjectCalendarToLibrary`
 * herbruikt): dat herstelt de invariant zonder de cache zelf — en dus zonder de datums — aan te raken.
 */
export function syncProjectCalendar(s: CalendarCacheState): void {
  const entry = s.calendars.find((c) => c.id === s.project.calendarId);
  if (entry) s.calendar = entry;
  else promoteProjectCalendarToLibrary(s);
}

/**
 * §4.3-migratie: promoveer de geladen/actieve projectkalender-cache (`s.calendar`) tot een
 * bibliotheek-entry als er nog geen entry met `project.calendarId` bestaat — zo wordt de tot nu
 * toe inline projectkalender van een pre-2.8a-document de eerste zichtbare bibliotheek-entry.
 * Idempotent en puur additief: bestaande bibliotheken blijven ongemoeid (no-op als de entry al
 * bestaat), `s.calendar` zelf wordt niet aangeraakt (geen stille hergeneratie van
 * holidays/generation, §4.3) — er komt alleen een kopie bij in `s.calendars`. Zelfde naamgevings-
 * semantiek als de `ensureProjectCalendarInLibrary`-store-actie (projectSlice.ts, de lazy
 * dialoog-variant voor al-open documenten): bestaande kalendernaam blijft, `'Projectkalender'`
 * alleen als fallback voor een leeg/ontbrekend naamveld.
 */
export function promoteProjectCalendarToLibrary(s: CalendarCacheState): void {
  if (s.calendars.some((c) => c.id === s.project.calendarId)) return;
  // BEWUST geen .push: `s.calendars` kan hier een door Immer BEVROREN array zijn die zojuist
  // binnen dezelfde set() uit een payload/snapshot is toegewezen (hydratePayload bij
  // switchDocument/recovery, restoreSnapshot bij undo/redo) — push gooit dan
  // "Cannot add property N, object is not extensible". Een verse array toewijzen is altijd veilig.
  s.calendars = [...s.calendars, { ...s.calendar, name: s.calendar.name || 'Projectkalender' }];
}
