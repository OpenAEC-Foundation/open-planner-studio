// check-contour-unit-switch.ts — aanval a04 na #600 (knownbug 265): dezelfde kalendertijd in een andere
// eenheid mag contour en splits niet herschalen.
//
// Invoer uit het rapport: kalender ma–vr 08:00–16:00, taak Uitharden in kalendertijd van ma 1 juni 2026
// 00:00 tot wo 3 juni 00:00 (2 d = 48 klokuren). Toezicht (capaciteit 3) heeft een contour van 240 min op
// maandag en 480 min op dinsdag: samen 12 u. De eenheidskeuze naar uren schrijft `durationUnit: 'hours'`,
// `durationMinutes: 2880` en het verborgen dagengetal 6. Begin en einde blijven gelijk.
//
// Vóór de fix mat de herschaling de oude duur als 2 × 480 = 960 werkminuten en de nieuwe als 2880
// klokminuten: de contour werd 2160 min (36 u), de belasting op dinsdag 4 (overallocatie), en opslaan
// bewaarde dat. Nu meten vóór en na op dezelfde as (`taskAxisMinutes`: klokdagen × werktijd per dag).
//
// Routes: de store (`updateTask` met de patch van de eenheidskeuze) en het taakraster (de eenheidscel en
// de duurcel via de echte gridtransactie), plus opslaan en heropenen via IFC. De MCP-route
// (`planner_update_tasks` via de echte dispatch) staat in tests/mcp/cases-contour-eenheidswissel.ts.
//
// MOET de eerste import blijven: zie domStub.ts.
import './domStub';
import { createAppStoreContext, type AppState } from '@/state/appStore';
import { makeBands } from '@/utils/effectiveWorkTime';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { parseTaskDurationInput } from '@/utils/taskDurationInput';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime, TimephasedContourPeriod } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }

// ── Fixture uit het rapport ─────────────────────────────────────────────────
const CAL: WorkCalendar = {
  id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16,
  hoursPerDay: 8, holidays: [], workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
};
const RESOURCE: Resource = { id: 'r', name: 'Toezicht', description: '', type: 'LABOR', maxUnits: 3 };
const ASSIGNMENT: ResourceAssignment = { id: 'a', taskId: 't', resourceId: 'r', unitsPerDay: 1 };
const DAYS_TIME: TaskTime = {
  durationType: 'ELAPSEDTIME', durationUnit: 'days', scheduleDuration: 2,
  scheduleStart: '2026-06-01T00:00', scheduleFinish: '2026-06-03T00:00',
  earlyStart: '2026-06-01T00:00', earlyFinish: '2026-06-03T00:00',
  lateStart: '2026-06-01T00:00', lateFinish: '2026-06-03T00:00',
  freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
};
/** Dezelfde 48 klokuren in de urenmaat, zoals de eenheidskeuze ze schrijft (verborgen dagengetal 6). */
const HOURS_TIME: TaskTime = { ...DAYS_TIME, durationUnit: 'hours', durationMinutes: 2880, scheduleDuration: 6 };
const remaining = (afterMinutes: number, minutes: number, workMinutes: number): TimephasedContourPeriod =>
  ({ afterMinutes, minutes, workMinutes, kind: 'remaining' });
const actual = (afterMinutes: number, minutes: number, workMinutes: number): TimephasedContourPeriod =>
  ({ afterMinutes, minutes, workMinutes, kind: 'actual' });
/** 240 min op maandag, 480 op dinsdag: 12 u, op de as van één slot van 480 per werkdag. */
const CONTOUR: TimephasedContourPeriod[] = [remaining(0, 480, 240), remaining(480, 480, 480)];

function taskWith(time: TaskTime, periods: TimephasedContourPeriod[]): Task {
  return {
    id: 't', name: 'Uitharden', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'], time: { ...time },
    timephasedContours: [{ resourceUid: null, resourceId: 'r', periods: periods.map(p => ({ ...p })) }],
  };
}

function storeWith(task: Task): () => AppState {
  const { store } = createAppStoreContext();
  store.setState({
    calendar: CAL, calendars: [], tasks: [task], resources: [{ ...RESOURCE }], assignments: [{ ...ASSIGNMENT }],
    sequences: [], project: { ...store.getState().project, startDate: '2026-06-01' },
  });
  return store.getState;
}

function cell(columnId: string, value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId: 't', columnId: columnId as CellEditIntent['columnId'], route: 'task-schedule', value };
}

function periodsOf(S: () => AppState): TimephasedContourPeriod[] {
  return S().tasks[0].timephasedContours?.[0]?.periods ?? [];
}
const workOf = (periods: readonly TimephasedContourPeriod[]): number => periods.reduce((n, p) => n + p.workMinutes, 0);

type Route = 'store' | 'raster-eenheid' | 'raster-duur';

/** Eén bewerking naar `target` langs `route`. De store krijgt de patch van de eenheidskeuze of de duur. */
function edit(S: () => AppState, route: Route, target: { unit: 'days'; days: number } | { unit: 'hours'; hours: number }): void {
  const t = S().tasks[0];
  if (route === 'store') {
    S().updateTask('t', {
      time: target.unit === 'hours'
        ? { ...t.time, durationUnit: 'hours', durationMinutes: target.hours * 60, scheduleDuration: target.hours * 60 / 480 }
        : { ...t.time, durationUnit: 'days', scheduleDuration: target.days, durationMinutes: undefined },
    });
    return;
  }
  const intent = route === 'raster-eenheid'
    ? cell('task.time.durationUnit', target.unit)
    : cell('task.time.scheduleDuration', parseTaskDurationInput(
      target.unit === 'hours' ? `${target.hours}h` : `${target.days}d`, target.unit));
  const res = S().runGridMutation([intent]);
  if (!res.ok) diffs.push(`${route}: gridtransactie geweigerd ${JSON.stringify(res)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Dezelfde 48 klokuren: dagen → uren en uren → dagen laten de contour staan
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- contour-unit-switch: dezelfde kalendertijd in een andere eenheid --');
for (const route of ['store', 'raster-eenheid', 'raster-duur'] as const) {
  // Dagen → uren (het geval uit het rapport).
  {
    const S = storeWith(taskWith(DAYS_TIME, CONTOUR));
    S().runCPM();
    eq(`[${route}] d→u: belasting vooraf`, S().resourceLoadResult?.load.r, { '2026-06-01': 0.5, '2026-06-02': 1 });
    edit(S, route, { unit: 'hours', hours: 48 });
    const t = S().tasks[0].time;
    eq(`[${route}] d→u: de taak staat in de urenmaat, 2880 klokminuten`, [t.durationUnit, t.durationMinutes], ['hours', 2880]);
    eq(`[${route}] d→u: contour ongewijzigd`, periodsOf(S), CONTOUR);
    eq(`[${route}] d→u: contourwerk 720 min`, workOf(periodsOf(S)), 720);
    S().runCPM();
    const load = S().resourceLoadResult;
    eq(`[${route}] d→u: belasting ma 0,5 en di 1`, load?.load.r, { '2026-06-01': 0.5, '2026-06-02': 1 });
    eq(`[${route}] d→u: 12 u werk`, load?.hours.r, 12);
    eq(`[${route}] d→u: geen overallocatie`, load?.overallocatedDays, {});
  }
  // Uren → dagen (de omgekeerde wissel): vóór de fix kromp de contour tot een derde.
  {
    const S = storeWith(taskWith(HOURS_TIME, CONTOUR));
    edit(S, route, { unit: 'days', days: 2 });
    const t = S().tasks[0].time;
    eq(`[${route}] u→d: de taak staat in de dagenmaat, 2 d`, [t.durationUnit, t.scheduleDuration], ['days', 2]);
    eq(`[${route}] u→d: contour ongewijzigd`, periodsOf(S), CONTOUR);
  }
}

// Een importgat (zonder `source`) schaalt met de contour mee (`rescaleSplitGaps`): bij dezelfde
// klokuren blijft het staan. Vóór de fix verschoof het naar 1440 met 720 pauze (d→u) of 160/80 (u→d).
console.log('-- contour-unit-switch: een importgat blijft staan --');
for (const route of ['store', 'raster-eenheid', 'raster-duur'] as const) {
  const GAP = [{ afterMinutes: 480, gapMinutes: 240 }];
  for (const [label, from, to] of [
    ['d→u', DAYS_TIME, { unit: 'hours', hours: 48 }],
    ['u→d', HOURS_TIME, { unit: 'days', days: 2 }],
  ] as const) {
    const S = storeWith({ ...taskWith(from, CONTOUR), splitGaps: GAP.map(g => ({ ...g })) });
    edit(S, route, to);
    eq(`[${route}] ${label}: importgat ongewijzigd`, S().tasks[0].splitGaps, GAP);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Opslaan en heropenen bewaart de 12 u en dezelfde belasting
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- contour-unit-switch: opslaan en heropenen --');
{
  const S = storeWith(taskWith(DAYS_TIME, CONTOUR));
  S().runCPM();
  edit(S, 'store', { unit: 'hours', hours: 48 });
  S().runCPM();
  const s = S();
  const back = readIFC(writeIFC({
    project: s.project, tasks: s.tasks, sequences: s.sequences, calendar: s.calendar,
    resources: s.resources, assignments: s.assignments,
  }));
  const task = back.tasks.find(t => t.name === 'Uitharden');
  ok('heropenen: de taak komt terug', task !== undefined);
  const periods = task?.timephasedContours?.[0]?.periods ?? [];
  eq('heropenen: contourwerk 720 min', workOf(periods), 720);
  eq('heropenen: dezelfde periodes', periods.map(p => [p.afterMinutes, p.minutes, p.workMinutes, p.kind]),
    CONTOUR.map(p => [p.afterMinutes, p.minutes, p.workMinutes, p.kind]));
  eq('heropenen: de urenmaat blijft', [task?.time.durationUnit, task?.time.durationMinutes], ['hours', 2880]);
  const { store } = createAppStoreContext();
  store.setState({
    calendar: back.calendar, calendars: back.resourceCalendars ?? [], tasks: back.tasks, resources: back.resources,
    assignments: back.assignments, sequences: back.sequences, project: back.project,
  });
  store.getState().runCPM();
  const load = store.getState().resourceLoadResult;
  const rid = back.resources.find(r => r.name === 'Toezicht')?.id ?? '';
  eq('heropenen: belasting ma 0,5 en di 1', load?.load[rid], { '2026-06-01': 0.5, '2026-06-02': 1 });
  eq('heropenen: geen overallocatie', load?.overallocatedDays, {});
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Een echte duurwijziging schaalt nog steeds mee, in beide eenheden met dezelfde uitkomst
// ═══════════════════════════════════════════════════════════════════════════
// 48 → 72 klokuren is factor 1,5 op de as: 0..720 met 360 min en 720..1440 met 720 min. Vóór de fix gaf
// 2 d → 72 u factor 4,5 (960 → 4320). Met een actual-periode op de eerste dag groeit alleen de rest, van
// één naar twee dagen (factor 2 op 480..960); vóór de fix gaf 48 u → 72 u daar factor 1,6 (2400 → 3840),
// omdat de klokminuten van de urentaak tegen de as-minuten van de actual werden afgezet.
console.log('-- contour-unit-switch: een echte duurwijziging schaalt in beide eenheden gelijk --');
{
  const longer = [remaining(0, 720, 360), remaining(720, 720, 720)];
  const cases: { label: string; from: TaskTime; to: { unit: 'days'; days: number } | { unit: 'hours'; hours: number } }[] = [
    { label: '2 d → 3 d', from: DAYS_TIME, to: { unit: 'days', days: 3 } },
    { label: '2 d → 72 u', from: DAYS_TIME, to: { unit: 'hours', hours: 72 } },
    { label: '48 u → 72 u', from: HOURS_TIME, to: { unit: 'hours', hours: 72 } },
    { label: '48 u → 3 d', from: HOURS_TIME, to: { unit: 'days', days: 3 } },
  ];
  for (const route of ['store', 'raster-duur'] as const) {
    for (const c of cases) {
      const S = storeWith(taskWith(c.from, CONTOUR));
      edit(S, route, c.to);
      eq(`[${route}] ${c.label}: factor 1,5`, periodsOf(S), longer);
      const withActual = storeWith(taskWith(c.from, [actual(0, 480, 480), remaining(480, 480, 480)]));
      edit(withActual, route, c.to);
      eq(`[${route}] ${c.label} met actual op dag 1: de rest verdubbelt`, periodsOf(withActual),
        [actual(0, 480, 480), remaining(480, 960, 960)]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Werktijd blijft zoals het was: 2 d ↔ 16 u is dezelfde werkduur, 2 d → 24 u is factor 1,5
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- contour-unit-switch: werktijd ongewijzigd --');
{
  const work = (t: TaskTime): TaskTime => ({
    ...t, durationType: 'WORKTIME', scheduleStart: '2026-06-01T08:00', scheduleFinish: '2026-06-02T16:00',
    earlyStart: '2026-06-01T08:00', earlyFinish: '2026-06-02T16:00', lateStart: '2026-06-01T08:00', lateFinish: '2026-06-02T16:00',
  });
  for (const route of ['store', 'raster-duur'] as const) {
    const same = storeWith(taskWith(work(DAYS_TIME), CONTOUR));
    edit(same, route, { unit: 'hours', hours: 16 });
    eq(`[${route}] werktijd 2 d → 16 u: contour ongewijzigd`, periodsOf(same), CONTOUR);
    const longer = storeWith(taskWith(work(DAYS_TIME), CONTOUR));
    edit(longer, route, { unit: 'hours', hours: 24 });
    eq(`[${route}] werktijd 2 d → 24 u: factor 1,5`, periodsOf(longer), [remaining(0, 720, 360), remaining(720, 720, 720)]);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  contour-unit-switch: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  contour-unit-switch: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
