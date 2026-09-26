// Een AUTOMATISCH ingevulde werkelijke start valt nooit ná het werkelijke einde — het MCP-pad van
// critreview claim 9 (raster/store/dialoog: tests/planning/check-auto-actual-start.ts).
//
// Vóór de fix: `planner_update_tasks` met `progress: { completion: 100 }` op een taak waarvan de
// geplande start ná de statusdatum ligt, leidde de werkelijke start af uit de vroege start
// (bv. 2026-07-08) terwijl de invarianten daarna het werkelijke einde op de statusdatum
// (2026-06-10) zetten. De begin-/eindvolgordecheck (`isActualFinishBeforeStart`) draaide vóór die
// invarianten en zag het dus niet: het onmogelijke paar werd gewoon opgeslagen. Met een opgegeven
// `actualFinish` erbij weigerde dezelfde check juist de hele update — op een start die de AI niet
// had opgegeven.
//
// De regel (gedeeld met raster en store via `fillMissingActualStart`): ligt de in te vullen start
// later dan het werkelijke einde, dan wordt de werkelijke start gelijk aan het einde — dagtaken op de
// dag, uurtaken exact op het einde-instant. Een OPGEGEVEN actualStart blijft onaangeroerd.
//
// Besluit eigenaar (Z1b, regel 4): de AI-koppeling leidt die start NIET meer af wanneer de geplande
// start ná de statusdatum ligt — zo'n update wordt per item geweigerd met de uitleg dat de AI
// `actualStart` moet meegeven (tests/mcp/cases-progress-entry-ai.ts). De klem hierboven blijft het
// vangnet van store en raster (tests/planning/check-auto-actual-start.ts); hier toetsen we dat de
// geweigerde varianten niets veranderen en dat een OPGEGEVEN start gewoon werkt.
//
// Alles loopt door de echte JSON-RPC-dispatcher (schema's, stale-guard, transactie), niet door de
// validatiefunctie alleen.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';

const S = () => useAppStore.getState();

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`.
S().addTask({ name: 'warmup' });
S().undo();
registerAllTools();

let rpcId = 0;
async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
    makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
  );
  const parsed = JSON.parse(raw!);
  assert(parsed.result?.structuredContent, `geen structuredContent voor ${name}: ${raw}`);
  return parsed.result.structuredContent;
}

type Kind = 'dag' | 'uur';
const BAND = [{ start: 480, end: 1020 }];

/** Voorganger van 20 werkdagen (160 uur) + opvolger T van 5 werkdagen (40 uur) via FS: T start
 *  ruim ná de statusdatum op 10 juni. */
function setup(kind: Kind, statusDate: string): string {
  S().newProject();
  S().setProject({ startDate: '2026-06-01', statusDate });
  if (kind === 'uur') {
    S().setCalendar({
      ...S().calendar,
      workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } },
    } as WorkCalendar);
  }
  const time = (days: number) => kind === 'uur'
    ? createDefaultTaskTime('2026-06-01', days * 8, 'hours')
    : createDefaultTaskTime('2026-06-01', days);
  const pre = S().addTask({ name: 'Voorganger', time: time(20) });
  const t = S().addTask({ name: 'T', time: time(5) });
  S().addSequence({ predecessorId: pre, successorId: t, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  return t;
}

const timeOf = (id: string): TaskTime => S().tasks.find((t) => t.id === id)!.time;
const statusOf = (id: string) => S().tasks.find((t) => t.id === id)!.status;

function assertAccepted(res: any, label: string): void {
  assert(res.ok === true, `${label}: tool gaf een fout: ${JSON.stringify(res)}`);
  assertEq(res.itemRejections ?? [], [], `${label}: geen per-item-weigering`);
}

const SCENARIOS: readonly { kind: Kind; statusDate: string; finish: string; explicitStart: string }[] = [
  { kind: 'dag', statusDate: '2026-06-10', finish: '2026-06-09', explicitStart: '2026-06-03' },
  { kind: 'uur', statusDate: '2026-06-10T12:00', finish: '2026-06-09T11:00', explicitStart: '2026-06-03T09:00' },
];

for (const { kind, statusDate, finish, explicitStart } of SCENARIOS) {
  /** Eén zachte weigering die de AI vertelt de werkelijke start mee te geven; taak ongewijzigd. */
  function assertAskedForActualStart(res: any, t: string, before: string, label: string): void {
    const rejections: { id: string; reason: string }[] = res.itemRejections ?? [];
    assertEq(rejections.length, 1, `${label}: precies één per-item-weigering`);
    assert(/progress\.actualStart/.test(rejections[0]?.reason ?? ''), `${label}: de reden vraagt om actualStart: ${rejections[0]?.reason}`);
    assertEq(JSON.stringify(timeOf(t)), before, `${label}: taak ongewijzigd`);
  }

  test(`${kind}: completion 100 zonder actualStart ⇒ geweigerd, de AI moet de werkelijke start meegeven`, async () => {
    const t = setup(kind, statusDate);
    const es = timeOf(t).earlyStart;
    assert(es > statusDate, `voorwaarde: vroege start (${es}) ligt ná de statusdatum (${statusDate})`);
    const before = JSON.stringify(timeOf(t));
    const res = await rpc('planner_update_tasks', { updates: [{ id: t, progress: { completion: 100 } }] });
    assertAskedForActualStart(res, t, before, 'completion 100');
    assertEq(statusOf(t), 'NOT_STARTED', 'taak niet gestart');
  });

  test(`${kind}: completion 100 + actualFinish zonder actualStart ⇒ ook geweigerd (geen verzonnen start)`, async () => {
    const t = setup(kind, statusDate);
    const before = JSON.stringify(timeOf(t));
    const res = await rpc('planner_update_tasks', {
      updates: [{ id: t, progress: { completion: 100, actualFinish: finish } }],
    });
    assertAskedForActualStart(res, t, before, 'completion 100 + actualFinish');
  });

  test(`${kind}: completion 100 via planner_batch ⇒ dezelfde weigering`, async () => {
    const t = setup(kind, statusDate);
    const before = JSON.stringify(timeOf(t));
    const res = await rpc('planner_batch', {
      steps: [{ tool: 'planner_update_tasks', args: { updates: [{ id: t, progress: { completion: 100 } }] } }],
    });
    assert(res.ok === true, `batch gaf een fout: ${JSON.stringify(res)}`);
    assertEq(JSON.stringify(timeOf(t)), before, 'taak ongewijzigd (batch)');
  });

  test(`${kind}: een OPGEGEVEN actualStart blijft onaangeroerd`, async () => {
    const t = setup(kind, statusDate);
    const res = await rpc('planner_update_tasks', {
      updates: [{ id: t, progress: { completion: 100, actualStart: explicitStart } }],
    });
    assertAccepted(res, 'completion 100 + actualStart');
    assertEq({ as: timeOf(t).actualStart, af: timeOf(t).actualFinish }, { as: explicitStart, af: statusDate },
      'opgegeven start blijft, einde = statusdatum');
  });

  test(`${kind}: opgegeven actualStart ná opgegeven actualFinish blijft geweigerd (geen stille klem)`, async () => {
    const t = setup(kind, statusDate);
    const before = JSON.stringify(timeOf(t));
    const res = await rpc('planner_update_tasks', {
      updates: [{ id: t, progress: { actualStart: finish, actualFinish: explicitStart } }],
    });
    const rejections: { reason: string }[] = res.itemRejections ?? [];
    assertEq(rejections.length, 1, 'precies één per-item-weigering');
    assert(/vóór actualStart/.test(rejections[0]!.reason), `reden noemt de volgorde: ${rejections[0]!.reason}`);
    assertEq(JSON.stringify(timeOf(t)), before, 'taak ongemoeid');
  });
}

await run();
