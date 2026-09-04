// WP / taak T17 — tool-runtime: envelop, guards, drift-anker, backup-hookpunt.
// Draait headless tegen de ECHTE Zustand-store (via de harness) — geen mock. Bewijst de
// runtime-semantiek uit spec §Sessie-semantiek & respons-contract (regels 115-116, 128-132):
//   - envelop-velden compleet (activeDocumentId, titel, scheduleStale, paused, readOnly);
//   - dialoog-guard benoemt de open vlag, blokkeert read én mutate;
//   - paused/readOnly blokkeren ALLEEN mutaties (read gaat door, mét de vlag in de envelop);
//   - drift: user-switch ⇒ DOC_DRIFT met beide id's; eerste mutatie bindt het anker;
//     bindExpectedDoc verzet het;
//   - AI-backup: pad ⇒ backupCreated precies één keer; reject ⇒ BACKUP_FAILED vóór enige mutatie;
//   - transactie-fout ⇒ nette code (CYCLE bij kring, VALIDATION anders).
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import {
  buildEnvelope, runReadTool, runMutateTool, bindExpectedDoc,
  guardNonTransactional, toolError, McpStepError,
  mcpDocumentTitle, MCP_UNTITLED_TITLE,
} from '@/services/mcp/tools/runtime';
import type { MutationOutcome } from '@/services/mcp/tools/runtime';
import type { McpContext } from '@/services/mcp/contracts';
import { draft } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';

const store = useAppStore;

// Warm-up (zelfde reden als cases-transaction.ts): een verse store heeft `calendars: []`; het
// rollback-/restore-pad promoot de projectkalender-cache tot bibliotheek-entry (syncProjectCalendar,
// §9.1). Door hier één edit te undo'en staat `cal-default` al in de bibliotheek, zodat een latere
// byte-identiek-assert die (benigne) promotie niet als store-verschil waarneemt.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

/** Verse ctx met overschrijfbare velden (spiegelt buildMcpContext, maar volledig in de hand). */
function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    ...over,
  });
}

/** Alle door de tests gezette runtime-vlaggen weer op de rustwaarde. */
function resetFlags(): void {
  store.setState((s) => {
    s.ui.showNewProjectDialog = false;
    s.ui.aiPaused = false;
    s.ui.aiReadOnly = false;
  });
}

/** Muterende fn die één taak toevoegt en het id als data teruggeeft. */
const addTaskOutcome = (): MutationOutcome => ({ data: draft.addTask({ name: 'via-runtime' }) });

// =================================================================================================
// 1) Envelop-velden compleet
// =================================================================================================
test('buildEnvelope: alle contractvelden aanwezig en kloppend, geen backupCreated', () => {
  resetFlags();
  const env = buildEnvelope(makeCtx());
  const active = store.getState().getOpenDocuments().find((d) => d.isActive)!;
  assertEq(env.activeDocumentId, store.getState().activeDocumentId, 'activeDocumentId hoort het actieve doc-id te zijn');
  assertEq(env.documentTitle, mcpDocumentTitle(active), 'documentTitle hoort via de bestaande titel-afleiding te komen');
  assertEq(env.scheduleStale, store.getState().scheduleStale, 'scheduleStale hoort de top-level-vlag te spiegelen');
  assertEq(env.paused, false, 'paused hoort false te zijn in rusttoestand');
  assertEq(env.readOnly, false, 'readOnly hoort false te zijn in rusttoestand');
  assert(!('backupCreated' in env), 'backupCreated hoort te ontbreken zonder backup deze call');
});

// Regressie: de store levert voor een NAAMLOOS document bewust een lege titel (datalaag), maar de
// MCP-laag mag nooit een lege titel naar de AI-client sturen — die zag anders "" waar vroeger een
// naam stond. De terugval is een vaste Engelse string (geen `t(...)` in deze laag), en bij meerdere
// naamloze documenten komt er een taalonafhankelijk volgnummer bij.
test('buildEnvelope: naamloos document ⇒ Engelse terugvaltitel i.p.v. een lege string', () => {
  resetFlags();
  const before = store.getState().project.name;
  store.setState((s) => { s.project = { ...s.project, name: '' }; s.filePath = null; s.fileHandle = null; });
  const active = store.getState().getOpenDocuments().find((d) => d.isActive)!;
  assertEq(active.title, '', 'de STORE hoort naamloos als lege titel te blijven leveren');
  assertEq(buildEnvelope(makeCtx()).documentTitle, MCP_UNTITLED_TITLE, 'de envelop hoort de terugvaltitel te dragen');
  store.setState((s) => { s.project = { ...s.project, name: 'Kade 7' }; });
  assertEq(buildEnvelope(makeCtx()).documentTitle, 'Kade 7', 'met een naam hoort de echte projectnaam te komen');
  store.setState((s) => { s.project = { ...s.project, name: before }; });
});

test('mcpDocumentTitle: volgnummer onderscheidt meerdere naamloze documenten', () => {
  assertEq(mcpDocumentTitle({ id: 'a', title: '', isDirty: false, isActive: true }), MCP_UNTITLED_TITLE,
    'zonder volgnummer hoort de kale terugvaltitel te komen');
  assertEq(mcpDocumentTitle({ id: 'b', title: '', isDirty: false, isActive: false, untitledOrdinal: 2 }),
    `${MCP_UNTITLED_TITLE} (2)`, 'met volgnummer hoort dat achter de terugvaltitel te staan');
  assertEq(mcpDocumentTitle({ id: 'c', title: 'Kade 7', isDirty: false, isActive: false, untitledOrdinal: 3 }),
    'Kade 7', 'een echte titel wint altijd van de terugval');
});

// =================================================================================================
// 2) Dialoog-guard — leestool
// =================================================================================================
test('runReadTool: open dialoog ⇒ DIALOG_OPEN met de vlag-naam', () => {
  resetFlags();
  store.setState((s) => { s.ui.showNewProjectDialog = true; });
  const res = runReadTool(makeCtx(), (s) => s.tasks.length);
  resetFlags();
  assert(!res.ok, 'read hoort geweigerd te worden terwijl een dialoog open staat');
  if (res.ok) return;
  assertEq(res.code, 'DIALOG_OPEN', 'code hoort DIALOG_OPEN te zijn');
  assert(res.error.includes('showNewProjectDialog'), `fout hoort de vlag-naam te noemen, kreeg: ${res.error}`);
});

// =================================================================================================
// 3) Dialoog-guard — muterende tool
// =================================================================================================
test('runMutateTool: open dialoog ⇒ DIALOG_OPEN met de vlag-naam', async () => {
  resetFlags();
  store.setState((s) => { s.ui.showNewProjectDialog = true; });
  const res = await runMutateTool(makeCtx(), 'mutate', addTaskOutcome);
  resetFlags();
  assert(!res.ok, 'mutate hoort geweigerd te worden terwijl een dialoog open staat');
  if (res.ok) return;
  assertEq(res.code, 'DIALOG_OPEN', 'code hoort DIALOG_OPEN te zijn');
  assert(res.error.includes('showNewProjectDialog'), `fout hoort de vlag-naam te noemen, kreeg: ${res.error}`);
});

// =================================================================================================
// 4) Paused blokkeert ALLEEN mutaties; read gaat door mét de vlag in de envelop
// =================================================================================================
test('paused: read werkt (paused-vlag in envelop), mutate ⇒ PAUSED', async () => {
  resetFlags();
  store.setState((s) => { s.ui.aiPaused = true; });
  const readRes = runReadTool(makeCtx({ paused: true }), (s) => s.tasks.length);
  assert(readRes.ok, 'read hoort door te mogen terwijl gepauzeerd');
  if (readRes.ok) assertEq(readRes.envelope.paused, true, 'de envelop hoort paused:true te tonen');

  const mutRes = await runMutateTool(makeCtx({ paused: true }), 'mutate', addTaskOutcome);
  resetFlags();
  assert(!mutRes.ok, 'mutate hoort geweigerd te worden terwijl gepauzeerd');
  if (!mutRes.ok) assertEq(mutRes.code, 'PAUSED', 'code hoort PAUSED te zijn');
});

// =================================================================================================
// 5) ReadOnly blokkeert ALLEEN mutaties; read gaat door mét de vlag in de envelop
// =================================================================================================
test('readOnly: read werkt (readOnly-vlag in envelop), mutate ⇒ READ_ONLY', async () => {
  resetFlags();
  store.setState((s) => { s.ui.aiReadOnly = true; });
  const readRes = runReadTool(makeCtx({ readOnly: true }), (s) => s.tasks.length);
  assert(readRes.ok, 'read hoort door te mogen in alleen-lezen-modus');
  if (readRes.ok) assertEq(readRes.envelope.readOnly, true, 'de envelop hoort readOnly:true te tonen');

  const mutRes = await runMutateTool(makeCtx({ readOnly: true }), 'mutate', addTaskOutcome);
  resetFlags();
  assert(!mutRes.ok, 'mutate hoort geweigerd te worden in alleen-lezen-modus');
  if (!mutRes.ok) assertEq(mutRes.code, 'READ_ONLY', 'code hoort READ_ONLY te zijn');
});

// =================================================================================================
// 6) Eerste mutatie bindt het drift-anker aan het actieve document
// =================================================================================================
test('runMutateTool: eerste mutatie met expectedDocId null bindt het anker', async () => {
  resetFlags();
  const ctx = makeCtx();
  assertEq(ctx.expectedDocId, null, 'voorwaarde: het anker start ongebonden');
  const res = await runMutateTool(ctx, 'mutate', addTaskOutcome);
  assert(res.ok, 'de mutatie hoort te slagen');
  assertEq(ctx.expectedDocId, store.getState().activeDocumentId, 'het anker hoort nu op het actieve doc-id te staan');
});

// =================================================================================================
// 7) bindExpectedDoc verzet het anker naar het huidige actieve document
// =================================================================================================
test('bindExpectedDoc: verzet het anker naar het actieve doc-id', () => {
  resetFlags();
  const ctx = makeCtx({ expectedDocId: 'een-oud-verlopen-id' });
  bindExpectedDoc(ctx);
  assertEq(ctx.expectedDocId, store.getState().activeDocumentId, 'bindExpectedDoc hoort het anker op het actieve doc te zetten');
});

// =================================================================================================
// 8) AI-backup: pad ⇒ backupCreated in de envelop, precies één keer aangeroepen
// =================================================================================================
test('runMutateTool: backup-hook geeft pad ⇒ backupCreated precies één keer', async () => {
  resetFlags();
  let calls = 0;
  const ctx = makeCtx({
    ensureBackup: async () => { calls++; return '/appdata/ai-backups/doc/proj-123.ifc'; },
  });
  const res = await runMutateTool(ctx, 'mutate', addTaskOutcome);
  assert(res.ok, 'de mutatie hoort te slagen');
  if (res.ok) assertEq(res.envelope.backupCreated, '/appdata/ai-backups/doc/proj-123.ifc', 'het backup-pad hoort in de envelop te staan');
  assertEq(calls, 1, 'de backup-hook hoort precies één keer aangeroepen te zijn');
});

// =================================================================================================
// 9) AI-backup: reject ⇒ BACKUP_FAILED en de store blijft onaangeroerd (JSON-assert)
// =================================================================================================
test('runMutateTool: backup-hook rejectet ⇒ BACKUP_FAILED, store onaangeroerd', async () => {
  resetFlags();
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  let fnCalled = false;
  const ctx = makeCtx({ ensureBackup: async () => { throw new Error('schijf vol'); } });
  const res = await runMutateTool(ctx, 'mutate', () => { fnCalled = true; return { data: draft.addTask({ name: 'mag-niet' }) }; });
  assert(!res.ok, 'de mutatie hoort geweigerd te worden bij een mislukte backup');
  if (!res.ok) assertEq(res.code, 'BACKUP_FAILED', 'code hoort BACKUP_FAILED te zijn');
  assert(!fnCalled, 'de muterende fn mag niet gedraaid zijn — de backup faalt ervóór');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'de store hoort byte-identiek te zijn (geen mutatie)');
});

// =================================================================================================
// 10) Transactie-rollback: kringverwijzing ⇒ nette CYCLE-code
// =================================================================================================
test('runMutateTool: kring in de transactie ⇒ CYCLE-code, store teruggerold', async () => {
  resetFlags();
  const a = store.getState().addTask({ name: 'cyc-A' });
  const b = store.getState().addTask({ name: 'cyc-B' });
  store.getState().runCPM();
  const res = await runMutateTool(makeCtx(), 'mutate', () => {
    draft.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    draft.addSequence({ predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
    return { data: null };
  });
  assert(!res.ok, 'de mutatie hoort te falen op de kringverwijzing');
  if (!res.ok) assertEq(res.code, 'CYCLE', 'een kringverwijzing hoort code CYCLE te krijgen');
  assertEq(store.getState().sequences.filter((s) => s.predecessorId === a || s.predecessorId === b).length, 0, 'de kring-relaties horen teruggerold te zijn');
});

// =================================================================================================
// 11) Transactie-fout die geen kring is ⇒ VALIDATION-code
// =================================================================================================
test('runMutateTool: niet-kring-transactiefout ⇒ VALIDATION-code', async () => {
  resetFlags();
  const res = await runMutateTool(makeCtx(), 'mutate', () => {
    draft.updateCalendar('onbestaand-kalender-id', { name: 'x' }); // gooit een herkenbare fout
    return { data: null };
  });
  assert(!res.ok, 'de mutatie hoort te falen op de onbekende kalender');
  if (!res.ok) assertEq(res.code, 'VALIDATION', 'een niet-kring-fout hoort code VALIDATION te krijgen');
});

// =================================================================================================
// 12) itemRejections uit de outcome komen in de Ok-respons terecht
// =================================================================================================
test('runMutateTool: itemRejections uit de outcome verschijnen in de Ok-respons', async () => {
  resetFlags();
  const res = await runMutateTool(makeCtx(), 'mutate', () => ({
    data: draft.addTask({ name: 'bulk' }),
    itemRejections: [{ id: 'weg-1', reason: 'onbekend' }],
  }));
  assert(res.ok, 'de mutatie hoort te slagen (zachte weigering is geen harde fout)');
  if (res.ok) {
    assertEq(res.itemRejections, [{ id: 'weg-1', reason: 'onbekend' }], 'de per-item-weigeringen horen mee te komen');
  }
});

// =================================================================================================
// 13) Drift: user-switch buiten ctx om ⇒ DOC_DRIFT met beide id's
// =================================================================================================
test('runMutateTool: user-switch ⇒ DOC_DRIFT met was-X-nu-Y', async () => {
  resetFlags();
  const ctx = makeCtx();
  // Eerste mutatie bindt het anker aan het huidige (bron)document.
  const bind = await runMutateTool(ctx, 'mutate', addTaskOutcome);
  assert(bind.ok, 'de eerste (ankerbindende) mutatie hoort te slagen');
  const srcDoc = ctx.expectedDocId!;

  // Simuleer een user-tabwissel BUITEN de ctx om: een nieuw, actief document.
  store.getState().newDocument();
  const nowDoc = store.getState().activeDocumentId;
  assert(srcDoc !== nowDoc, 'voorwaarde: het actieve document is nu een ander');

  const res = await runMutateTool(ctx, 'mutate', addTaskOutcome);
  assert(!res.ok, 'een mutatie na een user-switch hoort te falen op drift');
  if (!res.ok) {
    assertEq(res.code, 'DOC_DRIFT', 'code hoort DOC_DRIFT te zijn');
    assert(res.error.includes(srcDoc) && res.error.includes(nowDoc), `fout hoort beide id's te noemen, kreeg: ${res.error}`);
    assert(res.error.includes('switch_document'), 'fout hoort naar switch_document te verwijzen');
  }
});

// =================================================================================================
// 14) Tabwissel TIJDENS de backup-await ⇒ DOC_DRIFT; brondocument byte-identiek (spec-volgorde:
//     backup-await → drift-check). De fake-backup wisselt midden in zijn await van tabblad — precies
//     het venster waarin een user-klik `switchDocument`/`newDocument` synchroon kan afvuren.
// =================================================================================================
test('runMutateTool: tabwissel tijdens backup-await ⇒ DOC_DRIFT, brondoc onaangeroerd', async () => {
  resetFlags();
  const srcDoc = store.getState().activeDocumentId;
  store.getState().addTask({ name: 'bron-taak' });
  const srcTasksBefore = JSON.stringify(store.getState().tasks);

  const ctx = makeCtx({
    expectedDocId: srcDoc,
    // Backup-hook die MIDDEN in zijn await van tabblad wisselt (synchrone store-actie op een klik).
    ensureBackup: async () => { store.getState().newDocument(); return null; },
  });
  const res = await runMutateTool(ctx, 'mutate', addTaskOutcome);

  assert(!res.ok, 'een tabwissel tijdens de backup-await hoort op drift te falen');
  if (!res.ok) {
    assertEq(res.code, 'DOC_DRIFT', 'code hoort DOC_DRIFT te zijn (drift-check draait ná de backup-await)');
    assert(res.error.includes(srcDoc), 'de fout hoort het bron-doc-id te noemen');
  }
  // Het brondocument staat nu geparkeerd in de registry en mag geen mutatie hebben gekregen.
  const srcPayload = store.getState().documents.find((d) => d.id === srcDoc)?.payload;
  assert(srcPayload != null, 'het brondocument hoort geparkeerd in de registry te staan');
  assertEq(JSON.stringify(srcPayload!.tasks), srcTasksBefore, 'de taken van het brondocument horen byte-identiek te zijn (geen mutatie)');
});

// =================================================================================================
// 15) Envelop-versheid: de succes-envelop toont de POST-mutatie-waarden. De transactie draait aan het
//     eind runCPM (⇒ scheduleStale false) en de mutatie hernoemt het project (⇒ nieuwe titel); beide
//     moeten in de envelop de ná-waarde tonen, niet de vóór-waarde.
// =================================================================================================
test('runMutateTool: succes-envelop toont post-mutatie scheduleStale én documenttitel', async () => {
  resetFlags();
  store.setState((s) => { s.scheduleStale = true; s.filePath = null; });
  const staleBefore = store.getState().scheduleStale;
  const titleBefore = store.getState().getOpenDocuments().find((d) => d.isActive)!.title;
  assert(staleBefore === true, 'voorwaarde: scheduleStale start op true');

  const res = await runMutateTool(makeCtx(), 'mutate', () => {
    draft.setProject({ name: 'Post-mutatie Titel' });
    return { data: null };
  });

  assert(res.ok, 'de mutatie hoort te slagen');
  if (res.ok) {
    assertEq(res.envelope.scheduleStale, false, 'de eind-runCPM maakt de planning vers ⇒ envelop toont false (post), niet de pre-waarde true');
    assert(res.envelope.scheduleStale !== staleBefore, 'scheduleStale vóór ≠ ná');
    assertEq(res.envelope.documentTitle, 'Post-mutatie Titel', 'de envelop toont de post-mutatie projecttitel');
    assert(res.envelope.documentTitle !== titleBefore, 'documenttitel vóór ≠ ná');
  }
});

// =================================================================================================
// 16) McpStepError uit de handler ⇒ díe code overleeft de transactie-rollback (i.p.v. de
//     string-heuristiek); de store rolt schoon terug.
// =================================================================================================
test('runMutateTool: McpStepError in de handler ⇒ die exacte code, store teruggerold', async () => {
  resetFlags();
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const res = await runMutateTool(makeCtx(), 'mutate', () => {
    draft.addTask({ name: 'wordt-teruggerold' }); // muteert binnen de transactie
    throw new McpStepError('NOT_FOUND', 'de doeltaak bestaat niet');
  });
  assert(!res.ok, 'de mutatie hoort te falen op de McpStepError');
  if (!res.ok) {
    assertEq(res.code, 'NOT_FOUND', 'de expliciete McpStepError-code hoort te winnen van de heuristiek');
    assert(res.error.includes('de doeltaak bestaat niet'), 'de boodschap van de McpStepError hoort mee te komen');
  }
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'de store hoort schoon teruggerold te zijn (geen achtergebleven taak)');
});

// =================================================================================================
// 17) guardNonTransactional (undo/redo/run_cpm): zelfde guards, ZONDER backup/transactie.
// =================================================================================================
test('guardNonTransactional: paused ⇒ PAUSED; schoon ⇒ null + anker gebonden; drift ⇒ DOC_DRIFT', async () => {
  resetFlags();
  // paused blokkeert.
  const pausedErr = guardNonTransactional(makeCtx({ paused: true }));
  assert(pausedErr !== null && pausedErr.code === 'PAUSED', 'gepauzeerd hoort een PAUSED-fout te geven');

  // Schoon ⇒ null, en het losse anker wordt gebonden.
  const ctx = makeCtx();
  const ok = guardNonTransactional(ctx);
  assertEq(ok, null, 'zonder blokkade hoort guardNonTransactional null te geven');
  assertEq(ctx.expectedDocId, store.getState().activeDocumentId, 'het anker hoort gebonden te zijn aan het actieve doc');

  // Gebonden anker + user-switch ⇒ DOC_DRIFT (geen backup/transactie in het spel).
  store.getState().newDocument();
  const driftErr = guardNonTransactional(ctx);
  assert(driftErr !== null && driftErr.code === 'DOC_DRIFT', 'na een user-switch hoort guardNonTransactional DOC_DRIFT te geven');
});

// =================================================================================================
// 18) toolError: paused/readOnly in de fout-envelop komen uit ctx.
// =================================================================================================
test('toolError: envelop-paused/readOnly worden uit ctx overschreven', () => {
  resetFlags(); // ui-vlaggen staan nu op false
  const err = toolError(makeCtx({ paused: true, readOnly: true }), 'SCOPE', 'buiten bereik');
  assert(!err.ok, 'toolError hoort een McpToolErr te zijn');
  assertEq(err.code, 'SCOPE', 'de code hoort te kloppen');
  assert(err.envelope != null, 'de fout hoort een envelop te dragen');
  assertEq(err.envelope!.paused, true, 'envelop-paused hoort de ctx-waarde (true) te tonen, niet de live ui-waarde (false)');
  assertEq(err.envelope!.readOnly, true, 'envelop-readOnly hoort de ctx-waarde (true) te tonen');
});

await run();
