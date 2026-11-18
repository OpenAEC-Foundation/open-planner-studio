// #804 PR 11a: echte documentacties, volledige heropening of bewijs van nul schrijfacties.
// Bronobjecten alleen op identiteit vergelijken; nooit een assert-diff van bronbytes maken.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildExportIFCInput, buildWriteIFCInput } from '@/state/ifcSaveInput';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { writeIFC, writeIFCWithChoices } from '@/services/ifc/ifcWriter';
import { askPlanOnly, resetPlanOnlyAsker, setPlanOnlyAsker, type PlanOnlyReason } from '@/services/ifc/planOnlyQuestion';
import { hasForeignContent } from '@/services/ifc/foreign/ifcSource';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { classify } from '@/services/ifc/foreign/classify';
import { prepareIfcOutput, IfcWriteBlockedError } from '@/state/prepareIfcOutput';
import { refusedWriteTarget, ifcFullWriteBlocked, ifcSaveBlocked } from '@/state/ifcForeignGuard';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { closeProjectFileWrites } from '@/services/fileAccess/writeCoordinator';
import { setSiteSaveAsker, resetSiteAskers } from '@/services/fileAccess/siteDialogs';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { openInStore, loadStore } from './ifcAppRoute';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { flushRecoveryNow, registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { byteWrite, installNodeFileIpc } from './nodeFileIpc';
import { installDeterminism } from './ifcPariteitKern';
import { canon, firstDiff, mergeProblems, openForeign, shownAfterOpen } from './ifcMergeKern';

const reseed = installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const dir = mkdtempSync(join(tmpdir(), 'ops-document-save-'));
type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const longer = (store: Store) => {
  const state = store.getState(), task = state.tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  state.updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
  store.getState().runCPM();
  return task.id;
};
let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  console.log(`START ${name}`);
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.message : error).slice(0, 1600)}`); }
}
/** Het eigen tijdelijke bestand van de nieuwe-naamroute (knownbug 1131 stap 4). */
const isTemp = (path: string | undefined) => /[\\/]save-[0-9a-z]+\.ops-save\.tmp$/.test(path ?? '');
const tempLeft = () => readdirSync(dir).filter(name => isTemp(join(dir, name)));
/** Nam deze route de nieuwe weg: één `createNew` in het eigen tijdelijke bestand en één plaatsing op `target`? */
function tookTempRoute(calls: readonly { command: string; path?: string; options?: { createNew?: boolean } }[], target: string) {
  assert.deepEqual(calls.filter(c => c.command === 'plugin:fs|write_file').map(c => [isTemp(c.path), c.options?.createNew]), [[true, true]],
    'de hele buffer in het eigen tijdelijke bestand, niet in het doel');
  assert.deepEqual(calls.filter(c => c.command === 'place_file_exclusive').map(c => c.path), [target], 'één plaatsing op het doel');
}
function desktop() {
  const ipc = installNodeFileIpc();
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const invoke = win.__TAURI_INTERNALS__.invoke;
  let answer: string | null = null, picks = 0;
  let onPick: (() => void) | undefined;
  win.__TAURI_INTERNALS__.invoke = async (...args) => {
    if (args[0] === 'plugin:dialog|save') { picks++; onPick?.(); return answer; }
    return invoke(...args);
  };
  return { ...ipc, choose: (name: string | null) => { answer = name; }, picks: () => picks, onPick: (action: () => void) => { onPick = action; } };
}
await check('desktop: duur, nieuwe naam, resource, tweede nieuwe naam; volledig heropenen', async () => {
  const { store } = await openInStore(bytes);
  const ipc = desktop();
  try {
    const id = longer(store), duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
    const first = join(dir, 'eerste.ifc'); ipc.choose(first);
    const calls = ipc.calls.length;
    await store.getState().saveFileAs();
    assert(existsSync(first), 'Opslaan als schreef een nieuw bestand');
    tookTempRoute(ipc.calls.slice(calls), first);
    assert.deepEqual(tempLeft(), [], 'geen hulpbestand achtergebleven');
    const output = new Uint8Array(readFileSync(first));
    assert.deepEqual(mergeProblems(bytes, output), [], 'het vreemde deel blijft bytegelijk');
    const reopened = await openForeign(output);
    assert.equal(reopened.tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    const current = store.getState();
    assert.equal(current.filePath, first); assert.equal(current.isDirty, false);
    current.addResource({ name: 'Nieuwe resource 11a', type: 'EQUIPMENT', description: '', maxUnits: 2, costPerHour: 37.5 });
    const second = join(dir, 'tweede.ifc'); ipc.choose(second);
    await store.getState().saveFileAs();
    assert(existsSync(second));
    const again = new Uint8Array(readFileSync(second)), opened = await openForeign(again);
    assert.deepEqual(mergeProblems(bytes, again), []);
    assert.equal(opened.tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    assert(opened.resources.some(r => r.name === 'Nieuwe resource 11a'));
    assert.equal(hash(current.ifcSource!.bytes), hash(output), 'de tweede opslag bouwde op de eerste geschreven bron');
    assert.equal(current.foreignSourceMark!.filePath, first);
    assert.equal(current.foreignSourceMark!.sha256, hash(output));
    assert.equal(store.getState().foreignSourceMark!.filePath, second);
    assert.equal(store.getState().foreignSourceMark!.sha256, hash(again));
  } finally { ipc.dispose(); }
});

await check('eigen repobestand zonder bewerking: volledig en bytegelijk opslaan', async () => {
  const { store } = await openInStore(bytes), ipc = desktop(), target = join(dir, 'ongewijzigd.ifc');
  ipc.choose(target);
  try {
    await store.getState().saveFileAs();
    assert(existsSync(target), 'het eigen repobestand schrijft zonder bewerking');
    const output = new Uint8Array(readFileSync(target));
    assert.equal(hash(output), hash(bytes)); await openForeign(output);
  } finally { ipc.dispose(); }
});

const preserved = (store: Store) => {
  const s = store.getState();
  return { source: s.ifcSource, mark: s.foreignSourceMark, path: s.filePath, handle: s.fileHandle,
    site: s.siteFileId, version: s.siteFileVersion, dirty: s.isDirty };
};
function unchanged(store: Store, before: ReturnType<typeof preserved>) {
  const now = preserved(store);
  assert(now.source === before.source, 'bronidentiteit intact');
  assert(now.mark === before.mark, 'kenmerk intact');
  assert(now.handle === before.handle);
  assert.deepEqual([now.path, now.site, now.version, now.dirty], [before.path, before.site, before.version, before.dirty]);
}
async function openAt(ref: import('@/services/fileAccess').FileRef, data = bytes) {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes: data, ref });
  assert(store.getState().ifcSource, 'echte bytes-openroute afgerond');
  return store;
}
function assertNotice(store: Store, key: string) {
  assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey), [key]);
  assert.equal(store.getState().ui.notifications.find(n => n.messageKey === key)?.count, 1, 'één weigering');
}
const clearNotices = (store: Store) => store.setState(s => { s.ui.notifications = []; });

await check('Ctrl+S en sluitvraag: origineel en zojuist gemaakte naam, nul bytes', async () => {
  const ipc = desktop();
  try {
    const original = join(dir, 'origineel.ifc'); writeFileSync(original, bytes);
    const store = await openAt({ kind: 'path', path: original });
    for (const step of [0, 1]) {
      if (step === 1) { ipc.choose(join(dir, 'voor-ctrl-s.ifc')); await store.getState().saveFileAs(); }
      longer(store); clearNotices(store);
      const before = preserved(store), oldBytes = hash(new Uint8Array(readFileSync(before.path!))), calls = ipc.calls.length;
      assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), false);
      unchanged(store, before);
      assertNotice(store, 'notifications.ifcForeignReplaceBlocked');
      assert.equal(hash(new Uint8Array(readFileSync(before.path!))), oldBytes);
      assert.equal(ipc.calls.slice(calls).some(c => c.options?.write || byteWrite(c)), false,
        'de doelcontrole stopt vóór iedere schrijfpoging');
      clearNotices(store);
      let closed = false;
      await createCloseDocumentDialogActions({
        pendingId: store.getState().activeDocumentId, getActiveDocumentId: () => store.getState().activeDocumentId,
        switchDocument: store.getState().switchDocument, closeDocument: () => { closed = true; },
        saveFile: () => store.getState().saveFileForDocument(store.getState().activeDocumentId),
        clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
      }).save();
      assert.equal(closed, false); unchanged(store, before);
    }
  } finally { ipc.dispose(); }
});

await check('Opslaan als bestaand eigen bestand: de plaatsing weigert, oude bytes intact, dezelfde zin als Exporteren', async () => {
  const { store } = await openInStore(bytes); longer(store);
  const ipc = desktop(), target = join(dir, 'bestaand.ifc');
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  writeFileSync(target, plain); ipc.choose(target);
  const before = preserved(store);
  try {
    const calls = ipc.calls.length;
    clearNotices(store); await store.getState().saveFileAs(); unchanged(store, before);
    assert.equal(hash(new Uint8Array(readFileSync(target))), hash(plain));
    // Knownbug 1760: geen interne tekst ("Byte-delen … (create-new)"), maar de zin van Exporteren.
    assertNotice(store, 'notifications.ifcForeignNewTargetOnly');
    tookTempRoute(ipc.calls.slice(calls), target);
    assert.deepEqual(tempLeft(), [], 'het eigen hulpbestand is weg');
  } finally { ipc.dispose(); }
});

for (const fault of ['annuleren', 'I/O-fout', 'document-gesloten', 'nieuwe-bron', 'flag-uit-na-kiezer'] as const) {
  await check(`${fault}: na voorbereiden nul bytes, bron en doel intact`, async () => {
    const { store } = await openInStore(bytes); longer(store);
    const before = preserved(store), id = store.getState().activeDocumentId;
    const ipc = desktop(), target = join(dir, `${fault.replace('/', '-')}.ifc`);
    ipc.choose(fault === 'annuleren' ? null : target);
    if (fault === 'I/O-fout') ipc.faults.writeErrorAfter = 2;
    let expectedSource = before.source;
    // #804 stap 3: niet de documentwissel maar het verdwijnen van het document weigert (zie de proef hieronder).
    if (fault === 'document-gesloten') ipc.onPick(() => { store.getState().newDocument(); store.getState().closeDocument(id); });
    if (fault === 'flag-uit-na-kiezer') ipc.onPick(() => { store.setState(s => { s.ui.featureFlags = {}; }); });
    if (fault === 'nieuwe-bron') {
      const other = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), before.source!);
      expectedSource = other.source;
      ipc.onPick(() => { store.getState().commitSavedDocument(id, store.getState(), undefined, other); });
    }
    try {
      await store.getState().saveFileAs();
      assert.equal(existsSync(target), false);
      if (fault === 'document-gesloten') {
        assert.equal(store.getState().documents.some(d => d.id === id), false);
        assertNotice(store, 'notifications.ifcSaveChangedWhileWaiting');
      } else if (fault === 'nieuwe-bron') {
        assert(store.getState().ifcSource === expectedSource, 'de inmiddels gecommitte bron blijft staan');
        assert.equal(store.getState().filePath, before.path);
      } else unchanged(store, before);
      if (fault === 'I/O-fout') {
        assert(ipc.calls.some(c => c.wrote && isTemp(c.path)), 'de schrijffout is werkelijk bereikt, in het tijdelijke bestand');
        assert.equal(ipc.calls.some(c => c.command === 'place_file_exclusive'), false, 'niets geplaatst');
        assert.deepEqual(tempLeft(), [], 'het eigen hulpbestand is weg');
        assertNotice(store, 'notifications.saveFailed');
      }
    } finally { ipc.dispose(); }
  });
}

/** Een tweede document met eigen, herkenbare inhoud: het mag door een opslag van het andere document nooit geraakt worden. */
function otherDocument(store: Store) {
  const id = store.getState().newDocument();
  store.getState().addTask({ name: 'Taak van het andere document' });
  const s = store.getState();
  return { id, tasks: s.tasks, ifcSource: s.ifcSource, mark: s.foreignSourceMark, filePath: s.filePath, handle: s.fileHandle };
}
/** Het andere document is nog actief en precies zoals het was. */
function otherUntouched(store: Store, other: ReturnType<typeof otherDocument>) {
  const s = store.getState();
  assert.equal(s.activeDocumentId, other.id, 'het andere document blijft actief');
  assert(s.tasks === other.tasks, 'zijn taken zijn niet aangeraakt');
  assert(s.ifcSource === other.ifcSource && s.foreignSourceMark === other.mark, 'zijn bron en kenmerk zijn niet aangeraakt');
  assert.equal(s.filePath, other.filePath); assert(s.fileHandle === other.handle, 'zijn doel is niet aangeraakt');
  assert.equal(s.isDirty, true, 'het blijft gewijzigd');
}
const payloadOf = (store: Store, id: string) => store.getState().getOpenDocumentPayloads().find(d => d.id === id)!.payload;

await check('Opslaan als met een tabbladwissel tijdens de bestandskiezer: het slapende document wordt opgeslagen en vastgelegd (#804 stap 3)', async () => {
  const { store } = await openInStore(bytes); const edited = longer(store);
  const id = store.getState().activeDocumentId, duration = store.getState().tasks.find(t => t.id === edited)!.time.scheduleDuration;
  const ipc = desktop(), target = join(dir, 'tabbladwissel.ifc');
  let other: ReturnType<typeof otherDocument> | undefined;
  ipc.choose(target); ipc.onPick(() => { other = otherDocument(store); });
  try {
    clearNotices(store);
    await store.getState().saveFileAs();
    assert(existsSync(target), 'het bestand is geschreven');
    const output = new Uint8Array(readFileSync(target)), saved = payloadOf(store, id);
    assert.deepEqual(mergeProblems(bytes, output), [], 'het vreemde deel blijft bytegelijk');
    const reopened = await openForeign(output);
    assert.equal(reopened.tasks.find(t => t.id === edited)!.time.scheduleDuration, duration, 'de inhoud van het opgeslagen document');
    assert.equal(reopened.tasks.some(t => t.name === 'Taak van het andere document'), false, 'niets van het andere document');
    assert.equal(saved.filePath, target); assert.equal(saved.isDirty, false);
    assert.equal(saved.ifcSource!.sha256, hash(output)); assert.equal(saved.foreignSourceMark!.sha256, hash(output));
    otherUntouched(store, other!);
    assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').length, 0);
  } finally { ipc.dispose(); }
});

function browserDownload() {
  const win = window as unknown as Record<string, unknown>;
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL, downloads: Blob[] = [];
  URL.createObjectURL = blob => { assert(blob instanceof Blob); downloads.push(blob); return 'blob:document-test'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ href: '', download: '', click: () => {} }),
    // Het voortgangsblad laadt `@/i18n/config`, dat de taalrichting op het document zet.
    documentElement: {},
  } });
  win.showSaveFilePicker = () => { throw new Error('een vreemde browseropslag moet downloaden'); };
  return { downloads, dispose: () => {
    URL.createObjectURL = create; URL.revokeObjectURL = revoke; delete win.showSaveFilePicker;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  } };
}
await check('download: twee volledige heropeningen, bron/doel/kenmerk blijven bij openen', async () => {
  const { store } = await openInStore(bytes), browser = browserDownload();
  try {
    const id = longer(store), duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
    const before = preserved(store);
    await store.getState().saveFileAs();
    assert.equal(browser.downloads.length, 1);
    const first = new Uint8Array(await browser.downloads[0].arrayBuffer()), reopened = await openForeign(first);
    assert.deepEqual(mergeProblems(bytes, first), []);
    assert.equal(reopened.tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    unchanged(store, { ...before, dirty: false });
    store.getState().addResource({ name: 'Resource na download', type: 'EQUIPMENT', description: '', maxUnits: 2, costPerHour: 37.5 });
    await store.getState().saveFileAs();
    assert.equal(browser.downloads.length, 2);
    const second = new Uint8Array(await browser.downloads[1].arrayBuffer()), again = await openForeign(second);
    assert.deepEqual(mergeProblems(bytes, second), []);
    assert.equal(again.tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    assert(again.resources.some(r => r.name === 'Resource na download'));
    unchanged(store, { ...before, dirty: false });
  } finally { browser.dispose(); }
});

for (const kind of ['nieuw', 'versie', 'conflictkopie', 'zonder-basis'] as const) {
  await check(`site ${kind}: volledig bestand of zonder basis nul bytes`, async () => {
    const win = window as unknown as Record<string, unknown>, requests: { id?: string; data: Blob; baseVersion?: string }[] = [];
    win.openaecHost = { storage: {
      list: async () => [], versions: async () => [], open: async () => ({ data: new Blob([bytes.buffer]), name: 'bron.ifc', version: 'v1' }),
      save: async (request: { id?: string; data: Blob; baseVersion?: string }) => {
        requests.push(request);
        return { id: request.id ?? 'nieuw', name: 'hostnaam.ifc', version: 'v2' };
      },
    } };
    if (kind === 'conflictkopie') win.openaecHost = {
      list: async () => [], versions: async () => [], open: async () => ({ bytes, name: 'bron.ifc', version: 'v1' }),
      save: async (data: Uint8Array, options: { id?: string; expectedVersion?: string }) => {
        requests.push({ id: options.id, data: new Blob([new Uint8Array(data).buffer]), baseVersion: options.expectedVersion });
        return { id: 'kopie', name: 'conflict.ifc', version: 'v9', conflictCopy: true };
      },
    };
    setSiteSaveAsker(async () => ({ kind: 'site', name: 'nieuw.ifc' }));
    try {
      const store = kind === 'nieuw' ? (await openInStore(bytes)).store : await openAt({ kind: 'site', id: 'bron' });
      if (kind !== 'nieuw') store.setState(s => { s.siteFileVersion = kind === 'zonder-basis' ? null : 'v1'; });
      const id = longer(store), duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
      const before = preserved(store), expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), before.source!);
      clearNotices(store);
      if (kind === 'nieuw') await store.getState().saveFileAs(); else await store.getState().saveFile();
      if (kind === 'zonder-basis') { assert.equal(requests.length, 0); unchanged(store, before); return; }
      assert.equal(requests.length, 1);
      assert.equal(requests[0].baseVersion, kind === 'nieuw' ? undefined : 'v1');
      const output = new Uint8Array(await requests[0].data.arrayBuffer()), reopened = await openForeign(output);
      assert.equal(hash(output), expected.sha256, 'de host krijgt precies het voorbereide resultaat');
      assert.deepEqual(mergeProblems(bytes, output), []);
      assert.equal(reopened.tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
      assert.equal(store.getState().siteFileId, kind === 'conflictkopie' ? 'kopie' : kind === 'nieuw' ? 'nieuw' : 'bron');
      assert.equal(store.getState().siteFileVersion, kind === 'conflictkopie' ? 'v9' : 'v2');
      assert.equal(store.getState().foreignSourceMark!.siteFileId, store.getState().siteFileId);
      assert.equal(store.getState().foreignSourceMark!.sha256, hash(output));
      assert.equal(hash(store.getState().ifcSource!.bytes), hash(output));
      assert.equal(store.getState().isDirty, false);
    } finally { delete win.openaecHost; resetSiteAskers(); }
  });
}

for (const cause of ['flag-uit', 'sourceMissing'] as const) await check(`${cause}: alle documentroutes nul bytes`, async () => {
  const { store } = await openInStore(bytes); longer(store);
  store.setState(s => {
    if (cause === 'flag-uit') s.ui.featureFlags = {};
    else s.foreignSourceMark = { ...s.foreignSourceMark!, sourceMissing: true };
  });
  const before = preserved(store), browser = browserDownload();
  try {
    for (const site of [false, true]) {
      const win = window as unknown as Record<string, unknown>;
      let siteCalls = 0;
      if (site) win.openaecHost = { storage: { list: async () => [], open: async () => null, versions: async () => [], save: async () => { siteCalls++; throw new Error('geen writes'); } } };
      for (const save of [() => store.getState().saveFile(), () => store.getState().saveFileAs(), () => store.getState().saveFileForDocument(store.getState().activeDocumentId)]) {
        clearNotices(store); await save(); unchanged(store, before); assertNotice(store, cause === 'sourceMissing' ? 'notifications.ifcForeignSourceMissing' : 'notifications.ifcForeignSaveBlocked');
      }
      assert.equal(siteCalls, 0); delete win.openaecHost;
    }
    assert.equal(browser.downloads.length, 0);
    const ipc = desktop(); ipc.choose(join(dir, `${cause}.ifc`));
    try { await store.getState().saveFileAs(); assert.equal(ipc.picks(), 0); unchanged(store, before); }
    finally { ipc.dispose(); }
  } finally { browser.dispose(); }
});

await check('mergeweigering vóór bestandskiezer: nul bytes en ongewijzigd document', async () => {
  const unsupported = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc')));
  const { store } = await openInStore(unsupported);
  longer(store);
  const before = preserved(store), ipc = desktop(); ipc.choose(join(dir, 'weigering.ifc'));
  try {
    clearNotices(store); await store.getState().saveFileAs();
    assert.equal(ipc.picks(), 0, 'getypeerde weigering vóór de kiezer');
    assert.equal(existsSync(join(dir, 'weigering.ifc')), false);
    unchanged(store, before); assertNotice(store, 'notifications.ifcForeignMergeRefused');
  } finally { ipc.dispose(); }
});

await check('doorwerken tijdens schrijven: bron volgt schijf, bewerking blijft dirty en gaat mee naar volgende naam', async () => {
  const { store } = await openInStore(bytes); const id = longer(store);
  const ipc = desktop(), first = join(dir, 'doorwerken.ifc'), second = join(dir, 'doorwerken-twee.ifc');
  ipc.choose(first);
  let edited = false;
  ipc.faults.beforeOpen = path => {
    if (!isTemp(path) || edited) return; edited = true;
    store.getState().updateTask(id, { name: 'Tijdens schrijven gewijzigd' });
  };
  try {
    await store.getState().saveFileAs();
    assert(edited); assert.equal(store.getState().isDirty, true);
    assert.equal(store.getState().ifcSource!.sha256, hash(new Uint8Array(readFileSync(first))));
    assert.notEqual((await openForeign(new Uint8Array(readFileSync(first)))).tasks.find(t => t.id === id)!.name, 'Tijdens schrijven gewijzigd');
    ipc.choose(second); await store.getState().saveFileAs();
    const output = new Uint8Array(readFileSync(second)), reopened = await openForeign(output);
    assert.equal(reopened.tasks.find(t => t.id === id)!.name, 'Tijdens schrijven gewijzigd');
    assert.deepEqual(mergeProblems(bytes, output), []); assert.equal(store.getState().isDirty, false);
  } finally { ipc.dispose(); }
});

await check('zonder vreemd deel en flag aan: beide acties bytegelijk aan de gewone writer, bestaand doel vervangbaar', async () => {
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  const ipc = desktop(), first = join(dir, 'gewoon-bron.ifc'), second = join(dir, 'gewoon-doel.ifc');
  writeFileSync(first, plain); writeFileSync(second, plain);
  try {
    const store = await openAt({ kind: 'path', path: first }, plain), source = store.getState().ifcSource;
    assert.equal(ifcSaveBlocked(store.getState()), false); assert.equal(ifcFullWriteBlocked(store.getState()), false);
    for (const as of [false, true]) {
      longer(store); const expected = new TextEncoder().encode(writeIFC(buildWriteIFCInput(store.getState(), 'merge')));
      if (as) { ipc.choose(second); await store.getState().saveFileAs(); } else await store.getState().saveFile();
      const output = new Uint8Array(readFileSync(as ? second : first));
      assert.equal(hash(output), hash(expected)); await openForeign(output);
      assert(store.getState().ifcSource === source, 'de verouderde niet-vreemde bron bereikt de merge niet (1555)');
      assert.equal(store.getState().isDirty, false);
    }
    assert.notEqual(hash(new Uint8Array(readFileSync(second))), source!.sha256);
    assert.equal(ipc.calls.some(c => c.command === 'plugin:fs|rename'), true, 'de gewone vervangingsroute blijft staan');
  } finally { ipc.dispose(); }
});

await check('AutoSave: nul bytes, één bestaande melding per document per sessie', async () => {
  const ipc = desktop(), original = join(dir, 'autosave-bron.ifc'); writeFileSync(original, bytes);
  try {
    const store = await openAt({ kind: 'path', path: original }); longer(store);
    store.setState(s => { s.autoSaveToFile = true; }); clearNotices(store);
    const before = preserved(store), count = ipc.calls.length;
    const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true });
    await controller.flush(); await controller.flush();
    unchanged(store, before); assertNotice(store, 'notifications.ifcForeignSaveBlocked');
    assert.equal(ipc.calls.length, count); assert.equal(hash(new Uint8Array(readFileSync(original))), hash(bytes));
  } finally { ipc.dispose(); }
});

await check('planOnly met vreemd deel: bewaakte voorbereiding weigert vóór I/O', async () => {
  const { store } = await openInStore(bytes);
  let refused = false;
  try { await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'planOnly')); }
  catch (error) { refused = error instanceof IfcWriteBlockedError; }
  assert(refused, 'planOnly mag geen IFC-bestand zonder model afleveren');
});

await check('site-uitzondering is aan één schrijvend document gebonden; export krijgt haar nooit', async () => {
  const store = await openAt({ kind: 'site', id: 'model-site' });
  store.setState(s => { s.siteFileVersion = 'v1'; });
  const snapshot = store.getState(), target = { kind: 'site' as const, id: 'model-site' };
  const deps = { identityFs: async () => undefined, readers: () => ({}) };
  assert.equal(await refusedWriteTarget(snapshot, target, deps), 'open-source', 'een export krijgt nooit de uitzondering');
  assert.equal(await refusedWriteTarget(snapshot, target, deps, {
    documentId: snapshot.activeDocumentId, baseVersion: 'v1', source: snapshot.ifcSource!,
  }), null, 'volledige documentopslag naar eigen siteversie mag');
  for (const documentId of ['ander-document', snapshot.activeDocumentId]) {
    assert.equal(await refusedWriteTarget(snapshot, target, deps, {
      documentId, baseVersion: documentId === snapshot.activeDocumentId ? 'verkeerde-basis' : 'v1', source: snapshot.ifcSource!,
    }), 'open-source', 'ander document of andere basis geeft geen uitzondering');
  }
});

await check('IFC-export desktop: volledig bestand, document intact, daarna Opslaan als op de openingsbron', async () => {
  const original = join(dir, 'export-bron.ifc'); writeFileSync(original, bytes);
  const store = await openAt({ kind: 'path', path: original }), ipc = desktop();
  try {
    const id = longer(store), before = preserved(store), literal = store.getState().ifcLiteralCalendarIds;
    const target = join(dir, 'export-volledig.ifc'); ipc.choose(target);
    const calls = ipc.calls.length;
    const result = await store.getState().exportAs('ifc');
    assert(result.ok && !result.cancelled, 'IFC-export schrijft');
    assert(existsSync(target), 'nieuw exportbestand bestaat');
    tookTempRoute(ipc.calls.slice(calls), target);
    const output = new Uint8Array(readFileSync(target)), reopened = await openForeign(output);
    assert.deepEqual(mergeProblems(bytes, output), []);
    assert.equal(reopened.tasks.find(t => t.id === id)!.time.scheduleDuration,
      store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration);
    unchanged(store, before);
    assert(store.getState().ifcLiteralCalendarIds === literal, 'export legt geen letterlijke kalenders vast');
    store.getState().addResource({ name: 'Na export', type: 'EQUIPMENT', description: '', maxUnits: 2, costPerHour: 37.5 });
    const saved = join(dir, 'opslag-na-export.ifc'); ipc.choose(saved);
    await store.getState().saveFileAs();
    const again = new Uint8Array(readFileSync(saved)), after = await openForeign(again);
    assert.deepEqual(mergeProblems(bytes, again), []);
    assert(after.resources.some(r => r.name === 'Na export'));
    assert.equal(after.tasks.find(t => t.id === id)!.time.scheduleDuration, reopened.tasks.find(t => t.id === id)!.time.scheduleDuration);
    // Een gesloten exportbestand blijft op inhoud beschermd tegen een gewone planningwrite.
    store.getState().newDocument(); ipc.choose(target);
    assert.equal((await store.getState().exportAs('ifc')).ok, true);
    assert.equal(hash(new Uint8Array(readFileSync(target))), hash(output));
    assertNotice(store, 'notifications.ifcForeignTargetExport');
  } finally { ipc.dispose(); }
});

for (const kind of ['bestaand', 'eigen-bron', 'andere-bron'] as const) await check(`IFC-export ${kind}: nul bytes, één melding`, async () => {
  const target = join(dir, `export-${kind}.ifc`);
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  writeFileSync(target, kind === 'bestaand' ? plain : bytes);
  const store = kind === 'bestaand' ? (await openInStore(bytes)).store : await openAt({ kind: 'path', path: target });
  if (kind === 'andere-bron') {
    store.getState().newDocument();
    await store.getState().openOpenedFile({ name: 'ander.ifc', content: '', bytes, ref: null });
  }
  longer(store); const before = preserved(store), ipc = desktop(), oldHash = hash(new Uint8Array(readFileSync(target)));
  ipc.choose(target);
  try {
    clearNotices(store); const result = await store.getState().exportAs('ifc');
    assert(result.ok && result.cancelled); unchanged(store, before);
    assert.equal(hash(new Uint8Array(readFileSync(target))), oldHash);
    // Een bestaand doel: alleen het eigen tijdelijke bestand werd geschreven, de plaatsing weigerde en het is weer weg.
    assert.deepEqual(ipc.calls.filter(c => c.wrote).map(c => isTemp(c.path)), kind === 'bestaand' ? [true] : []);
    assert.deepEqual(tempLeft(), []);
    assertNotice(store, kind === 'bestaand' ? 'notifications.ifcForeignNewTargetOnly' : 'notifications.ifcForeignTargetExport');
  } finally { ipc.dispose(); }
});

// Knownbug 1131 stap 4: `source-changed` na de plaatsing. De stand op schijf is onbekend: na de plaatsing raakt de app
// niets meer aan, het document blijft zoals het was (niet opgeslagen) en de planner krijgt de eigen zin.
for (const route of ['Opslaan als', 'Exporteren'] as const) await check(`${route}: source-changed laat alles staan, eigen melding`, async () => {
  const { store } = await openInStore(bytes); longer(store);
  const ipc = desktop(), target = join(dir, `onbekend-${route === 'Opslaan als' ? 'opslag' : 'export'}.ifc`);
  ipc.choose(target);
  ipc.faults.place = (_from, _to, real) => { real(); return { reject: { code: 'source-changed' } }; };
  const before = preserved(store);
  try {
    clearNotices(store);
    if (route === 'Opslaan als') await store.getState().saveFileAs();
    else {
      const result = await store.getState().exportAs('ifc');
      assert(result.ok && result.cancelled, 'de export telt niet als geslaagd');
    }
    unchanged(store, before);
    const calls = ipc.calls, at = calls.findIndex(c => c.command === 'place_file_exclusive');
    assert(at >= 0, 'de route plaatste');
    assert.deepEqual(calls.slice(at + 1).filter(c => c.command.startsWith('plugin:fs|')).map(c => c.command), [],
      'na de plaatsing geen schrijf-, verwijder- of leesactie');
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey),
      ['notifications.ifcForeignPlaceUnknown']);
    assert.equal(existsSync(target), true, 'wat de stap achterliet, blijft staan');
  } finally { ipc.dispose(); }
});

await check('IFC-export browser: volledige download, bron/doel/dirty/kalenders intact', async () => {
  const { store } = await openInStore(bytes); const id = longer(store);
  const before = preserved(store), literal = store.getState().ifcLiteralCalendarIds, browser = browserDownload();
  try {
    const result = await store.getState().exportAs('ifc');
    assert(result.ok && !result.cancelled); assert.equal(browser.downloads.length, 1);
    const output = new Uint8Array(await browser.downloads[0].arrayBuffer()), reopened = await openForeign(output);
    assert.deepEqual(mergeProblems(bytes, output), []);
    assert.equal(reopened.tasks.find(t => t.id === id)!.time.scheduleDuration, store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration);
    unchanged(store, before); assert(store.getState().ifcLiteralCalendarIds === literal);
    assert(!store.getState().ui.notifications.some(n => n.messageKey === 'notifications.exportPlanOnly'), 'IFC draagt het gebouwmodel: geen zin');
  } finally { browser.dispose(); }
});

// Knownbug 1740 (besluit van de eigenaar, 16 november 2026): geen vraag vooraf, wel een zin na afloop. Alleen met een
// gebouwmodel en de flag aan; verder dezelfde meldingen als zonder die zin, en vanuit een gewoon document niets nieuws.
const PLAN_ONLY_EXPORT = 'notifications.exportPlanOnly';
async function exportNotices(store: Store, format: import('@/services/formatRegistry').ExportFormat) {
  clearNotices(store);
  const before = preserved(store), browser = browserDownload();
  try {
    const result = await store.getState().exportAs(format);
    assert(result.ok && !result.cancelled, `${format}: geëxporteerd`); assert.equal(browser.downloads.length, 1);
  } finally { browser.dispose(); }
  unchanged(store, before);
  return store.getState().ui.notifications.map(n => ({
    key: n.messageKey, params: n.params, count: n.count, lines: (n.detailLines ?? []).map(line => line.messageKey),
  }));
}
/** De meldingen zonder de zin: als eigen melding weg, als regel van de eerste melding weg. */
const withoutSentence = (notices: Awaited<ReturnType<typeof exportNotices>>) => notices
  .filter(n => n.key !== PLAN_ONLY_EXPORT).map(n => ({ ...n, lines: n.lines.filter(line => line !== PLAN_ONLY_EXPORT) }));
for (const format of ['csv', 'mspdi', 'p6', 'xer', 'progress-xlsx'] as const) await check(`export ${format}: de zin "alleen de planning" alleen met een gebouwmodel`, async () => {
  const { store } = await openInStore(bytes); longer(store);
  const withModel = await exportNotices(store, format);
  assert.deepEqual(withModel.flatMap(n => [n.key, ...n.lines]).filter(key => key === PLAN_ONLY_EXPORT), [PLAN_ONLY_EXPORT], 'de zin precies één keer');
  store.setState(s => { s.ui.featureFlags = {}; });
  assert.deepEqual(await exportNotices(store, format), withoutSentence(withModel),
    'flag uit: dezelfde meldingen zonder de zin; de zin duwt geen melding weg');
  const plain = (await openInStore(new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc'))))).store;
  assert(!hasForeignContent(plain.getState().ifcSource));
  const ordinary = await exportNotices(plain, format);
  assert.deepEqual(ordinary, withoutSentence(ordinary), 'gewoon document: geen zin');
});

// Review van #1002 (BLOKKEERT 1): MS Project XML met een kostenresource en een kritieke drempel in uren geeft vijf meldingen,
// meer dan de store tegelijk toont (`MAX_NOTIFICATIONS`). Wat de planner na afloop ziet, draagt de zin precies één keer.
await check('export mspdi met vijf meldingen: na afloop staat de zin er nog, precies één keer', async () => {
  const { store } = await openInStore(bytes);
  store.getState().addResource({ name: 'Leges', type: 'COST', description: '', maxUnits: 1 });
  store.getState().setProject({ schedulingOptions: { criticalDefinition: { mode: 'totalFloat', thresholdHours: 2 } } });
  const shown = new Set<string>();
  const stop = store.subscribe(now => { for (const n of now.ui.notifications) shown.add(n.id); });
  try {
    const final = await exportNotices(store, 'mspdi');
    assert(shown.size > (await import('@/state/slices/uiSlice')).MAX_NOTIFICATIONS, `meer meldingen dan de grens (${shown.size})`);
    assert.deepEqual(final.flatMap(n => [n.key, ...n.lines]).filter(key => key === PLAN_ONLY_EXPORT), [PLAN_ONLY_EXPORT], 'de zin precies één keer');
  } finally { stop(); }
});

for (const cause of ['flag-uit', 'sourceMissing', 'mergeweigering'] as const) await check(`IFC-export ${cause}: nul bytes vóór kiezer`, async () => {
  const data = cause === 'mergeweigering' ? new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc'))) : bytes;
  const { store } = await openInStore(data); longer(store);
  store.setState(s => {
    if (cause === 'flag-uit') s.ui.featureFlags = {};
    if (cause === 'sourceMissing') s.foreignSourceMark = { ...s.foreignSourceMark!, sourceMissing: true };
  });
  const before = preserved(store), ipc = desktop(), target = join(dir, `export-${cause}.ifc`); ipc.choose(target);
  try {
    clearNotices(store);
    const result = await store.getState().exportAs('ifc');
    assert(result.ok && result.cancelled); assert.equal(ipc.picks(), 0); assert.equal(existsSync(target), false);
    unchanged(store, before);
    assertNotice(store, cause === 'mergeweigering' ? 'notifications.ifcForeignMergeRefused' : cause === 'sourceMissing' ? 'notifications.ifcForeignSourceMissing' : 'notifications.ifcForeignSaveBlocked');
  } finally { ipc.dispose(); }
});

for (const cause of ['flag-uit-na-kiezer', 'sourceMissing-na-kiezer', 'nieuwe-bron', 'documentwissel'] as const) {
  await check(`IFC-export ${cause}: nul bytes na voorbereiding`, async () => {
    const { store } = await openInStore(bytes); longer(store);
    const before = preserved(store), id = store.getState().activeDocumentId, ipc = desktop();
    const target = join(dir, `export-laat-${cause}.ifc`); ipc.choose(target);
    const other = cause === 'nieuwe-bron'
      ? await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), before.source!) : null;
    ipc.onPick(() => {
      if (cause === 'documentwissel') store.getState().newDocument();
      else if (other) store.getState().commitSavedDocument(id, store.getState(), undefined, other);
      else store.setState(s => {
        if (cause === 'flag-uit-na-kiezer') s.ui.featureFlags = {};
        else s.foreignSourceMark = { ...s.foreignSourceMark!, sourceMissing: true };
      });
    });
    try {
      const result = await store.getState().exportAs('ifc'); assert(result.ok && result.cancelled);
      assert.equal(existsSync(target), false); assert.equal(ipc.calls.filter(c => c.wrote).length, 0);
      if (cause === 'documentwissel') store.getState().switchDocument(id);
      if (other) assert(store.getState().ifcSource === other.source, 'de nieuwe opslagbron blijft staan');
      else assert(store.getState().ifcSource === before.source, 'de openingsbron blijft staan');
    } finally { ipc.dispose(); }
  });
}

for (const flag of [true, false]) await check(`gewone IFC-export, flag ${flag}: main-tekst en bestaande vervanging`, async () => {
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  const { store } = await openInStore(plain);
  store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; }); longer(store);
  const before = preserved(store), ipc = desktop(), target = join(dir, `export-gewoon-${flag}.ifc`); writeFileSync(target, plain); ipc.choose(target);
  try {
    const { buildExportIFCInput } = await import('@/state/ifcSaveInput');
    const expected = new TextEncoder().encode(writeIFC(buildExportIFCInput(store.getState(), 'merge')));
    const result = await store.getState().exportAs('ifc'); assert(result.ok && !result.cancelled);
    const output = new Uint8Array(readFileSync(target)); assert.equal(hash(output), hash(expected)); await openForeign(output);
    unchanged(store, before);
  } finally { ipc.dispose(); }
});

// ── PR 13: Exporteren → IFC zonder gebouwmodel en de export met bibliotheek, na de vraag "alleen de planning" ──
const asked: PlanOnlyReason[] = [];
const answer = (yes: boolean, during?: () => void) => setPlanOnlyAsker(async reason => { asked.push(reason); during?.(); return yes; });
const withoutModel = { withoutBuildingModel: true } as const;
/** De bibliotheek krijgt bij elke uitvoer een nieuw project (GlobalIds en intern id); de rest vergelijkt letterlijk. */
const withoutGlobalIds = (text: string | null) => text?.replace(/'[0-9A-Za-z_$]{22}'/g, "'<GlobalId>'")
  .replace(/'proj-[0-9a-z]+'/g, "'proj-<id>'");
const writeCalls = (ipc: ReturnType<typeof desktop>) => ipc.calls.filter(c => byteWrite(c) || c.options?.write).length;
/** De GlobalIds van de A- en V-stukken: het gebouwmodel en de gegevens van een ander programma. C (gedeelde context,
 *  zoals het `IfcProject`) houdt in de planning zijn GlobalId; dat is de planning zelf. */
function foreignGlobalIds(source: Uint8Array): string[] {
  const index = scanForeignStep(source), { classes } = classify(index), ids: string[] = [];
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i) || classes[i] < 3) continue;
    const m = /^\s*#\d+\s*=\s*\w+\s*\(\s*'([0-9A-Za-z_$]{22})'/.exec(new TextDecoder().decode(source.subarray(index.start(i), index.end(i))));
    if (m) ids.push(`${m[1]} ${index.type(i)} ${'PCAV'[classes[i] - 1]}`);
  }
  return ids;
}
/** Het bestand bevat alleen planning: na indeling geen C, A of V, en geen GlobalId van het vreemde deel. */
function assertPlanOnly(source: Uint8Array, out: Uint8Array) {
  const { counts } = classify(scanForeignStep(out));
  assert.deepEqual([counts.C, counts.A, counts.V], [0, 0, 0], 'het nieuwe bestand bevat alleen planning');
  const ids = foreignGlobalIds(source), text = new TextDecoder().decode(out);
  assert(ids.length > 0, 'de bron heeft een vreemd deel met GlobalIds');
  assert.deepEqual(ids.filter(id => text.includes(id.slice(0, 22))), [], 'geen object van het vreemde deel in het nieuwe bestand');
}
/** Heropenen zoals Bestand → Openen, met de flag aan of uit: een gewoon document zonder vreemd deel. */
async function reopenOrdinary(out: Uint8Array, flag: boolean) {
  const { createAppStoreContext, buildWriteIFCInput: input } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
  await store.getState().openOpenedFile({ name: 'zonder-model.ifc', content: new TextDecoder().decode(out), bytes: out, ref: null });
  const s = store.getState();
  assert(s.tasks.length > 0, `flag ${flag}: de planning is geopend`);
  assert.deepEqual(s.ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey), [], `flag ${flag}: geen fout`);
  assert.equal(hasForeignContent(s.ifcSource), false, `flag ${flag}: geen vreemd deel`);
  assert.equal(s.foreignSourceMark, null, `flag ${flag}: geen bronkenmerk`);
  assert.equal(ifcSaveBlocked(s), false, `flag ${flag}: gewoon op te slaan`);
  return input(s, 'merge');
}

await check('zonder gebouwmodel, desktop: ja → alleen de planning, heropent gewoon, document intact, daarna volledig Opslaan als', async () => {
  const original = join(dir, 'zonder-model-bron.ifc'); writeFileSync(original, bytes);
  const store = await openAt({ kind: 'path', path: original }), ipc = desktop();
  asked.length = 0; answer(true);
  try {
    longer(store); clearNotices(store);
    const before = preserved(store), literal = store.getState().ifcLiteralCalendarIds;
    const expected = writeIFCWithChoices(buildExportIFCInput(store.getState(), 'planOnly')).content;
    const seen = await shownAfterOpen(buildWriteIFCInput(store.getState(), 'planOnly'));
    const full = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), before.source!);
    const target = join(dir, 'zonder-model.ifc'); ipc.choose(target);
    const result = await store.getState().exportAs('ifc', withoutModel);
    assert(result.ok && !result.cancelled, 'de export schrijft');
    assert.deepEqual(asked, ['export'], 'één vraag, met de reden export');
    const output = new Uint8Array(readFileSync(target));
    assert.equal(new TextDecoder().decode(output), expected, 'de gewone writer met planOnly, van dezelfde staat');
    assertPlanOnly(bytes, output);
    for (const flag of [true, false]) {
      assert.equal(canon(await reopenOrdinary(output, flag), reseed), canon(seen, reseed), `flag ${flag}: het domein dat de planner zag`);
    }
    unchanged(store, before);
    assert(store.getState().ifcLiteralCalendarIds === literal, 'export legt geen letterlijke kalenders vast');
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), [], 'geen weigering');
    const saved = join(dir, 'zonder-model-daarna-volledig.ifc'); ipc.choose(saved);
    await store.getState().saveFileAs();
    const again = new Uint8Array(readFileSync(saved));
    assert.equal(hash(again), full.sha256, 'Opslaan als schrijft dezelfde bytes als zonder de export ervoor');
    assert.deepEqual(mergeProblems(bytes, again), []);
    assert.deepEqual(asked, ['export'], 'Opslaan als vraagt niets');
  } finally { ipc.dispose(); resetPlanOnlyAsker(); }
});

await check('zonder gebouwmodel, browser: ja → download met alleen de planning', async () => {
  const { store } = await openInStore(bytes); longer(store);
  asked.length = 0; answer(true);
  const before = preserved(store), browser = browserDownload();
  try {
    const expected = writeIFCWithChoices(buildExportIFCInput(store.getState(), 'planOnly')).content;
    const result = await store.getState().exportAs('ifc', withoutModel);
    assert(result.ok && !result.cancelled); assert.equal(browser.downloads.length, 1);
    assert.equal(await browser.downloads[0].text(), expected);
    assertPlanOnly(bytes, new Uint8Array(await browser.downloads[0].arrayBuffer()));
    assert.deepEqual(asked, ['export']); unchanged(store, before);
  } finally { browser.dispose(); resetPlanOnlyAsker(); }
});

for (const route of ['export', 'pool'] as const) await check(`${route}: nee op de vraag → nul schrijfacties, geen melding`, async () => {
  const { store } = await openInStore(bytes); longer(store);
  if (route === 'pool') store.getState().setProject({ companyId: store.getState().seedDemoLibrary(), companyName: 'Proefbedrijf' });
  asked.length = 0; answer(false); clearNotices(store);
  const before = preserved(store), ipc = desktop(), target = join(dir, `nee-${route}.ifc`); ipc.choose(target);
  try {
    const result = route === 'pool' ? await store.getState().exportProjectWithPool() : await store.getState().exportAs('ifc', withoutModel);
    assert(result.ok && result.cancelled, 'telt als geannuleerd');
    assert.deepEqual(asked, [route === 'pool' ? 'exportWithPool' : 'export']);
    assert.equal(ipc.picks(), 0, 'geen bestandskiezer'); assert.equal(writeCalls(ipc), 0); assert.equal(existsSync(target), false);
    assert.deepEqual(store.getState().ui.notifications, [], 'geen melding');
    unchanged(store, before);
  } finally { ipc.dispose(); resetPlanOnlyAsker(); }
});

for (const kind of ['eigen-bron', 'andere-bron', 'bestaand-model'] as const) for (const route of ['export', 'pool'] as const) {
  await check(`${route} zonder gebouwmodel naar ${kind}: nul bytes, één melding`, async () => {
    const target = join(dir, `zonder-model-${kind}-${route}.ifc`); writeFileSync(target, bytes);
    const store = kind === 'bestaand-model' ? (await openInStore(bytes)).store : await openAt({ kind: 'path', path: target });
    if (kind === 'andere-bron') {
      // Het doel is de bron van het eerste document; de export komt uit een tweede document.
      store.getState().newDocument();
      await store.getState().openOpenedFile({ name: 'ander.ifc', content: '', bytes, ref: null });
    }
    if (route === 'pool') store.getState().setProject({ companyId: store.getState().seedDemoLibrary(), companyName: 'Proefbedrijf' });
    longer(store); asked.length = 0; answer(true); clearNotices(store);
    const before = preserved(store), ipc = desktop(), oldHash = hash(new Uint8Array(readFileSync(target))); ipc.choose(target);
    try {
      const result = route === 'pool' ? await store.getState().exportProjectWithPool() : await store.getState().exportAs('ifc', withoutModel);
      assert(result.ok && result.cancelled); assert.equal(asked.length, 1);
      assert.equal(hash(new Uint8Array(readFileSync(target))), oldHash, 'het bestand met gebouwmodel blijft heel');
      assert.equal(writeCalls(ipc), 0); unchanged(store, before);
      assertNotice(store, 'notifications.ifcForeignTargetExport');
    } finally { ipc.dispose(); resetPlanOnlyAsker(); }
  });
}

for (const change of ['documentwissel', 'bewerking', 'nieuwe-bron', 'ander-kenmerk', 'flag-uit'] as const) for (const route of ['export', 'pool'] as const) {
  await check(`${route}: ${change} tijdens de vraag → nul bytes`, async () => {
    const { store } = await openInStore(bytes); longer(store);
    if (route === 'pool') store.getState().setProject({ companyId: store.getState().seedDemoLibrary(), companyName: 'Proefbedrijf' });
    const id = store.getState().activeDocumentId, before = preserved(store);
    const other = change === 'nieuwe-bron' ? await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), before.source!) : null;
    asked.length = 0; clearNotices(store);
    answer(true, () => {
      if (change === 'documentwissel') store.getState().newDocument();
      else if (change === 'bewerking') longer(store);
      else if (other) store.getState().commitSavedDocument(id, store.getState(), undefined, other);
      else store.setState(s => {
        if (change === 'flag-uit') s.ui.featureFlags = {};
        else s.foreignSourceMark = { ...s.foreignSourceMark! };
      });
    });
    const ipc = desktop(), target = join(dir, `tijdens-${change}-${route}.ifc`); ipc.choose(target);
    try {
      const result = route === 'pool' ? await store.getState().exportProjectWithPool() : await store.getState().exportAs('ifc', withoutModel);
      assert(result.ok && result.cancelled); assert.equal(asked.length, 1);
      assert.equal(ipc.picks(), 0, 'geen bestandskiezer'); assert.equal(writeCalls(ipc), 0); assert.equal(existsSync(target), false);
      if (change === 'documentwissel') store.getState().switchDocument(id);
      assertNotice(store, change === 'flag-uit' ? 'notifications.ifcForeignSaveBlocked' : 'notifications.ifcExportChangedWhileWaiting');
    } finally { ipc.dispose(); resetPlanOnlyAsker(); }
  });
}

await check('export met bibliotheek: vraag, projectbestand met alleen de planning, bibliotheek gelijk aan main, document intact', async () => {
  const { store } = await openInStore(bytes); longer(store);
  const companyId = store.getState().seedDemoLibrary();
  store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
  asked.length = 0; answer(true); clearNotices(store);
  const before = preserved(store), ipc = desktop();
  const project = join(dir, 'pool-project.ifc'), library = join(dir, 'pool-bibliotheek.ifc');
  ipc.choose(project); ipc.onPick(() => { if (ipc.picks() === 2) ipc.choose(library); });
  try {
    const expected = writeIFCWithChoices(buildExportIFCInput(store.getState(), 'planOnly')).content;
    const expectedLibrary = store.getState().exportPoolIFC(companyId);
    const result = await store.getState().exportProjectWithPool();
    assert(result.ok && !result.cancelled, 'beide bestanden geschreven');
    assert.deepEqual(asked, ['exportWithPool'], 'één vraag, ook zonder het vinkje Zonder gebouwmodel');
    assert.equal(ipc.picks(), 2);
    const output = new Uint8Array(readFileSync(project));
    assert.equal(new TextDecoder().decode(output), expected); assertPlanOnly(bytes, output);
    const libraryText = withoutGlobalIds(readFileSync(library, 'utf8'))!, mainLibrary = withoutGlobalIds(expectedLibrary)!;
    assert(libraryText === mainLibrary, `de bibliotheek zoals main hem schrijft: ${firstDiff(libraryText, mainLibrary)}`);
    await reopenOrdinary(output, true);
    unchanged(store, before);
  } finally { ipc.dispose(); resetPlanOnlyAsker(); }
});

for (const cause of ['sourceMissing', 'flag-uit'] as const) await check(`${cause}: beide routes zonder gebouwmodel geweigerd met de bestaande melding, geen vraag`, async () => {
  const { store } = await openInStore(bytes); longer(store);
  store.getState().setProject({ companyId: store.getState().seedDemoLibrary(), companyName: 'Proefbedrijf' });
  store.setState(s => {
    if (cause === 'flag-uit') s.ui.featureFlags = {};
    else { s.foreignSourceMark = { ...s.foreignSourceMark!, sourceMissing: true }; s.ifcSource = null; }
  });
  asked.length = 0; answer(true);
  const before = preserved(store), ipc = desktop(), target = join(dir, `geweigerd-${cause}.ifc`); ipc.choose(target);
  try {
    for (const run of [() => store.getState().exportAs('ifc', withoutModel), () => store.getState().exportProjectWithPool()]) {
      clearNotices(store); const result = await run();
      assert(result.ok && result.cancelled); assert.equal(ipc.picks(), 0); assert.equal(existsSync(target), false);
      assertNotice(store, cause === 'sourceMissing' ? 'notifications.ifcForeignSourceMissing' : 'notifications.ifcForeignSaveBlocked');
      unchanged(store, before);
    }
    assert.deepEqual(asked, [], 'geen vraag');
  } finally { ipc.dispose(); resetPlanOnlyAsker(); }
});

for (const flag of [true, false]) await check(`zonder vreemd deel, flag ${flag}: geen vraag, dezelfde bytes als de gewone export`, async () => {
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  const { store } = await openInStore(plain);
  store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; }); longer(store);
  const companyId = store.getState().seedDemoLibrary();
  store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
  asked.length = 0; answer(false);
  const ipc = desktop();
  try {
    const exportTarget = join(dir, `gewoon-zonder-model-${flag}.ifc`); ipc.choose(exportTarget);
    const expected = writeIFC(buildExportIFCInput(store.getState(), 'merge'));
    assert((await store.getState().exportAs('ifc', withoutModel)).ok);
    assert.equal(readFileSync(exportTarget, 'utf8'), expected, 'het vinkje verandert niets zonder gebouwmodel');
    const project = join(dir, `gewoon-pool-${flag}.ifc`), library = join(dir, `gewoon-pool-bib-${flag}.ifc`);
    ipc.choose(project); ipc.onPick(() => { if (ipc.picks() === 3) ipc.choose(library); });
    const expectedProject = writeIFCWithChoices(buildExportIFCInput(store.getState(), 'planOnly')).content;
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok && !pooled.cancelled);
    assert.equal(readFileSync(project, 'utf8'), expectedProject);
    const libraryText = withoutGlobalIds(readFileSync(library, 'utf8'))!, mainLibrary = withoutGlobalIds(store.getState().exportPoolIFC(companyId))!;
    assert(libraryText === mainLibrary, `de bibliotheek zoals main hem schrijft: ${firstDiff(libraryText, mainLibrary)}`);
    assert.deepEqual(asked, [], 'geen vraag');
  } finally { ipc.dispose(); resetPlanOnlyAsker(); }
});

await check('zonder ja blijft planOnly geweigerd; een ja geldt één keer en alleen voor zijn reden', async () => {
  const { store } = await openInStore(bytes);
  const state = store.getState(), input = buildWriteIFCInput(state, 'planOnly');
  const refused = async (confirmation?: Parameters<typeof prepareIfcOutput>[2], write = input) => {
    try { await prepareIfcOutput(state, write, confirmation); return false; }
    catch (error) { return error instanceof IfcWriteBlockedError; }
  };
  assert(await refused(), 'zonder bevestiging (MCP, paneel, kern) weigert planOnly');
  assert(await refused({ reason: 'export' }), 'een zelfgemaakte bevestiging telt niet');
  answer(true);
  try {
    const yes = (await askPlanOnly('export'))!;
    assert.equal(await refused(yes), false, 'het ja laat precies deze ene voorbereiding door');
    assert(await refused(yes), 'een tweede keer geldt hetzelfde ja niet');
    assert(await refused((await askPlanOnly('export'))!, buildWriteIFCInput(state, 'merge')), 'een ja geldt niet voor merge');
    assert(await refused((await askPlanOnly('missingSourceSaveAs'))!), 'het ja van Opslaan als geldt niet bij een aanwezig gebouwmodel');
    answer(false);
    assert.equal(await askPlanOnly('export'), null, 'nee geeft geen bevestiging');
  } finally { resetPlanOnlyAsker(); }
});
// ── Knownbug 1131 stap 2: Ctrl+S op het eigen bestand via de bestandshandle (browser). ──
// De dubbel overleeft `structuredClone` in de nep-IndexedDB (prototype terug in `onRead`), zodat het herstel na een
// crash via dezelfde handle leest, zoals Chromium een handle uit IndexedDB teruggeeft. Inhoud en storingen staan per
// naam buiten het object. Geen bewijs van browserrechten of van het wisselbestand van een echte browser.
const handleFiles = new Map<string, Uint8Array>();
interface HandleFaults {
  permission?: 'denied'; unreadable?: boolean; writeErrorAt?: number; closeError?: boolean;
  onWrite?: (written: number) => void; afterClose?: () => Promise<void>;
}
const handleFaults = new Map<string, HandleFaults>();
const writableLog: string[] = [];
class FakeHandle {
  readonly kind = 'file';
  constructor(readonly name: string) {}
  async isSameEntry(other: unknown) { return other instanceof FakeHandle && other.name === this.name; }
  async queryPermission() { return handleFaults.get(this.name)?.permission === 'denied' ? 'prompt' : 'granted'; }
  async requestPermission() { return handleFaults.get(this.name)?.permission === 'denied' ? 'denied' : 'granted'; }
  async getFile() {
    const data = handleFiles.get(this.name);
    if (!data) throw new DOMException('weg', 'NotFoundError');
    if (handleFaults.get(this.name)?.unreadable) throw new DOMException('onleesbaar', 'NotReadableError');
    return new File([new Uint8Array(data).buffer], this.name);
  }
  async createWritable() {
    const name = this.name, faults = handleFaults.get(name) ?? {}, parts: Uint8Array[] = [];
    writableLog.push(`create ${name}`);
    return {
      write: async (part: Uint8Array | string) => {
        if (faults.writeErrorAt === parts.length) throw new DOMException('schijf vol', 'QuotaExceededError');
        parts.push(typeof part === 'string' ? new TextEncoder().encode(part) : new Uint8Array(part)); faults.onWrite?.(parts.length);
      },
      abort: async () => { writableLog.push(`abort ${name}`); },
      close: async () => {
        if (faults.closeError) throw new DOMException('sluiten', 'InvalidStateError');
        handleFiles.set(name, new Uint8Array(Buffer.concat(parts)));
        writableLog.push(`close ${name} ${parts.length}`);
        await faults.afterClose?.();
      },
    };
  }
}
let failManifest = false;
const hydrateHandles = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  if (Reflect.get(value, 'kind') === 'file' && handleFiles.has(Reflect.get(value, 'name'))) Object.setPrototypeOf(value, FakeHandle.prototype);
  else for (const child of Object.values(value)) hydrateHandles(child);
};
installFakeRecoveryIndexedDb({
  onRead: (_store, _method, value) => hydrateHandles(value),
  onPut: (store, value) => {
    if (failManifest && store === 'records' && Reflect.get(value, 'kind') === 'manifest') throw new Error('IndexedDB weigert');
  },
});
const sessionValues = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (k: string) => sessionValues.get(k) ?? null, setItem: (k: string, v: string) => sessionValues.set(k, v),
  removeItem: (k: string) => sessionValues.delete(k),
} });
/** De herstelronde zoals `useAutoSave` haar registreert: `replaceWithRecoveryPending` wacht erop. */
function recoveryRounds(store: Store, afterRound?: () => void) {
  const tracker = new RecoveryDeltaTracker();
  return registerRecoveryFlush(async () => {
    const s = store.getState();
    await runRecoveryTick(tracker, s.activeDocumentId,
      s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
    afterRound?.();
  });
}
async function restoreFrom(loaded: Awaited<ReturnType<typeof loadRecovery>>) {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const inputs = [];
  for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, true));
  assert.equal(store.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  return store;
}
let handleCount = 0;
async function openHandle(data = bytes) {
  const name = `model-${++handleCount}.ifc`, handle = new FakeHandle(name);
  handleFiles.set(name, data);
  const store = await openAt({ kind: 'handle', handle: handle as unknown as FileSystemFileHandle }, data);
  return { store, name, handle };
}
const fileOf = (name: string) => handleFiles.get(name)!;
const leaf = (store: Store, skip: readonly string[] = []) =>
  store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone && !skip.includes(t.id))!;
const ctrlS = (store: Store) => store.getState().saveFileForDocument(store.getState().activeDocumentId);
const pendingIn = async (id: string) => (await loadRecovery()).docs.find(d => d.id === id)?.ifcSource?.pendingSha256;

await check('handle Ctrl+S drie keer (taak, duur, relatie; de derde via de sluitvraag): volledig bestand, bron volgt', async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store), browser = browserDownload();
  try {
    let previous: Uint8Array = bytes;
    const added = store.getState().addTask({ name: 'Taak via Ctrl+S' }); store.getState().runCPM();
    const longerId = leaf(store, [added]).id;
    for (const round of [1, 2, 3]) {
      if (round === 2) longer(store);
      if (round === 3) {
        assert(store.getState().addSequence({ predecessorId: longerId, successorId: added, type: 'FINISH_START', lagDays: 0 }), 'relatie aangemaakt');
        store.getState().runCPM();
      }
      assert.equal(hash(store.getState().ifcSource!.bytes), hash(previous), `ronde ${round}: de bron is de uitvoer van de vorige ronde`);
      assert.equal(store.getState().isDirty, true);
      const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
      clearNotices(store); writableLog.length = 0;
      if (round < 3) assert.equal(await ctrlS(store), true, `ronde ${round}: Ctrl+S schrijft`);
      else {
        let closed = false;
        await createCloseDocumentDialogActions({
          pendingId: store.getState().activeDocumentId, getActiveDocumentId: () => store.getState().activeDocumentId,
          switchDocument: store.getState().switchDocument, closeDocument: () => { closed = true; },
          saveFile: () => ctrlS(store), clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
        }).save();
        assert.equal(closed, true, 'de sluitvraag sluit na een geslaagde opslag');
      }
      const output = fileOf(name);
      assert.equal(hash(output), expected.sha256, `ronde ${round}: precies de voorbereide merge`);
      assert.deepEqual(writableLog, [`create ${name}`, `close ${name} 1`], 'één vervanging, de hele buffer in één write');
      assert.deepEqual(mergeProblems(bytes, output), [], `ronde ${round}: het vreemde deel blijft bytegelijk`);
      const reopened = await openForeign(output), now = store.getState();
      assert.equal(reopened.tasks.find(t => t.id === added)?.name, 'Taak via Ctrl+S');
      assert.equal(reopened.tasks.find(t => t.id === longerId)!.time.scheduleDuration, now.tasks.find(t => t.id === longerId)!.time.scheduleDuration);
      assert.equal(reopened.sequences.some(q => q.predecessorId === longerId && q.successorId === added), round === 3);
      assert.equal(hash(now.ifcSource!.bytes), hash(output)); assert.equal(now.ifcSource!.sha256, hash(output));
      assert.equal(now.foreignSourceMark!.sha256, hash(output)); assert(now.foreignSourceMark!.handle, 'het kenmerk houdt de handle');
      assert.equal(now.isDirty, false); assert.equal(now.ui.notifications.filter(n => n.severity === 'error').length, 0);
      assert.equal(await pendingIn(now.activeDocumentId), undefined, 'het veld is na de vervanging gewist');
      assert.equal((await loadRecovery()).docs.find(d => d.id === now.activeDocumentId)?.ifcSource?.sha256, hash(output));
      previous = output;
    }
    assert.equal(browser.downloads.length, 0, 'geen download');
  } finally { unregister(); browser.dispose(); await clearRecovery(); }
});

await check('handle Opslaan als blijft een download; het eigen bestand blijft staan', async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store), browser = browserDownload();
  try {
    longer(store); const before = preserved(store);
    await store.getState().saveFileAs();
    assert.equal(browser.downloads.length, 1);
    assert.deepEqual(mergeProblems(bytes, new Uint8Array(await browser.downloads[0].arrayBuffer())), []);
    assert.equal(hash(fileOf(name)), hash(bytes)); unchanged(store, { ...before, dirty: false });
  } finally { unregister(); browser.dispose(); await clearRecovery(); }
});

const otherProgram = new Uint8Array(bytes); otherProgram[Buffer.from(otherProgram).indexOf("FILE_NAME('") + 11] ^= 1;
const handleFaultCases = [
  { fault: 'gewijzigd vóór de merge', notice: 'notifications.ifcForeignTargetChanged', writes: false, aborts: false,
    arrange: (name: string) => { handleFiles.set(name, otherProgram); }, after: otherProgram },
  { fault: 'langer vóór de merge', notice: 'notifications.ifcForeignTargetChanged', writes: false, aborts: false,
    arrange: (name: string) => { handleFiles.set(name, new Uint8Array([...bytes, 10])); }, after: new Uint8Array([...bytes, 10]) },
  { fault: 'weg vóór de merge', notice: 'notifications.ifcForeignTargetGone', writes: false, aborts: false,
    arrange: (name: string) => { handleFiles.delete(name); }, after: null },
  { fault: 'onleesbaar vóór de merge', notice: 'notifications.ifcForeignTargetGone', writes: false, aborts: false,
    arrange: (name: string) => { handleFaults.set(name, { unreadable: true }); }, after: bytes },
  { fault: 'gewijzigd tussen schrijven en close()', notice: 'notifications.ifcForeignTargetChanged', writes: true, aborts: true,
    arrange: (name: string) => { handleFaults.set(name, { onWrite: () => { handleFiles.set(name, otherProgram); } }); }, after: otherProgram },
  { fault: 'weg tussen schrijven en close()', notice: 'notifications.ifcForeignTargetGone', writes: true, aborts: true,
    arrange: (name: string) => { handleFaults.set(name, { onWrite: () => { handleFiles.delete(name); } }); }, after: null },
  { fault: 'schrijffout', notice: 'notifications.ifcForeignReplaceFailed', writes: true, aborts: true,
    arrange: (name: string) => { handleFaults.set(name, { writeErrorAt: 0 }); }, after: bytes },
  { fault: 'fout bij close()', notice: 'notifications.ifcForeignReplaceFailed', writes: true, aborts: false,
    arrange: (name: string) => { handleFaults.set(name, { closeError: true }); }, after: bytes },
] as const;
for (const c of handleFaultCases) await check(`handle Ctrl+S, ${c.fault}: niets vervangen, document ongewijzigd`, async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store), browser = browserDownload();
  try {
    longer(store); clearNotices(store); writableLog.length = 0;
    const before = preserved(store), id = store.getState().activeDocumentId;
    c.arrange(name);
    assert.equal(await ctrlS(store), false);
    unchanged(store, before);
    if (c.after) assert.equal(hash(fileOf(name)), hash(c.after), 'het bestand op het doel is niet door de app veranderd');
    else assert.equal(handleFiles.has(name), false);
    assert.equal(writableLog.some(l => l.startsWith('close')), false, 'geen close()');
    assert.equal(writableLog.includes(`create ${name}`), c.writes, c.writes ? 'de controle viel ná het schrijven' : 'geen schrijfstroom');
    assert.equal(writableLog.includes(`abort ${name}`), c.aborts, 'de stroom is afgebroken (abort)');
    assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey).join(), c.notice);
    assert.equal(await pendingIn(id), undefined, 'het veld is gewist');
    assert.equal(browser.downloads.length, 0, 'geen download als terugval');
  } finally { handleFaults.clear(); unregister(); browser.dispose(); await clearRecovery(); }
});

await check('handle Ctrl+S, crash na close() en vóór het manifest: herstel vindt de nieuwe versie via pendingSha256', async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store);
  try {
    const edit = longer(store), id = store.getState().activeDocumentId;
    // De gewone herstelronde na een bewerking (in de app de 10 s-ronde): het manifest kent het document al.
    await flushRecoveryNow();
    assert.equal((await loadRecovery()).docs.find(d => d.id === id)?.ifcSource?.pendingSha256, undefined);
    let crash: Awaited<ReturnType<typeof loadRecovery>> | undefined;
    handleFaults.set(name, { afterClose: async () => { crash = await loadRecovery(); } });
    assert.equal(await ctrlS(store), true);
    const written = fileOf(name), doc = crash!.docs.find(d => d.id === id)!;
    assert.equal(doc.ifcSource?.sha256, hash(bytes), 'op het moment van de crash noemt het manifest nog de oude bron');
    assert.equal(doc.ifcSource?.pendingSha256, hash(written), 'en de komende versie');
    const restored = await restoreFrom(crash!), payload = restored.getState().getOpenDocumentPayloads().find(d => d.id === id)!.payload;
    assert.equal(payload.ifcSource?.sha256, hash(written), 'herstel neemt de nieuwe versie als bron');
    assert.equal(payload.foreignSourceMark?.sourceMissing, undefined);
    assert.equal((payload.fileHandle as unknown as FakeHandle | null)?.name, name, 'en geeft het doel terug');
    assert.equal(payload.tasks.find(t => t.id === edit)!.time.scheduleDuration,
      store.getState().tasks.find(t => t.id === edit)!.time.scheduleDuration);
    // Na het herstel werkt Ctrl+S weer op hetzelfde bestand, met de herstelde versie als bron.
    handleFaults.clear(); unregister();
    restored.getState().switchDocument(id); longer(restored);
    const restoredRounds = recoveryRounds(restored);
    try {
      clearNotices(restored);
      assert.equal(await ctrlS(restored), true, 'Ctrl+S na herstel schrijft');
      assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
      assert.equal(restored.getState().ifcSource!.sha256, hash(fileOf(name)));
    } finally { restoredRounds(); }
  } finally { handleFaults.clear(); unregister(); await clearRecovery(); }
});

for (const cause of ['geen herstelronde', 'IndexedDB weigert het manifest'] as const) {
  await check(`handle Ctrl+S, ${cause} (1764): niets vervangen, eigen melding`, async () => {
    const { store, name } = await openHandle(), unregister = cause === 'geen herstelronde' ? () => {} : recoveryRounds(store);
    const browser = browserDownload();
    failManifest = cause !== 'geen herstelronde';
    try {
      longer(store); clearNotices(store); writableLog.length = 0;
      const before = preserved(store);
      assert.equal(await ctrlS(store), false);
      unchanged(store, before); assert.equal(hash(fileOf(name)), hash(bytes)); assert.deepEqual(writableLog, []);
      assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey).at(-1),
        'notifications.ifcForeignReplaceNotRecorded');
      assert.equal(browser.downloads.length, 0);
    } finally { failManifest = false; unregister(); browser.dispose(); await clearRecovery(); }
  });
}

// Knownbug 1768 (besluit van de eigenaar, 16 november 2026): na de download blijft het document gewijzigd tot het
// geopende bestand is bijgewerkt; de melding noemt de kopie. Ook *Opslaan* in de sluitvraag sluit dan niet.
await check('handle zonder schrijftoestemming: download, het document blijft gewijzigd; later met toestemming opgeslagen', async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store), browser = browserDownload();
  try {
    longer(store); const before = preserved(store); writableLog.length = 0; clearNotices(store);
    handleFaults.set(name, { permission: 'denied' });
    assert.equal(await ctrlS(store), false, 'Ctrl+S meldt: niet opgeslagen');
    assert.equal(browser.downloads.length, 1); assert.deepEqual(writableLog, []);
    assert.deepEqual(mergeProblems(bytes, new Uint8Array(await browser.downloads[0].arrayBuffer())), []);
    assert.equal(hash(fileOf(name)), hash(bytes)); unchanged(store, before);
    assert.equal(store.getState().isDirty, true, 'het document blijft gewijzigd');
    const shown = store.getState().ui.notifications, { suggestedFileBase } = await import('@/state/slices/fileSlice');
    assert.deepEqual(shown.map(n => n.messageKey), ['notifications.ifcForeignDownloadCopy'], 'alleen de eigen melding');
    assert.deepEqual(shown[0].params, { file: `${suggestedFileBase(store.getState())}.ifc` }, 'de melding noemt de kopie');
    // *Opslaan* in de sluitvraag: weer een download, het document blijft open en gewijzigd.
    let closed = false;
    await createCloseDocumentDialogActions({
      pendingId: store.getState().activeDocumentId, getActiveDocumentId: () => store.getState().activeDocumentId,
      switchDocument: store.getState().switchDocument, closeDocument: () => { closed = true; },
      saveFile: () => ctrlS(store), clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
    }).save();
    assert.equal(closed, false, 'de sluitvraag sluit niet na een download');
    assert.equal(browser.downloads.length, 2); assert.equal(store.getState().isDirty, true);
    assert.equal(store.getState().ui.notifications.find(n => n.messageKey === 'notifications.ifcForeignDownloadCopy')?.count, 1,
      'een tweede download ververst de melding');
    // Later toestemming: Ctrl+S schrijft alsnog op de handle en het document staat op opgeslagen.
    handleFaults.delete(name);
    assert.equal(await ctrlS(store), true);
    assert.equal(browser.downloads.length, 2, 'geen download meer');
    assert.deepEqual(writableLog, [`create ${name}`, `close ${name} 1`]);
    assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
    assert.equal(store.getState().isDirty, false); assert(store.getState().fileHandle === before.handle, 'dezelfde handle');
    assert(!store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignDownloadCopy'),
      'de kopiemelding verdwijnt zodra het geopende bestand is bijgewerkt');
  } finally { handleFaults.clear(); unregister(); browser.dispose(); await clearRecovery(); }
});

// Review van #1002 (BLOKKEERT 2): vreemde inhoud zonder gebouwmodel (alleen een eigenschappenset van een ander programma).
// De modelscan zegt 'no-model'; export en download doen precies wat main doet.
await check('vreemde inhoud zonder gebouwmodel: export zonder zin, download telt als opgeslagen, zoals main', async () => {
  const { scanTargetBytes } = await import('@/services/ifc/foreign/targetModelScan');
  const original = readFileSync(join(root, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  const source = original.replace('ENDSEC;\nEND-ISO-10303-21;',
    "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n" +
    "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;");
  assert.notEqual(source, original);
  const input = new TextEncoder().encode(source);
  assert.equal(scanTargetBytes(input), 'no-model', 'geen gebouwmodel');
  const { store } = await openInStore(input);
  assert(hasForeignContent(store.getState().ifcSource), 'wel vreemde inhoud');
  for (const format of ['csv', 'mspdi'] as const) {
    const flagOn = await exportNotices(store, format);
    assert.deepEqual(flagOn, withoutSentence(flagOn), `${format}: geen zin`);
  }
  const { store: onHandle, name } = await openHandle(input), unregister = recoveryRounds(onHandle), browser = browserDownload();
  try {
    longer(onHandle); clearNotices(onHandle); handleFaults.set(name, { permission: 'denied' });
    assert.equal(await ctrlS(onHandle), true, 'de download telt als opgeslagen, zoals main');
    assert.equal(browser.downloads.length, 1); assert.equal(onHandle.getState().isDirty, false);
    assert(!onHandle.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignDownloadCopy'), 'geen kopiemelding');
    assert.equal(hash(fileOf(name)), hash(input), 'het geopende bestand blijft staan');
  } finally { handleFaults.clear(); unregister(); browser.dispose(); await clearRecovery(); }
});

// Review van #1002 ronde 2 (BLOKKEERT 1): twee bronnen met een gebouwmodel die de lezer opent maar de strengere doelscan
// `unreadable` noemt. Het antwoord komt van de bron (de scan die de bron accepteerde), dus het document blijft gewijzigd,
// het tabblad sluit niet en CSV krijgt de zin.
for (const [variant, edit] of [
  ['kop zonder tweede argument van FILE_DESCRIPTION', (text: string) => text.replace(",'2;1');", ');')],
  ['IFCREAL(NAN) vóór de eerste wand', (text: string) => text.replace(/^DATA;\n/m, "DATA;\n#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCREAL(NAN),$);\n")],
] as const) await check(`gebouwmodel met ${variant}: blijft gewijzigd, sluit niet, CSV met de zin`, async () => {
  const { scanTargetBytes } = await import('@/services/ifc/foreign/targetModelScan');
  const model = new TextDecoder().decode(bytes), content = edit(model);
  assert.notEqual(content, model);
  const input = new TextEncoder().encode(content);
  assert.equal(scanTargetBytes(input), 'unreadable', 'de doelscan beslist hier niet');
  const { store, name } = await openHandle(input), unregister = recoveryRounds(store), browser = browserDownload();
  try {
    assert(store.getState().ifcSource?.foreign, 'geopend met vreemde inhoud');
    longer(store);
    const notices = await exportNotices(store, 'csv');
    assert.deepEqual(notices.flatMap(n => [n.key, ...n.lines]).filter(key => key === PLAN_ONLY_EXPORT), [PLAN_ONLY_EXPORT], 'CSV met de zin');
    handleFaults.set(name, { permission: 'denied' });
    let closed = false;
    await createCloseDocumentDialogActions({
      pendingId: store.getState().activeDocumentId, getActiveDocumentId: () => store.getState().activeDocumentId,
      switchDocument: store.getState().switchDocument, closeDocument: () => { closed = true; },
      saveFile: () => ctrlS(store), clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
    }).save();
    assert.equal(closed, false, 'het tabblad sluit niet na alleen een kopie');
    assert.equal(store.getState().isDirty, true, 'het document blijft gewijzigd');
    assert.equal(browser.downloads.length, 1, 'de kopie (de CSV telt `exportNotices` zelf)');
    assert.equal(hash(fileOf(name)), hash(input), 'het geopende bestand blijft staan');
  } finally { handleFaults.clear(); unregister(); browser.dispose(); await clearRecovery(); }
});

// Review van #1002 ronde 2 (BLOKKEERT 2): drie documenten met een gebouwmodel en een geweigerde schrijftoestemming, daarna
// een export. De kopiemeldingen nemen samen hoogstens één plek in, dus na afloop staan de meldingen van de export er nog
// (wat main toont, plus de zin). De stapel wordt vooraf bewust niet geleegd.
async function threeCopies() {
  const { store, name } = await openHandle(), browser = browserDownload(), ids: string[] = [];
  clearNotices(store);
  for (const [i, modelName] of [name, `${name}.tab2.ifc`, `${name}.tab3.ifc`].entries()) {
    if (i > 0) {
      handleFiles.set(modelName, bytes);
      await store.getState().openOpenedFile({ name: modelName, content: '', bytes, ref: { kind: 'handle', handle: new FakeHandle(modelName) as unknown as FileSystemFileHandle } });
    }
    ids.push(store.getState().activeDocumentId);
    longer(store); handleFaults.set(modelName, { permission: 'denied' });
    assert.equal(await ctrlS(store), false); assert.equal(store.getState().isDirty, true);
  }
  assert.equal(new Set(ids).size, 3); assert.equal(browser.downloads.length, 3);
  return { store, browser, ids };
}
const keysAndLines = (store: Store) => store.getState().ui.notifications.map(n => [n.messageKey, ...(n.detailLines ?? []).map(l => l.messageKey)]);
await check('drie kopieën, daarna CSV uit het derde document: de exportmeldingen en de zin staan er', async () => {
  const { store, browser } = await threeCopies();
  try {
    const result = await store.getState().exportAs('csv');
    assert(result.ok && !result.cancelled); assert.equal(browser.downloads.length, 4);
    const final = keysAndLines(store), flat = final.flat();
    assert.equal(flat.filter(key => key === PLAN_ONLY_EXPORT).length, 1, `de zin precies één keer: ${JSON.stringify(final)}`);
    assert(flat.includes('notifications.savedViaDownload'), 'de downloadmelding');
    assert(flat.includes('notifications.exportDataLoss'), 'de verliesmelding');
  } finally { handleFaults.clear(); browser.dispose(); await clearRecovery(); }
});
await check('drie kopieën, daarna CSV uit een gewone planning: download- en verliesmelding zoals main', async () => {
  const { store, browser } = await threeCopies();
  try {
    const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
    await store.getState().openOpenedFile({ name: 'gewone-planning.ifc', content: '', bytes: plain, ref: null });
    assert(!hasForeignContent(store.getState().ifcSource));
    const result = await store.getState().exportAs('csv');
    assert(result.ok && !result.cancelled); assert.equal(browser.downloads.length, 4);
    const flat = keysAndLines(store).flat();
    assert(flat.includes('notifications.savedViaDownload') && flat.includes('notifications.exportDataLoss'), JSON.stringify(flat));
    assert(!flat.includes(PLAN_ONLY_EXPORT), 'geen zin');
  } finally { handleFaults.clear(); browser.dispose(); await clearRecovery(); }
});
await check('de ene kopiemelding noemt de laatste kopie en verdwijnt als dat document sluit', async () => {
  const { store, browser, ids } = await threeCopies();
  try {
    const copy = () => store.getState().ui.notifications.filter(n => n.messageKey === 'notifications.ifcForeignDownloadCopy');
    assert.equal(copy().length, 1, 'hoogstens één kopiemelding');
    assert.equal(copy()[0].params?.file, `${(await import('@/state/slices/fileSlice')).suggestedFileBase(store.getState())}.ifc`, 'ze noemt de laatste kopie');
    store.getState().closeDocument(ids[0]);
    assert.equal(copy().length, 1, 'een ander document sluiten laat haar staan');
    store.getState().closeDocument(ids[2]);
    assert.equal(copy().length, 0, 'het document dat ze noemt is gesloten');
    assert(store.getState().documents.some(d => d.id === ids[1]), 'het tweede document is er nog');
  } finally { handleFaults.clear(); browser.dispose(); await clearRecovery(); }
});

// Knownbug 1768, punt 5: een document zonder gebouwmodel houdt de gewone route. Eerst de opslaankiezer; zonder kiezer een
// download die het document op opgeslagen zet. Geen melding over een kopie.
await check('gewoon document, handle zonder schrijftoestemming: eerst de opslaankiezer, anders een download, zoals main', async () => {
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  const win = window as unknown as Record<string, unknown>;
  for (const picker of [true, false]) {
    const { store, name } = await openHandle(plain), browser = browserDownload(), chosen: string[] = [];
    if (picker) {
      win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
      win.showSaveFilePicker = async () => {
        const target = `${name}.nieuw`; chosen.push(target); handleFiles.set(target, new Uint8Array());
        return new FakeHandle(target);
      };
    }
    try {
      longer(store); clearNotices(store); handleFaults.set(name, { permission: 'denied' });
      assert.equal(await ctrlS(store), true, `kiezer ${picker}: opgeslagen`);
      assert.equal(hash(fileOf(name)), hash(plain), 'het geopende bestand blijft staan');
      assert.equal(store.getState().isDirty, false);
      assert.equal(chosen.length, picker ? 1 : 0); assert.equal(browser.downloads.length, picker ? 0 : 1);
      assert.equal(store.getState().fileHandle === null, !picker, picker ? 'de nieuwe handle' : 'de download verliest de handle');
      assert(!store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignDownloadCopy'));
    } finally { handleFaults.clear(); browser.dispose(); delete win.showOpenFilePicker; }
  }
});

await check('handle: een ander open document met hetzelfde bestand als bron blijft geweigerd', async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store);
  try {
    store.getState().newDocument();
    await store.getState().openOpenedFile({ name, content: '', bytes, ref: { kind: 'handle', handle: new FakeHandle(name) as unknown as FileSystemFileHandle } });
    longer(store); clearNotices(store); writableLog.length = 0;
    const before = preserved(store);
    assert.equal(await ctrlS(store), false);
    unchanged(store, before); assertNotice(store, 'notifications.ifcForeignReplaceBlocked');
    assert.deepEqual(writableLog, []); assert.equal(hash(fileOf(name)), hash(bytes));
    const s = store.getState(), deps = { identityFs: async () => undefined, readers: () => ({}) };
    const own = { documentId: s.activeDocumentId, source: s.ifcSource! };
    assert.equal(await refusedWriteTarget(s, { kind: 'handle', handle: s.fileHandle! }, deps, own), 'open-source');
  } finally { unregister(); await clearRecovery(); }
});

await check('doelcontrole: de uitzondering "eigen doel" alleen voor de eigen handle, nooit voor een pad of een export', async () => {
  const { store, name } = await openHandle(), s = store.getState();
  const deps = { identityFs: async () => undefined, readers: () => ({}) };
  const handle = { kind: 'handle' as const, handle: s.fileHandle! }, own = { documentId: s.activeDocumentId, source: s.ifcSource! };
  assert.equal(await refusedWriteTarget(s, handle, deps, own), null, 'eigen document, eigen handle');
  assert.equal(await refusedWriteTarget(s, handle, deps), 'open-source', 'zonder ownVersion (export, Opslaan als) geen uitzondering');
  assert.equal(await refusedWriteTarget(s, handle, deps, { ...own, documentId: 'ander-document' }), 'open-source');
  assert.equal(await refusedWriteTarget(s, handle, deps, { ...own, source: { ...own.source } }), 'open-source', 'een andere bron');
  const other = { kind: 'handle' as const, handle: new FakeHandle(`${name}.ander`) as unknown as FileSystemFileHandle };
  handleFiles.set(`${name}.ander`, bytes);
  assert.equal(await refusedWriteTarget(s, other, deps, own), 'building-model', 'een andere handle: geen uitzondering, het model in het doel weigert');
  store.setState(x => { x.ui.featureFlags = {}; });
  assert.equal(await refusedWriteTarget(store.getState(), handle, deps, own), 'open-source', 'flag uit');
  store.setState(x => { x.ui.featureFlags = { ifcForeignContent: true }; x.foreignSourceMark = { ...x.foreignSourceMark!, sourceMissing: true }; });
  assert.equal(await refusedWriteTarget(store.getState(), handle, deps, own), 'open-source', 'bron ontbreekt');
  const path = join(dir, 'pad-eigen-doel.ifc'); writeFileSync(path, bytes);
  const onPath = await openAt({ kind: 'path', path }), p = onPath.getState();
  assert.equal(await refusedWriteTarget(p, { kind: 'path', path }, deps, { documentId: p.activeDocumentId, source: p.ifcSource! }),
    'open-source', 'een pad krijgt de uitzondering niet (stap 5)');
});

for (const cause of ['flag-uit', 'sourceMissing'] as const) await check(`handle ${cause}: Ctrl+S weigert zoals nu, nul bytes`, async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store), browser = browserDownload();
  try {
    longer(store);
    store.setState(s => {
      if (cause === 'flag-uit') s.ui.featureFlags = {};
      else s.foreignSourceMark = { ...s.foreignSourceMark!, sourceMissing: true };
    });
    clearNotices(store); writableLog.length = 0; const before = preserved(store);
    assert.equal(await ctrlS(store), false); unchanged(store, before);
    assertNotice(store, cause === 'flag-uit' ? 'notifications.ifcForeignSaveBlocked' : 'notifications.ifcForeignSourceMissing');
    assert.deepEqual(writableLog, []); assert.equal(browser.downloads.length, 0); assert.equal(hash(fileOf(name)), hash(bytes));
  } finally { unregister(); browser.dispose(); await clearRecovery(); }
});

await check('handle zonder gebouwmodel, flag aan: Ctrl+S schrijft de gewone tekst zoals main, zonder herstelronde', async () => {
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  const { store, name } = await openHandle(plain);
  longer(store); writableLog.length = 0;
  const expected = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
  assert.equal(await ctrlS(store), true);
  assert.equal(new TextDecoder().decode(fileOf(name)), expected);
  assert.deepEqual(writableLog, [`create ${name}`, `close ${name} 1`], 'de gewone tekstroute (saveToRefWeb)');
  assert.equal(store.getState().isDirty, false);
});

// ── #804 stap 3: een opslag hoort bij het document van zijn momentopname; sluiten wacht; één wachtende opslag. ──
/** Eén keer iets doen na de eerstvolgende herstelronde: die van `replaceWithRecoveryPending`, midden in de opslag
 *  (na de merge en het vastleggen van de komende versie, vóór de laatste controle en het schrijven). */
function midSave() {
  let action: (() => void) | undefined;
  return { set: (a: () => void) => { action = a; }, run: () => { const a = action; action = undefined; a?.(); } };
}
const turnUntil = async (done: () => boolean) => {
  for (let i = 0; i < 2000 && !done(); i++) await new Promise(r => setImmediate(r));
  assert(done(), 'de opslag bereikte het verwachte punt');
};

await check('handle Ctrl+S met een tabbladwissel tijdens de opslag: het slapende document wordt opgeslagen, het actieve blijft onaangeroerd', async () => {
  const { store, name } = await openHandle(), hook = midSave(), unregister = recoveryRounds(store, hook.run), browser = browserDownload();
  try {
    const edited = longer(store), id = store.getState().activeDocumentId;
    const duration = store.getState().tasks.find(t => t.id === edited)!.time.scheduleDuration;
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    let other: ReturnType<typeof otherDocument> | undefined;
    hook.set(() => { other = otherDocument(store); });
    clearNotices(store); writableLog.length = 0;
    assert.equal(await ctrlS(store), true, 'de opslag gaat door na de wissel');
    assert(other, 'de wissel gebeurde tijdens de opslag');
    const output = fileOf(name), saved = payloadOf(store, id);
    assert.equal(hash(output), expected.sha256, 'het doel kreeg precies de merge van het opgeslagen document');
    assert.deepEqual(writableLog, [`create ${name}`, `close ${name} 1`]);
    const reopened = await openForeign(output);
    assert.equal(reopened.tasks.find(t => t.id === edited)!.time.scheduleDuration, duration);
    assert.equal(reopened.tasks.some(t => t.name === 'Taak van het andere document'), false, 'niets van het actieve document');
    assert.equal(saved.isDirty, false, 'vastgelegd in het slapende document');
    assert.equal(saved.ifcSource!.sha256, hash(output)); assert.equal(saved.foreignSourceMark!.sha256, hash(output));
    otherUntouched(store, other!);
    assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').length, 0);
    assert.equal((await loadRecovery()).docs.find(d => d.id === id)?.ifcSource?.sha256, hash(output), 'het herstel volgt de nieuwe bron');
  } finally { unregister(); browser.dispose(); await clearRecovery(); }
});

for (const cause of ['document gesloten', 'bron vervangen'] as const) {
  await check(`handle Ctrl+S, ${cause} tijdens de opslag: de weigering, niets geschreven`, async () => {
    const { store, name } = await openHandle(), hook = midSave(), unregister = recoveryRounds(store, hook.run), browser = browserDownload();
    try {
      longer(store); const id = store.getState().activeDocumentId;
      const replacement = cause === 'bron vervangen'
        ? await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!) : null;
      hook.set(() => {
        if (replacement) store.getState().commitSavedDocument(id, store.getState(), undefined, replacement);
        else { store.getState().newDocument(); store.getState().closeDocument(id); }
      });
      clearNotices(store); writableLog.length = 0;
      assert.equal(await ctrlS(store), false);
      assert.equal(hash(fileOf(name)), hash(bytes), 'het bestand is niet vervangen');
      assert.deepEqual(writableLog, [], 'geen schrijfstroom');
      if (replacement) assert(store.getState().ifcSource === replacement.source, 'de vervangen bron blijft staan');
      else assert.equal(store.getState().documents.some(d => d.id === id), false);
      assertNotice(store, 'notifications.ifcSaveChangedWhileWaiting');
    } finally { unregister(); browser.dispose(); await clearRecovery(); }
  });
}

await check('handle Ctrl+S: sluiten tijdens de opslag wacht, met de aanduiding, en sluit daarna zonder vraag', async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store), browser = browserDownload();
  let release!: () => void; const held = new Promise<void>(r => { release = r; });
  handleFaults.set(name, { afterClose: () => held });
  try {
    longer(store); const id = store.getState().activeDocumentId;
    const neighbour = store.getState().newDocument(); store.getState().switchDocument(id);
    clearNotices(store); writableLog.length = 0;
    const saving = ctrlS(store);
    await turnUntil(() => writableLog.includes(`close ${name} 1`));
    store.getState().requestCloseDocument(id);
    assert.equal(store.getState().ui.savingBeforeClose, true, '"Wordt nog opgeslagen…" staat');
    assert(store.getState().documents.some(d => d.id === id), 'het document is er nog');
    assert.equal(store.getState().ui.pendingCloseDocId, null, 'geen sluitvraag tijdens de opslag');
    release();
    assert.equal(await saving, true);
    await turnUntil(() => !store.getState().documents.some(d => d.id === id));
    assert.equal(store.getState().ui.savingBeforeClose, false, 'de aanduiding is weg');
    assert.equal(store.getState().ui.pendingCloseDocId, null, 'opgeslagen, dus zonder sluitvraag gesloten');
    assert.equal(store.getState().activeDocumentId, neighbour);
    assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').length, 0);
  } finally { release(); handleFaults.clear(); unregister(); browser.dispose(); await clearRecovery(); }
});

await check('sluiten zonder lopende opslag: meteen, zonder aanduiding; gewijzigd geeft meteen de sluitvraag', async () => {
  const { store } = await openInStore(bytes);
  const shown: boolean[] = [];
  const off = store.subscribe((now, before) => { if (now.ui.savingBeforeClose !== before.ui.savingBeforeClose) shown.push(now.ui.savingBeforeClose); });
  try {
    const first = store.getState().activeDocumentId, second = store.getState().newDocument();
    store.getState().requestCloseDocument(second);
    assert.equal(store.getState().documents.some(d => d.id === second), false, 'het schone document is in dezelfde beurt gesloten');
    longer(store);
    store.getState().requestCloseDocument(first);
    assert.equal(store.getState().ui.pendingCloseDocId, first, 'het gewijzigde document krijgt in dezelfde beurt de sluitvraag');
    await store.getState().closeDocumentAfterSaves(first);
    assert.equal(store.getState().documents.some(d => d.id === first), false);
    assert.deepEqual(shown, [], 'nooit de aanduiding');
  } finally { off(); }
});

await check('handle: drie keer Ctrl+S tijdens een lopende opslag geeft twee opslagen, niet vier; de tweede neemt alles mee', async () => {
  const { store, name } = await openHandle(), unregister = recoveryRounds(store), browser = browserDownload();
  let release!: () => void; const held = new Promise<void>(r => { release = r; });
  handleFaults.set(name, { afterClose: () => held });
  try {
    longer(store); clearNotices(store); writableLog.length = 0;
    const first = ctrlS(store);
    await turnUntil(() => writableLog.includes(`close ${name} 1`));
    const edited = longer(store), duration = store.getState().tasks.find(t => t.id === edited)!.time.scheduleDuration;
    const more = [ctrlS(store), ctrlS(store), ctrlS(store)];
    release();
    // De eerste is opgeslagen maar niet schoon (er kwam een bewerking bij); de wachtende neemt die mee.
    assert.deepEqual(await Promise.all([first, ...more]), [false, true, true, true]);
    assert.equal(writableLog.filter(l => l === `create ${name}`).length, 2, 'twee vervangingen');
    const reopened = await openForeign(fileOf(name));
    assert.equal(reopened.tasks.find(t => t.id === edited)!.time.scheduleDuration, duration, 'de wachtende opslag nam de latere bewerking mee');
    assert.equal(store.getState().isDirty, false);
    assert.equal(hash(store.getState().ifcSource!.bytes), hash(fileOf(name)));
  } finally { release(); handleFaults.clear(); unregister(); browser.dispose(); await clearRecovery(); }
});

await check('AutoSave-ronde die na het begin van de laatste fase (afsluiten, updater) om het slot vraagt, schrijft niet', async () => {
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  const { store, name } = await openHandle(plain);
  store.getState().setAutoSaveToFile(true); longer(store); writableLog.length = 0; clearNotices(store);
  // De ronde kiest haar kandidaten met een open poort; de laatste fase begint voordat ze om het schrijfslot vraagt.
  let closing: Promise<() => void> | undefined;
  const autosave = createFileAutoSaveController({ getState: store.getState, enabled: () => { closing ??= closeProjectFileWrites(); return true; } });
  await autosave.flush();
  assert(closing, 'de laatste fase begon tijdens de ronde');
  assert.deepEqual(writableLog, [], 'niets geschreven');
  assert.equal(hash(fileOf(name)), hash(plain));
  assert.equal(store.getState().isDirty, true);
  assert.equal(store.getState().ui.notifications.length, 0, 'geen melding');
  // Na een afgebroken fase (een mislukte installatie) schrijft de volgende ronde wel.
  (await closing)();
  await createFileAutoSaveController({ getState: store.getState, enabled: () => true }).flush();
  assert.equal(store.getState().isDirty, false, 'weer opgeslagen');
  assert.notEqual(hash(fileOf(name)), hash(plain));
});

rmSync(dir, { recursive: true, force: true });
console.log(`Documentopslag: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
