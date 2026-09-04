// WP0 / taak T1 — `runInMcpTransaction` + beginUndoable-suppressie + rollback.
// Draait headless tegen de ECHTE Zustand-store (via de harness) — geen mock. Bewijst de vijf
// invarianten uit de spec (§Werkpakket 0): één snapshot per transactie, atomische rollback bij
// throw én bij cpmResult.error, coalesce-reset ná afloop, en runCPM dat binnen het venster géén
// undo-snapshot pusht.
import { useAppStore, test, assert, assertEq, run } from './harness';
import { runInMcpTransaction } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

const store = useAppStore;

// Warm-up: breng de kalender-bibliotheek in de restore-steady-state. Het rollback-primitief
// `restoreSnapshot` (én undo/redo) promoot de projectkalender-cache tot bibliotheek-entry wanneer die
// nog ontbreekt (syncProjectCalendar, §9.1). Een verse store heeft `calendars: []`; door hier één
// edit te undo'en staat de projectkalender al in de bibliotheek, zodat de rollback-tests hieronder de
// (benigne, undo-identieke) kalender-promotie niet als "store-verschil" waarnemen.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// 1) Twee mutaties binnen één transactie ⇒ undoStack groeit met exact 1.
test('twee mutaties in één transactie ⇒ undoStack +1', () => {
  const id = store.getState().addTask({ name: 'trans-1' });
  const before = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => {
    store.getState().updateTask(id, { name: 'een' });
    store.getState().updateTask(id, { name: 'twee' });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, before + 1, 'undoStack moet met exact 1 groeien (één snapshot voor de hele transactie)');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.name, 'twee', 'beide mutaties horen toegepast te zijn (laatste wint)');
});

// 2) Exception in de callback ⇒ store-inhoud gelijk aan vóór de transactie én undoStack ongewijzigd.
test('exception in callback ⇒ volledige rollback', () => {
  const id = store.getState().addTask({ name: 'trans-2' });
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const beforeLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => {
    store.getState().updateTask(id, { name: 'zou-verdwijnen' });
    throw new Error('boem');
  });

  assert(!res.ok, 'transactie hoort te falen');
  assertEq(
    JSON.stringify(createSnapshot(store.getState())),
    beforeSnap,
    'store-inhoud moet identiek zijn aan vóór de transactie',
  );
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeLen, 'undoStack mag niet gewijzigd zijn na rollback');
});

// 3) Ná een geslaagde transactie is de coalesce-marker gereset én de suppressie-vlag uit: een
//    volgende keyed mutatie pusht zijn EIGEN snapshot (stack +1) i.p.v. te coalescen of onderdrukt
//    te worden.
test('na geslaagde transactie pusht een keyed mutatie een eigen snapshot', () => {
  const id = store.getState().addTask({ name: 'trans-3' });

  const res = runInMcpTransaction(() => {
    store.getState().updateTask(id, { name: 'binnen' });
  });
  assert(res.ok, 'transactie hoort te slagen');

  const afterTx = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  store.getState().updateTask(id, { name: 'erna' }, { coalesceKey: 'x' });
  assertEq(
    store.getState().historyEvents.filter(event => event.state === 'applied').length,
    afterTx + 1,
    'keyed mutatie na de transactie hoort een eigen snapshot te pushen (geen coalesce, geen suppressie)',
  );
});

// 4) runCPM binnen het transactievenster pusht geen undo-snapshot (invariant a). De transactie
//    neemt zelf precies één snapshot; een runCPM in de callback (plus de eind-runCPM) voegt niets toe.
test('runCPM binnen transactie pusht geen snapshot (invariant a)', () => {
  store.getState().addTask({ name: 'trans-4' });
  const before = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => {
    store.getState().runCPM();
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(
    store.getState().historyEvents.filter(event => event.state === 'applied').length,
    before + 1,
    'alleen de transactie-snapshot; runCPM (in callback én aan het eind) pusht niets',
  );
});

// 5) Transactie waarvan de eind-runCPM een cpmResult.error oplevert (kringverwijzing) ⇒ volledige
//    rollback: store gelijk aan vóór, undoStack ongewijzigd, en cpmResult terug op de pre-transactie-waarde.
test('cpmResult.error na de eind-runCPM ⇒ volledige rollback incl. cpmResult', () => {
  const a = store.getState().addTask({ name: 'trans-5-A' });
  const b = store.getState().addTask({ name: 'trans-5-B' });
  // Schone uitgangsplanning zodat cpmResult een geldige (niet-error) waarde heeft om naar terug te rollen.
  store.getState().runCPM();
  store.getState().recomputeViewRows();
  store.getState().recomputeResourceLoad();
  store.setState((s) => { s.isDirty = false; });

  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const beforeLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const notificationsBefore = JSON.stringify(store.getState().ui.notifications);
  const beforeCpmError = store.getState().cpmResult?.error ?? null;
  const beforeViewRows = JSON.stringify(store.getState().viewRows);
  const beforeResourceLoad = JSON.stringify(store.getState().resourceLoadResult);
  assert(beforeCpmError == null, 'voorwaarde: cpmResult mag vóór de transactie geen error dragen');
  assertEq(store.getState().isDirty, false, 'voorwaarde: document is schoon vóór de transactie');

  const res = runInMcpTransaction(() => {
    // Deze taak dwingt ook de afgeleide viewRows naar een tussenstaat die rollback moet opruimen.
    store.getState().addTask({ name: 'trans-5-moet-ook-uit-viewRows' });
    // Directe draft-mutatie: een kring A→B→A dwingt de solver tot cpmResult.error.
    store.setState((s) => {
      s.sequences.push(
        { id: 'cyc-1', predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 },
        { id: 'cyc-2', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 },
      );
    });
  });

  assert(!res.ok, 'transactie hoort te falen op de kringverwijzing');
  assertEq(
    JSON.stringify(createSnapshot(store.getState())),
    beforeSnap,
    'store-inhoud (incl. sequences en cpmResult) moet identiek zijn aan vóór de transactie',
  );
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeLen, 'undoStack mag niet gewijzigd zijn na rollback');
  assertEq(store.getState().cpmResult?.error ?? null, null, 'cpmResult hoort terug op de geldige pre-transactie-waarde te staan (geen error-banner)');
  assertEq(JSON.stringify(store.getState().viewRows), beforeViewRows,
    'rollback herstelt viewRows exact en laat geen rij van de teruggerolde taak achter');
  assertEq(JSON.stringify(store.getState().resourceLoadResult), beforeResourceLoad,
    'rollback herstelt resourceLoadResult exact en laat geen null/tussenresultaat achter');
  assertEq(store.getState().isDirty, false,
    'een geweigerde MCP-transactie maakt een vooraf schoon document niet dirty');
  assertEq(JSON.stringify(store.getState().ui.notifications), notificationsBefore,
    'de tijdelijke solverfoutmelding hoort samen met de mislukte transactie terug te rollen');
});

// 6) Geneste aanroep is verboden: de geneste `runInMcpTransaction` gooit, en die throw laat de
//    buitenste transactie schoon terugrollen — store én stacks onaangeroerd.
test('geneste runInMcpTransaction gooit en laat store/stacks onaangeroerd', () => {
  const id = store.getState().addTask({ name: 'reentr' });
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const beforeLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => {
    store.getState().updateTask(id, { name: 'buiten' });
    // Geneste transactie: weigert (throw). Die throw propageert naar de buitenste `try`.
    runInMcpTransaction(() => {
      store.getState().updateTask(id, { name: 'genest' });
    });
  });

  if (res.ok) {
    assert(false, 'buitenste transactie hoort te falen op de geneste weigering');
    return;
  }
  assert(res.error.includes('herintreedbaar'), 'foutmelding hoort de reentrancy-weigering te noemen');
  assertEq(
    JSON.stringify(createSnapshot(store.getState())),
    beforeSnap,
    'store-inhoud onaangeroerd na de geneste weigering + rollback',
  );
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeLen, 'undoStack onaangeroerd na rollback');
});

// 7) `prevRedo`-herstel: seed een redoStack (mutatie + undo), draai dan een transactie die faalt op
//    een cpm-error, en bewijs dat de redoStack ná rollback identiek is aan vóór.
test('rollback herstelt de redo-stack exact (prevRedo)', () => {
  const a = store.getState().addTask({ name: 'redo-A' });
  const b = store.getState().addTask({ name: 'redo-B' });
  // Seed: een mutatie + undo laat precies één redo-entry achter.
  store.getState().updateTask(a, { name: 'redo-A2' });
  store.getState().undo();
  assert(store.getState().historyEvents.filter(event => event.state === 'undone').length > 0, 'voorwaarde: redoStack mag niet leeg zijn');
  const redoBefore = JSON.stringify(store.getState().historyEvents.filter(event => event.state === 'undone'));
  const undoLenBefore = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => {
    // Kring A→B→A ⇒ de eind-runCPM levert cpmResult.error ⇒ rollback-pad.
    store.setState((s) => {
      s.sequences.push(
        { id: 'redo-cyc-1', predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 },
        { id: 'redo-cyc-2', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 },
      );
    });
  });

  assert(!res.ok, 'transactie hoort te falen op de kringverwijzing');
  assertEq(JSON.stringify(store.getState().historyEvents.filter(event => event.state === 'undone')),
    redoBefore, 'redo-events horen identiek te zijn aan vóór de transactie');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLenBefore, 'undoStack ongewijzigd na rollback');
});

// 8) `resetUndoCoalescing` op het ROLLBACK-pad: ná een gefaalde (teruggerolde) transactie pusht een
//    keyed mutatie een eigen snapshot (bewijst tevens dat de suppressie-vlag via finally uit staat).
test('na een rollback pusht een keyed mutatie een eigen snapshot', () => {
  const id = store.getState().addTask({ name: 'roll-coalesce' });
  const res = runInMcpTransaction(() => {
    throw new Error('faal met opzet');
  });
  assert(!res.ok, 'transactie hoort te falen');

  const afterRollback = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  store.getState().updateTask(id, { name: 'na-rollback' }, { coalesceKey: 'y' });
  assertEq(
    store.getState().historyEvents.filter(event => event.state === 'applied').length,
    afterRollback + 1,
    'keyed mutatie ná rollback hoort een eigen snapshot te pushen (coalesce gereset, suppressie uit)',
  );
});

// 9) De contextfactory bezit state, runtimelease en eindherberekening per AppStoreContext. Deze
//    cases gebruiken bewust géén singletonwrapper: twee gewone Zustandstores zouden zonder de
//    runtimechecks hieronder ten onrechte onafhankelijk kunnen lijken.
function warmContext(context: AppStoreContext): void {
  context.store.getState().addTask({ name: 'factory-warmup' });
  context.store.getState().undo();
}

const stackDepths = (context: AppStoreContext) => ({
  undo: historyDepthsForActiveScope(context.store.getState()).undoDepth,
  redo: historyDepthsForActiveScope(context.store.getState()).redoDepth,
});

test('createMcpTransactions(B): succes muteert en herrekent alleen B met één eigen undo', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  warmContext(A);
  warmContext(B);
  const txB = createMcpTransactions(B);
  const aVoor = JSON.stringify(capturePayload(A.store.getState()));
  const aNotificationsVoor = JSON.stringify(A.store.getState().ui.notifications);
  const bUndoVoor = historyDepthsForActiveScope(B.store.getState()).undoDepth;
  const originalRunCPM = B.store.getState().runCPM;
  let bRunCPMCalls = 0;
  B.store.setState({
    runCPM: () => {
      bRunCPMCalls++;
      originalRunCPM();
    },
  });

  const result = txB.run(() => txB.draft.addTask({ name: 'alleen in factory-B' }));

  assert(result.ok, 'de contextgebonden transactie hoort te slagen');
  assert(result.ok && B.store.getState().tasks.some((task) => task.id === result.value),
    'de generieke returnwaarde hoort het in B aangemaakte taak-id te zijn');
  assertEq(historyDepthsForActiveScope(B.store.getState()).undoDepth, bUndoVoor + 1,
    'factory-B hoort precies één eigen undo-snapshot te maken');
  assertEq(bRunCPMCalls, 1, 'factory-B hoort B precies éénmaal aan het eind te herrekenen');
  assertEq(JSON.stringify(capturePayload(A.store.getState())), aVoor,
    'document A hoort byte-inhoudelijk gelijk te blijven');
  assertEq(JSON.stringify(A.store.getState().ui.notifications), aNotificationsVoor,
    'notificaties van A horen gelijk te blijven');
});

test('createMcpTransactions(B): callbackthrow rolt alleen B volledig terug', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  warmContext(A);
  warmContext(B);
  const txB = createMcpTransactions(B);
  const aVoor = JSON.stringify(capturePayload(A.store.getState()));
  const aNotificationsVoor = JSON.stringify(A.store.getState().ui.notifications);
  const bVoor = JSON.stringify(createSnapshot(B.store.getState()));
  const bStacksVoor = stackDepths(B);

  const result = txB.run(() => {
    txB.draft.addTask({ name: 'verdwijnt uit B' });
    throw new Error('factory-boem');
  });

  assert(!result.ok && result.error === 'factory-boem', 'de callbackthrow hoort als gefaald resultaat terug te komen');
  assertEq(JSON.stringify(createSnapshot(B.store.getState())), bVoor,
    'B hoort na callbackthrow exact naar de beginsnapshot terug te keren');
  assertEq(stackDepths(B), bStacksVoor, 'undo en redo van B horen exact teruggezet te zijn');
  assertEq(JSON.stringify(capturePayload(A.store.getState())), aVoor,
    'callbackrollback in B mag A niet wijzigen');
  assertEq(JSON.stringify(A.store.getState().ui.notifications), aNotificationsVoor,
    'callbackrollback in B mag A-notificaties niet wijzigen');
});

test('nested run op hetzelfde factoryobject propageert en rolt outer B terug; B blijft herbruikbaar', () => {
  const B = createAppStoreContext();
  warmContext(B);
  const txB = createMcpTransactions(B);
  const voor = JSON.stringify(createSnapshot(B.store.getState()));
  const stacksVoor = stackDepths(B);

  const outer = txB.run(() => {
    txB.draft.addTask({ name: 'outer-zelfde-factory' });
    txB.run(() => txB.draft.addTask({ name: 'inner-zelfde-factory' }));
  });

  assert(!outer.ok && /herintreedbaar/i.test(outer.error),
    'de nested enter hoort de outer callback als fout te bereiken');
  assertEq(JSON.stringify(createSnapshot(B.store.getState())), voor,
    'de outer call hoort volledig terug te rollen na de nested weigering');
  assertEq(stackDepths(B), stacksVoor, 'nested weigering mag geen extra undo/redo achterlaten');

  const herstel = txB.run(() => txB.draft.addTask({ name: 'B-na-nested-rollback' }));
  assert(herstel.ok, 'dezelfde factory hoort na rollback opnieuw bruikbaar te zijn');
});

test('tweede factory op dezelfde B-runtime kan reentrancy niet omzeilen', () => {
  const B = createAppStoreContext();
  warmContext(B);
  const txB = createMcpTransactions(B);
  const txB2 = createMcpTransactions(B);
  const voor = JSON.stringify(createSnapshot(B.store.getState()));
  const stacksVoor = stackDepths(B);

  const outer = txB.run(() => {
    txB.draft.addTask({ name: 'outer-eerste-factory' });
    txB2.run(() => txB2.draft.addTask({ name: 'inner-tweede-factory' }));
  });

  assert(!outer.ok && /herintreedbaar/i.test(outer.error),
    'de tweede factory hoort op B\'s actieve runtimelease geweigerd te worden');
  assertEq(JSON.stringify(createSnapshot(B.store.getState())), voor,
    'de weigering via factory twee hoort de outer B-call volledig terug te rollen');
  assertEq(stackDepths(B), stacksVoor,
    'twee factoryobjecten op B mogen geen extra undo/redo produceren');

  const herstel = txB2.run(() => txB2.draft.addTask({ name: 'B2-na-rollback' }));
  assert(herstel.ok, 'factory twee hoort na de gesloten outer lease bruikbaar te zijn');
});

test('synchrone txA.run binnen txB.run is toegestaan en iedere context houdt eigen undo', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  warmContext(A);
  warmContext(B);
  const txA = createMcpTransactions(A);
  const txB = createMcpTransactions(B);
  const aUndoVoor = historyDepthsForActiveScope(A.store.getState()).undoDepth;
  const bUndoVoor = historyDepthsForActiveScope(B.store.getState()).undoDepth;

  const outer = txB.run(() => {
    const bId = txB.draft.addTask({ name: 'B-outer' });
    const inner = txA.run(() => txA.draft.addTask({ name: 'A-inner' }));
    if (!inner.ok) throw new Error(inner.error);
    return { aId: inner.value, bId };
  });

  assert(outer.ok, 'een transactie op A hoort tijdens een actieve B-transactie toegestaan te zijn');
  assert(outer.ok && A.store.getState().tasks.some((task) => task.id === outer.value.aId),
    'de inner returnwaarde hoort naar de taak in A te wijzen');
  assert(outer.ok && B.store.getState().tasks.some((task) => task.id === outer.value.bId),
    'de outer returnwaarde hoort naar de taak in B te wijzen');
  assertEq(historyDepthsForActiveScope(A.store.getState()).undoDepth, aUndoVoor + 1,
    'A krijgt precies één eigen undo');
  assertEq(historyDepthsForActiveScope(B.store.getState()).undoDepth, bUndoVoor + 1,
    'B krijgt precies één eigen undo');
});

test('succes en rollback breken B-coalescing maar laten A-coalescing doorlopen', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  const aId = A.store.getState().addTask({ name: 'A-coalesce-start' });
  const bId = B.store.getState().addTask({ name: 'B-coalesce-start' });
  A.store.setState({ historyEvents: [], nextHistorySequence: 1 });
  B.store.setState({ historyEvents: [], nextHistorySequence: 1 });
  A.runtime.resetUndoCoalescing();
  B.runtime.resetUndoCoalescing();
  for (const name of ['A-1', 'A-2']) A.store.getState().updateTask(aId, { name }, { coalesceKey: 'edit:name' });
  for (const name of ['B-1', 'B-2']) B.store.getState().updateTask(bId, { name }, { coalesceKey: 'edit:name' });
  const txB = createMcpTransactions(B);

  const succes = txB.run(() => txB.draft.updateTaskFields(bId, { description: 'B-succes' }));
  assert(succes.ok, 'voorwaarde: de eerste B-transactie hoort te slagen');
  B.store.getState().updateTask(bId, { name: 'B-na-succes' }, { coalesceKey: 'edit:name' });
  A.store.getState().updateTask(aId, { name: 'A-na-B-succes' }, { coalesceKey: 'edit:name' });
  assertEq(stackDepths(B), { undo: 3, redo: 0 },
    'na B-succes hoort dezelfde key een nieuwe B-snapshot te maken');
  assertEq(stackDepths(A), { undo: 1, redo: 0 },
    'B-succes mag de lopende A-coalescereeks niet breken');

  const bUndoVoorRollback = historyDepthsForActiveScope(B.store.getState()).undoDepth;
  const rollback = txB.run(() => { throw new Error('coalesce-rollback'); });
  assert(!rollback.ok, 'voorwaarde: de tweede B-transactie hoort terug te rollen');
  assertEq(historyDepthsForActiveScope(B.store.getState()).undoDepth, bUndoVoorRollback,
    'de rollback zelf hoort geen B-undo achter te laten');
  B.store.getState().updateTask(bId, { name: 'B-na-rollback' }, { coalesceKey: 'edit:name' });
  A.store.getState().updateTask(aId, { name: 'A-na-B-rollback' }, { coalesceKey: 'edit:name' });
  assertEq(stackDepths(B), { undo: 4, redo: 0 },
    'na B-rollback hoort dezelfde key opnieuw een nieuwe B-snapshot te maken');
  assertEq(stackDepths(A), { undo: 1, redo: 0 },
    'B-rollback mag de lopende A-coalescereeks evenmin breken');
});

await run();
