// Twee randen van de kalenderwandeling in hele milliseconden (was knownbug 390 en 391).
//
// Sinds review #591 r7 wandelt `CalendarEngine` werktijd in hele ms (`walkMs`). Twee randen deden dat nog niet:
//  390: de werkplaatsing van belasting en nivelleerder (`workPlacement.ts`, urenmaat) telde kommagetalminuten op,
//       en een `Date` kapte af. Vanaf ma 08:00 gaf 1920/7 min 12:34:17,142 tegen 12:34:17,143 bij
//       `addWorkMinutes`. En 480,000005 min (een band-eind plus 0,3 ms) eindigt bij de solver ma 16:00, maar de
//       plaatsing boekte nog een stukje op dinsdag: naast een volle dinsdag gaf dat een overbezetting.
//  391: een lengte onder een halve ms is in hele ms 0, maar `addWorkMinutes` normaliseerde de start vooruit en
//       `subtractWorkMinutes` achteruit. Vanaf ma 1 juni 08:00 kwam 0,000001 min terug op vr 29 mei 16:00.
//
// Alleen de tijdas rekent in hele ms. Het geboekte werk blijft de bronhoeveelheid (review #694 r1): boekte de
// plaatsing de afgeronde lengte, dan maakten drie XER-taken van samen precies 8 u een volle dag overbezet.
//
// Wat deze check vastlegt:
//  (a) het einde van de plaatsing is op de ms gelijk aan `addWorkMinutes` vanaf ma 08:00, de plaatsing boekt
//      geen dag na dat einde, en het geboekte werk is de duur (alleen floatruis, geen halve ms): tienden
//      0,1–5000 min, uren met twee decimalen 0,01–83 u, en breuken die geen heel aantal ms zijn (1920/7,
//      1600,00002, 2407,40742 en twee band-einden plus 0,3 ms); op ma–vr 08:00–16:00 en op 08–12 + 13–17.
//      Met splits is het einde `addWorkMinutes` over het werk plus de gaten ervóór, zoals de solver, en het
//      geboekte werk de duur, ook als de as in een gat eindigt;
//  (a2) via de keten van de belasting (`taskLoadPlacement`, `computeResourceLoad`): A 480,000005 min op ma, B
//      480 min op di, één resource met capaciteit 1. A boekt niets op dinsdag, dus dinsdag is precies vol;
//  (a3) de volle dag uit review #694 r1 via de echte openroute (XER → store → Bereken → nivelleren →
//      Toepassen), onder OPS, P6 en MS Project: maandag precies 1 belast, 8 u werk, geen overbezetting, en
//      de nivelleerder schuift niemand, ook niet na Toepassen;
//  (b) de spiegel `subtractWorkMinutes(addWorkMinutes(t, m), m)` voor m = 0, 0,000001, 0,000008 (net onder een
//      halve ms) en 0,0000083334 (net boven), vanaf ma 08:00, ma 12:00 en vr 16:00, op beide kalenders. Onder
//      een halve ms is de uitkomst `t` zelf. Vanaf een band-eind geeft 1 ms de volgende bandstart terug:
//      hetzelfde punt op de werk-as (regel 3 bij de minuut-lussen in `CalendarEngine.ts`), dus
//      `workMinutesBetween === 0`. Vanaf een werkmoment is de uitkomst altijd `t`;
//  (b2) m onder een halve ms geeft in beide richtingen precies hetzelfde als m = 0, ook buiten werktijd; en
//      de plaatsing van zo'n duur is leeg, met de start als einde, net als `addWorkMinutes`.
//
// Draait via run.sh (esbuild-bundel, ook in de tijdzone-matrix). Alleen de exitcode telt.
import './domStub';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { workPlacement } from '@/engine/scheduler/workPlacement';
import { computeResourceLoad, taskLoadPlacement } from '@/engine/scheduler/ResourceLoad';
import { solveProject } from '@/engine/scheduler/solveProject';
import { splitTotalSpanMinutes } from '@/engine/scheduler/duration';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createAppStoreContext } from '@/state/appStore';
import { parseOpenedFile } from '@/services/formatRegistry';
import { formatDate, parseInstant } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
const iso = (d: Date): string => d.toISOString();

function hourCalendar(id: string, bands: { start: number; end: number }[]): WorkCalendar {
  return {
    id, name: id, description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
    holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
  };
}
const DAY = hourCalendar('ma-vr 08-16', [{ start: 480, end: 960 }]);
const LUNCH = hourCalendar('ma-vr 08-12 13-17', [{ start: 480, end: 720 }, { start: 780, end: 1020 }]);
const CALENDARS = [DAY, LUNCH];
const MONDAY = new Date('2026-06-01T08:00:00Z');
/** Een halve ms in minuten: de grens waaronder een lengte in hele ms 0 is. */
const HALF_MS_MIN = 0.5 / 60_000;
/** Floatruis bij het optellen van geboekte minuten; ver onder een halve ms (8,3e-6 min). */
const WORK_EPS_MIN = 1e-9;
const bookedMinutes = (days: readonly { minutes: number }[]): number => days.reduce((sum, d) => sum + d.minutes, 0);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (a) Het einde van de plaatsing is het einde van de kalenderwandeling
// ════════════════════════════════════════════════════════════════════════════════════════════════
const RASTERS: { name: string; values: number[] }[] = [
  { name: 'tienden 0,1–5000 min', values: Array.from({ length: 50_000 }, (_, i) => (i + 1) / 10) },
  // Uren met twee decimalen, zoals XER en P6 XML ze dragen (minuten via de lezerregel: op een miljoenste minuut).
  { name: 'uren 0,01–83 u', values: Array.from({ length: 8300 }, (_, i) => Math.round((i + 1) / 100 * 60 * 1e6) / 1e6) },
  // Geen heel aantal ms: de ruis van zes decimalen, de werkregel (1920 min werk bij inzet 7), een XER-breuk, en
  // twee band-einden plus 0,3 ms (ma 16:00 op de dagkalender; ma 12:00 en ma 17:00 op de lunchkalender).
  { name: 'geen heel aantal ms', values: [1600.00002, 1920 / 7, 2407.40742, 480.000005, 240.000005] },
];
for (const calendar of CALENDARS) {
  const engine = new CalendarEngine(calendar);
  for (const raster of RASTERS) {
    const misses: string[] = [];
    for (const m of raster.values) {
      const walked = engine.addWorkMinutes(MONDAY, m);
      const placed = workPlacement(engine, { start: MONDAY, duration: m, measure: 'minutes' });
      const lastDay = formatDate(walked);
      const booked = bookedMinutes(placed.days);
      if (placed.finish.getTime() !== walked.getTime()) {
        misses.push(`${m} min: plaatsing ${iso(placed.finish)}, wandeling ${iso(walked)}`);
      } else if (placed.days.some(d => d.iso > lastDay)) {
        misses.push(`${m} min: belasting na ${lastDay} (${placed.days.map(d => d.iso).join(' ')})`);
      } else if (!(Math.abs(booked - m) <= WORK_EPS_MIN)) {
        misses.push(`${m} min: geboekt ${booked} min`);
      }
    }
    eq(`(a) ${calendar.id}, ${raster.name}: einde plaatsing = addWorkMinutes (${misses.length} afwijkingen)`,
      misses.slice(0, 5), []);
  }
}
{
  const engine = new CalendarEngine(DAY);
  const placed = workPlacement(engine, { start: MONDAY, duration: 1920 / 7, measure: 'minutes' });
  eq('(a) het geval uit de knownbug: 1920/7 min vanaf ma 08:00', iso(placed.finish), '2026-06-01T12:34:17.143Z');
  const tail = workPlacement(engine, { start: MONDAY, duration: 480.000005, measure: 'minutes' });
  eq('(a) band-eind plus 0,3 ms: alleen maandag, einde ma 16:00, geboekt de bronduur',
    [tail.days.map(d => d.iso), iso(tail.finish), bookedMinutes(tail.days)],
    [['2026-06-01'], '2026-06-01T16:00:00.000Z', 480.000005]);
}
// Met splits: het einde op de split-as is het werk plus de gaten ervóór, één keer afgerond, zoals de solver
// (`addDurationChecked`: `addWorkMinutes(start, splitTotalSpanMinutes(gaps, werk))`). Werk en gaten los
// afronden zou bij 1920/7 min werk, gat en werk 1 ms te laat eindigen. Het geboekte werk is de duur, ook als
// de as in een gat eindigt (480,000005 min met een gat van 60 min na 480 min: het werk na het gat is 0,3 ms).
for (const calendar of CALENDARS) {
  const engine = new CalendarEngine(calendar);
  const piece = 1920 / 7;
  const cases: { work: number; gaps: { afterMinutes: number; gapMinutes: number }[] }[] = [
    { work: 3 * piece, gaps: [{ afterMinutes: piece, gapMinutes: piece }] },
    { work: 480, gaps: [{ afterMinutes: 240, gapMinutes: 240.000005 }] },
    { work: 2407.40742, gaps: [{ afterMinutes: 1600.00002, gapMinutes: 0.1 }, { afterMinutes: 1600.05, gapMinutes: piece }] },
    { work: 480.000005, gaps: [{ afterMinutes: 480, gapMinutes: 60 }] },
  ];
  for (const { work, gaps } of cases) {
    const placed = workPlacement(engine, { start: MONDAY, duration: work, measure: 'minutes', gaps });
    eq(`(a) ${calendar.id}, ${work} min werk met ${gaps.length} gat(en): einde = addWorkMinutes(werk + gaten)`,
      iso(placed.finish), iso(engine.addWorkMinutes(MONDAY, splitTotalSpanMinutes(gaps, work))));
    eq(`(a) ${calendar.id}, ${work} min werk met ${gaps.length} gat(en): geboekt werk = de duur`,
      Math.abs(bookedMinutes(placed.days) - work) <= WORK_EPS_MIN, true);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (a2) De belasting via de echte plaatsing
// ════════════════════════════════════════════════════════════════════════════════════════════════
// A boekt haar bronwerk binnen haar eigen spanne, dus niets op dinsdag. Haar rest van 0,3 ms boven de volle
// maandag blijft op maandag; wat de belasting daarmee doet, legt deze check niet vast (zie de PR-tekst).
const OPS = effectiveSchedulingOptions({});
function hourTask(id: string, start: string, minutes: number): Task {
  return {
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'],
    time: { ...createDefaultTaskTime(start, minutes / 60, 'hours', DAY), durationMinutes: minutes },
  };
}
{
  const engine = new CalendarEngine(DAY);
  const odd = hourTask('odd', '2026-06-01T08:00', 1920 / 7);
  const a = hourTask('a', '2026-06-01T08:00', 480.000005);
  const b = hourTask('b', '2026-06-02T08:00', 480);
  const tasks = [odd, a, b];
  const solved = solveProject({ tasks, sequences: [], calendar: DAY, calendars: [], schedulingOptions: OPS });
  eq('(a2) geen solverfout', solved.error ?? null, null);
  eq('(a2) solver: A eindigt ma 16:00, B begint di 08:00', [a.time.earlyFinish, b.time.earlyStart],
    ['2026-06-01T16:00', '2026-06-02T08:00']);

  const oddPlaced = taskLoadPlacement(odd, engine, OPS);
  eq('(a2) taskLoadPlacement 1920/7 min = addWorkMinutes',
    oddPlaced && iso(oddPlaced.finish), iso(engine.addWorkMinutes(parseInstant(odd.time.earlyStart!), 1920 / 7)));
  const aPlaced = taskLoadPlacement(a, engine, OPS);
  eq('(a2) taskLoadPlacement A: alleen maandag, einde = addWorkMinutes',
    aPlaced && [aPlaced.days.map(d => d.iso), iso(aPlaced.finish)],
    [['2026-06-01'], iso(engine.addWorkMinutes(parseInstant(a.time.earlyStart!), 480.000005))]);

  const resources = [{ id: 'r', name: 'r', type: 'LABOR' as const, description: '', maxUnits: 1 }];
  const assignments = [
    { id: 'ra', taskId: 'a', resourceId: 'r', unitsPerDay: 1, curve: 'UNIFORM' as const },
    { id: 'rb', taskId: 'b', resourceId: 'r', unitsPerDay: 1, curve: 'UNIFORM' as const },
  ];
  const load = computeResourceLoad(resources, assignments, [a, b], DAY, [], OPS);
  eq('(a2) belasting: alleen ma en di belast', Object.keys(load.load.r ?? {}).sort(), ['2026-06-01', '2026-06-02']);
  eq('(a2) belasting: dinsdag precies vol en niet overbezet',
    [load.load.r?.['2026-06-02'], (load.overallocatedDays.r ?? []).includes('2026-06-02')], [1, false]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (a3) Een volle dag via de echte openroute (review #694 r1)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Drie niet-gestarte XER-taken van 2,285711 + 2,285711 + 3,428578 u = precies 8 u (de lezer: 137,14266 +
// 137,14266 + 205,71468 = 480 min), alle drie vanaf ma 1 juni 08:00 op één medewerker met capaciteit 1. Geen
// van die duren is een heel aantal ms, en elk einde rondt naar boven af. Boekte de plaatsing de afgeronde
// lengte, dan was maandag 1,0000000347 belast (8,0000003 u), en schoof de nivelleerder B naar dinsdag.
const FULL_DAY_HOURS = ['2.285711', '2.285711', '3.428578'];
const XER_WEEK = '(0||CalendarData()((0||DaysOfWeek()((0||1()())'
  + [2, 3, 4, 5, 6].map(d => `(0||${d}()((0||0(s|08:00|f|16:00)())))`).join('') + '(0||7()())))(0||Exceptions()())))';
const FULL_DAY_XER = [
  'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date', '%R\tP1\tVolle dag\tC1\t2026-06-01 08:00',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tDagkalender\tP1\tCA_Project\t8\t40\t${XER_WEEK}`,
  '%T\tTASK', '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type'
    + '\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  ...FULL_DAY_HOURS.map((h, i) => {
    const code = 'ABC'[i];
    return `%R\tT${i + 1}\tP1\tC1\t${code}\t${code}\tTT_Task\tTK_NotStart\tCP_Phys\t0\t0\t${h}\t${h}`
      + '\t2026-06-01 08:00\t2026-06-01 16:00';
  }),
  '%E',
].join('\n');
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  const store = createAppStoreContext().store;
  const opened = await parseOpenedFile({ name: 'volle-dag.xer', bytes: new TextEncoder().encode(FULL_DAY_XER) });
  store.getState().applyOpenedImport(opened, OPEN);
  store.getState().applySchedulingSettings({
    profile: { id: profile, baseId: profile, name: '', overrides: {} },
    options: store.getState().project.schedulingOptions,
  });
  const r = store.getState().addResource({ name: 'Een medewerker', description: '', type: 'LABOR', maxUnits: 1 });
  const leaves = () => store.getState().tasks.filter(t => !t.isSummary);
  for (const t of leaves()) store.getState().assignResource(t.id, r, 1);
  store.getState().runCPM();
  const s = store.getState();
  eq(`(a3) ${profile}: drie taken van samen 480 min, alle drie vanaf ma 08:00`,
    [leaves().reduce((sum, t) => sum + (t.time.durationMinutes ?? 0), 0), leaves().map(t => t.time.earlyStart)],
    [480, ['2026-06-01T08:00', '2026-06-01T08:00', '2026-06-01T08:00']]);
  const monday = s.resourceLoadResult?.load[r]?.['2026-06-01'] ?? NaN;
  eq(`(a3) ${profile}: maandag belast met precies 1, zonder marge`, [monday <= 1, monday], [true, 1]);
  eq(`(a3) ${profile}: 8 u werk (alleen floatruis)`, Math.abs((s.resourceLoadResult?.hours[r] ?? NaN) - 8) <= 1e-9, true);
  eq(`(a3) ${profile}: geen overbezette dag`, s.resourceLoadResult?.overallocatedDays[r] ?? [], []);
  const level = s.levelResources({ constrainToFloat: false });
  eq(`(a3) ${profile}: de nivelleerder schuift niemand`, [level.delays, level.shifts, level.unresolved], [{}, {}, {}]);
  s.applyLeveling(level);
  const after = store.getState();
  eq(`(a3) ${profile}: na Toepassen staan A, B en C nog op ma 08:00, zonder overbezetting`,
    [leaves().map(t => [t.name, t.time.earlyStart]), after.resourceLoadResult?.overallocatedDays[r] ?? []],
    [[['A', '2026-06-01T08:00'], ['B', '2026-06-01T08:00'], ['C', '2026-06-01T08:00']], []]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (b) De spiegel bij een lengte rond een halve ms
// ════════════════════════════════════════════════════════════════════════════════════════════════
const SMALL = [0, 0.000001, 0.000008, 0.0000083334];
const POINTS: [string, string][] = [
  ['ma 08:00', '2026-06-01T08:00:00Z'], ['ma 12:00', '2026-06-01T12:00:00Z'], ['vr 16:00', '2026-05-29T16:00:00Z'],
];
for (const calendar of CALENDARS) {
  const engine = new CalendarEngine(calendar);
  for (const [name, at] of POINTS) {
    const t = new Date(at);
    // Een band-eind is geen startmoment: `addWorkMinutes` begint daar bij de volgende bandstart.
    const onWorkInstant = engine.nextWorkInstant(t).getTime() === t.getTime();
    for (const m of SMALL) {
      const back = engine.subtractWorkMinutes(engine.addWorkMinutes(t, m), m);
      const want = m < HALF_MS_MIN || onWorkInstant ? t : engine.nextWorkInstant(t);
      eq(`(b) ${calendar.id}, ${name}, m = ${m}: terug op ${iso(want)}`, iso(back), iso(want));
      eq(`(b) ${calendar.id}, ${name}, m = ${m}: geen werktijd tussen start en terugweg`,
        engine.workMinutesBetween(t, back), 0);
    }
  }
}
{
  // Het geval uit de knownbug, letterlijk.
  const engine = new CalendarEngine(DAY);
  const there = engine.addWorkMinutes(MONDAY, 0.000001);
  eq('(b) knownbug 391: 0,000001 min vanaf ma 1 juni 08:00 heen en terug',
    [iso(there), iso(engine.subtractWorkMinutes(there, 0.000001))],
    ['2026-06-01T08:00:00.000Z', '2026-06-01T08:00:00.000Z']);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (b2) Onder een halve ms is precies hetzelfde als 0, in beide richtingen
// ════════════════════════════════════════════════════════════════════════════════════════════════
const ALL_POINTS: [string, string][] = [
  ...POINTS, ['ma 07:00', '2026-06-01T07:00:00Z'], ['ma 16:00', '2026-06-01T16:00:00Z'],
  ['ma 12:30', '2026-06-01T12:30:00Z'], ['za 10:00', '2026-05-30T10:00:00Z'],
];
const BELOW_HALF = [0.000001, 0.000008, 0.0000083333];
for (const calendar of CALENDARS) {
  const engine = new CalendarEngine(calendar);
  for (const [name, at] of ALL_POINTS) {
    const t = new Date(at);
    for (const m of BELOW_HALF) {
      eq(`(b2) ${calendar.id}, ${name}: addWorkMinutes(t, ${m}) = addWorkMinutes(t, 0)`,
        iso(engine.addWorkMinutes(t, m)), iso(engine.addWorkMinutes(t, 0)));
      eq(`(b2) ${calendar.id}, ${name}: subtractWorkMinutes(t, ${m}) = subtractWorkMinutes(t, 0)`,
        iso(engine.subtractWorkMinutes(t, m)), iso(engine.subtractWorkMinutes(t, 0)));
      const placed = workPlacement(engine, { start: t, duration: m, measure: 'minutes' });
      eq(`(b2) ${calendar.id}, ${name}: plaatsing van ${m} min is leeg, einde = addWorkMinutes`,
        [placed.days.length, iso(placed.finish)], [0, iso(engine.addWorkMinutes(t, m))]);
    }
  }
  // De grens ligt op de goede plek: net boven een halve ms is 1 ms.
  eq(`(b2) ${calendar.id}: 0,0000083334 min vanaf ma 08:00 is 1 ms`,
    iso(engine.addWorkMinutes(MONDAY, 0.0000083334)), '2026-06-01T08:00:00.001Z');
}

if (errors.length) {
  for (const e of errors) console.log(`XX kalender-ms-randen: ${e}`);
  console.log(`XX kalender-ms-randen: ${errors.length} van ${checks} controles rood`);
  process.exitCode = 1;
} else {
  console.log(`OK kalender-ms-randen: ${checks} controles groen`);
}
