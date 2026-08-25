// WP0 / taak T1 — `runInMcpTransaction` + beginUndoable-suppressie + rollback.
// Draait headless tegen de ECHTE Zustand-store (via de harness) — geen mock. Bewijst de vijf
// invarianten uit de spec (§Werkpakket 0): één snapshot per transactie, atomische rollback bij
// throw én bij cpmResult.error, coalesce-reset ná afloop, en runCPM dat binnen het venster géén
// undo-snapshot pusht.
import { useAppStore, test, assert, assertEq, run } from './harness';
import { runInMcpTransaction } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';

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

  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const beforeLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const beforeCpmError = store.getState().cpmResult?.error ?? null;
  assert(beforeCpmError == null, 'voorwaarde: cpmResult mag vóór de transactie geen error dragen');

  const res = runInMcpTransaction(() => {
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

await run();
