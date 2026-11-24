import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import {
  baseInvoke, changedIfc, eq, enc, errors, gate, has, internals, ipc, isRead, kantoor, kantoorIfc, labels, names, newApp,
  onDisk, report, resetInvoke, school, schoolIfc, setup, until, win, type Store,
} from './nieuweVersieFixture';

const { changedOnDiskShown } = await import('@/state/openDocumentFor');
const { createAppQuitController } = await import('@/services/appQuit/appQuitController');
const { appQuitDependencies } = await import('@/services/appQuit/appQuitDependencies');
const { createCloseDocumentDialogActions } = await import('@/components/layout/DocumentChrome/closeDocumentActions');
const { leaveBackstageGuarded, setBackstageLeaveGuard } = await import('@/components/backstage/backstageLeaveGuard');

type State = ReturnType<Store['getState']>;
type Route = 'knop' | 'hand';
const tabOf = (s: State, path: string) => s.getOpenDocumentPayloads().find(d => d.payload.filePath === path);
const recentOf = (s: State, path: string) => s.recentFiles.find(e => e.ref.kind === 'path' && e.ref.path === path)!;
const hand = (T: () => State, id: string, path: string) => {
  T().requestCloseDocument(id);
  return T().openRecentFile(recentOf(T(), path).id, labels);
};
const holdRead = (path: string) => {
  const reached = gate(), release = gate();
  let reads = 0;
  internals.invoke = async (command, args, options) => {
    const result = await baseInvoke(command, args, options);
    if (isRead(command, args, path) && ++reads === 1) { reached.open(); await release.wait; }
    return result;
  };
  return { reached: reached.wait, release: release.open, reads: () => reads };
};
const tabState = (st: Store, path: string) => {
  const T = () => st.getState();
  const tab = tabOf(T(), path);
  return [tab?.payload.tasks.map(t => t.name) ?? null, tab ? tab.payload.knownTargetFingerprint?.sha256 === onDisk(path) : null,
    tab ? T().documents.find(d => d.id === tab.id)?.changedOnDisk === true : null];
};
const schoolNew = schoolIfc.replaceAll("'Dak'", "'Dak nieuwe versie'");
const newest = changedIfc.replaceAll('Extern opgeslagen werk', 'Nieuwste versie op schijf');

async function twoStrips(route: Route) {
  const { st, T, a, b } = await setup(false);
  writeFileSync(school, schoolNew);
  await T().openRecentFile(recentOf(T(), school).id, labels);
  T().switchDocument(a);
  const reading = holdRead(kantoor);
  try {
    const first = route === 'knop' ? T().loadNewVersion(labels) : hand(T, a, kantoor);
    await reading.reached;
    const between = [has(st, a), T().activeDocumentId === b, changedOnDiskShown(T())];
    if (route === 'knop') await T().loadNewVersion(labels);
    else await hand(T, b, school);
    reading.release();
    await first;
    return [between, tabState(st, kantoor), tabState(st, school), T().documents.length];
  } finally { reading.release(); resetInvoke(); }
}

async function backstageLater(route: Route) {
  const { st, T, a, b } = await setup(false);
  const reading = holdRead(school);
  let proceed: (() => void) | undefined;
  const undo = setBackstageLeaveGuard(next => { proceed = next; return true; });
  try {
    const pendingRecent = T().openRecentFile(recentOf(T(), school).id, labels);
    await reading.reached;
    T().setUI({ activeRibbonTab: 'file', backstageSection: 'project-info' });
    if (route === 'knop') void T().loadNewVersion(labels, { blocked: () => false, leave: leaveBackstageGuarded });
    else leaveBackstageGuarded(() => { T().requestCloseDocument(a); });
    const deferred = [proceed !== undefined, has(st, a)];
    reading.release();
    await pendingRecent;
    const switched = T().activeDocumentId === b;
    proceed?.();
    if (route === 'hand') {
      if (T().ui.activeRibbonTab === 'file') T().setUI({ activeRibbonTab: 'start' });
      await T().openRecentFile(recentOf(T(), kantoor).id, labels);
    }
    await until(() => T().filePath === kantoor);
    return [deferred, switched, has(st, a), has(st, b), tabState(st, kantoor), tabState(st, school), T().ui.activeRibbonTab];
  } finally { undo(); reading.release(); resetInvoke(); }
}

async function quitDuringQuestion(route: Route) {
  const { app, st, T, a, b } = await setup(true);
  T().requestCloseDocument(b);
  const reading = holdRead(kantoor);
  let closed = false;
  const controller = createAppQuitController(appQuitDependencies(app, {
    stopRecovery: () => () => {},
    clearRecovery: async () => {},
    destroyWindow: async () => { closed = true; },
  }));
  const unsubscribe = st.subscribe(() => { if (controller.active) controller.step(); });
  try {
    if (route === 'knop') await T().loadNewVersion(labels);
    else T().requestCloseDocument(a);
    const asked = T().ui.pendingCloseDocId === a;
    controller.requestQuit();
    let finishing: Promise<void> | null = null;
    const actions = createCloseDocumentDialogActions({
      pendingId: a,
      getActiveDocumentId: () => T().activeDocumentId,
      switchDocument: (id) => T().switchDocument(id),
      closeDocument: (id, options) => T().closeDocumentAfterSaves(id, options),
      saveFile: () => T().saveFileForDocument(a),
      clearPending: () => { finishing = T().finishCloseQuestion(a, labels); },
      restoreOpenerFocus: () => {},
      onSavePendingChange: (pending) => T().setUI({ closeQuestionSaving: pending }),
    });
    await actions.discard();
    await Promise.race([finishing, until(() => reading.reads() > 0)]);
    const windowClosed = await until(() => closed);
    return [asked, windowClosed, has(st, a), T().documents.length, reading.reads()];
  } finally { unsubscribe(); reading.release(); resetInvoke(); }
}

async function newerDuringRead(route: Route) {
  const { st, T, a, b } = await setup(false);
  T().requestCloseDocument(b);
  const reading = holdRead(kantoor);
  try {
    const first = route === 'knop' ? T().loadNewVersion(labels) : hand(T, a, kantoor);
    await reading.reached;
    writeFileSync(kantoor, newest);
    await T().openRecentFile(recentOf(T(), kantoor).id, labels);
    reading.release();
    await first;
    return [has(st, a), tabState(st, kantoor), T().documents.length];
  } finally { reading.release(); resetInvoke(); }
}

try {
  {
    const { st, T, a } = await setup(false);
    const before = [T().activeDocumentId === a, changedOnDiskShown(T())];
    await T().loadNewVersion(labels);
    eq('N1 schoon tabblad: sluiten, dan Recent; de nieuwe versie, de strook weg, de vingerafdruk van de gelezen bytes', [
      before, has(st, a), T().filePath, names(st), T().isDirty, changedOnDiskShown(T()),
      T().knownTargetFingerprint?.sha256 === onDisk(), T().documents.length, T().ui.pendingCloseDocId,
    ], [[true, true], false, kantoor, ['Extern opgeslagen werk'], false, false, true, 2, null]);
    T().addTask({ name: 'Na het laden' });
    await T().saveFile();
    eq('N1 daarna Ctrl+S: geen weigering, het werk op schijf', [
      T().isDirty, readFileSync(kantoor, 'utf8').includes('Na het laden'), errors(st),
    ], [false, true, []]);
  }

  {
    const { st, T, a } = await setup(true);
    let reads = 0;
    internals.invoke = async (command, args, options) => { if (isRead(command, args)) reads++; return baseInvoke(command, args, options); };
    try {
      await T().loadNewVersion(labels);
      const asked = [T().ui.pendingCloseDocId === a, T().ui.pendingCloseReopen?.ref, reads, has(st, a), names(st)];
      const closed = await T().closeDocumentAfterSaves(a);
      await T().finishCloseQuestion(a, labels);
      await until(() => T().filePath === kantoor && !has(st, a));
      eq('N2 niet-opgeslagen werk: de vraag zonder te lezen; Niet opslaan sluit en opent via Recent', [
        asked, closed, has(st, a), names(st), changedOnDiskShown(T()), T().ui.pendingCloseReopen, reads,
      ], [[true, { kind: 'path', path: kantoor }, 0, true, ['Fundering', 'Eigen werk']], true, false, ['Extern opgeslagen werk'], false, null, 1]);
    } finally { resetInvoke(); }
  }

  {
    const { st, T, a } = await setup(true);
    await T().loadNewVersion(labels);
    T().setUI({ pendingCloseDocId: null });
    eq('N3 Annuleren of Escape: de vraag en het doel vervallen samen; tabblad, werk en strook blijven', [
      T().ui.pendingCloseReopen, has(st, a), T().activeDocumentId === a, names(st), T().isDirty, changedOnDiskShown(T()),
    ], [null, true, true, ['Fundering', 'Eigen werk'], true, true]);
    T().requestCloseDocument(a);
    eq('N3 het kruisje daarna: de gewone sluitvraag, zonder openen', [T().ui.pendingCloseDocId === a, T().ui.pendingCloseReopen], [true, null]);
    T().setUI({ pendingCloseDocId: null });
  }

  {
    const { st, T, a } = await setup(false);
    unlinkSync(kantoor);
    await T().loadNewVersion(labels);
    eq('N4 lezen mislukt na het sluiten (bestand weg): het tabblad is dicht en de melding van Recent, zoals op main', [
      has(st, a), errors(st).length > 0, T().documents.length,
    ], [false, true, 1]);
    writeFileSync(kantoor, changedIfc);
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
    internals.invoke = async (command, args, options) => { if (isRead(command, args)) reads++; return baseInvoke(command, args, options); };
    try {
      await Promise.all([T().loadNewVersion(labels), T().loadNewVersion(labels)]);
    } finally { resetInvoke(); }
    eq('N7 twee keer klikken: één lezing en één tabblad', [reads, has(st, a), T().documents.length, names(st)], [1, false, 2, ['Extern opgeslagen werk']]);
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
    const during = [destroyed, T().ui.pendingCloseDocId === a];
    await T().closeDocumentAfterSaves(a);
    await T().finishCloseQuestion(a, labels);
    controller.step();
    const closed = await until(() => destroyed);
    eq(`N9 ${route} (ronde 10): het venster sluiten tijdens de vraag wacht op de vraag; na Niet opslaan gaat het venster dicht`, [
      during, closed, has(st, a),
    ], [[false, true], true, false]);
  }

  {
    const { st, T, a } = await setup(false);
    T().setUI({ featureFlags: {} });
    await T().loadNewVersion(labels);
    eq('N10 de flag uit: geen strook en de knop doet niets', [changedOnDiskShown(T()), has(st, a), names(st), T().ui.pendingCloseDocId],
      [false, true, ['Fundering'], null]);
  }

  {
    const { st, T, a } = await setup(false);
    T().setUI({ activeRibbonTab: 'file', backstageSection: 'project-info' });
    await T().loadNewVersion(labels);
    eq('N13 vanuit Backstage: na het laden staat het lint op Start, zoals Recent in Backstage', [has(st, a), T().ui.activeRibbonTab], [false, 'start']);
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
      const st = newApp(true).store;
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
      eq('N11 een browser-handle: dezelfde handle via Recent, met die handle als doel', [
        shown, has(st, a), names(st), T().fileHandle === ref.handle, changedOnDiskShown(T()),
      ], [[true, true], false, ['Extern opgeslagen werk'], true, false]);
    } finally {
      win.__TAURI_INTERNALS__ = tauri;
    }
  }
  for (const [label, run] of [
    ['N14 (Sol ronde 3, blokkade) twee tabbladen met elk een strook: de knop van het tweede tabblad werkt terwijl het eerste nog leest', twoStrips],
    ['N15 (Sol ronde 3) de klik wacht achter de Backstage-vraag terwijl een ander tabblad actief wordt: de knop sluit het tabblad van de klik', backstageLater],
    ['N16 (Sol ronde 3) het venster sluiten tijdens de vraag van de knop, dan Niet opslaan: geen lezing meer, zoals het kruisje', quitDuringQuestion],
    ['N17 (Sol ronde 3) een nieuwere versie en een tweede Recent tijdens de lezing na het sluiten', newerDuringRead],
  ] as const) {
    const knop = await run('knop');
    const byHand = await run('hand');
    eq(`${label}: knop gelijk aan kruisje, dan Recent`, knop, byHand);
    if (label.startsWith('N14')) eq(`${label}: beide tabbladen tonen de nieuwe versie`, [knop[1], knop[2]],
      [[['Extern opgeslagen werk'], true, false], [['Dak nieuwe versie'], true, false]]);
    if (label.startsWith('N15')) eq(`${label}: School blijft open, Kantoor heropend`, [knop[3], knop[2]], [true, false]);
    if (label.startsWith('N16')) eq(`${label}: geen lezing na Niet opslaan`, knop[4], 0);
  }
} finally {
  ipc.dispose();
}

report('nieuwe-versie-laden');
