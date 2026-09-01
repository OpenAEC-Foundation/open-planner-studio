// Issue #27 etappe 2 — spreadsheet-terugimport (voortgang bijwerken uit een blad).
// Vier delen, in de volgorde waarin de plan-taken ze opleveren:
//   Deel 1 (T2) — matchProgressRows: overrides → id → WBS.
//   Deel 2 (T3) — buildProgressImportPlan met een STUB-planner (geen store, geen echte invarianten).
//   Deel 3 (T3) — buildProgressImportPlan met de ECHTE planner (planTaskCellEdits + de store).
//   Deel 4 (T5) — de store-acties previewProgressImport/applyProgressImport (atomiciteit, undo,
//                 drift-herberekening, overrides).
// Draait via run.sh (registratie: T11). Exit 0 = alles groen; de suite print "alles groen" ook bij
// exit 1 wanneer het bundelen faalt — de exitcode is het enige geldige oordeel.

import { matchProgressRows } from '@/services/progressImport/matchRows';
import { buildProgressImportPlan, type ProgressPlanDeps } from '@/services/progressImport/buildPlan';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { useAppStore } from '@/state/appStore';
import { buildTaskEditPlanEnvironment } from '@/state/gridTransaction';
import { planTaskCellEdits } from '@/engine/taskGrid/taskEditPlan';
import type { ProgressOverrides, ProgressRow } from '@/services/progressImport/types';
import type { Task } from '@/types/task';
import type { CellEditIntent, CellValidationError, GridResult } from '@/types/taskGrid';
import type { PlannedTaskEdit } from '@/engine/taskGrid/taskEditPlan';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

let taskSeq = 0;
function makeTask(wbsCode: string, overrides: Partial<Task> = {}): Task {
  taskSeq++;
  return {
    id: `task-${taskSeq}`,
    name: `Taak ${taskSeq}`,
    description: '',
    wbsCode,
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 500,
    parentId: null,
    childIds: [],
    resourceIds: [],
    time: createDefaultTaskTime('2026-01-05', 5),
    ...overrides,
  };
}
function makeRow(rowNumber: number, fields: Partial<ProgressRow> = {}): ProgressRow {
  return { rowNumber, ...fields };
}
const pct = (value: number): ProgressRow['completion'] => ({ kind: 'value', value });
const badPct = (raw: string): ProgressRow['completion'] => ({ kind: 'unreadable', raw });
const dateVal = (iso: string): { kind: 'value'; iso: string } => ({ kind: 'value', iso });
const badDate = (raw: string): { kind: 'unreadable'; raw: string } => ({ kind: 'unreadable', raw });

/** Stub-planner (Deel 2): past de gevraagde velden RECHTSTREEKS toe, zonder invarianten — dat is
 *  precies het verschil met Deel 3 (de ECHTE `planTaskCellEdits`), waar 100%-completion bv. zelf een
 *  actualStart/actualFinish afleidt. */
function stubPlanEdits(
  task: Task,
  edits: readonly CellEditIntent[],
): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
  const next: Task = { ...task, time: { ...task.time } };
  for (const edit of edits) {
    const id = String(edit.columnId);
    if (id === 'task.time.completion') next.time.completion = edit.value as number;
    else if (id === 'task.time.actualStart') next.time.actualStart = edit.value as string;
    else if (id === 'task.time.actualFinish') next.time.actualFinish = edit.value as string;
  }
  return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
}
const stubDeps: ProgressPlanDeps = { planEdits: stubPlanEdits };

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel 1 — matching (T2): overrides → id → WBS, resolutievolgorde exact volgens A11.
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  // ── Scenario `m`: pure automatische matching, geen overrides. ──
  const A = makeTask('wbs-a');
  const B = makeTask('wbs-b');
  const D1 = makeTask('wbs-dup');
  const D2 = makeTask('wbs-dup');
  const E = makeTask('wbs-e');
  const tasksM = [A, B, D1, D2, E];
  const rowsM: ProgressRow[] = [
    makeRow(2, { taskId: A.id, wbsCode: B.wbsCode }),      // id èn een andere taak se WBS: id moet winnen
    makeRow(3, { taskId: 'ghost-id', wbsCode: B.wbsCode }), // onbekend id ⇒ terugval op de unieke WBS
    makeRow(4, { wbsCode: 'wbs-dup' }),                     // twee dragers van dezelfde WBS
    makeRow(5, { wbsCode: 'wbs-none' }),                    // niets bruikbaars
    makeRow(6, { taskId: E.id }),                           // eerste claim op E
    makeRow(7, { taskId: E.id }),                           // tweede claim op E (dezelfde taak, andere rij)
  ];
  const m = matchProgressRows(rowsM, tasksM);

  eq('id wint van WBS', m.matches[0].match, 'id');
  eq('…en levert taak A', m.matches[0].taskId, A.id);
  eq('onbekend id valt terug op WBS', m.matches[1].match, 'wbs');
  eq('…en levert taak B', m.matches[1].taskId, B.id);
  eq('dubbele WBS ⇒ ambiguousWbs', m.matches[2].reason, 'ambiguousWbs');
  eq('niets bruikbaars ⇒ unmatched', m.matches[3].reason, 'unmatched');
  eq('…en de EERSTE rij houdt de taak', m.matches[4].taskId, E.id);
  eq('tweede claim ⇒ duplicateRow', m.matches[5].reason, 'duplicateRow');

  // ── Scenario `o`: een override koppelt een verder kansloze rij. ──
  const C = makeTask('wbs-c');
  const oOverrides: ProgressOverrides = new Map([[2, C.id]]);
  const o = matchProgressRows([makeRow(2, {})], [C], oOverrides);
  eq('override koppelt een losse rij', o.matches[0].match, 'manual');
  eq('…aan de gekozen taak', o.matches[0].taskId, C.id);

  // ── Scenario `o2`: een override wint van een automatische id-treffer van een ANDERE rij. ──
  // Bindend (A11 §1): overrides resolven VOORDAT de automatische matching draait, dus de
  // automatische id-treffer op dezelfde taak in een andere rij vindt de taak al geclaimd.
  const F = makeTask('wbs-f');
  const o2Overrides: ProgressOverrides = new Map([[3, F.id]]);
  const o2 = matchProgressRows(
    [makeRow(2, { taskId: F.id }), makeRow(3, {})],
    [F],
    o2Overrides,
  );
  eq('override wint van een id-treffer van een ANDERE rij', o2.matches[0].reason, 'duplicateRow');
  eq('…want de override claimde de taak eerst', o2.matches[1].match, 'manual');
  eq('…aan dezelfde taak', o2.matches[1].taskId, F.id);

  // ── Scenario `o3`: een override naar de taak die automatisch al gevonden zou zijn = bevestiging. ──
  const X = makeTask('wbs-x');
  const G = makeTask('wbs-g');
  const o3Overrides: ProgressOverrides = new Map([[3, G.id]]);
  const o3 = matchProgressRows(
    [makeRow(2, { taskId: X.id }), makeRow(3, { wbsCode: G.wbsCode })],
    [X, G],
    o3Overrides,
  );
  eq('override naar dezelfde taak = bevestiging', o3.matches[1].match, 'manual');
  eq('…niet meer wbs (de twijfel is weg)', o3.matches[1].taskId, G.id);

  // ── Scenario `o4`: twee overrides naar één taak — de eerste in rijvolgorde wint. ──
  const K = makeTask('wbs-k');
  const o4Overrides: ProgressOverrides = new Map([[2, K.id], [4, K.id]]);
  const o4 = matchProgressRows(
    [makeRow(2, {}), makeRow(3, {}), makeRow(4, {})],
    [K],
    o4Overrides,
  );
  eq('eerste override op één taak wint', o4.matches[0].match, 'manual');
  eq('…en claimt de taak', o4.matches[0].taskId, K.id);
  eq('twee overrides op één taak: tweede geweigerd', o4.matches[2].reason, 'duplicateRow');

  // ── Scenario `o5`: een override naar een niet meer bestaande taak wordt genegeerd, niet stil. ──
  const L = makeTask('wbs-l');
  const o5Overrides: ProgressOverrides = new Map([[2, 'verdwenen-taak-id']]);
  const o5 = matchProgressRows([makeRow(2, { wbsCode: L.wbsCode })], [L], o5Overrides);
  eq('override naar een verdwenen taak wordt genegeerd', o5.matches[0].match, 'wbs');
  ok('…en gerapporteerd', o5.ignoredOverrideRows.includes(2));
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel 2 — planvorming (T3, STUB-planner): no-op-tolerantie, weigeringen, betwijfelde koppelingen.
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  // ── Ongewijzigd blad ⇒ nul wijzigingen, alles noop. ──
  const t1 = makeTask('wbs-t1', { time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33 } });
  const t2 = makeTask('wbs-t2', { time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.5 } });
  const rowsSame: ProgressRow[] = [
    makeRow(2, { taskId: t1.id, completion: pct(0.33) }),
    makeRow(3, { taskId: t2.id, completion: pct(0.5) }),
  ];
  const plan = buildProgressImportPlan(rowsSame, [t1, t2], stubDeps);
  eq('ongewijzigd blad ⇒ nul wijzigingen', plan.appliedCount, 0);
  eq('…en alles telt als noop', plan.noopCount, rowsSame.length);

  // ── Afgeronde procenten (de export rondt af, A6) zijn geen wijziging; een echte wijziging wél. ──
  const tRound = makeTask('wbs-round', { time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.333 } });
  const planRounded = buildProgressImportPlan(
    [makeRow(2, { taskId: tRound.id, completion: pct(0.33) })], [tRound], stubDeps,
  );
  eq('afgeronde procenten zijn geen wijziging', planRounded.appliedCount, 0);
  const tChange = makeTask('wbs-change', { time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.333 } });
  const planChanged = buildProgressImportPlan(
    [makeRow(2, { taskId: tChange.id, completion: pct(0.40) })], [tChange], stubDeps,
  );
  eq('een echte procentwijziging telt wél', planChanged.appliedCount, 1);

  // ── Een datum-only invoer degradeert een bestaande datetime nooit stil tot middernacht (A6). ──
  const tDt = makeTask('wbs-dt', {
    time: { ...createDefaultTaskTime('2026-01-05', 5), actualStart: '2026-06-09T08:30' },
  });
  const planDt = buildProgressImportPlan(
    [makeRow(2, { taskId: tDt.id, actualStart: dateVal('2026-06-09') })], [tDt], stubDeps,
  );
  eq('datum-only degradeert een datetime niet', planDt.rows[0].outcome, 'noop');

  // ── Een verzameltaak wordt geweigerd — `planTaskCellEdits` bewaakt dit zelf niet (A3). ──
  const tSum = makeTask('wbs-sum', { childIds: ['child-1'] });
  const planSum = buildProgressImportPlan(
    [makeRow(2, { taskId: tSum.id, completion: pct(0.5) })], [tSum], stubDeps,
  );
  eq('verzameltaak wordt geweigerd', planSum.rows[0].reason, 'summaryTask');

  // ── Een onleesbaar veld wordt geweigerd — NOOIT stilzwijgend "vandaag" (A5). ──
  const tBad = makeTask('wbs-bad');
  const planBad = buildProgressImportPlan(
    [makeRow(2, { taskId: tBad.id, actualStart: badDate('volgende week') })], [tBad], stubDeps,
  );
  eq('onleesbare datum wordt geweigerd', planBad.rows[0].reason, 'unreadableDate');
  eq('…en NOOIT stilzwijgend vandaag', planBad.rows[0].changes.length, 0);
  const tBadPct = makeTask('wbs-bad-pct');
  const planBadPct = buildProgressImportPlan(
    [makeRow(2, { taskId: tBadPct.id, completion: badPct('bijna klaar') })], [tBadPct], stubDeps,
  );
  eq('onleesbaar percentage wordt geweigerd', planBadPct.rows[0].reason, 'unreadableNumber');

  // ── Eén geweigerde rij stopt het blad niet — elke rij is onafhankelijk (A3). ──
  const tMixA = makeTask('wbs-mix-a');
  const tMixB = makeTask('wbs-mix-b');
  const planMixed = buildProgressImportPlan(
    [
      makeRow(2, { taskId: tMixA.id, completion: pct(0.5) }),
      makeRow(3, { taskId: tMixB.id, completion: pct(0.6) }),
      makeRow(4, { completion: pct(0.7) }), // geen taskId/wbsCode ⇒ unmatched ⇒ refused
    ],
    [tMixA, tMixB],
    stubDeps,
  );
  ok('één geweigerde rij stopt het blad niet', planMixed.appliedCount === 2 && planMixed.refusedCount === 1);

  // ── Een rij zonder enige voortgangswaarde. ──
  const tEmpty = makeTask('wbs-empty');
  const planEmpty = buildProgressImportPlan(
    [makeRow(2, { taskId: tEmpty.id })], [tEmpty], stubDeps,
  );
  eq('rij zonder voortgangskolommen', planEmpty.rows[0].reason, 'noProgressColumns');

  // ── Een WBS-match is "betwijfeld" totdat hij bevestigd of gecorrigeerd is (A11). ──
  const tWbs = makeTask('wbs-doubt');
  const planWbs = buildProgressImportPlan(
    [makeRow(2, { wbsCode: tWbs.wbsCode, completion: pct(0.5) })], [tWbs], stubDeps,
  );
  eq('WBS-match is betwijfeld', planWbs.rows[0].needsConfirmation, true);
  eq('…en telt in de teller', planWbs.needsConfirmationCount, 1);
  const planOk = buildProgressImportPlan(
    [makeRow(2, { wbsCode: tWbs.wbsCode, completion: pct(0.5) })], [tWbs], stubDeps,
    new Map([[2, tWbs.id]]),
  );
  eq('bevestigen haalt de twijfel weg', planOk.rows[0].needsConfirmation, undefined);

  // ── Losse rijen (unmatched/ambiguousWbs) worden geteld, duplicateRow NIET (die telt apart). ──
  const dupA = makeTask('wbs-loose-dup');
  const dupB = makeTask('wbs-loose-dup');
  const planLoose = buildProgressImportPlan(
    [
      makeRow(2, { completion: pct(0.1) }),                       // unmatched
      makeRow(3, { wbsCode: 'wbs-loose-dup', completion: pct(0.2) }), // ambiguousWbs
    ],
    [dupA, dupB],
    stubDeps,
  );
  eq('losse rijen worden geteld', planLoose.needsLinkCount, 2);

  // ── Een handmatig gekoppelde rij draait mee als was het een id-match, met dezelfde changes. ──
  const tById = makeTask('wbs-linked-id');
  const planById = buildProgressImportPlan(
    [makeRow(2, { taskId: tById.id, completion: pct(0.6) })], [tById], stubDeps,
  );
  const tLinked = makeTask('wbs-linked-manual');
  const planLinked = buildProgressImportPlan(
    [makeRow(2, { completion: pct(0.6) })], [tLinked], stubDeps,
    new Map([[2, tLinked.id]]),
  );
  eq('een gekoppelde rij draait gewoon mee', planLinked.appliedCount, 1);
  eq('…met dezelfde changes als een id-match',
    JSON.stringify(planLinked.rows[0].changes), JSON.stringify(planById.rows[0].changes));
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel 3 — planvorming met de ECHTE planner (T3): `planTaskCellEdits` + `buildTaskEditPlanEnvironment`,
// gevoed vanuit een echte store, zodat de invarianten uit `taskMutationRules.ts` echt meedraaien.
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const S = () => useAppStore.getState();
  S().newProject();
  S().setStatusDate('2026-01-10');
  const idA = S().addTask({ name: 'A ná statusdatum', time: createDefaultTaskTime('2026-01-05', 5) });
  const idB = S().addTask({ name: 'B naar 100%', time: createDefaultTaskTime('2026-01-05', 5) });
  const idC = S().addTask({ name: 'C finish vóór start', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();

  const realDeps: ProgressPlanDeps = {
    planEdits: (task, edits) => planTaskCellEdits(task, edits, buildTaskEditPlanEnvironment(S(), task)),
  };
  const rows: ProgressRow[] = [
    // ná de statusdatum (2026-01-10) ⇒ geweigerd door de ECHTE invariant, niet door onze eigen kern.
    makeRow(2, { taskId: idA, actualStart: dateVal('2026-01-15') }),
    // 100% completion, geen actualStart in het blad ⇒ de invariant leidt die ZELF af.
    makeRow(3, { taskId: idB, completion: pct(1) }),
    // finish vóór start ⇒ geweigerd door dezelfde invariant.
    makeRow(4, { taskId: idC, actualStart: dateVal('2026-01-10'), actualFinish: dateVal('2026-01-08') }),
  ];
  const plan = buildProgressImportPlan(rows, S().tasks, realDeps);

  eq('actual ná de statusdatum wordt geweigerd', plan.rows[0].reason, 'actualAfterStatusDate');
  eq('invarianten leiden actualStart af', plan.rows[1].changes.some(c => c.field === 'actualStart'), true);
  eq('…en de geplande status is COMPLETED', plan.rows[1].plannedTask!.status, 'COMPLETED');
  eq('finish vóór start wordt geweigerd', plan.rows[2].reason, 'actualFinishBeforeStart');
}

if (diffs.length > 0) {
  console.error(`FAIL progress-import: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-import: ${checks}/${checks}`);
}
