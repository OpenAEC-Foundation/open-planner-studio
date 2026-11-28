import { generateHolidays, NL_SET } from '@/engine/calendar/holidays';
import type { WorkCalendar } from '@/types/calendar';
import { loadConstructionMode } from '@/utils/settingsStore';

export const DEFAULT_CALENDAR_ID = 'cal-default';

export function createDefaultCalendar(anchorYear: number = new Date().getFullYear()): WorkCalendar {
  const from = anchorYear - 1;
  const to = anchorYear + 2;
  const construction = loadConstructionMode();
  return {
    id: DEFAULT_CALENDAR_ID,
    name: construction ? 'Bouwkalender NL' : 'Standaardkalender',
    description: construction
      ? 'Standaard bouwkalender: ma-vr 07:00-16:00'
      : 'Standaardkalender: ma-vr 07:00-16:00',
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: construction ? generateHolidays(NL_SET, undefined, from, to) : [],
    generation: construction ? { ruleSetId: 'NL', generatedFromYear: from, generatedToYear: to } : undefined,
  };
}

export function createNewCalendar(name: string): Omit<WorkCalendar, 'id'> {
  const { id: _id, ...base } = createDefaultCalendar();
  void _id;
  return { ...base, name };
}
