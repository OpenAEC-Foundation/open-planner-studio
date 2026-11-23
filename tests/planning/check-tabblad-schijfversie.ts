import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIfcFromText } from '@/services/formatRegistry';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import type { IfcSaveResponse, IfcSaveResult } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import type { IfcOutputCompute, IfcSaveJob } from '@/state/prepareIfcOutput';
import type { FileRef } from '@/services/fileAccess';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { resetSiteAskers, setSiteSaveAsker } from '@/services/fileAccess/siteDialogs';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { clearRecovery } from '@/services/recovery/recoveryStore';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { payloadFromInput, recoveryInputFromParsed } from '@/state/documentContract';
import { openInStore, loadStore } from './ifcAppRoute';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';
import { installDeterminism } from './ifcPariteitKern';
import { InProcessWorker } from './inProcessSaveWorker';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const modelBytes = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const plainBytes = () => new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
const otherPlainBytes = () => new Uint8Array(readFileSync(join(root, 'public/examples/10-villa-wassenaar.ifc')));
const dir = mkdtempSync(join(tmpdir(), 'ops-schijfversie-'));
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const print = (data: Uint8Array) => ({ sha256: sha(data), byteLength: data.byteLength });
const onDisk = (path: string) => print(new Uint8Array(readFileSync(path)));
type Store = Awaited<ReturnType<typeof openInStore>>['store'];

let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  console.log(`START ${name}`);
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) {
    failed++;
    const text = error instanceof Error ? error.message : typeof error === 'object' ? JSON.stringify(error) : String(error);
    console.error(`XX ${name}: ${text.slice(0, 1600)}`);
  }
}

const known = (store: Store, id = store.getState().activeDocumentId) => {
  const s = store.getState();
  return id === s.activeDocumentId ? s.knownTargetFingerprint : s.documents.find(d => d.id === id)!.payload!.knownTargetFingerprint;
};
let added = 0;
const edit = (store: Store) => {
  store.getState().addTask({ name: `Toegevoegd voor de schijfversie ${++added}` });
  store.getState().runCPM();
};
const ctrlS = (store: Store) => store.getState().saveFileForDocument(store.getState().activeDocumentId);
const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
const quietly = async <T,>(run: () => Promise<T>): Promise<T> => {
  const realError = console.error;
  console.error = () => {};
  try { return await run(); } finally { console.error = realError; }
};

const handleFiles = new Map<string, Uint8Array>();
class FakeHandle {
  readonly kind = 'file';
  constructor(readonly name: string) {}
  async isSameEntry(other: unknown) { return other instanceof FakeHandle && other.name === this.name; }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async getFile() {
    const data = handleFiles.get(this.name);
    if (!data) throw new DOMException('weg', 'NotFoundError');
    return new File([new Uint8Array(data).buffer], this.name);
  }
  async createWritable() {
    const name = this.name, parts: Uint8Array[] = [];
    return {
      write: async (part: Uint8Array | string) => { parts.push(typeof part === 'string' ? new TextEncoder().encode(part) : new Uint8Array(part)); },
      abort: async () => {},
      close: async () => { handleFiles.set(name, new Uint8Array(Buffer.concat(parts))); },
    };
  }
}
let handleCount = 0;
const newHandle = (data?: Uint8Array) => {
  const handle = new FakeHandle(`bestand-${++handleCount}.ifc`);
  if (data) handleFiles.set(handle.name, data);
  return handle;
};
const handleRef = (handle: FakeHandle): FileRef => ({ kind: 'handle', handle: handle as unknown as FileSystemFileHandle });
const onHandle = (handle: FakeHandle) => print(handleFiles.get(handle.name)!);
const hydrateHandles = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  if (Reflect.get(value, 'kind') === 'file' && handleFiles.has(Reflect.get(value, 'name'))) Object.setPrototypeOf(value, FakeHandle.prototype);
  else for (const child of Object.values(value)) hydrateHandles(child);
};
installFakeRecoveryIndexedDb({ onRead: (_store, _method, value) => hydrateHandles(value) });
const sessionValues = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (k: string) => sessionValues.get(k) ?? null, setItem: (k: string, v: string) => sessionValues.set(k, v),
  removeItem: (k: string) => sessionValues.delete(k),
} });

function recoveryRounds(store: Store) {
  const tracker = new RecoveryDeltaTracker();
  return registerRecoveryFlush(async () => {
    const s = store.getState();
    await runRecoveryTick(tracker, s.activeDocumentId,
      s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
  });
}

function desktop() {
  const ipc = installNodeFileIpc({ appDataDir: mkdtempSync(join(dir, 'appdata-')) });
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const invoke = win.__TAURI_INTERNALS__.invoke;
  let answer: string | null = null, picks = 0;
  let onPick: (() => void) | undefined;
  win.__TAURI_INTERNALS__.invoke = async (...args) => {
    if (args[0] === 'plugin:dialog|save') { picks++; onPick?.(); return answer; }
    return invoke(...args);
  };
  return { ...ipc, choose: (path: string | null) => { answer = path; }, picks: () => picks, onPick: (action: () => void) => { onPick = action; } };
}

function browserDownload() {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL, downloads: Blob[] = [];
  URL.createObjectURL = blob => { assert(blob instanceof Blob); downloads.push(blob); return 'blob:schijfversie'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ href: '', download: '', click: () => {} }), documentElement: {},
  } });
  return { downloads, dispose: () => {
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  } };
}

function browserPicker() {
  const win = window as unknown as Record<string, unknown>, picked: FakeHandle[] = [];
  win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
  win.showSaveFilePicker = async () => { const handle = newHandle(new Uint8Array()); picked.push(handle); return handle; };
  return { picked, dispose: () => { delete win.showOpenFilePicker; delete win.showSaveFilePicker; } };
}

class RecordingWorker extends InProcessWorker {
  readonly answers: IfcSaveResponse[] = [];
  override emit(data: IfcSaveResponse) { this.answers.push(data); super.emit(data); }
}
function saveWorker() {
  const workers: RecordingWorker[] = [];
  const client = createIfcSaveWorker({ createWorker: () => { const worker = new RecordingWorker(); workers.push(worker); return worker; } });
  return {
    compute: client.compute, dispose: () => client.dispose(),
    jobs: (): IfcSaveJob[] => workers.flatMap(worker => worker.requests.map(request => request.job)),
    results: (): IfcSaveResult[] => workers.flatMap(worker => worker.answers.flatMap(answer => 'result' in answer ? [answer.result] : [])),
  };
}

async function openAt(ref: FileRef | null, data: Uint8Array, compute?: IfcOutputCompute, flag = true) {
  const { createAppStoreContext } = await loadStore(), context = createAppStoreContext({ ifcSaveCompute: compute });
  context.store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
  const name = ref?.kind === 'path' ? basename(ref.path) : 'bron.ifc';
  await context.store.getState().openOpenedFile(flag
    ? { name, content: '', bytes: data, ref } : { name, content: new TextDecoder().decode(data), ref });
  return context;
}
const fileAt = (name: string, data: Uint8Array) => {
  const path = join(dir, name);
  writeFileSync(path, data);
  return path;
};

await check('openen van een eigen pad of handle: het veld is de SHA-256 van de gelezen bytes', async () => {
  const ipc = desktop();
  try {
    const path = fileAt('open-pad.ifc', plainBytes());
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    assert.deepEqual(known(store), onDisk(path));
    const source = store.getState().ifcSource!;
    assert.deepEqual(known(store), { sha256: source.sha256, byteLength: source.bytes.byteLength }, 'de hash en de bytes van de bron, geen tweede berekening');
  } finally { ipc.dispose(); }
  const handle = newHandle(modelBytes);
  const { store } = await openAt(handleRef(handle), modelBytes);
  assert.deepEqual(known(store), onHandle(handle));
});

await check('onbekend bij openen zonder eigen bestand, van de site, met de flag uit, in een kopie, na laden in hetzelfde tabblad en na herstel', async () => {
  const { store: withoutTarget } = await openInStore(plainBytes());
  assert(withoutTarget.getState().ifcSource, 'de bytes-route liep');
  assert.deepEqual(known(withoutTarget), null, 'de browser zonder handle heeft geen eigen bestand');
  const { store: site } = await openAt({ kind: 'site', id: 'bron' }, plainBytes());
  assert.equal(site.getState().siteFileId, 'bron');
  assert.deepEqual(known(site), null, 'op de site is siteFileVersion de versie');
  const ipc = desktop();
  try {
    const offPath = fileAt('open-flag-uit.ifc', plainBytes());
    const { store: off } = await openAt({ kind: 'path', path: offPath }, plainBytes(), undefined, false);
    assert.equal(off.getState().filePath, offPath);
    assert.deepEqual(known(off), null, 'met de flag uit blijft het veld leeg');
    const own = fileAt('kopie-bron.ifc', plainBytes());
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    const original = store.getState().activeDocumentId;
    const copy = store.getState().duplicateDocument();
    assert.deepEqual(known(store, copy), null, 'een kopie heeft geen eigen bestand');
    assert.deepEqual(known(store, original), onDisk(own), 'het origineel houdt zijn hash');
    store.getState().switchDocument(original);
    const changedText = new TextDecoder().decode(plainBytes()).replace("'Zuidas Office Building'", "'Zuidas, gewijzigd'");
    const changed = await readIfcFromText(changedText, undefined, { ifcBytes: true });
    assert(changed.ifcSource && changed.ifcSource.sha256 !== onDisk(own).sha256, 'een bron met andere bytes dan het eigen bestand');
    store.getState().applyProjectEdit(changed);
    assert.deepEqual(known(store), onDisk(own), 'IFC toepassen schrijft het eigen bestand niet: de hash blijft');
    store.getState().loadState(changed);
    assert.equal(store.getState().filePath, own);
    assert.deepEqual(known(store), null, 'laden in hetzelfde tabblad: wat geladen is, kwam niet van het eigen bestand');
    const restored = payloadFromInput({
      ...recoveryInputFromParsed(changed, { id: 'hersteld', filePath: own, isDirty: true, datesAsRecorded: false }), sourceRestored: true,
    });
    assert.equal(restored.knownTargetFingerprint, null, 'een hersteld tabblad weet niet wat er intussen op schijf gebeurde');
  } finally { ipc.dispose(); }
});

for (const route of ['opslagworker', 'hoofdthread', 'worker start niet'] as const) {
  await check(`rij 8, Ctrl+S van een gewone planning op het eigen pad (${route}): de hash van wat er nu op schijf staat`, async () => {
    const sw = route === 'opslagworker' ? saveWorker() : null;
    const fallback = route === 'worker start niet' ? createIfcSaveWorker({ createWorker: () => null }) : null;
    const ipc = desktop(), path = fileAt(`ctrl-s-${route.replace(/ /g, '-')}.ifc`, plainBytes());
    try {
      const { store } = await openAt({ kind: 'path', path }, plainBytes(), sw?.compute ?? fallback?.compute);
      const opened = known(store);
      for (const round of [1, 2]) {
        const before = onDisk(path).byteLength;
        edit(store);
        assert.equal(await ctrlS(store), true, `ronde ${round}`);
        assert.notEqual(onDisk(path).byteLength, before, `ronde ${round}: de grootte veranderde`);
        assert.deepEqual(known(store), onDisk(path), `ronde ${round}`);
      }
      assert.notDeepEqual(known(store), opened);
      if (sw) {
        assert.deepEqual(sw.jobs().map(job => job.kind === 'writer' && job.hashBytes), [true, true], 'de job vraagt de hash');
        const last = sw.results().at(-1)!;
        assert.equal(last.kind === 'writer' ? last.sha256 : undefined, onDisk(path).sha256, 'de worker rekende hem');
      }
      assert.deepEqual(errors(store), []);
    } finally { ipc.dispose(); sw?.dispose(); fallback?.dispose(); }
  });
}

await check('rij 8, Ctrl+S van een gewone planning via de eigen handle, met en zonder opslagworker', async () => {
  for (const sw of [saveWorker(), null]) {
    const handle = newHandle(plainBytes());
    try {
      const { store } = await openAt(handleRef(handle), plainBytes(), sw?.compute);
      const opened = known(store);
      edit(store);
      assert.equal(await ctrlS(store), true);
      assert.notDeepEqual(onHandle(handle), opened);
      assert.deepEqual(known(store), onHandle(handle));
    } finally { sw?.dispose(); }
  }
});

await check('rij 3, Ctrl+S met een gebouwmodel op het eigen pad: de hash van de vervanging', async () => {
  const ipc = desktop(), path = fileAt('model-pad.ifc', modelBytes);
  try {
    const { store } = await openAt({ kind: 'path', path }, modelBytes);
    const unregister = recoveryRounds(store);
    try {
      edit(store);
      assert.equal(await ctrlS(store), true);
      assert.notDeepEqual(onDisk(path), print(modelBytes));
      assert.deepEqual(known(store), onDisk(path));
      assert.equal(known(store)!.sha256, store.getState().ifcSource!.sha256);
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); }
});

await check('rij 2, Ctrl+S met een gebouwmodel via de eigen handle: de hash van de vervanging', async () => {
  const handle = newHandle(modelBytes);
  const { store } = await openAt(handleRef(handle), modelBytes);
  const unregister = recoveryRounds(store);
  try {
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.notDeepEqual(onHandle(handle), print(modelBytes));
    assert.deepEqual(known(store), onHandle(handle));
  } finally { unregister(); await clearRecovery(); }
});

await check('rij 4 en 5, Opslaan als op de desktop (nieuwe naam, bestaand bestand, Ctrl+S zonder doel): de hash van het nieuwe doel', async () => {
  const sw = saveWorker(), ipc = desktop(), own = fileAt('als-eigen.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes(), sw.compute);
    const opened = known(store);
    edit(store);
    const fresh = join(dir, 'als-nieuw.ifc'); ipc.choose(fresh);
    await store.getState().saveFileAs();
    assert.equal(store.getState().filePath, fresh);
    assert.deepEqual(known(store), onDisk(fresh), 'rij 4: de nieuwe naam');
    assert.notDeepEqual(known(store), opened);
    edit(store);
    const existing = fileAt('als-bestaand.ifc', otherPlainBytes()); ipc.choose(existing);
    await store.getState().saveFileAs();
    assert.equal(store.getState().filePath, existing);
    assert.deepEqual(known(store), onDisk(existing), 'rij 5: over een bestaand bestand');
    edit(store);
    store.setState(s => { s.filePath = null; });
    const viaCtrlS = join(dir, 'als-ctrl-s.ifc'); ipc.choose(viaCtrlS);
    assert.equal(await ctrlS(store), true);
    assert.equal(store.getState().filePath, viaCtrlS);
    assert.deepEqual(known(store), onDisk(viaCtrlS), 'rij 4: de bestandskiezer van Ctrl+S');
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); sw.dispose(); }
});

await check('rij 4, Opslaan als met een gebouwmodel naar een nieuwe naam: de hash van de geschreven merge', async () => {
  const ipc = desktop(), own = fileAt('als-model.ifc', modelBytes);
  try {
    const { store } = await openAt({ kind: 'path', path: own }, modelBytes);
    edit(store);
    const fresh = join(dir, 'als-model-nieuw.ifc'); ipc.choose(fresh);
    await store.getState().saveFileAs();
    assert.equal(store.getState().filePath, fresh);
    assert.deepEqual(known(store), onDisk(fresh));
    assert.deepEqual(onDisk(own), print(modelBytes), 'het origineel bleef staan');
  } finally { ipc.dispose(); }
});

for (const kind of ['nieuw', 'versie', 'conflictkopie'] as const) {
  const row = kind === 'nieuw' ? 1 : kind === 'versie' ? 7 : 6;
  await check(`rij ${row}, de site (${kind}): onbekend, ook als het tabblad eerst een hash had`, async () => {
    const win = window as unknown as Record<string, unknown>;
    win.openaecHost = kind === 'conflictkopie' ? {
      list: async () => [], versions: async () => [], open: async () => null,
      save: async () => ({ id: 'kopie', name: 'conflict.ifc', version: 'v9', conflictCopy: true }),
    } : { storage: {
      list: async () => [], versions: async () => [], open: async () => null,
      save: async (request: { id?: string }) => ({ id: request.id ?? 'nieuw', name: 'hostnaam.ifc', version: 'v2' }),
    } };
    setSiteSaveAsker(async () => ({ kind: 'site', name: 'nieuw.ifc' }));
    try {
      const handle = newHandle(modelBytes);
      const { store } = kind === 'nieuw' ? await openAt(handleRef(handle), modelBytes) : await openAt({ kind: 'site', id: 'bron' }, modelBytes);
      if (kind === 'nieuw') assert.deepEqual(known(store), onHandle(handle));
      else store.setState(s => { s.siteFileVersion = 'v1'; s.knownTargetFingerprint = print(modelBytes); });
      edit(store);
      if (kind === 'nieuw') await store.getState().saveFileAs();
      else assert.equal(await ctrlS(store), true);
      assert.equal(store.getState().siteFileId, kind === 'nieuw' ? 'nieuw' : kind === 'versie' ? 'bron' : 'kopie');
      assert.equal(store.getState().isDirty, false, 'de opslag lukte');
      assert.deepEqual(known(store), null);
    } finally { delete win.openaecHost; resetSiteAskers(); }
  });
}

await check('rij 9 en 11, een gebouwmodel dat als download eindigt (Ctrl+S zonder doel, Opslaan als): onbekend', async () => {
  const browser = browserDownload();
  try {
    const { store } = await openInStore(modelBytes);
    store.setState(s => { s.knownTargetFingerprint = print(modelBytes); });
    edit(store);
    await ctrlS(store);
    assert.equal(browser.downloads.length, 1, 'rij 9: een download');
    assert.deepEqual(known(store), null, 'rij 9');
    const handle = newHandle(modelBytes);
    const { store: viaHandle } = await openAt(handleRef(handle), modelBytes);
    assert.deepEqual(known(viaHandle), onHandle(handle));
    edit(viaHandle);
    await viaHandle.getState().saveFileAs();
    assert.equal(browser.downloads.length, 2, 'rij 11: een download');
    assert.deepEqual(onHandle(handle), print(modelBytes), 'het eigen bestand bleef staan');
    assert.deepEqual(known(viaHandle), null, 'rij 11');
  } finally { browser.dispose(); }
});

await check('rij 10 en 12, de bestandskiezer van de browser: de hash van de gekozen handle, met en zonder opslagworker', async () => {
  for (const sw of [saveWorker(), null]) {
    const picker = browserPicker();
    try {
      const { store } = await openAt(null, plainBytes(), sw?.compute);
      assert.deepEqual(known(store), null);
      edit(store);
      assert.equal(await ctrlS(store), true);
      assert.equal(picker.picked.length, 1);
      assert.deepEqual(known(store), onHandle(picker.picked[0]!), 'rij 10');
      edit(store);
      await store.getState().saveFileAs();
      assert.equal(picker.picked.length, 2);
      assert.deepEqual(known(store), onHandle(picker.picked[1]!), 'rij 12');
      assert.deepEqual(errors(store), []);
    } finally { picker.dispose(); sw?.dispose(); }
  }
});

await check('rij 10 en 12, een gewone planning die als download eindigt: onbekend, ook na een eigen handle', async () => {
  const browser = browserDownload(), handle = newHandle(plainBytes());
  try {
    const { store } = await openAt(handleRef(handle), plainBytes());
    assert.deepEqual(known(store), onHandle(handle));
    edit(store);
    await store.getState().saveFileAs();
    assert.equal(browser.downloads.length, 1, 'rij 12: een download');
    assert.equal(store.getState().fileHandle, null);
    assert.deepEqual(known(store), null, 'rij 12');
    edit(store);
    store.setState(s => { s.knownTargetFingerprint = onHandle(handle); });
    await ctrlS(store);
    assert.equal(browser.downloads.length, 2, 'rij 10: een download');
    assert.deepEqual(known(store), null, 'rij 10');
  } finally { browser.dispose(); }
});

for (const route of ['opslagworker', 'hoofdthread'] as const) {
  await check(`rij 13, Automatisch opslaan van een gewone planning naar het eigen pad (${route}): de hash van de ronde`, async () => {
    const sw = route === 'opslagworker' ? saveWorker() : null, ipc = desktop(), path = fileAt(`auto-${route}.ifc`, plainBytes());
    try {
      const { store } = await openAt({ kind: 'path', path }, plainBytes(), sw?.compute);
      const opened = known(store);
      store.getState().setAutoSaveToFile(true);
      edit(store);
      await createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw?.compute }).flush();
      assert.equal(store.getState().isDirty, false, 'de ronde schreef');
      assert.notDeepEqual(onDisk(path), opened);
      assert.deepEqual(known(store), onDisk(path));
      if (sw) assert.deepEqual(sw.jobs().map(job => job.kind === 'writer' && job.hashBytes), [true]);
    } finally { ipc.dispose(); sw?.dispose(); }
  });
}

await check('rij 13, Automatisch opslaan met een gebouwmodel naar het eigen pad: de hash van de vervanging', async () => {
  const ipc = desktop(), path = fileAt('auto-model.ifc', modelBytes);
  try {
    const { store } = await openAt({ kind: 'path', path }, modelBytes);
    const unregister = recoveryRounds(store);
    try {
      edit(store);
      let now = 5_000_000;
      store.getState().setAutoSaveToFile(true);
      const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, now: () => now });
      controller.observe();
      now += 31_000;
      await controller.flushModels();
      assert.equal(store.getState().isDirty, false, 'de ronde schreef');
      assert.notDeepEqual(onDisk(path), print(modelBytes));
      assert.deepEqual(known(store), onDisk(path));
    } finally { unregister(); await clearRecovery(); }
  } finally { ipc.dispose(); }
});

await check('A2, Exporteren → IFC en de export met de resourcebibliotheek over het eigen bestand: onbekend; elders blijft de hash', async () => {
  const ipc = desktop(), own = fileAt('export-eigen.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    const opened = known(store);
    edit(store);
    ipc.choose(join(dir, 'export-ander.ifc'));
    assert((await store.getState().exportAs('ifc')).ok);
    assert.deepEqual(known(store), opened, 'een ander bestand: het eigen bestand is niet veranderd');
    assert.deepEqual(onDisk(own), opened);
    ipc.choose(own);
    assert((await store.getState().exportAs('ifc')).ok);
    assert.notDeepEqual(onDisk(own), opened, 'de export schreef het eigen bestand');
    assert.deepEqual(known(store), null, 'Exporteren → IFC');
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), onDisk(own));
    const companyId = store.getState().seedDemoLibrary();
    store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
    edit(store);
    const library = join(dir, 'export-bibliotheek.ifc'), picks = ipc.picks();
    ipc.choose(own); ipc.onPick(() => { if (ipc.picks() === picks + 2) ipc.choose(library); });
    const beforePool = onDisk(own);
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok && !pooled.cancelled);
    assert(existsSync(library));
    assert.notDeepEqual(onDisk(own), beforePool, 'de export schreef het eigen bestand');
    assert.deepEqual(known(store), null, 'export met de resourcebibliotheek');
    assert.equal(await ctrlS(store), true);
    const saved = known(store);
    const loose = join(dir, 'bibliotheek-los.ifc');
    ipc.onPick(() => {}); ipc.choose(loose);
    await store.getState().exportLibrary(companyId);
    assert(existsSync(loose), 'het bibliotheekbestand is geschreven');
    assert.deepEqual(known(store), saved, 'het bibliotheekbestand is niet het eigen bestand');
    assert.deepEqual(onDisk(own), saved);
  } finally { ipc.dispose(); }
});

await check('A2, planner_export_ifc met overwrite over het eigen bestand: onbekend; elders blijft de hash', async () => {
  const { fileTools, fileToolDeps } = await import('@/services/mcp/tools/fileTools');
  const { createMcpContext } = await import('@/services/mcp/context');
  const { createMcpTransactions } = await import('@/state/runtime/createMcpTransactions');
  const ipc = desktop(), own = fileAt('mcp-eigen.ifc', plainBytes()), previous = fileToolDeps.getFs;
  fileToolDeps.getFs = async () => ({
    homeDir: async () => dir, exists: async (path: string) => existsSync(path),
    stat: async (path: string) => { const info = statSync(path); return { isFile: info.isFile(), dev: info.dev, ino: info.ino }; },
    scanTarget: async () => null,
    writeTextFile: async (path: string, content: string) => { writeFileSync(path, content); },
    readTextFile: async (path: string) => readFileSync(path, 'utf8'), readFile: async (path: string) => new Uint8Array(readFileSync(path)),
  });
  try {
    const context = await openAt({ kind: 'path', path: own }, plainBytes());
    const opened = known(context.store);
    edit(context.store);
    const tool = fileTools.find(t => t.name === 'planner_export_ifc')!;
    const run = (path: string) => tool.handler({ path, overwrite: true },
      createMcpContext(context, createMcpTransactions(context), { ensureBackup: async () => null, markDuplicateBorn: () => {} }));
    assert.equal((await run(join(dir, 'mcp-ander.ifc'))).ok, true);
    assert.deepEqual(known(context.store), opened);
    assert.equal((await run(own)).ok, true);
    assert.notDeepEqual(onDisk(own), opened, 'de export schreef het eigen bestand');
    assert.deepEqual(known(context.store), null);
  } finally { fileToolDeps.getFs = previous; ipc.dispose(); }
});

await check('met de flag uit: geen hash in verzoek of antwoord van de worker, het veld blijft onbekend, de bytes zoals main ze schrijft', async () => {
  const sw = saveWorker(), ipc = desktop(), own = fileAt('flag-uit.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes(), sw.compute, false);
    assert.deepEqual(known(store), null, 'openen');
    edit(store);
    const viaCtrlS = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
    assert.equal(await ctrlS(store), true);
    assert.equal(readFileSync(own, 'utf8'), viaCtrlS, 'Ctrl+S');
    assert.deepEqual(known(store), null, 'Ctrl+S');
    edit(store);
    const viaSaveAs = writeIFC(buildWriteIFCInput(store.getState(), 'merge')), target = join(dir, 'flag-uit-als.ifc');
    ipc.choose(target);
    await store.getState().saveFileAs();
    assert.equal(store.getState().filePath, target);
    assert.equal(readFileSync(target, 'utf8'), viaSaveAs, 'Opslaan als');
    assert.deepEqual(known(store), null, 'Opslaan als');
    store.getState().setAutoSaveToFile(true);
    edit(store);
    const viaAutoSave = writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
    await createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw.compute }).flush();
    assert.equal(readFileSync(target, 'utf8'), viaAutoSave, 'Automatisch opslaan');
    assert.deepEqual(known(store), null, 'Automatisch opslaan');
    assert.deepEqual(sw.jobs().map(job => Object.keys(job)), [['kind', 'input'], ['kind', 'input'], ['kind', 'input']]);
    assert.deepEqual(sw.results().map(result => Object.keys(result)),
      [['kind', 'bytes', 'literalCalendarIds'], ['kind', 'bytes', 'literalCalendarIds'], ['kind', 'bytes', 'literalCalendarIds']]);
  } finally { ipc.dispose(); sw.dispose(); }
});

await check('de flag gaat midden in de sessie aan: onbekend tot de eerste opslag met de flag aan; weer uit: onbekend na de volgende opslag', async () => {
  const ipc = desktop(), own = fileAt('flag-later.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes(), undefined, false);
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    assert.deepEqual(known(store), null);
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), onDisk(own));
    store.setState(s => { s.ui.featureFlags = {}; });
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), null);
  } finally { ipc.dispose(); }
});

await check('een mislukte of geweigerde opslag laat het veld staan; het beschrijft dan nog de laatste eigen schrijfactie', async () => {
  const ipc = desktop(), own = fileAt('mislukt.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    const opened = known(store);
    edit(store);
    ipc.faults.writeErrorAfter = 0;
    try { assert.equal(await quietly(() => ctrlS(store)), false); } finally { ipc.faults.writeErrorAfter = null; }
    assert.deepEqual(errors(store), ['notifications.saveFailed']);
    assert.deepEqual(known(store), opened);
    assert.deepEqual(onDisk(own), opened, 'het bestand is niet veranderd');
  } finally { ipc.dispose(); }
  const handle = newHandle(modelBytes);
  const { store } = await openAt(handleRef(handle), modelBytes);
  const opened = known(store);
  handleFiles.set(handle.name, plainBytes());
  edit(store);
  assert.equal(await ctrlS(store), false, 'de doelbewaking weigert');
  assert.deepEqual(known(store), opened);
  assert.notDeepEqual(onHandle(handle), opened, 'een ander programma schreef het bestand; de app niet');
});

rmSync(dir, { recursive: true, force: true });
console.log(`Tabblad kent de schijfversie: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
