// #804, knownbug 1957: één bestand, één tabblad (besluit van de eigenaar, 21 november 2026; T1: achter de flag
// `ifcForeignContent`). Opent de planner een bestand dat al in een tabblad open staat, dan komt er geen tweede tabblad:
// de app gaat naar dat tabblad, met één melding, en dat tabblad houdt al zijn werk (taken, gewijzigd-stand, ongedaan
// maken). Met de flag uit: een tweede tabblad, zoals main.
//
//  A. `openDocumentFor`: pad (lexicaal, ook Windows; `dev`/`ino` via een link), handle (`isSameEntry`, ook een ander
//     object voor hetzelfde bestand; een fout telt als anders), site-id, `null`; een tabblad met een handle telt niet
//     voor een pad en omgekeerd; een betrouwbare `dev`/`ino` gaat voor op het lexicale pad (`maplink/../a.ifc`).
//     Met de flag uit roept geen openroute de toets aan (B6, C4: precies main).
//  B. Desktop, op echte bestanden (plugin-fs-JS met nep-IPC naar Node-fs): Bestand → Openen (`openFile()` met de
//     kiezer), via een link, Recent, slepen; twee keer hetzelfde bestand in één neerzetting; een kopie met dezelfde
//     inhoud is een ander bestand; CSV opent opnieuw (vraag P2); het tabblad dat tijdens het wachten van een
//     neerzetting sluit, laat het bestand gewoon openen. Met de flag uit: telkens een tweede tabblad.
//  C. Browser (nep-FSA-handles): Openen (`showOpenFilePicker`, telkens een nieuw handle-object), Recent, slepen
//     (`droppedFilesFromDataTransfer`), een `isSameEntry` die gooit, Firefox zonder handle. Met de flag uit: twee
//     tabbladen.
// De site staat in `check-site-storage.ts` (G16), `planner_import_schedule` in `tests/mcp/cases-doc-file.ts` en
// `cases-headless-server.ts`.
//
// Draait via run.sh. Exit 0 = alles groen; alleen de exitcode telt.
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
const { openDocumentFor } = await import('@/state/openDocumentFor');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { writeCSV } = await import('@/services/csv/csvWriter');
const { buildImportLabels } = await import('@/i18n/importLabels');
const { openDroppedFiles } = await import('@/state/fileDrop');
const { droppedFilesFromPaths, droppedFilesFromDataTransfer } = await import('@/services/fileAccess/fileDrop');
const { tauriOpenIO } = await import('@/services/fileAccess/tauriOpenPath');
const { readOpenedPath, fileIdentityFs } = await import('@/services/fileAccess');
const { ifcForeignContentEnabled } = await import('@/utils/featureFlags');
type Store = ReturnType<typeof createAppStoreContext>['store'];
type FileIdentityInfo = import('@/services/fileAccess/fileIdentity').FileIdentityInfo;

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

function newStore(flag: boolean): Store {
  reseed(0x1957);
  const { store } = createAppStoreContext();
  if (flag) store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  return store;
}

/** Een planning als IFC-tekst, met één taak. */
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

/** De leeskeuze van de app bij slepen: IFC als bytes alleen met de flag (`dropReadOptions`). */
const readOptions = (store: Store) => ({ ifcBytes: ifcForeignContentEnabled(store.getState().ui.featureFlags) });
const notices = (store: Store) => store.getState().ui.notifications.map(n => [n.severity, n.messageKey]);
const clearNotices = (store: Store) => store.setState(s => { s.ui.notifications = []; });
/** Wat het tabblad `id` draagt: naam, taken, gewijzigd, bestand. Ook voor het slapende tabblad. */
function tab(store: Store, id: string) {
  const doc = store.getState().getOpenDocumentPayloads().find(d => d.id === id)?.payload;
  return doc ? { project: doc.project.name, tasks: doc.tasks.map(t => t.name), isDirty: doc.isDirty, filePath: doc.filePath } : null;
}
const history = (store: Store) => JSON.stringify([store.getState().historyEvents, store.getState().nextHistorySequence]);

// ═══ A. De identiteit ═════════════════════════════════════════════════════════════════════════════
{
  type Payload = { filePath: string | null; fileHandle: FileSystemFileHandle | null; siteFileId: string | null };
  const handleFor = (name: string, opts: { throws?: boolean } = {}) => ({
    kind: 'file', name,
    isSameEntry: async (other: { name?: string }) => {
      if (opts.throws) throw new DOMException('weg', 'NotFoundError');
      return other.name === name;
    },
  }) as unknown as FileSystemFileHandle;
  const state = (docs: Array<[string, Partial<Payload>]>) => ({
    getOpenDocumentPayloads: () => docs.map(([id, p]) => ({
      id,
      payload: { filePath: null, fileHandle: null, siteFileId: null, foreignSourceMark: null, ifcSource: null, siteFileVersion: null, ...p },
    })),
    ui: { featureFlags: { ifcForeignContent: true } },
  }) as unknown as Parameters<typeof openDocumentFor>[0];
  /** De id van de match, of `null`. */
  const findId = async (...args: Parameters<typeof openDocumentFor>) => (await openDocumentFor(...args))?.id ?? null;
  const ids = new Map<string, [number, number]>([['/plan/a.ifc', [1, 10]], ['/plan/link-a.ifc', [1, 10]], ['/plan/b.ifc', [1, 11]]]);
  const fs = {
    stat: async (path: string): Promise<FileIdentityInfo> => {
      const id = ids.get(path);
      if (!id) throw new Error(`failed to get metadata of path: ${path} with error: geen (os error 2)`);
      return { isFile: true, dev: id[0], ino: id[1] };
    },
  };
  const withFs = async () => fs;
  const noFs = async () => undefined;
  const path = (p: string) => ({ kind: 'path' as const, path: p });
  const handleA = handleFor('a.ifc');
  const docs = state([
    ['doc-pad', { filePath: '/plan/a.ifc' }],
    ['doc-win', { filePath: 'C:\\Werk\\Plan.ifc' }],
    ['doc-handle', { filePath: 'h.ifc', fileHandle: handleA }],
    ['doc-site', { filePath: 's.ifc', siteFileId: 'site-1' }],
    ['doc-site-handle', { filePath: 'sh.ifc', fileHandle: handleFor('sh.ifc'), siteFileId: 'site-2' }],
    ['doc-gooit', { filePath: 'g.ifc', fileHandle: handleFor('g.ifc', { throws: true }) }],
    ['doc-csv', { filePath: null }],
  ]);
  eq('A1 hetzelfde pad', await findId(docs, path('/plan/a.ifc'), noFs), 'doc-pad');
  eq('A2 ander pad, zelfde dev/ino (link)', await findId(docs, path('/plan/link-a.ifc'), withFs), 'doc-pad');
  eq('A2b zonder bestandsidentiteit ziet de link niet', await findId(docs, path('/plan/link-a.ifc'), noFs), null);
  eq('A3 ander bestand', await findId(docs, path('/plan/b.ifc'), withFs), null);
  eq('A4 POSIX is hoofdlettergevoelig', await findId(docs, path('/plan/A.ifc'), noFs), null);
  eq('A5 Windows: stationsletter en . lexicaal', await findId(docs, path('c:\\Werk\\.\\Plan.ifc'), noFs), 'doc-win');
  eq('A6 handle: isSameEntry waar, ander object', await findId(docs, { kind: 'handle', handle: handleFor('a.ifc') }, noFs), 'doc-handle');
  eq('A7 handle: isSameEntry onwaar', await findId(docs, { kind: 'handle', handle: handleFor('x.ifc') }, noFs), null);
  eq('A8 handle: isSameEntry gooit ⇒ anders', await findId(docs, { kind: 'handle', handle: handleFor('g.ifc') }, noFs), null);
  eq('A9 site: hetzelfde id', await findId(docs, { kind: 'site', id: 'site-1' }, noFs), 'doc-site');
  eq('A9b site: ander id', await findId(docs, { kind: 'site', id: 'site-9' }, noFs), null);
  eq('A9c site wint van de handle van hetzelfde document', await findId(docs, { kind: 'handle', handle: handleFor('sh.ifc') }, noFs), null);
  eq('A10 ref null', await findId(docs, null, withFs), null);
  eq('A11 een tabblad met een handle telt niet voor een pad', await findId(docs, path('h.ifc'), noFs), null);
  eq('A12 een tabblad met een pad telt niet voor een handle', await findId(docs, { kind: 'handle', handle: handleFor('/plan/a.ifc') }, noFs), null);
  eq('A13 een pad dat niet meer bestaat', await findId(state([['d', { filePath: '/plan/weg.ifc' }]]), path('/plan/weg.ifc'), withFs), null);
  eq('A14 de match met het bestand van dat moment', await openDocumentFor(docs, path('/plan/a.ifc'), noFs),
    { id: 'doc-pad', file: { filePath: '/plan/a.ifc', fileHandle: null, siteFileId: null } });
  // Review #1121: `/plan/x/../a.ifc` is lexicaal `/plan/a.ifc`, maar via een maplink een ander bestand. Een betrouwbare
  // bestandsidentiteit gaat voor; zonder identiteit (Windows, een stat-fout) blijft de lexicale vergelijking.
  ids.set('/plan/x/../a.ifc', [1, 12]);
  eq('A16 lexicaal gelijk, andere dev/ino: een ander bestand', await findId(docs, path('/plan/x/../a.ifc'), withFs), null);
  eq('A16b zonder identiteit: lexicaal', await findId(docs, path('/plan/x/../a.ifc'), noFs), 'doc-pad');
}

// ═══ B. Desktop ═══════════════════════════════════════════════════════════════════════════════════
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
      const entry = store.getState().recentFiles.find(e => e.ref.kind === 'path' && e.ref.path === file);
      if (!entry) throw new Error(`geen recent voor ${file}`);
      await store.getState().openRecentFile(entry.id, labels);
    } else {
      await openDroppedFiles(store, droppedFilesFromPaths([file], io, readOptions(store)), labels, () => false);
    }
  };
  try {
    // Met de flag aan: kantoor open in A, met onopgeslagen werk; school in B (actief).
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
    for (const how of ['openen', 'link', 'recent', 'slepen'] as const) {
      S().switchDocument(b);
      clearNotices(store);
      await openVia(store, how);
      eq(`B1 ${how}: geen tweede tabblad`, S().documents.length, 2);
      eq(`B1 ${how}: het tabblad met kantoor is actief`, S().activeDocumentId, a);
      eq(`B1 ${how}: dat tabblad houdt zijn werk`, tab(store, a), tabA);
      eq(`B1 ${how}: ongedaan maken onveranderd`, history(store), historyBefore);
      eq(`B1 ${how}: één melding`, notices(store), [['info', ALREADY_OPEN]]);
      // Recent krijgt wat de planner koos: via de link het pad van de link, zoals main.
      eq(`B1 ${how}: Recent bijgewerkt`, S().recentFiles[0]?.ref, { kind: 'path', path: how === 'link' ? link : kantoor });
      eq(`B1 ${how}: B onveranderd`, tab(store, b), { project: 'School', tasks: ['Dak'], isDirty: false, filePath: school });
    }
    // Ongedaan maken werkt na de wissel nog op het werk van A.
    S().undo();
    eq('B2 ongedaan maken in A na de wissel', S().tasks.map(t => t.name), ['Fundering']);
    S().redo();

    // Een kopie met dezelfde inhoud is een ander bestand; twee keer dezelfde kopie in één neerzetting geeft één
    // tabblad en één melding.
    clearNotices(store);
    await openDroppedFiles(store, droppedFilesFromPaths([kopie, kopie], io, { ifcBytes: true }), labels, () => false);
    const c = S().activeDocumentId;
    eq('B3 kopie: een eigen tabblad', [S().documents.length, tab(store, c)?.filePath, tab(store, c)?.project], [3, kopie, 'School']);
    eq('B3 tweede neerzetting van dezelfde kopie: één melding', notices(store), [['info', ALREADY_OPEN]]);

    // CSV heeft geen opslagdoel: opnieuw openen geeft een nieuw tabblad (vraag P2).
    S().addTask({ name: 'Werk in de kopie' });
    clearNotices(store);
    dialogAnswer = csv;
    await S().openFile(labels);
    S().addTask({ name: 'Werk in de CSV' });
    await S().openFile(labels);
    eq('B4 CSV twee keer: twee tabbladen, geen melding', [S().documents.length, notices(store).filter(n => n[1] === ALREADY_OPEN)], [5, []]);
    // De formaatuitleg van de CSV sluiten (*Begrepen*): anders wacht een volgende neerzetting daar terecht op.
    store.setState(s => { s.ui.pendingFormatNotice = null; });

    // Een neerzetting die moet wachten (een dialoog staat open), terwijl de planner het tabblad met kantoor sluit:
    // het bestand opent dan gewoon, in een eigen tabblad, en verdwijnt niet.
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

    // Knownbug 1909: een Openen van doel.ifc loopt nog (het bestand is gelezen, het tabblad nog niet geregistreerd)
    // terwijl een ander tabblad *Opslaan als* over doel.ifc doet. De toets na het lezen ziet dat doel.ifc nu open staat
    // in het tabblad dat opsloeg, en gaat daarheen: geen tweede tabblad met de oude inhoud van doel.ifc.
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

    // Review #1121 ronde 1 (BLOKKEERT): *Opslaan als* zet het gevonden tabblad op een ander bestand terwijl de toets of
    // de wachtende neerzetting nog loopt. De wissel kijkt vlak vóór het activeren of dat tabblad nog naar het gevraagde
    // bestand wijst; zo niet, dan opent het gevraagde bestand gewoon, zoals main. Twee volgordes: (1) een neerzetting
    // die wacht op de dialoogpoort, (2) een trage `stat` in de toets zelf, zonder wachtlus.
    for (const during of ['wachtende neerzetting', 'trage stat'] as const) {
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
      const renamed = join(dir, during === 'trage stat' ? 'nieuwe-naam-stat.ifc' : 'nieuwe-naam-wacht.ifc');
      // De trage `stat` moet die van de toets zijn: het bestand is dan al gelezen en geparst wordt daarna.
      const preRead = during === 'trage stat' ? await readOpenedPath(kantoor, true) : null;
      let opening: Promise<void>;
      let release: () => void = () => undefined;
      const halted = new Promise<void>((resolve) => {
        if (during === 'wachtende neerzetting') {
          let calls = 0;
          let blocked = true;
          release = () => { blocked = false; };
          opening = openDroppedFiles(st, droppedFilesFromPaths([kantoor], io, readOptions(st)), labels, () => {
            if (++calls === 1) return false; // de poort bij het neerzetten
            resolve();
            return blocked;
          });
        } else {
          let statMayReturn: () => void = () => undefined;
          const gate = new Promise<void>((r) => { statMayReturn = r; });
          release = () => statMayReturn();
          const outer = internals.invoke;
          internals.invoke = async (command, args, options) => {
            if (command === 'plugin:fs|stat' && (args as { path?: string }).path === kantoor) {
              internals.invoke = outer;
              resolve();
              await gate;
            }
            return outer(command, args, options);
          };
          opening = T().openOpenedFile(preRead!, labels);
        }
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

    // Review #1121 ronde 1 (VERVOLG): een pad met `..` door een maplink wijst op POSIX naar een ander bestand dan wat
    // er lexicaal staat. Bij het openen gaat een betrouwbare bestandsidentiteit (`dev`/`ino`) voor op de lexicale
    // gelijkheid: `maplink/../kantoor.ifc` is hier een ander bestand (planning School) en opent in een eigen tabblad.
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
      // Wijst het pad wel naar hetzelfde bestand (hier `.` en een overbodige `/`), dan nog steeds het open tabblad.
      dialogAnswer = `${dir}/./kantoor.ifc`;
      await T().openFile(labels);
      eq('B9 ./kantoor.ifc: hetzelfde bestand, naar het open tabblad', [T().activeDocumentId, T().documents.length], [first, 2]);
    }

    // Review #1121 ronde 2 (BLOKKEERT): de toets van een openactie loopt, en intussen slaat de planner een ander tabblad op
    // als het bestand dat geopend wordt. De uitkomst van de toets ("niet open") is dan vervallen: de app gaat naar het
    // tabblad dat nu op dat bestand staat, met de melding, en het zojuist opgeslagen werk blijft op schijf, ook na Ctrl+S.
    // Gaat dat tabblad daarna nog dicht (R3), dan leest de app het bestand opnieuw: geen oude bytes in een nieuw tabblad.
    // Met de flag uit is er geen toets; dan is kantoor al open als Opslaan als begint en weigert het, zoals main.
    {
      const { readFileSync } = await import('node:fs');
      const race = async (flag: boolean, route: 'openen' | 'recent' | 'slepen', closeAfterSave = false) => {
        writeFileSync(kantoor, kantoorIfc);
        const st = newStore(flag);
        const T = () => st.getState();
        dialogAnswer = school;
        await T().openFile(labels);
        const saving = T().activeDocumentId;
        T().addTask({ name: 'Nieuwe opgeslagen taak' });
        st.setState(s => { s.recentFiles = [{ id: 'r', ref: { kind: 'path', path: kantoor }, name: 'kantoor.ifc', addedAt: 1 }]; });
        const saveAs = async () => {
          T().switchDocument(saving);
          saveAnswer = kantoor;
          await T().saveFileAs();
          if (closeAfterSave) T().closeDocument(saving);
        };
        // Na het lezen van kantoor: de eerste `stat` van kantoor is die van de toets. Daarin Opslaan als.
        let read = false, gated = false;
        const outer = internals.invoke;
        internals.invoke = async (command, args, options) => {
          const at = (args as { path?: string } | undefined)?.path;
          if (read && !gated && command === 'plugin:fs|stat' && at === kantoor) { gated = true; await saveAs(); }
          const result = await outer(command, args, options);
          if (!read && /^plugin:fs\|read_(text_)?file$/.test(command) && at === kantoor) read = true;
          return result;
        };
        clearNotices(st);
        try {
          if (route === 'recent') await T().openRecentFile('r', labels);
          else await openVia(st, route);
        } finally { internals.invoke = outer; }
        if (!gated) await saveAs();
        return { st, T, saving, gated };
      };
      for (const route of ['openen', 'recent', 'slepen'] as const) {
        {
          const { st, T, saving, gated } = await race(true, route);
          const onKantoor = T().getOpenDocumentPayloads().filter(d => d.payload.filePath === kantoor);
          eq(`R1 ${route}: Opslaan als tijdens de toets; één tabblad op kantoor, het opgeslagen tabblad, met de melding`, [
            gated, onKantoor.map(d => d.id), T().activeDocumentId, notices(st),
          ], [true, [saving], saving, [['info', ALREADY_OPEN]]]);
          eq(`R1 ${route}: het opgeslagen werk staat op schijf`, readFileSync(kantoor, 'utf8').includes('Nieuwe opgeslagen taak'), true);
          T().addTask({ name: 'Daarna in het actieve tabblad' });
          await T().saveFile();
          const written = readFileSync(kantoor, 'utf8');
          eq(`R1 ${route}: ook na Ctrl+S`, [written.includes('Nieuwe opgeslagen taak'), written.includes('Daarna in het actieve tabblad')], [true, true]);
        }
        {
          const { st, T, saving } = await race(false, route);
          eq(`R2 ${route} flag uit: zoals main weigert Opslaan als, het werk blijft gewijzigd, het bestand bytegelijk`, [
            readFileSync(kantoor, 'utf8') === kantoorIfc, tab(st, saving)?.isDirty,
            T().getOpenDocumentPayloads().filter(d => d.payload.filePath === kantoor).length,
            notices(st).some(n => n[1] === 'notifications.ifcForeignTargetOpenInTab'),
          ], [true, true, 1, true]);
        }
        {
          const { st, T, saving } = await race(true, route, true);
          eq(`R3 ${route}: opgeslagen en daarna gesloten; de app leest opnieuw en opent de opgeslagen versie`, [
            T().documents.some(d => d.id === saving), T().filePath, T().tasks.map(t => t.name).includes('Nieuwe opgeslagen taak'),
            notices(st).filter(n => n[1] === ALREADY_OPEN),
          ], [false, kantoor, true, []]);
          await T().saveFile();
          eq(`R3 ${route}: Ctrl+S houdt het opgeslagen werk`, readFileSync(kantoor, 'utf8').includes('Nieuwe opgeslagen taak'), true);
        }
      }
      writeFileSync(kantoor, kantoorIfc);
    }

    // #1116/#1091: een startbestand (eerste start, of een tweede start: de planner dubbelklikt op een bestand dat al open
    // staat) loopt door `openLaunchFiles` → `openOpenedFile`, dus door de toets. Met de flag aan: naar het open
    // tabblad, met de melding en Recent. Een tabblad dat pas tijdens het wachten opengaat, vindt de eigen controle van
    // de startroute (`existingDocument`); die geeft met de flag aan dezelfde melding. Met de flag uit zoals main: de
    // startroute wisselt, zonder melding.
    {
      const { openLaunchFiles } = await import('@/state/launchFiles');
      // Zoals de desktop-hook (`useLaunchFiles`): met de bestandsidentiteit.
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
        // Het tabblad met kantoor gaat pas open terwijl het startbestand wacht (een dialoog staat open).
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
        // School weer bovenaan Recent (Openen van school gaat naar zijn tabblad).
        dialogAnswer = school;
        await T().openFile(labels);
        eq('B10 voorwaarde: school bovenaan Recent', T().recentFiles[0]?.ref, { kind: 'path', path: school });
        clearNotices(st);
        blocked = false;
        await launching;
        eq('B10 tabblad dat tijdens het wachten opende: daarheen, met de melding', [
          T().activeDocumentId, T().documents.length, notices(st),
        ], [late, 2, [['info', ALREADY_OPEN]]]);
        // Review #1121 ronde 2: ook de late wissel werkt Recent bij, zoals de eerste.
        eq('B10 tabblad dat tijdens het wachten opende: Recent bijgewerkt', T().recentFiles[0]?.ref, { kind: 'path', path: kantoor });
      }
      {
        // Review #1121 ronde 2: een tabblad op `maplink/../kantoor.ifc` (een ander bestand, planning School, uit B9) en het
        // startbestand kantoor.ifc. Lexicaal gelijk, maar een betrouwbare `dev`/`ino` zegt anders: een eigen tabblad.
        const st = newStore(true);
        const T = () => st.getState();
        dialogAnswer = `${dir}/maplink/../kantoor.ifc`;
        await T().openFile(labels);
        const viaLink = T().activeDocumentId;
        clearNotices(st);
        await openLaunchFiles(st, [kantoor], io, labels, () => false, launchOptions(st));
        eq('B11 startbestand, lexicaal gelijk maar een ander bestand: een eigen tabblad, geen melding', [
          tab(st, viaLink)?.project, T().activeDocumentId !== viaLink, T().project.name, T().documents.length,
          notices(st).filter(n => n[1] === ALREADY_OPEN),
        ], ['School', true, 'Kantoor', 2, []]);
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

    // Met de flag uit: precies main, elke weg geeft een tweede tabblad op hetzelfde bestand.
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

// ═══ C. Browser ═══════════════════════════════════════════════════════════════════════════════════
{
  const files = new Map<string, Uint8Array>([['kantoor.ifc', enc.encode(kantoorIfc)], ['school.ifc', enc.encode(schoolIfc)]]);
  /** Een nep-FSA-handle: `isSameEntry` op de naam, zoals twee handles voor hetzelfde bestand (een nieuw object na elke
   *  kiezer of uit Recent). */
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
      const dt = { items: [{ kind: 'file', getAsFile: () => new File([new Uint8Array(files.get(name)!).buffer], name), getAsFileSystemHandle: async () => handle }] };
      await openDroppedFiles(store, droppedFilesFromDataTransfer(dt as never, readOptions(store)), labels, () => false);
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

  // Een `isSameEntry` die gooit, telt als een ander bestand: een nieuw tabblad, geen melding.
  files.set('los.ifc', enc.encode(kantoorIfc));
  await S().openOpenedFile({ name: 'los.ifc', content: '', bytes: files.get('los.ifc'), ref: { kind: 'handle', handle: asHandle(new FakeHandle('los.ifc', true)) } }, labels);
  const los = S().activeDocumentId;
  S().addTask({ name: 'Werk in los' });
  clearNotices(store);
  await openVia(store, 'openen', 'los.ifc');
  eq('C2 isSameEntry gooit: een nieuw tabblad, geen melding', [S().documents.length, S().activeDocumentId !== los, notices(store)], [4, true, []]);

  // Firefox/Safari: geen handle, dus geen identiteit: twee tabbladen.
  const ff = { name: 'kantoor.ifc', content: '', bytes: files.get('kantoor.ifc'), ref: null };
  S().addTask({ name: 'Werk' });
  await S().openOpenedFile(ff, labels);
  S().addTask({ name: 'Werk' });
  await S().openOpenedFile(ff, labels);
  eq('C3 zonder handle: telkens een nieuw tabblad', [S().documents.length, notices(store).filter(n => n[1] === ALREADY_OPEN)], [6, []]);

  // Met de flag uit: precies main.
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
