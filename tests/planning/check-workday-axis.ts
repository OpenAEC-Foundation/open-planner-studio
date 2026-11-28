import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate, MS_PER_DAY } from '@/utils/dateUtils';
import { buildWorkdayAxis, buildCalendarAxis } from '@/engine/renderer/workdayAxis';
import { dateToX as calendarDateToX } from '@/engine/renderer/timeAxis';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}
function close(label: string, actual: number, expected: number, tol = 1e-6): void {
  checks++;
  if (!(Math.abs(actual - expected) <= tol)) diffs.push(`${label}: kreeg ${actual}, verwacht ${expected} (Δ=${actual - expected})`);
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(`${label}: verwachte conditie was FALSE`);
}

const calendar: WorkCalendar = {
  id: 'wd-axis-fixture',
  name: 'wd-axis-fixture',
  description: 'wd-axis-fixture',
  workDays: [1, 2, 3, 4, 5],
  workStartHour: 8,
  workEndHour: 16,
  hoursPerDay: 8,
  holidays: [
    { name: 'Test-feestdag', startDate: '2026-07-08', endDate: '2026-07-08' },
    { name: 'Bouwvak', startDate: '2027-08-02', endDate: '2027-08-08' },
  ],
};
const engine = new CalendarEngine(calendar);

const WORK_DAYS = new Set(calendar.workDays);
const holidayDayIdxs = new Set<number>();
for (const h of calendar.holidays) {
  const sIdx = Math.floor(parseDate(h.startDate).getTime() / MS_PER_DAY);
  const eIdx = Math.floor(parseDate(h.endDate).getTime() / MS_PER_DAY);
  for (let d = sIdx; d <= eIdx; d++) holidayDayIdxs.add(d);
}
function isoDowRef(dayIdx: number): number {
  const jsDow = new Date(dayIdx * MS_PER_DAY).getUTCDay();
  return jsDow === 0 ? 7 : jsDow;
}
function isWorkDayRef(dayIdx: number): boolean {
  if (!WORK_DAYS.has(isoDowRef(dayIdx))) return false;
  if (holidayDayIdxs.has(dayIdx)) return false;
  return true;
}
function refWorkdayIndexOfDay(dayIdx: number): number {
  let count = 0;
  for (let d = 0; d < dayIdx; d++) if (isWorkDayRef(d)) count++;
  return count;
}
function dayIdxOf(iso: string): number {
  return Math.floor(parseDate(iso).getTime() / MS_PER_DAY);
}
function d(iso: string): Date {
  return parseDate(iso);
}

const MON06 = d('2026-07-06');
const TUE07 = d('2026-07-07');
const WED08_HOLIDAY = d('2026-07-08');
const THU09 = d('2026-07-09');
const FRI10 = d('2026-07-10');
const SAT11 = d('2026-07-11');
const SUN12 = d('2026-07-12');
const MON13 = d('2026-07-13');

const ZOOM = 22;
const TABLE_WIDTH = 300;
const SCROLL_X = 0;

const axis = buildWorkdayAxis({
  calendar: engine,
  origin: MON06,
  chartOriginX: TABLE_WIDTH,
  zoom: ZOOM,
  scrollX: SCROLL_X,
  initialPaddingDays: 5,
});

for (const [label, date] of [
  ['ma06', MON06], ['di07', TUE07], ['do09', THU09], ['vr10', FRI10], ['ma13', MON13],
] as [string, Date][]) {
  const idx = axis.dayIndexOf(date);
  eq(`refIndex ${label}`, idx, refWorkdayIndexOfDay(dayIdxOf(date.toISOString().slice(0, 10))));
  const roundTripped = axis.dateAtIndex(idx);
  eq(`round-trip ${label}`, roundTripped.getTime(), date.getTime());
}

close('dateToX(za11) == dateToX(ma13)', axis.dateToX(SAT11), axis.dateToX(MON13));
close('dateToX(zo12) == dateToX(ma13)', axis.dateToX(SUN12), axis.dateToX(MON13));
eq('dayIndexOf(za11) == dayIndexOf(ma13)', axis.dayIndexOf(SAT11), axis.dayIndexOf(MON13));
eq('dayIndexOf(zo12) == dayIndexOf(ma13)', axis.dayIndexOf(SUN12), axis.dayIndexOf(MON13));
close('dateToX(wo08-feestdag) == dateToX(do09)', axis.dateToX(WED08_HOLIDAY), axis.dateToX(THU09));
eq('dayIndexOf(wo08-feestdag) == dayIndexOf(do09)', axis.dayIndexOf(WED08_HOLIDAY), axis.dayIndexOf(THU09));
close(
  'niet-werkdag: geen sub-dag-interpolatie',
  axis.dateToX(new Date(SAT11.getTime() + 13 * 3600000)),
  axis.dateToX(SAT11),
);

eq('5-werkdagen-span ma06→ma13 == 4 (5 kolommen)', axis.daySpan(MON06, MON13), 4);
close('balkbreedte 5 werkdagen == 4*zoom', axis.dateToX(MON13) - axis.dateToX(MON06), 4 * ZOOM);

for (const [label, from, to] of [
  ['ma06→di07', MON06, TUE07],
  ['ma06→do09', MON06, THU09],
  ['ma06→vr10', MON06, FRI10],
  ['ma06→ma13', MON06, MON13],
  ['di07→vr10', TUE07, FRI10],
] as [string, Date, Date][]) {
  eq(`daySpan(${label}) == workDaysBetween-1`, axis.daySpan(from, to), engine.workDaysBetween(from, to) - 1);
}
const originIdx = axis.dayIndexOf(MON06);
for (const n of [1, 3, 5, 8, 13]) {
  const viaEngine = engine.addWorkDays(MON06, n);
  const viaAxis = axis.dateAtIndex(originIdx + (n - 1));
  eq(`addWorkDays(ma06,${n}) == axis.dateAtIndex`, viaAxis.getTime(), viaEngine.getTime());
}

const thu09Noon = new Date(THU09.getTime() + 12 * 3600000);
close('do09 12:00 == celmidden (fractie 0.5)', axis.dayIndexOf(thu09Noon), axis.dayIndexOf(THU09) + 0.5);
close('dateToX(do09 12:00) == dateToX(do09)+0.5*zoom', axis.dateToX(thu09Noon), axis.dateToX(THU09) + 0.5 * ZOOM);
const xAtNoon = axis.dateToX(thu09Noon);
close('xToDate∘dateToX(do09 12:00) inverteert', axis.xToDate(xAtNoon).getTime(), thu09Noon.getTime(), 1);

{
  const axis6 = buildWorkdayAxis({ calendar: engine, origin: MON06, chartOriginX: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X, initialPaddingDays: 5 });
  const beforeOrigin = d('2026-06-01');
  eq(
    'dayIndexOf(vóór origin) == refIndex',
    axis6.dayIndexOf(beforeOrigin),
    refWorkdayIndexOfDay(dayIdxOf('2026-06-01')),
  );
  ok('dayIndexOf(vóór origin) < dayIndexOf(origin)', axis6.dayIndexOf(beforeOrigin) < axis6.dayIndexOf(MON06));
  eq('dateAtIndex(extreem negatief) clamt op epoch', axis6.dateAtIndex(-1_000_000).getTime(), new Date(0).getTime());
}

{
  const axis7 = buildWorkdayAxis({ calendar: engine, origin: MON06, chartOriginX: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X, initialPaddingDays: 5 });
  const bouwvakStart = d('2027-08-02');
  const bouwvakEnd = d('2027-08-08');
  const dayAfterBouwvak = d('2027-08-09');
  eq(
    'lazy-groei: dayIndexOf(bouwvak-start) == refIndex',
    axis7.dayIndexOf(bouwvakStart),
    refWorkdayIndexOfDay(dayIdxOf('2027-08-02')),
  );
  close('lazy-groei: bouwvak-start/eind zelfde naad-x', axis7.dateToX(bouwvakStart), axis7.dateToX(bouwvakEnd));
  close('lazy-groei: bouwvak-naad == eerste werkdag erna', axis7.dateToX(bouwvakStart), axis7.dateToX(dayAfterBouwvak));
  const idx7 = axis7.dayIndexOf(dayAfterBouwvak);
  eq('lazy-groei: round-trip ná groei', axis7.dateAtIndex(idx7).getTime(), dayAfterBouwvak.getTime());
}

{
  const axis8 = buildWorkdayAxis({ calendar: engine, origin: MON06, chartOriginX: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X, initialPaddingDays: 5 });
  const farDayIdx = 150_000;
  const farDate = new Date(farDayIdx * MS_PER_DAY);
  eq('groei-plafond: dayIndexOf(ver-weg) == refIndex', axis8.dayIndexOf(farDate), refWorkdayIndexOfDay(farDayIdx));
  const farIdx = axis8.dayIndexOf(farDate);
  const farRoundTripped = axis8.dateAtIndex(farIdx);
  eq('groei-plafond: round-trip blijft correct', farRoundTripped.getTime(), farDate.getTime());
}

{
  const emptyCal: WorkCalendar = { ...calendar, id: 'empty', name: 'empty', workDays: [] };
  const emptyEngine = new CalendarEngine(emptyCal);
  let threw = false;
  try {
    buildWorkdayAxis({ calendar: emptyEngine, origin: MON06, chartOriginX: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X });
  } catch {
    threw = true;
  }
  ok('lege werkweek: buildWorkdayAxis gooit', threw);
}

{
  const calAxis = buildCalendarAxis({ origin: MON06, chartOriginX: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X });
  for (const [label, date] of [['ma06', MON06], ['do09', THU09], ['ma13', MON13]] as [string, Date][]) {
    eq(`CalendarAxis.dateToX(${label}) == oude dateToX`, calAxis.dateToX(date), calendarDateToX(date, MON06, TABLE_WIDTH, ZOOM, SCROLL_X));
  }
  eq('CalendarAxis.daySpan == kalenderdagen', calAxis.daySpan(MON06, MON13), 7);
}

if (diffs.length === 0) {
  console.log(`OK  workday-axis: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  workday-axis: ${diffs.length} afwijking(en) van ${checks}`);
  for (const dd of diffs.slice(0, 40)) console.log(`   - ${dd}`);
  process.exit(1);
}
