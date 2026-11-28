import { matchProgressRows } from '@/services/progressImport/matchRows';
import { buildProgressImportPlan, type ProgressPlanDeps } from '@/services/progressImport/buildPlan';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { useAppStore } from '@/state/appStore';
import { buildTaskEditPlanEnvironment } from '@/state/gridTransaction';
import { planTaskCellEdits } from '@/engine/taskGrid/taskEditPlan';
import { formatCompletionPercent } from '@/services/csv/csvWriter';
import { sheetFromText } from './progressSheetFixture';
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

{
  const A = makeTask('wbs-a');
  const B = makeTask('wbs-b');
  const D1 = makeTask('wbs-dup');
  const D2 = makeTask('wbs-dup');
  const E = makeTask('wbs-e');
  const tasksM = [A, B, D1, D2, E];
  const rowsM: ProgressRow[] = [
    makeRow(2, { taskId: A.id, wbsCode: B.wbsCode }),
    makeRow(3, { taskId: 'ghost-id', wbsCode: B.wbsCode }),
    makeRow(4, { wbsCode: 'wbs-dup' }),
    makeRow(5, { wbsCode: 'wbs-none' }),
    makeRow(6, { taskId: E.id }),
    makeRow(7, { taskId: E.id }),
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

  const C = makeTask('wbs-c');
  const oOverrides: ProgressOverrides = new Map([[2, C.id]]);
  const o = matchProgressRows([makeRow(2, {})], [C], oOverrides);
  eq('override koppelt een losse rij', o.matches[0].match, 'manual');
  eq('…aan de gekozen taak', o.matches[0].taskId, C.id);

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

  const L = makeTask('wbs-l');
  const o5Overrides: ProgressOverrides = new Map([[2, 'verdwenen-taak-id']]);
  const o5 = matchProgressRows([makeRow(2, { wbsCode: L.wbsCode })], [L], o5Overrides);
  eq('override naar een verdwenen taak wordt genegeerd', o5.matches[0].match, 'wbs');
  ok('…en gerapporteerd', o5.ignoredOverrideRows.includes(2));
}

{
  const t1 = makeTask('wbs-t1', { time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33 } });
  const t2 = makeTask('wbs-t2', { time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.5 } });
  const rowsSame: ProgressRow[] = [
    makeRow(2, { taskId: t1.id, completion: pct(0.33) }),
    makeRow(3, { taskId: t2.id, completion: pct(0.5) }),
  ];
  const plan = buildProgressImportPlan(rowsSame, [t1, t2], stubDeps);
  eq('ongewijzigd blad ⇒ nul wijzigingen', plan.appliedCount, 0);
  eq('…en alles telt als noop', plan.noopCount, rowsSame.length);

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

  const tDt = makeTask('wbs-dt', {
    time: { ...createDefaultTaskTime('2026-01-05', 5), actualStart: '2026-06-09T08:30' },
  });
  const planDt = buildProgressImportPlan(
    [makeRow(2, { taskId: tDt.id, actualStart: dateVal('2026-06-09') })], [tDt], stubDeps,
  );
  eq('datum-only degradeert een datetime niet', planDt.rows[0].outcome, 'noop');

  const tSum = makeTask('wbs-sum', { childIds: ['child-1'] });
  const planSum = buildProgressImportPlan(
    [makeRow(2, { taskId: tSum.id, completion: pct(0.5) })], [tSum], stubDeps,
  );
  eq('verzameltaak wordt geweigerd', planSum.rows[0].reason, 'summaryTask');

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

  const tMixA = makeTask('wbs-mix-a');
  const tMixB = makeTask('wbs-mix-b');
  const planMixed = buildProgressImportPlan(
    [
      makeRow(2, { taskId: tMixA.id, completion: pct(0.5) }),
      makeRow(3, { taskId: tMixB.id, completion: pct(0.6) }),
      makeRow(4, { completion: pct(0.7) }),
    ],
    [tMixA, tMixB],
    stubDeps,
  );
  ok('één geweigerde rij stopt het blad niet', planMixed.appliedCount === 2 && planMixed.refusedCount === 1);

  const tEmpty = makeTask('wbs-empty');
  const planEmpty = buildProgressImportPlan(
    [makeRow(2, { taskId: tEmpty.id })], [tEmpty], stubDeps,
  );
  eq('rij zonder voortgangskolommen ⇒ noop', planEmpty.rows[0].outcome, 'noop');
  eq('…zonder reden', planEmpty.rows[0].reason, undefined);
  eq('…en telt als ongewijzigd', planEmpty.noopCount, 1);
  eq('…en niet als geweigerd', planEmpty.refusedCount, 0);

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

  const dupA = makeTask('wbs-loose-dup');
  const dupB = makeTask('wbs-loose-dup');
  const planLoose = buildProgressImportPlan(
    [
      makeRow(2, { completion: pct(0.1) }),
      makeRow(3, { wbsCode: 'wbs-loose-dup', completion: pct(0.2) }),
    ],
    [dupA, dupB],
    stubDeps,
  );
  eq('losse rijen worden geteld', planLoose.needsLinkCount, 2);

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

{
  const S = () => useAppStore.getState();
  S().newProject();
  S().setStatusDate('2026-01-10');
  const idA = S().addTask({ name: 'A ná statusdatum', time: createDefaultTaskTime('2026-01-05', 5) });
  const idB = S().addTask({ name: 'B naar 100%', time: createDefaultTaskTime('2026-01-05', 5) });
  const idC = S().addTask({ name: 'C finish vóór start', time: createDefaultTaskTime('2026-01-05', 5) });
  const idD = S().addTask({ name: 'D 45% zonder actuals', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();

  const realDeps: ProgressPlanDeps = {
    planEdits: (task, edits) => planTaskCellEdits(task, edits, buildTaskEditPlanEnvironment(S(), task)),
  };
  const rows: ProgressRow[] = [
    makeRow(2, { taskId: idA, actualStart: dateVal('2026-01-15') }),
    makeRow(3, { taskId: idB, completion: pct(1) }),
    makeRow(4, { taskId: idC, actualStart: dateVal('2026-01-10'), actualFinish: dateVal('2026-01-08') }),
    makeRow(5, { taskId: idD, completion: pct(0.45) }),
  ];
  const plan = buildProgressImportPlan(rows, S().tasks, realDeps);

  eq('actual ná de statusdatum wordt geweigerd', plan.rows[0].reason, 'actualAfterStatusDate');
  eq('afgeleide actualStart staat NIET in de changes',
    plan.rows[1].changes.some(c => c.field === 'actualStart'), false);
  eq('…de aangeleverde completion wél', plan.rows[1].changes.map(c => c.field), ['completion']);
  ok('…en de afgeleide actualStart staat wél in de geplande taak',
    plan.rows[1].plannedTask?.time.actualStart !== undefined);
  ok('…rij 1 leverde een plannedTask op', plan.rows[1].plannedTask !== undefined);
  eq('…en de geplande status is COMPLETED', plan.rows[1].plannedTask?.status, 'COMPLETED');
  eq('finish vóór start wordt geweigerd', plan.rows[2].reason, 'actualFinishBeforeStart');

  eq('45% ⇒ changes bevat alleen completion', plan.rows[3].changes.map(c => c.field), ['completion']);
  eq('…en de rij wordt gewoon toegepast', plan.rows[3].outcome, 'apply');
  ok('…terwijl de afgeleide actualStart wel degelijk geschreven wordt',
    plan.rows[3].plannedTask?.time.actualStart !== undefined);
}

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
    makeRow(4, { completion: pct(0.9) }),
  ];

  const preview = S().previewProgressImport(rows);
  eq('preview telt de wijzigingen', preview.appliedCount, 2);
  const afterPreviewA = S().tasks.find((t) => t.id === idA)!;
  eq('preview muteert niets', afterPreviewA.time.completion, beforeA.completion);

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

  useAppStore.setState((s) => { s.scheduleStale = false; });
  const historyLenBefore2 = S().historyEvents.length;
  S().applyProgressImport([makeRow(2, { taskId: idA, completion: pct(beforeA.completion) })]);
  eq('een blad zonder wijzigingen pusht geen undo-stap', S().historyEvents.length, historyLenBefore2);
  ok('…en laat scheduleStale ongemoeid', S().scheduleStale === false);

  const idG = S().addTask({ name: 'G', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  S().applyProgressImport([makeRow(5, { taskId: idG, actualStart: badDate('rommel') })]);
  const untouched = S().tasks.find((x) => x.id === idG)!;
  ok('geweigerde rij raakt zijn taak niet aan', untouched.time.actualStart === undefined);

  const idD = S().addTask({ name: 'D', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  const rowD = makeRow(6, { taskId: idD, completion: pct(0.3) });
  const previewD = S().previewProgressImport([rowD]);
  eq('sanity: preview D zou toepassen', previewD.appliedCount, 1);
  useAppStore.setState((s) => {
    const index = s.tasks.findIndex((x) => x.id === idD);
    s.tasks[index]!.childIds = ['fake-child-id'];
  });
  const applied = S().applyProgressImport([rowD]);
  eq('apply herberekent tegen de live taken', applied.refusedCount, 1);

  const idE = S().addTask({ name: 'E', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  const rowE = makeRow(7, { completion: pct(0.6) });
  const overridesE: ProgressOverrides = new Map([[7, idE]]);
  const previewLinked = S().previewProgressImport([rowE], overridesE);
  eq('preview met override koppelt de rij', previewLinked.appliedCount, 1);
  S().applyProgressImport([rowE], overridesE);
  const linkedTask = S().tasks.find((x) => x.id === idE)!;
  eq('apply MET overrides schrijft die rij', linkedTask.time.completion, 0.6);

  const idF = S().addTask({ name: 'F', time: createDefaultTaskTime('2026-01-05', 5) });
  S().runCPM();
  const rowF = makeRow(8, { completion: pct(0.6) });
  S().applyProgressImport([rowF]);
  const unlinkedTask = S().tasks.find((x) => x.id === idF)!;
  eq('apply ZONDER overrides schrijft hem niet', unlinkedTask.time.completion, 0);
}

{
  const S = () => useAppStore.getState();
  const realDeps: ProgressPlanDeps = {
    planEdits: (task, edits) => planTaskCellEdits(task, edits, buildTaskEditPlanEnvironment(S(), task)),
  };

  S().newProject();
  const idH = S().addTask({ name: 'H', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.335 } });
  const idI = S().addTask({ name: 'I', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.125 } });
  const idJ = S().addTask({ name: 'J', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33 } });
  const idP = S().addTask({ name: 'P', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.995 } });
  const idQ = S().addTask({ name: 'Q', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33333 } });
  S().runCPM();

  const before = S();
  const roundTripText = [
    'OPS Task ID;Completion (%)',
    ...before.tasks.map(task => `${task.id};${formatCompletionPercent(task.time.completion)}`),
  ].join('\r\n');
  const roundTripSheet = sheetFromText(roundTripText);
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

  const idL = S().addTask({ name: 'L', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.334 } });
  const idM = S().addTask({ name: 'M', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.33 } });
  const idN = S().addTask({ name: 'N', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.995 } });
  const idO = S().addTask({ name: 'O', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.004 } });
  const idR = S().addTask({ name: 'R', time: { ...createDefaultTaskTime('2026-01-05', 5), completion: 0.5 } });
  S().runCPM();

  const manualCsv = [
    'OPS Task ID;Completion (%)',
    `${idL};33`,
    `${idM};33,4`,
    `${idN};100`,
    `${idO};0`,
    `${idR};100`,
  ].join('\r\n');
  const manualSheet = sheetFromText(manualCsv);
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
  eq('"100" op 99,5% ⇒ noop (bewust, ronde 3)', rowN?.outcome, 'noop');

  const rowO = rowFor(idO);
  ok('sanity: rij O ("0" op 0,4%) gevonden', rowO !== undefined);
  eq('"0" op 0,4% ⇒ noop (bewust, symmetrisch)', rowO?.outcome, 'noop');

  const rowR = rowFor(idR);
  ok('sanity: rij R ("100" op 50%) gevonden', rowR !== undefined);
  eq('"100" op 50% ⇒ een echte wijziging', rowR?.outcome, 'apply');
  ok('…rij R leverde een plannedTask op', rowR?.plannedTask !== undefined);
  eq('…en plant 100% completion', rowR?.plannedTask?.time.completion, 1);
  eq('…en de status is COMPLETED via de invarianten', rowR?.plannedTask?.status, 'COMPLETED');
}

{
  const S = () => useAppStore.getState();
  const TODAY = '2026-01-07';
  S().newProject();
  S().setProject({ startDate: '2026-01-05' });
  const idA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-01-05', 5) });
  const idL = S().addTask({ name: 'L', time: createDefaultTaskTime('2026-02-02', 5) });
  S().runCPM();
  useAppStore.setState((s) => { s.historyEvents = []; s.nextHistorySequence = 1; s.isDirty = false; s.ui.notifications = []; });

  const rowsA = [makeRow(2, { taskId: idA, completion: pct(0.4) })];
  const previewA = S().previewProgressImport(rowsA, undefined, { today: TODAY });
  eq('6a preview zonder statusdatum telt de rij', previewA.appliedCount, 1);
  eq('6a …en laat de statusdatum leeg', S().project.statusDate, undefined);

  const historyBefore = S().historyEvents.length;
  S().applyProgressImport(rowsA, undefined, { today: TODAY });
  eq('6b apply zonder statusdatum zet hem op vandaag', S().project.statusDate, TODAY);
  eq('6b …en schrijft de voortgang', S().tasks.find((t) => t.id === idA)!.time.completion, 0.4);
  eq('6b …in één undo-stap', S().historyEvents.length, historyBefore + 1);
  eq('6b …met één melding statusDateSetToday',
    S().ui.notifications.filter((n) => n.messageKey === 'notifications.statusDateSetToday').length, 1);
  S().undo();
  eq('6c één Ctrl+Z draait voortgang én statusdatum terug',
    [S().project.statusDate, S().tasks.find((t) => t.id === idA)!.time.completion], [undefined, 0]);

  const future = S().previewProgressImport([makeRow(3, { taskId: idA, actualStart: dateVal('2026-01-08') })], undefined, { today: TODAY });
  eq('6d werkelijke start ná vandaag zonder statusdatum ⇒ geweigerd', future.rows[0]?.reason, 'actualAfterStatusDate');

  S().setStatusDate(TODAY);
  S().runCPM();
  const rowL = makeRow(4, { taskId: idL, completion: pct(0.3) });
  const refusedL = S().applyProgressImport([rowL], undefined, { today: TODAY });
  eq('6e later geplande taak zonder werkelijke start ⇒ rij geweigerd (actualStartRequired)',
    [refusedL.rows[0]?.outcome, refusedL.rows[0]?.reason], ['refused', 'actualStartRequired']);
  eq('6e …taak onaangeroerd', S().tasks.find((t) => t.id === idL)!.time.completion, 0);
  const rowLStart = makeRow(5, { taskId: idL, completion: pct(0.3), actualStart: dateVal('2026-01-06') });
  S().applyProgressImport([rowLStart], undefined, { today: TODAY });
  const l = S().tasks.find((t) => t.id === idL)!;
  eq('6f mét werkelijke start in het blad ⇒ toegepast zoals opgegeven',
    [l.time.completion, l.time.actualStart], [0.3, '2026-01-06T07:00']);

  const idH = S().addTask({ name: 'H', time: createDefaultTaskTime('2026-02-02', 5) });
  S().runCPM();
  const headless = S().applyProgressImport([makeRow(6, { taskId: idH, completion: pct(0.3) })]);
  eq('6g zonder today (headless) ⇒ toegepast zoals voorheen', headless.rows[0]?.outcome, 'apply');
}

if (diffs.length > 0) {
  console.error(`FAIL progress-import: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-import: ${checks}/${checks}`);
}
