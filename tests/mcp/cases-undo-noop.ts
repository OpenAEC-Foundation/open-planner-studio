// G5 — een MCP-transactie zonder datawijziging telt GEEN undo-stap (bijvondst G1, 2026-09-25).
//
// Waargenomen, en hier via de ECHTE dispatcher (`handleMcpMessage`) gereproduceerd: elke geslaagde
// MCP-mutatie legde een "MCP-bewerking"-undo-stap vast, ook als hij per saldo niets veranderde
// (dezelfde naam nog eens, een deels geweigerde call waarvan de rest een no-op is, een lege batch-
// stap). Oorzaak: de transactie draaide altijd haar eind-`runCPM`, `cpmResult` kreeg een nieuwe
// referentie, en de history-vergelijking (`snapshotsEqual`) gaat op referentie. Gevolgen voor de
// gebruiker: een loze undo-stap, zijn REDO-stapel gewist, een verouderde planning stil herrekend,
// "datums zoals opgeslagen" stil verlaten, en het document op "gewijzigd".
//
// De regel is die van de UI-routes (no-op-guards met `sameValue`): per saldo niets gewijzigd ⇒ er is
// niets gebeurd. De MCP-transactie meet dat op haar ene commit-plek met `documentDataChanged`
// (dezelfde meting die al `isDirty` bepaalde), vóór de eindherberekening. Geen datawijziging ⇒ geen
// undo-stap, geen herberekening, en `cpmResult`/`scheduleStale`/`isDirty` blijven zoals ze waren.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { mcpTransactions } from '@/state/mcpTransaction';
import { readIFC } from '@/services/ifc/ifcReader';
import { externIfc } from '../fixtures/recordedDatesIfc';

const store = useAppStore;
const S = () => store.getState();
registerAllTools();

// Warm-up (zoals cases-recorded-dates.ts): projectkalender tot bibliotheek-entry promoten via één
// undo, zodat restore-paden een steady state hebben.
S().addTask({ name: 'warmup' });
S().undo();

/** Roep een tool aan via de ECHTE JSON-RPC-weg en geef het tool-resultaat (structuredContent). */
async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 200)}`);
  return msg.result.structuredContent;
}

function ok(res: any): any {
  assert(res.ok === true, `verwachtte ok, kreeg fout: ${res.error}`);
  return res;
}

const applied = () => S().historyEvents.filter((e) => e.state === 'applied').length;
const undone = () => S().historyEvents.filter((e) => e.state === 'undone').length;
const task = (id: string) => S().tasks.find((t) => t.id === id)!;

/**
 * Doorgerekend project met twee gekoppelde taken (A op 50%), een REDO-stapel die een no-op niet mag
 * wissen, en daarna "opgeslagen" (isDirty=false).
 */
function savedProject(): { a: string; b: string } {
  S().newProject();
  S().setProject({ startDate: '2026-03-02', statusDate: '2026-03-04' });
  const a = S().addTask({ name: 'Grondwerk' });
  const b = S().addTask({ name: 'Fundering' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().setTaskProgress(a, 0.5);
  S().runCPM();
  S().addTask({ name: 'weer weg' });
  S().undo(); // ⇒ één redo-stap
  store.setState((s) => { s.isDirty = false; });
  assertEq(S().scheduleStale, false, 'opzet: planning is vers');
  assert(undone() > 0, 'opzet: er ligt een redo-stapel');
  return { a, b };
}

/**
 * Maak de planning ECHT verouderd, zoals een UI-bewerking met automatisch berekenen uit: A wordt
 * langer, maar de berekende datums (en dus B's start) staan nog op de oude stand. Een herberekening
 * zou ze verzetten — wie dan "niets herrekend" pint, pint ook dat de datums blijven staan.
 */
function makeStale(a: string, b: string): string | undefined {
  S().updateTask(a, { time: { ...task(a).time, scheduleDuration: 8 } });
  assertEq(S().scheduleStale, true, 'opzet: planning is verouderd');
  store.setState((s) => { s.isDirty = false; });
  return task(b).time.earlyStart;
}

/** Pin "er is niets gebeurd": geen undo-stap, redo intact, rekenstand en dirty ongewijzigd. */
function expectNothingHappened(label: string, before: { applied: number; undone: number; cpm: unknown; stale: boolean; dirty: boolean; tasks: unknown }): void {
  assertEq(applied(), before.applied, `${label}: geen undo-stap`);
  assertEq(undone(), before.undone, `${label}: de redo-stapel van de gebruiker blijft staan`);
  assert(S().cpmResult === before.cpm, `${label}: cpmResult blijft hetzelfde object (geen herberekening)`);
  assertEq(S().scheduleStale, before.stale, `${label}: scheduleStale ongewijzigd`);
  assertEq(S().isDirty, before.dirty, `${label}: document niet gewijzigd`);
  assert(S().tasks === before.tasks, `${label}: de taken zijn exact de oude`);
}

function snap() {
  return { applied: applied(), undone: undone(), cpm: S().cpmResult, stale: S().scheduleStale, dirty: S().isDirty, tasks: S().tasks };
}

// --- 1) Het gemelde geval ------------------------------------------------------------------------
test('update_tasks met dezelfde naam: geen undo-stap, redo blijft, niets herrekend, niet dirty', async () => {
  const { a } = savedProject();
  const before = snap();
  const res = ok(await rpc('planner_update_tasks', { updates: [{ id: a, fields: { name: 'Grondwerk' } }] }));
  assertEq(res.data.updated, [a], 'het item telt als verwerkt (het staat al zoals gevraagd)');
  expectNothingHappened('zelfde naam', before);
});

test('controle: een echte naamswijziging is precies één undo-stap', async () => {
  const { a } = savedProject();
  const before = applied();
  ok(await rpc('planner_update_tasks', { updates: [{ id: a, fields: { name: 'Grondwerk fase 1' } }] }));
  assertEq(applied(), before + 1, 'één undo-stap');
  assertEq(undone(), 0, 'een echte wijziging maakt de redo-stapel ongeldig');
  assertEq(S().isDirty, true, 'document gewijzigd');
  S().undo();
  assertEq(task(a).name, 'Grondwerk', 'undo zet de naam terug');
});

// --- 2) Per saldo: een nieuw object met dezelfde inhoud is geen wijziging ------------------------
test('update_tasks met de huidige duur of dezelfde constraint: geen undo-stap', async () => {
  const { a } = savedProject();
  ok(await rpc('planner_update_tasks', { updates: [{ id: a, fields: { constraint: { type: 'SNET', date: '2026-03-02' } } }] }));
  S().runCPM();
  store.setState((s) => { s.isDirty = false; });
  const cases: Record<string, unknown>[] = [
    { duration: task(a).time.scheduleDuration },
    { constraint: { date: '2026-03-02', type: 'SNET' } },
  ];
  for (const fields of cases) {
    const before = { ...snap(), tasks: S().tasks };
    ok(await rpc('planner_update_tasks', { updates: [{ id: a, fields }] }));
    expectNothingHappened(JSON.stringify(fields), before);
  }
});

test('update_project met de huidige naam: geen undo-stap (modifiedAt telt niet, zoals in de UI)', async () => {
  savedProject();
  const before = snap();
  const project = S().project;
  ok(await rpc('planner_update_project', { name: project.name }));
  expectNothingHappened('zelfde projectnaam', before);
  assert(S().project === project, 'het project is exact het oude (ook modifiedAt)');
});

// --- 3) Deels geweigerd, deels no-op -------------------------------------------------------------
test('update_tasks: één item geweigerd, het andere een no-op ⇒ weigering gemeld, verder niets', async () => {
  const { a, b } = savedProject();
  const before = snap();
  const res = ok(await rpc('planner_update_tasks', {
    updates: [{ id: a, progress: { completion: 150 } }, { id: b, fields: { name: 'Fundering' } }],
  }));
  assertEq(res.itemRejections?.length, 1, 'de weigering blijft gemeld');
  assertEq(res.data.updated, [b], 'het no-op-item telt als verwerkt');
  expectNothingHappened('geweigerd + no-op', before);
});

// --- 4) planner_batch -----------------------------------------------------------------------------
test('planner_batch met alleen no-op-stappen (ook een geweigerd item): geen undo-stap', async () => {
  const { a, b } = savedProject();
  const before = snap();
  const res = ok(await rpc('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: a, fields: { name: 'Grondwerk' } }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: b, progress: { completion: 150 } }] } },
    ],
  }));
  assertEq(res.itemRejections?.length, 1, 'de weigering uit stap 2 blijft gemeld');
  expectNothingHappened('batch van no-ops', before);
});

test('planner_batch met alleen leesstappen: geen undo-stap', async () => {
  const { a } = savedProject();
  const before = snap();
  const res = ok(await rpc('planner_batch', {
    steps: [{ tool: 'planner_get_task', args: { taskId: a } }, { tool: 'planner_get_project_info' }],
  }));
  assertEq(res.data.stepCount, 2, 'beide leesstappen uitgevoerd');
  expectNothingHappened('batch van leesstappen', before);
});

test('planner_batch die een naam wijzigt en weer terugzet: per saldo niets, dus geen undo-stap', async () => {
  const { a } = savedProject();
  const before = snap();
  ok(await rpc('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: a, fields: { name: 'Tijdelijk' } }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: a, fields: { name: 'Grondwerk' } }] } },
    ],
  }));
  assertEq(applied(), before.applied, 'geen undo-stap');
  assertEq(undone(), before.undone, 'redo-stapel blijft staan');
  assertEq(S().isDirty, false, 'document niet gewijzigd');
  assertEq(task(a).name, 'Grondwerk', 'naam zoals hij was');
});

test('planner_batch: no-op-stap gevolgd door een leesstap op een verouderde planning ⇒ niets herrekend', async () => {
  const { a, b } = savedProject();
  const staleStartB = makeStale(a, b);
  const before = snap();
  const res = ok(await rpc('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: a, fields: { name: 'Grondwerk' } }] } },
      { tool: 'planner_get_task', args: { taskId: a } },
    ],
  }));
  assertEq(res.data.steps[1].status, 'uitgevoerd', 'de leesstap is uitgevoerd');
  expectNothingHappened('batch no-op + lezen (verouderd)', before);
  assertEq(task(b).time.earlyStart, staleStartB, 'B staat nog op zijn oude berekende start');
  assertEq(res.envelope.scheduleStale, true, 'de envelop meldt eerlijk dat de planning nog verouderd is');
});

test('controle: planner_batch met een echte wijziging blijft één undo-stap', async () => {
  const { a, b } = savedProject();
  const before = applied();
  ok(await rpc('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: a, fields: { name: 'Grondwerk' } }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: b, fields: { name: 'Fundering en kelder' } }] } },
    ],
  }));
  assertEq(applied(), before + 1, 'één undo-stap');
  assertEq(S().isDirty, true, 'document gewijzigd');
});

// --- 5) Verouderde planning en "datums zoals opgeslagen" -----------------------------------------
test('no-op op een verouderde planning: blijft verouderd, cpmResult ongemoeid', async () => {
  const { a, b } = savedProject();
  const staleStartB = makeStale(a, b);
  const before = snap();
  const res = ok(await rpc('planner_update_tasks', { updates: [{ id: a, fields: { name: 'Grondwerk' } }] }));
  expectNothingHappened('verouderd + no-op', before);
  assertEq(task(b).time.earlyStart, staleStartB, 'B staat nog op zijn oude berekende start');
  assertEq(res.envelope.scheduleStale, true, 'de envelop meldt de verouderde planning');
});

test('no-op in "datums zoals opgeslagen": de modus blijft aan, geen undo-stap', async () => {
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('g5')), { filePath: null, recompute: true });
  S().showRecordedDates();
  assertEq(S().datesAsRecorded, true, 'opzet: de modus staat aan');
  const bId = S().tasks.find((t) => t.wbsCode === '1.2')!.id;
  const recordedStart = task(bId).time.earlyStart;
  const before = snap();
  ok(await rpc('planner_update_tasks', { updates: [{ id: bId, fields: { name: task(bId).name } }] }));
  expectNothingHappened('opgeslagen datums + no-op', before);
  assertEq(S().datesAsRecorded, true, 'de modus blijft aan');
  assertEq(task(bId).time.earlyStart, recordedStart, 'de opgeslagen datum blijft staan');
});

// --- 6) De transactie zelf, en wat géén no-op is -------------------------------------------------
test('een lege MCP-transactie laat geen undo-stap achter', () => {
  savedProject();
  const before = snap();
  const res = mcpTransactions.run(() => 'niets');
  assert(res.ok, 'de transactie slaagt');
  assertEq(res.ok && res.value, 'niets', 'de waarde van de callback komt terug');
  expectNothingHappened('lege run', before);
});

test('baseline activeren is wél een wijziging: één undo-stap, undo zet de vorige terug', async () => {
  savedProject();
  const first = S().saveBaseline('Eerste');
  const second = S().saveBaseline('Tweede');
  S().setActiveBaseline(second);
  store.setState((s) => { s.isDirty = false; });
  const before = applied();
  const res = ok(await rpc('planner_activate_baseline', { baselineId: first }));
  assertEq(res.data.changed, true, 'de activatie wijzigt iets');
  assertEq(S().activeBaselineId, first, 'de gekozen baseline is actief');
  assertEq(applied(), before + 1, 'één undo-stap');
  assertEq(S().isDirty, true, 'document gewijzigd (de actieve baseline gaat mee in het bestand)');
  S().undo();
  assertEq(S().activeBaselineId, second, 'undo zet de vorige actieve baseline terug');
});

await run();
