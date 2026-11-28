import './domStub';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppQuitController, type AppQuitDocument } from '@/services/appQuit/appQuitController';
import { appQuitDependencies } from '@/services/appQuit/appQuitDependencies';
import { appStoreContext, createAppStoreContext } from '@/state/appStore';
import { createPendingTextEdits, mountedPendingTextEdits } from '@/state/pendingTextEdits';
import { isProjectFileWriteBusy, runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { isGlobalShortcutFrozen } from '@/hooks/keyboard/shortcutRegistry';
import { isBlockingDialogOpen } from '@/state/blockingDialogs';
import { installNodeFileIpc } from './nodeFileIpc';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

function harness(initial: AppQuitDocument[]) {
  const log: string[] = [];
  const world = {
    docs: initial.map((d) => ({ ...d })),
    pending: null as string | null,
    quitPending: false,
    recoveryOn: true,
    inputFinished: 0,
    saving: null as Promise<void> | null,
    errors: 0,
  };
  const controller = createAppQuitController({
    finishPendingInput: () => { world.inputFinished++; },
    listDocuments: () => world.docs.map((d) => ({ ...d })),
    getPendingCloseDocId: () => world.pending,
    setPendingCloseDocId: (id) => { world.pending = id; log.push(`vraag:${id}`); },
    setQuitPending: (p) => { world.quitPending = p; },
    closeWrites: async () => { log.push('poort-dicht'); return () => { log.push('poort-open'); }; },
    stopRecovery: () => {
      world.recoveryOn = false;
      log.push('herstel-uit');
      return () => { world.recoveryOn = true; log.push('herstel-aan'); };
    },
    clearRecovery: async () => { log.push('herstel-gewist'); },
    destroyWindow: async () => { log.push('venster-dicht'); },
    waitForSaves: () => {
      const saving = world.saving;
      if (!saving) return null;
      log.push('aanduiding-aan');
      return saving.then(() => { world.saving = null; log.push('aanduiding-uit'); });
    },
    watchFailures: () => {
      const seen = world.errors;
      return () => world.errors > seen;
    },
    claimShutdown: () => () => undefined,
  });
  const hold = () => {
    let release!: () => void;
    world.saving = new Promise<void>((r) => { release = r; });
    return release;
  };
  const answer = (choice: 'opslaan' | 'niet-opslaan' | 'annuleren' | 'opslaan-mislukt') => {
    const id = world.pending!;
    if (choice === 'opslaan' || choice === 'niet-opslaan') world.docs = world.docs.filter((d) => d.id !== id);
    world.pending = null;
    controller.step();
  };
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { controller, world, log, answer, settle, hold };
}

{
  const h = harness([{ id: 'a', isDirty: false }, { id: 'b', isDirty: false }]);
  eq('1 CloseRequested wordt overgenomen', h.controller.requestQuit(), true);
  await h.settle();
  eq('1 schone exit: volgorde', h.log, ['poort-dicht', 'herstel-uit', 'herstel-gewist', 'venster-dicht', 'poort-open']);
}

{
  const h = harness([{ id: 'a', isDirty: true }, { id: 'b', isDirty: false }, { id: 'c', isDirty: true }]);
  h.controller.requestQuit();
  eq('2 eerst de vraag voor a', h.log, ['vraag:a']);
  eq('2 afsluiten loopt', h.world.quitPending, true);
  h.answer('opslaan');
  eq('2 daarna de vraag voor c', h.log, ['vraag:a', 'vraag:c']);
  h.answer('niet-opslaan');
  await h.settle();
  eq('2 daarna schone exit', h.log.slice(2), ['poort-dicht', 'herstel-uit', 'herstel-gewist', 'venster-dicht', 'poort-open']);
}

{
  const h = harness([{ id: 'a', isDirty: true }, { id: 'b', isDirty: true }]);
  h.controller.requestQuit();
  h.answer('annuleren');
  await h.settle();
  eq('3 geen tweede vraag, geen exit', h.log, ['vraag:a']);
  eq('3 herstel blijft aan', h.world.recoveryOn, true);
  eq('3 vlag uit, controller inactief', [h.world.quitPending, h.controller.active], [false, false]);
  h.controller.requestQuit();
  eq('3 nieuwe poging vraagt opnieuw', h.log, ['vraag:a', 'vraag:a']);
}

{
  const h = harness([{ id: 'a', isDirty: true }]);
  h.controller.requestQuit();
  h.answer('opslaan-mislukt');
  await h.settle();
  eq('4 mislukte opslag: geen exit', h.log, ['vraag:a']);
}

{
  const h = harness([{ id: 'a', isDirty: true }]);
  h.controller.requestQuit();
  h.controller.step();
  h.controller.step();
  eq('5 geen dubbele vraag', h.log, ['vraag:a']);
}

{
  const reg = createPendingTextEdits();
  const ctx = createAppStoreContext({ pendingTextEdits: reg });
  const s = () => ctx.store.getState();
  s().newProject();
  const taskId = s().addTask({ name: 'Metselwerk' });
  const resourceId = s().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 4 });
  s().assignResource(taskId, resourceId, 1);
  const asg = s().assignments[0]!.id;
  ctx.store.setState((st) => { st.isDirty = false; });
  let released = 0;
  reg.register({ commit: () => s().updateAssignment(asg, { unitsPerDay: 3 }) });
  reg.register({ release: () => { released++; } });
  const log: string[] = [];
  const controller = createAppQuitController(appQuitDependencies(ctx, {
    stopRecovery: () => { log.push('herstel-uit'); return () => { log.push('herstel-aan'); }; },
    clearRecovery: async () => { log.push('herstel-gewist'); },
    destroyWindow: async () => { log.push('venster-dicht'); },
  }));
  controller.requestQuit();
  await new Promise((r) => setTimeout(r, 0));
  eq('6 geen exit zonder vraag', log, []);
  eq('6 sluitvraag voor het actieve document', s().ui.pendingCloseDocId, s().activeDocumentId);
  eq('6 de getypte inzet staat in de store', s().assignments[0]!.unitsPerDay, 3);
  eq('6 eigen rekenblokkade vrijgegeven', released, 1);
  s().setUI({ pendingCloseDocId: null });
  controller.step();
  eq('6 geannuleerd', [s().ui.appQuitPending, controller.active], [false, false]);
}

for (const closeActive of [true, false]) {
  const reg = createPendingTextEdits();
  const ctx = createAppStoreContext({ pendingTextEdits: reg });
  const s = () => ctx.store.getState();
  s().newProject();
  const task = s().addTask({ name: 'Metselwerk' });
  const resource = s().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 4 });
  s().assignResource(task, resource, 1);
  const assignment = s().assignments[0]!.id;
  const active = s().activeDocumentId;
  const other = s().newDocument();
  s().switchDocument(active);
  ctx.store.setState(st => { st.isDirty = false; });
  reg.register({ commit: () => s().updateAssignment(assignment, { unitsPerDay: 3 }) });
  s().requestCloseDocument(closeActive ? active : other);
  eq(`1838/${closeActive}: open veld is vastgelegd`, s().assignments[0]!.unitsPerDay, 3);
  eq(`1838/${closeActive}: wijziging blijft bewaard`, s().isDirty, true);
  eq(`1838/${closeActive}: vraag hoort bij gewijzigde doel`, s().ui.pendingCloseDocId, closeActive ? active : null);
  eq(`1838/${closeActive}: juiste document blijft open`, s().documents.some(d => d.id === (closeActive ? active : other)), closeActive);
}

{
  let commits = 0;
  const off = mountedPendingTextEdits.register({ commit: () => { commits++; } });
  createAppStoreContext().store.getState().newDocument();
  eq('7 andere context raakt de zichtbare invoer niet', commits, 0);
  appStoreContext.store.getState().newDocument();
  eq('7 de gemounte context rondt hem af', commits, 1);
  off();
}

{
  const h = harness([{ id: 'a', isDirty: false }]);
  const release = h.hold();
  eq('8 CloseRequested wordt overgenomen', h.controller.requestQuit(), true);
  await h.settle();
  eq('8 eerst wachten met de aanduiding; het herstel blijft', [h.log, h.world.recoveryOn], [['aanduiding-aan'], true]);
  h.controller.requestQuit();
  h.controller.step();
  eq('8 nog een sluitpoging of storewijziging: geen tweede wachtronde', h.log, ['aanduiding-aan']);
  release();
  await h.settle();
  eq('8 daarna de schone exit', h.log, ['aanduiding-aan', 'aanduiding-uit', 'poort-dicht', 'herstel-uit', 'herstel-gewist', 'venster-dicht', 'poort-open']);
}

{
  const h = harness([{ id: 'a', isDirty: true }]);
  const release = h.hold();
  h.controller.requestQuit();
  h.world.errors++;
  release();
  await h.settle();
  eq('9 geen vraag en geen exit', h.log, ['aanduiding-aan', 'aanduiding-uit']);
  eq('9 herstel aan, afsluiten afgebroken', [h.world.recoveryOn, h.world.quitPending, h.controller.active], [true, false, false]);
}

{
  const h = harness([{ id: 'a', isDirty: true }, { id: 'b', isDirty: false }]);
  const release = h.hold();
  h.controller.requestQuit();
  release();
  await h.settle();
  eq('10 na het wachten de sluitvraag', h.log, ['aanduiding-aan', 'aanduiding-uit', 'vraag:a']);
  h.answer('niet-opslaan');
  await h.settle();
  eq('10 daarna dicht', h.log.slice(3), ['poort-dicht', 'herstel-uit', 'herstel-gewist', 'venster-dicht', 'poort-open']);
}

{
  const h = harness([{ id: 'a', isDirty: true }]);
  h.controller.requestQuit();
  const release = h.hold();
  h.answer('opslaan');
  await h.settle();
  eq('11 na de vraag eerst wachten', [h.log, h.world.recoveryOn], [['vraag:a', 'aanduiding-aan'], true]);
  release();
  await h.settle();
  eq('11 daarna dicht', h.log.slice(1), ['aanduiding-aan', 'aanduiding-uit', 'poort-dicht', 'herstel-uit', 'herstel-gewist', 'venster-dicht', 'poort-open']);
}

{
  const ctx = createAppStoreContext();
  const s = () => ctx.store.getState();
  s().newProject();
  ctx.store.setState((st) => { st.isDirty = false; });
  const log: string[] = [];
  const shown: boolean[] = [];
  const off = ctx.store.subscribe((now, before) => {
    if (now.ui.savingBeforeClose !== before.ui.savingBeforeClose) shown.push(now.ui.savingBeforeClose);
  });
  const controller = createAppQuitController(appQuitDependencies(ctx, {
    stopRecovery: () => { log.push('herstel-uit'); return () => { log.push('herstel-aan'); }; },
    clearRecovery: async () => { log.push('herstel-gewist'); },
    destroyWindow: async () => { log.push('venster-dicht'); },
  }));
  const settle = () => new Promise((r) => setTimeout(r, 0));
  const failedSave = () => s().notify({ severity: 'error', messageKey: 'notifications.saveFailed', dedupeKey: 'opslag-1' });
  let release: () => void = () => undefined;
  const holdWrite = () => runProjectFileWrite(() => new Promise<void>((r) => { release = r; }), () => undefined);

  let write = holdWrite();
  controller.requestQuit();
  await settle();
  eq('12 tijdens de opslag: de aanduiding staat, niets gewist', [s().ui.savingBeforeClose, s().ui.appQuitPending, log], [true, true, []]);
  failedSave();
  release();
  await write;
  await settle();
  eq('12 mislukt: afgebroken, aanduiding weg', [s().ui.savingBeforeClose, s().ui.appQuitPending, log], [false, false, []]);

  write = holdWrite();
  controller.requestQuit();
  await settle();
  failedSave();
  release();
  await write;
  await settle();
  eq('12 herhaalde fout: opnieuw afgebroken', [s().ui.appQuitPending, log], [false, []]);

  write = holdWrite();
  controller.requestQuit();
  await settle();
  release();
  await write;
  await settle();
  eq('12 geslaagd: daarna de schone exit', log, ['herstel-uit', 'herstel-gewist', 'venster-dicht']);
  eq('12 de aanduiding drie keer aan en weer uit', shown, [true, false, true, false, true, false]);
  off();
}

{
  const ctx = createAppStoreContext();
  const s = () => ctx.store.getState();
  ctx.store.getState().newProject();
  ctx.store.setState((st) => { st.isDirty = false; });
  const log: string[] = [];
  let shown = false;
  const off = ctx.store.subscribe((now) => { if (now.ui.savingBeforeClose) shown = true; });
  const controller = createAppQuitController(appQuitDependencies(ctx, {
    stopRecovery: () => { log.push('herstel-uit'); return () => { log.push('herstel-aan'); }; },
    clearRecovery: async () => { log.push('herstel-gewist'); },
    destroyWindow: async () => { log.push('venster-dicht'); },
  }));
  controller.requestQuit();
  eq('13 de laatste fase begint meteen, in dezelfde beurt: de schil staat stil', [log, s().ui.appClosing], [[], true]);
  await new Promise((r) => setTimeout(r, 0));
  eq('13 schone exit zonder aanduiding', [log, shown], [['herstel-uit', 'herstel-gewist', 'venster-dicht'], false]);
  eq('13 na het venster staat de poort weer open', isProjectFileWriteBusy(), false);
  off();
}

{
  const ipc = installNodeFileIpc();
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const invoke = win.__TAURI_INTERNALS__.invoke;
  let dialogs = 0;
  win.__TAURI_INTERNALS__.invoke = async (...args: unknown[]) => {
    if (args[0] === 'plugin:dialog|save') { dialogs++; return null; }
    return invoke(...args);
  };
  const dir = mkdtempSync(join(tmpdir(), 'ops-app-quit-'));
  const target = join(dir, 'afsluiten.ifc');
  writeFileSync(target, readFileSync('public/examples/03-kantoorgebouw-zuidas.ifc'));
  const fileHash = () => createHash('sha256').update(readFileSync(target)).digest('hex');
  const mutating = (from: number) => ipc.calls.slice(from).map((c) => c.command)
    .filter((c) => /write|rename|place|remove|truncate|copy/.test(c));
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    return { promise, resolve };
  };
  const ctx = createAppStoreContext();
  const s = () => ctx.store.getState();
  s().newProject();
  ctx.store.setState((st) => { st.isDirty = false; st.filePath = target; st.autoSaveToFile = true; });
  const autosave = createFileAutoSaveController({ getState: s, enabled: () => true });
  const firstEntered = deferred(), allowFirst = deferred(), clearEntered = deferred(), allowClear = deferred();
  const destroyed = deferred();
  let recoveryOn = true;
  let phase = { calls: 0, hash: '' };
  const destroys: unknown[] = [];
  const controller = createAppQuitController(appQuitDependencies(ctx, {
    stopRecovery: () => { recoveryOn = false; return () => { recoveryOn = true; }; },
    clearRecovery: async () => { clearEntered.resolve(); await allowClear.promise; },
    destroyWindow: async () => {
      destroys.push({ busy: isProjectFileWriteBusy(), dirty: s().isDirty, closing: s().ui.appClosing });
      destroyed.resolve();
    },
  }));
  const off = ctx.store.subscribe(() => { if (controller.active) controller.step(); });
  const realError = console.error;
  console.error = () => undefined;
  try {
    const first = runProjectFileWrite(async () => { firstEntered.resolve(); await allowFirst.promise; }, () => undefined);
    await firstEntered.promise;
    controller.requestQuit();
    await new Promise((r) => setTimeout(r, 0));
    eq('14 eerst wachten op de lopende opslag', [s().ui.savingBeforeClose, s().ui.appClosing], [true, false]);
    allowFirst.resolve();
    await first;
    await clearEntered.promise;
    phase = { calls: ipc.calls.length, hash: fileHash() };
    eq('14 de laatste fase: de schil staat stil, ook voor de MCP-bridge',
      [s().ui.appClosing, isGlobalShortcutFrozen(s().ui), isBlockingDialogOpen(s().ui), recoveryOn], [true, true, true, false]);
    s().addTask({ name: 'Bewerking tijdens het afsluiten' });
    eq('14 Ctrl+S slaat niet op', await s().saveFileForDocument(s().activeDocumentId), false);
    await s().saveFileAs();
    await autosave.flush();
    eq('14 geen kiezer, geen melding, niets geschreven, document gewijzigd',
      [dialogs, s().ui.notifications.length, mutating(phase.calls), fileHash() === phase.hash, s().isDirty], [0, 0, [], true, true]);
    allowClear.resolve();
    await new Promise((r) => setTimeout(r, 0));
    eq('14 geen destroyWindow met een gewijzigd document', destroys, []);
    eq('14 de sluitvraag; schil, poort en herstel weer open',
      [s().ui.pendingCloseDocId, s().ui.appClosing, s().ui.appQuitPending, controller.active, recoveryOn],
      [s().activeDocumentId, false, true, true, true]);
    eq('14 nog steeds niets geschreven', [mutating(phase.calls), fileHash() === phase.hash], [[], true]);
    eq('14 opslaan werkt weer', await s().saveFileForDocument(s().activeDocumentId), true);
    eq('14 en schreef het bestand', [s().isDirty, fileHash() !== phase.hash], [false, true]);
    s().setUI({ pendingCloseDocId: null });
    await destroyed.promise;
    eq('14 daarna dicht, zonder gewijzigd document', destroys, [{ busy: false, dirty: false, closing: true }]);
  } finally {
    console.error = realError;
    allowFirst.resolve();
    allowClear.resolve();
    off();
    ipc.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
}

if (diffs.length === 0) {
  console.log(`OK  app-quit: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  app-quit: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
