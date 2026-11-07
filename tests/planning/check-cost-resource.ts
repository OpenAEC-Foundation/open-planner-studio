// check-cost-resource.ts — kostenresource (issue #815, deel 1): een vast bedrag per toewijzing.
//
// Besluiten (Ethan, 2026-11-07): type 'COST' met `ResourceAssignment.costAmount` (alleen het begrote
// bedrag). Geen tarief, max. eenheden, kalender, eenheid, ploeg of werk. Telt niet mee voor belasting,
// overbezetting, histogram of nivelleren en stuurt nooit de duur. Een wijziging maakt de planning niet
// verouderd en wist geen opgeslagen sturing. Mag op een mijlpaal; werk en materiaal daar niet.
//
// Wat deze batterij pint (plan `docs/superpowers/plans/2026-11-07-kostenresource.md`, review ronde 1):
//   A. bedrag: zetten, 0, wissen, ongeldig weigeren; undo/redo; documentwissel; crashherstel (punt 8)
//   B. geen invalidatie en geen stale op elke route: toevoegen, bedrag, verwijderen, verplaatsen,
//      resource weg (purge) en het taakraster (punt 3)
//   C. histogram en belasting zonder COST: ongescoped, gescoped en gemengd (punt 4)
//   D. mijlpaalroutes met undo: store, taak → mijlpaal, verplaatsen, taakraster (punt 6)
//   E. bibliotheek: typewissel over de COST-grens met toewijzingen geweigerd op elke route (punt 2)
//   F. pool-JSON: COST als MATERIAL + markering, de lezer zet hem terug (punt 5)
//   G. resourcevelden: COST wist tarief/kalender/eenheid/ploeg/stappen; typewissel geweigerd
//   H. duur: een kostenresource stuurt de duur niet onder een werkbeschermende regel
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { computeHistogramReport, computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { contouredAssignmentIds } from '@/engine/contour/curveState';
import { contourSiblings, costResourceIds } from '@/types/resource';
import { legacyCpmOptions } from './legacySolveOptions';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { serializeRecoverySnapshot } from '@/services/recovery/recoverySnapshotInput';
import { readIFC } from '@/services/ifc/ifcReader';
import { capturePayload } from '@/state/documentContract';
import { materializeLibraryBoundary } from '@/state/documentActivation';
import { classifyResourceOnOpen, computeResourceHash } from '@/services/library/libraryOps';
import { POOL_COST_RESOURCE_MARKER, readPoolIFC, writePoolIFC } from '@/services/library/libraryIfc';
import type { Task, TaskSplitGap } from '@/types/task';
import type { AssignmentSetIntent, TaskAssignmentToken } from '@/types/taskGrid';

declare const process: { exit(code: number): never };

let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

type Store = ReturnType<typeof createAppStore>;

const LEVELING_GAP: TaskSplitGap = { afterMinutes: 960, gapMinutes: 480, source: 'leveling' };

/** Sturing die een toewijzingswijziging zou wissen (`invalidateForAssignmentChange`). */
function seedSteering(store: Store, taskId: string): void {
  store.setState((s) => {
    const t = s.tasks.find(x => x.id === taskId)!;
    t.splitGaps = [{ ...LEVELING_GAP }];
    t.timephasedFinishFloor = '2026-06-10T17:00';
    t.timephasedStartAnchor = '2026-06-01T08:00';
    t.timephasedDurationWalks = [{ anchor: '2026-06-01T08:00', resourceCalendarId: s.calendar.id, workMinutes: 2400 }];
  });
}
function steering(task: Task) {
  return {
    gaps: task.splitGaps ?? null,
    floor: task.timephasedFinishFloor ?? null,
    anchor: task.timephasedStartAnchor ?? null,
    walks: task.timephasedDurationWalks?.length ?? 0,
  };
}
const KEPT = { gaps: [LEVELING_GAP], floor: '2026-06-10T17:00', anchor: '2026-06-01T08:00', walks: 1 };

function intent(taskId: string, tokens: readonly TaskAssignmentToken[]): AssignmentSetIntent {
  return { kind: 'assignment-set', taskId, columnId: taskColumnId('assignment.resources'), tokens };
}

function fixture() {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const t1 = S().addTask({ name: 'Ruwbouw', time: createDefaultTaskTime('2026-06-01', 5) });
  const t2 = S().addTask({ name: 'Afbouw', time: createDefaultTaskTime('2026-06-08', 5) });
  const ms = S().addTask({ name: 'Oplevering', time: createDefaultTaskTime('2026-06-15', 0) });
  S().updateTask(ms, { isMilestone: true });
  const cost = S().addResource({ name: 'Leges', type: 'COST', description: '', maxUnits: 1 });
  const labor = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 50 });
  const mat = S().addResource({ name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 10 });
  S().assignResource(t1, labor, 1);
  S().runCPM();
  return { store, S, t1, t2, ms, cost, labor, mat };
}
const costOf = (S: () => ReturnType<Store['getState']>, taskId: string, resourceId: string) =>
  S().assignments.find(a => a.taskId === taskId && a.resourceId === resourceId);

// ── A. Bedrag: zetten, 0, wissen, ongeldig; undo/redo; documentwissel; crashherstel ─────────────────
{
  const { S, t1, ms, cost, labor } = fixture();
  S().assignResource(t1, cost, 3, 'BELL', 1250.55);
  const a = costOf(S, t1, cost)!;
  eq('A1 toevoegen: inzet vast 1, geen curve, bedrag mee', [a.unitsPerDay, a.curve ?? null, a.costAmount], [1, null, 1250.55]);
  S().setAssignmentCost(a.id, 0);
  eq('A2 bedrag 0 is geldig', costOf(S, t1, cost)?.costAmount, 0);
  S().setAssignmentCost(a.id, undefined);
  eq('A3 wissen: geen bedrag', 'costAmount' in costOf(S, t1, cost)!, false);
  S().setAssignmentCost(a.id, -5);
  S().setAssignmentCost(a.id, Number.NaN);
  S().setAssignmentCost(a.id, Number.POSITIVE_INFINITY);
  eq('A4 negatief/NaN/oneindig geweigerd (bedrag blijft leeg)', 'costAmount' in costOf(S, t1, cost)!, false);
  S().setAssignmentCost(a.id, 800);
  S().undo();
  eq('A5 undo zet het lege bedrag terug', 'costAmount' in costOf(S, t1, cost)!, false);
  S().undo();
  eq('A6 undo zet bedrag 0 terug', costOf(S, t1, cost)?.costAmount, 0);
  S().redo(); S().redo();
  eq('A7 redo zet 800 terug', costOf(S, t1, cost)?.costAmount, 800);
  const laborA = costOf(S, t1, labor)!;
  S().setAssignmentCost(laborA.id, 99);
  eq('A8 bedrag op een werkresource geweigerd', 'costAmount' in costOf(S, t1, labor)!, false);

  S().assignResource(ms, cost, 1, undefined, 0);
  // Documentwissel: het bedrag reist mee in de payload.
  const first = S().activeDocumentId;
  S().newDocument();
  S().switchDocument(first);
  eq('A9 documentwissel bewaart 800', costOf(S, t1, cost)?.costAmount, 800);
  eq('A10 documentwissel bewaart 0 op de mijlpaal', costOf(S, ms, cost)?.costAmount, 0);
  // Crashherstel: dezelfde serialisatie als de auto-save.
  const back = readIFC(serializeRecoverySnapshot(S()));
  const backCost = back.resources.find(r => r.name === 'Leges');
  const amounts = back.assignments.filter(x => x.resourceId === backCost?.id).map(x => x.costAmount ?? null).sort();
  eq('A11 herstel: type COST', backCost?.type, 'COST');
  eq('A12 herstel: bedragen 0 en 800', amounts, [0, 800]);
  S().setAssignmentCost(a.id, undefined);
  const cleared = readIFC(serializeRecoverySnapshot(S()));
  const clearedCost = cleared.resources.find(r => r.name === 'Leges');
  eq('A13 herstel na wissen: geen bedrag op de taak',
    cleared.assignments.filter(x => x.resourceId === clearedCost?.id).map(x => x.costAmount ?? null).sort(), [0, null]);
}

// ── B. Geen invalidatie en geen stale, op elke route ────────────────────────────────────────────
{
  const { store, S, t1, t2, ms, cost, labor } = fixture();
  seedSteering(store, t1);
  store.setState({ scheduleStale: false });
  const ef = S().tasks.find(t => t.id === t1)!.time.earlyFinish;
  const check = (label: string) => {
    eq(`${label}: sturing blijft`, steering(S().tasks.find(t => t.id === t1)!), KEPT);
    eq(`${label}: planning niet verouderd`, S().scheduleStale, false);
  };
  S().assignResource(t1, cost, 1, undefined, 100);
  check('B1 toevoegen');
  const a = costOf(S, t1, cost)!;
  S().setAssignmentCost(a.id, 250);
  check('B2 bedrag');
  S().unassignResource(a.id);
  check('B3 verwijderen');
  S().assignResource(t1, cost, 1, undefined, 100);
  seedSteering(store, t2);
  S().moveAssignment(costOf(S, t1, cost)!.id, t2);
  check('B4 verplaatsen (bron)');
  eq('B4 verplaatsen (doel): sturing blijft', steering(S().tasks.find(t => t.id === t2)!), KEPT);
  S().moveAssignment(costOf(S, t2, cost)!.id, t1);
  // Taakraster: kostentoken erbij en eraf.
  const laborA = costOf(S, t1, labor)!;
  const withCost: TaskAssignmentToken[] = [
    { assignmentId: laborA.id, resourceId: labor, unitsPerDay: 1 },
    { assignmentId: costOf(S, t1, cost)!.id, resourceId: cost, unitsPerDay: 1, costAmount: 100 },
  ];
  eq('B5 raster: zelfde set is ok', S().runGridMutation([intent(t1, withCost)]).ok, true);
  check('B5 raster ongewijzigd');
  eq('B6 raster: kosten eraf ok', S().runGridMutation([intent(t1, withCost.slice(0, 1))]).ok, true);
  check('B6 raster kosten eraf');
  eq('B7 raster: kosten erbij ok', S().runGridMutation([intent(t1, [withCost[0], { resourceId: cost, unitsPerDay: 1 }])]).ok, true);
  check('B7 raster kosten erbij');
  // Purge: de hele kostenresource weg.
  S().removeResource(cost);
  check('B8 resource weg (purge)');
  eq('B9 de werkdatum verschoof niet', S().tasks.find(t => t.id === t1)!.time.earlyFinish, ef);
  // Contrast: een werkresource erbij wist de sturing wél (de batterij toetst iets).
  S().assignResource(t1, S().addResource({ name: 'Extra', type: 'LABOR', description: '', maxUnits: 1 }), 1);
  eq('B10 contrast: werkresource wist de nivelleerpauze', S().tasks.find(t => t.id === t1)!.splitGaps ?? null, null);
  void ms;
}

// ── C. Histogram en belasting zonder COST ──────────────────────────────────────────────────────
{
  const { S, t1, t2, cost, labor } = fixture();
  S().assignResource(t1, cost, 1, undefined, 500);
  S().assignResource(t2, cost, 1, undefined, 500);
  // Parallel aan t1: twee kostentoewijzingen op dezelfde dagen (capaciteit 1) — geen overbezetting.
  const t3 = S().addTask({ name: 'Parallel', time: createDefaultTaskTime('2026-06-01', 5) });
  S().assignResource(t3, cost, 1, undefined, 500);
  S().runCPM();
  const input = (resourceIds?: string[]) => ({
    tasks: S().tasks, sequences: S().sequences, assignments: S().assignments, resources: S().resources,
    calendar: S().calendar, calendars: S().calendars, cpmResult: S().cpmResult, bucket: 'dag' as const,
    schedulingOptions: effectiveSchedulingOptions(S().project), ...(resourceIds ? { resourceIds } : {}),
  });
  const ids = (r: ReturnType<typeof computeHistogramReport>) => r.resources.map(x => x.resourceId);
  eq('C1 ongescoped: geen COST in het rapport', ids(computeHistogramReport(input())).includes(cost), false);
  eq('C2 gescoped op alleen COST: leeg', ids(computeHistogramReport(input([cost]))), []);
  eq('C3 gemengd: alleen de werkresource', ids(computeHistogramReport(input([cost, labor]))), [labor]);
  const load = computeResourceLoad(S().resources, S().assignments, S().tasks, S().calendar, S().calendars,
    effectiveSchedulingOptions(S().project));
  eq('C4 belasting: COST heeft geen dagbelasting', Object.keys(load.load[cost] ?? {}).length, 0);
  eq('C5 belasting: geen overbezetting voor COST (twee taken tegelijk)', Object.keys(load.overallocatedDays[cost] ?? {}).length, 0);
  eq('C6 resourcebelasting in de store: geen COST', Object.keys(S().resourceLoadResult?.load[cost] ?? {}).length, 0);
}

// ── D. Mijlpaalroutes met undo ─────────────────────────────────────────────────────────────────
{
  const { S, t1, t2, ms, cost, labor, mat } = fixture();
  S().assignResource(ms, labor, 1);
  S().assignResource(ms, mat, 1);
  eq('D1 werk en materiaal op een mijlpaal geweigerd', S().assignments.filter(a => a.taskId === ms).length, 0);
  S().assignResource(ms, cost, 1, undefined, 10);
  eq('D2 kosten op een mijlpaal toegestaan', costOf(S, ms, cost)?.costAmount, 10);
  S().undo();
  eq('D3 undo haalt de kostentoewijzing van de mijlpaal', costOf(S, ms, cost), undefined);
  S().redo();
  eq('D4 redo zet hem terug', costOf(S, ms, cost)?.costAmount, 10);
  // Taak → mijlpaal: alleen als de taak uitsluitend kostentoewijzingen heeft.
  S().assignResource(t2, cost, 1, undefined, 20);
  S().updateTask(t2, { isMilestone: true });
  eq('D5 taak met alleen kosten wordt mijlpaal', S().tasks.find(t => t.id === t2)?.isMilestone, true);
  S().undo();
  eq('D6 undo maakt er weer een taak van', S().tasks.find(t => t.id === t2)?.isMilestone ?? false, false);
  S().updateTask(t1, { isMilestone: true });
  eq('D7 taak met werk wordt geen mijlpaal', S().tasks.find(t => t.id === t1)?.isMilestone ?? false, false);
  // Verplaatsen naar een mijlpaal: kosten ja, werk nee.
  S().unassignResource(costOf(S, ms, cost)!.id);
  eq('D8 kosten verplaatsen naar een mijlpaal', S().moveAssignment(costOf(S, t2, cost)!.id, ms), true);
  eq('D9 werk verplaatsen naar een mijlpaal geweigerd', S().moveAssignment(costOf(S, t1, labor)!.id, ms), false);
  S().undo();
  eq('D10 undo zet de kosten terug op de taak', [!!costOf(S, t2, cost), !!costOf(S, ms, cost)], [true, false]);
  // Taakraster op een mijlpaal.
  eq('D11 raster: kostentoken op een mijlpaal ok', S().runGridMutation([intent(ms, [{ resourceId: cost, unitsPerDay: 1 }])]).ok, true);
  eq('D12 raster: werktoken op een mijlpaal geweigerd',
    S().runGridMutation([intent(ms, [{ assignmentId: costOf(S, ms, cost)!.id, resourceId: cost, unitsPerDay: 1 }, { resourceId: labor, unitsPerDay: 1 }])]).ok, false);
  eq('D13 raster: kostentoken met inzet 2 geweigerd', S().runGridMutation([intent(t2, [{ assignmentId: costOf(S, t2, cost)?.id, resourceId: cost, unitsPerDay: 2 }])]).ok, false);
}

// ── E. Bibliotheek: typewissel over de COST-grens met toewijzingen geweigerd ─────────────────────
{
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const t = S().addTask({ name: 'T', time: createDefaultTaskTime('2026-06-01', 5) });
  const cid = S().addCompany('Kosten BV');
  S().bindProjectToCompany(cid);
  const poolId = S().promoteResourceToPool(cid, { id: 'src', name: 'Kraanmachinist', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 60 })!;
  const add = S().addLibraryResourceToProject(cid, poolId);
  const resId = add.resourceId!;
  S().assignResource(t, resId, 1);
  const typeOf = () => S().resources.find(r => r.id === resId)?.type;
  const pool = () => S().pools[cid];

  // Sluimerend document met dezelfde koppeling (`refreshAllDocumentsFromPool` raakt het ook).
  const first = S().activeDocumentId;
  // Pooledit naar COST: actief document.
  S().updatePoolResource(cid, poolId, { type: 'COST' });
  eq('E1 pool zelf wordt COST zonder tarief', [pool().resources.find(r => r.id === poolId)?.type, pool().resources.find(r => r.id === poolId)?.costPerHour ?? null], ['COST', null]);
  eq('E2 actief document: type blijft LABOR', typeOf(), 'LABOR');
  eq('E3 actief document: toewijzing blijft', S().assignments.filter(a => a.resourceId === resId).length, 1);
  eq('E4 actief document: tarief blijft', S().resources.find(r => r.id === resId)?.costPerHour, 60);
  eq('E5 actief document: toont als afwijking', classifyResourceOnOpen(S().resources.find(r => r.id === resId)!, pool()), 'deviated');
  // Expliciet bijwerken en "neem de bibliotheek": geweigerd met melding.
  const notices = () => S().ui.notifications.filter(n => n.messageKey === 'notifications.costTypeChangeRefused').length;
  S().updateProjectResourceFromLibrary(resId);
  eq('E6 bijwerken uit bibliotheek: type blijft', typeOf(), 'LABOR');
  eq('E7 bijwerken uit bibliotheek: melding', notices() >= 1, true);
  S().resolveDeviation({ kind: 'resource', projectId: resId }, 'company');
  eq('E8 afwijking "bibliotheek": type blijft', typeOf(), 'LABOR');

  // Slapend document.
  S().newDocument();
  S().updatePoolResource(cid, poolId, { description: 'nieuw' });
  const dormant = S().documents.find(d => d.id === first)?.payload;
  eq('E9 slapend document: type blijft LABOR', dormant?.resources.find(r => r.id === resId)?.type, 'LABOR');
  S().switchDocument(first);
  eq('E10 na activeren: type en toewijzing blijven', [typeOf(), S().assignments.filter(a => a.resourceId === resId).length], ['LABOR', 1]);

  // Openen/herstel-grens: een 'behind'-kopie (bestand == syncedHash) met de pool op COST.
  store.setState((s) => {
    const r = s.resources.find(x => x.id === resId)!;
    r.libraryOrigin = { ...r.libraryOrigin!, syncedHash: computeResourceHash(r) };
  });
  const boundary = materializeLibraryBoundary({ payload: capturePayload(S()), companies: S().companies, pools: S().pools, mode: 'open-boundary' });
  const opened = boundary.payload.resources.find(r => r.id === resId)!;
  eq('E11 openen: type en tarief blijven', [opened.type, opened.costPerHour], ['LABOR', 60]);
  eq('E12 openen: toewijzing blijft', boundary.payload.assignments.filter(a => a.resourceId === resId).length, 1);
  eq('E13 openen: als afwijking zichtbaar', classifyResourceOnOpen(opened, pool()), 'deviated');

  // Zonder toewijzingen mag de wissel wel; de COST-velden worden dan gewist.
  S().unassignResource(S().assignments.find(a => a.resourceId === resId)!.id);
  S().updateProjectResourceFromLibrary(resId);
  eq('E14 zonder toewijzingen: wissel naar COST toegestaan, tarief weg',
    [typeOf(), S().resources.find(r => r.id === resId)?.costPerHour ?? null], ['COST', null]);
}

// ── F. Pool-JSON: COST als MATERIAL + markering ─────────────────────────────────────────────────
{
  const store = createAppStore();
  const S = () => store.getState();
  const cid = S().addCompany('Pool BV');
  S().addPoolResource(cid, { name: 'Leges', type: 'COST', description: '', maxUnits: 1 });
  S().addPoolResource(cid, { name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 5 });
  const ifc = writePoolIFC(S().pools[cid]);
  const json = ifc.split('\n').find(l => l.includes('OPS_Library') || l.includes(POOL_COST_RESOURCE_MARKER)) ?? '';
  eq('F1 pool-JSON schrijft geen type COST', /"type":"COST"/.test(ifc), false);
  eq('F2 pool-JSON draagt de markering', ifc.includes(`"${POOL_COST_RESOURCE_MARKER}":true`), true);
  const back = await readPoolIFC(ifc);
  eq('F3 lezer zet COST terug', back.resources.find(r => r.name === 'Leges')?.type, 'COST');
  eq('F4 materiaal blijft materiaal', back.resources.find(r => r.name === 'Beton')?.type, 'MATERIAL');
  eq('F5 markering verdwijnt bij lezen', POOL_COST_RESOURCE_MARKER in (back.resources.find(r => r.name === 'Leges') ?? {}), false);
  void json;
}

// ── G. Resourcevelden en typewissel in de store ─────────────────────────────────────────────────
{
  const { S, t1, cost, labor } = fixture();
  S().updateResource(cost, { costPerHour: 10, maxUnits: 3, unitOfMeasure: 'st', calendarId: S().calendar.id, availabilitySteps: [{ from: '2026-06-01', maxUnits: 2 }] });
  const r = S().resources.find(x => x.id === cost)!;
  eq('G1 COST krijgt geen tarief/eenheid/kalender/stappen, max. 1',
    [r.costPerHour ?? null, r.unitOfMeasure ?? null, r.calendarId ?? null, r.availabilitySteps ?? null, r.maxUnits], [null, null, null, null, 1]);
  S().updateResource(labor, { type: 'COST' });
  eq('G2 werkresource met toewijzing wordt geen COST', S().resources.find(x => x.id === labor)?.type, 'LABOR');
  S().assignResource(t1, cost, 1, undefined, 5);
  S().updateResource(cost, { type: 'LABOR' });
  eq('G3 COST met toewijzing wordt geen LABOR', S().resources.find(x => x.id === cost)?.type, 'COST');
  const spare = S().addResource({ name: 'Los', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 40 });
  S().updateResource(spare, { type: 'COST' });
  const sp = S().resources.find(x => x.id === spare)!;
  eq('G4 zonder toewijzing: wissel naar COST wist het tarief', [sp.type, sp.costPerHour ?? null, sp.maxUnits], ['COST', null, 1]);
}

// ── H. Een kostenresource stuurt de duur niet ───────────────────────────────────────────────────
{
  const { S, t1, cost } = fixture();
  S().setTaskWorkRule(t1, 'FIXED_WORK');
  const before = S().tasks.find(t => t.id === t1)!.time.durationMinutes ?? S().tasks.find(t => t.id === t1)!.time.scheduleDuration;
  S().assignResource(t1, cost, 1, undefined, 100);
  const after = S().tasks.find(t => t.id === t1)!.time.durationMinutes ?? S().tasks.find(t => t.id === t1)!.time.scheduleDuration;
  eq('H1 vast werk: kosten erbij verandert de duur niet', after, before);
  S().unassignResource(costOf(S, t1, cost)!.id);
  const removed = S().tasks.find(t => t.id === t1)!.time.durationMinutes ?? S().tasks.find(t => t.id === t1)!.time.scheduleDuration;
  eq('H2 vast werk: kosten eraf verandert de duur niet', removed, before);
}

// ── I. Een kostentoewijzing verandert de koppeling van een oude contour niet (review 1, BLOKKEERT 2) ──
// Eén werktoewijzing, capaciteit 1, een oude contour zonder `resourceId` (0,25 / 1,75 over twee dagen).
// De legacy-terugval koppelt die contour alleen als de taak precies één toewijzing heeft. Een
// kostentoewijzing erbij mag dat niet veranderen: belasting, histogram en nivelleerder zien vóór
// en na hetzelfde, met de piek en de overbezetting op dag 2.
{
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const taskId = S().addTask({ name: 'Oud project', time: createDefaultTaskTime('2026-06-01', 2) });
  const labor = S().addResource({ name: 'Timmerman', type: 'LABOR', maxUnits: 1, description: '' });
  const cost = S().addResource({ name: 'Leges', type: 'COST', maxUnits: 1, description: '' });
  S().assignResource(taskId, labor, 1);
  S().runCPM();
  store.setState(s => {
    s.tasks.find(t => t.id === taskId)!.timephasedContours = [{ resourceUid: 7, periods: [
      { afterMinutes: 0, minutes: 480, workMinutes: 120 },
      { afterMinutes: 480, minutes: 480, workMinutes: 840 },
    ] }];
  });
  const loadOf = () => {
    const r = computeResourceLoad(S().resources, S().assignments, S().tasks, S().calendar, S().calendars, effectiveSchedulingOptions(S().project));
    return { load: r.load[labor], over: r.overallocatedDays[labor] ?? [] };
  };
  const histogramOf = () => computeHistogramReport({
    tasks: S().tasks, sequences: S().sequences, assignments: S().assignments, resources: S().resources,
    calendar: S().calendar, calendars: S().calendars, cpmResult: S().cpmResult, bucket: 'dag',
    schedulingOptions: effectiveSchedulingOptions(S().project),
  }).resources.find(r => r.resourceId === labor)!.buckets.map(b => ({ day: b.start, load: b.load, peak: b.peakDayLoad, over: b.overallocatedDays }));
  const levelOf = () => {
    const r = levelResources(S().tasks, S().sequences, S().resources, S().assignments, S().calendar, S().calendars,
      S().cpmResult!, { constrainToFloat: false }, legacyCpmOptions());
    return { unresolved: r.unresolved, reasons: r.unresolvedReasons, overruns: r.intrinsicOverruns ?? {}, shifts: r.shifts };
  };
  const contouredOf = () => {
    const task = S().tasks.find(t => t.id === taskId)!;
    return [...contouredAssignmentIds(task, contourSiblings(S().assignments.filter(a => a.taskId === taskId), costResourceIds(S().resources)))];
  };
  const laborAssignment = costOf(S, taskId, labor)!;
  const before = { load: loadOf(), histogram: histogramOf(), level: levelOf(), contoured: contouredOf() };
  eq('I0 vóór kosten: belasting 0,25 / 1,75, dag 2 overbezet', before.load, { load: { '2026-06-01': 0.25, '2026-06-02': 1.75 }, over: ['2026-06-02'] });
  eq('I0 vóór kosten: histogrampiek 1,75 op dag 2', before.histogram.map(b => b.peak), [0.25, 1.75]);
  eq('I0 vóór kosten: nivelleerder ziet een conflict', Object.keys(before.level.unresolved), [taskId]);
  eq('I0 vóór kosten: contour hoort bij de werktoewijzing', before.contoured, [laborAssignment.id]);
  S().assignResource(taskId, cost, 1, undefined, 1250);
  eq('I1 belasting blijft gelijk met kosten erbij', loadOf(), before.load);
  eq('I2 histogram blijft gelijk met kosten erbij (piek en overbezetting)', histogramOf(), before.histogram);
  eq('I3 nivelleerder blijft gelijk met kosten erbij', levelOf(), before.level);
  eq('I4 contourkoppeling (paneel, resourcediagram) blijft gelijk', contouredOf(), before.contoured);
  // De store-actie vindt de oude contour nog: loslaten verwijdert hem.
  S().setAssignmentContour(laborAssignment.id, null);
  eq('I5 loslaten vindt de oude contour ook met kosten erbij', S().tasks.find(t => t.id === taskId)!.timephasedContours ?? [], []);
}

if (diffs.length === 0) {
  console.log(`OK  cost-resource: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  cost-resource: ${diffs.length}/${checks} checks GEFAALD`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
