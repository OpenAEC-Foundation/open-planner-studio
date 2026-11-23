import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import type { IfcOutputCompute } from '@/state/prepareIfcOutput';
import type { FileRef } from '@/services/fileAccess';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
import { installDeterminism } from './ifcPariteitKern';
import { InProcessWorker } from './inProcessSaveWorker';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const plainBytes = () => new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
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
const known = (store: Store) => store.getState().knownTargetFingerprint;
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
const sameSizeOtherContent = (data: Uint8Array): Uint8Array => {
  const text = new TextDecoder().decode(data);
  const changed = text.replace("'Zuidas Office Building'", "'Zuidas Office Buildinx'");
  assert.notEqual(changed, text, 'de proef vond de projectnaam');
  const bytes = new TextEncoder().encode(changed);
  assert.equal(bytes.byteLength, data.byteLength, 'even groot');
  return bytes;
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
  let answer: string | null = null;
  let before: ((command: string) => void) | undefined;
  win.__TAURI_INTERNALS__.invoke = async (...args) => {
    if (args[0] === 'plugin:dialog|save') return answer;
    before?.(String(args[0]));
    return invoke(...args);
  };
  const once = (command: RegExp, action: () => void) => {
    before = seen => { if (!command.test(seen)) return; before = undefined; action(); };
  };
  return { ...ipc, choose: (path: string | null) => { answer = path; }, once };
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

await check('met de flag uit: Ctrl+S en Automatisch opslaan schrijven over een gewijzigd bestand zoals main, ook als het tabblad een versie kent', async () => {
  const ipc = desktop();
  try {
    const off = fileAt('flag-uit.ifc', plainBytes());
    const { store: offStore } = await openAt({ kind: 'path', path: off }, plainBytes(), undefined, false);
    edit(offStore);
    writeFileSync(off, otherPlainBytes());
    assert.equal(await ctrlS(offStore), true);
    assert.notDeepEqual(onDisk(off), print(otherPlainBytes()));
    const later = fileAt('flag-later-uit.ifc', plainBytes());
    const { store } = await openAt({ kind: 'path', path: later }, plainBytes());
    assert.notEqual(known(store), null);
    store.setState(s => { s.ui.featureFlags = {}; });
    edit(store);
    writeFileSync(later, otherPlainBytes());
    assert.equal(await ctrlS(store), true, 'Ctrl+S');
    assert.notDeepEqual(onDisk(later), print(otherPlainBytes()));
    edit(store);
    writeFileSync(later, otherPlainBytes());
    await autoSave(store).flush();
    assert.equal(store.getState().isDirty, false, 'Automatisch opslaan');
    assert.notDeepEqual(onDisk(later), print(otherPlainBytes()));
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

await check('twee tabbladen op hetzelfde pad (knownbug 1957): de opslag van het tweede tabblad weigert in plaats van stil te overschrijven', async () => {
  const ipc = desktop(), path = fileAt('twee-tabbladen.ifc', plainBytes());
  try {
    const { store } = await openAt({ kind: 'path', path }, plainBytes());
    const first = store.getState().activeDocumentId;
    await store.getState().openOpenedFile({ name: basename(path), content: '', bytes: plainBytes(), ref: { kind: 'path', path } });
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

await check('de uitwegen blijven zoals main: Opslaan als over het gewijzigde eigen bestand en een export erover schrijven; daarna is de versie onbekend of nieuw', async () => {
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
    assert.equal(known(store), null);
    writeFileSync(path, otherPlainBytes());
    assert.equal(await ctrlS(store), true, 'na een export over het eigen bestand: onbekend, dus niet bewaakt');
    assert.deepEqual(known(store), onDisk(path));
    assert.deepEqual(errors(store), [CHANGED]);
  } finally { ipc.dispose(); }
});

async function stoppedAutoSave(name: string, failRead = false) {
  const ipc = desktop(), path = fileAt(name, plainBytes());
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
}
const roundWritesLaterWork = async (stopped: Awaited<ReturnType<typeof stoppedAutoSave>>) => {
  const { store, controller, path } = stopped;
  const later = edit(store);
  await controller.flush();
  return holds(path, later) && !store.getState().isDirty;
};

await check('stop van de bewaking × geen eigen opslag: de stop blijft, ook na een geweigerde Ctrl+S en een bestand dat weer klopt', async () => {
  const stopped = await stoppedAutoSave('stop-blijft.ifc');
  try {
    const { store, path, foreign } = stopped;
    assert.equal(await ctrlS(store), false, 'Ctrl+S weigert: het bestand is nog veranderd');
    assert.equal(await roundWritesLaterWork(stopped), false);
    assert.deepEqual(onDisk(path), print(foreign));
    writeFileSync(path, plainBytes());
    assert.equal(await roundWritesLaterWork(stopped), false, 'de planner sloeg niet zelf op');
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

await check('stop van de bewaking × de versie wordt onbekend (export over het eigen bestand): de stop vervalt en de ronde schrijft zoals main', async () => {
  const stopped = await stoppedAutoSave('stop-export.ifc');
  try {
    const { store, path, ipc } = stopped;
    ipc.choose(path);
    assert((await store.getState().exportAs('ifc')).ok);
    assert.equal(known(store), null);
    writeFileSync(path, otherPlainBytes());
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

rmSync(dir, { recursive: true, force: true });
console.log(`Bewaakte opslag: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
