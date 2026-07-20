import type { WorkCalendar } from '@/types/calendar';
import { materializeHolidays, type HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import { loadConstructionMode } from '@/utils/settingsStore';

/**
 * Fasering-templates voor de nieuw-project-wizard: een herbruikbaar skelet van
 * hoofdfasen waarmee een nieuw project start i.p.v. een lege takenlijst. De
 * faseNamen zijn projectdata (geen UI-chrome) en staan daarom in de werktaal
 * (Nederlands); de gebruiker past ze daarna naar wens aan.
 */
export type TemplateKey = 'empty' | 'woningbouw' | 'utiliteit';

export const PROJECT_TEMPLATES: { key: TemplateKey; phases: string[] }[] = [
  { key: 'empty', phases: [] },
  {
    key: 'woningbouw',
    phases: [
      'Bouwplaats & grondwerk',
      'Fundering',
      'Ruwbouw / casco',
      'Dak',
      'Gevel & afbouw',
      'Installaties (W/E)',
      'Afwerking',
      'Oplevering',
    ],
  },
  {
    key: 'utiliteit',
    phases: [
      'Sloop & strip-out',
      'Grondwerk & fundering',
      'Hoofddraagconstructie',
      'Gevel & dak',
      'Installaties (W/E)',
      'Afbouw',
      'Inregelen & testen',
      'Oplevering',
    ],
  },
];

export function templatePhases(key: TemplateKey): string[] {
  return PROJECT_TEMPLATES.find((t) => t.key === key)?.phases ?? [];
}

/**
 * Kalender-generator-parameters voor de nieuw-project-wizard (fase 2.8a, §7.2). Vervangt de
 * oude vaste presets (`CalendarPreset`/`buildPresetCalendar`) door de regelgebaseerde
 * feestdagen-engine: land/regio en NL-bouwvak (default GEEN — harde eis TODO.md r192-194).
 * `span` is de generatie-spanne in jaren (§4.4: bij aanmaak startjaar−1..+3).
 */
export function buildGeneratedCalendar(
  params: HolidayGenParams,
  span: { from: number; to: number },
  name?: string,
): WorkCalendar {
  // Bouwmodus (2026-07-13): default-naam/omschrijving volgen de vlag (agnostisch ⇒ "Standaardkalender").
  // De feestdagen komen uit `params` (de wizard zet in agnostische modus zelf `country: 'none'`), dus
  // die worden hier niet apart geneutraliseerd. Namen blijven bewust hardcoded (geen t()).
  const construction = loadConstructionMode();
  const calName = name ?? (construction ? 'Bouwkalender NL' : 'Standaardkalender');
  const { holidays, generation } = materializeHolidays(params, span.from, span.to);
  return {
    id: 'cal-default',
    name: calName,
    description: construction
      ? 'Standaard bouwkalender: ma-vr 07:00-16:00'
      : 'Standaardkalender: ma-vr 07:00-16:00',
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays,
    generation,
  };
}
