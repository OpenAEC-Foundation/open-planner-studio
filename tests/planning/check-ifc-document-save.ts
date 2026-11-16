// #804 PR 11a: echte documentacties, volledige heropening of bewijs van nul schrijfacties.
// Bronobjecten alleen op identiteit vergelijken; nooit een assert-diff van bronbytes maken.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
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
import { setSiteSaveAsker, resetSiteAskers } from '@/services/fileAccess/siteDialogs';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { openInStore, loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
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
    await store.getState().saveFileAs();
    assert(existsSync(first), 'Opslaan als schreef een nieuw bestand');
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
      assert.equal(ipc.calls.slice(calls).some(c => c.options?.write || c.command === 'plugin:fs|write_text_file'), false,
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

await check('Opslaan als bestaand eigen bestand: createNew weigert, oude bytes intact', async () => {
  const { store } = await openInStore(bytes); longer(store);
  const ipc = desktop(), target = join(dir, 'bestaand.ifc');
  const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
  writeFileSync(target, plain); ipc.choose(target);
  const before = preserved(store);
  try {
    clearNotices(store); await store.getState().saveFileAs(); unchanged(store, before);
    assert.equal(hash(new Uint8Array(readFileSync(target))), hash(plain));
    assertNotice(store, 'notifications.saveFailed');
    assert(ipc.calls.some(c => c.path === target && c.options?.createNew));
  } finally { ipc.dispose(); }
});

await check('browserhandle Ctrl+S: nul bytes, geen downloadterugval', async () => {
  let writables = 0;
  const handle = { kind: 'file', name: 'model.ifc', isSameEntry: async (other: unknown) => other === handle,
    getFile: async () => new File([new Uint8Array(bytes).buffer], 'model.ifc'),
    createWritable: async () => { writables++; throw new Error('mag niet schrijven'); },
  } as unknown as FileSystemFileHandle;
  const store = await openAt({ kind: 'handle', handle }); longer(store);
  const before = preserved(store), browser = browserDownload();
  try {
    clearNotices(store); await store.getState().saveFile(); unchanged(store, before);
    assertNotice(store, 'notifications.ifcForeignReplaceBlocked');
    assert.equal(writables, 0); assert.equal(browser.downloads.length, 0);
  } finally { browser.dispose(); }
});

for (const fault of ['annuleren', 'I/O-fout', 'documentwissel', 'nieuwe-bron', 'flag-uit-na-kiezer'] as const) {
  await check(`${fault}: na voorbereiden nul bytes, bron en doel intact`, async () => {
    const { store } = await openInStore(bytes); longer(store);
    const before = preserved(store), id = store.getState().activeDocumentId;
    const ipc = desktop(), target = join(dir, `${fault.replace('/', '-')}.ifc`);
    ipc.choose(fault === 'annuleren' ? null : target);
    if (fault === 'I/O-fout') ipc.faults.writeErrorAfter = 2;
    let expectedSource = before.source;
    if (fault === 'documentwissel') ipc.onPick(() => { store.getState().newDocument(); });
    if (fault === 'flag-uit-na-kiezer') ipc.onPick(() => { store.setState(s => { s.ui.featureFlags = {}; }); });
    if (fault === 'nieuwe-bron') {
      const other = await prepareIfcWrite(buildWriteIFCInput(store.getState(), 'merge'), before.source!);
      expectedSource = other.source;
      ipc.onPick(() => { store.getState().commitSavedDocument(id, store.getState(), undefined, other); });
    }
    try {
      await store.getState().saveFileAs();
      assert.equal(existsSync(target), false);
      if (fault === 'documentwissel') store.getState().switchDocument(id);
      if (fault === 'nieuwe-bron') {
        assert(store.getState().ifcSource === expectedSource, 'de inmiddels gecommitte bron blijft staan');
        assert.equal(store.getState().filePath, before.path);
      } else unchanged(store, before);
      if (fault === 'I/O-fout') {
        assert(ipc.calls.some(c => c.command === 'plugin:fs|write'), 'de schrijffout is werkelijk bereikt');
        assertNotice(store, 'notifications.saveFailed');
      }
    } finally { ipc.dispose(); }
  });
}

function browserDownload() {
  const win = window as unknown as Record<string, unknown>;
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL, downloads: Blob[] = [];
  URL.createObjectURL = blob => { assert(blob instanceof Blob); downloads.push(blob); return 'blob:document-test'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ href: '', download: '', click: () => {} }),
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
    if (path !== first || edited) return; edited = true;
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
    const result = await store.getState().exportAs('ifc');
    assert(result.ok && !result.cancelled, 'IFC-export schrijft');
    assert(existsSync(target), 'nieuw exportbestand bestaat');
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
    assert.equal(ipc.calls.filter(c => c.command === 'plugin:fs|write').length, 0);
    assertNotice(store, kind === 'bestaand' ? 'notifications.ifcForeignExportNewTarget' : 'notifications.ifcForeignTargetExport');
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
  } finally { browser.dispose(); }
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
      assert.equal(existsSync(target), false); assert.equal(ipc.calls.filter(c => c.command === 'plugin:fs|write').length, 0);
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
const writeCalls = (ipc: ReturnType<typeof desktop>) => ipc.calls.filter(c => c.command === 'plugin:fs|write'
  || c.command === 'plugin:fs|write_text_file' || c.options?.write).length;
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
rmSync(dir, { recursive: true, force: true });
console.log(`Documentopslag: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
