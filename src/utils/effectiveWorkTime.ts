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
  simpleBreakStartMinute?: number,
  simpleBreakDurationMinutes?: number,
): { start: number; end: number }[] {
  const span = endMin - startMin;
  if (span <= 0) return [];

  // Een opgeslagen eenvoudig pauzepatroon is de bron voor de scalar-afleiding. De UI laat zulke
  // ongeldige invoer niet toepassen, maar de engine blijft defensief voor oude/externe data.
  if (simpleBreakStartMinute !== undefined || simpleBreakDurationMinutes !== undefined) {
    const issue = scalarBreakIssue(startMin, endMin, simpleBreakStartMinute, simpleBreakDurationMinutes);
    if (issue) return [];
    const gap = simpleBreakDurationMinutes ?? 0;
    if (gap === 0) return [{ start: startMin, end: endMin }];
    const gapStart = simpleBreakStartMinute ?? NOON;
    return [{ start: startMin, end: gapStart }, { start: gapStart + gap, end: endMin }]
      .filter((band) => band.end > band.start);
  }

  // Legacy-scalar-kalenders hebben geen pauzevelden. Behoud hun bestaande afleiding letterlijk:
  // `hoursPerDay` bepaalt de netto tijd en het verschil valt zo dicht mogelijk bij 12:00.
  const target = Math.round(hoursPerDay * 60);
  if (target <= 0 || target > span) return [];
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
  simpleBreakStartMinute?: number,
  simpleBreakDurationMinutes?: number,
): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  const bands = seedScalarBands(
    workStartHour * 60,
    workEndHour * 60,
    hoursPerDay,
    simpleBreakStartMinute,
    simpleBreakDurationMinutes,
  );
  for (const weekday of workDays) {
    if (WEEKDAY_KEYS.includes(weekday as typeof WEEKDAY_KEYS[number])) {
      byWeekday[weekday as typeof WEEKDAY_KEYS[number]] = bands.map((band) => ({ ...band }));
    }
  }
  return { byWeekday };
}

export type ScalarBreakIssue = 'invalidDuration' | 'outsideWorkingDay' | 'consumesWorkingDay';

/**
 * Valideert het eenvoudige patroon op één plaats voor UI én effectieve werkbands. Een pauze van
 * nul minuten is expliciet toegestaan: daarmee kiest de gebruiker bewust voor een doorlopende
 * werkdag, ook wanneer een oudere `hoursPerDay` nog een impliciete middagpauze zou afleiden.
 */
export function scalarBreakIssue(
  startMin: number,
  endMin: number,
  breakStartMinute: number | undefined,
  breakDurationMinutes: number | undefined,
): ScalarBreakIssue | undefined {
  if (breakDurationMinutes === undefined && breakStartMinute === undefined) return undefined;
  const duration = breakDurationMinutes ?? 0;
  if (!Number.isInteger(duration) || duration < 0) return 'invalidDuration';
  if (duration === 0) return undefined;
  const start = breakStartMinute ?? NOON;
  if (!Number.isInteger(start) || start < startMin || start >= endMin || start + duration > endMin) {
    return 'outsideWorkingDay';
  }
  if (duration >= endMin - startMin) return 'consumesWorkingDay';
  return undefined;
}

/** Netto uren die het expliciete pauzepatroon oplevert; `undefined` betekent ongeldig/legacy. */
export function simpleBreakNetHours(calendar: WorkCalendar): number | undefined {
  if (calendar.simpleBreakStartMinute === undefined && calendar.simpleBreakDurationMinutes === undefined) {
    return undefined;
  }
  const start = calendar.workStartHour * 60;
  const end = calendar.workEndHour * 60;
  if (scalarBreakIssue(start, end, calendar.simpleBreakStartMinute, calendar.simpleBreakDurationMinutes)) {
    return undefined;
  }
  return (end - start - (calendar.simpleBreakDurationMinutes ?? 0)) / 60;
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
  const {
    workDays, workStartHour, workEndHour, hoursPerDay, simpleBreakStartMinute, simpleBreakDurationMinutes,
  } = calendar;
  if (!Array.isArray(workDays) || workDays.length === 0
    || !Number.isFinite(workStartHour) || !Number.isFinite(workEndHour) || !Number.isFinite(hoursPerDay)
    || workStartHour < 0 || workEndHour > 24 || hoursPerDay <= 0) return undefined;
  const bands = seedScalarWorkTime(
    workDays, workStartHour, workEndHour, hoursPerDay, simpleBreakStartMinute, simpleBreakDurationMinutes,
  );
  return hasAnyBands(bands) ? bands : undefined;
}

/** Een niet-muterende kalenderweergave die een CalendarEngine in uurmodus kan gebruiken. */
export function calendarWithEffectiveWorkTime(calendar: WorkCalendar): WorkCalendar | undefined {
  const workTime = effectiveWorkTimeBands(calendar);
  return workTime ? { ...calendar, workTime } : undefined;
}

/** Kalenderweergave voor consumenten die een CalendarEngine bouwen: effectieve banden waar die
 * bestaan, anders de oorspronkelijke (bijvoorbeeld ongeldig of zuiver dag-granulair) kalender. */
export function calendarForEngine(calendar: WorkCalendar): WorkCalendar {
  return calendarWithEffectiveWorkTime(calendar) ?? calendar;
}
