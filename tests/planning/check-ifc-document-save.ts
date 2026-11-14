// #804 PR 11a: echte documentacties, volledige heropening of bewijs van nul schrijfacties.
// Bronobjecten alleen op identiteit vergelijken; nooit een assert-diff van bronbytes maken.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { ifcDocumentSaveBlocked, ifcSaveBlocked } from '@/state/ifcForeignGuard';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { setSiteSaveAsker, resetSiteAskers } from '@/services/fileAccess/siteDialogs';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { openInStore, loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
import { installDeterminism } from './ifcPariteitKern';
import { mergeProblems, openForeign } from './ifcMergeKern';

installDeterminism();
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
    const ipc = desktop(), target = join(dir, `${fault}.ifc`);
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
      if (fault === 'I/O-fout') assertNotice(store, 'notifications.saveFailed');
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
        clearNotices(store); await save(); unchanged(store, before); assertNotice(store, 'notifications.ifcForeignSaveBlocked');
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
    assert.equal(ifcSaveBlocked(store.getState()), false); assert.equal(ifcDocumentSaveBlocked(store.getState()), false);
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
rmSync(dir, { recursive: true, force: true });
console.log(`Documentopslag: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
