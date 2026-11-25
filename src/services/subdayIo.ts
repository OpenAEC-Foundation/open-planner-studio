import { parseIfcDuration } from '@/services/ifc/isoDuration';
import { parseIfcClock } from '@/services/ifc/ifcClock';
import type { MilestoneKind, Task } from '@/types/task';
import { isHourModeCalendar, type WorkCalendar, type WorkTimeBands } from '@/types/calendar';
import { effectiveWorkTimeBands, firstBlockedDay, seedScalarBands } from '@/utils/effectiveWorkTime';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { isoDayOfWeek } from '@/utils/dateUtils';
import { modalBandHoursPerDay } from '@/engine/scheduler/CalendarEngine';

const MIN_PER_DAY = 1440;

export function minutesToClock(min: number, endOfDay = false): string {
  if (endOfDay && min === MIN_PER_DAY) return '24:00:00';
  const m = ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const milliseconds = Math.round(m * 60_000);
  const h = Math.floor(milliseconds / 3_600_000) % 24;
  const mm = Math.floor(milliseconds / 60_000) % 60;
  const ss = Math.floor(milliseconds / 1000) % 60;
  const fraction = milliseconds % 1000;
  const seconds = String(ss).padStart(2, '0') + (fraction ? `.${String(fraction).padStart(3, '0').replace(/0+$/, '')}` : '');
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${seconds}`;
}

export function scalarHourFromClock(clock: string): number {
  const parsed = parseIfcClock(clock);
  return parsed ? parsed.minutes / 60 : NaN;
}

export function clockToMinutes(clock: string): number | null {
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

export function minutesToIsoDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}PT${h}H${m}M0S`;
}

export const SIX_DECIMAL_HOUR_NOISE_MINUTES = 0.00003;

export function sixDecimalHoursToMinutes(hours: number): number {
  const minutes = hours * 60;
  const whole = Math.round(minutes);
  if (Math.abs(minutes - whole) <= SIX_DECIMAL_HOUR_NOISE_MINUTES) return whole;
  return Math.round(minutes * 1e6) / 1e6;
}

export function isoDurationToMinutes(iso: string): number | null {
  return !iso || iso === '$' ? null : parseIfcDuration(iso).timeMinutes;
}

export function hasNonAnchorTime(iso: string, anchorClock: string): boolean {
  const tIdx = iso.indexOf('T');
  if (tIdx < 0) return false;
  const time = iso.slice(tIdx + 1).replace(/[Zz].*$/, '').replace(/[+-]\d\d:?\d\d$/, '');
  return time.slice(0, 5) !== anchorClock.slice(0, 5);
}

export function isSubDayMinutes(minutes: number, hoursPerDay: number): boolean {
  const perDay = Math.round(hoursPerDay * 60);
  if (perDay <= 0) return true;
  return Math.round(minutes) % perDay !== 0;
}

export function canonicalizeBands(
  raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>>,
): { bands: WorkTimeBands; deviates: boolean } {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  let deviates = false;
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    const list = raw[wd] ?? [];
    if (list.length > 1) deviates = true;
    const norm = list
      .map((b) => {
        const rawStart = b.start;
        let end = b.end;
        if (end <= b.start) end += MIN_PER_DAY;
        if (end > MIN_PER_DAY) deviates = true;
        if (end - rawStart >= MIN_PER_DAY) deviates = true;
        return { start: b.start, end };
      })
      .sort((a, b) => a.start - b.start);
    byWeekday[wd] = norm;
  }
  return { bands: { byWeekday }, deviates };
}

export function sameBlocks(
  a: ReadonlyArray<{ start: number; end: number }>, b: ReadonlyArray<{ start: number; end: number }>,
): boolean {
  return a.length === b.length && a.every((x, i) => x.start === b[i].start && x.end === b[i].end);
}

export function sharedWeekBlocks(bands: WorkTimeBands): ReadonlyArray<{ start: number; end: number }> | 'verschilt' | undefined {
  let shared: ReadonlyArray<{ start: number; end: number }> | undefined;
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    const day = bands.byWeekday[wd];
    if (day.length === 0) continue;
    if (!shared) shared = day;
    else if (!sameBlocks(shared, day)) return 'verschilt';
  }
  return shared;
}

export function opsDayWithBreak(bands: WorkTimeBands): ReadonlyArray<{ start: number; end: number }> | undefined {
  const shared = sharedWeekBlocks(bands);
  return Array.isArray(shared) && shared.length === 2
    && shared[0].end < shared[1].start && shared[1].end <= MIN_PER_DAY
    ? shared : undefined;
}

export const deriveHoursPerDay = modalBandHoursPerDay;

export function hoursPerDayDiffers(stored: number, derived: number | undefined): boolean {
  return stored !== derived;
}

export interface BlockedWorkDay {
  startHour: number;
  endHour: number;
  netHours: number;
  blocks: number;
  firstBlockEndHour: number;
}
export function workDayFromBlocks(dayBlocks: ReadonlyArray<{ start: number; end: number }>): BlockedWorkDay | undefined {
  const blocks = dayBlocks
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
    .map((b) => ({ start: b.start, end: b.end <= b.start ? b.end + MIN_PER_DAY : b.end }))
    .sort((a, b) => a.start - b.start);
  if (blocks.length === 0) return undefined;
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  return {
    startHour: Math.floor(first.start / 60),
    endHour: last.end > MIN_PER_DAY ? 24 : Math.floor(last.end / 60),
    netHours: blocks.reduce((sum, b) => sum + (b.end - b.start), 0) / 60,
    blocks: blocks.length,
    firstBlockEndHour: Math.floor(Math.min(first.end, MIN_PER_DAY) / 60),
  };
}

export { firstBlockedDay };

export const STANDARD_DAY_BLOCKS: ReadonlyArray<{ start: number; end: number }> = [
  { start: 7 * 60, end: 12 * 60 }, { start: 13 * 60, end: 16 * 60 },
];

export type WorkTimeSessionStart = Pick<WorkCalendar, 'workTime' | 'hoursPerDay'>;

export function hoursPerDayFollowsBlocks(start: WorkTimeSessionStart): boolean {
  if (!start.workTime) return true;
  const modal = deriveHoursPerDay(start.workTime, NaN);
  return Number.isNaN(modal) || !hoursPerDayDiffers(start.hoursPerDay, modal);
}

export function hoursPerDayForBlocks(
  start: WorkTimeSessionStart,
  cal: Pick<WorkCalendar, 'hoursPerDay'>,
  workTime: WorkTimeBands,
): number {
  return hoursPerDayFollowsBlocks(start) ? deriveHoursPerDay(workTime, cal.hoursPerDay) : cal.hoursPerDay;
}

export function workDayTogglePatch(
  cal: Pick<WorkCalendar, 'workDays' | 'workTime' | 'hoursPerDay' | 'workStartHour' | 'workEndHour'
    | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
  day: number,
  opened?: WorkTimeSessionStart,
): Partial<WorkCalendar> {
  const has = cal.workDays.includes(day);
  const workDays = has ? cal.workDays.filter((x) => x !== day) : [...cal.workDays, day].sort((a, b) => a - b);
  if (!cal.workTime || day < 1 || day > 7) return { workDays };
  const own = opened?.workTime?.byWeekday[day as 1];
  const seeded = () => {
    const bands = seedScalarBands(cal.workStartHour * 60, cal.workEndHour * 60, cal.hoursPerDay,
      cal.simpleBreakStartMinute, cal.simpleBreakDurationMinutes);
    return bands.length > 0 ? bands : STANDARD_DAY_BLOCKS;
  };
  const source = has
    ? []
    : (own && own.length > 0 ? own : firstBlockedDay(cal.workTime) ?? firstBlockedDay(opened?.workTime)) ?? seeded();
  const workTime: WorkTimeBands = {
    byWeekday: { ...cal.workTime.byWeekday, [day as 1]: source.map((b) => ({ ...b })) },
  };
  return { workDays, workTime, hoursPerDay: hoursPerDayForBlocks(opened ?? cal, cal, workTime) };
}

export function workDaysSetPatch(
  cal: Pick<WorkCalendar, 'workDays' | 'workTime' | 'hoursPerDay' | 'workStartHour' | 'workEndHour'
    | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
  days: readonly number[],
  opened?: WorkTimeSessionStart,
): Partial<WorkCalendar> {
  let cur = { ...cal };
  for (const on of [true, false]) {
    for (let day = 1; day <= 7; day++) {
      if (days.includes(day) === on && cur.workDays.includes(day) !== on) {
        cur = { ...cur, ...workDayTogglePatch(cur, day, opened) };
      }
    }
  }
  return cur.workTime
    ? { workDays: cur.workDays, workTime: cur.workTime, hoursPerDay: hoursPerDayForBlocks(opened ?? cal, cal, cur.workTime) }
    : { workDays: cur.workDays };
}

function scalarDayOfBands(cal: Pick<WorkCalendar, 'workTime'>): BlockedWorkDay | undefined {
  const day = firstBlockedDay(cal.workTime);
  return day ? workDayFromBlocks(day) : undefined;
}

export function withRepairedFirstBlockScalar<T extends Pick<WorkCalendar, 'workTime' | 'workStartHour' | 'workEndHour'>>(cal: T): T {
  const day = scalarDayOfBands(cal);
  if (!day || day.blocks < 2) return cal;
  if (cal.workStartHour !== day.startHour || cal.workEndHour !== day.firstBlockEndHour) return cal;
  if (day.endHour <= cal.workEndHour) return cal;
  return { ...cal, workEndHour: day.endHour };
}

export function firstBlockScalarVariant<T extends Pick<WorkCalendar, 'workTime' | 'workStartHour' | 'workEndHour'>>(cal: T): T | undefined {
  const day = scalarDayOfBands(cal);
  if (!day || day.blocks < 2) return undefined;
  if (cal.workStartHour !== day.startHour || cal.workEndHour !== day.endHour) return undefined;
  if (day.firstBlockEndHour >= day.endHour) return undefined;
  return { ...cal, workEndHour: day.firstBlockEndHour };
}

export function workDaysFromBands(bands: WorkTimeBands): number[] {
  const days: number[] = [];
  for (let wd = 1; wd <= 7; wd++) {
    if ((bands.byWeekday[wd as 1] ?? []).length > 0) days.push(wd);
  }
  return days;
}

export function synthBandsFromScalar(cal: WorkCalendar): WorkTimeBands {
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const band = { start: cal.workStartHour * 60, end: cal.workEndHour * 60 };
  for (const wd of cal.workDays) if (wd >= 1 && wd <= 7) raw[wd as 1] = [{ ...band }];
  return canonicalizeBands(raw).bands;
}

const bandRegistry = new WeakMap<WorkCalendar, { canonical: WorkTimeBands; deviates: boolean }>();

export function registerCalendarBands(
  cal: WorkCalendar,
  info: { canonical: WorkTimeBands; deviates: boolean },
): void {
  bandRegistry.set(cal, info);
}

export function getCalendarBands(
  cal: WorkCalendar,
): { canonical: WorkTimeBands; deviates: boolean } | undefined {
  return bandRegistry.get(cal);
}

export function promoteHourCalendar(
  cal: WorkCalendar,
  info: { canonical: WorkTimeBands; deviates: boolean } | undefined,
  signaled: boolean,
  preferCanonicalWhenEmpty: boolean,
): boolean {
  if (!((info?.deviates ?? false) || signaled)) return false;
  if (cal.workTime) return true;
  const canonical = info?.canonical;
  const useCanonical = !!canonical && (preferCanonicalWhenEmpty || workDaysFromBands(canonical).length > 0);
  const bands = useCanonical ? canonical! : synthBandsFromScalar(cal);
  cal.workTime = bands;
  const wd = workDaysFromBands(bands);
  if (wd.length > 0) cal.workDays = wd;
  cal.hoursPerDay = deriveHoursPerDay(bands, cal.hoursPerDay);
  return true;
}

export function milestoneKindAt(cal: WorkCalendar, anchor: Date): MilestoneKind | undefined {
  const bands = cal.workTime;
  if (!bands) return undefined;
  const wd = isoDayOfWeek(anchor) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const prevWd = (((wd + 5) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const minuteOfDay = anchor.getUTCHours() * 60 + anchor.getUTCMinutes();
  const todays = bands.byWeekday[wd] ?? [];
  for (const b of todays) {
    if (b.start === minuteOfDay) return 'START';
  }
  for (const b of todays) {
    if (b.end === minuteOfDay) return 'FINISH';
  }
  const yesterdays = bands.byWeekday[prevWd] ?? [];
  for (const b of yesterdays) {
    if (b.end >= 1440 && b.end - 1440 === minuteOfDay) return 'FINISH';
  }
  return undefined;
}

export function promoteHourCalendars<K>(
  entries: Iterable<readonly [K, WorkCalendar]>,
  signaled: (key: K) => boolean,
  preferCanonicalWhenEmpty: boolean,
): Set<K> {
  const promoted = new Set<K>();
  for (const [key, cal] of entries) {
    if (promoteHourCalendar(cal, getCalendarBands(cal), signaled(key), preferCanonicalWhenEmpty)) promoted.add(key);
  }
  return promoted;
}

export function effectiveCalendarByTask(
  tasks: Task[],
  projectCal: WorkCalendar,
  library: WorkCalendar[],
): Map<string, WorkCalendar> {
  const byId = new Map<string, WorkCalendar>();
  for (const c of library) byId.set(c.id, c);
  const result = new Map<string, WorkCalendar>();
  for (const t of tasks) {
    result.set(t.id, (t.calendarId && byId.get(t.calendarId)) || projectCal);
  }
  return result;
}

export function exportCalendarLayout(tasks: Task[], calendar: WorkCalendar, resourceCalendars: WorkCalendar[]): {
  libraryCalendars: WorkCalendar[];
  calendarNumber: Map<string, number>;
  effCalByTask: Map<string, WorkCalendar>;
  hourTaskCalendarIds: Set<string>;
} {
  const libraryCalendars = resourceCalendars.filter(c => c.id !== calendar.id);
  const calendarNumber = new Map<string, number>([[calendar.id, 1]]);
  libraryCalendars.forEach((cal, i) => calendarNumber.set(cal.id, i + 2));
  const effCalByTask = effectiveCalendarByTask(tasks, calendar, libraryCalendars);
  const hourTaskCalendarIds = new Set(tasks.flatMap((task) => {
    const calendarId = taskDurationUnit(task) === 'hours' ? effCalByTask.get(task.id)?.id : undefined;
    return calendarId ? [calendarId] : [];
  }));
  return { libraryCalendars, calendarNumber, effCalByTask, hourTaskCalendarIds };
}


export function hasConcreteWorkBlocks(calendar: WorkCalendar): boolean {
  return !!effectiveWorkTimeBands(calendar);
}

export function fileHasHourData(tasks: Task[], calendars: WorkCalendar[]): boolean {
  if (calendars.some(isHourModeCalendar)) return true;
  return tasks.some((t) => taskDurationUnit(t) === 'hours');
}

export function taskMinutesForWrite(task: Task, hoursPerDay: number): number {
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return Math.round(task.time.scheduleDuration * hoursPerDay * 60);
}
