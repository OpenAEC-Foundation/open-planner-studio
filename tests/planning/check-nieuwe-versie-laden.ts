import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import {
  baseInvoke, changedIfc, eq, enc, errors, has, internals, ipc, isRead, kantoor, kantoorIfc, labels, names, newApp,
  onDisk, report, resetInvoke, setup, until, win,
} from './nieuweVersieFixture';

const { changedOnDiskShown } = await import('@/state/openDocumentFor');
const { createAppQuitController } = await import('@/services/appQuit/appQuitController');
const { appQuitDependencies } = await import('@/services/appQuit/appQuitDependencies');

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
      const closed = await T().loadNewVersionAfterDiscard(a, labels);
      T().setUI({ pendingCloseDocId: null });
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
    if (route === 'kruisje') await T().closeDocumentAfterSaves(a);
    else await T().loadNewVersionAfterDiscard(a, labels);
    T().setUI({ pendingCloseDocId: null });
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
} finally {
  ipc.dispose();
}

report('nieuwe-versie-laden');
