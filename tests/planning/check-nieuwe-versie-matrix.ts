import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  baseInvoke, changedIfc, dialog, dir, enc, eq, errors, gate, internals, ipc, kantoor, kantoorIfc, labels, newApp, report,
  resetInvoke, schoolIfc, setup, sleep, win, type Store,
} from './nieuweVersieFixture';

const { isBlockingDialogOpen } = await import('@/state/blockingDialogs');
const { leaveBackstageGuarded, setBackstageLeaveGuard } = await import('@/components/backstage/backstageLeaveGuard');
const { openDroppedFiles } = await import('@/state/fileDrop');
const { droppedFilesFromPaths } = await import('@/services/fileAccess/fileDrop');
const { tauriOpenIO } = await import('@/services/fileAccess/tauriOpenPath');
const io = await tauriOpenIO();

type Route = 'knop' | 'kruisje';
type Platform = 'pad' | 'handle';
type Begin = 'schoon' | 'werk' | 'verouderd' | 'verouderdWerk' | 'backstage' | 'tweede';
type During = 'niets' | 'typen' | 'ctrlS' | 'opslaanAls' | 'export' | 'undo' | 'tabwissel' | 'sluiten' | 'recent' | 'slepen'
  | 'flagUit' | 'dialoog' | 'backstageTijdens' | 'opslagLateRecent';
type Answer = 'nietOpslaan' | 'annuleren' | 'escape';
interface Case { platform: Platform; begin: Begin; during: During; answer: Answer }

const other = join(dir, 'kantoor-ander.ifc');
const holds: { reached: () => void; release: Promise<void> }[] = [];
const holdNextRead = () => {
  const reached = gate(), release = gate();
  const hold = { reached: reached.open, release: release.wait };
  holds.push(hold);
  return {
    reached: reached.wait, release: release.open,
    drop: () => { const i = holds.indexOf(hold); if (i >= 0) holds.splice(i, 1); },
  };
};
const takeHold = async () => {
  const hold = holds.shift();
  if (hold) { hold.reached(); await hold.release; }
};
const kantoorRead = (command: string, args: unknown) =>
  /^plugin:fs\|read_(text_)?file$/.test(command) && (args as { path?: string } | undefined)?.path === kantoor;

class FakeHandle {
  readonly kind = 'file';
  slowIdentity = false;
  constructor(readonly name: string, public bytes: Uint8Array, readonly entry: string) {}
  async getFile() {
    const bytes = this.bytes;
    if (this.entry === 'kantoor') await takeHold();
    return new File([bytes as BlobPart], this.name);
  }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async isSameEntry(other: unknown) {
    if (this.slowIdentity || (other as FakeHandle).slowIdentity) await sleep(400);
    return other instanceof FakeHandle && other.entry === this.entry;
  }
}

interface World {
  st: Store;
  T: () => ReturnType<Store['getState']>;
  a: string;
  b: string;
  platform: Platform;
  writeKantoor: (text: string) => void;
  kantoorText: () => string;
  recentId: () => string | null;
  drop?: () => Promise<void>;
}

async function padWorld(c: Case): Promise<World> {
  const { st, T, a, b } = await setup(c.begin === 'werk' || c.begin === 'verouderdWerk');
  const world: World = {
    st, T, a, b, platform: 'pad',
    writeKantoor: (text) => writeFileSync(kantoor, text),
    kantoorText: () => readFileSync(kantoor, 'utf8'),
    recentId: () => T().recentFiles.find(e => e.ref.kind === 'path' && e.ref.path === kantoor)?.id ?? null,
    drop: () => openDroppedFiles(st, droppedFilesFromPaths([kantoor], io, { ifcBytes: true }), labels, () => false),
  };
  if (c.begin === 'verouderd' || c.begin === 'verouderdWerk') writeFileSync(kantoor, kantoorIfc);
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
  const kh = new FakeHandle('kantoor.ifc', enc.encode(kantoorIfc), 'kantoor');
  const sh = new FakeHandle('school.ifc', enc.encode(schoolIfc), 'school');
  const ref = (h: FakeHandle) => ({ kind: 'handle' as const, handle: h as unknown as FileSystemFileHandle });
  const openHandle = (h: FakeHandle) => T().openOpenedFile({ name: h.name, content: '', bytes: h.bytes, ref: ref(h) }, labels);
  await openHandle(kh);
  const a = T().activeDocumentId;
  if (c.begin === 'werk') T().addTask({ name: 'Eigen werk' });
  T().newDocument();
  await openHandle(sh);
  const b = T().activeDocumentId;
  if (c.begin === 'tweede') {
    const twin = new FakeHandle('kantoor.ifc', kh.bytes, 'kantoor');
    twin.slowIdentity = true;
    T().newDocument();
    await T().openOpenedFile({ name: twin.name, content: '', bytes: twin.bytes, ref: ref(twin) }, labels);
    twin.slowIdentity = false;
  }
  kh.bytes = enc.encode(changedIfc);
  T().switchDocument(b);
  await openHandle(kh);
  st.setState(s => {
    s.recentFiles = [{ id: 'kantoor-h', ref: ref(kh), name: 'kantoor.ifc', addedAt: 1 }];
    s.ui.notifications = [];
  });
  return {
    st, T, a, b, platform: 'handle',
    writeKantoor: (text) => { kh.bytes = enc.encode(text); },
    kantoorText: () => new TextDecoder().decode(kh.bytes),
    recentId: () => 'kantoor-h',
  };
}

const finishWorld = () => {
  if (tauri) { win.__TAURI_INTERNALS__ = tauri; tauri = null; }
  holds.length = 0;
  resetInvoke();
};

let pendingLeave: (() => void) | null = null;
let backstageAsked = 0;
const registerDraft = () => {
  pendingLeave = null;
  return setBackstageLeaveGuard((proceed) => { backstageAsked++; pendingLeave = proceed; return true; });
};
const gateFor = (w: World) => ({
  blocked: () => isBlockingDialogOpen(w.T().ui),
  leave: leaveBackstageGuarded,
});

async function duringAction(w: World, c: Case, created: string[]): Promise<(() => Promise<void>) | null> {
  const { T, a, b } = w;
  switch (c.during) {
    case 'niets': return null;
    case 'typen':
      T().addTask({ name: 'Getypt tijdens lezen' });
      created.push('Getypt tijdens lezen');
      return null;
    case 'ctrlS':
      T().addTask({ name: 'Intussen zelf opgeslagen' });
      created.push('Intussen zelf opgeslagen');
      await T().saveFile();
      return null;
    case 'opslaanAls':
      dialog.save = other;
      await T().saveFileAs();
      return null;
    case 'export':
      dialog.save = kantoor;
      await T().exportAs('ifc');
      return null;
    case 'undo':
      T().undo();
      return null;
    case 'tabwissel':
      T().switchDocument(b);
      return null;
    case 'sluiten':
      T().closeDocument(a);
      return null;
    case 'recent': {
      const id = w.recentId();
      if (id) await T().openRecentFile(id, labels);
      return null;
    }
    case 'slepen':
      await w.drop?.();
      return null;
    case 'flagUit':
      T().setUI({ featureFlags: {} });
      return null;
    case 'dialoog': {
      const taskId = T().tasks[0]?.id ?? null;
      T().setUI({ showTaskDialog: true, editingTaskId: taskId });
      return async () => {
        if (taskId) T().updateTask(taskId, { name: 'In de dialoog' });
        created.push('In de dialoog');
        T().setUI({ showTaskDialog: false, editingTaskId: null });
      };
    }
    case 'backstageTijdens': {
      const unregister = registerDraft();
      return async () => {
        T().setProject({ name: 'Toegepaste naam' });
        unregister();
        const proceed = pendingLeave;
        pendingLeave = null;
        proceed?.();
        await sleep(20);
      };
    }
    case 'opslagLateRecent': {
      const late = holdNextRead();
      const id = w.recentId();
      const recent = id ? T().openRecentFile(id, labels) : Promise.resolve();
      await Promise.race([late.reached, sleep(400)]);
      T().addTask({ name: 'Intussen zelf opgeslagen' });
      created.push('Intussen zelf opgeslagen');
      await T().saveFile();
      late.release();
      await recent;
      return null;
    }
  }
}

async function answer(w: World, route: Route, c: Case) {
  const { T, a } = w;
  if (T().ui.pendingCloseDocId !== a) return;
  if (c.answer === 'nietOpslaan') {
    if (route === 'knop') await T().loadNewVersionAfterDiscard();
    else await T().closeDocumentAfterSaves(a);
    T().setUI({ pendingCloseDocId: null });
    return;
  }
  T().setUI({ pendingCloseDocId: null });
}

const viaLeave = (run: () => Promise<void> | void) => new Promise<void>((resolve) => {
  let ran = false;
  leaveBackstageGuarded(() => { ran = true; void Promise.resolve(run()).finally(resolve); });
  if (!ran) resolve();
});

async function runRoute(route: Route, c: Case) {
  const w = c.platform === 'pad' ? await padWorld(c) : await handleWorld(c);
  const { T, st, a } = w;
  const created = c.begin === 'werk' || c.begin === 'verouderdWerk' ? ['Eigen werk'] : [];
  if (c.begin === 'tweede' && c.platform === 'pad') created.push('Werk in tweede tab');
  let asked = 0;
  const unsubscribe = st.subscribe((next, prev) => {
    if (next.ui.pendingCloseDocId && next.ui.pendingCloseDocId !== prev.ui.pendingCloseDocId) asked++;
  });
  backstageAsked = 0;
  const unregisterBegin = c.begin === 'backstage' ? registerDraft() : null;
  let reads = 0;
  internals.invoke = async (command, args, options) => {
    const result = await baseInvoke(command, args, options);
    if (kantoorRead(command, args)) { reads++; await takeHold(); }
    return result;
  };
  try {
    if (route === 'knop') {
      const first = holdNextRead();
      const loading = T().loadNewVersion(labels, gateFor(w));
      const reached = await Promise.race([first.reached.then(() => true), sleep(400).then(() => false)]);
      if (!reached) first.drop();
      const finish = await duringAction(w, c, created);
      first.release();
      await Promise.race([loading, sleep(150)]);
      if (finish) await finish();
      await Promise.race([loading, sleep(3000)]);
      await answer(w, route, c);
    } else {
      const finish = await duringAction(w, c, created);
      if (finish && c.during === 'dialoog') await finish();
      if (w.T().documents.some(d => d.id === a)) await viaLeave(() => T().requestCloseDocument(a));
      if (finish && c.during !== 'dialoog') await finish();
      await sleep(20);
      const asking = T().ui.pendingCloseDocId === a;
      await answer(w, route, c);
      const id = w.recentId();
      if (id && !(asking && c.answer !== 'nietOpslaan')) await viaLeave(() => T().openRecentFile(id, labels));
    }
    await sleep(20);
    const tabs = T().getOpenDocumentPayloads().map(({ id, payload }) => JSON.stringify([
      payload.filePath ?? payload.fileHandle?.name ?? null, payload.tasks.map(t => t.name), payload.isDirty,
      T().documents.find(d => d.id === id)?.changedOnDisk === true, payload.project.name,
    ])).sort();
    const everywhere = [...T().getOpenDocumentPayloads().flatMap(d => d.payload.tasks.map(t => t.name)), w.kantoorText()];
    const otherText = (() => { try { return readFileSync(other, 'utf8'); } catch { return ''; } })();
    const lostAny = created.filter(name => !everywhere.some(text => text === name || text.includes(name)) && !otherText.includes(name));
    const lost = asked > 0 ? [] : lostAny;
    return {
      tabs,
      active: [T().filePath ?? T().fileHandle?.name ?? null, T().tasks.map(t => t.name)],
      question: asked > 0,
      backstageAsked: backstageAsked > 0,
      reads,
      lost,
      errors: [...new Set(errors(st))].sort(),
    };
  } finally {
    unsubscribe();
    unregisterBegin?.();
    pendingLeave = null;
    try { unlinkSync(other); } catch { }
    finishWorld();
  }
}

type End = Awaited<ReturnType<typeof runRoute>>;
const activeIs = (file: string, tasks: string[]) => (end: End) =>
  end.active[0] === join(dir, file) && JSON.stringify(end.active[1]) === JSON.stringify(tasks);
const exceptions: Record<string, { reason: string; knop: (end: End) => boolean }> = {
  'pad schoon opslaanAls nietOpslaan': {
    reason: 'regel 3: Opslaan als tijdens het lezen; de lezing hoort bij het oude doel en vervalt',
    knop: activeIs('kantoor-ander.ifc', ['Fundering']),
  },
  'pad werk opslaanAls nietOpslaan': {
    reason: 'regel 3: Opslaan als tijdens het lezen; de lezing hoort bij het oude doel en vervalt',
    knop: activeIs('kantoor-ander.ifc', ['Fundering', 'Eigen werk']),
  },
  'pad verouderd opslagLateRecent nietOpslaan': {
    reason: 'regel 3: de eigen opslag laat de lezing vervallen, dus de knop sluit niets en het eigen werk blijft in beeld; de strook die de late Recent zette is 2048, op main net zo',
    knop: activeIs('kantoor.ifc', ['Fundering', 'Intussen zelf opgeslagen']),
  },
  'pad werk export nietOpslaan': {
    reason: 'regel 3: een export over het eigen bestand tijdens het lezen; de lezing vervalt en het tabblad houdt zijn werk (het kruisje zou daarna vragen en weggooien)',
    knop: activeIs('kantoor.ifc', ['Fundering', 'Eigen werk']),
  },
  'pad schoon sluiten nietOpslaan': {
    reason: 'het tabblad is tijdens het lezen gesloten: er is niets te vervangen, dus de knop opent niets',
    knop: (end) => !end.tabs.some(tab => tab.includes('kantoor.ifc')),
  },
  'pad schoon flagUit nietOpslaan': {
    reason: 'met de flag uit bestaat de knop niet en wist de app het versieverschil; de lezing vervalt (een al gestarte lezing parst met de actuele flag en meldt dan openFailed, zoals Recent in dezelfde race)',
    knop: activeIs('kantoor.ifc', ['Fundering']),
  },
};

const cases: Case[] = [];
const add = (platform: Platform, begin: Begin, during: During, answers: Answer[] = ['nietOpslaan']) => {
  for (const a of answers) cases.push({ platform, begin, during, answer: a });
};
add('pad', 'schoon', 'niets');
add('pad', 'werk', 'niets', ['nietOpslaan', 'annuleren', 'escape']);
add('pad', 'verouderd', 'niets');
add('pad', 'verouderdWerk', 'niets', ['nietOpslaan', 'annuleren']);
add('pad', 'verouderd', 'ctrlS');
add('pad', 'verouderd', 'opslagLateRecent');
add('pad', 'backstage', 'niets');
add('pad', 'tweede', 'niets');
add('pad', 'schoon', 'typen', ['nietOpslaan', 'annuleren']);
add('pad', 'werk', 'ctrlS');
add('pad', 'schoon', 'opslaanAls');
add('pad', 'werk', 'opslaanAls');
add('pad', 'schoon', 'export');
add('pad', 'werk', 'export');
add('pad', 'werk', 'undo');
add('pad', 'schoon', 'tabwissel');
add('pad', 'werk', 'tabwissel');
add('pad', 'schoon', 'sluiten');
add('pad', 'schoon', 'recent');
add('pad', 'werk', 'recent');
add('pad', 'schoon', 'slepen');
add('pad', 'schoon', 'flagUit');
add('pad', 'schoon', 'dialoog', ['nietOpslaan', 'annuleren']);
add('pad', 'schoon', 'backstageTijdens', ['nietOpslaan', 'annuleren']);
add('handle', 'schoon', 'niets');
add('handle', 'werk', 'niets', ['nietOpslaan', 'annuleren']);
add('handle', 'schoon', 'typen');
add('handle', 'schoon', 'tabwissel');
add('handle', 'tweede', 'niets');

try {
  for (const c of cases) {
    const id = `${c.platform} ${c.begin} ${c.during} ${c.answer}`;
    const knop = await runRoute('knop', c);
    const kruisje = await runRoute('kruisje', c);
    const { question: _k, reads: _kr, ...knopRest } = knop;
    const { question: _r, reads: _rr, ...kruisjeRest } = kruisje;
    const same = JSON.stringify(knopRest) === JSON.stringify(kruisjeRest);
    if (!same) console.log(`VERSCHIL ${id}${exceptions[id] ? ` (uitzondering: ${exceptions[id].reason})` : ''}\n  knop    ${JSON.stringify(knopRest)}\n  kruisje ${JSON.stringify(kruisjeRest)}`);
    if (exceptions[id]) {
      eq(`M ${id}: uitzondering met de afgesproken uitkomst, en geen werk stil weg`, [exceptions[id].knop(knop), knop.lost], [true, []]);
    } else {
      eq(`M ${id}: de knop eindigt als kruisje, dan Recent`, knopRest, kruisjeRest);
      eq(`M ${id}: een vraag bij de knop alleen als het kruisje er een gaf`, knop.question, kruisje.question);
    }
    if (c.begin === 'backstage') eq(`M ${id}: met een niet-toegepaste invoer leest de knop niets, net als Recent achter de Backstage-vraag`, [knop.reads, kruisje.reads], [0, 0]);
  }
} finally {
  ipc.dispose();
}

report('nieuwe-versie-matrix');
