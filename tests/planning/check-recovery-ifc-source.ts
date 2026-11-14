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
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
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
  async getFile() { return new File([new Uint8Array(handleData.get(this.name)!).buffer], this.name); }
}
function hydrateHandles(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Reflect.get(value, 'kind') === 'file' && handleData.has(Reflect.get(value, 'name'))) Object.setPrototypeOf(value, Handle.prototype);
  else for (const child of Object.values(value)) hydrateHandles(child);
}
const idb = installFakeRecoveryIndexedDb({ onRead: (_store, _method, value) => hydrateHandles(value) });
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
  await runRecoveryTick(tracker, store.getState().activeDocumentId,
    store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, enabled)));
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
assert.deepEqual(mergeProblems(first, second), [], 'vreemde verwijzingen en bytes intact');
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
for (const ref of [null, { kind: 'site' as const, id: 'site-model' }]) {
  const unavailable = await openAt(bytes, ref); durationEdit(unavailable);
  const unavailableRestored = await restore(await tick(unavailable));
  assert.equal(unavailableRestored.getState().foreignSourceMark?.sourceMissing, true);
  assert.equal(unavailableRestored.getState().filePath, null);
  assert.equal(unavailableRestored.getState().siteFileId, null);
  await noWrites(unavailableRestored); await clearRecovery();
}
console.log('PROEF 5b GROEN: site en browser zonder handle houden bron ontbreekt en nul writes.');

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
const parity = [];
for (const enabled of [false, true]) {
  const docs = (enabled ? normal : mixed).getState().getOpenDocumentPayloads()
    .map(({ id, payload }) => recoverySourceDocument(id, payload, enabled));
  const save = new RecoveryDeltaTracker().prepare(docs[0].id, docs, source => writeIFC(recoverySnapshotInput(source).input))!;
  assert(save.documents.every(d => !('ifcSource' in d)));
  parity.push({ input: save, plan: planTauriV3RecoverySave(null, save, 'pariteit', ownRecoveryNames) });
}
writeFileSync(join(evidenceDir, 'main-input.json'), JSON.stringify({ records, foreignId, ordinaryId, path,
  disk: [...tauriDisk].map(([path, bytes]) => [path, Buffer.from(bytes).toString('base64')]), parity,
}));
console.log('PROEF 6c GROEN: v5 + documentcontrole, vreemde documentdoelen leeg; basisinput geschreven.');

// Geen bytes van het model in snapshot, Worker-invoer, manifest of herstelrecords.
const snapshot = (await loadRecovery()).docs.find(d => d.id === foreignId)!.ifc;
assert(!snapshot.includes('IFCWALL('));
assert(!JSON.stringify(recoverySnapshotInput(mixed.getState().getOpenDocumentPayloads().find(d => d.id === foreignId)!.payload)).includes('IFCWALL('));
assert(!JSON.stringify(manifest).includes('IFCWALL('));
assert(!JSON.stringify(records).includes('IFCWALL('));
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
