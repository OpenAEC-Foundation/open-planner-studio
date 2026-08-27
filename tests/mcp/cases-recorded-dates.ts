// Issue #63 — "datums zoals opgeslagen" × de MCP-transactie.
//
// De modus verlaten kost per ontwerp ÉÉN undo-stap (`runCPM` pusht dan een snapshot, scheduleSlice).
// Binnen een MCP-transactie mag dat NIET bovenop de transactie-snapshot komen: de belofte daar is
// "één bulk = één undo-stap", en de rollback popt precies één entry. Deze batterij bewijst dat de
// modus die twee eigenschappen niet ondermijnt — het gat waar de review van taak 6 op wees:
//   K1: de eindherberekening (stap 5) draaide ná het `finally` dat de suppressie uitzette, dus
//       `beginUndoable` was daar niet meer onderdrukt ⇒ undo-stack 1 → 3.
//   K2: de rollback popt één entry terwijl er in de modus twee gepusht waren ⇒ fantoom-undo-stap
//       na een GEWEIGERDE AI-actie.
import { useAppStore, test, assert, assertEq, run } from './harness';
import { runInMcpTransaction, draft } from '@/state/mcpTransaction';
import { readIFC } from '@/services/ifc/ifcReader';
import { externIfc } from '../fixtures/recordedDatesIfc';
import { createAppStoreContext } from '@/state/appStore';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';

const store = useAppStore;
const S = () => store.getState();

// Warm-up (zoals cases-bulk.ts): projectkalender tot bibliotheek-entry promoten via één undo, zodat
// het rollback-/restore-pad een steady state heeft.
S().addTask({ name: 'warmup' });
S().undo();

/** Zet de store in "datums zoals opgeslagen" met de gedeelde issue-#63-fixture. */
function enterMode(tag: string): { aId: string; bId: string } {
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc(tag)), { filePath: null, recompute: true });
  S().showRecordedDates();
  return {
    aId: S().tasks.find((t) => t.wbsCode === '1.1')!.id,
    bId: S().tasks.find((t) => t.wbsCode === '1.2')!.id,
  };
}

// --- 1) K1: een geslaagde transactie in de modus blijft ÉÉN undo-stap ------------------------------
test('MCP-transactie in de modus: één undo-stap, niet twee (K1)', () => {
  const { bId } = enterMode('m1');
  assertEq(S().datesAsRecorded, true, 'voorwaarde: de modus hoort aan te staan');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-16',
    'voorwaarde: b hoort de OPGESLAGEN datum te tonen');
  const before = S().undoStack.length;

  const res = runInMcpTransaction(() => { draft.addTask({ name: 'via AI' }); });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(S().undoStack.length, before + 1, 'één transactie-snapshot (bulk = één undo-stap), óók in de modus');
  assertEq(S().datesAsRecorded, false, 'de eindherberekening hoort de modus te verlaten');
  assertEq(S().recordedDates, null, 'de vastlegging hoort gewist te zijn');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-09',
    'b hoort op zijn herberekende datum te staan');
});

// --- 2) Claim (a): die ene undo-stap herstelt modus én datums in één keer --------------------------
test('MCP-transactie in de modus: één undo herstelt modus, datums én de nieuwe taak (claim a)', () => {
  const { bId } = enterMode('m2');
  const before = S().undoStack.length;

  const res = runInMcpTransaction(() => { draft.addTask({ name: 'via AI 2' }); });
  assert(res.ok, 'transactie hoort te slagen');
  assert(S().tasks.some((t) => t.name === 'via AI 2'), 'voorwaarde: de taak hoort te bestaan');

  S().undo();

  assertEq(S().undoStack.length, before, 'de undo-stack hoort terug op zijn oude diepte te staan');
  assertEq(S().datesAsRecorded, true, 'undo hoort de modus te herstellen');
  assert(S().recordedDates !== null, 'undo hoort de vastlegging te herstellen');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-16',
    'undo hoort de opgeslagen datum te herstellen');
  assert(!S().tasks.some((t) => t.name === 'via AI 2'),
    'diezelfde ene undo hoort de AI-taak te verwijderen — geen half-uitgevoerde transactie');
});

// --- 3) K2: een geweigerde transactie in de modus laat GEEN fantoom-undo-stap achter ---------------
test('MCP-transactie met kringverwijzing in de modus: rollback laat de stacks onaangeroerd (K2)', () => {
  const { aId, bId } = enterMode('m3');
  const before = S().undoStack.length;
  const beforeStart = S().tasks.find((t) => t.id === bId)!.time.earlyStart;

  // a → b bestaat al in de fixture; b → a maakt er een kring van. Die fout komt pas uit de
  // eindherberekening (stap 5), dus dit raakt precies het pad waar de tweede snapshot ontstond.
  const res = runInMcpTransaction(() => {
    draft.addSequence({ predecessorId: bId, successorId: aId, type: 'FINISH_START', lagDays: 0 });
  });

  assert(!res.ok, 'een kringverwijzing hoort de transactie te laten falen');
  assertEq(S().undoStack.length, before, 'undoStack onaangeroerd na rollback — geen fantoom-undo-stap');
  assertEq(S().datesAsRecorded, true, 'de rollback hoort de modus terug te zetten');
  assert(S().recordedDates !== null, 'de rollback hoort de vastlegging terug te zetten');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, beforeStart,
    'de rollback hoort de opgeslagen datum terug te zetten');
});

// --- 4) Buiten de modus verandert er niets aan het bestaande transactiegedrag ----------------------
test('MCP-transactie buiten de modus: onveranderd één undo-stap', () => {
  S().newProject();
  assertEq(S().datesAsRecorded, false, 'voorwaarde: de modus hoort uit te staan');
  const before = S().undoStack.length;

  const res = runInMcpTransaction(() => { draft.addTask({ name: 'gewoon' }); });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(S().undoStack.length, before + 1, 'onveranderd: één undo-stap');
});

test('contextfactory B verlaat recorded-dates met één B-undo en laat A buiten beeld', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  B.store.getState().applyLoadedProject(readIFC(externIfc('factory-B')), { filePath: null, recompute: true });
  B.store.getState().showRecordedDates();
  const bId = B.store.getState().tasks.find((task) => task.wbsCode === '1.2')!.id;
  const aTakenVoor = A.store.getState().tasks.length;
  const aUndoVoor = A.store.getState().undoStack.length;
  const bUndoVoor = B.store.getState().undoStack.length;
  const txB = createMcpTransactions(B);

  const result = txB.run(() => txB.draft.addTask({ name: 'factory-B-in-recorded-mode' }));

  assert(result.ok, 'de contextgebonden transactie hoort in recorded-dates-modus te slagen');
  assertEq(B.store.getState().undoStack.length, bUndoVoor + 1,
    'modus verlaten plus B-mutatie hoort samen precies één B-undo te zijn');
  assertEq(B.store.getState().datesAsRecorded, false, 'alleen B hoort zijn recorded-dates-modus te verlaten');
  assertEq(B.store.getState().tasks.find((task) => task.id === bId)!.time.earlyStart, '2026-03-09',
    'B hoort op zijn herberekende datum te staan');
  assertEq(A.store.getState().tasks.length, aTakenVoor, 'A-taken horen onaangeroerd te blijven');
  assertEq(A.store.getState().undoStack.length, aUndoVoor, 'A-undo hoort onaangeroerd te blijven');
});

await run();
