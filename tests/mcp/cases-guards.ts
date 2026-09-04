// WP7 / taak T4 — validatielaag: pure `validate.*`/`progress.*`-helpers bovenop de drafts.
// Draait headless tegen de ECHTE Zustand-store (via de harness). De helpers zijn PUUR (geen
// store-mutatie) behalve `progress.applyProgressUpdate`, dat op een Immer-DRAFT werkt — die test
// draaien we daarom binnen een `useAppStore.setState`-producer of binnen een transactie.
//
// De testlijst spiegelt spec §Testen (regel 146) + §Werkpakket 7 (regel 60): completion out-of-range
// zonder klem, 40%-taak ⇒ STARTED + afgeleide actualStart (0-100→0-1-conversie), actual ná
// statusdatum ⇒ weigering, actuals zonder statusdatum ⇒ weigering met uitleg, actualFinish <
// actualStart ⇒ weigering, actualFinish-wis op 100% ⇒ completion-reset, voortgang op summary ⇒
// weigering, kringverwijzing in de voorgestelde batch ⇒ noCycle noemt de kring (+ store byte-
// identiek binnen een transactie), dubbele toewijzing ⇒ assignmentAllowed én de store weigeren hem,
// onbekend task-id ⇒ per-item-fout uit tasksExist.
import { useAppStore, test, assert, assertEq, run } from './harness';
import { validate, progress } from '@/state/mcpValidation';
import { runInMcpTransaction, draft } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';
import { createAppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

const store = useAppStore;

// Warm-up (zelfde reden als cases-draft.ts): een verse store heeft `calendars: []`; het rollback-/
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry (syncProjectCalendar, §9.1). Door
// hier één edit te undo'en staat `cal-default` al in de bibliotheek, zodat de byte-identiek-assert na
// een transactie-rollback niet op die (gedocumenteerde, benigne) promotie struikelt.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

/** Kleine helper: een progress-update op een taak toepassen BINNEN een Immer-draft (de helper muteert
 *  de draft alleen bij `applied:true`). Retourneert het per-item-resultaat. */
function applyProgress(
  taskId: string,
  update: { completion?: number; actualStart?: string; actualFinish?: string },
  statusDate: string | undefined,
): { applied: true } | { applied: false; reason: string } {
  let result: { applied: true } | { applied: false; reason: string } = { applied: false, reason: 'niet-uitgevoerd' };
  store.setState((s) => {
    result = progress.applyProgressUpdate(s, taskId, update, statusDate);
  });
  return result;
}

// =================================================================================================
// 1) validate.tasksExist / taskExists — onbekend task-id ⇒ per-item-fout
// =================================================================================================
test('validate.taskExists: bestaand id ⇒ null, onbekend id ⇒ {id, reason}', () => {
  const id = store.getState().addTask({ name: 'bestaat' });
  assertEq(validate.taskExists(store.getState(), id), null, 'bestaand id hoort null (geen fout) te geven');
  const err = validate.taskExists(store.getState(), 'geen-taak');
  assert(err !== null && err.id === 'geen-taak' && /onbekend|bestaat niet|niet gevonden/i.test(err.reason),
    'onbekend id hoort een {id, reason}-fout te geven die het id benoemt');
});

test('validate.tasksExist: rapporteert per ontbrekend id een aparte fout, bestaande niet', () => {
  const a = store.getState().addTask({ name: 'te-a' });
  const b = store.getState().addTask({ name: 'te-b' });
  const errors = validate.tasksExist(store.getState(), [a, 'weg-1', b, 'weg-2']);
  assertEq(errors.length, 2, 'precies twee ontbrekende id\'s horen gerapporteerd te worden');
  assertEq(errors.map((e) => e.id).sort(), ['weg-1', 'weg-2'], 'de twee ontbrekende id\'s horen genoemd te worden');
  assert(errors.every((e) => typeof e.reason === 'string' && e.reason.length > 0), 'elke fout hoort een reden te dragen');
});

// =================================================================================================
// 2) validate.noCycle — kringverwijzing in de voorgestelde batch ⇒ noemt de kring; store byte-identiek
// =================================================================================================
test('validate.noCycle: acyclische voorgestelde batch ⇒ null', () => {
  const a = store.getState().addTask({ name: 'nc-a' });
  const b = store.getState().addTask({ name: 'nc-b' });
  const c = store.getState().addTask({ name: 'nc-c' });
  const cyc = validate.noCycle(store.getState(), [
    { predecessorId: a, successorId: b },
    { predecessorId: b, successorId: c },
  ]);
  assertEq(cyc, null, 'een keten a→b→c hoort geen kring op te leveren');
});

test('validate.noCycle: kring binnen de voorgestelde batch ⇒ noemt de betrokken taken', () => {
  const a = store.getState().addTask({ name: 'cyc-a' });
  const b = store.getState().addTask({ name: 'cyc-b' });
  const c = store.getState().addTask({ name: 'cyc-c' });
  const cyc = validate.noCycle(store.getState(), [
    { predecessorId: a, successorId: b },
    { predecessorId: b, successorId: c },
    { predecessorId: c, successorId: a },
  ]);
  assert(Array.isArray(cyc), 'een kring a→b→c→a hoort gedetecteerd te worden (array terug)');
  const set = new Set(cyc as string[]);
  assert(set.has(a) && set.has(b) && set.has(c), 'de gerapporteerde kring hoort alle drie de taken te bevatten');
});

test('validate.noCycle: kring die pas ontstaat met de BESTAANDE relaties erbij', () => {
  const a = store.getState().addTask({ name: 'mix-a' });
  const b = store.getState().addTask({ name: 'mix-b' });
  // Bestaande relatie a→b.
  store.getState().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  // Voorgestelde relatie b→a sluit de kring met de bestaande a→b.
  const cyc = validate.noCycle(store.getState(), [{ predecessorId: b, successorId: a }]);
  assert(Array.isArray(cyc), 'b→a bovenop bestaande a→b hoort een kring te vormen');
  const set = new Set(cyc as string[]);
  assert(set.has(a) && set.has(b), 'de kring hoort a en b te bevatten');
});

test('validate.noCycle is PUUR: detectie muteert de store niet (byte-identiek)', () => {
  const a = store.getState().addTask({ name: 'pure-a' });
  const b = store.getState().addTask({ name: 'pure-b' });
  const before = JSON.stringify(createSnapshot(store.getState()));
  validate.noCycle(store.getState(), [
    { predecessorId: a, successorId: b },
    { predecessorId: b, successorId: a },
  ]);
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'noCycle mag de store niet aanraken');
});

test('kringverwijzing die tóch de transactie in glipt ⇒ rollback laat de store byte-identiek', () => {
  // WP3-vangnet: de transactie-rollback vangt een kring die de pre-check zou hebben moeten weren.
  const a = store.getState().addTask({ name: 'tx-a' });
  const b = store.getState().addTask({ name: 'tx-b' });
  const before = JSON.stringify(createSnapshot(store.getState()));
  const res = runInMcpTransaction(() => {
    draft.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    draft.addSequence({ predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  });
  assert(!res.ok, 'een kring hoort de transactie te laten falen (cpmResult.error)');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'na de rollback hoort de store byte-identiek te zijn');
});

// =================================================================================================
// 3) validate.assignmentAllowed — leaf-only/mijlpaal/units + dubbele-toewijzing-guard
// =================================================================================================
test('validate.assignmentAllowed: geldige leaf-toewijzing ⇒ ok', () => {
  const t = store.getState().addTask({ name: 'aa-leaf' });
  const r = store.getState().addResource({ name: 'aa-res', type: 'LABOR', description: '', maxUnits: 1 });
  const res = validate.assignmentAllowed(store.getState(), t, r, 1);
  assert(res.ok, 'een geldige leaf-toewijzing hoort te worden toegestaan');
});

test('validate.assignmentAllowed: mijlpaal / summary / units<=0 ⇒ weigering', () => {
  const ms = store.getState().addTask({ name: 'aa-ms', isMilestone: true });
  const parent = store.getState().addTask({ name: 'aa-parent' });
  store.getState().addTask({ name: 'aa-child', parentId: parent });
  const leaf = store.getState().addTask({ name: 'aa-leaf2' });
  const r = store.getState().addResource({ name: 'aa-res2', type: 'LABOR', description: '', maxUnits: 1 });

  const onMs = validate.assignmentAllowed(store.getState(), ms, r, 1);
  assert(!onMs.ok && /mijlpaal|milestone/i.test(onMs.ok ? '' : onMs.reason), 'toewijzing op een mijlpaal hoort geweigerd');
  const onSummary = validate.assignmentAllowed(store.getState(), parent, r, 1);
  assert(!onSummary.ok && /samenvat|summary|kinderen|children/i.test(onSummary.ok ? '' : onSummary.reason), 'toewijzing op een summary hoort geweigerd');
  const badUnits = validate.assignmentAllowed(store.getState(), leaf, r, 0);
  assert(!badUnits.ok && /eenhe|units|positief/i.test(badUnits.ok ? '' : badUnits.reason), 'units<=0 hoort geweigerd');
});

test('validate.assignmentAllowed weigert de DUBBELE toewijzing (duplicaat = dubbeltelling in load)', () => {
  const t = store.getState().addTask({ name: 'dup-leaf' });
  const r = store.getState().addResource({ name: 'dup-res', type: 'LABOR', description: '', maxUnits: 10 });

  // Eerste toewijzing via de store: toegestaan.
  const first = validate.assignmentAllowed(store.getState(), t, r, 2);
  assert(first.ok, 'de eerste toewijzing hoort te worden toegestaan');
  store.getState().assignResource(t, r, 2);

  // De algemene store-route bewaakt dezelfde invariant als laatste vangrail voor niet-MCP-aanroepers.
  store.getState().assignResource(t, r, 2);
  const dupes = store.getState().assignments.filter((a) => a.taskId === t && a.resourceId === r);
  assertEq(dupes.length, 1, 'de store weigert een tweede (duplicaat-)toewijzing');
  const loadSum = dupes.reduce((sum, a) => sum + a.unitsPerDay, 0);
  assertEq(loadSum, 2, 'de geweigerde duplicaat verhoogt de gevraagde last niet');

  // De guard weigert de tweede toewijzing (op een staat waarin de resource er al op zit).
  const second = validate.assignmentAllowed(store.getState(), t, r, 2);
  assert(!second.ok && /al toegewezen|dubbel|reeds|bestaan/i.test(second.ok ? '' : second.reason),
    'assignmentAllowed hoort de dubbele toewijzing te weigeren met een duidelijke reden');
});

// =================================================================================================
// 4) progress.applyProgressUpdate — het volledige voortgangspad (WP7)
// =================================================================================================
test('voortgang: completion 150 ⇒ weigering ZONDER klem (geen mutatie op de taak)', () => {
  const id = store.getState().addTask({ name: 'pg-oob' });
  store.getState().setProject({ statusDate: '2026-08-01' });
  const before = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);

  const res = applyProgress(id, { completion: 150 }, '2026-08-01');
  assert(!res.applied, 'completion 150 hoort geweigerd te worden');
  assert(!res.applied && /0.?100|bereik|range|buiten/i.test(res.reason), 'de reden hoort het 0–100-bereik te noemen');
  const after = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);
  assertEq(after, before, 'een geweigerd item mag de taak NIET muteren (geen klem naar 100)');
});

test('voortgang: 40%-taak ⇒ STARTED + afgeleide actualStart, 0-100→0-1-conversie', () => {
  const id = store.getState().addTask({ name: 'pg-40' });
  store.getState().runCPM(); // earlyStart vullen zodat de afleiding een echte datum pakt.
  store.getState().setProject({ statusDate: '2027-01-01' });
  const task0 = store.getState().tasks.find((t) => t.id === id)!;
  const expectStart = task0.time.earlyStart || task0.time.scheduleStart;

  const res = applyProgress(id, { completion: 40 }, '2027-01-01');
  assert(res.applied, '40% voortgang hoort te worden toegepast');
  const task = store.getState().tasks.find((t) => t.id === id)!;
  assertEq(task.time.completion, 0.4, 'completion 40 (0–100) hoort naar 0.4 (0–1) te converteren');
  assertEq(task.status, 'STARTED', 'een taak met voortgang>0 zonder finish hoort STARTED te zijn');
  assertEq(task.time.actualStart, expectStart, 'actualStart hoort afgeleid uit earlyStart||scheduleStart');
});

test('voortgang: actualStart ná de statusdatum ⇒ weigering (spiegel van accepted=false)', () => {
  const id = store.getState().addTask({ name: 'pg-late' });
  store.getState().setProject({ statusDate: '2026-06-01' });
  const before = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);

  const res = applyProgress(id, { completion: 50, actualStart: '2026-07-01' }, '2026-06-01');
  assert(!res.applied, 'een actualStart ná de statusdatum hoort geweigerd te worden');
  assert(!res.applied && /statusdatum|status date|ná|na de/i.test(res.reason), 'de reden hoort de statusdatum te noemen');
  const after = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);
  assertEq(after, before, 'een geweigerd item mag de taak niet muteren');
});

test('voortgang: actuals ZONDER statusdatum ⇒ weigering met uitleg', () => {
  const id = store.getState().addTask({ name: 'pg-nostatus' });
  store.getState().setProject({ statusDate: undefined });
  const before = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);

  const res = applyProgress(id, { completion: 30 }, undefined);
  assert(!res.applied, 'voortgang zonder statusdatum hoort geweigerd te worden');
  assert(!res.applied && /statusdatum|status date/i.test(res.reason), 'de reden hoort uit te leggen dat er geen statusdatum is');
  const after = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);
  assertEq(after, before, 'een geweigerd item mag de taak niet muteren');
});

test('voortgang: actualFinish < actualStart ⇒ weigering', () => {
  const id = store.getState().addTask({ name: 'pg-order' });
  store.getState().setProject({ statusDate: '2026-12-31' });
  const before = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);

  const res = applyProgress(id, { actualStart: '2026-06-10', actualFinish: '2026-06-05' }, '2026-12-31');
  assert(!res.applied, 'actualFinish vóór actualStart hoort geweigerd te worden');
  assert(!res.applied && /finish|einde|start|volgorde|vóór|voor/i.test(res.reason), 'de reden hoort de datumvolgorde te noemen');
  const after = JSON.stringify(store.getState().tasks.find((t) => t.id === id)!.time);
  assertEq(after, before, 'een geweigerd item mag de taak niet muteren');
});

test('voortgang: actualFinish wissen op een 100%-taak reset ook completion', () => {
  const id = store.getState().addTask({ name: 'pg-clearfinish' });
  store.getState().setProject({ statusDate: '2026-12-31' });
  // Zet de taak eerst op 100% mét een echte finish.
  const r1 = applyProgress(id, { actualFinish: '2026-06-01' }, '2026-12-31');
  assert(r1.applied, 'de taak op 100% zetten hoort te lukken');
  const done = store.getState().tasks.find((t) => t.id === id)!;
  assertEq(done.time.completion, 1, 'de taak hoort nu op completion 1 te staan');
  assertEq(done.status, 'COMPLETED', 'de taak hoort COMPLETED te zijn');

  // Wis de finish: completion moet meeresetten (anders re-default de invariant meteen een finish).
  const r2 = applyProgress(id, { actualFinish: undefined }, '2026-12-31');
  assert(r2.applied, 'de finish wissen hoort te lukken');
  const cleared = store.getState().tasks.find((t) => t.id === id)!;
  assertEq(cleared.time.actualFinish, undefined, 'actualFinish hoort gewist te zijn');
  assert(cleared.time.completion < 1, 'completion hoort mee te resetten (niet meer 100%)');
  assert(cleared.status !== 'COMPLETED', 'de taak hoort niet meer COMPLETED te zijn');
});

test('voortgang op een summary-taak ⇒ weigering', () => {
  const parent = store.getState().addTask({ name: 'pg-summary' });
  store.getState().addTask({ name: 'pg-summary-child', parentId: parent });
  store.getState().setProject({ statusDate: '2026-12-31' });
  const before = JSON.stringify(store.getState().tasks.find((t) => t.id === parent)!.time);

  const res = applyProgress(parent, { completion: 50 }, '2026-12-31');
  assert(!res.applied, 'voortgang op een taak met kinderen hoort geweigerd te worden');
  assert(!res.applied && /kinderen|children|samenvat|summary|verzamel/i.test(res.reason), 'de reden hoort te noemen dat het een verzameltaak is');
  const after = JSON.stringify(store.getState().tasks.find((t) => t.id === parent)!.time);
  assertEq(after, before, 'een geweigerd item mag de summary niet muteren');
});

// =================================================================================================
// 5) validate.milestoneDuration — hergebruik van de T3-regel (mijlpaal ⇒ duur 0)
// =================================================================================================
test('validate.milestoneDuration: mijlpaal met duur>0 ⇒ fout, duur 0 / geen mijlpaal ⇒ null', () => {
  const bad = validate.milestoneDuration({ isMilestone: true, time: { scheduleDuration: 3 } as any });
  assert(bad !== null && /duur|duration|mijlpaal|milestone/i.test(bad!), 'een mijlpaal met duur>0 hoort een reden te geven');
  assertEq(validate.milestoneDuration({ isMilestone: true, time: { scheduleDuration: 0 } as any }), null, 'mijlpaal met duur 0 ⇒ geen fout');
  assertEq(validate.milestoneDuration({ isMilestone: false, time: { scheduleDuration: 5 } as any }), null, 'gewone taak ⇒ geen fout');
  assertEq(validate.milestoneDuration({ isMilestone: true }), null, 'mijlpaal zonder expliciete time ⇒ geen fout (duur wordt 0)');
});

// =================================================================================================
// 6) Contextfactory-vangrails: solverrollback en strikt synchrone callback
// =================================================================================================
test('solvercycle in factory B rolt B volledig terug en laat A bytegelijk', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  B.store.getState().addTask({ name: 'warmup' });
  B.store.getState().undo();
  const a = B.store.getState().addTask({ name: 'factory-cycle-A' });
  const b = B.store.getState().addTask({ name: 'factory-cycle-B' });
  B.store.getState().runCPM();
  const txB = createMcpTransactions(B);
  const aVoor = JSON.stringify(capturePayload(A.store.getState()));
  const bVoor = JSON.stringify(createSnapshot(B.store.getState()));
  const historyVoor = JSON.stringify(B.store.getState().historyEvents);

  const result = txB.run(() => {
    txB.draft.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    txB.draft.addSequence({ predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  });

  assert(!result.ok, 'de eindsolver hoort de kring te weigeren');
  assertEq(JSON.stringify(createSnapshot(B.store.getState())), bVoor,
    'B hoort inclusief cpmResult exact terug te rollen');
  assertEq(JSON.stringify(B.store.getState().historyEvents), historyVoor,
    'B-history hoort na solverrollback exact gelijk te zijn');
  assertEq(JSON.stringify(capturePayload(A.store.getState())), aVoor, 'solverrollback in B mag A niet raken');
});

test('een thenable uit de callback wordt runtime geweigerd en volledig teruggerold', () => {
  const context = createAppStoreContext();
  context.store.getState().addTask({ name: 'warmup' });
  context.store.getState().undo();
  const tx = createMcpTransactions(context);
  const voor = JSON.stringify(createSnapshot(context.store.getState()));
  const stacksVoor = historyDepthsForActiveScope(context.store.getState());
  const unsafeRun = tx.run as unknown as (
    fn: () => unknown,
  ) => { ok: true; value: unknown; timephasedGuidanceLost: number } | { ok: false; error: string };

  const result = unsafeRun(() => {
    tx.draft.addTask({ name: 'verdwijnt-door-thenable' });
    return Promise.resolve('asynchroon');
  });

  assert(!result.ok && /synchroon|thenable|promise/i.test(result.error),
    'de runtimeguard hoort een herkenbare synchroniciteitsfout te geven');
  assertEq(JSON.stringify(createSnapshot(context.store.getState())), voor,
    'de thenable-weigering hoort de documentstate volledig terug te rollen');
  assertEq(historyDepthsForActiveScope(context.store.getState()), stacksVoor,
    'de thenable-weigering hoort undo/redo exact te herstellen');
});

if (false) {
  const context = createAppStoreContext();
  const tx = createMcpTransactions(context);
  // @ts-expect-error MCP-transacties zijn strikt synchroon; Promise-return is type-ongeldig.
  tx.run(async () => 'niet-toegestaan');
}

await run();
