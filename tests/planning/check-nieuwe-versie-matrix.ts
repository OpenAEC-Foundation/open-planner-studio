import { createHash } from 'node:crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  baseInvoke, changedIfc, dialog, dir, enc, eq, errors, gate, internals, ipc, kantoor, kantoorIfc, labels, newApp, report,
  resetInvoke, schoolIfc, setup, until, win, type App, type Store,
} from './nieuweVersieFixture';

if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: {} } });
}
const { isBlockingDialogOpen } = await import('@/state/blockingDialogs');
const { leaveBackstageGuarded, setBackstageLeaveGuard } = await import('@/components/backstage/backstageLeaveGuard');
const { createCloseDocumentDialogActions } = await import('@/components/layout/DocumentChrome/closeDocumentActions');
const { SHORTCUTS } = await import('@/hooks/keyboard/shortcutRegistry');
const { openDroppedFiles } = await import('@/state/fileDrop');
const { droppedFilesFromPaths } = await import('@/services/fileAccess/fileDrop');
const { tauriOpenIO } = await import('@/services/fileAccess/tauriOpenPath');
const { lowerForeignOpenWarnBytesForTests } = await import('@/services/ifc/foreignOpenSize');
const { createAppQuitController } = await import('@/services/appQuit/appQuitController');
const { appQuitDependencies } = await import('@/services/appQuit/appQuitDependencies');
const io = await tauriOpenIO();
const escape = SHORTCUTS.find(s => s.id === 'edit.deselect')!;

type Route = 'knop' | 'kruisje';
type Platform = 'pad' | 'handle';
type Begin = 'schoon' | 'werk' | 'verouderd' | 'verouderdWerk' | 'backstage' | 'dialoog' | 'tweede' | 'weg' | 'onleesbaar' | 'groot'
  | 'tweeStroken';
type Before = 'niets' | 'opslagLoopt';
type During = 'niets' | 'typen' | 'ctrlS' | 'opslaanAls' | 'recent' | 'slepen' | 'flagUit' | 'dialoog' | 'backstage'
  | 'nieuwereVersie' | 'handleB' | 'venster' | 'exporteren' | 'tabSluiten' | 'recentAnder' | 'knopAnder' | 'tweeOpslagen';
type Answer = 'nietOpslaan' | 'annuleren' | 'escape';
type Moment = 'vraag' | 'lezen';
interface Case { platform: Platform; begin: Begin; before: Before; during: During; moment: Moment; answer: Answer }

const other = join(dir, 'kantoor-ander.ifc');
const modelBytes = readFileSync('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
const newestIfc = changedIfc.split('Extern opgeslagen werk').join('Nieuwste versie op schijf');
const schoolNewIfc = schoolIfc.split("'Dak'").join("'Dak nieuwe versie'");

const holds: { reached: () => void; release: Promise<void> }[] = [];
const armRead = () => {
  const reached = gate(), release = gate();
  holds.push({ reached: reached.open, release: release.wait });
  return { reached: reached.wait, release: release.open };
};
const takeHold = async () => {
  const hold = holds.shift();
  if (hold) { hold.reached(); await hold.release; }
};
const kantoorRead = (command: string, args: unknown) =>
  /^plugin:fs\|read_(text_)?file$/.test(command) && (args as { path?: string } | undefined)?.path === kantoor;

const handleIds = new Map<object, string>();
class FakeHandle {
  readonly kind = 'file';
  slowIdentity = false;
  constructor(readonly name: string, public bytes: Uint8Array, readonly entry: string, label: string) { handleIds.set(this, label); }
  async getFile() {
    const bytes = this.bytes;
    if (this.entry === 'kantoor') await takeHold();
    return new File([bytes as BlobPart], this.name);
  }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async isSameEntry(other: unknown) {
    if (this.slowIdentity || (other as FakeHandle).slowIdentity) await new Promise<void>(r => setTimeout(r, 300));
    return other instanceof FakeHandle && other.entry === this.entry;
  }
}

interface World {
  app: App;
  st: Store;
  T: () => ReturnType<Store['getState']>;
  a: string;
  b: string;
  writeKantoor: (bytes: string | Uint8Array) => void;
  kantoorBytes: () => Uint8Array;
  recentId: () => string | null;
  drop: () => Promise<void>;
  openTwin: () => Promise<void>;
}

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const versionNames = new Map<string, string>([
  [sha(enc.encode(kantoorIfc)), 'A'], [sha(enc.encode(changedIfc)), 'B'], [sha(enc.encode(newestIfc)), 'C'],
  [sha(enc.encode(schoolIfc)), 'school'], [sha(enc.encode(schoolNewIfc)), 'school-nieuw'], [sha(modelBytes), 'model'],
]);

async function padWorld(c: Case): Promise<World> {
  const { app, st, T, a, b } = await setup(c.begin === 'werk' || c.begin === 'verouderdWerk');
  const world: World = {
    app, st, T, a, b,
    writeKantoor: (bytes) => writeFileSync(kantoor, bytes),
    kantoorBytes: () => { try { return readFileSync(kantoor); } catch { return new Uint8Array(); } },
    recentId: () => T().recentFiles.find(e => e.ref.kind === 'path' && e.ref.path === kantoor)?.id ?? null,
    drop: () => openDroppedFiles(st, droppedFilesFromPaths([kantoor], io, { ifcBytes: true }), labels, () => false),
    openTwin: async () => {},
  };
  if (c.begin === 'verouderd' || c.begin === 'verouderdWerk') writeFileSync(kantoor, kantoorIfc);
  if (c.begin === 'weg') unlinkSync(kantoor);
  if (c.begin === 'onleesbaar') writeFileSync(kantoor, 'ISO-10303-21;\nkapot');
  if (c.begin === 'groot') writeFileSync(kantoor, modelBytes);
  if (c.begin === 'tweeStroken') {
    writeFileSync(join(dir, 'school.ifc'), schoolNewIfc);
    const id = T().recentFiles.find(e => e.ref.kind === 'path' && e.ref.path === join(dir, 'school.ifc'))?.id;
    if (id) await T().openRecentFile(id, labels);
    T().switchDocument(a);
  }
  if (c.begin === 'tweede') {
    T().switchDocument(b);
    T().addTask({ name: 'Werk in tweede tab' });
    unlinkSync(kantoor);
    dialog.save = kantoor;
    await T().saveFileAs();
    writeFileSync(kantoor, changedIfc);
    const id = world.recentId();
    if (id) await T().openRecentFile(id, labels);
  }
  st.setState(s => { s.ui.notifications = []; });
  return world;
}

let tauri: unknown = null;
async function handleWorld(c: Case): Promise<World> {
  tauri = win.__TAURI_INTERNALS__;
  delete win.__TAURI_INTERNALS__;
  const app = newApp(true);
  const st = app.store;
  const T = () => st.getState();
  const kh = new FakeHandle('kantoor.ifc', enc.encode(kantoorIfc), 'kantoor', 'h-kantoor');
  const sh = new FakeHandle('school.ifc', enc.encode(schoolIfc), 'school', 'h-school');
  const ref = (h: FakeHandle) => ({ kind: 'handle' as const, handle: h as unknown as FileSystemFileHandle });
  const openHandle = (h: FakeHandle) => T().openOpenedFile({ name: h.name, content: '', bytes: h.bytes, ref: ref(h) }, labels);
  const twin = new FakeHandle('kantoor.ifc', kh.bytes, 'kantoor', 'h-kantoor-2');
  const openTwin = async () => {
    twin.bytes = kh.bytes;
    twin.slowIdentity = true;
    T().newDocument();
    await T().openOpenedFile({ name: twin.name, content: '', bytes: twin.bytes, ref: ref(twin) }, labels);
    twin.slowIdentity = false;
  };
  await openHandle(kh);
  const a = T().activeDocumentId;
  if (c.begin === 'werk') T().addTask({ name: 'Eigen werk' });
  T().newDocument();
  await openHandle(sh);
  const b = T().activeDocumentId;
  if (c.begin === 'tweede') await openTwin();
  kh.bytes = enc.encode(changedIfc);
  T().switchDocument(b);
  await openHandle(kh);
  st.setState(s => {
    s.recentFiles = [{ id: 'kantoor-h', ref: ref(kh), name: 'kantoor.ifc', addedAt: 1 }];
    s.ui.notifications = [];
  });
  return {
    app, st, T, a, b,
    writeKantoor: (bytes) => { kh.bytes = typeof bytes === 'string' ? enc.encode(bytes) : bytes; },
    kantoorBytes: () => kh.bytes,
    recentId: () => 'kantoor-h',
    drop: async () => {},
    openTwin,
  };
}

let backstageAsked = 0;
let windowClosed = false;
const unregister: (() => void)[] = [];
const registerDraft = () => { unregister.push(setBackstageLeaveGuard(() => { backstageAsked++; return true; })); };
const gateFor = (w: World) => ({ blocked: () => isBlockingDialogOpen(w.T().ui), leave: leaveBackstageGuarded });

interface Created { name: string; doc: string }
const schoolPath = join(dir, 'school.ifc');
const schoolRecent = (w: World) => w.T().recentFiles.find(e => e.ref.kind === 'path' && e.ref.path === schoolPath)?.id ?? null;
let quitUnsubscribe: (() => void) | null = null;

async function duringAction(w: World, c: Case, route: Route, created: Created[]) {
  const { T, b } = w;
  switch (c.during) {
    case 'niets': return;
    case 'typen':
      T().addTask({ name: 'Getypt tijdens lezen' });
      created.push({ name: 'Getypt tijdens lezen', doc: T().activeDocumentId });
      return;
    case 'ctrlS':
      T().switchDocument(b);
      T().addTask({ name: 'Opgeslagen in school' });
      created.push({ name: 'Opgeslagen in school', doc: b });
      await T().saveFile();
      return;
    case 'tweeOpslagen':
      T().switchDocument(b);
      T().addTask({ name: 'Eerst opgeslagen' });
      created.push({ name: 'Eerst opgeslagen', doc: b });
      await T().saveFile();
      T().addTask({ name: 'Daarna opgeslagen als' });
      created.push({ name: 'Daarna opgeslagen als', doc: b });
      dialog.save = other;
      await T().saveFileAs();
      return;
    case 'exporteren':
      dialog.save = T().filePath ?? kantoor;
      await T().exportAs('ifc');
      return;
    case 'tabSluiten':
      T().closeDocument(T().activeDocumentId);
      return;
    case 'recentAnder': {
      const id = schoolRecent(w);
      if (id) await T().openRecentFile(id, labels);
      return;
    }
    case 'knopAnder': {
      if (!w.T().documents.some(d => d.id === b)) return;
      T().switchDocument(b);
      if (route === 'knop') { await T().loadNewVersion(labels, gateFor(w)); return; }
      T().requestCloseDocument(b);
      const id = schoolRecent(w);
      if (id && !w.T().documents.some(d => d.id === b)) await T().openRecentFile(id, labels);
      return;
    }
    case 'opslaanAls':
      T().switchDocument(b);
      dialog.save = other;
      await T().saveFileAs();
      return;
    case 'recent': {
      const id = w.recentId();
      if (id) await T().openRecentFile(id, labels);
      return;
    }
    case 'slepen': await w.drop(); return;
    case 'flagUit': T().setUI({ featureFlags: {} }); return;
    case 'dialoog': T().setUI({ showTaskDialog: true, editingTaskId: T().tasks[0]?.id ?? null }); return;
    case 'backstage': registerDraft(); return;
    case 'nieuwereVersie': w.writeKantoor(newestIfc); return;
    case 'handleB': await w.openTwin(); return;
    case 'venster': {
      const controller = createAppQuitController(appQuitDependencies(w.app, {
        stopRecovery: () => () => {},
        clearRecovery: async () => {},
        destroyWindow: async () => { windowClosed = true; },
      }));
      quitUnsubscribe = w.st.subscribe(() => { if (controller.active) controller.step(); });
      controller.requestQuit();
      return;
    }
  }
}

async function answer(w: World, c: Case, discarded: Set<string>) {
  let finishing: Promise<void> | null = null;
  const actions = createCloseDocumentDialogActions({
    pendingId: w.a,
    getActiveDocumentId: () => w.T().activeDocumentId,
    switchDocument: (id) => w.T().switchDocument(id),
    closeDocument: (id, options) => w.T().closeDocumentAfterSaves(id, options),
    saveFile: () => w.T().saveFileForDocument(w.a),
    clearPending: () => { finishing = w.T().finishCloseQuestion(w.a, labels); },
    restoreOpenerFocus: () => {},
    onSavePendingChange: (pending) => { w.T().setUI({ closeQuestionSaving: pending }); },
  });
  if (c.answer === 'nietOpslaan') { discarded.add(w.a); await actions.discard(); }
  else if (c.answer === 'annuleren') actions.cancel();
  else escape.run(w.T());
  return { finishing: finishing as Promise<void> | null };
}

const settledAfter = (w: World) => {
  const recent = w.T().recentFiles, count = errors(w.st).length + w.T().ui.notifications.length;
  return () => w.T().recentFiles !== recent || errors(w.st).length + w.T().ui.notifications.length !== count;
};

async function runRoute(route: Route, c: Case) {
  const w = c.platform === 'pad' ? await padWorld(c) : await handleWorld(c);
  const { T, st, a } = w;
  const created: Created[] = c.begin === 'werk' || c.begin === 'verouderdWerk' ? [{ name: 'Eigen werk', doc: a }] : [];
  if (c.begin === 'tweede' && c.platform === 'pad') created.push({ name: 'Werk in tweede tab', doc: w.b });
  const discarded = new Set<string>();
  let asked = 0, readsOfKantoor = 0;
  const unsubscribe = st.subscribe((next, prev) => {
    if (next.ui.pendingCloseDocId && next.ui.pendingCloseDocId !== prev.ui.pendingCloseDocId) asked++;
  });
  backstageAsked = 0;
  windowClosed = false;
  if (c.begin === 'backstage') registerDraft();
  if (c.begin === 'dialoog') T().setUI({ showTaskDialog: true, editingTaskId: T().tasks[0]?.id ?? null });
  if (c.begin === 'groot') lowerForeignOpenWarnBytesForTests(1024);
  let writeHold: { placed: ReturnType<typeof gate>; release: ReturnType<typeof gate> } | null = null;
  internals.invoke = async (command, args, options) => {
    if (writeHold && /^plugin:fs\|(write|write_file|write_text_file|rename)$/.test(command)) {
      const hold = writeHold;
      writeHold = null;
      hold.placed.open();
      await hold.release.wait;
    }
    const result = await baseInvoke(command, args, options);
    if (kantoorRead(command, args)) { readsOfKantoor++; await takeHold(); }
    return result;
  };
  const closed = () => !T().documents.some(d => d.id === a);
  try {
    let saving: Promise<void> | null = null;
    let release: (() => void) | null = null;
    if (c.before === 'opslagLoopt') {
      const hold = { placed: gate(), release: gate() };
      writeHold = hold;
      release = hold.release.open;
      T().switchDocument(w.b);
      T().addTask({ name: 'Werk in school' });
      saving = T().saveFile();
      await hold.placed.wait;
      T().switchDocument(a);
    }
    const reading = c.during !== 'niets' && c.moment === 'lezen' ? armRead() : null;
    let clicked: Promise<void> | null = null;
    if (route === 'knop') clicked = T().loadNewVersion(labels, gateFor(w));
    else if (!isBlockingDialogOpen(T().ui)) leaveBackstageGuarded(() => T().requestCloseDocument(a));
    if (saving) {
      T().addTask({ name: 'Getypt terwijl de opslag liep' });
      created.push({ name: 'Getypt terwijl de opslag liep', doc: T().activeDocumentId });
      release?.();
      await saving;
    }
    if (clicked) await Promise.race([clicked, reading?.reached ?? clicked]);
    else if (saving) await until(() => T().ui.pendingCloseDocId === a || closed());
    let opening: Promise<void> | null = null;
    let settled = settledAfter(w);
    if (T().ui.pendingCloseDocId === a) {
      if (c.during !== 'niets' && c.moment === 'vraag') {
        await duringAction(w, c, route, created);
        settled = settledAfter(w);
      }
      const { finishing } = await answer(w, c, discarded);
      const id = w.recentId();
      if (route === 'kruisje' && closed() && id && !T().ui.appQuitPending) opening = T().openRecentFile(id, labels);
      else if (route === 'knop') opening = finishing;
    } else if (route === 'kruisje' && closed()) {
      const id = w.recentId();
      if (id) opening = T().openRecentFile(id, labels);
    } else if (clicked) {
      opening = clicked;
    }
    if (reading && closed()) {
      if (!await Promise.race([reading.reached.then(() => true), until(() => false)])) holds.length = 0;
      await duringAction(w, c, route, created);
      settled = settledAfter(w);
    }
    reading?.release();
    if (opening) await opening;
    else if (closed()) await until(settled);
    if (c.during === 'venster') await until(() => windowClosed);
    holds.length = 0;
    const names = new Map(versionNames);
    const seen = new Map<string, string>();
    const version = (hash: string) => {
      if (!names.has(hash)) names.set(hash, `eigen-${names.size - versionNames.size + 1}`);
      seen.set(hash, names.get(hash)!);
      return names.get(hash)!;
    };
    const ordered = [...T().getOpenDocumentPayloads()].sort((x, y) =>
      String(x.payload.filePath ?? handleIds.get(x.payload.fileHandle ?? {}) ?? '').localeCompare(String(y.payload.filePath ?? handleIds.get(y.payload.fileHandle ?? {}) ?? ''))
      || x.payload.tasks.map(t => t.name).join().localeCompare(y.payload.tasks.map(t => t.name).join()));
    for (const path of [kantoor, schoolPath, other]) { try { version(sha(readFileSync(path))); } catch { } }
    const tabs = ordered.map(({ id, payload }) => {
      const ref = payload.fileHandle ? `handle:${handleIds.get(payload.fileHandle) ?? '?'}` : payload.filePath ? `pad:${basename(payload.filePath)}` : null;
      const disk = payload.fileHandle ? (payload.fileHandle as unknown as FakeHandle).bytes
        : payload.filePath ? (() => { try { return readFileSync(payload.filePath!); } catch { return null; } })() : null;
      const known = payload.knownTargetFingerprint;
      return JSON.stringify([
        ref, payload.tasks.map(t => t.name), payload.isDirty, T().documents.find(d => d.id === id)?.changedOnDisk === true,
        payload.project.name, payload.ifcSource ? version(payload.ifcSource.sha256) : null, payload.ifcSource?.bytes.byteLength ?? null,
        known ? [version(known.sha256), known.byteLength, !!disk && sha(disk) === known.sha256 && disk.byteLength === known.byteLength] : null,
      ]);
    });
    const injective = new Set(seen.values()).size === seen.size;
    const everywhere = [...T().getOpenDocumentPayloads().flatMap(d => d.payload.tasks.map(t => t.name)),
      new TextDecoder().decode(w.kantoorBytes()), (() => { try { return readFileSync(other, 'utf8'); } catch { return ''; } })(),
      (() => { try { return readFileSync(join(dir, 'school.ifc'), 'utf8'); } catch { return ''; } })()];
    const lost = created.filter(item => !discarded.has(item.doc) && !everywhere.some(text => text === item.name || text.includes(item.name)))
      .map(item => item.name);
    return {
      tabs,
      active: T().filePath ? basename(T().filePath!) : T().fileHandle ? handleIds.get(T().fileHandle!) ?? '?' : null,
      ribbon: T().ui.activeRibbonTab,
      question: asked > 0,
      backstageAsked: backstageAsked > 0,
      windowClosed,
      lost,
      notices: T().ui.notifications.map(n => n.messageKey).sort(),
      reads: readsOfKantoor,
      disk: [kantoor, schoolPath, other].map(path => { try { return version(sha(readFileSync(path))); } catch { return null; } }),
      injective,
    };
  } finally {
    unsubscribe();
    quitUnsubscribe?.();
    quitUnsubscribe = null;
    for (const undo of unregister.splice(0)) undo();
    lowerForeignOpenWarnBytesForTests();
    try { unlinkSync(other); } catch { }
    if (tauri) { win.__TAURI_INTERNALS__ = tauri; tauri = null; }
    holds.length = 0;
    resetInvoke();
  }
}

const cases: Case[] = [];
const add = (platform: Platform, begin: Begin, during: During = 'niets', answers: Answer[] = ['nietOpslaan'], before: Before = 'niets', moment: Moment = 'lezen') => {
  for (const a of answers) cases.push({ platform, begin, before, during, moment, answer: a });
};
add('pad', 'schoon');
add('pad', 'werk', 'niets', ['nietOpslaan', 'annuleren', 'escape']);
add('pad', 'verouderd');
add('pad', 'verouderdWerk', 'niets', ['nietOpslaan', 'annuleren']);
add('pad', 'backstage');
add('pad', 'dialoog');
add('pad', 'tweede');
add('pad', 'weg');
add('pad', 'onleesbaar');
add('pad', 'groot');
for (const during of ['typen', 'ctrlS', 'opslaanAls', 'exporteren', 'tabSluiten', 'recent', 'recentAnder', 'slepen', 'flagUit', 'dialoog', 'backstage', 'nieuwereVersie', 'venster'] as const) {
  add('pad', 'schoon', during);
  add('pad', 'werk', during);
  add('pad', 'werk', during, ['nietOpslaan'], 'niets', 'vraag');
}
add('pad', 'tweeStroken');
add('pad', 'tweeStroken', 'knopAnder');
add('pad', 'tweeStroken', 'recentAnder');
add('pad', 'tweede', 'ctrlS');
add('pad', 'schoon', 'tweeOpslagen');
add('pad', 'werk', 'tweeOpslagen');
add('pad', 'schoon', 'niets', ['nietOpslaan'], 'opslagLoopt');
add('handle', 'schoon');
add('handle', 'werk', 'niets', ['nietOpslaan', 'annuleren']);
add('handle', 'tweede');
add('handle', 'schoon', 'handleB');
add('handle', 'schoon', 'typen');
add('handle', 'werk', 'nieuwereVersie');

try {
  for (const c of cases) {
    const id = `${c.platform} ${c.begin} ${c.before} ${c.during}@${c.moment} ${c.answer}`;
    console.log(`GEVAL ${id}`);
    const knop = await runRoute('knop', c);
    console.log(`GEVAL ${id} kruisje`);
    const kruisje = await runRoute('kruisje', c);
    const { question: _k, ...knopRest } = knop;
    const { question: _r, ...kruisjeRest } = kruisje;
    if (JSON.stringify(knopRest) !== JSON.stringify(kruisjeRest)) {
      console.log(`VERSCHIL ${id}\n  knop    ${JSON.stringify(knopRest)}\n  kruisje ${JSON.stringify(kruisjeRest)}`);
    }
    eq(`M ${id}: de knop eindigt als kruisje, dan Recent`, knopRest, kruisjeRest);
    eq(`M ${id}: een vraag bij de knop alleen als het kruisje er een gaf`, knop.question, kruisje.question);
    eq(`M ${id}: geen werk zonder vraag weg`, knop.lost, []);
    eq(`M ${id}: verschillende versies krijgen verschillende namen`, [knop.injective, kruisje.injective], [true, true]);
  }
} finally {
  ipc.dispose();
}

report('nieuwe-versie-matrix');
