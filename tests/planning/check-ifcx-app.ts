import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { installDeterminism } from './ifcPariteitKern';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
import { InProcessWorker } from './inProcessSaveWorker';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import {
  binaryExtensions, isReadableFileName, openDialogFilters, parseOpenedFile, readFormatForFile, readOptionsFor, readsAsBytes,
} from '@/services/formatRegistry';
import { splitDroppedFiles } from '@/services/fileAccess/fileDrop';
import { documentFileFilters, isIfcxName, nameWithFormat, outputFormat } from '@/state/ifcxGuard';
import { computeIfcOutputHere, documentSaveCompute, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { readIfcx, classifyIfcx, writeIfcx } from '@/services/ifc/ifcx';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { payloadFromImport } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { documentDataFromImport } from '@/services/documentData';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { readXER } from '@/services/xer/xerReader';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { flushRecoveryNow, registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { changedOnDiskShown } from '@/state/openDocumentFor';
import { taskElementLinks, uncheckedModelLinks } from '@/state/taskElementLinks';
import { createSnapshot, documentDataChanged } from '@/state/snapshot';
import { setSiteSaveAsker, resetSiteAskers } from '@/services/fileAccess/siteDialogs';
import { fileToolDeps, realFs } from '@/services/mcp/tools/fileTools';
import { resetPlanOnlyAsker, setPlanOnlyAsker, type PlanOnlyReason } from '@/services/ifc/planOnlyQuestion';
import { resetIfcSchemaAsker, setIfcSchemaAsker } from '@/services/ifc/ifcSchemaQuestion';
import { fixture as maximalFixture } from './ifcRoundtripFixture';
import { getTool } from '@/services/mcp/toolRegistry';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import type { FeatureFlagValues } from '@/utils/featureFlags';
import type { FileRef } from '@/services/fileAccess';
import type { Task } from '@/types/task';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = ['verbouwing-eengezinswoning-kern.ifcx', 'datumgevallen.ifcx'];
const fixture = (name: string) => new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifcx/eigen', name)));
const own = fixture(FIXTURES[0]);
const other = fixture(FIXTURES[1]);
const withModel = fixture('planning-met-model.ifcx');
const facade = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifcx/extern/gevel.ifcx')));
const linkedModel = new Uint8Array(readFileSync(join(root, 'docs/superpowers/evidence/2026-11-27-ifcx-verwijzing-los-modelbestand/model.ifcx')));
const dir = mkdtempSync(join(tmpdir(), 'ops-ifcx-app-'));
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const text = (data: Uint8Array) => new TextDecoder().decode(data);
const isIfcxText = (data: Uint8Array) => text(data).startsWith('{') && JSON.parse(text(data)).header.ifcxVersion === 'ifcx_alpha';
const isStep = (data: Uint8Array) => text(data).startsWith('ISO-10303-21;');
const bytesAt = (path: string) => new Uint8Array(readFileSync(path));
const IFCX_ON: FeatureFlagValues = { ifcx: true };
const BOTH_ON: FeatureFlagValues = { ifcx: true, ifcForeignContent: true };
const IFC_FILTER = { name: 'IFC Files', extensions: ['ifc'] };
const IFCX_FILTER = { name: 'IFCX Files', extensions: ['ifcx'] };
const ownStep = new TextEncoder().encode(writeIFC(buildWriteIFCInput(documentDataFromImport(structuredClone(readIfcx(own))), 'planOnly')));

let passed = 0, failed = 0;
const only = process.env.OPS_IFCX_APP_ONLY ? new RegExp(process.env.OPS_IFCX_APP_ONLY) : null;
async function check(name: string, action: () => Promise<void>) {
  if (only && !only.test(name)) return;
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) {
    failed++;
    const shown = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : JSON.stringify(error);
    console.error(`XX ${name}: ${shown.slice(0, 2000)}`);
  }
}

type DialogCall = { defaultPath?: string; filters?: { name: string; extensions: string[] }[] };
function desktop(appDataDir: string = mkdtempSync(join(tmpdir(), 'ops-ifcx-appdata-'))) {
  const ipc = installNodeFileIpc({ appDataDir });
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const invoke = win.__TAURI_INTERNALS__.invoke;
  let answer: string | null = null;
  let after: string | null | undefined;
  const dialogs: DialogCall[] = [];
  win.__TAURI_INTERNALS__.invoke = async (...args) => {
    if (args[0] === 'plugin:dialog|save') {
      dialogs.push(((args[1] ?? {}) as { options?: DialogCall }).options ?? {});
      const chosen = answer;
      if (after !== undefined) { answer = after; after = undefined; }
      return chosen;
    }
    return invoke(...args);
  };
  return { ...ipc, dialogs, choose: (path: string | null, next?: string | null) => { answer = path; after = next; } };
}

function saveWorker(mode: 'auto' | 'none' = 'auto') {
  const workers: InProcessWorker[] = [];
  const client = createIfcSaveWorker({ createWorker: () => {
    if (mode === 'none') return null;
    const w = new InProcessWorker('auto'); workers.push(w); return w;
  } });
  const requests = () => workers.flatMap(w => w.requests);
  return {
    client,
    jobs: () => requests().flatMap(r => 'job' in r ? [r.job] : []),
    classified: () => requests().filter(r => 'classify' in r).length,
  };
}
type SaveWorker = ReturnType<typeof saveWorker>;

const workerOf = new WeakMap<object, SaveWorker>();
const appOf = new WeakMap<object, { runtime: { ifcSaveCompute?: IfcOutputCompute; ifcxClassify?: (bytes: Uint8Array) => Promise<'own' | 'foreign' | 'not-ifcx' | 'unreadable'> } }>();
async function newApp(flags: FeatureFlagValues, worker: SaveWorker | null = saveWorker(), wrap?: (compute: IfcOutputCompute) => IfcOutputCompute) {
  const { createAppStoreContext } = await loadStore();
  const compute = worker && (wrap ? wrap(worker.client.compute) : worker.client.compute);
  const app = createAppStoreContext(worker ? { ifcSaveCompute: compute!, ifcxClassify: worker.client.classifyIfcx } : {});
  app.store.setState(s => { s.ui.featureFlags = { ...flags }; });
  if (worker) workerOf.set(app.store, worker);
  appOf.set(app.store, app);
  return app;
}
type App = Awaited<ReturnType<typeof newApp>>;
type Store = App['store'];
async function openInto(store: Store, path: string) {
  const ref: FileRef = { kind: 'path', path };
  const data = bytesAt(path);
  const opened = readsAsBytes(path, readOptionsFor(store.getState().ui.featureFlags)) ? { content: '', bytes: data } : { content: text(data) };
  await store.getState().openOpenedFile({ name: basename(path), ...opened, ref });
}
async function openApp(path: string, flags: FeatureFlagValues, worker?: SaveWorker | null, wrap?: (compute: IfcOutputCompute) => IfcOutputCompute) {
  const app = await newApp(flags, worker === undefined ? saveWorker() : worker, wrap);
  await openInto(app.store, path);
  return app;
}
const openAt = async (path: string, flags: FeatureFlagValues, worker?: SaveWorker | null) => (await openApp(path, flags, worker)).store;
const save = (store: Store) => store.getState().saveFileForDocument(store.getState().activeDocumentId);
const autosaveOf = (store: Store) => createFileAutoSaveController({
  getState: store.getState, enabled: () => true,
  compute: appOf.get(store)?.runtime.ifcSaveCompute, classifyIfcx: appOf.get(store)?.runtime.ifcxClassify,
});
const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
const clearNotices = (store: Store) => store.setState(s => { s.ui.notifications = []; });
const setFlags = (store: Store, flags: FeatureFlagValues) => store.setState(s => { s.ui.featureFlags = { ...flags }; });
function shiftFirstTask(store: Store): string {
  const task = store.getState().tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
  store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
  store.getState().runCPM();
  return task.id;
}
const shown = (tasks: readonly Task[]) => JSON.stringify(tasks.map(t => [t.id,
  t.time.scheduleStart, t.time.scheduleFinish, t.time.earlyStart, t.time.earlyFinish, t.time.lateStart, t.time.lateFinish,
  t.time.scheduleDuration, t.time.totalFloat]));
const mcpContext = (app: App) => ({
  app, transactions: createMcpTransactions(app), expectedDocId: app.store.getState().activeDocumentId, tempIdMap: new Map(),
  paused: false, readOnly: false, ensureBackup: async () => null, markDuplicateBorn: () => {},
});
async function exportViaMcp(app: App, path: string) {
  const getFs = fileToolDeps.getFs;
  fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
  try { return await getTool('planner_export_ifc')!.handler({ path, overwrite: true }, mcpContext(app)); }
  finally { fileToolDeps.getFs = getFs; }
}
async function recoverInto(store: Store, flags: FeatureFlagValues): Promise<Store> {
  await clearRecovery();
  const tracker = new RecoveryDeltaTracker();
  const unregister = registerRecoveryFlush(async () => {
    const s = store.getState();
    await runRecoveryTick(tracker, s.activeDocumentId,
      s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, !!s.ui.featureFlags.ifcForeignContent, !!s.ui.featureFlags.ifcx)));
  });
  try { await flushRecoveryNow(); } finally { unregister(); }
  const loaded = await loadRecovery();
  assert.deepEqual(loaded.docs.map(doc => doc.id), store.getState().getOpenDocumentPayloads()
    .filter(doc => !doc.payload.ifcxReferences || store.getState().ui.featureFlags.ifcx).map(doc => doc.id));
  const restored = (await newApp(flags)).store;
  const inputs = [];
  for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, false));
  assert.equal(restored.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  return restored;
}

await check('flag uit: leesopties, filters, slepen en de schrijftaak zijn die van main', async () => {
  const off = readOptionsFor({});
  assert.deepEqual(off, { ifcBytes: false });
  assert.deepEqual(readOptionsFor({ ifcForeignContent: true }), { ifcBytes: true });
  assert.deepEqual(openDialogFilters(off), openDialogFilters());
  assert.deepEqual(openDialogFilters(off)[0].extensions, ['ifc', 'csv', 'xml', 'mpp', 'xer']);
  assert.deepEqual(binaryExtensions(off), ['mpp', 'xer']);
  assert.equal(isReadableFileName('plan.ifcx', off), false);
  assert.equal(readFormatForFile('plan.ifcx', off).id, 'ifc');
  assert.equal(outputFormat({ fileFormat: 'ifc' }, {}), 'ifc');
  assert.equal(outputFormat({ fileFormat: 'ifcx' }, {}), 'ifc', 'een IFCX-document schrijft met de flag uit nooit IFCX');
  assert.deepEqual(documentFileFilters(outputFormat({ fileFormat: 'ifc' }, {})), [{ name: 'IFC Files', extensions: ['ifc'] }]);
  assert.equal(documentSaveCompute({}, computeIfcOutputHere, 'ifc'), computeIfcOutputHere, 'de schrijftaak is die van main');
  assert.equal(documentSaveCompute({}, undefined, 'ifc'), computeIfcOutputHere, 'zonder worker rekent STEP hier, zoals main');
  const split = splitDroppedFiles([{ name: 'plan.ifcx', read: async () => { throw new Error('niet lezen'); } }], off);
  assert.deepEqual(split.refused, ['plan.ifcx']);
});

await check('flag aan: IFCX in de filters, bij slepen en als bytes; één naamregel (ifcx zonder punt is geen IFCX)', async () => {
  const on = readOptionsFor(IFCX_ON);
  assert.equal(on.ifcx, true);
  assert.deepEqual(openDialogFilters(on)[0].extensions, ['ifc', 'ifcx', 'csv', 'xml', 'mpp', 'xer']);
  assert(openDialogFilters(on).some(f => f.name === 'IFCX Files'));
  assert.deepEqual(binaryExtensions(on), ['ifcx', 'mpp', 'xer']);
  assert.equal(isReadableFileName('plan.IFCX', on), true);
  assert.equal(readFormatForFile('plan.ifcx', on).id, 'ifcx');
  assert.equal(readFormatForFile('plan.ifcx', on).canBeSaveTarget, true);
  for (const name of ['ifcx', '/map/ifcx', 'IFCX']) {
    assert.equal(isIfcxName(name), false, `${name} is geen IFCX-naam`);
    assert.equal(readFormatForFile(name, on).id, 'ifc', `de registry volgt dezelfde regel voor ${name}`);
    assert.equal(isReadableFileName(name, on), false);
  }
  assert.equal(outputFormat({ fileFormat: 'ifcx' }, IFCX_ON), 'ifcx');
  assert.equal(outputFormat({ fileFormat: 'ifc' }, IFCX_ON), 'ifc', 'een als STEP gelezen document blijft STEP, ook met de flag aan');
  assert.deepEqual(documentFileFilters('ifcx'), [{ name: 'IFCX Files', extensions: ['ifcx'] }]);
  assert.equal(nameWithFormat('plan.ifcx', 'ifc'), 'plan.ifc');
  assert.equal(nameWithFormat('plan.ifc', 'ifcx'), 'plan.ifcx');
  assert.equal(nameWithFormat('plan', 'ifcx'), 'plan.ifcx');
  assert.equal(nameWithFormat('plan.ifc', 'ifc'), 'plan.ifc');
});

await check('flag uit: een .ifcx opent niet als IFCX', async () => {
  const path = join(dir, 'uit.ifcx'); writeFileSync(path, own);
  const store = await openAt(path, {});
  assert.notEqual(store.getState().filePath, path);
  assert.deepEqual(errors(store), ['notifications.openFailed']);
});

await check('een onbekende IFCX-versie meldt ifcx.open.unsupportedVersion; een nieuwer profiel ifcx.open.newer (#804, knownbug 2393)', async () => {
  const versionDoc = JSON.parse(text(own));
  versionDoc.header.ifcxVersion = 'ifcx_beta';
  const versionPath = join(dir, 'andere-versie.ifcx');
  writeFileSync(versionPath, JSON.stringify(versionDoc));
  const versionStore = await openAt(versionPath, IFCX_ON);
  assert.deepEqual(errors(versionStore), ['ifcx.open.unsupportedVersion']);

  const profileDoc = JSON.parse(text(own));
  const documentEntry = profileDoc.data.find((entry: { attributes?: Record<string, unknown> }) => entry.attributes?.['openaec::ops::document']);
  (documentEntry.attributes['openaec::ops::document'] as Record<string, unknown>).formatVersion = '2.0.0';
  const profilePath = join(dir, 'nieuwer-profiel.ifcx');
  writeFileSync(profilePath, JSON.stringify(profileDoc));
  const profileStore = await openAt(profilePath, IFCX_ON);
  assert.deepEqual(errors(profileStore), ['ifcx.open.newer']);

});

await check('modelbron openen en een eigen planning ernaast opslaan en heropenen', async () => {
  const ipc = desktop();
  try {
    const model = facade;
    const path = join(dir, 'gevel.ifcx'), plan = join(dir, 'gevel - planning.ifcx');
    writeFileSync(path, model);
    const store = await openAt(path, IFCX_ON);
    assert.deepEqual(errors(store), []);
    assert.equal(store.getState().tasks.length, 0);
    assert.equal(store.getState().filePath, null);
    assert.equal(store.getState().knownTargetFingerprint, null);
    assert.equal(store.getState().project.name, 'gevel - planning');
    assert.equal(store.getState().documents.length, 2);
    assert(store.getState().ui.notifications.some(n => n.messageKey === 'ifcx.model.opened'));
    const id = store.getState().addTask({ name: 'Gevel plaatsen' });
    ipc.choose(path);
    assert.equal(await save(store), false);
    assert.deepEqual(bytesAt(path), model);
    clearNotices(store);
    ipc.choose(plan);
    assert.equal(await save(store), true);
    assert.equal(ipc.dialogs[0].defaultPath, plan);
    assert.equal(store.getState().filePath, plan);
    assert(ipc.calls.some(c => c.command === 'place_file_exclusive'));
    const written = readIfcx(bytesAt(plan));
    assert.deepEqual(written.modelSource, { fileName: 'gevel.ifcx', sha256: hash(model) });
    assert.equal(written.tasks.find(t => t.id === id)?.name, 'Gevel plaatsen');
    const reopened = await openAt(plan, IFCX_ON);
    const jobs = workerOf.get(store)!.jobs();
    for (const job of jobs) {
      assert.equal(job.kind, 'writer');
      assert(!('ifcxModel' in job.input) && !('ifcxReferences' in job.input) && !('fileHandle' in job.input));
    }
    reopened.getState().updateTask(id, { name: 'Gevel gereed' });
    assert.equal(await save(reopened), true);
    assert.equal(readIfcx(bytesAt(plan)).tasks.find(t => t.id === id)?.name, 'Gevel gereed');
    assert.deepEqual(readIfcx(bytesAt(plan)).modelSource, written.modelSource);
    assert.deepEqual(bytesAt(path), model);
    assert.deepEqual(errors(await openAt(path, {})), ['notifications.openFailed']);
    const otherTab = reopened.getState().activeDocumentId;
    reopened.getState().newDocument();
    assert.equal(await reopened.getState().foreignTargetCheck(null)({ kind: 'path', path }), true);
    const alias = join(dir, 'alias-gevel.csv');
    symlinkSync(path, alias);
    assert.equal(await reopened.getState().foreignTargetCheck(null)({ kind: 'path', path: alias }), true);
    ipc.choose(alias);
    await reopened.getState().exportAs('csv');
    assert.deepEqual(bytesAt(path), model);
    ipc.choose(path);
    await reopened.getState().exportAs('csv');
    assert.deepEqual(bytesAt(path), model);
    reopened.getState().switchDocument(otherTab);
    clearNotices(reopened);
    ipc.choose(path);
    await reopened.getState().saveFileAs();
    assert.deepEqual(errors(reopened), ['notifications.ifcForeignTargetSave']);
    assert.deepEqual(bytesAt(path), model);
    const mixed = JSON.parse(text(model));
    mixed.data.push({ path: 'taak', attributes: { 'openaec::planning::activity': {} } });
    const mixedPath = join(dir, 'gemengd.ifcx');
    writeFileSync(mixedPath, JSON.stringify(mixed));
    assert.deepEqual(errors(await openAt(mixedPath, IFCX_ON)), ['ifcx.open.foreign']);
    mixed.data = [];
    writeFileSync(mixedPath, JSON.stringify(mixed));
    assert.deepEqual(errors(await openAt(mixedPath, IFCX_ON)), ['ifcx.open.foreign']);
  } finally { ipc.dispose(); }
});

await check('modelkoppelingen bij het heropenen met een gelijk, gewijzigd of ontbrekend buurmodel', async () => {
  const model = linkedModel;
  const original = readIfcx(withModel);
  assert.equal(original.modelSource?.sha256, hash(model));
  const id = original.tasks[0].id;
  for (const status of ['gelijk', 'gewijzigd', 'ontbreekt', 'geen leesrecht', 'eigen naam', 'alias van planning']) {
    const ipc = desktop();
    try {
      const folder = mkdtempSync(join(dir, status));
      const path = join(folder, 'model.ifcx');
      const plan = status === 'eigen naam' ? path : join(folder, 'planning-met-model.ifcx');
      if (status === 'gelijk' || status === 'geen leesrecht') writeFileSync(path, model);
      if (status === 'geen leesrecht') ipc.faults.onCall = (command, candidate) => {
        if (command === 'plugin:fs|read_file' && candidate === path) throw new Error('Geen leesrecht');
      };
      if (status === 'gewijzigd') {
        const changed = JSON.parse(text(model));
        changed.data.pop();
        writeFileSync(path, JSON.stringify(changed));
      }
      writeFileSync(plan, withModel);
      if (status === 'alias van planning') symlinkSync(plan, path);
      const store = await openAt(plan, IFCX_ON);
      assert.deepEqual(errors(store), []);
      assert.deepEqual(store.getState().ifcxReferences?.modelSource, original.modelSource);
      assert.equal(uncheckedModelLinks(store.getState()), status !== 'gelijk');
      const links = () => taskElementLinks(store.getState(), id);
      const before = createSnapshot(store.getState());
      const removed = { ...before, ifcxReferences: { ...before.ifcxReferences, elementLinks: new Map() } };
      assert.equal(documentDataChanged(before, removed), true);
      assert.deepEqual(links()?.map(link => [link.target, link.found]), [
        ['e671b834-a918-42c4-9901-000000000001', status === 'gelijk'], ['/gevel/Raam-02', false],
      ]);
      const notices = store.getState().ui.notifications.filter(n => n.messageKey === 'ifcx.model.unchecked');
      assert.deepEqual(notices.map(n => n.params?.file), status === 'gelijk' ? [] : ['model.ifcx']);
      store.getState().deleteTask(id);
      store.getState().undo();
      assert.equal(links()?.length, 2);
      const tab = store.getState().activeDocumentId;
      store.getState().newDocument();
      store.getState().switchDocument(tab);
      assert.equal(links()?.[0].found, status === 'gelijk');
      const edited = shiftFirstTask(store);
      store.getState().setAutoSaveToFile(true);
      await autosaveOf(store).flush();
      const automatic = readIfcx(bytesAt(plan));
      assert.deepEqual(automatic.modelSource, original.modelSource);
      assert.deepEqual(automatic.elementLinks, original.elementLinks);
      assert.equal(automatic.tasks.find(task => task.id === edited)?.time.scheduleDuration,
        store.getState().tasks.find(task => task.id === edited)!.time.scheduleDuration);
      assert.equal(workerOf.get(store)!.jobs().length, 1);
      assert.equal(await save(store), true, `Ctrl+S schrijft de eigen planning bij ${status}`);
      const written = readIfcx(bytesAt(plan));
      assert.equal(written.tasks.find(task => task.id === edited)?.time.scheduleDuration,
        store.getState().tasks.find(task => task.id === edited)!.time.scheduleDuration);
      assert.deepEqual(written.modelSource, original.modelSource);
      assert.deepEqual(written.elementLinks, original.elementLinks);
      localStorage.setItem('ops-featureFlags', JSON.stringify(IFCX_ON));
      const recovery = await recoverInto(store, IFCX_ON);
      localStorage.removeItem('ops-featureFlags');
      assert.equal(recovery.getState().filePath, plan);
      assert.deepEqual(recovery.getState().ifcxReferences, store.getState().ifcxReferences);
      assert.equal(uncheckedModelLinks(recovery.getState()), status !== 'gelijk');
      const reopened = await openAt(plan, IFCX_ON);
      assert.equal(await save(reopened), true);
      assert.deepEqual(readIfcx(bytesAt(plan)).elementLinks, original.elementLinks);
      assert.deepEqual(readIfcx(bytesAt(plan)).modelSource, original.modelSource);
      if (status === 'gelijk') {
        assert.deepEqual(bytesAt(path), model);
        const step = join(folder, 'omgezet.ifc');
        ipc.choose(step);
        await reopened.getState().saveFileAs();
        assert.deepEqual(errors(reopened), ['ifcx.model.saveAsIfc']);
        assert.equal(existsSync(step), false);
        clearNotices(reopened);
        const beforeExport = bytesAt(plan);
        const exported = await reopened.getState().exportAs('ifc');
        assert(exported.ok && !exported.cancelled);
        assert(isStep(bytesAt(step)));
        const lossNotices = (store: typeof reopened) => store.getState().ui.notifications.filter(n => n.messageKey === 'ifcx.model.ifcExportLoss').length;
        assert.equal(lossNotices(reopened), 1);
        assert.deepEqual(bytesAt(plan), beforeExport);
        const plain = await openAt(step, IFCX_ON);
        assert.equal(plain.getState().ifcxReferences, null);
        const copy = join(folder, 'kopie.ifc');
        ipc.choose(copy);
        const exportedPlain = await plain.getState().exportAs('ifc');
        assert(exportedPlain.ok && !exportedPlain.cancelled);
        assert(isStep(bytesAt(copy)));
        const pooledCopy = join(folder, 'kopie-met-bibliotheek.ifc'), plainLibrary = join(folder, 'kopie-bibliotheek.ifc');
        plain.getState().setProject({ companyId: plain.getState().seedDemoLibrary(), companyName: 'Proefbedrijf' });
        ipc.choose(pooledCopy, plainLibrary);
        const pooledPlain = await plain.getState().exportProjectWithPool();
        assert(pooledPlain.ok && !pooledPlain.cancelled);
        assert(isStep(bytesAt(pooledCopy)) && existsSync(plainLibrary));
        assert.equal(lossNotices(plain), 0);
        reopened.getState().setProject({ companyId: reopened.getState().seedDemoLibrary(), companyName: 'Proefbedrijf' });
        const libraryFile = join(folder, 'bibliotheek.ifc');
        for (const [name, library] of [['bibliotheek-geannuleerd.ifc', null], ['met-bibliotheek.ifc', libraryFile]] as const) {
          clearNotices(reopened);
          const pooledStep = join(folder, name);
          ipc.choose(pooledStep, library);
          const pooled = await reopened.getState().exportProjectWithPool();
          assert(pooled.ok && !!pooled.cancelled === (library === null));
          assert(isStep(bytesAt(pooledStep)));
          assert.equal(existsSync(libraryFile), library !== null);
          assert.equal(lossNotices(reopened), 1);
          assert.deepEqual(bytesAt(plan), beforeExport);
          assert.deepEqual(bytesAt(path), model);
        }
      }
    } finally { ipc.dispose(); }
  }
});

for (const [label, flags] of [['alleen ifcx', IFCX_ON], ['ifcx en ifcForeignContent', BOTH_ON]] as const) {
  await check(`${label}: openen legt formaat en versie vast; Ctrl+S schrijft IFCX in de worker, met de bekende versie en zonder classificatie`, async () => {
    const ipc = desktop();
    try {
      const path = join(dir, `ctrl-s-${flags.ifcForeignContent ? 'beide' : 'ifcx'}.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, flags);
      const sw = workerOf.get(store)!;
      assert.equal(store.getState().filePath, path);
      assert.equal(store.getState().fileFormat, 'ifcx');
      assert.deepEqual(store.getState().knownTargetFingerprint, { sha256: hash(own), byteLength: own.byteLength, origin: 'opened' },
        'de lezer legt de versie vast, ook met ifcForeignContent uit');
      const id = shiftFirstTask(store);
      const duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
      assert.equal(await save(store), true);
      assert.deepEqual(errors(store), []);
      const written = bytesAt(path);
      assert(isIfcxText(written), 'het bestand is IFCX');
      assert.equal(readIfcx(written).tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
      assert.equal(store.getState().isDirty, false);
      assert.deepEqual(store.getState().knownTargetFingerprint, { sha256: hash(written), byteLength: written.byteLength, origin: 'written' });
      assert.deepEqual(store.getState().ui.notifications.filter(n => n.messageKey.startsWith('notifications.foreignChanges')), [],
        'geen telling van vreemde gegevens (#1199): een IFCX-document heeft geen vreemd deel');
      assert.deepEqual(sw.jobs().map(j => j.kind === 'writer' && j.format), ['ifcx'], 'de worker rekende IFCX');
      assert.equal(sw.classified(), 0, 'het eigen doel met een bekende versie gaat niet door de classificatie');
      const tabs = store.getState().getOpenDocumentPayloads().length;
      await openInto(store, path);
      assert.equal(store.getState().getOpenDocumentPayloads().length, tabs, 'opnieuw openen geeft geen tweede tabblad');
      const from = ipc.calls.length;
      const reopened = await openAt(path, flags);
      assert.equal(reopened.getState().ifcxReferences, null);
      assert(!reopened.getState().ui.notifications.some(n => n.messageKey.startsWith('ifcx.model.')));
      assert(!ipc.calls.slice(from).some(c => c.command === 'plugin:fs|read_file' && c.path?.startsWith(dir) && c.path !== path));
      assert.equal(shown(reopened.getState().tasks), shown(store.getState().tasks), 'heropend: dezelfde datums');
      assert.deepEqual([...(readIfcx(written).ifcLiteralCalendarIds ?? [])].sort(),
        [...(store.getState().ifcLiteralCalendarIds ?? [])].sort(), 'de letterlijke kalenders van het bestand zijn vastgelegd');
    } finally { ipc.dispose(); }
  });
}

const NOT_IN_KERN_TASK_FIELDS = [
  'customTaskTypeId', 'levelingDelay', 'levelingDelayMinutes', 'levelingDelayElapsed', 'splitGaps', 'timephasedFinishFloor',
  'timephasedStartAnchor', 'timephasedDurationWalks', 'timephasedContours', 'mspTaskType', 'effortDriven', 'workRule',
  'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow', 'p6CompletePctType',
  'p6ExpectedFinish', 'p6SuspendResume', 'color', 'activityCodes', 'customFields', 'constraint', 'constraint2', 'isHammock',
  'externalLinks', 'deadline', 'notes',
];
const NOT_IN_KERN_PROJECT_FIELDS = [
  'progressMode', 'schedulingOptions', 'schedulingProfile', 'defaultWorkRule', 'companyId', 'companyName', 'p6ProjectCode',
  'dependentProjectsFolder', 'anchorsFromOpenDocuments',
];
const without = <T extends object>(object: T, keys: readonly string[]): T => {
  const copy = { ...object } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy as T;
};
const kernPlanning = (full: ImportResult): ImportResult => ({
  ...full, resources: [], assignments: [], baselines: [], activeBaselineId: null, comparedBaselineIds: [null, null],
  activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [], libraryPool: undefined,
  project: without(full.project, NOT_IN_KERN_PROJECT_FIELDS),
  tasks: full.tasks.map(task => ({ ...without(task, NOT_IN_KERN_TASK_FIELDS), resourceIds: [], time: without(task.time, ['progressBeforeRecalculation']) })),
  sequences: full.sequences.map(sequence => without(sequence, ['p6StartAtPredecessorFinishBoundary'])),
});
const planningOf = (input: object) => {
  const { project, ...rest } = JSON.parse(JSON.stringify(input));
  return { ...rest, project: { ...project, modifiedAt: undefined } };
};
const sameFields = (a: Record<string, unknown>, b: Record<string, unknown>, label: string) => {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) assert.deepEqual(a[key], b[key], `${label}: het veld ${key}`);
};

for (const example of ['showcase-verbouwing-eengezinswoning.ifc', '03-kantoorgebouw-zuidas.ifc']) {
  await check(`IFCX en STEP uit dezelfde planning (${example}): dezelfde planning vlak vóór de activering en na doorrekenen; de laadgrens verandert niets aan readIfcx`, async () => {
    const kern = kernPlanning(readIFC(readFileSync(join(root, 'public/examples', example), 'utf8')));
    const stepText = writeIFC(kern);
    const ifcxBytes = new TextEncoder().encode(writeIfcx(kern, new Date('2026-11-24T08:00:00.000Z')));
    const options = readOptionsFor(IFCX_ON);
    const fromStep = await parseOpenedFile({ name: 'plan.ifc', text: stepText }, undefined, options);
    const fromIfcx = await parseOpenedFile({ name: 'plan.ifcx', bytes: ifcxBytes }, undefined, options);
    assert(!isMultiDocumentImport(fromStep) && !isMultiDocumentImport(fromIfcx));
    sameFields(planningOf(buildWriteIFCInput(payloadFromImport(fromIfcx, null), 'planOnly')),
      planningOf(buildWriteIFCInput(payloadFromImport(fromStep, null), 'planOnly')), 'vlak vóór de activering');
    const read = readIfcx(ifcxBytes);
    const loaded = documentDataFromImport(structuredClone(read));
    assert.equal(loaded.minuteModelPending, false, 'geen omzetting naar het minutenmodel');
    for (const [key, value] of [['project', read.project], ['calendar', read.calendar], ['tasks', read.tasks], ['sequences', read.sequences],
      ['calendars', read.resourceCalendars ?? []], ['ifcGlobalIds', read.ifcGlobalIds ?? null], ['ifcLiteralCalendarIds', read.ifcLiteralCalendarIds ?? null]] as const) {
      assert.deepEqual(JSON.parse(JSON.stringify(loaded[key])), JSON.parse(JSON.stringify(value)), `de laadgrens laat ${key} zoals readIfcx het gaf`);
    }
    const asIfcx = join(dir, `uit-planning-${example}.ifcx`), asStep = join(dir, `uit-planning-${example}`);
    writeFileSync(asIfcx, ifcxBytes); writeFileSync(asStep, stepText);
    const a = await openAt(asIfcx, IFCX_ON), b = await openAt(asStep, IFCX_ON);
    assert.deepEqual(errors(a), []); assert.deepEqual(errors(b), []);
    sameFields(planningOf(buildWriteIFCInput(a.getState(), 'planOnly')), planningOf(buildWriteIFCInput(b.getState(), 'planOnly')), 'na doorrekenen');
    assert.equal(shown(a.getState().tasks), shown(b.getState().tasks), 'de getoonde datums');
    assert.deepEqual(a.getState().cpmResult?.criticalPath, b.getState().cpmResult?.criticalPath, 'het kritieke pad');
  });
}

await check('Opslaan als (desktop): voorgestelde naam op .ifcx, het IFCX-filter voorop, uitvoer IFCX; met de flag uit STEP met een naam op .ifc', async () => {
  for (const flags of [IFCX_ON, BOTH_ON]) {
    const ipc = desktop();
    try {
      const path = join(dir, `bron-als-${flags.ifcForeignContent ? 'beide' : 'ifcx'}.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, flags);
      shiftFirstTask(store);
      const target = join(dir, `nieuw-${flags.ifcForeignContent ? 'beide' : 'ifcx'}.ifcx`); ipc.choose(target);
      await store.getState().saveFileAs();
      assert.deepEqual(errors(store), []);
      assert.equal(ipc.dialogs.length, 1);
      assert(ipc.dialogs[0].defaultPath?.endsWith('.ifcx'), `voorgestelde naam ${ipc.dialogs[0].defaultPath}`);
      assert.deepEqual(ipc.dialogs[0].filters, [IFCX_FILTER, IFC_FILTER], 'het type van het document voorop, daarna IFC');
      const written = bytesAt(target);
      assert(isIfcxText(written));
      assert.equal(store.getState().filePath, target);
      assert.equal(store.getState().fileFormat, 'ifcx');
      assert.deepEqual(store.getState().knownTargetFingerprint, { sha256: hash(written), byteLength: written.byteLength, origin: 'written' });
      assert.equal(hash(bytesAt(path)), hash(own), 'het oude bestand bleef staan');
    } finally { ipc.dispose(); }
  }
  const ipc = desktop();
  try {
    const path = join(dir, 'uit-als.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    setFlags(store, {});
    const chosen = join(dir, 'uit-als-kopie.ifc'); ipc.choose(chosen);
    await store.getState().saveFileAs();
    assert.deepEqual(errors(store), []);
    assert.equal(ipc.dialogs[0].defaultPath, join(dir, 'uit-als.ifc'), 'de voorgestelde naam volgt het formaat: .ifc');
    assert.deepEqual(ipc.dialogs[0].filters, [{ name: 'IFC Files', extensions: ['ifc'] }]);
    assert(isStep(bytesAt(chosen)));
    assert.equal(store.getState().filePath, chosen);
    assert.equal(store.getState().fileFormat, 'ifc', 'na Opslaan als naar STEP is het een IFC-document');
    assert.equal(hash(bytesAt(path)), hash(own));
    shiftFirstTask(store);
    assert.equal(await save(store), true);
    assert(isStep(bytesAt(chosen)), 'Ctrl+S schrijft daarna STEP naar het nieuwe doel');
  } finally { ipc.dispose(); }
});

type Timeline = string[];
async function tracedApp(flags: FeatureFlagValues, ipc: ReturnType<typeof desktop>) {
  const timeline: Timeline = [];
  const app = await newApp(flags, saveWorker(), compute => (job, stop) => {
    timeline.push(`${job.kind === 'merge' ? 'merge' : job.format ?? 'ifc'}@${ipc.dialogs.length}`);
    return compute(job, stop);
  });
  return { store: app.store, timeline };
}
async function withPlanOnlyAnswers<T>(answers: Partial<Record<PlanOnlyReason, boolean>>, action: (asked: PlanOnlyReason[]) => Promise<T>): Promise<T> {
  const asked: PlanOnlyReason[] = [];
  setPlanOnlyAsker(async reason => { asked.push(reason); return answers[reason] ?? false; });
  try { return await action(asked); } finally { resetPlanOnlyAsker(); }
}
const headerSchema = (data: Uint8Array) => /FILE_SCHEMA\(\('([A-Z0-9_]+)'\)\)/.exec(text(data))?.[1];
const ipcSteps = (ipc: ReturnType<typeof desktop>, from: number) => ipc.calls.slice(from)
  .filter(c => !c.path || !c.path.includes('ops-ifcx-appdata-'))
  .map(c => `${c.command} ${c.path ? basename(c.path).replace(/(save|vorige)-[a-z0-9]+/g, '$1-*').replace(/^.*-(gelijk|zelfde)-/, '') : ''}`);

const examplePath = join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc');
const maximalPath = join(dir, 'maximale-fixture.ifc');
writeFileSync(maximalPath, writeIFC(maximalFixture));

for (const [name, sourcePath] of [['voorbeeld', examplePath], ['maximale fixture', maximalPath]] as const) {
  for (const [label, flags] of [['alleen ifcx', IFCX_ON], ['ifcx en ifcForeignContent', BOTH_ON]] as const) {
    await check(`omzetten (${name}, ${label}): IFC → IFCX en IFCX → IFC met Opslaan als, telkens heropenen en Ctrl+S; de uitvoer van het gekozen type pas na het venster`, async () => {
      const ipc = desktop();
      try {
        const slug = `${name}-${flags.ifcForeignContent ? 'beide' : 'ifcx'}`.replace(/ /g, '-');
        const start = join(dir, `${slug}.ifc`); writeFileSync(start, readFileSync(sourcePath));
        const original = bytesAt(start);
        const { store, timeline } = await tracedApp(flags, ipc);
        await openInto(store, start);
        assert.deepEqual(errors(store), []);
        assert.equal(store.getState().fileFormat, 'ifc');
        shiftFirstTask(store);
        const asIfcx = join(dir, `${slug}-om.ifcx`); ipc.choose(asIfcx);
        await store.getState().saveFileAs();
        assert.deepEqual(errors(store), []);
        assert.deepEqual(ipc.dialogs[0].filters, [IFC_FILTER, IFCX_FILTER], 'IFC voorop bij een IFC-document');
        assert(ipc.dialogs[0].defaultPath?.endsWith('.ifc'), 'de voorgestelde naam houdt het type van het document');
        assert.deepEqual(timeline, ['ifc@0', 'ifcx@1'], 'eerst de uitvoer van het document, na het venster IFCX');
        const written = bytesAt(asIfcx);
        assert(isIfcxText(written), 'het nieuwe bestand is IFCX');
        assert.equal(store.getState().filePath, asIfcx);
        assert.equal(store.getState().fileFormat, 'ifcx');
        assert.equal(store.getState().isDirty, false);
        assert.deepEqual(store.getState().knownTargetFingerprint, { sha256: hash(written), byteLength: written.byteLength, origin: 'written' });
        assert.equal(hash(bytesAt(start)), hash(original), 'het IFC-bestand bleef staan');
        const reopenedIfcx = await openAt(asIfcx, flags);
        assert.deepEqual(errors(reopenedIfcx), []);
        assert.equal(shown(reopenedIfcx.getState().tasks), shown(store.getState().tasks), 'heropend als IFCX: dezelfde datums');
        shiftFirstTask(store);
        assert.equal(await save(store), true, 'Ctrl+S na het omzetten');
        assert.deepEqual(errors(store), []);
        const saved = bytesAt(asIfcx);
        assert(isIfcxText(saved) && hash(saved) !== hash(written), 'Ctrl+S schrijft IFCX naar het nieuwe bestand');
        assert.deepEqual(timeline.slice(2), ['ifcx@1']);

        const back = join(dir, `${slug}-terug.ifc`); ipc.choose(back);
        await store.getState().saveFileAs();
        assert.deepEqual(errors(store), []);
        assert.deepEqual(ipc.dialogs[1].filters, [IFCX_FILTER, IFC_FILTER], 'IFCX voorop bij een IFCX-document');
        assert(ipc.dialogs[1].defaultPath?.endsWith('.ifcx'));
        assert.deepEqual(timeline.slice(3), ['ifcx@1', 'ifc@2']);
        const step = bytesAt(back);
        assert(isStep(step), 'terug als STEP');
        assert.equal(headerSchema(step), headerSchema(original), 'het schema uit Projectinstellingen, dat van het oorspronkelijke bestand');
        assert.equal(store.getState().filePath, back);
        assert.equal(store.getState().fileFormat, 'ifc');
        assert.equal(store.getState().isDirty, false);
        assert.equal(hash(bytesAt(asIfcx)), hash(saved), 'het IFCX-bestand bleef staan');
        const reopenedStep = await openAt(back, flags);
        assert.deepEqual(errors(reopenedStep), []);
        assert.equal(shown(reopenedStep.getState().tasks), shown(store.getState().tasks), 'heropend als IFC: dezelfde datums');
        shiftFirstTask(store);
        assert.equal(await save(store), true);
        assert(isStep(bytesAt(back)) && hash(bytesAt(back)) !== hash(step), 'Ctrl+S schrijft daarna STEP');
      } finally { ipc.dispose(); }
    });
  }
}

await check('IFCX → IFC schrijft het schema uit Projectinstellingen, zonder schemavraag', async () => {
  const asked: string[] = [];
  setIfcSchemaAsker(async question => { asked.push(question.fileSchema); return null; });
  const ipc = desktop();
  try {
    for (const schema of ['IFC4', 'IFC4X3'] as const) {
      const path = join(dir, `schema-${schema}.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, IFCX_ON);
      store.getState().applyProjectInfo({ ifcSchema: schema }, undefined);
      assert.equal(store.getState().project.ifcSchema, schema);
      const target = join(dir, `schema-${schema}.ifc`); ipc.choose(target);
      await store.getState().saveFileAs();
      assert.deepEqual(errors(store), []);
      assert.equal(headerSchema(bytesAt(target)), schema, `het schema ${schema} uit Projectinstellingen`);
      assert.equal(store.getState().fileFormat, 'ifc');
    }
    assert.deepEqual(asked, [], 'geen schemavraag');
  } finally { ipc.dispose(); resetIfcSchemaAsker(); }
});

for (const reopen of [false, true]) {
  const route = reopen ? 'na heropenen' : 'in hetzelfde tabblad';
  await check(`Bonsai van IFC4 naar IFCX: alleen de planning, daarna Ctrl+S en terug naar IFC4 zonder schemavraag (${route})`, async () => {
    const ipc = desktop();
    const schemas: string[] = [];
    setIfcSchemaAsker(async question => { schemas.push(question.fileSchema); return null; });
    try {
      const model = join(dir, `bonsai-${route}.ifc`);
      const target = join(dir, `bonsai-${route}.ifcx`);
      const original = readFileSync(join(root, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc'));
      writeFileSync(model, original);
      const { store, timeline } = await tracedApp(BOTH_ON, ipc);
      await openInto(store, model);
      assert.deepEqual(errors(store), []);
      assert(store.getState().ifcSource?.foreign);
      assert.equal(store.getState().project.ifcSchemaUnconfirmed, 'IFC4');
      const task = store.getState().tasks.find(t => !t.childIds.length)!;
      store.getState().updateTask(task.id, { name: 'Voor omzetting' });
      ipc.choose(target);
      await withPlanOnlyAnswers({ ifcxSaveAs: false }, async asked => {
        await store.getState().saveFileAs();
        assert.deepEqual(asked, ['ifcxSaveAs']);
      });
      assert.deepEqual(errors(store), [], 'annuleren meldt niets');
      assert.equal(existsSync(target), false, 'annuleren schrijft niets');
      assert.deepEqual(timeline, ['merge@0'], 'na annuleren geen tweede berekening');
      assert.equal(store.getState().project.ifcSchemaUnconfirmed, 'IFC4');

      const refused = join(dir, 'beschermd-doel.ifcx');
      writeFileSync(refused, 'onleesbaar doel');
      ipc.choose(refused);
      await withPlanOnlyAnswers({ ifcxSaveAs: true }, async () => { await store.getState().saveFileAs(); });
      assert.deepEqual(errors(store), ['notifications.ifcUnreadableTargetSave']);
      assert.equal(readFileSync(refused, 'utf8'), 'onleesbaar doel');
      assert.deepEqual(timeline.slice(1), ['merge@1', 'ifcx@2']);
      clearNotices(store);
      assert.equal(store.getState().fileFormat, 'ifc');
      assert.equal(store.getState().filePath, model);
      assert(store.getState().ifcSource?.foreign);
      assert.equal(store.getState().project.ifcSchemaUnconfirmed, 'IFC4', 'het IFC-document houdt zijn vraag');

      ipc.choose(target);
      await withPlanOnlyAnswers({ ifcxSaveAs: true }, async asked => {
        await store.getState().saveFileAs();
        assert.deepEqual(asked, ['ifcxSaveAs']);
      });
      assert.deepEqual(timeline.slice(-2), ['merge@2', 'ifcx@3']);
      assert.deepEqual(errors(store), []);
      assert.deepEqual(schemas, []);
      const written = bytesAt(target);
      assert(isIfcxText(written));
      assert.ok(!text(written).includes('"ifcSchemaUnconfirmed"'), 'ook de IFCX-velddefinitie is weg');
      const planning = readIfcx(written);
      assert.equal(planning.tasks.length, store.getState().tasks.length);
      assert.equal(planning.project.ifcSchemaUnconfirmed, undefined, 'het geschreven IFCX draagt geen schemavraag');
      assert.equal(store.getState().project.ifcSchemaUnconfirmed, undefined, 'de vraag is uit het tabblad');
      assert.equal(store.getState().filePath, target);
      assert.equal(store.getState().ifcSource, null);
      assert.equal(store.getState().foreignSourceMark?.sourceMissing, false);
      assert.equal(store.getState().isDirty, false);

      const current = reopen ? await openAt(target, BOTH_ON) : store;
      if (reopen) {
        assert.equal(shown(current.getState().tasks), shown(store.getState().tasks));
      } else {
        current.getState().undo();
        assert.equal(current.getState().tasks.find(t => t.id === task.id)?.name, task.name);
      }
      assert.equal(current.getState().fileFormat, 'ifcx');
      assert.equal(current.getState().project.ifcSchemaUnconfirmed, undefined);
      assert.equal(current.getState().project.ifcSchema, 'IFC4');
      shiftFirstTask(current);
      const saved = await save(current);
      assert.deepEqual(schemas, [], 'Ctrl+S zonder schemavraag');
      assert.equal(saved, true);
      assert.deepEqual(errors(current), []);
      const updated = bytesAt(target);
      assert(isIfcxText(updated) && hash(updated) !== hash(written));
      assert.equal(shown(readIfcx(updated).tasks), shown(current.getState().tasks));

      const back = join(dir, `bonsai-${route}-terug.ifc`);
      ipc.choose(back);
      await current.getState().saveFileAs();
      assert.deepEqual(schemas, [], 'Opslaan als zonder schemavraag');
      assert.deepEqual(errors(current), []);
      assert.equal(current.getState().filePath, back);
      assert.equal(headerSchema(bytesAt(back)), 'IFC4');
      assert.equal(readIFC(text(bytesAt(back))).project.ifcSchemaUnconfirmed, undefined);
      assert.equal(hash(bytesAt(model)), hash(original), 'het bronmodel bleef byte-gelijk');
    } finally { ipc.dispose(); resetIfcSchemaAsker(); }
  });
}

await check('een eerder geschreven IFCX met een open vraag kan rechtstreeks terug naar IFC', async () => {
  const ipc = desktop();
  const asked: string[] = [];
  setIfcSchemaAsker(async question => { asked.push(question.fileSchema); return null; });
  try {
    const path = join(dir, 'oude-schemavraag.ifcx');
    const legacy = text(own).replace('            "wbsAutoNumber": {', [
      '            "ifcSchemaUnconfirmed": {', '              "dataType": "String",', '              "optional": true',
      '            },', '            "wbsAutoNumber": {',
    ].join('\n'));
    assert.equal(classifyIfcx(new TextEncoder().encode(legacy)), 'own', 'oud schema zonder open vraag');
    const marked = legacy.replace('"ifcSchema":"IFC4X3_ADD2"', '"ifcSchema":"IFC4","ifcSchemaUnconfirmed":"IFC4"');
    writeFileSync(path, marked);
    const old = readIfcx(bytesAt(path));
    assert.equal(old.project.ifcSchema, 'IFC4');
    assert.equal(old.project.ifcSchemaUnconfirmed, undefined);
    const malformed = marked.replace('"ifcSchemaUnconfirmed":"IFC4"', '"ifcSchemaUnconfirmed":42');
    assert.equal(classifyIfcx(new TextEncoder().encode(malformed)), 'unreadable');
    assert.equal(classifyIfcx(new TextEncoder().encode(marked.trimEnd())), 'unreadable', 'ook het oude profiel toetst de bytes');
    const store = await openAt(path, IFCX_ON);
    const back = join(dir, 'oude-schemavraag-terug.ifc');
    ipc.choose(back);
    await store.getState().saveFileAs();
    assert.deepEqual(asked, [], 'geen schemavraag vóór de kiezer');
    assert.deepEqual(errors(store), []);
    assert.equal(headerSchema(bytesAt(back)), 'IFC4');
    assert.equal(readIFC(text(bytesAt(back))).project.ifcSchemaUnconfirmed, undefined);
  } finally { ipc.dispose(); resetIfcSchemaAsker(); }
});

await check('een oude STEP-herstelsnapshot of IFC-bewerking in een IFCX-tabblad neemt de schemavraag niet over', async () => {
  const { store } = await newApp(IFCX_ON);
  const snapshot = readIFC(writeIFC(maximalFixture));
  assert.equal(snapshot.project.ifcSchemaUnconfirmed, 'IFC4');
  const recovered = { ...snapshot, id: 'herstel-ifcx', filePath: null, isDirty: true, datesAsRecorded: false, ifcx: { known: null } };
  assert.deepEqual(store.getState().restoreDocuments([recovered], recovered.id).skippedIds, []);
  assert.equal(store.getState().fileFormat, 'ifcx');
  assert.equal(store.getState().project.ifcSchema, 'IFC4');
  assert.equal(store.getState().project.ifcSchemaUnconfirmed, undefined);
  store.getState().applyProjectEdit(snapshot);
  assert.equal(store.getState().fileFormat, 'ifcx');
  assert.equal(store.getState().project.ifcSchemaUnconfirmed, undefined);
});

await check('een open schemavraag bij IFC naar IFC komt vóór de kiezer, met de flag aan en uit', async () => {
  const hashes: string[] = [];
  for (const flags of [{}, IFCX_ON]) {
    const ipc = desktop();
    try {
      const { store, timeline } = await tracedApp(flags, ipc);
      await openInto(store, maximalPath);
      const asked: string[] = [];
      setIfcSchemaAsker(async question => {
        asked.push(question.fileSchema);
        assert.deepEqual(timeline, []);
        assert.equal(ipc.dialogs.length, 0);
        return question.keep;
      });
      const target = join(dir, `schema-behouden-${flags.ifcx ? 'aan' : 'uit'}.ifc`);
      ipc.choose(target);
      await store.getState().saveFileAs();
      assert.deepEqual(asked, ['IFC4']);
      assert.deepEqual(errors(store), []);
      const bytes = bytesAt(target);
      assert.equal(headerSchema(bytes), 'IFC4');
      assert.equal(readIFC(text(bytes)).project.ifcSchemaUnconfirmed, undefined);
      hashes.push(hash(bytes));
    } finally { ipc.dispose(); resetIfcSchemaAsker(); }
  }
  assert.equal(hashes[0], hashes[1], 'dezelfde IFC-bytes met beide flagstanden');
});

await check('een planning uit een XER-import naar IFCX: de melding over het P6-bronarchief; annuleren schrijft niets, doorgaan schrijft zonder archief en het document laat het archief los', async () => {
  const ipc = desktop();
  try {
    const xerPath = join(dir, 'p6-import.xer');
    writeFileSync(xerPath, readFileSync(join(root, 'tests/browser/fixtures/xer/zonder-bijzonderheden.xer')));
    const { store, timeline } = await tracedApp(IFCX_ON, ipc);
    await store.getState().openOpenedFile({ name: 'p6-import.xer', content: '', bytes: bytesAt(xerPath), ref: { kind: 'path', path: xerPath } });
    assert.deepEqual(errors(store), []);
    assert(store.getState().xerSourceArchive, 'het document draagt het P6-bronarchief');
    const renamed = store.getState().tasks.find(t => t.childIds.length === 0)!.id;
    store.getState().updateTask(renamed, { name: 'Hernoemd vóór IFCX' });
    const target = join(dir, 'p6-import.ifcx'); ipc.choose(target);
    await withPlanOnlyAnswers({ ifcxXerArchive: false }, async asked => {
      await store.getState().saveFileAs();
      assert.deepEqual(asked, ['ifcxXerArchive']);
    });
    assert.deepEqual(errors(store), []);
    assert.equal(existsSync(target), false);
    assert.deepEqual(timeline, ['ifc@0']);
    assert(store.getState().xerSourceArchive, 'na annuleren houdt het document het archief');
    assert.equal(store.getState().fileFormat, 'ifc');
    await withPlanOnlyAnswers({ ifcxXerArchive: true }, async asked => {
      await store.getState().saveFileAs();
      assert.deepEqual(asked, ['ifcxXerArchive']);
    });
    assert.deepEqual(errors(store), []);
    assert.deepEqual(timeline.slice(1), ['ifc@1', 'ifcx@2']);
    const written = bytesAt(target);
    assert(isIfcxText(written));
    assert.equal(store.getState().fileFormat, 'ifcx');
    assert.equal(store.getState().xerSourceArchive, null, 'het archief is uit het document');
    assert.equal(store.getState().xerImportMetadata, null);
    assert.equal(store.getState().xerSourceProjectId, null);
    assert.equal(store.getState().isDirty, false);
    store.getState().updateTask(renamed, { name: 'Hernoemd na IFCX' });
    assert.equal(await save(store), true, 'Ctrl+S daarna weigert niet op het archief');
    assert.deepEqual(errors(store), []);
    assert(isIfcxText(bytesAt(target)));
    const reopened = await openAt(target, IFCX_ON);
    assert.deepEqual(errors(reopened), []);
    assert.equal(shown(reopened.getState().tasks), shown(store.getState().tasks));
    assert.equal(reopened.getState().tasks.find(t => t.id === renamed)?.name, 'Hernoemd na IFCX');
  } finally { ipc.dispose(); }
});

await check('de extensie volgt het gekozen type; met de flag uit plakt het venster .ifc erachter zoals main', async () => {
  const ipc = desktop();
  try {
    const stepPath = join(dir, 'extensie.ifc'); writeFileSync(stepPath, ownStep);
    const ifcxPath = join(dir, 'extensie.ifcx'); writeFileSync(ifcxPath, own);
    const cases: [string, FeatureFlagValues, string, string, 'ifc' | 'ifcx'][] = [
      [stepPath, IFCX_ON, 'zonder-type', 'zonder-type.ifc', 'ifc'],
      [ifcxPath, IFCX_ON, 'zonder-type-x', 'zonder-type-x.ifcx', 'ifcx'],
      [stepPath, IFCX_ON, 'hoofdletters.IFCX', 'hoofdletters.IFCX', 'ifcx'],
      [ifcxPath, IFCX_ON, 'naar-ifc.ifc', 'naar-ifc.ifc', 'ifc'],
      [stepPath, {}, 'uit.ifcx', 'uit.ifcx.ifc', 'ifc'],
    ];
    for (const [source, flags, chosen, expected, format] of cases) {
      const store = await openAt(source, flags.ifcx ? flags : IFCX_ON);
      setFlags(store, flags);
      ipc.choose(join(dir, chosen));
      await store.getState().saveFileAs();
      assert.deepEqual(errors(store), [], chosen);
      assert.equal(store.getState().filePath, join(dir, expected), chosen);
      assert.equal(store.getState().fileFormat, format, chosen);
      assert(format === 'ifcx' ? isIfcxText(bytesAt(join(dir, expected))) : isStep(bytesAt(join(dir, expected))), chosen);
    }
    assert.deepEqual(ipc.dialogs.at(-1)!.filters, [IFC_FILTER], 'met de flag uit alleen IFC in het venster');
  } finally { ipc.dispose(); }
});

for (const [label, off, on] of [['zonder ifcForeignContent', {}, IFCX_ON], ['met ifcForeignContent', { ifcForeignContent: true }, BOTH_ON]] as const) {
  await check(`hetzelfde type (${label}): Opslaan als naar een nieuwe en een bestaande naam en Ctrl+S geven met de flag aan dezelfde bytes, berekeningen en bestandsaanroepen als met de flag uit`, async () => {
    const runs: { bytes: string[]; steps: string[][]; timeline: Timeline; filters: unknown[] }[] = [];
    for (const [variant, flags] of [['gelijk', off], ['zelfde', on]] as const) {
      const ipc = desktop();
      try {
        const source = join(dir, `${label.replace(/ /g, '-')}-${variant}-bron.ifc`); writeFileSync(source, ownStep);
        const existing = join(dir, `${label.replace(/ /g, '-')}-${variant}-bestaand.ifc`); writeFileSync(existing, ownStep);
        const { store, timeline } = await tracedApp(flags, ipc);
        await openInto(store, source);
        const run = { bytes: [] as string[], steps: [] as string[][], timeline, filters: [] as unknown[] };
        for (const target of [join(dir, `${label.replace(/ /g, '-')}-${variant}-nieuw.ifc`), existing]) {
          shiftFirstTask(store);
          const from = ipc.calls.length;
          ipc.choose(target);
          await store.getState().saveFileAs();
          assert.deepEqual(errors(store), []);
          assert.equal(store.getState().filePath, target);
          run.steps.push(ipcSteps(ipc, from));
          run.bytes.push(hash(bytesAt(target)));
        }
        shiftFirstTask(store);
        const from = ipc.calls.length;
        assert.equal(await save(store), true);
        run.steps.push(ipcSteps(ipc, from));
        run.bytes.push(hash(bytesAt(existing)));
        run.filters = ipc.dialogs.map(d => d.filters);
        runs.push(run);
      } finally { ipc.dispose(); }
    }
    const [main, branch] = runs;
    assert.deepEqual(branch.bytes, main.bytes, 'dezelfde bytes');
    assert.deepEqual(branch.steps, main.steps, 'dezelfde bestandsaanroepen in dezelfde volgorde');
    assert.deepEqual(branch.timeline, main.timeline, 'dezelfde berekeningen, vóór het venster');
    assert.deepEqual(main.timeline, ['ifc@0', 'ifc@1', 'ifc@2']);
    assert.deepEqual(main.filters, [[IFC_FILTER], [IFC_FILTER]], 'met de flag uit alleen IFC in het venster');
    assert.deepEqual(branch.filters, [[IFC_FILTER, IFCX_FILTER], [IFC_FILTER, IFCX_FILTER]], 'met de flag aan beide typen');
  });
}

await check('hetzelfde type bij een IFCX-document: één berekening vóór het venster, geen vraag', async () => {
  const ipc = desktop();
  try {
    for (const flags of [IFCX_ON, BOTH_ON]) {
      const path = join(dir, `zelfde-type-${flags.ifcForeignContent ? 'beide' : 'ifcx'}.ifcx`); writeFileSync(path, own);
      const { store, timeline } = await tracedApp(flags, ipc);
      await openInto(store, path);
      shiftFirstTask(store);
      const before = ipc.dialogs.length;
      const target = join(dir, `zelfde-type-${flags.ifcForeignContent ? 'beide' : 'ifcx'}-kopie.ifcx`); ipc.choose(target);
      await withPlanOnlyAnswers({}, async asked => {
        await store.getState().saveFileAs();
        assert.deepEqual(asked, []);
      });
      assert.deepEqual(errors(store), []);
      assert.deepEqual(timeline, [`ifcx@${before}`]);
      assert(isIfcxText(bytesAt(target)));
    }
  } finally { ipc.dispose(); }
});

await check('flag uit met een open IFCX-document: Ctrl+S en Automatisch opslaan schrijven niets, met één melding', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'flag-uit.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    shiftFirstTask(store);
    store.setState(s => { s.ui.featureFlags = {}; s.autoSaveToFile = true; });
    clearNotices(store);
    const calls = ipc.calls.length;
    assert.equal(await save(store), false);
    assert.deepEqual(errors(store), ['ifcx.flagOff']);
    clearNotices(store);
    const autosave = autosaveOf(store);
    await autosave.flush(); await autosave.flush();
    assert.deepEqual(errors(store), ['ifcx.flagOff'], 'één melding voor Automatisch opslaan');
    assert.equal(ipc.calls.slice(calls).filter(c => c.command.includes('write') || c.command === 'plugin:fs|rename'
      || c.command === 'place_file_exclusive').length, 0, 'geen schrijfactie');
    assert.equal(hash(bytesAt(path)), hash(own));
    assert.equal(store.getState().isDirty, true);
    assert.equal(store.getState().fileFormat, 'ifcx');
  } finally { ipc.dispose(); }
});

await check('Automatisch opslaan naar het bestand schrijft een IFCX-document als IFCX, in de worker', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'autosave.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    const sw = workerOf.get(store)!;
    store.setState(s => { s.autoSaveToFile = true; });
    const id = shiftFirstTask(store), duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
    await autosaveOf(store).flush();
    assert.deepEqual(errors(store), []);
    const written = bytesAt(path);
    assert(isIfcxText(written));
    assert.equal(readIfcx(written).tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(sw.jobs().map(j => j.kind === 'writer' && j.format), ['ifcx']);
    assert.equal(sw.classified(), 0);
    assert.deepEqual(store.getState().knownTargetFingerprint, { sha256: hash(written), byteLength: written.byteLength, origin: 'written' });
  } finally { ipc.dispose(); }
});

await check('geen stapeling: een tik tijdens een lopende IFCX-schrijfbeurt start geen tweede', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'stapeling.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    store.setState(s => { s.autoSaveToFile = true; });
    shiftFirstTask(store);
    let running = 0, most = 0, started = 0, release: () => void = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    const compute: IfcOutputCompute = async (job) => {
      started++; running++; most = Math.max(most, running);
      if (started === 1) await held;
      try { return await computeIfcOutputHere(job); } finally { running--; }
    };
    const autosave = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute });
    const first = autosave.flush();
    for (let turn = 0; turn < 50 && started === 0; turn++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(started, 1, 'de eerste ronde rekent');
    shiftFirstTask(store);
    const second = autosave.flush(), third = autosave.flush();
    for (let turn = 0; turn < 20; turn++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(started, 1, 'tijdens de lopende schrijfbeurt start geen tweede');
    release();
    await Promise.all([first, second, third]);
    assert.equal(most, 1, 'nooit twee schrijfbeurten tegelijk');
    assert.equal(started, 2, 'één vervolgronde voor de latere wijziging, na de eerste');
    assert(isIfcxText(bytesAt(path)));
    assert.equal(store.getState().isDirty, false);
  } finally { ipc.dispose(); }
});

await check('crash na een bewerking, herstel, Ctrl+S: IFCX, byte-gelijk aan een opslag zonder crash; formaat en versie gaan mee', async () => {
  const ipc = desktop(mkdtempSync(join(tmpdir(), 'ops-ifcx-herstel-')));
  try {
    const plain = join(dir, 'zonder-crash.ifcx'), crashed = join(dir, 'met-crash.ifcx');
    writeFileSync(plain, own); writeFileSync(crashed, own);
    const reference = await openAt(plain, IFCX_ON);
    shiftFirstTask(reference);
    assert.equal(await save(reference), true);
    const store = await openAt(crashed, IFCX_ON);
    shiftFirstTask(store);
    const restored = await recoverInto(store, IFCX_ON);
    assert.equal(restored.getState().filePath, crashed);
    assert.equal(restored.getState().fileFormat, 'ifcx', 'het formaat overleeft crashherstel');
    assert.deepEqual(restored.getState().knownTargetFingerprint, store.getState().knownTargetFingerprint, 'de versie ook');
    assert.equal(await save(restored), true);
    assert.deepEqual(errors(restored), []);
    const after = bytesAt(crashed);
    assert(isIfcxText(after));
    assert.equal(hash(after), hash(bytesAt(plain)), 'byte-gelijk aan de opslag zonder crash');
  } finally { ipc.dispose(); }
});

await check('na herstel: een andere versie op het pad vóór de eerste opslag weigert met de melding van #1174', async () => {
  const ipc = desktop(mkdtempSync(join(tmpdir(), 'ops-ifcx-herstel-ander-')));
  try {
    const path = join(dir, 'herstel-ander.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    shiftFirstTask(store);
    const restored = await recoverInto(store, IFCX_ON);
    writeFileSync(path, other);
    assert.equal(await save(restored), false);
    assert.deepEqual(errors(restored), ['notifications.ifcForeignTargetChanged']);
    assert.equal(hash(bytesAt(path)), hash(other), 'de andere versie bleef staan');
  } finally { ipc.dispose(); }
});

for (const [label, flags] of [['alleen ifcx', IFCX_ON], ['ifcx en ifcForeignContent', BOTH_ON]] as const) {
  await check(`${label}: een tweede instantie zet een andere geldige IFCX op het pad vóór de eerste opslag: weigert, de andere versie blijft`, async () => {
    const ipc = desktop();
    try {
      const path = join(dir, `tweede-instantie-${flags.ifcForeignContent ? 'beide' : 'ifcx'}.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, flags);
      shiftFirstTask(store);
      assert.equal(classifyIfcx(other), 'own', 'de andere versie is zelf een geldige eigen IFCX');
      writeFileSync(path, other);
      assert.equal(await save(store), false);
      assert.deepEqual(errors(store), ['notifications.ifcForeignTargetChanged']);
      assert.equal(hash(bytesAt(path)), hash(other));
      store.setState(s => { s.autoSaveToFile = true; }); clearNotices(store);
      await autosaveOf(store).flush();
      assert.deepEqual(errors(store), ['notifications.ifcForeignAutoSaveTargetChanged']);
      assert.equal(hash(bytesAt(path)), hash(other));
      assert.equal(store.getState().isDirty, true);
      const tabs = store.getState().getOpenDocumentPayloads().length;
      await openInto(store, path);
      assert.equal(store.getState().getOpenDocumentPayloads().length, tabs, 'opnieuw openen wisselt naar het bestaande tabblad');
      assert.equal(changedOnDiskShown(store.getState()), true, 'en zegt dat het bestand veranderde');
    } finally { ipc.dispose(); }
  });
}

const foreignIfcx = (() => {
  const document = JSON.parse(text(own));
  document.header.id = 'urn:ifccad:model:hello-wall';
  return new TextEncoder().encode(JSON.stringify(document, null, 2));
})();
const unreadableIfcx = new TextEncoder().encode(text(own).replace('"ifcxVersion": "ifcx_alpha"', '"ifcxVersion": "ifcx_alpha", "extra": 1'));
const truncatedIfcx = own.slice(0, Math.floor(own.byteLength / 2));

await check('doelbescherming: een bestaand IFCX van een ander, onleesbaar of afgekapt blijft staan op Opslaan als, Ctrl+S en Automatisch opslaan', async () => {
  assert.equal(classifyIfcx(foreignIfcx), 'foreign');
  assert.notEqual(classifyIfcx(unreadableIfcx), 'own');
  assert.equal(classifyIfcx(truncatedIfcx), 'not-ifcx');
  for (const [kind, content] of [['vreemd', foreignIfcx], ['onleesbaar', unreadableIfcx], ['afgekapt', truncatedIfcx]] as const) {
    const notice = classifyIfcx(content) === 'foreign' ? 'notifications.ifcForeignTargetSave' : 'notifications.ifcUnreadableTargetSave';
    const ipc = desktop();
    try {
      const target = join(dir, `doel-${kind}.ifcx`); writeFileSync(target, content);
      const path = join(dir, `bron-voor-doel-${kind}.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, IFCX_ON);
      const sw = workerOf.get(store)!;
      shiftFirstTask(store); clearNotices(store);
      ipc.choose(target);
      await store.getState().saveFileAs();
      assert.deepEqual(errors(store), [notice], `Opslaan als weigert (${kind})`);
      assert.equal(hash(bytesAt(target)), hash(content), 'het doel bleef byte-gelijk');
      assert.equal(sw.classified(), 1, 'de opslagworker classificeerde het onbekende doel');
      writeFileSync(path, content); clearNotices(store);
      assert.equal(await save(store), false);
      assert.deepEqual(errors(store), ['notifications.ifcForeignTargetChanged'], 'Ctrl+S weigert op de versie');
      assert.equal(hash(bytesAt(path)), hash(content));
      store.setState(s => { s.autoSaveToFile = true; }); clearNotices(store);
      await autosaveOf(store).flush();
      assert.deepEqual(errors(store), ['notifications.ifcForeignAutoSaveTargetChanged'], 'Automatisch opslaan weigert');
      assert.equal(hash(bytesAt(path)), hash(content));
      assert.equal(store.getState().isDirty, true);
    } finally { ipc.dispose(); }
  }
});

await check('Opslaan als over een leeg bestand of een andere eigen IFCX mag; een eigen IFCX gaat door de classificatie in de worker', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'bron-voor-eigen-doel.ifcx'); writeFileSync(path, own);
    for (const [kind, content, classified] of [['leeg', new Uint8Array(), 0], ['eigen', other, 1]] as const) {
      const store = await openAt(path, IFCX_ON);
      const sw = workerOf.get(store)!;
      shiftFirstTask(store);
      const target = join(dir, `doel-${kind}.ifcx`); writeFileSync(target, content); ipc.choose(target);
      await store.getState().saveFileAs();
      assert.deepEqual(errors(store), [], kind);
      assert(isIfcxText(bytesAt(target)), kind);
      assert.equal(sw.classified(), classified, kind);
    }
  } finally { ipc.dispose(); }
});

await check('de worker start niet: IFCX geeft de bestaande opslagfout en rekent niets op de hoofdthread; STEP valt terug zoals main', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'zonder-worker.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON, saveWorker('none'));
    shiftFirstTask(store); clearNotices(store);
    assert.equal(await save(store), false);
    assert.deepEqual(errors(store), ['notifications.ifcSaveWorkerFailed']);
    assert.equal(hash(bytesAt(path)), hash(own));
    const target = join(dir, 'zonder-worker-nieuw.ifcx'); ipc.choose(target); clearNotices(store);
    await store.getState().saveFileAs();
    assert.deepEqual(errors(store), ['notifications.ifcSaveWorkerFailed']);
    assert.equal(existsSync(target), false);
    store.setState(s => { s.autoSaveToFile = true; }); clearNotices(store);
    await autosaveOf(store).flush();
    assert.deepEqual(errors(store), ['notifications.ifcSaveWorkerFailed']);
    assert.equal(hash(bytesAt(path)), hash(own));
    assert.equal(store.getState().isDirty, true);
    const unmarked = (await newApp(IFCX_ON, null)).store;
    await openInto(unmarked, path);
    shiftFirstTask(unmarked); clearNotices(unmarked);
    assert.equal(await save(unmarked), false, 'een context zonder worker schrijft geen IFCX');
    assert.deepEqual(errors(unmarked), ['notifications.ifcSaveWorkerFailed']);
    const stepPath = join(dir, 'zonder-worker.ifc'); writeFileSync(stepPath, ownStep);
    const step = await openAt(stepPath, IFCX_ON, saveWorker('none'));
    shiftFirstTask(step);
    assert.equal(await save(step), true);
    assert.deepEqual(errors(step), []);
    assert(isStep(bytesAt(stepPath)));
  } finally { ipc.dispose(); }
});

await check('zonder classificatie in de worker weigert een IFCX-document een onbekend bestaand doel', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'zonder-classificatie.ifcx'); writeFileSync(path, own);
    const sw = saveWorker();
    const { createAppStoreContext } = await loadStore();
    const { store } = createAppStoreContext({ ifcSaveCompute: sw.client.compute });
    setFlags(store, IFCX_ON);
    await openInto(store, path);
    shiftFirstTask(store);
    const target = join(dir, 'zonder-classificatie-doel.ifcx'); writeFileSync(target, other); ipc.choose(target);
    await store.getState().saveFileAs();
    assert.deepEqual(errors(store), ['notifications.ifcUnreadableTargetSave']);
    assert.equal(hash(bytesAt(target)), hash(other));
  } finally { ipc.dispose(); }
});

await check('het P6-bronarchief van een XER-import: STEP weigert het compacte archief, de kern weigert het schrijven met één melding over de planning; Automatisch opslaan rekent dezelfde inhoud niet opnieuw (was knownbug 2367)', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'resource.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    const sw = workerOf.get(store)!;
    const imported = readXER(new Uint8Array(readFileSync(join(root, 'tests/browser/fixtures/xer/zonder-bijzonderheden.xer'))));
    assert(!('kind' in imported) && imported.xerSourceArchive && imported.xer, 'het XER-bestand geeft één document met bronarchief');
    store.setState({
      xerSourceArchive: imported.xerSourceArchive, xerImportMetadata: imported.xer, xerSourceProjectId: imported.xer.sourceProjectId ?? null,
    });
    shiftFirstTask(store);
    clearNotices(store);
    assert.equal(await save(store), false);
    assert.deepEqual(errors(store), ['ifcx.writeRefused']);
    assert.equal(store.getState().ui.notifications[0].detail, 'planning');
    assert.equal(hash(bytesAt(path)), hash(own));
    assert.equal(store.getState().isDirty, true);
    store.setState(s => { s.autoSaveToFile = true; }); clearNotices(store);
    const autosave = autosaveOf(store);
    const before = sw.jobs().length;
    await autosave.flush(); await autosave.flush(); await autosave.flush();
    assert.equal(sw.jobs().length, before + 1, 'één schrijfbeurt voor dezelfde geweigerde inhoud');
    assert.deepEqual(errors(store), ['ifcx.writeRefused']);
    shiftFirstTask(store);
    await autosave.flush();
    assert.equal(sw.jobs().length, before + 2, 'na een wijziging probeert hij het opnieuw');
    assert.equal(hash(bytesAt(path)), hash(own));
  } finally { ipc.dispose(); }
});

await check('browser: een IFCX-document slaat een nieuw doel op als download met de naam op .ifcx, nooit via de kiezer; met de flag uit STEP op .ifc', async () => {
  const win = window as unknown as Record<string, unknown>;
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL, downloads: { blob: Blob; name: string }[] = [];
  URL.createObjectURL = blob => { downloads.push({ blob: blob as Blob, name: '' }); return 'blob:ifcx'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => { const a = { href: '', download: '', click: () => { downloads.at(-1)!.name = a.download; } }; return a; },
    documentElement: {},
  } });
  let pickerCalls = 0, writes = 0;
  let pickedHandle = { kind: 'file', name: 'kopie.ifcx',
    getFile: async () => new File([], 'kopie.ifcx'),
    createWritable: async () => { writes++; return { write: async () => {}, close: async () => {}, abort: async () => {} }; },
    queryPermission: async () => 'granted', requestPermission: async () => 'granted', isSameEntry: async () => false };
  win.showOpenFilePicker = async () => [];
  win.showSaveFilePicker = async () => { pickerCalls++; return pickedHandle; };
  try {
    const store = (await newApp(IFCX_ON)).store;
    await store.getState().openOpenedFile({ name: 'download.ifcx', content: '', bytes: own, ref: null });
    assert.equal(store.getState().filePath, 'download.ifcx');
    assert.equal(store.getState().fileFormat, 'ifcx');
    shiftFirstTask(store);
    await store.getState().saveFile();
    assert.deepEqual(errors(store), []);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].name, `${store.getState().project.name}.ifcx`, 'de naam van main, met de extensie van het formaat');
    assert(isIfcxText(new Uint8Array(await downloads[0].blob.arrayBuffer())));
    await store.getState().saveFileAs();
    assert.equal(downloads.length, 2);
    assert.equal(downloads[1].name, downloads[0].name, 'Opslaan als stelt de naam van het document voor, op .ifcx');
    assert.equal(pickerCalls, 0, 'een IFCX-document opent de opslaankiezer van de browser niet');
    const off = (await newApp(IFCX_ON)).store;
    await off.getState().openOpenedFile({ name: 'download.ifcx', content: '', bytes: own, ref: null });
    setFlags(off, {});
    await off.getState().saveFileAs();
    assert.deepEqual(errors(off), []);
    assert.equal(downloads.length, 3);
    assert.equal(downloads[2].name, 'download.ifc', 'met de flag uit: STEP met een naam op .ifc');
    assert(isStep(new Uint8Array(await downloads[2].blob.arrayBuffer())));
    assert.equal(off.getState().fileFormat, 'ifc');
    assert.equal(pickerCalls, 0);
    const step = (await newApp(IFCX_ON)).store;
    await step.getState().openOpenedFile({ name: 'stap.ifc', content: text(ownStep), ref: null });
    const stepTab = step.getState().activeDocumentId;
    assert.equal(step.getState().fileFormat, 'ifc');
    await step.getState().saveFileAs();
    assert.equal(pickerCalls, 1, 'een IFC-document gebruikt de kiezer zoals main');
    assert.deepEqual(errors(step), ['ifcx.nameMismatch'], 'de kiezer gaf kopie.ifcx terug: niet bij het formaat');
    assert.equal(writes, 0, 'niets naar dat doel geschreven');
    await step.getState().openOpenedFile({ name: 'gevel.ifcx', content: '', bytes: facade, ref: null });
    assert.equal(step.getState().filePath, null);
    step.getState().addTask({ name: 'Begane grond' });
    const beforeModel = downloads.length;
    assert.equal(await save(step), true);
    assert.equal(downloads[beforeModel].name, 'gevel - planning.ifcx');
    assert.deepEqual(readIfcx(new Uint8Array(await downloads[beforeModel].blob.arrayBuffer())).modelSource,
      { fileName: 'gevel.ifcx', sha256: hash(facade) });
    step.getState().switchDocument(stepTab);
    assert.equal(step.getState().fileFormat, 'ifc');
    for (const flags of [IFCX_ON, {}]) {
      setFlags(step, flags);
      pickedHandle = { ...pickedHandle, name: 'kopie.ifc' };
      const beforePicker: number = pickerCalls;
      const beforeWrites: number = writes;
      clearNotices(step);
      await step.getState().saveFileAs();
      assert.deepEqual(errors(step), []);
      assert.equal(pickerCalls, beforePicker + 1, 'de gewone planning gebruikt de kiezer terwijl het model open is');
      assert.equal(writes, beforeWrites + 1);
      assert.equal(step.getState().fileHandle, pickedHandle, 'de gekozen kopie is het nieuwe schrijfdoel');
      assert.equal(downloads.length, beforeModel + 1);
    }
  } finally {
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    delete win.showOpenFilePicker; delete win.showSaveFilePicker;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

await check('browser: Openen, Recent en slepen met een andere handle voor hetzelfde IFCX-bestand maken met alleen ifcx aan het bestaande tabblad actief, met zijn wijziging; een gewone .ifc opent zoals main een tweede tabblad', async () => {
  const { buildImportLabels } = await import('@/i18n/importLabels');
  const { openDroppedFiles } = await import('@/state/fileDrop');
  const labels = buildImportLabels((key) => key);
  const win = window as unknown as Record<string, unknown>;
  const handlesTo = (name: string, bytes: Uint8Array, canRead = () => true) => {
    const entry = {};
    return () => ({ kind: 'file', name, entry,
      getFile: async () => {
        if (!canRead()) throw new DOMException('Geen leesrecht', 'NotAllowedError');
        return new File([bytes.slice()], name);
      },
      queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      isSameEntry: async (other: { entry?: object }) => other?.entry === entry,
    }) as unknown as FileSystemFileHandle;
  };
  let picked: FileSystemFileHandle | null = null;
  win.showOpenFilePicker = async () => [picked];
  type Route = 'Openen' | 'Recent' | 'slepen';
  const openVia = async (store: Store, route: Route, handle: FileSystemFileHandle) => {
    if (route === 'Openen') { picked = handle; await store.getState().openFile(labels); return; }
    if (route === 'Recent') {
      store.setState(s => { s.recentFiles = [{ id: 'r', ref: { kind: 'handle', handle }, name: handle.name, addedAt: 1 }]; });
      await store.getState().openRecentFile('r', labels);
      return;
    }
    const readOptions = readOptionsFor(store.getState().ui.featureFlags);
    const data = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    await openDroppedFiles(store, [{ name: handle.name, read: async (beforeRead) => {
      const ref = { kind: 'handle', handle } as const;
      beforeRead?.(ref);
      return { name: handle.name, ...(readsAsBytes(handle.name, readOptions) ? { content: '', bytes: data } : { content: text(data) }), ref };
    } }], labels, () => false, { readOptions });
  };
  const opened = async (flags: FeatureFlagValues, name: string, bytes: Uint8Array, route: Route) => {
    const handles = handlesTo(name, bytes);
    const store = (await newApp(flags)).store;
    await openVia(store, 'Openen', handles());
    const first = store.getState().activeDocumentId;
    const taskId = shiftFirstTask(store);
    const edited = store.getState().tasks.find(t => t.id === taskId)!.time.scheduleDuration;
    store.getState().newDocument();
    await openVia(store, route, handles());
    return { store, first, taskId, edited };
  };
  const fileTabs = (store: Store) => store.getState().getOpenDocumentPayloads().filter(d => d.payload.fileHandle !== null).length;
  try {
    for (const route of ['Openen', 'Recent', 'slepen'] as const) {
      const model = (await newApp(IFCX_ON)).store;
      let firstReadable = true;
      await openVia(model, route, handlesTo('model.ifcx', facade, () => firstReadable)());
      assert.equal(model.getState().ifcxReferences?.modelSource?.sha256, hash(facade));
      firstReadable = route !== 'Recent';
      await openVia(model, route, handlesTo('zonder-treffer.ifcx', withModel)());
      assert.equal(uncheckedModelLinks(model.getState()), true, `${route}: geen leesbaar model met de juiste hash`);
      assert.deepEqual(taskElementLinks(model.getState(), model.getState().tasks[0].id)?.map(link => link.found), [false, false]);
      const source = handlesTo('model.ifcx', linkedModel);
      await openVia(model, route, source());
      assert.deepEqual(errors(model), [], route);
      assert.equal(model.getState().fileHandle, null);
      assert.equal(model.getState().filePath, null);
      assert.equal(model.getState().ifcxReferences?.modelSource?.sha256, hash(linkedModel));
      model.getState().newDocument();
      assert.equal(await model.getState().foreignTargetCheck(null)({ kind: 'handle', handle: source() }), true);
      await openVia(model, route, handlesTo('planning-met-model.ifcx', withModel)());
      assert.equal(uncheckedModelLinks(model.getState()), false, `${route}: het tweede gelijknamige model heeft de juiste hash`);
      assert.deepEqual(taskElementLinks(model.getState(), model.getState().tasks[0].id)?.map(link => link.found), [true, false]);
      const { store, first, taskId, edited } = await opened(IFCX_ON, 'plan.ifcx', own, route);
      assert.deepEqual(errors(store), [], route);
      assert.equal(fileTabs(store), 1, `${route}: geen tweede tabblad voor hetzelfde bestand`);
      assert.equal(store.getState().activeDocumentId, first, `${route}: het bestaande tabblad is actief`);
      assert.equal(store.getState().fileFormat, 'ifcx');
      assert.equal(store.getState().tasks.find(t => t.id === taskId)!.time.scheduleDuration, edited, `${route}: de wijziging blijft`);
      assert.equal(store.getState().isDirty, true, route);
      assert.equal(changedOnDiskShown(store.getState()), false, `${route}: het bestand op schijf is niet veranderd`);
    }
    for (const flags of [{}, IFCX_ON] as FeatureFlagValues[]) {
      for (const route of ['Openen', 'Recent', 'slepen'] as const) {
        const { store, first } = await opened(flags, 'plan.ifc', ownStep, route);
        assert.deepEqual(errors(store), [], route);
        assert.equal(fileTabs(store), 2, `${route}, ${JSON.stringify(flags)}: zoals main met ifcForeignContent uit een tweede tabblad`);
        assert.notEqual(store.getState().activeDocumentId, first, route);
        assert.equal(store.getState().fileFormat, 'ifc');
      }
    }
  } finally {
    delete win.showOpenFilePicker;
  }
});

await check('site: Ctrl+S schrijft IFCX naar het eigen bestand; Opslaan als normaliseert de naam op het formaat', async () => {
  const win = window as unknown as Record<string, unknown>;
  const requests: { id?: string; data: Blob; name?: string; baseVersion?: string }[] = [];
  win.openaecHost = { storage: {
    list: async () => [], versions: async () => [],
    open: async (id: string) => ({ data: new Blob([(id === 'gebouw' ? facade : own).slice().buffer]),
      file: { name: id === 'gebouw' ? 'gevel.ifcx' : 'site.ifcx', version: 'v1' } }),
    save: async (request: { id?: string; data: Blob; name?: string; baseVersion?: string }) => {
      requests.push(request);
      return { id: request.id ?? 'nieuw', name: request.name ?? 'site.ifcx', version: `v${requests.length + 1}` };
    },
  } };
  let asked = 'kopie';
  setSiteSaveAsker(async () => ({ kind: 'site', name: asked }));
  try {
    const store = (await newApp(IFCX_ON)).store;
    assert.equal(await store.getState().openFromSite('bron'), true,
      `site opent: ${JSON.stringify(store.getState().ui.notifications.map(n => [n.messageKey, n.detail]))}`);
    assert.equal(store.getState().siteFileId, 'bron');
    assert.equal(store.getState().fileFormat, 'ifcx');
    shiftFirstTask(store);
    assert.equal(await save(store), true, `site Ctrl+S: ${JSON.stringify(store.getState().ui.notifications.map(n => [n.messageKey, n.detail]))}`);
    assert.deepEqual(errors(store), []);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].id, 'bron');
    assert(isIfcxText(new Uint8Array(await requests[0].data.arrayBuffer())));
    await store.getState().saveFileAs();
    assert.equal(requests[1].name, 'kopie.ifcx', 'de naam krijgt de extensie van het formaat');
    asked = 'kopie.ifc';
    await store.getState().saveFileAs();
    assert.equal(requests[2].name, 'kopie.ifcx', 'een naam op .ifc wordt .ifcx');
    assert(isIfcxText(new Uint8Array(await requests[2].data.arrayBuffer())));
    setFlags(store, {});
    asked = 'terug.ifcx';
    await store.getState().saveFileAs();
    assert.equal(requests[3].name, 'terug.ifc', 'met de flag uit: STEP met een naam op .ifc');
    assert(isStep(new Uint8Array(await requests[3].data.arrayBuffer())));
    assert.equal(store.getState().fileFormat, 'ifc');
    setFlags(store, IFCX_ON);
    assert.equal(await store.getState().openFromSite('gebouw'), true);
    assert.equal(store.getState().siteFileId, null);
    store.getState().newDocument();
    assert.equal(await store.getState().foreignTargetCheck(null)({ kind: 'site', id: 'gebouw' }), true);
    assert(requests.every(request => request.id !== 'gebouw'));
  } finally { delete win.openaecHost; resetSiteAskers(); }
});

await check('Exporteren → IFC van een IFCX-document blijft STEP; het eigen IFCX-bestand vervangt het nooit, ook niet via MCP met overwrite', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'export-bron.ifcx'); writeFileSync(path, own);
    const app = await openApp(path, IFCX_ON);
    const store = app.store;
    const target = join(dir, 'export.ifc'); ipc.choose(target);
    await store.getState().exportAs('ifc');
    assert(isStep(bytesAt(target)));
    assert.equal(store.getState().filePath, path);
    clearNotices(store);
    ipc.choose(path);
    await store.getState().exportAs('ifc');
    assert.deepEqual(errors(store), []);
    assert(isStep(bytesAt(`${path}.ifc`)), 'kiest de planner het eigen bestand, dan volgt de naam het formaat: .ifcx.ifc');
    assert.equal(hash(bytesAt(path)), hash(own), 'het eigen IFCX-bestand bleef staan');
    for (const flags of [IFCX_ON, {}]) {
      setFlags(store, flags);
      const viaMcp = await exportViaMcp(app, path);
      assert.equal(viaMcp.ok, false, `MCP met overwrite: true weigert (${JSON.stringify(flags)})`);
      assert.equal(hash(bytesAt(path)), hash(own));
    }
    setFlags(store, IFCX_ON);
    const getFs = fileToolDeps.getFs;
    fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
    try {
      const imported = await getTool('planner_import_schedule')!.handler({ path }, mcpContext(app));
      assert(imported.ok, JSON.stringify(imported).slice(0, 300));
      assert.equal((imported.data as { format?: string }).format, 'IFCX', 'de MCP-import meldt het gelezen formaat');
    } finally { fileToolDeps.getFs = getFs; }
    const alias = join(dir, 'export-bron-alias.ifc');
    symlinkSync(path, alias);
    const viaAlias = await exportViaMcp(app, alias);
    assert.equal(viaAlias.ok, false, 'ook via een link met een andere naam');
    assert(JSON.stringify(viaAlias).includes('open document'), `de reden is het open IFCX-document: ${JSON.stringify(viaAlias).slice(0, 300)}`);
    assert.equal(hash(bytesAt(path)), hash(own));
  } finally { ipc.dispose(); }
});

await check('een STEP-bestand met de naam .ifcx is een IFC-document: met de flag uit én daarna aan schrijft Ctrl+S STEP, zoals main (was knownbug 2364)', async () => {
  const path = join(dir, 'step-met-ifcx-naam.ifcx'); writeFileSync(path, ownStep);
  const ipc = desktop();
  try {
    const store = await openAt(path, {});
    assert.deepEqual(errors(store), []);
    assert.equal(store.getState().filePath, path);
    assert.equal(store.getState().fileFormat, 'ifc');
    shiftFirstTask(store);
    assert.equal(await save(store), true);
    assert.deepEqual(errors(store), []);
    assert(isStep(bytesAt(path)));
    setFlags(store, IFCX_ON);
    shiftFirstTask(store);
    assert.equal(await save(store), true);
    assert.deepEqual(errors(store), []);
    assert(isStep(bytesAt(path)), 'de naam beslist het formaat niet: nog steeds STEP');
    shiftFirstTask(store);
    store.setState(s => { s.autoSaveToFile = true; });
    await autosaveOf(store).flush();
    assert.deepEqual(errors(store), []);
    assert(isStep(bytesAt(path)));
    assert.equal(store.getState().isDirty, false);
  } finally { ipc.dispose(); }
  const on = await openAt(path, IFCX_ON);
  assert.deepEqual(errors(on), ['ifcx.open.notIfcx']);
});

type Route = 'Ctrl+S' | 'Automatisch opslaan' | 'na crashherstel' | 'na tabbladwissel' | 'na dupliceren' | 'MCP-export met overwrite';
const ROUTES: Route[] = ['Ctrl+S', 'Automatisch opslaan', 'na crashherstel', 'na tabbladwissel', 'na dupliceren', 'MCP-export met overwrite'];
const READS = [
  { read: 'ifc', ext: 'ifc', open: {} }, { read: 'ifc', ext: 'ifc', open: IFCX_ON }, { read: 'ifc', ext: 'ifc', open: BOTH_ON },
  { read: 'ifc', ext: 'ifcx', open: {} }, { read: 'ifcx', ext: 'ifcx', open: IFCX_ON }, { read: 'ifcx', ext: 'ifcx', open: BOTH_ON },
] as const;
const SAVES: FeatureFlagValues[] = [{}, IFCX_ON, { ifcForeignContent: true }, BOTH_ON];

await check('regel F: elke schrijfroute naar het eigen doel schrijft het gelezen formaat, of laat het doel byte-gelijk met een melding', async () => {
  let cases = 0;
  const outcomes: Record<string, number> = {};
  for (const { read, ext, open } of READS) {
    for (const saveFlags of SAVES) {
      for (const route of ROUTES) {
        const label = `${read} als .${ext}, open ${JSON.stringify(open)}, opslaan ${JSON.stringify(saveFlags)}, ${route}`;
        const ipc = desktop();
        try {
          const path = join(dir, `regel-f-${cases}.${ext}`);
          const start = read === 'ifcx' ? own : ownStep;
          writeFileSync(path, start);
          const app = await openApp(path, open);
          let store = app.store;
          assert.deepEqual(errors(store), [], `${label}: opent`);
          assert.equal(store.getState().fileFormat, read, `${label}: het gelezen formaat`);
          shiftFirstTask(store);
          setFlags(store, saveFlags);
          clearNotices(store);
          let refusedByTool = false;
          if (route === 'Ctrl+S') await save(store);
          else if (route === 'Automatisch opslaan') {
            store.setState(s => { s.autoSaveToFile = true; });
            await autosaveOf(store).flush();
          } else if (route === 'na crashherstel') {
            store = await recoverInto(store, saveFlags);
            await save(store);
          } else if (route === 'na tabbladwissel') {
            const id = store.getState().activeDocumentId;
            store.getState().newDocument();
            store.getState().switchDocument(id);
            assert.equal(store.getState().fileFormat, read, `${label}: het formaat na de wissel`);
            await save(store);
          } else if (route === 'na dupliceren') {
            const id = store.getState().activeDocumentId;
            store.getState().duplicateDocument();
            assert.equal(store.getState().fileFormat, read, `${label}: de kopie houdt het formaat`);
            assert.equal(store.getState().filePath, null, `${label}: de kopie heeft geen doel`);
            store.getState().switchDocument(id);
            await save(store);
          } else {
            const result = await exportViaMcp(app, path);
            refusedByTool = !result.ok;
          }
          const after = bytesAt(path);
          const unchanged = hash(after) === hash(start);
          const wroteRead = !unchanged && (read === 'ifcx' ? isIfcxText(after) : isStep(after));
          const noticed = errors(store).length > 0 || refusedByTool;
          assert(wroteRead || (unchanged && noticed),
            `${label}: ${unchanged ? 'ongewijzigd zonder melding' : `het andere formaat geschreven (${text(after).slice(0, 20)})`}; ${JSON.stringify(errors(store))}`);
          const expectWrite = read === 'ifcx' ? route !== 'MCP-export met overwrite' && !!saveFlags.ifcx
            : !(route === 'MCP-export met overwrite' && ext === 'ifcx' && !!saveFlags.ifcx);
          assert.equal(wroteRead, expectWrite, `${label}: ${expectWrite ? 'schrijft' : 'weigert'}; ${JSON.stringify(errors(store))}`);
          const key = `${read}.${ext}:${wroteRead ? 'geschreven' : 'geweigerd'}`;
          outcomes[key] = (outcomes[key] ?? 0) + 1;
          cases++;
        } finally { ipc.dispose(); }
      }
    }
  }
  console.log(`  REGEL F: ${cases} gevallen ${JSON.stringify(outcomes)}`);
});

type WaitSetup = { open: FeatureFlagValues; before: FeatureFlagValues; during: FeatureFlagValues };
async function switchedOnEveryWaitPoint(name: string, setup: WaitSetup, act: (store: Store, ipc: ReturnType<typeof desktop>) => Promise<{ bytes: Uint8Array; errors: string[] }>) {
  const baseline = await (async () => {
    const ipc = desktop();
    try {
      const path = join(dir, `${name}-basis.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, setup.open);
      shiftFirstTask(store); setFlags(store, setup.before); clearNotices(store);
      return await act(store, ipc);
    } finally { ipc.dispose(); }
  })();
  let points = 0;
  for (let at = 0; ; at++) {
    const ipc = desktop();
    let switched = false, seen = 0, armed = false;
    try {
      const path = join(dir, `${name}-${at}.ifcx`); writeFileSync(path, own);
      let store!: Store;
      const flip = () => { if (armed && !switched && seen++ === at) { switched = true; setFlags(store, setup.during); } };
      store = (await openApp(path, setup.open, undefined, compute => (job, stop) => { armed = true; flip(); return compute(job, stop); })).store;
      shiftFirstTask(store); setFlags(store, setup.before); clearNotices(store);
      ipc.faults.onCall = () => flip();
      const outcome = await act(store, ipc);
      if (!switched) break;
      points++;
      assert.equal(isIfcxText(outcome.bytes), isIfcxText(baseline.bytes), `${name}, wissel op wachtpunt ${at}: hetzelfde formaat`);
      assert.equal(isStep(outcome.bytes), isStep(baseline.bytes), `${name}, wissel op wachtpunt ${at}: hetzelfde formaat`);
      assert.deepEqual(outcome.errors, baseline.errors, `${name}, wissel op wachtpunt ${at}: dezelfde meldingen`);
    } finally { ipc.dispose(); }
  }
  assert(points > 3, `${name}: de wissel viel op ${points} wachtpunten`);
  console.log(`  WISSEL ${name}: ${points} wachtpunten, uitkomst ${isIfcxText(baseline.bytes) ? 'IFCX' : 'STEP'} ${JSON.stringify(baseline.errors)}`);
}

await check('de flag ifcx gaat uit midden in een poging, op elk wachtpunt: de uitkomst is die van dezelfde poging zonder wissel', async () => {
  await switchedOnEveryWaitPoint('ctrl-s', { open: IFCX_ON, before: IFCX_ON, during: {} }, async store => {
    await save(store);
    return { bytes: bytesAt(store.getState().filePath!), errors: errors(store) };
  });
  await switchedOnEveryWaitPoint('autosave', { open: IFCX_ON, before: IFCX_ON, during: {} }, async store => {
    store.setState(s => { s.autoSaveToFile = true; });
    const path = store.getState().filePath!;
    await autosaveOf(store).flush();
    return { bytes: bytesAt(path), errors: errors(store) };
  });
  let target = 0;
  await switchedOnEveryWaitPoint('opslaan-als', { open: IFCX_ON, before: IFCX_ON, during: {} }, async (store, ipc) => {
    const path = join(dir, `wissel-als-${target++}.ifcx`); ipc.choose(path);
    await store.getState().saveFileAs();
    return { bytes: existsSync(path) ? bytesAt(path) : new Uint8Array(), errors: errors(store) };
  });
  await switchedOnEveryWaitPoint('opslaan-als-aan', { open: IFCX_ON, before: {}, during: IFCX_ON }, async (store, ipc) => {
    const path = join(dir, `wissel-als-aan-${target++}.ifc`); ipc.choose(path);
    await store.getState().saveFileAs();
    return { bytes: existsSync(path) ? bytesAt(path) : new Uint8Array(), errors: errors(store) };
  });
});

console.log(`\nIFCX in de app: ${passed} proeven geslaagd, ${failed} fouten`);
if (failed > 0) process.exit(1);
