import { generateHolidays, NL_SET } from '@/engine/calendar/holidays';
import type { WorkCalendar } from '@/types/calendar';
import { loadConstructionMode } from '@/utils/settingsStore';

/**
 * Standaard bouwkalender (NL, ma-vr). Jaar-onafhankelijk: de feestdagen worden
 * regelgebaseerd gegenereerd voor `anchorYear-1 t/m anchorYear+2` — GEEN bouwvak (harde eis), MÉT
 * Kerst.
 *
 * Bouwmodus: in bouw-agnostische modus (bouwmodus UIT) levert de fabriek een NEUTRALE
 * kalender op — naam "Standaardkalender", GEEN NL-feestdagen (equivalent aan `country: 'none'`, dus
 * `generation: undefined`). In bouwmodus (default AAN): "Bouwkalender NL" + NL-
 * feestdagen. De vlag is app-niveau localStorage; deze synchrone fabriek leest 'm rechtstreeks
 * (`loadConstructionMode`). De kalendernamen blijven bewust hardcoded (geen t()).
 *
 * Deze fabrieksfunctie leeft in de engine-laag (niet in `src/types/`) omdat ze `generateHolidays`
 * als WAARDE nodig heeft; anders ontstaat er een runtime-module-cyclus met `holidays.ts`.
 */
export function createDefaultCalendar(anchorYear: number = new Date().getFullYear()): WorkCalendar {
  const from = anchorYear - 1;
  const to = anchorYear + 2;
  const construction = loadConstructionMode();
  return {
    id: 'cal-default',
    name: construction ? 'Bouwkalender NL' : 'Standaardkalender',
    description: construction
      ? 'Standaard bouwkalender: ma-vr 07:00-16:00'
      : 'Standaardkalender: ma-vr 07:00-16:00',
    workDays: [1, 2, 3, 4, 5], // Monday to Friday
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: construction ? generateHolidays(NL_SET, undefined, from, to) : [],
    generation: construction ? { ruleSetId: 'NL', generatedFromYear: from, generatedToYear: to } : undefined,
  };
}

/**
 * De ENE fabriek voor een nieuwe bibliotheekkalender (zonder id — de bibliotheek kent er een toe):
 * "+" in de kalenderdialoog, "+ Resourcekalender" in de resourcerij en MCP `update_calendar` met
 * `create: true` — zodat dezelfde handeling niet op de ene plek 0 en op de andere 29 feestdagen
 * oplevert.
 *
 * Gekozen standaard = de app-standaard (`createDefaultCalendar`): ma-vr 07:00-16:00, 8 u, en in
 * bouwmodus de NL-feestdagen met hun generatie-herkomst. Waarom deze en niet "leeg":
 *  - het is wat een nieuw project, MCP `create` (bewust, zie calendarResourceTools.ts) en de
 *    resourcerij doen;
 *  - of er standaard feestdagen in zitten is de keuze van de instelling Bouwmodus, niet van de knop
 *    waarmee je de kalender maakt (bouwmodus uit ⇒ ook hier geen feestdagen);
 *  - de fouten zijn niet symmetrisch: een vergeten feestdag plant stil werk op Kerst of Koningsdag,
 *    een ongewenste staat zichtbaar in de lijst en is met "Feestdagen genereren… → Geen feestdagen"
 *    in één handeling weg.
 */
export function createNewCalendar(name: string): Omit<WorkCalendar, 'id'> {
  const { id: _id, ...base } = createDefaultCalendar();
  void _id;
  return { ...base, name };
}
