import type { WorkCalendar } from '@/types/calendar';
import { materializeHolidays, type HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import { loadConstructionMode } from '@/utils/settingsStore';
import type { TFunction } from 'i18next';
import type nlMenu from '@/i18n/locales/nl/menu.json';

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

export function templatePhases(key: TemplateKey, t: TFunction<'menu'>): string[] {
  return (PROJECT_TEMPLATES.find((tmpl) => tmpl.key === key)?.phases ?? []).map((phase) => t(phase));
}

export function buildGeneratedCalendar(
  params: HolidayGenParams,
  span: { from: number; to: number },
  name?: string,
): WorkCalendar {
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
