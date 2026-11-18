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
        if (edge.clear.hold) {
          edge.clear.hold = false;
          edge.clear.entered.resolve();
          await edge.clear.release.promise;
        }
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
  onSavePendingChange: () => undefined,
});
const resetEdge = () => {
  edge.install = { entered: deferred(), release: deferred(), started: false, fails: true };
  edge.clear = { hold: false, entered: deferred(), release: deferred() };
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

ipc.dispose();
rmSync(dir, { recursive: true, force: true });
console.log(`Afsluiten vanaf de productie-ingang: ${passed} geslaagd, ${failed} mislukt.`);
process.exit(failed ? 1 : 0);
