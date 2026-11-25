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
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { flushRecoveryNow, registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { changedOnDiskShown } from '@/state/openDocumentFor';
import { setSiteSaveAsker, resetSiteAskers } from '@/services/fileAccess/siteDialogs';
import { fileToolDeps, realFs } from '@/services/mcp/tools/fileTools';
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
const dir = mkdtempSync(join(tmpdir(), 'ops-ifcx-app-'));
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const text = (data: Uint8Array) => new TextDecoder().decode(data);
const isIfcxText = (data: Uint8Array) => text(data).startsWith('{') && JSON.parse(text(data)).header.ifcxVersion === 'ifcx_alpha';
const isStep = (data: Uint8Array) => text(data).startsWith('ISO-10303-21;');
const bytesAt = (path: string) => new Uint8Array(readFileSync(path));
const IFCX_ON: FeatureFlagValues = { ifcx: true };
const BOTH_ON: FeatureFlagValues = { ifcx: true, ifcForeignContent: true };
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
  const dialogs: DialogCall[] = [];
  win.__TAURI_INTERNALS__.invoke = async (...args) => {
    if (args[0] === 'plugin:dialog|save') {
      dialogs.push(((args[1] ?? {}) as { options?: DialogCall }).options ?? {});
      return answer;
    }
    return invoke(...args);
  };
  return { ...ipc, dialogs, choose: (path: string | null) => { answer = path; } };
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
      s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, !!s.ui.featureFlags.ifcForeignContent)));
  });
  try { await flushRecoveryNow(); } finally { unregister(); }
  const loaded = await loadRecovery();
  assert.equal(loaded.docs.length, store.getState().getOpenDocumentPayloads().length);
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
      const reopened = await openAt(path, flags);
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

await check('Opslaan als (desktop): voorgestelde naam op .ifcx, het IFCX-filter, uitvoer IFCX; met de flag uit STEP met een naam op .ifc', async () => {
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
      assert.deepEqual(ipc.dialogs[0].filters, [{ name: 'IFCX Files', extensions: ['ifcx'] }]);
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

await check('resources: de kern weigert het schrijven, één melding; Automatisch opslaan rekent dezelfde inhoud niet opnieuw (was knownbug 2367)', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'resource.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    const sw = workerOf.get(store)!;
    store.getState().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, costPerHour: 10 });
    clearNotices(store);
    assert.equal(await save(store), false);
    assert.deepEqual(errors(store), ['ifcx.writeRefused']);
    assert(store.getState().ui.notifications[0].detail?.includes('resources'), 'de melding noemt het veld');
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
  const pickedHandle = { kind: 'file', name: 'kopie.ifcx',
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
    assert.equal(step.getState().fileFormat, 'ifc');
    await step.getState().saveFileAs();
    assert.equal(pickerCalls, 1, 'een IFC-document gebruikt de kiezer zoals main');
    assert.deepEqual(errors(step), ['ifcx.nameMismatch'], 'de kiezer gaf kopie.ifcx terug: niet bij het formaat');
    assert.equal(writes, 0, 'niets naar dat doel geschreven');
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
  const handlesTo = (name: string, bytes: Uint8Array) => {
    const entry = {};
    return () => ({ kind: 'file', name, entry,
      getFile: async () => new File([bytes.slice()], name),
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
    open: async () => ({ data: new Blob([own.slice().buffer]), file: { name: 'site.ifcx', version: 'v1' } }),
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
