// #804 stap 3, fixronde 2 (review van #987, ronde 2): afsluiten en de updater vanaf hun productie-ingang. De echte
// hooks `useAutoSave` (crashherstel) en `useAppCloseGuard`, de echte Tauri-JavaScript van `@tauri-apps/api/window`, de
// echte updater, store, IFC-opslag en de Tauri-herstelopslag op tijdelijke bestanden. Alleen React-effecten (direct
// gemount), de native IPC-rand (venster, updater, paden) en de knophandler van de baselinedialoog (de component als
// functie, zonder React) zijn nagebootst. Bron: de proeven van de reviewer (`lifecycle.ts`).
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import type * as Ts from 'typescript';
import { installBrowserStubs } from './ifcPariteitKern';
import { installNodeFileIpc } from './nodeFileIpc';

const ts = createRequire(import.meta.url)('typescript') as typeof Ts;
const turn = () => new Promise<void>((r) => { setImmediate(r); });
const until = async (done: () => boolean, rounds = 60) => { for (let i = 0; i < rounds && !done(); i++) await turn(); };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { resolve, promise };
};

const dir = mkdtempSync(join(tmpdir(), 'ops-app-quit-lifecycle-'));
const appDataDir = join(dir, 'data');
mkdirSync(appDataDir);
const projectFile = readFileSync('public/examples/03-kantoorgebouw-zuidas.ifc');
installBrowserStubs();
const ipc = installNodeFileIpc();
type Win = Record<string, unknown> & { __TAURI_INTERNALS__: Record<string, unknown> & { invoke: (...args: unknown[]) => Promise<unknown> } };
const win = window as unknown as Win;
win.parent = win;
win.addEventListener = () => undefined;
win.removeEventListener = () => undefined;

// De native rand: venster, gebeurtenissen, updater, paden en het opruimen van het herstel.
const callbacks = new Map<number, (event: unknown) => unknown>();
const events = new Map<string, number>();
let nextCallback = 0;
const edge = {
  install: { entered: deferred(), release: deferred(), started: false, fails: true },
  clear: { hold: false, entered: deferred(), release: deferred() },
  /** Het wissen van het herstelrecord van een vervanging (de laatste stap van Ctrl+S op een bestand met een model). */
  record: { hold: false, entered: deferred(), release: deferred() },
  /** Vlak vóór elke `place_file_exclusive`, met het doel. */
  place: null as ((to: string) => void) | null,
  destroyFails: false,
  destroys: [] as Array<{ dirty: boolean; recoveryFiles: number }>,
};
const nativeInvoke = win.__TAURI_INTERNALS__.invoke;
Object.assign(win.__TAURI_INTERNALS__, {
  metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main', windowLabel: 'main' } },
  transformCallback(callback: (event: unknown) => unknown) {
    callbacks.set(++nextCallback, callback);
    return nextCallback;
  },
  unregisterCallback: (id: number) => { callbacks.delete(id); },
  async invoke(command: string, args: Record<string, unknown>, options: unknown) {
    switch (command) {
      case 'plugin:event|listen':
        events.set(args.event as string, args.handler as number);
        return args.handler;
      case 'plugin:event|unlisten':
        if (events.get(args.event as string) === args.eventId) events.delete(args.event as string);
        return null;
      case 'plugin:window|destroy':
        edge.destroys.push({ dirty: dirtyDocuments().length > 0, recoveryFiles: recoveryFiles() });
        if (edge.destroyFails) throw new Error('Het venster weigert te sluiten');
        return null;
      case 'install_kind': return 'appimage';
      case 'plugin:updater|check': return { rid: 1, currentVersion: '0.1.0', version: '0.2.0', rawJson: {} };
      case 'plugin:updater|download': return 2;
      case 'plugin:updater|install':
        edge.install.started = true;
        edge.install.entered.resolve();
        await edge.install.release.promise;
        if (edge.install.fails) throw new Error('Installatie mislukt');
        return null;
      case 'plugin:process|restart': return null;
      case 'plugin:path|resolve_directory': return appDataDir;
      case 'plugin:path|join': return join(...(args.paths as string[]));
      case 'plugin:fs|read_dir': return readdirSync(args.path as string, { withFileTypes: true }).map((f) => ({
        name: f.name, isFile: f.isFile(), isDirectory: f.isDirectory(), isSymlink: f.isSymbolicLink(),
      }));
      case 'plugin:fs|read_text_file': return readFileSync(args.path as string);
      case 'plugin:fs|remove':
        if (/\.replace\.[0-9a-z]+\.json$/.test(String(args.path))) {
          if (edge.record.hold) {
            edge.record.hold = false;
            edge.record.entered.resolve();
            await edge.record.release.promise;
          }
          return nativeInvoke(command, args, options);
        }
        if (edge.clear.hold) {
          edge.clear.hold = false;
          edge.clear.entered.resolve();
          await edge.clear.release.promise;
        }
        return nativeInvoke(command, args, options);
      case 'place_file_exclusive':
        edge.place?.(String(args.to));
        return nativeInvoke(command, args, options);
      case 'plugin:dialog|save': throw new Error('De proef heeft al een schrijfdoel');
      default: return nativeInvoke(command, args, options);
    }
  },
});
win.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
/** Alt+F4: de native gebeurtenis bij de echte JavaScript-handler van `onCloseRequested`. */
const nativeClose = async () => {
  const id = events.get('tauri://close-requested');
  assert.ok(id !== undefined, 'de app luistert naar CloseRequested');
  await callbacks.get(id)!({ event: 'tauri://close-requested', id });
  await turn();
};

const modules: Record<string, unknown> = {
  'react/jsx-runtime': await import('react/jsx-runtime'),
  '@/state/appStore': await import('@/state/appStore'),
  '@/state/recoverySourceDocument': await import('@/state/recoverySourceDocument'),
  '@/utils/featureFlags': await import('@/utils/featureFlags'),
  '@/utils/platform': await import('@/utils/platform'),
  '@/utils/displayDate': await import('@/utils/displayDate'),
  '@/services/recovery/recoveryDelta': await import('@/services/recovery/recoveryDelta'),
  '@/services/recovery/recoverySnapshot': await import('@/services/recovery/recoverySnapshot'),
  '@/services/recovery/recoveryStore': await import('@/services/recovery/recoveryStore'),
  '@/services/recovery/recoverySnapshotSerializer': await import('@/services/recovery/recoverySnapshotSerializer'),
  '@/services/recovery/recoveryTickQueue': await import('@/services/recovery/recoveryTickQueue'),
  '@/services/recovery/recoveryFlush': await import('@/services/recovery/recoveryFlush'),
  '@/services/recovery/recoveryPendingSource': await import('@/services/recovery/recoveryPendingSource'),
  '@/services/actualAutosave/actualAutoSave': await import('@/services/actualAutosave/actualAutoSave'),
  '@/services/actualAutosave/fileAutoSave': await import('@/services/actualAutosave/fileAutoSave'),
  '@/services/actualAutosave/fileAutoSaveTimers': await import('@/services/actualAutosave/fileAutoSaveTimers'),
  '@/state/textEntryActivity': await import('@/state/textEntryActivity'),
  '@/state/recoveryManifestNotice': await import('@/state/recoveryManifestNotice'),
  '@/services/appQuit/appQuitController': await import('@/services/appQuit/appQuitController'),
  '@/services/appQuit/appQuitDependencies': await import('@/services/appQuit/appQuitDependencies'),
  '@/services/mcp/discoveryFiles': await import('@/services/mcp/discoveryFiles'),
  '@/components/common/Dialog': await import('@/components/common/Dialog'),
  '@/state/helpArticles': await import('@/state/helpArticles'),
  './ConfirmDialog': await import('@/components/dialogs/ConfirmDialog'),
  '@tauri-apps/api/window': await import('@tauri-apps/api/window'),
};
const { useAppStore } = await import('@/state/appStore');
const { flushRecoveryNow } = await import('@/services/recovery/recoveryFlush');
const { loadRecovery } = await import('@/services/recovery/recoveryStore');
const { downloadAndInstall } = await import('@/services/updater/updaterService');
const { createCloseDocumentDialogActions } = await import('@/components/layout/DocumentChrome/closeDocumentActions');
const state = () => useAppStore.getState();
const dirtyDocuments = () => state().getOpenDocumentPayloads().filter((d) => d.payload.isDirty).map((d) => d.id);
const recoveryFiles = () => readdirSync(appDataDir).filter((name) => name !== 'mcp').length;

/** Laadt een module met de echte afhankelijkheden uit `modules`; alleen `react` komt van de proef. */
function loadModule<T>(path: string, react: unknown): T {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(output, {
    exports, Error, Promise, setTimeout, clearTimeout, console,
    require: (name: string) => {
      if (name === 'react') return react;
      assert.ok(Object.prototype.hasOwnProperty.call(modules, name), `Onverwachte afhankelijkheid van ${path}: ${name}`);
      return modules[name];
    },
  }, { filename: path });
  return exports as T;
}

const enabled = { current: true };
/** De app monteren zoals `App.tsx`: de herstelronde van `useAutoSave` en `useAppCloseGuard`. */
const mount = async () => {
  // De listener van de vorige (gesloten) app telt niet: wacht op die van deze.
  events.delete('tauri://close-requested');
  const effects: Array<() => void | (() => void)> = [];
  const react = { useEffect: (effect: () => void | (() => void)) => { effects.push(effect); } };
  loadModule<{ useAutoSave: (e: typeof enabled) => void }>('src/hooks/useAutoSave.ts', react).useAutoSave(enabled);
  const recovery = effects[0]!;
  effects.length = 0;
  loadModule<{ useAppCloseGuard: (e: typeof enabled) => void }>('src/hooks/useAppCloseGuard.ts', react).useAppCloseGuard(enabled);
  const cleanups = [recovery(), effects[0]!()];
  await until(() => events.has('tauri://close-requested'));
  return () => { for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup(); };
};
/** De knop Opslaan van de baselinedialoog: de echte handler uit de component (als functie, zonder React). */
const baselineSaveButton = () => {
  const react = { useState: <V,>(value: V) => [value, () => undefined], useEffect: () => undefined, useMemo: <V,>(f: () => V) => f() };
  const component = loadModule<{ BaselineDialog: () => unknown }>('src/components/dialogs/BaselineDialog.tsx', react);
  const find = (node: unknown): { props: { onClick: () => void } } | null => {
    if (Array.isArray(node)) return node.map(find).find(Boolean) ?? null;
    const element = node as { type?: unknown; props?: { children?: unknown } } | null;
    if (!element?.props) return null;
    if (element.type === 'button' && element.props.children === 'save') return element as { props: { onClick: () => void } };
    return find(element.props.children);
  };
  return find(component.BaselineDialog());
};
modules['@/state/appStore'] = { ...(modules['@/state/appStore'] as object) };
const realAppStore = modules['@/state/appStore'] as { useAppStore: typeof useAppStore };
// De dialoog leest de store met een selector; zonder React: direct op de echte store.
const baselineStore = Object.assign((select: (s: ReturnType<typeof state>) => unknown) => select(state()), useAppStore);
const withBaselineStore = <T,>(action: () => T): T => {
  const before = realAppStore.useAppStore;
  realAppStore.useAppStore = baselineStore as unknown as typeof useAppStore;
  try { return action(); } finally { realAppStore.useAppStore = before; }
};
modules['react-i18next'] = { useTranslation: () => ({ t: (key: string) => key }) };
modules['@/components/icons'] = { Icon: () => null };

const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
let fileNumber = 0;
/** Eén document met een eigen bestand; de andere open documenten gaan dicht. */
const freshDocument = (dirty: boolean) => {
  const id = state().newDocument();
  for (const other of state().getOpenDocumentPayloads().map((d) => d.id)) if (other !== id) state().closeDocument(other);
  state().addTask({ name: 'Een bewerking vóór het afsluiten' });
  const target = join(dir, `project-${++fileNumber}.ifc`);
  writeFileSync(target, projectFile);
  useAppStore.setState((st) => { st.filePath = target; if (!dirty) st.isDirty = false; });
  return { id, target };
};
const closeQuestion = (id: string) => createCloseDocumentDialogActions({
  pendingId: id,
  getActiveDocumentId: () => state().activeDocumentId,
  switchDocument: state().switchDocument,
  closeDocument: state().closeDocumentAfterSaves,
  saveFile: () => state().saveFileForDocument(id),
  clearPending: () => state().setUI({ pendingCloseDocId: null }),
  restoreOpenerFocus: () => undefined,
  // Zoals `CloseDocumentDialog`: de lopende opslag van de sluitvraag staat in de store (de knoppen en Escape lezen haar).
  onSavePendingChange: (pending) => state().setUI({ closeQuestionSaving: pending }),
});
const resetEdge = () => {
  edge.install = { entered: deferred(), release: deferred(), started: false, fails: true };
  edge.clear = { hold: false, entered: deferred(), release: deferred() };
  edge.record = { hold: false, entered: deferred(), release: deferred() };
  edge.place = null;
  edge.destroyFails = false;
  edge.destroys.length = 0;
};

let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  console.log(`START ${name}`);
  resetEdge();
  enabled.current = true;
  // Na een geslaagde afsluiting (het venster is weg) blijft de vlag in de echte app staan; hier begint een nieuwe app.
  state().setUI({ appQuitPending: false });
  const unmount = await mount();
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.message : error).slice(0, 1600)}`); }
  finally {
    edge.install.release.resolve();
    edge.clear.release.resolve();
    edge.record.release.resolve();
    useAppStore.setState((st) => { st.ui.featureFlags = {}; });
    state().setUI({ showBaselineDialog: false, showUpdateDialog: false, pendingCloseDocId: null });
    await until(() => false, 20);
    unmount();
  }
}

await check('baseline opgeslagen tijdens het opruimen: geen venster dicht met een gewijzigd document, de gewone ronde begint opnieuw', async () => {
  const { id, target } = freshDocument(true);
  await flushRecoveryNow();
  assert.equal(await state().saveFileForDocument(id), true);
  await flushRecoveryNow();
  assert.deepEqual((await loadRecovery()).docs.map((d) => d.isDirty), [false], 'een schone herstelsnapshot');
  const saved = fileHash(target);
  state().setUI({ showBaselineDialog: true });
  edge.clear.hold = true;
  await nativeClose();
  await edge.clear.entered.promise;
  assert.deepEqual([state().ui.appClosing, state().ui.pendingCloseDocId, enabled.current], [true, null, false], 'de laatste fase');
  const button = withBaselineStore(baselineSaveButton);
  assert.ok(button, 'de knop Opslaan van de baselinedialoog');
  button.props.onClick();
  assert.equal(state().isDirty, true, 'de handler zet een baseline in het document');
  edge.clear.release.resolve();
  await until(() => edge.destroys.length > 0 || state().ui.pendingCloseDocId !== null, 400);
  assert.deepEqual(edge.destroys.filter((d) => d.dirty), [], 'het venster gaat nooit dicht met een gewijzigd document');
  assert.equal(state().ui.pendingCloseDocId, id, 'de gewone sluitvraag voor het gewijzigde document');
  assert.deepEqual([state().ui.appClosing, state().ui.appQuitPending, enabled.current, state().ui.showBaselineDialog],
    [false, true, true, true], 'poort, schil en herstel weer open; de dialoog staat er nog');
  // Het hervatte herstel legt de baseline vast (knownbug 1819: na het wissen weer een volledige ronde).
  await flushRecoveryNow();
  assert.deepEqual((await loadRecovery()).docs.map((d) => d.isDirty), [true]);
  // Opslaan in de sluitvraag schrijft het bestand; daarna gaat de app dicht.
  await closeQuestion(id).save();
  await until(() => edge.destroys.length > 0, 400);
  assert.notEqual(fileHash(target), saved, 'de baseline staat in het bestand');
  assert.deepEqual(edge.destroys, [{ dirty: false, recoveryFiles: 0 }]);
});

await check('Alt+F4 tijdens de installatie van een update: geen sluitvraag met een opslagkeuze die niets schrijft', async () => {
  const { id, target } = freshDocument(true);
  const before = fileHash(target);
  state().setUI({ showUpdateDialog: true });
  const statuses: string[] = [];
  const updating = downloadAndInstall((status) => { statuses.push(status.kind); });
  await edge.install.entered.promise;
  await nativeClose();
  assert.deepEqual([state().ui.pendingCloseDocId, state().ui.appQuitPending, edge.destroys.length], [null, false, 0],
    'de updater heeft de afsluitfase: geen sluitvraag, geen afsluitronde');
  assert.deepEqual([state().isDirty, fileHash(target) === before], [true, true]);
  edge.install.release.resolve();
  await updating;
  assert.equal(statuses.at(-1), 'error');
  // Na de installatiefout: opslaan en sluiten werken weer.
  assert.equal(await state().saveFileForDocument(id), true);
  assert.notEqual(fileHash(target), before);
  await nativeClose();
  await until(() => edge.destroys.length > 0, 400);
  assert.deepEqual(edge.destroys, [{ dirty: false, recoveryFiles: 0 }]);
});

await check('de sluitvraag staat open als de updater wil installeren: de updater wacht, Opslaan schrijft', async () => {
  const { id, target } = freshDocument(true);
  const before = fileHash(target);
  await nativeClose();
  assert.equal(state().ui.pendingCloseDocId, id, 'de sluitvraag');
  const statuses: string[] = [];
  const updating = downloadAndInstall((status) => { statuses.push(status.kind); });
  await until(() => edge.install.started, 40);
  assert.deepEqual([edge.install.started, statuses.includes('installing')], [false, false], 'de updater wacht op de sluitvraag');
  await closeQuestion(id).save();
  await until(() => edge.destroys.length > 0, 400);
  assert.notEqual(fileHash(target), before, 'Opslaan in de sluitvraag schreef het bestand');
  assert.deepEqual(edge.destroys, [{ dirty: false, recoveryFiles: 0 }]);
  // In de echte app is het proces nu weg; hier gaat de updater daarna verder en faalt de installatie.
  await edge.install.entered.promise;
  edge.install.release.resolve();
  await updating;
});

await check('de sluitvraag geannuleerd terwijl de updater wacht: de updater installeert daarna', async () => {
  const { id } = freshDocument(true);
  await nativeClose();
  const statuses: string[] = [];
  const updating = downloadAndInstall((status) => { statuses.push(status.kind); });
  await until(() => edge.install.started, 40);
  assert.equal(edge.install.started, false);
  closeQuestion(id).cancel();
  await edge.install.entered.promise;
  assert.deepEqual([state().ui.appQuitPending, state().isDirty], [false, true]);
  edge.install.release.resolve();
  await updating;
  assert.equal(statuses.at(-1), 'error');
  assert.equal(await state().saveFileForDocument(id), true, 'na de installatiefout werkt opslaan');
});

await check('na een geweigerde destroy werkt het hervatte crashherstel weer (knownbug 1819)', async () => {
  const one = freshDocument(true);
  const two = state().newDocument();
  state().addTask({ name: 'Tweede planning' });
  const second = join(dir, `project-${++fileNumber}.ifc`);
  writeFileSync(second, projectFile);
  useAppStore.setState((st) => { st.filePath = second; });
  await flushRecoveryNow();
  assert.equal(await state().saveFileForDocument(two), true);
  state().switchDocument(one.id);
  assert.equal(await state().saveFileForDocument(one.id), true);
  await flushRecoveryNow();
  assert.deepEqual((await loadRecovery()).docs.map((d) => d.isDirty), [false, false]);
  edge.destroyFails = true;
  const realError = console.error;
  console.error = () => undefined;
  try {
    await nativeClose();
    await until(() => edge.destroys.length > 0 && !state().ui.appQuitPending, 400);
  } finally { console.error = realError; }
  assert.deepEqual([edge.destroys.length, enabled.current, state().ui.appClosing, state().ui.appQuitPending], [1, true, false, false]);
  assert.equal((await loadRecovery()).docs.length, 0, 'het herstel was gewist');
  state().switchDocument(two);
  state().addTask({ name: 'Bewerking na het geweigerde sluiten' });
  await flushRecoveryNow();
  const docs = (await loadRecovery()).docs;
  assert.deepEqual(docs.map((d) => d.id).sort(), [one.id, two].sort(), 'een volledige herstelronde');
  assert.ok(docs.find((d) => d.id === two)!.ifc.includes('Bewerking na het geweigerde sluiten'));
});

// #804, knownbug 1131 stap 5b: Ctrl+S en *Opslaan* in de sluitvraag op het eigen bestand met een gebouwmodel.
const modelFile = new Uint8Array(readFileSync('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
const recordFiles = () => readdirSync(appDataDir).filter((name) => /\.replace\.[0-9a-z]+\.json$/.test(name));
const errorKeys = () => state().ui.notifications.filter((n) => n.severity === 'error').map((n) => n.messageKey);
const renameTask = (name: string) => {
  const task = state().tasks.find((t) => !t.childIds.length && !t.isMilestone)!;
  state().updateTask(task.id, { name });
};
/** Eén document met een gebouwmodel uit een eigen bestand (flag aan), met een bewerking; de rest gaat dicht. */
const foreignDocument = async () => {
  useAppStore.setState((st) => { st.ui.featureFlags = { ifcForeignContent: true }; });
  const empty = state().newDocument();
  for (const other of state().getOpenDocumentPayloads().map((d) => d.id)) if (other !== empty) state().closeDocument(other);
  const target = join(dir, `model-${++fileNumber}.ifc`);
  writeFileSync(target, modelFile);
  await state().openOpenedFile({ name: 'model.ifc', content: '', bytes: modelFile, ref: { kind: 'path', path: target } });
  assert.ok(state().ifcSource?.foreign, 'geopend met een gebouwmodel');
  assert.equal(state().filePath, target);
  renameTask('Een bewerking in het model');
  state().setUI({ pendingCloseDocId: null });
  useAppStore.setState((st) => { st.ui.notifications = []; });
  await flushRecoveryNow();
  return { id: state().activeDocumentId, target };
};

await check('gebouwmodel: afsluiten wacht op een lopende vervanging tot ook het record weg is; Ctrl+S in de laatste fase weigert stil; Opslaan in de sluitvraag vervangt en sluit', async () => {
  const { id, target } = await foreignDocument();
  const before = fileHash(target);
  edge.record.hold = true;
  const saving = state().saveFileForDocument(id);
  await Promise.race([edge.record.entered.promise, saving.then((ok) => {
    throw new Error(`de opslag eindigde (${ok}) zonder een herstelrecord te wissen`);
  })]);
  assert.notEqual(fileHash(target), before, 'het bestand is al vervangen');
  assert.equal(recordFiles().length, 1, 'alleen het wissen van het record loopt nog');
  await nativeClose();
  await until(() => false, 40);
  assert.deepEqual([edge.destroys.length, state().ui.pendingCloseDocId, state().ui.appQuitPending], [0, null, true],
    'het afsluiten wacht, zonder sluitvraag');
  edge.clear.hold = true;
  edge.record.release.resolve();
  assert.equal(await saving, true, 'de vervanging is geslaagd');
  assert.deepEqual(recordFiles(), [], 'het record is weg');
  await edge.clear.entered.promise;
  assert.equal(state().ui.appClosing, true, 'de laatste fase');
  // Een bewerking en Ctrl+S in de laatste fase: geweigerd, zonder melding van een mislukte opslag.
  const saved = fileHash(target);
  renameTask('Bewerking in de laatste fase');
  const from = ipc.calls.length;
  assert.equal(await state().saveFileForDocument(id), false);
  assert.deepEqual(errorKeys(), [], 'geen melding');
  assert.deepEqual(ipc.calls.slice(from).filter((call) => call.wrote || call.command === 'place_file_exclusive'), [], 'niets geschreven');
  assert.deepEqual([fileHash(target), recordFiles().length], [saved, 0]);
  edge.clear.release.resolve();
  // Het vangnet: met een gewijzigd document gaat het venster niet dicht; de gewone sluitvraag volgt.
  await until(() => state().ui.pendingCloseDocId !== null, 400);
  assert.equal(state().ui.pendingCloseDocId, id);
  assert.deepEqual(edge.destroys.filter((d) => d.dirty), []);
  await closeQuestion(id).save();
  await until(() => edge.destroys.length > 0, 400);
  assert.ok(readFileSync(target).toString('latin1').includes('Bewerking in de laatste fase'), 'Opslaan in de sluitvraag vervangt het bestand');
  assert.deepEqual(errorKeys(), []);
  assert.deepEqual(edge.destroys, [{ dirty: false, recoveryFiles: 0 }], 'dicht, zonder herstelbestanden of record');
});

for (const outcome of ['een ander programma wijzigde het bestand', 'bewerken tijdens de opslag'] as const) {
  await check(`gebouwmodel, Opslaan in de sluitvraag van de app: ${outcome}; de app sluit niet`, async () => {
    const { id, target } = await foreignDocument();
    if (outcome === 'een ander programma wijzigde het bestand') writeFileSync(target, new Uint8Array([...modelFile, 10]));
    else edge.place = (to) => { if (to === target) renameTask('Tijdens het opslaan'); };
    const before = fileHash(target);
    await nativeClose();
    assert.equal(state().ui.pendingCloseDocId, id, 'de sluitvraag');
    await closeQuestion(id).save();
    await until(() => !state().ui.appQuitPending, 400);
    assert.deepEqual([edge.destroys.length, state().ui.appQuitPending, state().isDirty], [0, false, true],
      'het afsluiten is afgebroken; het document blijft gewijzigd');
    assert.ok(state().getOpenDocumentPayloads().some((d) => d.id === id));
    if (outcome === 'een ander programma wijzigde het bestand') {
      assert.equal(fileHash(target), before, 'niets vervangen');
      assert.deepEqual(errorKeys(), ['notifications.ifcForeignTargetChanged']);
    } else {
      assert.notEqual(fileHash(target), before, 'de momentopname staat in het bestand');
      assert.equal(readFileSync(target).toString('latin1').includes('Tijdens het opslaan'), false);
      assert.deepEqual(errorKeys(), []);
    }
    assert.deepEqual(recordFiles(), []);
  });
}

// Fixronde 1 van #1008 (review Sol, bevinding 1): *Opslaan* in de sluitvraag sluit alleen een document dat vlak vóór
// het sluiten nog schoon is, en Escape verbergt de sluitvraag niet terwijl haar opslag loopt. Proef van de reviewer.
await check('gebouwmodel: Escape tijdens de laatste opslagstap verbergt de sluitvraag niet, en een latere bewerking houdt het tabblad open', async () => {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: {} } });
  const { SHORTCUTS, canRunShortcut, matchesCombo } = await import('@/hooks/keyboard/shortcutRegistry');
  const { id, target } = await foreignDocument();
  state().requestCloseDocument(id);
  assert.equal(state().ui.pendingCloseDocId, id, 'de echte tabbladactie opent de sluitvraag');
  edge.record.hold = true;
  const saving = closeQuestion(id).save();
  await Promise.race([edge.record.entered.promise, saving.then(() => {
    throw new Error('de opslag eindigde zonder een herstelrecord te wissen');
  })]);
  assert.equal(state().isDirty, false, 'de broncommit is al geweest');
  assert.equal(state().ui.pendingCloseDocId, id, 'de sluitvraag staat nog open tijdens het opruimen');
  // Escape zoals `useKeyboardShortcuts`: de eerste sneltoets die past en mag lopen.
  const escapeEvent = { key: 'Escape', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false } as KeyboardEvent;
  SHORTCUTS.find(entry => matchesCombo(escapeEvent, entry.combo) && canRunShortcut(entry, false))?.run(state());
  assert.equal(state().ui.pendingCloseDocId, id, 'Escape verbergt de sluitvraag niet terwijl haar opslag loopt');
  // Een bewerking langs een andere weg (de store-actie) tijdens de laatste stap: het tabblad mag dan niet dicht.
  renameTask('Nieuwe bewerking tijdens de laatste stap');
  assert.equal(state().isDirty, true);
  edge.record.release.resolve();
  await saving;
  const current = state().getOpenDocumentPayloads().find(d => d.id === id);
  assert.ok(current, 'het tabblad blijft open');
  assert.equal(current.payload.isDirty, true, 'met de nog niet opgeslagen bewerking');
  assert.equal(readFileSync(target).toString('latin1').includes('Nieuwe bewerking tijdens de laatste stap'), false);
  assert.equal(state().ui.pendingCloseDocId, null, 'de sluitvraag is weg, zoals na een opslag die het document gewijzigd liet');
});

await check('gebouwmodel: de updater wacht op het wissen van het herstelrecord en geeft na een installatiefout de schrijfpoort terug', async () => {
  const { claimShutdown } = await import('@/services/appQuit/shutdownPhase');
  const { id, target } = await foreignDocument();
  const before = fileHash(target);
  edge.record.hold = true;
  const storing = state().saveFile();
  await Promise.race([edge.record.entered.promise, storing.then(() => { throw new Error('geen herstelrecord gewist'); })]);
  assert.notEqual(fileHash(target), before);
  assert.equal(recordFiles().length, 1);
  const statuses: string[] = [];
  const updating = downloadAndInstall(status => { statuses.push(status.kind); });
  const updaterOwnsPhase = () => {
    const release = claimShutdown('quit');
    if (!release) return true;
    release();
    return false;
  };
  await until(updaterOwnsPhase, 400);
  assert.ok(updaterOwnsPhase(), 'de updater bezit de afsluitfase');
  assert.equal(edge.install.started, false);
  const from = ipc.calls.length;
  assert.equal(await state().saveFileForDocument(id), false, 'de schrijfpoort weigert al');
  assert.equal(ipc.calls.slice(from).filter(call => call.wrote || call.command === 'place_file_exclusive').length, 0);
  edge.record.release.resolve();
  await storing;
  await edge.install.entered.promise;
  assert.deepEqual(recordFiles(), []);
  edge.install.release.resolve();
  await updating;
  assert.equal(statuses.at(-1), 'error');
  renameTask('Bewerking na updatefout');
  assert.equal(await state().saveFileForDocument(id), true);
  assert.ok(readFileSync(target).toString('latin1').includes('Bewerking na updatefout'));
});

// Fixronde 2 van #1008 (review Sol ronde 2, bevinding 1): open veldinvoer die tijdens *Opslaan* in de sluitvraag getypt
// is, rondt de sluitactie eerst af; daarna kijkt dezelfde actie of het document schoon is (`closeDocument` met
// `onlyIfClean`). De invoer blijft dus in het open tabblad, en het venster gaat niet dicht. Proeven van de reviewer.
modules['@/state/pendingTextEdits'] = await import('@/state/pendingTextEdits');
modules['@/utils/decimalInput'] = await import('@/utils/decimalInput');
const { readIfcBytes } = await import('@/services/ifc/foreign/ifcBytesRoute');
async function assignmentOnDisk(target: string, resourceName: string) {
  const parsed = await readIfcBytes(new Uint8Array(readFileSync(target)));
  const resource = parsed.resources.find(r => r.name === resourceName);
  return parsed.assignments.find(a => a.resourceId === resource?.id)?.unitsPerDay;
}

// UnitsInput is de echte component. Alleen React-hooks en de bezorging van het change-event zijn nagebootst.
const draftInput = (assignmentId: string, seen: Array<{ value: number; dirty: boolean }>) => {
  const cleanups: Array<() => void> = [];
  const react = {
    useEffect: (effect: () => void | (() => void)) => { const off = effect(); if (off) cleanups.push(off); },
    useRef: <V,>(value: V) => ({ current: value }),
    useState: <V,>(value: V) => [value, () => undefined],
  };
  type Rendered = { type: (props: unknown) => { props: { onChange: (event: { target: { value: string } }) => void } }; props: unknown };
  const { UnitsInput } = loadModule<{ UnitsInput: (props: unknown) => Rendered }>('src/components/common/UnitsInput.tsx', react);
  const component = UnitsInput({
    value: 1, locale: 'nl', commitOnBlur: true,
    onCommit: (unitsPerDay: number) => {
      state().updateAssignment(assignmentId, { unitsPerDay });
      seen.push({ value: state().assignments.find(a => a.id === assignmentId)!.unitsPerDay, dirty: state().isDirty });
    },
  });
  const field = component.type(component.props);
  return { type: (value: string) => field.props.onChange({ target: { value } }), dispose: () => { for (const off of cleanups.reverse()) off(); } };
};

for (const route of ['tabblad', 'app'] as const) {
  await check(`${route}: Opslaan in de sluitvraag bewaart een open, pas na de broncommit getypte inzet`, async () => {
    const { id, target } = await foreignDocument();
    const resourceName = 'Ploeg voor proef open veldinvoer';
    const task = state().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
    const resource = state().addResource({ name: resourceName, type: 'LABOR', description: '', maxUnits: 4 });
    state().assignResource(task.id, resource, 1);
    const assignment = state().assignments.find(a => a.resourceId === resource)!;
    assert.ok(assignment);
    if (route === 'app') await nativeClose();
    else state().requestCloseDocument(id);
    assert.equal(state().ui.pendingCloseDocId, id);
    const seen: Array<{ value: number; dirty: boolean }> = [];
    const field = draftInput(assignment.id, seen);
    try {
      edge.record.hold = true;
      const saving = closeQuestion(id).save();
      await Promise.race([edge.record.entered.promise, saving.then(() => { throw new Error('geen broncommit bereikt'); })]);
      assert.equal(state().isDirty, false);
      assert.equal(await assignmentOnDisk(target, resourceName), 1);
      field.type('3');
      assert.equal(state().isDirty, false, 'het veld wacht op blur/afronden');
      assert.deepEqual(seen, []);
      edge.record.release.resolve();
      await saving;
      if (route === 'app') await until(() => edge.destroys.length > 0 || !state().ui.appQuitPending, 400);
      const current = state().getOpenDocumentPayloads().find(d => d.id === id);
      const observed = {
        commits: seen, unitsOnDisk: await assignmentOnDisk(target, resourceName), tabOpen: !!current,
        documentDirty: current?.payload.isDirty ?? null, windowDestroyed: edge.destroys.length,
      };
      console.log('VELDINVOER', route, JSON.stringify(observed));
      assert.deepEqual(observed, {
        commits: [{ value: 3, dirty: true }], unitsOnDisk: 1, tabOpen: true, documentDirty: true, windowDestroyed: 0,
      });
    } finally {
      field.dispose();
    }
  });
}

for (const outcome of ['annuleren', 'fout'] as const) {
  await check(`gewoon document: na ${outcome} van de bestandsdialoog werkt een nieuwe sluitvraag en Escape weer`, async () => {
    const { id } = freshDocument(true);
    useAppStore.setState(st => { st.filePath = null; });
    const originalInvoke = win.__TAURI_INTERNALS__.invoke;
    win.__TAURI_INTERNALS__.invoke = async (cmd, ...args) => {
      if (cmd !== 'plugin:dialog|save') return originalInvoke(cmd, ...args);
      if (outcome === 'fout') throw new Error('Reviewer: de bestandskiezer faalt');
      return null;
    };
    try {
      state().requestCloseDocument(id);
      assert.equal(state().ui.pendingCloseDocId, id);
      await closeQuestion(id).save();
      assert.deepEqual([state().isDirty, state().ui.pendingCloseDocId, state().ui.closeQuestionSaving], [true, null, false]);
      state().requestCloseDocument(id);
      assert.equal(state().ui.pendingCloseDocId, id);
      const { SHORTCUTS, canRunShortcut } = await import('@/hooks/keyboard/shortcutRegistry');
      const escape = SHORTCUTS.find(shortcut => shortcut.id === 'edit.deselect')!;
      assert.equal(canRunShortcut(escape, false), true);
      escape.run(state());
      assert.deepEqual([state().isDirty, state().ui.pendingCloseDocId, state().ui.closeQuestionSaving], [true, null, false]);
    } finally {
      win.__TAURI_INTERNALS__.invoke = originalInvoke;
    }
  });
}

// *Niet opslaan* gooit de wijzigingen weg, ook open veldinvoer: die houdt het sluiten niet tegen (tabblad en venster).
for (const route of ['tabblad', 'app'] as const) {
  await check(`${route}: Niet opslaan in de sluitvraag sluit ook met open veldinvoer`, async () => {
    const { id } = freshDocument(true);
    const task = state().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
    const resource = state().addResource({ name: 'Ploeg voor Niet opslaan', type: 'LABOR', description: '', maxUnits: 4 });
    state().assignResource(task.id, resource, 1);
    const assignment = state().assignments.find(a => a.resourceId === resource)!;
    if (route === 'app') await nativeClose();
    else state().requestCloseDocument(id);
    assert.equal(state().ui.pendingCloseDocId, id);
    const seen: Array<{ value: number; dirty: boolean }> = [];
    const field = draftInput(assignment.id, seen);
    try {
      field.type('3');
      await closeQuestion(id).discard();
      if (route === 'app') await until(() => edge.destroys.length > 0 || !state().ui.appQuitPending, 400);
      assert.deepEqual(seen, [{ value: 3, dirty: true }], 'de open invoer is afgerond en daarna weggegooid');
      assert.equal(state().getOpenDocumentPayloads().some(d => d.id === id), false, 'het tabblad is dicht');
      assert.equal(edge.destroys.length, route === 'app' ? 1 : 0, 'het venster gaat dicht na Niet opslaan');
    } finally {
      field.dispose();
    }
  });
}


ipc.dispose();
rmSync(dir, { recursive: true, force: true });
console.log(`Afsluiten vanaf de productie-ingang: ${passed} geslaagd, ${failed} mislukt.`);
process.exit(failed ? 1 : 0);
