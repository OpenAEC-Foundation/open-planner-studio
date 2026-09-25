// Toewijzingswijziging via MCP — `planner_manage_resources` delete (cascade) moet dezelfde
// gevolgregels toepassen als `planner_manage_assignments` remove: `invalidateForAssignmentChange`
// (`taskDefaults.ts`) op elke taak die daarmee een toewijzing kwijtraakt — laag 3/4 en de
// nivelleerpauzes weg, importsplits blijven, verloren MSP-sturing op de lease geregistreerd zodat
// `envelope.timephasedGuidanceLost` klopt (plus de eenmalige K8a-melding in de app).
//
// Vóór de fix verwijderde `draft.removeResource` (`purgeResource`) de toewijzingen zonder enige
// invalidatie: nivelleerpauze en laag 3/4 bleven staan en de envelop zweeg.
//
// ECHTE dispatch: JSON-RPC `tools/call` via `handleMcpMessage` (schemapoort, runMutateTool, lease,
// eind-runCPM) tegen de echte store. De store- en taakrasterroutes staan in
// `tests/planning/check-assignment-invalidation.ts`.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext } from '@/services/mcp/contracts';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task, TaskSplitGap } from '@/types/task';

const store = useAppStore;
registerAllTools();

// Warm-up (zelfde reden als cases-resource-crud.ts): het restore-pad promoot de projectkalender-cache.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

const IMPORT_SPLIT: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
const LEVELING_GAP: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
const LOST_KEY = 'notifications.mppTimephasedSteeringLost';
const CLEARED = { splitGaps: [IMPORT_SPLIT], floor: null, anchor: null, walks: null };

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, { expectedDocId: store.getState().activeDocumentId });
}

let rpcId = 0;
/** Eén echte JSON-RPC-`tools/call` door de dispatcher; geeft het `McpToolResult` terug. */
async function dispatch(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assert(msg.result && !msg.result.isError, `${name} faalde: ${raw}`);
  return msg.result.structuredContent;
}

function taskOf(id: string): Task {
  return store.getState().tasks.find((t) => t.id === id)!;
}
function steering(id: string) {
  const t = taskOf(id);
  return {
    splitGaps: t.splitGaps ?? null,
    floor: t.timephasedFinishFloor ?? null,
    anchor: t.timephasedStartAnchor ?? null,
    walks: t.timephasedDurationWalks ?? null,
  };
}
function notices(): unknown[] {
  return store.getState().ui.notifications
    .filter((n) => n.messageKey === LOST_KEY)
    .map((n) => n.params?.count);
}

/** Nivelleeruitvoer (+ optioneel MSP-sturing) rechtstreeks op de taak: wat een eerdere nivellering
 *  resp. een .mpp-import achterlaat — geen tool schrijft deze velden. */
function seed(id: string, withMsp: boolean): void {
  store.setState((s) => {
    const t = s.tasks.find((x) => x.id === id)!;
    t.splitGaps = [{ ...IMPORT_SPLIT }, { ...LEVELING_GAP }];
    if (withMsp) {
      t.timephasedFinishFloor = '2026-06-10T17:00';
      t.timephasedStartAnchor = '2026-06-01T08:00';
      t.timephasedDurationWalks = [{ anchor: '2026-06-01T08:00', resourceCalendarId: s.calendar.id, workMinutes: 2400 }];
    }
  });
}

/** T1: alleen R1. T2: R1 + R2. T3: alleen R2 (bystander). T4: geen toewijzing (bystander). */
function fixture(withMsp: boolean) {
  store.getState().newProject(); // reset óók de eenmalige K8a-meldingsgate van dit document
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const mk = (name: string) => S().addTask({ name, time: createDefaultTaskTime('2026-06-01', 5) });
  const t1 = mk('T1'); const t2 = mk('T2'); const t3 = mk('T3'); const t4 = mk('T4');
  const r1 = S().addResource({ name: 'R1', type: 'LABOR', description: '', maxUnits: 1 });
  const r2 = S().addResource({ name: 'R2', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(t1, r1, 1);
  S().assignResource(t2, r1, 1);
  S().assignResource(t2, r2, 1);
  S().assignResource(t3, r2, 1);
  for (const t of [t1, t2, t3, t4]) seed(t, withMsp);
  S().runCPM();
  store.setState((s) => { s.ui.notifications = []; });
  return { t1, t2, t3, t4, r1, r2 };
}

for (const withMsp of [true, false]) {
  const tag = withMsp ? '+ MSP-sturing' : '(alleen nivelleerpauze)';

  test(`manage_assignments remove ${tag} — referentie: wist nivelleerpauze + laag 3/4 en telt het verlies`, async () => {
    const f = fixture(withMsp);
    const a1 = store.getState().assignments.find((a) => a.taskId === f.t1 && a.resourceId === f.r1)!;
    const res = await dispatch('planner_manage_assignments', { actions: [{ action: 'remove', assignmentId: a1.id }] });
    assertEq(steering(f.t1), CLEARED, 'T1: nivelleerpauze + laag 3/4 weg, importsplit blijft');
    assertEq(res.envelope.timephasedGuidanceLost, withMsp ? 1 : undefined, 'envelope.timephasedGuidanceLost');
    assertEq(notices(), withMsp ? [1] : [], 'K8a-melding alleen bij verloren MSP-sturing');
  });

  test(`manage_resources delete (cascade) ${tag} — zelfde gevolgregels als unassign op elke geraakte taak`, async () => {
    const f = fixture(withMsp);
    const bystanders = [steering(f.t3), steering(f.t4)];
    const efBystanders = [taskOf(f.t3).time.earlyFinish, taskOf(f.t4).time.earlyFinish];
    const res = await dispatch('planner_manage_resources', { actions: [{ action: 'delete', id: f.r1, cascade: true }] });
    const row = res.data.deleted[0];
    assertEq(row.affectedTaskIds.slice().sort(), [f.t1, f.t2].sort(), 'rapport noemt de geraakte taken');
    assertEq(store.getState().resources.some((r) => r.id === f.r1), false, 'R1 is weg');
    assertEq(steering(f.t1), CLEARED, 'T1: nivelleerpauze + laag 3/4 weg, importsplit blijft');
    assertEq(steering(f.t2), CLEARED, 'T2: nivelleerpauze + laag 3/4 weg, importsplit blijft');
    assertEq(store.getState().assignments.filter((a) => a.taskId === f.t2).map((a) => a.resourceId), [f.r2],
      'T2 houdt zijn R2-toewijzing');
    assertEq([steering(f.t3), steering(f.t4)], bystanders, 'T3 (alleen R2) en T4 (geen toewijzing) blijven ongemoeid');
    assertEq(res.envelope.timephasedGuidanceLost, withMsp ? 2 : undefined,
      'envelope.timephasedGuidanceLost telt beide taken die MSP-sturing verloren');
    assertEq(notices(), withMsp ? [2] : [], 'één K8a-melding (count 2) alleen bij verloren MSP-sturing');
    // De eind-runCPM van de transactie heeft de pauze al verrekend: T1 eindigt een werkdag eerder dan
    // de bystanders (die hun nivelleerpauze nog dragen).
    assertEq([taskOf(f.t3).time.earlyFinish, taskOf(f.t4).time.earlyFinish], efBystanders, 'bystander-EF ongewijzigd');
    assert(taskOf(f.t1).time.earlyFinish < efBystanders[1],
      `T1 eindigt eerder zonder nivelleerpauze (T1 ${taskOf(f.t1).time.earlyFinish}, T4 ${efBystanders[1]})`);
  });

  test(`manage_resources delete ${tag} — één undo herstelt resource, toewijzingen en de gewiste sturing`, async () => {
    const f = fixture(withMsp);
    const before = [f.t1, f.t2].map(steering);
    await dispatch('planner_manage_resources', { actions: [{ action: 'delete', id: f.r1, cascade: true }] });
    store.getState().undo();
    assertEq(store.getState().resources.some((r) => r.id === f.r1), true, 'R1 is terug');
    assertEq([f.t1, f.t2].map(steering), before, 'gaten en laag 3/4 zijn terug');
  });
}

await run();
