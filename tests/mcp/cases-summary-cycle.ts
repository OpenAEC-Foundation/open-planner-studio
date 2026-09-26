// Kring via een fase (audit taakmutaties, rapport S4) — de AI krijgt bij `planner_move_task` dezelfde
// voorafweigering als de UI in plaats van pas de rollback van de eindberekening.
//
// Een relatie op een fase geldt voor elke taak in die fase (`expandSummaryRelations`). Hang je een
// taak onder een fase waarvan de relaties via die taak rondlopen, dan ontstaat een kring die pas in
// die uitgevouwen graaf zichtbaar is. `planner_move_task` keek daar niet naar; pas de afsluitende
// herberekening ving het, met de Engelse solvertekst "Circular dependency detected" en — in
// `planner_batch` — elke stap als "uitgevoerd", zodat de AI niet zag wélke stap de kring maakte.
//
// Gemeten vóór de wijziging (en onveranderd erna): een kring rolt de HELE aanroep terug — in een
// batch alle stappen. Dat is het bestaande contract; deze cases pinnen alleen dat de fout nu VOORAF
// komt, met de gewone kringtekst, bij de juiste stap.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool, registerAllTools } from '@/services/mcp/toolRegistry';
import { createSnapshot } from '@/state/snapshot';
import type { McpToolResult } from '@/services/mcp/contracts';

const store = useAppStore;
registerAllTools();

// Warm-up (zelfde reden als cases-guards.ts): het rollbackpad promoot de projectkalender één keer
// tot bibliotheek-entry; daarna is een byte-identiek-vergelijking na een rollback zuiver.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

const S = () => store.getState();
const ctx = () => makeMcpContext(appStoreContext, {
  expectedDocId: S().activeDocumentId,
  ensureBackup: async () => null,
});
async function call(name: string, args: unknown): Promise<McpToolResult> {
  const def = getTool(name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return await def.handler(args, ctx());
}
const snapshot = () => JSON.stringify(createSnapshot(S()));
/** Fout met code CYCLE uit de VOORAFcontrole (gewone kringtekst), niet uit de solverrollback. */
function assertPrecheckedCycle(res: McpToolResult, label: string): string {
  assert(!res.ok, `${label}: hoort geweigerd te worden`);
  if (res.ok) return '';
  assertEq(res.code, 'CYCLE', `${label}: code CYCLE`);
  assert(res.error.includes('kringverwijzing gedetecteerd'), `${label}: gewone kringtekst verwacht, kreeg: ${res.error}`);
  assert(!/Circular dependency/i.test(res.error), `${label}: geen Engelse solvertekst uit de rollback, kreeg: ${res.error}`);
  return res.error;
}
/** De stapstatussen van een gefaalde batch. */
function batchStatuses(res: McpToolResult): string[] {
  const steps = res.ok ? undefined : (res.data as { steps?: { status: string }[] } | undefined)?.steps;
  return (steps ?? []).map(step => step.status);
}

/** S4: A→C en C→B. B onder A hangen maakt van A→C ook B→C. Plus losse X en Y. */
function s4() {
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const c = S().addTask({ name: 'C' });
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  S().addSequence({ predecessorId: a, successorId: c, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: c, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  store.setState(state => { state.ui.notifications = []; });
  return { a, b, c, x, y };
}

// ── S4: verhangen (planner_move_task) ────────────────────────────────────────────────────────
test('move_task: verhangen dat via de nieuwe fase een kring maakt ⇒ vooraf CYCLE', async () => {
  const { a, b, c } = s4();
  const before = snapshot();
  const res = await call('planner_move_task', { id: b, newParentId: a });
  const error = assertPrecheckedCycle(res, 'move_task B onder A');
  assert(error.includes(b) && error.includes(c), `de kring noemt B en C, kreeg: ${error}`);
  assertEq(snapshot(), before, 'B is niet verplaatst');
  assertEq(S().ui.notifications.filter(n => n.messageKey === 'notifications.hierarchyCycle').length, 0,
    'de AI krijgt de fout; de gebruiker krijgt geen UI-melding over een verplaatsing die hij niet deed');
  S().runCPM();
  assertEq(S().cpmResult?.error, undefined, 'de planning blijft rekenen');
});

test('move_task zonder kring blijft gewoon werken (tegenproef)', async () => {
  const { a, b, c } = s4();
  S().removeSequence(S().sequences.find(sequence => sequence.predecessorId === c)!.id);
  const res = await call('planner_move_task', { id: b, newParentId: a });
  assert(res.ok, `verplaatsen zonder kring hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  assertEq(S().tasks.find(task => task.id === b)!.parentId, a, 'B hangt onder A');
});

test('batch: de move_task-stap die de kring maakt, faalt zelf — niet pas de eindberekening', async () => {
  const { a, b, x, y } = s4();
  const before = snapshot();
  const res = await call('planner_batch', { steps: [
    { tool: 'planner_add_dependencies', args: { dependencies: [{ predecessorId: x, successorId: y, type: 'FS' }] } },
    { tool: 'planner_move_task', args: { id: b, newParentId: a } },
  ] });
  const error = assertPrecheckedCycle(res, 'batch met move_task');
  // Vóór de wijziging: beide stappen "uitgevoerd", daarna liep de eindberekening vast.
  assertEq(batchStatuses(res), ['uitgevoerd', 'gefaald'], 'stap 2 (move_task) is de gefaalde stap');
  assert(error.includes('1. planner_add_dependencies — uitgevoerd (teruggedraaid)'), `stap 1 is teruggedraaid, kreeg: ${error}`);
  assertEq(snapshot(), before, 'de hele batch is teruggedraaid (bestaand contract)');
});

await run();
