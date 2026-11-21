// #804 PR 11a: echte documentacties, volledige heropening of bewijs van nul schrijfacties.
// Bronobjecten alleen op identiteit vergelijken; nooit een assert-diff van bronbytes maken.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, linkSync, readdirSync, realpathSync, rmSync } from 'node:fs';
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
import { computeIfcOutputHere, prepareIfcOutput, IfcWriteBlockedError, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { createIfcSaveWorker, type IfcSaveWorkerOptions } from '@/services/ifc/saveWorker/ifcSaveWorker';
import { documentContentOf, saveStatusOf } from '@/state/documentSaveState';
import { refusedWriteTarget, ifcFullWriteBlocked, ifcSaveBlocked } from '@/state/ifcForeignGuard';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { scheduleFileAutoSave } from '@/services/actualAutosave/fileAutoSaveTimers';
import { closeProjectFileWrites, isProjectFileWriteBusy } from '@/services/fileAccess/writeCoordinator';
import { setSiteSaveAsker, resetSiteAskers } from '@/services/fileAccess/siteDialogs';
import { resetFolderAccessAsker, setFolderAccessAsker } from '@/services/fileAccess/replaceFolderAccess';
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
import { InProcessWorker } from './inProcessSaveWorker';
import { createExtensionApi } from '@/extensions/extensionApi';

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
  catch (error) {
    failed++;
    // Een fout zonder `Error` (een melding, een uitkomst) als JSON, niet als "[object Object]".
    const text = error instanceof Error ? error.message : typeof error === 'object' ? JSON.stringify(error) : String(error);
    console.error(`XX ${name}: ${text.slice(0, 1600)}`);
  }
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
/** `appDataDir`: zonder een eigen map een verse tijdelijke; Opslaan als over een bestaand bestand legt met de flag aan het
 *  herstelrecord van de vervanging daar vast (fixronde 2 van #1071). */
function desktop(appDataDir: string = mkdtempSync(join(tmpdir(), 'ops-804-appdata-'))) {
  const ipc = installNodeFileIpc({ appDataDir });
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
/** `ifcSaveCompute`: het rekenen van de opslag, zoals `appStore.ts` de opslagworker aan de app geeft (#804 stap 5). */
async function openAt(ref: import('@/services/fileAccess').FileRef, data = bytes, ifcSaveCompute?: IfcOutputCompute) {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext({ ifcSaveCompute });
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

// Knownbug 1131 stap 5b: het gewone vervolg Opslaan als → Ctrl+S op het zojuist gemaakte bestand, en het origineel.
// De vervanging zelf is uitgebreid beproefd in `check-ifc-own-file-replace.ts`; hier de keten vanaf de productie-ingang.
await check('Ctrl+S en sluitvraag: origineel en zojuist gemaakte naam worden vervangen, het model bytegelijk', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const ipc = desktop(appData);
  try {
    const original = join(dir, 'origineel.ifc'); writeFileSync(original, bytes);
    const store = await openAt({ kind: 'path', path: original });
    const unregister = recoveryRounds(store);
    try {
      for (const step of [0, 1]) {
        if (step === 1) { ipc.choose(join(dir, 'voor-ctrl-s.ifc')); await store.getState().saveFileAs(); }
        const id = store.getState().activeDocumentId, path = store.getState().filePath!;
        longer(store); clearNotices(store);
        assert.equal(await store.getState().saveFileForDocument(id), true);
        const output = new Uint8Array(readFileSync(path));
        assert.deepEqual(mergeProblems(bytes, output), [], 'het gebouwmodel bytegelijk');
        assert.equal(store.getState().ifcSource!.sha256, hash(output), 'de geschreven versie is de bron');
        assert.deepEqual([store.getState().isDirty, store.getState().filePath], [false, path]);
        assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), []);
        assert.deepEqual(tempLeft(), [], 'geen hulpbestand');
        longer(store);
        let closed = false;
        await createCloseDocumentDialogActions({
          pendingId: id, getActiveDocumentId: () => store.getState().activeDocumentId,
          switchDocument: store.getState().switchDocument, closeDocument: () => { closed = true; },
          saveFile: () => store.getState().saveFileForDocument(id),
          clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
        }).save();
        assert.equal(closed, true, 'Opslaan in de sluitvraag sluit na een geslaagde vervanging');
        assert.equal(hash(new Uint8Array(readFileSync(path))), store.getState().ifcSource!.sha256);
      }
      assert.equal(hash(new Uint8Array(readFileSync(original))) !== hash(bytes), true, 'het origineel is ook vervangen');
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

// #804 keuze 4 (knownbug 1131 stap 8): Opslaan als over een bestaand bestand vervangt het langs de weg van Ctrl+S; de
// proeven daarvan staan in `check-ifc-own-file-replace.ts` (deel c). Hier de grens van 1764 op die route: zonder
// vastgelegde herstelronde schrijft de app niet, zoals bij Ctrl+S.
await check('Opslaan als over een bestaand bestand zonder herstelronde: niets geschreven, de melding van Ctrl+S', async () => {
  const { store } = await openInStore(bytes); longer(store);
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const ipc = desktop(appData), target = join(dir, 'bestaand.ifc');
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  writeFileSync(target, plain); ipc.choose(target);
  const before = preserved(store);
  try {
    const calls = ipc.calls.length;
    clearNotices(store); await store.getState().saveFileAs(); unchanged(store, before);
    assert.equal(hash(new Uint8Array(readFileSync(target))), hash(plain));
    assertNotice(store, 'notifications.ifcForeignReplaceNotRecorded');
    assert.deepEqual(ipc.calls.slice(calls).filter(c => c.wrote && c.path?.startsWith(dir)), [], 'nul schrijfacties in de map');
    assert.deepEqual(ipc.calls.slice(calls).filter(c => c.command === 'place_file_exclusive'), [], 'niets verplaatst');
    assert.deepEqual(tempLeft(), []);
  } finally { ipc.dispose(); rmSync(appData, { recursive: true, force: true }); }
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
      ipc.onPick(() => { store.getState().commitSavedDocument(documentContentOf(store.getState(), id)!, store.getState(), undefined, other); });
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

// #804 stap 8: met de flag aan doet een document met een gebouwmodel mee (de proeven onderaan); met de flag uit (na het
// openen uitgezet) blijft het zoals op main: nul bytes en de bestaande melding.
await check('AutoSave met de flag uit: nul bytes, één bestaande melding per document per sessie', async () => {
  const ipc = desktop(), original = join(dir, 'autosave-bron.ifc'); writeFileSync(original, bytes);
  try {
    const store = await openAt({ kind: 'path', path: original }); longer(store);
    store.setState(s => { s.autoSaveToFile = true; s.ui.featureFlags = {}; }); clearNotices(store);
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
    // Fixronde 1 van #1071, punt 3: de bron van een ander open document is het bestand van een open tabblad.
    assertNotice(store, kind === 'bestaand' ? 'notifications.ifcForeignNewTargetOnly'
      : kind === 'andere-bron' ? 'notifications.exportTargetOpenInTab' : 'notifications.ifcForeignTargetExport');
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

// Knownbug 1903 (besluit technisch beslisser, 21 november 2026): een documentwissel tijdens de kiezer is geen wijziging
// van A. De export schrijft dan precies wat A zonder wissel schrijft, niets van het nieuwe tabblad. Tot #1097 eiste deze
// proef nul bytes (`3ecdeec01`, toen de controle de bron van het actieve tabblad vergeleek).
for (const cause of ['flag-uit-na-kiezer', 'sourceMissing-na-kiezer', 'nieuwe-bron', 'documentwissel'] as const) {
  await check(`IFC-export ${cause}: ${cause === 'documentwissel' ? 'precies de bytes van A' : 'nul bytes'} na voorbereiding`, async () => {
    const { store } = await openInStore(bytes); longer(store);
    const before = preserved(store), id = store.getState().activeDocumentId, ipc = desktop();
    const target = join(dir, `export-laat-${cause}.ifc`); ipc.choose(target);
    const other = cause === 'nieuwe-bron'
      ? await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), before.source!) : null;
    const ofA = cause === 'documentwissel'
      ? (await prepareIfcWrite(buildExportIFCInput(store.getState(), 'merge'), before.source!)).bytes : null;
    const nameOfA = store.getState().project.name;
    ipc.onPick(() => {
      if (cause === 'documentwissel') {
        // Een herkenbaar B: alles hiervan dat in het bestand komt, valt op.
        store.getState().newDocument();
        store.getState().setProject({ name: 'ProjectBravo1097' });
        store.getState().addTask({ name: 'TaakBravo1097' });
      } else if (other) store.getState().commitSavedDocument(documentContentOf(store.getState(), id)!, store.getState(), undefined, other);
      else store.setState(s => {
        if (cause === 'flag-uit-na-kiezer') s.ui.featureFlags = {};
        else s.foreignSourceMark = { ...s.foreignSourceMark!, sourceMissing: true };
      });
    });
    try {
      const result = await store.getState().exportAs('ifc');
      if (ofA) {
        assert(result.ok && !result.cancelled, 'de export van A rondt af');
        const written = new Uint8Array(readFileSync(target));
        assert.equal(hash(written), hash(ofA), 'precies wat A zonder documentwissel schrijft');
        const fresh = store.getState();
        assert.notEqual(fresh.activeDocumentId, id, 'het nieuwe tabblad is actief');
        const text = new TextDecoder().decode(written);
        assert(nameOfA && text.includes(`IFCPROJECT('`) && text.includes(`'${nameOfA}'`), 'het project van A');
        assert.equal(fresh.project.name, 'ProjectBravo1097');
        assert(fresh.tasks.some(t => t.name === 'TaakBravo1097'), 'B heeft eigen inhoud');
        assert(!text.includes('ProjectBravo1097') && !text.includes('TaakBravo1097'), 'niets van het nieuwe tabblad');
        store.getState().switchDocument(id);
      } else {
        assert(result.ok && result.cancelled);
        assert.equal(existsSync(target), false); assert.equal(ipc.calls.filter(c => c.wrote).length, 0);
      }
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
      // Fixronde 1 van #1071, punt 3: de bron van een ander open document is het bestand van een open tabblad.
      assertNotice(store, kind === 'andere-bron' ? 'notifications.exportTargetOpenInTab' : 'notifications.ifcForeignTargetExport');
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
      else if (other) store.getState().commitSavedDocument(documentContentOf(store.getState(), id)!, store.getState(), undefined, other);
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
async function openHandle(data = bytes, ifcSaveCompute?: IfcOutputCompute) {
  const name = `model-${++handleCount}.ifc`, handle = new FakeHandle(name);
  handleFiles.set(name, data);
  const store = await openAt({ kind: 'handle', handle: handle as unknown as FileSystemFileHandle }, data, ifcSaveCompute);
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
    assert.deepEqual([shown[0].severity, shown[0].sticky ?? false], ['info', false], 'een gewone melding die vanzelf verdwijnt (ronde 3)');
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

// Review van #1002 ronde 3 (BLOKKEERT 1, keuze 1 van de orkestrator): een complexe instantie telt altijd als
// gebouwmodel, zonder tekst te lezen. Commentaar of kleine letters tussen de deelnamen maken geen verschil meer.
const plainExample = () => readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc'), 'utf8');
for (const variant of ['hoofdletters', 'commentaar', 'kleine-letters'] as const) {
  await check(`gebouwmodel in een complexe instantie (${variant}): blijft gewijzigd, sluit niet, CSV met de zin`, async () => {
    const gap = variant === 'commentaar' ? ' /* IFC STEP commentaar */ ' : '';
    const type = (word: string) => variant === 'kleine-letters' ? word.toLowerCase() : word;
    const wall = [
      'IFCBUILDINGELEMENT()', 'IFCELEMENT($)', 'IFCOBJECT($)', 'IFCOBJECTDEFINITION()',
      'IFCPRODUCT($,$)', "IFCROOT('242F3AJ$ylGv3IUzUFH5GZ',$,'Proefwand',$)", 'IFCWALL(.NOTDEFINED.)',
    ].map(part => part.replace(/^([A-Z]+)\(/, (_, word: string) => `${type(word)}${gap}(`)).join(' ');
    const plain = plainExample(), content = plain.replace(/\bDATA;\r?\n/, match => `${match}#99001=(${wall});\n`);
    assert.notEqual(content, plain);
    const input = new TextEncoder().encode(content), { store, name } = await openHandle(input), browser = browserDownload();
    try {
      assert.deepEqual([store.getState().ifcSource?.foreign, store.getState().ifcSource?.buildingModel], [true, true], 'bron met gebouwmodel');
      const id = store.getState().activeDocumentId, task = longer(store);
      const wanted = store.getState().tasks.find(t => t.id === task)!.time.scheduleDuration;
      const notices = await exportNotices(store, 'csv');
      assert.deepEqual(notices.flatMap(n => [n.key, ...n.lines]).filter(key => key === PLAN_ONLY_EXPORT), [PLAN_ONLY_EXPORT], 'CSV met de zin');
      handleFaults.set(name, { permission: 'denied' });
      assert.equal(await ctrlS(store), false, 'Ctrl+S: niet opgeslagen');
      assert.equal(store.getState().isDirty, true, 'het document blijft gewijzigd');
      assert.equal(hash(fileOf(name)), hash(input), 'het geopende bestand blijft staan');
      assert.equal(browser.downloads.length, 1);
      const copy = await browser.downloads[0].text();
      assert(copy.includes(`#99001=(${wall});`), 'de kopie draagt de wand');
      assert.equal((await openForeign(new TextEncoder().encode(copy))).tasks.find(t => t.id === task)!.time.scheduleDuration, wanted);
      let closed = false;
      await createCloseDocumentDialogActions({
        pendingId: id, getActiveDocumentId: () => store.getState().activeDocumentId,
        switchDocument: store.getState().switchDocument, closeDocument: () => { closed = true; },
        saveFile: () => store.getState().saveFileForDocument(id), clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
      }).save();
      assert.equal(closed, false, '*Opslaan* in de sluitvraag sluit het tabblad niet');
      assert.equal(store.getState().isDirty, true);
    } finally { handleFaults.clear(); browser.dispose(); await clearRecovery(); }
  });
}
await check('gewone planning zonder vreemde inhoud: buildingModel false, export zonder zin', async () => {
  const plain = new TextEncoder().encode(plainExample()), { scanForeign } = await import('@/services/ifc/foreign/foreignScan');
  const scan = scanForeign(plain);
  assert(scan.ok, 'de scan leest het voorbeeld'); assert.equal(scan.buildingModel, false, 'de scan ziet geen gebouwmodel');
  const { store } = await openInStore(plain);
  assert.equal(store.getState().ifcSource?.buildingModel, false, 'de bron heeft geen gebouwmodel');
  assert(!hasForeignContent(store.getState().ifcSource));
  const notices = await exportNotices(store, 'csv');
  assert.deepEqual(notices, withoutSentence(notices), 'geen zin');
});

// Review van #1002 ronde 3 (BLOKKEERT 2, keuze 2): de kopiemelding is een gewone informatiemelding, zoals
// `savedViaDownload` op main. Twee blijvende openingswaarschuwingen (XER of IFC2X3) plus een kopie verdringen de
// exportmeldingen dus niet. De stapel wordt vooraf bewust niet geleegd.
const keysAndLines = (store: Store) => store.getState().ui.notifications.map(n => [n.messageKey, ...(n.detailLines ?? []).map(l => l.messageKey)]);
async function openWarnings(store: Store, kind: 'xer' | 'ifc2x3') {
  const files = kind === 'xer'
    ? ['zonder-geplande-start.xer', 'onbekend-taaktype.xer'].map(file => [file, readFileSync(join(root, 'tests/browser/fixtures/xer', file), 'utf8')])
    : (() => {
      const legacy = plainExample().replace(/FILE_SCHEMA\(.*?\);/, "FILE_SCHEMA(('IFC2X3'));");
      return [['archief-1.ifc', legacy], ['archief-2.ifc', legacy.replace(/FILE_NAME\('[^']*'/, "FILE_NAME('tweede-archief.ifc'")]];
    })();
  for (const [file, content] of files) {
    await store.getState().openOpenedFile({ name: file, content, bytes: new TextEncoder().encode(content), ref: null });
  }
  const warnings = store.getState().ui.notifications.filter(n => n.sticky);
  if (kind === 'xer') {
    assert.equal(warnings.filter(n => n.messageKey.startsWith('notifications.xerImport')).length, 2, JSON.stringify(keysAndLines(store)));
    const lines = warnings.flatMap(n => (n.detailLines ?? []).map(l => l.messageKey));
    assert(lines.includes('notifications.xerImportMissingPlannedStarts') && lines.includes('notifications.xerImportEnumFallbacks'), JSON.stringify(lines));
  } else assert.equal(warnings.filter(n => n.messageKey === 'notifications.ifc2x3PlanningOnly').length, 2, JSON.stringify(keysAndLines(store)));
}
for (const kind of ['xer', 'ifc2x3'] as const) for (const from of ['model', 'gewoon'] as const) {
  await check(`twee ${kind}-openingswaarschuwingen, een kopie, daarna CSV uit ${from === 'model' ? 'het modeldocument' : 'een gewone planning'}`, async () => {
    const { store, name } = await openHandle(), browser = browserDownload();
    try {
      const modelId = store.getState().activeDocumentId;
      longer(store);
      await openWarnings(store, kind);
      store.getState().switchDocument(modelId);
      handleFaults.set(name, { permission: 'denied' });
      assert.equal(await ctrlS(store), false); assert.equal(browser.downloads.length, 1, 'de kopie');
      assert(store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignDownloadCopy'), 'de kopiemelding');
      if (from === 'gewoon') {
        const plain = new TextEncoder().encode(plainExample());
        await store.getState().openOpenedFile({ name: 'gewone-planning.ifc', content: '', bytes: plain, ref: null });
        assert(!hasForeignContent(store.getState().ifcSource));
      }
      const result = await store.getState().exportAs('csv');
      assert(result.ok && !result.cancelled); assert.equal(browser.downloads.length, 2, 'de CSV');
      const flat = keysAndLines(store).flat();
      assert(flat.includes('notifications.exportDataLoss'), `de verliesmelding: ${JSON.stringify(keysAndLines(store))}`);
      assert.equal(flat.filter(key => key === PLAN_ONLY_EXPORT).length, from === 'model' ? 1 : 0, `de zin: ${JSON.stringify(keysAndLines(store))}`);
    } finally { handleFaults.clear(); browser.dispose(); await clearRecovery(); }
  });
}

// Drie documenten met een gebouwmodel en een geweigerde schrijftoestemming, daarna een export. Er is één gewone
// kopiemelding voor de hele app; elke nieuwe kopie ververst haar. De stapel wordt vooraf bewust niet geleegd.
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
await check('drie kopieën: één gewone kopiemelding die de laatste kopie noemt', async () => {
  const { store, browser } = await threeCopies();
  try {
    const copy = store.getState().ui.notifications.filter(n => n.messageKey === 'notifications.ifcForeignDownloadCopy');
    assert.equal(copy.length, 1, 'één kopiemelding');
    assert.deepEqual([copy[0].severity, copy[0].sticky ?? false, copy[0].count], ['info', false, 1], 'gewoon, ververst');
    assert.equal(copy[0].params?.file, `${(await import('@/state/slices/fileSlice')).suggestedFileBase(store.getState())}.ifc`, 'ze noemt de laatste kopie');
  } finally { handleFaults.clear(); browser.dispose(); await clearRecovery(); }
});
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
    // Fixronde 1 van #1071, punt 3: de melding noemt het open tabblad (was `ifcForeignReplaceBlocked`, de reden 'open-source').
    unchanged(store, before); assertNotice(store, 'notifications.ifcForeignTargetOpenInTab');
    assert.deepEqual(writableLog, []); assert.equal(hash(fileOf(name)), hash(bytes));
    const s = store.getState(), deps = { identityFs: async () => undefined, readers: () => ({}) };
    const own = { documentId: s.activeDocumentId, source: s.ifcSource! };
    assert.equal(await refusedWriteTarget(s, { kind: 'handle', handle: s.fileHandle! }, deps, own), 'open-document');
  } finally { unregister(); await clearRecovery(); }
});

await check('doelcontrole: de uitzondering "eigen doel" alleen voor de eigen handle of het eigen pad, nooit voor een export', async () => {
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
  const onPath = await openAt({ kind: 'path', path }), p = onPath.getState(), ownPath = { documentId: p.activeDocumentId, source: p.ifcSource! };
  // Knownbug 1131 stap 5b: het eigen pad op de desktop krijgt de uitzondering; of er nog de bron staat, toetst de vervanging.
  assert.equal(await refusedWriteTarget(p, { kind: 'path', path }, deps, ownPath), null, 'eigen document, eigen pad');
  assert.equal(await refusedWriteTarget(p, { kind: 'path', path }, deps), 'open-source', 'zonder ownVersion (export, Opslaan als) geen uitzondering');
  assert.equal(await refusedWriteTarget(p, { kind: 'path', path }, deps, { ...ownPath, source: { ...ownPath.source } }), 'open-source', 'een andere bron');
  assert.equal(await refusedWriteTarget(p, { kind: 'path', path: `${path}.ander` }, deps, ownPath), 'unreadable-target',
    'een ander pad: geen uitzondering (zonder lezer is het doel onleesbaar)');
  // Een ander open document met hetzelfde bestand als bron.
  onPath.getState().newDocument();
  await onPath.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes, ref: { kind: 'path', path } });
  const twice = onPath.getState();
  // Fixronde 1 van #1071, punt 3: de reden noemt het open tabblad (was 'open-source').
  assert.equal(await refusedWriteTarget(twice, { kind: 'path', path }, deps, { documentId: twice.activeDocumentId, source: twice.ifcSource! }),
    'open-document', 'een ander open document met dit bestand als bron blijft geweigerd');
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
const turnUntil = async (done: () => boolean, what = 'de opslag bereikte het verwachte punt') => {
  for (let i = 0; i < 2000 && !done(); i++) await new Promise(r => setImmediate(r));
  assert(done(), what);
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
        if (replacement) store.getState().commitSavedDocument(documentContentOf(store.getState(), id)!, store.getState(), undefined, replacement);
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

// ── #804 stap 5: het gebouwmodel via de opslagworker, en de opslagstand per document in de statusbalk. ──
/** De opslagworker zoals de app hem aan zijn store geeft (`appStore.ts`: de berekenfunctie van één client, voor de merge
 *  én de gewone writer, #804 stap 6), met dubbels in dit proces. `manual`: de proef start en beantwoordt zelf, zodat ze
 *  tijdens het rekenen kan typen of wisselen. */
function saveWorker(mode: 'auto' | 'manual' = 'auto', options: Omit<IfcSaveWorkerOptions, 'createWorker'> = {}) {
  const workers: InProcessWorker[] = [];
  const client = createIfcSaveWorker({ ...options, createWorker: () => { const w = new InProcessWorker(mode); workers.push(w); return w; } });
  const requests = () => workers.flatMap(w => w.requests);
  return { workers, client, compute: client.compute, requests,
    merges: () => requests().filter(r => r.job.kind === 'merge').length };
}
type SaveWorker = ReturnType<typeof saveWorker>;
/** Tot het n-de verzoek in de worker is: de opslag rekent dan in de achtergrond. */
const mergeArrives = (sw: SaveWorker, n: number) => turnUntil(() => sw.requests().length >= n);
/** De worker start (één keer) en beantwoordt zijn laatste verzoek met de echte handler. */
const finishMerge = async (sw: SaveWorker) => { const w = sw.workers.at(-1)!; w.start(); await w.answer(w.requests.length - 1); };
/** Wat de statusbalk voor dit document toont: 'saving' ("Opslaan…"), 'saved' ("Opgeslagen 14:32"), 'unsaved' of niets. */
const statusOf = (store: Store, id = store.getState().activeDocumentId) => {
  const s = store.getState(), entry = s.documents.find(d => d.id === id)!;
  return saveStatusOf(entry.saveState, id === s.activeDocumentId ? s.isDirty : entry.payload!.isDirty)?.kind ?? null;
};
const saveStateOf = (store: Store, id = store.getState().activeDocumentId) => store.getState().documents.find(d => d.id === id)!.saveState;
const plainBytes = () => new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));

await check('gebouwmodel via de opslagworker: Ctrl+S, Opslaan als en Exporteren → IFC rekenen de merge daar, met dezelfde bytes; de gewone writer ook (stap 6)', async () => {
  const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store), browser = browserDownload();
  try {
    longer(store);
    const viaCtrlS = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    assert.equal(await ctrlS(store), true);
    assert.equal(sw.merges(), 1, 'Ctrl+S rekende de merge in de worker');
    assert.equal(hash(fileOf(name)), viaCtrlS.sha256, 'Ctrl+S: dezelfde bytes als de hoofdthread');
    longer(store);
    const viaSaveAs = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    await store.getState().saveFileAs();
    assert.equal(sw.merges(), 2, 'Opslaan als rekende de merge in de worker');
    assert.equal(hash(new Uint8Array(await browser.downloads[0]!.arrayBuffer())), viaSaveAs.sha256, 'Opslaan als: dezelfde bytes');
    longer(store);
    const viaExport = await prepareIfcWrite(buildExportIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    const result = await store.getState().exportAs('ifc');
    assert(result.ok && !result.cancelled);
    assert.equal(sw.merges(), 3, 'Exporteren → IFC rekende de merge in de worker');
    assert.equal(hash(new Uint8Array(await browser.downloads[1]!.arrayBuffer())), viaExport.sha256, 'Exporteren: dezelfde bytes');
    assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').length, 0);
    // #804 stap 6: zonder vreemd deel rekent de gewone writer ook in de worker, met de flag aan en uit.
    const plain = await openHandle(plainBytes(), sw.compute);
    longer(plain.store);
    assert.equal(await ctrlS(plain.store), true);
    assert.equal(sw.requests().length, 4, 'de gewone writer ging naar de worker');
    assert.equal(sw.requests()[3]!.job.kind, 'writer');
    // Knownbug 1936: elke merge rekende in een eigen worker, die daarna stopte; de gewone writer kreeg er een nieuwe.
    assert.deepEqual(sw.workers.map(w => [w.requests.map(r => r.job.kind), w.terminated]),
      [[['merge'], true], [['merge'], true], [['merge'], true], [['writer'], false]], 'een verse worker na elke merge');
  } finally { unregister(); browser.dispose(); sw.client.dispose(); await clearRecovery(); }
});

await check('typen tijdens de merge in de worker: het bestand krijgt de momentopname, de bron volgt, het latere werk blijft gewijzigd', async () => {
  const sw = saveWorker('manual'), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    longer(store); writableLog.length = 0;
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    const saving = ctrlS(store);
    assert.equal(statusOf(store), 'saving', '"Opslaan…" vanaf het begin van de opslag');
    await mergeArrives(sw, 1);
    const later = store.getState().addTask({ name: 'Getypt tijdens de merge' });
    assert.equal(statusOf(store), 'saving', '"Opslaan…" ook terwijl de planner doortypt');
    await finishMerge(sw);
    assert.equal(await saving, false, 'opgeslagen, maar niet schoon');
    assert.equal(hash(fileOf(name)), expected.sha256, 'het bestand kreeg precies de momentopname');
    assert.equal((await openForeign(fileOf(name))).tasks.some(t => t.id === later), false, 'zonder het latere werk');
    const now = store.getState();
    assert.equal(now.ifcSource!.sha256, hash(fileOf(name)), 'de bron volgt wat er geschreven is');
    assert.equal(now.isDirty, true, 'het latere werk blijft gewijzigd');
    assert(now.tasks.some(t => t.id === later), 'het latere werk staat er nog');
    assert.equal(statusOf(store), 'unsaved', '"Niet opgeslagen"');
    // De volgende opslag neemt het latere werk mee, één keer.
    const next = ctrlS(store);
    await mergeArrives(sw, 2); await finishMerge(sw);
    assert.equal(await next, true);
    assert((await openForeign(fileOf(name))).tasks.some(t => t.id === later), 'de tweede opslag schreef het latere werk');
    assert.equal(writableLog.filter(l => l === `create ${name}`).length, 2, 'twee vervangingen, niet meer');
    assert.equal(sw.merges(), 2);
    assert.equal(statusOf(store), 'saved', '"Opgeslagen <tijd>"');
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

await check('twee keer Ctrl+S tijdens de merge in de worker: één extra opslag, die het latere werk meeneemt', async () => {
  const sw = saveWorker('manual'), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    longer(store); clearNotices(store); writableLog.length = 0;
    const first = ctrlS(store);
    await mergeArrives(sw, 1);
    const edited = longer(store), duration = store.getState().tasks.find(t => t.id === edited)!.time.scheduleDuration;
    const more = [ctrlS(store), ctrlS(store)];
    await finishMerge(sw);
    await mergeArrives(sw, 2); await finishMerge(sw);
    assert.deepEqual(await Promise.all([first, ...more]), [false, true, true]);
    for (let i = 0; i < 50; i++) await new Promise(r => setImmediate(r));
    assert.equal(sw.merges(), 2, 'twee merges, niet drie');
    assert.equal(writableLog.filter(l => l === `create ${name}`).length, 2, 'twee vervangingen, geen dubbele');
    assert.equal((await openForeign(fileOf(name))).tasks.find(t => t.id === edited)!.time.scheduleDuration, duration, 'niets verloren');
    assert.equal(store.getState().isDirty, false);
    assert.equal(statusOf(store), 'saved');
    assert.equal(saveStateOf(store)!.saving, 0);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

await check('tabbladwissel tijdens de merge in de worker: het slapende document wordt opgeslagen en vastgelegd, de stand hoort bij het document', async () => {
  const sw = saveWorker('manual'), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    longer(store); clearNotices(store);
    const id = store.getState().activeDocumentId;
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    const saving = ctrlS(store);
    await mergeArrives(sw, 1);
    const other = otherDocument(store);
    assert.equal(statusOf(store), 'unsaved', 'het andere tabblad toont zijn eigen stand');
    assert.equal(statusOf(store, id), 'saving', 'het opgeslagen document staat nog op "Opslaan…"');
    await finishMerge(sw);
    assert.equal(await saving, true);
    assert.equal(hash(fileOf(name)), expected.sha256, 'precies de merge van het opgeslagen document');
    const saved = payloadOf(store, id);
    assert.equal(saved.isDirty, false, 'vastgelegd in het slapende document');
    assert.equal(saved.ifcSource!.sha256, hash(fileOf(name)));
    otherUntouched(store, other);
    assert.equal(statusOf(store), 'unsaved');
    store.getState().switchDocument(id);
    assert.equal(statusOf(store), 'saved', 'terug op het tabblad: "Opgeslagen <tijd>"');
    assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').length, 0);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

for (const [reason, route] of [['crashed', 'Ctrl+S'], ['timeout', 'Opslaan als'], ['transport', 'Exporteren → IFC']] as const) {
  await check(`workerfout (${reason}) bij ${route}: niets geschreven, doel en herstel ongewijzigd, document gewijzigd, één melding`, async () => {
    const sw = saveWorker('manual', { timeoutMs: () => 30 });
    const { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store), browser = browserDownload();
    const realError = console.error; console.error = () => {};
    try {
      longer(store); await flushRecoveryNow(); clearNotices(store); writableLog.length = 0;
      const id = store.getState().activeDocumentId, before = preserved(store);
      const recovered = async () => {
        const doc = (await loadRecovery()).docs.find(d => d.id === id);
        return [doc?.ifcSource?.sha256, doc?.ifcSource?.pendingSha256];
      };
      const recoveryBefore = await recovered();
      const run = route === 'Ctrl+S' ? ctrlS(store) : route === 'Opslaan als' ? store.getState().saveFileAs() : store.getState().exportAs('ifc');
      await mergeArrives(sw, 1);
      const w = sw.workers[0]!; w.start();
      if (reason === 'crashed') w.fail('Out of memory');
      if (reason === 'transport') w.onmessageerror?.call(w as unknown as Worker, {} as MessageEvent);
      await run;
      assert.equal(w.terminated, true, 'de worker is gestopt');
      assert.equal(sw.requests().length, 1, 'niet opnieuw gerekend');
      assert.equal(hash(fileOf(name)), hash(bytes), 'het doel is niet veranderd');
      assert.deepEqual(writableLog, [], 'geen schrijfstroom');
      assert.equal(browser.downloads.length, 0, 'geen download');
      unchanged(store, before);
      assert.equal(store.getState().isDirty, true, 'het document blijft gewijzigd');
      assert.deepEqual(await recovered(), recoveryBefore, 'het herstelrecord is niet veranderd');
      assertNotice(store, 'notifications.ifcSaveWorkerFailed');
      assert.equal(saveStateOf(store), undefined, 'geen "Opslaan…" meer en geen "Opgeslagen"');
      assert.equal(statusOf(store), 'unsaved');
    } finally { console.error = realError; unregister(); browser.dispose(); sw.client.dispose(); await clearRecovery(); }
  });
}

await check('de opslagworker start niet: de hoofdthread rekent en de opslag slaagt', async () => {
  for (const [label, client] of [
    ['geen Worker', createIfcSaveWorker({ createWorker: () => null })],
    ['geen started', createIfcSaveWorker({ createWorker: () => new InProcessWorker('silent'), startTimeoutMs: 30 })],
  ] as const) {
    const { store, name } = await openHandle(bytes, client.compute), unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store);
      const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
      assert.equal(await ctrlS(store), true, label);
      assert.equal(hash(fileOf(name)), expected.sha256, `${label}: dezelfde bytes`);
      assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').length, 0, label);
      assert.equal(statusOf(store), 'saved', label);
    } finally { unregister(); client.dispose(); await clearRecovery(); }
  }
});

await check('opslagstand: "Opslaan…" tot en met de laatste herstelronde na de commit, dan "Opgeslagen" met de tijd; weg na annuleren, weigering en fout', async () => {
  // Geslaagd, via de handle: de laatste herstelronde (die het record van de vervanging bijwerkt) valt ná de commit.
  const sw = saveWorker();
  const rounds: Array<{ status: string | null; dirty: boolean }> = [];
  const { store } = await openHandle(bytes, sw.compute);
  const unregister = recoveryRounds(store, () => rounds.push({ status: statusOf(store), dirty: store.getState().isDirty }));
  try {
    longer(store);
    assert.equal(statusOf(store), 'unsaved');
    const t0 = Date.now(); assert.equal(await ctrlS(store), true); const t1 = Date.now();
    assert.deepEqual(rounds.at(-1), { status: 'saving', dirty: false }, 'na de commit, bij de laatste herstelronde: nog "Opslaan…"');
    assert.deepEqual(rounds.map(r => r.status), rounds.map(() => 'saving'), 'elke herstelronde van de opslag ziet "Opslaan…"');
    const at = saveStateOf(store)!.savedAt!;
    assert(at >= t0 && at <= t1, 'de tijd van deze opslag');
    assert.deepEqual(saveStatusOf(saveStateOf(store), false), { kind: 'saved', at });
    longer(store);
    assert.equal(statusOf(store), 'unsaved', 'weer gewijzigd: "Niet opgeslagen"');
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }

  // Weigering (het eigen bestand is door een ander programma gewijzigd) en een fout bij close(): geen stand.
  for (const [label, arrange] of [
    ['weigering', (name: string) => { handleFiles.set(name, otherProgram); }],
    ['fout', (name: string) => { handleFaults.set(name, { closeError: true }); }],
  ] as const) {
    const sw2 = saveWorker(), opened = await openHandle(bytes, sw2.compute), unregister2 = recoveryRounds(opened.store);
    const realError = console.error; console.error = () => {};
    try {
      longer(opened.store); arrange(opened.name);
      assert.equal(await ctrlS(opened.store), false, label);
      assert.equal(saveStateOf(opened.store), undefined, `${label}: geen "Opslaan…" en geen "Opgeslagen"`);
      assert.equal(statusOf(opened.store), 'unsaved', label);
    } finally { console.error = realError; handleFaults.clear(); unregister2(); sw2.client.dispose(); await clearRecovery(); }
  }

  // Annuleren van de bestandskiezer (desktop, Opslaan als) en een gewoon document zonder gebouwmodel: ook voor alle
  // bestanden geldt de stand.
  const ipc = desktop();
  try {
    const { store: plain } = await openInStore(plainBytes(), 'gewoon.ifc');
    longer(plain);
    ipc.choose(null);
    const saving = plain.getState().saveFileAs();
    assert.equal(statusOf(plain), 'saving', 'Opslaan als: "Opslaan…" vanaf het begin');
    await saving;
    assert.equal(saveStateOf(plain), undefined, 'annuleren: weg');
    assert.equal(statusOf(plain), 'unsaved');
    const target = join(dir, 'gewoon-opgeslagen.ifc'); ipc.choose(target);
    await plain.getState().saveFileAs();
    assert(existsSync(target));
    assert.equal(statusOf(plain), 'saved', 'een gewoon document: "Opgeslagen <tijd>"');
    // Een nieuwe inhoud in hetzelfde tabblad neemt de stand niet over.
    plain.getState().newProject();
    assert.equal(statusOf(plain), null, 'nieuw project in hetzelfde tabblad: geen "Opgeslagen"');
  } finally { ipc.dispose(); }
});

// ── Fixronde 1 van #1020: vervangt een laadactie de inhoud van het tabblad tijdens de opslag, dan hoort haar uitkomst
// niet bij die nieuwe inhoud. De route van de review: `api.data.loadProject` van een extensie met een ander project. ──
/** `api.data.loadProject` van een extensie op deze context: hetzelfde project (lees-wijzig-laad) of een ander. */
function loadThroughExtension(context: ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>, sameProject: boolean) {
  const { data } = createExtensionApi('fixronde-1020', [], undefined, context, { app: context, showNotification() {} });
  data.loadProject({
    project: sameProject ? data.getProject() : { ...data.getProject(), id: 'ander-project-uit-extensie', name: 'Ander project uit extensie' },
    calendar: data.getCalendar(),
    tasks: sameProject ? data.getTasks() : [], sequences: sameProject ? data.getSequences() : [],
    resources: sameProject ? data.getResources() : [], assignments: sameProject ? data.getAssignments() : [],
  });
}
/** Een document met gebouwmodel zonder opslagdoel (desktop, Opslaan als), met de opslagworker zoals in de app. */
async function openForSaveAs(sw: SaveWorker) {
  const { createAppStoreContext } = await loadStore();
  const context = createAppStoreContext({ ifcSaveCompute: sw.compute });
  context.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await context.store.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes, ref: null });
  const task = leaf(context.store);
  context.store.getState().updateTask(task.id, { name: 'Wijziging van project A' });
  context.store.getState().runCPM();
  return { context, store: context.store };
}

await check('extensie laadt een ander project tijdens de merge van Opslaan als: niets geschreven, het nieuwe project krijgt geen pad, bron of "Opgeslagen"', async () => {
  const sw = saveWorker('manual'), { context, store } = await openForSaveAs(sw), ipc = desktop();
  const target = join(dir, 'ander-project-tijdens-merge.ifc');
  try {
    const before = store.getState(), id = before.activeDocumentId;
    clearNotices(store); ipc.choose(target);
    const saving = store.getState().saveFileAs();
    await mergeArrives(sw, 1);
    loadThroughExtension(context, false);
    assert.equal(store.getState().activeDocumentId, id, 'hetzelfde tabblad');
    assert.notEqual(store.getState().project.id, before.project.id, 'een ander project');
    assert.equal(statusOf(store), 'unsaved', 'het nieuwe project toont niet de opslag van het vorige');
    await finishMerge(sw);
    await saving;
    const after = store.getState();
    assert.equal(ipc.picks(), 0, 'geen bestandskiezer');
    assert.equal(existsSync(target), false, 'niets geschreven');
    assert.equal(after.filePath, null, 'geen pad op het nieuwe project');
    assert.equal(after.ifcSource?.sha256, before.ifcSource!.sha256, 'geen nieuwe bron op het nieuwe project');
    assert.equal(after.isDirty, true);
    assert.equal(saveStateOf(store), undefined, 'geen "Opslaan…" en geen "Opgeslagen"');
    assertNotice(store, 'notifications.ifcSaveChangedWhileWaiting');
  } finally { ipc.dispose(); sw.client.dispose(); }
});

await check('nieuw project in hetzelfde tabblad ná het plaatsen en vóór de commit: het bestand staat er, de nieuwe inhoud krijgt niets', async () => {
  const sw = saveWorker(), { store } = await openForSaveAs(sw), ipc = desktop();
  const target = join(dir, 'nieuw-project-tijdens-plaatsen.ifc');
  try {
    const id = store.getState().activeDocumentId;
    ipc.choose(target);
    ipc.faults.place = (_from, _to, place) => { const placed = place(); store.getState().newProject(); return placed; };
    await store.getState().saveFileAs();
    const after = store.getState();
    assert(existsSync(target) && readFileSync(target, 'utf8').includes('Wijziging van project A'), 'de opgeslagen inhoud staat in het bestand');
    assert.equal(after.activeDocumentId, id);
    assert.equal(after.tasks.length, 0, 'het nieuwe, lege project');
    assert.equal(after.filePath, null, 'geen pad');
    assert.equal(after.ifcSource, null, 'geen bron');
    assert.equal(after.isDirty, false, 'zoals een nieuw project');
    assert.equal(saveStateOf(store), undefined, 'geen "Opgeslagen"');
    assert.equal(statusOf(store), null);
  } finally { ipc.dispose(); sw.client.dispose(); }
});

await check('handle Ctrl+S, ander project geladen tussen schrijven en commit: het bestand is vervangen, het herstelrecord afgerond, de nieuwe inhoud niet vastgelegd', async () => {
  const sw = saveWorker();
  const { createAppStoreContext } = await loadStore();
  const name = `model-${++handleCount}.ifc`, handle = new FakeHandle(name);
  handleFiles.set(name, bytes);
  const context = createAppStoreContext({ ifcSaveCompute: sw.compute });
  const store = context.store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes, ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle } });
  const unregister = recoveryRounds(store);
  try {
    longer(store); clearNotices(store);
    const id = store.getState().activeDocumentId, opened = store.getState().ifcSource!;
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), opened);
    handleFaults.set(name, { afterClose: async () => { loadThroughExtension(context, false); } });
    assert.equal(await ctrlS(store), false, 'niet vastgelegd');
    assert.equal(hash(fileOf(name)), expected.sha256, 'het bestand kreeg de opgeslagen inhoud');
    const after = store.getState();
    assert.equal(after.activeDocumentId, id);
    assert(after.ifcSource === opened, 'de nieuwe inhoud kreeg de geschreven bron niet');
    assert.equal(after.isDirty, true);
    assert.equal(saveStateOf(store), undefined, 'geen "Opgeslagen"');
    assert.equal(await pendingIn(id), undefined, 'het herstelrecord is afgerond');
  } finally { handleFaults.clear(); unregister(); sw.client.dispose(); await clearRecovery(); }
});

await check('extensie laadt hetzelfde project tijdens de merge: de opslag loopt door zoals bij doorwerken, "Opslaan…" blijft staan', async () => {
  const sw = saveWorker('manual');
  const { createAppStoreContext } = await loadStore();
  const name = `model-${++handleCount}.ifc`, handle = new FakeHandle(name);
  handleFiles.set(name, bytes);
  const context = createAppStoreContext({ ifcSaveCompute: sw.compute });
  const store = context.store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes, ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle } });
  const unregister = recoveryRounds(store);
  try {
    longer(store); clearNotices(store);
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    const saving = ctrlS(store);
    await mergeArrives(sw, 1);
    loadThroughExtension(context, true);
    assert.equal(statusOf(store), 'saving', '"Opslaan…" blijft bij een laadactie binnen hetzelfde project');
    await finishMerge(sw);
    assert.equal(await saving, false, 'opgeslagen, maar niet schoon (de extensie wijzigde het document)');
    assert.equal(hash(fileOf(name)), expected.sha256, 'de momentopname is geschreven');
    const after = store.getState();
    assert.equal(after.ifcSource!.sha256, hash(fileOf(name)), 'de geschreven momentopname is de bron');
    assert.equal(after.isDirty, true, 'het latere werk blijft gewijzigd');
    assert.equal(after.filePath, 'bron.ifc', 'het opslagdoel blijft');
    assert.equal(statusOf(store), 'unsaved');
    assert.equal(store.getState().ui.notifications.filter(n => n.severity === 'error').length, 0);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

await check('een wachtende Ctrl+S hoort bij de inhoud waarvoor hij gevraagd werd: na een ander project doet hij niets, en een nieuwe Ctrl+S sluit er niet bij aan', async () => {
  const sw = saveWorker('manual'), { context, store } = await openForSaveAs(sw), ipc = desktop();
  const target = join(dir, 'wachtende-opslag-ander-project.ifc');
  try {
    ipc.choose(target);
    const running = ctrlS(store);
    await mergeArrives(sw, 1);
    const waiting = ctrlS(store);
    loadThroughExtension(context, false);
    const forNew = ctrlS(store);
    assert.notEqual(forNew, waiting, 'het nieuwe project wacht niet mee met de opslag van het vorige');
    await finishMerge(sw);
    assert.equal(await running, false);
    assert.equal(await waiting, false, 'de wachtende opslag van het vorige project schrijft niets');
    await mergeArrives(sw, 2); await finishMerge(sw);
    await forNew;
    assert.equal(sw.merges(), 2, 'één merge voor het vorige project, één voor het nieuwe; geen voor de wachtende');
  } finally { ipc.dispose(); sw.client.dispose(); }
});

// ── #804 stap 6: gewone bestanden via de opslagworker, voor iedereen (besluit technisch beslisser 16 november 2026,
// "zonder flag, met pariteit op bytes en sha256"). De worker levert bytes; de schrijfroutes schrijven die bytes zelf. ──

await check('de app geeft de berekenfunctie van de opslagworker onvoorwaardelijk door: ook de gewone writer rekent daar (de proef van stap 5 keert om)', async () => {
  const workers: InProcessWorker[] = [];
  const { store } = await openInStore(plainBytes(), 'gewoon.ifc');
  const g = globalThis as { Worker?: unknown };
  const previous = g.Worker;
  // Alleen de opslagworker van de app; elke andere worker (scanner, herstel) start hier niet en valt terug.
  g.Worker = class {
    constructor(url: URL) {
      if (!String(url).includes('ifcSave.worker')) throw new Error(`niet de opslagworker: ${String(url)}`);
      const w = new InProcessWorker('auto'); workers.push(w); return w;
    }
  };
  try {
    const { appStoreContext } = await import('@/state/appStore');
    const compute = appStoreContext.runtime.ifcSaveCompute;
    assert(compute, 'de gemounte app heeft een berekenfunctie');
    const input = buildWriteIFCInput(store.getState(), 'merge');
    reseed(41); const main = writeIFCWithChoices(input).content;
    reseed(41); const output = await compute({ kind: 'writer', input });
    assert.equal(workers.length, 1, 'de app startte zijn opslagworker');
    assert.deepEqual(workers[0]!.requests.map(r => r.job.kind), ['writer'], 'de gewone writer rekende in de worker');
    assert(!output.prepared && output.bytes instanceof Uint8Array, 'de uitkomst draagt de bytes uit de worker');
    assert.equal(hash(output.bytes), hash(new TextEncoder().encode(main)), 'dezelfde bytes als de hoofdthread');
  } finally { g.Worker = previous; }
});

/** De berekenfunctie, met een teller op de luie tekst van een writeruitkomst uit de worker (`writerOutput` in
 *  `ifcSaveProtocol.ts`): een route die de bytes toch eerst tot tekst maakt, telt. */
function countingDecodes(compute: IfcOutputCompute) {
  let decodes = 0;
  const counted: IfcOutputCompute = async job => {
    const output = await compute(job);
    if (!output.prepared && output.bytes) {
      const content = Object.getOwnPropertyDescriptor(output, 'content')!;
      Object.defineProperty(output, 'content', { configurable: true, enumerable: true, get() { decodes++; return content.get!.call(output); } });
    }
    return output;
  };
  return { compute: counted, decodes: () => decodes };
}

const plainText = (data: Uint8Array) => new TextDecoder().decode(data);
const PLAIN_ROUTES = ['Ctrl+S', 'Automatisch opslaan', 'Exporteren → IFC', 'export met bibliotheek', 'Opslaan als over een bestaande naam', 'Opslaan als'] as const;
type PlainRoute = typeof PLAIN_ROUTES[number];
/** Elke gewone documentroute op één geopend bestand (desktop, echte bestanden), met of zonder de worker: wat elke route
 *  schreef, en met welke schrijfaanroep. `null`: dit bestand opent niet als gewone planning (een vreemd deel). */
async function plainRoutes(data: Uint8Array, flag: boolean, compute?: IfcOutputCompute) {
  const folder = mkdtempSync(join(dir, 'pariteit-')), own = join(folder, 'eigen.ifc');
  writeFileSync(own, data);
  const ipc = desktop();
  try {
    reseed(7);
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext({ ifcSaveCompute: compute });
    store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
    await store.getState().openOpenedFile({ name: 'eigen.ifc', content: new TextDecoder().decode(data), bytes: data, ref: { kind: 'path', path: own } });
    const opened = store.getState();
    if (opened.filePath !== own || hasForeignContent(opened.ifcSource) || ifcFullWriteBlocked(opened)) return null;
    clearNotices(store);
    const out = {} as Record<PlainRoute, Uint8Array>, writes = {} as Record<PlainRoute, string | undefined>;
    // Een bewerking zonder nieuw id: `generateId` telt per proces door, dus een nieuwe taak kreeg in de tweede run een
    // ander id (en GlobalId) dan in de eerste.
    const leafTask = opened.tasks.find(t => !t.childIds.length && !t.isMilestone);
    if (!leafTask) return null;
    const edit = (n: number) => { store.getState().updateTask(leafTask.id, { name: `Pariteit ${n}` }); store.getState().runCPM(); };
    const from = ipc.calls.length;
    let mark = from;
    /** De eerste schrijfaanroep van deze route (bij de export met bibliotheek: het projectbestand, vóór de bibliotheek). */
    const firstWrite = (route: PlainRoute) => {
      writes[route] = ipc.calls.slice(mark).find(c => writeFileCallOf(c) && c.path?.startsWith(folder))?.command;
      mark = ipc.calls.length;
    };
    edit(1); reseed(21);
    assert.equal(await ctrlS(store), true, 'Ctrl+S');
    out['Ctrl+S'] = new Uint8Array(readFileSync(own)); firstWrite('Ctrl+S');
    edit(2); store.getState().setAutoSaveToFile(true); reseed(22);
    await createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute }).flush();
    assert.equal(store.getState().isDirty, false, 'Automatisch opslaan legde vast');
    out['Automatisch opslaan'] = new Uint8Array(readFileSync(own)); firstWrite('Automatisch opslaan');
    edit(3);
    const exported = join(folder, 'export.ifc'); ipc.choose(exported); reseed(23);
    const result = await store.getState().exportAs('ifc');
    assert(result.ok && !result.cancelled, 'Exporteren → IFC');
    out['Exporteren → IFC'] = new Uint8Array(readFileSync(exported)); firstWrite('Exporteren → IFC');
    const withPool = join(folder, 'met-bibliotheek.ifc'), pool = join(folder, 'bibliotheek.ifc');
    ipc.choose(withPool); const picks = ipc.picks();
    ipc.onPick(() => { if (ipc.picks() === picks + 2) ipc.choose(pool); });
    reseed(24);
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok, 'export met bibliotheek');
    out['export met bibliotheek'] = new Uint8Array(readFileSync(withPool)); firstWrite('export met bibliotheek');
    ipc.onPick(() => {});
    // Een leesbare gewone planning als bestaand doel: met de flag aan leest de doelcontrole het doel.
    const existing = join(folder, 'bestaand.ifc'); writeFileSync(existing, data);
    ipc.choose(existing); reseed(25);
    await store.getState().saveFileAs();
    out['Opslaan als over een bestaande naam'] = new Uint8Array(readFileSync(existing)); firstWrite('Opslaan als over een bestaande naam');
    const fresh = join(folder, 'nieuw.ifc'); ipc.choose(fresh); reseed(26);
    await store.getState().saveFileAs();
    out['Opslaan als'] = new Uint8Array(readFileSync(fresh)); firstWrite('Opslaan als');
    assert.equal(store.getState().filePath, fresh);
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey), [], 'geen foutmelding');
    return { out, writes, places: ipc.calls.slice(from).filter(c => c.command === 'place_file_exclusive').length };
  } finally { ipc.dispose(); }
}
const writeFileCallOf = (c: { command: string }) => c.command === 'plugin:fs|write_file' || c.command === 'plugin:fs|write_text_file';

await check('pariteit over de echte routes: elk voorbeeld en elke opslagfixture, flag uit en aan, schrijft via de worker op elke route dezelfde bytes als de hoofdthread, zonder omweg via tekst', async () => {
  const files = [
    ...readdirSync(join(root, 'public/examples')).filter(f => f.endsWith('.ifc')).sort().map(f => `public/examples/${f}`),
    ...['tests/fixtures/ifc-foreign', 'tests/fixtures/ifc-project-owner'].flatMap(folder =>
      readdirSync(join(root, folder)).filter(f => f.endsWith('.ifc')).sort().map(f => `${folder}/${f}`)),
  ];
  let compared = 0;
  const examplesCompared = new Set<string>();
  for (const file of files) for (const flag of [false, true]) {
    const data = new Uint8Array(readFileSync(join(root, file)));
    let main: Awaited<ReturnType<typeof plainRoutes>>;
    try { main = await plainRoutes(data, flag); } catch (error) {
      if (file.startsWith('public/')) throw new Error(`${file}, flag ${flag}, op de hoofdthread: ${(error as Error).message}`);
      continue;
    }
    const sw = saveWorker(), counted = countingDecodes(sw.compute);
    try {
      const viaWorker = await plainRoutes(data, flag, counted.compute)
        .catch((error: Error) => { throw new Error(`${file}, flag ${flag}, via de worker: ${error.message}`); });
      assert.equal(viaWorker === null, main === null, `${file}, flag ${flag}: dezelfde soort document`);
      if (!main || !viaWorker) continue;
      for (const route of PLAIN_ROUTES) {
        const label = `${file}, flag ${flag}, ${route}`;
        if (!Buffer.from(viaWorker.out[route]).equals(Buffer.from(main.out[route]))) {
          assert.fail(`${label}: niet byte voor byte gelijk ${firstDiff(plainText(viaWorker.out[route]), plainText(main.out[route]))}`);
        }
        assert.equal(viaWorker.out[route].byteLength, main.out[route].byteLength, `${label}: dezelfde lengte`);
        assert.equal(hash(viaWorker.out[route]), hash(main.out[route]), `${label}: dezelfde sha256`);
      }
      assert.deepEqual(sw.requests().map(r => r.job.kind), PLAIN_ROUTES.map(() => 'writer'), `${file}, flag ${flag}: elke route rekende in de worker`);
      assert.equal(counted.decodes(), 0, `${file}, flag ${flag}: geen route maakte de bytes eerst tot tekst`);
      // Fixronde 2 van #1071: met de flag aan gaat Opslaan als op de desktop langs de vervanging (een bestaande naam: twee
      // plaatsingen) of de exclusieve aanmaak (een vrije naam: één), altijd met bytes, ook zonder worker.
      const desktopSaveAs = (route: PlainRoute) => flag && (route === 'Opslaan als over een bestaande naam' || route === 'Opslaan als');
      for (const route of PLAIN_ROUTES) {
        assert.equal(viaWorker.writes[route], 'plugin:fs|write_file', `${file}, flag ${flag}, ${route}: de bytes als rauwe body`);
        assert.equal(main.writes[route], desktopSaveAs(route) ? 'plugin:fs|write_file' : 'plugin:fs|write_text_file',
          `${file}, flag ${flag}, ${route}: zonder worker ${desktopSaveAs(route) ? 'ook de bytes' : 'de tekst, zoals main'}`);
      }
      assert.deepEqual([viaWorker.places, main.places], flag ? [3, 3] : [0, 0],
        `${file}, flag ${flag}: ${flag ? 'de plaatsingen van Opslaan als' : 'geen exclusieve plaatsing; de gewone atomaire opslag'}`);
      compared++;
      if (file.startsWith('public/')) examplesCompared.add(file);
    } finally { sw.client.dispose(); }
  }
  assert.equal(examplesCompared.size, files.filter(f => f.startsWith('public/')).length, 'elk voorbeeld vergeleken');
  // Elk voorbeeld met de flag uit én aan, plus minstens één opslagfixture die als gewone planning opent.
  assert(compared >= examplesCompared.size * 2 + 1, `${compared} combinaties vergeleken`);
});

/** Een gewone planning achter een bestandshandle (browser), met de opslagworker. */
const openPlainHandle = (compute: IfcOutputCompute) => openHandle(plainBytes(), compute);

await check('gewoon document via de worker: typen tijdens het rekenen; het bestand krijgt de momentopname, het document blijft gewijzigd, de volgende Ctrl+S neemt het mee', async () => {
  const sw = saveWorker('manual'), { store, name } = await openPlainHandle(sw.compute);
  try {
    longer(store); writableLog.length = 0; clearNotices(store);
    const expected = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
    const saving = ctrlS(store);
    assert.equal(statusOf(store), 'saving', '"Opslaan…" vanaf het begin');
    await mergeArrives(sw, 1);
    assert.equal(sw.requests()[0]!.job.kind, 'writer', 'de gewone writer rekent in de worker');
    store.getState().addTask({ name: 'Getypt tijdens het rekenen' });
    assert.equal(statusOf(store), 'saving', '"Opslaan…" ook terwijl de planner doortypt');
    await finishMerge(sw);
    assert.equal(await saving, false, 'opgeslagen, maar niet schoon');
    assert.equal(plainText(fileOf(name)), expected, 'het bestand kreeg precies de momentopname');
    assert.equal(plainText(fileOf(name)).includes('Getypt tijdens het rekenen'), false);
    assert.equal(store.getState().isDirty, true, 'het latere werk blijft gewijzigd');
    assert.equal(statusOf(store), 'unsaved');
    const next = ctrlS(store);
    await mergeArrives(sw, 2); await finishMerge(sw);
    assert.equal(await next, true);
    assert(plainText(fileOf(name)).includes('Getypt tijdens het rekenen'), 'de tweede opslag schreef het latere werk');
    assert.equal(writableLog.filter(l => l === `create ${name}`).length, 2);
    assert.equal(statusOf(store), 'saved');
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), []);
  } finally { sw.client.dispose(); }
});

await check('gewoon document via de worker: twee keer Ctrl+S tijdens het rekenen geeft één extra opslag, die het latere werk meeneemt', async () => {
  const sw = saveWorker('manual'), { store, name } = await openPlainHandle(sw.compute);
  try {
    longer(store); clearNotices(store); writableLog.length = 0;
    const first = ctrlS(store);
    await mergeArrives(sw, 1);
    store.getState().addTask({ name: 'Na de eerste Ctrl+S' });
    const more = [ctrlS(store), ctrlS(store)];
    await finishMerge(sw);
    await mergeArrives(sw, 2); await finishMerge(sw);
    assert.deepEqual(await Promise.all([first, ...more]), [false, true, true]);
    for (let i = 0; i < 50; i++) await new Promise(r => setImmediate(r));
    assert.equal(sw.requests().length, 2, 'twee keer gerekend, niet drie');
    assert.equal(writableLog.filter(l => l === `create ${name}`).length, 2, 'twee schrijfacties');
    assert(plainText(fileOf(name)).includes('Na de eerste Ctrl+S'), 'niets verloren');
    assert.equal(store.getState().isDirty, false);
    assert.equal(saveStateOf(store)!.saving, 0);
  } finally { sw.client.dispose(); }
});

await check('gewoon document via de worker: tabbladwissel tijdens het rekenen; het slapende document wordt opgeslagen en vastgelegd', async () => {
  const sw = saveWorker('manual'), { store, name } = await openPlainHandle(sw.compute);
  try {
    longer(store); clearNotices(store);
    const id = store.getState().activeDocumentId, expected = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
    const saving = ctrlS(store);
    await mergeArrives(sw, 1);
    const other = otherDocument(store);
    assert.equal(statusOf(store, id), 'saving');
    await finishMerge(sw);
    assert.equal(await saving, true);
    assert.equal(plainText(fileOf(name)), expected, 'precies het opgeslagen document');
    assert.equal(payloadOf(store, id).isDirty, false, 'vastgelegd in het slapende document');
    otherUntouched(store, other);
    store.getState().switchDocument(id);
    assert.equal(statusOf(store), 'saved');
  } finally { sw.client.dispose(); }
});

for (const route of ['Ctrl+S (handle)', 'Opslaan als (desktop)'] as const) {
  await check(`gewoon document via de worker, ${route}: een ander project in hetzelfde tabblad tijdens het rekenen; niets geschreven, het nieuwe project krijgt niets`, async () => {
    const sw = saveWorker('manual');
    const { createAppStoreContext } = await loadStore();
    const context = createAppStoreContext({ ifcSaveCompute: sw.compute }), { store } = context;
    const handleName = `gewoon-${++handleCount}.ifc`;
    handleFiles.set(handleName, plainBytes());
    const ipc = route === 'Opslaan als (desktop)' ? desktop() : null, target = join(dir, `gewoon-ander-project-${handleCount}.ifc`);
    try {
      await store.getState().openOpenedFile(route === 'Ctrl+S (handle)'
        ? { name: handleName, content: plainText(plainBytes()), ref: { kind: 'handle', handle: new FakeHandle(handleName) as unknown as FileSystemFileHandle } }
        : { name: 'gewoon.ifc', content: plainText(plainBytes()), ref: null });
      longer(store); clearNotices(store); writableLog.length = 0; ipc?.choose(target);
      const before = store.getState();
      const saving = route === 'Ctrl+S (handle)' ? ctrlS(store) : store.getState().saveFileAs();
      await mergeArrives(sw, 1);
      loadThroughExtension(context, false);
      assert.notEqual(store.getState().project.id, before.project.id, 'een ander project');
      await finishMerge(sw);
      await saving;
      assert.deepEqual(writableLog, [], 'geen schrijfstroom');
      assert.equal(hash(fileOf(handleName)), hash(plainBytes()), 'het eigen bestand is niet veranderd');
      assert.equal(existsSync(target), false, 'geen nieuw bestand');
      assert.equal(ipc?.picks() ?? 0, 0, 'geen bestandskiezer');
      assert.equal(store.getState().filePath === target, false, 'geen pad op het nieuwe project');
      assert.equal(saveStateOf(store), undefined, 'geen "Opslaan…" en geen "Opgeslagen"');
      assertNotice(store, 'notifications.ifcSaveChangedWhileWaiting');
    } finally { ipc?.dispose(); sw.client.dispose(); }
  });
}

await check('gewoon document via de worker, handle Ctrl+S: een ander project tussen schrijven en commit; het bestand staat er, de nieuwe inhoud wordt niet vastgelegd', async () => {
  const sw = saveWorker();
  const { createAppStoreContext } = await loadStore();
  const context = createAppStoreContext({ ifcSaveCompute: sw.compute }), { store } = context;
  const name = `gewoon-${++handleCount}.ifc`;
  handleFiles.set(name, plainBytes());
  try {
    await store.getState().openOpenedFile({ name, content: plainText(plainBytes()), ref: { kind: 'handle', handle: new FakeHandle(name) as unknown as FileSystemFileHandle } });
    longer(store); clearNotices(store);
    const id = store.getState().activeDocumentId, expected = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
    handleFaults.set(name, { afterClose: async () => { loadThroughExtension(context, false); } });
    assert.equal(await ctrlS(store), false, 'niet vastgelegd');
    assert.equal(plainText(fileOf(name)), expected, 'het bestand kreeg de opgeslagen inhoud');
    assert.equal(store.getState().activeDocumentId, id);
    assert.equal(store.getState().isDirty, true, 'de nieuwe inhoud is niet als opgeslagen vastgelegd');
    assert.equal(saveStateOf(store), undefined, 'geen "Opgeslagen"');
  } finally { handleFaults.clear(); sw.client.dispose(); }
});

// Knownbug 1896, de proef van de review van #1020 (ronde 2) en dezelfde voor een gewoon document: B laden in de
// schrijfstap van de handle, vóór `close()`. Na de fix stopt de bestaande `abort()` de opslag.
for (const kind of ['gebouwmodel', 'gewoon document'] as const) {
  await check(`1896, ${kind}: ander project nadat de browser de buffer schreef, vóór close(); het doel houdt zijn oorspronkelijke bytes`, async () => {
    const sw = saveWorker('manual');
    const { createAppStoreContext } = await loadStore();
    const context = createAppStoreContext({ ifcSaveCompute: sw.compute }), { store } = context;
    const name = `review-handle-${++handleCount}.ifc`, data = kind === 'gebouwmodel' ? bytes : plainBytes();
    handleFiles.set(name, data);
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    await store.getState().openOpenedFile({ name, content: '', bytes: data, ref: { kind: 'handle', handle: new FakeHandle(name) as unknown as FileSystemFileHandle } });
    const unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store); writableLog.length = 0;
      const before = store.getState(), id = before.activeDocumentId, originalHash = hash(fileOf(name));
      let hashAtReplacement: string | undefined;
      handleFaults.set(name, { onWrite: () => {
        hashAtReplacement = hash(fileOf(name));
        loadThroughExtension(context, false);
        assert.equal(store.getState().activeDocumentId, id);
        assert.notEqual(store.getState().project.id, before.project.id);
      } });
      const saving = ctrlS(store);
      await mergeArrives(sw, 1);
      await finishMerge(sw);
      assert.equal(await saving, false);
      assert.equal(hashAtReplacement, originalHash, 'het doel was ongewijzigd bij de projectwissel');
      assert.equal(hash(fileOf(name)), originalHash, 'close() plaatst de oude planning niet meer op het doel');
      assert.deepEqual(writableLog, [`create ${name}`, `abort ${name}`], 'de bestaande abort()');
      assert.equal(await pendingIn(id), undefined, 'het herstelrecord is opgeruimd');
      assertNotice(store, 'notifications.ifcSaveChangedWhileWaiting');
      assert.equal(saveStateOf(store), undefined);
    } finally { handleFaults.clear(); unregister(); sw.client.dispose(); await clearRecovery(); }
  });
}

await check('gewoon document, Opslaan als over een bestaande handle (browser): het bestand wordt overschreven zoals op main, niet gedownload', async () => {
  const win = window as unknown as Record<string, unknown>;
  const sw = saveWorker(), { store } = await openPlainHandle(sw.compute), browser = browserDownload();
  const existing = `bestaand-${++handleCount}.ifc`;
  handleFiles.set(existing, new TextEncoder().encode('oude inhoud'));
  win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
  win.showSaveFilePicker = async () => new FakeHandle(existing);
  try {
    longer(store); clearNotices(store); writableLog.length = 0;
    const expected = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
    await store.getState().saveFileAs();
    assert.equal(sw.requests().at(-1)!.job.kind, 'writer');
    assert.equal(plainText(fileOf(existing)), expected, 'het bestaande bestand kreeg de nieuwe planning');
    assert.deepEqual(writableLog, [`create ${existing}`, `close ${existing} 1`]);
    assert.equal(browser.downloads.length, 0, 'geen download');
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), []);
  } finally { browser.dispose(); delete win.showOpenFilePicker; sw.client.dispose(); }
});

for (const route of ['Ctrl+S', 'Opslaan als', 'Exporteren → IFC', 'export met bibliotheek', 'Automatisch opslaan'] as const) {
  await check(`gewoon document, workerfout bij ${route}: niets geschreven, het document blijft gewijzigd, één melding, niet opnieuw gerekend`, async () => {
    const sw = saveWorker('manual');
    const folder = mkdtempSync(join(dir, 'workerfout-')), own = join(folder, 'eigen.ifc');
    writeFileSync(own, plainBytes());
    const ipc = desktop(), target = join(folder, 'doel.ifc');
    const realError = console.error; console.error = () => {};
    try {
      const store = await openAt({ kind: 'path', path: own }, plainBytes(), sw.compute);
      longer(store); clearNotices(store); ipc.choose(target);
      if (route === 'Automatisch opslaan') store.getState().setAutoSaveToFile(true);
      const from = ipc.calls.length;
      const run = route === 'Ctrl+S' ? ctrlS(store) : route === 'Opslaan als' ? store.getState().saveFileAs()
        : route === 'Exporteren → IFC' ? store.getState().exportAs('ifc') : route === 'export met bibliotheek' ? store.getState().exportProjectWithPool()
          : createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw.compute }).flush();
      await mergeArrives(sw, 1);
      const w = sw.workers[0]!; w.start(); w.fail('Out of memory');
      await run;
      assert.equal(w.terminated, true, 'de worker is gestopt');
      assert.equal(sw.requests().length, 1, 'niet opnieuw gerekend');
      assert.equal(hash(new Uint8Array(readFileSync(own))), hash(plainBytes()), 'het eigen bestand is niet veranderd');
      assert.equal(existsSync(target), false, 'geen nieuw bestand');
      assert.deepEqual(ipc.calls.slice(from).filter(c => c.wrote && c.path?.startsWith(folder)), [], 'nul schrijfacties');
      assert.equal(ipc.picks(), 0, 'geen bestandskiezer');
      assert.equal(store.getState().isDirty, true);
      assertNotice(store, 'notifications.ifcSaveWorkerFailed');
    } finally { console.error = realError; ipc.dispose(); sw.client.dispose(); }
  });
}

await check('gewoon document: de opslagworker start niet; de hoofdthread rekent, de opslag slaagt met de tekst', async () => {
  for (const [label, client] of [
    ['geen Worker', createIfcSaveWorker({ createWorker: () => null })],
    ['geen started', createIfcSaveWorker({ createWorker: () => new InProcessWorker('silent'), startTimeoutMs: 30 })],
  ] as const) {
    const { store, name } = await openPlainHandle(client.compute);
    try {
      longer(store); clearNotices(store);
      const expected = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
      assert.equal(await ctrlS(store), true, label);
      assert.equal(plainText(fileOf(name)), expected, `${label}: dezelfde inhoud`);
      assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), [], label);
      assert.equal(statusOf(store), 'saved', label);
    } finally { client.dispose(); }
  }
});

await check('Automatisch opslaan, gewoon document: de ronde rekent via de berekenfunctie onder het schrijfslot; typen tijdens de ronde laat het document gewijzigd, de volgende ronde neemt het mee', async () => {
  const sw = saveWorker('manual');
  const folder = mkdtempSync(join(dir, 'autosave-')), own = join(folder, 'eigen.ifc');
  writeFileSync(own, plainBytes());
  const ipc = desktop();
  try {
    const store = await openAt({ kind: 'path', path: own }, plainBytes(), sw.compute);
    longer(store); store.getState().setAutoSaveToFile(true); clearNotices(store);
    const expected = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
    const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw.compute });
    const round = controller.flush();
    await mergeArrives(sw, 1);
    assert.equal(sw.requests()[0]!.job.kind, 'writer', 'de ronde rekent in de worker');
    assert.equal(isProjectFileWriteBusy(), true, 'onder het schrijfslot');
    store.getState().addTask({ name: 'Getypt tijdens de ronde' });
    await finishMerge(sw);
    await round;
    assert.equal(plainText(new Uint8Array(readFileSync(own))), expected, 'het bestand kreeg de momentopname van de ronde');
    assert.equal(store.getState().isDirty, true, 'het latere werk blijft gewijzigd');
    const next = controller.flush();
    await mergeArrives(sw, 2); await finishMerge(sw);
    await next;
    assert(plainText(new Uint8Array(readFileSync(own))).includes('Getypt tijdens de ronde'), 'de volgende ronde schreef het latere werk');
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), []);
  } finally { ipc.dispose(); sw.client.dispose(); }
});

// ── Fixronde 1 van #1027: de proeven van de review (Sol), aangepast aan de besluiten van Trias (19 november 2026) ──────
// Blokkade 4 (knownbug 1896): de late controle op beide IFC-exports. Desktop: vóór de plaatsing, het doel blijft. Een
// handle uit de opslaankiezer van de browser: die kiezer heeft een bestaand doel al leeggemaakt (knownbug 1899), dus de
// export maakt het gevraagde bestand af, maar meldt geen succes en zet niets vast (geen Recent, geen kalenderkeuze).
for (const route of ['Exporteren → IFC', 'export met bibliotheek'] as const) {
  for (const backend of ['desktop', 'handle'] as const) {
    await check(`review 1896: ${route}, ${backend}, projectwissel met de uitvoer nog in het hulpbestand`, async () => {
      const sw = saveWorker();
      const { createAppStoreContext } = await loadStore();
      const context = createAppStoreContext({ ifcSaveCompute: sw.compute }), { store } = context;
      const ipc = backend === 'desktop' ? desktop() : null;
      const browser = backend === 'handle' ? browserDownload() : null;
      const win = window as unknown as Record<string, unknown>;
      const internal = win.__TAURI_INTERNALS__ as { invoke: (...args: unknown[]) => Promise<unknown> } | undefined;
      const invoke = internal?.invoke;
      const name = `review-export-${++handleCount}.ifc`, path = join(dir, name);
      const previous = new TextEncoder().encode('Versie vóór export');
      const readTarget = () => ipc ? new Uint8Array(readFileSync(path)) : fileOf(name);
      const beforeHash = hash(previous);
      let loaded = false;
      try {
        await store.getState().openOpenedFile({ name: 'gewoon.ifc', content: plainText(plainBytes()), ref: null });
        longer(store);
        const projectId = store.getState().project.id;
        const expected = new TextEncoder().encode(writeIFC(buildExportIFCInput(store.getState(), route === 'Exporteren → IFC' ? 'merge' : 'planOnly')));
        const replaceProject = () => {
          if (ipc) assert.equal(hash(readTarget()), beforeHash, 'de oude versie stond nog op het doel');
          else assert.equal(readTarget().byteLength, 0, 'de opslaankiezer had het doel al leeggemaakt');
          loadThroughExtension(context, false);
          assert.notEqual(store.getState().project.id, projectId);
          loaded = true;
        };
        if (ipc && internal && invoke) {
          writeFileSync(path, previous);
          ipc.choose(path);
          internal.invoke = async (...args) => {
            const answer = await invoke(...args);
            if (!loaded && args[0] === 'plugin:fs|write_file' && tempLeft().length > 0) replaceProject();
            return answer;
          };
        } else {
          handleFiles.set(name, previous);
          win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
          // Chromium kapt een gekozen bestaand bestand af vóór de kiezer de handle teruggeeft.
          win.showSaveFilePicker = async () => { handleFiles.set(name, new Uint8Array()); return new FakeHandle(name); };
          handleFaults.set(name, { onWrite: replaceProject });
          writableLog.length = 0;
        }
        clearNotices(store);
        const result = route === 'Exporteren → IFC' ? await store.getState().exportAs('ifc') : await store.getState().exportProjectWithPool();
        const recent = store.getState().recentFiles.some(file => file.name === name);
        assert(loaded, 'de laadactie vond plaats terwijl plaatsen nog kon worden afgebroken');
        assert.equal(result.ok && result.cancelled, true, 'geen geslaagde export voor het nieuwe project');
        assert.equal(recent, false, 'geen export in Recent');
        if (ipc) {
          assert.equal(hash(readTarget()), beforeHash, 'desktop: het doelbestand blijft ongewijzigd');
          assert.deepEqual(tempLeft(), [], 'desktop: geen tijdelijk bestand');
          assertNotice(store, 'notifications.ifcExportChangedWhileWaiting');
        } else {
          assert(Buffer.from(readTarget()).equals(Buffer.from(expected)), 'handle: het volledige exportbestand, nooit 0 bytes');
          assert.deepEqual(writableLog.map(entry => entry.split(' ')[0]), ['create', 'close'], 'handle: afgeschreven, niet afgebroken');
          assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), [], 'handle: geen foutmelding');
        }
        assert.deepEqual(store.getState().ifcLiteralCalendarIds, null, 'geen kalenderkeuze vastgelegd op het nieuwe project');
      } finally {
        if (internal && invoke) internal.invoke = invoke;
        handleFaults.delete(name);
        delete win.showOpenFilePicker;
        ipc?.dispose();
        browser?.dispose();
        sw.client.dispose();
      }
    });
  }
}

// Blokkade 1: Automatisch opslaan controleert het doel ná het rekenen, in dezelfde schrijfbeurt.
await check('review AutoSave: nieuw gebouwmodel op het doel bij het einde van de writer', async () => {
  const sw = saveWorker('manual');
  const path = join(dir, 'review-autosave-doel.ifc');
  const own = plainBytes();
  writeFileSync(path, own);
  const ipc = desktop();
  try {
    const { createAppStoreContext } = await loadStore();
    const { store } = createAppStoreContext({ ifcSaveCompute: sw.compute });
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    await store.getState().openOpenedFile({ name: 'review-autosave-doel.ifc', content: plainText(own), bytes: own, ref: { kind: 'path', path } });
    assert(!hasForeignContent(store.getState().ifcSource));
    longer(store);
    store.getState().setAutoSaveToFile(true);
    clearNotices(store);
    const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw.compute });
    const writing = controller.flush();
    await mergeArrives(sw, 1);
    assert.equal(hash(readFileSync(path)), hash(own));
    writeFileSync(path, bytes); // een ander programma zet tijdens het rekenen een model op het doel
    await finishMerge(sw);
    await writing;
    assert.equal(hash(readFileSync(path)), hash(bytes), 'AutoSave moet het nieuwe gebouwmodel weigeren');
    assert.equal(store.getState().isDirty, true);
    assert(store.getState().ui.notifications.map(n => n.messageKey).includes('notifications.ifcForeignTargetAutoSave'));
  } finally {
    ipc.dispose();
    sw.client.dispose();
  }
});

// Blokkade 3 (besluit Trias, knownbug 1899): na de opslaankiezer van de browser maakt de opslag het gekozen bestand af
// met de inhoud waar de planner om vroeg, zoals main; alleen de commit weigert. Nooit 0 bytes.
for (const route of ['Opslaan als', 'Ctrl+S zonder doel'] as const) await check(`review 1899: ${route} via de opslaankiezer van Chromium, projectwissel tijdens het schrijven: het volledige bestand, B krijgt niets`, async () => {
  const sw = saveWorker();
  const { createAppStoreContext } = await loadStore();
  const context = createAppStoreContext({ ifcSaveCompute: sw.compute });
  const { store } = context;
  const win = window as unknown as Record<string, unknown>;
  const browser = browserDownload();
  const name = `review-native-kiezer-${++handleCount}.ifc`;
  const before = plainBytes();
  handleFiles.set(name, before);
  win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
  win.showSaveFilePicker = async () => {
    // Chromium CreateAndTruncateLocalFile/CreateAndTruncateFile loopt vóór het teruggeven van de handle.
    handleFiles.set(name, new Uint8Array());
    return new FakeHandle(name);
  };
  let loaded = false;
  handleFaults.set(name, { onWrite: () => {
    assert.equal(fileOf(name).byteLength, 0, 'de kiezer heeft het bestand al afgekapt');
    loadThroughExtension(context, false);
    loaded = true;
  } });
  try {
    await store.getState().openOpenedFile({ name: 'gewoon.ifc', content: plainText(before), ref: null });
    longer(store);
    const expected = new TextEncoder().encode(writeIFC(buildWriteIFCInput(store.getState(), 'merge')));
    writableLog.length = 0;
    if (route === 'Opslaan als') await store.getState().saveFileAs();
    else await store.getState().saveFile();
    const after = fileOf(name);
    assert(loaded);
    assert(after.byteLength > 0 && Buffer.from(after).equals(Buffer.from(expected)), `het volledige bestand van A (${after.byteLength} bytes)`);
    assert.deepEqual(writableLog.map(entry => entry.split(' ')[0]), ['create', 'close']);
    assert.equal(store.getState().filePath, null, 'B krijgt geen pad');
    assert.equal(store.getState().fileHandle, null, 'B krijgt geen handle');
    assert.equal(store.getState().isDirty, true, 'B is niet als opgeslagen vastgelegd');
    assert.notEqual(statusOf(store), 'saved', 'B krijgt geen Opgeslagen');
    assert.equal(store.getState().recentFiles.some(file => file.name === name), false, 'niets in Recent');
    assert.equal(browser.downloads.length, 0, 'geen download ernaast');
  } finally {
    browser.dispose();
    delete win.showOpenFilePicker;
    handleFaults.delete(name);
    sw.client.dispose();
  }
});

for (const flag of [false, true]) {
  await check(`review pariteit gewone browserdownload en site (flag ${flag})`, async () => {
    const plain = plainBytes();
    const sw = saveWorker();
    const counted = countingDecodes(sw.compute);
    const { createAppStoreContext } = await loadStore();
    const { store } = createAppStoreContext({ ifcSaveCompute: counted.compute });
    const win = window as unknown as Record<string, unknown>;
    const browser = browserDownload();
    const requests: { id?: string; data: Blob; baseVersion?: string }[] = [];
    const renameLeaf = (name: string) => {
      const state = store.getState(), task = state.tasks.find(t => !t.childIds.length && !t.isMilestone)!;
      state.updateTask(task.id, { name });
      store.getState().runCPM();
    };
    const output = () => new TextEncoder().encode(writeIFC(buildWriteIFCInput(store.getState(), 'merge')));
    try {
      store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
      await store.getState().openOpenedFile({ name: 'gewoon.ifc', content: plainText(plain), ref: null });
      renameLeaf('Één – in download 🚧');
      const expectedDownload = output();
      await store.getState().saveFileAs();
      assert.equal(browser.downloads.length, 1);
      assert.equal(hash(new Uint8Array(await browser.downloads[0]!.arrayBuffer())), hash(expectedDownload));
      win.openaecHost = { storage: {
        list: async () => [], versions: async () => [],
        open: async () => ({ data: new Blob([plain.buffer]), name: 'review-site.ifc', version: 'v1' }),
        save: async (request: { id?: string; data: Blob; baseVersion?: string }) => {
          requests.push(request);
          return { id: request.id ?? 'sitebestand', name: 'review-site.ifc', version: `v${requests.length + 1}` };
        },
      } };
      setSiteSaveAsker(async () => ({ kind: 'site', name: 'review-site.ifc' }));
      renameLeaf('Één – op de site 🏗');
      const expectedNew = output();
      await store.getState().saveFileAs();
      assert.equal(store.getState().siteFileVersion, 'v2');
      renameLeaf('Twee – op de site 🏗');
      const expectedVersion = output();
      assert.equal(await ctrlS(store), true);
      assert.deepEqual(requests.map(r => [r.id, r.baseVersion]), [[undefined, undefined], ['sitebestand', 'v2']]);
      const siteHashes = await Promise.all(requests.map(async r => hash(new Uint8Array(await r.data.arrayBuffer()))));
      assert.deepEqual(siteHashes, [hash(expectedNew), hash(expectedVersion)]);
      assert.equal(counted.decodes(), 0);
      assert.equal(sw.requests().length, 3);
    } finally {
      resetSiteAskers();
      delete win.openaecHost;
      browser.dispose();
      sw.client.dispose();
    }
  });
}

// Vervolgpunt 5: de schrijftoestemming voor een bekende handle vóór het rekenen, zoals de merge. De handle onthoudt de
// toestemming, zoals Chromium (`queryPermission` geeft daarna `granted`).
await check('review browserpermissie: de eerste gewone Ctrl+S wacht op een worker die niet start', async () => {
  const sw = saveWorker('manual');
  const platform = browserDownload();
  const win = window as unknown as Record<string, unknown>;
  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext({ ifcSaveCompute: sw.compute });
  const name = `review-permissie-${++handleCount}.ifc`, before = plainBytes(), handle = new FakeHandle(name);
  handleFiles.set(name, before);
  let expiresAt = 0, granted = false;
  const requireGesture = () => {
    if (performance.now() >= expiresAt) throw new DOMException('Gebruikersactivatie verlopen', 'SecurityError');
  };
  handle.queryPermission = async () => granted ? 'granted' : 'prompt';
  handle.requestPermission = async () => { requireGesture(); granted = true; return 'granted'; };
  win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
  win.showSaveFilePicker = async () => { requireGesture(); return handle; };
  try {
    await store.getState().openOpenedFile({ name, content: plainText(before), ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle } });
    longer(store);
    expiresAt = performance.now() + 5000;
    assert.equal(await ctrlS(store), true);
    assert.notEqual(hash(fileOf(name)), hash(before), 'met verse schrijftoestemming moet Ctrl+S het eigen bestand bijwerken');
    assert.equal(platform.downloads.length, 0);
    assert.equal(store.getState().fileHandle, handle as unknown as FileSystemFileHandle, 'de handle blijft');
  } finally {
    platform.dispose();
    delete win.showOpenFilePicker;
    sw.client.dispose();
  }
});

// Vervolgpunt 7: Opslaan als met een ontbrekende bron gebruikt alleen de bytes van de worker.
await check('review bytes: Opslaan als met ontbrekende bron leest de werkervariant ook als tekst', async () => {
  const sw = saveWorker();
  const counted = countingDecodes(sw.compute);
  const { store } = await openHandle(bytes, counted.compute);
  const browser = browserDownload();
  try {
    store.setState(s => { s.foreignSourceMark = { ...s.foreignSourceMark!, sourceMissing: true }; s.ifcSource = null; });
    setPlanOnlyAsker(async () => true);
    await store.getState().saveFileAs();
    assert.equal(sw.requests().length, 1);
    assert.equal(sw.requests()[0]!.job.kind, 'writer');
    assert.equal(browser.downloads.length, 1);
    assert.equal(counted.decodes(), 0, 'de route gebruikt alleen de bytes');
  } finally {
    resetPlanOnlyAsker();
    browser.dispose();
    sw.client.dispose();
  }
});

// Een gewone ronde van Automatisch opslaan houdt de schrijfrij vast (knownbug 1904); die van een gebouwmodel wijkt (stap 8,
// de voorrangsproeven onderaan).
await check('review wachtrij: handmatig opslaan en sluiten wachten op AutoSave, AutoSave kiest geen kandidaat tijdens Ctrl+S', async () => {
  const sw = saveWorker('manual');
  const path = join(dir, 'review-autosave-wachtrij.ifc'), plain = plainBytes();
  writeFileSync(path, plain);
  const ipc = desktop();
  try {
    const store = await openAt({ kind: 'path', path }, plain, sw.compute);
    const id = store.getState().activeDocumentId;
    store.getState().newDocument();
    const otherId = store.getState().activeDocumentId;
    assert.equal(store.getState().isDirty, false);
    store.getState().switchDocument(id);
    longer(store);
    store.getState().setAutoSaveToFile(true);
    const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw.compute });
    const auto = controller.flush();
    await mergeArrives(sw, 1);
    store.getState().addTask({ name: 'Alleen in de nieuwere handmatige opslag' });
    const manual = ctrlS(store);
    store.getState().requestCloseDocument(otherId);
    assert.equal(store.getState().ui.savingBeforeClose, true);
    assert.equal(sw.requests().length, 1);
    assert(store.getState().documents.some(d => d.id === otherId), 'zelfs het andere tabblad wacht');
    assert.equal(hash(readFileSync(path)), hash(plain), 'er is nog niet geschreven');
    await finishMerge(sw);
    await auto;
    await mergeArrives(sw, 2);
    assert(!readFileSync(path, 'utf8').includes('Alleen in de nieuwere handmatige opslag'));
    await controller.flush();
    assert.equal(sw.requests().length, 2, 'de AutoSave-tik slaat de kandidaat over terwijl Ctrl+S bezig is');
    assert(store.getState().documents.some(d => d.id === otherId));
    await finishMerge(sw);
    assert.equal(await manual, true);
    await turnUntil(() => !store.getState().documents.some(d => d.id === otherId));
    assert(readFileSync(path, 'utf8').includes('Alleen in de nieuwere handmatige opslag'));
    assert.equal(isProjectFileWriteBusy(), false);
    assert.equal(store.getState().ui.savingBeforeClose, false);
  } finally {
    sw.client.dispose();
    ipc.dispose();
  }
});

// Vervolgpunt 6 (besluit Trias): typen tijdens het rekenen van een gewone export weigert die export (knownbug 1894).
await check('review exportbewerking: verder typen tijdens een gewone workerexport weigert de gekozen momentopname', async () => {
  const sw = saveWorker('manual');
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext({ ifcSaveCompute: sw.compute });
  const ipc = desktop();
  const target = join(dir, 'review-export-bewerking.ifc');
  ipc.choose(target);
  try {
    await store.getState().openOpenedFile({ name: 'gewoon.ifc', content: plainText(plainBytes()), ref: null });
    longer(store);
    clearNotices(store);
    const exporting = store.getState().exportAs('ifc');
    await mergeArrives(sw, 1);
    store.getState().addTask({ name: 'Getypt tijdens de export' });
    await finishMerge(sw);
    const result = await exporting;
    assert.equal(result.ok && result.cancelled, true);
    assertNotice(store, 'notifications.ifcExportChangedWhileWaiting');
    assert.equal(ipc.picks(), 0);
    assert.equal(existsSync(target), false);
    assert.equal(store.getState().isDirty, true);
  } finally {
    sw.client.dispose();
    ipc.dispose();
  }
});

// Blokkade 4: bij de bestaande mergehandle beslist de inhoudscontrole synchroon, direct naast `close()`.
await check('review 1896: gebouwmodel, laadactie tussen de asynchrone broncontrole en close', async () => {
  const sw = saveWorker();
  const { createAppStoreContext } = await loadStore();
  const context = createAppStoreContext({ ifcSaveCompute: sw.compute }), { store } = context;
  const name = `review-close-${++handleCount}.ifc`;
  handleFiles.set(name, bytes);
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name, content: '', bytes, ref: { kind: 'handle', handle: new FakeHandle(name) as unknown as FileSystemFileHandle } });
  const unregister = recoveryRounds(store), original = FakeHandle.prototype.getFile;
  let late = false, ran = false;
  FakeHandle.prototype.getFile = async function() {
    const file = await original.call(this);
    if (this.name !== name || !late) return file;
    late = false;
    const slice = file.slice.bind(file);
    file.slice = (...args) => {
      const blob = slice(...args), buffer = blob.arrayBuffer.bind(blob);
      blob.arrayBuffer = async () => {
        const read = await buffer();
        let remaining = 6;
        const load = () => {
          if (--remaining > 0) { queueMicrotask(load); return; }
          assert.equal(hash(fileOf(name)), hash(bytes), 'plaatsing was nog te voorkomen');
          loadThroughExtension(context, false);
          ran = true;
        };
        queueMicrotask(load);
        return read;
      };
      return blob;
    };
    return file;
  };
  handleFaults.set(name, { onWrite: () => { late = true; } });
  try {
    longer(store);
    clearNotices(store);
    writableLog.length = 0;
    await ctrlS(store);
    assert(ran);
    assert.equal(hash(fileOf(name)), hash(bytes), 'close moet direct na de synchrone inhoudscontrole beslissen');
    assert.deepEqual(writableLog.map(entry => entry.split(' ')[0]), ['create', 'abort']);
  } finally {
    FakeHandle.prototype.getFile = original;
    handleFaults.delete(name);
    unregister();
    sw.client.dispose();
    await clearRecovery();
  }
});

// Review van #1027, ronde 2: een tabbladwissel is geen wijziging van de planning. De late controle van een IFC-export
// (knownbug 1896) kijkt naar het geëxporteerde document, ook als dat intussen in een ander tabblad staat: de export van
// A rondt af met de volledige bytes. De proef van de reviewer, vanaf de echte exportacties.
for (const withPool of [false, true]) {
  const route = withPool ? 'met resourcebibliotheek' : 'IFC';
  await check(`review van #1027 ronde 2: desktopexport ${route} na een gewone tabbladwissel rondt af`, async () => {
    const { sameIFCSource } = await import('@/state/ifcSaveInput');
    const { createAppStoreContext } = await loadStore();
    const sw = saveWorker();
    const { store } = createAppStoreContext({ ifcSaveCompute: sw.compute });
    const ipc = desktop();
    const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
    const internal = win.__TAURI_INTERNALS__;
    const invoke = internal.invoke;
    const target = join(dir, `export-tabwissel-${withPool}.ifc`);
    const pool = join(dir, 'export-tabwissel-bibliotheek.ifc');
    const previous = new TextEncoder().encode('Bestaande projectexport');
    let tempWritten!: () => void;
    const atTemp = new Promise<void>(resolve => { tempWritten = resolve; });
    let finishWrite!: () => void;
    const waitToPlace = new Promise<void>(resolve => { finishWrite = resolve; });
    let entered = false;
    try {
      await store.getState().openOpenedFile({ name: 'gewoon.ifc', content: plainText(plainBytes()), ref: null });
      const first = store.getState().activeDocumentId;
      const second = store.getState().newDocument();
      store.getState().switchDocument(first);
      if (withPool) {
        const companyId = store.getState().seedDemoLibrary();
        store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
      }
      longer(store);
      clearNotices(store);
      const snapshot = store.getState();
      const expected = new TextEncoder().encode(writeIFC(buildExportIFCInput(snapshot, withPool ? 'planOnly' : 'merge')));
      const originalContent = documentContentOf(snapshot, first);
      writeFileSync(target, previous);
      ipc.choose(target);
      ipc.onPick(() => { if (ipc.picks() === 2) ipc.choose(pool); });
      internal.invoke = async (...args) => {
        const result = await invoke(...args);
        if (!entered && (args[0] === 'plugin:fs|write_file' || args[0] === 'plugin:fs|write_text_file') && tempLeft().length > 0) {
          entered = true;
          tempWritten();
          await waitToPlace;
        }
        return result;
      };

      const saving = withPool ? snapshot.exportProjectWithPool() : snapshot.exportAs('ifc');
      await Promise.race([atTemp, saving.then(() => assert.fail('de actie kwam nooit bij het hulpbestand'))]);
      assert(entered);
      assert.equal(hash(readFileSync(target)), hash(previous), 'het bestaande doel staat nog op zijn plaats');
      assert.equal(hash(readFileSync(join(dir, tempLeft()[0]!))), hash(expected), 'in het hulpbestand staan alle bytes van A');
      store.getState().switchDocument(second);
      assert.equal(store.getState().activeDocumentId, second);
      assert.deepEqual(documentContentOf(store.getState(), first), originalContent, 'de identiteit van A bleef gelijk');
      assert(sameIFCSource(snapshot, payloadOf(store, first)), 'de te schrijven inhoud van A bleef gelijk');
      finishWrite();
      const result = await saving;
      const actual = readFileSync(target);
      const observation = {
        route, cancelled: result.ok && result.cancelled === true, existingHash: hash(previous), expectedHash: hash(expected),
        actualHash: hash(actual), actualLength: actual.length, expectedLength: expected.length, picks: ipc.picks(),
        recent: store.getState().recentFiles.some(file => file.name === target.split('/').at(-1)),
        errors: store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey),
        poolWritten: existsSync(pool), tempLeft: tempLeft().length,
      };
      console.log('REVIEW-TABWISSEL', JSON.stringify(observation));
      assert(result.ok && !result.cancelled, 'de export van A hoort bij een gewone tabbladwissel af te ronden');
      assert.equal(hash(actual), hash(expected));
      assert.equal(ipc.picks(), withPool ? 2 : 1);
      assert.equal(observation.poolWritten, withPool);
    } finally {
      finishWrite();
      internal.invoke = invoke;
      ipc.dispose();
      sw.client.dispose();
    }
  });
}

/** Knownbugs 1901 (a) en 1903: de desktopexport van A, met op één moment eerst `change` op A (bewerken, of via de
 *  extensie een ander project laden) en dan een wissel naar tabblad B. `temp`: met de uitvoer van A in het hulpbestand,
 *  vóór de plaatsing (één schrijfpauze, zoals de proef van ronde 2 hierboven); `picker`: vlak na de bestandskiezer,
 *  vóór de doelcontrole terugkomt. `foreign`: A is een IFC met gebouwmodel (flag aan) en de export de volledige IFC, dus
 *  alleen een nieuwe naam. Ongewijzigd rondt de export af met precies de bytes van A; gewijzigd weigert hij met de
 *  bestaande melding en schrijft hij niets. */
async function exportWithTabSwitch({ withPool, foreign, when, change }: {
  withPool: boolean; foreign: boolean; when: 'picker' | 'temp'; change: 'none' | 'edit' | 'replace';
}) {
  const { createAppStoreContext } = await loadStore();
  const sw = saveWorker();
  const context = createAppStoreContext({ ifcSaveCompute: sw.compute }), { store } = context;
  const ipc = desktop();
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const internal = win.__TAURI_INTERNALS__;
  const invoke = internal.invoke;
  const tag = `${withPool ? 'pool' : foreign ? 'model' : 'ifc'}-${when}-${change}`;
  const target = join(dir, `export-wissel-${tag}.ifc`), pool = join(dir, `export-wissel-${tag}-bibliotheek.ifc`);
  const previous = new TextEncoder().encode('Bestaande projectexport');
  let tempWritten!: () => void;
  const atTemp = new Promise<void>(resolve => { tempWritten = resolve; });
  let finishWrite!: () => void;
  const waitToPlace = new Promise<void>(resolve => { finishWrite = resolve; });
  let switched = false;
  try {
    if (foreign) store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    await store.getState().openOpenedFile(foreign
      ? { name: 'model.ifc', content: '', bytes, ref: null }
      : { name: 'gewoon.ifc', content: plainText(plainBytes()), ref: null });
    assert.equal(hasForeignContent(store.getState().ifcSource), foreign);
    const first = store.getState().activeDocumentId;
    const second = store.getState().newDocument();
    store.getState().switchDocument(first);
    if (withPool) store.getState().setProject({ companyId: store.getState().seedDemoLibrary(), companyName: 'Proefbedrijf' });
    longer(store);
    clearNotices(store);
    const snapshot = store.getState();
    const input = buildExportIFCInput(snapshot, withPool ? 'planOnly' : 'merge');
    const expected = foreign ? (await prepareIfcWrite(input, snapshot.ifcSource!)).bytes : new TextEncoder().encode(writeIFC(input));
    const secondFile = payloadOf(store, second).filePath;
    if (!foreign) writeFileSync(target, previous);
    const switchAway = () => {
      switched = true;
      if (change === 'edit') longer(store);
      if (change === 'replace') loadThroughExtension(context, false);
      store.getState().switchDocument(second);
      assert.equal(store.getState().activeDocumentId, second);
    };
    ipc.choose(target);
    ipc.onPick(() => {
      if (ipc.picks() === 1 && when === 'picker') switchAway();
      if (ipc.picks() === 2) ipc.choose(pool);
    });
    if (when === 'temp') internal.invoke = async (...args) => {
      const result = await invoke(...args);
      if (!switched && writeFileCallOf({ command: String(args[0]) }) && tempLeft().length > 0) {
        tempWritten();
        await waitToPlace;
      }
      return result;
    };
    const action = withPool ? snapshot.exportProjectWithPool() : snapshot.exportAs('ifc');
    if (when === 'temp') {
      await Promise.race([atTemp, action.then(() => assert.fail('de export kwam nooit bij het hulpbestand'))]);
      assert.equal(hash(readFileSync(join(dir, tempLeft()[0]!))), hash(expected), 'in het hulpbestand staan alle bytes van A');
      switchAway();
      finishWrite();
    }
    const result = await action;
    assert(switched, 'de tabbladwissel vond plaats');
    assert.equal(store.getState().activeDocumentId, second, 'B blijft het actieve tabblad');
    assert.equal(store.getState().filePath, secondFile, 'B houdt zijn eigen doel');
    assert.deepEqual(tempLeft(), [], 'geen hulpbestand achtergebleven');
    const recent = store.getState().recentFiles.some(file => file.name === target.split('/').at(-1));
    if (change === 'none') {
      assert(result.ok && !result.cancelled, 'een gewone tabbladwissel is geen wijziging van de planning');
      assert.equal(hash(readFileSync(target)), hash(expected), 'precies de planning van A');
      if (foreign) assert.deepEqual(mergeProblems(bytes, new Uint8Array(readFileSync(target))), []);
      assert.equal(ipc.picks(), withPool ? 2 : 1);
      assert.equal(existsSync(pool), withPool);
      assert.equal(recent, true);
      assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), []);
    } else {
      assert(result.ok && result.cancelled, 'een gewijzigde A wordt niet geëxporteerd');
      if (foreign) assert.equal(existsSync(target), false);
      else assert.equal(hash(readFileSync(target)), hash(previous), 'het bestaande doel blijft ongewijzigd');
      // Na de kiezer weigert de doelcontrole al, dus vóór er een hulpbestand ontstaat.
      if (when === 'picker') assert.equal(ipc.calls.filter(c => writeFileCallOf(c) && isTemp(c.path)).length, 0, 'niets geschreven');
      assert.equal(ipc.picks(), 1);
      assert.equal(existsSync(pool), false);
      assert.equal(recent, false);
      assertNotice(store, 'notifications.ifcExportChangedWhileWaiting');
    }
  } finally {
    finishWrite();
    internal.invoke = invoke;
    ipc.dispose();
    sw.client.dispose();
  }
}

for (const withPool of [false, true]) {
  const route = withPool ? 'met resourcebibliotheek' : 'IFC';
  for (const change of ['edit', 'replace'] as const) {
    await check(`knownbug 1901: desktopexport ${route}, A ${change === 'edit' ? 'bewerkt' : 'vervangen'} en dan naar B, weigert`,
      () => exportWithTabSwitch({ withPool, foreign: false, when: 'temp', change }));
  }
  await check(`knownbug 1903: desktopexport ${route}, direct na de kiezer naar B, rondt af`,
    () => exportWithTabSwitch({ withPool, foreign: false, when: 'picker', change: 'none' }));
  await check(`knownbug 1903: desktopexport ${route}, na de kiezer A bewerkt en naar B, weigert vóór het schrijven`,
    () => exportWithTabSwitch({ withPool, foreign: false, when: 'picker', change: 'edit' }));
}
await check('knownbug 1901: desktopexport IFC met gebouwmodel, met de uitvoer van A in het hulpbestand naar B, rondt af',
  () => exportWithTabSwitch({ withPool: false, foreign: true, when: 'temp', change: 'none' }));
await check('knownbug 1903: desktopexport IFC met gebouwmodel, direct na de kiezer naar B, rondt af',
  () => exportWithTabSwitch({ withPool: false, foreign: true, when: 'picker', change: 'none' }));

// Knownbug 1903 in de browser (met knownbug 1899): de opslaankiezer van Chromium maakt een gekozen bestaand bestand al
// leeg bij het kiezen. Weigerde de doelcontrole daarna om een tabbladwissel, dan bleef dat bestand leeg. Nu krijgt het de
// bytes van A. Een A die na de kiezer verandert, schrijft de export niet; dan blijft het bestand leeg, zoals bij elke
// weigering na deze kiezer (1899). Fixronde 2 van #1097 (keuze (b) van de technisch beslisser): staat A na de kiezer niet
// meer vooraan, dan moet A ook tot aan `close()` ongewijzigd blijven, anders `abort()`. `change`:
// - `edit-at-picker`: A bewerkt vóór de doelcontrole, dan naar B;
// - `back-and-edit`: naar B bij de kiezer; tijdens de write terug naar A, een taak bewerkt, weer naar B;
// - `rename-library`: naar B bij de kiezer; tijdens de write de bibliotheek van A hernoemd terwijl B vooraan blijft
//   (`renameCompany` wijzigt `project.companyName` in het slapende A, en die naam gaat mee in het IFC);
// - `back-and-stay` (fixronde 3): naar B bij de kiezer; tijdens de write terug naar A, een taak bewerkt, en op A blijven.
//   De keuze voor de late controle valt bij de geslaagde doelcontrole (A stond daar niet vooraan), niet bij `close()`;
// - `no-switch-edit`: geen wissel, A tijdens de write bewerkt. Dat is het late venster van main (knownbug 1958): de
//   export plaatst de planning van vóór de wijziging en meldt succes. Bewust niet veranderd; deze proef legt main vast;
// - `edit-then-switch` (fixronde 3): A vooraan tot en met de doelcontrole, tijdens de write A bewerkt en dán pas naar B.
//   Ook dat is main (knownbug 1958): de eerste wissel kwam na de doelcontrole.
const BROWSER_CHANGES = ['none', 'edit-at-picker', 'back-and-edit', 'rename-library', 'back-and-stay', 'no-switch-edit', 'edit-then-switch'] as const;
const browserCases = [false, true].flatMap(withPool => BROWSER_CHANGES
  .filter(change => !withPool || change !== 'edit-at-picker')
  .map(change => ({ withPool, change })));
for (const { withPool, change } of browserCases) {
  const label = {
    'none': 'direct na de kiezer naar B, krijgt de bytes van A',
    'edit-at-picker': 'na de kiezer A bewerkt en naar B, schrijft A niet',
    'back-and-edit': 'naar B, tijdens de write A bewerkt, breekt af vóór close',
    'rename-library': 'naar B, tijdens de write de bibliotheek van A hernoemd, breekt af vóór close',
    'back-and-stay': 'naar B, tijdens de write terug naar A en A bewerkt, breekt af vóór close',
    'no-switch-edit': 'zonder wissel A bewerkt tijdens de write, plaatst de oude bytes zoals main (knownbug 1958)',
    'edit-then-switch': 'A vooraan bij de doelcontrole, tijdens de write bewerkt en dan naar B, plaatst de oude bytes zoals main (knownbug 1958)',
  }[change];
  await check(`knownbug 1903: browserexport ${withPool ? 'met resourcebibliotheek' : 'IFC'} naar een handle, ${label}`, async () => {
    const { createAppStoreContext } = await loadStore();
    const sw = saveWorker();
    const { store } = createAppStoreContext({ ifcSaveCompute: sw.compute });
    const browser = browserDownload();
    const win = window as unknown as Record<string, unknown>;
    const name = `browser-wissel-${withPool}-${change}-${++handleCount}.ifc`, library = `${name}-bibliotheek.ifc`;
    const switchAtPicker = change !== 'no-switch-edit' && change !== 'edit-then-switch';
    const placed = change === 'none' || change === 'no-switch-edit' || change === 'edit-then-switch';
    try {
      await store.getState().openOpenedFile({ name: 'gewoon.ifc', content: plainText(plainBytes()), ref: null });
      const first = store.getState().activeDocumentId;
      const companyId = store.getState().seedDemoLibrary();
      store.getState().setProject({ companyId, companyName: 'Bedrijf van A' });
      const second = store.getState().newDocument();
      store.getState().switchDocument(first);
      longer(store);
      clearNotices(store);
      const expected = new TextEncoder().encode(writeIFC(buildExportIFCInput(store.getState(), withPool ? 'planOnly' : 'merge')));
      handleFiles.set(name, new TextEncoder().encode('Versie vóór export'));
      win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
      let picks = 0;
      win.showSaveFilePicker = async () => {
        if (++picks === 2) { handleFiles.set(library, new Uint8Array()); return new FakeHandle(library); }
        handleFiles.set(name, new Uint8Array()); // Chromium kapt het gekozen bestand af vóór de kiezer terugkomt.
        if (change === 'edit-at-picker') longer(store);
        if (switchAtPicker) store.getState().switchDocument(second);
        return new FakeHandle(name);
      };
      let changedDuringWrite = false;
      handleFaults.set(name, { onWrite: () => {
        if (changedDuringWrite) return;
        changedDuringWrite = true;
        if (change === 'back-and-edit') {
          store.getState().switchDocument(first);
          longer(store);
          store.getState().switchDocument(second);
        }
        if (change === 'rename-library') {
          assert.equal(store.getState().activeDocumentId, second);
          store.getState().renameCompany(companyId, 'Bibliotheek hernoemd 1097');
          assert.equal(payloadOf(store, first).project.companyName, 'Bibliotheek hernoemd 1097', 'het slapende A veranderde');
        }
        if (change === 'back-and-stay') {
          store.getState().switchDocument(first);
          longer(store);
        }
        if (change === 'no-switch-edit' || change === 'edit-then-switch') longer(store);
        if (change === 'edit-then-switch') store.getState().switchDocument(second);
      } });
      writableLog.length = 0;
      const result = withPool ? await store.getState().exportProjectWithPool() : await store.getState().exportAs('ifc');
      const projectLog = writableLog.filter(entry => entry.split(' ')[1] === name).map(entry => entry.split(' ')[0]);
      const recent = store.getState().recentFiles.some(file => file.name === name);
      assert.equal(store.getState().activeDocumentId, change === 'no-switch-edit' || change === 'back-and-stay' ? first : second);
      assert.equal(browser.downloads.length, 0, 'geen download ernaast');
      if (placed) {
        assert(result.ok && !result.cancelled, change === 'none' ? 'een tabbladwissel is geen wijziging van de planning' : 'main: de export slaagt');
        assert(Buffer.from(fileOf(name)).equals(Buffer.from(expected)), 'het gekozen bestand krijgt precies de bytes van A (van de momentopname)');
        assert.deepEqual(projectLog, ['create', 'close']);
        assert.equal(recent, true);
        assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error'), []);
        if (withPool) assert(fileOf(library).byteLength > 0, 'de bibliotheek ernaast');
        assert.equal(picks, withPool ? 2 : 1);
        if (change !== 'none') assert(changedDuringWrite, 'A veranderde tijdens de write');
      } else {
        assert(result.ok && result.cancelled, 'een veranderde A wordt niet geëxporteerd');
        assert.equal(fileOf(name).byteLength, 0, 'de kiezer had het bestand al leeggemaakt (1899); niet de oude bytes van A');
        assert.deepEqual(projectLog, change === 'edit-at-picker' ? [] : ['create', 'abort'], 'afgebroken vóór close');
        assert.equal(change === 'edit-at-picker' || changedDuringWrite, true);
        assert.equal(recent, false, 'niets in Recent');
        assert.equal(handleFiles.has(library), false, 'geen bibliotheek');
        assert.equal(picks, 1, 'geen tweede kiezer');
        assertNotice(store, 'notifications.ifcExportChangedWhileWaiting');
      }
    } finally {
      handleFaults.delete(name);
      delete win.showOpenFilePicker;
      browser.dispose();
      sw.client.dispose();
    }
  });
}

// ── #804 stap 8: Automatisch opslaan bij een document met een gebouwmodel ─────────────────────────────────────────────
// Dezelfde vervanging als Ctrl+S (browser: de handle met herstel in twee stappen; desktop: `replaceOwnPathWithRecovery`),
// met een eigen ritme per document (30 s rust; de klok is nagebootst) en voorrang voor handmatige acties.
/** De klok van het ritme: `rest()` laat 31 s rust voorbijgaan. */
function autoClock() {
  let t = 5_000_000;
  return { now: () => t, rest: () => { t += 31_000; }, advance: (ms: number) => { t += ms; } };
}
/** Automatisch opslaan aan, met de echte controller zoals `useAutoSave` hem bouwt (de berekenfunctie van de store). */
function modelAutoSave(store: Store, compute?: IfcOutputCompute) {
  const clock = autoClock();
  store.getState().setAutoSaveToFile(true);
  const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute, now: clock.now });
  /** Na een wijziging: de store meldt hem (`observe`), dan 31 s rust, dan de ronde. */
  const round = () => { controller.observe(); clock.rest(); return controller.flushModels(); };
  return { controller, clock, round };
}
const replaceRecordsIn = (appData: string) => readdirSync(appData).filter(name => name.includes('.replace.'));
const autoErrors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);

await check('stap 8, browser: een ronde schrijft het eigen bestand via de handle; het model bytegelijk, de bron volgt, het herstelveld weg', async () => {
  const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  const browser = browserDownload();
  try {
    longer(store); clearNotices(store); writableLog.length = 0;
    const auto = modelAutoSave(store, sw.compute);
    auto.controller.observe();
    await auto.controller.flushModels();
    assert.deepEqual(writableLog, [], 'zonder 30 s rust geen ronde');
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    auto.clock.rest();
    await auto.controller.flushModels();
    const output = fileOf(name);
    assert.equal(hash(output), expected.sha256, 'precies de merge van de momentopname');
    assert.equal(sw.merges(), 1, 'gerekend in de opslagworker');
    assert.deepEqual(writableLog, [`create ${name}`, `close ${name} 1`], 'één vervanging, de hele buffer in één write');
    assert.deepEqual(mergeProblems(bytes, output), [], 'het vreemde deel bytegelijk');
    const now = store.getState();
    assert.equal(now.ifcSource!.sha256, hash(output), 'de geschreven versie is de bron');
    assert.equal(now.foreignSourceMark!.sha256, hash(output));
    assert.equal(now.isDirty, false, 'niet meer gewijzigd');
    assert.equal(statusOf(store), 'saved');
    assert.equal(await pendingIn(now.activeDocumentId), undefined, 'het herstelveld is weg');
    assert.deepEqual(autoErrors(store), []);
    assert.equal(browser.downloads.length, 0, 'nooit een download');
  } finally { unregister(); browser.dispose(); sw.client.dispose(); await clearRecovery(); }
});

await check('stap 8, desktop: een ronde vervangt het eigen pad; het model bytegelijk, de bron volgt, geen herstelrecord of hulpbestand', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const ipc = desktop(appData), sw = saveWorker();
  try {
    const own = join(dir, 'autosave-eigen.ifc'); writeFileSync(own, bytes);
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store);
      const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
      const from = ipc.calls.length;
      await modelAutoSave(store, sw.compute).round();
      const output = new Uint8Array(readFileSync(own));
      assert.equal(hash(output), expected.sha256, 'precies de merge van de momentopname');
      assert.deepEqual(ipc.calls.slice(from).filter(c => c.command === 'plugin:fs|write_file' && c.path?.startsWith(dir))
        .map(c => [isTemp(c.path), c.options?.createNew]), [[true, true]], 'de hele buffer in het eigen tijdelijke bestand');
      assert.equal(ipc.calls.slice(from).filter(c => c.command === 'place_file_exclusive').length, 2, 'stap 3 en 4 van de vervanging');
      assert.deepEqual(mergeProblems(bytes, output), [], 'het vreemde deel bytegelijk');
      assert.equal(store.getState().ifcSource!.sha256, hash(output), 'de geschreven versie is de bron');
      assert.equal(store.getState().isDirty, false);
      assert.deepEqual(replaceRecordsIn(appData), [], 'het herstelrecord is weg');
      assert.deepEqual(tempLeft(), [], 'geen hulpbestand');
      assert.deepEqual(readdirSync(dir).filter(n => n.startsWith('autosave-eigen.ifc.')), [], 'geen vorige versie');
      assert.deepEqual(autoErrors(store), []);
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

await check('stap 8: typen tijdens de ronde; de momentopname staat in het bestand, het document blijft gewijzigd, de volgende ronde neemt het mee', async () => {
  const sw = saveWorker('manual'), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    longer(store); clearNotices(store);
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    const auto = modelAutoSave(store, sw.compute);
    const first = auto.round();
    await mergeArrives(sw, 1);
    assert.equal(isProjectFileWriteBusy(), true, 'de ronde rekent onder het schrijfslot');
    store.getState().addTask({ name: 'Getypt tijdens de ronde' });
    await finishMerge(sw);
    await first;
    assert.equal(hash(fileOf(name)), expected.sha256, 'de momentopname van de ronde');
    assert.equal(store.getState().isDirty, true, 'het latere werk is nog niet opgeslagen');
    assert.equal(store.getState().ifcSource!.sha256, expected.sha256, 'de bron is wel de geschreven versie');
    const second = auto.round();
    await mergeArrives(sw, 2); await finishMerge(sw);
    await second;
    assert(plainText(fileOf(name)).includes('Getypt tijdens de ronde'), 'de volgende ronde schreef het latere werk');
    assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(autoErrors(store), []);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

await check('stap 8: een slapend document (ander tabblad) wordt opgeslagen en gecommit', async () => {
  const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    const model = store.getState().activeDocumentId;
    longer(store);
    const auto = modelAutoSave(store, sw.compute);
    const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
    store.getState().newDocument();
    assert.notEqual(store.getState().activeDocumentId, model);
    clearNotices(store);
    await auto.round();
    assert.equal(hash(fileOf(name)), expected.sha256, 'het slapende document is geschreven');
    const sleeping = payloadOf(store, model);
    assert.equal(sleeping.isDirty, false, 'en gecommit');
    assert.equal(sleeping.ifcSource!.sha256, expected.sha256, 'de bron van het slapende document volgt');
    assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
    assert.deepEqual(autoErrors(store), []);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

await check('stap 8: het eigen bestand verschilt van de bron; niets geschreven, één melding, geen tweede poging; na opslaan doet het weer mee', async () => {
  const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    longer(store); clearNotices(store);
    handleFiles.set(name, otherProgram);
    writableLog.length = 0;
    const auto = modelAutoSave(store, sw.compute);
    await auto.round();
    assert.equal(hash(fileOf(name)), hash(otherProgram), 'het bestand van de ander blijft');
    assert.deepEqual(writableLog, [], 'nul schrijfacties');
    assert.equal(sw.merges(), 0, 'gestopt vóór het rekenen');
    assert.equal(store.getState().isDirty, true);
    assertNotice(store, 'notifications.ifcForeignAutoSaveTargetChanged');
    longer(store);
    await auto.round();
    assert.deepEqual(writableLog, [], 'geen tweede poging');
    assertNotice(store, 'notifications.ifcForeignAutoSaveTargetChanged');
    // De planner zet het bestand terug en slaat zelf op: daarna doet het document weer mee.
    handleFiles.set(name, store.getState().ifcSource!.bytes);
    assert.equal(await ctrlS(store), true, 'Ctrl+S slaat op');
    clearNotices(store); writableLog.length = 0;
    longer(store);
    await auto.round();
    assert.deepEqual(writableLog, [`create ${name}`, `close ${name} 1`], 'na opslaan schrijft Automatisch opslaan weer');
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(autoErrors(store), []);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

for (const backend of ['browser', 'desktop'] as const) {
  await check(`stap 8, ${backend}: het herstel kan de komende versie niet vastleggen; niets geplaatst, één melding`, async () => {
    const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
    const ipc = backend === 'desktop' ? desktop(appData) : null, sw = saveWorker();
    try {
      const own = join(dir, 'autosave-niet-vastgelegd.ifc'); writeFileSync(own, bytes);
      const opened = backend === 'browser' ? await openHandle(bytes, sw.compute)
        : { store: await openAt({ kind: 'path', path: own }, bytes, sw.compute), name: '' };
      const { store } = opened;
      // Browser: geen herstelronde (zoals vóór de herstelkeuze), dus niets vast te leggen. Desktop: het record in de
      // datamap kan niet geschreven worden.
      const unregister = backend === 'desktop' ? recoveryRounds(store) : () => {};
      if (ipc) ipc.faults.forbidden = path => path.startsWith(appData) && path.includes('.replace.');
      try {
        longer(store); clearNotices(store); writableLog.length = 0;
        const from = ipc?.calls.length ?? 0;
        await modelAutoSave(store, sw.compute).round();
        if (ipc) {
          assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'het eigen bestand onveranderd');
          assert.deepEqual(ipc.calls.slice(from).filter(c => c.command === 'place_file_exclusive'), [], 'niets geplaatst');
          assert.deepEqual(ipc.calls.slice(from).filter(c => c.wrote && c.path?.startsWith(dir)), [], 'nul schrijfacties in de map');
          assert.deepEqual(replaceRecordsIn(appData), []);
        } else {
          assert.equal(hash(fileOf(opened.name)), hash(bytes), 'het eigen bestand onveranderd');
          assert.deepEqual(writableLog, [], 'nul schrijfacties');
        }
        assert.equal(store.getState().isDirty, true);
        assertNotice(store, 'notifications.ifcForeignAutoSaveNotRecorded');
      } finally { unregister(); await clearRecovery(); }
    } finally { ipc?.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
  });
}

// Fixronde 1 van #1124: zonder toegang tot de map een eigen melding (één keer zelf opslaan, dan vraagt de app de map).
await check('stap 8, desktop buiten de thuismap (forbidden): niets geschreven, geen herstelrecord dat blijft, één melding over de toegang tot de map', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const folder = mkdtempSync(join(dir, 'buiten-'));
  const ipc = desktop(appData), sw = saveWorker();
  try {
    const own = join(folder, 'model.ifc'); writeFileSync(own, bytes);
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store);
      ipc.faults.forbidden = path => path.startsWith(`${folder}/`) && (isTemp(path) || path.includes('.ops-vorige-'));
      ipc.faults.forbiddenMeta = true;
      const from = ipc.calls.length;
      const auto = modelAutoSave(store, sw.compute);
      await auto.round();
      assert.deepEqual(readdirSync(folder), ['model.ifc']);
      assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'niets geschreven');
      assert.deepEqual(ipc.calls.slice(from).filter(c => c.wrote && c.path?.startsWith(folder)), [], 'nul schrijfacties in de map');
      assert.deepEqual(replaceRecordsIn(appData), [], 'geen herstelrecord dat blijft staan');
      assertNotice(store, 'notifications.ifcForeignAutoSaveFolderAccess');
      longer(store);
      await auto.round();
      assert.equal(sw.merges(), 1, 'geen tweede poging');
      assertNotice(store, 'notifications.ifcForeignAutoSaveFolderAccess');
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

// De gewone zin blijft waar Opslaan als de uitweg is: een bestand met een tweede naam (harde link).
await check('stap 8, desktop: het eigen bestand heeft een tweede naam (harde link); niets geschreven, de melding van Opslaan als', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const folder = mkdtempSync(join(dir, 'link-'));
  const ipc = desktop(appData), sw = saveWorker();
  try {
    const own = join(folder, 'model.ifc'); writeFileSync(own, bytes);
    linkSync(own, join(folder, 'tweede naam.ifc'));
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store);
      await modelAutoSave(store, sw.compute).round();
      assert.deepEqual(readdirSync(folder).sort(), ['model.ifc', 'tweede naam.ifc']);
      assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'niets geschreven');
      assert.deepEqual(replaceRecordsIn(appData), []);
      assertNotice(store, 'notifications.ifcForeignAutoSaveSaveAsOnly');
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

await check('stap 8, desktop: een herstelrecord van een eerdere onderbroken vervanging; niets geschreven, één melding', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const ipc = desktop(appData), sw = saveWorker();
  try {
    const own = join(dir, 'autosave-restant.ifc'); writeFileSync(own, bytes);
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      const { ownRecoveryNames } = await import('@/services/recovery/recoveryPaths');
      writeFileSync(join(appData, `${ownRecoveryNames.base}.replace.vaneerder1.json`), JSON.stringify({
        kind: 'ops-replace', version: 1, id: 'vaneerder1', path: own, vorigeSha256: hash(bytes), pendingSha256: hash(otherProgram),
      }));
      longer(store); clearNotices(store);
      const from = ipc.calls.length;
      await modelAutoSave(store, sw.compute).round();
      assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'niets geschreven');
      assert.deepEqual(ipc.calls.slice(from).filter(c => c.command === 'place_file_exclusive'), [], 'niets geplaatst');
      assert.deepEqual(replaceRecordsIn(appData), [`${ownRecoveryNames.base}.replace.vaneerder1.json`], 'alleen het oude record');
      assert.equal(store.getState().isDirty, true);
      assertNotice(store, 'notifications.ifcForeignAutoSaveRemnant');
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

// Besluit technisch beslisser, 19 november 2026: "de ronde wijkt". Elke proef houdt het rekenen van de ronde in de worker
// vast (die antwoordt nooit): de handmatige actie loopt toch meteen, en de ronde schrijft niets en meldt niets.
for (const manual of ['Ctrl+S, zelfde document', 'Ctrl+S, ander document', 'een tabblad sluiten', 'de laatste fase van afsluiten'] as const) {
  await check(`stap 8, voorrang: ${manual} tijdens het rekenen breekt de ronde af; niets geschreven, geen melding, de ronde komt later terug`, async () => {
    const sw = saveWorker('manual'), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      const model = store.getState().activeDocumentId;
      // Een tweede, gewoon document met een eigen handle (voor Ctrl+S op een ander document) of zonder bestand (sluiten).
      let other = '', otherName = '';
      if (manual === 'Ctrl+S, ander document') {
        otherName = `gewoon-${++handleCount}.ifc`;
        handleFiles.set(otherName, plainBytes());
        await store.getState().openOpenedFile({ name: otherName, content: plainText(plainBytes()),
          ref: { kind: 'handle', handle: new FakeHandle(otherName) as unknown as FileSystemFileHandle } });
        other = store.getState().activeDocumentId;
        longer(store);
        store.getState().switchDocument(model);
      } else if (manual === 'een tabblad sluiten') {
        other = store.getState().newDocument();
        store.getState().switchDocument(model);
      }
      longer(store); clearNotices(store); writableLog.length = 0;
      const auto = modelAutoSave(store, sw.compute);
      const round = auto.round();
      await mergeArrives(sw, 1);
      const roundWorker = sw.workers[0]!;
      roundWorker.start();
      let reopen: (() => void) | undefined;
      let action: Promise<unknown>;
      if (manual === 'Ctrl+S, zelfde document') action = ctrlS(store);
      else if (manual === 'Ctrl+S, ander document') action = store.getState().saveFileForDocument((store.getState().switchDocument(other), other));
      else if (manual === 'een tabblad sluiten') { store.getState().requestCloseDocument(other); action = turnUntil(() => !store.getState().documents.some(d => d.id === other)); }
      else action = closeProjectFileWrites().then(r => { reopen = r; });
      await round;
      assert.equal(roundWorker.terminated, true, 'de worker van de ronde is gestopt, zonder te antwoorden');
      assert.deepEqual(writableLog, [], 'de ronde schreef niets');
      assert.equal(hash(fileOf(name)), hash(bytes), 'het eigen bestand onveranderd');
      assert.equal(payloadOf(store, model).isDirty, true, 'het document blijft gewijzigd');
      assert.deepEqual(autoErrors(store), [], 'geen melding');
      if (manual.startsWith('Ctrl+S')) {
        await mergeArrives(sw, 2);
        assert.notEqual(sw.workers.at(-1), roundWorker, 'Ctrl+S rekent meteen in een nieuwe worker');
        await finishMerge(sw);
        assert.equal(await action, true, 'Ctrl+S slaat op');
      } else await action;
      if (manual === 'Ctrl+S, ander document') assert.equal(payloadOf(store, other).isDirty, false, 'het andere document is opgeslagen');
      if (manual === 'een tabblad sluiten') assert(!store.getState().documents.some(d => d.id === other), 'het tabblad is dicht');
      reopen?.();
      if (manual === 'Ctrl+S, zelfde document') return;
      // De ronde komt terug: niet meteen, wel na de volgende rustperiode.
      store.getState().switchDocument(model);
      await auto.controller.flushModels();
      assert.equal(sw.requests().length, manual === 'Ctrl+S, ander document' ? 2 : 1, 'niet meteen opnieuw');
      auto.clock.rest();
      const again = auto.controller.flushModels();
      await mergeArrives(sw, manual === 'Ctrl+S, ander document' ? 3 : 2); await finishMerge(sw);
      await again;
      assert.deepEqual(mergeProblems(bytes, fileOf(name)), [], 'na de rust schrijft de ronde alsnog');
      assert.equal(store.getState().isDirty, false);
      if (otherName) assert.equal(hash(fileOf(otherName)) !== hash(plainBytes()), true);
    } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
  });
}

await check('stap 8, voorrang: tijdens het plaatsen breekt niets af; Ctrl+S wacht tot de ronde klaar is', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const ipc = desktop(appData), sw = saveWorker();
  try {
    const own = join(dir, 'autosave-plaatsen.ifc'); writeFileSync(own, bytes);
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute);
    const order: string[] = [];
    let manual: Promise<boolean> | undefined;
    // De eerste herstelronde in de vervanging: het herstelrecord en het manifest liggen vast. Dan meldt Ctrl+S zich.
    const unregister = recoveryRounds(store, () => {
      if (manual || replaceRecordsIn(appData).length === 0) return;
      store.getState().addTask({ name: 'Na de momentopname' });
      manual = ctrlS(store).then(saved => { order.push('Ctrl+S'); return saved; });
    });
    try {
      longer(store); clearNotices(store);
      const expected = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
      await modelAutoSave(store, sw.compute).round().then(() => order.push('ronde'));
      assert(manual, 'Ctrl+S meldde zich tijdens het plaatsen');
      assert.equal(await manual, true);
      assert.deepEqual(order, ['ronde', 'Ctrl+S'], 'de ronde liep af, Ctrl+S wachtte');
      assert.equal(sw.merges(), 2, 'de ronde en Ctrl+S rekenden elk één keer');
      assert.notEqual(hash(new Uint8Array(readFileSync(own))), expected.sha256, 'Ctrl+S schreef daarna het latere werk');
      assert(readFileSync(own, 'latin1').includes('Na de momentopname'));
      assert.deepEqual(mergeProblems(bytes, new Uint8Array(readFileSync(own))), []);
      assert.equal(store.getState().isDirty, false);
      assert.deepEqual(replaceRecordsIn(appData), []);
      assert.deepEqual(autoErrors(store), []);
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

await check('stap 8, ritme per document: een gewoon document ernaast schrijft meteen, het gebouwmodel pas na 30 s rust', async () => {
  const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    const model = store.getState().activeDocumentId;
    longer(store);
    store.getState().setAutoSaveToFile(true);
    const plainName = `gewoon-${++handleCount}.ifc`;
    handleFiles.set(plainName, plainBytes());
    await store.getState().openOpenedFile({ name: plainName, content: plainText(plainBytes()),
      ref: { kind: 'handle', handle: new FakeHandle(plainName) as unknown as FileSystemFileHandle } });
    const plain = store.getState().activeDocumentId;
    assert.notEqual(plain, model);
    longer(store);
    clearNotices(store);
    const auto = modelAutoSave(store, sw.compute);
    auto.controller.observe();
    await auto.controller.flush();
    await auto.controller.flushModels();
    assert.equal(payloadOf(store, plain).isDirty, false, 'het gewone document: meteen, op zijn eigen 10 s-ritme van useAutoSave');
    assert.equal(hash(fileOf(name)), hash(bytes), 'het gebouwmodel wacht op zijn rust');
    assert.equal(auto.controller.nextModelRoundAt(), auto.clock.now() + 30_000, 'de wekker staat op 30 s');
    auto.clock.advance(29_000);
    await auto.controller.flushModels();
    assert.equal(hash(fileOf(name)), hash(bytes), 'na 29 s nog niet');
    auto.clock.advance(1_000);
    await auto.controller.flushModels();
    assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
    assert.notEqual(hash(fileOf(name)), hash(bytes), 'na 30 s rust wel');
    assert.equal(payloadOf(store, model).isDirty, false);
    assert.equal(auto.controller.nextModelRoundAt(), null, 'niets meer gepland');
    assert.deepEqual(autoErrors(store), []);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

// Waar Ctrl+S een vraag zou stellen, slaat de ronde het document over: geen vraag, geen venster, geen melding. (Een
// schemavraag ontstaat bij een gebouwmodel niet: `ifcSchemaQuestionFor` houdt de kop van de bron.)
// Afhankelijke projecten: zie de proeven van fixronde 1 hieronder (alleen een te krap anker sluit de ronde uit).
for (const question of ['schrijftoestemming voor de handle'] as const) {
  await check(`stap 8: ${question}; de ronde slaat het document over zonder vraag`, async () => {
    const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
    const browser = browserDownload();
    try {
      longer(store); clearNotices(store); writableLog.length = 0;
      handleFaults.set(name, { permission: 'denied' });
      await modelAutoSave(store, sw.compute).round();
      assert.deepEqual(writableLog, [], 'niets geschreven');
      assert.equal(sw.merges(), 0, 'niet gerekend');
      assert.equal(browser.downloads.length, 0, 'geen download');
      assert.equal(hash(fileOf(name)), hash(bytes));
      assert.equal(store.getState().isDirty, true);
      assert.deepEqual(autoErrors(store), [], 'geen melding');
    } finally {
      handleFaults.delete(name); unregister(); browser.dispose(); sw.client.dispose(); await clearRecovery();
    }
  });
}

// ── Fixronde 1 van de review van #1033 ───────────────────────────────────────────────────────────────────────────────
/** Een poort die een stap vasthoudt tot de proef hem vrijgeeft. */
function gate() {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  return { held, release };
}

// Punt 1: een IFC-export vraagt de opslagworker vóór hij de schrijfrij bereikt. Hij gaat toch voor: de ronde wijkt
// meteen, de export rekent in een nieuwe worker en slaagt, en de ronde schrijft niets.
for (const exporter of ['Exporteren → IFC', 'Exporteren met bibliotheek'] as const) {
  await check(`stap 8, voorrang: ${exporter} tijdens het rekenen van de ronde; de export rekent meteen en slaagt, de ronde schrijft niets`, async () => {
    const sw = saveWorker('manual'), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
    const browser = browserDownload();
    try {
      longer(store); clearNotices(store); writableLog.length = 0;
      asked.length = 0; answer(true);
      const auto = modelAutoSave(store, sw.compute);
      const round = auto.round();
      await mergeArrives(sw, 1);
      const roundWorker = sw.workers[0]!;
      roundWorker.start();
      const action = exporter === 'Exporteren → IFC' ? store.getState().exportAs('ifc') : store.getState().exportProjectWithPool();
      await turnUntil(() => roundWorker.terminated);
      await round;
      await mergeArrives(sw, 2);
      assert.notEqual(sw.workers.at(-1), roundWorker, 'de export rekent meteen in een nieuwe worker');
      await finishMerge(sw);
      const result = await action;
      assert(result.ok && !result.cancelled, 'de export slaagt');
      assert.equal(browser.downloads.length, 1, 'één download');
      assert.deepEqual(writableLog, [], 'de ronde schreef niets');
      assert.equal(hash(fileOf(name)), hash(bytes), 'het eigen bestand onveranderd');
      assert.equal(store.getState().isDirty, true, 'het document blijft gewijzigd');
      assert.deepEqual(autoErrors(store), [], 'geen melding');
    } finally { resetPlanOnlyAsker(); unregister(); browser.dispose(); sw.client.dispose(); await clearRecovery(); }
  });
}

// Punt 2: een handmatige actie die zich meldt terwijl de ronde het herstel nog vastlegt (desktop: het herstelrecord;
// browser: de komende versie in het herstelmanifest), laat de ronde wijken. Niets geschreven, geen record dat blijft.
await check('stap 8, voorrang: Ctrl+S terwijl de ronde het desktopherstelrecord schrijft; de ronde schrijft niets, Ctrl+S wel', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const ipc = desktop(appData), sw = saveWorker();
  const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (...a: unknown[]) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = internals.invoke, started = gate(), finish = gate();
  try {
    const own = join(dir, 'autosave-voor-record.ifc'); writeFileSync(own, bytes);
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store);
      let held = false;
      internals.invoke = async (...args: unknown[]) => {
        const [command, , options] = args as [string, unknown, { headers?: { path?: string } } | undefined];
        if (!held && command === 'plugin:fs|write_text_file' && decodeURIComponent(options?.headers?.path ?? '').includes('.replace.')) {
          held = true; started.release(); await finish.held;
        }
        return invoke(...args);
      };
      const from = ipc.calls.length;
      const round = modelAutoSave(store, sw.compute).round();
      await started.held;
      const save = ctrlS(store);
      await turnUntil(() => true);
      finish.release();
      await round;
      assert.equal(ipc.calls.slice(from).filter(c => c.command === 'place_file_exclusive').length, 0, 'de ronde plaatste niets');
      assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'het eigen bestand onveranderd');
      assert.deepEqual(replaceRecordsIn(appData), [], 'geen herstelrecord dat blijft');
      assert.equal(await save, true, 'Ctrl+S slaat op');
      assert.deepEqual(mergeProblems(bytes, new Uint8Array(readFileSync(own))), []);
      assert.equal(ipc.calls.slice(from).filter(c => c.command === 'place_file_exclusive').length, 2, 'alleen Ctrl+S plaatste');
      assert.deepEqual(replaceRecordsIn(appData), []);
      assert.equal(store.getState().isDirty, false);
      assert.deepEqual(autoErrors(store), []);
    } finally { unregister(); await clearRecovery(); }
  } finally { finish.release(); internals.invoke = invoke; sw.client.dispose(); ipc.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

await check('stap 8, voorrang: Ctrl+S terwijl de ronde het browserherstelmanifest schrijft; de ronde schrijft niets, Ctrl+S wel', async () => {
  const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute);
  const tracker = new RecoveryDeltaTracker(), started = gate(), finish = gate();
  let held = false;
  const unregister = registerRecoveryFlush(async () => {
    if (!held) { held = true; started.release(); await finish.held; }
    const s = store.getState();
    await runRecoveryTick(tracker, s.activeDocumentId,
      s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
  });
  try {
    longer(store); clearNotices(store); writableLog.length = 0;
    const round = modelAutoSave(store, sw.compute).round();
    await started.held;
    const save = ctrlS(store);
    await turnUntil(() => true);
    finish.release();
    await round;
    assert.deepEqual(writableLog, [], 'de ronde schreef niets');
    assert.equal(hash(fileOf(name)), hash(bytes), 'het eigen bestand onveranderd');
    assert.equal(await save, true, 'Ctrl+S slaat op');
    assert.deepEqual(writableLog, [`create ${name}`, `close ${name} 1`], 'alleen Ctrl+S schreef');
    assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
    assert.equal(await pendingIn(store.getState().activeDocumentId), undefined, 'geen komende versie die blijft');
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(autoErrors(store), []);
  } finally { finish.release(); unregister(); sw.client.dispose(); await clearRecovery(); }
});

// Punt 3: de wekkers van `useAutoSave` (`scheduleFileAutoSave`) met de echte store en controller en een nagebootste
// klok. De wekker van een gebouwmodel start alleen dat document; een gewoon document ernaast houdt zijn 10 s.
await check('stap 8, wekkers: de wekker van het gebouwmodel schrijft geen gewoon document vóór diens eigen 10 s', async () => {
  const { store, name } = await openHandle(bytes, computeIfcOutputHere), unregister = recoveryRounds(store);
  const model = store.getState().activeDocumentId;
  store.getState().setAutoSaveToFile(true);
  const plainName = `gewoon-${++handleCount}.ifc`;
  handleFiles.set(plainName, plainBytes());
  await store.getState().openOpenedFile({ name: plainName, content: plainText(plainBytes()),
    ref: { kind: 'handle', handle: new FakeHandle(plainName) as unknown as FileSystemFileHandle } });
  const plain = store.getState().activeDocumentId;
  store.getState().setAutoSaveToFile(true);
  clearNotices(store);
  const start = 5_000_000;
  let t = start, serial = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: computeIfcOutputHere, now: () => t });
  const schedule = scheduleFileAutoSave(controller, {
    setTimeout: (fn, ms) => { timers.set(++serial, { at: t + ms, fn }); return serial; },
    clearTimeout: id => { timers.delete(id as number); },
    now: () => t,
  });
  const unsub = store.subscribe(schedule.request);
  /** De klok tot `start + ms`, met elke wekker die intussen afgaat (en de ronde die hij start). */
  const until = async (ms: number) => {
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > start + ms) break;
      t = next[1].at; timers.delete(next[0]); next[1].fn();
      await turnUntil(() => !controller.isSaving());
    }
    t = start + ms;
  };
  const dirty = (id: string) => payloadOf(store, id).isDirty;
  try {
    longer(store);
    await until(0);
    assert.equal(dirty(plain), false, 'de eerste gewone ronde meteen');
    await until(2_000);
    store.getState().switchDocument(model); longer(store); store.getState().switchDocument(plain);
    await until(29_000);
    longer(store);
    await until(29_000);
    assert.equal(dirty(plain), false, 'op 29 s: 10 s na de vorige gewone ronde');
    await until(31_000);
    longer(store);
    const plainFile = hash(fileOf(plainName));
    await until(32_000);
    assert.equal(dirty(model), false, 'op 32 s: het gebouwmodel na 30 s rust');
    assert.notEqual(hash(fileOf(name)), hash(bytes));
    assert.equal(dirty(plain), true, 'op 32 s: het gewone document wacht op zijn eigen 10 s');
    assert.equal(hash(fileOf(plainName)), plainFile, 'het gewone bestand nog niet geschreven');
    await until(39_000);
    assert.equal(dirty(plain), false, 'op 39 s: de gewone ronde');
    assert.deepEqual(autoErrors(store), []);
    // Knownbug 1925: een gewijzigd gebouwmodel met Automatisch opslaan uit houdt de wekker niet wakker.
    store.getState().switchDocument(model); longer(store); store.getState().setAutoSaveToFile(false);
    await until(45_000);
    assert.equal(controller.nextModelRoundAt(), null, 'geen wekker voor een document dat niet meedoet');
    const modelFile = hash(fileOf(name));
    await until(400_000);
    assert.equal(hash(fileOf(name)), modelFile, 'en geen ronde');
    assert.equal(dirty(model), true);
  } finally { unsub(); schedule.dispose(); unregister(); await clearRecovery(); }
});

// Punt 5: een gevonden afhankelijke planning sluit de ronde alleen uit waar Ctrl+S zou vragen: bij een te krap anker.
for (const anchor of ['ruim', 'te krap'] as const) {
  await check(`stap 8, afhankelijke projecten met een ${anchor} anker: ${anchor === 'ruim' ? 'de ronde schrijft, zonder vraag' : 'de ronde slaat het document over zonder vraag; Ctrl+S vraagt'}`, async () => {
    const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
    const { setDependentAnchorAsker, resetDependentAnchorAsker } = await import('@/state/dependentAnchorQuestion');
    let questions = 0;
    setDependentAnchorAsker(async () => { questions++; return true; });
    try {
      const task = longer(store); clearNotices(store);
      store.setState(s => { s.ui.dependentProjects = [{ documentId: s.activeDocumentId, projectId: s.project.id,
        links: [{ projectId: 'afnemer', projectName: 'Afhankelijk', taskId: 'taak', taskName: 'Taak', ownTaskId: task,
          linkId: 'koppeling', direction: 'predecessor', relType: 'FS', anchorDate: anchor === 'ruim' ? '2099-01-01' : '1900-01-01' }] }]; });
      await modelAutoSave(store, sw.compute).round();
      assert.equal(questions, 0, 'de ronde vraagt niets');
      if (anchor === 'ruim') {
        assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
        assert.notEqual(hash(fileOf(name)), hash(bytes), 'geschreven');
        assert.equal(store.getState().isDirty, false);
      } else {
        assert.equal(sw.merges(), 0, 'niet gerekend');
        assert.equal(hash(fileOf(name)), hash(bytes), 'niets geschreven');
        assert.equal(store.getState().isDirty, true);
        assert.equal(await ctrlS(store), true);
        assert.equal(questions, 1, 'Ctrl+S vraagt');
      }
      assert.deepEqual(autoErrors(store), []);
    } finally { resetDependentAnchorAsker(); unregister(); sw.client.dispose(); await clearRecovery(); }
  });
}

// ── Fixronde 2 van de review van #1033 ───────────────────────────────────────────────────────────────────────────────
/** Een paar beurten van de gebeurtenislus: genoeg om een gestarte ronde haar volgende stap te laten zetten. */
const someTurns = async () => { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)); };
/** De wekkers van `useAutoSave` (`scheduleFileAutoSave`) met de echte controller en een nagebootste klok, vanaf `start`. */
function fakeSchedule(store: Store, compute: IfcOutputCompute) {
  const start = 5_000_000;
  let t = start, serial = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute, now: () => t });
  const schedule = scheduleFileAutoSave(controller, {
    setTimeout: (fn, ms) => { timers.set(++serial, { at: t + ms, fn }); return serial; },
    clearTimeout: id => { timers.delete(id as number); },
    now: () => t,
  });
  const unsub = store.subscribe(schedule.request);
  return {
    controller, schedule,
    /** De klok tot `start + ms`; elke wekker die intussen afgaat, start zijn ronde (die hier niet wordt afgewacht). */
    until: async (ms: number) => {
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > start + ms) break;
        t = next[1].at; timers.delete(next[0]); next[1].fn();
        await someTurns();
      }
      t = start + ms;
    },
    dispose: () => { unsub(); schedule.dispose(); },
  };
}

// Deel A: een IFC-export houdt voorrang over de hele volgorde: de bronkeuze, de planvraag en het schrijven. Een ronde die
// aan de beurt komt terwijl de vraag "alleen de planning" open staat, wijkt; een ronde die al plaatst, maakt dat af
// vóór de export zijn bron kiest. De export levert precies één bestand.
for (const exporter of ['IFC zonder gebouwmodel', 'Exporteren met bibliotheek'] as const) {
  for (const moment of ['de ronde rekent al', 'de ronde komt aan de beurt terwijl de vraag open staat'] as const) {
    await check(`stap 8, export (${exporter}): ${moment}; de ronde wijkt, de export levert één bestand`, async () => {
      const sw = saveWorker('manual'), { store, name } = await openHandle(bytes, sw.compute);
      const unregister = recoveryRounds(store), browser = browserDownload();
      const entered = gate(), accept = gate();
      setPlanOnlyAsker(async () => { entered.release(); await accept.held; return true; });
      try {
        longer(store); clearNotices(store); writableLog.length = 0;
        const auto = modelAutoSave(store, sw.compute);
        let roundDone = false;
        let round: Promise<void> | undefined;
        const startRound = () => { round = auto.round().then(() => { roundDone = true; }); };
        if (moment === 'de ronde rekent al') { startRound(); await mergeArrives(sw, 1); sw.workers[0]!.start(); }
        const action = exporter === 'Exporteren met bibliotheek' ? store.getState().exportProjectWithPool()
          : store.getState().exportAs('ifc', withoutModel);
        await entered.held;
        if (moment !== 'de ronde rekent al') startRound();
        await turnUntil(() => roundDone, 'de ronde wijkt terwijl de vraag open staat');
        await round;
        assert.deepEqual(writableLog, [], 'de ronde schreef niets');
        assert.equal(hash(fileOf(name)), hash(bytes), 'het eigen bestand onveranderd');
        assert.equal(store.getState().isDirty, true, 'het document blijft gewijzigd');
        accept.release();
        await mergeArrives(sw, moment === 'de ronde rekent al' ? 2 : 1);
        await finishMerge(sw);
        const result = await action;
        assert(result.ok && !result.cancelled, 'de export slaagt');
        assert.equal(browser.downloads.length, 1, 'één bestand');
        assert.deepEqual(autoErrors(store), [], 'geen melding');
      } finally { accept.release(); resetPlanOnlyAsker(); unregister(); browser.dispose(); sw.client.dispose(); await clearRecovery(); }
    });
  }
}

// Fixronde 3 van de review van #1033: de export legt bij de aanroep vast voor welk document hij is. Wisselt de planner van
// tabblad terwijl de export op de plaatsing wacht, dan exporteert hij nooit het andere document: hij weigert met de
// bestaande melding, vóór de bestandskiezer.
for (const exporter of ['Exporteren → IFC', 'IFC zonder gebouwmodel', 'Exporteren met bibliotheek'] as const) for (const moment of ['zelfde tabblad', 'tabbladwissel vóór het einde van de plaatsing'] as const) {
  await check(`stap 8, export (${exporter}) terwijl de ronde haar tijdelijke bestand al schreef, ${moment}: ${moment === 'zelfde tabblad' ? 'de ronde plaatst, daarna levert de export één bestand' : 'de export weigert, nooit het andere document'}`, async () => {
    const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
    const ipc = desktop(appData), sw = saveWorker('manual');
    const own = join(dir, `autosave-export-plaatsen-${++handleCount}.ifc`), dest = join(dir, `autosave-export-uit-${handleCount}.ifc`);
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (...a: unknown[]) => Promise<unknown> } }).__TAURI_INTERNALS__;
    const invoke = internals.invoke, tempWritten = gate(), releaseTemp = gate();
    let unregister: (() => void) | undefined;
    try {
      writeFileSync(own, bytes); ipc.choose(dest);
      const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute);
      unregister = recoveryRounds(store);
      const original = store.getState().activeDocumentId;
      const other = moment === 'zelfde tabblad' ? null : otherDocument(store);
      store.getState().switchDocument(original);
      // Zoals in de proef van de reviewer: het eigen document heeft een gekoppelde bibliotheek, het andere niet.
      if (other && exporter === 'Exporteren met bibliotheek') {
        const companyId = store.getState().seedDemoLibrary();
        store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
      }
      longer(store); clearNotices(store);
      asked.length = 0; answer(true);
      let held = false;
      internals.invoke = async (...args: unknown[]) => {
        const [command, , options] = args as [string, unknown, { headers?: { path?: string } } | undefined];
        if (!held && command === 'plugin:fs|write_file' && decodeURIComponent(options?.headers?.path ?? '').endsWith('.ops-save.tmp')) {
          const result = await invoke(...args);
          held = true; tempWritten.release(); await releaseTemp.held;
          return result;
        }
        return invoke(...args);
      };
      const round = modelAutoSave(store, sw.compute).round();
      await mergeArrives(sw, 1);
      await finishMerge(sw);
      await tempWritten.held;
      const action = exporter === 'Exporteren met bibliotheek' ? store.getState().exportProjectWithPool()
        : store.getState().exportAs('ifc', exporter === 'IFC zonder gebouwmodel' ? withoutModel : undefined);
      await someTurns();
      assert.equal(ipc.picks(), 0, 'de export wacht op de plaatsing');
      if (other) store.getState().switchDocument(other.id);
      releaseTemp.release();
      await round;
      assert.notEqual(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'de ronde maakte haar plaatsing af');
      assert.equal(payloadOf(store, original).isDirty, false);
      if (other) {
        let settled = false;
        void action.then(() => { settled = true; });
        await turnUntil(() => settled, 'de export rondt af zonder te rekenen');
        const refused = await action;
        assert(refused.ok && refused.cancelled, 'de export weigert');
        assert.equal(ipc.picks(), 0, 'geen bestandskiezer');
        assert.equal(existsSync(dest), false, 'geen bestand');
        assert.equal(sw.requests().length, 1, 'de export rekende niet');
        assertNotice(store, 'notifications.ifcExportChangedWhileWaiting');
        assert.equal(store.getState().activeDocumentId, other.id, 'het andere tabblad blijft actief');
        return;
      }
      assert.equal(store.getState().isDirty, false);
      await mergeArrives(sw, 2);
      await finishMerge(sw);
      const result = await action;
      assert(result.ok && !result.cancelled, 'de export slaagt');
      assert.equal(ipc.picks(), 1, 'één bestandskiezer');
      assert.equal(existsSync(dest), true, 'één bestand');
      assert.deepEqual(autoErrors(store), [], 'geen melding');
    } finally {
      resetPlanOnlyAsker(); releaseTemp.release(); internals.invoke = invoke; unregister?.(); sw.client.dispose(); ipc.dispose();
      await clearRecovery(); rmSync(appData, { recursive: true, force: true });
    }
  });
}

// Deel B: één wekker voor modellen, de gewone ronde van 10 s zonder modelkandidaten, en het ritme getoetst bij de beurt.
await check('stap 8, fixronde 2: de gewone ingang (10 s) start nooit een gebouwmodel; alleen de wekker van het model', async () => {
  const sw = saveWorker(), { store, name } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  try {
    longer(store); clearNotices(store);
    const auto = modelAutoSave(store, sw.compute);
    auto.controller.observe(); auto.clock.rest();
    await auto.controller.flush();
    assert.equal(sw.requests().length, 0, 'de gewone ingang rekent het gebouwmodel niet');
    assert.equal(hash(fileOf(name)), hash(bytes));
    await auto.controller.flushModels();
    assert.notEqual(hash(fileOf(name)), hash(bytes), 'de wekker van het model wel');
    assert.equal(sw.requests().length, 1);
  } finally { unregister(); sw.client.dispose(); await clearRecovery(); }
});

/** Een gebouwmodel en een gewoon document, allebei met Automatisch opslaan aan; het gewone document is actief. */
async function modelAndPlain(compute: IfcOutputCompute) {
  const { store, name } = await openHandle(bytes, compute), unregister = recoveryRounds(store);
  const model = store.getState().activeDocumentId;
  store.getState().setAutoSaveToFile(true);
  const plainName = `gewoon-${++handleCount}.ifc`;
  handleFiles.set(plainName, plainBytes());
  await store.getState().openOpenedFile({ name: plainName, content: plainText(plainBytes()),
    ref: { kind: 'handle', handle: new FakeHandle(plainName) as unknown as FileSystemFileHandle } });
  const plain = store.getState().activeDocumentId;
  store.getState().setAutoSaveToFile(true);
  clearNotices(store);
  return { store, name, model, plain, plainName, unregister };
}

// Fixronde 3 van de review van #1033 (knownbug 1930, besluit technisch beslisser): een gewone tik breekt een modelronde
// niet meer af. Hij wacht in de rij en schrijft direct na de modelronde; de modelronde krijgt zo haar beurt, ook als de
// planner in een gewoon document doorwerkt. Vervangt de proef van fixronde 2 "schrijft op zijn eigen tik van 40 s".
for (const computeMs of [8_500, 15_000, 25_000]) {
  await check(`stap 8, fixronde 3: doorwerken in een gewoon document laat een modelronde van ${computeMs / 1000} s niet wijken; de gewone tik wacht en schrijft direct daarna`, async () => {
    const sw = saveWorker('manual');
    const compute: IfcOutputCompute = (job, stop) => job.kind === 'merge' ? sw.compute(job, stop) : computeIfcOutputHere(job);
    const { store, name, model, plain, plainName, unregister } = await modelAndPlain(compute);
    const timed = fakeSchedule(store, compute);
    const dirty = (id: string) => payloadOf(store, id).isDirty;
    try {
      await timed.until(2_000);
      store.getState().switchDocument(model); longer(store); store.getState().switchDocument(plain);
      // Een wekker die een wijziging zet, gaat af bij de volgende `until`; daarom na elke wijziging `until` op hetzelfde moment.
      await timed.until(22_000); longer(store); await timed.until(22_000);
      await turnUntil(() => !dirty(plain), 'gewone tik op 22 s');
      await timed.until(32_000);
      await mergeArrives(sw, 1);
      const modelWorker = sw.workers[0]!;
      modelWorker.start();
      // De planner werkt door in het gewone document: elke 3 s een wijziging, terwijl het model rekent.
      let ticksDuringRound = 0, plainFile = hash(fileOf(plainName));
      for (let at = 33_000; at < 32_000 + computeMs; at += 3_000) {
        await timed.until(at); longer(store); await timed.until(at);
        await someTurns();
        assert.equal(modelWorker.terminated, false, `de gewone tik breekt de modelronde niet af (${at / 1000} s)`);
        assert.equal(hash(fileOf(plainName)), plainFile, `het gewone bestand wacht op de modelronde (${at / 1000} s)`);
        if (timed.controller.isSaving()) ticksDuringRound++;
      }
      // Bij een ronde langer dan de 10 s van de gewone tik valt er een tik in de ronde; die wacht in de rij.
      if (computeMs > 10_000) assert(ticksDuringRound > 0, 'een gewone tik viel in de modelronde');
      await timed.until(32_000 + computeMs);
      await modelWorker.answer(modelWorker.requests.length - 1);
      await turnUntil(() => !dirty(model), 'de modelronde schrijft');
      if (computeMs > 10_000) await turnUntil(() => !dirty(plain), 'direct daarna de wachtende gewone tik');
      assert.equal(sw.requests().length, 1, 'één modelronde, niet afgebroken');
      assert.deepEqual(mergeProblems(bytes, fileOf(name)), [], 'het gebouwmodel byte voor byte');
      // Daarna weer het gewone ritme van 10 s.
      plainFile = hash(fileOf(plainName));
      const after = 32_000 + computeMs + 1_000;
      await timed.until(after); longer(store); await timed.until(after + 10_000);
      await turnUntil(() => !dirty(plain), 'daarna weer de gewone tik van 10 s');
      assert.notEqual(hash(fileOf(plainName)), plainFile);
      assert.deepEqual(autoErrors(store), []);
    } finally { timed.dispose(); unregister(); sw.client.dispose(); await clearRecovery(); }
  });
}

// Fixronde 4 van de review van #1033 (bevinding 1): een gewone tik die achter een modelronde wacht, toetst bij zijn beurt
// of zijn document nog meedoet. Zette de planner Automatisch opslaan intussen uit en kwam er een andere versie op het
// bestand, dan schrijft de tik niets: die versie blijft byte voor byte staan, zoals op main en met de flag uit.
for (const flag of ['aan', 'uit'] as const) {
  await check(`stap 8, fixronde 4: een wachtende gewone tik schrijft niet meer nadat Automatisch opslaan uit ging (flag ${flag})`, async () => {
    const sw = saveWorker('manual');
    const compute: IfcOutputCompute = (job, stop) => job.kind === 'merge' ? sw.compute(job, stop) : computeIfcOutputHere(job);
    const { store, model, plain, plainName, unregister } = await modelAndPlain(compute);
    if (flag === 'uit') store.setState(s => { s.ui.featureFlags = { ...s.ui.featureFlags, ifcForeignContent: false }; });
    const timed = fakeSchedule(store, compute);
    const dirty = (id: string) => payloadOf(store, id).isDirty;
    try {
      await timed.until(2_000);
      store.getState().switchDocument(model); longer(store); store.getState().switchDocument(plain);
      // Een wekker die een wijziging zet, gaat af bij de volgende `until`; daarom na elke wijziging `until` op hetzelfde moment.
      await timed.until(22_000); longer(store); await timed.until(22_000);
      await turnUntil(() => !dirty(plain), 'gewone tik op 22 s');
      await timed.until(32_000);
      if (flag === 'aan') { await mergeArrives(sw, 1); sw.workers[0]!.start(); }
      await timed.until(35_000);
      const edited = longer(store);
      await timed.until(35_000);
      await timed.until(42_000);
      await someTurns();
      if (flag === 'uit') await turnUntil(() => !dirty(plain), 'flag uit: de tik van 42 s schrijft meteen, zoals main');
      else {
        assert.equal(timed.controller.isSaving(), true, 'de gewone tik wacht achter de modelronde');
        assert.equal(dirty(plain), true);
      }
      // De planner zet Automatisch opslaan voor het gewone document uit; een ander programma zet een eigen versie neer.
      await timed.until(43_000);
      store.getState().setAutoSaveToFile(false);
      const input = buildWriteIFCInput(store.getState(), 'merge');
      const external = new TextEncoder().encode(writeIFC({ ...input, tasks: input.tasks.map(task =>
        task.id === edited ? { ...task, name: 'Extern toegevoegde taaknaam' } : task) }));
      handleFiles.set(plainName, external);
      const writesBefore = writableLog.filter(entry => entry.startsWith(`close ${plainName} `)).length;
      await timed.until(45_000);
      if (flag === 'aan') {
        await sw.workers[0]!.answer(sw.workers[0]!.requests.length - 1);
        await turnUntil(() => !dirty(model), 'de modelronde schrijft');
      }
      await turnUntil(() => !isProjectFileWriteBusy() && !timed.controller.isSaving(), 'de rij is leeg');
      assert.equal(writableLog.filter(entry => entry.startsWith(`close ${plainName} `)).length, writesBefore,
        'na het uitzetten schrijft de gewone tik niets');
      assert.equal(hash(fileOf(plainName)), hash(external), 'de andere versie blijft byte voor byte staan');
      assert((await reopenOrdinary(fileOf(plainName), true)).tasks.some(task => task.name === 'Extern toegevoegde taaknaam'));
      assert.equal(payloadOf(store, plain).autoSaveToFile, false);
      // Met de flag uit meldt main dat het gebouwmodel niet automatisch opgeslagen wordt; verder geen melding.
      if (flag === 'aan') assert.deepEqual(autoErrors(store), [], 'geen melding');
    } finally { timed.dispose(); unregister(); sw.client.dispose(); await clearRecovery(); }
  });
}

// Fixronde 5 van de review van #1033: de toets bij de beurt wacht nergens op. Een gewone tik vraagt de schrijftoestemming
// zoals main (de controller, vlak vóór de write; geen extra vraag bij de beurt), dus uitzetten tijdens een
// toestemmingsvraag geeft dezelfde uitkomst als op main: de tik schreef al, daarna niets meer, en een andere versie op het
// bestand blijft byte voor byte staan. Naar `probe-round5.ts` van de reviewer.
for (const flag of ['uit', 'aan'] as const) {
  await check(`stap 8, fixronde 5: een gewone tik vraagt de schrijftoestemming zoals main; uitzetten tijdens die vraag laat een andere versie staan (flag ${flag})`, async () => {
    const events: string[] = [];
    const compute: IfcOutputCompute = job => { events.push('voorbereiding'); return computeIfcOutputHere(job); };
    const { store, name, handle } = await openHandle(plainBytes(), compute);
    if (flag === 'uit') store.setState(s => { s.ui.featureFlags = { ...s.ui.featureFlags, ifcForeignContent: false }; });
    store.getState().setAutoSaveToFile(true);
    const timed = fakeSchedule(store, compute);
    const permission = gate(), query = handle.queryPermission.bind(handle);
    let queries = 0, held = false;
    (handle as unknown as { queryPermission: () => Promise<string> }).queryPermission = async () => {
      queries++;
      events.push(`toestemming ${queries}`);
      // De reviewer hield de tweede vraag vast als die vóór de voorbereiding kwam: dat is de extra vraag bij de beurt.
      if (queries === 2 && !events.includes('voorbereiding')) { held = true; await permission.held; }
      return query();
    };
    const count = () => writableLog.filter(entry => entry.startsWith(`close ${name} `)).length;
    try {
      const taskId = longer(store);
      await timed.until(0);
      await turnUntil(() => held || count() === 1, 'een toestemmingsvraag bij de beurt of een voltooide schrijfbeurt');
      const before = count();
      store.getState().setAutoSaveToFile(false);
      const input = buildWriteIFCInput(store.getState(), 'merge');
      const marker = 'Externe taaknaam tijdens de toestemmingsvraag';
      const external = new TextEncoder().encode(writeIFC({ ...input, tasks: input.tasks.map(task =>
        task.id === taskId ? { ...task, name: marker } : task) }));
      handleFiles.set(name, external);
      permission.release();
      await turnUntil(() => !isProjectFileWriteBusy() && !timed.controller.isSaving(), 'de rij is leeg');
      await timed.until(10_000);
      await someTurns();
      assert.equal(count() - before, 0, 'na het uitzetten niets meer');
      assert.equal(hash(fileOf(name)), hash(external), 'de andere versie byte voor byte');
      assert((await reopenOrdinary(fileOf(name), false)).tasks.some(task => task.name === marker));
      assert.equal(before, 1, 'de tik schreef al vóór het uitzetten, zoals main');
      const second = events.indexOf('toestemming 2');
      assert(second === -1 || second > events.indexOf('voorbereiding'), `geen extra vraag vóór de voorbereiding: ${events.join(' → ')}`);
      assert.deepEqual(autoErrors(store), []);
    } finally { permission.release(); timed.dispose(); await clearRecovery(); }
  });
}

// Fixronde 5 (bevinding 2): is de schrijftoestemming bij de beurt ingetrokken, dan meldt de tik dat zoals main
// (`autoSaveNotWritable`) en blijft het bestand byte voor byte staan; komt de toestemming terug en bewerkt de planner
// opnieuw, dan plaatst de eerstvolgende tik precies één versie.
for (const flag of ['uit', 'aan'] as const) {
  await check(`stap 8, fixronde 5: ingetrokken schrijftoestemming bij de beurt geeft de melding van main; daarna één versie (flag ${flag})`, async () => {
    const compute: IfcOutputCompute = job => computeIfcOutputHere(job);
    const { store, name, handle } = await openHandle(plainBytes(), compute);
    if (flag === 'uit') store.setState(s => { s.ui.featureFlags = { ...s.ui.featureFlags, ifcForeignContent: false }; });
    store.getState().setAutoSaveToFile(true);
    clearNotices(store);
    const timed = fakeSchedule(store, compute);
    const query = handle.queryPermission.bind(handle);
    let queries = 0, denied = true;
    (handle as unknown as { queryPermission: () => Promise<string> }).queryPermission = async () =>
      ++queries >= 2 && denied ? 'prompt' : query();
    const fileCalls = () => writableLog.filter(entry => entry.split(' ')[1] === name);
    try {
      const initial = hash(fileOf(name));
      longer(store);
      await timed.until(0);
      await turnUntil(() => queries >= 2 && !isProjectFileWriteBusy() && !timed.controller.isSaving(), 'de tik met ingetrokken toestemming');
      assert.equal(hash(fileOf(name)), initial, 'het bestand byte voor byte');
      assert.deepEqual(fileCalls(), [], 'niets op het bestand');
      assert.equal(store.getState().isDirty, true);
      assert.deepEqual(autoErrors(store), ['notifications.autoSaveNotWritable'], 'de melding van main');
      denied = false;
      await timed.until(5_000);
      const taskId = longer(store);
      store.getState().updateTask(taskId, { name: 'Gewone tik na herstel van het schrijfrecht' });
      await timed.until(10_000);
      await turnUntil(() => !store.getState().isDirty && !isProjectFileWriteBusy(), 'de volgende tik schrijft');
      assert((await reopenOrdinary(fileOf(name), false)).tasks.some(task => task.name === 'Gewone tik na herstel van het schrijfrecht'));
      assert.deepEqual(fileCalls(), [`create ${name}`, `close ${name} 1`], 'precies één versie');
    } finally { timed.dispose(); await clearRecovery(); }
  });
}

// Fixronde 3 (bevinding 2 van de review): plaatst de modelronde al, dan gaat de verschuldigde gewone tik niet verloren: hij
// wacht in de rij en schrijft zodra de plaatsing klaar is. Met de flag uit (geen modelronde) schrijft hij op 40 s, zoals main.
for (const flag of ['aan', 'uit'] as const) {
  await check(`stap 8, fixronde 3: een gewone tik tijdens de plaatsing van een modelronde gaat niet verloren (flag ${flag})`, async () => {
    const sw = saveWorker('manual');
    const compute: IfcOutputCompute = (job, stop) => job.kind === 'merge' ? sw.compute(job, stop) : computeIfcOutputHere(job);
    const { store, name, model, plain, plainName, unregister } = await modelAndPlain(compute);
    if (flag === 'uit') store.setState(s => { s.ui.featureFlags = { ...s.ui.featureFlags, ifcForeignContent: false }; });
    const timed = fakeSchedule(store, compute);
    const dirty = (id: string) => payloadOf(store, id).isDirty;
    const placing = gate(), releasePlacing = gate();
    handleFaults.set(name, { afterClose: async () => { placing.release(); await releasePlacing.held; } });
    try {
      longer(store);
      await timed.until(0);
      await turnUntil(() => !dirty(plain), 'gewone tik op 0 s');
      await timed.until(2_000);
      store.getState().switchDocument(model); longer(store); store.getState().switchDocument(plain);
      await timed.until(15_000); longer(store);
      await timed.until(20_000);
      await turnUntil(() => !dirty(plain), 'gewone tik op 20 s');
      await timed.until(29_000); longer(store);
      await timed.until(30_000);
      await turnUntil(() => !dirty(plain), 'gewone tik op 30 s');
      await timed.until(31_000); longer(store);
      const plainFile = hash(fileOf(plainName));
      clearNotices(store);
      await timed.until(32_000);
      if (flag === 'aan') {
        await mergeArrives(sw, 1);
        await finishMerge(sw);
        await placing.held;
      }
      await timed.until(39_000);
      assert.equal(hash(fileOf(plainName)), plainFile, 'vóór de tik van 40 s niets');
      await timed.until(40_000);
      if (flag === 'uit') {
        await turnUntil(() => !dirty(plain), 'flag uit: op 40 s, zoals main');
        assert.equal(sw.requests().length, 0, 'flag uit: geen modelronde');
        return;
      }
      await someTurns();
      assert.equal(dirty(plain), true, 'de gewone tik wacht op de plaatsing');
      await timed.until(42_000);
      releasePlacing.release();
      await turnUntil(() => !dirty(model), 'de modelronde plaatst');
      await turnUntil(() => !dirty(plain), 'direct daarna de gewone tik, zonder de volgende tik van 50 s');
      assert.notEqual(hash(fileOf(plainName)), plainFile);
      assert.deepEqual(mergeProblems(bytes, fileOf(name)), []);
      assert.deepEqual(autoErrors(store), []);
    } finally { releasePlacing.release(); handleFaults.delete(name); timed.dispose(); unregister(); sw.client.dispose(); await clearRecovery(); }
  });
}

await check('stap 8, fixronde 2: het ritme geldt bij de beurt; een al gekozen model begint niet als er intussen getypt is', async () => {
  const sw = saveWorker('manual'), { store, name: firstName } = await openHandle(bytes, sw.compute), unregister = recoveryRounds(store);
  const first = store.getState().activeDocumentId;
  store.getState().setAutoSaveToFile(true);
  const secondName = `tweede-model-${++handleCount}.ifc`;
  handleFiles.set(secondName, bytes);
  await store.getState().openOpenedFile({ name: secondName, content: '', bytes,
    ref: { kind: 'handle', handle: new FakeHandle(secondName) as unknown as FileSystemFileHandle } });
  const second = store.getState().activeDocumentId;
  assert.notEqual(second, first);
  store.getState().setAutoSaveToFile(true);
  clearNotices(store);
  const timed = fakeSchedule(store, sw.compute);
  try {
    store.getState().switchDocument(first); longer(store);
    store.getState().switchDocument(second); longer(store);
    await timed.until(0);
    await timed.until(30_000);
    await mergeArrives(sw, 1);
    sw.workers[0]!.start();
    // Typen in een cel van het tweede model (het actieve), zonder vastleggen.
    await timed.until(40_000);
    timed.schedule.textEntry();
    await timed.until(48_000);
    timed.schedule.textEntry();
    await timed.until(49_000);
    await finishMerge(sw);
    await turnUntil(() => !payloadOf(store, first).isDirty);
    await someTurns();
    assert.equal(sw.merges(), 1, 'het tweede model begint niet: het is na het typen niet aan de beurt');
    assert.equal(hash(fileOf(secondName)), hash(bytes));
    await timed.until(77_000);
    assert.equal(sw.merges(), 1, 'ook niet vóór 30 s rust na het laatste typen');
    await timed.until(78_000);
    await mergeArrives(sw, 2);
    await finishMerge(sw);
    await turnUntil(() => !payloadOf(store, second).isDirty);
    assert.notEqual(hash(fileOf(firstName)), hash(bytes));
    assert.notEqual(hash(fileOf(secondName)), hash(bytes), 'op 78 s het tweede model');
    assert.deepEqual(autoErrors(store), []);
  } finally { timed.dispose(); unregister(); sw.client.dispose(); await clearRecovery(); }
});

// ── #804, knownbug 1762: Ctrl+S en Opslaan als buiten de thuismap. Vanaf de productie-ingang, met de scope als toestand
// (`nodeFileIpc.ts`): de map ligt buiten de capability, de bestandskiezer gaf het bestand vrij, en de planner geeft de
// map eenmalig vrij met de nagebootste mapkiezer. De vraag in de app staat vóór de merge, binnen dezelfde opslagbeurt. ──
type DesktopIpc = ReturnType<typeof desktop>;
/** `folder` ligt buiten de thuismap; `chosen` gaf een bestandskiezer vrij (het geopende bestand). */
function outsideHomeScope(ipc: DesktopIpc, folder: string, ...chosen: string[]) {
  const real = realpathSync(folder);
  ipc.scope.outside = path => path === real || path.startsWith(`${real}/`);
  for (const file of chosen) ipc.scope.allowFile(file);
}
/** De vraag in de app: onthoudt de map en antwoordt met `answer`, dat tijdens de vraag iets mag doen. */
function folderQuestion(answer: (folder: string) => boolean | Promise<boolean>) {
  const asked: string[] = [];
  setFolderAccessAsker(async folder => { asked.push(folder); return answer(folder); });
  return asked;
}
const folderPicks = (ipc: DesktopIpc, from: number) => ipc.calls.slice(from).filter(c => c.command === 'plugin:dialog|open').map(c => c.dialog);
const FOLDER_PICK = (folder: string) => ({ directory: true, multiple: false, recursive: false, defaultPath: folder });

await check('knownbug 1762, Ctrl+S buiten de thuismap: één vraag en één mapkiezer vóór de merge; opgeslagen zonder hulpbestand; daarna en na een herstart geen vraag meer', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const folder = mkdtempSync(join(dir, 'buiten-'));
  const ipc = desktop(appData), sw = saveWorker();
  let mergesAtQuestion = -1;
  const asked = folderQuestion(() => { mergesAtQuestion = sw.merges(); return true; });
  try {
    const own = join(folder, 'model.ifc'); writeFileSync(own, bytes);
    outsideHomeScope(ipc, folder, own);
    ipc.dialog.pickFolder = () => folder;
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store);
      const from = ipc.calls.length;
      assert.equal(await ctrlS(store), true, 'opgeslagen');
      assert.deepEqual(asked, [folder], 'één vraag, met de map van het bestand');
      assert.equal(mergesAtQuestion, 0, 'de vraag kwam vóór de merge');
      assert.deepEqual(folderPicks(ipc, from), [FOLDER_PICK(folder)], 'één mapkiezer, niet-recursief, op die map');
      const output = new Uint8Array(readFileSync(own));
      assert.deepEqual(mergeProblems(bytes, output), [], 'het gebouwmodel bytegelijk');
      assert.equal(store.getState().ifcSource!.sha256, hash(output), 'de geschreven versie is de bron');
      assert.deepEqual(readdirSync(folder), ['model.ifc'], 'geen hulpbestand');
      assert.deepEqual(replaceRecordsIn(appData), [], 'geen herstelrecord');
      assert.deepEqual(autoErrors(store), []);
      assert.equal(store.getState().isDirty, false);
      longer(store);
      const second = ipc.calls.length;
      assert.equal(await ctrlS(store), true, 'een tweede Ctrl+S');
      assert.deepEqual([asked.length, folderPicks(ipc, second)], [1, []], 'vraagt niets meer');
      assert.notEqual(hash(new Uint8Array(readFileSync(own))), hash(output), 'en vervangt weer');
    } finally { unregister(); await clearRecovery(); }
    // Een herstart: `persisted-scope` zet de vrijgegeven map terug (hier: dezelfde scope), het bestand opent opnieuw.
    const reopened = new Uint8Array(readFileSync(own));
    const again = await openAt({ kind: 'path', path: own }, reopened, sw.compute), unregisterAgain = recoveryRounds(again);
    try {
      longer(again); clearNotices(again);
      const from = ipc.calls.length;
      assert.equal(await ctrlS(again), true, 'na een herstart opgeslagen');
      assert.deepEqual([asked.length, folderPicks(ipc, from)], [1, []], 'na een herstart geen vraag en geen mapkiezer');
      assert.deepEqual(readdirSync(folder), ['model.ifc']);
    } finally { unregisterAgain(); await clearRecovery(); }
  } finally { resetFolderAccessAsker(); ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

for (const refusal of ['annuleren in de vraag', 'annuleren in de mapkiezer', 'een andere map gekozen'] as const) {
  await check(`knownbug 1762, Ctrl+S buiten de thuismap, ${refusal}: het doel bytegelijk, geen hulpbestand en geen record, geen merge, één melding`, async () => {
    const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
    const folder = mkdtempSync(join(dir, 'buiten-'));
    const ipc = desktop(appData), sw = saveWorker();
    const asked = folderQuestion(() => refusal !== 'annuleren in de vraag');
    try {
      const own = join(folder, 'model.ifc'); writeFileSync(own, bytes);
      outsideHomeScope(ipc, folder, own);
      ipc.dialog.pickFolder = refusal === 'een andere map gekozen' ? () => dir : () => null;
      const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
      try {
        longer(store); clearNotices(store);
        const from = ipc.calls.length;
        assert.equal(await ctrlS(store), false, 'niet opgeslagen');
        assert.deepEqual(asked, [folder]);
        assert.equal(folderPicks(ipc, from).length, refusal === 'annuleren in de vraag' ? 0 : 1);
        assert.equal(sw.merges(), 0, 'geen merge');
        assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'het doel bytegelijk');
        assert.deepEqual(readdirSync(folder), ['model.ifc'], 'geen hulpbestand');
        assert.deepEqual(ipc.calls.slice(from).filter(c => c.wrote && c.path?.startsWith(folder)), [], 'nul schrijfacties in de map');
        assert.deepEqual(replaceRecordsIn(appData), [], 'geen herstelrecord');
        assertNotice(store, 'notifications.ifcForeignFolderAccessMissing');
        assert.deepEqual(store.getState().ui.notifications.find(n => n.messageKey === 'notifications.ifcForeignFolderAccessMissing')?.params,
          { folder }, 'de melding noemt de map');
        assert.equal(store.getState().isDirty, true, 'het document blijft gewijzigd');
      } finally { unregister(); await clearRecovery(); }
    } finally { resetFolderAccessAsker(); ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
  });
}

await check('knownbug 1762, Ctrl+S: tijdens de vraag bewerkt de planner het document en wisselt hij van tabblad; het bestand krijgt de stand van Ctrl+S, het andere tabblad blijft ongemoeid', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const folder = mkdtempSync(join(dir, 'buiten-'));
  const ipc = desktop(appData), sw = saveWorker();
  try {
    const own = join(folder, 'model.ifc'); writeFileSync(own, bytes);
    outsideHomeScope(ipc, folder, own);
    ipc.dialog.pickFolder = () => folder;
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    const model = store.getState().activeDocumentId, other = store.getState().newDocument();
    store.getState().switchDocument(model);
    try {
      const task = longer(store); clearNotices(store);
      const atCtrlS = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
      folderQuestion(() => {
        store.getState().updateTask(task, { name: 'Tijdens de vraag' });
        store.getState().switchDocument(other);
        return true;
      });
      assert.equal(await ctrlS(store), false, 'opgeslagen, maar het document is intussen gewijzigd');
      assert.equal(hash(new Uint8Array(readFileSync(own))), atCtrlS.sha256, 'het bestand heeft de stand van Ctrl+S');
      assert(!readFileSync(own).toString('latin1').includes('Tijdens de vraag'), 'niet de bewerking van tijdens de vraag');
      assert.equal(store.getState().activeDocumentId, other, 'het andere tabblad staat vooraan');
      assert.equal(payloadOf(store, model).ifcSource!.sha256, atCtrlS.sha256, 'de geschreven versie is de bron van het model');
      assert.equal(payloadOf(store, model).isDirty, true, 'het model blijft gewijzigd: de bewerking staat nog niet in het bestand');
      assert.equal(payloadOf(store, other).filePath, null, 'het andere tabblad kreeg geen bestand');
      assert.deepEqual(readdirSync(folder), ['model.ifc']);
      assert.deepEqual(autoErrors(store), []);
    } finally { unregister(); await clearRecovery(); }
  } finally { resetFolderAccessAsker(); ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

await check('knownbug 1762, Ctrl+S: het tabblad gaat tijdens de vraag dicht; niets geschreven, de melding van een veranderde opslag', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const folder = mkdtempSync(join(dir, 'buiten-'));
  const ipc = desktop(appData), sw = saveWorker();
  try {
    const own = join(folder, 'model.ifc'); writeFileSync(own, bytes);
    outsideHomeScope(ipc, folder, own);
    ipc.dialog.pickFolder = () => folder;
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    const model = store.getState().activeDocumentId;
    store.getState().newDocument();
    store.getState().switchDocument(model);
    try {
      longer(store); clearNotices(store);
      folderQuestion(() => { store.getState().closeDocument(model); return true; });
      const from = ipc.calls.length;
      assert.equal(await ctrlS(store), false);
      assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'niets geschreven');
      assert.deepEqual(ipc.calls.slice(from).filter(c => c.wrote && c.path?.startsWith(folder)), [], 'nul schrijfacties in de map');
      assert.deepEqual(readdirSync(folder), ['model.ifc']);
      assert.deepEqual(replaceRecordsIn(appData), []);
      assertNotice(store, 'notifications.ifcSaveChangedWhileWaiting');
    } finally { unregister(); await clearRecovery(); }
  } finally { resetFolderAccessAsker(); ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

await check('knownbug 1762, Automatisch opslaan buiten de thuismap vraagt nooit: geen vraag, geen venster, de melding over de toegang tot de map; na Ctrl+S met toegang vervangt het', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-document-save-appdata-'));
  const folder = mkdtempSync(join(dir, 'buiten-'));
  const ipc = desktop(appData), sw = saveWorker();
  const asked = folderQuestion(() => true);
  try {
    const own = join(folder, 'model.ifc'); writeFileSync(own, bytes);
    outsideHomeScope(ipc, folder, own);
    ipc.dialog.pickFolder = () => folder;
    const store = await openAt({ kind: 'path', path: own }, bytes, sw.compute), unregister = recoveryRounds(store);
    try {
      longer(store); clearNotices(store);
      const from = ipc.calls.length;
      const auto = modelAutoSave(store, sw.compute);
      await auto.round();
      assert.deepEqual([asked, folderPicks(ipc, from)], [[], []], 'geen vraag en geen mapkiezer');
      assert.equal(hash(new Uint8Array(readFileSync(own))), hash(bytes), 'niets geschreven');
      assert.deepEqual(readdirSync(folder), ['model.ifc']);
      assert.deepEqual(replaceRecordsIn(appData), [], 'geen herstelrecord dat blijft staan');
      assertNotice(store, 'notifications.ifcForeignAutoSaveFolderAccess');
      // De planner slaat zelf op: één vraag, en de map is vrijgegeven.
      clearNotices(store);
      assert.equal(await ctrlS(store), true, 'Ctrl+S slaat op');
      assert.deepEqual(asked, [folder]);
      const saved = hash(new Uint8Array(readFileSync(own)));
      longer(store);
      const later = ipc.calls.length;
      await auto.round();
      assert.notEqual(hash(new Uint8Array(readFileSync(own))), saved, 'daarna vervangt Automatisch opslaan in die map');
      assert.deepEqual([asked.length, folderPicks(ipc, later)], [1, []], 'zonder vraag');
      assert.deepEqual(readdirSync(folder), ['model.ifc'], 'geen hulpbestand');
      assert.deepEqual(autoErrors(store), []);
      assert.equal(store.getState().isDirty, false);
    } finally { unregister(); await clearRecovery(); }
  } finally { resetFolderAccessAsker(); ipc.dispose(); sw.client.dispose(); rmSync(appData, { recursive: true, force: true }); }
});

rmSync(dir, { recursive: true, force: true });
console.log(`Documentopslag: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
