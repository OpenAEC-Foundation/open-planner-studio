import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIfcFromText } from '@/services/formatRegistry';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import type { IfcSaveResponse, IfcSaveResult } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import { computeIfcOutputHere, type IfcOutputCompute, type IfcSaveJob } from '@/state/prepareIfcOutput';
import { IfcSaveWorkerError } from '@/services/ifc/saveWorker/ifcSaveWorkerError';
import { isProjectFileWriteBusy } from '@/services/fileAccess/writeCoordinator';
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
const withoutLiteralBytes = () => new Uint8Array(readFileSync(join(root, 'public/examples/showcase-verbouwing-eengezinswoning.ifc')));
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
let onHandleWrite: ((name: string) => void) | null = null;
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
      close: async () => { onHandleWrite?.(name); handleFiles.set(name, new Uint8Array(Buffer.concat(parts))); },
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

await check('rij 8, Ctrl+S die eindigt terwijl het tabblad slaapt: de hash komt in het slapende tabblad', async () => {
  const ipc = desktop(), path = fileAt('ctrl-s-slapend.ifc', plainBytes());
  let armed = false, reached!: () => void, release!: () => void;
  const atGate = new Promise<void>(resolve => { reached = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const held: IfcOutputCompute = async job => {
    if (armed) { reached(); await gate; }
    return computeIfcOutputHere(job);
  };
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes(), held);
    const sleeping = store.getState().activeDocumentId, before = onDisk(path).byteLength;
    edit(store);
    armed = true;
    const saved = ctrlS(store);
    await atGate;
    const other = store.getState().duplicateDocument();
    assert.equal(store.getState().activeDocumentId, other, 'het tabblad slaapt tijdens het rekenen');
    release();
    assert.equal(await saved, true);
    assert.notEqual(onDisk(path).byteLength, before, 'de grootte veranderde');
    assert.deepEqual(known(store, sleeping), onDisk(path), 'het slapende tabblad kent de nieuwe versie');
    assert.deepEqual(known(store, other), null, 'de kopie heeft geen eigen bestand');
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); }
});

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
      const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw?.compute });
      for (const round of [1, 2]) {
        const before = onDisk(path).byteLength;
        edit(store);
        await controller.flush();
        assert.equal(store.getState().isDirty, false, `ronde ${round} schreef`);
        assert.notEqual(onDisk(path).byteLength, before, `ronde ${round}: de grootte veranderde`);
        assert.deepEqual(known(store), onDisk(path), `ronde ${round}`);
      }
      assert.notDeepEqual(known(store), opened);
      if (sw) assert.deepEqual(sw.jobs().map(job => job.kind === 'writer' && job.hashBytes), [true, true]);
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

await check('A2, Exporteren → IFC en de export met de resourcebibliotheek over het eigen bestand: de vingerafdruk van de geschreven bytes; elders blijft de hash', async () => {
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
    assert.deepEqual(known(store), onDisk(own), 'Exporteren → IFC');
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
    assert.deepEqual(known(store), onDisk(own), 'export met de resourcebibliotheek');
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

await check('A2, planner_export_ifc met overwrite over het eigen bestand: de vingerafdruk van de geschreven bytes; elders blijft de hash', async () => {
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
    assert.deepEqual(known(context.store), onDisk(own));
  } finally { fileToolDeps.getFs = previous; ipc.dispose(); }
});

await check('ronde 1: de resourcebibliotheek over de eigen handle in de browser (Bestand → Bibliotheek en de export met de resourcebibliotheek): de vingerafdruk van de bibliotheekbytes op die handle', async () => {
  const win = window as unknown as Record<string, unknown>, answers: FakeHandle[] = [];
  win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
  win.showSaveFilePicker = async () => answers.shift()!;
  const own = newHandle(plainBytes()), other = newHandle(new Uint8Array());
  const text = (handle: FakeHandle) => new TextDecoder().decode(handleFiles.get(handle.name)!);
  try {
    const { store } = await openAt(handleRef(own), plainBytes());
    const companyId = store.getState().seedDemoLibrary();
    store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), onHandle(own));
    assert.equal(text(own).includes('IFCTASK('), true, 'eerst staat de planning op de eigen handle');
    answers.push(own);
    await store.getState().exportLibrary(companyId);
    assert.equal(answers.length, 0, 'de kiezer gaf de eigen handle');
    assert.equal(text(own).includes('IFCTASK('), false, 'nu staat de bibliotheek, zonder taken, op de eigen handle');
    assert.deepEqual(known(store), onHandle(own), 'Bestand → Bibliotheek');
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), onHandle(own));
    answers.push(other, own);
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok && !pooled.cancelled);
    assert.equal(answers.length, 0, 'twee kiezers: het projectbestand en de bibliotheek');
    assert.equal(text(other).includes('IFCTASK('), true, 'het projectbestand staat op de andere handle');
    assert.equal(text(own).includes('IFCTASK('), false, 'de bibliotheek staat op de eigen handle');
    assert.deepEqual(known(store), onHandle(own), 'export met de resourcebibliotheek');
    assert.deepEqual(errors(store), []);
  } finally { delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
});

await check('openen: gaat de flag uit tussen het lezen van de bytes en het activeren, dan onbekend', async () => {
  const ipc = desktop(), path = fileAt('open-flag-wissel.ifc', plainBytes());
  try {
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    let waited = false;
    await store.getState().openOpenedFile({ name: basename(path), content: '', bytes: plainBytes(), ref: { kind: 'path', path } }, undefined, {
      waitWhile: () => {
        if (waited) return false;
        waited = true;
        store.setState(s => { s.ui.featureFlags = {}; });
        return true;
      },
    });
    assert.equal(waited, true);
    assert.equal(store.getState().filePath, path);
    assert.deepEqual(known(store), null);
  } finally { ipc.dispose(); }
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

await check('een mislukte schrijfactie naar het eigen pad maakt het veld onbekend; een geweigerde opslag laat het staan', async () => {
  const ipc = desktop(), own = fileAt('mislukt.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    assert.deepEqual(known(store), onDisk(own));
    edit(store);
    ipc.faults.writeErrorAfter = 0;
    try { assert.equal(await quietly(() => ctrlS(store)), false); } finally { ipc.faults.writeErrorAfter = null; }
    assert.deepEqual(errors(store), ['notifications.saveFailed']);
    assert.deepEqual(onDisk(own), print(plainBytes()), 'via het halffabricaat bleef het bestand heel');
    assert.deepEqual(known(store), null, 'Ctrl+S: na een mislukte schrijfactie weet de app niet wat er staat');
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), onDisk(own));
    store.getState().setAutoSaveToFile(true);
    edit(store);
    ipc.faults.writeErrorAfter = 0;
    try { await quietly(() => createFileAutoSaveController({ getState: store.getState, enabled: () => true }).flush()); }
    finally { ipc.faults.writeErrorAfter = null; }
    assert.equal(store.getState().isDirty, true, 'de ronde schreef niet');
    assert.deepEqual(known(store), null, 'Automatisch opslaan');
    const real = fileAt('mislukt-echt.ifc', plainBytes()), link = join(dir, 'mislukt-link.ifc');
    symlinkSync(real, link);
    const { store: linked } = await openAt({ kind: 'path', path: link }, plainBytes());
    assert.deepEqual(known(linked), onDisk(link));
    edit(linked);
    ipc.faults.directWriteError = 'proef: de directe schrijfactie op het gelinkte doel mislukt';
    try { assert.equal(await quietly(() => ctrlS(linked)), false); } finally { ipc.faults.directWriteError = null; }
    assert.deepEqual(known(linked), null, 'een gelinkt doel wordt direct geschreven');
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

type ExportRoute = 'exportAs' | 'pool-project' | 'pool-library' | 'library' | 'mcp';
type ExportTarget = 'eigen' | 'alias' | 'ander' | 'annuleren';
const exportRoutes: ExportRoute[] = ['exportAs', 'pool-project', 'pool-library', 'library', 'mcp'];
const exportCells: Record<'linux' | 'windows', Record<ExportTarget, Record<ExportRoute, 'bijgewerkt' | 'behouden' | 'geweigerd' | 'n.v.t.'>>> = {
  linux: {
    eigen: { exportAs: 'bijgewerkt', 'pool-project': 'bijgewerkt', 'pool-library': 'geweigerd', library: 'geweigerd', mcp: 'bijgewerkt' },
    alias: { exportAs: 'bijgewerkt', 'pool-project': 'bijgewerkt', 'pool-library': 'geweigerd', library: 'geweigerd', mcp: 'bijgewerkt' },
    ander: { exportAs: 'behouden', 'pool-project': 'behouden', 'pool-library': 'behouden', library: 'behouden', mcp: 'behouden' },
    annuleren: { exportAs: 'behouden', 'pool-project': 'behouden', 'pool-library': 'behouden', library: 'behouden', mcp: 'n.v.t.' },
  },
  windows: {
    eigen: { exportAs: 'bijgewerkt', 'pool-project': 'bijgewerkt', 'pool-library': 'geweigerd', library: 'geweigerd', mcp: 'bijgewerkt' },
    alias: { exportAs: 'bijgewerkt', 'pool-project': 'bijgewerkt', 'pool-library': 'bijgewerkt', library: 'bijgewerkt', mcp: 'bijgewerkt' },
    ander: { exportAs: 'behouden', 'pool-project': 'behouden', 'pool-library': 'behouden', library: 'behouden', mcp: 'behouden' },
    annuleren: { exportAs: 'behouden', 'pool-project': 'behouden', 'pool-library': 'behouden', library: 'behouden', mcp: 'n.v.t.' },
  },
};

for (const platform of ['linux', 'windows'] as const) {
  for (const flag of [true, false] as const) {
    await check(`A2-tabel, desktop ${platform}${flag ? '' : ', flag uit'}: elke exportroute naar het eigen bestand, een alias, een ander bestand en annuleren`, async () => {
      const { fileTools, fileToolDeps } = await import('@/services/mcp/tools/fileTools');
      const { createMcpContext } = await import('@/services/mcp/context');
      const { createMcpTransactions } = await import('@/state/runtime/createMcpTransactions');
      const previousFs = fileToolDeps.getFs;
      fileToolDeps.getFs = async () => ({
        homeDir: async () => dir, exists: async (p: string) => existsSync(p),
        stat: async (p: string) => {
          const info = statSync(p);
          return { isFile: info.isFile(), dev: platform === 'windows' ? null : info.dev, ino: platform === 'windows' ? null : info.ino };
        },
        scanTarget: async () => null,
        writeTextFile: async (p: string, content: string) => { writeFileSync(p, content); },
        readTextFile: async (p: string) => readFileSync(p, 'utf8'), readFile: async (p: string) => new Uint8Array(readFileSync(p)),
      });
      const ipc = desktop();
      const seen: string[] = [];
      try {
        for (const target of ['eigen', 'alias', 'ander', 'annuleren'] as const) {
          for (const route of exportRoutes) {
            const expected = exportCells[platform][target][route];
            if (expected === 'n.v.t.') continue;
            const label = `${platform}, ${route}, ${target}${flag ? '' : ', flag uit'}`;
            const own = fileAt(`tabel-${platform}-${flag}-${route}-${target}.ifc`, plainBytes());
            const alias = join(dir, `tabel-${platform}-${flag}-${route}-${target}-alias.ifc`);
            symlinkSync(own, alias);
            const other = join(dir, `tabel-${platform}-${flag}-${route}-${target}-ander.ifc`);
            const elsewhere = join(dir, `tabel-${platform}-${flag}-${route}-${target}-elders.ifc`);
            const context = await openAt({ kind: 'path', path: own }, plainBytes(), undefined, flag);
            const store = context.store;
            const companyId = store.getState().seedDemoLibrary();
            store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
            edit(store);
            assert.equal(await ctrlS(store), true, `${label}: opslaan vooraf`);
            if (!flag) store.setState(s => { s.knownTargetFingerprint = onDisk(own); });
            const before = known(store), onDiskBefore = onDisk(own);
            assert.deepEqual(before, onDiskBefore, `${label}: vooraf kent het tabblad zijn bestand`);
            edit(store);
            ipc.faults.noIdentity = platform === 'windows';
            const chosen = target === 'eigen' ? own : target === 'alias' ? alias : target === 'ander' ? other : null;
            const start = ipc.picks();
            ipc.onPick(() => {});
            try {
              if (route === 'exportAs') { ipc.choose(chosen); await store.getState().exportAs('ifc'); }
              if (route === 'pool-project') {
                ipc.choose(chosen);
                ipc.onPick(() => { if (ipc.picks() === start + 2) ipc.choose(null); });
                await store.getState().exportProjectWithPool();
              }
              if (route === 'pool-library') {
                ipc.choose(elsewhere);
                ipc.onPick(() => { if (ipc.picks() === start + 2) ipc.choose(chosen); });
                await store.getState().exportProjectWithPool();
              }
              if (route === 'library') { ipc.choose(chosen); await store.getState().exportLibrary(companyId); }
              if (route === 'mcp') {
                const tool = fileTools.find(t => t.name === 'planner_export_ifc')!;
                await tool.handler({ path: chosen!, overwrite: true },
                  createMcpContext(context, createMcpTransactions(context), { ensureBackup: async () => null, markDuplicateBorn: () => {} }));
              }
            } finally { ipc.faults.noIdentity = false; }
            const ownChanged = !isDeepStrictEqual(onDisk(own), onDiskBefore);
            if (target === 'ander') assert.equal(existsSync(other), true, `${label}: de export schreef het andere bestand`);
            if (target === 'ander' || target === 'annuleren') assert.equal(ownChanged, false, `${label}: het eigen bestand is niet geschreven`);
            if (target === 'eigen' || target === 'alias') assert.equal(ownChanged, expected !== 'geweigerd', `${label}: ${expected === 'geweigerd' ? 'geweigerd vóór het schrijven' : 'het eigen bestand is geschreven'}`);
            const updated = flag && expected === 'bijgewerkt';
            assert.deepEqual(known(store), updated ? onDisk(own) : before, `${label}: ${updated ? 'bijgewerkt' : 'behouden'}`);
            if (updated) assert.notDeepEqual(known(store), before, `${label}: een nieuwe vingerafdruk`);
            seen.push(`${label}: ${updated ? 'bijgewerkt' : 'behouden'}`);
          }
        }
      } finally { fileToolDeps.getFs = previousFs; ipc.dispose(); }
      console.log(`TABEL ${seen.join(' | ')}`);
    });
  }
}

await check('A2-tabel, browser: de eigen handle krijgt de vingerafdruk van de geschreven bytes; een andere handle, een falende isSameEntry, een download en annuleren behouden', async () => {
  const win = window as unknown as Record<string, unknown>;
  class BrokenHandle extends FakeHandle { override async isSameEntry(): Promise<boolean> { throw new Error('proef: isSameEntry faalt'); } }
  const routes = ['exportAs', 'pool-project', 'pool-library', 'library'] as const;
  for (const target of ['eigen', 'ander', 'werpt', 'download', 'annuleren'] as const) {
    for (const route of routes) {
      const label = `browser, ${route}, ${target}`;
      const own = newHandle(plainBytes()), elsewhere = newHandle(new Uint8Array());
      const chosen = target === 'eigen' ? own : target === 'ander' ? newHandle(new Uint8Array())
        : target === 'werpt' ? new BrokenHandle(`kapot-${++handleCount}.ifc`) : null;
      if (chosen && target === 'werpt') handleFiles.set(chosen.name, new Uint8Array());
      const browser = target === 'download' ? browserDownload() : null;
      const answers = route === 'pool-library' ? [elsewhere, chosen] : route === 'pool-project' ? [chosen, null] : [chosen];
      if (target !== 'download') {
        win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
        win.showSaveFilePicker = async () => {
          const next = answers.shift();
          if (!next) throw new DOMException('geannuleerd', 'AbortError');
          return next;
        };
      }
      try {
        const { store } = await openAt(handleRef(own), plainBytes());
        const companyId = store.getState().seedDemoLibrary();
        store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
        edit(store);
        assert.equal(await ctrlS(store), true, `${label}: opslaan vooraf`);
        const before = known(store);
        assert.deepEqual(before, onHandle(own));
        edit(store);
        if (route === 'exportAs') await store.getState().exportAs('ifc');
        if (route === 'pool-project' || route === 'pool-library') await store.getState().exportProjectWithPool();
        if (route === 'library') await store.getState().exportLibrary(companyId);
        if (target === 'eigen') assert.notDeepEqual(onHandle(own), before, `${label}: de export schreef de eigen handle`);
        else assert.deepEqual(onHandle(own), before, `${label}: de eigen handle is niet geschreven`);
        if (chosen && target !== 'eigen') assert.notEqual(handleFiles.get(chosen.name)!.byteLength, 0, `${label}: de export schreef het gekozen doel`);
        if (browser && route !== 'pool-library') assert.notEqual(browser.downloads.length, 0, `${label}: een download`);
        assert.deepEqual(known(store), target === 'eigen' ? onHandle(own) : before, label);
      } finally { browser?.dispose(); delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
    }
  }
});

await check('de kalenders blijven unknown als treffer tellen: op Windows legt een export naar een ander bestand ze vast, de vingerafdruk blijft', async () => {
  for (const platform of ['linux', 'windows'] as const) {
    const ipc = desktop(), own = fileAt(`kalender-${platform}.ifc`, withoutLiteralBytes()), other = join(dir, `kalender-${platform}-ander.ifc`);
    try {
      const { store } = await openAt({ kind: 'path', path: own }, withoutLiteralBytes());
      edit(store);
      assert.equal(await ctrlS(store), true);
      assert.equal(store.getState().ifcLiteralCalendarIds, null, `${platform}: vooraf geen letterlijke kalender`);
      const before = known(store);
      store.getState().addTask({ name: 'Uurtaak', time: { ...store.getState().tasks[0]!.time, durationUnit: 'hours', durationMinutes: 240 } });
      store.getState().runCPM();
      ipc.faults.noIdentity = platform === 'windows';
      ipc.choose(other);
      try { assert((await store.getState().exportAs('ifc')).ok); } finally { ipc.faults.noIdentity = false; }
      assert(readFileSync(other, 'utf8').includes("'LiteralTimes'"), `${platform}: de export schreef een letterlijke kalender`);
      assert.deepEqual(store.getState().ifcLiteralCalendarIds, platform === 'windows' ? [store.getState().calendar.id] : null,
        `${platform}: de kalenders tellen ${platform === 'windows' ? 'unknown als treffer' : 'een aantoonbaar ander bestand niet'}`);
      assert.deepEqual(known(store), before, `${platform}: de vingerafdruk blijft`);
    } finally { ipc.dispose(); }
  }
});

await check('Automatisch opslaan: een rekenfout vóór het schrijven laat het veld staan', async () => {
  const ipc = desktop(), own = fileAt('auto-rekenfout.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    const before = known(store);
    store.getState().setAutoSaveToFile(true);
    edit(store);
    const failing: IfcOutputCompute = async () => { throw new IfcSaveWorkerError('crashed', 'proef: de opslagworker viel uit'); };
    await quietly(() => createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: failing }).flush());
    assert.equal(store.getState().isDirty, true, 'niets geschreven');
    assert.deepEqual(onDisk(own), print(plainBytes()));
    assert.deepEqual(known(store), before);
  } finally { ipc.dispose(); }
});

await check('een onzekere plaatsing op het eigen pad (unknown, previous-stranded, target-taken) maakt het veld onbekend', async () => {
  const outcomes: [string, (n: number, to: string) => { reject: Record<string, string> } | undefined][] = [
    ['unknown', n => n === 1 ? { reject: { code: 'source-changed' } } : undefined],
    ['previous-stranded', n => n >= 2 ? { reject: { code: 'io', message: 'EIO' } } : undefined],
    ['target-taken', (n, to) => { if (n === 2) writeFileSync(to, plainBytes()); return undefined; }],
  ];
  for (const [label, answer] of outcomes) {
    for (const route of ['Ctrl+S', 'Automatisch opslaan'] as const) {
      const ipc = desktop(), path = fileAt(`onzeker-${label}-${route.replace(/[ +]/g, '-')}.ifc`, modelBytes);
      try {
        const { store } = await openAt({ kind: 'path', path }, modelBytes);
        const unregister = recoveryRounds(store);
        try {
          assert.deepEqual(known(store), onDisk(path));
          edit(store);
          let n = 0;
          ipc.faults.place = (_from, to) => answer(++n, to);
          try {
            if (route === 'Ctrl+S') assert.equal(await quietly(() => ctrlS(store)), false, `${label}, ${route}: niet vastgelegd`);
            else {
              let now = 5_000_000;
              store.getState().setAutoSaveToFile(true);
              const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, now: () => now });
              controller.observe();
              now += 31_000;
              await quietly(() => controller.flushModels());
            }
          } finally { ipc.faults.place = null; }
          assert.equal(store.getState().isDirty, true, `${label}, ${route}: niet opgeslagen`);
          assert.deepEqual(known(store), null, `${label}, ${route}`);
        } finally { unregister(); await clearRecovery(); }
      } finally { ipc.dispose(); }
    }
  }
});

const mcpTool = async () => {
  const { fileTools, fileToolDeps } = await import('@/services/mcp/tools/fileTools');
  const { createMcpContext } = await import('@/services/mcp/context');
  const { createMcpTransactions } = await import('@/state/runtime/createMcpTransactions');
  const tool = fileTools.find(t => t.name === 'planner_export_ifc')!;
  return {
    fileToolDeps,
    run: (context: Awaited<ReturnType<typeof openAt>>, path: string) => tool.handler({ path, overwrite: true },
      createMcpContext(context, createMcpTransactions(context), { ensureBackup: async () => null, markDuplicateBorn: () => {} })),
  };
};
const mcpFs = (real: (path: string) => string, home: string, identity: boolean, afterWrite: (path: string) => void = () => {}) => async () => ({
  homeDir: async () => home, exists: async (p: string) => existsSync(real(p)),
  stat: async (p: string) => {
    const info = statSync(real(p));
    return { isFile: info.isFile(), dev: identity ? info.dev : null, ino: identity ? info.ino : null };
  },
  scanTarget: async () => null,
  writeTextFile: async (p: string, content: string) => { writeFileSync(real(p), content); afterWrite(p); },
  readTextFile: async (p: string) => readFileSync(real(p), 'utf8'), readFile: async (p: string) => new Uint8Array(readFileSync(real(p))),
});

await check('ronde 3: Windows, het tabblad op C:\\Users\\planner\\planning.ifc en planner_export_ifc met die padtekst (MCP maakt er C:/… van): de vingerafdruk van de geschreven bytes; een ander bestand met een gelijkende naam: blijft', async () => {
  const { fileToolDeps, run } = await mcpTool();
  const home = join(dir, 'windows-home');
  mkdirSync(home);
  const real = (p: string) => p.replace(/^C:[\\/]Users[\\/]planner/, home).replace(/\\/g, '/');
  const own = 'C:\\Users\\planner\\planning.ifc', lookalike = 'C:\\Users\\planner\\Planning.ifc';
  writeFileSync(real(own), plainBytes());
  const previousFs = fileToolDeps.getFs;
  fileToolDeps.getFs = mcpFs(real, 'C:\\Users\\planner', false);
  const ipc = desktop();
  ipc.faults.noIdentity = true;
  ipc.faults.mapPath = real;
  try {
    const context = await openAt({ kind: 'path', path: own }, plainBytes());
    assert.equal(context.store.getState().filePath, own);
    const opened = known(context.store);
    assert.deepEqual(opened, onDisk(real(own)));
    edit(context.store);
    const other = await run(context, lookalike);
    assert.equal(other.ok, true, JSON.stringify(other));
    assert.equal(existsSync(real(lookalike)), true, 'het andere bestand is geschreven');
    assert.deepEqual(onDisk(real(own)), opened, 'het eigen bestand is niet geschreven');
    assert.deepEqual(known(context.store), opened, 'een ander bestand met een gelijkende naam: blijft');
    const mine = await run(context, own);
    assert.equal(mine.ok, true, JSON.stringify(mine));
    assert.notDeepEqual(onDisk(real(own)), opened, 'de export schreef het eigen bestand, via C:/Users/planner/planning.ifc');
    assert.deepEqual(known(context.store), onDisk(real(own)), 'de vingerafdruk van de geschreven bytes');
  } finally { fileToolDeps.getFs = previousFs; ipc.dispose(); }
});

for (const [label, moment, change] of [
  ['een ander programma schrijft het eigen bestand tussen de export en de stat (andere grootte)', 'plugin:fs|stat', 'kleiner'],
  ['een ander programma schrijft het eigen bestand tussen de export en de stat (gelijke grootte, andere inhoud)', 'plugin:fs|stat', 'gelijk-groot'],
  ['een ander programma schrijft het eigen bestand tussen de stat en het lezen', 'plugin:fs|open', 'gelijk-groot'],
  ['de inhoud van het tabblad wordt tijdens de nacontrole vervangen', 'plugin:fs|stat', 'inhoud'],
  ['het eigen doel van het tabblad verandert tijdens de nacontrole', 'plugin:fs|stat', 'doel'],
] as const) {
  await check(`na een export over het eigen bestand: ${label}`, async () => {
    const { fileToolDeps, run } = await mcpTool();
    const own = fileAt(`extern-${change}-${moment.slice(-4)}.ifc`, plainBytes());
    let armed = false;
    const previousFs = fileToolDeps.getFs;
    fileToolDeps.getFs = mcpFs(p => p, dir, true, p => { if (p === own) armed = true; });
    const ipc = desktop();
    try {
      const context = await openAt({ kind: 'path', path: own }, plainBytes());
      const before = known(context.store);
      const replacement = await readIfcFromText(new TextDecoder().decode(otherPlainBytes()), undefined, { ifcBytes: true });
      edit(context.store);
      let changed = false;
      ipc.faults.onCall = (command, path) => {
        if (!armed || path !== own || command !== moment) return;
        armed = false;
        changed = true;
        if (change === 'kleiner') writeFileSync(own, plainBytes().subarray(0, 1000));
        if (change === 'gelijk-groot') {
          const now = new Uint8Array(readFileSync(own));
          now[now.length - 3] = now[now.length - 3] === 0x41 ? 0x42 : 0x41;
          writeFileSync(own, now);
        }
        if (change === 'inhoud') context.store.getState().loadState(replacement);
        if (change === 'doel') context.store.getState().setFilePath(join(dir, `ander-doel-${moment.slice(-4)}.ifc`));
      };
      const result = await run(context, own);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(changed, true, 'het moment kwam');
      if (change === 'inhoud' || change === 'doel') {
        assert.notDeepEqual(onDisk(own), before, 'de export schreef het eigen bestand');
        assert.deepEqual(known(context.store), null, change === 'inhoud' ? 'de nieuwe inhoud kreeg geen vingerafdruk van de export' : 'het nieuwe doel kreeg geen vingerafdruk van het oude');
      } else {
        assert.deepEqual(known(context.store), before, 'de oude vingerafdruk blijft');
        assert.notDeepEqual(known(context.store), onDisk(own), 'en die klopt niet met de schijf');
      }
    } finally { fileToolDeps.getFs = previousFs; ipc.dispose(); }
  });
}

await check('een ongewijzigd document naar een andere naam: de geschreven bytes zijn gelijk aan het eigen bestand, en de vingerafdruk wordt opnieuw dezelfde, nog steeds ware waarde', async () => {
  const ipc = desktop(), own = fileAt('ongewijzigd.ifc', plainBytes()), other = join(dir, 'ongewijzigd-ander.ifc');
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    edit(store);
    assert.equal(await ctrlS(store), true);
    const before = known(store);
    let pickedAt = 0;
    ipc.onPick(() => { pickedAt = ipc.calls.length; });
    ipc.choose(other);
    assert((await store.getState().exportAs('ifc')).ok);
    assert.equal(isDeepStrictEqual(readFileSync(other), readFileSync(own)), true, 'de export schrijft dezelfde bytes als de opslag');
    const ownCalls = ipc.calls.slice(pickedAt).filter(c => c.path === own).map(c => c.command);
    assert(ownCalls.includes('plugin:fs|open'), `bij gelijke grootte leest de controle het eigen bestand: ${ownCalls.join(', ')}`);
    assert.deepEqual(known(store), before);
    assert.deepEqual(known(store), onDisk(own));
  } finally { ipc.dispose(); }
});

for (const flag of [false, true] as const) {
  await check(`de bestandsaanroepen op het eigen bestand na een export naar een ander bestand of annuleren, flag ${flag ? 'aan: alleen één stat per geschreven deel' : 'uit: geen enkele'}`, async () => {
    const { fileToolDeps, run } = await mcpTool();
    const previousFs = fileToolDeps.getFs;
    fileToolDeps.getFs = mcpFs(p => p, dir, true);
    const ipc = desktop();
    try {
      for (const target of ['ander', 'annuleren'] as const) {
        for (const route of exportRoutes) {
          if (route === 'mcp' && target === 'annuleren') continue;
          const label = `${route}, ${target}`;
          const own = fileAt(`aanroepen-${flag}-${route}-${target}.ifc`, withoutLiteralBytes());
          const other = join(dir, `aanroepen-${flag}-${route}-${target}-ander.ifc`);
          const elsewhere = join(dir, `aanroepen-${flag}-${route}-${target}-elders.ifc`);
          const context = await openAt({ kind: 'path', path: own }, withoutLiteralBytes(), undefined, flag);
          const store = context.store;
          const companyId = store.getState().seedDemoLibrary();
          store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
          edit(store);
          assert.equal(await ctrlS(store), true);
          if (!flag) store.setState(s => { s.knownTargetFingerprint = onDisk(own); });
          const before = known(store);
          edit(store);
          const chosen = target === 'ander' ? other : null;
          const start = ipc.picks(), from = ipc.calls.length;
          ipc.onPick(() => {});
          if (route === 'exportAs') { ipc.choose(chosen); await store.getState().exportAs('ifc'); }
          if (route === 'pool-project') {
            ipc.choose(chosen);
            ipc.onPick(() => { if (ipc.picks() === start + 2) ipc.choose(null); });
            await store.getState().exportProjectWithPool();
          }
          if (route === 'pool-library') {
            ipc.choose(elsewhere);
            ipc.onPick(() => { if (ipc.picks() === start + 2) ipc.choose(chosen); });
            await store.getState().exportProjectWithPool();
          }
          if (route === 'library') { ipc.choose(chosen); await store.getState().exportLibrary(companyId); }
          if (route === 'mcp') assert.equal((await run(context, other)).ok, true);
          const ownCalls = ipc.calls.slice(from).filter(c => c.path === own).map(c => c.command);
          const parts = route === 'pool-library' ? (target === 'ander' ? 2 : 1) : target === 'ander' ? 1 : 0;
          assert.deepEqual(ownCalls, flag ? Array(parts).fill('plugin:fs|stat') : [], `${label}: de aanroepen op het eigen bestand`);
          assert.deepEqual(known(store), before, `${label}: het veld blijft`);
        }
      }
    } finally { fileToolDeps.getFs = previousFs; ipc.dispose(); }
  });
}

await check('volgorde 1: de export met de resourcebibliotheek schrijft beide delen over de eigen handle; daarna volgt de vingerafdruk de bytes op die handle', async () => {
  const win = window as unknown as Record<string, unknown>;
  const own = newHandle(plainBytes()), answers: FakeHandle[] = [own, own];
  win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
  win.showSaveFilePicker = async () => answers.shift()!;
  const written: string[] = [];
  onHandleWrite = name => { if (name === own.name) written.push(name); };
  try {
    const { store } = await openAt(handleRef(own), plainBytes());
    const companyId = store.getState().seedDemoLibrary();
    store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
    edit(store);
    assert.equal(await ctrlS(store), true);
    written.length = 0;
    const before = known(store);
    edit(store);
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok && !pooled.cancelled);
    assert.equal(answers.length, 0);
    assert.equal(written.length, 2, 'beide delen schreven de eigen handle');
    assert.equal(new TextDecoder().decode(handleFiles.get(own.name)!).includes('IFCTASK('), false, 'de bibliotheek staat als laatste op de eigen handle');
    assert.notDeepEqual(known(store), before);
    assert.deepEqual(known(store), onHandle(own), 'hash én grootte zijn die van de bytes op de eigen handle');
  } finally { onHandleWrite = null; delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
});

await check('volgorde 2: Automatisch opslaan schrijft, de export wacht in de schrijfrij en schrijft daarna andere bytes over het eigen pad; daarna volgt de vingerafdruk de bytes op schijf', async () => {
  const ipc = desktop(), own = fileAt('volgorde-2.ifc', plainBytes());
  let armed = false, reached!: () => void, release!: () => void;
  const atGate = new Promise<void>(resolve => { reached = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const held: IfcOutputCompute = async job => {
    if (armed) { armed = false; reached(); await gate; }
    return computeIfcOutputHere(job);
  };
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    store.getState().setAutoSaveToFile(true);
    edit(store);
    armed = true;
    const autoSave = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: held }).flush();
    await atGate;
    edit(store);
    ipc.choose(own);
    const exported = store.getState().exportAs('ifc');
    for (let i = 0; i < 50 && ipc.picks() === 0; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(ipc.picks(), 0, 'de export wacht in de rij achter Automatisch opslaan');
    release();
    await autoSave;
    const afterAutoSave = known(store);
    assert.deepEqual(afterAutoSave, onDisk(own), 'Automatisch opslaan legde zijn eigen vingerafdruk vast');
    assert((await exported).ok);
    assert.notDeepEqual(onDisk(own), afterAutoSave, 'de export schreef andere bytes over het eigen pad');
    assert.deepEqual(known(store), onDisk(own), 'hash én grootte zijn die van de bytes die de export schreef');
  } finally { ipc.dispose(); }
});

await check('de schrijfrij: elke exportroute schrijft het eigen doel en legt de vingerafdruk vast binnen de beurt van de rij', async () => {
  const win = window as unknown as Record<string, unknown>;
  for (const route of ['exportAs', 'pool-project', 'pool-library', 'library'] as const) {
    const own = newHandle(plainBytes()), elsewhere = newHandle(new Uint8Array());
    const answers = route === 'pool-library' ? [elsewhere, own] : route === 'pool-project' ? [own, null] : [own];
    win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
    win.showSaveFilePicker = async () => {
      const next = answers.shift();
      if (!next) throw new DOMException('geannuleerd', 'AbortError');
      return next;
    };
    const writes: boolean[] = [], commits: boolean[] = [];
    onHandleWrite = name => { if (name === own.name) writes.push(isProjectFileWriteBusy()); };
    try {
      const { store } = await openAt(handleRef(own), plainBytes());
      const companyId = store.getState().seedDemoLibrary();
      store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
      edit(store);
      assert.equal(await ctrlS(store), true);
      writes.length = 0;
      edit(store);
      const unsubscribe = store.subscribe((now, prev) => {
        if (now.knownTargetFingerprint !== prev.knownTargetFingerprint) commits.push(isProjectFileWriteBusy());
      });
      try {
        if (route === 'exportAs') await store.getState().exportAs('ifc');
        if (route === 'pool-project' || route === 'pool-library') await store.getState().exportProjectWithPool();
        if (route === 'library') await store.getState().exportLibrary(companyId);
      } finally { unsubscribe(); }
      assert.equal(isProjectFileWriteBusy(), false, `${route}: de rij is daarna leeg`);
      assert.deepEqual(writes, [true], `${route}: het schrijven van de eigen handle valt binnen de beurt`);
      assert.deepEqual(commits, [true], `${route}: de nacontrole legt vast binnen de beurt`);
      assert.deepEqual(known(store), onHandle(own), route);
    } finally { onHandleWrite = null; delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
  }
  const { fileToolDeps, run } = await mcpTool();
  const own = fileAt('rij-mcp.ifc', plainBytes());
  const writes: boolean[] = [], commits: boolean[] = [];
  const previousFs = fileToolDeps.getFs;
  fileToolDeps.getFs = mcpFs(p => p, dir, true, p => { if (p === own) writes.push(isProjectFileWriteBusy()); });
  const ipc = desktop();
  try {
    const context = await openAt({ kind: 'path', path: own }, plainBytes());
    edit(context.store);
    const unsubscribe = context.store.subscribe((now, prev) => {
      if (now.knownTargetFingerprint !== prev.knownTargetFingerprint) commits.push(isProjectFileWriteBusy());
    });
    try { assert.equal((await run(context, own)).ok, true); } finally { unsubscribe(); }
    assert.equal(isProjectFileWriteBusy(), false, 'mcp: de rij is daarna leeg');
    assert.deepEqual(writes, [true], 'mcp: het schrijven valt binnen de beurt');
    assert.deepEqual(commits, [true], 'mcp: de nacontrole legt vast binnen de beurt');
    assert.deepEqual(known(context.store), onDisk(own));
  } finally { fileToolDeps.getFs = previousFs; ipc.dispose(); }
});

await check('de flag uitzetten via de instelling wist de vingerafdruk van elk tabblad; weer aanzetten brengt geen oude waarde terug', async () => {
  const ipc = desktop(), first = fileAt('flag-uit-eerste.ifc', plainBytes()), second = fileAt('flag-uit-tweede.ifc', otherPlainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: first }, plainBytes());
    const firstId = store.getState().activeDocumentId;
    await store.getState().openOpenedFile({ name: basename(second), content: '', bytes: otherPlainBytes(), ref: { kind: 'path', path: second } });
    assert.notEqual(store.getState().activeDocumentId, firstId);
    assert.deepEqual(known(store, firstId), onDisk(first), 'het slapende tabblad');
    assert.deepEqual(known(store), onDisk(second), 'het actieve tabblad');
    store.getState().setUI({ featureFlags: { ...store.getState().ui.featureFlags, ifcForeignContent: false } });
    assert.deepEqual([known(store, firstId), known(store)], [null, null]);
    store.getState().setUI({ featureFlags: { ...store.getState().ui.featureFlags, ifcForeignContent: true } });
    assert.deepEqual([known(store, firstId), known(store)], [null, null], 'weer aan: onbekend tot de volgende opslag');
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), onDisk(second));
  } finally { ipc.dispose(); }
});

rmSync(dir, { recursive: true, force: true });
console.log(`Tabblad kent de schijfversie: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
