import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/types/calendar';

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
 * Kalender-presets. Bewust eerlijk afgeleid van de bestaande standaard-
 * bouwkalender; regio-specifieke bouwvak (Midden/Zuid) ontbreekt omdat er geen
 * geverifieerde datatabel voor is — niet verzinnen.
 */
export type CalendarPreset = 'nl-bouw' | 'nl-feestdagen' | 'geen';

export function buildPresetCalendar(preset: CalendarPreset): WorkCalendar {
  const base = createDefaultCalendar();
  if (preset === 'nl-feestdagen') {
    return { ...base, holidays: base.holidays.filter((h) => !h.name.toLowerCase().includes('bouwvak')) };
  }
  if (preset === 'geen') {
    return { ...base, name: '5-daagse kalender', description: 'Ma-vr 07:00-16:00, geen feestdagen', holidays: [] };
  }
  return base; // 'nl-bouw'
}
