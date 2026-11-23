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
const { startOpenLookup, existingDocument } = await import('@/state/openDocumentFor');
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
const ALREADY_OPEN = 'notifications.fileAlreadyOpen';
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
const notices = (store: Store) => store.getState().ui.notifications.map(n => [n.severity, n.messageKey]);
const clearNotices = (store: Store) => store.setState(s => { s.ui.notifications = []; });
function tab(store: Store, id: string) {
  const doc = store.getState().getOpenDocumentPayloads().find(d => d.id === id)?.payload;
  return doc ? { project: doc.project.name, tasks: doc.tasks.map(t => t.name), isDirty: doc.isDirty, filePath: doc.filePath } : null;
}
const history = (store: Store) => JSON.stringify([store.getState().historyEvents, store.getState().nextHistorySequence]);

{
  type Payload = { filePath: string | null; fileHandle: FileSystemFileHandle | null; siteFileId: string | null };
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
  const state = (docs: Array<[string, Partial<Payload>]>): Tab[] => docs.map(([id, p]) => ({
    id, payload: { filePath: null, fileHandle: null, siteFileId: null, ...p },
  }));
  const asTabs = (tabs: Tab[]) => ({ getOpenDocumentPayloads: () => tabs }) as unknown as Parameters<typeof existingDocument>[0];
  const decide = (tabs: Tab[], ref: Parameters<typeof existingDocument>[1]) => existingDocument(asTabs(tabs), ref, null);
  const settle = async <T extends { settled: boolean }>(lookup: T): Promise<T> => {
    for (let i = 0; i < 50 && !lookup.settled; i++) await new Promise<void>((r) => setTimeout(r, 0));
    return lookup;
  };
  const findId = async (tabs: Tab[], handle: FileSystemFileHandle) => {
    const lookup = await settle(startOpenLookup(asTabs(tabs), { kind: 'handle', handle }));
    return lookup.settled ? lookup.id : 'open';
  };
  const path = (p: string) => ({ kind: 'path' as const, path: p });
  const handleA = handleFor('a.ifc');
  const docs = state([
    ['doc-pad', { filePath: '/plan/a.ifc' }],
    ['doc-win', { filePath: 'C:\\Werk\\Plan.ifc' }],
    ['doc-handle', { filePath: 'h.ifc', fileHandle: handleA }],
    ['doc-site', { filePath: 's.ifc', siteFileId: 'site-1' }],
    ['doc-site-handle', { filePath: 'sh.ifc', fileHandle: handleFor('sh.ifc'), siteFileId: 'site-2' }],
    ['doc-csv', { filePath: null }],
  ]);
  eq('A1 hetzelfde pad', decide(docs, path('/plan/a.ifc')), 'doc-pad');
  eq('A2 een link (een andere padtekst) telt niet (knownbug 2063)', decide(docs, path('/plan/link-a.ifc')), null);
  eq('A4 POSIX is hoofdlettergevoelig', decide(docs, path('/plan/A.ifc')), null);
  eq('A5 geen normalisatie: een anders geschreven pad telt niet (ook op Windows)',
    [decide(docs, path('/plan/./a.ifc')), decide(docs, path('/plan/x/../a.ifc')), decide(docs, path('c:\\Werk\\.\\Plan.ifc'))], [null, null, null]);
  eq('A11 een tabblad met een handle telt niet voor een pad', decide(docs, path('h.ifc')), null);
  eq('A9 site: hetzelfde id', decide(docs, { kind: 'site', id: 'site-1' }), 'doc-site');
  eq('A9b site: ander id', decide(docs, { kind: 'site', id: 'site-9' }), null);
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
    const lookup = startOpenLookup(asTabs(tabs), { kind: 'handle', handle: gevraagd });
    eq('A19 tegelijk: alle drie de vergelijkingen direct gestart, ook voor een andere naam', [...calls].sort(), ['a.ifc→a.ifc', 'a.ifc→x.ifc', 'a.ifc→y.ifc']);
    await settle(lookup);
    eq('A19 zolang ze vastzitten: nog niet beslist', lookup.settled, false);
    hold.open();
    await settle(lookup);
    eq('A19 de treffer op de laatste plaats', [lookup.settled, lookup.id], [true, 'zelfde']);
    const stuck = gate();
    const slowTabs = state([
      ['vast', { filePath: 'x.ifc', fileHandle: { kind: 'file', name: 'x.ifc' } as unknown as FileSystemFileHandle }],
      ['zelfde', { filePath: 'a.ifc', fileHandle: handleFor('a.ifc') }],
    ]);
    const req = { kind: 'file', name: 'a.ifc',
      isSameEntry: async (other: { name?: string }) => { if (other.name === 'x.ifc') { await stuck.wait; return false; } return other.name === 'a.ifc'; },
    } as unknown as FileSystemFileHandle;
    const early = await settle(startOpenLookup(asTabs(slowTabs), { kind: 'handle', handle: req }));
    eq('A19b een treffer telt zodra hij binnen is, ook als een andere vergelijking nog loopt', [early.settled, early.id], [true, 'zelfde']);
    const none = startOpenLookup(asTabs(slowTabs.slice(0, 1)), { kind: 'handle', handle: req });
    await settle(none);
    eq('A19b "geen treffer" pas als alle vergelijkingen binnen zijn', none.settled, false);
    stuck.open();
    await settle(none);
    eq('A19b daarna: geen treffer', [none.settled, none.id], [true, null]);
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
      eq(`B1 ${how}: één melding`, notices(store), [['info', ALREADY_OPEN]]);
      eq(`B1 ${how}: Recent bijgewerkt`, S().recentFiles[0]?.ref, { kind: 'path', path: kantoor });
      eq(`B1 ${how}: B onveranderd`, tab(store, b), { project: 'School', tasks: ['Dak'], isDirty: false, filePath: school });
    }
    {
      S().switchDocument(b);
      clearNotices(store);
      await openVia(store, 'link');
      const viaLink = S().activeDocumentId;
      eq('B1 link: een eigen tabblad met de inhoud van het bestand, geen melding', [
        S().documents.length, ![a, b].includes(viaLink), S().filePath, S().tasks.map(t => t.name), notices(store).filter(n => n[1] === ALREADY_OPEN),
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
    eq('B3 tweede neerzetting van dezelfde kopie: één melding', notices(store), [['info', ALREADY_OPEN]]);

    S().addTask({ name: 'Werk in de kopie' });
    clearNotices(store);
    dialogAnswer = csv;
    await S().openFile(labels);
    S().addTask({ name: 'Werk in de CSV' });
    await S().openFile(labels);
    eq('B4 CSV twee keer: twee tabbladen, geen melding', [S().documents.length, notices(store).filter(n => n[1] === ALREADY_OPEN)], [5, []]);
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
    eq('B5 geen melding "staat al open"', notices(store).filter(n => n[1] === ALREADY_OPEN), []);

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
    eq('B7 1909: één melding', notices(store), [['info', ALREADY_OPEN]]);

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
      eq(`B8 ${during}: geen melding "staat al open"`, notices(st).filter(n => n[1] === ALREADY_OPEN), []);
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
      eq('B9 maplink/..: geen melding "staat al open"', notices(st).filter(n => n[1] === ALREADY_OPEN), []);
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
          reads, stats, T().activeDocumentId === kantoorTab, T().documents.length, T().project.name, notices(st).filter(n => n[1] === ALREADY_OPEN),
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
          stats, plain, viaHardlink, samePathText, notices(st).filter(n => n[1] === ALREADY_OPEN),
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
            notices(st).filter(n => n[1] === ALREADY_OPEN).length,
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
      eq('R6 2041: drie openacties lezen tegelijk; één tabblad op kantoor, de melding één keer (zelfde dedupeKey)', [
        held, T().getOpenDocumentPayloads().filter(d => d.payload.filePath === kantoor).length, T().documents.length,
        notices(st).filter(n => n[1] === ALREADY_OPEN).length,
      ], [3, 1, 2, 1]);
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
        eq(`B10 tweede start, ${how}: naar het open tabblad, met de melding`, [
          T().activeDocumentId, T().documents.length, notices(st),
        ], [first, 2, [['info', ALREADY_OPEN]]]);
        eq(`B10 tweede start, ${how}: dat tabblad houdt zijn inhoud`, tab(st, first), before);
        eq(`B10 tweede start, ${how}: Recent bijgewerkt`, T().recentFiles[0]?.ref, { kind: 'path', path });
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
        eq('B10 tabblad dat tijdens het wachten opende: daarheen, met de melding', [
          T().activeDocumentId, T().documents.length, notices(st),
        ], [late, 2, [['info', ALREADY_OPEN]]]);
        eq('B10 tabblad dat tijdens het wachten opende: Recent bijgewerkt', T().recentFiles[0]?.ref, { kind: 'path', path: kantoor });
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
            notices(st).filter(n => n[1] === ALREADY_OPEN).length,
          ], [first, 2, false, 1]);
        }
      }
      {
        const { st, T, first, before } = await launchCase(false);
        clearNotices(st);
        await openLaunchFiles(st, [kantoor], io, labels, () => false, launchOptions(st));
        eq('B10 flag uit: de startroute wisselt zoals main, zonder melding', [
          T().activeDocumentId, T().documents.length, notices(st).filter(n => n[1] === ALREADY_OPEN),
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
      eq(`B6 flag uit, ${how}: geen melding "staat al open"`, notices(offStore).filter(n => n[1] === ALREADY_OPEN), []);
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
    eq(`C1 ${how}: één melding`, notices(store), [['info', ALREADY_OPEN]]);
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
  eq('C3 zonder handle: telkens een nieuw tabblad', [S().documents.length, notices(store).filter(n => n[1] === ALREADY_OPEN)], [6, []]);

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
        calls, S().documents.length - count, notices(store).filter(n => n[1] === ALREADY_OPEN),
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
      const atDone = [S().documents.length - count, S().project.name, notices(st).filter(n => n[1] === ALREADY_OPEN).length];
      eq(`P1 browser ${how}: isSameEntry vastgehouden; de openactie wacht er niet op`, [held > 0, done, ...atDone], [true, true, 1, 'Kantoor', 0]);
      hold.open();
      await opening;
      await new Promise(r => setTimeout(r, 20));
      eq(`P1 browser ${how}: de late uitkomst doet niets meer`,
        [S().documents.length - count, S().project.name, notices(st).filter(n => n[1] === ALREADY_OPEN).length], atDone);
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
    eq(`C4 flag uit, ${how}: geen melding "staat al open"`, notices(offStore).filter(n => n[1] === ALREADY_OPEN), []);
  }
}

console.error = realError;
for (const diff of diffs) console.log(`XX ${diff}`);
console.log(`one-file-one-tab: ${checks} controles, ${diffs.length} afwijkingen`);
if (diffs.length) process.exitCode = 1;
