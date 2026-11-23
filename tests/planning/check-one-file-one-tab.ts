import { copyFileSync, mkdirSync, mkdtempSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';

installBrowserStubs();
installFakeRecoveryIndexedDb();
const reseed = installDeterminism();
const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
const realError = console.error;
console.error = () => {};

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { startOpenLookup, openTabFor, changedOnDiskShown } = await import('@/state/openDocumentFor');
const { hasChangedOnDisk } = await import('@/state/documentSaveState');
const { isBlockingDialogOpen } = await import('@/state/blockingDialogs');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { writeCSV } = await import('@/services/csv/csvWriter');
const { buildImportLabels } = await import('@/i18n/importLabels');
const { openDroppedFiles } = await import('@/state/fileDrop');
const { droppedFilesFromDataTransfer, droppedFilesFromPaths } = await import('@/services/fileAccess/fileDrop');
const { tauriOpenIO } = await import('@/services/fileAccess/tauriOpenPath');
const { readOpenedPath, fileIdentityFs } = await import('@/services/fileAccess');
const { ifcForeignContentEnabled } = await import('@/utils/featureFlags');
const { allReadFormats } = await import('@/services/formatRegistry');
const { fileToolDeps, realFs } = await import('@/services/mcp/tools/fileTools');
const { getTool } = await import('@/services/mcp/toolRegistry');
const { createMcpTransactions } = await import('@/state/runtime/createMcpTransactions');
type Store = ReturnType<typeof createAppStoreContext>['store'];

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 300)} ≠ ${w?.slice(0, 300)}`);
};
const labels = buildImportLabels((key) => key);
const CHANGED = 'buiten dit tabblad gewijzigd';
const enc = new TextEncoder();

let events: string[] | null = null;
const record = (event: string) => { events?.push(event); };
{
  const ifcFormat = allReadFormats().find(f => f.extensions.includes('ifc'))!;
  const parse = ifcFormat.read;
  ifcFormat.read = (input, l, o) => { record('parse'); return parse(input, l, o); };
}
const orderOf = (seq: string[]) => {
  const upto = seq.slice(0, seq.indexOf('actief') + 1);
  return upto.filter((e, i) => e !== 'toets' || upto[i - 1] !== 'toets');
};

function newApp(flag: boolean) {
  reseed(0x1957);
  const app = createAppStoreContext();
  if (flag) app.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  return app;
}
const newStore = (flag: boolean): Store => newApp(flag).store;
function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => { open = resolve; });
  return { wait, open: () => open() };
}
const mcpContext = (app: ReturnType<typeof createAppStoreContext>, expectedDocId: string | null) => ({
  app, transactions: createMcpTransactions(app), expectedDocId, tempIdMap: new Map(),
  paused: false, readOnly: false, ensureBackup: async () => null, markDuplicateBorn: () => {},
});

function planIfc(name: string, task: string): string {
  const store = newStore(false);
  store.getState().newProject();
  store.getState().setProject({ name, startDate: '2026-01-05' });
  store.getState().addTask({ name: task });
  return writeIFC(buildWriteIFCInput(store.getState(), 'planOnly'));
}
const kantoorIfc = planIfc('Kantoor', 'Fundering');
const schoolIfc = planIfc('School', 'Dak');
const csvText = (() => {
  const store = newStore(false);
  store.getState().newProject();
  store.getState().setProject({ name: 'Lijst', startDate: '2026-01-05' });
  store.getState().addTask({ name: 'Rij' });
  const s = store.getState();
  return writeCSV(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments);
})();

const readOptions = (store: Store) => ({ ifcBytes: ifcForeignContentEnabled(store.getState().ui.featureFlags) });
const notices = (store: Store): string[][] => [
  ...store.getState().ui.notifications.map(n => [n.severity, n.messageKey]),
  ...store.getState().documents.filter(d => d.changedOnDisk).map(() => ['tabblad', CHANGED]),
];
const clearNotices = (store: Store) => store.setState(s => { s.ui.notifications = []; });
function tab(store: Store, id: string) {
  const doc = store.getState().getOpenDocumentPayloads().find(d => d.id === id)?.payload;
  return doc ? { project: doc.project.name, tasks: doc.tasks.map(t => t.name), isDirty: doc.isDirty, filePath: doc.filePath } : null;
}
const history = (store: Store) => JSON.stringify([store.getState().historyEvents, store.getState().nextHistorySequence]);

{
  type Payload = { filePath: string | null; fileHandle: FileSystemFileHandle | null; siteFileId: string | null;
    siteFileVersion: string | null; knownTargetFingerprint: { sha256: string; byteLength: number } | null };
  type Tab = { id: string; payload: Payload };
  const calls: string[] = [];
  const handleFor = (name: string, opts: { throws?: boolean; hold?: Promise<void> } = {}) => ({
    kind: 'file', name,
    isSameEntry: async (other: { name?: string }) => {
      calls.push(`${name}→${other.name}`);
      if (opts.hold) await opts.hold;
      if (opts.throws) throw new DOMException('weg', 'NotFoundError');
      return other.name === name;
    },
  }) as unknown as FileSystemFileHandle;
  const V1 = { sha256: 'aa', byteLength: 10 };
  const V2 = { sha256: 'bb', byteLength: 10 };
  const read = (fingerprint = V1) => ({ kind: 'bytes' as const, fingerprint });
  const state = (docs: Array<[string, Partial<Payload>]>): Tab[] => docs.map(([id, p]) => ({
    id, payload: { filePath: null, fileHandle: null, siteFileId: null, siteFileVersion: null, knownTargetFingerprint: V1, ...p },
  }));
  const asTabs = (tabs: Tab[]) => ({ getOpenDocumentPayloads: () => tabs }) as unknown as Parameters<typeof openTabFor>[0];
  type Ref = Parameters<typeof openTabFor>[1];
  const choose = (tabs: Tab[], ref: Ref, version: Parameters<typeof openTabFor>[3] = read(), lookup: Parameters<typeof openTabFor>[2] = null) =>
    openTabFor(asTabs(tabs), ref, lookup, version);
  const decide = (tabs: Tab[], ref: Ref) => choose(tabs, ref)?.id ?? null;
  const ticks = async () => { for (let i = 0; i < 20; i++) await new Promise<void>((r) => setTimeout(r, 0)); };
  const findId = async (tabs: Tab[], handle: FileSystemFileHandle) => {
    const lookup = startOpenLookup(asTabs(tabs), { kind: 'handle', handle });
    await ticks();
    return choose(tabs, { kind: 'handle', handle }, read(), lookup)?.id ?? null;
  };
  const path = (p: string) => ({ kind: 'path' as const, path: p });
  const handleA = handleFor('a.ifc');
  const docs = state([
    ['doc-pad', { filePath: '/plan/a.ifc' }],
    ['doc-win', { filePath: 'C:\\Werk\\Plan.ifc' }],
    ['doc-handle', { filePath: 'h.ifc', fileHandle: handleA }],
    ['doc-site', { filePath: 's.ifc', siteFileId: 'site-1', siteFileVersion: 'v1', knownTargetFingerprint: null }],
    ['doc-site-handle', { filePath: 'sh.ifc', fileHandle: handleFor('sh.ifc'), siteFileId: 'site-2', siteFileVersion: 'v1' }],
    ['doc-csv', { filePath: null }],
  ]);
  eq('A1 hetzelfde pad, dezelfde versie: wisselen zonder melding', choose(docs, path('/plan/a.ifc')), { id: 'doc-pad', changedOnDisk: false });
  eq('A2 een link (een andere padtekst) telt niet (knownbug 2063)', decide(docs, path('/plan/link-a.ifc')), null);
  eq('A4 POSIX is hoofdlettergevoelig', decide(docs, path('/plan/A.ifc')), null);
  eq('A5 geen normalisatie: een anders geschreven pad telt niet (ook op Windows)',
    [decide(docs, path('/plan/./a.ifc')), decide(docs, path('/plan/x/../a.ifc')), decide(docs, path('c:\\Werk\\.\\Plan.ifc'))], [null, null, null]);
  eq('A11 een tabblad met een handle telt niet voor een pad', decide(docs, path('h.ifc')), null);
  eq('A9 site: hetzelfde id en dezelfde versie', choose(docs, { kind: 'site', id: 'site-1' }, { kind: 'site', version: 'v1' }),
    { id: 'doc-site', changedOnDisk: false });
  eq('A9 site: een andere versie ⇒ wisselen met melding', choose(docs, { kind: 'site', id: 'site-1' }, { kind: 'site', version: 'v2' }),
    { id: 'doc-site', changedOnDisk: true });
  eq('A9 site: de versie van de lezing onbekend ⇒ geen wissel', choose(docs, { kind: 'site', id: 'site-1' }, null), null);
  eq('A9b site: ander id', choose(docs, { kind: 'site', id: 'site-9' }, { kind: 'site', version: 'v1' }), null);
  eq('V1 een andere hash ⇒ wisselen met melding', choose(docs, path('/plan/a.ifc'), read(V2)), { id: 'doc-pad', changedOnDisk: true });
  eq('V1 dezelfde hash, een andere grootte ⇒ met melding', choose(docs, path('/plan/a.ifc'), read({ sha256: 'aa', byteLength: 11 })),
    { id: 'doc-pad', changedOnDisk: true });
  eq('V2 het tabblad kent zijn versie niet ⇒ geen wissel (tweede tabblad, zoals main)',
    choose(state([['onbekend', { filePath: '/plan/a.ifc', knownTargetFingerprint: null }]]), path('/plan/a.ifc')), null);
  eq('V2 de lezing heeft geen hash ⇒ geen wissel', choose(docs, path('/plan/a.ifc'), null), null);
  eq('V3 een tabblad met dezelfde versie gaat voor een tabblad zonder of met een andere versie',
    choose(state([
      ['onbekend', { filePath: '/plan/a.ifc', knownTargetFingerprint: null }],
      ['anders', { filePath: '/plan/a.ifc', knownTargetFingerprint: V2 }],
      ['gelijk', { filePath: '/plan/a.ifc' }],
    ]), path('/plan/a.ifc')), { id: 'gelijk', changedOnDisk: false });
  eq('V3 zonder gelijke versie: het eerste tabblad met een bekende versie, met melding',
    choose(state([
      ['onbekend', { filePath: '/plan/a.ifc', knownTargetFingerprint: null }],
      ['anders', { filePath: '/plan/a.ifc', knownTargetFingerprint: V2 }],
    ]), path('/plan/a.ifc')), { id: 'anders', changedOnDisk: true });
  calls.length = 0;
  eq('A6 handle: isSameEntry waar, ander object', await findId(docs, handleFor('a.ifc')), 'doc-handle');
  eq('A6 richting: gevraagd.isSameEntry(tabblad), niet voor een site-tabblad', calls, ['a.ifc→a.ifc']);
  eq('A7 handle: isSameEntry onwaar', await findId(docs, handleFor('x.ifc')), null);
  eq('A8 handle: isSameEntry gooit ⇒ anders', await findId(docs, handleFor('a.ifc', { throws: true })), null);
  eq('A9c site wint van de handle van hetzelfde document', await findId(docs, handleFor('sh.ifc')), null);
  eq('A12 een tabblad met een pad telt niet voor een handle', await findId(state([['p', { filePath: '/plan/a.ifc' }]]), handleFor('/plan/a.ifc')), null);
  {
    const hold = gate();
    const tabs = state([
      ['traag', { filePath: 'x.ifc', fileHandle: handleFor('x.ifc') }],
      ['ander', { filePath: 'y.ifc', fileHandle: handleFor('y.ifc') }],
      ['zelfde', { filePath: 'a.ifc', fileHandle: handleFor('a.ifc') }],
    ]);
    calls.length = 0;
    const gevraagd = handleFor('a.ifc', { hold: hold.wait });
    const ref = { kind: 'handle' as const, handle: gevraagd };
    const lookup = startOpenLookup(asTabs(tabs), ref);
    eq('A19 tegelijk: alle drie de vergelijkingen direct gestart, ook voor een andere naam', [...calls].sort(), ['a.ifc→a.ifc', 'a.ifc→x.ifc', 'a.ifc→y.ifc']);
    await ticks();
    eq('A19 zolang ze vastzitten: geen treffer', choose(tabs, ref, read(), lookup), null);
    hold.open();
    await ticks();
    eq('A19 de treffer op de laatste plaats', choose(tabs, ref, read(), lookup)?.id, 'zelfde');
    const stuck = gate();
    const slowTabs = state([
      ['vast', { filePath: 'x.ifc', fileHandle: { kind: 'file', name: 'x.ifc' } as unknown as FileSystemFileHandle }],
      ['zelfde', { filePath: 'a.ifc', fileHandle: handleFor('a.ifc') }],
    ]);
    const req = { kind: 'file', name: 'a.ifc',
      isSameEntry: async (other: { name?: string }) => { if (other.name === 'x.ifc') { await stuck.wait; return false; } return other.name === 'a.ifc'; },
    } as unknown as FileSystemFileHandle;
    const early = startOpenLookup(asTabs(slowTabs), { kind: 'handle', handle: req });
    await ticks();
    eq('A19b een treffer telt zodra hij binnen is, ook als een andere vergelijking nog loopt',
      choose(slowTabs, { kind: 'handle', handle: req }, read(), early)?.id, 'zelfde');
    stuck.open();
  }
  {
    const tabs = state([
      ['eerste', { filePath: 'a.ifc', fileHandle: handleFor('a.ifc') }],
      ['tweede', { filePath: 'a.ifc', fileHandle: handleFor('a.ifc') }],
    ]);
    const ref = { kind: 'handle' as const, handle: handleFor('a.ifc') };
    const lookup = startOpenLookup(asTabs(tabs), ref);
    await ticks();
    eq('A20 (Sol, ronde 7): twee bevestigde treffers; de eerste sluit vóór de beslissing ⇒ de tweede',
      choose(tabs.slice(1), ref, read(), lookup)?.id, 'tweede');
    const moved = [{ ...tabs[0], payload: { ...tabs[0].payload, fileHandle: handleFor('ander.ifc') } }];
    eq('A20 een treffer telt niet meer als het tabblad intussen een andere handle kreeg (Opslaan als)',
      choose(moved, ref, read(), lookup), null);
  }
  eq('A17 synchroon: dezelfde padtekst', decide(docs, path('/plan/a.ifc')), 'doc-pad');
}

{
  const dir = mkdtempSync(join(tmpdir(), 'ops-1957-'));
  const kantoor = join(dir, 'kantoor.ifc');
  const school = join(dir, 'school.ifc');
  const kopie = join(dir, 'kopie-van-school.ifc');
  const link = join(dir, 'link-naar-kantoor.ifc');
  const csv = join(dir, 'lijst.csv');
  writeFileSync(kantoor, kantoorIfc);
  writeFileSync(school, schoolIfc);
  copyFileSync(school, kopie);
  symlinkSync(kantoor, link);
  writeFileSync(csv, csvText);
  const ipc = installNodeFileIpc({ appDataDir: mkdtempSync(join(tmpdir(), 'ops-1957-appdata-')) });
  const tauriWin = (globalThis as unknown as { window: Record<string, unknown> }).window;
  tauriWin.parent = tauriWin;
  let dialogAnswer: string | null = null;
  let saveAnswer: string | null = null;
  const internals = tauriWin.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
  const innerInvoke = internals.invoke;
  internals.invoke = async (command, args, options) => {
    if (command === 'plugin:dialog|open') return dialogAnswer;
    if (command === 'plugin:dialog|save') return saveAnswer;
    return innerInvoke(command, args, options);
  };
  const io = await tauriOpenIO();
  const openVia = async (store: Store, how: 'openen' | 'link' | 'recent' | 'slepen', file = kantoor) => {
    if (how === 'openen' || how === 'link') {
      dialogAnswer = how === 'link' ? link : file;
      await store.getState().openFile(labels);
    } else if (how === 'recent') {
      let entry = store.getState().recentFiles.find(e => e.ref.kind === 'path' && e.ref.path === file);
      if (!entry) {
        entry = { id: `recent-${file}`, ref: { kind: 'path', path: file }, name: file.split('/').pop()!, addedAt: 1 };
        const own = entry;
        store.setState(s => { s.recentFiles = [own, ...s.recentFiles]; });
      }
      await store.getState().openRecentFile(entry.id, labels);
    } else {
      await openDroppedFiles(store, droppedFilesFromPaths([file], io, readOptions(store)), labels, () => false, { readOptions: readOptions(store) });
    }
  };
  try {
    const store = newStore(true);
    const S = () => store.getState();
    dialogAnswer = kantoor;
    await S().openFile(labels);
    const a = S().activeDocumentId;
    S().addTask({ name: 'Onopgeslagen werk' });
    dialogAnswer = school;
    S().newDocument();
    await S().openFile(labels);
    const b = S().activeDocumentId;
    eq('B0 voorwaarde: twee tabbladen, A gewijzigd op kantoor', [S().documents.length, a !== b, tab(store, a)],
      [2, true, { project: 'Kantoor', tasks: ['Fundering', 'Onopgeslagen werk'], isDirty: true, filePath: kantoor }]);
    const tabA = tab(store, a);
    const historyBefore = history(store);
    for (const how of ['openen', 'recent', 'slepen'] as const) {
      S().switchDocument(b);
      clearNotices(store);
      await openVia(store, how);
      eq(`B1 ${how}: geen tweede tabblad`, S().documents.length, 2);
      eq(`B1 ${how}: het tabblad met kantoor is actief`, S().activeDocumentId, a);
      eq(`B1 ${how}: dat tabblad houdt zijn werk`, tab(store, a), tabA);
      eq(`B1 ${how}: ongedaan maken onveranderd`, history(store), historyBefore);
      eq(`B1 ${how}: dezelfde versie, geen melding`, notices(store), []);
      eq(`B1 ${how}: Recent bijgewerkt`, S().recentFiles[0]?.ref, { kind: 'path', path: kantoor });
      eq(`B1 ${how}: B onveranderd`, tab(store, b), { project: 'School', tasks: ['Dak'], isDirty: false, filePath: school });
    }
    {
      S().switchDocument(b);
      clearNotices(store);
      await openVia(store, 'link');
      const viaLink = S().activeDocumentId;
      eq('B1 link: een eigen tabblad met de inhoud van het bestand, geen melding', [
        S().documents.length, ![a, b].includes(viaLink), S().filePath, S().tasks.map(t => t.name), notices(store).filter(n => n[1] === CHANGED),
      ], [3, true, link, ['Fundering'], []]);
      eq('B1 link: A houdt zijn werk', tab(store, a), tabA);
      S().closeDocument(viaLink);
      S().switchDocument(a);
    }
    S().undo();
    eq('B2 ongedaan maken in A na de wissel', S().tasks.map(t => t.name), ['Fundering']);
    S().redo();

    clearNotices(store);
    await openDroppedFiles(store, droppedFilesFromPaths([kopie, kopie], io, { ifcBytes: true }), labels, () => false, { readOptions: { ifcBytes: true } });
    const c = S().activeDocumentId;
    eq('B3 kopie: een eigen tabblad', [S().documents.length, tab(store, c)?.filePath, tab(store, c)?.project], [3, kopie, 'School']);
    eq('B3 tweede neerzetting van dezelfde kopie: naar dat tabblad, geen melding', [S().documents.length, notices(store)], [3, []]);

    S().addTask({ name: 'Werk in de kopie' });
    clearNotices(store);
    dialogAnswer = csv;
    await S().openFile(labels);
    S().addTask({ name: 'Werk in de CSV' });
    await S().openFile(labels);
    eq('B4 CSV twee keer: twee tabbladen, geen melding', [S().documents.length, notices(store).filter(n => n[1] === CHANGED)], [5, []]);
    store.setState(s => { s.ui.pendingFormatNotice = null; });

    S().switchDocument(b);
    clearNotices(store);
    const opened = await readOpenedPath(kantoor, true);
    let polls = 0;
    await S().openOpenedFile(opened, labels, {
      waitWhile: () => {
        polls++;
        if (polls === 1) S().closeDocument(a);
        return polls < 3;
      },
    });
    const reopened = S().activeDocumentId;
    eq('B5 gesloten tijdens het wachten: het bestand opent in een eigen tabblad', [
      S().documents.some(d => d.id === a), reopened !== b, tab(store, reopened),
    ], [false, true, { project: 'Kantoor', tasks: ['Fundering'], isDirty: false, filePath: kantoor }]);
    eq('B5 geen melding', notices(store).filter(n => n[1] === CHANGED), []);

    const doel = join(dir, 'doel.ifc');
    writeFileSync(doel, schoolIfc);
    const oud = await readOpenedPath(doel, true);
    S().newDocument();
    S().setProject({ name: 'Opslaander', startDate: '2026-01-05' });
    S().addTask({ name: 'Nieuw werk' });
    const saver = S().activeDocumentId;
    const countBefore = S().documents.length;
    let release: () => void = () => { throw new Error('read() is nog niet aangeroepen'); };
    const slow = { name: 'doel.ifc', read: () => new Promise<typeof oud>((resolve) => { release = () => resolve(oud); }) };
    const opening = openDroppedFiles(store, [slow], labels, () => false);
    saveAnswer = doel;
    await S().saveFileAs();
    eq('B7 voorwaarde: Opslaan als schreef doel.ifc', [S().filePath, S().isDirty], [doel, false]);
    clearNotices(store);
    release();
    await opening;
    eq('B7 1909: geen tweede tabblad met de oude inhoud', [S().documents.length, S().activeDocumentId], [countBefore, saver]);
    eq('B7 1909: het tabblad dat opsloeg, met zijn werk', tab(store, saver), { project: 'Opslaander', tasks: ['Nieuw werk'], isDirty: false, filePath: doel });
    eq('B7 1909: de lezing is ouder dan wat het tabblad opsloeg; de melding met de knop', notices(store), [['tabblad', CHANGED]]);

    for (const during of ['wachtende neerzetting'] as const) {
      const st = newStore(true);
      const T = () => st.getState();
      dialogAnswer = kantoor;
      await T().openFile(labels);
      const a = T().activeDocumentId;
      T().addTask({ name: 'Nieuwe versie' });
      T().newDocument();
      dialogAnswer = school;
      await T().openFile(labels);
      const b = T().activeDocumentId;
      const renamed = join(dir, 'nieuwe-naam-wacht.ifc');
      let opening: Promise<void>;
      let release: () => void = () => undefined;
      const halted = new Promise<void>((resolve) => {
        let calls = 0;
        let blocked = true;
        release = () => { blocked = false; };
        opening = openDroppedFiles(st, droppedFilesFromPaths([kantoor], io, readOptions(st)), labels, () => {
          if (++calls === 1) return false;
          resolve();
          return blocked;
        }, { readOptions: readOptions(st) });
      });
      await halted;
      T().switchDocument(a);
      saveAnswer = renamed;
      await T().saveFileAs();
      eq(`B8 ${during}: voorwaarde, Opslaan als zette A op een nieuwe naam`, T().filePath, renamed);
      T().switchDocument(b);
      clearNotices(st);
      release();
      await opening!;
      eq(`B8 ${during}: het gevraagde bestand opent in een eigen tabblad`, [
        ![a, b].includes(T().activeDocumentId), T().filePath, T().project.name, T().tasks.map(t => t.name), T().documents.length,
      ], [true, kantoor, 'Kantoor', ['Fundering'], 3]);
      eq(`B8 ${during}: geen melding`, notices(st).filter(n => n[1] === CHANGED), []);
      eq(`B8 ${during}: A houdt zijn nieuwe naam en zijn werk`, tab(st, a), {
        project: 'Kantoor', tasks: ['Fundering', 'Nieuwe versie'], isDirty: false, filePath: renamed,
      });
    }

    {
      const st = newStore(true);
      const T = () => st.getState();
      const outside = join(dir, 'andere-map');
      mkdirSync(join(outside, 'sub'), { recursive: true });
      symlinkSync(join(outside, 'sub'), join(dir, 'maplink'));
      writeFileSync(join(outside, 'kantoor.ifc'), schoolIfc);
      const viaLink = `${dir}/maplink/../kantoor.ifc`;
      dialogAnswer = kantoor;
      await T().openFile(labels);
      const first = T().activeDocumentId;
      T().addTask({ name: 'Werk in kantoor' });
      clearNotices(st);
      dialogAnswer = viaLink;
      await T().openFile(labels);
      eq('B9 maplink/..: een ander bestand, een eigen tabblad', [
        statSync(viaLink).ino !== statSync(kantoor).ino, T().activeDocumentId !== first, T().project.name, T().documents.length,
      ], [true, true, 'School', 2]);
      eq('B9 maplink/..: geen melding', notices(st).filter(n => n[1] === CHANGED), []);
      dialogAnswer = `${dir}/./kantoor.ifc`;
      await T().openFile(labels);
      eq('B9 ./kantoor.ifc: een andere padtekst, een eigen tabblad (2063); kantoor houdt zijn werk', [
        T().activeDocumentId !== first, T().documents.length, tab(st, first)?.tasks,
      ], [true, 3, ['Fundering', 'Werk in kantoor']]);
    }

    {
      const { readFileSync } = await import('node:fs');
      type Route = 'openen' | 'recent' | 'slepen' | 'MCP';
      const race = async (flag: boolean, route: Route, closeAfterSave: boolean) => {
        writeFileSync(kantoor, kantoorIfc);
        const app = newApp(flag);
        const st = app.store;
        const T = () => st.getState();
        dialogAnswer = school;
        await T().openFile(labels);
        const saving = T().activeDocumentId;
        T().addTask({ name: 'Net opgeslagen werk' });
        st.setState(s => { s.recentFiles = [{ id: 'r', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
        const saveAs = async () => {
          T().switchDocument(saving);
          saveAnswer = kantoor;
          await T().saveFileAs();
          if (closeAfterSave && !T().isDirty) T().closeDocument(saving);
        };
        let gated = false, inSave = false, reads = 0;
        const outer = internals.invoke;
        internals.invoke = async (command, args, options) => {
          const at = (args as { path?: string } | undefined)?.path;
          if (!gated && command === 'plugin:fs|stat' && at === kantoor) {
            gated = true; inSave = true;
            try { await saveAs(); } finally { inSave = false; }
          }
          if (!inSave && /^plugin:fs\|read_(text_)?file$/.test(command) && at === kantoor) reads++;
          return outer(command, args, options);
        };
        const getFs = fileToolDeps.getFs;
        fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
        clearNotices(st);
        try {
          if (route === 'MCP') await getTool('planner_import_schedule')!.handler({ path: kantoor }, mcpContext(app, T().activeDocumentId));
          else if (route === 'recent') await T().openRecentFile('r', labels);
          else await openVia(st, route);
        } finally {
          internals.invoke = outer;
          fileToolDeps.getFs = getFs;
        }
        if (!gated) await saveAs();
        return { st, T, saving, gated, reads };
      };
      for (const route of ['openen', 'recent', 'slepen'] as const) {
        {
          const { st, T, saving } = await race(false, route, false);
          eq(`R2 ${route} flag uit: zoals main weigert Opslaan als, het werk blijft gewijzigd, het bestand bytegelijk`, [
            readFileSync(kantoor, 'utf8') === kantoorIfc, tab(st, saving)?.isDirty,
            T().getOpenDocumentPayloads().filter(d => d.payload.filePath === kantoor).length,
            notices(st).some(n => n[1] === 'notifications.ifcForeignTargetOpenInTab'),
          ], [true, true, 1, true]);
        }
      }
      writeFileSync(kantoor, kantoorIfc);
    }

    {
      const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
      for (const route of ['openen', 'recent', 'slepen', 'MCP'] as const) {
        writeFileSync(kantoor, kantoorIfc);
        const app = newApp(true);
        const st = app.store;
        const T = () => st.getState();
        await openVia(st, 'openen', school);
        st.setState(s => { s.recentFiles = [{ id: 'k', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
        const release = gate();
        let running = false, stats = 0;
        const holdStat = async (path: string) => {
          stats++;
          if (path === school && !running) { running = true; await release.wait; running = false; }
        };
        const outer = internals.invoke;
        internals.invoke = async (command, args, options) => {
          if (command === 'plugin:fs|stat') await holdStat((args as { path?: string }).path ?? '');
          else if (command.startsWith('plugin:fs|') && running) await release.wait;
          return outer(command, args, options);
        };
        const getFs = fileToolDeps.getFs;
        const fs = await realFs();
        fileToolDeps.getFs = async () => ({ ...fs, homeDir: async () => dir, stat: async (path: string) => { await holdStat(path); return fs.stat(path); } });
        let opening: Promise<unknown>;
        if (route === 'MCP') opening = Promise.resolve(getTool('planner_import_schedule')!.handler({ path: kantoor }, mcpContext(app, T().activeDocumentId)));
        else if (route === 'recent') opening = T().openRecentFile('k', labels);
        else opening = openVia(st, route, kantoor);
        try {
          const done = await Promise.race([opening.then(() => true), sleep(120).then(() => false)]);
          eq(`D3 ${route} (Sol, ronde 6): een vastgehouden stat van een ander tabblad houdt het openen niet op; geen stat`, [
            done, stats, T().project.name,
          ], [true, 0, 'Kantoor']);
        } finally {
          release.open();
          internals.invoke = outer;
          fileToolDeps.getFs = getFs;
          await opening.catch(() => undefined);
        }
      }
      writeFileSync(kantoor, kantoorIfc);
    }

    {
      const { readFileSync, unlinkSync } = await import('node:fs');
      writeFileSync(kantoor, kantoorIfc);
      const app = newApp(true);
      const st = app.store;
      const T = () => st.getState();
      await openVia(st, 'openen', kantoor);
      const kantoorTab = T().activeDocumentId;
      const getFs = fileToolDeps.getFs;
      const fs = await realFs();
      let readProject = '';
      fileToolDeps.getFs = async () => ({
        ...fs, homeDir: async () => dir,
        readFile: async (path: string) => {
          if (path === link) {
            await new Promise<void>(resolve => setImmediate(resolve));
            unlinkSync(link);
            symlinkSync(school, link);
            readProject = readFileSync(path, 'utf8') === schoolIfc ? 'School' : 'anders';
          }
          return fs.readFile(path);
        },
      });
      try {
        const ctx = mcpContext(app, kantoorTab);
        const result = await getTool('planner_import_schedule')!.handler({ path: link }, ctx);
        const data = result.ok ? result.data as { documentId: string; alreadyOpen?: boolean } : null;
        const updated = await getTool('planner_update_project')!.handler({ name: 'Nieuwe projectnaam' }, ctx);
        const exportedPath = join(dir, 'uitvoer-d2.ifc');
        const exported = await getTool('planner_export_ifc')!.handler({ path: exportedPath }, ctx);
        const bytes = readFileSync(exportedPath, 'utf8');
        const deleted = await getTool('planner_delete_tasks')!.handler({ ids: [T().tasks[0].id] }, ctx);
        await T().saveFile();
        const kantoorAfter = readFileSync(kantoor, 'utf8');
        eq('D2 MCP, een link die tijdens het lezen naar School gaat (Sol, ronde 6): alles blijft bij School, zoals main', [
          readProject, result.ok, data?.documentId === kantoorTab, data?.alreadyOpen, ctx.expectedDocId === data?.documentId,
          updated.ok, exported.ok, bytes.includes('Dak'), bytes.includes('Fundering'), deleted.ok,
          tab(st, kantoorTab)?.project, kantoorAfter === kantoorIfc,
        ], ['School', true, false, undefined, true, true, true, true, false, true, 'Kantoor', true]);
      } finally {
        fileToolDeps.getFs = getFs;
        unlinkSync(link);
        symlinkSync(kantoor, link);
      }
      writeFileSync(school, schoolIfc);
      writeFileSync(kantoor, kantoorIfc);
    }

    {
      const { readFileSync } = await import('node:fs');
      writeFileSync(kantoor, kantoorIfc);
      const app = newApp(true);
      const st = app.store;
      const T = () => st.getState();
      await openVia(st, 'openen', school);
      const writerId = T().activeDocumentId;
      T().addTask({ name: 'Net opgeslagen werk' });
      clearNotices(st);
      const releaseLookup = gate(), placement = gate(), releasePlacement = gate();
      const getFs = fileToolDeps.getFs;
      let waitingAtStat = false, placing = false, reads = 0;
      const fs = await realFs();
      fileToolDeps.getFs = async () => ({
        ...fs, homeDir: async () => dir,
        stat: async (path: string) => { if (path === kantoor && !waitingAtStat) { waitingAtStat = true; await releaseLookup.wait; } return fs.stat(path); },
        readFile: (path: string) => { if (path === kantoor) reads++; return fs.readFile(path); },
      });
      ipc.faults.place = async (from) => {
        if (from === kantoor && !placing) { placing = true; placement.open(); await releasePlacement.wait; }
        return undefined;
      };
      try {
        let importDone = false;
        const importing = Promise.resolve(getTool('planner_import_schedule')!.handler({ path: kantoor }, mcpContext(app, writerId))).finally(() => { importDone = true; });
        await new Promise<void>(r => setTimeout(r, 120));
        const first = importDone ? 'import voltooid' : waitingAtStat ? 'toets wacht' : 'onverwachte fase';
        const openBeforeSave = T().getOpenDocumentPayloads().some(d => d.payload.filePath === kantoor);
        T().switchDocument(writerId);
        saveAnswer = kantoor;
        const saving = T().saveFileAs();
        const writeStage = await Promise.race([saving.then(() => 'opslag terug'), placement.wait.then(() => 'plaatsing wacht')]);
        releaseLookup.open();
        const response = await importing as { ok: boolean; data?: { documentId: string } };
        releasePlacement.open();
        await saving;
        const savedBytes = readFileSync(kantoor, 'utf8');
        const saveNotices = notices(st).map(n => n[1]);
        const atTarget = T().getOpenDocumentPayloads().filter(d => d.payload.filePath === kantoor).length;
        const writerDirty = tab(st, writerId)?.isDirty;
        T().switchDocument(response.data!.documentId);
        T().addTask({ name: 'Vervolgwerk' });
        clearNotices(st);
        await T().saveFile();
        const final = readFileSync(kantoor, 'utf8');
        eq('P2 MCP en een lopende opslag (Sol, ronde 5): zoals main', [
          first, writeStage, openBeforeSave, response.ok, savedBytes === kantoorIfc, saveNotices.includes('notifications.ifcForeignTargetOpenInTab'),
          atTarget, writerDirty, reads, final.includes('Vervolgwerk'), final.includes('Net opgeslagen werk'), notices(st),
        ], ['import voltooid', 'opslag terug', true, true, true, true, 1, true, 1, true, false, []]);
      } finally {
        releaseLookup.open();
        releasePlacement.open();
        ipc.faults.place = null;
        fileToolDeps.getFs = getFs;
      }
      writeFileSync(kantoor, kantoorIfc);
    }

    {
      if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
        Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: {} } });
      }
      const { SHORTCUTS } = await import('@/hooks/keyboard/shortcutRegistry');
      const editTask = SHORTCUTS.find(shortcut => shortcut.id === 'edit.editTask')!;
      for (const route of ['openen', 'recent'] as const) {
        writeFileSync(kantoor, kantoorIfc);
        const st = newStore(true);
        const T = () => st.getState();
        await openVia(st, 'openen', kantoor);
        await openVia(st, 'openen', school);
        const schoolId = T().activeDocumentId;
        st.setState(s => { s.recentFiles = [{ id: 'k', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
        const release = gate();
        let waiting = false;
        const outer = internals.invoke;
        internals.invoke = async (command, args, options) => {
          if ((args as { path?: string } | undefined)?.path === kantoor && command === 'plugin:fs|stat' && !waiting) { waiting = true; await release.wait; }
          return outer(command, args, options);
        };
        let done = false;
        const opening = (route === 'recent' ? T().openRecentFile('k', labels) : openVia(st, 'openen', kantoor)).finally(() => { done = true; });
        try {
          await new Promise<void>(r => setTimeout(r, 150));
          const doneAtF2 = done;
          T().switchDocument(schoolId);
          const taskId = T().tasks[0].id;
          T().selectTask(taskId);
          editTask.run(T());
          const dialogAtF2 = T().ui.showTaskDialog;
          release.open();
          await opening;
          eq(`P3 ${route} (Sol, ronde 5): F2 terwijl de toets vastzit; de openactie was klaar, de taakdialoog blijft open`, [
            doneAtF2, dialogAtF2, T().ui.showTaskDialog, T().ui.editingTaskId === taskId, T().activeDocumentId === schoolId,
          ], [true, true, true, true, true]);
          T().setUI({ showTaskDialog: false, editingTaskId: null });
        } finally {
          release.open();
          internals.invoke = outer;
        }
      }
    }

    {
      const { realpathSync, unlinkSync } = await import('node:fs');
      const other = join(dir, 'andere-map');
      mkdirSync(join(other, 'sub'), { recursive: true });
      symlinkSync(join(other, 'sub'), join(dir, 'maplink2'));
      const alias = `${dir}/maplink2/../kantoor.ifc`;
      const aliasTarget = join(other, 'kantoor.ifc');
      writeFileSync(aliasTarget, schoolIfc);
      writeFileSync(kantoor, kantoorIfc);
      const st = newStore(true);
      const T = () => st.getState();
      await openVia(st, 'openen', alias);
      const aliasId = T().activeDocumentId;
      const precondition = [realpathSync.native(alias) !== realpathSync.native(kantoor), T().project.name];
      T().newDocument();
      await openVia(st, 'openen', school);
      clearNotices(st);
      unlinkSync(aliasTarget);
      await openVia(st, 'openen', kantoor);
      eq('B11 verdwenen alias: Kantoor opent, niet het tabblad van de alias', [
        ...precondition, T().activeDocumentId === aliasId, T().project.name, T().filePath, notices(st),
      ], [true, 'School', false, 'Kantoor', kantoor, []]);
    }

    for (const route of ['openen', 'recent', 'slepen', 'MCP'] as const) {
      writeFileSync(kantoor, kantoorIfc);
      const app = newApp(false);
      const st = app.store;
      const T = () => st.getState();
      await openVia(st, 'openen', kantoor);
      const kantoorTab = T().activeDocumentId;
      await openVia(st, 'openen', school);
      st.setState(s => { s.recentFiles = [{ id: 'k', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
      clearNotices(st);
      const reading = gate(), release = gate();
      let reads = 0, stats = 0;
      const outer = internals.invoke;
      internals.invoke = async (command, args, options) => {
        const at = (args as { path?: string } | undefined)?.path;
        if (command === 'plugin:fs|stat') stats++;
        if (at === kantoor && /^plugin:fs\|read_(text_)?file$/.test(command)) { reads++; reading.open(); await release.wait; }
        return outer(command, args, options);
      };
      const getFs = fileToolDeps.getFs;
      fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
      let opening: Promise<unknown>;
      if (route === 'MCP') opening = Promise.resolve(getTool('planner_import_schedule')!.handler({ path: kantoor }, mcpContext(app, T().activeDocumentId)));
      else if (route === 'recent') opening = T().openRecentFile('k', labels);
      else opening = openVia(st, route, kantoor);
      try {
        await reading.wait;
        st.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
        release.open();
        await opening;
        eq(`P4 ${route} (Sol, ronde 6): de flag gaat aan tijdens het lezen; geen wissel, zoals main`, [
          reads, stats, T().activeDocumentId === kantoorTab, T().documents.length, T().project.name, notices(st).filter(n => n[1] === CHANGED),
        ], [1, 0, false, 3, 'Kantoor', []]);
      } finally {
        release.open();
        internals.invoke = outer;
        fileToolDeps.getFs = getFs;
      }
    }

    {
      const { linkSync } = await import('node:fs');
      writeFileSync(kantoor, kantoorIfc);
      const st = newStore(true);
      const T = () => st.getState();
      await openVia(st, 'openen', kantoor);
      const kantoorTab = T().activeDocumentId;
      let stats = 0;
      const outer = internals.invoke;
      internals.invoke = async (command, args, options) => {
        if (command === 'plugin:fs|stat') stats++;
        return outer(command, args, options);
      };
      try {
        clearNotices(st);
        await openVia(st, 'openen', csv);
        const plain = [T().activeDocumentId !== kantoorTab, T().filePath, T().tasks.map(t => t.name)];
        const csvAlias = join(dir, 'kantoor-als.csv');
        linkSync(kantoor, csvAlias);
        writeFileSync(csvAlias, csvText);
        await openVia(st, 'openen', csvAlias);
        const viaHardlink = [T().activeDocumentId !== kantoorTab, T().filePath, T().tasks.map(t => t.name)];
        st.setState(s => { s.filePath = null; });
        T().switchDocument(kantoorTab);
        st.setState(s => { s.filePath = csv; });
        await openVia(st, 'openen', csv);
        const samePathText = [T().activeDocumentId !== kantoorTab, T().filePath];
        eq('P5 CSV (Sol, ronde 6): geen stat, geen wissel, een eigen tabblad zonder opslagdoel, zoals main', [
          stats, plain, viaHardlink, samePathText, notices(st).filter(n => n[1] === CHANGED),
        ], [0, [true, null, ['Rij']], [true, null, ['Rij']], [true, null], []]);
      } finally {
        internals.invoke = outer;
        writeFileSync(kantoor, kantoorIfc);
      }
    }

    {
      const { readFileSync } = await import('node:fs');
      const { lowerModelOpenLimitForTests } = await import('@/services/ifc/modelOpenLimit');
      const modelBytes = readFileSync('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
      const groot = join(dir, 'model-groot.ifc');
      writeFileSync(groot, modelBytes);
      const app = newApp(true);
      const st = app.store;
      const T = () => st.getState();
      dialogAnswer = groot;
      await T().openFile(labels);
      const modelTab = T().activeDocumentId;
      eq('2043 voorwaarde: het model is open, met zijn bron', [T().filePath, !!T().ifcSource?.foreign], [groot, true]);
      T().newDocument();
      dialogAnswer = school;
      await T().openFile(labels);
      const schoolTab = T().activeDocumentId;
      const getFs = fileToolDeps.getFs;
      fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
      lowerModelOpenLimitForTests(modelBytes.length - 1);
      try {
        for (const route of ['openen', 'recent', 'slepen', 'MCP'] as const) {
          T().switchDocument(schoolTab);
          clearNotices(st);
          const count = T().documents.length;
          let mcpError: string | null = null;
          if (route === 'MCP') {
            const r = await getTool('planner_import_schedule')!.handler({ path: groot }, mcpContext(app, schoolTab)) as { ok: boolean; code?: string; error?: string };
            mcpError = r.ok ? null : `${r.code}: ${r.error ?? ''}`;
          } else if (route === 'recent') {
            st.setState(s => { s.recentFiles = [{ id: 'g', ref: { kind: 'path', path: groot }, name: 'model-groot.ifc', addedAt: 1 }]; });
            await T().openRecentFile('g', labels);
          } else {
            await openVia(st, route, groot);
          }
          eq(`2043 ${route}: model boven de grens dat al open staat; de groottemelding, geen wissel, geen tweede tabblad`, [
            T().activeDocumentId === schoolTab, T().documents.length === count,
            T().getOpenDocumentPayloads().some(d => d.id === modelTab && d.payload.filePath === groot),
            route === 'MCP' ? /^VALIDATION: .*IFC open refused/.test(mcpError ?? '') : notices(st).some(n => n[1] === 'notifications.ifcForeignOpenTooLarge'),
            notices(st).filter(n => n[1] === CHANGED).length,
          ], [true, true, true, true, 0]);
        }
      } finally {
        lowerModelOpenLimitForTests();
        fileToolDeps.getFs = getFs;
      }
      const { removeRecent } = await import('@/services/fileAccess/recentFiles');
      for (const e of T().recentFiles.filter(e => e.ref.kind === 'path' && e.ref.path === groot)) await removeRecent(e.id);
    }

    for (const route of ['openen', 'recent', 'slepen'] as const) {
      writeFileSync(kantoor, kantoorIfc);
      const st = newStore(true);
      const T = () => st.getState();
      dialogAnswer = school;
      await T().openFile(labels);
      st.setState(s => { s.recentFiles = [{ id: 'r', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
      let flipped = false;
      const outer = internals.invoke;
      internals.invoke = async (command, args, options) => {
        if (!flipped && /^plugin:fs\|read_(text_)?file$/.test(command) && (args as { path?: string }).path === kantoor) {
          flipped = true;
          st.setState(s => { s.ui.featureFlags = {}; });
        }
        return outer(command, args, options);
      };
      clearNotices(st);
      try {
        if (route === 'recent') await T().openRecentFile('r', labels);
        else await openVia(st, route);
      } finally { internals.invoke = outer; }
      eq(`R7 ${route}: flag uit tijdens het lezen; Kantoor opent, geen openFailed`, [
        flipped, T().project.name, T().tasks.map(t => t.name), T().filePath,
        notices(st).filter(n => n[0] === 'error').map(n => n[1]),
      ], [true, 'Kantoor', ['Fundering'], kantoor, []]);
    }

    {
      const { readFileSync } = await import('node:fs');
      const ifcFormat = allReadFormats().find(f => f.extensions.includes('ifc'))!;
      const parse = ifcFormat.read;
      for (const flag of [true, false]) {
        writeFileSync(kantoor, kantoorIfc);
        const app = newApp(flag);
        const st = app.store;
        const T = () => st.getState();
        dialogAnswer = school;
        await T().openFile(labels);
        const savingTab = T().activeDocumentId;
        T().addTask({ name: 'Werk uit Opslaan als' });
        const placementStarted = gate();
        const releasePlacement = gate();
        let parsed = false, saveStarted = false, statHeld = false, placementHeld = false, reads = 0;
        let openAtFirstTurn: boolean | null = null;
        let saving: Promise<void> = Promise.resolve();
        ifcFormat.read = async (input, l, o) => {
          const result = await parse(input, l, o);
          if (input.name === kantoor && !parsed) {
            parsed = true;
            setImmediate(() => { openAtFirstTurn = T().getOpenDocumentPayloads().some(d => d.payload.filePath === kantoor); });
            setImmediate(() => {
              saveStarted = true;
              T().switchDocument(savingTab);
              saveAnswer = kantoor;
              saving = T().saveFileAs().finally(() => placementStarted.open());
            });
          }
          return result;
        };
        const outer = internals.invoke;
        internals.invoke = async (command, args, options) => {
          if (parsed && !saveStarted && !statHeld && command === 'plugin:fs|stat' && (args as { path?: string }).path === kantoor) {
            statHeld = true;
            await placementStarted.wait;
          }
          return outer(command, args, options);
        };
        ipc.faults.place = async (from, to) => {
          if (placementHeld || ![from, to].includes(kantoor)) return undefined;
          placementHeld = true;
          placementStarted.open();
          await releasePlacement.wait;
          return undefined;
        };
        const getFs = fileToolDeps.getFs;
        fileToolDeps.getFs = async () => {
          const fs = await realFs();
          return {
            ...fs, homeDir: async () => dir,
            readFile: (path: string) => { if (path === kantoor) reads++; return fs.readFile(path); },
            readTextFile: (path: string) => { if (path === kantoor) reads++; return fs.readTextFile(path); },
          };
        };
        clearNotices(st);
        let result: Awaited<ReturnType<NonNullable<ReturnType<typeof getTool>>['handler']>>;
        let bytesWhenAnswered = '';
        try {
          result = await getTool('planner_import_schedule')!.handler({ path: kantoor }, mcpContext(app, savingTab));
          bytesWhenAnswered = readFileSync(kantoor, 'utf8');
        } finally {
          releasePlacement.open();
          await new Promise<void>((resolve) => setImmediate(resolve));
          await saving.catch(() => undefined);
          ifcFormat.read = parse;
          internals.invoke = outer;
          ipc.faults.place = null;
          fileToolDeps.getFs = getFs;
        }
        const data = result.ok ? result.data as { documentId: string; filePath: string } : null;
        eq(`R4 MCP flag ${flag ? 'aan' : 'uit'}: opslag na het parsen; MCP opende Kantoor en las één keer`, [
          parsed, saveStarted, data?.filePath, tab(st, data?.documentId ?? '')?.project, reads, bytesWhenAnswered === kantoorIfc,
          openAtFirstTurn,
        ], [true, true, kantoor, 'Kantoor', 1, true, true]);
        eq(`R4 MCP flag ${flag ? 'aan' : 'uit'}: zoals main weigert Opslaan als, School blijft gewijzigd, kantoor bytegelijk`, [
          statHeld, placementHeld, readFileSync(kantoor, 'utf8') === kantoorIfc, tab(st, savingTab)?.isDirty,
          tab(st, savingTab)?.filePath, T().getOpenDocumentPayloads().filter(d => d.payload.filePath === kantoor).length,
          notices(st).some(n => n[1] === 'notifications.ifcForeignTargetOpenInTab'),
        ], [false, false, true, true, school, 1, true]);
      }
      writeFileSync(kantoor, kantoorIfc);
    }

    {
      const { readFileSync } = await import('node:fs');
      const releaseAfter = (n: number, open: () => void) => { if (n <= 0) open(); else queueMicrotask(() => releaseAfter(n - 1, open)); };
      const seen = new Set<string>();
      const orders: (number | 'Openen eerst klaar' | 'MCP eerst klaar')[] = [...Array.from({ length: 25 }, (_, i) => i - 12), 'Openen eerst klaar', 'MCP eerst klaar'];
      for (const uiAt of [school]) for (const offset of orders) {
        writeFileSync(kantoor, kantoorIfc);
        writeFileSync(school, schoolIfc);
        const app = newApp(true);
        const st = app.store;
        const T = () => st.getState();
        dialogAnswer = kantoor;
        await T().openFile(labels);
        const kantoorId = T().activeDocumentId;
        T().newDocument();
        dialogAnswer = school;
        await T().openFile(labels);
        const schoolId = T().activeDocumentId;
        T().newDocument();
        const ctx = mcpContext(app, T().activeDocumentId);
        const reachedMcp = gate(), reachedUi = gate(), releaseMcp = gate(), releaseUi = gate();
        let heldMcp = false, heldUi = false;
        const outer = internals.invoke;
        internals.invoke = async (command, args, options) => {
          const at = (args as { path?: string } | undefined)?.path;
          const reading = /^plugin:fs\|read_(text_)?file$/.test(command);
          if (reading && !heldMcp && at === kantoor) {
            heldMcp = true; reachedMcp.open(); await releaseMcp.wait;
          } else if (reading && heldMcp && !heldUi && at === uiAt) {
            heldUi = true; reachedUi.open(); await releaseUi.wait;
          }
          return outer(command, args, options);
        };
        const getFs = fileToolDeps.getFs;
        fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
        let result: Awaited<ReturnType<NonNullable<ReturnType<typeof getTool>>['handler']>>;
        try {
          const importing = getTool('planner_import_schedule')!.handler({ path: kantoor }, ctx);
          await reachedMcp.wait;
          dialogAnswer = school;
          const opening = T().openFile(labels);
          await reachedUi.wait;
          if (offset === 'Openen eerst klaar') {
            releaseUi.open();
            await opening;
            releaseMcp.open();
            result = await importing;
          } else if (offset === 'MCP eerst klaar') {
            releaseMcp.open();
            result = await importing;
            releaseUi.open();
            await opening;
          } else {
            releaseAfter(-offset, releaseMcp.open);
            releaseAfter(offset, releaseUi.open);
            result = await importing;
            await opening;
          }
        } finally {
          releaseMcp.open();
          releaseUi.open();
          internals.invoke = outer;
        }
        const data = result.ok ? result.data as { documentId: string; filePath: string; alreadyOpen?: boolean } : null;
        seen.add(T().activeDocumentId === schoolId ? 'School' : T().activeDocumentId === kantoorId ? 'Kantoor' : 'anders');
        eq(`R5 kruisend ${uiAt === school ? 'school' : 'kantoor'} ${offset}: het antwoord en het anker noemen Kantoor`, [
          data?.documentId, data?.filePath, data?.alreadyOpen, ctx.expectedDocId, T().documents.length,
        ], [kantoorId, kantoor, true, kantoorId, 3]);
        const exportPath = join(dir, `kruisend-export-${uiAt === school ? 's' : 'k'}-${String(offset).replace(/ /g, '-')}.ifc`);
        try {
          const edit = await getTool('planner_update_project')!.handler({ name: 'Bewerkt door MCP' }, ctx);
          const exported = await getTool('planner_export_ifc')!.handler({ path: exportPath }, ctx);
          const onKantoor = T().activeDocumentId === kantoorId;
          const written = exported.ok ? readFileSync(exportPath, 'utf8') : '';
          eq(`R5 kruisend ${uiAt === school ? 'school' : 'kantoor'} ${offset}: bewerking en export op Kantoor, of een driftweigering`, [
            edit.ok ? 'ok' : edit.code, exported.ok ? 'ok' : exported.code,
            written.includes('Dak'), onKantoor ? written.includes('Fundering') : true,
          ], onKantoor ? ['ok', 'ok', false, true] : ['DOC_DRIFT', 'DOC_DRIFT', false, true]);
          eq(`R5 kruisend ${uiAt === school ? 'school' : 'kantoor'} ${offset}: School onaangeroerd`, tab(st, schoolId), { project: 'School', tasks: ['Dak'], isDirty: false, filePath: school });
        } finally {
          fileToolDeps.getFs = getFs;
        }
      }
      eq('R5 kruisend: beide eindstanden gezien', [...seen].sort(), ['Kantoor', 'School']);
    }

    {
      writeFileSync(kantoor, kantoorIfc);
      const st = newStore(true);
      const T = () => st.getState();
      dialogAnswer = school;
      await T().openFile(labels);
      st.setState(s => { s.recentFiles = [{ id: 'r', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
      const all = gate();
      const three = gate();
      let held = 0;
      const outer = internals.invoke;
      internals.invoke = async (command, args, options) => {
        if (/^plugin:fs\|read_(text_)?file$/.test(command) && (args as { path?: string }).path === kantoor && held < 3) {
          if (++held === 3) three.open();
          await all.wait;
        }
        return outer(command, args, options);
      };
      clearNotices(st);
      let opening: Promise<unknown>[];
      try {
        dialogAnswer = kantoor;
        opening = [T().openFile(labels), T().openRecentFile('r', labels), openVia(st, 'slepen')];
        await three.wait;
        all.open();
        await Promise.all(opening);
      } finally { internals.invoke = outer; all.open(); }
      eq('R6 2041: drie openacties lezen tegelijk; één tabblad op kantoor, geen melding (dezelfde versie)', [
        held, T().getOpenDocumentPayloads().filter(d => d.payload.filePath === kantoor).length, T().documents.length,
        notices(st).filter(n => n[1] === CHANGED).length,
      ], [3, 1, 2, 0]);
    }

    {
      const { openLaunchFiles } = await import('@/state/launchFiles');
      const launchOptions = (store: Store) => ({ readOptions: readOptions(store), identityFs: fileIdentityFs });
      const launchCase = async (flag: boolean) => {
        const st = newStore(flag);
        const T = () => st.getState();
        dialogAnswer = kantoor;
        await T().openFile(labels);
        const first = T().activeDocumentId;
        T().addTask({ name: 'Werk in kantoor' });
        const before = tab(st, first);
        T().newDocument();
        dialogAnswer = school;
        await T().openFile(labels);
        const other = T().activeDocumentId;
        return { st, T, first, before, other };
      };
      for (const [how, path] of [['pad', kantoor], ['link', link]] as const) {
        const { st, T, first, before, other } = await launchCase(true);
        st.setState(s => { s.recentFiles = []; });
        clearNotices(st);
        await openLaunchFiles(st, [path], io, labels, () => false, launchOptions(st));
        eq(`B10 tweede start, ${how}: naar het open tabblad, dezelfde versie, geen melding`, [
          T().activeDocumentId, T().documents.length, notices(st),
        ], [first, 2, []]);
        eq(`B10 tweede start, ${how}: dat tabblad houdt zijn inhoud`, tab(st, first), before);
        eq(`B10 tweede start, ${how}: Recent niet bijgewerkt, zoals main (Sol, ronde 7)`, T().recentFiles, []);
        eq(`B10 tweede start, ${how}: het andere tabblad onveranderd`, tab(st, other)?.filePath, school);
      }
      {
        const st = newStore(true);
        const T = () => st.getState();
        dialogAnswer = school;
        await T().openFile(labels);
        let blocked = true;
        let waiting!: () => void;
        const entered = new Promise<void>((r) => { waiting = r; });
        st.setState(s => { s.recentFiles = []; });
        const launching = openLaunchFiles(st, [kantoor], io, labels, () => { waiting(); return blocked; }, launchOptions(st));
        await entered;
        dialogAnswer = kantoor;
        await T().openFile(labels);
        const late = T().activeDocumentId;
        dialogAnswer = school;
        await T().openFile(labels);
        eq('B10 voorwaarde: school bovenaan Recent', T().recentFiles[0]?.ref, { kind: 'path', path: school });
        clearNotices(st);
        blocked = false;
        await launching;
        eq('B10 tabblad dat tijdens het wachten opende: daarheen, geen melding', [
          T().activeDocumentId, T().documents.length, notices(st),
        ], [late, 2, []]);
        eq('B10 tabblad dat tijdens het wachten opende: Recent zoals main', T().recentFiles[0]?.ref, { kind: 'path', path: school });
      }
      for (const flag of [true, false]) {
        const st = newStore(flag);
        const T = () => st.getState();
        dialogAnswer = school;
        await T().openFile(labels);
        let blocked = true;
        let waiting!: () => void;
        const entered = new Promise<void>((r) => { waiting = r; });
        const before = ipc.calls.length;
        const launching = openLaunchFiles(st, [kantoor], io, labels, () => { waiting(); return blocked; }, launchOptions(st));
        await entered;
        T().addTask({ name: 'Gewijzigd in School' });
        await T().saveFile();
        blocked = false;
        await launching;
        const reads = ipc.calls.slice(before).filter(c => /^plugin:fs\|read_(text_)?file$/.test(c.command) && c.path === kantoor).length;
        eq(`B10 flag ${flag ? 'aan' : 'uit'}: opslag in een ander tabblad tijdens het wachten; twee lezingen, zoals main`, [
          T().filePath, T().project.name, T().isDirty, reads,
        ], [kantoor, 'Kantoor', false, 2]);
        writeFileSync(school, schoolIfc);
      }
      {
        const ifcFormat = allReadFormats().find(f => f.extensions.includes('ifc'))!;
        const parse = ifcFormat.read;
        for (const route of ['startlink', 'openen'] as const) {
          const { st, T, first } = await launchCase(true);
          clearNotices(st);
          ifcFormat.read = async (input, l, o) => {
            st.setState(s => { s.ui.featureFlags = {}; });
            return parse(input, l, o);
          };
          try {
            if (route === 'startlink') await openLaunchFiles(st, [link], io, labels, () => false, launchOptions(st));
            else await openVia(st, 'openen');
          } finally { ifcFormat.read = parse; }
          eq(`B10 flag uit tijdens het parsen, ${route}: naar het open tabblad, geen tweede`, [
            T().activeDocumentId, T().documents.length, ifcForeignContentEnabled(T().ui.featureFlags),
            notices(st).filter(n => n[1] === CHANGED).length,
          ], [first, 2, false, 0]);
        }
      }
      {
        const { st, T, first, before } = await launchCase(false);
        clearNotices(st);
        await openLaunchFiles(st, [kantoor], io, labels, () => false, launchOptions(st));
        eq('B10 flag uit: de startroute wisselt zoals main, zonder melding', [
          T().activeDocumentId, T().documents.length, notices(st).filter(n => n[1] === CHANGED),
        ], [first, 2, []]);
        eq('B10 flag uit: dat tabblad houdt zijn inhoud', tab(st, first), before);
      }
    }

    {
      const { openLaunchFiles } = await import('@/state/launchFiles');
      const ipcFlagOn = new Map<string, string[]>();
      for (const flag of [true, false]) for (const route of ['openen', 'recent', 'slepen', 'MCP', 'start'] as const) {
        const app = newApp(flag);
        const st = app.store;
        const T = () => st.getState();
        dialogAnswer = kantoor;
        await T().openFile(labels);
        T().newDocument();
        dialogAnswer = school;
        await T().openFile(labels);
        st.setState(s => { s.recentFiles = [{ id: 'r', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
        const outer = internals.invoke;
        const ipcSeen: string[] = [];
        let active = false;
        internals.invoke = async (command, args, options) => {
          const at = (args as { path?: string } | undefined)?.path;
          if (!active && events) ipcSeen.push(`${command.replace(/read_text_file$/, 'read_file')} ${at === kantoor ? 'kantoor' : at ?? ''}`);
          if (command === 'plugin:fs|stat') record('toets');
          if (at === kantoor && /^plugin:fs\|read_(text_)?file$/.test(command)) record('lees');
          return outer(command, args, options);
        };
        const unsubscribe = st.subscribe((next, previous) => { if (next.activeDocumentId !== previous.activeDocumentId) { record('actief'); active = true; } });
        const getFs = fileToolDeps.getFs;
        fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
        events = [];
        try {
          if (route === 'MCP') await getTool('planner_import_schedule')!.handler({ path: kantoor }, mcpContext(app, T().activeDocumentId));
          else if (route === 'start') await openLaunchFiles(st, [kantoor], io, labels, () => false, { readOptions: readOptions(st), identityFs: fileIdentityFs });
          else if (route === 'recent') await T().openRecentFile('r', labels);
          else await openVia(st, route);
        } finally {
          internals.invoke = outer;
          unsubscribe();
          fileToolDeps.getFs = getFs;
        }
        const seq = events;
        events = null;
        console.log(JSON.stringify({ proef: 'T1 volgorde', route, flag, seq }));
        if (route === 'start') {
          eq(`T1 ${route} flag ${flag ? 'aan' : 'uit'}: lezen, toets, parsen, activeren (main)`, orderOf(seq), ['lees', 'toets', 'parse', 'actief']);
        } else {
          eq(`T1 ${route} flag ${flag ? 'aan' : 'uit'}: lezen, parsen, activeren zoals main; geen stat in de hele actie`, [
            orderOf(seq), seq.includes('toets'),
          ], [['lees', 'parse', 'actief'], false]);
          if (flag) ipcFlagOn.set(route, ipcSeen);
          else eq(`D1 ${route}: met de flag aan dezelfde bestandsaanroepen als met de flag uit (main), tot het activeren`, ipcFlagOn.get(route), ipcSeen);
        }
        eq(`T1 ${route} flag ${flag ? 'aan' : 'uit'}: één lezing in de hele actie`, seq.filter(e => e === 'lees').length, 1);
      }
    }

    {
      const { readFileSync, unlinkSync } = await import('node:fs');
      const { createHash } = await import('node:crypto');
      const { openLaunchFiles } = await import('@/state/launchFiles');
      const changedIfc = planIfc('Kantoor', 'Extern opgeslagen werk');
      const onDisk = () => createHash('sha256').update(readFileSync(kantoor)).digest('hex');
      type App = ReturnType<typeof newApp>;
      type Route = 'openen' | 'recent' | 'slepen' | 'MCP' | 'start';
      const reopen = async (app: App, route: Route): Promise<Record<string, unknown> | null> => {
        const st = app.store;
        if (route === 'MCP') {
          const r = await getTool('planner_import_schedule')!.handler({ path: kantoor }, mcpContext(app, st.getState().activeDocumentId));
          return r.ok ? r.data as Record<string, unknown> : { fout: r };
        }
        if (route === 'start') await openLaunchFiles(st, [kantoor], io, labels, () => false, { readOptions: readOptions(st), identityFs: fileIdentityFs });
        else if (route === 'recent') {
          st.setState(s => { s.recentFiles = [{ id: 'v', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
          await st.getState().openRecentFile('v', labels);
        } else await openVia(st, route);
        return null;
      };
      const setup = async (flagAtOpen = true, work = true) => {
        writeFileSync(kantoor, kantoorIfc);
        const app = newApp(flagAtOpen);
        const st = app.store;
        const T = () => st.getState();
        await openVia(st, 'openen', kantoor);
        const a = T().activeDocumentId;
        if (work) T().addTask({ name: 'Eigen werk' });
        T().newDocument();
        await openVia(st, 'openen', school);
        st.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
        clearNotices(st);
        return { app, st, T, a, count: T().documents.length };
      };
      const marked = (st: Store, id: string) => hasChangedOnDisk(st.getState(), id);
      const shown = (st: Store) => changedOnDiskShown(st.getState());
      const holdRead = () => {
        const release = gate(), reached = gate();
        let held = false, reads = 0;
        const outer = internals.invoke;
        internals.invoke = async (command, args, options) => {
          if (!/^plugin:fs\|read_(text_)?file$/.test(command) || (args as { path?: string } | undefined)?.path !== kantoor) {
            return outer(command, args, options);
          }
          reads++;
          const result = await outer(command, args, options);
          if (!held) { held = true; reached.open(); await release.wait; }
          return result;
        };
        return { reached: reached.wait, release: release.open, reads: () => reads, stop: () => { internals.invoke = outer; } };
      };
      const { SHORTCUTS } = await import('@/hooks/keyboard/shortcutRegistry');
      const escape = SHORTCUTS.find(shortcut => shortcut.id === 'edit.deselect')!;
      const changedTab = async (dirty: boolean) => {
        const ctx = await setup(true, dirty);
        writeFileSync(kantoor, changedIfc);
        await openVia(ctx.st, 'openen', kantoor);
        clearNotices(ctx.st);
        return ctx;
      };
      const getFs = fileToolDeps.getFs;
      fileToolDeps.getFs = async () => ({ ...await realFs(), homeDir: async () => dir });
      try {
        for (const route of ['openen', 'recent', 'slepen', 'MCP', 'start'] as const) {
          {
            const { app, st, T, a, count } = await setup();
            const data = await reopen(app, route);
            eq(`V4 ${route}: dezelfde versie ⇒ naar het tabblad, geen melding`, [
              T().activeDocumentId === a, T().documents.length - count, notices(st), tab(st, a)?.tasks,
              route === 'MCP' ? [data?.alreadyOpen, data?.changedOnDisk] : null,
            ], [true, 0, [], ['Fundering', 'Eigen werk'], route === 'MCP' ? [true, undefined] : null]);
          }
          {
            const { app, st, T, a, count } = await setup();
            writeFileSync(kantoor, changedIfc);
            const data = await reopen(app, route);
            eq(`V5 ${route}: een andere versie op schijf ⇒ naar het tabblad, met de strook en de knop; het werk blijft`, [
              T().activeDocumentId === a, T().documents.length - count, notices(st), shown(st),
              tab(st, a)?.tasks, tab(st, a)?.isDirty, route === 'MCP' ? [data?.alreadyOpen, data?.changedOnDisk] : null,
            ], [true, 0, [['tabblad', CHANGED]], true, ['Fundering', 'Eigen werk'], true, route === 'MCP' ? [true, true] : null]);
            await reopen(app, route);
            eq(`V5 ${route}: nog eens openen ⇒ nog steeds één strook`, notices(st), [['tabblad', CHANGED]]);
          }
          {
            const { app, st, T, a, count } = await setup(false);
            const data = await reopen(app, route);
            if (route === 'start') {
              eq('V6 start: het tabblad kent zijn versie niet ⇒ zoals main naar dat tabblad, geen melding (2064)', [
                T().activeDocumentId === a, T().documents.length - count, notices(st),
              ], [true, 0, []]);
            } else {
              eq(`V6 ${route}: het tabblad kent zijn versie niet ⇒ een tweede tabblad met het bestand, zoals main`, [
                T().activeDocumentId !== a, T().documents.length - count, T().filePath, T().tasks.map(t => t.name), tab(st, a)?.tasks,
                notices(st).filter(n => n[1] === CHANGED), route === 'MCP' ? data?.alreadyOpen : null,
              ], [true, 1, kantoor, ['Fundering'], ['Fundering', 'Eigen werk'], [], route === 'MCP' ? undefined : null]);
            }
          }
          {
            writeFileSync(kantoor, kantoorIfc);
            const app = newApp(true);
            const st = app.store;
            const T = () => st.getState();
            await openVia(st, 'openen', kantoor);
            const a = T().activeDocumentId;
            T().addTask({ name: 'Opgeslagen werk' });
            await T().saveFile();
            const saved = [T().isDirty, readFileSync(kantoor, 'utf8').includes('Opgeslagen werk')];
            T().newDocument();
            await openVia(st, 'openen', school);
            clearNotices(st);
            const count = T().documents.length;
            await reopen(app, route);
            eq(`V7 ${route} (ronde 7): openen, bewerken, Ctrl+S, opnieuw openen ⇒ naar het tabblad, geen melding`, [
              ...saved, T().activeDocumentId === a, T().documents.length - count, notices(st),
            ], [false, true, true, 0, []]);
          }
        }

        {
          const { st, T, a } = await changedTab(false);
          const before = [T().activeDocumentId === a, shown(st), T().isDirty];
          await T().loadNewVersion(labels);
          const after = [T().activeDocumentId === a, T().documents.length, T().filePath, T().isDirty,
            T().knownTargetFingerprint?.sha256 === onDisk(), T().ui.pendingReloadDocId, marked(st, a), shown(st)];
          T().undo();
          eq('K1 schoon tabblad: de knop vult hetzelfde tabblad met de nieuwe versie, zonder vraag; lege geschiedenis, de strook weg', [
            ...before, ...after, T().tasks.map(t => t.name),
          ], [true, true, false, true, 2, kantoor, false, true, null, false, false, ['Extern opgeslagen werk']]);
          T().switchDocument(T().documents.find(d => d.id !== a)!.id);
          await openVia(st, 'openen', kantoor);
          eq('K1 daarna opnieuw openen ⇒ naar het tabblad, geen strook', [T().activeDocumentId === a, notices(st)], [true, []]);
        }

        for (const choice of ['annuleren', 'weggooien'] as const) {
          const { st, T, a } = await changedTab(true);
          await T().loadNewVersion(labels);
          const asked = [T().ui.pendingReloadDocId === a, T().tasks.map(t => t.name), isBlockingDialogOpen(T().ui)];
          if (choice === 'annuleren') T().cancelReload();
          else T().confirmReload();
          const want = {
            annuleren: [['Fundering', 'Eigen werk'], true, true, true],
            weggooien: [['Extern opgeslagen werk'], false, false, false],
          }[choice];
          eq(`K2 gewijzigd tabblad, ${choice}: pas na het lezen de vraag; daarna ${choice === 'annuleren' ? 'alles zoals het was' : 'dit tabblad met wat op schijf staat'}`, [
            asked, T().activeDocumentId === a, T().tasks.map(t => t.name), T().isDirty, marked(st, a), shown(st), T().ui.pendingReloadDocId,
            readFileSync(kantoor, 'utf8').includes('Eigen werk'),
          ], [[true, ['Fundering', 'Eigen werk'], true], true, ...want, null, false]);
          if (choice === 'annuleren') {
            eq('K2 annuleren: een akkoord daarna doet niets', [T().confirmReload(), T().tasks.map(t => t.name)], [false, ['Fundering', 'Eigen werk']]);
          }
        }

        {
          const { st, T, a } = await changedTab(true);
          const hold = holdRead();
          const loading = T().loadNewVersion(labels);
          await hold.reached;
          T().addTask({ name: 'Tijdens het lezen' });
          const second = T().loadNewVersion(labels);
          hold.release();
          await Promise.all([loading, second]);
          hold.stop();
          const asked = [T().ui.pendingReloadDocId === a, T().tasks.map(t => t.name), hold.reads()];
          escape.run(T());
          T().addTask({ name: 'Na Escape' });
          eq('R8-1a (Sol, ronde 8): gewijzigd tabblad, doorwerken tijdens het lezen, Escape, doorwerken: zonder akkoord verdwijnt niets', [
            asked, T().ui.pendingReloadDocId, T().confirmReload(), T().tasks.map(t => t.name), T().isDirty, marked(st, a),
            readFileSync(kantoor, 'utf8').includes('Extern opgeslagen werk'),
          ], [[true, ['Fundering', 'Eigen werk', 'Tijdens het lezen'], 1], null, false,
            ['Fundering', 'Eigen werk', 'Tijdens het lezen', 'Na Escape'], true, true, true]);
        }

        {
          const { st, T, a } = await changedTab(false);
          const hold = holdRead();
          const loading = T().loadNewVersion(labels);
          await hold.reached;
          T().addTask({ name: 'Opgeslagen tijdens het lezen' });
          await T().saveFile();
          hold.release();
          await loading;
          hold.stop();
          eq('R8-1b (Sol, ronde 8): schoon tabblad, bewerkt en opgeslagen tijdens het lezen ⇒ de knop breekt af; de taak blijft, ook op schijf', [
            T().activeDocumentId === a, T().tasks.map(t => t.name), T().isDirty, T().ui.pendingReloadDocId,
            readFileSync(kantoor, 'utf8').includes('Opgeslagen tijdens het lezen'), marked(st, a),
          ], [true, ['Fundering', 'Opgeslagen tijdens het lezen'], false, null, true, false]);
        }

        {
          const { st, T, a } = await changedTab(true);
          const school = T().documents.find(d => d.id !== a)!.id;
          T().switchDocument(school);
          const inSchool = [shown(st), marked(st, a)];
          await T().loadNewVersion(labels);
          const schoolTask = T().tasks[0].id;
          T().setUI({ showTaskDialog: true, editingTaskId: schoolTask });
          await T().loadNewVersion(labels);
          const afterSchool = [T().activeDocumentId === school, T().ui.showTaskDialog, T().ui.editingTaskId === schoolTask];
          T().setUI({ showTaskDialog: false, editingTaskId: null });
          T().switchDocument(a);
          T().setUI({ showTaskDialog: true, editingTaskId: T().tasks[0].id });
          await T().loadNewVersion(labels);
          eq('R8-2 (Sol, ronde 8): de strook van Kantoor is in School niet zichtbaar en niet bedienbaar; een open taakdialoog blijft', [
            inSchool, afterSchool, T().ui.showTaskDialog, T().ui.pendingReloadDocId, T().tasks.map(t => t.name), marked(st, a),
          ], [[false, true], [true, true, true], true, null, ['Fundering', 'Eigen werk'], true]);
          T().setUI({ showTaskDialog: false, editingTaskId: null });
        }

        {
          const { st, T, a } = await setup();
          for (const name of ['een.xml', 'twee.xml', 'drie.xml']) T().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: name });
          writeFileSync(kantoor, changedIfc);
          await reopen({ store: st } as App, 'recent');
          eq('R8-3 (Sol, ronde 8): drie blijvende foutmeldingen en dan een wissel met een andere versie ⇒ de strook staat er', [
            T().activeDocumentId === a, shown(st), T().ui.notifications.filter(n => n.severity === 'error').length,
          ], [true, true, 3]);
        }

        {
          const { st, T, a } = await changedTab(true);
          unlinkSync(kantoor);
          const errorsBefore = notices(st).filter(n => n[0] === 'error').length;
          await T().loadNewVersion(labels);
          eq('K3 mislukt lezen (bestand weg): het tabblad blijft zoals het was, met de gewone foutmelding; de strook blijft', [
            T().activeDocumentId === a, T().tasks.map(t => t.name), T().isDirty, notices(st).filter(n => n[0] === 'error').length - errorsBefore,
            shown(st), T().ui.pendingReloadDocId,
          ], [true, ['Fundering', 'Eigen werk'], true, 1, true, null]);
          writeFileSync(kantoor, kantoorIfc);
        }

        {
          const { st, T, a } = await changedTab(true);
          const visible = shown(st);
          saveAnswer = join(dir, 'kantoor-ander-doel.ifc');
          await T().saveFileAs();
          const afterSaveAs = [shown(st), marked(st, a)];
          T().newDocument();
          await openVia(st, 'openen', kantoor);
          const b = T().activeDocumentId;
          writeFileSync(kantoor, kantoorIfc);
          T().switchDocument(a);
          await openVia(st, 'openen', kantoor);
          const visibleB = [T().activeDocumentId === b, shown(st)];
          T().closeDocument(b);
          eq('K4 de strook verdwijnt na Opslaan als naar een ander doel en met het sluiten van het tabblad', [
            visible, afterSaveAs, visibleB, T().documents.some(d => d.changedOnDisk),
          ], [true, [false, false], [true, true], false]);
          writeFileSync(kantoor, kantoorIfc);
        }

        {
          const { st, T, a } = await changedTab(false);
          st.setState(s => { s.ui.featureFlags = {}; });
          await T().loadNewVersion(labels);
          eq('K5 de flag gaat uit ⇒ de strook is weg en de knop doet niets', [shown(st), T().tasks.map(t => t.name), T().activeDocumentId === a],
            [false, ['Fundering'], true]);
        }

        {
          const legacy = readFileSync('tests/planning/fixtures/b5-lopend-oude-writer.ifc', 'utf8');
          const { st, T, a } = await setup(true, false);
          writeFileSync(kantoor, legacy);
          await openVia(st, 'openen', kantoor);
          const historyBefore = T().historyEvents.length;
          await T().loadNewVersion(labels);
          eq('K6 (VERVOLG 6, 2204): een oud bestand waarvan de minutenomzetting taken verschuift ⇒ na het laden gewijzigd, met een stap om terug te zetten', [
            T().activeDocumentId === a, marked(st, a), T().isDirty, T().historyEvents.length > historyBefore,
          ], [true, false, true, true]);
          writeFileSync(kantoor, kantoorIfc);
        }
      } finally {
        fileToolDeps.getFs = getFs;
        writeFileSync(kantoor, kantoorIfc);
      }
    }

    const offStore = newStore(false);
    const O = () => offStore.getState();
    dialogAnswer = kantoor;
    await O().openFile(labels);
    O().addTask({ name: 'Onopgeslagen werk' });
    let count = 1;
    for (const how of ['openen', 'link', 'recent', 'slepen'] as const) {
      clearNotices(offStore);
      await openVia(offStore, how);
      count++;
      eq(`B6 flag uit, ${how}: een tweede tabblad`, O().documents.length, count);
      eq(`B6 flag uit, ${how}: het nieuwe tabblad is actief, met de inhoud van het bestand`,
        [O().tasks.map(t => t.name), O().isDirty], [['Fundering'], false]);
      eq(`B6 flag uit, ${how}: geen melding`, notices(offStore).filter(n => n[1] === CHANGED), []);
    }
    eq('B6 flag uit: alle tabbladen wijzen naar kantoor (of de link)', O().getOpenDocumentPayloads().map(d => d.payload.filePath),
      [kantoor, kantoor, link, kantoor, kantoor]);
  } finally {
    ipc.dispose();
  }
}

{
  const files = new Map<string, Uint8Array>([['kantoor.ifc', enc.encode(kantoorIfc)], ['school.ifc', enc.encode(schoolIfc)]]);
  class FakeHandle {
    readonly kind = 'file';
    constructor(readonly name: string, readonly throws = false) {}
    async isSameEntry(other: unknown) {
      if (this.throws) throw new DOMException('weg', 'NotFoundError');
      return other instanceof FakeHandle && other.name === this.name;
    }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    async getFile() { return new File([new Uint8Array(files.get(this.name)!).buffer], this.name); }
  }
  const asHandle = (h: FakeHandle) => h as unknown as FileSystemFileHandle;
  let picked: FakeHandle | null = null;
  win.showOpenFilePicker = async () => [picked];
  const openVia = async (store: Store, how: 'openen' | 'recent' | 'slepen', name = 'kantoor.ifc') => {
    if (how === 'openen') {
      picked = new FakeHandle(name);
      await store.getState().openFile(labels);
    } else if (how === 'recent') {
      const entry = { id: `recent-${name}`, name, ref: { kind: 'handle' as const, handle: asHandle(new FakeHandle(name)) }, addedAt: 1 };
      store.setState(s => { s.recentFiles = [entry]; });
      await store.getState().openRecentFile(entry.id, labels);
    } else {
      const handle = new FakeHandle(name);
      const dropped = new File([new Uint8Array(files.get(name)!).buffer], name);
      const content = { arrayBuffer: dropped.arrayBuffer.bind(dropped), text: dropped.text.bind(dropped) };
      dropped.arrayBuffer = () => { if (name === 'kantoor.ifc') record('lees'); return content.arrayBuffer(); };
      dropped.text = () => { if (name === 'kantoor.ifc') record('lees'); return content.text(); };
      const dt = { items: [{ kind: 'file', getAsFile: () => dropped, getAsFileSystemHandle: async () => handle }] };
      await openDroppedFiles(store, droppedFilesFromDataTransfer(dt as never, readOptions(store)), labels, () => false, { readOptions: readOptions(store) });
    }
  };

  const store = newStore(true);
  const S = () => store.getState();
  await openVia(store, 'openen');
  const a = S().activeDocumentId;
  S().addTask({ name: 'Onopgeslagen werk' });
  S().newDocument();
  await openVia(store, 'openen', 'school.ifc');
  const b = S().activeDocumentId;
  eq('C0 voorwaarde: twee tabbladen, A gewijzigd met een handle', [S().documents.length, a !== b, tab(store, a)?.tasks, tab(store, a)?.isDirty],
    [2, true, ['Fundering', 'Onopgeslagen werk'], true]);
  const tabA = tab(store, a);
  const historyBefore = history(store);
  for (const how of ['openen', 'recent', 'slepen'] as const) {
    S().switchDocument(b);
    clearNotices(store);
    await openVia(store, how);
    eq(`C1 ${how}: geen tweede tabblad`, S().documents.length, 2);
    eq(`C1 ${how}: het tabblad met kantoor is actief`, S().activeDocumentId, a);
    eq(`C1 ${how}: dat tabblad houdt zijn werk`, tab(store, a), tabA);
    eq(`C1 ${how}: ongedaan maken onveranderd`, history(store), historyBefore);
    eq(`C1 ${how}: dezelfde versie, geen melding`, notices(store), []);
    eq(`C1 ${how}: Recent bijgewerkt`, S().recentFiles[0]?.name, 'kantoor.ifc');
  }

  files.set('los.ifc', enc.encode(kantoorIfc));
  await S().openOpenedFile({ name: 'los.ifc', content: '', bytes: files.get('los.ifc'), ref: { kind: 'handle', handle: asHandle(new FakeHandle('los.ifc')) } }, labels);
  const los = S().activeDocumentId;
  S().addTask({ name: 'Werk in los' });
  clearNotices(store);
  picked = new FakeHandle('los.ifc', true);
  await S().openFile(labels);
  eq('C2 isSameEntry gooit: een nieuw tabblad, geen melding', [S().documents.length, S().activeDocumentId !== los, notices(store)], [4, true, []]);

  const ff = { name: 'kantoor.ifc', content: '', bytes: files.get('kantoor.ifc'), ref: null };
  S().addTask({ name: 'Werk' });
  await S().openOpenedFile(ff, labels);
  S().addTask({ name: 'Werk' });
  await S().openOpenedFile(ff, labels);
  eq('C3 zonder handle: telkens een nieuw tabblad', [S().documents.length, notices(store).filter(n => n[1] === CHANGED)], [6, []]);

  {
    files.set('lijst.csv', enc.encode(csvText));
    const sameEntry = FakeHandle.prototype.isSameEntry;
    let calls = 0;
    FakeHandle.prototype.isSameEntry = function (this: FakeHandle, other: unknown) { calls++; return sameEntry.call(this, other); };
    try {
      const count = S().documents.length;
      clearNotices(store);
      for (const how of ['openen', 'recent', 'slepen'] as const) {
        await openVia(store, how, 'lijst.csv');
        store.setState(s => { s.ui.pendingFormatNotice = null; });
      }
      eq('C5 CSV in de browser: geen isSameEntry vóór het activeren, telkens een eigen tabblad', [
        calls, S().documents.length - count, notices(store).filter(n => n[1] === CHANGED),
      ], [0, 3, []]);
    } finally {
      FakeHandle.prototype.isSameEntry = sameEntry;
    }
    store.setState(s => { s.ui.pendingFormatNotice = null; });
  }

  for (const flag of [true, false]) for (const how of ['openen', 'recent', 'slepen'] as const) {
    const st = newStore(flag);
    await openVia(st, 'openen');
    st.getState().newDocument();
    await openVia(st, 'openen', 'school.ifc');
    const unsubscribe = st.subscribe((next, previous) => { if (next.activeDocumentId !== previous.activeDocumentId) record('actief'); });
    const sameEntry = FakeHandle.prototype.isSameEntry;
    const getFile = FakeHandle.prototype.getFile;
    FakeHandle.prototype.isSameEntry = function (this: FakeHandle, other: unknown) { record('toets'); return sameEntry.call(this, other); };
    FakeHandle.prototype.getFile = function (this: FakeHandle) { if (this.name === 'kantoor.ifc') record('lees'); return getFile.call(this); };
    events = [];
    try { await openVia(st, how); } finally {
      FakeHandle.prototype.isSameEntry = sameEntry;
      FakeHandle.prototype.getFile = getFile;
      unsubscribe();
    }
    const seq = events;
    events = null;
    console.log(JSON.stringify({ proef: 'T2 volgorde', how, flag, seq }));
    eq(`T2 ${how} flag ${flag ? 'aan' : 'uit'}: lezen, parsen, activeren zoals main; de toets ${flag ? 'gestart' : 'niet'} vóór het activeren`, [
      orderOf(seq.filter(e => e !== 'toets')), seq.slice(0, seq.indexOf('actief')).includes('toets'),
    ], [['lees', 'parse', 'actief'], flag]);
    eq(`T2 ${how} flag ${flag ? 'aan' : 'uit'}: één lezing`, seq.filter(e => e === 'lees').length, 1);
  }

  for (const how of ['openen', 'recent', 'slepen'] as const) {
    const st = newStore(true);
    const S = () => st.getState();
    await openVia(st, 'openen');
    st.getState().newDocument();
    await openVia(st, 'openen', 'school.ifc');
    const sameEntry = FakeHandle.prototype.isSameEntry;
    const hold = gate();
    let holding = true, held = 0;
    FakeHandle.prototype.isSameEntry = async function (this: FakeHandle, other: unknown) {
      if (holding) { held++; await hold.wait; }
      return sameEntry.call(this, other);
    };
    const unsubscribe = st.subscribe((next, previous) => { if (next.activeDocumentId !== previous.activeDocumentId) holding = false; });
    clearNotices(st);
    const count = S().documents.length;
    const opening = openVia(st, how);
    try {
      const done = await Promise.race([opening.then(() => true), new Promise<boolean>(r => setTimeout(() => r(false), 300))]);
      const atDone = [S().documents.length - count, S().project.name, notices(st).filter(n => n[1] === CHANGED).length];
      eq(`P1 browser ${how}: isSameEntry vastgehouden; de openactie wacht er niet op`, [held > 0, done, ...atDone], [true, true, 1, 'Kantoor', 0]);
      hold.open();
      await opening;
      await new Promise(r => setTimeout(r, 20));
      eq(`P1 browser ${how}: de late uitkomst doet niets meer`,
        [S().documents.length - count, S().project.name, notices(st).filter(n => n[1] === CHANGED).length], atDone);
    } finally {
      hold.open();
      FakeHandle.prototype.isSameEntry = sameEntry;
      unsubscribe();
      await opening.catch(() => undefined);
    }
  }

  const offStore = newStore(false);
  const O = () => offStore.getState();
  await openVia(offStore, 'openen');
  O().addTask({ name: 'Onopgeslagen werk' });
  let count = 1;
  for (const how of ['openen', 'recent', 'slepen'] as const) {
    clearNotices(offStore);
    await openVia(offStore, how);
    count++;
    eq(`C4 flag uit, ${how}: een tweede tabblad`, [O().documents.length, O().tasks.map(t => t.name), O().isDirty], [count, ['Fundering'], false]);
    eq(`C4 flag uit, ${how}: geen melding`, notices(offStore).filter(n => n[1] === CHANGED), []);
  }
}

console.error = realError;
for (const diff of diffs) console.log(`XX ${diff}`);
console.log(`one-file-one-tab: ${checks} controles, ${diffs.length} afwijkingen`);
if (diffs.length) process.exitCode = 1;
