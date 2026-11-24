import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import { computeIfcOutputHere, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import type { FileRef } from '@/services/fileAccess';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
import { installDeterminism } from './ifcPariteitKern';
import { InProcessWorker } from './inProcessSaveWorker';
import { fakeScanWorker } from './fakeScanWorker';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const plainBytes = () => new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
const modelBytes = () => new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const otherPlainBytes = () => new Uint8Array(readFileSync(join(root, 'public/examples/10-villa-wassenaar.ifc')));
const dir = mkdtempSync(join(tmpdir(), 'ops-bewaakte-opslag-'));
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const print = (data: Uint8Array) => ({ sha256: sha(data), byteLength: data.byteLength });
const onDisk = (path: string) => print(new Uint8Array(readFileSync(path)));
type Store = Awaited<ReturnType<typeof openAt>>['store'];

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

const CHANGED = 'notifications.ifcForeignTargetChanged';
const AUTOSAVE_CHANGED = 'notifications.ifcForeignAutoSaveTargetChanged';
const known = (store: Store) => {
  const fingerprint = store.getState().knownTargetFingerprint;
  return fingerprint && { sha256: fingerprint.sha256, byteLength: fingerprint.byteLength };
};
const origin = (store: Store) => store.getState().knownTargetFingerprint?.origin ?? null;
const FOREIGN_TARGET = 'notifications.ifcForeignTargetSave';
const UNREADABLE_TARGET = 'notifications.ifcUnreadableTargetSave';
let added = 0;
const edit = (store: Store) => {
  const name = `Toegevoegd voor de bewaakte opslag ${++added}`;
  store.getState().addTask({ name });
  store.getState().runCPM();
  return name;
};
const holds = (path: string, name: string) => readFileSync(path, 'utf8').includes(`'${name}'`);
const notices = (store: Store, key: string) => store.getState().ui.notifications.filter(n => n.messageKey === key).length;
const ctrlS = (store: Store) => store.getState().saveFileForDocument(store.getState().activeDocumentId);
const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
const sameSizeChange = (data: Uint8Array): Uint8Array => {
  const bytes = new Uint8Array(data);
  const at = new TextDecoder().decode(bytes).indexOf("FILE_NAME('") + "FILE_NAME('".length;
  assert(at > "FILE_NAME('".length && /[A-Za-z0-9]/.test(String.fromCharCode(bytes[at])), 'de proef vond de bestandsnaam in de kop');
  bytes[at] = bytes[at] === 0x78 ? 0x79 : 0x78;
  return bytes;
};
const sameSizeOtherContent = (data: Uint8Array): Uint8Array => {
  const text = new TextDecoder().decode(data);
  const changed = text.replace("'Zuidas Office Building'", "'Zuidas Office Buildinx'");
  assert.notEqual(changed, text, 'de proef vond de projectnaam');
  const bytes = new TextEncoder().encode(changed);
  assert.equal(bytes.byteLength, data.byteLength, 'even groot');
  return bytes;
};

const handleFiles = new Map<string, Uint8Array>();
const handleReads = new Map<string, number>();
let onSameEntry: (() => void) | null = null;
class FakeHandle {
  readonly kind = 'file';
  constructor(readonly name: string) {}
  async isSameEntry(other: unknown) {
    const during = onSameEntry;
    onSameEntry = null;
    during?.();
    return other instanceof FakeHandle && other.name === this.name;
  }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async getFile() {
    handleReads.set(this.name, (handleReads.get(this.name) ?? 0) + 1);
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
const newHandle = (data: Uint8Array) => {
  const handle = new FakeHandle(`bewaakt-${++handleCount}.ifc`);
  handleFiles.set(handle.name, data);
  return handle;
};
const handleRef = (handle: FakeHandle): FileRef => ({ kind: 'handle', handle: handle as unknown as FileSystemFileHandle });
const onHandle = (handle: FakeHandle) => print(handleFiles.get(handle.name)!);

function desktop() {
  const ipc = installNodeFileIpc({ appDataDir: mkdtempSync(join(dir, 'appdata-')) });
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const invoke = win.__TAURI_INTERNALS__.invoke;
  let answer: string | null = null, picks = 0;
  let before: ((command: string) => void) | undefined;
  win.__TAURI_INTERNALS__.invoke = async (...args) => {
    if (args[0] === 'plugin:dialog|save') { picks++; return answer; }
    before?.(String(args[0]));
    return invoke(...args);
  };
  const once = (command: RegExp, action: () => void) => {
    before = seen => { if (!command.test(seen)) return; before = undefined; action(); };
  };
  return { ...ipc, choose: (path: string | null) => { answer = path; }, once, picks: () => picks };
}

function saveWorker() {
  const client = createIfcSaveWorker({ createWorker: () => new InProcessWorker() });
  return { compute: client.compute, dispose: () => client.dispose() };
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
const autoSave = (store: Store) => {
  store.getState().setAutoSaveToFile(true);
  return createFileAutoSaveController({ getState: store.getState, enabled: () => true });
};

await check('Ctrl+S op het eigen pad: een ander programma schreef een bestand van een andere grootte; de app weigert', async () => {
  const ipc = desktop(), path = fileAt('andere-grootte.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    const opened = known(store);
    edit(store);
    writeFileSync(path, otherPlainBytes());
    assert.notEqual(otherPlainBytes().byteLength, opened!.byteLength);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(errors(store), [CHANGED]);
    assert.deepEqual(onDisk(path), print(otherPlainBytes()), 'het bestand van het andere programma staat er nog');
    assert.equal(store.getState().isDirty, true, 'de wijzigingen staan nog in de app');
    assert.deepEqual(known(store), opened);
  } finally { ipc.dispose(); }
});

await check('Ctrl+S op het eigen pad: even groot maar een andere inhoud; de app leest, hasht en weigert', async () => {
  const ipc = desktop(), path = fileAt('zelfde-grootte.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    edit(store);
    const foreign = sameSizeOtherContent(plainBytes());
    writeFileSync(path, foreign);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(errors(store), [CHANGED]);
    assert.deepEqual(onDisk(path), print(foreign));
    assert.equal(store.getState().isDirty, true);
  } finally { ipc.dispose(); }
});

await check('Ctrl+S op het eigen pad: dezelfde bytes opnieuw neergezet (nieuwe wijzigingstijd) of het bestand weg: de app schrijft zoals main', async () => {
  const ipc = desktop(), path = fileAt('zelfde-bytes.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    edit(store);
    writeFileSync(path, readFileSync(path));
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(known(store), onDisk(path));
    edit(store);
    rmSync(path);
    assert.equal(await ctrlS(store), true, 'er valt niets te verliezen');
    assert(existsSync(path));
    assert.deepEqual(known(store), onDisk(path));
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); }
});

await check('onbekende versie (null): niet bewaken; Ctrl+S schrijft over een gewijzigd bestand zoals main', async () => {
  const ipc = desktop(), path = fileAt('onbekend.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    store.getState().setFilePath(path);
    assert.equal(known(store), null);
    edit(store);
    writeFileSync(path, otherPlainBytes());
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(errors(store), []);
    assert.deepEqual(known(store), onDisk(path));
    assert.notDeepEqual(onDisk(path), print(otherPlainBytes()));
  } finally { ipc.dispose(); }
});

await check('met de flag uit: Ctrl+S en Automatisch opslaan schrijven over een gewijzigd bestand zoals main, ook als het tabblad een versie kent, en lezen het doel niet', async () => {
  const ipc = desktop();
  try {
    let read = ipc.bytesRead();
    const off = fileAt('flag-uit.ifc', plainBytes());
    const { store: offStore } = await openAt({ kind: 'path', path: off }, plainBytes(), undefined, false);
    edit(offStore);
    writeFileSync(off, otherPlainBytes());
    assert.equal(await ctrlS(offStore), true);
    assert.notDeepEqual(onDisk(off), print(otherPlainBytes()));
    assert.equal(ipc.bytesRead(), read, 'Ctrl+S met de flag uit las geen byte van het doel');
    const later = fileAt('flag-later-uit.ifc', plainBytes());
    const { store } = await openAt({ kind: 'path', path: later }, plainBytes());
    assert.notEqual(known(store), null);
    store.setState(s => { s.ui.featureFlags = {}; });
    edit(store);
    writeFileSync(later, otherPlainBytes());
    read = ipc.bytesRead();
    assert.equal(await ctrlS(store), true, 'Ctrl+S');
    assert.notDeepEqual(onDisk(later), print(otherPlainBytes()));
    edit(store);
    writeFileSync(later, otherPlainBytes());
    await autoSave(store).flush();
    assert.equal(store.getState().isDirty, false, 'Automatisch opslaan');
    assert.notDeepEqual(onDisk(later), print(otherPlainBytes()));
    assert.equal(ipc.bytesRead(), read, 'met de flag uit lazen Ctrl+S en de ronde geen byte van het doel, ook met een bekende versie');
    assert.deepEqual([...errors(offStore), ...errors(store)], []);
  } finally { ipc.dispose(); }
});

await check('Ctrl+S via de eigen handle: een andere grootte en een even grote andere inhoud worden geweigerd; dezelfde bytes niet', async () => {
  for (const foreign of [otherPlainBytes(), sameSizeOtherContent(plainBytes())]) {
    const handle = newHandle(plainBytes());
    const { store } = await openAt(handleRef(handle), plainBytes());
    edit(store);
    handleFiles.set(handle.name, foreign);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(errors(store), [CHANGED]);
    assert.deepEqual(onHandle(handle), print(foreign));
    assert.equal(store.getState().isDirty, true);
  }
  const handle = newHandle(plainBytes());
  const { store } = await openAt(handleRef(handle), plainBytes());
  edit(store);
  handleFiles.set(handle.name, plainBytes());
  assert.equal(await ctrlS(store), true);
  assert.deepEqual(known(store), onHandle(handle));
  assert.deepEqual(errors(store), []);
});

for (const route of ['opslagworker', 'hoofdthread'] as const) {
  await check(`tien keer Ctrl+S achter elkaar op het eigen pad en via de eigen handle (${route}): geen weigering`, async () => {
    const sw = route === 'opslagworker' ? saveWorker() : null;
    const ipc = desktop(), path = fileAt(`tien-${route}.ifc`, plainBytes());
    try {
      const { store } = await openAt({ kind: 'path', path }, plainBytes(), sw?.compute);
      for (let round = 1; round <= 10; round++) {
        edit(store);
        assert.equal(await ctrlS(store), true, `pad, ronde ${round}`);
        assert.deepEqual(known(store), onDisk(path), `pad, ronde ${round}`);
      }
      assert.deepEqual(errors(store), []);
    } finally { ipc.dispose(); }
    try {
      const handle = newHandle(plainBytes());
      const { store } = await openAt(handleRef(handle), plainBytes(), sw?.compute);
      for (let round = 1; round <= 10; round++) {
        edit(store);
        assert.equal(await ctrlS(store), true, `handle, ronde ${round}`);
        assert.deepEqual(known(store), onHandle(handle), `handle, ronde ${round}`);
      }
      assert.deepEqual(errors(store), []);
    } finally { sw?.dispose(); }
  });
}

await check('Automatisch opslaan naar het eigen pad: tien rondes en daarna Ctrl+S, zonder weigering', async () => {
  const sw = saveWorker(), ipc = desktop(), path = fileAt('auto-tien.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes(), sw.compute);
    const controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: sw.compute });
    store.getState().setAutoSaveToFile(true);
    for (let round = 1; round <= 10; round++) {
      edit(store);
      await controller.flush();
      assert.equal(store.getState().isDirty, false, `ronde ${round}`);
      assert.deepEqual(known(store), onDisk(path), `ronde ${round}`);
    }
    edit(store);
    assert.equal(await ctrlS(store), true);
    edit(store);
    await controller.flush();
    assert.equal(store.getState().isDirty, false, 'Ctrl+S gevolgd door Automatisch opslaan');
    assert.deepEqual(known(store), onDisk(path));
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); sw.dispose(); }
});

await check('Automatisch opslaan naar het eigen pad: een ander programma schreef het bestand; één melding, stoppen tot de planner zelf een doel kiest', async () => {
  const ipc = desktop(), path = fileAt('auto-gewijzigd.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    const controller = autoSave(store);
    edit(store);
    const foreign = sameSizeOtherContent(plainBytes());
    writeFileSync(path, foreign);
    await controller.flush();
    assert.equal(store.getState().isDirty, true);
    assert.deepEqual(onDisk(path), print(foreign));
    assert.deepEqual(errors(store), [AUTOSAVE_CHANGED]);
    writeFileSync(path, plainBytes());
    edit(store);
    await controller.flush();
    assert.deepEqual(onDisk(path), print(plainBytes()), 'gestopt: ook als het bestand weer klopt, schrijft de ronde niet');
    assert.equal(store.getState().ui.notifications.filter(n => n.messageKey === AUTOSAVE_CHANGED).length, 1);
    const elsewhere = join(dir, 'auto-elders.ifc'); ipc.choose(elsewhere);
    await store.getState().saveFileAs();
    assert.equal(store.getState().filePath, elsewhere);
    edit(store);
    await controller.flush();
    assert.equal(store.getState().isDirty, false, 'een ander doel: Automatisch opslaan loopt weer');
    assert.deepEqual(known(store), onDisk(elsewhere));
  } finally { ipc.dispose(); }
});

await check('Automatisch opslaan via de eigen handle: een ander programma schreef het bestand; de ronde schrijft niet', async () => {
  const handle = newHandle(plainBytes());
  const { store } = await openAt(handleRef(handle), plainBytes());
  const controller = autoSave(store);
  edit(store);
  handleFiles.set(handle.name, otherPlainBytes());
  await controller.flush();
  assert.equal(store.getState().isDirty, true);
  assert.deepEqual(onHandle(handle), print(otherPlainBytes()));
  assert.deepEqual(errors(store), [AUTOSAVE_CHANGED]);
});

await check('twee tabbladen op hetzelfde bestand (knownbug 1957, via een anders geschreven pad: 2063): de opslag van het tweede tabblad weigert in plaats van stil te overschrijven', async () => {
  const ipc = desktop(), path = fileAt('twee-tabbladen.ifc', plainBytes()), other = `${dir}/./twee-tabbladen.ifc`;
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    const first = store.getState().activeDocumentId;
    await store.getState().openOpenedFile({ name: basename(other), content: '', bytes: plainBytes(), ref: { kind: 'path', path: other } });
    assert.notEqual(store.getState().activeDocumentId, first, 'een tweede tabblad, zoals main');
    edit(store);
    assert.equal(await ctrlS(store), true);
    const saved = onDisk(path);
    store.getState().switchDocument(first);
    edit(store);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(errors(store), [CHANGED]);
    assert.deepEqual(onDisk(path), saved, 'de opslag van het andere tabblad staat er nog');
    assert.equal(store.getState().isDirty, true);
  } finally { ipc.dispose(); }
});

function ownHandlePicker(own: FakeHandle, count: number) {
  const win = window as unknown as Record<string, unknown>, answers = Array.from({ length: count }, () => own);
  win.showOpenFilePicker = () => { throw new Error('niet gebruikt'); };
  win.showSaveFilePicker = async () => answers.shift()!;
  return { left: () => answers.length, dispose: () => { delete win.showOpenFilePicker; delete win.showSaveFilePicker; } };
}
const withLibrary = (store: Store) => {
  const companyId = store.getState().seedDemoLibrary();
  store.getState().setProject({ companyId, companyName: 'Proefbedrijf' });
};

await check('de uitwegen blijven zoals main: Opslaan als over het gewijzigde eigen bestand en een export erover schrijven; daarna kent het tabblad de versie op schijf', async () => {
  const ipc = desktop(), path = fileAt('uitweg.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    edit(store);
    writeFileSync(path, otherPlainBytes());
    assert.equal(await ctrlS(store), false);
    ipc.choose(path);
    await store.getState().saveFileAs();
    assert.equal(store.getState().isDirty, false, 'Opslaan als over het eigen bestand');
    assert.deepEqual(known(store), onDisk(path));
    edit(store);
    writeFileSync(path, otherPlainBytes());
    ipc.choose(path);
    assert((await store.getState().exportAs('ifc')).ok, 'de export wordt niet bewaakt');
    assert.notDeepEqual(onDisk(path), print(otherPlainBytes()));
    assert.deepEqual(known(store), onDisk(path), 'de vingerafdruk is die van de geschreven export');
    const saved = edit(store);
    assert.equal(await ctrlS(store), true, 'Ctrl+S op de eigen versie slaagt');
    assert(holds(path, saved));
    edit(store);
    const foreign = sameSizeChange(readFileSync(path));
    writeFileSync(path, foreign);
    assert.equal(await ctrlS(store), false, 'na een externe wijziging van dezelfde grootte weigert Ctrl+S weer');
    assert.deepEqual(onDisk(path), print(foreign));
    assert.deepEqual(errors(store), [CHANGED]);
  } finally { ipc.dispose(); }
});

await check('volgorde 1, de export met de resourcebibliotheek schrijft beide delen over de eigen handle: Ctrl+S op die versie slaagt, na een externe wijziging van dezelfde grootte weigert hij weer', async () => {
  const own = newHandle(plainBytes()), picker = ownHandlePicker(own, 2);
  try {
    const { store } = await openAt(handleRef(own), plainBytes());
    withLibrary(store);
    edit(store);
    assert.equal(await ctrlS(store), true);
    edit(store);
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok && !pooled.cancelled);
    assert.equal(picker.left(), 0, 'beide delen kozen de eigen handle');
    assert.deepEqual(known(store), onHandle(own), 'de vingerafdruk is die van het laatste deel op de eigen handle');
    const saved = edit(store);
    assert.equal(await ctrlS(store), true, 'Ctrl+S op de eigen versie slaagt');
    assert(new TextDecoder().decode(handleFiles.get(own.name)!).includes(`'${saved}'`));
    edit(store);
    const foreign = sameSizeChange(handleFiles.get(own.name)!);
    handleFiles.set(own.name, foreign);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(onHandle(own), print(foreign));
    assert.deepEqual(errors(store), [CHANGED]);
  } finally { picker.dispose(); }
});

await check('volgorde 2, Automatisch opslaan schrijft en de export wacht in de schrijfrij en schrijft daarna over het eigen pad: Ctrl+S op die versie slaagt, na een externe wijziging van dezelfde grootte weigert hij weer', async () => {
  const ipc = desktop(), path = fileAt('volgorde-2.ifc', plainBytes());
  const started: Promise<unknown>[] = [];
  let armed = false, reached!: () => void, release!: () => void;
  const atGate = new Promise<void>(resolve => { reached = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const held: IfcOutputCompute = async job => {
    if (armed) { armed = false; reached(); await gate; }
    return computeIfcOutputHere(job);
  };
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    store.getState().setAutoSaveToFile(true);
    edit(store);
    armed = true;
    const round = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: held }).flush();
    started.push(round);
    await atGate;
    edit(store);
    ipc.choose(path);
    const exported = store.getState().exportAs('ifc');
    started.push(exported);
    for (let i = 0; i < 50 && ipc.picks() === 0; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(ipc.picks(), 0, 'de export wacht in de rij achter Automatisch opslaan');
    release();
    await round;
    const afterRound = known(store);
    assert.deepEqual(afterRound, onDisk(path));
    assert((await exported).ok);
    assert.notDeepEqual(onDisk(path), afterRound, 'de export schreef andere bytes over het eigen pad');
    assert.deepEqual(known(store), onDisk(path));
    const saved = edit(store);
    assert.equal(await ctrlS(store), true, 'Ctrl+S op de eigen versie slaagt');
    assert(holds(path, saved));
    edit(store);
    const foreign = sameSizeChange(readFileSync(path));
    writeFileSync(path, foreign);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(onDisk(path), print(foreign));
    assert.deepEqual(errors(store), [CHANGED]);
  } finally {
    release();
    await Promise.allSettled(started);
    ipc.dispose();
  }
});

async function stoppedAutoSave(name: string, failRead = false) {
  const ipc = desktop(), path = fileAt(name, plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    const controller = autoSave(store);
    edit(store);
    const foreign = sameSizeOtherContent(plainBytes());
    writeFileSync(path, foreign);
    if (failRead) ipc.once(/^plugin:fs\|read_file$/, () => { throw new Error('leesfout voor de proef'); });
    await controller.flush();
    assert.equal(store.getState().isDirty, true, 'gestopt: niets geschreven');
    assert.deepEqual(onDisk(path), print(foreign));
    assert.equal(notices(store, AUTOSAVE_CHANGED), 1);
    return { ipc, path, store, controller, foreign };
  } catch (error) {
    ipc.dispose();
    throw error;
  }
}
const roundWritesLaterWork = async (stopped: Awaited<ReturnType<typeof stoppedAutoSave>>) => {
  const { store, controller, path } = stopped;
  const later = edit(store);
  await controller.flush();
  return holds(path, later) && !store.getState().isDirty;
};

await check('stop van de bewaking × geen eigen opslag: de stop blijft, ook na een geweigerde Ctrl+S en een bestand dat weer klopt; wordt alleen de versie onbekend, dan vervalt hij', async () => {
  const stopped = await stoppedAutoSave('stop-blijft.ifc');
  try {
    const { store, path, foreign } = stopped;
    assert.equal(await ctrlS(store), false, 'Ctrl+S weigert: het bestand is nog veranderd');
    assert.equal(await roundWritesLaterWork(stopped), false);
    assert.deepEqual(onDisk(path), print(foreign));
    writeFileSync(path, plainBytes());
    assert.equal(await roundWritesLaterWork(stopped), false, 'de planner sloeg niet zelf op');
    assert.equal(notices(store, AUTOSAVE_CHANGED), 1);
    store.getState().forgetKnownTargetFingerprint(store.getState().activeDocumentId);
    assert.equal(store.getState().ui.featureFlags.ifcForeignContent, true, 'de flag blijft aan');
    assert.equal(await roundWritesLaterWork(stopped), true, 'de versie werd onbekend: de stop vervalt en de ronde schrijft');
    assert.equal(notices(store, AUTOSAVE_CHANGED), 1);
  } finally { stopped.ipc.dispose(); }
});

await check('stop van de bewaking × geslaagde Ctrl+S (ook Opslaan in de sluitvraag) met nieuw werk tijdens het schrijven: de stop vervalt', async () => {
  const stopped = await stoppedAutoSave('stop-ctrl-s.ifc');
  try {
    const { store, path, ipc } = stopped;
    writeFileSync(path, plainBytes());
    let during = '';
    ipc.once(/^plugin:fs\|write/, () => { during = edit(store); });
    assert.equal(await ctrlS(store), false, 'de geschreven momentopname is niet het nieuwste werk');
    assert(during && !holds(path, during), 'het werk tijdens het schrijven staat nog niet in het bestand');
    assert.deepEqual(known(store), onDisk(path), 'de eigen opslag is vastgelegd');
    assert.equal(store.getState().isDirty, true);
    assert.equal(await roundWritesLaterWork(stopped), true);
    assert(holds(path, during));
  } finally { stopped.ipc.dispose(); }
});

await check('stop van de bewaking × Opslaan als naar hetzelfde pad met nieuw werk tijdens het schrijven: de stop vervalt', async () => {
  const stopped = await stoppedAutoSave('stop-als-zelfde.ifc');
  try {
    const { store, path, ipc } = stopped;
    ipc.choose(path);
    let during = '';
    ipc.once(/^plugin:fs\|write/, () => { during = edit(store); });
    await store.getState().saveFileAs();
    assert.equal(store.getState().filePath, path);
    assert(during && !holds(path, during));
    assert.deepEqual(known(store), onDisk(path));
    assert.equal(store.getState().isDirty, true);
    assert.equal(await roundWritesLaterWork(stopped), true);
  } finally { stopped.ipc.dispose(); }
});

await check('stop van de bewaking × de flag gaat uit: de stop vervalt en de ronde schrijft zoals main', async () => {
  const stopped = await stoppedAutoSave('stop-flag-uit.ifc');
  try {
    stopped.store.setState(s => { s.ui.featureFlags = {}; });
    assert.equal(await roundWritesLaterWork(stopped), true);
    assert.equal(notices(stopped.store, AUTOSAVE_CHANGED), 1);
  } finally { stopped.ipc.dispose(); }
});

await check('stop van de bewaking × een eigen export over het eigen pad: de stop vervalt, de volgende ronde schrijft het resterende werk, en een volgende externe wijziging stopt weer', async () => {
  const stopped = await stoppedAutoSave('stop-export.ifc');
  try {
    const { store, path, ipc } = stopped;
    ipc.choose(path);
    assert((await store.getState().exportAs('ifc')).ok);
    assert.deepEqual(known(store), onDisk(path), 'de eigen export legde een nieuwe bekende versie vast');
    assert.equal(store.getState().isDirty, true);
    assert.equal(await roundWritesLaterWork(stopped), true);
    assert.deepEqual(known(store), onDisk(path));
    const foreign = sameSizeChange(readFileSync(path));
    writeFileSync(path, foreign);
    assert.equal(await roundWritesLaterWork(stopped), false, 'opnieuw gestopt');
    assert.deepEqual(onDisk(path), print(foreign));
    assert.equal(notices(store, AUTOSAVE_CHANGED), 1, 'één melding per document per sessie');
  } finally { stopped.ipc.dispose(); }
});

await check('stop van de bewaking × volgorde 1, de export met de resourcebibliotheek over de eigen handle: de stop vervalt, de volgende ronde schrijft het resterende werk, en een volgende externe wijziging stopt weer', async () => {
  const own = newHandle(plainBytes()), picker = ownHandlePicker(own, 2);
  try {
    const { store } = await openAt(handleRef(own), plainBytes());
    withLibrary(store);
    const controller = autoSave(store);
    edit(store);
    const first = sameSizeOtherContent(plainBytes());
    handleFiles.set(own.name, first);
    await controller.flush();
    assert.equal(store.getState().isDirty, true, 'gestopt');
    assert.deepEqual(onHandle(own), print(first));
    const pooled = await store.getState().exportProjectWithPool();
    assert(pooled.ok && !pooled.cancelled);
    assert.equal(picker.left(), 0);
    assert.deepEqual(known(store), onHandle(own));
    const later = edit(store);
    await controller.flush();
    assert.equal(store.getState().isDirty, false, 'de stop verviel');
    assert(new TextDecoder().decode(handleFiles.get(own.name)!).includes(`'${later}'`), 'de ronde schreef het resterende werk');
    const foreign = sameSizeChange(handleFiles.get(own.name)!);
    handleFiles.set(own.name, foreign);
    edit(store);
    await controller.flush();
    assert.equal(store.getState().isDirty, true, 'opnieuw gestopt');
    assert.deepEqual(onHandle(own), print(foreign));
    assert.equal(notices(store, AUTOSAVE_CHANGED), 1);
  } finally { picker.dispose(); }
});

await check('stop van de bewaking × de instelling gaat uit via setUI: de stop vervalt en de ronde schrijft zoals main', async () => {
  const stopped = await stoppedAutoSave('stop-setui.ifc');
  try {
    stopped.store.getState().setUI({ featureFlags: {} });
    assert.equal(known(stopped.store), null, 'setUI wist de vingerafdruk');
    assert.equal(await roundWritesLaterWork(stopped), true);
  } finally { stopped.ipc.dispose(); }
});

await check('stop van de bewaking × een onleesbaar bestand: dezelfde stop, en hij vervalt op dezelfde regels', async () => {
  const stopped = await stoppedAutoSave('stop-onleesbaar.ifc', true);
  try {
    assert.equal(await roundWritesLaterWork(stopped), false, 'gestopt');
    stopped.store.setState(s => { s.ui.featureFlags = {}; });
    assert.equal(await roundWritesLaterWork(stopped), true);
  } finally { stopped.ipc.dispose(); }
});

await check('de flag gaat uit terwijl de vergelijking loopt: Automatisch opslaan legt geen stop vast en Ctrl+S weigert niet', async () => {
  const ipc = desktop();
  try {
    const autoPath = fileAt('tijdens-auto.ifc', plainBytes());
    const { store: auto } = await openAt({ kind: 'path', path: autoPath }, plainBytes());
    const controller = autoSave(auto);
    const work = edit(auto);
    writeFileSync(autoPath, sameSizeOtherContent(plainBytes()));
    ipc.once(/^plugin:fs\|read_file$/, () => { auto.setState(s => { s.ui.featureFlags = {}; }); });
    await controller.flush();
    assert(holds(autoPath, work), 'de ronde schrijft zoals main');
    assert.equal(auto.getState().isDirty, false);
    assert.equal(notices(auto, AUTOSAVE_CHANGED), 0);
    const later = edit(auto);
    await controller.flush();
    assert(holds(autoPath, later), 'en er staat geen stop');
    const savePath = fileAt('tijdens-ctrl-s.ifc', plainBytes());
    const { store } = await openAt({ kind: 'path', path: savePath }, plainBytes());
    const saved = edit(store);
    writeFileSync(savePath, sameSizeOtherContent(plainBytes()));
    ipc.once(/^plugin:fs\|read_file$/, () => { store.setState(s => { s.ui.featureFlags = {}; }); });
    assert.equal(await ctrlS(store), true);
    assert(holds(savePath, saved));
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); }
});

function flagProbe(on: boolean) {
  const flags = {};
  let yielded = true;
  const writtenReads: boolean[] = [];
  let guardReads = 0;
  Object.defineProperty(flags, 'ifcForeignContent', {
    enumerable: true,
    get() {
      const stack = new Error().stack ?? '';
      if (/\bguardedKnownTarget\d*\b/.test(stack)) {
        guardReads++;
        yielded = false;
        queueMicrotask(() => { yielded = true; });
      } else if (/\bwrittenFingerprint\d*\b/.test(stack)) writtenReads.push(yielded);
      return on;
    },
  });
  return { flags, guardReads: () => guardReads, writtenAfterYield: () => writtenReads.at(-1) };
}

await check('geldt de bewaking niet (flag uit), dan wacht Ctrl+S en Automatisch opslaan nergens op tussen die toets en het schrijven, zoals main', async () => {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 50;
  const ipc = desktop();
  try {
    for (const on of [false, true]) {
      const savePath = fileAt(`volgorde-ctrl-s-${on}.ifc`, plainBytes());
      const { store } = await openAt({ kind: 'path', path: savePath }, plainBytes());
      assert.notEqual(known(store), null, 'het tabblad kent een versie');
      const probe = flagProbe(on);
      store.setState(s => { s.ui.featureFlags = probe.flags; });
      edit(store);
      assert.equal(await ctrlS(store), true);
      assert(probe.guardReads() > 0, 'Ctrl+S las de flag in de toets');
      assert.equal(probe.writtenAfterYield(), on, `Ctrl+S, flag ${on ? 'aan: wel' : 'uit: geen'} wachtstap tussen toets en schrijven`);
      const autoPath = fileAt(`volgorde-auto-${on}.ifc`, plainBytes());
      const { store: auto } = await openAt({ kind: 'path', path: autoPath }, plainBytes());
      const controller = autoSave(auto);
      const autoProbe = flagProbe(on);
      auto.setState(s => { s.ui.featureFlags = autoProbe.flags; });
      edit(auto);
      await controller.flush();
      assert.equal(auto.getState().isDirty, false);
      assert(autoProbe.guardReads() > 0, 'de ronde las de flag in de toets');
      assert.equal(autoProbe.writtenAfterYield(), on, `Automatisch opslaan, flag ${on ? 'aan: wel' : 'uit: geen'} wachtstap tussen toets en schrijven`);
    }
  } finally { ipc.dispose(); Error.stackTraceLimit = limit; }
});

const newErrors = (store: Store) => {
  const before = errors(store).length;
  return () => errors(store).slice(before);
};
const twoDataSections = (data: Uint8Array): Uint8Array => {
  const lines = new TextDecoder().decode(data).split('\n');
  const half = lines.findIndex((line, i) => i > lines.length / 2 && line.startsWith('#') && line.includes('IFCPROPERTYSET('));
  assert(half > 0, 'de proef vond een eigenschappenset halverwege');
  return new TextEncoder().encode([...lines.slice(0, half), 'ENDSEC;', 'DATA;', ...lines.slice(half)].join('\n'));
};
const wallOfSameSize = (data: Uint8Array): Uint8Array => {
  const text = new TextDecoder().decode(data);
  const line = text.split('\n').find(l => /^#\d+=IFC[A-Z]+\(/.test(l) && /^[\x20-\x7e]+$/.test(l) && l.length > 80);
  assert(line, 'de proef vond een lange regel');
  const head = `${/^#\d+/.exec(line)![0]}=IFCWALL('0YvctVUKr0kugbFTf53O9L',$,'`, tail = `',$,$,$,$,$,$);`;
  const changed = new TextEncoder().encode(text.replace(line, head + 'x'.repeat(line.length - head.length - tail.length) + tail));
  assert.equal(changed.byteLength, data.byteLength, 'even groot');
  return changed;
};

await check('2203 A: staat op het eigen pad of de eigen handle de versie die het tabblad zelf schreef, dan lezen Ctrl+S en de ronde het doel één keer', async () => {
  const ipc = desktop(), path = fileAt('eigen-versie.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.equal(origin(store), 'written');
    for (const route of ['Ctrl+S', 'Automatisch opslaan'] as const) {
      const size = readFileSync(path).byteLength, read = ipc.bytesRead();
      const saved = edit(store);
      if (route === 'Ctrl+S') assert.equal(await ctrlS(store), true);
      else await autoSave(store).flush();
      assert.equal(ipc.bytesRead() - read, size, `${route}: precies één lezing van het doel`);
      assert(holds(path, saved), route);
      assert.equal(origin(store), 'written', route);
    }
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); }
  const handle = newHandle(plainBytes());
  const { store } = await openAt(handleRef(handle), plainBytes());
  edit(store);
  assert.equal(await ctrlS(store), true);
  for (const route of ['Ctrl+S', 'Automatisch opslaan'] as const) {
    const reads = handleReads.get(handle.name) ?? 0;
    const saved = edit(store);
    if (route === 'Ctrl+S') assert.equal(await ctrlS(store), true);
    else await autoSave(store).flush();
    assert.equal((handleReads.get(handle.name) ?? 0) - reads, 1, `${route}: één getFile op de eigen handle`);
    assert(new TextDecoder().decode(handleFiles.get(handle.name)!).includes(`'${saved}'`), route);
  }
  assert.deepEqual(errors(store), []);
});

await check('2203 B: de eerste Ctrl+S na openen loopt zoals main: eerst de doelscan als stroom, dan de toets van de bekende versie, en schrijft', async () => {
  const ipc = desktop(), path = fileAt('geopend.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    assert.equal(origin(store), 'opened');
    const read = ipc.bytesRead(), saved = edit(store);
    assert.equal(await ctrlS(store), true);
    assert.equal(ipc.bytesRead() - read, 3 * plainBytes().byteLength, 'de modelscan, de indeling en de toets, zoals main');
    assert(holds(path, saved));
    assert.equal(origin(store), 'written');
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); }
  const handle = newHandle(plainBytes());
  const { store } = await openAt(handleRef(handle), plainBytes());
  const reads = handleReads.get(handle.name) ?? 0;
  edit(store);
  assert.equal(await ctrlS(store), true);
  assert.equal((handleReads.get(handle.name) ?? 0) - reads, 2, 'de doelscan en de toets, zoals main');
});

await check('2203 A en B: of er gescand wordt, hangt alleen aan de herkomst en de laatste toets (een toestand die de app zelf niet maakt: een gebouwmodel met een passende vingerafdruk)', async () => {
  for (const kind of ['pad', 'handle'] as const) {
    for (const from of ['written', 'opened'] as const) {
      const ipc = kind === 'pad' ? desktop() : null, model = modelBytes();
      try {
        let store: Store, onTarget: () => Uint8Array, reads: () => number;
        if (kind === 'pad') {
          const path = fileAt(`herkomst-${from}.ifc`, plainBytes()), files = ipc!;
          ({ store } = await openAt({ kind: 'path', path }, plainBytes()));
          writeFileSync(path, model);
          onTarget = () => new Uint8Array(readFileSync(path));
          const start = files.bytesRead();
          reads = () => files.bytesRead() - start;
        } else {
          const handle = newHandle(plainBytes());
          ({ store } = await openAt(handleRef(handle), plainBytes()));
          handleFiles.set(handle.name, model);
          onTarget = () => handleFiles.get(handle.name)!;
          const start = handleReads.get(handle.name) ?? 0;
          reads = () => (handleReads.get(handle.name) ?? 0) - start;
        }
        store.setState(s => { s.knownTargetFingerprint = { ...print(model), origin: from, utf8Bom: false }; });
        const fresh = newErrors(store);
        edit(store);
        const saved = await ctrlS(store);
        if (from === 'written') {
          assert.equal(reads(), kind === 'pad' ? model.byteLength : 1, `${kind}: alleen de toets, één lezing`);
          assert.equal(saved, true, `${kind}: zelf geschreven, dus geen scan`);
          assert.notDeepEqual(print(onTarget()), print(model));
        } else {
          assert.equal(saved, false, `${kind}: geopend, dus de scan van die bytes weigert het gebouwmodel`);
          assert.deepEqual(fresh(), [FOREIGN_TARGET]);
          assert.deepEqual(print(onTarget()), print(model));
        }
      } finally { ipc?.dispose(); }
    }
  }
});

await check('2203 C: een geopend bestand met twee datasecties (openen neemt het aan, de doelscan niet): Ctrl+S scant zoals main en weigert', async () => {
  const ipc = desktop(), split = twoDataSections(plainBytes()), path = fileAt('twee-datasecties.ifc', split);
  try {
    const { store } = await openAt({ kind: 'path', path }, split);
    assert.equal(origin(store), 'opened', 'het bestand opende via de bytes-route');
    const fresh = newErrors(store);
    edit(store);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(fresh(), [UNREADABLE_TARGET]);
    assert.deepEqual(onDisk(path), print(split));
    assert.equal(store.getState().isDirty, true);
  } finally { ipc.dispose(); }
});

await check('2203 D: is de zelf geschreven versie vervangen door een even groot bestand met een muur, dan weigeren Ctrl+S en de ronde zoals voor deze PR: de doelscan van het bestand ziet de muur (pad en handle, één tabblad)', async () => {
  const ipc = desktop(), path = fileAt('muur.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.equal(origin(store), 'written');
    const wall = wallOfSameSize(new Uint8Array(readFileSync(path)));
    writeFileSync(path, wall);
    edit(store);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(errors(store), [FOREIGN_TARGET]);
    assert.deepEqual(onDisk(path), print(wall));
    await autoSave(store).flush();
    assert.deepEqual(onDisk(path), print(wall));
    assert.equal(store.getState().isDirty, true);
    assert.equal(notices(store, 'notifications.ifcForeignTargetAutoSave'), 1);
    assert.equal(notices(store, AUTOSAVE_CHANGED), 0);
  } finally { ipc.dispose(); }
  const handle = newHandle(plainBytes());
  const { store } = await openAt(handleRef(handle), plainBytes());
  edit(store);
  assert.equal(await ctrlS(store), true);
  assert.equal(origin(store), 'written');
  const wall = wallOfSameSize(handleFiles.get(handle.name)!);
  handleFiles.set(handle.name, wall);
  for (const action of ['Ctrl+S', 'Automatisch opslaan'] as const) {
    const reads = handleReads.get(handle.name) ?? 0, fresh = newErrors(store);
    edit(store);
    if (action === 'Ctrl+S') assert.equal(await ctrlS(store), false);
    else await autoSave(store).flush();
    assert.equal(store.getState().isDirty, true, action);
    assert.equal((handleReads.get(handle.name) ?? 0) - reads, 2, `${action}: de toets en daarna de doelscan`);
    assert.deepEqual(onHandle(handle), print(wall), action);
    assert.deepEqual(fresh(), [action === 'Ctrl+S' ? FOREIGN_TARGET : 'notifications.ifcForeignTargetAutoSave'], action);
  }
});

await check('2203 E: kent het tabblad de versie niet, dan scant Ctrl+S het doel zoals voorheen en weigert een gebouwmodel', async () => {
  const ipc = desktop(), path = fileAt('onbekend-model.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    store.getState().setFilePath(path);
    assert.equal(known(store), null);
    writeFileSync(path, modelBytes());
    edit(store);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(errors(store), [FOREIGN_TARGET]);
    assert.deepEqual(onDisk(path), print(modelBytes()));
  } finally { ipc.dispose(); }
  const handle = newHandle(plainBytes());
  const { store } = await openAt(handleRef(handle), plainBytes());
  store.setState(s => { s.knownTargetFingerprint = null; });
  handleFiles.set(handle.name, modelBytes());
  edit(store);
  assert.equal(await ctrlS(store), false);
  assert.deepEqual(errors(store), [FOREIGN_TARGET]);
  assert.deepEqual(onHandle(handle), print(modelBytes()));
});

await check('2203 G: ook op een zelf geschreven versie weigert Ctrl+S de bron van een ander tabblad met een gebouwmodel', async () => {
  const ipc = desktop(), path = fileAt('bron-van-ander.ifc', modelBytes()), plainPath = fileAt('gewoon-naast-model.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: plainPath }, plainBytes());
    const plain = store.getState().activeDocumentId;
    edit(store);
    await store.getState().openOpenedFile({ name: basename(path), content: '', bytes: modelBytes(), ref: { kind: 'path', path } });
    assert.notEqual(store.getState().activeDocumentId, plain, 'het model staat in een eigen tabblad');
    store.getState().switchDocument(plain);
    store.setState(s => { s.filePath = path; s.knownTargetFingerprint = { ...onDisk(path), origin: 'written', utf8Bom: false }; });
    const fresh = newErrors(store);
    edit(store);
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(fresh(), [FOREIGN_TARGET]);
    assert.deepEqual(onDisk(path), print(modelBytes()));
  } finally { ipc.dispose(); }
});

await check('2203, Opslaan als over een bestand met een gebouwmodel (bevestigd in de kiezer): daarna staat de eigen planning op het doel en slaat Ctrl+S de scan terecht over', async () => {
  const ipc = desktop(), own = fileAt('als-over-model-eigen.ifc', plainBytes()), model = fileAt('als-over-model.ifc', modelBytes());
  try {
    const { store } = await openAt({ kind: 'path', path: own }, plainBytes());
    edit(store);
    ipc.choose(model);
    await store.getState().saveFileAs();
    assert.equal(store.getState().filePath, model);
    assert.equal(store.getState().isDirty, false);
    assert.equal(origin(store), 'written');
    assert(!readFileSync(model, 'utf8').includes('IFCWALL'), 'het gebouwmodel is vervangen door de planning');
    const size = readFileSync(model).byteLength, read = ipc.bytesRead(), saved = edit(store);
    assert.equal(await ctrlS(store), true);
    assert.equal(ipc.bytesRead() - read, size, 'één lezing van de eigen versie');
    assert(holds(model, saved));
  } finally { ipc.dispose(); }
});

await check('2203 en knownbug 2065: schreef een ander tabblad via de browserkiezer over de eigen handle, dan weigert Ctrl+S met "gewijzigd" en slaat niets over', async () => {
  const own = newHandle(plainBytes()), source = newHandle(otherPlainBytes());
  const { store } = await openAt(handleRef(own), plainBytes());
  const plain = store.getState().activeDocumentId;
  edit(store);
  assert.equal(await ctrlS(store), true);
  assert.equal(origin(store), 'written');
  await store.getState().openOpenedFile({ name: source.name, content: '', bytes: otherPlainBytes(), ref: handleRef(source) });
  assert.notEqual(store.getState().activeDocumentId, plain);
  const picker = ownHandlePicker(own, 1);
  try {
    assert((await store.getState().exportAs('ifc')).ok, 'de browserkiezer vergelijkt de gekozen handle niet (knownbug 1899)');
  } finally { picker.dispose(); }
  assert(new TextDecoder().decode(handleFiles.get(own.name)!).includes("'New-Build Villa, Wassenaar'"), 'de planning van het andere tabblad staat op de eigen handle');
  store.getState().switchDocument(plain);
  const fresh = newErrors(store), onOwn = onHandle(own);
  edit(store);
  assert.equal(await ctrlS(store), false);
  assert.deepEqual(fresh(), [CHANGED]);
  assert.deepEqual(onHandle(own), onOwn);
});

function duringClassification(action: () => void) {
  const original = globalThis.Worker;
  let fired = 0;
  globalThis.Worker = class {
    constructor(url: unknown) {
      if (!String(url).includes('foreignScan')) throw new Error(`onverwachte Worker in de proef: ${String(url)}`);
      const worker = fakeScanWorker('ok') as unknown as { postMessage: (message: unknown) => void };
      const post = worker.postMessage;
      worker.postMessage = (message) => {
        if (fired === 0 && typeof message === 'object' && message !== null && 'bytes' in message) { fired++; action(); }
        post(message);
      };
      return worker;
    }
  } as unknown as typeof Worker;
  return { fired: () => fired, dispose: () => { globalThis.Worker = original; } };
}
const save = async (store: Store, action: 'Ctrl+S' | 'Automatisch opslaan') => {
  if (action === 'Ctrl+S') return ctrlS(store);
  await autoSave(store).flush();
  return !store.getState().isDirty;
};
const ACTIONS = ['Ctrl+S', 'Automatisch opslaan'] as const;
const label = (text: string) => text.replace(/[ +]/g, '-');

for (const kind of ['pad', 'handle'] as const) {
  for (const action of ACTIONS) {
    await check(`fixronde 1 (Sol): een gebouwmodel dat tijdens de indeling van de eerste opslag na openen op het doel verschijnt, blijft staan, zoals op main (${kind}, ${action})`, async () => {
      const ipc = kind === 'pad' ? desktop() : null, model = modelBytes();
      let hook: ReturnType<typeof duringClassification> | null = null;
      try {
        let store: Store, onTarget: () => Uint8Array, place: () => void;
        if (kind === 'pad') {
          const path = fileAt(`indeling-${label(action)}.ifc`, plainBytes());
          ({ store } = await openAt({ kind: 'path', path }, plainBytes()));
          onTarget = () => new Uint8Array(readFileSync(path));
          place = () => writeFileSync(path, model);
        } else {
          const handle = newHandle(plainBytes());
          ({ store } = await openAt(handleRef(handle), plainBytes()));
          onTarget = () => handleFiles.get(handle.name)!;
          place = () => { handleFiles.set(handle.name, model); };
        }
        assert.equal(origin(store), 'opened');
        edit(store);
        hook = duringClassification(place);
        assert.equal(await save(store, action), false);
        assert.equal(hook.fired(), 1, 'het model verscheen tijdens de indeling');
        assert.deepEqual(print(onTarget()), print(model), 'de externe bytes staan er nog');
        assert.equal(store.getState().isDirty, true);
        assert.deepEqual(errors(store), [action === 'Ctrl+S' ? CHANGED : AUTOSAVE_CHANGED]);
      } finally { hook?.dispose(); ipc?.dispose(); }
    });
  }
}

for (const action of ACTIONS) {
  await check(`fixronde 1 (Sol): een gebouwmodel dat op de eigen handle verschijnt terwijl de app de bron van een ander tabblad vergelijkt, blijft staan, ook op een zelf geschreven versie, zoals op main (${action})`, async () => {
    const own = newHandle(plainBytes()), source = newHandle(modelBytes()), model = modelBytes();
    const { store } = await openAt(handleRef(own), plainBytes());
    const plain = store.getState().activeDocumentId;
    await store.getState().openOpenedFile({ name: source.name, content: '', bytes: modelBytes(), ref: handleRef(source) });
    assert.notEqual(store.getState().activeDocumentId, plain, 'het model staat in een eigen tabblad');
    store.getState().switchDocument(plain);
    edit(store);
    assert.equal(await ctrlS(store), true);
    assert.equal(origin(store), 'written');
    const fresh = newErrors(store);
    edit(store);
    let fired = 0;
    onSameEntry = () => { fired++; handleFiles.set(own.name, model); };
    try { assert.equal(await save(store, action), false); } finally { onSameEntry = null; }
    assert.equal(fired, 1, 'het model verscheen tijdens de vergelijking van de handles');
    assert.deepEqual(onHandle(own), print(model));
    assert.equal(store.getState().isDirty, true);
    assert.deepEqual(fresh(), [action === 'Ctrl+S' ? FOREIGN_TARGET : 'notifications.ifcForeignTargetAutoSave']);
  });
}

for (const from of ['opened', 'written'] as const) {
  for (const action of ACTIONS) {
    await check(`fixronde 1 (Sol): het eigen bestand is weg en vóór de doelscan verschijnt een andere planning op die naam: de app weigert met "gewijzigd", zoals op main (${from}, ${action})`, async () => {
      const ipc = desktop(), path = fileAt(`weg-en-terug-${from}-${label(action)}.ifc`, plainBytes());
      try {
        const { store } = await openAt({ kind: 'path', path }, plainBytes());
        if (from === 'written') { edit(store); assert.equal(await ctrlS(store), true); }
        assert.equal(origin(store), from);
        edit(store);
        rmSync(path);
        let fired = 0;
        ipc.once(/^plugin:fs\|open$/, () => { fired++; writeFileSync(path, otherPlainBytes()); });
        assert.equal(await save(store, action), false);
        assert.equal(fired, 1, 'de andere planning verscheen vlak vóór de doelscan');
        assert.deepEqual(onDisk(path), print(otherPlainBytes()));
        assert.equal(store.getState().isDirty, true);
        assert.deepEqual(errors(store), [action === 'Ctrl+S' ? CHANGED : AUTOSAVE_CHANGED]);
      } finally { ipc.dispose(); }
    });
  }
}

for (const from of ['opened', 'written'] as const) {
  for (const action of ACTIONS) {
    await check(`fixronde 1 (Sol): stond er even een andere planning van dezelfde grootte en zet een ander programma de bekende versie tijdens de indeling terug, dan schrijft de app, zoals main (${from}, ${action})`, async () => {
      const ipc = desktop(), path = fileAt(`teruggezet-${from}-${label(action)}.ifc`, plainBytes());
      let hook: ReturnType<typeof duringClassification> | null = null;
      try {
        const { store } = await openAt({ kind: 'path', path }, plainBytes());
        if (from === 'written') { edit(store); assert.equal(await ctrlS(store), true); }
        assert.equal(origin(store), from);
        const knownBytes = new Uint8Array(readFileSync(path));
        writeFileSync(path, sameSizeChange(knownBytes));
        const saved = edit(store);
        hook = duringClassification(() => writeFileSync(path, knownBytes));
        assert.equal(await save(store, action), true);
        assert.equal(hook.fired(), 1, 'de bekende versie kwam tijdens de indeling terug');
        assert(holds(path, saved));
        assert.deepEqual(errors(store), []);
        assert.equal(origin(store), 'written');
      } finally { hook?.dispose(); ipc.dispose(); }
    });
  }
}

const BOM = [0xef, 0xbb, 0xbf] as const;
const withBom = (data: Uint8Array) => new Uint8Array([...BOM, ...data]);
const hasBom = (data: Uint8Array) => BOM.every((b, i) => data[i] === b);
const UNREADABLE_EXPORT = 'notifications.ifcUnreadableTargetExport';
const KINDS = ['pad', 'handle'] as const;
type Kind = typeof KINDS[number];
let bomFiles = 0;
const placed = (kind: Kind, data: Uint8Array) => {
  const name = `bom-${++bomFiles}.ifc`;
  if (kind === 'pad') {
    const path = fileAt(name, data);
    return { ref: { kind: 'path', path } as FileRef, bytes: () => new Uint8Array(readFileSync(path)), put: (next: Uint8Array) => writeFileSync(path, next) };
  }
  const handle = newHandle(data);
  return { ref: handleRef(handle), bytes: () => handleFiles.get(handle.name)!, put: (next: Uint8Array) => { handleFiles.set(handle.name, next); } };
};
const onPlatform = async (kind: Kind, action: (files: ReturnType<typeof desktop> | null) => Promise<void>) => {
  const ipc = kind === 'pad' ? desktop() : null;
  try { await action(ipc); } finally { ipc?.dispose(); }
};
const rename = (store: Store, name: string) => {
  const task = store.getState().tasks.find(t => !t.isSummary)!;
  store.getState().updateTask(task.id, { name });
};
const ownPlanning = await (async () => {
  const handle = newHandle(plainBytes());
  const { store } = await openAt(handleRef(handle), plainBytes());
  assert.equal(await ctrlS(store), true);
  const first = handleFiles.get(handle.name)!;
  const again = newHandle(first);
  const { store: reopened } = await openAt(handleRef(again), first);
  assert.equal(await ctrlS(reopened), true);
  assert.deepEqual(handleFiles.get(again.name), first, 'de schrijver geeft een ongewijzigde eigen planning byte voor byte terug');
  assert(!hasBom(first));
  return first;
})();

for (const kind of KINDS) {
  await check(`2212 ${kind}: een eigen BOM-bestand met twee datasecties weigert Ctrl+S zoals zonder BOM (de doelscan blijft)`, () => onPlatform(kind, async () => {
    const split = withBom(twoDataSections(ownPlanning)), own = placed(kind, split);
    const { store } = await openAt(own.ref, split);
    assert.equal(origin(store), 'opened');
    rename(store, 'Twee datasecties');
    assert.equal(await ctrlS(store), false);
    assert.deepEqual(errors(store), [UNREADABLE_TARGET]);
    assert.deepEqual(own.bytes(), split);
  }));
}

await check('2212 pad: Opslaan als en Exporteren → IFC over een bestaand BOM-bestand weigeren zoals main, ook over het eigen bestand', async () => {
  const ipc = desktop();
  try {
    const own = placed('pad', withBom(ownPlanning)), other = withBom(otherPlainBytes()), elsewhere = placed('pad', other);
    const { store } = await openAt(own.ref, withBom(ownPlanning));
    rename(store, 'Opslaan als over een BOM-bestand');
    const ownPath = (own.ref as Extract<FileRef, { kind: 'path' }>).path;
    for (const target of [elsewhere, own]) {
      const path = (target.ref as Extract<FileRef, { kind: 'path' }>).path, before = target.bytes();
      ipc.choose(path);
      store.setState(s => { s.ui.notifications = []; });
      await store.getState().saveFileAs();
      assert.deepEqual(errors(store), [UNREADABLE_TARGET], `Opslaan als over ${basename(path)}`);
      assert.deepEqual(target.bytes(), before);
      assert.equal(store.getState().filePath, ownPath);
      ipc.choose(path);
      store.setState(s => { s.ui.notifications = []; });
      assert.deepEqual(await store.getState().exportAs('ifc'), { ok: true, warnings: [], cancelled: true }, `export over ${basename(path)}`);
      assert.deepEqual(errors(store), [UNREADABLE_EXPORT]);
      assert.deepEqual(target.bytes(), before);
    }
    assert.equal(store.getState().isDirty, true);
  } finally { ipc.dispose(); }
});

await check('2212 met de flag uit: Ctrl+S en Automatisch opslaan op een BOM-bestand doen wat main doet en lezen het doel niet', async () => {
  const ipc = desktop();
  try {
    const own = placed('pad', withBom(ownPlanning)), twin = placed('pad', ownPlanning);
    const { store } = await openAt(own.ref, withBom(ownPlanning), undefined, false);
    const { store: main } = await openAt(twin.ref, ownPlanning, undefined, false);
    const read = ipc.bytesRead();
    for (const s of [store, main]) rename(s, 'Flag uit met BOM');
    assert.equal(await ctrlS(main), true);
    assert.equal(await ctrlS(store), true);
    assert.deepEqual(own.bytes(), twin.bytes(), 'zoals main: de gewone schrijver zonder BOM');
    for (const s of [store, main]) rename(s, 'Flag uit met BOM, automatisch');
    for (const s of [store, main]) await autoSave(s).flush();
    assert.equal(store.getState().isDirty, false);
    assert.deepEqual(own.bytes(), twin.bytes());
    assert.equal(ipc.bytesRead(), read, 'met de flag uit las de app geen byte van het doel');
    assert.deepEqual(errors(store), []);
  } finally { ipc.dispose(); }
});

rmSync(dir, { recursive: true, force: true });
console.log(`Bewaakte opslag: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
