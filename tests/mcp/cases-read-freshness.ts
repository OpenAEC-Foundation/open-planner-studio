// Leestools rekenen zelf bij (besluit eigenaar, 2026-10; was knownbugs 73).
//
// Zonder `planner_run_cpm` kon de agent een planning die een mens in de app had gewijzigd
// (`scheduleStale: true`, automatisch berekenen uit) niet meer verversen: de leestools gaven de oude
// datums. Nu rekent elke leestool die berekende waarden teruggeeft eerst door (`freshenScheduleForRead`
// in tools/runtime.ts), net als F5: geen undo-stap, geen `isDirty`, de redo-stapel blijft.
// Uitzondering: "datums zoals opgeslagen". Daar rekent een leestool NIET door (dat zou de opgeslagen
// datums vervangen en een undo-stap pushen); de envelop meldt de modus.
//
// Alles via de ECHTE dispatch-weg (`handleMcpMessage`), zoals het recept vraagt.
//
// MUTATIEBEWIJS (nagespeeld bij het bouwen):
//  - zet in `runReadTool` de regel `if (opts?.freshSchedule) freshen();` uit ⇒ case 1 en 2 slaan rood
//    (oude datums, `scheduleStale: true` in de envelop);
//  - haal de modus-tak uit `ensureFreshScheduleForRead` (staleGuard.ts) ⇒ case 5 slaat rood;
//  - haal de `ctx.transactions.isActive()`-tak uit `freshenScheduleForRead` ⇒ case 4 slaat rood;
//  - haal de `isAutoCalcHeld()`-tak uit `ensureFreshScheduleForRead` ⇒ case 6 slaat rood;
//  - haal de `failedSolveBlocks`-tak uit `ensureFreshScheduleForRead` ⇒ case 7 slaat rood.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool, registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { DATES_AS_RECORDED_NOTE, EDIT_IN_PROGRESS_NOTE } from '@/services/mcp/tools/runtime';
import { holdAutoCalc } from '@/state/editHold';
import type { McpContext, McpToolResult } from '@/services/mcp/contracts';
import { mcpTransactions } from '@/state/mcpTransaction';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import { readIFC } from '@/services/ifc/ifcReader';
import { externIfc } from '../fixtures/recordedDatesIfc';

const store = useAppStore;
const S = () => store.getState();
registerAllTools();

// Warm-up (zoals cases-recorded-dates.ts): projectkalender tot bibliotheek-entry promoten via één
// undo, zodat restore-paden een steady state hebben.
S().addTask({ name: 'warmup' });
S().undo();

async function rpc(name: string, args: unknown = {}, ctx?: McpContext): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    ctx ?? makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 200)}`);
  return msg.result.structuredContent;
}

function ok(res: any, label: string): any {
  assert(res.ok === true, `${label}: verwachtte ok, kreeg fout: ${res.error}`);
  return res;
}

const applied = () => S().historyEvents.filter((e) => e.state === 'applied').length;
const undone = () => S().historyEvents.filter((e) => e.state === 'undone').length;
const task = (id: string) => S().tasks.find((t) => t.id === id)!;

interface StaleProject { a: string; b: string; oldEnd: string; oldStartB: string }

/**
 * A (5 d) → B (5 d), doorgerekend, met een actieve baseline; daarna wijzigt een "mens" de duur van A
 * in de app (store-actie, automatisch berekenen uit) ⇒ `scheduleStale: true`, de berekende datums
 * staan nog op de oude stand. Dan nog een redo-stap, en "opgeslagen" (isDirty=false).
 */
function staleProject(): StaleProject {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01' });
  const a = S().addTask({ name: 'Grondwerk', time: createDefaultTaskTime('2026-06-01', 5) });
  const b = S().addTask({ name: 'Fundering', time: createDefaultTaskTime('2026-06-01', 5) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  S().saveBaseline('Basis');
  const oldEnd = S().cpmResult!.projectEnd!;
  const oldStartB = task(b).time.earlyStart!;
  S().updateTask(a, { time: { ...task(a).time, scheduleDuration: 10 } });
  S().addTask({ name: 'weer weg' });
  S().undo(); // ⇒ een redo-stapel die een lezing niet mag wissen
  store.setState((s) => { s.isDirty = false; });
  assertEq(S().scheduleStale, true, 'opzet: de planning is verouderd');
  assertEq(S().cpmResult!.projectEnd, oldEnd, 'opzet: het berekende einde staat nog op de oude stand');
  assert(undone() > 0, 'opzet: er ligt een redo-stapel');
  return { a, b, oldEnd, oldStartB };
}

/** De gedeelde eisen na een lezing die bijrekende. */
function expectFreshAfterRead(label: string, res: any, before: { applied: number; undone: number }, p: StaleProject): void {
  assertEq(res.envelope.scheduleStale, false, `${label}: de envelop meldt een verse planning`);
  assertEq(res.envelope.scheduleRecalculated, true, `${label}: de envelop meldt dat er is bijgerekend`);
  assertEq(S().scheduleStale, false, `${label}: de store is vers`);
  assert(S().cpmResult!.projectEnd! > p.oldEnd, `${label}: het einde is verschoven door de langere duur`);
  assert(task(p.b).time.earlyStart! > p.oldStartB, `${label}: B staat op zijn verse start`);
  assertEq(applied(), before.applied, `${label}: geen undo-stap`);
  assertEq(undone(), before.undone, `${label}: de redo-stapel blijft staan`);
  assertEq(S().isDirty, false, `${label}: het document wordt niet vuil`);
  // Vers betekent stabiel: nog eens doorrekenen verandert niets meer.
  const end = S().cpmResult!.projectEnd;
  S().runCPM();
  assertEq(S().cpmResult!.projectEnd, end, `${label}: nog eens rekenen geeft hetzelfde einde`);
}

// --- 1) Elke leestool met berekende waarden geeft na een menselijke wijziging verse datums -----------
const FRESH_READS: Array<{ tool: string; args: (p: StaleProject) => unknown; check: (data: any, p: StaleProject) => void }> = [
  { tool: 'planner_get_project_info', args: () => ({}), check: (d) => {
    assertEq(d.schedule.projectEnd, S().cpmResult!.projectEnd, 'get_project_info: projectEnd is het verse einde');
    assertEq(d.schedule.scheduleStale, false, 'get_project_info: scheduleStale in de data is false');
  } },
  { tool: 'planner_get_project_overview', args: () => ({}), check: (d, p) => {
    const row = (d.tasks as any[]).find((r) => r.id === p.b);
    assertEq(row.start, task(p.b).time.earlyStart, 'get_project_overview: B-start is vers');
  } },
  { tool: 'planner_list_tasks', args: () => ({}), check: (d, p) => {
    const row = ((d.tasks ?? d.items) as any[]).find((r) => r.id === p.b);
    assert(JSON.stringify(row).includes(task(p.b).time.earlyStart!), 'list_tasks: de rij van B draagt de verse start');
  } },
  { tool: 'planner_get_task', args: (p) => ({ taskId: p.b }), check: (d, p) => {
    assertEq(d.schedule.earlyStart, task(p.b).time.earlyStart, 'get_task: B-start is vers');
    assert(d.schedule.earlyStart > p.oldStartB, 'get_task: niet de oude start');
  } },
  { tool: 'planner_get_critical_path', args: () => ({}), check: (d, p) => {
    assert(d.hasResult !== false, 'get_critical_path: er is een rekenresultaat');
    assert(JSON.stringify(d).includes(p.b), 'get_critical_path: B staat op het kritieke pad');
  } },
  { tool: 'planner_compare_baseline', args: () => ({}), check: (d) => {
    assert(typeof d.projectEndDelta === 'number' && d.projectEndDelta > 0,
      `compare_baseline: het verse einde ligt na de baseline (delta ${JSON.stringify(d.projectEndDelta)})`);
  } },
  { tool: 'planner_analyze_delay', args: () => ({}), check: (d) => {
    assert(typeof d.projectEndDelta === 'number' && d.projectEndDelta > 0,
      `analyze_delay: de vertraging komt uit de verse planning (delta ${JSON.stringify(d.projectEndDelta)})`);
  } },
  { tool: 'planner_get_resource_histogram', args: () => ({}), check: (d) => {
    assertEq(d.recomputed, true, 'get_resource_histogram: meldt de herrekening ook in de data');
  } },
  { tool: 'planner_list_documents', args: () => ({}), check: (d) => {
    const row = (d.documents as any[]).find((r) => r.isActive);
    assertEq(row.projectEnd, S().cpmResult!.projectEnd, 'list_documents: het actieve document toont het verse einde');
    assertEq(row.scheduleStale, undefined, 'list_documents: de actieve rij is niet meer verouderd');
  } },
];

for (const read of FRESH_READS) {
  test(`${read.tool}: na een wijziging in de app (scheduleStale) ⇒ verse datums, geen undo-stap, niet vuil`, async () => {
    const p = staleProject();
    const before = { applied: applied(), undone: undone() };
    const res = ok(await rpc(read.tool, read.args(p)), read.tool);
    read.check(res.data, p);
    expectFreshAfterRead(read.tool, res, before, p);
  });
}

test('leestools zonder berekende waarden rekenen niet: list_resources en get_calendars', async () => {
  for (const tool of ['planner_list_resources', 'planner_get_calendars', 'planner_list_baselines']) {
    staleProject();
    const cpm = S().cpmResult;
    const res = ok(await rpc(tool), tool);
    assertEq(res.envelope.scheduleStale, true, `${tool}: de envelop meldt eerlijk de verouderde planning`);
    assertEq(res.envelope.scheduleRecalculated, undefined, `${tool}: niet bijgerekend`);
    assert(S().cpmResult === cpm, `${tool}: cpmResult ongemoeid`);
  }
});

// --- 2) Ook bij alleen-lezen en pauze: berekende velden zijn geen projectdata -------------------------
test('alleen-lezen + pauze: een leestool rekent tóch bij, zonder undo-stap en zonder isDirty', async () => {
  const p = staleProject();
  store.setState((s) => { s.ui.aiReadOnly = true; s.ui.aiPaused = true; });
  try {
    const before = { applied: applied(), undone: undone() };
    const ctx = makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId, readOnly: true, paused: true });
    const res = ok(await rpc('planner_get_project_info', {}, ctx), 'get_project_info (alleen-lezen)');
    assertEq([res.envelope.readOnly, res.envelope.paused], [true, true], 'de envelop meldt beide vlaggen');
    expectFreshAfterRead('alleen-lezen', res, before, p);
    // Controle: een muterende tool blijft geweigerd.
    const mut = await rpc('planner_update_tasks', { updates: [{ id: p.a, fields: { name: 'X' } }] }, ctx);
    assertEq(mut.ok, false, 'een mutatie blijft geweigerd bij pauze/alleen-lezen');
  } finally {
    store.setState((s) => { s.ui.aiReadOnly = false; s.ui.aiPaused = false; });
  }
});

// --- 3) Een open dialoog: geweigerd vóór er gerekend wordt ------------------------------------------
test('open dialoog: DIALOG_OPEN en er wordt niets doorgerekend', async () => {
  staleProject();
  const cpm = S().cpmResult;
  store.setState((s) => { s.ui.showProjectSettings = true; });
  try {
    const res = await rpc('planner_get_project_info');
    assertEq([res.ok, res.code], [false, 'DIALOG_OPEN'], 'de dialoog-guard weigert de lezing');
    assertEq(S().scheduleStale, true, 'de planning is niet doorgerekend');
    assert(S().cpmResult === cpm, 'cpmResult ongemoeid');
  } finally {
    store.setState((s) => { s.ui.showProjectSettings = false; });
  }
});

// --- 4) Binnen een MCP-transactie rekent een leestool niet zelf --------------------------------------
// Daar telt elke taakwijziging als datawijziging: een herrekening zou van een lezing een undo-stap met
// isDirty maken. `planner_batch` ververst daarom vóór zijn transactie (cases-undo-noop.ts).
test('leestool binnen een lopende MCP-transactie: geen herrekening, geen undo-stap, niet vuil', () => {
  staleProject();
  const before = { applied: applied(), undone: undone() };
  const tool = getTool('planner_get_project_info')!;
  const ctx = makeMcpContext(appStoreContext);
  const res = mcpTransactions.run(() => tool.handler({}, ctx) as McpToolResult);
  assert(res.ok && res.value.ok, 'transactie en lezing slagen');
  assertEq(res.ok && res.value.ok && res.value.envelope.scheduleRecalculated, undefined, 'niet bijgerekend binnen de transactie');
  assertEq(applied(), before.applied, 'geen undo-stap');
  assertEq(undone(), before.undone, 'redo-stapel intact');
  assertEq(S().isDirty, false, 'niet vuil');
  assertEq(S().scheduleStale, true, 'de planning blijft verouderd (de transactie had niets te doen)');
});

test('planner_batch met alleen een histogram-leesstap op een verouderde planning: verse datums, geen undo-stap', async () => {
  const p = staleProject();
  const before = { applied: applied(), undone: undone() };
  const res = ok(await rpc('planner_batch', { steps: [{ tool: 'planner_get_resource_histogram' }] }), 'batch');
  assertEq(res.data.steps[0].status, 'uitgevoerd', 'de leesstap is uitgevoerd');
  assertEq(applied(), before.applied, 'geen undo-stap');
  assertEq(undone(), before.undone, 'redo-stapel intact');
  assertEq(S().isDirty, false, 'niet vuil');
  assertEq(S().scheduleStale, false, 'vóór de transactie doorgerekend');
  assert(task(p.b).time.earlyStart! > p.oldStartB, 'B staat op zijn verse start');
});

// --- 5) "Datums zoals opgeslagen": niet doorrekenen, wel melden ---------------------------------------
function enterMode(tag: string): { bId: string } {
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc(tag)), { filePath: null, recompute: true });
  S().showRecordedDates();
  assertEq(S().datesAsRecorded, true, 'opzet: de modus staat aan');
  return { bId: S().tasks.find((t) => t.wbsCode === '1.2')!.id };
}

const MODE_READS: Array<{ tool: string; args: (bId: string) => unknown }> = [
  { tool: 'planner_get_project_info', args: () => ({}) },
  { tool: 'planner_get_project_overview', args: () => ({}) },
  { tool: 'planner_list_tasks', args: () => ({}) },
  { tool: 'planner_get_task', args: (bId) => ({ taskId: bId }) },
  { tool: 'planner_get_critical_path', args: () => ({}) },
  { tool: 'planner_get_resource_histogram', args: () => ({}) },
  { tool: 'planner_list_documents', args: () => ({}) },
];

test('datums zoals opgeslagen: leestools rekenen niet door, melden de modus, de modus blijft, geen undo-stap', async () => {
  for (const read of MODE_READS) {
    const { bId } = enterMode(`fresh-${read.tool}`);
    const cpm = S().cpmResult;
    const before = { applied: applied(), undone: undone(), dirty: S().isDirty };
    const res = ok(await rpc(read.tool, read.args(bId)), read.tool);
    assertEq(res.envelope.datesAsRecorded, true, `${read.tool}: de envelop meldt de modus`);
    assertEq(res.envelope.scheduleNote, DATES_AS_RECORDED_NOTE, `${read.tool}: met de Engelse toelichting`);
    assertEq(res.envelope.scheduleStale, false, `${read.tool}: scheduleStale blijft false (invariant)`);
    assertEq(res.envelope.scheduleRecalculated, undefined, `${read.tool}: niet bijgerekend`);
    assertEq(S().datesAsRecorded, true, `${read.tool}: de modus blijft aan`);
    assert(S().recordedDates !== null, `${read.tool}: de vastlegging blijft`);
    assert(S().cpmResult === cpm, `${read.tool}: cpmResult ongemoeid`);
    assertEq(task(bId).time.earlyStart, '2026-03-16', `${read.tool}: B houdt zijn OPGESLAGEN start`);
    assertEq(applied(), before.applied, `${read.tool}: geen undo-stap`);
    assertEq(undone(), before.undone, `${read.tool}: redo-stapel intact`);
    assertEq(S().isDirty, before.dirty, `${read.tool}: isDirty ongewijzigd`);
    if (read.tool === 'planner_get_task') {
      assertEq(res.data.schedule.earlyStart, '2026-03-16', 'get_task geeft de opgeslagen start terug');
    }
    if (read.tool === 'planner_list_documents') {
      assertEq((res.data.documents as any[]).find((r) => r.isActive).datesAsRecorded, true,
        'list_documents: de rij meldt de modus');
    }
  }
});

// De invariant "modus aan ⇒ nooit stale" (state/scheduleStale.ts) zou `ensureFreshSchedule` in de modus
// al stil houden. De leestool-tak in `ensureFreshScheduleForRead` maakt dat afgedwongen: ook als die
// invariant ooit breekt, verlaat een lezing de modus niet.
test('datums zoals opgeslagen + (kunstmatig) verouderd: een leestool verlaat de modus nog steeds niet', async () => {
  const { bId } = enterMode('fresh-broken-invariant');
  store.setState((s) => { s.scheduleStale = true; });
  const before = applied();
  const res = ok(await rpc('planner_get_task', { taskId: bId }), 'get_task');
  assertEq(res.data.schedule.earlyStart, '2026-03-16', 'de opgeslagen start komt terug');
  assertEq(S().datesAsRecorded, true, 'de modus blijft aan');
  assertEq(applied(), before, 'geen undo-stap (runCPM is niet aangeroepen)');
  store.setState((s) => { s.scheduleStale = false; });
});

test('controle: de eerste echte mutatie in de modus rekent wél door en verlaat de modus (één undo-stap)', async () => {
  const { bId } = enterMode('fresh-mutate');
  const before = applied();
  const res = ok(await rpc('planner_update_tasks', { updates: [{ id: bId, fields: { name: 'Anders' } }] }), 'update_tasks');
  assertEq(S().datesAsRecorded, false, 'de modus is verlaten');
  assertEq(res.envelope.datesAsRecorded, undefined, 'de envelop meldt de modus niet meer');
  assertEq(applied(), before + 1, 'één undo-stap');
  assertEq(task(bId).time.earlyStart, '2026-03-09', 'B staat op zijn herberekende start');
});

// --- 6) Een lopende bewerking (sleepgebaar, typen) houdt het bijrekenen tegen ---------------------
// Zelfde rem als Automatisch berekenen (`editHold.ts`, `useBarDrag`, `useTextEntryAutoCalcHold`):
// anders verspringt de balk onder de muis van de gebruiker.
test('lopende bewerking (holdAutoCalc): een leestool rekent niet door en meldt dat eerlijk', async () => {
  const p = staleProject();
  const cpm = S().cpmResult;
  const release = holdAutoCalc();
  try {
    const res = ok(await rpc('planner_get_task', { taskId: p.b }), 'get_task (bewerking)');
    assertEq(res.envelope.scheduleStale, true, 'de envelop meldt eerlijk een verouderde planning');
    assertEq(res.envelope.scheduleRecalculated, undefined, 'niet bijgerekend');
    assertEq(res.envelope.scheduleNote, EDIT_IN_PROGRESS_NOTE, 'met de Engelse toelichting');
    assert(S().cpmResult === cpm, 'cpmResult ongemoeid');
    assertEq(res.data.schedule.earlyStart, p.oldStartB, 'de (nog) oude start, eerlijk als verouderd gemeld');
  } finally {
    release();
  }
  const after = ok(await rpc('planner_get_task', { taskId: p.b }), 'get_task (na de bewerking)');
  assertEq(after.envelope.scheduleRecalculated, true, 'na loslaten rekent de volgende lezing wél door');
  assertEq(after.envelope.scheduleNote, undefined, 'en dan zonder toelichting');
});

// --- 7) Na een mislukte berekening niet opnieuw solven zolang de invoer gelijk bleef --------------
// Zelfde rem als Automatisch berekenen (`failedSolveGate.ts`): anders solvet elke lezing opnieuw en
// telt de melding `cpm-error` op (ook nadat de gebruiker hem wegklikte).
function cyclicProject(): { a: string; b: string } {
  const p = staleProject();
  // B → A erbij, zoals een importer hem schrijft (de store-route weigert de kring zelf).
  store.setState((s) => {
    s.sequences.push({ id: 'seq-kring', predecessorId: p.b, successorId: p.a, type: 'FINISH_START', lagDays: 0 });
  });
  return p;
}

const cpmErrorCount = () => S().ui.notifications.find((n) => n.dedupeKey === 'cpm-error')?.count ?? 0;

test('kringverwijzing: de eerste lezing rekent één keer, daarna geen nieuwe solve of melding zolang de invoer gelijk blijft', async () => {
  cyclicProject();
  store.setState((s) => { s.ui.notifications = []; });
  const first = ok(await rpc('planner_list_tasks'), 'list_tasks 1');
  const error = S().cpmResult?.error;
  assert(typeof error === 'string' && error.length > 0, 'opzet: de berekening faalt op de kring');
  assertEq(first.envelope.scheduleError, error, 'list_tasks meldt de rekenfout in de envelop');
  assertEq(first.envelope.scheduleStale, true, 'en de planning blijft verouderd');
  assertEq(cpmErrorCount(), 1, 'één melding van de mislukte berekening');
  const failed = S().cpmResult;

  for (const tool of ['planner_get_project_info', 'planner_list_tasks', 'planner_get_critical_path']) {
    const res = ok(await rpc(tool), tool);
    assertEq(res.envelope.scheduleError, error, `${tool}: de fout staat in de envelop`);
  }
  const detail = ok(await rpc('planner_get_task', { taskId: S().tasks[0].id }), 'get_task');
  assertEq(detail.envelope.scheduleError, error, 'get_task: de fout staat in de envelop');
  assert(S().cpmResult === failed, 'geen nieuwe solve: cpmResult is hetzelfde object');
  assertEq(cpmErrorCount(), 1, 'de melding telt niet op');

  // Weggeklikt blijft weg.
  store.setState((s) => { s.ui.notifications = []; });
  ok(await rpc('planner_get_project_info'), 'get_project_info na wegklikken');
  assertEq(cpmErrorCount(), 0, 'een weggeklikte melding komt niet terug door een lezing');

  // Echte invoerwijziging (de kring weg) ⇒ de volgende lezing rekent wél, en slaagt.
  store.setState((s) => { s.sequences = s.sequences.filter((q) => q.id !== 'seq-kring'); });
  const fixed = ok(await rpc('planner_get_project_info'), 'get_project_info na herstel');
  assertEq(fixed.envelope.scheduleRecalculated, true, 'na een invoerwijziging wordt er opnieuw gerekend');
  assertEq(fixed.envelope.scheduleError, undefined, 'zonder fout');
  assertEq(fixed.envelope.scheduleStale, false, 'en vers');
});

test('planner_batch met een leesstap op een verouderde planning meldt scheduleRecalculated in de envelop', async () => {
  staleProject();
  const res = ok(await rpc('planner_batch', { steps: [{ tool: 'planner_get_project_info' }] }), 'batch');
  assertEq(res.envelope.scheduleRecalculated, true, 'de batch rekende vooraf door en zegt dat');
  const fresh = ok(await rpc('planner_batch', { steps: [{ tool: 'planner_get_project_info' }] }), 'batch 2');
  assertEq(fresh.envelope.scheduleRecalculated, undefined, 'op een verse planning niet');
});

await run();
