/**
 * De belasting leest het profiel van het project (spec "alleen uren" §3.11, §3.14; review #581 r1,
 * knownbug 258). De verdeling van een dagenmaat-taak hangt af van de maatconventie
 * `workdayDurationMeasure`: onder OPS telt 1 d als één werkdag, onder P6 en MS Project als
 * 1 × de werktijd per dag (8 u). Elke productieroute moet daarom het effectieve profiel doorgeven.
 *
 * Kalender: ma–do 07:00–15:00 (8 u), vr 07:00–13:00 (6 u), werktijd per dag 8 u. Taak T: 1 d vanaf
 * vr 07:00 met resource R (inzet 1).
 *  - P6: 8 u = vr 6 u + ma 2 u. De solver eindigt op ma 09:00; de belasting is vr 0,75 + ma 0,25.
 *  - OPS (controle): één werkdag, dus vr 1.
 * Routes: `runCPM`, `recomputeResourceLoad`, de gridtransactie (duur 2 d: vr 0,75 + ma 1 + di 0,25),
 * undo/redo (`materializeHistoryTarget`), een documentwissel, openen uit IFC, het MCP-histogram, het
 * rapport *Resourcebelasting* en de bezetting van de bibliotheek.
 */
import './domStub';
import { makeMcpContext } from '../mcp/harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { SchedulingProfile } from '@/types/project';
import type { CellEditIntent } from '@/types/taskGrid';
import type { CompanyPool } from '@/types/library';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStoreFactory';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { parseTaskDurationInput } from '@/utils/taskDurationInput';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { computeResourceLoading } from '@/engine/reports/resourceLoading';
import { computeLibraryOccupancy } from '@/services/library/occupancy';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}

const LONG = [{ start: 420, end: 900 }];
const CAL: WorkCalendar = {
  id: 'cal', name: 'Korte vrijdag', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: LONG, 2: LONG, 3: LONG, 4: LONG, 5: [{ start: 420, end: 780 }], 6: [], 7: [] } },
};
const P6: SchedulingProfile = { baseId: 'p6', id: 'p6', name: '', overrides: {} };
const OPS: SchedulingProfile = { baseId: 'ops', id: 'ops', name: '', overrides: {} };
const VR = '2026-06-05';
const MA = '2026-06-08';
const DI = '2026-06-09';
const P6_LOAD = { [VR]: 0.75, [MA]: 0.25 };

function fixture(profile: SchedulingProfile): { context: AppStoreContext; taskId: string } {
  const context = createAppStoreContext();
  const t: Task = {
    id: 't', name: 'T', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'],
    time: { ...createDefaultTaskTime(`${VR}T07:00`, 1), durationUnit: 'days' },
  };
  context.store.setState(s => {
    s.project.startDate = VR;
    s.project.schedulingProfile = profile;
    s.calendar = CAL;
    s.calendars = [];
    s.tasks = [t];
    s.resources = [{ id: 'r', name: 'R', type: 'LABOR', description: '', maxUnits: 1 }];
    s.assignments = [{ id: 'a', taskId: 't', resourceId: 'r', unitsPerDay: 1 }];
  });
  context.store.getState().runCPM();
  return { context, taskId: 't' };
}
const loadOf = (c: AppStoreContext) => c.store.getState().resourceLoadResult?.load.r ?? null;
const finishOf = (c: AppStoreContext) => c.store.getState().tasks.find(t => t.id === 't')!.time.earlyFinish;

// ── runCPM en recomputeResourceLoad ──────────────────────────────────────────────
{
  const { context } = fixture(P6);
  eq('p1 P6: de solver eindigt op ma 09:00', finishOf(context), `${MA}T09:00`);
  eq('p2 P6: runCPM verdeelt vr 0,75 + ma 0,25', loadOf(context), P6_LOAD);
  context.store.getState().recomputeResourceLoad();
  eq('p3 P6: recomputeResourceLoad geeft dezelfde verdeling', loadOf(context), P6_LOAD);
}
{
  const { context } = fixture(OPS);
  eq('p4 OPS (controle): één werkdag, einde vr 13:00', finishOf(context), `${VR}T13:00`);
  eq('p5 OPS (controle): de belasting staat helemaal op vr', loadOf(context), { [VR]: 1 });
}

// ── Gridtransactie, undo en redo ─────────────────────────────────────────────────
{
  const { context } = fixture(P6);
  const S = () => context.store.getState();
  const cell: CellEditIntent = {
    kind: 'cell-edit', taskId: 't', columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'],
    route: 'task-schedule', value: parseTaskDurationInput('2d', 'days'),
  };
  const res = S().runGridMutation([cell]);
  eq('p6 gridtransactie: de duurcel slaagt', res.ok, true);
  // Twee dagen = 16 u: vr 6 + ma 8 + di 2. Zonder het profiel: vr 1 + ma 1.
  eq('p7 gridtransactie: de belasting leest het profiel', loadOf(context), { [VR]: 0.75, [MA]: 1, [DI]: 0.25 });
  S().undo();
  eq('p8 undo: de herstelde belasting leest het profiel', loadOf(context), P6_LOAD);
  S().redo();
  eq('p9 redo: idem', loadOf(context), { [VR]: 0.75, [MA]: 1, [DI]: 0.25 });
}

// ── Documentwissel en openen uit IFC ─────────────────────────────────────────────
{
  const { context } = fixture(P6);
  const S = () => context.store.getState();
  const first = S().activeDocumentId;
  S().newDocument();
  S().switchDocument(first);
  eq('p10 documentwissel: de belasting van het teruggehaalde document leest het profiel', loadOf(context), P6_LOAD);

  const parsed = readIFC(writeIFC(buildWriteIFCInput(S())));
  eq('p11 IFC: het profiel gaat mee', parsed.project.schedulingProfile?.baseId, 'p6');
  const reopened = createAppStoreContext();
  reopened.store.getState().applyLoadedProject(parsed, { recompute: true });
  // De lezer geeft de resource een eigen id.
  const r = reopened.store.getState();
  eq('p12 openen uit IFC: de belasting leest het profiel', r.resourceLoadResult?.load[r.resources[0].id] ?? null, P6_LOAD);
}

// ── Rapport en bezetting (pure kernen met de productie-invoer) ───────────────────
{
  const { context } = fixture(P6);
  const s = context.store.getState();
  const report = computeResourceLoading({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
    calendar: s.calendar, calendars: s.calendars, cpmResult: s.cpmResult, baseline: null, today: VR,
    solveOptions: solveOptionsFor(s.project),
  }, { period: { preset: 'project' }, bucket: 'week', onlyOverloaded: false });
  // Het rapport rondt af op één decimaal: 0,75 → 0,8 en 0,25 → 0,3 (zonder profiel 1 en 0).
  eq('p13 rapport Resourcebelasting: per week 0,8 en 0,3 (zonder profiel 1 en 0)',
    report.rows.map(r => [r.bucketStart, r.required]), [['2026-06-01', 0.8], [MA, 0.3]]);

  const pool: CompanyPool = { companyId: 'c', version: 1, resources: [{ id: 'lib-r', name: 'R', type: 'LABOR', description: '', maxUnits: 1 }] } as CompanyPool;
  const occupancy = computeLibraryOccupancy('c', pool, [{
    docId: 'd', title: 'D', scheduleStale: false, companyId: 'c',
    resources: [{ ...s.resources[0], libraryOrigin: { companyId: 'c', libraryItemId: 'lib-r', poolVersion: 1, syncedHash: '' } }],
    assignments: s.assignments, tasks: s.tasks, calendar: s.calendar, calendars: s.calendars,
    loadOptions: effectiveSchedulingOptions(s.project),
  }]);
  eq('p14 bezetting: de dagbelasting van het document leest het profiel', occupancy.rows[0]?.docs[0]?.dailyLoad ?? null, P6_LOAD);
}

// ── MCP ──────────────────────────────────────────────────────────────────────────
async function mcp() {
  const { context } = fixture(P6);
  const res = await getTool('planner_get_resource_histogram')!.handler(
    { resourceIds: ['r'], bucket: 'dag', van: VR, tot: MA }, makeMcpContext(context)) as McpToolResult;
  eq('p15 MCP-histogram: slaagt', res.ok, true);
  const data = (res as McpToolOk).data as { resources: { buckets: { start: string; load: number }[] }[] };
  const loads = Object.fromEntries((data.resources?.[0]?.buckets ?? []).filter(b => b.load > 0).map(b => [b.start, b.load]));
  eq('p16 MCP-histogram: vr 0,75 + ma 0,25', loads, P6_LOAD);
  const aggregate = await getTool('planner_get_resource_histogram')!.handler({}, makeMcpContext(context)) as McpToolResult;
  const agg = (aggregate as McpToolOk).data as { resources: { peakLoad: number; loadSum: number }[] };
  eq('p17 MCP-histogram zonder venster: piek 0,75, som 1', [agg.resources?.[0]?.peakLoad, agg.resources?.[0]?.loadSum], [0.75, 1]);
}

await mcp();
if (errors.length) {
  for (const e of errors) console.log(`XX ${e}`);
  console.log(`belasting-per-profiel: ${errors.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`OK  belasting-per-profiel (knownbug 258): ${checks} checks groen`);
