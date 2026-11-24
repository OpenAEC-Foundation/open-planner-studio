import { calendarForEngine, calendarHasOwnWorkBlocks } from '@/utils/effectiveWorkTime';
import { holidayEndDate, isHourModeCalendar, WorkCalendar, type WorkTimeBands } from '@/types/calendar';
import { parseDate, isoDayOfWeek, addCalendarDays, formatDate, diffCalendarDays, MS_PER_DAY, utcDayIndex } from '@/utils/dateUtils';

interface BandInterval {
  start: number;
  end: number;
}

interface BandCache {
  days: Map<number, BandInterval[]>;
  fills: number;
  measure: Map<number, MeasureDay>;
  minutePrefix?: { firstDay: number; cum: number[] };
}

interface MeasureDay {
  bands: BandInterval[];
  minutes: number;
}

interface MeasurePosition {
  dayMs: number;
  offset: number;
  day: MeasureDay;
}

const MEASURE_EPS = 1e-9;

const EMPTY_WEEK: WorkTimeBands = Object.freeze({
  byWeekday: Object.freeze({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }),
}) as WorkTimeBands;

const bandCacheRegistry = new WeakMap<WorkCalendar, BandCache>();

function modalHighest(values: readonly number[]): number {
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, count] of freq) {
    if (count > bestCount || (count === bestCount && v > best)) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

export function modalBandHoursPerDay(bands: WorkTimeBands, fallback: number): number {
  const sums: number[] = [];
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    const list = bands.byWeekday[wd] ?? [];
    if (list.length === 0) continue;
    sums.push(list.reduce((s, b) => s + (b.end - b.start), 0) / 60);
  }
  return sums.length === 0 ? fallback : modalHighest(sums);
}

export class CalendarEngine {
  private calendar: WorkCalendar;
  private holidaySet: Set<string>;
  private workDayMask: boolean[];
  private workDaysPerWeek: number;
  private holidayDaySet: Set<number>;
  private holidayWorkdayIdxSorted: number[];
  private workingExceptionDaySet: Set<number>;
  private workingExceptionSet: Set<string>;
  private workingExceptionBandsByDay: Map<number, { start: number; end: number }[]>;
  private workingExceptionOnNonWorkWeekdayIdxSorted: number[];
  private static readonly MAX_SCAN = 366;
  private static readonly MAX_DAYS = 200_000;
  private static readonly MAX_MINUTES = CalendarEngine.MAX_DAYS * 24 * 60;
  private static readonly MS_PER_MIN = 60_000;

  private derivedHpd = 0;
  private bandCache!: BandCache;
  private standardWorkdayBands: { start: number; end: number }[] = [];

  readonly hasOwnWorkBlocks: boolean;

  readonly isHourMode: boolean;

  constructor(calendar: WorkCalendar) {
    this.hasOwnWorkBlocks = calendarHasOwnWorkBlocks(calendar);
    calendar = calendarForEngine(calendar);
    this.calendar = calendar;
    this.workDayMask = new Array(8).fill(false);
    for (const wd of this.calendar.workDays) this.workDayMask[wd] = true;
    this.workDaysPerWeek = 0;
    for (let wd = 1; wd <= 7; wd++) if (this.workDayMask[wd]) this.workDaysPerWeek++;
    this.holidaySet = new Set<string>();
    this.holidayDaySet = new Set<number>();
    this.buildHolidaySet();
    this.workingExceptionDaySet = new Set<number>();
    this.workingExceptionSet = new Set<string>();
    this.workingExceptionBandsByDay = new Map<number, { start: number; end: number }[]>();
    this.buildWorkingExceptions();
    this.holidayWorkdayIdxSorted = [...this.holidayDaySet]
      .filter((idx) => this.workDayMask[isoDayOfWeek(new Date(idx * MS_PER_DAY))]
        && !this.workingExceptionDaySet.has(idx))
      .sort((a, b) => a - b);
    this.workingExceptionOnNonWorkWeekdayIdxSorted = [...this.workingExceptionDaySet]
      .filter((idx) => !this.workDayMask[isoDayOfWeek(new Date(idx * MS_PER_DAY))])
      .sort((a, b) => a - b);
    this.isHourMode = isHourModeCalendar(calendar);
    if (!this.calendar.workTime) this.calendar = { ...this.calendar, workTime: EMPTY_WEEK };
    this.derivedHpd = this.computeDerivedHoursPerDay();
    this.standardWorkdayBands = this.computeStandardWorkdayBands();
    let cache = bandCacheRegistry.get(calendar);
    if (!cache) {
      cache = { days: new Map(), fills: 0, measure: new Map() };
      bandCacheRegistry.set(calendar, cache);
    }
    this.bandCache = cache;
  }

  private buildHolidaySet(): void {
    for (const holiday of this.calendar.holidays) {
      const start = parseDate(holiday.startDate);
      const end = parseDate(holidayEndDate(holiday));
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        const d = addCalendarDays(start, i);
        this.holidaySet.add(formatDate(d));
        this.holidayDaySet.add(utcDayIndex(d.getTime()));
      }
    }
  }

  private buildWorkingExceptions(): void {
    for (const exc of this.calendar.workingExceptions ?? []) {
      const start = parseDate(exc.startDate);
      const end = parseDate(exc.endDate);
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        const d = addCalendarDays(start, i);
        const dayIdx = utcDayIndex(d.getTime());
        this.workingExceptionDaySet.add(dayIdx);
        this.workingExceptionSet.add(formatDate(d));
        if (exc.bands && exc.bands.length > 0) {
          this.workingExceptionBandsByDay.set(dayIdx, [...exc.bands]);
        }
      }
    }
  }

  hasWorkingDays(): boolean {
    return Array.isArray(this.calendar.workDays) && this.calendar.workDays.length > 0;
  }

  isWorkDay(date: Date): boolean {
    const dow = isoDayOfWeek(date);
    const hasExc = this.workingExceptionDaySet.size > 0;
    if (!hasExc && !this.workDayMask[dow]) return false;
    const dayIdx = utcDayIndex(date.getTime());
    if (hasExc && this.workingExceptionDaySet.has(dayIdx)) return true;
    if (!this.workDayMask[dow]) return false;
    return !this.holidayDaySet.has(dayIdx);
  }

  isHoliday(dateStr: string): boolean {
    return this.holidaySet.has(dateStr) && !this.workingExceptionSet.has(dateStr);
  }

  addWorkDays(startDate: Date, workDays: number): Date {
    return this.addWorkDaysChecked(startDate, workDays).date;
  }

  addWorkDaysChecked(startDate: Date, workDays: number): { date: Date; capped: boolean } {
    if (workDays <= 0) return { date: new Date(startDate.getTime()), capped: false };

    let current = new Date(startDate.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return { date: current, capped: true };
    }

    let remaining = workDays - 1;
    const fastOffset = this.offsetOfNthWorkday(current, remaining, 1);
    if (fastOffset !== null) return { date: addCalendarDays(current, fastOffset), capped: false };
    let steps = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, 1);
      if (this.isWorkDay(current)) {
        remaining--;
      }
      if (++steps > CalendarEngine.MAX_DAYS) return { date: current, capped: true };
    }
    return { date: current, capped: false };
  }

  workDaysBetween(start: Date, end: Date): number {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (!(endMs >= startMs)) return 0;
    const totalDays = Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
    const cappedDays = Math.min(totalDays, CalendarEngine.MAX_DAYS + 1);
    const startIdx = utcDayIndex(startMs);
    const lastIdx = startIdx + cappedDays - 1;
    return this.countWorkWeekdays(startIdx, lastIdx)
      - this.countHolidayWorkdaysInRange(startIdx, lastIdx)
      + this.countWorkingExceptionsAddedInRange(startIdx, lastIdx);
  }

  signedWorkDaysBetween(a: Date, b: Date): number {
    return a <= b ? this.workDaysBetween(a, b) - 1 : -(this.workDaysBetween(b, a) - 1);
  }

  private countWorkWeekdays(startIdx: number, lastIdx: number): number {
    const L = lastIdx - startIdx + 1;
    if (L <= 0) return 0;
    const fullWeeks = Math.floor(L / 7);
    let count = fullWeeks * this.workDaysPerWeek;
    const rem = L - fullWeeks * 7;
    if (rem > 0) {
      let wd = isoDayOfWeek(new Date(startIdx * MS_PER_DAY));
      for (let i = 0; i < rem; i++) {
        if (this.workDayMask[wd]) count++;
        wd = wd === 7 ? 1 : wd + 1;
      }
    }
    return count;
  }

  private countSortedIdxInRange(sorted: number[], startIdx: number, lastIdx: number): number {
    let lo = 0;
    let loHi = sorted.length;
    while (lo < loHi) {
      const mid = (lo + loHi) >>> 1;
      if (sorted[mid] < startIdx) lo = mid + 1;
      else loHi = mid;
    }
    let hi = 0;
    let hiHi = sorted.length;
    while (hi < hiHi) {
      const mid = (hi + hiHi) >>> 1;
      if (sorted[mid] <= lastIdx) hi = mid + 1;
      else hiHi = mid;
    }
    return hi - lo;
  }

  private countHolidayWorkdaysInRange(startIdx: number, lastIdx: number): number {
    return this.countSortedIdxInRange(this.holidayWorkdayIdxSorted, startIdx, lastIdx);
  }

  private countWorkingExceptionsAddedInRange(startIdx: number, lastIdx: number): number {
    return this.countSortedIdxInRange(this.workingExceptionOnNonWorkWeekdayIdxSorted, startIdx, lastIdx);
  }

  nextWorkDay(date: Date): Date {
    let current = new Date(date.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  nextWorkDayAfter(date: Date): Date {
    let current = addCalendarDays(date, 1);
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  prevWorkDay(date: Date): Date {
    let current = new Date(date.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, -1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  prevWorkDayBefore(date: Date): Date {
    let current = addCalendarDays(date, -1);
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, -1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  subtractWorkDays(endDate: Date, workDays: number): Date {
    if (workDays <= 0) return new Date(endDate.getTime());

    let current = new Date(endDate.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, -1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }

    let remaining = workDays - 1;
    const fastOffset = this.offsetOfNthWorkday(current, remaining, -1);
    if (fastOffset !== null) return addCalendarDays(current, -fastOffset);
    let steps = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, -1);
      if (this.isWorkDay(current)) {
        remaining--;
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return current;
  }

  addWorkingDaysSigned(date: Date, n: number): Date {
    let current = this.nextWorkDay(new Date(date.getTime()));
    if (n === 0) return current;
    const step = n > 0 ? 1 : -1;
    let remaining = Math.abs(n);
    const fastOffset = this.offsetOfNthWorkday(current, remaining, step);
    if (fastOffset !== null) return addCalendarDays(current, step * fastOffset);
    let guard = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, step);
      if (this.isWorkDay(current)) remaining--;
      if (++guard > CalendarEngine.MAX_DAYS) break;
    }
    return current;
  }

  private offsetOfNthWorkday(from: Date, remaining: number, dir: 1 | -1): number | null {
    if (!Number.isFinite(remaining)) return null;
    if (remaining <= 0) return 0;
    const need = Math.ceil(remaining);
    const fromIdx = utcDayIndex(from.getTime());
    if (!Number.isFinite(fromIdx)) return null;
    const countWithin = (d: number): number => {
      const a = dir === 1 ? fromIdx + 1 : fromIdx - d;
      const b = dir === 1 ? fromIdx + d : fromIdx - 1;
      return this.countWorkWeekdays(a, b)
        - this.countHolidayWorkdaysInRange(a, b)
        + this.countWorkingExceptionsAddedInRange(a, b);
    };
    const limit = CalendarEngine.MAX_DAYS;
    let lo = 0;
    let hi = Math.max(1, Math.min(limit, Math.ceil((need * 7) / Math.max(1, this.workDaysPerWeek))));
    while (countWithin(hi) < need) {
      if (hi >= limit) return null;
      lo = hi;
      hi = Math.min(limit, hi * 2);
    }
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (countWithin(mid) >= need) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  get hoursPerDay(): number {
    return this.derivedHpd;
  }

  effectiveBandsOn(d: Date): ReadonlyArray<Readonly<{ start: number; end: number }>> {
    const dayMs = this.dayStartMsOf(d.getTime());
    return this.bandsStartingOn(dayMs).map((b) => ({
      start: (b.start - dayMs) / CalendarEngine.MS_PER_MIN,
      end: (b.end - dayMs) / CalendarEngine.MS_PER_MIN,
    }));
  }

  private computeDerivedHoursPerDay(): number {
    return modalBandHoursPerDay(this.calendar.workTime!, this.calendar.hoursPerDay);
  }

  private computeStandardWorkdayBands(): { start: number; end: number }[] {
    const byWeekday = this.calendar.workTime!.byWeekday;
    const sums: { wd: 1 | 2 | 3 | 4 | 5 | 6 | 7; minutes: number }[] = [];
    for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
      if (!this.workDayMask[wd]) continue;
      const bands = byWeekday[wd];
      if (!bands || bands.length === 0) continue;
      sums.push({ wd, minutes: bands.reduce((s, b) => s + (b.end - b.start), 0) });
    }
    if (sums.length > 0) {
      const bestMinutes = modalHighest(sums.map((s) => s.minutes));
      const match = sums.find((s) => s.minutes === bestMinutes)!;
      return byWeekday[match.wd]!;
    }
    for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
      const bands = byWeekday[wd];
      if (bands && bands.length > 0) return bands;
    }
    return [];
  }

  typicalWorkdayBands(): ReadonlyArray<Readonly<{ start: number; end: number }>> {
    return this.standardWorkdayBands.map((b) => ({ start: b.start, end: b.end }));
  }

  private dayStartMsOf(ms: number): number {
    return utcDayIndex(ms) * MS_PER_DAY;
  }

  private bandsStartingOn(dayMs: number): BandInterval[] {
    const cache = this.bandCache;
    const hit = cache.days.get(dayMs);
    if (hit) return hit;
    cache.fills++;
    const result = this.materializeDayBands(dayMs,
      this.sourceBandsOn(dayMs), this.sourceBandsOn(dayMs - MS_PER_DAY));
    cache.days.set(dayMs, result);
    return result;
  }

  private materializeDayBands(
    dayMs: number,
    bands: WorkTimeBands['byWeekday'][1],
    previousBands: WorkTimeBands['byWeekday'][1],
  ): BandInterval[] {
    const previousDay = dayMs - MS_PER_DAY;
    let coveredUntil = dayMs;
    for (const band of previousBands) {
      coveredUntil = Math.max(coveredUntil, previousDay + band.end * CalendarEngine.MS_PER_MIN);
    }
    const result: BandInterval[] = [];
    for (const band of bands) {
      const start = Math.max(coveredUntil, dayMs + band.start * CalendarEngine.MS_PER_MIN);
      const end = dayMs + band.end * CalendarEngine.MS_PER_MIN;
      if (end > start) result.push({ start, end });
    }
    return result;
  }

  private sourceBandsOn(dayMs: number): { start: number; end: number }[] {
    const d = new Date(dayMs);
    const dayIdx = utcDayIndex(dayMs);
    const wd = isoDayOfWeek(d) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    let bands: { start: number; end: number }[];
    if (this.workingExceptionDaySet.has(dayIdx)) {
      const override = this.workingExceptionBandsByDay.get(dayIdx);
      const ownWeekdayBands = this.calendar.workTime!.byWeekday[wd];
      bands = override ?? (ownWeekdayBands && ownWeekdayBands.length > 0 ? ownWeekdayBands : this.standardWorkdayBands);
    } else if (this.holidaySet.has(formatDate(d))) {
      bands = [];
    } else {
      bands = this.calendar.workTime!.byWeekday[wd] ?? [];
    }
    return bands;
  }

  private findContaining(tMs: number, leftOpen: boolean): BandInterval | null {
    const day0 = this.dayStartMsOf(tMs);
    for (let k = -2; k <= 0; k++) {
      const dayMs = day0 + k * MS_PER_DAY;
      for (const band of this.bandsStartingOn(dayMs)) {
        const inside = leftOpen
          ? band.start < tMs && tMs <= band.end
          : band.start <= tMs && tMs < band.end;
        if (inside) return band;
      }
    }
    return null;
  }

  private nextBandStartStrictAfter(tMs: number): number {
    let dayMs = this.dayStartMsOf(tMs);
    let scan = 0;
    while (scan <= CalendarEngine.MAX_SCAN) {
      for (const band of this.bandsStartingOn(dayMs)) {
        if (band.start > tMs) return band.start;
      }
      dayMs += MS_PER_DAY;
      scan++;
    }
    return tMs;
  }

  private prevBandEndBound(tMs: number, strict: boolean): number | null {
    let best = Number.NEGATIVE_INFINITY;
    let dayMs = this.dayStartMsOf(tMs);
    let scan = 0;
    const span = 2880 * CalendarEngine.MS_PER_MIN;
    while (scan <= CalendarEngine.MAX_SCAN) {
      if (best !== Number.NEGATIVE_INFINITY && dayMs + span <= best) break;
      for (const band of this.bandsStartingOn(dayMs)) {
        const ok = strict ? band.end < tMs : band.end <= tMs;
        if (ok && band.end > best) best = band.end;
      }
      dayMs -= MS_PER_DAY;
      scan++;
    }
    return best === Number.NEGATIVE_INFINITY ? null : best;
  }

  isWorkInstant(t: Date): boolean {
    return this.findContaining(t.getTime(), false) !== null;
  }

  isFinishRangeWithinWorkBand(from: Date, through: Date): boolean {
    const band = this.findContaining(from.getTime(), true);
    return band !== null && band.end >= through.getTime();
  }

  nextWorkInstant(t: Date): Date {
    const tMs = t.getTime();
    if (this.findContaining(tMs, false)) return new Date(tMs);
    return new Date(this.nextBandStartStrictAfter(tMs));
  }

  nextWorkInstantAfter(t: Date): Date {
    return new Date(this.nextBandStartStrictAfter(t.getTime()));
  }

  prevWorkInstant(t: Date): Date {
    const tMs = t.getTime();
    if (this.findContaining(tMs, true)) return new Date(tMs);
    return new Date(this.prevBandEndBound(tMs, false) ?? tMs);
  }

  prevWorkInstantOrNull(t: Date): Date | null {
    const tMs = t.getTime();
    if (this.findContaining(tMs, true)) return new Date(tMs);
    const found = this.prevBandEndBound(tMs, false);
    return found === null ? null : new Date(found);
  }

  prevWorkInstantBefore(t: Date): Date {
    const tMs = t.getTime();
    return new Date(this.prevBandEndBound(tMs, true) ?? tMs);
  }

  addWorkMinutes(startInstant: Date, minutes: number): Date {
    return this.addPhysicalWorkMinutes(startInstant, minutes);
  }

  static walkMs(minutes: number): number {
    return Math.round(Math.min(minutes, CalendarEngine.MAX_MINUTES) * CalendarEngine.MS_PER_MIN);
  }

  private addPhysicalWorkMinutes(startInstant: Date, minutes: number): Date {
    let remaining = CalendarEngine.walkMs(minutes);
    if (minutes <= 0 || remaining === 0) return new Date(startInstant.getTime());
    let curMs = this.nextWorkInstant(startInstant).getTime();
    let steps = 0;
    while (remaining > 0) {
      const band = this.findContaining(curMs, false);
      if (!band) break;
      const availMs = band.end - curMs;
      if (remaining <= availMs) {
        curMs += remaining;
        remaining = 0;
      } else {
        remaining -= availMs;
        curMs = this.nextWorkInstant(new Date(band.end)).getTime();
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return new Date(curMs);
  }

  subtractWorkMinutes(endInstant: Date, minutes: number): Date {
    return this.subtractPhysicalWorkMinutes(endInstant, minutes);
  }

  private subtractPhysicalWorkMinutes(endInstant: Date, minutes: number): Date {
    let remaining = CalendarEngine.walkMs(minutes);
    if (minutes <= 0 || remaining === 0) return new Date(endInstant.getTime());
    let curMs = this.prevWorkInstant(endInstant).getTime();
    let steps = 0;
    while (remaining > 0) {
      const band = this.findContaining(curMs, true);
      if (!band) break;
      const availMs = curMs - band.start;
      if (remaining <= availMs) {
        curMs -= remaining;
        remaining = 0;
      } else {
        remaining -= availMs;
        curMs = this.prevWorkInstant(new Date(band.start)).getTime();
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return new Date(curMs);
  }

  workMinutesBetween(a: Date, b: Date): number {
    return this.physicalWorkMinutesBetween(a, b);
  }

  private physicalWorkMinutesBetween(a: Date, b: Date): number {
    const aMs = a.getTime();
    const bMs = b.getTime();
    if (aMs === bMs) return 0;
    const sign = bMs > aMs ? 1 : -1;
    const lo = Math.min(aMs, bMs);
    const hi = Math.max(aMs, bMs);
    const firstDayMs = this.dayStartMsOf(lo) - 2 * MS_PER_DAY;
    const fullFrom = Math.ceil(lo / MS_PER_DAY);
    const fullTo = Math.floor(hi / MS_PER_DAY) - 2;
    const spanDays = (hi - firstDayMs) / MS_PER_DAY;
    if (fullTo - fullFrom >= CalendarEngine.PREFIX_MIN_DAYS && spanDays <= CalendarEngine.MAX_DAYS) {
      return sign * (this.bandMinutesOnDays(firstDayMs, fullFrom * MS_PER_DAY, lo, hi)
        + this.fullDayMinutes(fullFrom, fullTo + 1)
        + this.bandMinutesOnDays((fullTo + 1) * MS_PER_DAY, hi, lo, hi));
    }
    let total = 0;
    let dayMs = firstDayMs;
    let steps = 0;
    while (dayMs < hi) {
      for (const band of this.bandsStartingOn(dayMs)) {
        const s = Math.max(band.start, lo);
        const e = Math.min(band.end, hi);
        if (e > s) total += (e - s) / CalendarEngine.MS_PER_MIN;
      }
      dayMs += MS_PER_DAY;
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return sign * total;
  }

  private static readonly PREFIX_MIN_DAYS = 14;

  private bandMinutesOnDays(fromDayMs: number, toDayMs: number, lo: number, hi: number): number {
    let total = 0;
    for (let dayMs = fromDayMs; dayMs < toDayMs && dayMs < hi; dayMs += MS_PER_DAY) {
      for (const band of this.bandsStartingOn(dayMs)) {
        const s = Math.max(band.start, lo);
        const e = Math.min(band.end, hi);
        if (e > s) total += (e - s) / CalendarEngine.MS_PER_MIN;
      }
    }
    return total;
  }

  private fullDayMinutes(fromDay: number, toDay: number): number {
    const cache = this.bandCache;
    let prefix = cache.minutePrefix;
    if (!prefix || fromDay < prefix.firstDay || toDay > prefix.firstDay + prefix.cum.length - 1) {
      const pad = Math.max(366, prefix ? prefix.cum.length : 0);
      const first = Math.min(fromDay, prefix ? prefix.firstDay : fromDay) - pad;
      const last = Math.max(toDay, prefix ? prefix.firstDay + prefix.cum.length - 1 : toDay) + pad;
      const cum = new Array<number>(last - first + 1);
      cum[0] = 0;
      for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + this.measureDay((first + i - 1) * MS_PER_DAY).minutes;
      prefix = { firstDay: first, cum };
      cache.minutePrefix = prefix;
    }
    return prefix.cum[toDay - prefix.firstDay] - prefix.cum[fromDay - prefix.firstDay];
  }

  addWorkingMinutesSigned(t: Date, m: number): Date {
    const current = this.nextWorkInstant(t);
    if (m === 0) return current;
    return m > 0 ? this.addWorkMinutes(current, m) : this.subtractWorkMinutes(current, -m);
  }

  private measureDay(dayMs: number): MeasureDay {
    const cache = this.bandCache;
    const hit = cache.measure.get(dayMs);
    if (hit) return hit;
    const bands = [...this.bandsStartingOn(dayMs)]
      .filter((b) => b.end > b.start)
      .sort((a, b) => a.start - b.start);
    let minutes = 0;
    for (const b of bands) minutes += (b.end - b.start) / CalendarEngine.MS_PER_MIN;
    const day: MeasureDay = { bands, minutes };
    cache.measure.set(dayMs, day);
    return day;
  }

  private measureOffset(day: MeasureDay, tMs: number): number {
    let offset = 0;
    for (const b of day.bands) {
      if (tMs <= b.start) break;
      offset += (Math.min(b.end, tMs) - b.start) / CalendarEngine.MS_PER_MIN;
    }
    return offset;
  }

  private measureFrom(t: Date): MeasurePosition | null {
    const s = this.nextWorkInstant(t).getTime();
    const band = this.findContaining(s, false);
    if (!band) return null;
    const dayMs = this.dayStartMsOf(band.start);
    const day = this.measureDay(dayMs);
    if (!(day.minutes > 0)) return null;
    return { dayMs, offset: this.measureOffset(day, s), day };
  }

  private measureTo(t: Date): MeasurePosition | null {
    const e = this.prevWorkInstantOrNull(t);
    if (!e) return null;
    const eMs = e.getTime();
    const band = this.findContaining(eMs, true);
    if (!band) return null;
    const dayMs = this.dayStartMsOf(band.start);
    const day = this.measureDay(dayMs);
    if (!(day.minutes > 0)) return null;
    return { dayMs, offset: this.measureOffset(day, eMs), day };
  }

  private measureLikeWorkDays(): boolean {
    if (this.measureLikeWorkDaysCache !== undefined) return this.measureLikeWorkDaysCache;
    const byWeekday = this.calendar.workTime?.byWeekday;
    let ok = byWeekday !== undefined;
    for (let wd = 1; ok && wd <= 7; wd++) {
      const previousWd = (wd === 1 ? 7 : wd - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      const bands = this.materializeDayBands(0,
        byWeekday![wd as 1 | 2 | 3 | 4 | 5 | 6 | 7] ?? [], byWeekday![previousWd] ?? []);
      if ((bands.length > 0) !== this.workDayMask[wd]) ok = false;
    }
    if (ok) {
      for (const idx of this.workingExceptionDaySet) {
        for (const affected of [idx, idx + 1]) {
          const day = new Date(affected * MS_PER_DAY);
          if ((this.measureDay(day.getTime()).minutes > 0) !== this.isWorkDay(day)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
    }
    this.measureLikeWorkDaysCache = ok;
    return ok;
  }
  private measureLikeWorkDaysCache?: boolean;

  private nthMeasureWorkday(dayMs: number, n: number, dir: 1 | -1): number | null {
    if (n <= 0) return dayMs;
    if (this.measureLikeWorkDays()) {
      const offset = this.offsetOfNthWorkday(new Date(dayMs), n, dir);
      if (offset !== null) return dayMs + dir * offset * MS_PER_DAY;
    }
    let d = dayMs;
    let left = n;
    let sinceWorkday = 0;
    for (let steps = 0; left > 0; steps++) {
      if (steps > CalendarEngine.MAX_DAYS || sinceWorkday > CalendarEngine.MAX_SCAN) return null;
      d += dir * MS_PER_DAY;
      if (this.measureDay(d).minutes > 0) {
        left--;
        sinceWorkday = 0;
      } else {
        sinceWorkday++;
      }
    }
    return d;
  }

  private measureWorkdaysInRange(aMs: number, bMs: number): number {
    if (bMs <= aMs) return 0;
    if (this.measureLikeWorkDays()) return this.workDaysBetween(new Date(aMs), new Date(bMs - MS_PER_DAY));
    let count = 0;
    for (let d = aMs, steps = 0; d < bMs && steps <= CalendarEngine.MAX_DAYS; d += MS_PER_DAY, steps++) {
      if (this.measureDay(d).minutes > 0) count++;
    }
    return count;
  }

  private measureMoment(day: MeasureDay, offset: number, side: 'start' | 'end'): number {
    let left = offset;
    for (const b of day.bands) {
      const len = (b.end - b.start) / CalendarEngine.MS_PER_MIN;
      if (side === 'end' ? left <= len : left < len) return b.start + left * CalendarEngine.MS_PER_MIN;
      left -= len;
    }
    const last = day.bands[day.bands.length - 1];
    return side === 'end' ? last.end : this.nextWorkInstant(new Date(last.end)).getTime();
  }

  addMeasuredWorkdays(start: Date, days: number): Date {
    return this.addMeasuredWorkdaysChecked(start, days).date;
  }

  addMeasuredWorkdaysChecked(start: Date, days: number): { date: Date; capped: boolean } {
    if (!(days > 0) || !Number.isFinite(days)) return { date: new Date(start.getTime()), capped: false };
    const from = this.measureFrom(start);
    if (!from) return { date: new Date(start.getTime()), capped: true };
    const firstLeft = (from.day.minutes - from.offset) / from.day.minutes;
    if (days <= firstLeft + MEASURE_EPS) {
      const offset = Math.min(from.day.minutes, from.offset + Math.round(days * from.day.minutes));
      if (offset <= from.offset) return { date: new Date(start.getTime()), capped: false };
      return { date: new Date(this.measureMoment(from.day, offset, 'end')), capped: false };
    }
    const rest = days - firstLeft;
    const n = Math.max(1, Math.ceil(rest - MEASURE_EPS));
    const dayMs = this.nthMeasureWorkday(from.dayMs, n, 1);
    if (dayMs === null) return { date: new Date(start.getTime()), capped: true };
    const day = this.measureDay(dayMs);
    const minutes = Math.round(Math.min(1, rest - (n - 1)) * day.minutes);
    if (minutes <= 0) return { date: this.prevWorkInstant(new Date(day.bands[0].start)), capped: false };
    return { date: new Date(this.measureMoment(day, minutes, 'end')), capped: false };
  }

  subtractMeasuredWorkdays(end: Date, days: number): Date {
    if (!(days > 0) || !Number.isFinite(days)) return new Date(end.getTime());
    const to = this.measureTo(end);
    if (!to) return new Date(end.getTime());
    const lastDone = to.offset / to.day.minutes;
    if (days <= lastDone + MEASURE_EPS) {
      const offset = Math.max(0, to.offset - Math.round(days * to.day.minutes));
      if (offset >= to.offset) return new Date(end.getTime());
      return new Date(this.measureMoment(to.day, offset, 'start'));
    }
    const rest = days - lastDone;
    const n = Math.max(1, Math.ceil(rest - MEASURE_EPS));
    const dayMs = this.nthMeasureWorkday(to.dayMs, n, -1);
    if (dayMs === null) return new Date(end.getTime());
    const day = this.measureDay(dayMs);
    const minutes = Math.round(Math.min(1, rest - (n - 1)) * day.minutes);
    return new Date(this.measureMoment(day, day.minutes - minutes, 'start'));
  }

  measuredWorkdayEnd(t: Date): Date {
    const from = this.measureFrom(t);
    if (!from) return new Date(t.getTime());
    return new Date(this.measureMoment(from.day, from.day.minutes, 'end'));
  }

  measuredWorkdaysBetween(a: Date, b: Date): number {
    const aMs = a.getTime();
    const bMs = b.getTime();
    if (aMs === bMs) return 0;
    if (bMs < aMs) return -this.measuredWorkdaysBetween(b, a);
    const pa = this.measureFrom(a);
    const pb = this.measureFrom(b);
    if (!pa || !pb) return this.hoursPerDay > 0 ? this.workMinutesBetween(a, b) / (this.hoursPerDay * 60) : 0;
    return this.measureWorkdaysInRange(pa.dayMs, pb.dayMs)
      + pb.offset / pb.day.minutes - pa.offset / pa.day.minutes;
  }

  workIntervalsBetween(from: Date, to: Date): { start: Date; end: Date }[] {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    if (!(toMs > fromMs)) return [];
    const out: { start: Date; end: Date }[] = [];
    const lastDay = this.dayStartMsOf(toMs);
    let dayMs = this.dayStartMsOf(fromMs) - MS_PER_DAY;
    let scan = 0;
    while (dayMs <= lastDay && scan <= CalendarEngine.MAX_DAYS) {
      for (const band of this.bandsStartingOn(dayMs)) {
        const s = Math.max(band.start, fromMs);
        const e = Math.min(band.end, toMs);
        if (e > s) out.push({ start: new Date(s), end: new Date(e) });
      }
      dayMs += MS_PER_DAY;
      scan++;
    }
    out.sort((a, b) => a.start.getTime() - b.start.getTime());
    return out;
  }

  materializationCount(): number {
    return this.bandCache.fills;
  }
  bandCacheRef(): unknown {
    return this.bandCache;
  }
}
