import { fileToolDeps } from '@/services/mcp/tools/fileTools';
import { lowerForeignOpenWarnBytesForTests } from '@/services/ifc/foreignOpenSize';
import { createHash } from 'node:crypto';
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
import { test as registerTest, assert, assertEq, run } from './harness';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { getTools } from '@/services/mcp/toolRegistry';
import { MCP_INSTRUCTIONS, MCP_SERVER_NAME, MCP_SERVER_VERSION, DEFAULT_PROTOCOL_VERSION } from '@/services/mcp/dispatcher';
import { AGENT_GUIDE_PATH, AGENT_SKILLS, readingText, skillAssetPath } from '@/services/mcp/tools/guideTools';
import { createHeadlessHost, headlessInstructions } from '../../headless/mcp-server/src/host';
import { startHttpTransport } from '../../headless/mcp-server/src/http';
import { parseOptions, isLoopbackHost } from '../../headless/mcp-server/src/options';
import { createAppLock, isOpenFilesName, nodePidState } from '../../headless/mcp-server/src/appLock';
import { createNodeFileFs, isInside, ScopeEscapeError, WorkingDirectoryRestoreError, type NodeFsPhase } from '../../headless/mcp-server/src/nodeFs';
import { XmlDomParser } from '../../headless/mcp-server/src/xmlDom';
import { decodeXmlBytes } from '../../headless/mcp-server/src/xmlEncoding';
import { FileTextDecodingError } from '@/services/mcp/fileTextError';
import { ByteWriteError } from '@/services/fileAccess/byteWrite';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { parseOpenedFile } from '@/services/formatRegistry';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { writeCSV } from '@/services/csv/csvWriter';
import { externalClientChecks, connectClient, type AppProbe } from './externalClient';
import {
  foreignCorpus, foreignWorkMethodSource, oldOwnSource, ownCorpus, slotCaseLabel, slotCaseSpecs, slotCorpus, slotValueIn, OLD_TASK_NAME,
  REVIEW_WORK_METHOD,
} from './headlessCorpus';
import { IFC_SLOT_TABLES } from '@/services/ifc/ifcSlotTables';
import { PSET } from '@/services/ifc/ifcPsets';

// Lokaal alleen bronproeven; de zelfstandige bundel en CLI draaien volledig in CI.
function test(name: string, fn: () => void | Promise<void>): void {
  if (process.env.OPS_HEADLESS_SOURCE_ONLY === '1' && name.startsWith('B')) return;
  registerTest(name, fn);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = join(ROOT, 'public');
const EXAMPLE = join(PUBLIC, 'examples', '10-villa-wassenaar.ifc');
const appVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;
const tmp = mkdtempSync(join(tmpdir(), 'ops-headless-mcp-'));
const TOKEN = 'b'.repeat(64);
const FOREIGN_FIXTURES = join(ROOT, 'tests/fixtures/ifc-foreign');
const withExternPset = (own: string) => own.replace('ENDSEC;\nEND-ISO-10303-21;',
  "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n" +
  "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;");

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
// Een lege registermap: de echte map van de app op deze machine telt in de test niet mee.
const host = await createHeadlessHost({
  root: rootA, dataDir: dataA, backup: true, readOnly: false, assets: publicAssets(), discoveryDirs: [join(tmp, 'geen-register')],
});
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

test('A: opties — --discovery-dir en OPS_MCP_DISCOVERY_DIR (vlag wint, leeg of ${…} telt niet)', () => {
  assertEq(parseOptions([], {}, '/w').discoveryDir, null, 'standaard: de mappen van de app');
  assertEq(parseOptions([], { OPS_MCP_DISCOVERY_DIR: 'reg' }, '/w').discoveryDir, '/w/reg', 'uit env, relatief aan de huidige map');
  assertEq(parseOptions(['--discovery-dir', '/a'], { OPS_MCP_DISCOVERY_DIR: '/b' }, '/w').discoveryDir, '/a', 'de vlag wint');
  assertEq(parseOptions([], { OPS_MCP_DISCOVERY_DIR: '${user_config.dir}' }, '/w').discoveryDir, null, 'niet-ingevulde manifestvariabele');
  assertEq(parseOptions([], { OPS_MCP_DISCOVERY_DIR: '  ' }, '/w').discoveryDir, null, 'leeg');
});

// --- A1. Het slot: register van open bestanden in de desktop-app (#730) ------------------------------
// De echte slotfunctie (`createAppLock`) in de echte bestandstoegang, met een tijdelijke registermap.

/** Pid van een kindproces dat al gestopt is: aantoonbaar dood. */
function deadPid(): number {
  const r = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  assert(typeof r.pid === 'number' && r.pid > 0, 'kindproces gestart');
  return r.pid!;
}
const registerText = (pid: number, files: string[]) =>
  JSON.stringify({ formatVersion: 1, pid, appVersion: '2026.44.1', updatedAt: '2026-10-29T08:00:00.000Z', files });

test('A1 slot: pid-toestand en registernamen', () => {
  assertEq(nodePidState(process.pid), 'alive', 'eigen proces leeft');
  assertEq(nodePidState(deadPid()), 'dead', 'gestopt kindproces');
  assertEq(['open-files.json', 'open-files.wt-1.json', 'open-files.json.ab12.tmp', 'open-files.x.json.tmp', 'runtime.json', 'open-files.txt']
    .map(isOpenFilesName), [true, true, false, false, false, false], 'namen');
});

test('A1 slot: zolang de app draait geen bestaand bestand vervangen, lezen mag; nieuw bestand, dood pid, .tmp, slug en onbruikbare registers', async () => {
  const lockRoot = join(tmp, 'lock-root');
  const regDir = join(tmp, 'lock-reg');
  mkdirSync(lockRoot, { recursive: true });
  mkdirSync(regDir);
  const open = join(lockRoot, 'open.ifc');
  const other = join(lockRoot, 'ander.ifc');
  writeFileSync(open, ORIGINAL);
  const reg = (name: string, text: string) => writeFileSync(join(regDir, name), text);
  const clear = () => { for (const f of readdirSync(regDir)) rmSync(join(regDir, f)); };
  let fresh = 0;
  const newFile = () => join(lockRoot, `nieuw-${++fresh}.ifc`);
  // Een niet-bestaande map in de lijst is geen fout.
  const fs = await createNodeFileFs(lockRoot, createAppLock([join(tmp, 'lock-bestaat-niet'), regDir]));
  const refusedWrite = async (p: string, label: string, text: string) => {
    let caught: unknown = null;
    try { await fs.writeTextFile(p, 'NIEUW'); } catch (e) { caught = e; }
    assert(caught instanceof ScopeEscapeError, `${label}: verwacht SCOPE, kreeg ${String(caught)}`);
    assert(String((caught as Error).message).includes(text), `${label}: tekst ${String((caught as Error).message)}`);
  };
  const running = 'does not replace the existing file';
  const isOpen = 'is open in the Open Planner Studio desktop app';
  const noneAtAll = 'the server writes no file at all';

  // Geen register: vrij.
  await fs.writeTextFile(other, 'A');
  // Geldig register van een levende app: geen bestaand bestand, ook niet een dat niet in het register staat
  // (het register loopt achter op wat de app net opende).
  reg('open-files.json', registerText(process.pid, [open]));
  await refusedWrite(open, 'open bestand', running);
  assertEq(readFileSync(open, 'utf8'), ORIGINAL, 'open bestand byte-gelijk');
  assertEq(tmpFiles(lockRoot), [], 'geen halffabricaat');
  await refusedWrite(other, 'ander bestaand bestand', running);
  assertEq(readFileSync(other, 'utf8'), 'A', 'ander bestand byte-gelijk');
  assertEq(await fs.readTextFile(open), ORIGINAL, 'lezen van het open bestand mag');
  assertEq(await fs.confine!(open), null, 'confine (lezen) kent geen slot');
  symlinkSync(open, join(lockRoot, 'alias.ifc'));
  await refusedWrite(join(lockRoot, 'alias.ifc'), 'symlink naar het open bestand', running);
  const created = newFile();
  await fs.writeTextFile(created, 'B');
  assertEq(readFileSync(created, 'utf8'), 'B', 'nieuw bestand geschreven');
  // Dood pid: het register is achtergebleven.
  clear();
  reg('open-files.json', registerText(deadPid(), [open]));
  await fs.writeTextFile(open, ORIGINAL);
  // Onbruikbaar register met levend pid, en zonder pid: niets wordt geschreven; met dood pid wel.
  clear();
  reg('open-files.json', JSON.stringify({ formatVersion: 2, pid: process.pid, files: [] }));
  await refusedWrite(newFile(), 'onbruikbaar, levend pid', noneAtAll);
  assertEq(await fs.readTextFile(other), 'A', 'lezen blijft mogen bij refuse-all');
  clear();
  reg('open-files.json', '{ kapot');
  await refusedWrite(newFile(), 'onbruikbaar, geen pid', noneAtAll);
  clear();
  reg('open-files.json', JSON.stringify({ formatVersion: 2, pid: deadPid() }));
  await fs.writeTextFile(other, 'C');
  // Een halffabricaat telt niet; een dev-register (`open-files.<slug>.json`) wel.
  clear();
  reg('open-files.json.4f2a.tmp', '{ kapot');
  await fs.writeTextFile(other, 'D');
  reg('open-files.wt-3007.json', registerText(process.pid, []));
  await refusedWrite(other, 'dev-register met slug, leeg', running);
  // Registerpad en doel bestaan allebei niet en zijn gelijk (een open document waarvan het bestand weg is);
  // ook in een map die nog niet bestaat.
  clear();
  reg('open-files.json', registerText(process.pid, [join(lockRoot, 'weg.ifc'), join(lockRoot, 'nieuw', 'weg.ifc')]));
  await refusedWrite(join(lockRoot, 'weg.ifc'), 'beide niet bestaand, gelijk', isOpen);
  await refusedWrite(join(lockRoot, 'nieuw', 'weg.ifc'), 'beide niet bestaand, ontbrekende map', isOpen);
  assert(!existsSync(join(lockRoot, 'weg.ifc')) && !existsSync(join(lockRoot, 'nieuw')), 'niets aangemaakt');
  await fs.writeTextFile(join(lockRoot, 'nieuw', 'anders.ifc'), 'E');
  // Onzekere identiteit van een registerpad (dode link): ook een nieuw bestand weigeren.
  clear();
  symlinkSync(join(tmp, 'lock-nergens.ifc'), join(tmp, 'lock-dode-link.ifc'));
  reg('open-files.json', registerText(process.pid, [join(tmp, 'lock-dode-link.ifc')]));
  await refusedWrite(newFile(), 'dode link in het register', 'cannot establish the identity');
  // Een registermap die bestaat maar niet te lezen is: weigeren (als root is elke map leesbaar).
  clear();
  if (process.getuid?.() !== 0) {
    chmodSync(regDir, 0o000);
    try {
      await refusedWrite(newFile(), 'onleesbare registermap', noneAtAll);
    } finally {
      chmodSync(regDir, 0o700);
    }
  }
  await fs.writeTextFile(other, 'F');
  assertEq(readFileSync(other, 'utf8'), 'F', 'na opruimen weer vrij (opnieuw gelezen per schrijfactie)');
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

test('A2 nieuwe naam als bytes: exclusief en atomair, ook als het doel vlak voor de plaatsing verschijnt', async () => {
  mkdirSync(fsRoot, { recursive: true });
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from('ISO-10303-21;\n'), 0xe9, 0x0a]);
  const createNew = async (promise: Promise<void>, label: string) => {
    let caught: unknown = null;
    try { await promise; } catch (e) { caught = e; }
    assert(caught instanceof ByteWriteError && caught.reason === 'create-new', `${label}: verwacht create-new, kreeg ${String(caught)}`);
  };
  const fs = await createNodeFileFs(fsRoot);
  const fresh = join(fsRoot, 'nieuw', 'bytes.ifc');
  await fs.writeNewUserBytes!(fresh, bytes);
  assert(readFileSync(fresh).equals(Buffer.from(bytes)), 'de bytes staan ongewijzigd op de nieuwe naam');
  assertEq([lstatSync(fresh).nlink, tmpFiles(join(fsRoot, 'nieuw'))], [1, []], 'één naam, geen halffabricaat');
  const existing = join(fsRoot, 'bestaand-bytes.ifc');
  writeFileSync(existing, ORIGINAL);
  await createNew(fs.writeNewUserBytes!(existing, bytes), 'bestaand doel');
  assertEq(readFileSync(existing, 'utf8'), ORIGINAL, 'bestaand doel: byte-gelijk');
  const late = join(fsRoot, 'laat.ifc');
  const racing = await createNodeFileFs(fsRoot, undefined, {
    afterCheck: (phase) => { if (phase === 'commit') writeFileSync(late, 'VAN EEN ANDER'); },
  });
  await createNew(racing.writeNewUserBytes!(late, bytes), 'doel verschijnt vlak voor de plaatsing');
  assertEq([readFileSync(late, 'utf8'), tmpFiles(fsRoot)], ['VAN EEN ANDER', []], 'het bestand van een ander blijft staan, geen halffabricaat');
  for (const phase of ['write', 'rename'] as const) {
    const target = join(fsRoot, `fout-${phase}.ifc`);
    const failing = await createNodeFileFs(fsRoot, undefined, { fault: (p) => { if (p === phase) throw new Error(`nagebootste ${p}-fout`); } });
    await expectReject(failing.writeNewUserBytes!(target, bytes), `${phase}-fout`);
    assertEq([existsSync(target), tmpFiles(fsRoot)], [false, []], `${phase}-fout: niets geschreven, halffabricaat opgeruimd`);
  }
  for (const name of ['laat.ifc', 'bestaand-bytes.ifc']) unlinkSync(join(fsRoot, name));
  rmSync(join(fsRoot, 'nieuw'), { recursive: true });
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

test('A drempel voor de waarschuwing: headless opent een model met zijn bron, zonder waarschuwing', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  const model = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  const path = join(rootA, 'productgrens-model.ifc');
  writeFileSync(path, model);
  try {
    lowerForeignOpenWarnBytesForTests(model.length - 1);
    const opened = await ok(client, 'planner_import_schedule', { path });
    const source = app.store.getState().ifcSource;
    assertEq([source?.foreign, source?.sha256], [true, createHash('sha256').update(model).digest('hex')],
      'het model opent met zijn geverifieerde bron, ook boven de drempel');
    assert(!JSON.stringify(opened).includes('larger than'), `geen waarschuwing in het antwoord, zoals main (${JSON.stringify(opened).slice(0, 300)})`);
  } finally {
    lowerForeignOpenWarnBytesForTests();
    await client.close();
  }
});

test('A doelbescherming: model en externe pset blijven bytegelijk zonder draaiende app', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  try {
    const own = readFileSync(EXAMPLE, 'utf8');
    const foreign = withExternPset(own);
    writeFileSync(join(rootA, 'eigen-bron.ifc'), own);
    await ok(client, 'planner_import_schedule', { path: join(rootA, 'eigen-bron.ifc') });
    assertEq(app.store.getState().ui.featureFlags.ifcForeignContent, true, 'headless zet de flag in zijn eigen store');
    for (const [name, bytes] of [
      ['model', readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/model-ifc4.ifc'))],
      ['externe-pset', Buffer.from(foreign)],
      ['onleesbaar-step', Buffer.from('ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;\n')],
      ['eigen-planning-met-bom', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(own)])],
    ] as const) {
      const target = join(rootA, `${name}.ifc`);
      writeFileSync(target, bytes);
      const alias = join(rootA, `${name}-link.ifc`);
      symlinkSync(target, alias);
      for (const path of [target, alias]) {
        await refused(client, 'planner_export_ifc', { path, overwrite: true }, 'VALIDATION', name);
        assert(readFileSync(target).equals(bytes), `${name}: geen byte gewijzigd`);
      }
    }
    for (const name of ['eigen-doel.ifc', 'nieuw-doel.ifc']) {
      const path = join(rootA, name);
      if (name.startsWith('eigen')) writeFileSync(path, own);
      await ok(client, 'planner_export_ifc', { path, overwrite: true });
      assert(readFileSync(path, 'utf8').includes('IFCTASK('), `${name}: geschreven`);
    }
  } finally { await client.close(); }
});

// Knownbug 1907 (review van #1064, besluit van de orkestrator): ook headless kan meerdere IFC's open hebben. Export van B
// naar het bestand van A weigert, ook met `overwrite: true`; A blijft bytegelijk. B naar B en naar een vrije naam mag.
test('A knownbug 1907: export_ifc over het bestand van een ander open document weigert; het eigen bestand en een vrije naam niet', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  try {
    const fileA = join(rootA, 'open-a.ifc'), fileB = join(rootA, 'open-b.ifc');
    copyFileSync(join(PUBLIC, 'examples', '05-brugvervanging-n279.ifc'), fileA);
    copyFileSync(EXAMPLE, fileB);
    for (const path of [fileA, fileB]) await ok(client, 'planner_import_schedule', { path });
    const open = app.store.getState().getOpenDocumentPayloads().map(d => d.payload.filePath);
    assert(open.includes(fileA) && open.includes(fileB), 'A en B staan allebei open');
    assertEq(app.store.getState().filePath, fileB, 'B is het actieve document');
    const before = readFileSync(fileA);
    const r = await refused(client, 'planner_export_ifc', { path: fileA, overwrite: true }, 'VALIDATION', 'B naar A');
    assert(String(r.s.error).includes('another open document'), `de fout zegt waarom: ${r.s.error}`);
    assert(readFileSync(fileA).equals(before), 'A is bytegelijk');
    await ok(client, 'planner_export_ifc', { path: fileB, overwrite: true });
    await ok(client, 'planner_export_ifc', { path: join(rootA, 'open-vrij.ifc') });
    assert(readFileSync(join(rootA, 'open-vrij.ifc'), 'utf8').includes('IFCTASK('), 'een vrije naam: geschreven');
    assert(readFileSync(fileA).equals(before), 'A blijft bytegelijk');
  } finally { await client.close(); }
});

test('A knownbug 1136: een externe pset gaat mee naar een nieuwe naam; over de bron en een bestaande naam weigert de export', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  try {
    const sourceBytes = Buffer.from(withExternPset(readFileSync(EXAMPLE, 'utf8')));
    const source = join(rootA, 'extern-bron.ifc');
    writeFileSync(source, sourceBytes);
    const opened = await ok(client, 'planner_import_schedule', { path: source });
    assertEq(opened.filePath, source, 'de bron is het bestand van het document');
    const kept = app.store.getState().ifcSource;
    assertEq([kept?.foreign, kept?.buildingModel, kept?.sha256], [true, false, createHash('sha256').update(sourceBytes).digest('hex')],
      'het document bewaart de bron met de externe pset');
    const leaf = app.store.getState().tasks.find(t => t.childIds.length === 0)!;
    await ok(client, 'planner_update_tasks', { updates: [{ id: leaf.id, fields: { name: 'Hernoemd headless' } }] });

    const copy = join(rootA, 'extern-kopie.ifc');
    const exported = await ok(client, 'planner_export_ifc', { path: copy });
    const written = readFileSync(copy);
    assertEq([exported.overwritten, exported.byteLength, exported.characters], [false, written.byteLength, undefined],
      'de export schrijft bytes naar de nieuwe naam');
    const text = written.toString('latin1');
    assert(text.includes("'ExternPset'") && text.includes("IFCTEXT('behouden')"), 'de externe pset staat in de uitvoer');
    assert(text.includes('Hernoemd headless'), 'de wijziging van de planning staat in de uitvoer');
    assertEq(readdirSync(rootA).filter(f => f.includes('.ops-')), [], 'geen hulpbestand');

    const again = await refused(client, 'planner_export_ifc', { path: copy }, 'VALIDATION', 'dezelfde naam zonder overwrite');
    assert(String(again.s.error).includes('already exists'), `de bestaande naam: ${again.s.error}`);
    for (const target of [source, copy, join(rootA, 'eigen-bron.ifc')]) {
      const before = readFileSync(target);
      const r = await refused(client, 'planner_export_ifc', { path: target, overwrite: true }, 'VALIDATION', `over ${target}`);
      assert(readFileSync(target).equals(before), `${target}: bytegelijk na ${r.s.error}`);
    }
    assert(readFileSync(source).equals(sourceBytes), 'de bron is bytegelijk');

    await ok(client, 'planner_import_schedule', { path: copy });
    const reopened = app.store.getState();
    assert(reopened.ifcSource?.foreign === true && reopened.tasks.some(t => t.name === 'Hernoemd headless'),
      'de kopie opent opnieuw met de externe pset en de wijziging');
  } finally { await client.close(); }
});

test('A 1136 ronde 1: een externe pset met ids boven de scannergrens en een IFC2X3 met een externe pset weigeren vóór I/O', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  const original = fileToolDeps.getFs;
  try {
    const cases = foreignCorpus(ROOT).filter(c =>
      ['pset-aan-project-IFC4X3_ADD2-ids-boven-scannergrens.ifc', 'pset-aan-project-IFC2X3-gewone-ids.ifc'].includes(c.name));
    assertEq(cases.length, 2, 'de twee gevallen van de review');
    for (const c of cases) {
      const source = join(rootA, `onzeker-${c.name}`);
      const copy = join(rootA, `onzeker-kopie-${c.name}`);
      writeFileSync(source, c.bytes);
      const opened = await ok(client, 'planner_import_schedule', { path: source });
      assert(opened.tasks > 0, `${c.name}: de planning opent zoals main`);
      assertEq(app.store.getState().foreignSourceMark?.sourceMissing, true, `${c.name}: het document staat als niet vast te stellen`);
      const backups = join(dataA, 'ai-backups');
      const backupsBefore = filesBelow(backups);
      const leaf = app.store.getState().tasks.find(t => t.childIds.length === 0)!;
      const edited = await call(client, 'planner_update_tasks', { updates: [{ id: leaf.id, fields: { name: 'Eerste wijziging' } }] });
      assert(!edited.isError, `${c.name}: de taakwijziging gaat door (${JSON.stringify(edited.s).slice(0, 200)})`);
      assertEq(edited.s.envelope?.backupCreated, undefined, `${c.name}: geen backupCreated`);
      assert(String(edited.s.envelope?.backupWithheld).includes('No AI backup was made'), `${c.name}: het antwoord zegt dat er geen back-up is`);
      assertEq([...filesBelow(backups).keys()], [...backupsBefore.keys()], `${c.name}: geen nieuw bestand in de back-upmap`);
      let fileCalls = 0;
      fileToolDeps.getFs = async () => { fileCalls++; return original(); };
      for (const args of [{ path: copy }, { path: copy, overwrite: true }, { path: source, overwrite: true }]) {
        const r = await refused(client, 'planner_export_ifc', args, 'VALIDATION', `${c.name} ${JSON.stringify(args)}`);
        assert(String(r.s.error).includes('cannot keep') && String(r.s.error).includes('nothing was written'), `${c.name}: de fout zegt waarom: ${r.s.error}`);
      }
      fileToolDeps.getFs = original;
      assertEq(fileCalls, 0, `${c.name}: de export raakt de bestandslaag niet`);
      assertEq(existsSync(copy), false, `${c.name}: geen kopie`);
      assert(readFileSync(source).equals(c.bytes), `${c.name}: de bron is bytegelijk`);
    }
  } finally {
    fileToolDeps.getFs = original;
    await client.close();
  }
});

test('A eigenschap (1136 ronde 1): elk vreemd stuk staat bytegelijk in de kopie, of de export weigert en er is geen kopie', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  const dir = join(rootA, 'eigenschap');
  mkdirSync(dir);
  const tally = { geschreven: 0, geweigerd: 0, nietGeopend: 0 };
  const byStand = new Map<string, number>();
  const broken: string[] = [];
  try {
    const all = [
      ...ownCorpus(ROOT).map(c => ({ name: c.name, bytes: c.bytes, pieces: [] as readonly string[], stand: c.stand as string | undefined,
        opens: c.opens, writes: c.opens && c.stand === 'eigen' })),
      ...foreignCorpus(ROOT).map(c => ({ name: c.name, bytes: c.bytes, pieces: c.pieces, stand: undefined as string | undefined,
        opens: true, writes: c.kept })),
    ];
    const expected = {
      geschreven: all.filter(c => c.opens && c.writes).length,
      geweigerd: all.filter(c => c.opens && !c.writes).length,
      nietGeopend: all.filter(c => !c.opens).length,
    };
    for (const [i, c] of all.entries()) {
      const source = join(dir, `${i}-bron.ifc`);
      const copy = join(dir, `${i}-kopie.ifc`);
      writeFileSync(source, c.bytes);
      const opened = await call(client, 'planner_import_schedule', { path: source });
      if (opened.isError) {
        tally.nietGeopend++;
        if (c.opens) broken.push(`${c.name}: opent niet (${opened.s.code} ${String(opened.s.error).slice(0, 120)})`);
        continue;
      }
      if (!c.opens) broken.push(`${c.name}: opent, maar hoort niet te openen`);
      const exported = await call(client, 'planner_export_ifc', { path: copy });
      const written = existsSync(copy) ? readFileSync(copy).toString('latin1') : null;
      const missing = written === null ? [] : c.pieces.filter(piece => !written.includes(piece));
      if (!exported.isError && written !== null && missing.length === 0) tally.geschreven++;
      else if (exported.isError && exported.s.code === 'VALIDATION' && written === null) tally.geweigerd++;
      else broken.push(`${c.name}: ${exported.isError ? exported.s.code : 'ok'}, kopie ${written === null ? 'ontbreekt' : `mist ${missing.length} vreemde regel(s)`}`);
      if (c.writes && exported.isError) broken.push(`${c.name}: hoort te schrijven, maar de export weigert (${exported.s.error})`);
      if (!c.writes && !exported.isError) broken.push(`${c.name}: hoort te weigeren, maar de export schreef`);
      if (!readFileSync(source).equals(c.bytes)) broken.push(`${c.name}: de bron veranderde`);
      const key = `${c.stand ?? 'vreemd'} ${exported.isError ? 'geweigerd' : 'geschreven'}`;
      byStand.set(key, (byStand.get(key) ?? 0) + 1);
    }
    console.log(`  eigenschap: ${all.length} bestanden, ${tally.geschreven} geschreven, ${tally.geweigerd} geweigerd, ${tally.nietGeopend} niet geopend`
      + ` (${[...byStand].map(([k, n]) => `${k} ${n}`).join(', ')})`);
    assertEq(broken, [], 'nooit ok met een vreemd stuk minder, nooit een kopie na een weigering, elk bestand in zijn stand');
    assertEq(tally, expected, 'de tellingen per uitkomst');
  } finally {
    await client.close();
  }
});

interface ToolStep { readonly tool: string; readonly args: () => Record<string, unknown>; readonly refused?: true }

function mutationSteps(dir: string, source: string): ToolStep[] {
  const st = () => app.store.getState();
  const leaf = () => st().tasks.find(t => t.childIds.length === 0 && !t.isMilestone && t.time.scheduleDuration >= 2)!.id;
  const parent = () => st().tasks.find(t => t.childIds.length > 0)!.id;
  const added = () => st().tasks.find(t => t.name === 'Eigenschap nieuw')?.id
    ?? [...st().tasks].reverse().find(t => t.childIds.length === 0 && !t.isMilestone && t.id !== leaf())!.id;
  const dependency = () => st().sequences[0].id;
  const baseline = () => st().baselines[0].id;
  const shifted = () => new Date(Date.parse(String(st().project.startDate).slice(0, 10)) + 7 * 86_400_000).toISOString().slice(0, 10);
  let original = '';
  return [
    { tool: 'planner_update_tasks', args: () => ({ updates: [{ id: leaf(), fields: { name: 'Eigenschap gewijzigd' } }] }) },
    { tool: 'planner_add_tasks', args: () => ({ tasks: [{ tempId: 'tmp-e1', name: 'Eigenschap nieuw', duration: 2 }] }) },
    { tool: 'planner_add_dependencies', args: () => ({ dependencies: [{ predecessorId: leaf(), successorId: added(), type: 'FS' }] }) },
    { tool: 'planner_update_dependencies', args: () => ({ updates: [{ seqId: dependency(), lag: 1 }] }) },
    { tool: 'planner_remove_dependencies', args: () => ({ ids: [dependency()] }) },
    { tool: 'planner_move_task', args: () => ({ id: added(), newParentId: parent() }) },
    { tool: 'planner_set_task_splits', args: () => ({ taskId: leaf(), interruptions: [{ afterWorkDays: 1, pauseDays: 1 }] }) },
    { tool: 'planner_update_calendar', args: () => ({ calendars: [{ id: st().calendar.id, name: 'Eigenschap kalender' }] }) },
    { tool: 'planner_manage_resources', args: () => ({ actions: [{ action: 'create', tempId: 'tmp-r1', name: 'Eigenschap resource', type: 'LABOR' }] }) },
    { tool: 'planner_manage_assignments', args: () => ({ actions: [{ action: 'add', taskId: leaf(), resourceId: st().resources[0].id, unitsPerDay: 8 }] }) },
    { tool: 'planner_level_resources', args: () => ({}) },
    { tool: 'planner_clear_leveling', args: () => { st().updateTask(leaf(), { levelingDelay: 1 }); return {}; } },
    { tool: 'planner_update_project', args: () => ({ description: 'Eigenschap' }) },
    { tool: 'planner_move_project', args: () => ({ newStartDate: shifted() }) },
    { tool: 'planner_save_baseline', args: () => ({ name: 'Eigenschap' }) },
    { tool: 'planner_rename_baseline', args: () => ({ baselineId: baseline(), name: 'Eigenschap hernoemd' }) },
    { tool: 'planner_activate_baseline', args: () => {
      st().saveBaseline('Eigenschap tweede');
      return { baselineId: st().baselines.find(b => b.id !== st().activeBaselineId)!.id };
    } },
    { tool: 'planner_delete_baseline', args: () => ({ baselineId: baseline() }) },
    { tool: 'planner_refresh_external_links', args: () => {
      st().addExternalLink(leaf(), {
        direction: 'predecessor', relType: 'FS', anchorDate: '2020-01-01T08:00:00', sourceMissing: false,
        sourceRef: { projectId: st().project.id, taskId: parent(), filePath: source },
      });
      return {};
    } },
    { tool: 'planner_batch', args: () => ({ steps: [{ tool: 'planner_update_tasks', args: { updates: [{ id: leaf(), fields: { name: 'Eigenschap batch' } }] } }] }) },
    { tool: 'planner_delete_tasks', args: () => ({ ids: [added()] }) },
    { tool: 'planner_undo', args: () => ({}) },
    { tool: 'planner_redo', args: () => ({}) },
    { tool: 'planner_duplicate_document', args: () => { original = st().activeDocumentId; return {}; } },
    { tool: 'planner_export_ifc', args: () => ({ path: join(dir, 'export-duplicaat.ifc') }), refused: true },
    { tool: 'planner_switch_document', args: () => ({ documentId: original }) },
    { tool: 'planner_export_ifc', args: () => ({ path: join(dir, 'export.ifc') }), refused: true },
    { tool: 'planner_new_document', args: () => ({}) },
    { tool: 'planner_import_schedule', args: () => ({ path: source }) },
    { tool: 'planner_export_ifc', args: () => ({ path: join(dir, 'export-na-heropenen.ifc'), overwrite: true }), refused: true },
  ];
}

function filesBelow(dir: string): Map<string, string> {
  const found = new Map<string, string>();
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) for (const [p, v] of filesBelow(path)) found.set(p, v);
    else if (entry.isFile()) found.set(path, createHash('sha256').update(readFileSync(path)).digest('hex'));
  }
  return found;
}

const isStep = (bytes: Buffer) => bytes.subarray(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0).toString('latin1').trimStart().startsWith('ISO-10303-21');

test('A eigenschap (1136 ronde 2): in stand 3 schrijft geen enkele wijzigende tool een IFC, en elke tool die een back-up zou melden zegt dat er geen is', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  const dir = join(rootA, 'alle-tools');
  mkdirSync(dir);
  const original = fileToolDeps.getFs;
  try {
    const mutating = getTools().filter(t => !t.annotations.readOnlyHint).map(t => t.name).sort();
    const backsUp = new Set(getTools().filter(t => t.kind === 'mutate' || t.kind === 'batch').map(t => t.name));
    const stepsFor = (sub: string, source: string) => mutationSteps(join(dir, sub), source);
    assertEq([...new Set(stepsFor('x', 'x').map(s => s.tool))].sort(), mutating, 'elke wijzigende tool uit de registry heeft een proefaanroep');

    const kept = foreignCorpus(ROOT).find(c => c.name === 'pset-aan-project-IFC4X3_ADD2-gewone-ids.ifc')!;
    const reportsBackup = new Set<string>();
    const referenceErrors: string[] = [];
    const stepCount = stepsFor('ref', 'x').length;
    for (let i = 0; i < stepCount; i++) {
      const sub = join(dir, `ref-${i}`);
      mkdirSync(sub);
      const source = join(sub, 'bron.ifc');
      writeFileSync(source, kept.bytes);
      const step = stepsFor(`ref-${i}`, source)[i];
      await ok(client, 'planner_import_schedule', { path: source });
      if (step.tool.includes('baseline') && step.tool !== 'planner_save_baseline') app.store.getState().saveBaseline('Referentie');
      const r = await call(client, step.tool, step.args());
      if (r.s.envelope?.backupCreated) reportsBackup.add(step.tool);
      if (r.isError && backsUp.has(step.tool)) referenceErrors.push(`${step.tool} ${r.s.code} ${String(r.s.error).slice(0, 100)}`);
    }
    const expectedBackups = [...new Set(stepsFor('x', 'x').map(s => s.tool))].filter(t => backsUp.has(t)).sort();
    assertEq(referenceErrors, [], 'in stand 2 slaagt elke tool van soort mutate of batch');
    assertEq([...reportsBackup].sort(), expectedBackups, 'in stand 2 maakt precies elke tool van soort mutate of batch een back-up');

    const uncertain = [
      ...ownCorpus(ROOT).filter(c => c.stand === 'onzeker' && c.opens),
      ...foreignCorpus(ROOT).filter(c => !c.kept),
    ];
    const before = new Map([...filesBelow(rootA), ...filesBelow(dataA)]);
    const sources = uncertain.map((c, i) => {
      mkdirSync(join(dir, `s3-${i}`));
      const source = join(dir, `s3-${i}`, 'bron.ifc');
      writeFileSync(source, c.bytes);
      return source;
    });
    for (const source of sources) before.set(source, createHash('sha256').update(readFileSync(source)).digest('hex'));
    let writes = 0;
    fileToolDeps.getFs = async () => {
      const fs = await original();
      return { ...fs, writeTextFile: async (p, c) => { writes++; return fs.writeTextFile(p, c); },
        writeNewUserBytes: async (p, b) => { writes++; return fs.writeNewUserBytes!(p, b); } };
    };
    const problems: string[] = [];
    let calls = 0;
    for (const [i, c] of uncertain.entries()) {
      await ok(client, 'planner_import_schedule', { path: sources[i] });
      if (app.store.getState().foreignSourceMark?.sourceMissing !== true) problems.push(`${c.name}: niet in stand 3 na openen`);
      for (const step of stepsFor(`s3-${i}`, sources[i])) {
        const r = await call(client, step.tool, step.args());
        calls++;
        const label = `${c.name} ${step.tool}`;
        if (step.refused ? !(r.isError && r.s.code === 'VALIDATION') : r.isError) problems.push(`${label}: ${r.isError ? r.s.code : 'ok'} ${String(r.s.error ?? '').slice(0, 120)}`);
        if (r.s.envelope?.backupCreated) problems.push(`${label}: backupCreated ${r.s.envelope.backupCreated}`);
        if (!r.isError && backsUp.has(step.tool) && app.store.getState().foreignSourceMark?.sourceMissing && !String(r.s.envelope?.backupWithheld ?? '').includes('No AI backup was made')) {
          problems.push(`${label}: het antwoord zegt niet dat er geen back-up is`);
        }
        if (step.tool === 'planner_refresh_external_links' && !r.isError && !(r.s.data?.sources?.length >= 1)) {
          problems.push(`${label}: het verversen las geen bron (${JSON.stringify(r.s.data).slice(0, 200)})`);
        }
      }
    }
    fileToolDeps.getFs = original;
    const after = new Map([...filesBelow(rootA), ...filesBelow(dataA)]);
    const written = [...after].filter(([p, hash]) => before.get(p) !== hash && isStep(readFileSync(p))).map(([p]) => p);
    console.log(`  alle tools: ${mutating.length} wijzigende tools, ${uncertain.length} bestanden in stand 3, ${calls} aanroepen, `
      + `back-up in stand 2 bij ${reportsBackup.size} tools (${[...reportsBackup].sort().join(', ')}), ${writes} schrijfaanroepen van de bestandslaag`);
    assertEq(problems, [], 'elke tool in stand 3: verwachte uitkomst, geen backupCreated, wel de melding dat er geen back-up is');
    assertEq(written, [], 'geen nieuw of gewijzigd bestand dat met ISO-10303-21 begint, in de werkmap en de gegevensmap');
    assertEq(writes, 0, 'de bestandslaag schreef niets');
    for (const [i, c] of uncertain.entries()) assert(readFileSync(sources[i]).equals(c.bytes), `${c.name}: de bron is bytegelijk`);
  } finally {
    fileToolDeps.getFs = original;
    await client.close();
  }
});

test('A eigenschap (1136 ronde 3): elk slot uit de slottabel met een waarde van een ander programma komt terug in de kopie en de back-up, of er komt geen IFC', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  const dir = join(rootA, 'slots');
  mkdirSync(dir);
  const backups = join(dataA, 'ai-backups');
  try {
    const cases = slotCorpus(ROOT);
    const constantSlots = IFC_SLOT_TABLES.flatMap(t => t.slots.filter(s => s.soort === 'constant' || s.soortVreemd === 'constant').map(s => `${t.naam}.${s.key}`));
    const covered = new Set(cases.map(c => `${c.table.naam}.${c.slot.key}`));
    assertEq(constantSlots.filter(name => !covered.has(name)), [], 'elk constant slot uit de slottabel heeft een geval');
    assertEq(cases.map(slotCaseLabel), slotCaseSpecs().map(slotCaseLabel), 'een geval per slot en herkomst uit de tabel');
    const outcome = new Map<string, string>();
    const broken: string[] = [];
    for (const [i, c] of cases.entries()) {
      const label = slotCaseLabel(c);
      const source = join(dir, `${i}-bron.ifc`);
      const copy = join(dir, `${i}-kopie.ifc`);
      writeFileSync(source, c.bytes);
      const opened = await call(client, 'planner_import_schedule', { path: source });
      if (opened.isError) {
        broken.push(`${label}: opent niet (${opened.s.code} ${String(opened.s.error).slice(0, 120)})`);
        continue;
      }
      const state = app.store.getState();
      const stand = state.foreignSourceMark?.sourceMissing ? 'stand 3' : state.ifcSource ? 'stand 2' : 'stand 1';
      const exported = await call(client, 'planner_export_ifc', { path: copy });
      const written = existsSync(copy) ? readFileSync(copy, 'utf8') : null;
      if (!exported.isError && written !== null && slotValueIn(written, c) === c.value) outcome.set(label, `${stand} geschreven`);
      else if (exported.isError && exported.s.code === 'VALIDATION' && written === null) outcome.set(label, `${stand} geweigerd`);
      else broken.push(`${label}: ${exported.isError ? exported.s.code : 'ok'}, in de kopie ${written === null ? 'geen bestand' : String(slotValueIn(written, c))} in plaats van ${c.value}`);
      const before = filesBelow(backups);
      const leaf = app.store.getState().tasks.find(t => t.childIds.length === 0)!;
      const edited = await call(client, 'planner_update_tasks', { updates: [{ id: leaf.id, fields: { name: 'Eerste wijziging' } }] });
      const fresh = [...filesBelow(backups).keys()].filter(p => !before.has(p));
      const envelope = edited.s.envelope ?? {};
      if (edited.isError) broken.push(`${label}: de taakwijziging faalt (${edited.s.code} ${String(edited.s.error).slice(0, 120)})`);
      else if (stand === 'stand 3') {
        if (!envelope.backupWithheld || envelope.backupCreated || fresh.length > 0) {
          broken.push(`${label}: stand 3, backupWithheld ${envelope.backupWithheld ? 'ja' : 'nee'}, ${fresh.length} nieuw bestand in de back-upmap`);
        }
      } else if (fresh.length === 1 && envelope.backupCreated && !envelope.backupWithheld) {
        const backup = readFileSync(fresh[0], 'utf8');
        const kept = stand === 'stand 2' ? backup.includes(PSET.RecoveryForeignSource) : slotValueIn(backup, c) === c.value;
        if (!kept) broken.push(`${label}: ${stand}, de back-up ${stand === 'stand 2' ? 'mist OPS_RecoveryForeignSource' : `heeft ${String(slotValueIn(backup, c))} in het slot`}`);
      } else broken.push(`${label}: ${stand}, ${fresh.length} nieuwe back-up(s), backupCreated ${String(envelope.backupCreated)}`);
      if (!readFileSync(source).equals(c.bytes)) broken.push(`${label}: de bron veranderde`);
    }
    const tally = new Map<string, number>();
    for (const value of outcome.values()) tally.set(value, (tally.get(value) ?? 0) + 1);
    console.log(`  slots: ${cases.length} gevallen uit ${IFC_SLOT_TABLES.length} slottabellen (${[...tally].sort().map(([k, n]) => `${k} ${n}`).join(', ')})`);
    console.log(`  geschreven met het slot: ${[...outcome].filter(([, v]) => v.endsWith('geschreven')).map(([k]) => k).join(', ')}`);
    assertEq(broken, [], 'nooit ok met een slot dat niet terugkomt, geen kopie na een weigering, geen back-up zonder het slot');
    assertEq(outcome.size, cases.length, 'elk geval heeft een uitkomst');
    assertEq(outcome.get('IfcTask.workMethod vreemd'), 'stand 3 geweigerd', 'het geval van de review: stand 3, geen IFC');
    assertEq(outcome.get('IfcTask.workMethod eigen'), 'stand 3 geweigerd', 'een werkwijze in een eigen taak: stand 3');
    assertEq(outcome.get('IfcTask.status vreemd'), 'stand 3 geweigerd', 'een status die de lezer niet draagt: stand 3');
    assertEq(outcome.get('IfcTask.name vreemd'), 'stand 1 geschreven', 'een naam die de lezer draagt: stand 1, met de naam');
  } finally {
    await client.close();
  }
});

test('A gebouwmodel: openen bewaart het model, een nieuwe naam krijgt het bytegelijk, een ongedragen wijziging weigert getypeerd', async () => {
  const { client } = await connectClient(httpA.url, { Authorization: `Bearer ${TOKEN}` });
  try {
    const model = readFileSync(join(FOREIGN_FIXTURES, 'eigen-plus-model.ifc'));
    const source = join(rootA, 'eigen-plus-model.ifc');
    writeFileSync(source, model);
    await ok(client, 'planner_import_schedule', { path: source });
    assertEq(app.store.getState().ifcSource?.buildingModel, true, 'het model is bewaard');
    const copy = join(rootA, 'model-kopie.ifc');
    const exported = await ok(client, 'planner_export_ifc', { path: copy });
    assertEq(exported.byteLength, model.byteLength, 'byteLength');
    assert(readFileSync(copy).equals(model), 'een ongewijzigde planning met model komt bytegelijk terug');

    const bonsai = readFileSync(join(FOREIGN_FIXTURES, 'bonsai-4d.ifc'));
    const bonsaiPath = join(rootA, 'bonsai-4d.ifc');
    writeFileSync(bonsaiPath, bonsai);
    await ok(client, 'planner_import_schedule', { path: bonsaiPath });
    const task = app.store.getState().tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
    await ok(client, 'planner_update_tasks', { updates: [{ id: task.id, fields: { duration: task.time.scheduleDuration + 1 } }] });
    const target = join(rootA, 'bonsai-kopie.ifc');
    const r = await refused(client, 'planner_export_ifc', { path: target }, 'VALIDATION', 'ongedragen wijziging');
    assert(String(r.s.error).includes('merge-needs-phase2') && String(r.s.error).includes('another format'), `de fout zegt waarom: ${r.s.error}`);
    assertEq(existsSync(target), false, 'er is niets geschreven');
    assert(readFileSync(bonsaiPath).equals(bonsai), 'de bron is bytegelijk');
  } finally { await client.close(); }
});

test('A: afsluiten', async () => { await httpA.close(); });

// --- B. De gebouwde server, gekopieerd naar een lege map --------------------------------------------

const buildDir = join(tmp, 'build');
const runDir = join(tmp, 'run');
const work = join(tmp, 'werkmap');
const outside = join(tmp, 'buiten');
const dataB = join(tmp, 'data-b');
const server = join(runDir, 'server.mjs');
if (process.env.OPS_HEADLESS_SOURCE_ONLY === '1') mkdirSync(work);

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
  assert(h.stdout.includes('--discovery-dir') && h.stdout.includes('OPS_MCP_DISCOVERY_DIR'), '--help noemt de registermap');
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
  assertEq(tools.length, 42, 'aantal tools');
  assertEq(canonical(tools), canonical(registryList()), 'tools/list = registry van de app (geen uitzonderingen)');
  assertEq(tools.map((t) => t.name), registryList().map((t) => t.name), 'dezelfde volgorde van tools');
});

test('B stdio: gids en beide skills komen uit de bundel (niets ontbreekt)', async () => {
  const data = await ok(stdio, 'planner_get_planning_guide', { part: 'both' });
  assertEq(data.missing, undefined, 'niets ontbreekt');
  // `both` is een installatiepart: de volle bestanden, mét frontmatter (#818, ronde 11).
  const guideFile = readFileSync(join(PUBLIC, AGENT_GUIDE_PATH), 'utf8');
  assertEq(data.guide, guideFile, 'gids = public/agent/planning-guide.md');
  assertEq(data.skills.map((s: { name: string }) => s.name), AGENT_SKILLS.map((s) => s.name), 'beide skills');
  for (const s of data.skills as { name: 'goed-plannen' | 'progress-update'; text: string }[]) {
    assertEq(s.text, readFileSync(join(PUBLIC, skillAssetPath(s.name)), 'utf8'), `skill ${s.name} = het bestand in public/`);
  }
  // Zonder `install` (standaard `guide`) is het antwoord leestekst (`readingText`, #818): zonder de eerste kop en
  // zonder lege regels.
  const read = await ok(stdio, 'planner_get_planning_guide', {});
  assertEq(read.guide, readingText(guideFile), 'gids = public/agent/planning-guide.md als leestekst');
  assert(guideFile.includes('\n\n') && !read.guide.includes('\n\n'), 'het bestand houdt zijn lege regels; het antwoord niet');
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

test('B stdio knownbug 1136: de losse server neemt een externe pset en een gebouwmodel mee naar een nieuwe naam', async () => {
  const pset = Buffer.from(withExternPset(readFileSync(EXAMPLE, 'utf8')));
  const model = readFileSync(join(FOREIGN_FIXTURES, 'eigen-plus-model.ifc'));
  for (const [name, bytes] of [['extern', pset], ['model', model]] as const) {
    writeFileSync(join(work, `${name}-bron.ifc`), bytes);
    await ok(stdio, 'planner_import_schedule', { path: `~/${name}-bron.ifc` });
    const exported = await ok(stdio, 'planner_export_ifc', { path: `~/${name}-kopie.ifc` });
    const written = readFileSync(join(work, `${name}-kopie.ifc`));
    assertEq(exported.byteLength, written.byteLength, `${name}: byteLength`);
    if (name === 'model') assert(written.equals(model), 'model: bytegelijk');
    else assert(written.toString('latin1').includes("'ExternPset'"), 'extern: de externe pset staat in de uitvoer');
    await refused(stdio, 'planner_export_ifc', { path: `~/${name}-bron.ifc`, overwrite: true }, 'VALIDATION', `${name}: over de bron`);
    assert(readFileSync(join(work, `${name}-bron.ifc`)).equals(bytes), `${name}: de bron is bytegelijk`);
  }
  writeFileSync(join(work, 'oude-bron.ifc'), oldOwnSource(ROOT));
  await ok(stdio, 'planner_import_schedule', { path: '~/oude-bron.ifc' });
  const oldTasks = (await ok(stdio, 'planner_list_tasks', { limit: 1000 })).tasks as Array<{ name: string }>;
  assertEq(oldTasks.find(t => t.name.startsWith('Set up '))?.name, OLD_TASK_NAME, 'oude eigen bron: de letterlijke taaknaam, zoals main 51b9cac22');
  const oldExport = await ok(stdio, 'planner_export_ifc', { path: '~/oude-bron-kopie.ifc' });
  assertEq([oldExport.characters, oldExport.byteLength, readFileSync(join(work, 'oude-bron-kopie.ifc')).byteLength], [59171, undefined, 59171],
    'oude eigen bron: de tekstroute van main, 59.171 tekens zoals main 51b9cac22');
  assertEq(readdirSync(work).filter(f => f.includes('.ops-')), [], 'geen hulpbestand');
});

test('B stdio 1136 ronde 3: een taak zonder OwnerHistory met een werkwijze van een ander programma krijgt geen IFC, ook geen back-up', async () => {
  const bytes = foreignWorkMethodSource(ROOT);
  const source = join(work, 'werkwijze-bron.ifc');
  const copy = join(work, 'werkwijze-kopie.ifc');
  writeFileSync(source, bytes);
  const opened = await ok(stdio, 'planner_import_schedule', { path: '~/werkwijze-bron.ifc' });
  assertEq(opened.tasks, 47, 'de planning opent zoals main');
  const first = await refused(stdio, 'planner_export_ifc', { path: '~/werkwijze-kopie.ifc' }, 'VALIDATION', 'export naar een nieuwe naam');
  assert(String(first.s.error).includes('cannot keep') && String(first.s.error).includes('nothing was written'), `de fout zegt waarom: ${first.s.error}`);
  assertEq(existsSync(copy), false, 'geen kopie');
  const backups = join(dataB, 'ai-backups');
  const before = filesBelow(backups);
  const tasks = (await ok(stdio, 'planner_list_tasks', { limit: 1000 })).tasks as Array<{ id: string; summary?: boolean }>;
  const edited = await call(stdio, 'planner_update_tasks', { updates: [{ id: tasks.find(t => !t.summary)!.id, fields: { name: 'Eerste wijziging' } }] });
  assert(!edited.isError, `de taakwijziging gaat door: ${JSON.stringify(edited.s).slice(0, 300)}`);
  assertEq(edited.s.envelope?.backupCreated, undefined, 'geen backupCreated');
  assert(String(edited.s.envelope?.backupWithheld).includes('No AI backup was made'), 'het antwoord zegt dat er geen back-up is');
  assertEq([...filesBelow(backups).keys()].filter(p => !before.has(p)), [], 'geen nieuw bestand in de back-upmap');
  await refused(stdio, 'planner_export_ifc', { path: '~/werkwijze-kopie.ifc' }, 'VALIDATION', 'export na de wijziging');
  await refused(stdio, 'planner_export_ifc', { path: '~/werkwijze-bron.ifc', overwrite: true }, 'VALIDATION', 'export over de bron');
  assertEq(existsSync(copy), false, 'nog steeds geen kopie');
  assert(readFileSync(source).equals(bytes) && bytes.includes(REVIEW_WORK_METHOD), 'de bron is bytegelijk en houdt de werkwijze');
});

/** Bladtaken als gesorteerde `naam|startdatum`-regels, voor een vergelijking tussen formaten. */
async function leafSchedule(client: Client): Promise<string[]> {
  const rows = (await ok(client, 'planner_list_tasks', { limit: 1000 })).tasks as Array<{ name: string; start: string; summary?: boolean }>;
  return rows.filter((t) => !t.summary).map((t) => `${t.name}|${String(t.start).slice(0, 10)}`).sort();
}

test('XML 1.0: geldige tekens, regeleinden en entiteiten blijven letterlijk correct (214)', () => {
  const parser = new XmlDomParser();
  const doc = parser.parseFromString('<root a="x\r\ny\tz&#xD;">A\r\nB\rC&#13;D&#x1F6A2;&amp;&lt;&gt;&quot;&apos;<![CDATA[\r\nraw & text]]></root>');
  assertEq(doc.getElementsByTagName('parsererror').length, 0, 'geldige XML');
  assertEq(doc.documentElement.textContent, 'A\nB\nC\rD🚢&<>"\'\nraw & text', 'fysieke CR genormaliseerd, karakterreferentie CR bewaard');
  assertEq(doc.documentElement.getAttribute('a'), 'x y z\r', 'attribuutwitruimte genormaliseerd vóór entiteiten');
  for (const code of [0x9, 0xa, 0xd, 0x20, 0xd7ff, 0xe000, 0xfffd, 0x10000, 0x10ffff]) {
    const value = String.fromCodePoint(code);
    const escaped = parser.parseFromString(`<r>&#${code};</r>`);
    assertEq(escaped.documentElement.textContent, value, `geldige karakterreferentie ${code}`);
  }
});

// Zowel direct als via de gebouwde server: geen stil genegeerde ongeldige uitbreidingselementen.
const invalidNamespaceFragments = [
  '<p:Extra/>', '<Extra p:attr="x"/>', '<:Extra/>', '<Extra:/>', '<p:q:Extra/>',
  '<Extra :attr="x"/>', '<Extra p:1attr="x" xmlns:p="urn:p"/>',
  '<Extra xmlns:p=""/>', '<Extra xmlns:xml="urn:wrong"/>',
  '<Extra xmlns:p="http://www.w3.org/XML/1998/namespace"/>',
  '<Extra xmlns="http://www.w3.org/XML/1998/namespace"/>',
  '<Extra xmlns:xmlns="urn:p"/>', '<xmlns:Extra/>',
  '<Extra xmlns:p="http://www.w3.org/2000/xmlns/"/>',
  '<Extra xmlns="http://www.w3.org/2000/xmlns/"/>',
  '<Extra xmlns:p="urn:x" xmlns:q="urn:x" p:a="1" q:a="2"/>',
  '<Extra xmlns:p="urn:x&amp;y" xmlns:q="urn:x&#38;y" p:a="1" q:a="2"/>',
  '<Extra><child xmlns:p="urn:p"/><p:later/></Extra>',
  '<Extra><child xmlns:p="urn:p"></child><p:later/></Extra>',
  '<Extra xmlns:p="urn:p"><child xmlns:p="urn:q" xmlns:q="urn:q" p:a="1" q:a="2"/></Extra>',
];

test('XML namespaces: declaratievolgorde, overerving, lokale overrides en gereserveerde namen (214)', () => {
  const parser = new XmlDomParser();
  for (const xml of invalidNamespaceFragments) {
    assertEq(parser.parseFromString(xml).getElementsByTagName('parsererror').length, 1, `ongeldig: ${xml}`);
  }
  const valid = [
    '<p:Root p:a="1" xmlns:p="urn:p"/>',
    '<Root xml:lang="nl"><xml:child/></Root>',
    '<Root xmlns:xml="http://www.w3.org/XML/1998/namespace" xml:space="preserve"/>',
    '<Root xmlns="urn:p" xmlns:p="urn:p" a="1" p:a="2"/>',
    '<Root xmlns="urn:p"><child xmlns=""/></Root>',
    '<Root xmlns:p="urn:p"><p:child p:a="x"/></Root>',
    '<Root xmlns:p="urn:p" xmlns:q="urn:q"><child xmlns:p="urn:q"/><later p:a="1" q:a="2"/></Root>',
    '<Root xmlns:p="urn:p" xmlns:q="urn:q"><child xmlns:p="urn:q"></child><later p:a="1" q:a="2"/></Root>',
    '<Root xmlns:p="urn:p" xmlns:q="urn:q" p:a="1" q:a="2"/>',
    '<Root xmlns:constructor="urn:c"><constructor:child/></Root>',
    '<Root xmlns:xmlOther="urn:allowed"><xmlOther:child/></Root>',
    '<é:Root xmlns:é="urn:unicode"><é:child/></é:Root>',
  ];
  for (const xml of valid) {
    assertEq(parser.parseFromString(xml).getElementsByTagName('parsererror').length, 0, `geldig: ${xml}`);
  }
  const root = parser.parseFromString('<p:Root xmlns:p="urn:p"><p:child p:a="x">tekst</p:child></p:Root>').documentElement;
  assertEq(root.tagName, 'p:Root', 'gekwalificeerde naam behouden');
  assertEq(root.localName, 'Root', 'lokale naam behouden');
  const child = root.getElementsByTagName('p:child')[0];
  assertEq(child.getAttribute('p:a'), 'x', 'attribuut via gekwalificeerde naam');
  assertEq(child.textContent, 'tekst', 'inhoud behouden');
});

/** Bewust zelf bytes maken; de productie-decoder mag niet zijn eigen fixtures schrijven. */
function utf16Bytes(text: string, bigEndian: boolean, bom = true): Buffer {
  const body = Buffer.from(text, 'utf16le');
  if (bigEndian) body.swap16();
  return bom ? Buffer.concat([Buffer.from(bigEndian ? [0xfe, 0xff] : [0xff, 0xfe]), body]) : body;
}

const invalidXmlBytes = [
  Buffer.from([0xff, 0xfe, 0x3c]), // afgebroken UTF-16-code-eenheid
  Buffer.from([0xff, 0xfe, 0x00, 0xd8]), // losse hoge surrogate
  Buffer.from([0xfe, 0xff, 0xdc, 0x00]), // losse lage surrogate
  Buffer.from([0x3c, 0x50, 0xc3, 0x28, 0x2f, 0x3e]), // ongeldige UTF-8
  Buffer.from([0xff, 0xfe, 0, 0, 0x3c, 0, 0, 0]), // UTF-32 LE, geen UTF-16
  Buffer.from([0, 0, 0xfe, 0xff, 0, 0, 0, 0x3c]), // UTF-32 BE
  utf16Bytes('<?xml version="1.0" encoding="UTF-8"?><Project/>', false),
  utf16Bytes('<?xml version="1.0" encoding="UTF-16LE"?><Project/>', true),
  Buffer.from('<?xml version="1.0" encoding="UTF-16"?><Project/>'),
  Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><Project/>'),
  utf16Bytes('<?xml version="1.0"?><Project/>', false, false),
  utf16Bytes('<?xml version="1.0" encoding="UTF-16"?><Project/>', true, false),
];

test('XML byte-decoding (214): beide bytevolgordes, BOM, declaratie en ongeldige bytes', async () => {
  const body = '<Project><Name>é漢😀</Name></Project>';
  for (const big of [false, true]) {
    assertEq(decodeXmlBytes(utf16Bytes(body, big)), body, 'BOM zonder declaratie');
    const generic = `<?xml version="1.0" encoding="UTF-16"?>${body}`;
    assertEq(decodeXmlBytes(utf16Bytes(generic, big)), generic, 'BOM met UTF-16-declaratie');
    const explicit = `<?xml version='1.0' encoding = '${big ? 'UTF-16BE' : 'UTF-16LE'}'?>${body}`;
    for (const bom of [false, true]) {
      assertEq(decodeXmlBytes(utf16Bytes(explicit, big, bom)), explicit, 'expliciete endian-declaratie');
    }
  }
  assertEq(decodeXmlBytes(Buffer.from(body)), body, 'UTF-8 zonder BOM');
  assertEq(decodeXmlBytes(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(body)])), body, 'UTF-8 BOM');
  for (const bytes of invalidXmlBytes) {
    let rejected = false;
    try { decodeXmlBytes(bytes); } catch (error) { rejected = error instanceof FileTextDecodingError; }
    assert(rejected, `ongeldige encoding moet leesvalidatiefout geven: ${bytes.toString('hex')}`);
  }
  const bytes = utf16Bytes(body, true);
  writeFileSync(join(work, 'encoding.XML'), bytes);
  writeFileSync(join(work, 'encoding.csv'), bytes);
  const fs = await createNodeFileFs(work);
  assertEq(await fs.readTextFile(join(work, 'encoding.XML')), body, 'XML-extensie hoofdletterongevoelig');
  assertEq(await fs.readTextFile(join(work, 'encoding.csv')), bytes.toString('utf8'), 'andere tekstformaten ongewijzigd');
  assertEq(Array.from(await fs.readFile(join(work, 'encoding.XML'))), Array.from(bytes), 'binair lezen blijft bytegelijk');
});

test('B stdio bevinding 3: MSPDI, P6 XML, CSV en XER openen in de losse server, met taken en datums', async () => {
  const source = readFileSync(EXAMPLE, 'utf8');
  writeFileSync(join(work, 'bron.ifc'), source);
  // De bronbestanden komen uit de stand van de app na openen, zoals Exporteren ze schrijft
  // (`fileSlice.ts`), niet uit de ruwe `readIFC`-uitvoer. Het voorbeeld is een bestand van vóór het
  // minutenmodel: de app rekent het bij openen opnieuw door, en de urenmotor rekent de procentlag
  // exact (B7), dus de berekende datums wijken af van de opgeslagen dagdatums. Een MSPDI uit de ruwe
  // `readIFC`-uitvoer, met die opgeslagen datums, opent in "datums zoals opgeslagen" en toont dan niet
  // de datums van het IFC. De ruwe writers verwachten genormaliseerde invoer (knownbugs 256).
  const app = createAppStoreContext();
  app.store.getState().openAsDocument(await parseOpenedFile({ name: 'bron.ifc', text: source }),
    { name: 'bron.ifc', ref: { kind: 'path', path: join(work, 'bron.ifc') } });
  if (app.store.getState().scheduleStale || !app.store.getState().cpmResult) app.store.getState().runCPM();
  const src = app.store.getState();
  writeFileSync(join(work, 'bron-mspdi.xml'), writeMSPDI(src.project, src.calendar, src.tasks, src.sequences, src.resources,
    src.assignments, src.calendars, src.baselines, src.activeBaselineId, src.customTaskTypes));
  writeFileSync(join(work, 'bron-p6.xml'), writeP6XML(src.project, src.calendar, src.tasks, src.sequences, src.resources,
    src.assignments, src.calendars, src.customTaskTypes));
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
  // Dezelfde echte import met Unicode-namen, in beide XML-dialecten en beide bytevolgordes.
  for (const [file, format] of [['bron-mspdi.xml', 'MSPDI-XML'], ['bron-p6.xml', 'P6-XML']] as const) {
    const xml = readFileSync(join(work, file), 'utf8').replace(/<\/Name>/g, ' é漢😀</Name>');
    writeFileSync(join(work, 'encoding.xml'), xml);
    await ok(stdio, 'planner_import_schedule', { path: '~/encoding.xml' });
    const expected = await leafSchedule(stdio);
    assert(expected.some((row) => row.includes('é漢😀')), `${format}: Unicode in taaknaam`);
    for (const big of [false, true]) {
      for (const bom of [false, true]) {
        const encoding = bom ? 'UTF-16' : big ? 'UTF-16BE' : 'UTF-16LE';
        const encoded = xml.replace(/encoding="UTF-8"/i, `encoding="${encoding}"`);
        writeFileSync(join(work, 'encoding.xml'), utf16Bytes(encoded, big, bom));
        const opened = await ok(stdio, 'planner_import_schedule', { path: '~/encoding.xml' });
        assertEq(opened.format, format, `${encoding}: formaat`);
        assertEq(await leafSchedule(stdio), expected, `${format} ${encoding} BOM=${bom}: namen en datums behouden`);
      }
    }
  }
  const beforeEncodingFailure = await leafSchedule(stdio);
  for (const bytes of invalidXmlBytes) {
    writeFileSync(join(work, 'encoding.xml'), bytes);
    await refused(stdio, 'planner_import_schedule', { path: '~/encoding.xml' }, 'VALIDATION', 'ongeldige XML-encoding');
    assertEq(await leafSchedule(stdio), beforeEncodingFailure, 'decoderfout laat het open plan intact');
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
  const beforeNamespaces = await leafSchedule(stdio);
  const mspdi = readFileSync(join(work, 'bron-mspdi.xml'), 'utf8');
  for (const fragment of invalidNamespaceFragments) {
    writeFileSync(join(work, 'namespace.xml'), mspdi.replace('</Project>', `${fragment}</Project>`));
    await refused(stdio, 'planner_import_schedule', { path: '~/namespace.xml' }, 'VALIDATION', `namespace: ${fragment}`);
    assertEq(await leafSchedule(stdio), beforeNamespaces, 'ongeldige namespace laat het open plan intact');
  }
  writeFileSync(join(work, 'namespace.xml'), mspdi.replace('</Project>',
    '<p:Extra p:attr="x" xmlns:p="urn:extension"><p:Child xml:lang="nl"/></p:Extra></Project>'));
  await ok(stdio, 'planner_import_schedule', { path: '~/namespace.xml' });
  assertEq(await leafSchedule(stdio), fromIfc, 'geldige namespace-uitbreiding behoudt planning');
  writeFileSync(join(work, 'entiteit.xml'), '<?xml version="1.0"?><!DOCTYPE Project [<!ENTITY x "y">]><Project xmlns="http://schemas.microsoft.com/project"><Name>&x;</Name></Project>');
  await refused(stdio, 'planner_import_schedule', { path: '~/entiteit.xml' }, 'VALIDATION', 'DOCTYPE met eigen entiteit');

  // Via de echte gebouwde server: geen ongeldige tekens of prototype-entiteiten in een plan laden.
  const beforeInvalid = await leafSchedule(stdio);
  const invalid = ['&#0;', '&#1;', '&#xD800;', '&#xFFFE;', '&#xFFFF;', '&#1114112;',
    '&constructor;', '&toString;', '&__proto__;', '&missing;', '&amp', '&#X41;', ']]>',
    String.fromCharCode(0), String.fromCharCode(1), String.fromCharCode(0xfffe)];
  for (const value of invalid) {
    writeFileSync(join(work, 'invalid-character.xml'), `<Project xmlns="http://schemas.microsoft.com/project"><Name>${value}</Name></Project>`);
    await refused(stdio, 'planner_import_schedule', { path: '~/invalid-character.xml' }, 'VALIDATION', `ongeldige XML ${JSON.stringify(value)}`);
    assertEq(await leafSchedule(stdio), beforeInvalid, 'geweigerde import laat huidig plan intact');
  }
  const parser = new XmlDomParser();
  assertEq(parser.parseFromString('<r>' + String.fromCharCode(0xd800) + '</r>').getElementsByTagName('parsererror').length, 1,
    'losse surrogate ook geweigerd vóór UTF-8-vervanging aan de bestandssysteemrand');
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

test('B stdio slot (#730): OPS_MCP_DISCOVERY_DIR — zolang de app draait wordt geen bestaand bestand vervangen', async () => {
  const regB = join(tmp, 'register-b');
  mkdirSync(regB);
  cpSync(EXAMPLE, join(work, 'open-b.ifc'));
  const openB = join(work, 'open-b.ifc');
  const bytes = readFileSync(openB);
  const reg = (name: string, text: string) => writeFileSync(join(regB, name), text);
  const clear = () => { for (const f of readdirSync(regB)) rmSync(join(regB, f)); };
  reg('open-files.json', registerText(process.pid, [openB]));
  const { client, transport } = await stdioClient(['--no-backup'], { OPS_MCP_DISCOVERY_DIR: regB });
  try {
    assert((client.getInstructions() ?? '').includes('the server does not replace an existing file'),
      'instructies noemen het slot');
    // Lezen van het open bestand mag.
    await ok(client, 'planner_import_schedule', { path: '~/open-b.ifc' });
    const r = await refused(client, 'planner_export_ifc', { path: '~/open-b.ifc', overwrite: true }, 'SCOPE', 'open bestand overschrijven');
    assert(String(r.s.error).includes('does not replace the existing file'), `tekst: ${r.s.error}`);
    assert(Buffer.compare(readFileSync(openB), bytes) === 0, 'open bestand byte-gelijk');
    assertEq(readdirSync(work).filter((f) => f.endsWith('.tmp')), [], 'geen halffabricaat');
    await ok(client, 'planner_export_ifc', { path: '~/ander-b.ifc' });
    assert(existsSync(join(work, 'ander-b.ifc')), 'nieuw bestand geschreven');
    await refused(client, 'planner_export_ifc', { path: '~/ander-b.ifc', overwrite: true }, 'SCOPE', 'bestaand bestand dat niet in het register staat');
    symlinkSync(openB, join(work, 'alias-b.ifc'));
    await refused(client, 'planner_export_ifc', { path: '~/alias-b.ifc', overwrite: true }, 'SCOPE', 'symlink naar het open bestand');
    // Beide niet bestaand en gelijk.
    clear();
    reg('open-files.json', registerText(process.pid, [join(work, 'nog-niet-b.ifc')]));
    await refused(client, 'planner_export_ifc', { path: '~/nog-niet-b.ifc' }, 'SCOPE', 'beide niet bestaand');
    assert(!existsSync(join(work, 'nog-niet-b.ifc')), 'niets aangemaakt');
    // Een dev-register telt mee; een halffabricaat niet.
    clear();
    reg('open-files.json.9c1d.tmp', '{ kapot');
    reg('open-files.wt-b.json', registerText(process.pid, [openB]));
    await refused(client, 'planner_export_ifc', { path: '~/open-b.ifc', overwrite: true }, 'SCOPE', 'dev-register');
    await ok(client, 'planner_export_ifc', { path: '~/nieuw-b.ifc' });
    // Dood pid: vrij.
    clear();
    reg('open-files.json', registerText(deadPid(), [openB]));
    await ok(client, 'planner_export_ifc', { path: '~/open-b.ifc', overwrite: true });
    // Onbruikbaar register: met levend pid en zonder pid wordt niets geschreven; lezen mag.
    for (const text of [JSON.stringify({ formatVersion: 99, pid: process.pid }), 'geen json']) {
      clear();
      reg('open-files.json', text);
      const all = await refused(client, 'planner_export_ifc', { path: '~/ander-b.ifc', overwrite: true }, 'SCOPE', `onbruikbaar: ${text}`);
      assert(String(all.s.error).includes('the server writes no file at all'), `tekst: ${all.s.error}`);
      await ok(client, 'planner_import_schedule', { path: '~/ander-b.ifc' });
    }
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
