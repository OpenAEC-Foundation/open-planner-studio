// Toewijzingswijziging — ÉÉN set gevolgregels over alle routes (headless tegen de ECHTE store en de
// ECHTE gridtransactie).
//
// Nivelleren schrijft nivelleerpauzes (`splitGaps` met `source: 'leveling'`) die bij de toewijzingen
// van dát moment horen; een .mpp-import schrijft MSP-sturing (laag 3 `timephasedFinishFloor`/
// `timephasedStartAnchor`, laag 4 `timephasedDurationWalks`) die dat óók doen. Verandert de
// toewijzingenset van een taak, dan gelden de gevolgregels van `invalidateForAssignmentChange`
// (`taskDefaults.ts`): laag 3 + laag 4 wissen, nivelleergaten wissen, importsplits (gaten zónder
// `source`) laten staan, en melden wanneer er MSP-sturing verloren ging.
//
// De store-acties `assignResource`/`unassignResource` deden dat al; deze batterij pint dat ELKE route
// dezelfde uitkomst geeft:
//   A. taakraster, kolom "Toegewezen resources" — toevoegen en verwijderen (gridtransactie) gaven
//      vóór de fix de nivelleerpauze NIET vrij (andere EF dan de store);
//   B. `removeResource` — verwijderde de toewijzingen zonder enige invalidatie (nivelleerpauze én
//      laag 3/4 bleven staan, geen melding), terwijl `unassignResource` per toewijzing beide wist;
//   C. taken zonder die resource blijven ongemoeid; een resource zonder toewijzingen raakt niets.
// De MCP-kant (`planner_manage_resources` delete) staat in `tests/mcp/cases-assignment-invalidation.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { __resetTimephasedLossNoticeForTests } from '@/state/timephasedLossNotice';
import type { Task, TaskSplitGap } from '@/types/task';
import type { AssignmentSetIntent, TaskAssignmentToken } from '@/types/taskGrid';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

type Store = ReturnType<typeof createAppStore>;

/** Importsplit (geen `source`): brondata, blijft altijd staan. */
const IMPORT_SPLIT: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
/** Nivelleerpauze zoals `writeLevelingResult` die schrijft. */
const LEVELING_GAP: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
const LOST_KEY = 'notifications.mppTimephasedSteeringLost';

/** Wat een toewijzingswijziging mag raken: gaten + laag 3 + laag 4. */
function steering(task: Task) {
  return {
    splitGaps: task.splitGaps ?? null,
    floor: task.timephasedFinishFloor ?? null,
    anchor: task.timephasedStartAnchor ?? null,
    walks: task.timephasedDurationWalks ?? null,
  };
}
/** De verwachte toestand ná een toewijzingswijziging: alleen de importsplit blijft. */
const CLEARED = { splitGaps: [IMPORT_SPLIT], floor: null, anchor: null, walks: null };

/** Zet nivelleeruitvoer (+ optioneel MSP-sturing) rechtstreeks op de taak — dit is wat een eerdere
 *  nivellering resp. een .mpp-import achterlaat; geen enkele bewerkroute schrijft deze velden. */
function seed(store: Store, taskId: string, withMsp: boolean): void {
  store.setState((s) => {
    const t = s.tasks.find((x) => x.id === taskId)!;
    t.splitGaps = [{ ...IMPORT_SPLIT }, { ...LEVELING_GAP }];
    if (withMsp) {
      t.timephasedFinishFloor = '2026-06-10T17:00';
      t.timephasedStartAnchor = '2026-06-01T08:00';
      t.timephasedDurationWalks = [{ anchor: '2026-06-01T08:00', resourceCalendarId: s.calendar.id, workMinutes: 2400 }];
    }
  });
}

function clean(store: Store): void {
  __resetTimephasedLossNoticeForTests();
  store.setState((s) => {
    s.ui.notifications = [];
    s.historyEvents = [];
    s.nextHistorySequence = 1;
  });
}

function notices(store: Store): { key: string; count: unknown }[] {
  return store.getState().ui.notifications
    .filter((n) => n.messageKey === LOST_KEY)
    .map((n) => ({ key: n.messageKey, count: n.params?.count }));
}

function taskOf(store: Store, id: string): Task {
  return store.getState().tasks.find((t) => t.id === id)!;
}

function assignmentIntent(taskId: string, tokens: readonly TaskAssignmentToken[]): AssignmentSetIntent {
  return { kind: 'assignment-set', taskId, columnId: taskColumnId('assignment.resources'), tokens };
}

// ── A. Eén taak, één toewijzing: store-route als referentie, taakraster moet hetzelfde doen ──────────
interface Single { store: Store; t: string; r1: string; r2: string; a1: string }
function single(withMsp: boolean): Single {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const t = S().addTask({ name: 'T', time: createDefaultTaskTime('2026-06-01', 5) });
  const r1 = S().addResource({ name: 'R1', type: 'LABOR', description: '', maxUnits: 1 });
  const r2 = S().addResource({ name: 'R2', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(t, r1, 1);
  const a1 = S().assignments.find((a) => a.taskId === t)!.id;
  seed(store, t, withMsp);
  S().runCPM();
  clean(store);
  return { store, t, r1, r2, a1 };
}

type Route = 'store' | 'grid';
function runSingle(route: Route, op: 'add' | 'remove', withMsp: boolean) {
  const f = single(withMsp);
  const S = () => f.store.getState();
  const efBefore = taskOf(f.store, f.t).time.earlyFinish;
  let gridOk: boolean | null = null;
  if (route === 'store') {
    if (op === 'add') S().assignResource(f.t, f.r2, 1);
    else S().unassignResource(f.a1);
  } else {
    const tokens: TaskAssignmentToken[] = op === 'add'
      ? [{ assignmentId: f.a1, resourceId: f.r1, unitsPerDay: 1 }, { resourceId: f.r2, unitsPerDay: 1 }]
      : [];
    gridOk = S().runGridMutation([assignmentIntent(f.t, tokens)]).ok;
  }
  const afterEdit = steering(taskOf(f.store, f.t));
  const noticesAfter = notices(f.store);
  S().runCPM();
  return {
    gridOk,
    steering: afterEdit,
    notices: noticesAfter,
    resourceIds: taskOf(f.store, f.t).resourceIds.length,
    efBefore,
    efAfter: taskOf(f.store, f.t).time.earlyFinish,
  };
}

for (const op of ['add', 'remove'] as const) {
  for (const withMsp of [true, false]) {
    const tag = `${op}${withMsp ? ' + MSP-sturing' : ' (alleen nivelleerpauze)'}`;
    const viaStore = runSingle('store', op, withMsp);
    const viaGrid = runSingle('grid', op, withMsp);
    const wantNotices = withMsp ? [{ key: LOST_KEY, count: 1 }] : [];
    eq(`A ${tag}: gridtransactie slaagt`, viaGrid.gridOk, true);
    eq(`A ${tag}: store wist nivelleerpauze + laag 3/4, importsplit blijft (referentie)`,
      viaStore.steering, CLEARED);
    eq(`A ${tag}: taakraster wist nivelleerpauze + laag 3/4, importsplit blijft`, viaGrid.steering, CLEARED);
    eq(`A ${tag}: store meldt verloren MSP-sturing alleen als die er was (referentie)`, viaStore.notices, wantNotices);
    eq(`A ${tag}: taakraster meldt verloren MSP-sturing zoals de store`, viaGrid.notices, wantNotices);
    eq(`A ${tag}: taakraster en store komen op dezelfde vroege einddatum`, viaGrid.efAfter, viaStore.efAfter);
    eq(`A ${tag}: taakraster en store houden dezelfde resourceIds`, viaGrid.resourceIds, viaStore.resourceIds);
  }
}
// De meting uit de bugmelding, in absolute datums: 5 werkdagen vanaf ma 2026-06-01 eindigen op vr
// 06-05; de importsplit (1 dag) maakt dat ma 06-08, de nivelleerpauze (1 dag) di 06-09. Na de
// toewijzingswijziging hoort alleen de importsplit mee te tellen ⇒ 06-08 (vóór de fix bleef het
// taakraster op 06-09 staan).
{
  const viaGrid = runSingle('grid', 'remove', false);
  eq('A meting: vóór de bewerking EF 2026-06-09 (importsplit + nivelleerpauze tellen mee)', viaGrid.efBefore, '2026-06-09');
  eq('A meting: na verwijderen via het taakraster EF 2026-06-08 (alleen de importsplit telt nog)', viaGrid.efAfter, '2026-06-08');
}

// ── B. removeResource: elke taak die de resource droeg krijgt de toewijzingen-trigger ─────────────────
interface Multi { store: Store; t1: string; t2: string; t3: string; t4: string; r1: string; r2: string; r3: string }
/** T1: alleen R1. T2: R1 + R2. T3: alleen R2 (bystander). T4: geen toewijzing (bystander). R3: geen
 *  toewijzingen. Alle vier de taken dragen nivelleerpauze + importsplit (+ MSP-sturing). */
function multi(withMsp: boolean): Multi {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const t1 = S().addTask({ name: 'T1', time: createDefaultTaskTime('2026-06-01', 5) });
  const t2 = S().addTask({ name: 'T2', time: createDefaultTaskTime('2026-06-01', 5) });
  const t3 = S().addTask({ name: 'T3', time: createDefaultTaskTime('2026-06-01', 5) });
  const t4 = S().addTask({ name: 'T4', time: createDefaultTaskTime('2026-06-01', 5) });
  const r1 = S().addResource({ name: 'R1', type: 'LABOR', description: '', maxUnits: 1 });
  const r2 = S().addResource({ name: 'R2', type: 'LABOR', description: '', maxUnits: 1 });
  const r3 = S().addResource({ name: 'R3', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(t1, r1, 1);
  S().assignResource(t2, r1, 1);
  S().assignResource(t2, r2, 1);
  S().assignResource(t3, r2, 1);
  for (const t of [t1, t2, t3, t4]) seed(store, t, withMsp);
  S().runCPM();
  clean(store);
  return { store, t1, t2, t3, t4, r1, r2, r3 };
}

for (const withMsp of [true, false]) {
  const tag = withMsp ? '+ MSP-sturing' : '(alleen nivelleerpauze)';
  // Referentie: dezelfde toewijzingen één voor één via unassignResource.
  const ref = multi(withMsp);
  for (const a of ref.store.getState().assignments.filter((x) => x.resourceId === ref.r1)) {
    ref.store.getState().unassignResource(a.id);
  }
  const f = multi(withMsp);
  const bystanderBefore = [steering(taskOf(f.store, f.t3)), steering(taskOf(f.store, f.t4))];
  f.store.getState().removeResource(f.r1);

  eq(`B ${tag}: removeResource laat R1 en zijn toewijzingen verdwijnen`, {
    resource: f.store.getState().resources.some((r) => r.id === f.r1),
    assignments: f.store.getState().assignments.filter((a) => a.resourceId === f.r1).length,
  }, { resource: false, assignments: 0 });
  for (const [label, id] of [['T1', f.t1], ['T2', f.t2]] as const) {
    eq(`B ${tag}: removeResource wist nivelleerpauze + laag 3/4 op ${label}, importsplit blijft`,
      steering(taskOf(f.store, id)), CLEARED);
    const refId = label === 'T1' ? ref.t1 : ref.t2;
    eq(`B ${tag}: removeResource geeft op ${label} dezelfde uitkomst als unassignResource`,
      steering(taskOf(f.store, id)), steering(taskOf(ref.store, refId)));
  }
  eq(`B ${tag}: T2 houdt zijn R2-toewijzing en resourceIds`, {
    assignments: f.store.getState().assignments.filter((a) => a.taskId === f.t2).map((a) => a.resourceId),
    resourceIds: taskOf(f.store, f.t2).resourceIds,
  }, { assignments: [f.r2], resourceIds: [f.r2] });
  eq(`B ${tag}: taken zonder R1 (T3 met R2, T4 zonder toewijzing) blijven ongemoeid`,
    [steering(taskOf(f.store, f.t3)), steering(taskOf(f.store, f.t4))], bystanderBefore);
  eq(`B ${tag}: bystanders dragen nog steeds hun nivelleerpauze`,
    taskOf(f.store, f.t3).splitGaps, [IMPORT_SPLIT, LEVELING_GAP]);
  // Meldingspatroon: zoals de store dat per bewerking doet (één melding, `count` = aantal taken dat
  // sturing verloor — zie `moveAssignment`/`removeCalendar`), en ALLEEN bij echt verloren MSP-sturing.
  eq(`B ${tag}: removeResource meldt verloren MSP-sturing zoals unassignResource`,
    notices(f.store), withMsp ? [{ key: LOST_KEY, count: 2 }] : []);
  eq(`B ${tag}: unassignResource-referentie meldde evengoed (eenmalig per document)`,
    notices(ref.store).length, withMsp ? 1 : 0);

  f.store.getState().runCPM();
  ref.store.getState().runCPM();
  eq(`B ${tag}: dezelfde vroege einddatums als de unassignResource-referentie`,
    [f.t1, f.t2, f.t3, f.t4].map((id) => taskOf(f.store, id).time.earlyFinish),
    [ref.t1, ref.t2, ref.t3, ref.t4].map((id) => taskOf(ref.store, id).time.earlyFinish));

  // Eén undo-stap zet ALLES terug, ook de gewiste sturing.
  f.store.getState().undo();
  eq(`B ${tag}: één undo herstelt resource, toewijzingen en de gewiste sturing`, {
    resource: f.store.getState().resources.some((r) => r.id === f.r1),
    t1: taskOf(f.store, f.t1).splitGaps,
    t1Floor: taskOf(f.store, f.t1).timephasedFinishFloor ?? null,
  }, { resource: true, t1: [IMPORT_SPLIT, LEVELING_GAP], t1Floor: withMsp ? '2026-06-10T17:00' : null });
}

// ── C. Resource zonder toewijzingen verwijderen raakt geen enkele taak ─────────────────────────────
{
  const f = multi(true);
  const before = [f.t1, f.t2, f.t3, f.t4].map((id) => steering(taskOf(f.store, id)));
  f.store.getState().removeResource(f.r3);
  eq('C removeResource zonder toewijzingen: resource weg', f.store.getState().resources.some((r) => r.id === f.r3), false);
  eq('C removeResource zonder toewijzingen: geen enkele taak geraakt',
    [f.t1, f.t2, f.t3, f.t4].map((id) => steering(taskOf(f.store, id))), before);
  eq('C removeResource zonder toewijzingen: geen melding', notices(f.store), []);
}

if (diffs.length) {
  console.error(`FAIL assignment-invalidation: ${diffs.length}/${checks}`);
  for (const d of diffs) console.error(`XX ${d}`);
  process.exit(1);
}
console.log(`OK  assignment-invalidation: ${checks} checks groen`);
