import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';

installBrowserStubs();
installFakeRecoveryIndexedDb();
const reseed = installDeterminism();
const realError = console.error;
console.error = () => {};

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { changedOnDiskShown } = await import('@/state/openDocumentFor');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { buildImportLabels } = await import('@/i18n/importLabels');
const { createAppQuitController } = await import('@/services/appQuit/appQuitController');
const { appQuitDependencies } = await import('@/services/appQuit/appQuitDependencies');
type App = ReturnType<typeof createAppStoreContext>;
type Store = App['store'];

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 300)} ≠ ${w?.slice(0, 300)}`);
};
const labels = buildImportLabels((key) => key);
const enc = new TextEncoder();

function newApp(flag: boolean): App {
  reseed(0x804);
  const app = createAppStoreContext();
  if (flag) app.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  return app;
}
function planIfc(name: string, task: string): string {
  const store = newApp(false).store;
  store.getState().newProject();
  store.getState().setProject({ name, startDate: '2026-01-05' });
  store.getState().addTask({ name: task });
  return writeIFC(buildWriteIFCInput(store.getState(), 'planOnly'));
}
function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => { open = resolve; });
  return { wait, open: () => open() };
}
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 400 && !cond(); i++) await new Promise<void>(r => setTimeout(r, 5));
  return cond();
};
const kantoorIfc = planIfc('Kantoor', 'Fundering');
const schoolIfc = planIfc('School', 'Dak');
const changedIfc = planIfc('Kantoor', 'Extern opgeslagen werk');
const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
const names = (store: Store) => store.getState().tasks.map(t => t.name);
const has = (store: Store, id: string) => store.getState().documents.some(d => d.id === id);

const dir = mkdtempSync(join(tmpdir(), 'ops-nieuwe-versie-'));
const kantoor = join(dir, 'kantoor.ifc');
const school = join(dir, 'school.ifc');
const onDisk = () => createHash('sha256').update(readFileSync(kantoor)).digest('hex');
const ipc = installNodeFileIpc({ appDataDir: mkdtempSync(join(tmpdir(), 'ops-nieuwe-versie-appdata-')) });
const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
win.parent = win;
let dialogAnswer: string | null = null;
const internals = win.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
const innerInvoke = internals.invoke;
internals.invoke = async (command, args, options) => {
  if (command === 'plugin:dialog|open') return dialogAnswer;
  return innerInvoke(command, args, options);
};
const isRead = (command: string, args: unknown) =>
  /^plugin:fs\|read_(text_)?file$/.test(command) && (args as { path?: string } | undefined)?.path === kantoor;
const openPath = async (store: Store, path: string) => {
  dialogAnswer = path;
  await store.getState().openFile(labels);
};

async function setup(dirty: boolean) {
  writeFileSync(kantoor, kantoorIfc);
  writeFileSync(school, schoolIfc);
  const app = newApp(true);
  const st = app.store;
  const T = () => st.getState();
  await openPath(st, kantoor);
  const a = T().activeDocumentId;
  if (dirty) T().addTask({ name: 'Eigen werk' });
  T().newDocument();
  await openPath(st, school);
  const b = T().activeDocumentId;
  writeFileSync(kantoor, changedIfc);
  await openPath(st, kantoor);
  st.setState(s => { s.ui.notifications = []; });
  return { app, st, T, a, b };
}

try {
  {
    const { st, T, a } = await setup(false);
    const before = [T().activeDocumentId === a, changedOnDiskShown(T())];
    await T().loadNewVersion(labels);
    eq('N1 schoon tabblad: de nieuwe versie in een tabblad, het oude weg, de strook weg, de vingerafdruk van de gelezen bytes', [
      before, has(st, a), T().filePath, names(st), T().isDirty, changedOnDiskShown(T()), T().documents.some(d => d.changedOnDisk),
      T().knownTargetFingerprint?.sha256 === onDisk(), T().documents.length, T().ui.pendingCloseDocId,
    ], [[true, true], false, kantoor, ['Extern opgeslagen werk'], false, false, false, true, 2, null]);
    T().addTask({ name: 'Na het laden' });
    await T().saveFile();
    eq('N1 daarna Ctrl+S: geen weigering, het werk op schijf', [
      T().isDirty, readFileSync(kantoor, 'utf8').includes('Na het laden'), errors(st),
    ], [false, true, []]);
  }

  {
    const { st, T, a } = await setup(true);
    await T().loadNewVersion(labels);
    const asked = [T().ui.pendingCloseDocId === a, T().ui.pendingCloseLoadsNewVersion, has(st, a), names(st), changedOnDiskShown(T())];
    const loaded = await T().loadNewVersionAfterDiscard();
    T().setUI({ pendingCloseDocId: null });
    eq('N2 niet-opgeslagen werk: de vraag met de nieuwe versie; Niet opslaan vervangt', [
      asked, loaded, has(st, a), names(st), T().filePath, changedOnDiskShown(T()), T().ui.pendingCloseLoadsNewVersion,
    ], [[true, true, true, ['Fundering', 'Eigen werk'], true], true, false, ['Extern opgeslagen werk'], kantoor, false, false]);
  }

  {
    const { st, T, a } = await setup(true);
    await T().loadNewVersion(labels);
    T().dropNewVersion();
    T().setUI({ pendingCloseDocId: null });
    const late = await T().loadNewVersionAfterDiscard();
    eq('N3 Annuleren: het tabblad, het werk en de strook blijven; een late Niet opslaan doet niets', [
      has(st, a), T().activeDocumentId === a, names(st), T().isDirty, changedOnDiskShown(T()), T().ui.pendingCloseLoadsNewVersion, late,
    ], [true, true, ['Fundering', 'Eigen werk'], true, true, false, false]);
    T().requestCloseDocument(a);
    eq('N3 het kruisje daarna: de gewone sluitvraag, zonder de nieuwe versie', [
      T().ui.pendingCloseDocId === a, T().ui.pendingCloseLoadsNewVersion,
    ], [true, false]);
    T().setUI({ pendingCloseDocId: null });
    await T().loadNewVersion(labels);
    T().setUI({ pendingCloseDocId: null });
    eq('N3 Escape (de sluitvraag dicht zonder knop) laat de nieuwe versie vallen', [
      T().ui.pendingCloseLoadsNewVersion, await T().loadNewVersionAfterDiscard(), has(st, a), names(st),
    ], [false, false, true, ['Fundering', 'Eigen werk']]);
  }

  {
    const { st, T, a } = await setup(true);
    unlinkSync(kantoor);
    await T().loadNewVersion(labels);
    eq('N4 lezen mislukt (bestand weg): de melding van de openroute; tabblad, werk en strook onveranderd', [
      errors(st).length > 0, has(st, a), T().activeDocumentId === a, names(st), T().isDirty, changedOnDiskShown(T()), T().ui.pendingCloseDocId,
    ], [true, true, true, ['Fundering', 'Eigen werk'], true, true, null]);
    writeFileSync(kantoor, changedIfc);
  }

  {
    const { st, T, a } = await setup(false);
    const reached = gate(), release = gate();
    let held = false;
    internals.invoke = async (command, args, options) => {
      if (command === 'plugin:dialog|open') return dialogAnswer;
      const result = await innerInvoke(command, args, options);
      if (!held && isRead(command, args)) { held = true; reached.open(); await release.wait; }
      return result;
    };
    try {
      const loading = T().loadNewVersion(labels);
      await reached.wait;
      T().addTask({ name: 'Tijdens het lezen' });
      const editable = [T().isDirty, names(st)];
      release.open();
      await loading;
      eq('N5 doorwerken tijdens het lezen: de bewerking maakt het tabblad gewijzigd, dus de vraag; niets stil weg', [
        editable, T().ui.pendingCloseDocId === a, T().ui.pendingCloseLoadsNewVersion, has(st, a), names(st),
      ], [[true, ['Fundering', 'Tijdens het lezen']], true, true, true, ['Fundering', 'Tijdens het lezen']]);
    } finally {
      release.open();
      internals.invoke = async (command, args, options) => command === 'plugin:dialog|open' ? dialogAnswer : innerInvoke(command, args, options);
    }
  }

  {
    const { st, T, a, b } = await setup(false);
    T().closeDocument(b);
    await T().loadNewVersion(labels);
    eq('N6 het laatste tabblad: de nieuwe versie in het enige tabblad', [
      has(st, a), T().documents.length, names(st), T().filePath, changedOnDiskShown(T()),
    ], [false, 1, ['Extern opgeslagen werk'], kantoor, false]);
  }

  {
    const { st, T, a } = await setup(false);
    let reads = 0;
    internals.invoke = async (command, args, options) => {
      if (command === 'plugin:dialog|open') return dialogAnswer;
      if (isRead(command, args)) reads++;
      return innerInvoke(command, args, options);
    };
    try {
      await Promise.all([T().loadNewVersion(labels), T().loadNewVersion(labels)]);
    } finally {
      internals.invoke = async (command, args, options) => command === 'plugin:dialog|open' ? dialogAnswer : innerInvoke(command, args, options);
    }
    eq('N7 twee keer klikken: één lezing en één tabblad', [reads, has(st, a), T().documents.length, names(st)], [1, false, 2, ['Extern opgeslagen werk']]);
  }

  {
    const { st, T, a, b } = await setup(false);
    T().switchDocument(b);
    T().addTask({ name: 'Werk in School' });
    const placed = gate(), release = gate();
    let held = false, readsWhileSaving = 0;
    internals.invoke = async (command, args, options) => {
      if (command === 'plugin:dialog|open') return dialogAnswer;
      if (isRead(command, args) && held) readsWhileSaving++;
      if (!held && /^plugin:fs\|(write|write_file|write_text_file|rename)$/.test(command)) { held = true; placed.open(); await release.wait; }
      return innerInvoke(command, args, options);
    };
    try {
      const saving = T().saveFile();
      await placed.wait;
      T().switchDocument(a);
      const loading = T().loadNewVersion(labels);
      await new Promise<void>(r => setTimeout(r, 60));
      const waiting = [readsWhileSaving, has(st, a), T().ui.savingBeforeClose];
      release.open();
      await saving;
      held = false;
      await loading;
      eq('N8 een opslag loopt: de knop leest pas daarna, dan de nieuwe versie', [
        waiting, has(st, a), names(st), readFileSync(school, 'utf8').includes('Werk in School'),
      ], [[0, true, true], false, ['Extern opgeslagen werk'], true]);
    } finally {
      release.open();
      internals.invoke = async (command, args, options) => command === 'plugin:dialog|open' ? dialogAnswer : innerInvoke(command, args, options);
    }
  }

  for (const route of ['kruisje', 'knop'] as const) {
    const { app, st, T, a } = await setup(true);
    if (route === 'kruisje') T().requestCloseDocument(a);
    else await T().loadNewVersion(labels);
    let destroyed = false;
    const controller = createAppQuitController(appQuitDependencies(app, {
      stopRecovery: () => () => {},
      clearRecovery: async () => {},
      destroyWindow: async () => { destroyed = true; },
    }));
    controller.requestQuit();
    await new Promise<void>(r => setTimeout(r, 30));
    const during = [destroyed, T().ui.pendingCloseDocId === a, T().ui.pendingCloseLoadsNewVersion];
    if (route === 'kruisje') await T().closeDocumentAfterSaves(a);
    else await T().loadNewVersionAfterDiscard();
    T().setUI({ pendingCloseDocId: null });
    controller.step();
    const closed = await until(() => destroyed);
    eq(`N9 ${route} (ronde 10): het venster sluiten tijdens de vraag wacht op de vraag; na Niet opslaan gaat het venster dicht`, [
      during, closed, has(st, a),
    ], [[false, true, route === 'knop'], true, false]);
  }

  {
    const { st, T, a } = await setup(false);
    T().setUI({ featureFlags: {} });
    await T().loadNewVersion(labels);
    eq('N10 de flag uit: geen strook en de knop doet niets', [changedOnDiskShown(T()), has(st, a), names(st), T().ui.pendingCloseDocId],
      [false, true, ['Fundering'], null]);
  }

  {
    class FakeHandle {
      readonly kind = 'file';
      constructor(readonly name: string, public bytes: Uint8Array) {}
      async getFile() { return new File([this.bytes as BlobPart], this.name); }
      async queryPermission() { return 'granted'; }
      async requestPermission() { return 'granted'; }
      async isSameEntry(other: unknown) { return other === this; }
    }
    const tauri = win.__TAURI_INTERNALS__;
    delete win.__TAURI_INTERNALS__;
    try {
    const app = newApp(true);
    const st = app.store;
    const T = () => st.getState();
    const handle = new FakeHandle('kantoor.ifc', enc.encode(kantoorIfc));
    const ref = { kind: 'handle' as const, handle: handle as unknown as FileSystemFileHandle };
    await T().openOpenedFile({ name: handle.name, content: '', bytes: handle.bytes, ref }, labels);
    const a = T().activeDocumentId;
    T().newDocument();
    handle.bytes = enc.encode(changedIfc);
    await T().openOpenedFile({ name: handle.name, content: '', bytes: handle.bytes, ref }, labels);
    const shown = [T().activeDocumentId === a, changedOnDiskShown(T())];
    await T().loadNewVersion(labels);
    eq('N11 een browser-handle: de nieuwe versie uit dezelfde handle, met die handle als doel', [
      shown, has(st, a), names(st), T().fileHandle === ref.handle, changedOnDiskShown(T()),
    ], [[true, true], false, ['Extern opgeslagen werk'], true, false]);
    } finally {
      win.__TAURI_INTERNALS__ = tauri;
    }
  }
} finally {
  ipc.dispose();
}

console.error = realError;
for (const diff of diffs) console.log(`XX ${diff}`);
console.log(`nieuwe-versie-laden: ${checks} controles, ${diffs.length} afwijkingen`);
if (diffs.length) process.exitCode = 1;
