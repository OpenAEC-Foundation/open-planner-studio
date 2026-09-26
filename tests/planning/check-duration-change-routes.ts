// check-duration-change-routes.ts — issue #146-vervolg: een duurwijziging heeft dezelfde GEVOLGEN
// langs elke schrijfroute. De regels staan sinds deze fix op één plek (`applyDurationChangeRules`
// in taskDefaults.ts); vóór die tijd stonden ze drie keer uitgeschreven en kreeg alleen
// `taskSlice.updateTask` de afknipregel voor gebruikersgaten. Een duurkrimp via het taakraster liet
// een gebruikersgat voorbij het nieuwe werktotaal liggen, waarna de taak voor splits stil
// ALLEEN-LEZEN was (`canSplitTask` ⇒ 'not-editable').
//
// Hier: de store (`updateTask`, zoals het eigenschappenpaneel schrijft) als referentie tegen het
// taakraster via de ECHTE gridtransactie (`runGridMutation`), in beide invoervormen van de duurcel
// (het eenheidsobject van `parseTaskDurationInput` en de minutenvorm van samengestelde invoer en
// plakken) plus de mijlpaalcel. Dag- én uurtaak. De MCP-route (`planner_update_tasks` via de echte
// dispatch) staat in tests/mcp/cases-splits.ts.
//
// Elk scenario krijgt per route een EIGEN verse `createAppStoreContext()`.
//
// MOET de eerste import blijven: zie domStub.ts.
import './domStub';
import { createAppStoreContext, type AppState } from '@/state/appStore';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task, TaskTimephasedContour } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { parseTaskDurationInput } from '@/utils/taskDurationInput';
import { canSplitTask, type SplitPiece } from '@/engine/scheduler/splitEdit';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const BANDS = [{ start: 480, end: 960 }]; // 08:00–16:00 ⇒ 8 u/dag
const WEEK: WorkTimeBands = { byWeekday: { 1: BANDS, 2: BANDS, 3: BANDS, 4: BANDS, 5: BANDS, 6: [], 7: [] } };
const HOUR_CAL: WorkCalendar = {
  id: 'cal-uren', name: 'uren', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: WEEK,
};
const DAY = 480;
const HOUR = 60;
const work = (minutes: number): SplitPiece => ({ kind: 'work', minutes });
const gap = (minutes: number): SplitPiece => ({ kind: 'gap', minutes, source: 'user' });

type Kind = 'day' | 'hour';
type Route = 'store' | 'grid-unit' | 'grid-minutes';
const ROUTES: readonly Route[] = ['store', 'grid-unit', 'grid-minutes'];

/** Contourprofiel met één periode per werkslot, zoals een import het aanlevert (alleen resterend werk). */
function contourOf(periods: readonly { afterMinutes: number; minutes: number }[]): TaskTimephasedContour[] {
  return [{
    resourceUid: null,
    periods: periods.map(p => ({ ...p, workMinutes: p.minutes, kind: 'remaining' as const })),
  }];
}

interface Scenario {
  label: string;
  kind: Kind;
  /** Werkduur vóór de bewerking, in de eenheid van de taak (dagen of uren). */
  from: number;
  pieces: SplitPiece[];
  contour?: TaskTimephasedContour[];
  /** Werkduur ná de bewerking, in de eenheid van de taak. */
  to: number;
  /** Verwachte `splitGaps` na de bewerking — onafhankelijk van de store vastgelegd. */
  expected: unknown;
}

/** Verse context met één gesplitste taak, gesplitst via de ENE schrijfweg `setTaskSplits`. */
function setup(sc: Scenario): { S: () => AppState; id: string } {
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  if (sc.kind === 'hour') {
    S().setCalendar(HOUR_CAL);
    ctx.store.setState((s) => { s.ui.enableHourPlanning = true; });
  }
  const id = sc.kind === 'day'
    ? S().addTask({ name: sc.label, time: createDefaultTaskTime('2026-06-01', sc.from) })
    : S().addTask({
      name: sc.label,
      time: { ...createDefaultTaskTime('2026-06-01T08:00', sc.from / 8, 'hours'), durationUnit: 'hours', durationMinutes: sc.from * HOUR },
    });
  const refusal = S().setTaskSplits(id, sc.pieces);
  if (refusal) diffs.push(`${sc.label}: setTaskSplits weigerde de fixture (${refusal})`);
  if (sc.contour) {
    const contour = sc.contour;
    ctx.store.setState((s) => { s.tasks.find(t => t.id === id)!.timephasedContours = contour; });
  }
  return { S, id };
}

const unitOf = (sc: Scenario) => (sc.kind === 'day' ? DAY : HOUR);

function cell(taskId: string, columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route, value };
}

/** Eén duurwijziging langs `route`. De store-vorm spiegelt `TaskDurationField.apply`. */
function applyDuration(S: () => AppState, id: string, sc: Scenario, route: Route): void {
  const task = S().tasks.find(t => t.id === id)!;
  if (route === 'store') {
    S().updateTask(id, {
      time: sc.kind === 'day'
        ? { ...task.time, durationUnit: 'days', scheduleDuration: sc.to, durationMinutes: undefined }
        : { ...task.time, durationUnit: 'hours', durationMinutes: sc.to * HOUR, scheduleDuration: sc.to / 8 },
    });
    return;
  }
  const value = route === 'grid-unit'
    ? parseTaskDurationInput(sc.kind === 'day' ? `${sc.to}d` : `${sc.to}h`, sc.kind === 'day' ? 'days' : 'hours')
    : sc.to * (sc.kind === 'day' ? DAY : HOUR);
  const res = S().runGridMutation([cell(id, 'task.time.scheduleDuration', 'task-schedule', value)]);
  if (!res.ok) diffs.push(`${sc.label} [${route}]: gridtransactie geweigerd ${JSON.stringify(res)}`);
}

interface Outcome { splitGaps: unknown; scheduleDuration: number; durationMinutes?: number; contours: unknown; refusal: unknown }

function outcomeOf(task: Task): Outcome {
  return {
    splitGaps: task.splitGaps ?? null,
    scheduleDuration: task.time.scheduleDuration,
    durationMinutes: task.time.durationMinutes,
    contours: task.timephasedContours ?? null,
    refusal: canSplitTask(task, 8, false),
  };
}

function runScenario(sc: Scenario): void {
  console.log(`-- duration-change-routes: ${sc.label} --`);
  const results = new Map<Route, Outcome>();
  for (const route of ROUTES) {
    const { S, id } = setup(sc);
    applyDuration(S, id, sc, route);
    const task = S().tasks.find(t => t.id === id)!;
    const outcome = outcomeOf(task);
    results.set(route, outcome);
    eq(`${sc.label} [${route}] splitGaps`, outcome.splitGaps, sc.expected ?? null);
    eq(`${sc.label} [${route}] de taak blijft splitsbaar (canSplitTask)`, outcome.refusal, null);
    // Het bewijs dat de taak werkelijk bewerkbaar is: een nieuwe split via de ENE schrijfweg slaagt.
    const again = S().setTaskSplits(id, [work(unitOf(sc)), gap(unitOf(sc)), work((sc.to - 1) * unitOf(sc))]);
    eq(`${sc.label} [${route}] daarna een nieuwe split zetten`, again, null);
  }
  const ref = results.get('store')!;
  for (const route of ROUTES) {
    if (route === 'store') continue;
    eq(`${sc.label} [${route}] zelfde uitkomst als updateTask`, results.get(route), ref);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Dagtaak
// ═══════════════════════════════════════════════════════════════════════════
runScenario({
  label: 'dag: krimp 10 → 5, gat na 7 werkdagen vervalt',
  kind: 'day', from: 10, to: 5,
  pieces: [work(7 * DAY), gap(2 * DAY), work(3 * DAY)],
  expected: undefined,
});
runScenario({
  label: 'dag: krimp 10 → 5, gat na 2 werkdagen blijft, gat na 7 vervalt',
  kind: 'day', from: 10, to: 5,
  pieces: [work(2 * DAY), gap(DAY), work(5 * DAY), gap(2 * DAY), work(3 * DAY)],
  expected: [{ afterMinutes: 2 * DAY, gapMinutes: DAY, source: 'user' }],
});
runScenario({
  label: 'dag: verlenging 10 → 12 laat het gat ongemoeid',
  kind: 'day', from: 10, to: 12,
  pieces: [work(7 * DAY), gap(2 * DAY), work(3 * DAY)],
  expected: [{ afterMinutes: 7 * DAY, gapMinutes: 2 * DAY, source: 'user' }],
});
runScenario({
  // Mét contour schaalt `rescaleTaskContours` het gat mee (factor ½, gesnapt op hele werkdagen):
  // na 3,5 → 4 werkdagen, pauze 1 werkdag. Afknippen is dan niet aan de orde.
  label: 'dag: krimp 10 → 5 met contour schaalt het gat mee i.p.v. af te knippen',
  kind: 'day', from: 10, to: 5,
  pieces: [work(7 * DAY), gap(2 * DAY), work(3 * DAY)],
  contour: contourOf([0, 1, 2, 3, 4, 5, 6, 9, 10, 11].map(d => ({ afterMinutes: d * DAY, minutes: DAY }))),
  expected: [{ afterMinutes: 4 * DAY, gapMinutes: DAY, source: 'user' }],
});

// ═══════════════════════════════════════════════════════════════════════════
// Uurtaak (urenkalender, Urenplanning aan)
// ═══════════════════════════════════════════════════════════════════════════
runScenario({
  label: 'uur: krimp 16 → 10 u, gat na 12 u vervalt',
  kind: 'hour', from: 16, to: 10,
  pieces: [work(12 * HOUR), gap(2 * HOUR), work(4 * HOUR)],
  expected: undefined,
});
runScenario({
  label: 'uur: krimp 16 → 10 u, gat na 4 u blijft, gat na 12 u vervalt',
  kind: 'hour', from: 16, to: 10,
  pieces: [work(4 * HOUR), gap(HOUR), work(8 * HOUR), gap(2 * HOUR), work(4 * HOUR)],
  expected: [{ afterMinutes: 4 * HOUR, gapMinutes: HOUR, source: 'user' }],
});
runScenario({
  label: 'uur: verlenging 16 → 20 u laat het gat ongemoeid',
  kind: 'hour', from: 16, to: 20,
  pieces: [work(12 * HOUR), gap(2 * HOUR), work(4 * HOUR)],
  expected: [{ afterMinutes: 12 * HOUR, gapMinutes: 2 * HOUR, source: 'user' }],
});
runScenario({
  // Factor 10/16: na 12 u ⇒ 7,5 → 8 u, pauze 2 u ⇒ 1,25 → 1 u (gesnapt op hele uren).
  label: 'uur: krimp 16 → 10 u met contour schaalt het gat mee i.p.v. af te knippen',
  kind: 'hour', from: 16, to: 10,
  pieces: [work(12 * HOUR), gap(2 * HOUR), work(4 * HOUR)],
  contour: contourOf([
    { afterMinutes: 0, minutes: DAY }, { afterMinutes: DAY, minutes: 4 * HOUR }, { afterMinutes: 14 * HOUR, minutes: 4 * HOUR },
  ]),
  expected: [{ afterMinutes: 8 * HOUR, gapMinutes: HOUR, source: 'user' }],
});

// ═══════════════════════════════════════════════════════════════════════════
// Mijlpaal aanzetten = duur 0: ook dat is een duurwijziging. Store (contextmenu/paneel/dialoog via
// `taskMilestoneTransition`) tegen de mijlpaalcel van het raster.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- duration-change-routes: mijlpaal aanzetten laat geen gebruikersgat achter --');
{
  const sc: Scenario = {
    label: 'mijlpaal', kind: 'day', from: 10, to: 0,
    pieces: [work(7 * DAY), gap(2 * DAY), work(3 * DAY)], expected: undefined,
  };
  const outcomes: unknown[] = [];
  for (const route of ['store', 'grid'] as const) {
    const { S, id } = setup(sc);
    if (route === 'store') S().updateTask(id, taskMilestoneTransition(S().tasks.find(t => t.id === id)!, true));
    else {
      const res = S().runGridMutation([cell(id, 'task.isMilestone', 'task-milestone', true)]);
      ok(`mijlpaal [grid]: gridtransactie geslaagd ${JSON.stringify(res)}`, res.ok);
    }
    const task = S().tasks.find(t => t.id === id)!;
    ok(`mijlpaal [${route}]: de taak is een mijlpaal met duur 0`, task.isMilestone && task.time.scheduleDuration === 0);
    eq(`mijlpaal [${route}]: geen gebruikersgat meer`, task.splitGaps ?? null, null);
    outcomes.push(task.splitGaps ?? null);
  }
  eq('mijlpaal: raster = store', outcomes[1], outcomes[0]);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  duration-change-routes: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  duration-change-routes: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
