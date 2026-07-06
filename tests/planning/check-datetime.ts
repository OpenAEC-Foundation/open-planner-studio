// Datetime-substraat + duur-parser + duur-helper-checks (fase 2.8b, golf 0).
// Onafhankelijk narekenen (elke verwachting met de hand uitgerekend) van:
//  - parseInstant/formatInstant round-trips (dag-modus strip, uur-modus behoud, T00:00);
//  - parseDuration-matrix (hele eenheden geldig; decimalen/rest/leeg/negatief afgewezen);
//  - formatDuration (dagen/uren/auto);
//  - durationMinutesOf/durationDaysOf-invariant (uur-kalender vs dag-kalender, Bevinding 2).
//
// Draait via run.sh (esbuild-bundel, zoals check-holidays.ts). Exit 0 = alles groen.
import { parseInstant, formatInstant, parseDate } from '@/utils/dateUtils';
import { parseDuration, formatDuration } from '@/utils/durationFormat';
import { durationMinutesOf, durationDaysOf } from '@/engine/scheduler/duration';
import type { Task } from '@/types/task';

const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// Minimale taak: de helpers lezen alleen task.time.scheduleDuration + durationMinutes.
function task(scheduleDuration: number, durationMinutes?: number): Task {
  return { time: { scheduleDuration, durationMinutes } } as unknown as Task;
}
const HOUR8 = { isHourMode: true, hoursPerDay: 8 };
const DAY8 = { isHourMode: false, hoursPerDay: 8 };
const HOUR10 = { isHourMode: true, hoursPerDay: 10 };

// ── 1) parseInstant/formatInstant ───────────────────────────────────────────
// Dag-modus strip: date-only blijft date-only.
eq('1  date-only, dag-modus', formatInstant(parseInstant('2026-07-06'), 'day'), '2026-07-06');
// Date-only in uur-modus ⇒ expliciete T00:00 (geen middernacht-uitzondering).
eq('2  date-only, uur-modus ⇒ T00:00', formatInstant(parseInstant('2026-07-06'), 'hour'), '2026-07-06T00:00');
// Datetime behouden in uur-modus.
eq('3  datetime behoud (uur)', formatInstant(parseInstant('2026-07-06T08:30'), 'hour'), '2026-07-06T08:30');
// Middernacht-uur-taak behoudt T00:00 (24/7-taak die op T00:00 landt).
eq('4  middernacht-uur-taak T00:00', formatInstant(parseInstant('2026-07-07T00:00'), 'hour'), '2026-07-07T00:00');
// Expliciete Z gerespecteerd (UTC).
eq('5  datetime met Z (uur)', formatInstant(parseInstant('2026-07-06T22:00Z'), 'hour'), '2026-07-06T22:00');
// Wrap-eind 06:00 volgende dag.
eq('6  wrap-eind 06:00 (uur)', formatInstant(parseInstant('2026-07-07T06:00'), 'hour'), '2026-07-07T06:00');
// Datetime in DAG-modus valt terug op date-only (strip-uur).
eq('7  datetime, dag-modus strip', formatInstant(parseInstant('2026-07-06T08:30'), 'day'), '2026-07-06');
// parseInstant == parseDate voor date-only (zelfde instant).
eq('8  parseInstant==parseDate (date-only)', parseInstant('2026-03-02').getTime(), parseDate('2026-03-02').getTime());
// Seconden worden op minuut afgekapt.
eq('9  seconden ⇒ minuut-truncatie', formatInstant(parseInstant('2026-07-06T08:30:45'), 'hour'), '2026-07-06T08:30');
// Idempotent round-trip.
eq('10 idempotente round-trip', formatInstant(parseInstant(formatInstant(parseInstant('2026-07-06T14:15'), 'hour')), 'hour'), '2026-07-06T14:15');

// ── 2) parseDuration — geldig (hele eenheden) ─────────────────────────────────
eq('11 "3d" @H8 = 3*8*60', parseDuration('3d', 8), 1440);
eq('12 "20u" @H8 = 20*60', parseDuration('20u', 8), 1200);
eq('13 "20h" @H8 = 20*60', parseDuration('20h', 8), 1200);
eq('14 "2d 4u" @H8 = 960+240', parseDuration('2d 4u', 8), 1200);
eq('15 "2d4h" @H8 = 960+240', parseDuration('2d4h', 8), 1200);
eq('16 "90m" = 90', parseDuration('90m', 8), 90);
eq('17 naakt "5" @H8 = 5*8*60', parseDuration('5', 8), 2400);
eq('18 naakt "5" @H10 = 5*10*60', parseDuration('5', 10), 3000);
eq('19 "2d 4u" @H10 = 1200+240', parseDuration('2d 4u', 10), 1440);
eq('20 "1d 2u 30m" @H8 = 480+120+30', parseDuration('1d 2u 30m', 8), 630);

// ── 3) parseDuration — ongeldig (⇒ null) ─────────────────────────────────────
eq('21 "2.5d" ⇒ null (decimaal)', parseDuration('2.5d', 8), null);
eq('22 "1,5u" ⇒ null (komma)', parseDuration('1,5u', 8), null);
eq('23 "4h30" ⇒ null (rest zonder suffix)', parseDuration('4h30', 8), null);
eq('24 "" ⇒ null (leeg)', parseDuration('', 8), null);
eq('25 "abc" ⇒ null', parseDuration('abc', 8), null);
eq('26 "-3d" ⇒ null (negatief)', parseDuration('-3d', 8), null);
eq('27 "   " ⇒ null (witruimte)', parseDuration('   ', 8), null);
eq('28 "2.5" ⇒ null (decimaal naakt)', parseDuration('2.5', 8), null);

// ── 4) formatDuration ────────────────────────────────────────────────────────
eq('29 fmt 1440 @H8 auto ⇒ "3d"', formatDuration(1440, 8, 'auto'), '3d');
eq('30 fmt 1200 @H8 hours ⇒ "20u"', formatDuration(1200, 8, 'hours'), '20u');
eq('31 fmt 1200 @H8 auto ⇒ "20u"', formatDuration(1200, 8, 'auto'), '20u');
eq('32 fmt 90 @H8 hours ⇒ "1u 30m"', formatDuration(90, 8, 'hours'), '1u 30m');
eq('33 fmt 45 @H8 hours ⇒ "45m"', formatDuration(45, 8, 'hours'), '45m');
eq('34 fmt 480 @H10 days ⇒ "0.8d"', formatDuration(480, 10, 'days'), '0.8d');
eq('35 fmt 480 @H8 days ⇒ "1d"', formatDuration(480, 8, 'days'), '1d');
eq('36 fmt 240 @H8 auto ⇒ "4u"', formatDuration(240, 8, 'auto'), '4u');

// ── 5) durationMinutesOf / durationDaysOf — invariant (Bevinding 2) ──────────
// A: scheduleDuration=2 werkdagen, durationMinutes=1200 (=20u=2.5d op H8).
const A = task(2, 1200);
// B: scheduleDuration=3, geen durationMinutes.
const B = task(3);
// C: scheduleDuration=1, durationMinutes=600 (=10u=1d op H10).
const C = task(1, 600);

eq('37 durMin A @uur ⇒ durationMinutes', durationMinutesOf(A, HOUR8), 1200);
eq('38 durMin A @dag ⇒ 2*8*60 (dm genegeerd)', durationMinutesOf(A, DAY8), 960);
eq('39 durMin B @uur (geen dm) ⇒ 3*8*60', durationMinutesOf(B, HOUR8), 1440);
eq('40 durMin B @dag ⇒ 3*8*60', durationMinutesOf(B, DAY8), 1440);

eq('41 durDagen A @uur ⇒ 1200/480 = 2.5', durationDaysOf(A, HOUR8), 2.5);
eq('42 durDagen A @dag ⇒ scheduleDuration 2 (dm genegeerd)', durationDaysOf(A, DAY8), 2);
eq('43 durDagen B @uur (geen dm) ⇒ 3', durationDaysOf(B, HOUR8), 3);
eq('44 durDagen B @dag ⇒ 3', durationDaysOf(B, DAY8), 3);
// KERN-INVARIANT: op een dag-kalender nooit een fractionele dag (geen 2.5 in addWorkDays).
eq('45 durDagen A @dag is integer (geen fractie)', Number.isInteger(durationDaysOf(A, DAY8)), true);
// Andere hoursPerDay: 600 min op H10 = precies 1 dag.
eq('46 durDagen C @H10-uur ⇒ 600/600 = 1', durationDaysOf(C, HOUR10), 1);
eq('47 durMin C @H10-uur ⇒ durationMinutes 600', durationMinutesOf(C, HOUR10), 600);

if (diffs.length === 0) {
  console.log('OK  datetime-check: alle checks groen (47)');
  process.exit(0);
} else {
  console.log(`XX  datetime-check: ${diffs.length} afwijking(en)`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
