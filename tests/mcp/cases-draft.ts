// WP0 / taak T2 — draft-primitieven: snapshot-vrije, recompute-vrije mutatoren voor gebruik BINNEN
// `runInMcpTransaction`. Draait headless tegen de ECHTE Zustand-store (via de harness) — geen mock.
// Bewijst per primitief het store-gelijke gedrag ZONDER eigen snapshot/recompute: elke transactie
// levert exact één undo-stap, en de eind-runCPM verwerkt de mutaties precies één keer.
import { useAppStore, test, assert, assertEq, run } from './harness';
import { runInMcpTransaction, draft } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { createAppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { __resetTimephasedLossNoticeForTests } from '@/state/timephasedLossNotice';

const store = useAppStore;

// Warm-up: breng de projectkalender in de bibliotheek (restore-steady-state). Een verse store heeft
// `calendars: []`; het rollback-/restore-pad promoot de projectkalender-cache tot bibliotheek-entry
// (syncProjectCalendar, §9.1). Door hier één edit te undo'en staat `cal-default` al in de bibliotheek,
// zodat de kalender-tests hieronder tegen een bestaande projectkalender-entry werken.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// --- 1) addTask -----------------------------------------------------------------------------------
test('draft.addTask binnen transactie ⇒ undoStack +1, parent.childIds gevuld, correcte parentId', () => {
  const parentId = store.getState().addTask({ name: 'ouder' });
  const before = store.getState().undoStack.length;

  let childId = '';
  const res = runInMcpTransaction(() => {
    childId = draft.addTask({ name: 'kind', parentId });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().undoStack.length, before + 1, 'undoStack moet met exact 1 groeien (één transactie-snapshot)');
  const parent = store.getState().tasks.find((t) => t.id === parentId);
  assert(!!parent && parent.childIds.includes(childId), 'parent.childIds hoort de nieuwe taak te bevatten');
  const child = store.getState().tasks.find((t) => t.id === childId);
  assertEq(child?.parentId, parentId, 'de nieuwe taak hoort de juiste parentId te dragen');
});

test('draft.addTask onbekende parentId ⇒ transactie faalt schoon (geen halve mutatie)', () => {
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const beforeLen = store.getState().undoStack.length;

  const res = runInMcpTransaction(() => {
    draft.addTask({ name: 'wees', parentId: 'bestaat-niet' });
  });

  assert(!res.ok, 'transactie hoort te falen op de onbekende parentId');
  assert(!res.ok && res.error.toLowerCase().includes('parent'), 'foutmelding hoort de onbekende parent te noemen');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'store-inhoud onaangeroerd na de schone rollback');
  assertEq(store.getState().undoStack.length, beforeLen, 'undoStack onaangeroerd na rollback');
  assert(!store.getState().tasks.some((t) => t.name === 'wees'), 'de weestaak mag niet zijn aangemaakt');
});

test('draft.addTask mijlpaal ⇒ duur 0, gewone taak ⇒ default 5', () => {
  let msId = '';
  let normalId = '';
  const res = runInMcpTransaction(() => {
    msId = draft.addTask({ name: 'mijlpaal', isMilestone: true });
    normalId = draft.addTask({ name: 'gewoon' });
  });
  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().tasks.find((t) => t.id === msId)?.time.scheduleDuration, 0, 'mijlpaal hoort duur 0 te krijgen');
  assertEq(store.getState().tasks.find((t) => t.id === normalId)?.time.scheduleDuration, 5, 'gewone taak hoort default-duur 5 te krijgen');
});

test('draft.addTask erft taskType van de ouder wanneer de aanroeper er zelf geen opgeeft', () => {
  const parentId = store.getState().addTask({ name: 'mcp-ouder', taskType: 'LOGISTIC' });

  let childId = '';
  const res = runInMcpTransaction(() => {
    childId = draft.addTask({ name: 'mcp-kind', parentId });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().tasks.find((t) => t.id === childId)?.taskType, 'LOGISTIC', 'kind hoort taskType van de ouder over te nemen');
});

test('draft.addTask: expliciete taskType wint van de ouder', () => {
  const parentId = store.getState().addTask({ name: 'mcp-ouder-2', taskType: 'LOGISTIC' });

  let childId = '';
  const res = runInMcpTransaction(() => {
    childId = draft.addTask({ name: 'mcp-kind-2', parentId, taskType: 'DEMOLITION' });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().tasks.find((t) => t.id === childId)?.taskType, 'DEMOLITION', 'expliciete taskType hoort te winnen van de ouder');
});

// --- 2) addSequence -------------------------------------------------------------------------------
test('draft.addSequence dedupt op (pred, succ, type)', () => {
  const a = store.getState().addTask({ name: 'seq-a' });
  const b = store.getState().addTask({ name: 'seq-b' });

  let first: string | null = null;
  let second: string | null = 'nog-niet-gezet';
  const res = runInMcpTransaction(() => {
    first = draft.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    second = draft.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assert(first !== null, 'eerste relatie hoort te worden aangemaakt (id terug)');
  assertEq(second, null, 'exact duplicaat hoort null terug te geven (dedup)');
  const count = store.getState().sequences.filter(
    (s) => s.predecessorId === a && s.successorId === b && s.type === 'FINISH_START',
  ).length;
  assertEq(count, 1, 'er hoort precies één FS-relatie tussen a en b te bestaan');
});

// --- 3) updateTaskFields --------------------------------------------------------------------------
test('draft.updateTaskFields voert een kale veld-merge uit', () => {
  const id = store.getState().addTask({ name: 'merge-oud' });
  const before = store.getState().undoStack.length;

  const res = runInMcpTransaction(() => {
    draft.updateTaskFields(id, { name: 'merge-nieuw', description: 'beschrijving' });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().undoStack.length, before + 1, 'één transactie-snapshot');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.name, 'merge-nieuw', 'naam hoort gemerged te zijn');
  assertEq(t?.description, 'beschrijving', 'beschrijving hoort gemerged te zijn');
});

// --- 4) deleteTask --------------------------------------------------------------------------------
test('draft.deleteTask ruimt relaties, assignments en parent.childIds op', () => {
  const parentId = store.getState().addTask({ name: 'del-parent' });
  const childId = store.getState().addTask({ name: 'del-child', parentId });
  const otherId = store.getState().addTask({ name: 'del-other' });
  const seqId = store.getState().addSequence({ predecessorId: childId, successorId: otherId, type: 'FINISH_START', lagDays: 0 });
  const resId = store.getState().addResource({ name: 'del-res', type: 'LABOR', description: '', maxUnits: 1 });
  store.getState().assignResource(childId, resId, 1);

  const before = store.getState().undoStack.length;
  const res = runInMcpTransaction(() => {
    draft.deleteTask(childId);
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().undoStack.length, before + 1, 'één transactie-snapshot');
  assert(!store.getState().tasks.some((t) => t.id === childId), 'de taak hoort verwijderd te zijn');
  const parent = store.getState().tasks.find((t) => t.id === parentId);
  assert(!!parent && !parent.childIds.includes(childId), 'parent.childIds hoort de verwijzing kwijt te zijn');
  assert(!store.getState().sequences.some((s) => s.id === seqId), 'relaties naar de taak horen opgeruimd te zijn');
  assert(!store.getState().assignments.some((a) => a.taskId === childId), 'assignments op de taak horen opgeruimd te zijn');
});

// --- 5) addCalendar / updateCalendar (projectkalender-cache-sync, §9.1) ----------------------------
test('draft.addCalendar voegt toe, draft.updateCalendar synct de projectkalender-cache', () => {
  // Voorwaarde: de projectkalender staat in de bibliotheek (warm-up hierboven).
  const projCalId = store.getState().project.calendarId;
  assert(store.getState().calendars.some((c) => c.id === projCalId), 'voorwaarde: projectkalender staat in de bibliotheek');

  const beforeCount = store.getState().calendars.length;
  let newCalId = '';
  const res1 = runInMcpTransaction(() => {
    newCalId = draft.addCalendar({ ...store.getState().calendar, name: 'Extra kalender' });
  });
  assert(res1.ok, 'addCalendar-transactie hoort te slagen');
  assertEq(store.getState().calendars.length, beforeCount + 1, 'de bibliotheek hoort met 1 te groeien');
  // De teruggegeven id moet ook echt de nieuwe entry aanwijzen (stond wel in een variabele, maar
  // werd nergens gecontroleerd).
  assertEq(store.getState().calendars.find((c) => c.id === newCalId)?.name, 'Extra kalender', 'de teruggegeven id hoort de nieuwe bibliotheek-entry aan te wijzen');
  // s.calendar blijft de cache van de projectkalender (die is niet gewijzigd).
  const projEntryA = store.getState().calendars.find((c) => c.id === projCalId);
  assertEq(JSON.stringify(store.getState().calendar), JSON.stringify(projEntryA), 's.calendar hoort consistent met de projectkalender-entry te blijven');

  // Wijzig de PROJECTkalender via bibliotheek-id ⇒ syncProjectCalendar hoort de cache mee te trekken.
  const res2 = runInMcpTransaction(() => {
    draft.updateCalendar(projCalId, { name: 'Projectkalender gewijzigd' });
  });
  assert(res2.ok, 'updateCalendar-transactie hoort te slagen');
  const projEntryB = store.getState().calendars.find((c) => c.id === projCalId);
  assertEq(projEntryB?.name, 'Projectkalender gewijzigd', 'de bibliotheek-entry hoort de nieuwe naam te dragen');
  assertEq(store.getState().calendar.name, 'Projectkalender gewijzigd', 's.calendar-cache hoort meegetrokken te zijn (§9.1)');
  assertEq(JSON.stringify(store.getState().calendar), JSON.stringify(projEntryB), 's.calendar hoort exact gelijk aan de bibliotheek-entry te zijn');
});

// --- 6) assignment-kwartet ------------------------------------------------------------------------
test('draft assignment-kwartet: assign/update/move/unassign met store-gelijke semantiek', () => {
  const t1 = store.getState().addTask({ name: 'asn-t1' });
  const t2 = store.getState().addTask({ name: 'asn-t2' });
  const resId = store.getState().addResource({ name: 'asn-res', type: 'LABOR', description: '', maxUnits: 1 });

  // assign
  let aid = '';
  const r1 = runInMcpTransaction(() => { aid = draft.assignResource(t1, resId, 1); });
  assert(r1.ok, 'assign-transactie hoort te slagen');
  let asn = store.getState().assignments.find((a) => a.id === aid);
  assertEq(asn?.taskId, t1, 'toewijzing hoort op t1 te staan');
  assert(store.getState().tasks.find((t) => t.id === t1)!.resourceIds.includes(resId), 't1.resourceIds hoort de resource te bevatten');

  // assign op een mijlpaal ⇒ fout (store no-op → hier throw ⇒ transactie faalt schoon)
  const ms = store.getState().addTask({ name: 'asn-ms', isMilestone: true });
  const rBad = runInMcpTransaction(() => { draft.assignResource(ms, resId, 1); });
  assert(!rBad.ok, 'toewijzen aan een mijlpaal hoort de transactie te laten falen');

  // update units
  const r2 = runInMcpTransaction(() => { draft.updateAssignment(aid, { unitsPerDay: 2 }); });
  assert(r2.ok, 'update-transactie hoort te slagen');
  asn = store.getState().assignments.find((a) => a.id === aid);
  assertEq(asn?.unitsPerDay, 2, 'eenheden/dag horen bijgewerkt te zijn');

  // move naar t2
  const r3 = runInMcpTransaction(() => { draft.moveAssignment(aid, t2); });
  assert(r3.ok, 'move-transactie hoort te slagen');
  asn = store.getState().assignments.find((a) => a.id === aid);
  assertEq(asn?.taskId, t2, 'toewijzing hoort verplaatst naar t2');
  assert(store.getState().tasks.find((t) => t.id === t2)!.resourceIds.includes(resId), 't2.resourceIds hoort de resource te bevatten');
  assert(!store.getState().tasks.find((t) => t.id === t1)!.resourceIds.includes(resId), 't1.resourceIds hoort de resource kwijt te zijn');

  // unassign
  const r4 = runInMcpTransaction(() => { draft.unassignResource(aid); });
  assert(r4.ok, 'unassign-transactie hoort te slagen');
  assert(!store.getState().assignments.some((a) => a.id === aid), 'toewijzing hoort verwijderd te zijn');
  assert(!store.getState().tasks.find((t) => t.id === t2)!.resourceIds.includes(resId), 't2.resourceIds hoort de resource kwijt te zijn');
});

// --- 7) applyLeveling / clearLeveling -------------------------------------------------------------
test('draft.applyLeveling zet delays; de eind-runCPM verwerkt ze precies één keer', () => {
  const id = store.getState().addTask({ name: 'lvl-task' });
  // Baseline zonder delay: de earlyStart-anker vastleggen.
  store.getState().runCPM();
  const baseStart = store.getState().tasks.find((t) => t.id === id)!.time.earlyStart;

  const before = store.getState().undoStack.length;
  const res = runInMcpTransaction(() => {
    draft.applyLeveling({
      delays: { [id]: 3 },
      unresolved: {}, unresolvedReasons: {}, shifts: {},
      projectEndBefore: '', projectEndAfter: '',
    });
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().undoStack.length, before + 1, 'één transactie-snapshot (geen dubbele undo-stap)');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.levelingDelay, 3, 'levelingDelay hoort gezet te zijn');
  assert(!store.getState().cpmResult?.error, 'cpmResult hoort geldig (geen error) te zijn na de eind-runCPM');
  assert(!store.getState().scheduleStale, 'de eind-runCPM hoort scheduleStale te wissen (schema is vers)');
  assert((t?.time.earlyStart ?? '') > baseStart, 'de delay hoort door de eind-runCPM verwerkt te zijn (earlyStart schuift op)');

  // clearLeveling ⇒ delay weg, earlyStart terug op de baseline.
  const res2 = runInMcpTransaction(() => { draft.clearLeveling(); });
  assert(res2.ok, 'clear-transactie hoort te slagen');
  const t2 = store.getState().tasks.find((x) => x.id === id);
  assertEq(t2?.levelingDelay, undefined, 'levelingDelay hoort gewist te zijn');
  assertEq(t2?.time.earlyStart, baseStart, 'earlyStart hoort terug op de baseline te staan');
});

// --- Contextfactory: draft hoort bij precies één actieve run --------------------------------------
test('contextdraft buiten zijn eigen actieve run faalt vóór mutatie', () => {
  const context = createAppStoreContext();
  const tx = createMcpTransactions(context);
  const voor = JSON.stringify(capturePayload(context.store.getState()));
  let fout = '';

  try {
    tx.draft.addTask({ name: 'mag-niet-buiten-run' });
  } catch (error) {
    fout = error instanceof Error ? error.message : String(error);
  }

  assert(/actieve|transactie|run/i.test(fout), 'draft buiten run hoort een herkenbare fout te gooien');
  assertEq(JSON.stringify(capturePayload(context.store.getState())), voor,
    'de weigering hoort vóór iedere statemutatie plaats te vinden');
});

test('draft van factory B schrijft uitsluitend in documentcontext B', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  const txB = createMcpTransactions(B);
  const aVoor = JSON.stringify(capturePayload(A.store.getState()));
  const result = txB.run(() => txB.draft.addTask({ name: 'draft-context-B' }));

  assert(result.ok, 'de B-draft hoort binnen zijn eigen run te slagen');
  assert(B.store.getState().tasks.some((task) => task.name === 'draft-context-B'),
    'de taak hoort in B te staan');
  assertEq(JSON.stringify(capturePayload(A.store.getState())), aVoor,
    'de B-draft mag A niet wijzigen');
});

test('timephased-verliesteller en melding horen uitsluitend bij de actieve B-lease', () => {
  __resetTimephasedLossNoticeForTests();
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  const aId = A.store.getState().addTask({ name: 'timephased-A' });
  const bId = B.store.getState().addTask({ name: 'timephased-B' });
  const windowFields = {
    timephasedFinishFloor: '2026-08-10T17:00',
    timephasedStartAnchor: '2026-08-03T08:00',
    timephasedContours: [{
      resourceUid: 7,
      periods: [{ afterMinutes: 0, minutes: 120, workMinutes: 120, kind: 'actual' as const }],
    }],
  };
  A.store.getState().updateTask(aId, windowFields);
  B.store.getState().updateTask(bId, windowFields);
  A.store.setState((state) => { state.ui.notifications = []; });
  B.store.setState((state) => { state.ui.notifications = []; });
  const aVoor = JSON.stringify(capturePayload(A.store.getState()));
  const txB = createMcpTransactions(B);
  const bTask = B.store.getState().tasks.find((task) => task.id === bId)!;

  const result = txB.run(() => {
    txB.draft.updateTaskFields(bId, {
      time: { ...bTask.time, scheduleDuration: bTask.time.scheduleDuration + 1 },
    });
  });

  assert(result.ok && result.timephasedGuidanceLost === 1,
    'de actieve B-lease hoort precies één verloren taak te tellen');
  assertEq(B.store.getState().ui.notifications.length, 1, 'B hoort precies één verliesmelding te krijgen');
  assertEq(B.store.getState().ui.notifications[0]?.params?.count, 1, 'de B-melding hoort teller 1 te dragen');
  assertEq(A.store.getState().ui.notifications.length, 0, 'A mag geen verliesmelding krijgen');
  assertEq(JSON.stringify(capturePayload(A.store.getState())), aVoor,
    'timephased verlies in B mag document A niet wijzigen');
});

// --- 9) Z14b — edit-time-invalidatie van het GELEZEN Z8-venster (eigenaarsprincipe 2026-08-18) ----
// Gedocumenteerde tweeling van taskSlice.ts's `updateTask`/`setTaskCalendar` (zie
// `taskDefaults.ts`'s `clearTimephasedWindow`/`timeUpdateTouchesTimephasedWindow`): een
// inhoudelijke bewerking (duur/datums/kalender/toewijzingen) wist `timephasedFinishFloor`/
// `timephasedStartAnchor`, maar NOOIT de rauwe bron `timephasedContours`.
const seedWindow = (id: string) => {
  store.getState().updateTask(id, {
    timephasedFinishFloor: '2026-08-10T17:00',
    timephasedStartAnchor: '2026-08-03T08:00',
    timephasedContours: [{ resourceUid: 7, periods: [{ afterMinutes: 0, minutes: 120, workMinutes: 120, kind: 'actual' }] }],
  });
};

test('draft.updateTaskFields: een duur-trigger wist het venster, de rauwe contouren blijven', () => {
  const id = store.getState().addTask({ name: 'z14b-utf', time: createDefaultTaskTime('2026-08-03', 5) });
  seedWindow(id);
  const before = store.getState().tasks.find((t) => t.id === id)!;

  const res = runInMcpTransaction(() => {
    draft.updateTaskFields(id, { time: { ...before.time, scheduleDuration: 8 } });
  });

  assert(res.ok, 'transactie hoort te slagen');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.timephasedFinishFloor, undefined, 'timephasedFinishFloor hoort gewist te zijn');
  assertEq(t?.timephasedStartAnchor, undefined, 'timephasedStartAnchor hoort gewist te zijn');
  assertEq(t?.timephasedContours?.length, 1, 'de rauwe contouren horen te blijven staan (eigenaarsprincipe)');
});

test('draft.updateTaskFields: een niet-trigger-veld (naam) laat het venster ongemoeid', () => {
  const id = store.getState().addTask({ name: 'z14b-utf-neg' });
  seedWindow(id);

  const res = runInMcpTransaction(() => {
    draft.updateTaskFields(id, { name: 'z14b-utf-neg (hernoemd)' });
  });

  assert(res.ok, 'transactie hoort te slagen');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.timephasedFinishFloor, '2026-08-10T17:00', 'timephasedFinishFloor hoort ongemoeid te blijven');
  assertEq(t?.timephasedStartAnchor, '2026-08-03T08:00', 'timephasedStartAnchor hoort ongemoeid te blijven');
});

test('draft.patchTaskFields: een timePatch-duur wist het venster', () => {
  const id = store.getState().addTask({ name: 'z14b-ptf' });
  seedWindow(id);

  const res = runInMcpTransaction(() => {
    draft.patchTaskFields(id, {}, { scheduleDuration: 9 });
  });

  assert(res.ok, 'transactie hoort te slagen');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.timephasedFinishFloor, undefined, 'timephasedFinishFloor hoort gewist te zijn');
  assertEq(t?.timephasedStartAnchor, undefined, 'timephasedStartAnchor hoort gewist te zijn');
  assertEq(t?.timephasedContours?.length, 1, 'de rauwe contouren horen te blijven staan');
});

test('draft.patchTaskFields: een calendarId-top-level-wijziging wist het venster', () => {
  const id = store.getState().addTask({ name: 'z14b-ptf-cal' });
  seedWindow(id);
  let newCalId = '';
  runInMcpTransaction(() => { newCalId = draft.addCalendar({ ...store.getState().calendar, name: 'z14b-ptf-cal-kalender' }); });

  const res = runInMcpTransaction(() => {
    draft.patchTaskFields(id, { calendarId: newCalId });
  });

  assert(res.ok, 'transactie hoort te slagen');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.timephasedFinishFloor, undefined, 'timephasedFinishFloor hoort gewist te zijn');
  assertEq(t?.timephasedStartAnchor, undefined, 'timephasedStartAnchor hoort gewist te zijn');
});

test('draft assignment-kwartet: assign/move/unassign wissen het venster op de betrokken taken', () => {
  const t1 = store.getState().addTask({ name: 'z14b-asn-t1' });
  const t2 = store.getState().addTask({ name: 'z14b-asn-t2' });
  const resId = store.getState().addResource({ name: 'z14b-asn-res', type: 'LABOR', description: '', maxUnits: 1 });
  seedWindow(t1);
  seedWindow(t2);

  // assign op t1 ⇒ t1's venster wist.
  let aid = '';
  runInMcpTransaction(() => { aid = draft.assignResource(t1, resId, 1); });
  let t1After = store.getState().tasks.find((t) => t.id === t1);
  assertEq(t1After?.timephasedFinishFloor, undefined, 'assignResource hoort t1.timephasedFinishFloor te wissen');
  assertEq(t1After?.timephasedContours?.length, 1, 'de rauwe contouren van t1 blijven staan');

  // move naar t2 ⇒ ZOWEL t1 als t2's venster wist (t2 had het nog staan).
  runInMcpTransaction(() => { draft.moveAssignment(aid, t2); });
  let t2After = store.getState().tasks.find((t) => t.id === t2);
  assertEq(t2After?.timephasedFinishFloor, undefined, 'moveAssignment hoort t2.timephasedFinishFloor te wissen');
  assertEq(t2After?.timephasedContours?.length, 1, 'de rauwe contouren van t2 blijven staan');

  // opnieuw seeden en unassign ⇒ venster wist.
  seedWindow(t2);
  runInMcpTransaction(() => { draft.unassignResource(aid); });
  t2After = store.getState().tasks.find((t) => t.id === t2);
  assertEq(t2After?.timephasedFinishFloor, undefined, 'unassignResource hoort t2.timephasedFinishFloor te wissen');
});

// F2 (spec-review-fixronde op 526af9f9): de "toewijzingen"-trigger moet OOK laag 4
// (`timephasedDurationWalks`) wissen — een bevroren import-snapshot per toewijzing dat stale wordt
// zodra de toewijzingenset verandert.
test('draft assignment-kwartet: assign/move/unassign wissen OOK timephasedDurationWalks (F2)', () => {
  const t1 = store.getState().addTask({ name: 'f2-asn-t1' });
  const t2 = store.getState().addTask({ name: 'f2-asn-t2' });
  const resId = store.getState().addResource({ name: 'f2-asn-res', type: 'LABOR', description: '', maxUnits: 1 });
  const walks = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal' }];
  store.getState().updateTask(t1, { timephasedDurationWalks: walks });
  store.getState().updateTask(t2, { timephasedDurationWalks: walks });

  let aid = '';
  runInMcpTransaction(() => { aid = draft.assignResource(t1, resId, 1); });
  assertEq(store.getState().tasks.find((t) => t.id === t1)?.timephasedDurationWalks, undefined,
    'assignResource hoort t1.timephasedDurationWalks te wissen');

  runInMcpTransaction(() => { draft.moveAssignment(aid, t2); });
  assertEq(store.getState().tasks.find((t) => t.id === t2)?.timephasedDurationWalks, undefined,
    'moveAssignment hoort t2.timephasedDurationWalks te wissen');

  store.getState().updateTask(t2, { timephasedDurationWalks: walks });
  runInMcpTransaction(() => { draft.unassignResource(aid); });
  assertEq(store.getState().tasks.find((t) => t.id === t2)?.timephasedDurationWalks, undefined,
    'unassignResource hoort t2.timephasedDurationWalks te wissen');
});

// N2 (Opus-her-check, tweede ronde): `updateTaskFields`/`patchTaskFields` (de mcpTransaction-
// tweeling van taskSlice.ts's `updateTask`) moeten OOK laag 4 wissen zodra een walk-item een
// bevroren `workMinutes` draagt — anders negeert een MCP-duurwijziging de F2-apportioneringstak
// stilzwijgend (`CPMSolver.ts`'s `timephasedFinish`: `walk.workMinutes ?? durMin` wint altijd zodra
// `workMinutes` gezet is). Zonder `workMinutes` (walks===1-vorm) blijft de lijst terecht ongemoeid —
// zie de controle-assertie onderaan.
test('draft.updateTaskFields: een duur-trigger wist OOK timephasedDurationWalks als workMinutes gezet is (N2)', () => {
  const id = store.getState().addTask({ name: 'n2-utf-frozen', time: createDefaultTaskTime('2026-08-03', 5) });
  const walksFrozen = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal', workMinutes: 1440 }];
  store.getState().updateTask(id, { timephasedDurationWalks: walksFrozen });
  const before = store.getState().tasks.find((t) => t.id === id)!;

  const res = runInMcpTransaction(() => {
    draft.updateTaskFields(id, { time: { ...before.time, scheduleDuration: 8 } });
  });

  assert(res.ok, 'transactie hoort te slagen');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.timephasedDurationWalks, undefined, 'timephasedDurationWalks hoort gewist te zijn (workMinutes was gezet)');
});

test('draft.updateTaskFields controle: een duur-trigger laat timephasedDurationWalks ONGEMOEID zonder workMinutes', () => {
  const id = store.getState().addTask({ name: 'n2-utf-plain', time: createDefaultTaskTime('2026-08-03', 5) });
  const walksPlain = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal' }];
  store.getState().updateTask(id, { timephasedDurationWalks: walksPlain });
  const before = store.getState().tasks.find((t) => t.id === id)!;

  const res = runInMcpTransaction(() => {
    draft.updateTaskFields(id, { time: { ...before.time, scheduleDuration: 8 } });
  });

  assert(res.ok, 'transactie hoort te slagen');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.timephasedDurationWalks?.length, 1, 'timephasedDurationWalks hoort ongemoeid te blijven (geen workMinutes, laag 4 stroomt al live mee)');
});

test('draft.patchTaskFields: een timePatch-duur wist OOK timephasedDurationWalks als workMinutes gezet is (N2)', () => {
  const id = store.getState().addTask({ name: 'n2-ptf-frozen' });
  const walksFrozen = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal', workMinutes: 1440 }];
  store.getState().updateTask(id, { timephasedDurationWalks: walksFrozen });

  const res = runInMcpTransaction(() => {
    draft.patchTaskFields(id, {}, { scheduleDuration: 9 });
  });

  assert(res.ok, 'transactie hoort te slagen');
  const t = store.getState().tasks.find((x) => x.id === id);
  assertEq(t?.timephasedDurationWalks, undefined, 'timephasedDurationWalks hoort gewist te zijn (workMinutes was gezet)');
});

// --- 8) setProject --------------------------------------------------------------------------------
test('draft.setProject wijzigt projectvelden binnen één transactie', () => {
  const before = store.getState().undoStack.length;
  const res = runInMcpTransaction(() => {
    draft.setProject({ name: 'Hernoemd project', author: 'MCP' });
  });
  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().undoStack.length, before + 1, 'één transactie-snapshot');
  assertEq(store.getState().project.name, 'Hernoemd project', 'projectnaam hoort bijgewerkt te zijn');
  assertEq(store.getState().project.author, 'MCP', 'auteur hoort bijgewerkt te zijn');
});

await run();
