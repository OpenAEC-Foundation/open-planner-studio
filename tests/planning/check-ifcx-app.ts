import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
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
  binaryExtensions, isReadableFileName, openDialogFilters, readFormatForFile, readOptionsFor, readsAsBytes,
} from '@/services/formatRegistry';
import { splitDroppedFiles } from '@/services/fileAccess/fileDrop';
import { classifyIfcxTarget, rememberOwnIfcxDigest } from '@/services/ifc/ifcxOwnBytes';
import { documentFileFilters, documentFileFormat } from '@/state/ifcxGuard';
import { computeIfcOutputHere, documentSaveCompute, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { readIfcx, classifyIfcx } from '@/services/ifc/ifcx';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { documentDataFromImport } from '@/services/documentData';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { flushRecoveryNow, registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { setSiteSaveAsker, resetSiteAskers } from '@/services/fileAccess/siteDialogs';
import type { FeatureFlagValues } from '@/utils/featureFlags';
import type { FileRef } from '@/services/fileAccess';
import type { Task } from '@/types/task';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = ['verbouwing-eengezinswoning-kern.ifcx', 'datumgevallen.ifcx'];
const fixture = (name: string) => new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifcx/eigen', name)));
const own = fixture(FIXTURES[0]);
const dir = mkdtempSync(join(tmpdir(), 'ops-ifcx-app-'));
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const text = (data: Uint8Array) => new TextDecoder().decode(data);
const isIfcxText = (data: Uint8Array) => text(data).startsWith('{') && JSON.parse(text(data)).header.ifcxVersion === 'ifcx_alpha';
const isStep = (data: Uint8Array) => text(data).startsWith('ISO-10303-21;');
const IFCX_ON: FeatureFlagValues = { ifcx: true };
const BOTH_ON: FeatureFlagValues = { ifcx: true, ifcForeignContent: true };

let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) {
    failed++;
    const shown = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : JSON.stringify(error);
    console.error(`XX ${name}: ${shown.slice(0, 2000)}`);
  }
}

const WRITE_TIME = /^(\s*"timestamp": |FILE_NAME\(|#\d+=IFC(OWNERHISTORY|WORKPLAN|WORKSCHEDULE)\()/;
function firstLineDifference(before: Uint8Array, after: Uint8Array, skipWriteTime = false): string | null {
  const a = text(before).split('\n'), b = text(after).split('\n');
  for (let at = 0; at < Math.max(a.length, b.length); at++) {
    if (a[at] === b[at]) continue;
    if (skipWriteTime && WRITE_TIME.test(a[at] ?? '') && WRITE_TIME.test(b[at] ?? '')) continue;
    const left = a[at] ?? '', right = b[at] ?? '';
    let from = 0;
    while (from < left.length && left[from] === right[from]) from++;
    return `regel ${at + 1}: …${left.slice(Math.max(0, from - 60), from + 60)}… → …${right.slice(Math.max(0, from - 60), from + 60)}…`;
  }
  return null;
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

type Store = Awaited<ReturnType<typeof openAt>>;
async function openAt(path: string, flags: FeatureFlagValues, ifcSaveCompute?: IfcOutputCompute) {
  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext(ifcSaveCompute ? { ifcSaveCompute } : {});
  store.setState(s => { s.ui.featureFlags = { ...flags }; });
  const ref: FileRef = { kind: 'path', path };
  const data = new Uint8Array(readFileSync(path));
  const opened = readsAsBytes(path, readOptionsFor(flags)) ? { content: '', bytes: data } : { content: text(data) };
  await store.getState().openOpenedFile({ name: basename(path), ...opened, ref });
  return store;
}
const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
const clearNotices = (store: Store) => store.setState(s => { s.ui.notifications = []; });
function shiftFirstTask(store: Store): string {
  const task = store.getState().tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
  store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
  store.getState().runCPM();
  return task.id;
}
const shown = (tasks: readonly Task[]) => JSON.stringify(tasks.map(t => [t.id,
  t.time.scheduleStart, t.time.scheduleFinish, t.time.earlyStart, t.time.earlyFinish, t.time.lateStart, t.time.lateFinish,
  t.time.scheduleDuration, t.time.totalFloat]));
function saveWorker() {
  const workers: InProcessWorker[] = [];
  const client = createIfcSaveWorker({ createWorker: () => { const w = new InProcessWorker('auto'); workers.push(w); return w; } });
  return { client, requests: () => workers.flatMap(w => w.requests) };
}

await check('flag uit: leesopties, filters, slepen en het documentformaat zijn die van main', async () => {
  const off = readOptionsFor({});
  assert.deepEqual(off, { ifcBytes: false });
  assert.deepEqual(readOptionsFor({ ifcForeignContent: true }), { ifcBytes: true });
  assert.deepEqual(openDialogFilters(off), openDialogFilters());
  assert.deepEqual(openDialogFilters(off)[0].extensions, ['ifc', 'csv', 'xml', 'mpp', 'xer']);
  assert.deepEqual(binaryExtensions(off), ['mpp', 'xer']);
  assert.equal(isReadableFileName('plan.ifcx', off), false);
  assert.equal(readFormatForFile('plan.ifcx', off).id, 'ifc');
  assert.equal(documentFileFormat({ filePath: 'plan.ifcx' }, {}), 'ifc');
  assert.deepEqual(documentFileFilters(documentFileFormat({ filePath: 'plan.ifcx' }, {})), [{ name: 'IFC Files', extensions: ['ifc'] }]);
  assert.equal(documentSaveCompute({}, computeIfcOutputHere), computeIfcOutputHere, 'de schrijftaak is die van main');
  const split = splitDroppedFiles([{ name: 'plan.ifcx', read: async () => { throw new Error('niet lezen'); } }], off);
  assert.deepEqual(split.refused, ['plan.ifcx']);
});

await check('flag aan: IFCX in de filters, bij slepen en als bytes', async () => {
  const on = readOptionsFor(IFCX_ON);
  assert.equal(on.ifcx, true);
  assert.deepEqual(openDialogFilters(on)[0].extensions, ['ifc', 'ifcx', 'csv', 'xml', 'mpp', 'xer']);
  assert(openDialogFilters(on).some(f => f.name === 'IFCX Files'));
  assert.deepEqual(binaryExtensions(on), ['ifcx', 'mpp', 'xer']);
  assert.equal(isReadableFileName('plan.IFCX', on), true);
  assert.equal(readFormatForFile('plan.ifcx', on).id, 'ifcx');
  assert.equal(readFormatForFile('plan.ifcx', on).canBeSaveTarget, true);
  assert.equal(documentFileFormat({ filePath: '/map/plan.ifcx' }, IFCX_ON), 'ifcx');
  assert.equal(documentFileFormat({ filePath: '/map/plan.ifc' }, IFCX_ON), 'ifc');
  assert.deepEqual(documentFileFilters('ifcx'), [{ name: 'IFCX Files', extensions: ['ifcx'] }]);
});

await check('flag uit: een .ifcx opent niet als IFCX', async () => {
  const path = join(dir, 'uit.ifcx'); writeFileSync(path, own);
  const store = await openAt(path, {});
  assert.notEqual(store.getState().filePath, path);
  assert.deepEqual(errors(store), ['notifications.openFailed']);
});

for (const [label, flags] of [['alleen ifcx', IFCX_ON], ['ifcx en ifcForeignContent', BOTH_ON]] as const) {
  for (const route of ['worker', 'hoofdthread'] as const) {
    await check(`${label}, ${route}: openen, taak verschuiven, Ctrl+S schrijft IFCX en heropent met de wijziging`, async () => {
      const ipc = desktop();
      const sw = route === 'worker' ? saveWorker() : null;
      try {
        const path = join(dir, `ctrl-s-${route}-${flags.ifcForeignContent ? 'beide' : 'ifcx'}.ifcx`); writeFileSync(path, own);
        const store = await openAt(path, flags, sw?.client.compute);
        assert.equal(store.getState().filePath, path);
        const id = shiftFirstTask(store);
        const duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
        assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), true);
        assert.deepEqual(errors(store), []);
        const written = new Uint8Array(readFileSync(path));
        assert(isIfcxText(written), 'het bestand is IFCX');
        assert.equal(readIfcx(written).tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
        assert.equal(store.getState().isDirty, false);
        assert.deepEqual(store.getState().ui.notifications.filter(n => n.messageKey.startsWith('notifications.foreignChanges')), [],
          'geen telling van vreemde gegevens (#1199): een IFCX-document heeft geen vreemd deel');
        if (sw) {
          const writerJobs = sw.requests().filter(r => r.job.kind === 'writer');
          assert.equal(writerJobs.length, 1);
          assert.equal(writerJobs[0].job.kind === 'writer' && writerJobs[0].job.format, 'ifcx', 'de worker rekende IFCX');
        }
        const reopened = await openAt(path, flags);
        assert.equal(shown(reopened.getState().tasks), shown(store.getState().tasks), 'heropend: dezelfde datums');
        assert.deepEqual([...(readIfcx(written).ifcLiteralCalendarIds ?? [])].sort(),
          [...(store.getState().ifcLiteralCalendarIds ?? [])].sort(), 'de letterlijke kalenders van het bestand zijn vastgelegd');
      } finally { ipc.dispose(); sw?.client.dispose(); }
    });
  }
}

for (const name of FIXTURES) {
  await check(`openen zonder wijziging, Ctrl+S, heropenen, Ctrl+S (${name}); de maat: dezelfde route met een eigen .ifc`, async () => {
    const ipc = desktop();
    try {
      const results: Record<string, unknown> = {};
      const source = join(dir, `bron-${name}`); writeFileSync(source, fixture(name));
      const asStep = new TextEncoder().encode(writeIFC(buildWriteIFCInput((await openAt(source, IFCX_ON)).getState(), 'planOnly')));
      for (const format of ['ifcx', 'ifc'] as const) {
        const start = format === 'ifcx' ? fixture(name) : asStep;
        const path = join(dir, `ongewijzigd-${name}.${format}`); writeFileSync(path, start);
        const store = await openAt(path, IFCX_ON);
        const before = shown(store.getState().tasks);
        assert.deepEqual(errors(store), [], `${format} opent`);
        assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), true, `${format}: eerste opslag`);
        assert.deepEqual(errors(store), []);
        const first = new Uint8Array(readFileSync(path));
        assert(format === 'ifcx' ? isIfcxText(first) : isStep(first));
        const reopened = await openAt(path, IFCX_ON);
        assert.deepEqual(errors(reopened), [], 'het geschreven bestand opent weer');
        assert.equal(shown(reopened.getState().tasks), before, 'na heropenen dezelfde datums als vóór het opslaan');
        assert.equal(await reopened.getState().saveFileForDocument(reopened.getState().activeDocumentId), true, `${format}: tweede opslag`);
        const second = new Uint8Array(readFileSync(path));
        assert.equal(hash(second), hash(first), 'een tweede opslag zonder wijziging schrijft dezelfde bytes');
        results[format] = { eersteOpslagVerandertHetBestand: hash(first) !== hash(start), eersteVerschil: firstLineDifference(start, first),
          buitenSchrijftijd: firstLineDifference(start, first, true) };
      }
      console.log(`  MAAT ${name}: ${JSON.stringify(results)}`);
    } finally { ipc.dispose(); }
  });
}

for (const name of FIXTURES) {
  await check(`na openen, ook na doorrekenen, heeft de app dezelfde planning als na openen van de STEP-versie (${name})`, async () => {
    const bytes = fixture(name);
    const step = new TextEncoder().encode(writeIFC(buildWriteIFCInput(documentDataFromImport(structuredClone(readIfcx(bytes))), 'planOnly')));
    const asIfcx = join(dir, `gelijk-${name}`), asStep = join(dir, `gelijk-${name}.ifc`);
    writeFileSync(asIfcx, bytes); writeFileSync(asStep, step);
    const fromIfcx = await openAt(asIfcx, IFCX_ON), fromStep = await openAt(asStep, IFCX_ON);
    assert.deepEqual(errors(fromIfcx), []); assert.deepEqual(errors(fromStep), []);
    const planning = (store: Store) => {
      const { project, ...rest } = JSON.parse(JSON.stringify(buildWriteIFCInput(store.getState(), 'planOnly')));
      return { ...rest, project: { ...project, modifiedAt: undefined } };
    };
    const a = planning(fromIfcx), b = planning(fromStep);
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      assert.deepEqual(a[key], b[key], `het veld ${key} van de opgeslagen planning`);
    }
    assert.equal(shown(fromIfcx.getState().tasks), shown(fromStep.getState().tasks), 'de getoonde datums');
    assert.deepEqual(fromIfcx.getState().cpmResult?.criticalPath, fromStep.getState().cpmResult?.criticalPath, 'het kritieke pad');
  });
}

await check('de maat op main: een eigen .ifc uit public/examples openen, niets wijzigen, Ctrl+S, nog eens Ctrl+S', async () => {
  const ipc = desktop();
  try {
    const start = new Uint8Array(readFileSync(join(root, 'public/examples/showcase-verbouwing-eengezinswoning.ifc')));
    const path = join(dir, 'voorbeeld.ifc'); writeFileSync(path, start);
    const store = await openAt(path, {});
    const before = shown(store.getState().tasks);
    assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), true);
    const first = new Uint8Array(readFileSync(path));
    const reopened = await openAt(path, {});
    assert.equal(shown(reopened.getState().tasks), before);
    assert.equal(await reopened.getState().saveFileForDocument(reopened.getState().activeDocumentId), true);
    const second = new Uint8Array(readFileSync(path));
    console.log(`  MAAT main .ifc: ${JSON.stringify({ eersteOpslagVerandertHetBestand: hash(first) !== hash(start),
      tweedeOpslagGelijk: hash(second) === hash(first), eersteVerschil: firstLineDifference(start, first),
      buitenSchrijftijd: firstLineDifference(start, first, true) })}`);
  } finally { ipc.dispose(); }
});

await check('Opslaan als (desktop): voorgestelde naam op .ifcx, het IFCX-filter, uitvoer IFCX; met de flag uit de naam van main', async () => {
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
      assert(isIfcxText(new Uint8Array(readFileSync(target))));
      assert.equal(store.getState().filePath, target);
      assert.equal(hash(new Uint8Array(readFileSync(path))), hash(own), 'het oude bestand bleef staan');
    } finally { ipc.dispose(); }
  }
  const ipc = desktop();
  try {
    const path = join(dir, 'uit-als.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    store.setState(s => { s.ui.featureFlags = {}; });
    const typed = join(dir, 'uit-als-ifc.ifcx'); ipc.choose(typed);
    await store.getState().saveFileAs();
    assert.deepEqual(ipc.dialogs[0].filters, [{ name: 'IFC Files', extensions: ['ifc'] }]);
    assert.equal(existsSync(`${typed}.ifc`), true, 'de extensie van main: .ifcx.ifc');
    assert(isStep(new Uint8Array(readFileSync(`${typed}.ifc`))));
    assert.equal(hash(new Uint8Array(readFileSync(path))), hash(own));
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
    assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), false);
    assert.deepEqual(errors(store), ['ifcx.flagOff']);
    clearNotices(store);
    const autosave = createFileAutoSaveController({ getState: store.getState, enabled: () => true });
    await autosave.flush(); await autosave.flush();
    assert.deepEqual(errors(store), ['ifcx.flagOff'], 'één melding voor Automatisch opslaan');
    assert.equal(ipc.calls.slice(calls).filter(c => c.command.includes('write') || c.command === 'plugin:fs|rename'
      || c.command === 'place_file_exclusive').length, 0, 'geen schrijfactie');
    assert.equal(hash(new Uint8Array(readFileSync(path))), hash(own));
    assert.equal(store.getState().isDirty, true);
  } finally { ipc.dispose(); }
});

await check('Automatisch opslaan naar het bestand schrijft een IFCX-document als IFCX, in de worker', async () => {
  const ipc = desktop();
  const sw = saveWorker();
  try {
    const path = join(dir, 'autosave.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON, sw.client.compute);
    store.setState(s => { s.autoSaveToFile = true; });
    const id = shiftFirstTask(store), duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
    await createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw.client.compute }).flush();
    assert.deepEqual(errors(store), []);
    const written = new Uint8Array(readFileSync(path));
    assert(isIfcxText(written));
    assert.equal(readIfcx(written).tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(sw.requests().map(r => r.job.kind === 'writer' && r.job.format), ['ifcx']);
  } finally { ipc.dispose(); sw.client.dispose(); }
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
    assert(isIfcxText(new Uint8Array(readFileSync(path))));
    assert.equal(store.getState().isDirty, false);
  } finally { ipc.dispose(); }
});

await check('crash na een bewerking, herstel, Ctrl+S: IFCX, byte-gelijk aan een opslag zonder crash', async () => {
  const appData = mkdtempSync(join(tmpdir(), 'ops-ifcx-herstel-'));
  const ipc = desktop(appData);
  try {
    const plain = join(dir, 'zonder-crash.ifcx'), crashed = join(dir, 'met-crash.ifcx');
    writeFileSync(plain, own); writeFileSync(crashed, own);
    const reference = await openAt(plain, IFCX_ON);
    shiftFirstTask(reference);
    assert.equal(await reference.getState().saveFileForDocument(reference.getState().activeDocumentId), true);
    const store = await openAt(crashed, IFCX_ON);
    shiftFirstTask(store);
    await clearRecovery();
    const tracker = new RecoveryDeltaTracker();
    const unregister = registerRecoveryFlush(async () => {
      const s = store.getState();
      await runRecoveryTick(tracker, s.activeDocumentId,
        s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
    });
    try { await flushRecoveryNow(); } finally { unregister(); }
    const loaded = await loadRecovery();
    assert.equal(loaded.docs.length, 1);
    const { createAppStoreContext } = await loadStore(), restored = createAppStoreContext().store;
    restored.setState(s => { s.ui.featureFlags = { ...IFCX_ON }; });
    const inputs = [];
    for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, false));
    assert.equal(restored.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
    assert.equal(restored.getState().filePath, crashed);
    assert.equal(await restored.getState().saveFileForDocument(restored.getState().activeDocumentId), true);
    assert.deepEqual(errors(restored), []);
    const after = new Uint8Array(readFileSync(crashed));
    assert(isIfcxText(after));
    assert.equal(hash(after), hash(new Uint8Array(readFileSync(plain))), 'byte-gelijk aan de opslag zonder crash');
  } finally { ipc.dispose(); }
});

const foreignIfcx = (() => {
  const document = JSON.parse(text(own));
  document.header.id = 'urn:ifccad:model:hello-wall';
  return new TextEncoder().encode(JSON.stringify(document, null, 2));
})();
const unreadableIfcx = new TextEncoder().encode(text(own).replace('"ifcxVersion": "ifcx_alpha"', '"ifcxVersion": "ifcx_alpha", "extra": 1'));

await check('doelbescherming: een bestaand IFCX van een ander of onleesbaar blijft staan op Ctrl+S, Opslaan als en Automatisch opslaan', async () => {
  assert.equal(classifyIfcx(foreignIfcx), 'foreign');
  assert.notEqual(classifyIfcx(unreadableIfcx), 'own');
  for (const [kind, content] of [['vreemd', foreignIfcx], ['onleesbaar', unreadableIfcx]] as const) {
    const ipc = desktop();
    try {
      const target = join(dir, `doel-${kind}.ifcx`); writeFileSync(target, content);
      const path = join(dir, `bron-voor-doel-${kind}.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, IFCX_ON);
      shiftFirstTask(store); clearNotices(store);
      ipc.choose(target);
      await store.getState().saveFileAs();
      assert.equal(errors(store).length, 1, `Opslaan als weigert (${errors(store)})`);
      assert.equal(hash(new Uint8Array(readFileSync(target))), hash(content), 'het doel bleef byte-gelijk');
      writeFileSync(path, content); clearNotices(store);
      assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), false);
      assert.equal(errors(store).length, 1, 'Ctrl+S weigert');
      assert.equal(hash(new Uint8Array(readFileSync(path))), hash(content));
      store.setState(s => { s.autoSaveToFile = true; }); clearNotices(store);
      await createFileAutoSaveController({ getState: store.getState, enabled: () => true }).flush();
      assert.equal(errors(store).length, 1, 'Automatisch opslaan weigert');
      assert.equal(hash(new Uint8Array(readFileSync(path))), hash(content));
      assert.equal(store.getState().isDirty, true);
    } finally { ipc.dispose(); }
  }
});

await check('bytes die de app als IFCX las of schreef, toetst de doelcontrole niet opnieuw', async () => {
  const notIfcx = new TextEncoder().encode('{"geen":"ifcx"}');
  assert.equal(await classifyIfcxTarget(notIfcx), 'not-ifcx');
  rememberOwnIfcxDigest(createHash('sha256').update(notIfcx).digest('hex'));
  assert.equal(await classifyIfcxTarget(notIfcx), 'own', 'een herkende vingerafdruk gaat niet opnieuw door de kern');
});

await check('resources: de kern weigert het schrijven, er wordt niets geschreven, één melding (ook uit de worker)', async () => {
  for (const route of ['worker', 'hoofdthread'] as const) {
    const ipc = desktop();
    const sw = route === 'worker' ? saveWorker() : null;
    try {
      const path = join(dir, `resource-${route}.ifcx`); writeFileSync(path, own);
      const store = await openAt(path, IFCX_ON, sw?.client.compute);
      store.getState().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, costPerHour: 10 });
      clearNotices(store);
      assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), false);
      assert.deepEqual(errors(store), ['ifcx.writeRefused']);
      assert(store.getState().ui.notifications[0].detail?.includes('resources'), 'de melding noemt het veld');
      assert.equal(hash(new Uint8Array(readFileSync(path))), hash(own));
      assert.equal(store.getState().isDirty, true);
    } finally { ipc.dispose(); sw?.client.dispose(); }
  }
});

await check('download en site: IFCX met de naam op .ifcx', async () => {
  const { createAppStoreContext } = await loadStore();
  const win = window as unknown as Record<string, unknown>;
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL, downloads: { blob: Blob; name: string }[] = [];
  let lastName = '';
  URL.createObjectURL = blob => { downloads.push({ blob: blob as Blob, name: '' }); return 'blob:ifcx'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => { const a = { href: '', download: '', click: () => { lastName = a.download; downloads.at(-1)!.name = a.download; } }; return a; },
    documentElement: {},
  } });
  try {
    const store = createAppStoreContext().store;
    store.setState(s => { s.ui.featureFlags = { ...IFCX_ON }; });
    await store.getState().openOpenedFile({ name: 'download.ifcx', content: '', bytes: own, ref: null });
    assert.equal(store.getState().filePath, 'download.ifcx');
    shiftFirstTask(store);
    await store.getState().saveFile();
    assert.deepEqual(errors(store), []);
    assert.equal(downloads.length, 1);
    assert.equal(lastName, `${store.getState().project.name}.ifcx`, 'de naam van main, met de extensie van het formaat');
    assert(isIfcxText(new Uint8Array(await downloads[0].blob.arrayBuffer())));
  } finally {
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
  const requests: { id?: string; data: Blob; name?: string; baseVersion?: string }[] = [];
  win.openaecHost = { storage: {
    list: async () => [], versions: async () => [],
    open: async () => ({ data: new Blob([own.slice().buffer]), file: { name: 'site.ifcx', version: 'v1' } }),
    save: async (request: { id?: string; data: Blob; name?: string; baseVersion?: string }) => {
      requests.push(request);
      return { id: request.id ?? 'nieuw', name: request.name ?? 'site.ifcx', version: `v${requests.length + 1}` };
    },
  } };
  setSiteSaveAsker(async () => ({ kind: 'site', name: 'kopie' }));
  try {
    const store = createAppStoreContext().store;
    store.setState(s => { s.ui.featureFlags = { ...IFCX_ON }; });
    assert.equal(await store.getState().openFromSite('bron'), true,
      `site opent: ${JSON.stringify(store.getState().ui.notifications.map(n => [n.messageKey, n.detail]))}`);
    assert.equal(store.getState().siteFileId, 'bron');
    shiftFirstTask(store);
    assert.equal(await store.getState().saveFileForDocument(store.getState().activeDocumentId), true,
      `site Ctrl+S: ${JSON.stringify(store.getState().ui.notifications.map(n => [n.messageKey, n.detail]))}`);
    assert.deepEqual(errors(store), []);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].id, 'bron');
    assert(isIfcxText(new Uint8Array(await requests[0].data.arrayBuffer())));
    await store.getState().saveFileAs();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].name, 'kopie.ifcx', 'Opslaan als op de site krijgt de extensie van het formaat');
    assert(isIfcxText(new Uint8Array(await requests[1].data.arrayBuffer())));
  } finally { delete win.openaecHost; resetSiteAskers(); }
});

await check('Exporteren → IFC van een IFCX-document blijft STEP', async () => {
  const ipc = desktop();
  try {
    const path = join(dir, 'export-bron.ifcx'); writeFileSync(path, own);
    const store = await openAt(path, IFCX_ON);
    const target = join(dir, 'export.ifc'); ipc.choose(target);
    await store.getState().exportAs('ifc');
    assert(isStep(new Uint8Array(readFileSync(target))));
    assert.equal(store.getState().filePath, path);
  } finally { ipc.dispose(); }
});

await check('een STEP-bestand met de naam .ifcx: met de flag uit opent het als IFC zoals op main (Ctrl+S weigert, knownbug 2364); met de flag aan niet', async () => {
  const source = join(dir, 'step-bron.ifcx'); writeFileSync(source, own);
  const step = new TextEncoder().encode(writeIFC(buildWriteIFCInput((await openAt(source, IFCX_ON)).getState(), 'planOnly')));
  const path = join(dir, 'step-met-ifcx-naam.ifcx'); writeFileSync(path, step);
  const ipc = desktop();
  try {
    const off = await openAt(path, {});
    assert.deepEqual(errors(off), []);
    assert.equal(off.getState().filePath, path);
    shiftFirstTask(off);
    assert.equal(await off.getState().saveFileForDocument(off.getState().activeDocumentId), false);
    assert.deepEqual(errors(off), ['ifcx.flagOff']);
    assert.equal(hash(new Uint8Array(readFileSync(path))), hash(step));
  } finally { ipc.dispose(); }
  const on = await openAt(path, IFCX_ON);
  assert.deepEqual(errors(on), ['ifcx.open.notIfcx']);
});

console.log(`\nIFCX in de app: ${passed} proeven geslaagd, ${failed} fouten`);
if (failed > 0) process.exit(1);
