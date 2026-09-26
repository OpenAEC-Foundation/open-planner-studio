// Kring via een fase (audit taakmutaties, rapport S4/S5) — de AI krijgt dezelfde voorafweigering als
// de UI in plaats van pas de rollback van de eindberekening.
//
// Een relatie op een fase geldt voor elke taak in die fase (`expandSummaryRelations`). Een kring kan
// dus pas in die uitgevouwen graaf zichtbaar zijn: een taak onder een fase hangen waarvan de relaties
// via die taak rondlopen (S4, `planner_move_task`), of een relatie naar een fase (S5,
// `planner_add_dependencies`/`planner_update_dependencies`). `planner_move_task` keek daar helemaal
// niet naar en de MCP-voorafcontrole (`validate.noCycle`) alleen naar de kale relaties; pas de
// afsluitende herberekening ving het, met de Engelse solvertekst "Circular dependency detected" en —
// in `planner_batch` — elke stap als "uitgevoerd", zodat de AI niet zag wélke stap de kring maakte.
//
// Gemeten vóór de wijziging (en onveranderd erna): een kring rolt de HELE aanroep terug — ook de
// geldige items in dezelfde `add_dependencies`, en in een batch alle stappen. Dat is het bestaande,
// gedocumenteerde contract ("een kringverwijzing is een harde fout die de hele call terugrolt"); deze
// cases pinnen alleen dat de fout nu VOORAF komt, met de gewone kringtekst, bij de juiste stap.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool, registerAllTools } from '@/services/mcp/toolRegistry';
import { validate } from '@/state/mcpValidation';
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

// ── S5: een relatie die via een fase rondloopt (add/update_dependencies) ─────────────────────
/** S5: fase P met P1, en P1→Q. Q→P zou via P1 rondlopen. Plus losse X en Y. */
function s5() {
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  const p = S().addTask({ name: 'P' });
  const p1 = S().addTask({ name: 'P1', parentId: p });
  const q = S().addTask({ name: 'Q' });
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  S().addSequence({ predecessorId: p1, successorId: q, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  return { p, p1, q, x, y };
}

test('validate.noCycle: een relatie naar een fase die via haar kind rondloopt, is een kring', () => {
  const { p, p1, q } = s5();
  const cycle = validate.noCycle(S(), [{ predecessorId: q, successorId: p }]);
  assertEq(cycle, [q, p1, q], 'de kring loopt via de bladtaak P1 en begint bij de nieuwe relatie');
});

test('add_dependencies: kring via een fase ⇒ vooraf CYCLE, hele aanroep terug (ook het geldige item)', async () => {
  const { p, q, x, y } = s5();
  const before = snapshot();
  const res = await call('planner_add_dependencies', { dependencies: [
    { predecessorId: x, successorId: y, type: 'FS' },
    { predecessorId: q, successorId: p, type: 'FS' },
  ] });
  const error = assertPrecheckedCycle(res, 'add_dependencies Q→P');
  assert(error.includes(q), 'de kring noemt de taken (ids), zoals bij een kring tussen bladtaken');
  assertEq(snapshot(), before, 'niets toegepast: ook X→Y niet (bestaand contract: kring = hele call terug)');
});

test('update_dependencies: een relatie omleggen tot een kring via een fase ⇒ vooraf CYCLE', async () => {
  const { p, q, x, y } = s5();
  S().addSequence({ predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 });
  const seqId = S().sequences.find(sequence => sequence.predecessorId === x)!.id;
  const before = snapshot();
  const res = await call('planner_update_dependencies', { updates: [{ seqId, predecessorId: q, successorId: p }] });
  assertPrecheckedCycle(res, 'update_dependencies X→Y ⇒ Q→P');
  assertEq(snapshot(), before, 'de relatie is niet omgelegd');
});

test('batch: de add_dependencies-stap die de kring maakt, faalt zelf', async () => {
  const { p, q } = s5();
  const res = await call('planner_batch', { steps: [
    { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-n', name: 'Nieuw' }] } },
    { tool: 'planner_add_dependencies', args: { dependencies: [{ predecessorId: q, successorId: p, type: 'FS' }] } },
  ] });
  assertPrecheckedCycle(res, 'batch met add_dependencies');
  assertEq(batchStatuses(res), ['uitgevoerd', 'gefaald'], 'stap 2 (add_dependencies) is de gefaalde stap');
  assertEq(S().tasks.some(task => task.name === 'Nieuw'), false, 'de taak uit stap 1 is teruggedraaid');
});

test('add_dependencies: een bestaande kring elders wordt de nieuwe relatie niet aangerekend', async () => {
  const { x, y } = s5();
  // Zoals een importer rechtstreeks naar `sequences` schrijft.
  store.setState(state => {
    state.sequences.push(
      { id: 'imp-xy', predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 },
      { id: 'imp-yx', predecessorId: y, successorId: x, type: 'FINISH_START', lagDays: 0 },
    );
  });
  const q = S().tasks.find(task => task.name === 'Q')!.id;
  const p1 = S().tasks.find(task => task.name === 'P1')!.id;
  assertEq(validate.noCycle(S(), [{ predecessorId: q, successorId: y }]), null,
    'Q→Y voegt niets toe aan de kring X↔Y: geen kring op naam van deze relatie');
  assert(Array.isArray(validate.noCycle(S(), [{ predecessorId: q, successorId: p1 }])),
    'een NIEUWE kring (Q→P1 naast P1→Q) wordt wel gevonden');
});

await run();
