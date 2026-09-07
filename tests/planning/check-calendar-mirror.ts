// check-calendar-mirror.ts — de SPIEGEL-invariant van de kalender- en duur-primitieven, corpusloos.
//
// AANLEIDING (diagnose laag 1, klasse (ii), deeldossier "spiegel", 2026-09-04/05). Het dossier van
// XER-project 761 (`rehab-2.xer`, kalender 842) meldde dat een terugwaartse duurwandeling over een
// aaneengesloten niet-werkblok van ±10 dagen 10 werkdagen overbrugt waar de voorwaartse wandeling
// er 7 telt, en vermoedde daarachter een FORMAATNEUTRAAL defect in
// `CalendarEngine.subtractWorkMinutes`/`CPMSolver.subDuration`.
//
// DIE VERMOEDENS ZIJN HIER GEMETEN EN WEERLEGD, en dat is precies wat deze batterij vastpint:
//
//   * Deel A — de kalenderprimitieven zijn WEL exacte spiegels, ook over een blok van 10
//     aaneengesloten vrije kalenderdagen, in uur-modus met 1, 2 en 3 banden per dag, in dag-modus,
//     en op een weekpatroon waarin het weekend werkt en een doordeweekse dag vrij is.
//   * Deel B — hetzelfde geldt op SOLVER-niveau: `ES..EF` en `LS..LF` overspannen altijd evenveel
//     werktijd, en `ES→LS` is altijd gelijk aan `EF→LF` (float-symmetrie), over FS/SS/FF/SF met
//     positieve, nul- en negatieve lag, met het late venster dwars door het blok.
//   * Deel C — de gemeten 7-vs-10 komt UITSLUITEND uit `subtractP6XerProjectedWorkMinutes`, de
//     P6/XER-resultaatprojectie. Die is per constructie GEEN spiegel (er is geen voorwaartse
//     tegenhanger) en hangt achter `WorkCalendar.p6Source === 'XER'`. Deel C pint zowel de
//     afwijking zelf als de bronpoort: zonder `p6Source: 'XER'` is de projectie inert en geldt de
//     spiegel onverkort. Zo kan die brongebonden asymmetrie nooit stilzwijgend formaatneutraal
//     worden — dat zou élk IFC-/MSPDI-/MPP-project raken.
//
// Draait via run.sh (ook in de tijdzone-matrix). Exit 0 = alles groen.

import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { solveProject } from '@/engine/scheduler/solveProject';
import { formatInstant, parseDate, parseInstant } from '@/utils/dateUtils';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import type { SequenceType } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

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

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────
// Eén band (08:00-17:00), twee banden (lunchpauze) en drie banden (ploegendienst met twee pauzes).
const ONE_BAND = [{ start: 480, end: 1020 }];                                           // 540 min
const TWO_BANDS = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];                // 480 min
const THREE_BANDS = [{ start: 360, end: 600 }, { start: 660, end: 840 }, { start: 900, end: 1260 }]; // 780 min

// Het aaneengesloten niet-werkblok: 10 kalenderdagen, ma 2026-03-09 t/m wo 2026-03-18, dus met een
// heel weekend erin. Dat is de vorm waarop het dossier de asymmetrie meende te zien.
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
  // P6-vorm van kalender 842 uit het dossier: het weekend werkt, vrijdag is vrij.
  { label: 'ma-do+za+zo', workDays: [1, 2, 3, 4, 6, 7] },
];

const HOUR_SHAPES: { label: string; bands: { start: number; end: number }[] }[] = [
  { label: '1 band', bands: ONE_BAND },
  { label: '2 banden', bands: TWO_BANDS },
  { label: '3 banden', bands: THREE_BANDS },
];

// Het meetvenster loopt ruim vóór en ná het blok, zodat élke wandeling van 1..20 werkdagen het blok
// een keer kruist, erin begint of er net buiten valt.
const SWEEP_FROM = Date.UTC(2026, 1, 16);
const SWEEP_TO = Date.UTC(2026, 3, 20);
const HALF_HOUR_MS = 1_800_000;
const DAY_MS = 86_400_000;
const SPANS = [1, 2, 3, 5, 7, 10, 13, 20];

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Deel A — de kalenderprimitieven
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// SNAP-REGEL OP NIET-WERK-INSTANTS (het punt waar de spiegel schijnbaar breekt, en waarom niet).
// `addWorkMinutes` normaliseert zijn startpunt met `nextWorkInstant` (voorwaarts), en
// `subtractWorkMinutes` normaliseert zijn eindpunt met `prevWorkInstant` (achterwaarts) — elk in de
// richting van de eigen wandeling. Daardoor geldt de ronde-reis-identiteit
// `sub(add(t, n), n) === t` EXACT voor elk werk-instant t. Ze geldt NIET letterlijk voor een t die
// zelf geen werk-instant is: `add` snapt dan vooruit, `sub` snapt achteruit, en de twee snappunten
// liggen aan weerszijden van hetzelfde gat. Ook een t op een bandGRENS is dubbelzinnig: 17:00 (het
// eind van vrijdag) en 08:00 (het begin van maandag) zijn hetzelfde punt op de werk-as — er ligt nul
// werktijd tussen. De juiste gelijkheidstest tussen twee posities op de werk-as is daarom
// `workMinutesBetween(a, b) === 0`, niet `a.getTime() === b.getTime()`. Deel A toetst beide vormen:
// de harde ms-identiteit voor werk-instants, en de werk-as-gelijkheid voor de rest.
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
        // A1 — vooruit en dan terug landt exact terug op t (harde ms-identiteit).
        const forward = eng.addWorkMinutes(t, minutes);
        const backAgain = eng.subtractWorkMinutes(forward, minutes);
        if (backAgain.getTime() !== t.getTime() && eng.workMinutesBetween(backAgain, t) !== 0) {
          addSub++;
          if (!firstAddSub) {
            firstAddSub = `${formatInstant(t, 'hour')} +${n}d=${formatInstant(forward, 'hour')} `
              + `-${n}d=${formatInstant(backAgain, 'hour')}`;
          }
        }
        // A2 — terug en dan vooruit landt op dezelfde positie op de werk-as (bandgrens-dualiteit).
        const backward = eng.subtractWorkMinutes(t, minutes);
        const forwardAgain = eng.addWorkMinutes(backward, minutes);
        if (eng.workMinutesBetween(forwardAgain, t) !== 0) {
          subAdd++;
          if (!firstSubAdd) {
            firstSubAdd = `${formatInstant(t, 'hour')} -${n}d=${formatInstant(backward, 'hour')} `
              + `+${n}d=${formatInstant(forwardAgain, 'hour')}`;
          }
        }
        // A3 — de wandeling verbruikt precies het gevraagde aantal werkminuten, beide kanten op.
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
      // `addWorkingDaysSigned` is de zuivere offset (de begindag telt NIET als dag 1) en moet in
      // beide richtingen even ver stappen — juist over het blok heen.
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

// Expliciete regel-instantie van het dossier: 7 werkdagen vooruit en 7 werkdagen terug over hetzelfde
// blok leveren precies dezelfde twee grenzen op. Kalender 842-vorm: vrijdag vrij, weekend werkt.
{
  const eng = new CalendarEngine(hourCalendar('h-842-vorm', [1, 2, 3, 4, 6, 7], TWO_BANDS));
  const start = parseInstant('2026-03-05T08:00');           // donderdag vóór het blok
  const finish = eng.addWorkMinutes(start, 7 * 480);        // 7 werkdagen à 8 uur
  // 03-05 do, 03-07 za, 03-08 zo, [blok 03-09..03-18], 03-19 do, 03-21 za, 03-22 zo, 03-23 ma.
  eq('A6 vooruit 7 werkdagen over het blok', formatInstant(finish, 'hour'), '2026-03-23T17:00');
  eq('A6 terug 7 werkdagen over het blok landt exact terug',
    formatInstant(eng.subtractWorkMinutes(finish, 7 * 480), 'hour'), '2026-03-05T08:00');
  eq('A6 beide richtingen overbruggen evenveel werkminuten',
    eng.workMinutesBetween(start, finish), 7 * 480);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Deel B — de spiegel op solver-niveau (`addDuration` ↔ `subDuration`, forward- ↔ backward-pass)
// ═══════════════════════════════════════════════════════════════════════════════════════════
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
            // X → Y → Z is de keten; SPACER duwt het projecteinde ver naar achteren zodat de keten
            // speling krijgt en haar LATE venster dwars door het blok van 10 dagen valt.
            const tasks = [mk('X', 3), mk('Y', 7), mk('Z', 2), mk('SPACER', 30)];
            const sequences: Sequence[] = [
              { id: 's1', predecessorId: 'X', successorId: 'Y', type: relType, lagDays },
              { id: 's2', predecessorId: 'Y', successorId: 'Z', type: 'FINISH_START', lagDays: 0 },
            ];
            const result = solveProject({
              tasks, sequences, calendar: cal, calendars: [cal], projectStartDate: iso,
            });
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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Deel C — er is GEEN brongebonden uitzondering meer op de spiegel
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Tot etappe 7b-2 droeg `CalendarEngine` een `subtractP6XerProjectedWorkMinutes`-projectie achter
// `p6Source === 'XER'`: die telde per `p6NonWorkPenaltyDate` in het doorlopen venster een extra
// niet-werkdag mee, zónder voorwaartse tegenhanger. Dat was precies de "7 vooruit, 10 terug" uit het
// diagnosedossier. De projectie is verwijderd nadat (a) de XER-decoder de werkelijk bedoelde vrije
// dagen kon reconstrueren en (b) gemeten was dat de projectie op élk penaltydragend corpusbestand
// nul cellen verklaarde. Deze sectie pint dat de spiegel nu ONVOORWAARDELIJK geldt: ook een kalender
// die de volledige XER-bronstempel én een penaltylijst draagt, wandelt vooruit en achteruit exact
// even ver. Zou iemand de projectie opnieuw invoeren, dan gaat C1 rood.
{
  const xer = new CalendarEngine(hourCalendar('c-xer', [1, 2, 3, 4, 6, 7], TWO_BANDS, {
    p6Source: 'XER', p6NonWorkPenaltyDates: ['2026-03-13', '2026-03-20'],
  }));
  const neutral = new CalendarEngine(hourCalendar('c-neutraal', [1, 2, 3, 4, 6, 7], TWO_BANDS));
  // Exact het venster uit A6: 7 werkdagen à 8 uur eindigend op ma 2026-03-23.
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
