// WP2 / taak T3 — draft.addTasks: geneste WBS in één aanroep met temp-id's en positie.
// Draait headless tegen de ECHTE Zustand-store (via de harness) — geen mock. Bewijst: geneste
// aanmaak met tempId-parents in husselvolgorde, pre-validatie (dubbele tempId / onbekende parentId /
// mijlpaal-duur / tempId-cykel) VÓÓR enige mutatie (falende batch ⇒ nul taken, byte-identieke
// rollback), en positie als insert-index binnen de ouder (childIds-volgorde exact).
import { useAppStore, test, assert, assertEq, run } from './harness';
import { runInMcpTransaction, draft } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';
import { deriveWbsCodes, flattenOrder } from '@/utils/wbs';
import { createAppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';

const store = useAppStore;

// Warm-up (zoals cases-draft.ts): projectkalender tot bibliotheek-entry promoten via één undo, zodat
// het rollback-/restore-pad in de byte-identiteit-test een steady state heeft.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// --- 1) Geneste 3-niveau-WBS in één call, tempId-parents in husselvolgorde --------------------------
test('draft.addTasks bouwt een 3-niveau-boom uit husselvolgorde; map bevat alle tempIds', () => {
  const before = store.getState().undoStack.length;

  let map = new Map<string, string>();
  const res = runInMcpTransaction(() => {
    // Kind vóór ouder, kleinkind vóór kind — bewust door elkaar.
    map = draft.addTasks([
      { tempId: 'c', name: 'niveau3', parentId: 'b' },
      { tempId: 'a', name: 'niveau1' },
      { tempId: 'b', name: 'niveau2', parentId: 'a' },
    ]);
  });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(store.getState().undoStack.length, before + 1, 'één transactie-snapshot (bulk = één undo-stap)');
  assertEq(map.size, 3, 'de map hoort álle drie de tempIds te bevatten');

  const idA = map.get('a')!;
  const idB = map.get('b')!;
  const idC = map.get('c')!;
  assert(!!idA && !!idB && !!idC, 'elke tempId hoort een echt id te krijgen');

  const tA = store.getState().tasks.find((t) => t.id === idA)!;
  const tB = store.getState().tasks.find((t) => t.id === idB)!;
  const tC = store.getState().tasks.find((t) => t.id === idC)!;
  assertEq(tA.parentId, null, 'niveau1 hoort een wortel te zijn');
  assertEq(tB.parentId, idA, 'niveau2 hoort onder niveau1 te hangen');
  assertEq(tC.parentId, idB, 'niveau3 hoort onder niveau2 te hangen');
  assertEq(tA.childIds, [idB], 'niveau1.childIds hoort exact [niveau2] te zijn');
  assertEq(tB.childIds, [idC], 'niveau2.childIds hoort exact [niveau3] te zijn');
  assertEq(tC.childIds, [], 'niveau3 hoort geen kinderen te hebben');
});

// --- 2) Onbekende parentId ⇒ throw VÓÓR mutatie, byte-identieke rollback ----------------------------
test('draft.addTasks onbekende parentId ⇒ transactie faalt schoon (store byte-identiek)', () => {
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const beforeLen = store.getState().undoStack.length;

  const res = runInMcpTransaction(() => {
    draft.addTasks([
      { tempId: 'x', name: 'goed' },
      { tempId: 'y', name: 'fout', parentId: 'bestaat-niet-en-geen-tempid' },
    ]);
  });

  assert(!res.ok, 'transactie hoort te falen op de onbekende parentId');
  assert(!res.ok && res.error.includes('bestaat-niet-en-geen-tempid'), 'de foutmelding hoort de boosdoener te noemen');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'store-inhoud onaangeroerd (nul taken aangemaakt)');
  assertEq(store.getState().undoStack.length, beforeLen, 'undoStack onaangeroerd na rollback');
  assert(!store.getState().tasks.some((t) => t.name === 'goed'), 'ook de geldige taak mag NIET zijn aangemaakt (pre-check vóór aanmaak)');
});

// --- 3) Dubbele tempId ⇒ throw; tempId-parent-cykel ⇒ throw -----------------------------------------
test('draft.addTasks dubbele tempId ⇒ transactie faalt schoon', () => {
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const res = runInMcpTransaction(() => {
    draft.addTasks([
      { tempId: 'dup', name: 'een' },
      { tempId: 'dup', name: 'twee' },
    ]);
  });
  assert(!res.ok, 'dubbele tempId hoort de transactie te laten falen');
  assert(!res.ok && res.error.toLowerCase().includes('dup'), 'de foutmelding hoort de dubbele tempId te noemen');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'store onaangeroerd na de dubbele-tempId-rollback');
});

test('draft.addTasks tempId-parent-cykel ⇒ transactie faalt schoon', () => {
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const res = runInMcpTransaction(() => {
    draft.addTasks([
      { tempId: 'p', name: 'p', parentId: 'q' },
      { tempId: 'q', name: 'q', parentId: 'p' },
    ]);
  });
  assert(!res.ok, 'een cykel in tempId-parents hoort de transactie te laten falen');
  assert(!res.ok && res.error.toLowerCase().includes('cykel'), 'de foutmelding hoort de cykel te benoemen');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'store onaangeroerd na de cykel-rollback');
});

// --- 4) Positie: kind op index 0 tussen twee bestaande siblings -------------------------------------
test('draft.addTasks position=0 plaatst het kind vooraan tussen bestaande siblings (childIds exact)', () => {
  const parentId = store.getState().addTask({ name: 'pos-parent' });
  const sibA = store.getState().addTask({ name: 'pos-a', parentId });
  const sibB = store.getState().addTask({ name: 'pos-b', parentId });
  // Voorwaarde: parent.childIds == [sibA, sibB]
  assertEq(store.getState().tasks.find((t) => t.id === parentId)!.childIds, [sibA, sibB], 'voorwaarde: twee bestaande siblings');

  let map = new Map<string, string>();
  const res = runInMcpTransaction(() => {
    map = draft.addTasks([{ tempId: 'x', name: 'pos-x', parentId, position: 0 }]);
  });
  assert(res.ok, 'transactie hoort te slagen');
  const idX = map.get('x')!;
  const parent = store.getState().tasks.find((t) => t.id === parentId)!;
  assertEq(parent.childIds, [idX, sibA, sibB], 'position=0 hoort het kind vooraan te zetten (childIds-volgorde exact)');
});

test('draft.addTasks meerdere posities in dezelfde ouder ⇒ toegepast in inputvolgorde', () => {
  const parentId = store.getState().addTask({ name: 'pos2-parent' });
  const sibA = store.getState().addTask({ name: 'pos2-a', parentId });
  // childIds == [sibA]; twee nieuwe items, beide position 0, in inputvolgorde toegepast.
  let map = new Map<string, string>();
  const res = runInMcpTransaction(() => {
    map = draft.addTasks([
      { tempId: 'x', name: 'pos2-x', parentId, position: 0 },
      { tempId: 'y', name: 'pos2-y', parentId, position: 0 },
    ]);
  });
  assert(res.ok, 'transactie hoort te slagen');
  const idX = map.get('x')!;
  const idY = map.get('y')!;
  const parent = store.getState().tasks.find((t) => t.id === parentId)!;
  // x op 0 ⇒ [x, sibA]; y op 0 ⇒ [y, x, sibA]
  assertEq(parent.childIds, [idY, idX, sibA], 'posities horen in inputvolgorde toegepast te worden');
});

// --- 4b) Positie op de RAUWE-ARRAY-as: midden-insert ⇒ WBS-codes kloppen (T3-review-nit) -----------
// De childIds-as is hierboven gedekt; deze test dekt de rauwe-array-as die de WBS-nummering aandrijft.
// Na een MIDDEN-insert (tussen twee siblings) horen de afgeleide WBS-codes (flattenOrder ⇒
// deriveWbsCodes, dezelfde helper die applyWbsNumbering gebruikt) de nieuwe volgorde te weerspiegelen —
// niet alleen childIds. Voorwaarde: wbsAutoNumber staat aan (default).
test('draft.addTasks midden-positie ⇒ rauwe-array-WBS-codes weerspiegelen de insert (via de nummerings-helper)', () => {
  assert(store.getState().project.wbsAutoNumber, 'voorwaarde: WBS-auto-nummering staat aan');
  const parentId = store.getState().addTask({ name: 'wbs-parent' });
  const sibA = store.getState().addTask({ name: 'wbs-a', parentId });
  const sibB = store.getState().addTask({ name: 'wbs-b', parentId });
  const sibC = store.getState().addTask({ name: 'wbs-c', parentId });
  assertEq(store.getState().tasks.find((t) => t.id === parentId)!.childIds, [sibA, sibB, sibC], 'voorwaarde: drie siblings');

  // Insert x TUSSEN sibA en sibB (position 1).
  let map = new Map<string, string>();
  const res = runInMcpTransaction(() => {
    map = draft.addTasks([{ tempId: 'x', name: 'wbs-x', parentId, position: 1 }]);
  });
  assert(res.ok, 'transactie hoort te slagen');
  const idX = map.get('x')!;

  // childIds-as (ter controle) + rauwe-array-as via flattenOrder.
  const parent = store.getState().tasks.find((t) => t.id === parentId)!;
  assertEq(parent.childIds, [sibA, idX, sibB, sibC], 'childIds hoort x tussen a en b te zetten');
  const flatIds = flattenOrder(store.getState().tasks).map((t) => t.id);
  const parentPos = flatIds.indexOf(parentId);
  assertEq(flatIds.slice(parentPos, parentPos + 5), [parentId, sibA, idX, sibB, sibC],
    'de rauwe-array-flatten hoort exact [parent, a, x, b, c] te zijn (raw array = WBS-bron)');

  // WBS-codes: elke stored wbsCode hoort exact de deriveWbsCodes-uitkomst van de rauwe array te zijn,
  // en x hoort de tweede kind-positie (parentcode + ".2") te dragen — hard bewijs dat de raw-array-as
  // (niet alleen childIds) de midden-insert kreeg.
  const derived = deriveWbsCodes(store.getState().tasks);
  for (const t of store.getState().tasks) {
    assertEq(t.wbsCode, derived.get(t.id), `stored wbsCode van '${t.name}' hoort gelijk aan de deriveWbsCodes-uitkomst`);
  }
  const parentCode = derived.get(parentId)!;
  assertEq(derived.get(sibA), `${parentCode}.1`, 'sibA hoort de eerste kind-code te dragen');
  assertEq(derived.get(idX), `${parentCode}.2`, 'x (midden-insert op index 1) hoort de TWEEDE kind-code te dragen');
  assertEq(derived.get(sibB), `${parentCode}.3`, 'sibB hoort door de insert naar de derde kind-code te schuiven');
  assertEq(derived.get(sibC), `${parentCode}.4`, 'sibC hoort naar de vierde kind-code te schuiven');
});

// --- 5) Mijlpaal-duur-validatie --------------------------------------------------------------------
test('draft.addTasks mijlpaal met expliciete duur > 0 ⇒ transactie faalt schoon', () => {
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const res = runInMcpTransaction(() => {
    draft.addTasks([
      {
        tempId: 'm',
        name: 'foute-mijlpaal',
        isMilestone: true,
        time: {
          durationType: 'WORKTIME', scheduleDuration: 3, scheduleStart: '2026-01-01', scheduleFinish: '2026-01-06',
          earlyStart: '2026-01-01', earlyFinish: '2026-01-06', lateStart: '2026-01-01', lateFinish: '2026-01-06',
          freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
        },
      },
    ]);
  });
  assert(!res.ok, 'een mijlpaal met duur > 0 hoort de transactie te laten falen');
  assert(!res.ok && res.error.toLowerCase().includes('mijlpaal'), 'de foutmelding hoort de mijlpaal te benoemen');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'store onaangeroerd na de mijlpaal-duur-rollback');
});

test('draft.addTasks mijlpaal zonder time ⇒ duur 0', () => {
  let map = new Map<string, string>();
  const res = runInMcpTransaction(() => {
    map = draft.addTasks([{ tempId: 'ms', name: 'goede-mijlpaal', isMilestone: true }]);
  });
  assert(res.ok, 'een mijlpaal zonder time hoort gewoon aangemaakt te worden');
  const t = store.getState().tasks.find((x) => x.id === map.get('ms'));
  assertEq(t?.time.scheduleDuration, 0, 'een mijlpaal zonder time hoort duur 0 te krijgen');
  assertEq(t?.isMilestone, true, 'de taak hoort een mijlpaal te zijn');
});

// --- 9) taskType-overerving: geneste batch (net-aangemaakte tempId-ouder telt al mee) --------------
test('draft.addTasks: taskType erft door de keten van tempId-ouder naar kind naar kleinkind', () => {
  let map = new Map<string, string>();
  const res = runInMcpTransaction(() => {
    map = draft.addTasks([
      { tempId: 'a', name: 'erf-niveau1', taskType: 'LOGISTIC' },
      { tempId: 'b', name: 'erf-niveau2', parentId: 'a' },
      { tempId: 'c', name: 'erf-niveau3', parentId: 'b', taskType: 'DEMOLITION' },
    ]);
  });

  assert(res.ok, 'transactie hoort te slagen');
  const idA = map.get('a')!;
  const idB = map.get('b')!;
  const idC = map.get('c')!;
  assertEq(store.getState().tasks.find((t) => t.id === idA)?.taskType, 'LOGISTIC', 'niveau1 behoudt zijn expliciete taskType');
  assertEq(store.getState().tasks.find((t) => t.id === idB)?.taskType, 'LOGISTIC', 'niveau2 zonder eigen taskType erft van de net-aangemaakte tempId-ouder (a)');
  assertEq(store.getState().tasks.find((t) => t.id === idC)?.taskType, 'DEMOLITION', 'niveau3 met een expliciete taskType wint van zijn ouder (b)');
});

test('contextgebonden addTasks bouwt de bulk alleen in B en retourneert B-id’s', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  const txB = createMcpTransactions(B);
  const aVoor = JSON.stringify(capturePayload(A.store.getState()));

  const result = txB.run(() => txB.draft.addTasks([
    { tempId: 'ouder', name: 'bulk-ouder-B' },
    { tempId: 'kind', name: 'bulk-kind-B', parentId: 'ouder' },
  ]));

  assert(result.ok, 'de contextgebonden bulk hoort te slagen');
  assert(result.ok && result.value.size === 2, 'de generieke returnwaarde hoort beide B-id’s te bevatten');
  const ouder = result.ok ? B.store.getState().tasks.find((task) => task.id === result.value.get('ouder')) : undefined;
  const kind = result.ok ? B.store.getState().tasks.find((task) => task.id === result.value.get('kind')) : undefined;
  assert(!!ouder && !!kind && kind.parentId === ouder.id, 'de geretourneerde ids horen de boom in B aan te wijzen');
  assertEq(JSON.stringify(capturePayload(A.store.getState())), aVoor, 'de B-bulk mag A niet wijzigen');
});

await run();
