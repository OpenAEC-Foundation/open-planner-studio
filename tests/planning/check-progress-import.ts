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
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ProgressOverrides, ProgressRow } from '@/services/progressImport/types';
import type { Task } from '@/types/task';

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

if (diffs.length > 0) {
  console.error(`FAIL progress-import: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-import: ${checks}/${checks}`);
}
