import { createAppStoreContext } from '@/state/appStoreFactory';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { workdayDateOfInstant } from '@/engine/calendar/workdayRules';
import { formatInstant, parseInstant, MS_PER_DAY } from '@/utils/dateUtils';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean, detail = '') => {
  checks++;
  if (!cond) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
};

const MS_PER_MIN = 60_000;
const fmt = (d: Date) => formatInstant(d, 'hour');
const at = (iso: string) => parseInstant(iso);

type Band = { start: number; end: number };
const hm = (h: number, m = 0) => h * 60 + m;
const week = (perDay: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, Band[]>>): WorkTimeBands => ({
  byWeekday: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], ...perDay },
});
const cal = (id: string, workDays: number[], workTime: WorkTimeBands | undefined, extra: Partial<WorkCalendar> = {}): WorkCalendar => ({
  id, name: id, description: '', workDays, workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  ...(workTime ? { workTime } : {}), ...extra,
});
const DAY8: Band[] = [{ start: hm(7), end: hm(12) }, { start: hm(13), end: hm(16) }];
const FRI6: Band[] = [{ start: hm(7), end: hm(12) }, { start: hm(13), end: hm(14) }];

const VOORBEELDWEEK = cal('voorbeeldweek', [1, 2, 3, 4, 5], week({ 1: DAY8, 2: DAY8, 3: DAY8, 4: DAY8, 5: FRI6 }));
const STANDAARD = cal('standaard', [1, 2, 3, 4, 5], undefined);
const FEESTDAG = cal('feestdag', [1, 2, 3, 4, 5], undefined, {
  holidays: [{ name: 'wo', startDate: '2026-06-03', endDate: '2026-06-03' }],
});
const UITZONDERING = cal('uitzondering', [1, 2, 3, 4, 5], week({ 1: DAY8, 2: DAY8, 3: DAY8, 4: DAY8, 5: DAY8 }), {
  workingExceptions: [{ name: 'za', startDate: '2026-06-06', endDate: '2026-06-06', bands: [{ start: hm(7), end: hm(11) }] }],
});
const NACHT = cal('nacht', [1, 2, 3, 4, 5], week({
  1: [{ start: hm(22), end: hm(30) }], 2: [{ start: hm(22), end: hm(30) }], 3: [{ start: hm(22), end: hm(30) }],
  4: [{ start: hm(22), end: hm(30) }], 5: [{ start: hm(22), end: hm(30) }],
}), { workStartHour: 22, workEndHour: 6 });
const ETMAAL = cal('etmaal', [1, 2, 3, 4, 5, 6, 7], week({
  1: [{ start: 0, end: 1440 }], 2: [{ start: 0, end: 1440 }], 3: [{ start: 0, end: 1440 }], 4: [{ start: 0, end: 1440 }],
  5: [{ start: 0, end: 1440 }], 6: [{ start: 0, end: 1440 }], 7: [{ start: 0, end: 1440 }],
}), { workStartHour: 0, workEndHour: 24, hoursPerDay: 24 });
const ZATERDAG1U = cal('zaterdag-1u', [1, 2, 3, 4, 5], week({ 1: DAY8, 2: DAY8, 3: DAY8, 4: DAY8, 5: DAY8 }), {
  workingExceptions: [{ name: 'za', startDate: '2026-06-06', endDate: '2026-06-06', bands: [{ start: hm(7), end: hm(8) }] }],
});
const TEGENSTRIJDIG = cal('tegenstrijdig', [1, 2, 3, 4, 5], week({ 1: DAY8, 2: DAY8, 3: DAY8, 4: DAY8, 5: DAY8, 6: [{ start: hm(8), end: hm(10) }] }));

const ALL = [VOORBEELDWEEK, STANDAARD, FEESTDAG, UITZONDERING, NACHT, ETMAAL, ZATERDAG1U, TEGENSTRIJDIG];
const engines = new Map(ALL.map((c) => [c.id, new CalendarEngine(c)]));
const E = (c: WorkCalendar) => engines.get(c.id)!;

const fwd = (c: WorkCalendar, from: string, days: number, want: string) =>
  eq(`${c.id}: ${from} + ${days} d`, fmt(E(c).addMeasuredWorkdays(at(from), days)), want);
const back = (c: WorkCalendar, from: string, days: number, want: string) =>
  eq(`${c.id}: ${from} − ${days} d`, fmt(E(c).subtractMeasuredWorkdays(at(from), days)), want);
const dist = (c: WorkCalendar, a: string, b: string, want: number) => {
  const got = E(c).measuredWorkdaysBetween(at(a), at(b));
  ok(`${c.id}: afstand ${a} → ${b} = ${want}`, Math.abs(got - want) < 1e-9, `kreeg ${got}`);
  const rev = E(c).measuredWorkdaysBetween(at(b), at(a));
  ok(`${c.id}: afstand ${b} → ${a} = ${-want}`, Math.abs(rev + want) < 1e-9, `kreeg ${rev}`);
};

fwd(VOORBEELDWEEK, '2026-06-01T07:00', 5, '2026-06-05T14:00');
fwd(VOORBEELDWEEK, '2026-06-02T11:00', 3, '2026-06-05T10:00');
fwd(VOORBEELDWEEK, '2026-06-03T07:00', 3, '2026-06-05T14:00');
back(VOORBEELDWEEK, '2026-06-05T14:00', 5, '2026-06-01T07:00');
back(VOORBEELDWEEK, '2026-06-05T10:00', 3, '2026-06-02T11:00');
back(VOORBEELDWEEK, '2026-06-05T14:00', 3, '2026-06-03T07:00');
dist(VOORBEELDWEEK, '2026-06-01T07:00', '2026-06-05T14:00', 5);
dist(VOORBEELDWEEK, '2026-06-02T11:00', '2026-06-05T10:00', 3);
fwd(VOORBEELDWEEK, '2026-06-04T16:00', 0.5, '2026-06-05T10:00');
fwd(VOORBEELDWEEK, '2026-06-05T07:00', 1, '2026-06-05T14:00');
fwd(VOORBEELDWEEK, '2026-06-01T07:00', 5 / 8, '2026-06-01T12:00');
back(VOORBEELDWEEK, '2026-06-01T16:00', 3 / 8, '2026-06-01T13:00');

fwd(STANDAARD, '2026-06-01T07:00', 2.5, '2026-06-03T11:00');
fwd(STANDAARD, '2026-06-03T07:00', 3.4, '2026-06-08T10:12');
fwd(STANDAARD, '2026-06-03T07:00', 3, '2026-06-05T16:00');
back(STANDAARD, '2026-06-08T10:12', 3.4, '2026-06-03T07:00');
back(STANDAARD, '2026-06-03T11:00', 2.5, '2026-06-01T07:00');
dist(STANDAARD, '2026-06-03T07:00', '2026-06-08T10:12', 3.4);
fwd(STANDAARD, '2026-06-01T16:00', 1, '2026-06-02T16:00');
fwd(STANDAARD, '2026-06-01T12:00', 0.5, '2026-06-02T08:00');
dist(STANDAARD, '2026-06-05T16:00', '2026-06-08T07:00', 0);
dist(STANDAARD, '2026-06-06T10:00', '2026-06-08T07:00', 0);
dist(STANDAARD, '2026-06-05T16:00', '2026-06-08T11:00', 0.5);
eq('standaard: + 0 d', fmt(E(STANDAARD).addMeasuredWorkdays(at('2026-06-01T09:30'), 0)), '2026-06-01T09:30');
eq('standaard: − 0 d', fmt(E(STANDAARD).subtractMeasuredWorkdays(at('2026-06-01T09:30'), 0)), '2026-06-01T09:30');

fwd(FEESTDAG, '2026-06-01T07:00', 3, '2026-06-04T16:00');
back(FEESTDAG, '2026-06-04T16:00', 3, '2026-06-01T07:00');
dist(FEESTDAG, '2026-06-02T11:00', '2026-06-04T11:00', 1);

fwd(UITZONDERING, '2026-06-05T07:00', 2, '2026-06-06T11:00');
fwd(UITZONDERING, '2026-06-05T07:00', 1.5, '2026-06-06T09:00');
back(UITZONDERING, '2026-06-06T11:00', 2, '2026-06-05T07:00');
dist(UITZONDERING, '2026-06-05T07:00', '2026-06-08T11:00', 2.5);

fwd(NACHT, '2026-06-02T22:00', 1, '2026-06-03T06:00');
fwd(NACHT, '2026-06-02T22:00', 1.5, '2026-06-04T02:00');
back(NACHT, '2026-06-04T02:00', 1.5, '2026-06-02T22:00');
dist(NACHT, '2026-06-02T22:00', '2026-06-03T06:00', 1);
dist(NACHT, '2026-06-03T02:00', '2026-06-04T02:00', 1);

fwd(ETMAAL, '2026-06-01T00:00', 1, '2026-06-02T00:00');
fwd(ETMAAL, '2026-06-01T12:00', 1, '2026-06-02T12:00');
back(ETMAAL, '2026-06-02T00:00', 1, '2026-06-01T00:00');

{
  const e = E(ZATERDAG1U);
  const end = e.addMeasuredWorkdays(at('2026-06-05T07:03'), 1);
  eq('T23-voorbeeld: einde', fmt(end), '2026-06-05T16:00');
  eq('T23-voorbeeld: einde ligt 0 werkminuten van za 07:00', e.workMinutesBetween(end, at('2026-06-06T07:00')), 0);
  const backAgain = e.subtractMeasuredWorkdays(end, 1);
  eq('T23-voorbeeld: terug', fmt(backAgain), '2026-06-05T07:00');
  ok('T23-voorbeeld: verschil binnen de grens van 4,5 minuut',
    Math.abs(e.workMinutesBetween(backAgain, at('2026-06-05T07:03'))) <= 4.5);
}

function dayBands(e: CalendarEngine, dayMs: number): { start: number; end: number }[] {
  return [...e.effectiveBandsOn(new Date(dayMs))].filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
}
const dayMinutes = (bands: { start: number; end: number }[]) => bands.reduce((s, b) => s + b.end - b.start, 0);
function endMomentAt(dayMs: number, bands: { start: number; end: number }[], offset: number): number {
  let left = offset;
  for (const b of bands) {
    const len = b.end - b.start;
    if (left <= len) return dayMs + (b.start + left) * MS_PER_MIN;
    left -= len;
  }
  return dayMs + bands[bands.length - 1].end * MS_PER_MIN;
}
function referenceForward(e: CalendarEngine, start: Date, days: number): { end: number; endDayMinutes: number; beginDayMinutes: number } {
  const s = e.nextWorkInstant(start);
  const d0 = workdayDateOfInstant(e, s, 'start').getTime();
  const b0 = dayBands(e, d0);
  const w0 = dayMinutes(b0);
  let a = 0;
  for (const b of b0) {
    const bs = d0 + b.start * MS_PER_MIN;
    const be = d0 + b.end * MS_PER_MIN;
    if (s.getTime() <= bs) break;
    a += (Math.min(be, s.getTime()) - bs) / MS_PER_MIN;
  }
  const firstLeft = (w0 - a) / w0;
  if (days <= firstLeft + 1e-9) {
    const offset = Math.min(w0, a + Math.round(days * w0));
    return { end: offset <= a ? start.getTime() : endMomentAt(d0, b0, offset), endDayMinutes: w0, beginDayMinutes: w0 };
  }
  let rest = days - firstLeft;
  let dayMs = d0;
  for (let guard = 0; guard < 5000; guard++) {
    dayMs += MS_PER_DAY;
    const bands = dayBands(e, dayMs);
    const w = dayMinutes(bands);
    if (w === 0) continue;
    if (rest <= 1 + 1e-9) {
      const minutes = Math.round(Math.min(1, rest) * w);
      const end = minutes <= 0 ? e.prevWorkInstant(new Date(dayMs + bands[0].start * MS_PER_MIN)).getTime() : endMomentAt(dayMs, bands, minutes);
      return { end, endDayMinutes: w, beginDayMinutes: w0 };
    }
    rest -= 1;
  }
  throw new Error('referentieloper: geen einde');
}

let seed = 20261023;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const BASE = at('2026-05-25T00:00').getTime();
let samples = 0;
let worstRatio = 0;
for (const c of ALL) {
  const e = E(c);
  for (let i = 0; i < 400; i++) {
    const start = new Date(BASE + Math.floor(rnd() * 40 * 1440) * MS_PER_MIN);
    const kind = rnd();
    const days = kind < 0.2 ? 1 + Math.floor(rnd() * 15)
      : kind < 0.35 ? (1 + Math.floor(rnd() * 30)) / 2
        : kind < 0.45 ? rnd() * 0.05
          : Math.round(rnd() * 25 * 1000) / 1000 || 0.001;
    const label = `${c.id}: ${fmt(start)} + ${days} d`;
    const got = e.addMeasuredWorkdays(start, days);
    const ref = referenceForward(e, start, days);
    samples++;
    if (got.getTime() !== ref.end) {
      diffs.push(`${label}: referentie ${fmt(new Date(ref.end))}, loper ${fmt(got)}`);
      checks++;
      continue;
    }
    const startOnAxis = e.nextWorkInstant(start);
    const backAgain = e.subtractMeasuredWorkdays(got, days);
    const err = Math.abs(e.workMinutesBetween(backAgain, startOnAxis));
    const backDay = workdayDateOfInstant(e, e.nextWorkInstant(backAgain), 'start').getTime();
    const beginMinutes = Math.max(ref.beginDayMinutes, dayMinutes(dayBands(e, backDay)));
    const bound = 0.5 + 0.5 * (beginMinutes / ref.endDayMinutes) + 1e-6;
    ok(`${label}: terug binnen ${bound.toFixed(3)} min`, err <= bound, `verschil ${err} min, terug ${fmt(backAgain)}`);
    worstRatio = Math.max(worstRatio, err / bound);
    const measured = e.measuredWorkdaysBetween(startOnAxis, got);
    const distBound = 0.5 / ref.endDayMinutes + 1e-9;
    ok(`${label}: afstand ${measured} ≈ ${days}`, days < 1e-9 || Math.abs(measured - days) <= distBound || got.getTime() === start.getTime(),
      `afwijking ${Math.abs(measured - days)} d`);
  }
}

const refWorkMinutes = (e: CalendarEngine, a: number, b: number): number => {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let total = 0;
  for (let dayMs = Math.floor(lo / MS_PER_DAY) * MS_PER_DAY - 2 * MS_PER_DAY; dayMs < hi; dayMs += MS_PER_DAY) {
    for (const band of e.effectiveBandsOn(new Date(dayMs))) {
      const s = Math.max(dayMs + band.start * MS_PER_MIN, lo);
      const t = Math.min(dayMs + band.end * MS_PER_MIN, hi);
      if (t > s) total += (t - s) / MS_PER_MIN;
    }
  }
  return (b >= a ? 1 : -1) * total;
};
let spanSamples = 0;
for (const c of ALL) {
  const e = new CalendarEngine(c);
  const base = at('2026-06-01T00:00').getTime();
  const fixed: Array<[number, number]> = [
    [base + 9 * 3_600_000, base + 20 * MS_PER_DAY + 3_600_000],
    [base - 400 * MS_PER_DAY + 7 * 3_600_000, base + 300 * MS_PER_DAY],
    [base + 900 * MS_PER_DAY + 22 * 3_600_000, base + 1200 * MS_PER_DAY + 5 * 3_600_000],
  ];
  const pairs: Array<[number, number]> = [...fixed];
  for (let i = 0; i < 40; i++) {
    const a = base + Math.floor((rnd() * 1500 - 600) * 24 * 60) * MS_PER_MIN;
    const len = Math.floor(rnd() * (i % 2 === 0 ? 40 : 1100) * 24 * 60) * MS_PER_MIN;
    pairs.push(rnd() < 0.5 ? [a, a + len] : [a + len, a]);
  }
  for (const [a, b] of pairs) {
    spanSamples++;
    eq(`${c.id}: workMinutesBetween ${fmt(new Date(a))} → ${fmt(new Date(b))}`,
      e.workMinutesBetween(new Date(a), new Date(b)), refWorkMinutes(e, a, b));
  }
}
ok(`D: ${spanSamples} spannes getoetst`, spanSamples > 300);

const REGRESSION_DAY: Band[] = [{ start: hm(8), end: hm(16) }];
const REGRESSION_WEEK = week({ 1: REGRESSION_DAY, 2: REGRESSION_DAY, 3: REGRESSION_DAY, 4: REGRESSION_DAY, 5: REGRESSION_DAY });
const LONG_NIGHT: Band[] = [{ start: hm(22), end: hm(42) }];
const coveredDayCases = [
  {
    calendar: cal('nachtuitzondering bedekt dinsdag', [1, 2, 3, 4, 5], REGRESSION_WEEK, {
      workingExceptions: [{ name: 'Nachtdienst', startDate: '2026-06-01', endDate: '2026-06-01', bands: LONG_NIGHT }],
    }),
    start: '2026-06-01T22:00', nextStart: '2026-06-03T08:00', finish: '2026-06-03T16:00',
  },
  {
    calendar: cal('weekpatroon bedekt dinsdag', [1, 2, 3, 4, 5], {
      byWeekday: { ...REGRESSION_WEEK.byWeekday, 1: LONG_NIGHT },
    }),
    start: '2026-06-01T22:00', nextStart: '2026-06-03T08:00', finish: '2026-06-03T16:00',
  },
  {
    calendar: cal('zondaguitzondering bedekt maandag', [1, 2, 3, 4, 5], REGRESSION_WEEK, {
      workingExceptions: [{ name: 'Nachtdienst', startDate: '2026-06-07', endDate: '2026-06-07', bands: LONG_NIGHT }],
    }),
    start: '2026-06-07T22:00', nextStart: '2026-06-09T08:00', finish: '2026-06-09T16:00',
  },
];
function regression(label: string, run: () => unknown, want: unknown): void {
  try { eq(label, run(), want); }
  catch (error) { checks++; diffs.push(`${label}: onverwachte uitzondering ${String(error)}`); }
}
for (const c of coveredDayCases) {
  const e = new CalendarEngine(c.calendar);
  regression(`${c.calendar.id}: vooruit twee dagen`, () => fmt(e.addMeasuredWorkdays(at(c.start), 2)), c.finish);
  regression(`${c.calendar.id}: terug twee dagen`, () => fmt(e.subtractMeasuredWorkdays(at(c.finish), 2)), c.start);
  regression(`${c.calendar.id}: afstand tot volgende dag is één`, () => e.measuredWorkdaysBetween(at(c.start), at(c.nextStart)), 1);
  regression(`${c.calendar.id}: omgekeerde afstand is min één`, () => e.measuredWorkdaysBetween(at(c.nextStart), at(c.start)), -1);
  regression(`${c.calendar.id}: afstand tot einde is twee`, () => e.measuredWorkdaysBetween(at(c.start), at(c.finish)), 2);
  regression(`${c.calendar.id}: F5 berekent twee dagen zonder uitzondering`, () => {
    const { store } = createAppStoreContext();
    store.setState(s => {
      s.calendar = c.calendar;
      s.project.startDate = c.start;
      s.project.schedulingProfile = builtInProfile('ops');
    });
    const id = store.getState().addTask({ name: 'Twee dagen',
      time: { ...createDefaultTaskTime(c.start, 2), durationUnit: 'days' } });
    store.getState().runCPM();
    const result = store.getState().cpmResult;
    if (!result || result.error) throw new Error(`F5 gaf geen geldige uitkomst: ${JSON.stringify(result?.error)}`);
    const time = store.getState().tasks.find(t => t.id === id)!.time;
    return [time.earlyStart, time.earlyFinish, time.lateStart, time.lateFinish, time.totalFloatMinutes];
  }, [c.start, c.finish, c.start, c.finish, 0]);
}

if (diffs.length > 0) {
  console.log(`XX dagenmaat-lopers: ${diffs.length} afwijking(en) van ${checks} checks`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  dagenmaat-lopers: alle checks groen (${checks}; ${samples} willekeurige lopen, slechtste verhouding tot de foutgrens ${worstRatio.toFixed(3)})`);
