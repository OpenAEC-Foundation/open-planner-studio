// Audit 2026-09-26 — `CalendarEngine.addWorkDaysChecked`, `subtractWorkDays` en `addWorkingDaysSigned`
// liepen dag voor dag (de grootste kostenpost van elke solve en van de leveler). Nu rekenkundig op
// dezelfde telling als `workDaysBetween`. Deze check vergelijkt ze met een letterlijke kopie van de
// oude lussen (op `isWorkDay`) voor willekeurige kalenders: 0–7 werkdagen, feestdagblokken, werkende
// uitzonderingen (ook op een zaterdag), fractionele/negatieve/nul/grote aantallen, NaN en ∞.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
let seed = 0x5a5a5a5a;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const MAX_SCAN = 366, MAX_DAYS = 200_000;

// ── De oude implementaties, letterlijk (op de publieke isWorkDay) ─────────────────────────────────
function oldAddWorkDaysChecked(e: CalendarEngine, startDate: Date, workDays: number) {
  if (workDays <= 0) return { date: new Date(startDate.getTime()), capped: false };
  let current = new Date(startDate.getTime());
  let scan = 0;
  while (!e.isWorkDay(current)) {
    current = addCalendarDays(current, 1);
    if (++scan > MAX_SCAN) return { date: current, capped: true };
  }
  let remaining = workDays - 1;
  let steps = 0;
  while (remaining > 0) {
    current = addCalendarDays(current, 1);
    if (e.isWorkDay(current)) remaining--;
    if (++steps > MAX_DAYS) return { date: current, capped: true };
  }
  return { date: current, capped: false };
}
function oldSubtractWorkDays(e: CalendarEngine, endDate: Date, workDays: number): Date {
  if (workDays <= 0) return new Date(endDate.getTime());
  let current = new Date(endDate.getTime());
  let scan = 0;
  while (!e.isWorkDay(current)) {
    current = addCalendarDays(current, -1);
    if (++scan > MAX_SCAN) return current;
  }
  let remaining = workDays - 1;
  let steps = 0;
  while (remaining > 0) {
    current = addCalendarDays(current, -1);
    if (e.isWorkDay(current)) remaining--;
    if (++steps > MAX_DAYS) break;
  }
  return current;
}
function oldAddWorkingDaysSigned(e: CalendarEngine, date: Date, n: number): Date {
  let current = e.nextWorkDay(new Date(date.getTime()));
  if (n === 0) return current;
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  let guard = 0;
  while (remaining > 0) {
    current = addCalendarDays(current, step);
    if (e.isWorkDay(current)) remaining--;
    if (++guard > MAX_DAYS) break;
  }
  return current;
}

function randomCalendar(): WorkCalendar {
  const r = rnd();
  const workDays = r < 0.0 ? [] : r < 0.1 ? [1, 2, 3, 4, 5, 6, 7] : r < 0.2 ? [1, 3, 5] : r < 0.3 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const holidays = [];
  for (let i = 0; i < Math.floor(rnd() * 8); i++) {
    const start = addCalendarDays(parseDate('2026-01-01'), Math.floor(rnd() * 900));
    holidays.push({ name: 'h', startDate: formatDate(start), endDate: formatDate(addCalendarDays(start, Math.floor(rnd() * (rnd() < 0.1 ? 60 : 5)))) });
  }
  const workingExceptions = [];
  for (let i = 0; i < Math.floor(rnd() * 4); i++) {
    const start = addCalendarDays(parseDate('2026-01-01'), Math.floor(rnd() * 900));
    workingExceptions.push({ name: 'w', startDate: formatDate(start), endDate: formatDate(addCalendarDays(start, Math.floor(rnd() * 3))) });
  }
  return {
    id: 'c', name: 'c', description: '', workDays, workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
    holidays, ...(workingExceptions.length > 0 ? { workingExceptions } : {}),
  } as WorkCalendar;
}

const AMOUNTS = () => {
  const r = rnd();
  if (r < 0.03) return NaN;
  if (r < 0.0315) return Infinity;
  if (r < 0.1) return 0;
  if (r < 0.2) return -Math.floor(rnd() * 40);
  if (r < 0.3) return Math.round(rnd() * 20 * 4) / 4;          // fractioneel
  if (r < 0.35) return 2000 + Math.floor(rnd() * 3000);        // groot
  return 1 + Math.floor(rnd() * 60);
};

let n = 0;
// Kapotte kalender (geen enkele werkdag): de oude lussen kappen af op MAX_SCAN/MAX_DAYS — dat
// randgedrag moet exact blijven, maar het is duur om te herhalen; daarom een handvol vaste gevallen.
{
  const empty = new CalendarEngine({ ...randomCalendar(), workDays: [], workingExceptions: undefined } as WorkCalendar);
  for (const amount of [3, -3, 0.5]) {
    const d = parseDate('2026-03-02');
    checks += 3;
    if (JSON.stringify(empty.addWorkDaysChecked(d, amount)) !== JSON.stringify(oldAddWorkDaysChecked(empty, d, amount))) diffs.push(`leeg addWorkDaysChecked ${amount}`);
    if (empty.subtractWorkDays(d, amount).getTime() !== oldSubtractWorkDays(empty, d, amount).getTime()) diffs.push(`leeg subtractWorkDays ${amount}`);
    if (empty.addWorkingDaysSigned(d, amount).getTime() !== oldAddWorkingDaysSigned(empty, d, amount).getTime()) diffs.push(`leeg addWorkingDaysSigned ${amount}`);
  }
}
for (let c = 0; c < 200; c++) {
  const e = new CalendarEngine(randomCalendar());
  for (let k = 0; k < 40; k++) {
    const d = addCalendarDays(parseDate('2026-01-01'), Math.floor(rnd() * 900));
    const amount = AMOUNTS();
    n++;
    const a1 = JSON.stringify(e.addWorkDaysChecked(d, amount)), b1 = JSON.stringify(oldAddWorkDaysChecked(e, d, amount));
    const a2 = e.subtractWorkDays(d, amount).getTime(), b2 = oldSubtractWorkDays(e, d, amount).getTime();
    const a3 = e.addWorkingDaysSigned(d, amount).getTime(), b3 = oldAddWorkingDaysSigned(e, d, amount).getTime();
    checks += 3;
    if (a1 !== b1) diffs.push(`addWorkDaysChecked(${formatDate(d)}, ${amount}): ${a1} ≠ ${b1}`);
    if (!Object.is(a2, b2)) diffs.push(`subtractWorkDays(${formatDate(d)}, ${amount}): ${a2} ≠ ${b2}`);
    if (!Object.is(a3, b3)) diffs.push(`addWorkingDaysSigned(${formatDate(d)}, ${amount}): ${a3} ≠ ${b3}`);
  }
}

if (diffs.length === 0) {
  console.log(`OK  calendar-arith: alle checks groen (${checks} over ${n} aanroepen)`);
  process.exit(0);
} else {
  console.log(`XX  calendar-arith: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 10)) console.log(`   - ${d}`);
  process.exit(1);
}
