import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { solveProject } from '@/engine/scheduler/solveProject';
import { formatInstant, parseDate, parseInstant } from '@/utils/dateUtils';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import type { SequenceType } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { opsSolveInput } from './legacySolveOptions';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${String(actual)}, verwacht ${String(expected)}`);
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const ONE_BAND = [{ start: 480, end: 1020 }];
const TWO_BANDS = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];
const THREE_BANDS = [{ start: 360, end: 600 }, { start: 660, end: 840 }, { start: 900, end: 1260 }];

const BLOCK = [{ name: 'Aaneengesloten blok van 10 dagen', startDate: '2026-03-09', endDate: '2026-03-18' }];

function hourCalendar(
  id: string, workDays: number[], bands: { start: number; end: number }[],
  extra: Partial<WorkCalendar> = {},
): WorkCalendar {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as Record<
    1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]
  >;
  for (const d of workDays) byWeekday[d as 1 | 2 | 3 | 4 | 5 | 6 | 7] = bands;
  return {
    id, name: id, description: '', workDays, workStartHour: 8, workEndHour: 17,
    hoursPerDay: bands.reduce((s, b) => s + (b.end - b.start), 0) / 60,
    holidays: [...BLOCK], workTime: { byWeekday }, ...extra,
  };
}

function dayCalendar(id: string, workDays: number[]): WorkCalendar {
  return {
    id, name: id, description: '', workDays, workStartHour: 8, workEndHour: 16,
    hoursPerDay: 8, holidays: [...BLOCK],
  };
}

const WEEK_PATTERNS: { label: string; workDays: number[] }[] = [
  { label: 'ma-vr', workDays: [1, 2, 3, 4, 5] },
  { label: 'ma-do+za+zo', workDays: [1, 2, 3, 4, 6, 7] },
];

const HOUR_SHAPES: { label: string; bands: { start: number; end: number }[] }[] = [
  { label: '1 band', bands: ONE_BAND },
  { label: '2 banden', bands: TWO_BANDS },
  { label: '3 banden', bands: THREE_BANDS },
];

const SWEEP_FROM = Date.UTC(2026, 1, 16);
const SWEEP_TO = Date.UTC(2026, 3, 20);
const HALF_HOUR_MS = 1_800_000;
const DAY_MS = 86_400_000;
const SPANS = [1, 2, 3, 5, 7, 10, 13, 20];

for (const shape of HOUR_SHAPES) {
  for (const week of WEEK_PATTERNS) {
    const label = `A uur ${shape.label} ${week.label}`;
    const eng = new CalendarEngine(hourCalendar(`h-${shape.label}-${week.label}`, week.workDays, shape.bands));
    const unit = shape.bands.reduce((s, b) => s + (b.end - b.start), 0);
    let addSub = 0; let subAdd = 0; let spanFwd = 0; let spanBack = 0; let sampled = 0;
    let firstAddSub = ''; let firstSubAdd = '';
    for (let ms = SWEEP_FROM; ms < SWEEP_TO; ms += HALF_HOUR_MS) {
      const t = new Date(ms);
      if (!eng.isWorkInstant(t)) continue;
      sampled++;
      for (const n of SPANS) {
        const minutes = n * unit;
        const forward = eng.addWorkMinutes(t, minutes);
        const backAgain = eng.subtractWorkMinutes(forward, minutes);
        if (backAgain.getTime() !== t.getTime() && eng.workMinutesBetween(backAgain, t) !== 0) {
          addSub++;
          if (!firstAddSub) {
            firstAddSub = `${formatInstant(t, 'hour')} +${n}d=${formatInstant(forward, 'hour')} `
              + `-${n}d=${formatInstant(backAgain, 'hour')}`;
          }
        }
        const backward = eng.subtractWorkMinutes(t, minutes);
        const forwardAgain = eng.addWorkMinutes(backward, minutes);
        if (eng.workMinutesBetween(forwardAgain, t) !== 0) {
          subAdd++;
          if (!firstSubAdd) {
            firstSubAdd = `${formatInstant(t, 'hour')} -${n}d=${formatInstant(backward, 'hour')} `
              + `+${n}d=${formatInstant(forwardAgain, 'hour')}`;
          }
        }
        if (eng.workMinutesBetween(t, forward) !== minutes) spanFwd++;
        if (eng.workMinutesBetween(backward, t) !== minutes) spanBack++;
      }
    }
    ok(`${label}: het meetvenster bevat werk-instants`, sampled > 200);
    eq(`${label} A1 sub(add(t,n),n) === t${firstAddSub ? ` — eerste: ${firstAddSub}` : ''}`, addSub, 0);
    eq(`${label} A2 add(sub(t,n),n) ≡ t${firstSubAdd ? ` — eerste: ${firstSubAdd}` : ''}`, subAdd, 0);
    eq(`${label} A3 voorwaartse wandeling verbruikt exact n werkminuten`, spanFwd, 0);
    eq(`${label} A3 achterwaartse wandeling verbruikt exact n werkminuten`, spanBack, 0);
  }
}

for (const week of WEEK_PATTERNS) {
  const label = `A dag ${week.label}`;
  const eng = new CalendarEngine(dayCalendar(`d-${week.label}`, week.workDays));
  let addSub = 0; let subAdd = 0; let signed = 0; let span = 0; let sampled = 0;
  for (let ms = SWEEP_FROM; ms < SWEEP_TO; ms += DAY_MS) {
    const t = new Date(ms);
    if (!eng.isWorkDay(t)) continue;
    sampled++;
    for (const n of SPANS) {
      const forward = eng.addWorkDays(t, n);
      if (eng.subtractWorkDays(forward, n).getTime() !== t.getTime()) addSub++;
      const backward = eng.subtractWorkDays(t, n);
      if (eng.addWorkDays(backward, n).getTime() !== t.getTime()) subAdd++;
      const shifted = eng.addWorkingDaysSigned(t, n);
      if (eng.addWorkingDaysSigned(shifted, -n).getTime() !== t.getTime()) signed++;
      if (eng.workDaysBetween(t, forward) !== n) span++;
    }
  }
  ok(`${label}: het meetvenster bevat werkdagen`, sampled > 20);
  eq(`${label} A4 subtractWorkDays(addWorkDays(t,n),n) === t`, addSub, 0);
  eq(`${label} A4 addWorkDays(subtractWorkDays(t,n),n) === t`, subAdd, 0);
  eq(`${label} A5 addWorkingDaysSigned is richtingssymmetrisch`, signed, 0);
  eq(`${label} A5 addWorkDays verbruikt exact n werkdagen`, span, 0);
}

{
  const eng = new CalendarEngine(hourCalendar('h-842-vorm', [1, 2, 3, 4, 6, 7], TWO_BANDS));
  const start = parseInstant('2026-03-05T08:00');
  const finish = eng.addWorkMinutes(start, 7 * 480);
  eq('A6 vooruit 7 werkdagen over het blok', formatInstant(finish, 'hour'), '2026-03-23T17:00');
  eq('A6 terug 7 werkdagen over het blok landt exact terug',
    formatInstant(eng.subtractWorkMinutes(finish, 7 * 480), 'hour'), '2026-03-05T08:00');
  eq('A6 beide richtingen overbruggen evenveel werkminuten',
    eng.workMinutesBetween(start, finish), 7 * 480);
}

function makeTask(
  id: string, anchor: string, amount: number, unit: 'days' | 'hours', minutesPerDay: number,
): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: unit,
      scheduleDuration: unit === 'hours' ? amount / minutesPerDay : amount,
      ...(unit === 'hours' ? { durationMinutes: amount } : {}),
      scheduleStart: anchor, scheduleFinish: anchor,
      earlyStart: anchor, earlyFinish: anchor, lateStart: anchor, lateFinish: anchor,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  };
}

const RELATIONS: SequenceType[] = ['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'];
const LAGS = [0, 2, -2];

for (const hourMode of [true, false]) {
  for (const shape of hourMode ? HOUR_SHAPES : [HOUR_SHAPES[1]]) {
    for (const week of WEEK_PATTERNS) {
      const label = `B ${hourMode ? `uur ${shape.label}` : 'dag'} ${week.label}`;
      const cal = hourMode
        ? hourCalendar(`b-${shape.label}-${week.label}`, week.workDays, shape.bands)
        : dayCalendar(`bd-${week.label}`, week.workDays);
      const eng = new CalendarEngine(cal);
      const mpd = eng.hoursPerDay * 60;
      const unit: 'days' | 'hours' = hourMode ? 'hours' : 'days';
      let spanFails = 0; let floatFails = 0; let solves = 0; let errors = 0;
      let firstSpan = ''; let firstFloat = '';
      for (let ms = Date.UTC(2026, 1, 20); ms < Date.UTC(2026, 2, 24); ms += DAY_MS) {
        const iso = new Date(ms).toISOString().slice(0, 10);
        const anchor = hourMode ? `${iso}T08:00` : iso;
        for (const relType of RELATIONS) {
          for (const lagDays of LAGS) {
            const mk = (id: string, days: number): Task =>
              makeTask(id, anchor, hourMode ? days * mpd : days, unit, mpd);
            const tasks = [mk('X', 3), mk('Y', 7), mk('Z', 2), mk('SPACER', 30)];
            const sequences: Sequence[] = [
              { id: 's1', predecessorId: 'X', successorId: 'Y', type: relType, lagDays },
              { id: 's2', predecessorId: 'Y', successorId: 'Z', type: 'FINISH_START', lagDays: 0 },
            ];
            const result = solveProject(opsSolveInput({
              tasks, sequences, calendar: cal, calendars: [cal], projectStartDate: iso,
            }));
            if (result.error) { errors++; continue; }
            solves++;
            for (const t of tasks) {
              const es = hourMode ? parseInstant(t.time.earlyStart!) : parseDate(t.time.earlyStart!);
              const ef = hourMode ? parseInstant(t.time.earlyFinish!) : parseDate(t.time.earlyFinish!);
              const ls = hourMode ? parseInstant(t.time.lateStart!) : parseDate(t.time.lateStart!);
              const lf = hourMode ? parseInstant(t.time.lateFinish!) : parseDate(t.time.lateFinish!);
              const early = hourMode ? eng.workMinutesBetween(es, ef) : eng.workDaysBetween(es, ef);
              const late = hourMode ? eng.workMinutesBetween(ls, lf) : eng.workDaysBetween(ls, lf);
              if (early !== late) {
                spanFails++;
                if (!firstSpan) {
                  firstSpan = `${iso} ${relType}/${lagDays} ${t.id}: ES..EF=${early} LS..LF=${late}`
                    + ` (${t.time.earlyStart}..${t.time.earlyFinish} | ${t.time.lateStart}..${t.time.lateFinish})`;
                }
              }
              const startFloat = hourMode ? eng.workMinutesBetween(es, ls) : eng.workDaysBetween(es, ls);
              const finishFloat = hourMode ? eng.workMinutesBetween(ef, lf) : eng.workDaysBetween(ef, lf);
              if (startFloat !== finishFloat) {
                floatFails++;
                if (!firstFloat) {
                  firstFloat = `${iso} ${relType}/${lagDays} ${t.id}: ES→LS=${startFloat} EF→LF=${finishFloat}`;
                }
              }
            }
          }
        }
      }
      eq(`${label}: geen solve-fouten`, errors, 0);
      ok(`${label}: er is echt doorgerekend`, solves > 100);
      eq(`${label} B1 ES..EF en LS..LF overspannen evenveel werktijd`
        + `${firstSpan ? ` — eerste: ${firstSpan}` : ''}`, spanFails, 0);
      eq(`${label} B2 ES→LS is gelijk aan EF→LF${firstFloat ? ` — eerste: ${firstFloat}` : ''}`,
        floatFails, 0);
    }
  }
}

{
  const xer = new CalendarEngine(hourCalendar('c-xer', [1, 2, 3, 4, 6, 7], TWO_BANDS, {
    p6Source: 'XER', p6NonWorkPenaltyDates: ['2026-03-13', '2026-03-20'],
  }));
  const neutral = new CalendarEngine(hourCalendar('c-neutraal', [1, 2, 3, 4, 6, 7], TWO_BANDS));
  const finish = parseInstant('2026-03-23T17:00');
  const start = parseInstant('2026-03-05T08:00');
  const duration = 7 * 480;

  eq('C1 een volledige XER-bronkalender wandelt achteruit exact even ver als een neutrale',
    formatInstant(xer.subtractWorkMinutes(finish, duration), 'hour'),
    formatInstant(neutral.subtractWorkMinutes(finish, duration), 'hour'));
  eq('C1 en die uitkomst is de exacte inverse van de voorwaartse wandeling',
    formatInstant(xer.addWorkMinutes(xer.subtractWorkMinutes(finish, duration), duration), 'hour'),
    formatInstant(finish, 'hour'));
  eq('C1 de bronstempel raakt ook de voorwaartse wandeling niet',
    formatInstant(xer.addWorkMinutes(start, duration), 'hour'),
    formatInstant(neutral.addWorkMinutes(start, duration), 'hour'));
  eq('C2 de werkminutentelling is bronneutraal',
    xer.workMinutesBetween(start, finish), neutral.workMinutesBetween(start, finish));
  eq('C2 en telt exact de gevraagde duur over het blok van tien dagen',
    xer.workMinutesBetween(start, finish), duration);
}

if (diffs.length === 0) {
  console.log(`OK  calendar-mirror: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  calendar-mirror: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
