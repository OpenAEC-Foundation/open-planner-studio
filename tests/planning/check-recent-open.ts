// Issue #782: Recent mag een leesfout niet verbergen of als een leeg project behandelen.
// De echte store, IndexedDB-route en Tauri-JS-plugin draaien; alleen native I/O is vervangen.
import { readFileSync } from 'node:fs';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

const g = globalThis as unknown as Record<string, unknown>;
const win: Record<string, unknown> = {};
win.parent = win;
g.window = win;
const mem = new Map<string, string>();
const storage = {
  getItem: (key: string) => mem.get(key) ?? null,
  setItem: (key: string, value: string) => { mem.set(key, value); },
  removeItem: (key: string) => { mem.delete(key); },
};
g.localStorage = storage;
g.sessionStorage = storage;
installFakeRecoveryIndexedDb();

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { addRecent, loadRecents } = await import('@/services/fileAccess/recentFiles');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { store } = createAppStoreContext();
const S = () => store.getState();
let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
  }
}
function documentState() {
  return JSON.stringify({
    active: S().activeDocumentId,
    documents: S().getOpenDocumentPayloads(),
    history: S().historyEvents,
    nextHistorySequence: S().nextHistorySequence,
  });
}

S().newProject();
S().setProject({ name: 'Źródło Łódź', startDate: '2026-01-05' });
S().addTask({ name: 'Zażółć gęślą jaźń' });
const ifc = writeIFC(buildWriteIFCInput(S()));
let failure: unknown = null;
const reads: Array<[string, string]> = [];
win.__TAURI_INTERNALS__ = {
  invoke: async (cmd: string, args: { path: string }) => {
    if (!['plugin:fs|read_text_file', 'plugin:fs|read_file'].includes(cmd)) {
      throw new Error(`Onverwachte plugin-aanroep: ${cmd}`);
    }
    reads.push([cmd, args.path]);
    if (failure !== null) throw failure;
    return new TextEncoder().encode(ifc);
  },
};

// Bestaande inhoud én een leeg begintabblad blijven bij tekst- en byteleesfouten intact.
for (const pristine of [true, false]) {
  S().newProject();
  if (!pristine) S().addTask({ name: 'Bestaand onopgeslagen werk' });
  for (const extension of ['ifc', 'mpp']) {
    const path = `D:\\Budowy Łódź\\Zażółć gęślą jaźń.${extension}`;
    for (const reason of [
      `failed to open file at path: ${path}: The system cannot find the file specified. (os error 2)`,
      `forbidden path: ${path}`,
      new Error('Permission denied (os error 13)'),
    ]) {
      // Elke fout begint met een aanwezige, gepersisteerde entry, ook als main hem verwijdert.
      store.setState({ recentFiles: await addRecent({ kind: 'path', path }, path.split('\\').pop()!) });
      const entry = S().recentFiles[0];
      failure = reason;
      store.setState(s => { s.ui.notifications = []; });
      const before = documentState();
      const recentsBefore = await loadRecents();
      await S().openRecentFile(entry.id);
      const label = `${pristine ? 'leeg' : 'gevuld'}/${extension}/${typeof reason}`;
      eq(`${label}: bestaande foutmelding met reden`,
        S().ui.notifications.map(n => [n.severity, n.messageKey, n.detail]),
        [['error', 'notifications.openFailed', reason instanceof Error ? reason.message : reason]]);
      eq(`${label}: geen document- of undo-mutatie`, documentState(), before);
      eq(`${label}: recente lijst behouden`, S().recentFiles, recentsBefore);
      eq(`${label}: ook na herladen behouden`, await loadRecents(), recentsBefore);
      eq(`${label}: ongewijzigd Windows-pad en juiste leesroute`, reads.at(-1),
        [extension === 'mpp' ? 'plugin:fs|read_file' : 'plugin:fs|read_text_file', path]);
    }
  }
}

// Een tijdelijke fout gevolgd door een geslaagde poging: echte IFC-parser en opslagdoel.
failure = null;
for (const path of ['C:\\Users\\Łukasz\\Dokumenty\\Żółć.ifc', '\\\\serwer\\Budowy Łódź\\Żółć.ifc']) {
  S().newProject();
  store.setState({ recentFiles: await addRecent({ kind: 'path', path }, 'Żółć.ifc') });
  store.setState(s => { s.ui.notifications = []; });
  await S().openRecentFile(S().recentFiles[0].id);
  eq('Unicode/UNC: inhoud geopend', S().tasks.map(t => t.name), ['Zażółć gęślą jaźń']);
  eq('Unicode/UNC: pad blijft opslagdoel', S().filePath, path);
  eq('Unicode/UNC: recent blijft bovenaan', S().recentFiles[0].ref, { kind: 'path', path });
  eq('Unicode/UNC: geen foutmelding', S().ui.notifications.filter(n => n.severity === 'error'), []);
}

// Web: geweigerde toestemming levert null; een verdwenen bestand gooit een DOMException.
delete win.__TAURI_INTERNALS__;
for (const denied of [true, false]) {
  S().newProject();
  store.setState(s => { s.ui.notifications = []; });
  const handle = {
    queryPermission: async () => denied ? 'denied' : 'granted',
    requestPermission: async () => 'denied',
    getFile: async () => { throw new DOMException('Bestand verdwenen', 'NotFoundError'); },
  } as unknown as FileSystemFileHandle;
  const entry = { id: 'web-recent', name: 'Żółć.ifc', ref: { kind: 'handle' as const, handle }, addedAt: 1 };
  store.setState({ recentFiles: [entry] });
  const before = documentState();
  await S().openRecentFile(entry.id);
  eq('Web: foutmelding met reden of bestandsnaam',
    S().ui.notifications.map(n => [n.severity, n.messageKey, n.detail]),
    [['error', 'notifications.openFailed', denied ? entry.name : 'Bestand verdwenen']]);
  eq('Web: document intact', documentState(), before);
  eq('Web: recent behouden', S().recentFiles, [entry]);
}

// Configuratiecontract: zonder scope-opslag vervalt een pickergrant buiten $HOME na herstart.
// Dit bewaakt de bedrading; een echte native herstart is hiermee niet uitgevoerd.
const main = readFileSync('src-tauri/src/main.rs', 'utf8').replace(/\/\/[^\n]*/g, '');
const plugins = [...main.matchAll(/\.plugin\(tauri_plugin_(\w+)::init\(\)\)/g)].map(m => m[1]);
eq('Desktop: scope-opslag na fs geregistreerd', plugins.includes('fs') && plugins.includes('persisted_scope')
  && plugins.indexOf('persisted_scope') > plugins.indexOf('fs'), true);
eq('Desktop: scope-plugin als dependency',
  /^tauri-plugin-persisted-scope\s*=/m.test(readFileSync('src-tauri/Cargo.toml', 'utf8')), true);

for (const diff of diffs) console.log(`XX ${diff}`);
console.log(`recent-open: ${checks} controles, ${diffs.length} afwijkingen`);
if (diffs.length) process.exitCode = 1;
