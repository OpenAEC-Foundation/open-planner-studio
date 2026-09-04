// Issue #27 etappe 2 — spreadsheet-terugimport (voortgang bijwerken uit een blad).
// Vier delen, in de volgorde waarin de plan-taken ze opleveren:
//   Deel 1 (T2) — matchProgressRows: overrides → id → WBS.
//   Deel 2 (T3) — buildProgressImportPlan met een STUB-planner (geen store, geen echte invarianten).
//   Deel 3 (T3) — buildProgressImportPlan met de ECHTE planner (planTaskCellEdits + de store).
//   Deel 4 (T5) — de store-acties previewProgressImport/applyProgressImport (atomiciteit, undo,
//                 drift-herberekening, overrides).
//   Deel 5 — regressie na twee fixrondes op de no-op-vergelijking op completion (Opus-eindreview
//            bevindingen 1+2, daarna Opus-hercheck N-B): `isCompletionUnchanged` (buildPlan.ts) +
//            `formatCompletionPercent` (csvWriter.ts), via een ECHTE writeCSV→parseProgressCsv→
//            finalizeProgressRows-round-trip en echte handmatige bladen, niet handgemaakte rijen.
// Draait via run.sh (registratie: T11). Exit 0 = alles groen; de suite print "alles groen" ook bij
// exit 1 wanneer het bundelen faalt — de exitcode is het enige geldige oordeel.

import { matchProgressRows } from '@/services/progressImport/matchRows';
import { buildProgressImportPlan, type ProgressPlanDeps } from '@/services/progressImport/buildPlan';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { useAppStore } from '@/state/appStore';
import { buildTaskEditPlanEnvironment } from '@/state/gridTransaction';
import { planTaskCellEdits } from '@/engine/taskGrid/taskEditPlan';
import { writeCSV } from '@/services/csv/csvWriter';
import { parseProgressCsv } from '@/services/progressImport/parseProgressCsv';
import { finalizeProgressRows } from '@/services/progressImport/sheetValues';
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
  // N-G (fixronde na de Opus-hercheck): een `plannedTask!` op een onverwacht niet-`apply`-uitkomst
  // crasht de hele suite met een kale stacktrace i.p.v. een nette diffregel — eerst de presentie
  // toetsen, dan pas via `?.` erin lezen (een ontbrekend `plannedTask` wordt dan gewoon `undefined`
  // in de `eq`-vergelijking, zichtbaar als een normale rode regel).
  ok('…rij 1 leverde een plannedTask op', plan.rows[1].plannedTask !== undefined);
  eq('…en de geplande status is COMPLETED', plan.rows[1].plannedTask?.status, 'COMPLETED');
  eq('finish vóór start wordt geweigerd', plan.rows[2].reason, 'actualFinishBeforeStart');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel 4 — de store-acties (T5): previewProgressImport/applyProgressImport. Atomiciteit, één
// undo-stap voor het HELE blad, drift-herberekening (A8) en overrides die de apply meemoeten (A11).
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const S = () => useAppStore.getState();
  S().newProject();
  const idA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-01-05', 5) });
  const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  useAppStore.setState((s) => { s.historyEvents = []; s.nextHistorySequence = 1; s.isDirty = false; });

  const beforeA = { ...S().tasks.find((t) => t.id === idA)!.time };
  const beforeB = { ...S().tasks.find((t) => t.id === idB)!.time };

  const rows: ProgressRow[] = [
    makeRow(2, { taskId: idA, completion: pct(0.4) }),
    makeRow(3, { taskId: idB, completion: pct(0.5) }),
    makeRow(4, { completion: pct(0.9) }), // geen taskId/wbsCode ⇒ unmatched ⇒ refused
  ];

  // ── Preview muteert niets en telt de wijzigingen. ──
  const preview = S().previewProgressImport(rows);
  eq('preview telt de wijzigingen', preview.appliedCount, 2);
  const afterPreviewA = S().tasks.find((t) => t.id === idA)!;
  eq('preview muteert niets', afterPreviewA.time.completion, beforeA.completion);

  // ── Apply schrijft de geplande taak, zet status via de invarianten en markeert de planning
  //    verouderd — in PRECIES één undo-stap voor het hele blad. ──
  const historyLenBefore = S().historyEvents.length;
  S().applyProgressImport(rows);
  const t = S().tasks.find((x) => x.id === idA)!;
  eq('apply schrijft de geplande taak', t.time.completion, 0.4);
  eq('apply zet status via de invarianten', t.status, 'STARTED');
  ok('apply markeert de planning verouderd', S().scheduleStale === true);
  const historyLenAfter = S().historyEvents.length;
  ok('apply pusht precies één undo-stap voor het hele blad', historyLenAfter === historyLenBefore + 1);

  S().undo();
  const t2 = S().tasks.find((x) => x.id === idA)!;
  const t3 = S().tasks.find((x) => x.id === idB)!;
  eq('één Ctrl+Z herstelt het hele blad', t2.time.completion, beforeA.completion);
  eq('…en niet slechts één rij', t3.time.completion, beforeB.completion);

  // ── Een blad zonder wijzigingen pusht geen undo-stap (net als een geweigerde setActualStart) —
  //    en laat scheduleStale ONGEMOEID (de runtime-eigen snapshotvergelijking in `finishUndoable`
  //    ontdubbelt de undo-stap toch al bij een écht ongewijzigde state; `scheduleStale` niet: die
  //    wordt onvoorwaardelijk gezet door `finishMutation({stale:true})`, dus ALLEEN de vroege
  //    `appliedCount === 0`-return in A4 voorkomt dat een no-op-blad de planning toch veroudert). ──
  useAppStore.setState((s) => { s.scheduleStale = false; });
  const historyLenBefore2 = S().historyEvents.length;
  S().applyProgressImport([makeRow(2, { taskId: idA, completion: pct(beforeA.completion) })]);
  eq('een blad zonder wijzigingen pusht geen undo-stap', S().historyEvents.length, historyLenBefore2);
  ok('…en laat scheduleStale ongemoeid', S().scheduleStale === false);

  // ── Een geweigerde rij raakt zijn taak niet aan. ──
  const idG = S().addTask({ name: 'G', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  S().applyProgressImport([makeRow(5, { taskId: idG, actualStart: badDate('rommel') })]);
  const untouched = S().tasks.find((x) => x.id === idG)!;
  ok('geweigerde rij raakt zijn taak niet aan', untouched.time.actualStart === undefined);

  // ── Apply herberekent tegen de LIVE taken (A8) — niet het (mogelijk verouderde) preview-plan. ──
  const idD = S().addTask({ name: 'D', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  const rowD = makeRow(6, { taskId: idD, completion: pct(0.3) });
  const previewD = S().previewProgressImport([rowD]);
  eq('sanity: preview D zou toepassen', previewD.appliedCount, 1);
  // Drift: D wordt tussen preview en apply een verzameltaak (bv. via een MCP-tool of een andere
  // gebruiker) — de apply moet dát zien, niet het preview-plan van vóór de drift hergebruiken.
  useAppStore.setState((s) => {
    const index = s.tasks.findIndex((x) => x.id === idD);
    s.tasks[index]!.childIds = ['fake-child-id'];
  });
  const applied = S().applyProgressImport([rowD]);
  eq('apply herberekent tegen de live taken', applied.refusedCount, 1);

  // ── Overrides moeten de apply meemaken, anders gaat de handmatige koppeling verloren (A11). ──
  const idE = S().addTask({ name: 'E', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  const rowE = makeRow(7, { completion: pct(0.6) }); // geen taskId/wbsCode ⇒ zonder override unmatched
  const overridesE: ProgressOverrides = new Map([[7, idE]]);
  const previewLinked = S().previewProgressImport([rowE], overridesE);
  eq('preview met override koppelt de rij', previewLinked.appliedCount, 1);
  S().applyProgressImport([rowE], overridesE);
  const linkedTask = S().tasks.find((x) => x.id === idE)!;
  eq('apply MET overrides schrijft die rij', linkedTask.time.completion, 0.6);

  const idF = S().addTask({ name: 'F', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  const rowF = makeRow(8, { completion: pct(0.6) }); // dezelfde rij, nu ZONDER override
  S().applyProgressImport([rowF]);
  const unlinkedTask = S().tasks.find((x) => x.id === idF)!;
  eq('apply ZONDER overrides schrijft hem niet', unlinkedTask.time.completion, 0);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel 5 — regressie op de no-op-vergelijking op completion, twee fixrondes.
//
// Ronde 1 (Opus-eindreview, bevindingen 1+2): een vaste float-epsilon is per constructie stuk —
// de export rondde destijds af op hele procenten, dus 0.335 kwam als "34" terug en
// `0.34 - 0.335 = 0.005000000000000004` lag net boven élke drempel die ook "45,5" (E6) nog als
// echte wijziging moest doorlaten.
//
// Ronde 2 (Opus-hercheck, N-B, BEVESTIGD): de vorm-bewuste vergelijking uit ronde 1 loste zelf
// een nieuw probleem op — "100" op een taak van 99,5% (`Math.round(99.5) === Math.round(100)`)
// en "0" op 0,4% verdwenen stil als `noop`. Wie 100 (of 0) typt meldt een taak af (of heropent
// hem) — dat moet ALTIJD een wijziging zijn. Twee helften die hier samen kloppen: `writeCSV`
// schrijft nu fractionele procenten (tot 4 decimalen, csvWriter.ts) en `isCompletionUnchanged`
// (buildPlan.ts) is precisie-VAN-DE-INVOER-bewust, met 0%/100% als harde uitzondering.
//
// Dit hele deel gaat EXPRES via de ECHTE schrijver/lezer/finalizer — ook de handmatige
// percentages ("33", "33,4", "100", "0") staan als tekst in een echt CSV-blad (N-F: niet met de
// hand als `ProgressRow` gebouwd — `parseSheetPercent("33,4")` levert 0.33399999999999996, geen
// het net-iets-andere 0.334 dat je zou krijgen door de fractie zelf uit te rekenen).
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const S = () => useAppStore.getState();
  const realDeps: ProgressPlanDeps = {
    planEdits: (task, edits) => planTaskCellEdits(task, edits, buildTaskEditPlanEnvironment(S(), task)),
  };

  // ── Round-trip: vijf taken, inclusief de twee die ronde 1 liet zien (0.335/0.125) plus 0.995
  //    (ronde 2 se scherpste geval, vlak onder de 100%-uitzondering) en 0.33333 (drie decimalen).
  //    Een ONGEWIJZIGD, écht geschreven en teruggelezen blad mag NUL wijzigingen tonen — en
  //    nergens een afgeleide actualStart, want dat zou betekenen dat een no-op-rij tóch als
  //    `apply` door de invarianten heen liep. ──
  S().newProject();
  const idH = S().addTask({ name: 'H', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.335 } });
  const idI = S().addTask({ name: 'I', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.125 } });
  const idJ = S().addTask({ name: 'J', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33 } });
  const idP = S().addTask({ name: 'P', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.995 } });
  const idQ = S().addTask({ name: 'Q', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33333 } });
  S().runCPM();

  const before = S();
  const roundTripCsv = writeCSV(
    before.project, before.calendar, before.tasks, before.sequences,
    before.resources, before.assignments, before.customTaskTypes,
  );
  const roundTripSheet = parseProgressCsv(roundTripCsv);
  const roundTripRows = finalizeProgressRows(roundTripSheet, 'dmy');
  const roundTripPlan = buildProgressImportPlan(roundTripRows, S().tasks, realDeps);
  eq('round-trip van de eigen export ⇒ nul wijzigingen', roundTripPlan.appliedCount, 0);
  ok('…en dus ook geen enkele rij die als apply doorliep',
    roundTripPlan.rows.every((row) => row.outcome !== 'apply'));
  ok('…en NERGENS een afgeleide actualStart in de changes',
    roundTripPlan.rows.every((row) => !row.changes.some((c) => c.field === 'actualStart')));
  ok('sanity: alle vijf taken zaten echt in de round-trip', [idH, idI, idJ, idP, idQ].every(
    (id) => roundTripRows.some((row) => row.taskId === id),
  ));

  // ── N-B: vier precisiecases, ELK via een echt handmatig CSV-blad (twee kolommen volstaan —
  //    `OPS Task ID` + `Completion (%)` — precies wat `parseProgressCsv` nodig heeft). ──
  const idL = S().addTask({ name: 'L', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.334 } });
  const idM = S().addTask({ name: 'M', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33 } });
  const idN = S().addTask({ name: 'N', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.995 } });
  const idO = S().addTask({ name: 'O', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.004 } });
  S().runCPM();

  const manualCsv = [
    'OPS Task ID;Completion (%)',
    `${idL};33`,   // "33" op een taak van 33,4% ⇒ noop (afronding eigen export, verdedigbaar)
    `${idM};33,4`, // "33,4" op een taak van 33% ⇒ een echte decimale wijziging
    `${idN};100`,  // "100" op een taak van 99,5% ⇒ ALTIJD een echte wijziging (de 100%-uitzondering)
    `${idO};0`,    // "0" op een taak van 0,4% ⇒ ALTIJD een echte wijziging (de 0%-uitzondering)
  ].join('\r\n');
  const manualSheet = parseProgressCsv(manualCsv);
  const manualRows = finalizeProgressRows(manualSheet, 'dmy');
  const manualPlan = buildProgressImportPlan(manualRows, S().tasks, realDeps);
  const rowFor = (taskId: string) => manualPlan.rows.find((row) => row.taskId === taskId);

  const rowL = rowFor(idL);
  ok('sanity: rij L ("33" op 33,4%) gevonden', rowL !== undefined);
  eq('"33" op 33,4% ⇒ noop (afronding eigen export, verdedigbaar)', rowL?.outcome, 'noop');

  const rowM = rowFor(idM);
  ok('sanity: rij M ("33,4" op 33%) gevonden', rowM !== undefined);
  eq('"33,4" op 33% ⇒ een echte decimale wijziging verdwijnt niet stil', rowM?.outcome, 'apply');
  ok('…rij M leverde een plannedTask op', rowM?.plannedTask !== undefined);
  eq('…en plant het exacte (ongeronde) percentage van de lezer',
    rowM?.plannedTask?.time.completion, 0.33399999999999996);

  const rowN = rowFor(idN);
  ok('sanity: rij N ("100" op 99,5%) gevonden', rowN !== undefined);
  eq('"100" op 99,5% ⇒ ALTIJD een echte wijziging (nooit stil noop)', rowN?.outcome, 'apply');
  ok('…rij N leverde een plannedTask op', rowN?.plannedTask !== undefined);
  eq('…en plant 100% completion', rowN?.plannedTask?.time.completion, 1);
  eq('…en de status is COMPLETED via de invarianten', rowN?.plannedTask?.status, 'COMPLETED');

  const rowO = rowFor(idO);
  ok('sanity: rij O ("0" op 0,4%) gevonden', rowO !== undefined);
  eq('"0" op 0,4% ⇒ ALTIJD een echte wijziging (nooit stil noop)', rowO?.outcome, 'apply');
  ok('…rij O leverde een plannedTask op', rowO?.plannedTask !== undefined);
  eq('…en plant 0% completion', rowO?.plannedTask?.time.completion, 0);
}

if (diffs.length > 0) {
  console.error(`FAIL progress-import: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-import: ${checks}/${checks}`);
}
