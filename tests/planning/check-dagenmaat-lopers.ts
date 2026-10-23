// De lopers van de dagenmaat (alleen uren §3.14, technische keuze T23). Exit 0 = groen.
//
// Wat hier bewezen wordt:
//   A. De voorbeelden uit de spec: de voorbeeldweek (B1: ma 07:00 + 5 d ⇒ vr 14:00, di 11:00 + 3 d ⇒
//      vr 10:00, wo 07:00 + 3 d ⇒ vr 14:00), een breuk (B2: 2,5 d ⇒ wo 11:00; B3: 3,4 d ⇒ ma 10:12),
//      de lag van §3.3 (0,5 d na do 16:00 ⇒ vr 10:00), een feestdag (telt 0), een werkende uitzondering
//      met minder uren (telt 1), een nachtblok (hoort bij de begindag), de 24:00-regel en het
//      reviewvoorbeeld vr 07:03 + 1 d met een zaterdag van 1 u (terug op vr 07:00, 3 minuten verschil).
//   B. Vooruit tegen een trage referentieloper die dag voor dag over `effectiveBandsOn` loopt: exact
//      hetzelfde moment, op willekeurige begins en duren (vaste zaadwaarde), op elke kalender hierboven.
//   C. De foutgrens van T23: vooruit en dan achteruit verschilt hooguit ½ + ½ × (werkminuten van de
//      begindag ÷ werkminuten van de einddag) minuut, en `measuredWorkdaysBetween` geeft de duur terug
//      binnen dezelfde grens (omgerekend naar dagen).
//
// Mutatiebewijs (zie de PR): `Math.round` → `Math.floor` in `addMeasuredWorkdaysChecked` maakt A en B
// rood; de feestdag als werkdag tellen (`measureDay` zonder `bandsStartingOn`) maakt A rood.
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

// De kalenders. 2026-06-01 is een maandag.
const VOORBEELDWEEK = cal('voorbeeldweek', [1, 2, 3, 4, 5], week({ 1: DAY8, 2: DAY8, 3: DAY8, 4: DAY8, 5: FRI6 }));
const STANDAARD = cal('standaard', [1, 2, 3, 4, 5], undefined); // scalair 07–16, 8 u: de engine maakt de blokken
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
// Tegenstrijdig: zaterdag heeft blokken maar staat niet in workDays. De dagenmaat telt de blokken (de
// trage tak van de lopers), zodat de referentieloper hieronder ook dat pad dekt.
const TEGENSTRIJDIG = cal('tegenstrijdig', [1, 2, 3, 4, 5], week({ 1: DAY8, 2: DAY8, 3: DAY8, 4: DAY8, 5: DAY8, 6: [{ start: hm(8), end: hm(10) }] }));

const ALL = [VOORBEELDWEEK, STANDAARD, FEESTDAG, UITZONDERING, NACHT, ETMAAL, ZATERDAG1U, TEGENSTRIJDIG];
const engines = new Map(ALL.map((c) => [c.id, new CalendarEngine(c)]));
const E = (c: WorkCalendar) => engines.get(c.id)!;

// ── A. Voorbeelden uit de spec ──
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

// B1, de voorbeeldweek
fwd(VOORBEELDWEEK, '2026-06-01T07:00', 5, '2026-06-05T14:00');
fwd(VOORBEELDWEEK, '2026-06-02T11:00', 3, '2026-06-05T10:00');
fwd(VOORBEELDWEEK, '2026-06-03T07:00', 3, '2026-06-05T14:00');
back(VOORBEELDWEEK, '2026-06-05T14:00', 5, '2026-06-01T07:00');
back(VOORBEELDWEEK, '2026-06-05T10:00', 3, '2026-06-02T11:00');
back(VOORBEELDWEEK, '2026-06-05T14:00', 3, '2026-06-03T07:00');
dist(VOORBEELDWEEK, '2026-06-01T07:00', '2026-06-05T14:00', 5);
dist(VOORBEELDWEEK, '2026-06-02T11:00', '2026-06-05T10:00', 3);
// §3.3: FS-lag 0,5 d na een einde do 16:00 is de helft van de vrijdag van 6 u ⇒ vr 10:00.
fwd(VOORBEELDWEEK, '2026-06-04T16:00', 0.5, '2026-06-05T10:00');
// Een einde op de korte vrijdag en een blokeinde in de middag blijven blokeinden.
fwd(VOORBEELDWEEK, '2026-06-05T07:00', 1, '2026-06-05T14:00');
fwd(VOORBEELDWEEK, '2026-06-01T07:00', 5 / 8, '2026-06-01T12:00');
back(VOORBEELDWEEK, '2026-06-01T16:00', 3 / 8, '2026-06-01T13:00');

// B2 en B3 op de standaardkalender (scalair 07–16, pauze 12–13)
fwd(STANDAARD, '2026-06-01T07:00', 2.5, '2026-06-03T11:00');
fwd(STANDAARD, '2026-06-03T07:00', 3.4, '2026-06-08T10:12');
fwd(STANDAARD, '2026-06-03T07:00', 3, '2026-06-05T16:00');
back(STANDAARD, '2026-06-08T10:12', 3.4, '2026-06-03T07:00');
back(STANDAARD, '2026-06-03T11:00', 2.5, '2026-06-01T07:00');
dist(STANDAARD, '2026-06-03T07:00', '2026-06-08T10:12', 3.4);
// Een start op een blokeinde telt vanaf het volgende blokbegin.
fwd(STANDAARD, '2026-06-01T16:00', 1, '2026-06-02T16:00');
fwd(STANDAARD, '2026-06-01T12:00', 0.5, '2026-06-02T08:00');
// Een moment buiten werktijd ligt op de grens tussen twee werkdagen.
dist(STANDAARD, '2026-06-05T16:00', '2026-06-08T07:00', 0);
dist(STANDAARD, '2026-06-06T10:00', '2026-06-08T07:00', 0);
dist(STANDAARD, '2026-06-05T16:00', '2026-06-08T11:00', 0.5);
// Nul of negatief ⇒ ongewijzigd, zoals addWorkMinutes.
eq('standaard: + 0 d', fmt(E(STANDAARD).addMeasuredWorkdays(at('2026-06-01T09:30'), 0)), '2026-06-01T09:30');
eq('standaard: − 0 d', fmt(E(STANDAARD).subtractMeasuredWorkdays(at('2026-06-01T09:30'), 0)), '2026-06-01T09:30');

// Feestdag wo 3 jun telt 0
fwd(FEESTDAG, '2026-06-01T07:00', 3, '2026-06-04T16:00');
back(FEESTDAG, '2026-06-04T16:00', 3, '2026-06-01T07:00');
dist(FEESTDAG, '2026-06-02T11:00', '2026-06-04T11:00', 1);

// Werkende zaterdag 6 jun van 4 u telt als hele dag
fwd(UITZONDERING, '2026-06-05T07:00', 2, '2026-06-06T11:00');
fwd(UITZONDERING, '2026-06-05T07:00', 1.5, '2026-06-06T09:00');
back(UITZONDERING, '2026-06-06T11:00', 2, '2026-06-05T07:00');
dist(UITZONDERING, '2026-06-05T07:00', '2026-06-08T11:00', 2.5);

// Nachtblok ma–vr 22:00–06:00: het blok hoort bij de dag waarop het begint
fwd(NACHT, '2026-06-02T22:00', 1, '2026-06-03T06:00');
fwd(NACHT, '2026-06-02T22:00', 1.5, '2026-06-04T02:00');
back(NACHT, '2026-06-04T02:00', 1.5, '2026-06-02T22:00');
dist(NACHT, '2026-06-02T22:00', '2026-06-03T06:00', 1);
dist(NACHT, '2026-06-03T02:00', '2026-06-04T02:00', 1);

// 24-uurskalender: een einde om 00:00 sluit de dag ervoor
fwd(ETMAAL, '2026-06-01T00:00', 1, '2026-06-02T00:00');
fwd(ETMAAL, '2026-06-01T12:00', 1, '2026-06-02T12:00');
back(ETMAAL, '2026-06-02T00:00', 1, '2026-06-01T00:00');

// Het reviewvoorbeeld van T23: vrijdag 8 u, werkende zaterdag 1 u, begin vr 07:03, duur 1 d. Na vrijdag
// blijft 3/480 d over; op zaterdag is dat Math.round(60 × 3/480) = 0 min. Het einde is dan het einde van
// vrijdag (op de tijdas hetzelfde punt als za 07:00), en terug komt op vr 07:00: 3 minuten verschil.
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

// ── B en C. Willekeurige begins en duren tegen de referentieloper ──
/** Werkminuten van de blokken die op kalenderdag `dayMs` beginnen, op volgorde. */
function dayBands(e: CalendarEngine, dayMs: number): { start: number; end: number }[] {
  return [...e.effectiveBandsOn(new Date(dayMs))].filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
}
const dayMinutes = (bands: { start: number; end: number }[]) => bands.reduce((s, b) => s + b.end - b.start, 0);
/** Het moment `offset` werkminuten na het begin van de dag, als eindmoment (een blokeinde blijft staan). */
function endMomentAt(dayMs: number, bands: { start: number; end: number }[], offset: number): number {
  let left = offset;
  for (const b of bands) {
    const len = b.end - b.start;
    if (left <= len) return dayMs + (b.start + left) * MS_PER_MIN;
    left -= len;
  }
  return dayMs + bands[bands.length - 1].end * MS_PER_MIN;
}
/** Trage referentie: dag voor dag, alleen `effectiveBandsOn`. Geeft het eindmoment en de werkminuten
 *  van de dag waarop het deel is afgerond (de "einddag" van de foutgrens). */
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
    // C. Vooruit en dan achteruit binnen de foutgrens van T23.
    const startOnAxis = e.nextWorkInstant(start);
    const backAgain = e.subtractMeasuredWorkdays(got, days);
    const err = Math.abs(e.workMinutesBetween(backAgain, startOnAxis));
    // De begindag is de dag waarop de terugloop landt. Ligt het begin op een daggrens (het blokbegin van
    // za 07:00 is op de tijdas ook het einde van vrijdag), dan kan dat de dag ervoor zijn: tel de langste.
    const backDay = workdayDateOfInstant(e, e.nextWorkInstant(backAgain), 'start').getTime();
    const beginMinutes = Math.max(ref.beginDayMinutes, dayMinutes(dayBands(e, backDay)));
    const bound = 0.5 + 0.5 * (beginMinutes / ref.endDayMinutes) + 1e-6;
    ok(`${label}: terug binnen ${bound.toFixed(3)} min`, err <= bound, `verschil ${err} min, terug ${fmt(backAgain)}`);
    worstRatio = Math.max(worstRatio, err / bound);
    // De afstand geeft de duur terug, binnen dezelfde afronding (de einddag weegt de halve minuut).
    const measured = e.measuredWorkdaysBetween(startOnAxis, got);
    const distBound = 0.5 / ref.endDayMinutes + 1e-9;
    ok(`${label}: afstand ${measured} ≈ ${days}`, days < 1e-9 || Math.abs(measured - days) <= distBound || got.getTime() === start.getTime(),
      `afwijking ${Math.abs(measured - days)} d`);
  }
}

if (diffs.length > 0) {
  console.log(`XX dagenmaat-lopers: ${diffs.length} afwijking(en) van ${checks} checks`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  dagenmaat-lopers: alle checks groen (${checks}; ${samples} willekeurige lopen, slechtste verhouding tot de foutgrens ${worstRatio.toFixed(3)})`);
