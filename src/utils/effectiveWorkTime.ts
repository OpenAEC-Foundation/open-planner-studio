import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

/**
 * Puur, effectief werktijdmodel voor uurprecisie.
 *
 * `workTime` blijft de expliciete, persistente bron van waarheid. Oudere en klassieke
 * scalar-kalenders hebben die niet, maar bevatten wel alle informatie om een stabiele
 * werkdag te vormen. Deze helper materialiseert die bands uitsluitend in het geheugen;
 * hij verandert nooit de kalender die de gebruiker heeft opgeslagen.
 */
const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 7] as const;
const NOON = 12 * 60;

export function seedScalarBands(
  startMin: number,
  endMin: number,
  hoursPerDay: number,
): { start: number; end: number }[] {
  const target = Math.round(hoursPerDay * 60);
  const span = endMin - startMin;
  if (span <= 0 || target <= 0 || target > span) return [];
  if (span === target) return [{ start: startMin, end: endMin }];
  const gap = span - target;
  const gapStart = Math.min(Math.max(NOON, startMin), endMin - gap);
  const gapEnd = gapStart + gap;
  const bands: { start: number; end: number }[] = [];
  if (gapStart > startMin) bands.push({ start: startMin, end: gapStart });
  if (gapEnd < endMin) bands.push({ start: gapEnd, end: endMin });
  return bands;
}

export function seedScalarWorkTime(
  workDays: number[],
  workStartHour: number,
  workEndHour: number,
  hoursPerDay: number,
): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  const bands = seedScalarBands(workStartHour * 60, workEndHour * 60, hoursPerDay);
  for (const weekday of workDays) {
    if (WEEKDAY_KEYS.includes(weekday as typeof WEEKDAY_KEYS[number])) {
      byWeekday[weekday as typeof WEEKDAY_KEYS[number]] = bands.map((band) => ({ ...band }));
    }
  }
  return { byWeekday };
}

function hasAnyBands(bands: WorkTimeBands): boolean {
  return WEEKDAY_KEYS.some((weekday) => bands.byWeekday[weekday].some(
    (band) => Number.isFinite(band.start) && Number.isFinite(band.end) && band.end > band.start,
  ));
}

/**
 * Geeft expliciete weekbands ongewijzigd terug. Ontbreken die, dan worden geldige scalarvelden
 * deterministisch als effectieve bands afgeleid. Een expliciete maar lege/ongeldige definitie
 * valt bewust niet terug op scalarvelden: handmatige weekblokken hebben absolute prioriteit.
 */
export function effectiveWorkTimeBands(calendar: WorkCalendar): WorkTimeBands | undefined {
  if (calendar.workTime) return hasAnyBands(calendar.workTime) ? calendar.workTime : undefined;
  const { workDays, workStartHour, workEndHour, hoursPerDay } = calendar;
  if (!Array.isArray(workDays) || workDays.length === 0
    || !Number.isFinite(workStartHour) || !Number.isFinite(workEndHour) || !Number.isFinite(hoursPerDay)
    || workStartHour < 0 || workEndHour > 24 || hoursPerDay <= 0) return undefined;
  const bands = seedScalarWorkTime(workDays, workStartHour, workEndHour, hoursPerDay);
  return hasAnyBands(bands) ? bands : undefined;
}

/** Een niet-muterende kalenderweergave die een CalendarEngine in uurmodus kan gebruiken. */
export function calendarWithEffectiveWorkTime(calendar: WorkCalendar): WorkCalendar | undefined {
  const workTime = effectiveWorkTimeBands(calendar);
  return workTime ? { ...calendar, workTime } : undefined;
}
