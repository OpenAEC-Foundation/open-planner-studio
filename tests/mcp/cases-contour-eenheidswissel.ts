// Aanval a04 na #600 (knownbug 265), de AI-route: `planner_update_tasks` met dezelfde kalendertijd in een
// andere eenheid herschaalt de contour niet. Store en taakraster staan in
// tests/planning/check-contour-unit-switch.ts; hier dezelfde invoer via de ECHTE dispatch-weg
// (`handleMcpMessage`), zodat schemapoort, veldvertaling en transactie meegetest worden.
//
// Invoer uit het rapport: kalender ma–vr 08:00–16:00, taak Uitharden in kalendertijd van ma 1 juni 2026
// 00:00 tot wo 3 juni 00:00 (2 d = 48 klokuren), Toezicht (capaciteit 3) met een contour van 240 min op
// maandag en 480 min op dinsdag. Vóór de fix werd de contour 2160 min en de belasting op dinsdag 4.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext } from '@/services/mcp/contracts';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime, TimephasedContourPeriod } from '@/types/task';
import { makeBands } from '@/utils/effectiveWorkTime';

const store = useAppStore;
const S = () => store.getState();

// Warm-up (zelfde reden als cases-mutate-tasks.ts): de projectkalender-cache promoveert bij de
// eerste restore tot bibliotheek-entry; één edit + undo zet dat vooraf recht.
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

const CAL: WorkCalendar = {
  id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16,
  hoursPerDay: 8, holidays: [], workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
};
const DAYS_TIME: TaskTime = {
  durationType: 'ELAPSEDTIME', durationUnit: 'days', scheduleDuration: 2,
  scheduleStart: '2026-06-01T00:00', scheduleFinish: '2026-06-03T00:00',
  earlyStart: '2026-06-01T00:00', earlyFinish: '2026-06-03T00:00',
  lateStart: '2026-06-01T00:00', lateFinish: '2026-06-03T00:00',
  freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
};
const remaining = (afterMinutes: number, minutes: number, workMinutes: number): TimephasedContourPeriod =>
  ({ afterMinutes, minutes, workMinutes, kind: 'remaining' });
const CONTOUR: TimephasedContourPeriod[] = [remaining(0, 480, 240), remaining(480, 480, 480)];

/** Verse fixture met de taak uit het rapport; `time` bepaalt de beginmaat. */
function fixture(time: TaskTime): void {
  S().newProject();
  const task: Task = {
    id: 't', name: 'Uitharden', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'], time: { ...time },
    timephasedContours: [{ resourceUid: null, resourceId: 'r', periods: CONTOUR.map(p => ({ ...p })) }],
  };
  store.setState({
    calendar: CAL, calendars: [], tasks: [task], sequences: [],
    resources: [{ id: 'r', name: 'Toezicht', description: '', type: 'LABOR', maxUnits: 3 }],
    assignments: [{ id: 'a', taskId: 't', resourceId: 'r', unitsPerDay: 1 }],
    project: { ...S().project, startDate: '2026-06-01' },
  });
  S().runCPM();
}

const periods = () => S().tasks.find(t => t.id === 't')?.timephasedContours?.[0]?.periods;

async function update(fields: Record<string, unknown>): Promise<void> {
  const res = await rpc('planner_update_tasks', { updates: [{ id: 't', fields }] });
  assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
  assertEq(res.itemRejections ?? [], [], 'geen weigering');
}

test('2 d kalendertijd → 48 u: contour en belasting blijven gelijk', async () => {
  fixture(DAYS_TIME);
  await update({ duration: 48, durationUnit: 'hours' });
  const time = S().tasks.find(t => t.id === 't')!.time;
  assertEq([time.durationUnit, time.durationMinutes], ['hours', 2880], 'de taak staat in de urenmaat');
  assertEq(periods(), CONTOUR, 'contour ongewijzigd (12 u)');
  S().runCPM();
  const load = S().resourceLoadResult;
  assertEq(load?.load.r, { '2026-06-01': 0.5, '2026-06-02': 1 }, 'belasting ma 0,5 en di 1');
  assertEq(load?.overallocatedDays, {}, 'geen overallocatie');
});

test('48 u kalendertijd → 2 d: contour blijft gelijk', async () => {
  fixture({ ...DAYS_TIME, durationUnit: 'hours', durationMinutes: 2880, scheduleDuration: 6 });
  await update({ duration: 2, durationUnit: 'days' });
  assertEq(S().tasks.find(t => t.id === 't')!.time.durationUnit, 'days', 'de taak staat in de dagenmaat');
  assertEq(periods(), CONTOUR, 'contour ongewijzigd (12 u)');
});

test('2 d kalendertijd → 72 u: een echte verlenging schaalt met factor 1,5', async () => {
  fixture(DAYS_TIME);
  await update({ duration: 72, durationUnit: 'hours' });
  assertEq(periods(), [remaining(0, 720, 360), remaining(720, 720, 720)], 'factor 1,5 op de as');
});

await run();
