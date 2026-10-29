import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import { ISO_WEEK_DAYS } from '@/utils/weekDays';

/**
 * Puur, effectief werktijdmodel voor uurprecisie.
 *
 * `workTime` blijft de expliciete, persistente bron van waarheid. Oudere en klassieke
 * scalar-kalenders hebben die niet, maar bevatten wel alle informatie om een stabiele
 * werkdag te vormen. Deze helper materialiseert die bands uitsluitend in het geheugen;
 * hij verandert nooit de kalender die de gebruiker heeft opgeslagen.
 */
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
  return makeBands(workDays, seedScalarBands(
    workStartHour * 60,
    workEndHour * 60,
    hoursPerDay,
    simpleBreakStartMinute,
    simpleBreakDurationMinutes,
  ));
}

/** Weekbanden met een kopie van dezelfde `bands` op elk van de opgegeven ISO-weekdagen; andere
 *  waarden dan 1–7 vallen weg en de overige weekdagen blijven leeg. */
export function makeBands(days: readonly number[], bands: readonly { start: number; end: number }[]): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const weekday of days) {
    if (ISO_WEEK_DAYS.includes(weekday as typeof ISO_WEEK_DAYS[number])) {
      byWeekday[weekday as typeof ISO_WEEK_DAYS[number]] = bands.map((band) => ({ ...band }));
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

/** `scalarBreakIssue` voor de werkdag en het eenvoudige pauzepatroon van een (concept)kalender. */
export function calendarScalarBreakIssue(
  calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
): ScalarBreakIssue | undefined {
  return scalarBreakIssue(
    calendar.workStartHour * 60,
    calendar.workEndHour * 60,
    calendar.simpleBreakStartMinute,
    calendar.simpleBreakDurationMinutes,
  );
}

/** Netto uren die het expliciete pauzepatroon oplevert; `undefined` betekent ongeldig/legacy. */
export function simpleBreakNetHours(
  calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
): number | undefined {
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

type ScalarCalendar = Pick<WorkCalendar,
  'workStartHour' | 'workEndHour' | 'hoursPerDay' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes' | 'workTime'>;

/** De impliciete pauze van een legacy-scalarkalender (zonder pauzevelden): klokspanne min netto uren,
 *  in minuten, nooit negatief. 07:00–16:00 / 8 u ⇒ 60. */
export function legacySimpleBreakDurationMinutes(calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'>): number {
  return Math.max(0, Math.round((calendar.workEndHour - calendar.workStartHour - calendar.hoursPerDay) * 60));
}

/**
 * Volgorde waarin "de eerste werkdag met blokken" gezocht wordt: zondag eerst, dan maandag t/m zaterdag
 * (ISO-nummers). Dat is de volgorde waarin MS Project zijn weekdagen schrijft (DayType 1 = zondag) en
 * dus waarin de MSPDI- en `.mpp`-lezer hun scalaire werkdag kiezen. Eén regel voor de lezers, het
 * bibliotheekherstel en de werkdagknoppen van de kalenderdialoog. De IFC-lezer volgt hem bij werkblokken
 * die per weekdag verschillen (meer `IfcWorkTime`'s); bij één `IfcWorkTime` draagt elke werkdag dezelfde
 * periodes, en maakt de volgorde niet uit.
 */
const SCALAR_DAY_ORDER = [7, 1, 2, 3, 4, 5, 6] as const;

/** De blokken van de eerste werkdag met blokken (volgorde {@link SCALAR_DAY_ORDER}), of `undefined`. */
export function firstBlockedDay(
  bands: Pick<WorkTimeBands, 'byWeekday'> | undefined,
): ReadonlyArray<{ start: number; end: number }> | undefined {
  const byWeekday = bands?.byWeekday;
  if (!byWeekday) return undefined;
  for (const wd of SCALAR_DAY_ORDER) {
    const day = byWeekday[wd];
    if (Array.isArray(day) && day.length > 0) return day;
  }
  return undefined;
}

/**
 * De pauze die een kalender zonder pauzevelden impliciet heeft, als begin (minuut van de dag) en duur:
 * begin 12:00, duur = klokspanne − netto uren ({@link legacySimpleBreakDurationMinutes}). Werkblokken tellen
 * hier niet mee. Het kalendervenster toont bij werkblokken het blok Werktijden en geen pauzevelden (besluit
 * eigenaar 2026-10-13, optie 2). MCP komt hier wel met een uurkalender: `planner_update_calendar` met
 * `workTime: null` plus een pauzeveld maakt er een dagkalender van, en de pauze die het item niet noemt,
 * volgt dan uit deze regel (12:00), niet uit het gat tussen de oude blokken.
 */
export function inferredSimpleBreak(
  calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'>,
): { startMinute: number; durationMinutes: number } {
  return { startMinute: NOON, durationMinutes: legacySimpleBreakDurationMinutes(calendar) };
}

/**
 * Mag de kalenderdialoog `patch` (Begin, Einde of pauzebegin) op `calendar` toepassen? Begin vóór
 * einde binnen 00:00–24:00, en de pauze — expliciet, anders de impliciete ({@link inferredSimpleBreak}
 * van `calendar`) — valt volledig binnen de nieuwe werkdag. Ook een legacy-scalar zonder zichtbare
 * pauzevelden draagt zijn netto-tijd als impliciete pauze; dezelfde controle beschermt een nieuw
 * Begin/Einde dus tegen het ongemerkt buiten de werkdag drukken van die pauze. Puur, zodat de regel
 * zonder React te toetsen is (`check-werkdag-einde`).
 */
export function scalarTimesValid(calendar: ScalarCalendar, patch: Partial<WorkCalendar>): boolean {
  const next = { ...calendar, ...patch };
  const start = Math.round(next.workStartHour * 60);
  const end = Math.round(next.workEndHour * 60);
  if (start < 0 || start >= 24 * 60 || end <= 0 || end > 24 * 60 || start >= end) return false;
  const inferred = inferredSimpleBreak(calendar);
  const breakStart = next.simpleBreakStartMinute ?? inferred.startMinute;
  const breakDuration = next.simpleBreakDurationMinutes ?? inferred.durationMinutes;
  return breakStart >= start && breakStart < end
    && scalarBreakIssue(start, end, breakStart, breakDuration) === undefined;
}

/**
 * De afleiding bij het wijzigen van werkdag (Begin/Einde) of pauze op een scalaire kalender — één
 * definitie voor de kalenderdialoog (`CalendarForm`) en MCP `planner_update_calendar`:
 *  1. een legacy-kalender (zonder expliciete pauzeduur) wordt eerst expliciet: zijn impliciete pauze
 *     ({@link inferredSimpleBreak}: begin 12:00 en duur = klokspanne − netto uren) komt in de patch, zodat een oud handmatig
 *     `hoursPerDay` geen verborgen tweede bron blijft;
 *  2. daarna volgen de netto uren (`hoursPerDay`) uit werkdag en pauze (`simpleBreakNetHours`). Is dat
 *     patroon ongeldig, dan blijft `hoursPerDay` buiten de patch — de aanroeper valideert en weigert
 *     (`calendarScalarBreakIssue`).
 * Raakt `patch` geen van de vier velden, dan is het resultaat `patch` zelf.
 */
export function simpleBreakPatch(calendar: ScalarCalendar, patch: Partial<WorkCalendar>): Partial<WorkCalendar> {
  const changesScalarTime = patch.workStartHour !== undefined
    || patch.workEndHour !== undefined
    || patch.simpleBreakStartMinute !== undefined
    || patch.simpleBreakDurationMinutes !== undefined;
  if (!changesScalarTime) return patch;
  const inferred = calendar.simpleBreakDurationMinutes === undefined ? inferredSimpleBreak(calendar) : undefined;
  const materializedLegacyDuration = inferred
    ? {
        simpleBreakStartMinute: calendar.simpleBreakStartMinute ?? inferred.startMinute,
        simpleBreakDurationMinutes: inferred.durationMinutes,
      }
    : {};
  const next = { ...calendar, ...materializedLegacyDuration, ...patch };
  const netHours = simpleBreakNetHours(next);
  return { ...materializedLegacyDuration, ...patch, ...(netHours !== undefined ? { hoursPerDay: netHours } : {}) };
}

function hasAnyBands(bands: WorkTimeBands): boolean {
  return ISO_WEEK_DAYS.some((weekday) => bands.byWeekday[weekday].some(
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

/** Afgeleide werkblokken blijven aan hun scalaire bron gekoppeld (T11). */
const engineCalendars = new WeakMap<WorkCalendar, WorkCalendar>();
const scalarEngineCalendars = new WeakSet<WorkCalendar>();

export function calendarHasOwnWorkBlocks(calendar: WorkCalendar): boolean {
  return calendar.workTime !== undefined && !scalarEngineCalendars.has(calendar);
}

/** Eén niet-muterende engineweergave per kalender, met gedeelde bandcache. */
export function calendarForEngine(calendar: WorkCalendar): WorkCalendar {
  if (calendar.workTime) return calendar;
  const cached = engineCalendars.get(calendar);
  if (cached) return cached;
  const effective = calendarWithEffectiveWorkTime(calendar) ?? calendar;
  if (effective !== calendar) scalarEngineCalendars.add(effective);
  engineCalendars.set(calendar, effective);
  return effective;
}
