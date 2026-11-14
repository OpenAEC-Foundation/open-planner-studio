import type { WorkCalendar } from '@/types/calendar';
import { materializeHolidays, type HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import { loadConstructionMode } from '@/utils/settingsStore';
import type { TFunction } from 'i18next';
import type nlMenu from '@/i18n/locales/nl/menu.json';

/**
 * Fasering-templates voor de nieuw-project-wizard: een herbruikbaar skelet van
 * hoofdfasen waarmee een nieuw project start i.p.v. een lege takenlijst. Een fase is een
 * vertaalsleutel; `templatePhases` vertaalt hem alleen bij aanmaak naar de interfacetaal (#912).
 * Daarna zijn de namen gewone projectgegevens: een latere taalwissel hernoemt ze niet.
 */
export type TemplateKey = 'empty' | 'woningbouw' | 'utiliteit';

type PhaseKey = `newProject.phase.${keyof typeof nlMenu.newProject.phase}`;

export const PROJECT_TEMPLATES: { key: TemplateKey; phases: readonly PhaseKey[] }[] = [
  { key: 'empty', phases: [] },
  {
    key: 'woningbouw',
    phases: [
      'newProject.phase.siteGroundwork',
      'newProject.phase.foundation',
      'newProject.phase.shell',
      'newProject.phase.roof',
      'newProject.phase.facadeFitOut',
      'newProject.phase.services',
      'newProject.phase.finishes',
      'newProject.phase.handover',
    ],
  },
  {
    key: 'utiliteit',
    phases: [
      'newProject.phase.demolitionStripOut',
      'newProject.phase.groundworkFoundation',
      'newProject.phase.mainStructure',
      'newProject.phase.facadeRoof',
      'newProject.phase.services',
      'newProject.phase.fitOut',
      'newProject.phase.commissioning',
      'newProject.phase.handover',
    ],
  },
];

/** De fasenamen van een sjabloon in de taal van `t` (de `menu`-namespace). */
export function templatePhases(key: TemplateKey, t: TFunction<'menu'>): string[] {
  return (PROJECT_TEMPLATES.find((tmpl) => tmpl.key === key)?.phases ?? []).map((phase) => t(phase));
}

/**
 * Kalender-generator-parameters voor de nieuw-project-wizard, voor de regelgebaseerde
 * feestdagen-engine: land/regio en NL-bouwvak (default GEEN — harde eis).
 * `span` is de generatie-spanne in jaren (bij aanmaak startjaar−1..+3).
 */
export function buildGeneratedCalendar(
  params: HolidayGenParams,
  span: { from: number; to: number },
  name?: string,
): WorkCalendar {
  // Bouwmodus: default-naam/omschrijving volgen de vlag (agnostisch ⇒ "Standaardkalender").
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
