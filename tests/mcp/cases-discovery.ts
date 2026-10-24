// Ontdekkingsbestanden voor de MCP-plugin (issue #570): `runtime.json` en `open-files.json`.
//
// Headless, zonder Tauri: het contract (`discoveryContract.ts`) is puur, de writer
// (`discoveryFiles.ts`) krijgt een geheugen-bestandssysteem, en de bridge-controller (`server.ts`)
// krijgt fakes. De bijwerk-triggers toetsen we tegen de ECHTE store: dezelfde koppeling als
// `useMcpDiscovery` (store-abonnement → `openFilePathsFromState` → `setOpenFiles`).
// Wat hier NIET bewezen wordt: de echte plugin-fs-aanroepen, bestandsrechten op schijf en het
// proces-id uit het initialisatiescript. Dat toetst `tests/mcp/realApp/run-real-app.ts` (CI, Linux).

import { useAppStore, test, assert, assertEq, run } from './harness';
import {
  MCP_DISCOVERY_FILE_MODE,
  MCP_DISCOVERY_FORMAT_VERSION,
  buildOpenFilesFile,
  buildRuntimeFile,
  mcpDiscoveryNames,
  openFileList,
  openFilePathsFromDocuments,
  openFilesWritePolicy,
  readOpenFilesFile,
  readRuntimeFile,
  type PidState,
  serializeDiscoveryFile,
} from '@/services/mcp/discoveryContract';
import {
  createDiscoveryWriter,
  getMcpDiscoveryWriter,
  openFilePathsFromState,
  type DiscoveryDirFs,
  type DiscoveryWriterDeps,
} from '@/services/mcp/discoveryFiles';
import { buildMcpContext, createBridgeController, type BridgeDeps } from '@/services/mcp/server';

// --- Geheugen-bestandssysteem -----------------------------------------------------------------------

interface MemFile { text: string; mode: number }

function memFs(opts: { failRename?: number } = {}) {
  const files = new Map<string, MemFile>();
  const ops: string[] = [];
  let renameFailures = opts.failRename ?? 0;
  const fs: DiscoveryDirFs = {
    async writeNew(name, text, mode) {
      if (files.has(name)) throw new Error(`EEXIST ${name}`);
      ops.push(`write ${name}`);
      files.set(name, { text, mode });
    },
    async rename(from, to) {
      if (renameFailures > 0) { renameFailures -= 1; throw new Error('EBUSY'); }
      const f = files.get(from);
      if (!f) throw new Error(`ENOENT ${from}`);
      ops.push(`rename ${from} -> ${to}`);
      files.delete(from);
      files.set(to, f);
    },
    async remove(name) {
      if (files.delete(name)) ops.push(`remove ${name}`);
    },
    async list() { return [...files.keys()]; },
  };
  return { fs, files, ops };
}

function makeWriter(over: Partial<DiscoveryWriterDeps> = {}, fsOpts?: { failRename?: number }) {
  const mem = memFs(fsOpts);
  const logs: string[] = [];
  let n = 0;
  const writer = createDiscoveryWriter({
    fs: mem.fs,
    names: mcpDiscoveryNames(null),
    pid: async () => 4242,
    appVersion: async () => '2026.43.1',
    now: () => new Date('2026-10-23T10:00:00.000Z'),
    tmpId: () => `t${++n}`,
    log: (m) => { logs.push(m); },
    ...over,
  });
  return { writer, logs, ...mem };
}

const readJson = (files: Map<string, MemFile>, name: string): any => JSON.parse(files.get(name)!.text);

// --- (1) paden blijven letterlijk ---------------------------------------------------------------------

test('openFileList bewaart paden letterlijk (spatie aan het eind, .., backslash, hoofdletters); alleen ontdubbelen en sorteren', () => {
  // Review PR #573: `trim()` maakte van "/home/jan/plan.ifc " een ANDER bestand. Elke omvorming kan dat.
  const raw = ['/home/jan/plan.ifc ', '/home/jan/plan.ifc', '/a/../b.ifc', '/x/back\\slash.ifc', 'C:\\Users\\Jan\\Plan.IFC', '/b.ifc', '/b.ifc', ''];
  assertEq(
    openFileList(raw),
    ['/a/../b.ifc', '/b.ifc', '/home/jan/plan.ifc', '/home/jan/plan.ifc ', '/x/back\\slash.ifc', 'C:\\Users\\Jan\\Plan.IFC'],
    'letterlijk, uniek, gesorteerd; alleen de lege waarde valt weg',
  );
});

test('het register op schijf draagt het pad met spatie letterlijk', async () => {
  const { writer, files } = makeWriter();
  await writer.setOpenFiles(['/home/jan/plan.ifc ']);
  assertEq(readJson(files, 'open-files.json').files, ['/home/jan/plan.ifc '], 'geen trim');
});

// --- (2) inhoud en lezen ------------------------------------------------------------------------------

test('runtime.json: opbouw, slot-newline en terugleesbaar; precies de zes velden', () => {
  const file = buildRuntimeFile({ pid: 7, port: 3877, token: 'abc', appVersion: '2026.43.1', startedAt: new Date('2026-10-23T08:00:00Z') });
  const text = serializeDiscoveryFile(file);
  assert(text.endsWith('}\n'), 'eindigt op een newline');
  assertEq(Object.keys(JSON.parse(text)).sort(), ['appVersion', 'formatVersion', 'pid', 'port', 'startedAt', 'token'], 'velden');
  assertEq(readRuntimeFile(text), { status: 'valid', file: { formatVersion: 1, pid: 7, port: 3877, token: 'abc', appVersion: '2026.43.1', startedAt: '2026-10-23T08:00:00.000Z' } }, 'teruglezen');
});

test('open-files.json: opbouw ontdubbelt en sorteert; terugleesbaar', () => {
  const file = buildOpenFilesFile({ pid: 7, appVersion: 'v', updatedAt: new Date(0), paths: ['/b.ifc', '/x/../a.ifc', '/b.ifc'] });
  assertEq(file.files, ['/b.ifc', '/x/../a.ifc'], 'letterlijk, uniek, gesorteerd');
  assertEq(file.formatVersion, MCP_DISCOVERY_FORMAT_VERSION, 'formatVersion');
  assertEq(readOpenFilesFile(serializeDiscoveryFile(file)), { status: 'valid', file }, 'teruglezen');
});

test('lezen kent drie uitkomsten: ontbrekend, geldig, onbruikbaar (met pid als dat veld geldig is)', () => {
  const ok = { formatVersion: 1, pid: 1, port: 1, token: 't', appVersion: 'v', startedAt: 's' };
  assertEq(readRuntimeFile(null), { status: 'missing' }, 'runtime ontbreekt');
  assertEq(readRuntimeFile(JSON.stringify({ ...ok, later: true })).status, 'valid', 'extra veld mag');
  const bad: Array<[string, string, number | null]> = [
    [JSON.stringify({ ...ok, formatVersion: 2 }), 'formatVersion 2', 1],
    [JSON.stringify({ ...ok, formatVersion: '1' }), 'formatVersion als tekst', 1],
    ['{', 'kapotte JSON', null],
    ['[]', 'geen object', null],
    [JSON.stringify({ ...ok, pid: 0 }), 'pid 0', null],
    [JSON.stringify({ ...ok, port: 70000 }), 'poort buiten bereik', 1],
    [JSON.stringify({ ...ok, token: '' }), 'leeg token', 1],
  ];
  for (const [text, what, pid] of bad) {
    const r = readRuntimeFile(text);
    assertEq([r.status, r.status === 'unusable' ? r.pid : 'n.v.t.'], ['unusable', pid], `runtime: ${what}`);
  }
  const of = { formatVersion: 1, pid: 5, appVersion: 'v', updatedAt: 'u', files: ['/a.ifc'] };
  assertEq(readOpenFilesFile(null), { status: 'missing' }, 'register ontbreekt');
  assertEq(readOpenFilesFile(JSON.stringify(of)).status, 'valid', 'register geldig');
  const badOpen: Array<[string, string, number | null]> = [
    [JSON.stringify({ ...of, files: [1] }), 'pad geen tekst', 5],
    [JSON.stringify({ ...of, formatVersion: 3, files: { lijst: ['/a.ifc'] } }), 'nieuwere versie', 5],
    ['', 'leeg bestand', null],
  ];
  for (const [text, what, pid] of badOpen) {
    const r = readOpenFilesFile(text);
    assertEq([r.status, r.status === 'unusable' ? r.pid : 'n.v.t.'], ['unusable', pid], `register: ${what}`);
  }
});

test('schrijfbeleid: een onbruikbaar register van een (mogelijk) levende app weigert alles', () => {
  const states: PidState[] = ['alive', 'unknown', 'dead'];
  const policy = (text: string | null) => states.map((st) => openFilesWritePolicy(readOpenFilesFile(text), () => st));
  const valid = JSON.stringify({ formatVersion: 1, pid: 5, appVersion: 'v', updatedAt: 'u', files: ['/a.ifc'] });
  const newer = JSON.stringify({ formatVersion: 2, pid: 5, files: { lijst: ['/a.ifc'] } });
  assertEq(policy(null), ['free', 'free', 'free'], 'ontbreekt: vrij');
  assertEq(policy(valid), ['check-files', 'check-files', 'free'], 'geldig: per bestand toetsen, tenzij de app dood is');
  assertEq(policy(newer), ['refuse-all', 'refuse-all', 'free'], 'nieuwere versie: alles weigeren, tenzij de app dood is');
  assertEq(policy('{kapot'), ['refuse-all', 'refuse-all', 'refuse-all'], 'onleesbaar zonder pid: altijd weigeren');
});

test('bestandsnamen: canoniek in productie, met slug voor een dev-instantie', () => {
  assertEq(mcpDiscoveryNames(null), { runtime: 'runtime.json', openFiles: 'open-files.json' }, 'productie');
  assertEq(mcpDiscoveryNames(''), { runtime: 'runtime.json', openFiles: 'open-files.json' }, 'lege slug = productie');
  assertEq(mcpDiscoveryNames('wt-a'), { runtime: 'runtime.wt-a.json', openFiles: 'open-files.wt-a.json' }, 'dev');
});

test('alleen FileRef van de soort path telt: site, browserhandle en naamloos niet; browser ⇒ niets', () => {
  const docs = [
    { filePath: '/a.ifc', fileHandle: null, siteFileId: null },
    { filePath: 'site.ifc', fileHandle: null, siteFileId: 'f-1' },
    { filePath: 'h.ifc', fileHandle: {}, siteFileId: null },
    { filePath: null, fileHandle: null, siteFileId: null },
  ];
  assertEq(openFilePathsFromDocuments(docs, true), ['/a.ifc'], 'desktop');
  assertEq(openFilePathsFromDocuments(docs, false), [], 'browser');
});

// --- (3) writer ---------------------------------------------------------------------------------------

test('bridgeStarted schrijft runtime.json atomair (nieuw halffabricaat, 0600, dan rename)', async () => {
  const { writer, files, ops } = makeWriter();
  await writer.bridgeStarted(3877, 'tok');
  assertEq(ops, ['write runtime.json.t1.tmp', 'rename runtime.json.t1.tmp -> runtime.json'], 'volgorde');
  assertEq([...files.keys()], ['runtime.json'], 'geen halffabricaat over');
  assertEq(files.get('runtime.json')!.mode, MCP_DISCOVERY_FILE_MODE, 'rechten 0600');
  assertEq(readJson(files, 'runtime.json'), {
    formatVersion: 1, pid: 4242, port: 3877, token: 'tok', appVersion: '2026.43.1', startedAt: '2026-10-23T10:00:00.000Z',
  }, 'inhoud');
});

test('bridgeStopped verwijdert runtime.json; een herstart met nieuw token schrijft opnieuw', async () => {
  const { writer, files } = makeWriter();
  await writer.bridgeStarted(3877, 'oud');
  await writer.bridgeStopped();
  assert(!files.has('runtime.json'), 'weg na stop');
  await writer.bridgeStarted(3999, 'nieuw');
  assertEq([readJson(files, 'runtime.json').port, readJson(files, 'runtime.json').token], [3999, 'nieuw'], 'nieuwe poort en token');
});

test('wachtrij: start en direct stop laten geen runtime.json achter', async () => {
  const { writer, files } = makeWriter();
  void writer.bridgeStarted(3877, 'tok');
  void writer.bridgeStopped();
  await writer.idle();
  assert(!files.has('runtime.json'), 'de stop wint, ook als de start nog liep');
});

test('setOpenFiles schrijft alleen bij een andere lijst (volgorde en dubbelen tellen niet)', async () => {
  const { writer, files, ops } = makeWriter();
  await writer.setOpenFiles([]);
  await writer.setOpenFiles([]);
  await writer.setOpenFiles(['/p/a.ifc']);
  await writer.setOpenFiles(['/p/a.ifc', '/p/a.ifc']);
  assertEq(ops.filter((o) => o.startsWith('rename')).length, 2, 'twee schrijfacties: leeg, dan één pad');
  assertEq(readJson(files, 'open-files.json'), {
    formatVersion: 1, pid: 4242, appVersion: '2026.43.1', updatedAt: '2026-10-23T10:00:00.000Z', files: ['/p/a.ifc'],
  }, 'inhoud');
  assertEq(files.get('open-files.json')!.mode, MCP_DISCOVERY_FILE_MODE, 'rechten 0600');
});

test('een mislukte schrijfactie laat geen halffabricaat achter en wordt bij dezelfde lijst opnieuw geprobeerd', async () => {
  const { writer, files, logs } = makeWriter({}, { failRename: 2 });
  await writer.setOpenFiles(['/a.ifc']);
  assertEq([...files.keys()], [], 'halffabricaat opgeruimd');
  assert(logs.some((l) => l.includes('mislukt')), 'fout gelogd');
  await writer.setOpenFiles(['/a.ifc']);
  assertEq(readJson(files, 'open-files.json').files, ['/a.ifc'], 'tweede poging schrijft');
});

test('Windows-achtige rename-fout: één herhaling volstaat', async () => {
  const { writer, files } = makeWriter({}, { failRename: 1 });
  await writer.bridgeStarted(1, 't');
  assert(files.has('runtime.json'), 'na één herhaling geschreven');
});

test('shutdown verwijdert beide bestanden; latere aanroepen schrijven niets meer', async () => {
  const { writer, files } = makeWriter();
  await writer.bridgeStarted(3877, 'tok');
  await writer.setOpenFiles(['/a.ifc']);
  await writer.shutdown();
  assertEq([...files.keys()], [], 'beide weg');
  await writer.setOpenFiles(['/b.ifc']);
  await writer.bridgeStarted(3877, 'tok');
  await writer.idle();
  assertEq([...files.keys()], [], 'na afsluiten niets nieuws');
});

test('startup ruimt eigen halffabricaten en een runtime.json van een vorige sessie op, vreemde bestanden niet', async () => {
  const { writer, files } = makeWriter();
  files.set('runtime.json', { text: '{}', mode: 0o600 });
  files.set('runtime.json.oud.tmp', { text: '{}', mode: 0o600 });
  files.set('open-files.json.oud.tmp', { text: '{}', mode: 0o600 });
  files.set('runtime.wt-a.json', { text: '{}', mode: 0o600 });
  files.set('runtime.wt-a.json.x.tmp', { text: '{}', mode: 0o600 });
  await writer.startup();
  assertEq([...files.keys()].sort(), ['runtime.wt-a.json', 'runtime.wt-a.json.x.tmp'], 'alleen eigen namen opgeruimd');
});

test('startup na een bridge-start in deze sessie laat runtime.json staan (autostart was eerder)', async () => {
  const { writer, files } = makeWriter();
  void writer.bridgeStarted(3877, 'tok');
  await writer.startup();
  assert(files.has('runtime.json'), 'eigen runtime-bestand blijft');
});

test('onbekend proces-id: niets schrijven, één waarschuwing', async () => {
  const { writer, files, logs } = makeWriter({ pid: async () => null });
  await writer.bridgeStarted(3877, 'tok');
  await writer.setOpenFiles(['/a.ifc']);
  assertEq([...files.keys()], [], 'geen bestanden');
  assertEq(logs.filter((l) => l.includes('proces-id')).length, 1, 'één waarschuwing');
});

test('buiten de desktop-app is er geen writer (browser, platformbouw, tests)', () => {
  assertEq(getMcpDiscoveryWriter(), null, 'geen Tauri ⇒ null');
});

// --- (4) bridge-controller → runtime-bestand ---------------------------------------------------------

function fakeBridge(opts: { failStart?: boolean; token?: () => string; port?: () => number } = {}) {
  const events: string[] = [];
  const deps: BridgeDeps = {
    listen: async () => () => {},
    invoke: async (cmd) => { if (opts.failStart && cmd === 'mcp_bridge_start') throw new Error('kon niet binden'); },
    emit: () => {},
    setStatus: () => {},
    buildContext: buildMcpContext,
    handleMessage: async () => '{}',
    getPort: opts.port ?? (() => 3877),
    getToken: opts.token ?? (() => 'tok'),
    onBridgeStarted: (port, token) => { events.push(`start ${port} ${token}`); },
    onBridgeStopped: () => { events.push('stop'); },
  };
  return { deps, events };
}

test('controller: start meldt poort en token; stop meldt stop', async () => {
  const fake = fakeBridge();
  const c = createBridgeController(fake.deps);
  await c.start();
  await c.stop();
  assertEq(fake.events, ['start 3877 tok', 'stop'], 'start en stop');
});

test('controller: een mislukte start (poort bezet) meldt stop, nooit start', async () => {
  const fake = fakeBridge({ failStart: true });
  await createBridgeController(fake.deps).start();
  assertEq(fake.events, ['stop'], 'geen runtime-bestand bij een bezette poort');
});

test('controller: herstart na nieuw token of andere poort schrijft de nieuwe waarden', async () => {
  let token = 'oud';
  let port = 3877;
  const fake = fakeBridge({ token: () => token, port: () => port });
  const c = createBridgeController(fake.deps);
  await c.start();
  token = 'nieuw';
  port = 3900;
  await c.restart();
  assertEq(fake.events, ['start 3877 oud', 'stop', 'start 3900 nieuw'], 'stop, dan start met nieuwe waarden');
});

test('controller: een fout in het ontdekkingsbestand stopt de bridge niet', async () => {
  const fake = fakeBridge();
  fake.deps.onBridgeStarted = () => { throw new Error('schijf vol'); };
  const c = createBridgeController(fake.deps);
  await c.start();
  assertEq(c.activeListenerCount(), 2, 'listeners blijven gekoppeld');
});

// --- (5) bijwerk-triggers tegen de echte store ---------------------------------------------------------

test('register volgt de store: openen, tweede document, documentwissel, Opslaan als, sluiten', async () => {
  const { writer, files } = makeWriter();
  const current = () => readJson(files, 'open-files.json').files as string[];
  const push = () => { void writer.setOpenFiles(openFilePathsFromState(useAppStore.getState(), true)); };
  push();
  const unsubscribe = useAppStore.subscribe(push);
  try {
    await writer.idle();
    assertEq(current(), [], 'vers, naamloos document: leeg register');

    // "Openen": het actieve document krijgt een pad.
    useAppStore.setState({ filePath: '/proj/a.ifc' });
    await writer.idle();
    assertEq(current(), ['/proj/a.ifc'], 'na openen');

    // Tweede (naamloos) document: het eerste slaapt, maar blijft open.
    const first = useAppStore.getState().activeDocumentId;
    const second = useAppStore.getState().newDocument();
    await writer.idle();
    assertEq(current(), ['/proj/a.ifc'], 'slapend document telt mee, naamloos niet');

    // "Opslaan als" op het tweede document.
    useAppStore.setState({ filePath: '/proj/b.ifc' });
    await writer.idle();
    assertEq(current(), ['/proj/a.ifc', '/proj/b.ifc'], 'na Opslaan als');

    // Documentwissel verandert de set niet.
    useAppStore.getState().switchDocument(first);
    await writer.idle();
    assertEq(current(), ['/proj/a.ifc', '/proj/b.ifc'], 'na wissel');

    // "Opslaan als" naar een andere naam: het oude pad verdwijnt.
    useAppStore.setState({ filePath: '/proj/a-v2.ifc' });
    await writer.idle();
    assertEq(current(), ['/proj/a-v2.ifc', '/proj/b.ifc'], 'oud pad weg');

    // Sluiten.
    useAppStore.getState().closeDocument(second);
    await writer.idle();
    assertEq(current(), ['/proj/a-v2.ifc'], 'na sluiten');

    // Site-bestand: geen pad op schijf.
    useAppStore.setState({ siteFileId: 'f-9' });
    await writer.idle();
    assertEq(current(), [], 'site-bestand telt niet');
  } finally {
    unsubscribe();
  }
});

await run();
