// #804 PR 9a: de echte herstelopslag en documentacties; bronobjecten alleen op identiteit/hash.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadStore, openInStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installNodeFileIpc } from './nodeFileIpc';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { mergeProblems, openForeign } from './ifcMergeKern';
import { SOURCE_COPY_DB, sourceCopyReferenceKey } from '@/services/recovery/recoverySourceCopies';
import { classify } from '@/services/ifc/foreign/classify';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery, saveRecovery } from '@/services/recovery/recoveryStore';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { recoverySnapshotInput } from '@/services/recovery/recoverySnapshotInput';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { ownRecoveryNames } from '@/hooks/recoveryPaths';
import { planTauriV3RecoverySave, parseRecoveryManifest } from '@/services/recovery/recoveryStore';
import { checkRecoveryDocuments, checkRecoveryManifestVersion } from '@/services/recovery/recoveryManifest';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';

installDeterminism();
await loadStore();
// De dubbel herstelt de prototypefuncties van een hosthandle na structuredClone. In Chromium
// doet IndexedDB dit native; dit is geen bewijs van browserrechten na een echte procescrash.
const handleData = new Map<string, Uint8Array>();
class Handle {
  readonly kind = 'file';
  constructor(readonly name: string) {}
  async queryPermission() { return 'granted'; }
  async getFile() {
    const bytes = handleData.get(this.name);
    if (!bytes) throw new DOMException('Geen leestoestemming', 'NotAllowedError');
    return new File([new Uint8Array(bytes).buffer], this.name);
  }
}
function hydrateHandles(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Reflect.get(value, 'kind') === 'file' && handleData.has(Reflect.get(value, 'name'))) Object.setPrototypeOf(value, Handle.prototype);
  else for (const child of Object.values(value)) hydrateHandles(child);
}
let failCopy = false, failManifest = false, interruptCleanup = false;
let copyWrites = 0, enforceCopyOrder = false;
const copyNotices: string[] = [];
const idb = installFakeRecoveryIndexedDb({
  onRead: (store, method, value) => {
    hydrateHandles(value);
    if (interruptCleanup && store === 'references' && method === 'getAll') throw new Error('crash vóór opruimen');
  },
  onPut: (store, value) => {
    if (store === 'xer-archives') {
      const written = Reflect.get(value, 'bytes');
      if (written instanceof Uint8Array) assert(hash(written) !== hash(bytes), 'geen IFC-bronbytes in de bestaande herstel-database');
    }
    if (store === 'sources') { copyWrites++; if (failCopy) throw new DOMException('quotum', 'QuotaExceededError'); }
    if (store === 'records' && Reflect.get(value, 'kind') === 'manifest') {
      if (failManifest) throw new Error('crash vóór manifest');
      for (const doc of Reflect.get(value, 'documents') as { ifcSource?: { sha256: string; handle?: unknown }; foreignSource?: { filePath?: string } }[]) {
        if (enforceCopyOrder && doc.ifcSource && !doc.ifcSource.handle && !doc.foreignSource?.filePath?.startsWith('/')) {
          assert(idb.store('sources', SOURCE_COPY_DB).has(doc.ifcSource.sha256), 'de kopie staat vóór het manifest');
        }
      }
    }
  },
});
const session = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v),
  removeItem: (k: string) => session.delete(k),
} });
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const dir = mkdtempSync(join(tmpdir(), 'ops-recovery-source-'));
const evidenceDir = process.env.OPS_RECOVERY_IFC_EVIDENCE ?? dir;
const hash = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
type Store = Awaited<ReturnType<typeof openInStore>>['store'];
function desktop() {
  const ipc = installNodeFileIpc(), internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = internals.invoke;
  let target: string | null = null;
  internals.invoke = async (c, a) => c === 'plugin:dialog|save' ? target
    : c === 'plugin:fs|read_file' ? new Uint8Array(readFileSync((a as { path: string }).path)) : invoke(c, a);
  return { ...ipc, choose: (p: string) => { target = p; } };
}
async function saveAs(store: Store, name: string) {
  const ipc = desktop(), target = join(dir, name); ipc.choose(target);
  try { await store.getState().saveFileAs(); assert(existsSync(target), `bestand geschreven: ${name}`); }
  finally { ipc.dispose(); }
  return new Uint8Array(readFileSync(target));
}
async function tick(store: Store, enabled = true, tracker = new RecoveryDeltaTracker()) {
  // De desktopproeven gebruiken de webopslagnaad voor het manifest, maar vangen de
  // documentmomentopname op het juiste platform (op desktop is geen bronkopie nodig).
  const desktopCapture = store.getState().filePath?.startsWith(dir) && !store.getState().siteFileId ? desktop() : null;
  let docs;
  try { docs = store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, enabled)); }
  finally { desktopCapture?.dispose(); }
  await runRecoveryTick(tracker, store.getState().activeDocumentId, docs, undefined, undefined, id => copyNotices.push(id));
  return loadRecovery();
}
async function restore(loaded: Awaited<ReturnType<typeof loadRecovery>>, enabled = true) {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const inputs = [];
  for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, enabled));
  assert.equal(store.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  return store;
}

// Eerst proef 2: zonder uitzonderingenlijst, na een opslag met een nieuw object.
const original = (await openInStore(bytes)).store;
original.getState().addResource({ name: 'Resource vóór crash', type: 'EQUIPMENT', description: '', maxUnits: 2, costPerHour: 37.5 });
const first = await saveAs(original, 'voor-crash.ifc');
const task = original.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0)!;
original.getState().updateTask(task.id, { name: 'Bewerking na opslag' });
const loaded = await tick(original);
const ipc = desktop();
let recovered: Store;
try { recovered = await restore(loaded); } finally { ipc.dispose(); }
assert(recovered!.getState().ifcSource?.foreign, 'herstel heeft het vreemde deel');
assert.equal(recovered!.getState().foreignSourceMark?.sourceMissing, undefined);
assert.equal(recovered!.getState().ifcSource!.sha256, hash(first));
const second = await saveAs(recovered!, 'na-crash.ifc');
const reopenedFirst = await openForeign(first), reopenedSecond = await openForeign(second);
assert(reopenedSecond.resources.some(r => r.name === 'Resource vóór crash'));
assert.equal(reopenedSecond.tasks.find(t => t.id === task.id)?.name, 'Bewerking na opslag');
const resourceGuid = (d: typeof reopenedFirst) => {
  const r = d.resources.find(r => r.name === 'Resource vóór crash')!;
  return d.ifcGlobalIds?.[`res:${r.id}`];
};
assert(resourceGuid(reopenedFirst));
assert.equal(resourceGuid(reopenedSecond), resourceGuid(reopenedFirst), 'geen nieuwe GlobalId voor de opgeslagen resource');
const rootGuids = (data: Uint8Array) => {
  const index = scanForeignStep(data), guids: string[] = [];
  for (let c = 0; c < index.count; c++) {
    const args = index.argTokens(c);
    if (args && args.length >= 5 && /^'[0-9A-Za-z_$]{22}'$/.test(args[0]) && /^#\d+$/.test(args[1])) guids.push(index.globalId(c));
  }
  return guids.sort();
};
assert.deepEqual(rootGuids(second), rootGuids(first), 'alle bestaande objecten, ook hulpobjecten, behouden hun GlobalId');
assert.deepEqual(mergeProblems(first, second), [], 'vreemde verwijzingen en bytes intact');
function sameForeignTargets(before: Uint8Array, after: Uint8Array): void {
  const old = scanForeignStep(before), next = scanForeignStep(after), classes = classify(old).classes;
  let checked = 0;
  for (let i = 0; i < old.count; i++) {
    if (!old.isEntity(i) || classes[i] === 1) continue;
    for (let k = old.outStart(i); k < old.outEnd(i); k++) {
      const target = old.outTarget(k);
      if (target < 0) continue;
      const id = old.id(target), actual = next.chunkOf(id);
      assert(actual >= 0, `vreemd doel #${id} bestaat`);
      assert.equal(next.type(actual), old.type(target), `type op vreemd doel #${id}`);
      assert.equal(next.globalId(actual), old.globalId(target), `GlobalId op vreemd doel #${id}`);
      checked++;
    }
  }
  assert(checked > 0, 'de fixture bevat vreemde verwijzingen');
  console.log(`DIRECTE DOELCONTROLE: ${checked} vreemde verwijzingen behouden type en GlobalId op hetzelfde #id.`);
}
sameForeignTargets(first, second);
console.log('PROEF 2 GROEN: twee bewerkingen, volledig heropenen, dezelfde GlobalId; geen idExceptions.');
assert(idb.store('records').size > 0);
await clearRecovery();
writeFileSync(join(dir, 'proef2-groen.txt'), 'Geen idExceptions nodig.\n');

async function openAt(data: Uint8Array, ref: import('@/services/fileAccess').FileRef | null) {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes: data, ref });
  assert(store.getState().ifcSource); return store;
}
const durationEdit = (store: Store) => {
  const t = store.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0)!;
  store.getState().updateTask(t.id, { time: { ...t.time, durationUnit: 'days', durationMinutes: undefined, scheduleDuration: t.time.scheduleDuration + 1 } });
  return { id: t.id, duration: store.getState().tasks.find(task => task.id === t.id)!.time.scheduleDuration };
};
async function noWrites(store: Store) {
  const ipc = desktop(); ipc.choose(join(dir, 'mag-nooit-bestaan.ifc'));
  try {
    const id = store.getState().activeDocumentId;
    await store.getState().saveFile(); await store.getState().saveFileAs();
    assert.equal(await store.getState().saveFileForDocument(id), false);
    const exported = await store.getState().exportAs('ifc');
    assert(exported.ok && exported.cancelled === true);
    await store.getState().exportProjectWithPool();
    store.setState(s => { s.autoSaveToFile = true; });
    await createFileAutoSaveController({ getState: store.getState, enabled: () => true }).flush();
    let closed = false;
    await createCloseDocumentDialogActions({
      pendingId: id, getActiveDocumentId: () => store.getState().activeDocumentId,
      switchDocument: store.getState().switchDocument, closeDocument: () => { closed = true; },
      saveFile: () => store.getState().saveFileForDocument(id), clearPending: () => {},
      restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
    }).save();
    assert.equal(closed, false);
    assert(store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignSourceMissing'));
    assert.equal(ipc.calls.some(c => c.options?.write || c.command.includes('write_file') || c.command.includes('write_text_file')), false);
    assert.equal(existsSync(join(dir, 'mag-nooit-bestaan.ifc')), false);
  } finally { ipc.dispose(); }
}

// Proef 1: bron op desktop, snapshotbewerking en daarna de bestaande Opslaan als-route.
const path = join(dir, 'desktop-bron.ifc'); writeFileSync(path, bytes);
const beforeCrash = await openAt(bytes, { kind: 'path', path });
const edit = durationEdit(beforeCrash), crash = await tick(beforeCrash);
const readIpc = desktop(); let afterCrash: Store;
try { afterCrash = await restore(crash); } finally { readIpc.dispose(); }
assert.equal(afterCrash!.getState().filePath, path);
assert.equal(afterCrash!.getState().foreignSourceMark!.byteLength, bytes.length);
assert.equal(afterCrash!.getState().foreignSourceMark!.sourceMissing, undefined);
assert.equal(afterCrash!.getState().tasks.find(t => t.id === edit.id)!.time.scheduleDuration, edit.duration);
const savedCrash = await saveAs(afterCrash!, 'duur-na-crash.ifc');
assert.equal((await openForeign(savedCrash)).tasks.find(t => t.id === edit.id)!.time.scheduleDuration, edit.duration);
assert.deepEqual(mergeProblems(bytes, savedCrash), []);
console.log('PROEF 1 GROEN: snapshotduur behouden, bron/doel terug, volledig heropenen.');

// Hetzelfde aantal bytes, maar één andere byte, moet op de hash stranden.
for (const kind of ['gewijzigd', 'weg', 'verkeerde-grootte'] as const) {
  const candidate = { ...crash.docs[0], foreignSource: { filePath: kind === 'weg' ? join(dir, 'weg.ifc') : path, siteFileId: null } };
  const changed = new Uint8Array(bytes); changed[Buffer.from(changed).indexOf("FILE_NAME('") + 11] ^= 1;
  writeFileSync(path, kind === 'verkeerde-grootte' ? changed.subarray(0, changed.length - 1) : changed);
  const ipc = desktop(); let missing: Store;
  try { missing = await restore({ ...crash, docs: [candidate] }); } finally { ipc.dispose(); }
  assert.equal(missing!.getState().foreignSourceMark?.sourceMissing, true, kind);
  assert.equal(missing!.getState().filePath, null, kind);
  assert.equal(missing!.getState().fileHandle, null);
  await noWrites(missing!);
  const repeat = await restore(await tick(missing!));
  assert.equal(repeat.getState().foreignSourceMark?.sourceMissing, true, 'ook na een tweede crash blijft de ontbrekende bron geblokkeerd');
  assert.equal(repeat.getState().filePath, null);
  await noWrites(repeat);
}
writeFileSync(path, bytes);
console.log('PROEF 3 GROEN: gewist, één byte anders en andere grootte: bron ontbreekt, doel weg, nul writes.');
await clearRecovery();

// Proef 4: ook een oud kenmerk op een inmiddels gewone planning blokkeert nieuw herstel niet.
const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
const normal = await openAt(plain, { kind: 'path', path: join(dir, 'verplaatst.ifc') });
normal.setState(s => { s.foreignSourceMark = beforeCrash.getState().foreignSourceMark; });
durationEdit(normal);
const plainRecovery = await tick(normal);
assert.equal(plainRecovery.docs[0].ifcSource, undefined);
const plainRestored = await restore(plainRecovery);
assert.equal(plainRestored.getState().foreignSourceMark, null);
assert.equal(plainRestored.getState().ifcSource, null, 'geen bewezen actuele schijfbron zonder vreemd deel');
const expected = writeIFC(buildWriteIFCInput(plainRestored.getState(), 'merge'));
const output = await saveAs(plainRestored, 'gewone-planning.ifc');
assert.equal(hash(output), hash(expected));
console.log('PROEF 4 GROEN: verplaatste gewone bron niet nodig; geen blokkade, bytes van gewone writer.');
await clearRecovery();

// Proef 5: hosthandle door de opslagnaad, vervolgens echt getFile + bytes-route + hash.
handleData.set('handle-model.ifc', bytes);
const handle = new Handle('handle-model.ifc') as unknown as FileSystemFileHandle;
const browser = await openAt(bytes, { kind: 'handle', handle }); durationEdit(browser);
const handleRecovery = await tick(browser);
assert.equal(handleRecovery.docs[0].ifcSource?.handle?.name, handle.name);
const browserRestored = await restore(handleRecovery);
assert(browserRestored.getState().ifcSource?.foreign);
assert.equal(browserRestored.getState().foreignSourceMark?.sourceMissing, undefined);
assert.equal(browserRestored.getState().fileHandle?.name, handle.name);
assert.equal(browserRestored.getState().foreignSourceMark?.handle?.name, handle.name);
await openForeign(await saveAs(browserRestored, 'handle-na-herstel.ifc'));
const wrongHandle = new Uint8Array(bytes); wrongHandle[Buffer.from(wrongHandle).indexOf("FILE_NAME('") + 11] ^= 1;
handleData.set(handle.name, wrongHandle);
const changedHandle = await restore(handleRecovery);
assert.equal(changedHandle.getState().foreignSourceMark?.sourceMissing, true);
assert.equal(changedHandle.getState().fileHandle, null);
console.log('PROEF 5 GROEN: handle teruggelezen; gewijzigde inhoud geweigerd.');
await clearRecovery();
// PR 9b: de echte browser-/siteketen met een eigen database naast ops-recovery v3.
enforceCopyOrder = true;
const sourceStore = () => idb.store('sources', SOURCE_COPY_DB);
const copyRefs = () => idb.store('references', SOURCE_COPY_DB);
assert.equal(idb.databases.has(SOURCE_COPY_DB), false, 'desktop en handle maakten geen kopiedatabase');
const offCopy = await openAt(bytes, null); durationEdit(offCopy);
const offPayload = offCopy.getState().getOpenDocumentPayloads()[0];
assert(recoverySourceDocument(offPayload.id, offPayload.payload, false).sourceCopy === undefined, 'flag uit draagt geen kopie');
await tick(offCopy, false);
assert.equal(idb.databases.has(SOURCE_COPY_DB), false, 'flag uit maakt geen extra database');
await clearRecovery();
const withoutHandle = await openAt(bytes, null), browserEdit = durationEdit(withoutHandle);
const browserTracker = new RecoveryDeltaTracker();
const browserCrash = await tick(withoutHandle, true, browserTracker);
assert.equal(sourceStore().size, 1);
assert.equal(copyWrites, 1);
assert.equal(idb.databases.get('ops-recovery')?.version, 3);
assert.equal(idb.store('xer-archives').size, 0, 'bronkopieën gebruiken de XER-store niet');
assert.deepEqual([...idb.databases.get('ops-recovery')!.stores].sort(), ['records', 'xer-archives']);
assert.deepEqual([...idb.databases.get(SOURCE_COPY_DB)!.stores].sort(), ['references', 'sources']);
const browserRecovered = await restore(browserCrash);
assert.equal(browserRecovered.getState().ifcSource!.sha256, hash(bytes));
assert.equal(browserRecovered.getState().foreignSourceMark?.sourceMissing, undefined);
assert.equal(browserRecovered.getState().tasks.find(t => t.id === browserEdit.id)!.time.scheduleDuration, browserEdit.duration);
// Opslaan als in de browser levert werkelijk een Blob-download; de openingsbron blijft gelijk.
const win = window as unknown as Record<string, unknown>, previousDocument = globalThis.document;
const previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
let downloaded: Blob | undefined;
URL.createObjectURL = blob => { downloaded = blob as Blob; return 'blob:test'; };
URL.revokeObjectURL = () => {};
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  createElement: () => ({ href: '', download: '', click: () => {}, remove: () => {}, style: {} }),
  body: { appendChild: () => {} },
} });
try { await browserRecovered.getState().saveFileAs(); }
finally {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
  URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke;
}
assert(downloaded, 'Opslaan als leverde een download');
const downloadBytes = new Uint8Array(await downloaded.arrayBuffer());
assert.equal((await openForeign(downloadBytes)).tasks.find(t => t.id === browserEdit.id)!.time.scheduleDuration, browserEdit.duration);
assert.deepEqual(mergeProblems(bytes, downloadBytes), []); sameForeignTargets(bytes, downloadBytes);
assert.equal(browserRecovered.getState().ifcSource!.sha256, hash(bytes), 'download vervangt de bron niet');
await tick(withoutHandle, true, browserTracker);
assert.equal(copyWrites, 1, 'ongewijzigde tick kopieert niet opnieuw');

// Gewist en beschadigd: de centrale hashcontrole blijft verplicht; elke bestaande documentroute nul bytes.
const stored = sourceStore().get(hash(bytes))!;
for (const broken of ['weg', 'hash'] as const) {
  if (broken === 'weg') sourceStore().delete(hash(bytes));
  else {
    const changed = new Uint8Array(bytes); changed[Buffer.from(changed).indexOf("FILE_NAME('") + 11] ^= 1;
    sourceStore().set(hash(bytes), { id: hash(bytes), bytes: changed });
  }
  const missing = await restore(browserCrash);
  assert.equal(missing.getState().foreignSourceMark?.sourceMissing, true, broken);
  assert.equal(missing.getState().filePath, null); assert.equal(missing.getState().siteFileId, null);
  await noWrites(missing);
  sourceStore().set(hash(bytes), stored);
}
// Een oude kopie kan wél als terugval dienen bij geweigerde handletoegang; geen kopie voor handles bijbouwen.
const denied = new Handle('geen-toestemming') as unknown as FileSystemFileHandle;
const withDeniedHandle = { ...browserCrash, docs: browserCrash.docs.map(d => ({ ...d, ifcSource: { ...d.ifcSource!, handle: denied } })) };
assert.equal((await restore(withDeniedHandle)).getState().foreignSourceMark?.sourceMissing, undefined);
await clearRecovery(); assert.equal(sourceStore().size, 0); assert.equal(copyRefs().size, 0);
console.log('PROEF 9b browser: download en heropenen volledig; gewiste/beschadigde kopie geweigerd; handle-terugval.');

// Sitebasis alleen naast de kopie: geen nieuwe doelvelden in het manifest.
const site = await openAt(bytes, { kind: 'site', id: 'site-model' });
site.setState(s => { s.siteFileVersion = 'v1'; });
const siteTracker = new RecoveryDeltaTracker(); durationEdit(site);
const siteCrash = await tick(site, true, siteTracker);
const recoveredSite = await restore(siteCrash);
assert.equal(recoveredSite.getState().siteFileId, 'site-model');
assert.equal(recoveredSite.getState().siteFileVersion, 'v1');
assert.equal(siteCrash.docs[0].siteFileId ?? null, null); assert.equal(siteCrash.docs[0].siteFileVersion ?? null, null);
const requests: { id?: string; data: Blob; baseVersion?: string }[] = [];
win.openaecHost = { storage: { list: async () => [], versions: async () => [], open: async () => null,
  save: async (request: { id?: string; data: Blob; baseVersion?: string }) => {
    requests.push(request); return { id: request.id, name: 'site.ifc', version: `v${requests.length + 1}` };
  },
} };
try {
  await recoveredSite.getState().saveFile();
  assert.equal(requests.length, 1); assert.equal(requests[0].baseVersion, 'v1');
  const hostBytes = new Uint8Array(await requests[0].data.arrayBuffer());
  assert.deepEqual(mergeProblems(bytes, hostBytes), []); sameForeignTargets(bytes, hostBytes);
  // Eerst de gewijzigde planning snapshotten, dan site-opslag: bronupdate is metadata-only.
  durationEdit(site); await tick(site, true, siteTracker);
  const oldCrash = await loadRecovery(), oldSha = site.getState().ifcSource!.sha256;
  await site.getState().saveFile();
  const newSha = site.getState().ifcSource!.sha256;
  assert.notEqual(newSha, oldSha);
  failManifest = true;
  await assert.rejects(() => tick(site, true, siteTracker), /crash vóór manifest/);
  failManifest = false;
  assert(sourceStore().has(newSha), 'crashvenster 1: nieuwe kopie staat er');
  const oldWindow = await restore(await loadRecovery());
  assert.equal(oldWindow.getState().ifcSource!.sha256, oldSha, 'crashvenster 1: oud manifest herstelt oude kopie');
  assert.equal(oldWindow.getState().siteFileVersion, 'v1');
  interruptCleanup = true;
  const newCrash = await tick(site, true, siteTracker);
  interruptCleanup = false;
  assert(sourceStore().has(oldSha), 'crashvenster 2: oude kopie nog niet opgeruimd');
  assert.equal((await restore(newCrash)).getState().ifcSource!.sha256, newSha, 'crashvenster 2: nieuw manifest herstelt nieuwe kopie');
  assert.equal((await restore(newCrash)).getState().siteFileVersion, 'v3');
  durationEdit(site); const latest = await tick(site, true, siteTracker);
  assert.equal(sourceStore().has(oldSha), false, 'oude kopie weg na nieuwe manifestcommit');
  assert.equal((await restore(latest)).getState().ifcSource!.sha256, newSha);
  assert.equal(oldCrash.docs[0].ifcSource!.sha256, oldSha);
} finally { delete win.openaecHost; }
await clearRecovery(); assert.equal(sourceStore().size, 0);
console.log('PROEF 9b site: basisversie, volledige hostbytes, nieuwe bronkopie; beide crashvensters en opruimen.');

// Best effort: schrijfnaad weigert één keer; snapshotten en bewerken blijven doorgaan.
const quota = await openAt(bytes, null), quotaTracker = new RecoveryDeltaTracker(); durationEdit(quota);
const attemptsBefore = copyWrites; failCopy = true;
for (let i = 0; i < 3; i++) {
  durationEdit(quota); const failed = await tick(quota, true, quotaTracker);
  assert.equal(failed.docs[0].ifcSource, undefined, 'geen verwijzing naar een mislukte kopie');
  const recovered = await restore(failed);
  assert.equal(recovered.getState().foreignSourceMark?.sourceMissing, true);
  assert(recovered.getState().tasks.length > 0, 'planning blijft herstelbaar');
}
failCopy = false;
assert.equal(copyWrites - attemptsBefore, 1, 'geen lus van kopieerpogingen');
assert.equal(copyNotices.filter(id => id === quota.getState().activeDocumentId).length, 1);
await clearRecovery();

// Gedeelde kopie, document sluiten, onbekende generatie en andere instantie.
const shared = await openAt(bytes, null), sharedTracker = new RecoveryDeltaTracker(); durationEdit(shared);
const firstId = shared.getState().activeDocumentId;
shared.getState().newDocument();
await shared.getState().openOpenedFile({ name: 'zelfde.ifc', content: '', bytes, ref: null }); durationEdit(shared);
const lastId = shared.getState().activeDocumentId;
await tick(shared, true, sharedTracker); assert.equal(sourceStore().size, 1); assert.equal(copyRefs().size, 2);
shared.getState().closeDocument(firstId); await tick(shared, true, sharedTracker);
assert.equal(sourceStore().size, 1); assert.equal(copyRefs().size, 1);
const otherSha = 'b'.repeat(64), otherKey = 'andere-instantie::doc::extern';
sourceStore().set(otherSha, { id: otherSha, bytes: new Uint8Array([1]) });
copyRefs().set(sourceCopyReferenceKey(otherKey, otherSha), { id: sourceCopyReferenceKey(otherKey, otherSha), documentKey: otherKey, sha256: otherSha });
const unknownKey = 'vreemd::manifest';
idb.store('records').set(unknownKey, { id: unknownKey, kind: 'manifest', sessionId: 'vreemd', version: 999, addedAt: 0 });
shared.getState().closeDocument(lastId); await tick(shared, true, sharedTracker);
assert(sourceStore().has(hash(bytes)), 'onbekende herstelset blokkeert opruimen');
idb.store('records').delete(unknownKey);
shared.getState().addTask({ name: 'Nieuw werk na sluiten' }); await tick(shared, true, sharedTracker);
assert.equal(sourceStore().has(hash(bytes)), false, 'laatste document gesloten: eigen kopie opgeruimd');
assert(sourceStore().has(otherSha), 'andere instantie blijft staan');
await clearRecovery(); assert(sourceStore().has(otherSha));
sourceStore().delete(otherSha); copyRefs().clear();
enforceCopyOrder = false;
console.log('PROEF 9b best effort/opruimen: één poging/melding, gedeelde bron, sluiten/wissen, onbekende en vreemde generaties.');

// Proef 6: echte gemengde herstelset; de basislezer krijgt deze ongewijzigde records in /tmp.
const mixed = await openAt(bytes, { kind: 'path', path }); durationEdit(mixed);
const foreignId = mixed.getState().activeDocumentId;
mixed.getState().newDocument();
await mixed.getState().openOpenedFile({ name: 'gewoon.ifc', content: '', bytes: plain,
  ref: { kind: 'path', path: join(dir, 'gewoon.ifc') } });
const ordinaryId = mixed.getState().activeDocumentId; durationEdit(mixed);
await tick(mixed);
const records = [...idb.store('records')];
const sources = mixed.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true));
const tracker = new RecoveryDeltaTracker();
const input = tracker.prepare(mixed.getState().activeDocumentId, sources, source => {
  return writeIFC(recoverySnapshotInput(source).input);
})!;
const plan = planTauriV3RecoverySave(null, input, 'bewijs', ownRecoveryNames);
const manifest = { version: 5, documents: plan.documents, activeDocumentId: ordinaryId };
checkRecoveryManifestVersion(manifest.version); checkRecoveryDocuments(manifest.documents);
assert(parseRecoveryManifest(JSON.stringify(manifest)));
const foreign = plan.documents.find(d => d.id === foreignId)!;
assert.equal(foreign.filePath, null); assert.equal(foreign.siteFileId ?? null, null); assert.equal(foreign.siteFileVersion ?? null, null);
assert.equal(foreign.ifcSource?.sha256, hash(bytes));
assert(!('ifcSource' in plan.documents.find(d => d.id === ordinaryId)!));

// Ook werkelijk gepubliceerde Tauri-manifesten en snapshots uit dezelfde runRecoveryTick.
const tauriDisk = new Map<string, Uint8Array>();
const prior = Object.getOwnPropertyDescriptor(globalThis, 'window')!;
Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {
  invoke: async (cmd: string, args: { path: string; paths: string[]; oldPath: string; newPath: string } & Uint8Array,
    options?: { headers?: { path?: string } }) => {
    switch (cmd) {
      case 'plugin:path|resolve_directory': return '/recovery';
      case 'plugin:path|join': return args.paths.join('/');
      case 'plugin:fs|mkdir': return null;
      case 'plugin:fs|exists': return tauriDisk.has(args.path);
      case 'plugin:fs|read_dir': return [...tauriDisk.keys()].map(p => ({ name: p.slice('/recovery/'.length) }));
      case 'plugin:fs|read_text_file': case 'plugin:fs|read_file': return tauriDisk.get(args.path);
      case 'plugin:fs|stat': return { mtime: 0, atime: null, birthtime: null };
      case 'plugin:fs|write_text_file': case 'plugin:fs|write_file': tauriDisk.set(decodeURIComponent(options!.headers!.path!), new Uint8Array(args)); return null;
      case 'plugin:fs|rename': tauriDisk.set(args.newPath, tauriDisk.get(args.oldPath)!); tauriDisk.delete(args.oldPath); return null;
      case 'plugin:fs|remove': tauriDisk.delete(args.path); return null;
      default: throw new Error(cmd);
    }
  },
} } });
try {
  const tauriLoaded = await tick(mixed);
  assert.equal(tauriLoaded.docs.find(d => d.id === foreignId)!.ifcSource!.sha256, hash(bytes));
  assert.equal(tauriLoaded.docs.find(d => d.id === foreignId)!.filePath, null);
} finally { Object.defineProperty(globalThis, 'window', prior); }

// Manifestpariteit bij flag uit en flag aan zonder vreemd deel, op dezelfde invoer/generatie.
const mixedSnapshot = (await loadRecovery()).docs.find(d => d.id === foreignId)!.ifc;
const parity = [];
for (const enabled of [false, true]) {
  const docs = (enabled ? normal : mixed).getState().getOpenDocumentPayloads()
    .map(({ id, payload }) => recoverySourceDocument(id, payload, enabled));
  const save = new RecoveryDeltaTracker().prepare(docs[0].id, docs, source => writeIFC(recoverySnapshotInput(source).input))!;
  assert(save.documents.every(d => !('ifcSource' in d)));
  await clearRecovery(); await saveRecovery(save);
  const webManifest = [...idb.store('records').values()].find(r => r && typeof r === 'object' && Reflect.get(r, 'kind') === 'manifest');
  assert(webManifest);
  parity.push({ input: save, plan: planTauriV3RecoverySave(null, save, 'pariteit', ownRecoveryNames), webManifest });
}
writeFileSync(join(evidenceDir, 'main-input.json'), JSON.stringify({ records, foreignId, ordinaryId, path,
  disk: [...tauriDisk].map(([path, bytes]) => [path, Buffer.from(bytes).toString('base64')]), parity,
}));
console.log('PROEF 6c GROEN: v5 + documentcontrole, vreemde documentdoelen leeg; basisinput geschreven.');

// Geen bytes van het model in snapshot, Worker-invoer, manifest of herstelrecords.
const snapshot = mixedSnapshot;
assert(!snapshot.includes('IFCWALL('));
assert(!JSON.stringify(recoverySnapshotInput(mixed.getState().getOpenDocumentPayloads().find(d => d.id === foreignId)!.payload)).includes('IFCWALL('));
assert(!JSON.stringify(manifest).includes('IFCWALL('));
assert(!JSON.stringify(records).includes('IFCWALL('));
const containsBytes = (value: unknown): boolean => value instanceof Uint8Array || value instanceof ArrayBuffer
  || (value !== null && typeof value === 'object' && Object.values(value).some(containsBytes));
assert.equal(containsBytes(records), false, 'geen buffers in bestaande herstelrecords');
assert.equal(containsBytes(recoverySnapshotInput(mixed.getState().getOpenDocumentPayloads().find(d => d.id === foreignId)!.payload)), false, 'geen buffers in Worker-invoer');
console.log(`PROEF 7 GROEN: bron ${bytes.length} bytes, snapshot ${Buffer.byteLength(snapshot)} bytes, bronverwijzing ${JSON.stringify(foreign.ifcSource).length} tekens; geen modelinhoud in snapshot/Worker/opslag.`);

// Metadata-only bronupdate gebruikt de nieuwe hash, zonder de oude bytebuffer in de caches.
const cachedTracker = new RecoveryDeltaTracker();
const current = mixed.getState().getOpenDocumentPayloads().find(d => d.id === foreignId)!;
const doc = recoverySourceDocument(current.id, current.payload, true);
cachedTracker.prepare(foreignId, [doc], () => 'planning'); cachedTracker.commit(foreignId, [doc]);
const replacement = { ...doc, source: { ...doc.source, ifcSource: { ...doc.source.ifcSource!, sha256: 'a'.repeat(64) } },
  ifcSource: { ...doc.ifcSource!, sha256: 'a'.repeat(64) } };
const metadataOnly = cachedTracker.prepare(foreignId, [replacement], () => { throw new Error('geen nieuwe serialisatie'); })!;
assert.equal(metadataOnly.upserts.length, 0);
assert.equal(metadataOnly.documents[0].ifcSource!.sha256, 'a'.repeat(64));
const privateCache = cachedTracker as unknown as { serialized: Map<string, { source: { ifcSource: unknown } }> };
assert.equal(privateCache.serialized.get(foreignId)!.source.ifcSource, null);

const flagOff = await restore(crash, false);
assert.equal(flagOff.getState().foreignSourceMark?.sourceMissing, true);
assert.equal(flagOff.getState().filePath, null);
console.log('Alle bronherstelproeven GROEN.');

// Compatibiliteitsinvoer voor de echte lezer/terugzetcode van de basiscommit.
await clearRecovery();
const compatibility = await openAt(bytes, { kind: 'site', id: 'compat-site' });
compatibility.setState(s => { s.siteFileVersion = 'v7'; }); durationEdit(compatibility);
const compatForeignId = compatibility.getState().activeDocumentId;
compatibility.getState().newDocument();
await compatibility.getState().openOpenedFile({ name: 'gewoon.ifc', content: '', bytes: plain, ref: null });
durationEdit(compatibility);
const compatPlainId = compatibility.getState().activeDocumentId;
await tick(compatibility);
const compatInput = new RecoveryDeltaTracker().prepare(compatPlainId,
  compatibility.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)),
  source => writeIFC(recoverySnapshotInput(source).input))!;
writeFileSync(join(evidenceDir, 'compat-input.json'), JSON.stringify({
  records: [...idb.store('records')], copies: [...sourceStore()].map(([key, value]) => [key,
    { ...(value as object), bytes: [...(value as { bytes: Uint8Array }).bytes] }]),
  references: [...copyRefs()], database: SOURCE_COPY_DB, input: compatInput,
  foreignId: compatForeignId, ordinaryId: compatPlainId,
}));
console.log(`COMPAT-INVOER: ${evidenceDir}/compat-input.json; bestaande database v3 met uitsluitend records/xer-archives; bronkopie apart.`);
