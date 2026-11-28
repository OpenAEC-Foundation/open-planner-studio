import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { WorkCalendar } from '@/types/calendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { formatDate, formatInstant, MS_PER_DAY, parseDate, parseInstant, utcDayIndex } from '@/utils/dateUtils';

export type InstantSide = 'start' | 'end';

export type DayClock =
  | { readonly kind: 'blocks'; readonly engine: CalendarEngine; readonly calendar: WorkCalendar }
  | { readonly kind: 'elapsed' };

export const ELAPSED_CLOCK: DayClock = { kind: 'elapsed' };

export function constraintDateSide(type: string): InstantSide | null {
  if (type === 'SNET' || type === 'SNLT' || type === 'MSO') return 'start';
  if (type === 'FNET' || type === 'FNLT' || type === 'MFO') return 'end';
  return null;
}

export function blocksClock(calendar: WorkCalendar): DayClock {
  return { kind: 'blocks', engine: new CalendarEngine(calendarForEngine(calendar)), calendar };
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MS_PER_MIN = 60_000;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY_RE.test(value);
}

export function isInstant(value: string): boolean {
  return INSTANT_RE.test(value);
}

export function workdayBoundaryLabel(clock: DayClock, value: string, side: InstantSide): string {
  if (!isInstant(value)) return value;
  const day = workdayOfInstant(clock, value, side);
  const boundary = side === 'start' ? dayStartInstant(clock, day) : dayEndInstant(clock, day);
  return boundary && parseInstant(boundary).getTime() === parseInstant(value).getTime() ? day : value;
}

function minuteOfDayIso(date: string, minutes: number): string {
  const ms = parseDate(date).getTime() + Math.round(minutes) * MS_PER_MIN;
  return formatInstant(new Date(ms), 'hour');
}

function blocksOn(clock: Extract<DayClock, { kind: 'blocks' }>, date: string) {
  return clock.engine.effectiveBandsOn(parseDate(date));
}

function scalarMinute(calendar: WorkCalendar, which: 'start' | 'end'): number | null {
  const start = calendar.workStartHour * 60;
  const end = calendar.workEndHour * 60;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440 || start >= end) return null;
  return which === 'start' ? start : end;
}

export function dayStartInstant(clock: DayClock, date: string): string | null {
  if (!isDateOnly(date) || Number.isNaN(parseDate(date).getTime())) return null;
  if (clock.kind === 'elapsed') return `${date}T00:00`;
  const own = blocksOn(clock, date);
  if (own.length > 0) return minuteOfDayIso(date, own[0].start);
  const typical = clock.engine.typicalWorkdayBands();
  if (typical.length > 0) return minuteOfDayIso(date, typical[0].start);
  const scalar = scalarMinute(clock.calendar, 'start');
  return scalar === null ? null : minuteOfDayIso(date, scalar);
}

export function dayEndInstant(clock: DayClock, date: string): string | null {
  if (!isDateOnly(date) || Number.isNaN(parseDate(date).getTime())) return null;
  if (clock.kind === 'elapsed') return minuteOfDayIso(date, 1440);
  const own = blocksOn(clock, date);
  if (own.length > 0) return minuteOfDayIso(date, own[own.length - 1].end);
  const typical = clock.engine.typicalWorkdayBands();
  if (typical.length > 0) return minuteOfDayIso(date, typical[typical.length - 1].end);
  const scalar = scalarMinute(clock.calendar, 'end');
  return scalar === null ? null : minuteOfDayIso(date, scalar);
}

export function milestoneWorkdayOf(clock: DayClock, value: string, side: InstantSide): string {
  if (isDateOnly(value)) return value;
  if (!isInstant(value)) return '';
  const t = parseInstant(value).getTime();
  if (Number.isNaN(t)) return '';
  const plain = workdayOfInstant(clock, value, side);
  if (clock.kind === 'blocks') {
    if (plain && blocksOn(clock, plain).length > 0) {
      const start = dayStartInstant(clock, plain);
      const end = dayEndInstant(clock, plain);
      if (start && end && parseInstant(start).getTime() <= t && t <= parseInstant(end).getTime()) return plain;
    }
    const day0 = utcDayIndex(t) * MS_PER_DAY;
    const candidates: { date: string; rank: number; own: boolean }[] = [];
    let insideOwn = false;
    for (let k = 0; k >= -2; k--) {
      const date = formatDate(new Date(day0 + k * MS_PER_DAY));
      const start = dayStartInstant(clock, date);
      const end = dayEndInstant(clock, date);
      if (!start || !end) continue;
      const s = parseInstant(start).getTime();
      const e = parseInstant(end).getTime();
      if (t < s || t > e) continue;
      const own = blocksOn(clock, date).length > 0;
      if (own && s < t && t < e) insideOwn = true;
      const ownEdge = side === 'start' ? t === s : t === e;
      const otherEdge = side === 'start' ? t === e : t === s;
      candidates.push({ date, rank: (ownEdge ? 0 : otherEdge ? 2 : 4) + (own ? 0 : 1), own });
    }
    let best: { date: string; rank: number } | null = null;
    for (const c of candidates) {
      if (insideOwn && !c.own) continue;
      if (!best || c.rank < best.rank) best = c;
    }
    if (best) return best.date;
  }
  return plain;
}

export function workdayEdgeAt(clock: DayClock, day: string, value: string): InstantSide | null {
  if (!isInstant(value)) return null;
  const t = parseInstant(value).getTime();
  const start = dayStartInstant(clock, day);
  const end = dayEndInstant(clock, day);
  if (end && parseInstant(end).getTime() === t) return 'end';
  if (start && parseInstant(start).getTime() === t) return 'start';
  return null;
}

export function milestoneMomentOn(clock: DayClock, planned: string, date: string, side: InstantSide): string | null {
  if (!isInstant(planned) || !isDateOnly(date)) return null;
  const at = parseInstant(planned).getTime();
  const typedMs = parseDate(date).getTime();
  const plannedDay = milestoneWorkdayOf(clock, planned, side);
  if (Number.isNaN(at) || Number.isNaN(typedMs) || !plannedDay) return null;
  const start = dayStartInstant(clock, date);
  const end = dayEndInstant(clock, date);
  const edge = workdayEdgeAt(clock, plannedDay, planned);
  let candidates: (string | null)[];
  if (edge) {
    candidates = edge === 'end' ? [end, start] : [start, end];
  } else {
    const moment = formatInstant(new Date(typedMs + (at - parseDate(plannedDay).getTime())), 'hour');
    const t = parseInstant(moment).getTime();
    const distance = (edgeAt: string | null) => edgeAt ? Math.abs(parseInstant(edgeAt).getTime() - t) : Infinity;
    const plannedStart = dayStartInstant(clock, plannedDay);
    const plannedEnd = dayEndInstant(clock, plannedDay);
    const inside = !!plannedStart && !!plannedEnd
      && parseInstant(plannedStart).getTime() < at && at < parseInstant(plannedEnd).getTime();
    if (inside && end && t > parseInstant(end).getTime()) candidates = [end, start];
    else if (inside && start && t < parseInstant(start).getTime()) candidates = [start, end];
    else if (!inside && plannedStart && plannedEnd) {
      candidates = at >= parseInstant(plannedEnd).getTime() ? [end, start] : [start, end];
    } else candidates = [moment, ...(distance(end) < distance(start) ? [end, start] : [start, end])];
  }
  return candidates.find(c => c !== null && milestoneWorkdayOf(clock, c, side) === date)
    ?? candidates.find(c => c !== null) ?? null;
}

export function workdayOfInstant(clock: DayClock, value: string, side: InstantSide): string {
  if (isDateOnly(value)) return value;
  if (!isInstant(value)) return '';
  const t = parseInstant(value).getTime();
  if (Number.isNaN(t)) return '';
  return formatDate(workdayDateOfInstant(clock.kind === 'blocks' ? clock.engine : null, new Date(t), side));
}

export function workdayDateOfInstant(
  engine: Pick<CalendarEngine, 'effectiveBandsOn'> | null,
  instant: Date,
  side: InstantSide,
): Date {
  const t = instant.getTime();
  const day0 = utcDayIndex(t) * MS_PER_DAY;
  if (engine) {
    for (let k = 0; k >= -2; k--) {
      const dayMs = day0 + k * MS_PER_DAY;
      for (const band of engine.effectiveBandsOn(new Date(dayMs))) {
        const start = dayMs + band.start * MS_PER_MIN;
        const end = dayMs + band.end * MS_PER_MIN;
        const inside = side === 'start' ? start <= t && t < end : start < t && t <= end;
        if (inside) return new Date(dayMs);
      }
    }
  }
  if (side === 'end' && t === day0) return new Date(day0 - MS_PER_DAY);
  return new Date(day0);
}
