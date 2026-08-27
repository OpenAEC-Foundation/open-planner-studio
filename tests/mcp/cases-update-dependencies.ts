// `planner_update_dependencies` — het WIJZIGEN van bestaande relaties (dependencyTools.ts).
//
// Het gat dat deze tool dicht: de bridge kon relaties alleen TOEVOEGEN en VERWIJDEREN. Een FS naar SS
// omzetten of alleen de lag bijstellen moest via verwijderen-en-opnieuw-toevoegen — met een nieuw
// sequence-id (dood voor elke verwijzing die de agent net uit de overview haalde) en twee undo-stappen.
//
// Bewijslast in dit bestand:
//   1. type wijzigen (lange én korte notatie) landt ECHT in de store;
//   2. lag wijzigen als getal, als "+2d"-string, als kale "2"-string én als procent "+50%";
//   3. LEESKANT↔SCHRIJFKANT: wat get_project_overview toont (FS+50% #seq-x) gaat er zó weer in;
//   4. een achtergebleven `lagMinutes` wordt gewist — anders overrulet die de nieuwe lag STIL;
//   5. onbekend seqId ⇒ zachte weigering; onbekend veld ⇒ weigering die de SLEUTEL noemt;
//   6. een kringverwijzing (via een verlegd eindpunt) ⇒ harde CYCLE + byte-identieke rollback;
//   7. duplicaat (zelfde voorganger+opvolger+type) ⇒ zachte weigering die de botsende relatie noemt;
//   8. een item dat niets verandert ⇒ zachte weigering, nooit een `ok` zonder effect;
//   9. het VOOR/NA-verschil per gewijzigde relatie klopt met de store;
//  10. alles ook via `planner_batch` (de batch-stap omzeilt de dispatcher, dus apart bewijzen);
//  11. `planner_add_dependencies` staat een verzameltaak-eindpunt sinds het eigenaarsbesluit van
//      2026-08-15 gewoon TOE (`expandSummaryRelations` rekent zo'n relatie door naar de
//      onderliggende bladtaken, MS Project-semantiek) — alleen een relatie tussen een taak en zijn
//      EIGEN (voor)ouder-samenvatting wordt nog geweigerd (`relationRules.ts`, `isAncestorRelation`).
//      Mijlpalen blijven expliciet toegestaan als voorganger/opvolger.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { getTool, registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createSnapshot } from '@/state/snapshot';
import type { McpContext, McpToolOk, McpToolResult } from '@/services/mcp/contracts';
import type { Sequence } from '@/types/sequence';

const store = useAppStore;
registerAllTools();

// Warm-up (zelfde reden als cases-mutate-tasks.ts): op een VERSE store staat `calendars: []`; het
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry. Door hier één edit te undo'en
// staat `cal-default` al in de bibliotheek, zodat de byte-identiek-assert na een rollback niet op die
// benigne promotie struikelt.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────

function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: store.getState().activeDocumentId,
    ...over,
  });
}

async function call(name: string, args: unknown, ctx: McpContext = makeCtx()): Promise<McpToolResult> {
  const def = getTool(name);
  if (!def) throw new Error(`tool ontbreekt in de registry: ${name}`);
  return await def.handler(args, ctx);
}

function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : `${res.code} ${res.error}`}`);
  return (res as McpToolOk).data as any;
}

function rejections(res: McpToolResult): { id: string; reason: string }[] {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).itemRejections ?? [];
}

const seqById = (id: string) => store.getState().sequences.find((s) => s.id === id)!;

/** `addSequence` retourneert sinds de relatieregels `string | null`. In deze fixtures zijn de
 *  eindpunten aantoonbaar geldige bladtaken, dus een `null` betekent dat er iets stuk is — dan
 *  willen we dát zien, niet een vage vervolgfout op een undefined id. */
function addSeq(seq: Omit<Sequence, 'id'>): string {
  const id = store.getState().addSequence(seq);
  if (id === null) throw new Error(`fixture: addSequence geweigerd voor ${seq.predecessorId}->${seq.successorId}`);
  return id;
}

/** Verse basis: drie taken A→B→C met twee relaties. Retourneert de id's. */
function threeChain(): { a: string; b: string; c: string; s1: string; s2: string } {
  store.getState().newProject();
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  const c = store.getState().addTask({ name: 'C' });
  // A/B/C zijn bladtaken zonder kinderen, deze relaties worden nooit geweigerd (zie addSeq).
  const s1 = addSeq({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  const s2 = addSeq({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
  return { a, b, c, s1, s2 };
}

// =================================================================================================
// 1) type wijzigen
// =================================================================================================
test('type wijzigen: FINISH_START ⇒ START_START landt echt in de store', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, type: 'START_START' }] });
  const data = okData(res);
  assertEq(seqById(s1).type, 'START_START', 'het type is ECHT gewijzigd');
  assertEq(data.updated.length, 1, 'één relatie gewijzigd');
  assertEq(data.updated[0].id, s1, 'het rapport noemt het sequence-id');
  assertEq(data.updated[0].changes.type, { from: 'FS', to: 'SS' }, 'het VOOR/NA-verschil klopt');
  assert(data.updated[0].changes.lag === undefined, 'een ongemoeide lag staat NIET in het verschil');
});

test('type wijzigen: de KORTE leeskant-notatie (FF) wordt geaccepteerd en vertaald', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, type: 'ff' }] });
  okData(res);
  assertEq(seqById(s1).type, 'FINISH_FINISH', 'kort + kleine letters ⇒ FINISH_FINISH');
});

test('onbekend type ⇒ zachte weigering die BEIDE notaties noemt, relatie ongewijzigd', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, type: 'XX' }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  assertEq(seqById(s1).type, 'FINISH_START', 'de relatie is ongemoeid');
  const reason = rejections(res)[0].reason;
  assert(reason.includes('FINISH_START') && reason.includes('FS'), `reden noemt beide notaties: ${reason}`);
});

// =================================================================================================
// 2) lag wijzigen — getal, "+2d", kale "2", procent
// =================================================================================================
test('lag wijzigen: getal, "+2d", "-1d" en kale "2" leveren allemaal de juiste lagDays', async () => {
  for (const [input, expect] of [[3, 3], ['+2d', 2], ['-1d', -1], ['2', 2]] as [unknown, number][]) {
    const { s1 } = threeChain();
    const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: input }] });
    const data = okData(res);
    assertEq(seqById(s1).lagDays, expect, `${JSON.stringify(input)} ⇒ lagDays ${expect}`);
    assertEq(data.updated[0].changes.lag.from, '0', 'de VOOR-waarde is de oude lag');
    assertEq(data.updated[0].changes.lag.to, expect > 0 ? `+${expect}d` : `${expect}d`, 'de NA-waarde in leeskant-notatie');
    assertEq(data.updated[0].changes.type, undefined, 'het type staat niet in het verschil');
  }
});

test('lag wijzigen: "+50%" zet lagPercent en wist de dag-lag', async () => {
  const { s1 } = threeChain();
  await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: 4 }] });
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: '+50%' }] });
  const data = okData(res);
  assertEq(seqById(s1).lagPercent, 50, 'lagPercent is 50');
  assertEq(seqById(s1).lagDays, 0, 'de dag-lag is 0 (procent sluit dagen uit)');
  assertEq(data.updated[0].changes.lag, { from: '+4d', to: '+50%' }, 'het verschil toont beide notaties');
});

test('terug van procent naar dagen WIST lagPercent (anders overrulet die de nieuwe lag stil)', async () => {
  const { s1 } = threeChain();
  await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: '+50%' }] });
  await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: 2 }] });
  assertEq(seqById(s1).lagDays, 2, 'lagDays is 2');
  assert(seqById(s1).lagPercent === undefined, 'lagPercent is echt weg (niet alleen overschreven)');
  assert(!('lagPercent' in seqById(s1)), 'de sleutel bestaat niet meer (byte-identiek aan een verse relatie)');
});

test('een achtergebleven lagMinutes wordt gewist EN gemeld (anders is de dag-lag een stille no-op)', async () => {
  store.getState().newProject();
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  // Zoals een IFC-/P6-import hem oplevert: dag-lag 0 met een minuut-precieze lag als bron van waarheid.
  // A/B zijn bladtaken zonder kinderen, deze relatie wordt nooit geweigerd (zie addSeq).
  const s = addSeq({
    predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0, lagMinutes: 240,
  });
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s, lag: 2 }] });
  const data = okData(res);
  assertEq(seqById(s).lagDays, 2, 'de dag-lag staat op 2');
  assert(seqById(s).lagMinutes === undefined, 'de minuut-lag is gewist — anders won die van lagDays');
  assertEq(data.updated[0].changes.lag.clearedLagMinutes, 240, 'de gewiste minuut-lag wordt EXPLICIET gemeld');
});

test('onzin-lag ("morgen", true) ⇒ zachte weigering per item, relatie ongewijzigd', async () => {
  for (const bad of ['morgen', true] as unknown[]) {
    const { s1 } = threeChain();
    const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: bad }] });
    assertEq(okData(res).updated, [], `${JSON.stringify(bad)}: niets gewijzigd`);
    assertEq(seqById(s1).lagDays, 0, `${JSON.stringify(bad)}: de lag is niet stil op 0/NaN gezet`);
    assertEq(rejections(res).length, 1, `${JSON.stringify(bad)}: één weigering`);
  }
});

// =================================================================================================
// 3) LEESKANT ↔ SCHRIJFKANT — de kernconventie
// =================================================================================================
test('pariteit: de notatie uit get_project_overview gaat er ONGEWIJZIGD weer in', async () => {
  const { s1 } = threeChain();
  await call('planner_update_dependencies', { updates: [{ seqId: s1, type: 'SS', lag: '+50%' }] });

  // Lezen: de overview levert "→<wbs> SS+50% #<seqId>".
  const overview = okData(await call('planner_get_project_overview', {}));
  const dump = JSON.stringify(overview);
  const m = new RegExp(`([A-Z]{2})([+-][^ "#]*)? #${s1}`).exec(dump);
  assert(m !== null, `de overview toont de relatie met id: ${dump.slice(0, 400)}`);
  assertEq(m![1], 'SS', 'de leeskant toont het korte type');
  assertEq(m![2], '+50%', 'de leeskant toont de procent-lag');

  // Terugschrijven met exact die twee strings — op de ANDERE relatie, zodat er echt iets verandert.
  const { s2 } = { s2: store.getState().sequences.find((s) => s.id !== s1)!.id };
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s2, type: m![1], lag: m![2] }] });
  okData(res);
  assertEq(seqById(s2).type, 'START_START', 'het gelezen type is terugschrijfbaar');
  assertEq(seqById(s2).lagPercent, 50, 'de gelezen procent-lag is terugschrijfbaar');
});

// =================================================================================================
// 4) weigeringen: onbekend seqId, onbekend veld, dubbele seqId, self-loop, lege patch
// =================================================================================================
test('onbekend seqId ⇒ ZACHTE weigering; de geldige items uit dezelfde call gaan gewoon door', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', {
    updates: [{ seqId: s1, type: 'SS' }, { seqId: 'seq-bestaat-niet', type: 'FF' }],
  });
  const data = okData(res);
  assertEq(data.updated.length, 1, 'het geldige item is toegepast');
  assertEq(seqById(s1).type, 'START_START', 'de geldige wijziging landde');
  assertEq(rejections(res).length, 1, 'precies één zachte weigering');
  assertEq(rejections(res)[0].id, 'seq-bestaat-niet', 'de weigering noemt het rotte id');
  assert(/bestaat niet/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

test('onbekend veld ⇒ weigering die de SLEUTEL noemt, plus het alternatief', async () => {
  const cases: [string, unknown, RegExp][] = [
    ['lagUnit', 'ELAPSEDTIME', /niet zetbaar/],
    ['lagPercent', 50, /lag: "\+50%"/],
    ['lagDays', 3, /gebruik `lag`/],
    ['id', 'x', /gebruik `seqId`/],
    ['zomaarwat', 1, /Toegestaan: seqId/],
  ];
  for (const [key, value, hintRe] of cases) {
    const { s1 } = threeChain();
    const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, [key]: value }] });
    assertEq(okData(res).updated, [], `${key}: niets gewijzigd`);
    const reason = rejections(res)[0].reason;
    assert(reason.includes(`\`${key}\``), `${key}: de weigering NOEMT de sleutel — kreeg: ${reason}`);
    assert(hintRe.test(reason), `${key}: de weigering noemt het alternatief — kreeg: ${reason}`);
  }
});

test('dubbele seqId in één call ⇒ zachte weigering (geen stille laatste-wint)', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', {
    updates: [{ seqId: s1, type: 'SS' }, { seqId: s1, type: 'FF' }],
  });
  assertEq(seqById(s1).type, 'START_START', 'alleen het eerste item landde');
  assertEq(okData(res).updated.length, 1, 'één wijziging gerapporteerd');
  assert(/meerdere keren/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

test('een relatie naar zichzelf ⇒ zachte weigering', async () => {
  const { a, s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, successorId: a }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  assertEq(seqById(s1).successorId !== a, true, 'de relatie is ongemoeid');
  assert(/zichzelf/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

test('onbekend taak-id op een eindpunt ⇒ zachte weigering die het id noemt', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, predecessorId: 'taak-x' }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  const reason = rejections(res)[0].reason;
  assert(reason.includes('taak-x') && reason.includes('predecessorId'), `reden: ${reason}`);
});

test('een item ZONDER wijzigbaar veld ⇒ weigering, niet stil ok', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1 }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  assert(/minstens één/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

test('een wijziging die NIETS verandert ⇒ weigering "er valt niets te wijzigen"', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, type: 'FS', lag: 0 }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  assert(/niets te wijzigen/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

test('nul uitvoerbare items ⇒ GEEN transactie (undo-stack en redo-stack onaangeroerd)', async () => {
  const { s1 } = threeChain();
  store.getState().addTask({ name: 'undo-voer' });
  store.getState().undo(); // vult de redo-stack
  const undoBefore = store.getState().undoStack.length;
  const redoBefore = store.getState().redoStack.length;
  assert(redoBefore > 0, 'de redo-stack is gevuld (voorwaarde van deze test)');
  const res = await call('planner_update_dependencies', {
    updates: [{ seqId: 'nope', type: 'SS' }, { seqId: s1, type: 'FS' }],
  });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  assertEq(store.getState().undoStack.length, undoBefore, 'geen spurious undo-snapshot');
  assertEq(store.getState().redoStack.length, redoBefore, 'de redo-stack van de gebruiker is intact');
});

// =================================================================================================
// 5) duplicaat
// =================================================================================================
test('duplicaat: een type-wijziging die een BESTAANDE relatie dubbelt ⇒ zachte weigering die hem noemt', async () => {
  store.getState().newProject();
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  // A/B zijn bladtaken zonder kinderen, deze relaties worden nooit geweigerd (zie addSeq).
  const fs = addSeq({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  const ss = addSeq({ predecessorId: a, successorId: b, type: 'START_START', lagDays: 0 });
  const res = await call('planner_update_dependencies', { updates: [{ seqId: ss, type: 'FS' }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  assertEq(seqById(ss).type, 'START_START', 'de relatie is ongemoeid (store-updateSequence zou dit STIL negeren)');
  const reason = rejections(res)[0].reason;
  assert(reason.includes(fs), `de weigering noemt de botsende relatie: ${reason}`);
  assertEq(store.getState().sequences.length, 2, 'er zijn nog steeds twee relaties');
});

test('duplicaat BINNEN dezelfde call ⇒ het tweede item wordt geweigerd', async () => {
  store.getState().newProject();
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  // A/B zijn bladtaken zonder kinderen, deze relaties worden nooit geweigerd (zie addSeq).
  const ss = addSeq({ predecessorId: a, successorId: b, type: 'START_START', lagDays: 0 });
  const ff = addSeq({ predecessorId: a, successorId: b, type: 'FINISH_FINISH', lagDays: 0 });
  const res = await call('planner_update_dependencies', {
    updates: [{ seqId: ss, type: 'SF' }, { seqId: ff, type: 'SF' }],
  });
  assertEq(okData(res).updated.length, 1, 'alleen het eerste item landde');
  assertEq(seqById(ss).type, 'START_FINISH', 'het eerste item is toegepast');
  assertEq(seqById(ff).type, 'FINISH_FINISH', 'het tweede item is geweigerd, niet stil toegepast');
  assert(rejections(res)[0].reason.includes(ss), `de weigering noemt de botsing: ${rejections(res)[0].reason}`);
});

// =================================================================================================
// 6) kring ⇒ harde fout + volledige rollback
// =================================================================================================
test('kringverwijzing via een verlegd eindpunt ⇒ CYCLE + byte-identieke rollback', async () => {
  const { a, s2 } = threeChain();
  store.getState().runCPM();
  const before = JSON.stringify(createSnapshot(store.getState()));
  // A→B en B→C bestaan; B→C omleggen naar B→A sluit de kring A→B→A.
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s2, successorId: a }] });
  assert(!res.ok, 'een kring moet een HARDE fout zijn, geen zachte weigering');
  assertEq((res as any).code, 'CYCLE', 'de foutcode is CYCLE');
  // De PRE-CHECK moet hem vangen, niet pas de eind-runCPM: alleen dan is de melding Nederlands én
  // noemt hij de betrokken taken. (Zonder pre-check komt de kale solver-string "Circular dependency
  // detected: …" door — óók CYCLE, maar veel minder bruikbaar. Deze assert is precies dat verschil.)
  const err = (res as any).error as string;
  assert(/kringverwijzing gedetecteerd/.test(err), `de pre-check levert de precieze melding: ${err}`);
  assert(err.includes(a), `de melding noemt de betrokken taken: ${err}`);
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'de store is byte-identiek teruggerold');
});

test('kring: ook de GELDIGE items uit dezelfde call worden teruggerold', async () => {
  const { a, s1, s2 } = threeChain();
  store.getState().runCPM();
  const res = await call('planner_update_dependencies', {
    updates: [{ seqId: s1, lag: 5 }, { seqId: s2, successorId: a }],
  });
  assert(!res.ok, 'de call faalt hard');
  assertEq(seqById(s1).lagDays, 0, 'de lag-wijziging van het geldige item is teruggedraaid');
});

// =================================================================================================
// 7) eindpunt verleggen (het geval waarvoor remove+add de enige route was)
// =================================================================================================
test('eindpunt verleggen: de relatie hangt daarna ECHT aan de andere taak, id blijft gelijk', async () => {
  const { a, c, s1 } = threeChain();
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, successorId: c }] });
  const data = okData(res);
  assertEq(seqById(s1).predecessorId, a, 'de voorganger is ongemoeid');
  assertEq(seqById(s1).successorId, c, 'de opvolger is verlegd');
  assertEq(data.updated[0].changes.successorId.to, c, 'het VOOR/NA-verschil noemt de nieuwe opvolger');
  assert(Array.isArray(data.tasks) && data.tasks.length >= 1, 'de herrekende datums van de geraakte taken komen mee');
  assert(typeof data.projectEnd === 'string' && data.projectEnd.length > 0, 'projectEnd gevuld');
});

// =================================================================================================
// 8) de planning beweegt echt mee (geen `ok` zonder gevolg)
// =================================================================================================
test('een lag-wijziging verschuift de opvolger ECHT (de eind-runCPM draait)', async () => {
  const { b, s1 } = threeChain();
  store.getState().runCPM();
  const startBefore = store.getState().tasks.find((t) => t.id === b)!.time.earlyStart;
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: 5 }] });
  okData(res);
  const startAfter = store.getState().tasks.find((t) => t.id === b)!.time.earlyStart;
  assert(startAfter > startBefore, `de opvolger schuift op: ${startBefore} ⇒ ${startAfter}`);
  const row = okData(res).tasks.find((t: any) => t.id === b);
  assertEq(row.earlyStart, startAfter, 'de gerapporteerde datum komt uit de herrekende store');
});

// =================================================================================================
// 9) de schemapoort — los én binnen planner_batch (de batch-stap omzeilt de dispatcher)
// =================================================================================================
async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 300)}`);
  return msg.result;
}

test('schemapoort: een onbekende TOP-level sleutel wordt door de dispatcher geweigerd', async () => {
  threeChain();
  const res = await rpc('planner_update_dependencies', { updaties: [] });
  assertEq(res.isError, true, 'de call moet falen');
  assertEq(res.structuredContent.code, 'VALIDATION', 'foutcode VALIDATION');
});

test('schemapoort: een lege `updates`-array wordt geweigerd (minItems)', async () => {
  threeChain();
  const res = await rpc('planner_update_dependencies', { updates: [] });
  assertEq(res.isError, true, 'de call moet falen');
});

test('batch: update_dependencies draait als STAP en landt in de store', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_batch', {
    steps: [
      { tool: 'planner_update_dependencies', args: { updates: [{ seqId: s1, type: 'SS', lag: '+2d' }] } },
    ],
  });
  const data = okData(res);
  assertEq(data.steps[0].status, 'uitgevoerd', 'de stap is uitgevoerd');
  assertEq(seqById(s1).type, 'START_START', 'het type landde via de batch');
  assertEq(seqById(s1).lagDays, 2, 'de lag landde via de batch');
});

test('batch: zachte weigeringen blijven ZACHT (de batch loopt door)', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_batch', {
    steps: [
      { tool: 'planner_update_dependencies', args: { updates: [{ seqId: 'nope', type: 'SS' }, { seqId: s1, lag: 3 }] } },
    ],
  });
  const data = okData(res);
  assertEq(data.steps[0].status, 'uitgevoerd', 'de stap is uitgevoerd ondanks de rotte regel');
  assertEq(seqById(s1).lagDays, 3, 'het geldige item landde');
  assert(data.rejections.some((r: any) => r.id === 'nope'), `de weigering komt bovenaan de batch: ${JSON.stringify(data.rejections)}`);
});

test('batch: een KRING in de stap rolt de HELE batch terug', async () => {
  const { a, s2 } = threeChain();
  store.getState().runCPM();
  const before = JSON.stringify(createSnapshot(store.getState()));
  const res = await call('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: a, fields: { name: 'mag-niet-blijven' } }] } },
      { tool: 'planner_update_dependencies', args: { updates: [{ seqId: s2, successorId: a }] } },
    ],
  });
  assert(!res.ok, 'de batch faalt hard');
  assertEq((res as any).code, 'CYCLE', 'de CYCLE-code overleeft de rollback');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'de store is byte-identiek teruggerold');
});

test('batch: de schemapoort geldt óók binnen een stap (geen omweg via een draaiboek)', async () => {
  threeChain();
  const res = await call('planner_batch', {
    steps: [{ tool: 'planner_update_dependencies', args: { updaties: [] } }],
  });
  assert(!res.ok, 'een schema-ongeldige stap is een structurele stapfout');
  assertEq((res as any).code, 'VALIDATION', 'foutcode VALIDATION');
});

test('batch: een onbekend VELD blijft ook binnen een stap een zachte weigering die de sleutel noemt', async () => {
  const { s1 } = threeChain();
  const res = await call('planner_batch', {
    steps: [{ tool: 'planner_update_dependencies', args: { updates: [{ seqId: s1, lagUnit: 'ELAPSEDTIME' }] } }],
  });
  const data = okData(res);
  assertEq(data.steps[0].status, 'uitgevoerd', 'de stap loopt door (zachte weigering)');
  assert(
    data.rejections.some((r: any) => r.reason.includes('`lagUnit`')),
    `de weigering noemt de sleutel: ${JSON.stringify(data.rejections)}`,
  );
});

// =================================================================================================
// 10) één tool-call = één undo-stap
// =================================================================================================
test('één call = één undo-stap; undo herstelt de oude relatie exact', async () => {
  const { s1 } = threeChain();
  store.getState().runCPM();
  const undoBefore = store.getState().undoStack.length;
  await call('planner_update_dependencies', { updates: [{ seqId: s1, type: 'SS', lag: '+3d' }] });
  assertEq(store.getState().undoStack.length, undoBefore + 1, 'precies één undo-stap');
  store.getState().undo();
  assertEq(seqById(s1).type, 'FINISH_START', 'undo herstelt het type');
  assertEq(seqById(s1).lagDays, 0, 'undo herstelt de lag');
});

// =================================================================================================
// 11) planner_add_dependencies: verzameltaak-eindpunt toegestaan sinds 2026-08-15; alleen een
//     voorouder-relatie (een taak gekoppeld aan zijn eigen (voor)ouder-samenvatting) wordt geweigerd
// =================================================================================================
test('add_dependencies: verzameltaak-eindpunt toegestaan; alleen een voorouder-relatie wordt geweigerd (mijlpaal blijft toegestaan)', async () => {
  store.getState().newProject();
  const fase = store.getState().addTask({ name: 'Fase' });
  const kind = store.getState().addTask({ name: 'Kind', parentId: fase }); // maakt Fase een verzameltaak
  const los = store.getState().addTask({ name: 'Los' });
  const mp = store.getState().addTask({ name: 'MP', isMilestone: true });
  assert(
    store.getState().tasks.find((t) => t.id === fase)!.childIds.length > 0,
    'voorwaarde: Fase is echt een verzameltaak (heeft een kind)',
  );

  const res = await call('planner_add_dependencies', {
    dependencies: [
      { predecessorId: fase, successorId: los, type: 'FINISH_START' }, // verzameltaak-eindpunt ⇒ toegestaan sinds 2026-08-15
      { predecessorId: mp, successorId: los, type: 'FINISH_START' }, // mijlpaal ⇒ toegestaan (regressie-anker, ongewijzigd)
      { predecessorId: kind, successorId: fase, type: 'FINISH_START' }, // voorouder-relatie ⇒ geweigerd
    ],
  });
  const data = okData(res);

  // Mutatiebewijs (uitgevoerd): met de VORIGE `classifyDeps` (die `hasSummaryEndpoint` nog als
  // blokkerende voorwaarde had, vóór het eigenaarsbesluit van 2026-08-15) gaf dit `added.length`
  // 1 (alleen MP→Los) i.p.v. 2, met Fase→Los als extra weigering — het exacte tegenovergestelde.
  assertEq(data.added.length, 2, 'exact twee relaties toegevoegd (Fase→Los en MP→Los)');
  const addedSeqs = data.added.map((id: string) => seqById(id));
  assert(
    addedSeqs.some((s: Sequence) => s.predecessorId === fase && s.successorId === los),
    'Fase→Los is echt aangemaakt (verzameltaak-eindpunt, sinds 2026-08-15 toegestaan)',
  );
  assert(
    addedSeqs.some((s: Sequence) => s.predecessorId === mp && s.successorId === los),
    'MP→Los is echt aangemaakt (mijlpaal-anker, ongewijzigd)',
  );

  const rej = rejections(res);
  assertEq(rej.length, 1, 'precies één zachte weigering');
  assertEq(rej[0].id, `${kind}->${fase}`, 'de weigering noemt Kind→Fase (de voorouder-relatie)');
  assert(/voorouder/.test(rej[0].reason), `de reden noemt "voorouder": ${rej[0].reason}`);

  // Een weigering schrijft ook echt niets: geen Kind→Fase-relatie in de store.
  assert(
    !store.getState().sequences.some((s) => s.predecessorId === kind && s.successorId === fase),
    'er staat geen Kind→Fase-relatie in de store',
  );
});

// =================================================================================================
// 12) planner_update_dependencies: verzameltaak-eindpunt toegestaan bij het VERHANGEN van een
//     relatie sinds 2026-08-15; alleen het verhangen NAAR de eigen (voor)ouder-samenvatting wordt
//     nog geweigerd. Dit pad schrijft seq.predecessorId/successorId rechtstreeks op de draft en gaat
//     dus langs addSequence heen — anders dan bij het aanmaken zit er hier GEEN tweede laag onder,
//     dus dit is de enige plek waar het kan worden tegengehouden.
// =================================================================================================
test('update_dependencies: voorganger verhangen naar een verzameltaak slaagt sinds 2026-08-15', async () => {
  store.getState().newProject();
  const fase = store.getState().addTask({ name: 'Fase' });
  store.getState().addTask({ name: 'Kind', parentId: fase }); // maakt Fase een verzameltaak
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  const s1 = addSeq({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });

  // Mutatiebewijs (uitgevoerd): met de VORIGE `classifyDepUpdates` (die `isSummaryTask` nog als
  // blokkerende voorwaarde had) gaf dit `updated: []` met een weigering die "verzameltaak" noemde.
  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, predecessorId: fase }] });
  const data = okData(res);
  assertEq(data.updated.length, 1, 'de wijziging naar de verzameltaak slaagt');
  assertEq(seqById(s1).predecessorId, fase, 'de voorganger hangt nu echt aan de verzameltaak');
});

test('update_dependencies: opvolger verhangen naar een verzameltaak slaagt sinds 2026-08-15', async () => {
  store.getState().newProject();
  const fase = store.getState().addTask({ name: 'Fase' });
  store.getState().addTask({ name: 'Kind', parentId: fase }); // maakt Fase een verzameltaak
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  const s1 = addSeq({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });

  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, successorId: fase }] });
  const data = okData(res);
  assertEq(data.updated.length, 1, 'de wijziging naar de verzameltaak slaagt');
  assertEq(seqById(s1).successorId, fase, 'de opvolger hangt nu echt aan de verzameltaak');
});

test('update_dependencies: opvolger verhangen naar de EIGEN (voor)ouder-samenvatting wordt zacht geweigerd, relatie ongemoeid', async () => {
  store.getState().newProject();
  const fase = store.getState().addTask({ name: 'Fase' });
  const kind = store.getState().addTask({ name: 'Kind', parentId: fase });
  const los = store.getState().addTask({ name: 'Los' });
  const s1 = addSeq({ predecessorId: kind, successorId: los, type: 'FINISH_START', lagDays: 0 });

  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, successorId: fase }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  const reason = rejections(res)[0].reason;
  assert(/voorouder/.test(reason), `de reden noemt "voorouder": ${reason}`);
  assertEq(seqById(s1).predecessorId, kind, 'de voorganger is ongemoeid');
  assertEq(seqById(s1).successorId, los, 'de opvolger is ongemoeid');
});

test('update_dependencies: voorganger verhangen naar de EIGEN (voor)ouder-samenvatting wordt zacht geweigerd, relatie ongemoeid', async () => {
  store.getState().newProject();
  const fase = store.getState().addTask({ name: 'Fase' });
  const kind = store.getState().addTask({ name: 'Kind', parentId: fase });
  const los = store.getState().addTask({ name: 'Los' });
  const s1 = addSeq({ predecessorId: los, successorId: kind, type: 'FINISH_START', lagDays: 0 });

  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, predecessorId: fase }] });
  assertEq(okData(res).updated, [], 'niets gewijzigd');
  const reason = rejections(res)[0].reason;
  assert(/voorouder/.test(reason), `de reden noemt "voorouder": ${reason}`);
  assertEq(seqById(s1).predecessorId, los, 'de voorganger is ongemoeid');
  assertEq(seqById(s1).successorId, kind, 'de opvolger is ongemoeid');
});

test('update_dependencies: opvolger verhangen naar een MIJLPAAL slaagt (regressie-anker, ongewijzigd)', async () => {
  store.getState().newProject();
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  const mp = store.getState().addTask({ name: 'MP', isMilestone: true });
  const s1 = addSeq({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });

  const res = await call('planner_update_dependencies', { updates: [{ seqId: s1, successorId: mp }] });
  const data = okData(res);
  assertEq(data.updated.length, 1, 'de wijziging naar de mijlpaal slaagt');
  assertEq(seqById(s1).successorId, mp, 'de opvolger hangt nu echt aan de mijlpaal');
});

// K5 (reviewbevinding op T4, nog steeds geldig ná 2026-08-15): een BESTAANDE relatie kan een
// voorouder-eindpunt hebben zonder dat deze call dat eindpunt aanraakt — bijvoorbeeld uit een P6-
// import, die zulke relaties wél toestaat. Zo'n relatie moet nog op type/lag te wijzigen zijn: alleen
// een NIEUW eindpunt wordt getoetst, niet een bestaand (spec §5: bestaande exemplaren blijven
// behouden én beheersbaar). De relatie hieronder is een ECHTE voorouder-relatie (Kind→Fase, Fase is
// de eigen ouder van Kind) — die kan niet via `addSequence`/`addSeq` ontstaan (die weigert 'm meteen),
// dus rechtstreeks in de store gezet, zoals een import dat ook zou doen.
test('update_dependencies: alleen type/lag wijzigen op een relatie met een BESTAAND voorouder-eindpunt slaagt', async () => {
  store.getState().newProject();
  const fase = store.getState().addTask({ name: 'Fase' });
  const kind = store.getState().addTask({ name: 'Kind', parentId: fase });
  const s1 = 'seq-existing-ancestor';
  store.setState((s) => {
    s.sequences.push({ id: s1, predecessorId: kind, successorId: fase, type: 'FINISH_START', lagDays: 0 });
  });
  assert(
    store.getState().sequences.some((s) => s.id === s1 && s.predecessorId === kind && s.successorId === fase),
    'voorwaarde: de bestaande voorouder-relatie staat in de store',
  );

  const resType = await call('planner_update_dependencies', { updates: [{ seqId: s1, type: 'SS' }] });
  const dataType = okData(resType);
  assertEq(dataType.updated.length, 1, 'type-only wijziging slaagt ondanks het bestaande voorouder-eindpunt');
  assertEq(seqById(s1).type, 'START_START', 'het type is echt gewijzigd');
  assertEq(seqById(s1).predecessorId, kind, 'de voorganger is ongemoeid (nog steeds de voorouder-relatie)');
  assertEq(seqById(s1).successorId, fase, 'de opvolger is ongemoeid (nog steeds de voorouder-relatie)');

  const resLag = await call('planner_update_dependencies', { updates: [{ seqId: s1, lag: 2 }] });
  const dataLag = okData(resLag);
  assertEq(dataLag.updated.length, 1, 'lag-only wijziging slaagt ondanks het bestaande voorouder-eindpunt');
  assertEq(seqById(s1).lagDays, 2, 'de lag is echt gewijzigd');
});

await run();
