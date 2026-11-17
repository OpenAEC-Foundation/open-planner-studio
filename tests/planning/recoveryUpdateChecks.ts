// Knownbug 329: de echte herstelhook moet opslagfouten tot aan de updater doorgeven.
// Effectregistratie, klok, IndexedDB en desktopplugins worden hier nagebootst;
// store, IFC-serialisatie, deltabepaling, schrijfketen en foutmeldingen zijn productiecode.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import type * as Ts from 'typescript';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { clearRecovery, loadRecovery, recoveryStorageUnavailable } from '@/services/recovery/recoveryStore';
import { createRecoverySnapshotSerializer } from '@/services/recovery/recoverySnapshotSerializer';
import { createRecoveryTickQueue } from '@/services/recovery/recoveryTickQueue';
import { registerRecoveryFlush, closeWritesAndFlushRecovery } from '@/services/recovery/recoveryFlush';
import { isProjectFileWriteBusy, runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { hasPendingIfcSource } from '@/services/recovery/recoveryPendingSource';
import { RecoveryManifestError } from '@/services/recovery/recoveryManifest';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { UpdateStatus } from '@/services/updater/updaterService';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';

const ts = createRequire(import.meta.url)('typescript') as typeof Ts;

function loadModule<T>(path: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(output, {
    exports, Error, Promise,
    require: (name: string) => {
      assert.ok(Object.prototype.hasOwnProperty.call(dependencies, name), `Onverwachte afhankelijkheid van ${path}: ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename: path });
  return exports as T;
}

const turn = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

export async function checkRecoveryUpdateFlush(failWrites: (error?: Error) => void): Promise<void> {
  await clearRecovery();
  const ctx = createAppStoreContext();
  ctx.store.getState().newProject();
  const taskId = ctx.store.getState().addTask({ name: 'Nog niet veilig opgeslagen' });
  const effects: Array<() => void | (() => void)> = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const loggedErrors: unknown[][] = [];
  let releaseSerialization: (() => void) | undefined;
  let holdSerialization = false;
  let serializationError: Error | undefined;
  const hook = loadModule<{ useAutoSave: (enabled: { current: boolean }) => void }>('src/hooks/useAutoSave.ts', {
    react: { useEffect: (effect: () => void | (() => void)) => effects.push(effect) },
    '@/state/appStore': { useAppStore: ctx.store },
    '@/utils/platform': {},
    '@/services/ifc/ifcWriter': {},
    '@/services/ifc/ifcSchemaQuestion': {},
    '@/state/ifcSaveInput': {},
    '@/services/recovery/recoveryDelta': { RecoveryDeltaTracker },
    '@/services/recovery/recoverySnapshot': { runRecoveryTick },
    '@/services/recovery/recoveryStore': { recoveryStorageUnavailable },
    '@/services/recovery/recoverySnapshotSerializer': { createRecoverySnapshotSerializer: () => {
      const serializer = createRecoverySnapshotSerializer(() => null);
      return { dispose: () => serializer.dispose(), serialize: async (...args: Parameters<typeof serializer.serialize>) => {
        if (holdSerialization) await new Promise<void>(resolve => { releaseSerialization = resolve; });
        if (serializationError) throw serializationError;
        return serializer.serialize(...args);
      } };
    } },
    '@/services/recovery/recoveryTickQueue': { createRecoveryTickQueue },
    '@/services/recovery/recoveryFlush': { registerRecoveryFlush },
    // Knownbug 1131 stap 1: een lopende vervanging vraagt een ronde, ook in een schone sessie.
    '@/services/recovery/recoveryPendingSource': { hasPendingIfcSource },
    '@/services/fileAccess': {},
    '@/services/actualAutosave/actualAutoSave': {},
    // #804 fixronde 2: de controller van de werkelijke AutoSave staat in een eigen module; dat effect monteert hier niet.
    '@/services/actualAutosave/fileAutoSave': {},
    '@/services/fileAccess/writeCoordinator': {},
    '@/state/recoveryManifestNotice': { notifyRecoveryError },
    // #804 1c: dezelfde momentopname en flagpoort als de echte hook.
    '@/state/recoverySourceDocument': { recoverySourceDocument },
    '@/utils/featureFlags': { ifcForeignContentEnabled },
  }, {
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
    console: { error: (...args: unknown[]) => loggedErrors.push(args) },
  });
  hook.useAutoSave({ current: true });
  // Alleen het herstel-effect monteren: werkelijke AutoSave en beforeunload zijn andere routes.
  const cleanup = effects[0]!();
  assert.equal(typeof cleanup, 'function');
  const calls: string[] = [];
  const statuses: UpdateStatus[] = [];
  const updater = loadModule<{ downloadAndInstall: (onStatus: (status: UpdateStatus) => void) => Promise<void> }>(
    'src/services/updater/updaterService.ts', {
      '@/utils/platform': { isTauri: () => true },
      '@/services/githubRepo': { GITHUB_REPO: 'geen-netwerk' },
      '@/services/recovery/recoveryFlush': { closeWritesAndFlushRecovery },
      '@tauri-apps/api/core': { invoke: async () => 'native' },
      '@tauri-apps/plugin-updater': { check: async () => ({
        download: async () => { calls.push('download'); },
        install: async () => { calls.push('install'); },
      }) },
      '@tauri-apps/plugin-process': { relaunch: async () => { calls.push('relaunch'); } },
    });
  const install = () => updater.downloadAndInstall(status => { statuses.push(structuredClone(status)); });
  const runTimer = () => {
    const entry = timers.entries().next().value as [number, () => void] | undefined;
    assert.ok(entry, 'de documentbewerking heeft een periodieke herstelronde gepland');
    timers.delete(entry[0]);
    entry[1]();
  };
  try {
    const diskError = new Error('Herstelopslag is vol');
    failWrites(diskError);
    await install();
    assert.deepEqual(calls, ['download'], '329: een mislukte herstelschrijf mag niet installeren of herstarten');
    assert.deepEqual(statuses, [{ kind: 'error', message: diskError.message }]);
    assert.equal(ctx.store.getState().ui.notifications.at(-1)?.messageKey, 'notifications.autoSaveFailed');
    assert.equal(loggedErrors[0]?.[1], diskError);
    failWrites();
    assert.equal((await loadRecovery()).docs.length, 0, 'een gefaalde ronde heeft geen veilige snapshot');

    // Opnieuw proberen schrijft de laatste documentstand en laat pas daarna installatie toe.
    ctx.store.getState().updateTask(taskId, { name: 'Veilig na opnieuw proberen' });
    await install();
    assert.deepEqual(calls, ['download', 'download', 'install', 'relaunch']);
    assert.deepEqual(statuses.slice(1), [{ kind: 'installing' }, { kind: 'restarting' }]);
    assert.ok((await loadRecovery()).docs[0]!.ifc.includes('Veilig na opnieuw proberen'));

    // Een timerfout blijft afgehandeld en de volgende ronde probeert opnieuw. Een onbehandelde
    // afwijzing maakt Node rood (de beurt hieronder geeft het unhandledRejection-event tijd).
    ctx.store.getState().updateTask(taskId, { name: 'Bewerking tijdens periodiek herstel' });
    failWrites(diskError);
    runTimer();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(ctx.store.getState().ui.notifications.filter(n => n.dedupeKey === 'autosave').length, 1);
    failWrites();
    runTimer();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok((await loadRecovery()).docs[0]!.ifc.includes('Bewerking tijdens periodiek herstel'));

    // De speciale manifestmelding mag de flush evenmin in een geslaagde opslag veranderen.
    const manifestError = new RecoveryManifestError('unsupported-version');
    ctx.store.getState().updateTask(taskId, { name: 'Manifest weigert deze bewerking' });
    failWrites(manifestError);
    calls.length = 0;
    statuses.length = 0;
    await install();
    assert.deepEqual(calls, ['download'], 'ook een reeds gemelde manifestfout blokkeert installatie');
    assert.deepEqual(statuses, [{ kind: 'error', message: manifestError.message }]);
    assert.equal(ctx.store.getState().ui.notifications.at(-1)?.messageKey, 'notifications.recoveryManifestBlocked');
    await install();
    assert.deepEqual(calls, ['download', 'download']);
    assert.equal(ctx.store.getState().ui.notifications.filter(n => n.dedupeKey === 'recovery-manifest').length, 1,
      'ook een al afgehandelde manifestmelding blijft installatie blokkeren, zonder extra melding');

    // Een serialisatiefout vóór de opslag moet dezelfde installatieblokkade geven.
    failWrites();
    serializationError = new Error('IFC-serialisatie mislukt');
    ctx.store.getState().updateTask(taskId, { name: 'Serialisatie weigert deze bewerking' });
    calls.length = 0;
    statuses.length = 0;
    await install();
    assert.deepEqual(calls, ['download']);
    assert.deepEqual(statuses, [{ kind: 'error', message: serializationError.message }]);
    serializationError = undefined;

    // Update aangevraagd tijdens een timeropslag: dezelfde mislukking bereikt beide aanroepers.
    failWrites(diskError);
    holdSerialization = true;
    ctx.store.getState().updateTask(taskId, { name: 'Timer is nog bezig' });
    runTimer();
    await turn();
    assert.ok(releaseSerialization);
    ctx.store.getState().updateTask(taskId, { name: 'Nieuwste bewerking tijdens update' });
    calls.length = 0;
    statuses.length = 0;
    const updating = install();
    await turn();
    assert.deepEqual(calls, ['download']);
    assert.deepEqual(statuses, [], 'de updater wacht op de lopende herstelronde');
    holdSerialization = false;
    releaseSerialization();
    await updating;
    assert.deepEqual(calls, ['download'], 'een fout in de gedeelde ronde blokkeert installatie');
    assert.deepEqual(statuses, [{ kind: 'error', message: diskError.message }]);
    failWrites();
    await install();
    assert.ok((await loadRecovery()).docs[0]!.ifc.includes('Nieuwste bewerking tijdens update'));
    assert.deepEqual(calls, ['download', 'download', 'install', 'relaunch']);

    // #804 stap 3: een lopende projectopslag (de schrijfrij) houdt de herstart tegen tot hij klaar is; pas daarna de
    // herstelronde, dus met wat de opslag vastlegde.
    let releaseWrite: () => void = () => undefined;
    const write = runProjectFileWrite(async () => {
      await new Promise<void>(resolve => { releaseWrite = resolve; });
      ctx.store.getState().updateTask(taskId, { name: 'Vastgelegd door de opslag' });
    }, () => undefined);
    calls.length = 0;
    statuses.length = 0;
    const waiting = install();
    await turn();
    assert.deepEqual(calls, ['download']);
    assert.deepEqual(statuses, [], 'de updater wacht op de lopende opslag');
    releaseWrite();
    await write;
    await waiting;
    assert.deepEqual(calls, ['download', 'install', 'relaunch']);
    assert.ok((await loadRecovery()).docs[0]!.ifc.includes('Vastgelegd door de opslag'), 'de herstelronde liep na de opslag');
  } finally {
    failWrites();
    if (typeof cleanup === 'function') cleanup();
  }
  console.log('OK  herstel vóór update: opslagfouten blokkeren installatie, timer en herpoging blijven bruikbaar, een lopende opslag wordt afgewacht');
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};

/**
 * #804 stap 3, fixronde 1 (BLOKKEERT; de proef van de review): de laatste fase van de updater. Een lege rij alleen sloot
 * nieuwe opslag niet uit: tijdens de herstelronde, `install()` en `relaunch()` kon nog een ronde van Automatisch opslaan
 * of een Ctrl+S beginnen. Echte store, echte opslagroute en echte bestands-AutoSave op een echt bestand; alleen de
 * Tauri-plugins zijn nagebootst. Mislukt de installatie, dan werkt opslaan daarna weer. Draait als laatste: de
 * bestandsbrug vervangt `window`.
 */
export async function checkUpdaterFinalPhase(): Promise<void> {
  await loadStore();
  const ipc = installNodeFileIpc();
  const dir = mkdtempSync(join(tmpdir(), 'ops-update-phase-'));
  const target = join(dir, 'update.ifc');
  writeFileSync(target, readFileSync('public/examples/03-kantoorgebouw-zuidas.ifc'));
  const fileHash = () => createHash('sha256').update(readFileSync(target)).digest('hex');
  const mutating = (from: number) => ipc.calls.slice(from).map(c => c.command)
    .filter(c => /write|rename|place|remove|truncate|copy/.test(c));
  const { store } = createAppStoreContext();
  const s = () => store.getState();
  s().newProject();
  s().addTask({ name: 'Nog niet weggeschreven bij de update' });
  store.setState(st => { st.filePath = target; st.autoSaveToFile = true; });
  const autosave = createFileAutoSaveController({ getState: s, enabled: () => true });
  let phase = { calls: 0, hash: '' };
  let round = { flushEntered: deferred(), allowFlush: deferred() };
  const seen: Array<{ step: string; busy: boolean; dirty: boolean; written: string[]; same: boolean }> = [];
  const observe = (step: string) => {
    seen.push({ step, busy: isProjectFileWriteBusy(), dirty: s().isDirty, written: mutating(phase.calls), same: fileHash() === phase.hash });
  };
  let installError: Error | undefined;
  const unregister = registerRecoveryFlush(async () => {
    phase = { calls: ipc.calls.length, hash: fileHash() };
    round.flushEntered.resolve();
    await round.allowFlush.promise;
  });
  const statuses: UpdateStatus[] = [];
  const updater = loadModule<{ downloadAndInstall: (onStatus: (status: UpdateStatus) => void) => Promise<void> }>(
    'src/services/updater/updaterService.ts', {
      '@/utils/platform': { isTauri: () => true },
      '@/services/githubRepo': { GITHUB_REPO: 'geen-netwerk' },
      '@/services/recovery/recoveryFlush': { closeWritesAndFlushRecovery },
      '@tauri-apps/api/core': { invoke: async () => 'native' },
      '@tauri-apps/plugin-updater': { check: async () => ({
        download: async () => undefined,
        install: async () => { observe('install'); if (installError) throw installError; },
      }) },
      '@tauri-apps/plugin-process': { relaunch: async () => { observe('relaunch'); } },
    });
  /** Tijdens de herstelronde van de updater: een ronde van Automatisch opslaan en Ctrl+S. */
  const lateSaves = async () => {
    await round.flushEntered.promise;
    await autosave.flush();
    const saved = await s().saveFileForDocument(s().activeDocumentId);
    observe('herstelronde');
    round.allowFlush.resolve();
    return saved;
  };
  try {
    // Een opslag loopt al: de updater wacht erop (toegelaten vóór de fase), daarna is de poort dicht.
    const firstEntered = deferred(), allowFirst = deferred();
    const first = runProjectFileWrite(async () => { firstEntered.resolve(); await allowFirst.promise; }, () => undefined);
    await firstEntered.promise;
    installError = new Error('Installatie mislukt');
    const failing = updater.downloadAndInstall(status => { statuses.push(structuredClone(status)); });
    await turn();
    assert.deepEqual([statuses, seen], [[], []], 'de updater wacht op de lopende opslag');
    allowFirst.resolve();
    await first;
    assert.equal(await lateSaves(), false, 'Ctrl+S in de laatste fase slaat niet op');
    await failing;
    const clean = { busy: false, dirty: true, written: [], same: true };
    assert.deepEqual(seen, [{ step: 'herstelronde', ...clean }, { step: 'install', ...clean }],
      'tijdens de herstelronde en bij install(): geen schrijfactie, niets geschreven, document nog gewijzigd');
    assert.deepEqual(statuses.at(-1), { kind: 'error', message: 'Installatie mislukt' });
    assert.equal(s().ui.notifications.length, 0, 'de geweigerde opslag meldt niets');
    // Afgebroken update: opslaan werkt weer.
    await autosave.flush();
    assert.equal(s().isDirty, false, 'Automatisch opslaan schrijft weer na een mislukte installatie');
    assert.notEqual(fileHash(), phase.hash);

    // Geslaagde installatie: ook bij install() en relaunch() loopt er niets en is er niets geschreven.
    s().addTask({ name: 'Bewerking vlak voor de herstart' });
    installError = undefined;
    round = { flushEntered: deferred(), allowFlush: deferred() };
    seen.length = 0;
    statuses.length = 0;
    const updating = updater.downloadAndInstall(status => { statuses.push(structuredClone(status)); });
    assert.equal(await lateSaves(), false);
    await updating;
    assert.deepEqual(seen.map(o => o.step), ['herstelronde', 'install', 'relaunch']);
    for (const o of seen) assert.deepEqual({ ...o, step: '' }, { step: '', ...clean }, `${o.step}: niets geschreven`);
    assert.deepEqual(statuses.map(st => st.kind), ['installing', 'restarting']);
  } finally {
    round.allowFlush.resolve();
    unregister();
    ipc.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('OK  laatste fase van de updater: geen opslag tijdens herstelronde, install en relaunch; na een mislukte installatie werkt opslaan weer');
}
