// `planner_update_tasks` en de gevolgregels op WAARDE (niet op sleutel-aanwezigheid) — de MCP-kant
// van dezelfde fix als tests/planning/check-value-based-triggers.ts (store + taakraster). Alles via
// de ECHTE dispatch-weg (`handleMcpMessage`), zodat schemapoort, guards en transactie meedoen.
//
// Gepind: exact de huidige duur (of constraint) terugsturen laat de MSP-sturing (laag 3 en laag 4
// met bevroren werk) en de nivelleergaten staan en draagt GEEN `timephasedGuidanceLost`; een ándere
// duur ontkoppelt zoals altijd, met envelopveld en K8a-melding.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext } from '@/services/mcp/contracts';
import type { TaskSplitGap } from '@/types/task';

const store = useAppStore;
const S = () => store.getState();

// Warm-up (zelfde reden als cases-splits.ts): de projectkalender-cache promoveert bij de eerste
// restore tot bibliotheek-entry; één edit + undo zet dat vooraf recht.
S().addTask({ name: 'warmup' });
S().undo();
registerAllTools();

function makeCtx(overrides: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId, ...overrides });
}

/** Roep een tool aan via de ECHTE JSON-RPC-weg; geeft `structuredContent` (het tool-resultaat). */
async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 200)}`);
  return msg.result.structuredContent;
}

function okResult(res: any): any {
  assert(res && res.ok === true, `verwachtte ok, kreeg: ${JSON.stringify(res).slice(0, 300)}`);
  return res;
}

const IMPORT_SPLIT: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
const LEVELING_GAP: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
const STEERING_LOST = 'notifications.mppTimephasedSteeringLost';

type Layer = 'laag3' | 'laag4';

/** Nieuw project (verse meldingspoort) met één taak van 5 werkdagen, SNET-constraint, MSP-sturing
 *  (laag 3 of laag 4 met bevroren werk), een importsplit en een nivelleergat. De sturing is via de
 *  tool-allowlist bewust niet zetbaar, dus rechtstreeks op de store (zoals `seedTimephasedWindow` in
 *  cases-taskfields.ts). */
async function freshTask(layer: Layer): Promise<string> {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  const created = okResult(await rpc('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-t', name: 'Metselwerk', duration: 5, constraint: { type: 'SNET', date: '2026-06-01' } }],
  }));
  const id: string = created.data.created['tmp-t'];
  store.setState((s) => {
    const t = s.tasks.find((x) => x.id === id)!;
    if (layer === 'laag3') {
      t.timephasedFinishFloor = '2026-06-05T17:00';
      t.timephasedStartAnchor = '2026-06-01T08:00';
    } else {
      t.timephasedDurationWalks = [{ anchor: '2026-06-01T08:00', resourceCalendarId: s.calendar.id, workMinutes: 900 }];
    }
    t.splitGaps = [IMPORT_SPLIT, LEVELING_GAP];
    s.ui.notifications = [];
  });
  return id;
}

const task = (id: string) => S().tasks.find((t) => t.id === id)!;
const steeringOf = (id: string) => ({
  floor: task(id).timephasedFinishFloor ?? null,
  anchor: task(id).timephasedStartAnchor ?? null,
  walks: task(id).timephasedDurationWalks?.length ?? 0,
});

for (const layer of ['laag3', 'laag4'] as const) {
  test(`${layer}: planner_update_tasks met exact de huidige duur laat de sturing en de nivelleergaten staan`, async () => {
    const id = await freshTask(layer);
    const before = steeringOf(id);
    assertEq(task(id).time.scheduleDuration, 5, 'opzet: duur 5');
    const res = okResult(await rpc('planner_update_tasks', { updates: [{ id, fields: { duration: 5 } }] }));
    assertEq(res.envelope.timephasedGuidanceLost, undefined, 'geen timephasedGuidanceLost in de envelop');
    assertEq(steeringOf(id), before, 'MSP-sturing blijft');
    assertEq(task(id).splitGaps, [IMPORT_SPLIT, LEVELING_GAP], 'importsplit én nivelleergat blijven');
    assertEq(S().ui.notifications.map((n) => n.messageKey), [], 'geen K8a-melding');
  });

  test(`${layer}: planner_update_tasks met een ándere duur ontkoppelt zoals altijd`, async () => {
    const id = await freshTask(layer);
    const res = okResult(await rpc('planner_update_tasks', { updates: [{ id, fields: { duration: 9 } }] }));
    assertEq(res.envelope.timephasedGuidanceLost, 1, 'timephasedGuidanceLost === 1');
    assertEq(steeringOf(id), { floor: null, anchor: null, walks: 0 }, 'MSP-sturing losgelaten');
    assertEq(task(id).splitGaps, [IMPORT_SPLIT], 'nivelleergat gewist, importsplit blijft');
    assertEq(S().ui.notifications.map((n) => n.messageKey), [STEERING_LOST], 'K8a-melding');
  });
}

test('planner_update_tasks met dezelfde constraint laat het nivelleergat staan; een andere wist het', async () => {
  const id = await freshTask('laag3');
  const same = okResult(await rpc('planner_update_tasks', {
    updates: [{ id, fields: { constraint: { date: '2026-06-01', type: 'SNET' } } }],
  }));
  assertEq(same.envelope.timephasedGuidanceLost, undefined, 'geen timephasedGuidanceLost');
  assertEq(task(id).splitGaps, [IMPORT_SPLIT, LEVELING_GAP], 'ongewijzigde constraint: gaten blijven');
  okResult(await rpc('planner_update_tasks', {
    updates: [{ id, fields: { constraint: { type: 'SNET', date: '2026-06-03' } } }],
  }));
  assertEq(task(id).splitGaps, [IMPORT_SPLIT], 'andere constraint: nivelleergat gewist');
  assertEq(steeringOf(id).floor, '2026-06-05T17:00', 'een constraint is geen Z8-trigger: laag 3 blijft');
});

test('planner_batch: dezelfde duur via een batchstap laat de sturing staan', async () => {
  const id = await freshTask('laag3');
  const res = okResult(await rpc('planner_batch', {
    steps: [{ tool: 'planner_update_tasks', args: { updates: [{ id, fields: { duration: 5 } }] } }],
  }));
  assertEq(res.envelope.timephasedGuidanceLost, undefined, 'geen timephasedGuidanceLost via de batch');
  assertEq(steeringOf(id).floor, '2026-06-05T17:00', 'laag 3 blijft');
  assertEq(task(id).splitGaps, [IMPORT_SPLIT, LEVELING_GAP], 'gaten blijven');
});

await run();
