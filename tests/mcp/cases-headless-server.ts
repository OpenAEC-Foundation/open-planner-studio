import { fileToolDeps } from '@/services/mcp/tools/fileTools';
// Headless MCP-server (issue #570, `headless/mcp-server/`): de `planner_*`-tools zonder app, op Node.
//
// Twee routes, beide met de OFFICIËLE MCP-client (`@modelcontextprotocol/sdk`):
//   A. In proces: de host (`createHeadlessHost`) achter zijn HTTP-transport, met dezelfde controles als de
//      bridge (`externalClient.ts`): sessies, 400/404, token, Origin, read-only, pauze, drift-anker.
//   B. Als gebouwd bestand: `scripts/build-mcp-server.mjs` bouwt `server.mjs`, de test kopieert de
//      build-uitvoer naar een lege tijdelijke map BUITEN de repo en start hem daar (zonder repo, zonder
//      `node_modules`). Over stdio: `tools/list` = de registry, gids en skills ingebed, een voorbeeld
//      openen → taken en een relatie toevoegen → rekenen → opslaan → opnieuw openen → vergelijken, de
//      MCP-backup, en de padbeveiliging (buiten de werkmap, `..`, symlinks, dode link, relatief pad).
//      Over HTTP: tools/list, fout token, ontbrekende sessie-id, Origin, en de startweigeringen.
import { test, assert, assertEq, run } from './harness';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { cpSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { getTools } from '@/services/mcp/toolRegistry';
import { MCP_INSTRUCTIONS, MCP_SERVER_NAME, MCP_SERVER_VERSION, DEFAULT_PROTOCOL_VERSION } from '@/services/mcp/dispatcher';
import { AGENT_GUIDE_PATH, AGENT_SKILLS, skillAssetPath } from '@/services/mcp/tools/guideTools';
import { createHeadlessHost, headlessInstructions } from '../../headless/mcp-server/src/host';
import { startHttpTransport } from '../../headless/mcp-server/src/http';
import { parseOptions, isLoopbackHost } from '../../headless/mcp-server/src/options';
import { createNodeFileFs, isInside, ScopeEscapeError, WorkingDirectoryRestoreError, type NodeFsPhase } from '../../headless/mcp-server/src/nodeFs';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { writeCSV } from '@/services/csv/csvWriter';
import { externalClientChecks, connectClient, type AppProbe } from './externalClient';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = join(ROOT, 'public');
const EXAMPLE = join(PUBLIC, 'examples', '10-villa-wassenaar.ifc');
const appVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;
const tmp = mkdtempSync(join(tmpdir(), 'ops-headless-mcp-'));
const TOKEN = 'b'.repeat(64);

function publicAssets(): Record<string, string> {
  const assets: Record<string, string> = {};
  for (const rel of [AGENT_GUIDE_PATH, ...AGENT_SKILLS.map((s) => skillAssetPath(s.name))]) {
    assets[rel] = readFileSync(join(PUBLIC, rel), 'utf8');
  }
  return assets;
}

/** De registry zoals `tools/list` hem hoort te tonen (zelfde vorm als `toolListEntry` in de dispatcher). */
const registryList = () => getTools().map((t) => ({
  name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations,
}));

/** JSON met gesorteerde sleutels: de SDK-client valideert `tools/list` met zod en zet de sleutels van een
 *  object daarbij in een andere volgorde. De inhoud moet gelijk zijn, de volgorde van sleutels niet. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as object).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
  }
  return value;
}

interface Outcome { isError: boolean; s: Record<string, any> }
async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<Outcome> {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
  return { isError: res.isError === true, s: (res.structuredContent ?? {}) as Record<string, any> };
}
async function ok(client: Client, name: string, args: Record<string, unknown> = {}): Promise<any> {
  const r = await call(client, name, args);
  assert(!r.isError && r.s.ok === true, `${name} faalde: ${JSON.stringify(r.s).slice(0, 600)}`);
  return r.s.data;
}
async function refused(client: Client, name: string, args: Record<string, unknown>, code: string, label: string): Promise<Outcome> {
  const r = await call(client, name, args);
  assert(r.isError, `${label}: verwacht een weigering, kreeg ${JSON.stringify(r.s).slice(0, 400)}`);
  assertEq(r.s.code, code, `${label}: foutcode`);
  return r;
}

// --- A. In proces: host + HTTP-transport met de bridgecontroles ----------------------------------

const rootA = join(tmp, 'root-a');
mkdirSync(rootA);
const dataA = join(tmp, 'data-a');
const host = await createHeadlessHost({ root: rootA, dataDir: dataA, backup: true, readOnly: false, assets: publicAssets() });
const httpA = await startHttpTransport({
  token: TOKEN, port: 0, buildContext: host.buildContext, handleMessage: host.handleMessage,
});
const app = host.app;
const probe: AppProbe = {
  taskCount: async () => app.store.getState().tasks.length,
  undo: async () => { app.store.getState().undo(); },
  setSafety: async (flags) => { app.store.getState().setUI(flags); },
  newDocument: async () => app.store.getState().newDocument(),
  closeDocument: async (id) => { app.store.getState().closeDocument(id); },
  switchDocument: async (id) => { app.store.getState().switchDocument(id); },
  restartBridge: async () => { httpA.restart(); },
};
const checks = externalClientChecks({
  url: httpA.url,
  token: TOKEN,
  probe,
  expected: {
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    instructions: `${MCP_INSTRUCTIONS}\n${headlessInstructions(host.root)}`,
    tools: getTools().map((t) => ({ name: t.name, annotations: t.annotations })),
  },
});
for (const check of checks) test(`A in proces (HTTP, bridgecontract): ${check.name}`, check.fn);

test('A: de eerste mutatie schreef één MCP-backup in <data-dir>/ai-backups', () => {
  const root = join(dataA, 'ai-backups');
  assert(existsSync(root), 'map ai-backups bestaat');
  const files = readdirSync(root).flatMap((bucket) => readdirSync(join(root, bucket)));
  assert(files.length >= 1 && files.every((f) => f.endsWith('.ifc')), `backups: ${files.join(', ')}`);
});

test('A: opties — standaard stdio, werkmap = huidige map, env werkt, CLI wint, geen --token', () => {
  const d = parseOptions([], {}, '/w');
  assertEq([d.transport, d.root, d.host, d.port, d.backup, d.readOnly], ['stdio', '/w', '127.0.0.1', 3878, true, false], 'standaard');
  const e = parseOptions([], { OPS_MCP_TRANSPORT: 'http', OPS_MCP_ROOT: 'sub', OPS_MCP_PORT: '0', OPS_MCP_BACKUP: 'off', OPS_MCP_READ_ONLY: '1' }, '/w');
  assertEq([e.transport, e.root, e.port, e.backup, e.readOnly], ['http', '/w/sub', 0, false, true], 'uit env');
  const c = parseOptions(['--root', '/x', '--transport=stdio'], { OPS_MCP_ROOT: '/y', OPS_MCP_TRANSPORT: 'http' }, '/w');
  assertEq([c.root, c.transport], ['/x', 'stdio'], 'CLI wint van env');
  for (const bad of [['--token', 'x'], ['--host', '0.0.0.0'], ['--port', '70000'], ['--onbekend'], ['los']]) {
    let threw = false;
    try { parseOptions(bad, {}, '/w'); } catch { threw = true; }
    assert(threw, `hoort te weigeren: ${bad.join(' ')}`);
  }
  assertEq(['127.0.0.1', '127.1.2.3', '::1', 'localhost', '0.0.0.0', '10.0.0.1'].map(isLoopbackHost),
    [true, true, true, true, false, false], 'loopback-herkenning');
});

test('A: slot-haak — een bestand dat in de app open staat, wordt geweigerd; standaard staat niets open', async () => {
  const locked = await createNodeFileFs(host.root, async () => true);
  const reason = await locked.confine!(join(host.root, 'plan.ifc'));
  assert(reason !== null && reason.includes('is open in Open Planner Studio'), `slotmelding: ${reason}`);
  assertEq(await (await createNodeFileFs(host.root)).confine!(join(host.root, 'plan.ifc')), null, 'zonder register: vrij');
});

// --- A2. Bestandstoegang met haken (review PR #572, bevindingen 1, 2 en 4) ---------------------------
// Fouten en mapwissels op een exact moment zijn alleen met een haak in hetzelfde proces te maken. Het
// is dezelfde module die in `server.mjs` gebundeld zit (`headless/mcp-server/src/nodeFs.ts`).

const fsRoot = join(tmp, 'fs-root');
const fsOutside = join(tmp, 'fs-buiten');
const ORIGINAL = 'ISO-10303-21;\n/* origineel */\n';
const tmpFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.tmp'));

async function expectReject(promise: Promise<unknown>, label: string, isScope = false): Promise<void> {
  let caught: unknown = null;
  try { await promise; } catch (e) { caught = e; }
  assert(caught !== null, `${label}: verwacht een fout`);
  if (isScope) assert(caught instanceof ScopeEscapeError, `${label}: verwacht een scopeweigering, kreeg ${String(caught)}`);
}

test('A2 bevinding 1: schrijf- en rename-fout laten het origineel byte-gelijk, ook via een link binnen de werkmap', async () => {
  mkdirSync(fsRoot, { recursive: true });
  writeFileSync(join(fsRoot, 'plan.ifc'), ORIGINAL);
  symlinkSync(join(fsRoot, 'plan.ifc'), join(fsRoot, 'link.ifc'));
  for (const phase of ['write', 'rename'] as const) {
    for (const name of ['plan.ifc', 'link.ifc']) {
      const fs = await createNodeFileFs(fsRoot, undefined, {
        fault: (p) => { if (p === phase) throw new Error(`nagebootste ${p}-fout`); },
      });
      await expectReject(fs.writeTextFile(join(fsRoot, name), 'NIEUW'), `${phase}-fout via ${name}`);
      assertEq(readFileSync(join(fsRoot, 'plan.ifc'), 'utf8'), ORIGINAL, `${phase}-fout via ${name}: origineel byte-gelijk`);
      assertEq(tmpFiles(fsRoot), [], `${phase}-fout via ${name}: halffabricaat opgeruimd`);
    }
  }
  // Zonder fout: via de link wordt het ECHTE doel atomair vervangen en blijft de link een link.
  const fs = await createNodeFileFs(fsRoot);
  await fs.writeTextFile(join(fsRoot, 'link.ifc'), 'NIEUW');
  assert(lstatSync(join(fsRoot, 'link.ifc')).isSymbolicLink(), 'de link blijft een link');
  assertEq(readFileSync(join(fsRoot, 'plan.ifc'), 'utf8'), 'NIEUW', 'het echte doel is vervangen');
  writeFileSync(join(fsRoot, 'plan.ifc'), ORIGINAL);
});

test('knownbug 216: lange geldige doelnamen blijven schrijfbaar en fouten houden het origineel intact', async () => {
  // De bestaande A2-suite toetst de POSIX-bestandslaag; dit is geen Windows MAX_PATH-bewijs.
  for (const name of ['a'.repeat(236) + '.ifc', 'é'.repeat(118) + '.ifc']) {
    assertEq(Buffer.byteLength(name, 'utf8'), 240, 'fixture: doelnaam van 240 bytes');
    const target = join(fsRoot, name);
    // De directe fixture-write bewijst eerst dat het bestandssysteem de doelnaam accepteert.
    writeFileSync(target, ORIGINAL);
    const fs = await createNodeFileFs(fsRoot);
    await fs.writeTextFile(target, 'LANG NIEUW');
    assertEq(readFileSync(target, 'utf8'), 'LANG NIEUW', 'lang doel vervangen');
    assertEq(tmpFiles(fsRoot), [], 'geen halffabricaat na succes');
    for (const phase of ['write', 'rename'] as const) {
      writeFileSync(target, ORIGINAL);
      let reached = false;
      const failing = await createNodeFileFs(fsRoot, undefined, { fault: p => {
        if (p === phase) { reached = true; throw new Error('lange naam testfout'); }
      } });
      await expectReject(failing.writeTextFile(target, 'MAG NIET'), 'lange naam ' + phase);
      assert(reached, 'foutpunt bereikt, niet eerder ENAMETOOLONG');
      assertEq(readFileSync(target, 'utf8'), ORIGINAL, 'lange naam: origineel behouden');
      assertEq(tmpFiles(fsRoot), [], 'lange naam: eigen halffabricaat opgeruimd');
    }
    unlinkSync(target);
    await fs.writeTextFile(target, 'NIEUW LANG DOEL');
    assertEq(readFileSync(target, 'utf8'), 'NIEUW LANG DOEL', 'nieuw lang doel aangemaakt');
    unlinkSync(target);
  }
});

test('A2 (215): doelmap synchroniseren na rename, met expliciete fout als het bestand al vervangen is', async () => {
  if (process.platform === 'win32') return; // Deze POSIX-route beweert geen Windows-durability.
  const folder = join(tmp, 'directory-sync');
  mkdirSync(folder);
  const target = join(folder, 'plan.ifc');
  const linked = join(folder, 'link.ifc');
  writeFileSync(target, ORIGINAL);
  symlinkSync(target, linked);
  let syncs = 0;
  let lastFd = -1;
  const fs = await createNodeFileFs(folder, undefined, {
    syncDirectory: (fd) => {
      syncs++;
      lastFd = fd;
      const actual = fstatSync(fd, { bigint: true });
      const expected = lstatSync(folder, { bigint: true });
      assert(actual.isDirectory() && actual.dev === expected.dev && actual.ino === expected.ino,
        'fsync krijgt het gecontroleerde map-object');
      assertEq(readFileSync(target, 'utf8'), 'NIEUW', 'rename is vóór directory-fsync uitgevoerd');
      assertEq(tmpFiles(folder), [], 'halffabricaat is al hernoemd');
      fsyncSync(fd); // Niet alleen de haak: ook de echte syscall op de echte map.
    },
  });
  for (const name of [target, linked]) {
    await fs.writeTextFile(name, 'NIEUW');
    let closed = false;
    try { fstatSync(lastFd); } catch { closed = true; }
    assert(closed, 'directory-handle gesloten na succes');
  }
  assertEq(syncs, 2, 'iedere save synchroniseert de doelmap, ook via een symlink');
  assert(lstatSync(linked).isSymbolicLink(), 'symlink behouden');
  const failing = await createNodeFileFs(folder, undefined, {
    syncDirectory: (fd) => { lastFd = fd; throw new Error('nagebootste directory-I/O-fout'); },
  });
  let message = '';
  try { await failing.writeTextFile(target, 'REEDS VERVANGEN'); } catch (error) { message = String(error); }
  assert(message.includes('was replaced') && message.includes('crash durability is unconfirmed')
    && message.includes('nagebootste directory-I/O-fout'), `eerlijk foutbericht na commit: ${message}`);
  assertEq(readFileSync(target, 'utf8'), 'REEDS VERVANGEN', 'geen onmogelijke rollback of verwijdering na rename');
  assertEq(tmpFiles(folder), [], 'geen los halffabricaat na syncfout');
  let closed = false;
  try { fstatSync(lastFd); } catch { closed = true; }
  assert(closed, 'directory-handle ook gesloten na syncfout');
  // De fout laat geen bruikbaarheidsprobleem achter: een volgende save kan normaal slagen.
  await fs.writeTextFile(target, 'NIEUW');
  assertEq(syncs, 3, 'volgende save synchroniseert opnieuw');
});

test('A2 (220): verdwenen procesmap valt terug, dubbele herstelfout bewaart de oorspronkelijke fout', async () => {
  if (process.platform === 'win32') return; // Windows laat de actieve procesmap niet zo verplaatsen.
  const runnerCwd = process.cwd();
  for (const loseRoot of [false, true]) {
    const base = mkdtempSync(join(tmp, 'cwd-restore-'));
    const previous = join(base, 'previous');
    const root = join(base, 'root');
    const moved = join(base, 'root-moved');
    mkdirSync(previous); mkdirSync(root);
    writeFileSync(join(root, 'plan.ifc'), ORIGINAL);
    const originalError = new Error('originele schrijffout blijft zichtbaar');
    const fs = await createNodeFileFs(root, undefined, {
      fault: (phase) => {
        if (phase !== 'write') return;
        // Nu draait de operatie in root: previous is leeg en niet de actuele procesmap.
        rmSync(previous, { recursive: true });
        if (loseRoot) renameSync(root, moved);
        throw originalError;
      },
    });
    let caught: unknown;
    try {
      process.chdir(previous);
      try { await fs.writeTextFile(join(root, 'plan.ifc'), 'MAG NIET WORDEN GESCHREVEN'); }
      catch (error) { caught = error; }
      if (loseRoot) {
        assert(caught instanceof WorkingDirectoryRestoreError, 'dubbele herstelfout heeft eigen type');
        const combined = caught as WorkingDirectoryRestoreError;
        assertEq(combined.errors.length, 3, 'operatiefout plus beide herstelfouten');
        assert(combined.errors[0] === originalError, 'originele foutobject behouden');
        assert(combined.errors.slice(1).every((error) => error instanceof Error && 'code' in error
          && error.code === 'ENOENT'), 'beide verdwenen paden verklaren de herstelfouten');
        assert(combined.message.includes(originalError.message) && combined.message.includes('unrestored'),
          'toolfout bevat oorspronkelijke oorzaak en de mislukte terugkeer');
        assertEq(process.cwd(), moved, 'geen onterechte claim dat de procesmap hersteld is');
      } else {
        assert(caught === originalError, 'geslaagde terugval bewaart de originele operatiefout');
        assertEq(process.cwd(), root, 'de bestaande werkmap is de terugval');
      }
      const actual = loseRoot ? moved : root;
      assertEq(readFileSync(join(actual, 'plan.ifc'), 'utf8'), ORIGINAL, 'doel niet gewijzigd');
      assertEq(tmpFiles(actual), [], 'eigen halffabricaat opgeruimd vóór herstel van procesmap');
    } finally {
      process.chdir(runnerCwd); // Testisolatie, ook als een assert faalt.
    }
  }
});

test('A2 bevinding 2: een map die tussen controle en operatie een link naar buiten wordt, wordt geweigerd', async () => {
  mkdirSync(fsOutside, { recursive: true });
  writeFileSync(join(fsOutside, 'plan.ifc'), 'GEHEIM');
  /** Vervang `<root>/sub` door een link naar buiten, op het gekozen moment. */
  let swaps = 0;
  const swapAt = (when: NodeFsPhase) => (phase: NodeFsPhase) => {
    if (phase !== when) return;
    renameSync(join(fsRoot, 'sub'), join(fsRoot, `sub-weg-${when}-${++swaps}`));
    symlinkSync(fsOutside, join(fsRoot, 'sub'), 'dir');
  };
  const reset = () => {
    rmSync(join(fsRoot, 'sub'), { recursive: true, force: true });
    mkdirSync(join(fsRoot, 'sub'));
    writeFileSync(join(fsRoot, 'sub', 'plan.ifc'), ORIGINAL);
  };
  // Route A van review ronde 2 is de wissel op 'realpath': `realpath` zag de map binnen, de `stat`-
  // aanroepen daarna zien al het bestand BUITEN (en leggen die identiteit vast).
  for (const when of ['realpath', 'open'] as const) {
    reset();
    const reader = await createNodeFileFs(fsRoot, undefined, { afterCheck: swapAt(when) });
    await expectReject(reader.readTextFile(join(fsRoot, 'sub', 'plan.ifc')), `lezen na mapwissel (${when})`, true);
  }
  for (const when of ['realpath', 'create', 'rename'] as const) {
    reset();
    const writer = await createNodeFileFs(fsRoot, undefined, { afterCheck: swapAt(when) });
    await expectReject(writer.writeTextFile(join(fsRoot, 'sub', 'plan.ifc'), 'NIEUW'), `schrijven na mapwissel (${when})`, true);
    assertEq(readFileSync(join(fsOutside, 'plan.ifc'), 'utf8'), 'GEHEIM', `${when}: het bestand buiten is niet overschreven`);
    assertEq(readdirSync(fsOutside), ['plan.ifc'], `${when}: buiten de werkmap staat niets nieuws`);
  }
  {
    // Ook `exists`/`stat` (de aliascontrole van de export) geven bij route A geen gegevens van buiten.
    reset();
    const prober = await createNodeFileFs(fsRoot, undefined, { afterCheck: swapAt('realpath') });
    await expectReject(prober.stat(join(fsRoot, 'sub', 'plan.ifc')), 'stat na mapwissel (realpath)', true);
  }
  rmSync(join(fsRoot, 'sub'), { recursive: true, force: true });
});

test('A2 bevinding 2, route B: een map die mét het halffabricaat naar buiten verhuist, krijgt geen rename', async () => {
  // Route B van review ronde 2: de gecontroleerde map verhuist mét het halffabricaat naar buiten en er
  // komt een link terug. Map en halffabricaat houden hun identiteit; alleen de ligging verandert.
  const away = join(tmp, 'fs-buiten-b');
  mkdirSync(away, { recursive: true });
  const moveOutAt = (when: NodeFsPhase, to: string) => (phase: NodeFsPhase) => {
    if (phase !== when) return;
    renameSync(join(fsRoot, 'sub'), to);
    symlinkSync(to, join(fsRoot, 'sub'), 'dir');
  };
  const reset = () => {
    rmSync(join(fsRoot, 'sub'), { recursive: true, force: true });
    mkdirSync(join(fsRoot, 'sub'));
    writeFileSync(join(fsRoot, 'sub', 'plan.ifc'), ORIGINAL);
  };
  // Verhuizing vóór de laatste controle (het moment uit de review): geen rename, origineel ongewijzigd.
  reset();
  const movedB = join(away, 'sub-b');
  const writer = await createNodeFileFs(fsRoot, undefined, { afterCheck: moveOutAt('rename', movedB) });
  await expectReject(writer.writeTextFile(join(fsRoot, 'sub', 'plan.ifc'), 'NIEUW'), 'route B: schrijven', true);
  assertEq(readFileSync(join(movedB, 'plan.ifc'), 'utf8'), ORIGINAL, 'route B: het bestand in de verhuisde map is niet vervangen');
  assertEq(readdirSync(movedB), ['plan.ifc'], 'route B: het halffabricaat is opgeruimd');
  // Ook bij lezen: verhuist de map tijdens het openen naar buiten, dan geeft de server niets terug.
  reset();
  const movedRead = join(away, 'sub-lezen');
  const reader = await createNodeFileFs(fsRoot, undefined, { afterCheck: moveOutAt('open', movedRead) });
  await expectReject(reader.readTextFile(join(fsRoot, 'sub', 'plan.ifc')), 'route B: lezen', true);
  // De resterende grens, eerlijk getest: een verhuizing NA de laatste controle en vóór de rename kan de
  // server niet tegenhouden. Hij merkt het direct erna en meldt een fout; de rename gebeurde in de
  // verhuisde map (hetzelfde map-object dat binnen lag), niet via een pad naar een andere map.
  reset();
  const movedLate = join(away, 'sub-laat');
  const late = await createNodeFileFs(fsRoot, undefined, { afterCheck: moveOutAt('commit', movedLate) });
  let lateError: unknown = null;
  try { await late.writeTextFile(join(fsRoot, 'sub', 'plan.ifc'), 'NIEUW'); } catch (e) { lateError = e; }
  assert(lateError instanceof ScopeEscapeError && lateError.message.includes('moved out of the working folder'),
    `laat: verwacht de melding over een verhuisde map, kreeg ${String(lateError)}`);
  assertEq(readdirSync(away).sort(), ['sub-b', 'sub-laat', 'sub-lezen'], 'laat: buiten staat alleen wat de test zelf verhuisde');
  rmSync(join(fsRoot, 'sub'), { recursive: true, force: true });
});

test('A2 bevinding 4: paden die alleen in hoofdletters verschillen tellen niet als binnen', async () => {
  assertEq([isInside('/data/Plans', '/data/Plans/x.ifc'), isInside('/data/Plans', '/data/plans/x.ifc'),
    isInside('/data/Plans', '/data/PlansX/x.ifc'), isInside('C:\\Plans', 'c:\\plans\\x.ifc', '\\')],
  [true, false, false, false], 'exacte vergelijking, ook in Windows-vorm');
  const upper = join(tmp, 'Hoofd');
  const lower = join(tmp, 'hoofd');
  mkdirSync(upper);
  mkdirSync(lower);
  writeFileSync(join(lower, 'geheim.ifc'), 'GEHEIM');
  symlinkSync(lower, join(upper, 'naar-kleine-letters'), 'dir');
  const fs = await createNodeFileFs(upper);
  const reason = await fs.confine!(join(upper, 'naar-kleine-letters', 'geheim.ifc'));
  assert(reason !== null && reason.includes('outside the working folder'), `link naar de map met kleine letters: ${reason}`);
});

// Knownbug 219: scopeverlies ná de voorcontrole blijft SCOPE door echte toolhandler en HTTP-client.
test('A2 late scopeweigering bereikt de MCP-client bij import en export zonder buitenwerkmap-I/O', async () => {
  const originalGetFs = fileToolDeps.getFs;
  const outsideDir = join(tmp, 'scope-219-outside');
  mkdirSync(outsideDir);
  writeFileSync(join(outsideDir, 'plan.ifc'), 'BUITEN BLIJFT INTACT');
  app.store.getState().setUI({ aiPaused: false, aiReadOnly: false });
  app.store.getState().newDocument();
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  try {
    for (const operation of ['import', 'export'] as const) {
      const dir = join(rootA, 'scope-219-' + operation);
      mkdirSync(dir);
      const original = readFileSync(EXAMPLE, 'utf8');
      writeFileSync(join(dir, 'plan.ifc'), original);
      let swapped = false;
      const fs = await createNodeFileFs(rootA, undefined, { afterCheck: phase => {
        if (!swapped && phase === (operation === 'import' ? 'open' : 'create')) {
          swapped = true;
          renameSync(dir, dir + '-held');
          symlinkSync(outsideDir, dir, 'dir');
        }
      } });
      fileToolDeps.getFs = async () => fs;
      const taskCount = app.store.getState().tasks.length;
      await refused(client, operation === 'import' ? 'planner_import_schedule' : 'planner_export_ifc',
        { path: join(dir, 'plan.ifc'), ...(operation === 'export' ? { overwrite: true } : {}) }, 'SCOPE', operation);
      assert(swapped, 'de map wisselde tijdens de operatie, niet vóór de voorcontrole');
      assertEq(readFileSync(join(outsideDir, 'plan.ifc'), 'utf8'), 'BUITEN BLIJFT INTACT', 'buitenbestand ongewijzigd');
      assertEq(readFileSync(join(dir + '-held', 'plan.ifc'), 'utf8'), original, 'origineel ongewijzigd');
      assertEq(app.store.getState().tasks.length, taskCount, 'geen document geïmporteerd');
      assertEq(tmpFiles(outsideDir), [], 'geen halffabricaat buiten de werkmap');
    }
    fileToolDeps.getFs = async () => createNodeFileFs(rootA);
    await refused(client, 'planner_import_schedule', { path: join(rootA, 'ordinary-missing.ifc') },
      'NOT_FOUND', 'gewone ontbrekende bron behoudt code');
    const ordinaryTarget = join(rootA, 'ordinary-write.ifc');
    writeFileSync(ordinaryTarget, 'OUD GEWOON');
    fileToolDeps.getFs = async () => createNodeFileFs(rootA, undefined, { fault: phase => {
      if (phase === 'write') {
        const error = new Error('ordinary write failure');
        error.name = 'ScopeEscapeError'; // Alleen een gelijknamige Error is niet het gedeelde contract.
        throw error;
      }
    } });
    await refused(client, 'planner_export_ifc', { path: ordinaryTarget, overwrite: true },
      'INTERNAL', 'gewone schrijffout behoudt code');
    assertEq(readFileSync(ordinaryTarget, 'utf8'), 'OUD GEWOON', 'gewone fout behoudt origineel');
  } finally {
    fileToolDeps.getFs = originalGetFs;
    await client.close();
  }
});

test('A: afsluiten', async () => { await httpA.close(); });

// --- B. De gebouwde server, gekopieerd naar een lege map --------------------------------------------

const buildDir = join(tmp, 'build');
const runDir = join(tmp, 'run');
const work = join(tmp, 'werkmap');
const outside = join(tmp, 'buiten');
const dataB = join(tmp, 'data-b');
const server = join(runDir, 'server.mjs');

test('B: bouwen en de uitvoer naar een lege map buiten de repo kopiëren', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/build-mcp-server.mjs'), '--out', buildDir], { cwd: ROOT, encoding: 'utf8' });
  assertEq(r.status, 0, `build:mcp-server faalde:\n${r.stdout}${r.stderr}`);
  cpSync(buildDir, runDir, { recursive: true });
  assertEq(readdirSync(runDir).sort(), ['LICENSE', 'LICENSE.GPL', 'README.md', 'THIRD-PARTY-NOTICES.md', 'package.json', 'server.mjs'], 'build-uitvoer');
  const pkg = JSON.parse(readFileSync(join(runDir, 'package.json'), 'utf8'));
  assertEq([pkg.version, pkg.bin?.['open-planner-mcp'], pkg.dependencies], [appVersion, './server.mjs', undefined], 'package.json');
  assert(!readFileSync(server, 'utf8').includes(ROOT), 'de bundel verwijst niet naar het repo-pad');
  mkdirSync(work);
  mkdirSync(outside);
  cpSync(EXAMPLE, join(work, 'villa.ifc'));
  writeFileSync(join(outside, 'geheim.ifc'), readFileSync(EXAMPLE, 'utf8'));
  symlinkSync(outside, join(work, 'link-naar-buiten'), 'dir');
  symlinkSync(join(outside, 'geheim.ifc'), join(work, 'geheim-link.ifc'));
  symlinkSync(join(outside, 'bestaat-niet.ifc'), join(work, 'dode-link.ifc'));
});

test('B: --version en --help, ook zonder repo', () => {
  const v = spawnSync(process.execPath, [server, '--version'], { cwd: runDir, encoding: 'utf8' });
  assertEq([v.status, v.stdout.trim()], [0, appVersion], '--version');
  const h = spawnSync(process.execPath, [server, '--help'], { cwd: runDir, encoding: 'utf8' });
  assert(h.status === 0 && h.stdout.includes('OPS_MCP_ROOT'), '--help noemt de omgevingsvariabelen');
});

/** Een stdio-transport voor de SDK-client: de officiële framing (`ReadBuffer`/`serializeMessage`) rond
 *  een eigen `spawn` (de SDK-transport gebruikt `cross-spawn`, dat esbuild niet als ESM bundelt). */
class SpawnStdioTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  private child?: ChildProcessWithoutNullStreams;
  private buffer = new ReadBuffer();
  stderr = '';
  constructor(private args: string[], private env: Record<string, string> = {}, private fileSizeLimitKb?: number) {}
  async start(): Promise<void> {
    // Met een limiet start bash de server met `ulimit -f`: een te groot bestand schrijven breekt dan af,
    // zoals een volle schijf of een crash midden in het schrijven.
    const [cmd, argv] = this.fileSizeLimitKb === undefined
      ? [process.execPath, [server, ...this.args]]
      : ['/bin/bash', ['-c', `ulimit -f ${this.fileSizeLimitKb}; exec "$0" "$@"`, process.execPath, server, ...this.args]];
    this.child = spawn(cmd, argv, {
      cwd: work, env: { PATH: process.env.PATH ?? '', HOME: tmp, ...this.env }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stderr.on('data', (d: Buffer) => { this.stderr += d.toString(); });
    this.child.stdin.on('error', () => { /* een gestopte server sluit zijn stdin; dat is geen testfout */ });
    this.child.stdout.on('data', (d: Buffer) => {
      this.buffer.append(d);
      for (let m = this.buffer.readMessage(); m; m = this.buffer.readMessage()) this.onmessage?.(m);
    });
    this.child.on('error', (e) => this.onerror?.(e));
    this.child.on('close', () => this.onclose?.());
  }
  async send(message: JSONRPCMessage): Promise<void> {
    await new Promise<void>((res) => { this.child!.stdin.write(serializeMessage(message), () => res()); });
  }
  async close(): Promise<void> {
    this.child?.stdin.end();
    // Ook een proces dat door een signaal stopte (exitCode null, signalCode gezet) is al dicht.
    await new Promise<void>((res) => {
      if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) res();
      else this.child.once('close', () => res());
    });
  }
}

async function stdioClient(args: string[], env: Record<string, string> = {}, fileSizeLimitKb?: number): Promise<{ client: Client; transport: SpawnStdioTransport }> {
  const transport = new SpawnStdioTransport(args, env, fileSizeLimitKb);
  const client = new Client({ name: 'ops-headless-test', version: '1.0.0' });
  try {
    await client.connect(transport);
  } catch (e) {
    throw new Error(`stdio-verbinding faalde: ${String(e)}\n${transport.stderr}`);
  }
  return { client, transport };
}

let stdio: Client;
let stdioTransport: SpawnStdioTransport;

test('B stdio: initialize, tools/list gelijk aan de registry (namen, beschrijvingen, schema\'s, annotaties)', async () => {
  ({ client: stdio, transport: stdioTransport } = await stdioClient(['--data-dir', dataB]));
  assertEq(stdio.getServerVersion(), { name: MCP_SERVER_NAME, version: appVersion }, 'serverInfo met de appversie');
  assertEq(stdio.getServerCapabilities(), { tools: {} }, 'capabilities');
  const instructions = stdio.getInstructions() ?? '';
  assert(instructions.startsWith(MCP_INSTRUCTIONS) && instructions.includes('Headless mode'), 'instructions = app + headless uitleg');
  const { tools } = await stdio.listTools();
  assertEq(tools.length, 41, 'aantal tools');
  assertEq(canonical(tools), canonical(registryList()), 'tools/list = registry van de app (geen uitzonderingen)');
  assertEq(tools.map((t) => t.name), registryList().map((t) => t.name), 'dezelfde volgorde van tools');
});

test('B stdio: gids en beide skills komen uit de bundel (niets ontbreekt)', async () => {
  const data = await ok(stdio, 'planner_get_planning_guide', { part: 'both' });
  assertEq(data.missing, undefined, 'niets ontbreekt');
  assertEq(data.guide, readFileSync(join(PUBLIC, AGENT_GUIDE_PATH), 'utf8'), 'gids = public/agent/planning-guide.md');
  assertEq(data.skills.map((s: { name: string }) => s.name), AGENT_SKILLS.map((s) => s.name), 'beide skills');
});

let firstTaskId = '';
let before: Array<{ name: string; start: string; end: string }> = [];

test('B stdio: voorbeeld openen via ~/, taken en relatie toevoegen, rekenen, opslaan, heropenen, vergelijken', async () => {
  const opened = await ok(stdio, 'planner_import_schedule', { path: '~/villa.ifc' });
  assertEq([opened.format, opened.documentsOpened], ['IFC', 1], 'IFC geopend');
  const countBefore = opened.tasks as number;
  const list = await ok(stdio, 'planner_list_tasks', { limit: 1000 });
  const leaf = (list.tasks as Array<{ id: string; summary?: boolean }>).find((t) => !t.summary);
  assert(leaf, 'een bladtaak in het voorbeeld');
  firstTaskId = leaf!.id;

  const added = await ok(stdio, 'planner_add_tasks', {
    tasks: [
      { tempId: 'tmp-h1', name: 'Headless A', duration: 3 },
      { tempId: 'tmp-h2', name: 'Headless B', duration: 4 },
    ],
  });
  const a = added.created['tmp-h1'] as string;
  const b = added.created['tmp-h2'] as string;
  await ok(stdio, 'planner_add_dependencies', {
    dependencies: [
      { predecessorId: firstTaskId, successorId: a, type: 'FINISH_START' },
      { predecessorId: a, successorId: b, type: 'FINISH_START' },
    ],
  });
  const info = await ok(stdio, 'planner_get_project_info');
  assertEq(info.statistics.totalTasks, countBefore + 2, 'twee taken erbij');
  const taskB = await ok(stdio, 'planner_get_task', { taskId: b });
  const taskA = await ok(stdio, 'planner_get_task', { taskId: a });
  assert(taskB.schedule.earlyStart >= taskA.schedule.earlyFinish, `B start na A: ${taskA.schedule.earlyFinish} → ${taskB.schedule.earlyStart}`);
  before = ((await ok(stdio, 'planner_list_tasks', { limit: 1000 })).tasks as typeof before)
    .map(({ name, start, end }) => ({ name, start, end }));

  // Opslaan = de eigen IFC overschrijven (atomair). Geen halffabricaat blijft achter.
  const saved = await ok(stdio, 'planner_export_ifc', { path: '~/villa.ifc', overwrite: true });
  assertEq(saved.overwritten, true, 'bestaand bestand vervangen');
  assertEq(readdirSync(work).filter((f) => f.endsWith('.tmp')), [], 'geen halffabricaat');

  const reopened = await ok(stdio, 'planner_import_schedule', { path: `${work}/villa.ifc` });
  assertEq(reopened.tasks, countBefore + 2, 'heropend: aantal taken');
  const after = ((await ok(stdio, 'planner_list_tasks', { limit: 1000 })).tasks as typeof before)
    .map(({ name, start, end }) => ({ name, start, end }));
  assertEq(after, before, 'heropend: dezelfde taken met dezelfde datums');
  const reB = (await ok(stdio, 'planner_list_tasks', { limit: 1000 })).tasks.find((t: { name: string }) => t.name === 'Headless B');
  const detail = await ok(stdio, 'planner_get_task', { taskId: reB.id });
  assertEq(detail.predecessors.length, 1, 'de relatie A → B is bewaard');
});

test('B stdio: de eerste mutatie schreef een MCP-backup in --data-dir', () => {
  const root = join(dataB, 'ai-backups');
  const files = existsSync(root) ? readdirSync(root).flatMap((bucket) => readdirSync(join(root, bucket))) : [];
  assert(files.length >= 1, `backups in ${root}: ${files.join(', ')}`);
});

test('B stdio: padbeveiliging — buiten de werkmap, .., symlink, dode link en relatief pad geven SCOPE', async () => {
  await refused(stdio, 'planner_export_ifc', { path: join(outside, 'x.ifc') }, 'SCOPE', 'absoluut buiten');
  await refused(stdio, 'planner_export_ifc', { path: '~/../buiten/x.ifc' }, 'SCOPE', '.. naar buiten');
  await refused(stdio, 'planner_export_ifc', { path: '~/link-naar-buiten/x.ifc' }, 'SCOPE', 'symlink-map naar buiten');
  await refused(stdio, 'planner_export_ifc', { path: '~/geheim-link.ifc', overwrite: true }, 'SCOPE', 'symlink-bestand naar buiten');
  await refused(stdio, 'planner_export_ifc', { path: '~/dode-link.ifc' }, 'SCOPE', 'dode link');
  await refused(stdio, 'planner_export_ifc', { path: 'relatief.ifc' }, 'SCOPE', 'relatief pad');
  await refused(stdio, 'planner_import_schedule', { path: '~/geheim-link.ifc' }, 'SCOPE', 'lezen via symlink naar buiten');
  await refused(stdio, 'planner_import_schedule', { path: '~/link-naar-buiten/geheim.ifc' }, 'SCOPE', 'lezen via symlink-map');
  assertEq(readdirSync(outside).sort(), ['geheim.ifc'], 'buiten de werkmap is niets geschreven');
  assert(!existsSync(join(outside, 'bestaat-niet.ifc')), 'de dode link heeft niets aangemaakt');
  // Binnen de werkmap mag het wel, ook in een nieuwe submap.
  await ok(stdio, 'planner_export_ifc', { path: '~/sub/kopie.ifc' });
  assert(existsSync(join(work, 'sub', 'kopie.ifc')), 'export in een submap van de werkmap');
});

test('B stdio bevinding 1: opslaan via een link binnen de werkmap vervangt het echte doel atomair; de link blijft', async () => {
  cpSync(EXAMPLE, join(work, 'doel.ifc'));
  symlinkSync(join(work, 'doel.ifc'), join(work, 'link-binnen.ifc'));
  await ok(stdio, 'planner_import_schedule', { path: '~/doel.ifc' });
  const saved = await ok(stdio, 'planner_export_ifc', { path: '~/link-binnen.ifc', overwrite: true });
  assertEq(saved.overwritten, true, 'bestaand doel vervangen');
  assert(lstatSync(join(work, 'link-binnen.ifc')).isSymbolicLink(), 'de link is nog een link');
  assert(readFileSync(join(work, 'doel.ifc'), 'utf8').startsWith('ISO-10303-21;'), 'het echte doel is een volledig IFC-bestand');
  assertEq(readdirSync(work).filter((f) => f.endsWith('.tmp')), [], 'geen halffabricaat');
});

test('B stdio bevinding 4: een link naar een map die alleen in hoofdletters verschilt geeft SCOPE', async () => {
  // De werkmap heet `werkmap`; ernaast staat `Werkmap` met een bestand. Een link ernaartoe is buiten.
  const sibling = join(tmp, 'Werkmap');
  mkdirSync(sibling);
  cpSync(EXAMPLE, join(sibling, 'geheim.ifc'));
  symlinkSync(sibling, join(work, 'naar-hoofdletters'), 'dir');
  await refused(stdio, 'planner_import_schedule', { path: '~/naar-hoofdletters/geheim.ifc' }, 'SCOPE', 'lezen via de link');
  await refused(stdio, 'planner_export_ifc', { path: '~/naar-hoofdletters/nieuw.ifc' }, 'SCOPE', 'schrijven via de link');
  assertEq(readdirSync(sibling), ['geheim.ifc'], 'naast de werkmap is niets geschreven');
});

/** Bladtaken als gesorteerde `naam|startdatum`-regels, voor een vergelijking tussen formaten. */
async function leafSchedule(client: Client): Promise<string[]> {
  const rows = (await ok(client, 'planner_list_tasks', { limit: 1000 })).tasks as Array<{ name: string; start: string; summary?: boolean }>;
  return rows.filter((t) => !t.summary).map((t) => `${t.name}|${String(t.start).slice(0, 10)}`).sort();
}

test('B stdio bevinding 3: MSPDI, P6 XML, CSV en XER openen in de losse server, met taken en datums', async () => {
  const source = readFileSync(EXAMPLE, 'utf8');
  const src = readIFC(source);
  writeFileSync(join(work, 'bron.ifc'), source);
  writeFileSync(join(work, 'bron-mspdi.xml'), writeMSPDI(src.project, src.calendar, src.tasks, src.sequences, src.resources,
    src.assignments, src.resourceCalendars ?? [], src.baselines ?? [], src.activeBaselineId ?? null, src.customTaskTypes ?? []));
  writeFileSync(join(work, 'bron-p6.xml'), writeP6XML(src.project, src.calendar, src.tasks, src.sequences, src.resources,
    src.assignments, src.resourceCalendars ?? [], src.customTaskTypes ?? []));
  writeFileSync(join(work, 'bron.csv'), writeCSV(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments));
  cpSync(join(ROOT, 'tests/browser/fixtures/xer/zonder-bijzonderheden.xer'), join(work, 'bron.xer'));

  await ok(stdio, 'planner_import_schedule', { path: '~/bron.ifc' });
  const fromIfc = await leafSchedule(stdio);
  assert(fromIfc.length > 5, `bladtaken uit IFC: ${fromIfc.length}`);

  for (const [file, format] of [['bron-mspdi.xml', 'MSPDI-XML'], ['bron-p6.xml', 'P6-XML']] as const) {
    const opened = await ok(stdio, 'planner_import_schedule', { path: `~/${file}` });
    assertEq(opened.format, format, `${file}: formaat`);
    assertEq(await leafSchedule(stdio), fromIfc, `${file}: dezelfde bladtaken met dezelfde startdatum als het IFC`);
  }
  const csv = await ok(stdio, 'planner_import_schedule', { path: '~/bron.csv' });
  assertEq(csv.format, 'CSV', 'CSV: formaat');
  const csvLeaves = await leafSchedule(stdio);
  assertEq(csvLeaves.map((l) => l.split('|')[0]), fromIfc.map((l) => l.split('|')[0]), 'CSV: dezelfde bladtaken');
  assert(csvLeaves.every((l) => /\|\d{4}-\d\d-\d\d$/.test(l)), 'CSV: elke bladtaak heeft een startdatum');

  const xer = await ok(stdio, 'planner_import_schedule', { path: '~/bron.xer' });
  assertEq(xer.format, 'XER', 'XER: formaat');
  const xerLeaves = await leafSchedule(stdio);
  assert(xerLeaves.length > 0 && xerLeaves.every((l) => /\|\d{4}-\d\d-\d\d$/.test(l)), `XER: taken met datums: ${xerLeaves.join(', ')}`);

  // Kapotte XML en een DOCTYPE met eigen entiteiten geven een nette weigering, geen crash.
  writeFileSync(join(work, 'kapot.xml'), '<Project xmlns="http://schemas.microsoft.com/project"><Tasks></Project>');
  const broken = await refused(stdio, 'planner_import_schedule', { path: '~/kapot.xml' }, 'VALIDATION', 'kapotte XML');
  assert(String(broken.s.error).includes('Invalid XML'), `melding: ${broken.s.error}`);
  writeFileSync(join(work, 'entiteit.xml'), '<?xml version="1.0"?><!DOCTYPE Project [<!ENTITY x "y">]><Project xmlns="http://schemas.microsoft.com/project"><Name>&x;</Name></Project>');
  await refused(stdio, 'planner_import_schedule', { path: '~/entiteit.xml' }, 'VALIDATION', 'DOCTYPE met eigen entiteit');
});

test('B stdio: afsluiten', async () => {
  await stdio.close();
  await stdioTransport.close();
});

test('B stdio bevinding 1: afbreken midden in het opslaan (bestandsgrootte-limiet) laat het origineel byte-gelijk', async () => {
  cpSync(EXAMPLE, join(work, 'crash.ifc'));
  const before = readFileSync(join(work, 'crash.ifc'));
  // 16 KB: het IFC (ongeveer 47 KB) past er niet in. Lezen raakt de limiet niet.
  const { client, transport } = await stdioClient(['--no-backup', '--open', 'crash.ifc'], {}, 16);
  try {
    let outcome = 'geen fout';
    try {
      const r = await call(client, 'planner_export_ifc', { path: '~/crash.ifc', overwrite: true });
      outcome = r.isError ? `toolfout ${r.s.code}` : 'gelukt';
    } catch (e) {
      outcome = `server afgebroken (${String(e).slice(0, 80)})`;
    }
    assert(outcome !== 'gelukt', `opslaan hoort niet te lukken onder de limiet (${outcome})`);
  } finally {
    await client.close().catch(() => {});
    await transport.close();
  }
  assert(Buffer.compare(readFileSync(join(work, 'crash.ifc')), before) === 0, 'het origineel is byte-gelijk');
});

test('B stdio: OPS_MCP_READ_ONLY=1 weigert mutaties (READ_ONLY), lezen werkt', async () => {
  const { client, transport } = await stdioClient(['--no-backup', '--open', 'villa.ifc'], { OPS_MCP_READ_ONLY: '1' });
  try {
    const info = await ok(client, 'planner_get_project_info');
    assert(info.statistics.totalTasks > 0, '--open opende het voorbeeld');
    await refused(client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-x', name: 'x', duration: 1 }] }, 'READ_ONLY', 'alleen-lezen');
  } finally {
    await client.close();
    await transport.close();
  }
});

/** Start de gebouwde server met HTTP en wacht op de regel `listening on <url>`. */
async function startHttp(env: Record<string, string>, args: string[] = []): Promise<{ child: ChildProcessWithoutNullStreams; url: string }> {
  const child = spawn(process.execPath, [server, '--transport', 'http', '--port', '0', '--no-backup', ...args], {
    cwd: work, env: { PATH: process.env.PATH ?? '', HOME: tmp, ...env }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let err = '';
  const url = await new Promise<string>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`geen 'listening on' binnen 20 s:\n${err}`)), 20_000);
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
      const m = /listening on (http:\/\/\S+)/.exec(err);
      if (m) { clearTimeout(timer); res(m[1]); }
    });
    child.on('close', (code) => { clearTimeout(timer); rej(new Error(`server stopte (exit ${code}):\n${err}`)); });
  });
  return { child, url };
}

test('B HTTP: tools/list, fout token 401, Origin 403, ontbrekende sessie-id 400, onbekende 404', async () => {
  const { child, url } = await startHttp({ OPS_MCP_TOKEN: TOKEN });
  try {
    assert(url.startsWith('http://127.0.0.1:'), `alleen loopback: ${url}`);
    const { client } = await connectClient(url, { Authorization: `Bearer ${TOKEN}` });
    const { tools } = await client.listTools();
    assertEq(canonical(tools), canonical(registryList()), 'tools/list over HTTP = registry');
    await ok(client, 'planner_get_project_info');
    await client.close();
    const post = (headers: Record<string, string>) => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assertEq((await post({ Authorization: 'Bearer fout' })).status, 401, 'fout token');
    assertEq((await post({})).status, 401, 'geen token');
    assertEq((await post({ Authorization: `Bearer ${TOKEN}`, Origin: 'http://evil.example' })).status, 403, 'Origin');
    const missing = await post({ Authorization: `Bearer ${TOKEN}` });
    assertEq(missing.status, 400, 'sessie-id ontbreekt');
    assertEq(((await missing.json()) as { error?: { code?: number } }).error?.code, -32600, 'JSON-RPC-fout bij 400');
    assertEq((await post({ Authorization: `Bearer ${TOKEN}`, 'Mcp-Session-Id': 'onbekend' })).status, 404, 'onbekende sessie');
  } finally {
    child.kill('SIGTERM');
  }
});

test('B HTTP: weigert te starten zonder token, met een kort token en op een niet-loopbackadres', () => {
  const runArgs = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, [server, '--transport', 'http', '--port', '0', ...args], {
      cwd: work, env: { PATH: process.env.PATH ?? '', HOME: tmp, ...env }, encoding: 'utf8', timeout: 20_000,
    });
  const noToken = runArgs([], {});
  assert(noToken.status === 2 && noToken.stderr.includes('OPS_MCP_TOKEN'), `zonder token: exit ${noToken.status} ${noToken.stderr}`);
  const short = runArgs([], { OPS_MCP_TOKEN: 'kort' });
  assertEq(short.status, 2, 'te kort token');
  const remote = runArgs(['--host', '0.0.0.0'], { OPS_MCP_TOKEN: TOKEN });
  assert(remote.status === 2 && remote.stderr.includes('loopback'), `0.0.0.0: exit ${remote.status} ${remote.stderr}`);
  const noRoot = spawnSync(process.execPath, [server, '--root', join(tmp, 'bestaat-niet')], {
    cwd: work, env: { PATH: process.env.PATH ?? '', HOME: tmp }, encoding: 'utf8', input: '', timeout: 20_000,
  });
  assert(noRoot.status === 1 && noRoot.stderr.includes('does not exist'), `werkmap bestaat niet: exit ${noRoot.status} ${noRoot.stderr}`);
});

test('opruimen', () => { rmSync(tmp, { recursive: true, force: true }); });

await run();
