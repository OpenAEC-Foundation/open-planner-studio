import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
import { InProcessWorker } from './inProcessSaveWorker';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import { saveTargetRef, type FileRef } from '@/services/fileAccess';
import { loadRecents, removeRecent } from '@/services/fileAccess/recentFiles';
import { readIfcx } from '@/services/ifc/ifcx';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { recoverySourceDocument, unchangedIfcxSaveTargets } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { taskElementLinks, uncheckedModelLinks } from '@/state/taskElementLinks';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { recoverySnapshotInput, writeRecoverySnapshot } from '@/services/recovery/recoverySnapshotInput';
import { clearRecovery, loadRecovery, RecoveryManifestError } from '@/services/recovery/recoveryStore';
import { recoveryManifestName } from '@/services/recovery/recoveryPaths';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { createRecoveryTickQueue } from '@/services/recovery/recoveryTickQueue';
import { saveFeatureFlags } from '@/utils/settingsStore';

const { createAppStoreContext } = await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(join(tmpdir(), 'ops-ifcx-herstel-'));
const recoveryDir = mkdtempSync(join(tmpdir(), 'ops-ifcx-herstelset-'));
const plan = join(dir, 'planning-met-model.ifcx');
const model = join(dir, 'model.ifcx');
const modelBytes = readFileSync(join(root, 'docs/superpowers/evidence/2026-11-27-ifcx-verwijzing-los-modelbestand/model.ifcx'));
const planBytes = readFileSync(join(root, 'tests/fixtures/ifcx/eigen/planning-met-model.ifcx'));
writeFileSync(model, modelBytes);
writeFileSync(plan, planBytes);
const flags = { ifcx: true };
const worker = createIfcSaveWorker({ createWorker: () => new InProcessWorker('auto') });
const db = installFakeRecoveryIndexedDb({ onRead: (store, method, entries) => {
  if (store === 'recents' && method === 'getAll' && Array.isArray(entries)) {
    for (const entry of entries) if (entry.ref.kind === 'handle') Object.setPrototypeOf(entry.ref.handle, BrowserHandle.prototype);
  }
} });
function app() {
  const { store } = createAppStoreContext({ ifcSaveCompute: worker.compute, ifcxClassify: worker.classifyIfcx });
  store.setState(s => { s.ui.featureFlags = flags; });
  return store;
}
type Store = ReturnType<typeof app>;
const open = (s: Store, path: string, ref: FileRef | null = { kind: 'path', path }) =>
  s.getState().openOpenedFile({ ref, name: basename(path), content: '', bytes: new Uint8Array(readFileSync(path)) });
const save = (s: Store) => s.getState().saveFileForDocument(s.getState().activeDocumentId);
const auto = (s: Store) => createFileAutoSaveController({ getState: s.getState, enabled: () => true,
  compute: worker.compute, classifyIfcx: worker.classifyIfcx }).flush();
function tick(s: Store, tracker = new RecoveryDeltaTracker(), serialize?: Parameters<typeof runRecoveryTick>[3]) {
  const state = s.getState();
  const docs = state.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, false, !!state.ui.featureFlags.ifcx));
  return runRecoveryTick(tracker, state.activeDocumentId, docs, serialize, () =>
    unchangedIfcxSaveTargets(docs, s.getState().getOpenDocumentPayloads, !!s.getState().ui.featureFlags.ifcx));
}
async function restore() {
  const loaded = await loadRecovery();
  const s = app();
  const inputs = await Promise.all(loaded.docs.map(d => readRecoveryDocument(d, loaded.archives, false)));
  assert.deepEqual(s.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds, []);
  assert.equal(s.getState().activeDocumentId, loaded.activeDocumentId);
  return s;
}
const manifestPath = join(recoveryDir, recoveryManifestName);
const manifest = () => JSON.parse(readFileSync(manifestPath, 'utf8'));
const ipc = installNodeFileIpc({ appDataDir: recoveryDir });
await saveFeatureFlags(flags);
try {
  const fresh = app();
  await open(fresh, model);
  const id = fresh.getState().addTask({ name: 'Muur stellen' });
  fresh.getState().setAutoSaveToFile(true);
  await auto(fresh);
  assert.equal(fresh.getState().isDirty, true);
  assert.deepEqual(readFileSync(model), modelBytes);
  await tick(fresh);
  assert.equal(manifest().version, 6);
  const after = await restore();
  assert.equal(after.getState().tasks.find(t => t.id === id)?.name, 'Muur stellen');
  assert.deepEqual(after.getState().ifcxReferences, fresh.getState().ifcxReferences);
  assert.equal(saveTargetRef(after.getState()), null);
  assert.equal(uncheckedModelLinks(after.getState()), false);
  const firstPlan = join(dir, 'model - planning.ifcx');
  const bridge = (window as unknown as { __TAURI_INTERNALS__: { invoke: (name: string, args: { options?: { defaultPath?: string } }, ...rest: unknown[]) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = bridge.invoke;
  let dialog = 0;
  bridge.invoke = async (cmd, args, ...rest) => {
    if (cmd !== 'plugin:dialog|save') return invoke(cmd, args, ...rest);
    dialog++;
    assert.equal(args.options?.defaultPath, firstPlan);
    return firstPlan;
  };
  try { assert.equal(await save(after), true); } finally { bridge.invoke = invoke; }
  assert.equal(dialog, 1);
  assert.deepEqual(readIfcx(readFileSync(firstPlan)).modelSource, fresh.getState().ifcxReferences?.modelSource);
  assert.deepEqual(readFileSync(model), modelBytes);
  console.log('OK crash vóór de eerste opslag, hersteld zonder doel, eerste opslag naast het model');

  const s = app();
  await open(s, plan);
  const task = s.getState().tasks[0].id;
  const initial = readIfcx(planBytes);
  const edit = (name: string) => s.getState().updateTask(task, { name });
  edit('Op schijf');
  assert.equal(await save(s), true);
  const savedBeforeCrash = readFileSync(plan);
  edit('Na handmatig opslaan');
  await tick(s);
  for (const blocked of [false, true]) {
    ipc.faults.onCall = (cmd, path) => { if (blocked && cmd === 'plugin:fs|read_file' && path === model) throw new Error('Geen leesrecht'); };
    const r = await restore();
    assert.equal(r.getState().tasks.find(t => t.id === task)?.name, 'Na handmatig opslaan');
    assert.deepEqual(r.getState().ifcxReferences, s.getState().ifcxReferences);
    assert.deepEqual(saveTargetRef(r.getState()), { kind: 'path', path: plan });
    assert.equal(uncheckedModelLinks(r.getState()), blocked);
    assert.deepEqual(taskElementLinks(r.getState(), task)?.map(link => link.found), [!blocked, false]);
    assert.equal(r.getState().ui.notifications.some(n => n.messageKey === 'ifcx.model.unchecked'), blocked);
    assert.equal(await save(r), true);
    const written = readIfcx(readFileSync(plan));
    assert.equal(written.tasks.find(t => t.id === task)?.name, 'Na handmatig opslaan');
    assert.deepEqual(written.modelSource, initial.modelSource);
    assert.deepEqual(written.elementLinks, initial.elementLinks);
    assert.deepEqual(readFileSync(model), modelBytes);
    console.log('OK herstel met twee exacte doelpaden, Ctrl+S en bytegelijk model, leesrecht', !blocked);
    writeFileSync(plan, savedBeforeCrash);
  }
  ipc.faults.onCall = null;
  const tracker = new RecoveryDeltaTracker();
  let release!: () => void, started!: () => void;
  const busy = new Promise<void>(r => { started = r; });
  const waiting = new Promise<void>(r => { release = r; });
  let oldCommitted: boolean | undefined;
  const queue = createRecoveryTickQueue(async () => {
    const persisted = await tick(s, tracker, async source => {
      if (source.ifcxReferences) { started(); await waiting; }
      return writeRecoverySnapshot(recoverySnapshotInput(source));
    });
    oldCommitted ??= persisted;
  }, () => true);
  const unregister = registerRecoveryFlush(queue);
  const running = queue();
  await busy;
  edit('Laatste handmatige opslag');
  const manual = save(s);
  try {
    for (let i = 0; i < 300 && s.getState().isDirty; i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(s.getState().isDirty, false);
  } finally { release(); }
  try { assert.equal(await manual, true); await running; } finally { unregister(); }
  assert.equal(oldCommitted, false);
  const last = await restore();
  assert.equal(last.getState().tasks.find(t => t.id === task)?.name, 'Laatste handmatige opslag');
  assert.deepEqual(last.getState().ifcxReferences, s.getState().ifcxReferences);
  assert.deepEqual(readIfcx(readFileSync(plan)).elementLinks, initial.elementLinks);
  console.log('OK handmatig opslaan tijdens herstelserialisatie, alleen de laatste opslag komt terug');

  const previousManifest = readFileSync(manifestPath);
  assert.equal(await tick(s, new RecoveryDeltaTracker(), async source => {
    s.setState(state => { state.ui.featureFlags = {}; });
    return writeRecoverySnapshot(recoverySnapshotInput(source));
  }), false);
  assert.deepEqual(readFileSync(manifestPath), previousManifest);
  s.setState(state => { state.ui.featureFlags = flags; });

  s.getState().setAutoSaveToFile(true);
  edit('Automatisch bijgewerkt');
  await auto(s);
  const automatic = readIfcx(readFileSync(plan));
  assert.equal(automatic.tasks.find(t => t.id === task)?.name, 'Automatisch bijgewerkt');
  assert.deepEqual(automatic.elementLinks, initial.elementLinks);
  assert.deepEqual(automatic.modelSource, initial.modelSource);
  edit('Automatische tussenstand');
  let resumeAuto!: () => void, autoStarted!: () => void;
  const holdingAuto = new Promise<void>(r => { resumeAuto = r; });
  const computingAuto = new Promise<void>(r => { autoStarted = r; });
  const simultaneous = createFileAutoSaveController({ getState: s.getState, enabled: () => true, classifyIfcx: worker.classifyIfcx,
    compute: async job => {
      autoStarted();
      await holdingAuto;
      const output = await worker.compute(job);
      assert(!output.prepared);
      const temporary = readIfcx(output.bytes ?? new TextEncoder().encode(output.content));
      assert.deepEqual(temporary.modelSource, initial.modelSource);
      assert.deepEqual(temporary.elementLinks, initial.elementLinks);
      return output;
    },
  }).flush();
  await computingAuto;
  edit('Nieuwere handmatige opslag');
  const nextSave = save(s);
  resumeAuto();
  await simultaneous;
  assert.equal(await nextSave, true);
  const newest = readIfcx(readFileSync(plan));
  assert.equal(newest.tasks.find(t => t.id === task)?.name, 'Nieuwere handmatige opslag');
  assert.deepEqual(newest.elementLinks, initial.elementLinks);
  assert.deepEqual(newest.modelSource, initial.modelSource);
  edit('Verkeerd doel');
  for (const path of [model, join(dir, 'geen-ifcx.ifc')]) {
    s.setState(st => { st.filePath = path; st.knownTargetFingerprint = null; });
    const before = ipc.calls.length;
    await auto(s);
    assert.equal(ipc.calls.slice(before).some(c => c.wrote), false);
    assert.equal(s.getState().isDirty, true);
    assert.deepEqual(readFileSync(model), modelBytes);
  }
  console.log('OK Automatisch opslaan neemt de verwijzingen mee en weigert het model en een STEP-doel');

  const bytes = readFileSync(manifestPath);
  await saveFeatureFlags({});
  await assert.rejects(loadRecovery, RecoveryManifestError);
  await assert.rejects(clearRecovery, RecoveryManifestError);
  assert.deepEqual(readFileSync(manifestPath), bytes);
  await saveFeatureFlags(flags);
  await clearRecovery();
  s.setState(st => { st.ui.featureFlags = {}; });
  await saveFeatureFlags({});
  await tick(s);
  assert.equal(manifest().version, 5);
  assert(!(await loadRecovery()).docs.some(d => d.id === s.getState().activeDocumentId));
  const ordinary = app();
  ordinary.setState(state => { state.ui.featureFlags = {}; });
  const ordinaryTask = ordinary.getState().addTask({ name: 'Gewone planning' });
  const ordinaryTracker = new RecoveryDeltaTracker();
  assert.equal(await tick(ordinary, ordinaryTracker), true);
  const plainManifest = readFileSync(manifestPath);
  assert.equal(manifest().version, 5);
  const plainSnapshot = (await loadRecovery()).docs[0].ifc;
  ordinary.setState(state => { state.ui.featureFlags = flags; });
  await saveFeatureFlags(flags);
  assert.equal(await tick(ordinary, ordinaryTracker), false);
  assert.deepEqual(readFileSync(manifestPath), plainManifest);
  assert.equal((await loadRecovery()).docs[0].ifc, plainSnapshot);
  assert.equal((await restore()).getState().tasks.find(t => t.id === ordinaryTask)?.name, 'Gewone planning');
  console.log('OK flag uit weigert een versie 6 en laat haar staan, gewone herstelsets blijven versie 5');
} finally { ipc.dispose(); }

await saveFeatureFlags(flags);
class BrowserHandle {
  constructor(readonly name: string, readonly path: string) {}
  async getFile() { return new File([new Uint8Array(readFileSync(this.path))], this.name); }
  async isSameEntry(other: BrowserHandle) { return this.path === other.path; }
  async queryPermission() { return 'granted'; }
  async createWritable() {
    let bytes: Uint8Array;
    return { write: async (data: Uint8Array | Blob) => { bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data; },
      close: async () => writeFileSync(this.path, bytes) };
  }
}
const browser = app();
await open(browser, plan, null);
browser.getState().updateTask(browser.getState().tasks[0].id, { name: 'Browserbewerking' });
await tick(browser);
const webManifest = [...db.store('records').values()].find(value => (value as { kind: string }).kind === 'manifest') as { version: number };
assert.equal(webManifest.version, 6);
const web = await restore();
assert.deepEqual(web.getState().ifcxReferences, browser.getState().ifcxReferences);
assert.equal(saveTargetRef(web.getState()), null);
assert.equal(uncheckedModelLinks(web.getState()), true);
console.log('OK webmanifest met exacte doelpaden, zonder modeltoegang of schrijfdoel');

const browserFiles = app();
const modelHandle = new BrowserHandle(basename(model), model) as unknown as FileSystemFileHandle;
const planHandle = new BrowserHandle(basename(plan), plan) as unknown as FileSystemFileHandle;
await open(browserFiles, model, { kind: 'handle', handle: modelHandle });
await open(browserFiles, plan, { kind: 'handle', handle: planHandle });
assert.equal(browserFiles.getState().fileHandle, planHandle);
assert((await loadRecents()).some(e => e.ref.kind === 'handle' && e.name === basename(plan)), 'de browser bewaart het planningsdoel in Recent');
await tick(browserFiles);
const webWithTarget = await restore();
assert.equal(await webWithTarget.getState().fileHandle?.isSameEntry(planHandle), true);
assert.equal(uncheckedModelLinks(webWithTarget.getState()), false);
webWithTarget.getState().updateTask(webWithTarget.getState().tasks[0].id, { name: 'Herstelde browserplanning' });
assert.equal(await save(webWithTarget), true);
assert.equal(readIfcx(readFileSync(plan)).tasks[0].name, 'Herstelde browserplanning');
assert.deepEqual(readIfcx(readFileSync(plan)).elementLinks, readIfcx(planBytes).elementLinks);
assert.deepEqual(readFileSync(model), modelBytes);
const records = [...db.store('records').values()];
assert(!JSON.stringify(records).includes('"kind":"handle"'));
console.log('OK hersteld met de eerdere browserhandle uit Recent, model gecontroleerd en Ctrl+S op de eigen planning');
const recentPlan = (await loadRecents()).find(entry => entry.ref.kind === 'handle' && entry.name === basename(plan));
assert(recentPlan);
await removeRecent(recentPlan.id);
const evicted = await restore();
assert.equal(saveTargetRef(evicted.getState()), null);
assert.deepEqual(evicted.getState().ifcxReferences, browserFiles.getState().ifcxReferences);
console.log('OK een verdwenen Recent-verwijzing wijst geen nieuw schrijfdoel aan');
