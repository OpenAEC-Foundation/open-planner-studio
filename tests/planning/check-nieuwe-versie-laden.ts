import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import {
  baseInvoke, changedIfc, eq, enc, errors, gate, has, internals, ipc, isRead, kantoor, kantoorIfc, labels, names, newApp,
  onDisk, report, resetInvoke, school, setup, until, win,
} from './nieuweVersieFixture';

const { changedOnDiskShown } = await import('@/state/openDocumentFor');
const { createAppQuitController } = await import('@/services/appQuit/appQuitController');
const { appQuitDependencies } = await import('@/services/appQuit/appQuitDependencies');

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
    const asked = [T().ui.pendingCloseDocId === a, (T().ui.pendingCloseNewVersion !== null), has(st, a), names(st), changedOnDiskShown(T())];
    const loaded = await T().loadNewVersionAfterDiscard();
    T().setUI({ pendingCloseDocId: null });
    eq('N2 niet-opgeslagen werk: de vraag met de nieuwe versie; Niet opslaan vervangt', [
      asked, loaded, has(st, a), names(st), T().filePath, changedOnDiskShown(T()), (T().ui.pendingCloseNewVersion !== null),
    ], [[true, true, true, ['Fundering', 'Eigen werk'], true], true, false, ['Extern opgeslagen werk'], kantoor, false, false]);
  }

  {
    const { st, T, a } = await setup(true);
    await T().loadNewVersion(labels);
    T().setUI({ pendingCloseDocId: null });
    const held = T().ui.pendingCloseNewVersion;
    const late = await T().loadNewVersionAfterDiscard();
    eq('N3 Annuleren: het tabblad, het werk en de strook blijven; een late Niet opslaan doet niets', [
      held, has(st, a), T().activeDocumentId === a, names(st), T().isDirty, changedOnDiskShown(T()), late,
    ], [null, true, true, ['Fundering', 'Eigen werk'], true, true, false]);
    T().requestCloseDocument(a);
    eq('N3 het kruisje daarna: de gewone sluitvraag, zonder de nieuwe versie', [
      T().ui.pendingCloseDocId === a, (T().ui.pendingCloseNewVersion !== null),
    ], [true, false]);
    T().setUI({ pendingCloseDocId: null });
    await T().loadNewVersion(labels);
    T().setUI({ pendingCloseDocId: null });
    eq('N3 Escape (de sluitvraag dicht zonder knop) laat de nieuwe versie vallen', [
      (T().ui.pendingCloseNewVersion !== null), await T().loadNewVersionAfterDiscard(), has(st, a), names(st),
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
      const result = await baseInvoke(command, args, options);
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
        editable, T().ui.pendingCloseDocId === a, (T().ui.pendingCloseNewVersion !== null), has(st, a), names(st),
      ], [[true, ['Fundering', 'Tijdens het lezen']], true, true, true, ['Fundering', 'Tijdens het lezen']]);
    } finally {
      release.open();
      resetInvoke();
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
      if (isRead(command, args)) reads++;
      return baseInvoke(command, args, options);
    };
    try {
      await Promise.all([T().loadNewVersion(labels), T().loadNewVersion(labels)]);
    } finally {
      resetInvoke();
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
      if (isRead(command, args) && held) readsWhileSaving++;
      if (!held && /^plugin:fs\|(write|write_file|write_text_file|rename)$/.test(command)) { held = true; placed.open(); await release.wait; }
      return baseInvoke(command, args, options);
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
      resetInvoke();
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
    const during = [destroyed, T().ui.pendingCloseDocId === a, (T().ui.pendingCloseNewVersion !== null)];
    if (route === 'kruisje') await T().closeDocumentAfterSaves(a);
    else await T().loadNewVersionAfterDiscard();
    T().setUI({ pendingCloseDocId: null });
    controller.step();
    const closed = await until(() => destroyed);
    eq(`N9 ${route} (ronde 10): het venster sluiten tijdens de vraag wacht op de vraag; na Niet opslaan gaat het venster dicht`, [
      during, closed, has(st, a),
    ], [[false, true, route === 'knop'], true, false]);
  }

  for (const dirty of [false, true]) {
    const { st, T, a } = await setup(dirty);
    writeFileSync(kantoor, kantoorIfc);
    const count = T().documents.length;
    await T().loadNewVersion(labels);
    const asked = T().ui.pendingCloseDocId === a;
    if (asked) {
      await T().loadNewVersionAfterDiscard();
      T().setUI({ pendingCloseDocId: null });
    }
    eq(`N12 (2048) ${dirty ? 'gewijzigd' : 'schoon'} tabblad: op schijf staat de versie die het tabblad kent ⇒ zoals kruisje en Recent: ${dirty ? 'de vraag, dan' : ''} die versie in een nieuw tabblad`, [
      asked, has(st, a), T().documents.length - count, names(st), changedOnDiskShown(T()),
    ], [dirty, false, 0, ['Fundering'], false]);
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

report('nieuwe-versie-laden');
