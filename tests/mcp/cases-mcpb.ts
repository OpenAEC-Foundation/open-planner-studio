// Claude Desktop-bundel (`.mcpb`, issue #567 en #730): bouwt hem met `scripts/build-mcpb.mjs`, controleert de
// ZIP en het manifest, en start de MEEGELEVERDE servers (uit de ZIP gehaald) zoals Claude Desktop dat doet
// (`node server/index.mjs`). Twee planners achter het schakelstuk:
//   - de app: de bridge-spiegel (`bridgeMirror.ts`) rond de echte TS-kant op een eigen headless store, gevonden
//     via een `runtime.json` in een tijdelijke ontdekkingsmap (`OPS_MCP_DISCOVERY_DIR`);
//   - zonder app: `server/headless.mjs` uit de ZIP, als kindproces van het schakelstuk, op een tijdelijke werkmap.
// De client is de officiële SDK-client; het stdio-transport hieronder start de server zelf. Niet de
// `StdioClientTransport` van de SDK: die sleept `cross-spawn` (CommonJS) mee, en dat laadt niet in de
// ESM-testbundel van `run.sh`.
//
// Wat dit NIET bewijst: dat Claude Desktop de bundel installeert en het installatievenster toont, en de echte
// Rust-bridge en het echte `runtime.json` van de app (dat doet `tests/mcp/realApp/`). De volledige
// schemacontrole van het manifest doet de officiële `mcpb validate` in `.github/workflows/mcpb.yml` en
// `release.yml`; hier staan de velden waar de bundel op leunt.
import { test, assert, assertEq, run } from './harness';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ToolListChangedNotificationSchema, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { createAppStoreContext } from '@/state/appStore';
import { buildMcpContext, createMcpSessionTable, type McpSessionTable } from '@/services/mcp/server';
import type { McpContext } from '@/services/mcp/contracts';
import { handleMcpMessage, MCP_INSTRUCTIONS, MCP_SERVER_NAME } from '@/services/mcp/dispatcher';
import { buildOpenFilesFile, buildRuntimeFile, serializeDiscoveryFile } from '@/services/mcp/discoveryContract';
import { fileToolDeps } from '@/services/mcp/tools/fileTools';
import { getTools } from '@/services/mcp/toolRegistry';
import { parseZipEntries } from '@/services/zip';
import { startBridgeMirror, type BridgeMirror } from './bridgeMirror';
import {
  HEADLESS_RESTART_NOTE, SESSION_RESET_MESSAGE, STATUS_TOOL_NAME, SWITCH_TO_APP_MESSAGE, SWITCH_TO_APP_NOTE,
  UNKNOWN_OUTCOME_MESSAGE, UNSAVED_STAY_NOTE, bundleInstructions, createPlannerProxy, headlessLostMessage,
  switchToHeadlessMessage, switchToHeadlessNote, type HeadlessChannel,
} from '../../integrations/claude-desktop/src/proxy';
import { readBundleConfig } from '../../integrations/claude-desktop/src/config';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const appPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string; license: string };
const work = mkdtempSync(join(tmpdir(), 'ops-mcpb-'));
const outDir = join(work, 'out');
const serverFile = join(work, 'extracted', 'server', 'index.mjs');
/** MCP-backups van de headless planner: niet in de gegevensmap van wie de test draait. */
const dataDir = join(work, 'data');
const EXAMPLE = join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc');
const EXAMPLE_NAME = 'Refurbishment & Extension of a Family Home';

type Json = Record<string, any>;
let manifest: Json = {};
let entries = new Map<string, Uint8Array>();

// --- De headless app achter de spiegel -----------------------------------------------------------

const app = createAppStoreContext();
const APP_PROJECT = 'Claude Desktop-bundel';
app.store.getState().setProject({ name: APP_PROJECT });
app.store.getState().ensureProjectCalendarInLibrary();
app.store.getState().addTask({ name: 'warmup' });
app.store.getState().undo();

const TOKEN = 'c'.repeat(64);
const backup = { ensureBackup: async () => null, markDuplicateBorn: () => {} };
const startMirror = (
  port?: number,
  extra: { sessions?: McpSessionTable; handleMessage?: (body: string, ctx: McpContext) => Promise<string> } = {},
) => startBridgeMirror({
  token: TOKEN,
  buildContext: () => buildMcpContext(app, undefined, backup),
  handleMessage: extra.handleMessage ?? handleMcpMessage,
  sessions: extra.sessions,
  port,
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wacht tot `cond` waar is (max. ~2 s); de assertie erna toont de echte stand. */
async function waitFor(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !cond(); i++) await sleep(20);
}

/** Een poort waar niets luistert (net vrijgegeven). */
async function freePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/** Het pid van een proces dat al gestopt is. */
function deadPid(): number {
  const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  return Number(r.stdout);
}

let dirCount = 0;
/** Een lege ontdekkingsmap (`<appDataDir>/mcp` van een nep-app). */
function newDiscoveryDir(): string {
  const dir = join(work, `discovery-${++dirCount}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Een werkmap met één planning (`plan.ifc`). */
function newRoot(): string {
  const dir = join(work, `root-${++dirCount}`);
  mkdirSync(dir, { recursive: true });
  copyFileSync(EXAMPLE, join(dir, 'plan.ifc'));
  return dir;
}

/** Schrijft `runtime.json` zoals de app dat doet als de bridge draait. */
function writeRuntime(dir: string, port: number, opts: { token?: string; pid?: number } = {}): void {
  const file = buildRuntimeFile({
    pid: opts.pid ?? process.pid, port, token: opts.token ?? TOKEN, appVersion: appPkg.version, startedAt: new Date(),
  });
  writeFileSync(join(dir, 'runtime.json'), serializeDiscoveryFile(file), { mode: 0o600 });
}
const removeRuntime = (dir: string) => rmSync(join(dir, 'runtime.json'), { force: true });

/** Schrijft `open-files.json` zoals de app dat doet: deze bestanden staan open in de app. */
function writeOpenFiles(dir: string, paths: readonly string[]): void {
  const file = buildOpenFilesFile({ pid: process.pid, appVersion: appPkg.version, updatedAt: new Date(), paths });
  writeFileSync(join(dir, 'open-files.json'), serializeDiscoveryFile(file), { mode: 0o600 });
}

interface Session {
  client: Client;
  listChanged: () => number;
  stderr: () => string;
}

/** Minimaal stdio-clienttransport: één regel JSON per bericht, zoals de MCP-specificatie voor stdio. */
function stdioTransport(env: Record<string, string>, onStderr: (text: string) => void): Transport {
  const child = spawn(process.execPath, [serverFile], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const buffer = new ReadBuffer();
  const transport: Transport = {
    start: async () => {
      child.stdout.on('data', (chunk: Buffer) => {
        buffer.append(chunk);
        for (let message = buffer.readMessage(); message !== null; message = buffer.readMessage()) {
          transport.onmessage?.(message);
        }
      });
      child.stderr.on('data', (chunk: Buffer) => onStderr(chunk.toString('utf8')));
      child.on('error', (error) => transport.onerror?.(error));
      child.on('close', () => transport.onclose?.());
    },
    send: async (message: JSONRPCMessage) => {
      await new Promise<void>((resolve, reject) => {
        child.stdin.write(serializeMessage(message), (error) => (error ? reject(error) : resolve()));
      });
    },
    close: async () => {
      child.stdin.end();
      if (child.exitCode === null) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => { child.kill(); resolve(); }, 4000);
          child.once('close', () => { clearTimeout(timer); resolve(); });
        });
      }
    },
  };
  return transport;
}

/** Start de meegeleverde server zoals Claude Desktop: `node server/index.mjs`, met de werkmap in env. */
async function startExtension(opts: { discovery: string; root?: string }): Promise<Session> {
  let log = '';
  const env: Record<string, string> = { PATH: process.env.PATH ?? '', OPS_MCP_DISCOVERY_DIR: opts.discovery, OPS_MCP_DATA_DIR: dataDir };
  if (opts.root) env.OPS_MCP_ROOT = opts.root;
  const transport = stdioTransport(env, (text) => { log += text; });
  const client = new Client({ name: 'ops-mcpb-test', version: '1.0.0' });
  let changes = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => { changes++; });
  await client.connect(transport);
  return { client, listChanged: () => changes, stderr: () => log };
}

/** De bundel met een draaiende app (de spiegel op `port`), zonder werkmap: zoals vóór #730. */
const startWithApp = (port: number) => {
  const discovery = newDiscoveryDir();
  writeRuntime(discovery, port);
  return startExtension({ discovery });
};

interface ToolResult { isError: boolean; text: string; texts: string[]; structured: Json }

async function call(session: Session, name: string, args: Json = {}): Promise<ToolResult> {
  const res = await session.client.callTool({ name, arguments: args }, undefined, { timeout: 30_000 });
  const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
  const texts = content.filter((c) => c.type === 'text').map((c) => c.text ?? '');
  return { isError: res.isError === true, text: texts.join('\n'), texts, structured: (res.structuredContent ?? {}) as Json };
}

async function toolNames(session: Session): Promise<string[]> {
  return (await session.client.listTools()).tools.map((t) => t.name);
}

const projectName = (res: ToolResult) => res.structured.data?.project?.name as string | undefined;

// --- Bouwen en de ZIP ----------------------------------------------------------------------------

test('build:mcpb bouwt de bundel (exit 0)', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/build-mcpb.mjs'), '--out', outDir], { cwd: ROOT, encoding: 'utf8' });
  assertEq(r.status, 0, `build-mcpb exitcode\n${r.stdout}\n${r.stderr}`);
});

test('de .mcpb is een geldige ZIP met precies de verwachte bestanden', async () => {
  const bytes = readFileSync(join(outDir, `open-planner-studio-${appPkg.version}.mcpb`));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const list = await parseZipEntries(buffer);
  entries = new Map(list.map((e) => [e.name, e.data]));
  assertEq([...entries.keys()].sort(),
    ['LICENSE', 'LICENSE.GPL', 'THIRD-PARTY-NOTICES.md', 'icon.png', 'manifest.json', 'server/headless.mjs', 'server/index.mjs'],
    'inhoud van de bundel');
  const server = entries.get('server/index.mjs') as Uint8Array;
  assert(server.length < 1024 * 1024, `server/index.mjs is ${server.length} bytes; verwacht onder 1 MB`);
  const headless = new TextDecoder().decode(entries.get('server/headless.mjs'));
  assert(headless.startsWith('#!/usr/bin/env node\n// @openaec/open-planner-mcp-server'), 'headless.mjs is de headless MCP-server');
  const png = entries.get('icon.png') as Uint8Array;
  assertEq([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'icon.png is een PNG');
  const notices = new TextDecoder().decode(entries.get('THIRD-PARTY-NOTICES.md'));
  assert(notices.includes('@modelcontextprotocol/sdk'), 'THIRD-PARTY-NOTICES.md noemt de SDK');
  assert(notices.includes('## server/headless.mjs'), 'THIRD-PARTY-NOTICES.md dekt ook headless.mjs');
  mkdirSync(dirname(serverFile), { recursive: true });
  writeFileSync(serverFile, server);
  writeFileSync(join(dirname(serverFile), 'headless.mjs'), entries.get('server/headless.mjs') as Uint8Array);
  manifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json'))) as Json;
});

test('manifest.json: de velden waar de bundel op leunt', () => {
  const allowed = new Set([
    'manifest_version', 'name', 'display_name', 'version', 'description', 'long_description', 'author', 'repository',
    'homepage', 'documentation', 'support', 'icon', 'icons', 'screenshots', 'server', 'tools', 'tools_generated',
    'prompts', 'prompts_generated', 'keywords', 'license', 'privacy_policies', 'compatibility', 'user_config',
    'localization', '_meta',
  ]);
  const unknown = Object.keys(manifest).filter((k) => !allowed.has(k));
  assertEq(unknown, [], 'onbekende topvelden (tikfout?)');
  assertEq(manifest.manifest_version, '0.3', 'manifest_version');
  assertEq(manifest.name, 'open-planner-studio', 'name');
  assertEq(manifest.version, appPkg.version, 'versie = appversie');
  assertEq(manifest.license, appPkg.license, 'licentie = repolicentie');
  assert(typeof manifest.description === 'string' && manifest.description.length > 0, 'description');
  assert(typeof manifest.author?.name === 'string', 'author.name');
  assert(entries.has(manifest.icon), `icon ${manifest.icon} zit in de bundel`);
  assertEq(manifest.server?.type, 'node', 'server.type');
  assert(entries.has(manifest.server?.entry_point), 'server.entry_point zit in de bundel');
  // De werkmap via env, niet via args: Claude Desktop breekt op Windows een argument met een spatie.
  assertEq(manifest.server?.mcp_config, {
    command: 'node',
    args: ['${__dirname}/server/index.mjs'],
    env: { OPS_MCP_ROOT: '${user_config.workdir}' },
  }, 'server.mcp_config');
  assertEq(Object.keys(manifest.user_config ?? {}), ['workdir'], 'alleen de werkmap; poort en token komen uit runtime.json');
  assertEq(manifest.user_config.workdir.type, 'directory', 'workdir: type');
  assertEq(manifest.user_config.workdir.required, true, 'workdir: verplicht');
  assertEq(manifest.compatibility?.runtimes?.node, '>=18.0.0', 'Node-eis van het schakelstuk');
});

test('instellingen: werkmap, een letterlijke manifestvariabele en de dev-slug', () => {
  assertEq(readBundleConfig({ OPS_MCP_ROOT: ' /p ' }), { root: '/p', devInstance: null, notes: [] }, 'gewone werkmap');
  assertEq(readBundleConfig({ OPS_MCP_ROOT: '${user_config.workdir}' }).root, null, 'niet ingevuld');
  assertEq(readBundleConfig({ OPS_MCP_DEV_INSTANCE: 'wt-a' }).devInstance, 'wt-a', 'dev-slug');
  const bad = readBundleConfig({ OPS_MCP_DEV_INSTANCE: '../x' });
  assertEq([bad.devInstance, bad.notes.length], [null, 1], 'ongeldige slug genegeerd, met melding');
});

// --- Twee standen, dezelfde tool -------------------------------------------------------------------

let mirror: BridgeMirror;
let appTools: Json[] = [];

test('met de app: runtime.json → de bridge; instructies, toollijst en een leestool van de app', async () => {
  mirror = await startMirror();
  const root = newRoot();
  const discovery = newDiscoveryDir();
  writeRuntime(discovery, mirror.port);
  const s = await startExtension({ discovery, root });
  try {
    assertEq(s.client.getServerVersion()?.name, MCP_SERVER_NAME, 'serverInfo komt van de bridge, niet van de bundel');
    assertEq(s.client.getInstructions(), MCP_INSTRUCTIONS + bundleInstructions(root), 'instructies van de bridge plus de bundeluitleg');
    assertEq(s.client.getServerCapabilities()?.tools?.listChanged, true, 'listChanged ook bij een online initialize (review r1, 3)');
    appTools = (await s.client.listTools()).tools as unknown as Json[];
    assertEq(appTools.length, getTools().length, 'aantal tools');
    assert(appTools.every((t) => String(t.name).startsWith('planner_')), 'alleen planner_-tools');
    const res = await call(s, 'planner_get_project_info');
    assert(!res.isError && res.structured.ok === true, `leestool faalde: ${res.text}`);
    assertEq(projectName(res), APP_PROJECT, 'het antwoord komt uit de app');
    assert(s.stderr().includes(`mode: the app (http://127.0.0.1:${mirror.port}/mcp)`), `logregel van de stand:\n${s.stderr()}`);
  } finally {
    await s.client.close();
  }
});

test('zonder app: geen runtime.json → de headless planner op de werkmap; dezelfde tools en dezelfde leestool', async () => {
  const root = newRoot();
  const s = await startExtension({ discovery: newDiscoveryDir(), root });
  try {
    assertEq(s.client.getServerVersion()?.name, MCP_SERVER_NAME, 'serverInfo van de headless planner');
    const instructions = s.client.getInstructions() ?? '';
    assert(instructions.startsWith(MCP_INSTRUCTIONS) && instructions.includes('Headless mode')
      && instructions.endsWith(bundleInstructions(root)), 'instructies: app, headless uitleg, bundeluitleg');
    const tools = (await s.client.listTools()).tools as unknown as Json[];
    const shape = (list: Json[]) => list.map((t) => JSON.stringify([t.name, t.description, t.inputSchema, t.annotations])).sort();
    assertEq(shape(tools), shape(appTools), 'dezelfde tools, beschrijvingen, schema\'s en annotaties als met de app');
    const fresh = await call(s, 'planner_get_project_info');
    assert(!fresh.isError && fresh.structured.ok === true, `leestool zonder app: ${fresh.text}`);
    const opened = await call(s, 'planner_import_schedule', { path: '~/plan.ifc' });
    assert(!opened.isError && opened.structured.ok === true, `plan openen: ${opened.text}`);
    const info = await call(s, 'planner_get_project_info');
    assertEq(projectName(info), EXAMPLE_NAME, 'het antwoord komt uit het bestand in de werkmap');
    assert(s.stderr().includes(`mode: without the app (the working folder '${root}')`), `logregel van de stand:\n${s.stderr()}`);
    assert(/headless: \[ops-mcp\] version \S+; working folder /.test(s.stderr()), 'de logregels van de headless planner gaan mee');
  } finally {
    await s.client.close();
  }
});

test('achtergebleven runtime.json (dood pid), geen verbinding of een geweigerd token: zonder app', async () => {
  const cases: Array<[string, (d: string) => Promise<void> | void, RegExp]> = [
    ['dood pid', (d) => writeRuntime(d, mirror.port, { pid: deadPid() }), /is left over: process \d+ is not running/],
    ['niemand op de poort', async (d) => writeRuntime(d, await freePort()), /does not answer on http:\/\/127\.0\.0\.1:\d+\/mcp/],
    ['ander token', (d) => writeRuntime(d, mirror.port, { token: 'd'.repeat(64) }), /refused the token from its runtime file \(HTTP 401\)/],
  ];
  for (const [label, prepare, logLine] of cases) {
    const discovery = newDiscoveryDir();
    await prepare(discovery);
    const s = await startExtension({ discovery, root: newRoot() });
    try {
      const res = await call(s, 'planner_import_schedule', { path: '~/plan.ifc' });
      assert(!res.isError && res.structured.ok === true, `${label}: zonder app openen: ${res.text}`);
      assert(s.stderr().includes('mode: without the app'), `${label}: stand zonder app:\n${s.stderr()}`);
      assert(logLine.test(s.stderr()), `${label}: logregel ${logLine}:\n${s.stderr()}`);
    } finally {
      await s.client.close();
    }
  }
});

test('wissel app → zonder app tijdens een sessie: melding, list_changed, wijzigen pas na een geopend bestand; niets kwijt', async () => {
  const root = newRoot();
  const discovery = newDiscoveryDir();
  const bridge = await startMirror();
  writeRuntime(discovery, bridge.port);
  const s = await startExtension({ discovery, root });
  let open = true;
  const before = app.store.getState().tasks.length;
  try {
    await toolNames(s);
    const inApp = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-app', name: 'In de app', duration: 1 }] });
    assert(!inApp.isError && inApp.structured.ok === true, `wijziging in de app: ${inApp.text}`);
    assertEq(app.store.getState().tasks.length, before + 1, 'de taak staat in de app');

    // De app gaat dicht: de app verwijdert runtime.json en de bridge stopt.
    removeRuntime(discovery);
    await bridge.close();
    open = false;
    const read = await call(s, 'planner_get_project_info');
    assert(!read.isError, `lezen na de wissel: ${read.text}`);
    assertEq(read.texts[0], switchToHeadlessNote(root), 'melding vooraan het eerste antwoord');
    assert(projectName(read) !== APP_PROJECT, 'het antwoord komt niet meer uit de app');
    await waitFor(() => s.listChanged() >= 1);
    assertEq(s.listChanged(), 1, 'list_changed bij de wissel');
    const refused = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-x', name: 'Hoort bij de app', duration: 1 }] });
    assertEq(refused.text, switchToHeadlessMessage(root), 'wijziging na de wissel geweigerd');
    assertEq(app.store.getState().tasks.length, before + 1, 'het werk in de app is onaangeroerd');

    const opened = await call(s, 'planner_import_schedule', { path: '~/plan.ifc' });
    assert(!opened.isError && opened.structured.ok === true, `bestand openen: ${opened.text}`);
    const added = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-h', name: 'Zonder app 1', duration: 1 }] });
    assert(!added.isError && added.structured.ok === true, `wijziging zonder app: ${added.text}`);
    const saved = await call(s, 'planner_export_ifc', { path: '~/plan-claude.ifc' });
    assert(!saved.isError && saved.structured.ok === true, `opslaan: ${saved.text}`);
    assert(readFileSync(join(root, 'plan-claude.ifc'), 'utf8').includes("'Zonder app 1'"), 'de taak staat in het bestand');
    assert(s.stderr().includes('switched to working without the app'), `logregel van de wissel:\n${s.stderr()}`);
  } finally {
    await s.client.close();
    if (open) await bridge.close();
    while (app.store.getState().tasks.length > before) app.store.getState().undo();
  }
});

test('wissel zonder app → app: niet weggeschreven werk houdt de aanvraag zonder app tot het is opgeslagen', async () => {
  const root = newRoot();
  const discovery = newDiscoveryDir();
  const s = await startExtension({ discovery, root });
  let bridge: BridgeMirror | null = null;
  const before = app.store.getState().tasks.length;
  try {
    await toolNames(s);
    const opened = await call(s, 'planner_import_schedule', { path: '~/plan.ifc' });
    assert(!opened.isError && opened.structured.ok === true, `bestand openen: ${opened.text}`);
    const added = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-u', name: 'Nog niet opgeslagen', duration: 1 }] });
    assert(!added.isError && added.structured.ok === true, `wijziging zonder app: ${added.text}`);

    // De app gaat open en start de bridge.
    bridge = await startMirror();
    writeRuntime(discovery, bridge.port);
    const read = await call(s, 'planner_get_project_info');
    assertEq(read.texts[0], UNSAVED_STAY_NOTE, 'melding: blijft zonder app tot het werk is weggeschreven');
    assertEq(projectName(read), EXAMPLE_NAME, 'nog steeds de headless planner');
    const more = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-v', name: 'Ook nog zonder app', duration: 1 }] });
    assert(!more.isError && more.structured.ok === true, `tweede wijziging zonder app: ${more.text}`);
    assertEq(app.store.getState().tasks.length, before, 'niets in de app gezet');

    // De gebruiker heeft plan.ifc in de app open: zolang de app draait, vervangt de headless planner geen
    // bestaand bestand (het slot), en het werk blijft dus niet weggeschreven.
    const original = readFileSync(join(root, 'plan.ifc'), 'utf8');
    writeOpenFiles(discovery, [join(root, 'plan.ifc')]);
    const locked = await call(s, 'planner_export_ifc', { path: '~/plan.ifc', overwrite: true });
    assert(locked.structured.ok === false && locked.text.includes('does not replace the existing file'),
      `overschrijven van een bestaand bestand terwijl de app draait hoort geweigerd: ${locked.text}`);
    assertEq(readFileSync(join(root, 'plan.ifc'), 'utf8'), original, 'plan.ifc onveranderd');
    const stillHere = await call(s, 'planner_get_project_info');
    assertEq(projectName(stillHere), EXAMPLE_NAME, 'na de weigering nog steeds de headless planner');

    const saved = await call(s, 'planner_export_ifc', { path: '~/plan-claude.ifc' });
    assert(!saved.isError && saved.structured.ok === true, `opslaan onder een andere naam: ${saved.text}`);
    const written = readFileSync(join(root, 'plan-claude.ifc'), 'utf8');
    assert(written.includes("'Nog niet opgeslagen'") && written.includes("'Ook nog zonder app'"), 'beide taken staan in het bestand');

    const next = await call(s, 'planner_get_project_info');
    assertEq(next.texts[0], SWITCH_TO_APP_NOTE, 'na het opslaan: melding van de wissel naar de app');
    assertEq(projectName(next), APP_PROJECT, 'het antwoord komt uit de app');
    await waitFor(() => s.listChanged() >= 1);
    assertEq(s.listChanged(), 1, 'list_changed bij de wissel');
    const refused = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-w', name: 'Zonder keuze', duration: 1 }] });
    assertEq(refused.text, SWITCH_TO_APP_MESSAGE, 'wijziging na de wissel geweigerd');
    const chosen = await call(s, 'planner_switch_document', { documentId: app.store.getState().activeDocumentId });
    assert(!chosen.isError && chosen.structured.ok === true, `document kiezen: ${chosen.text}`);
    const inApp = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a2', name: 'Bewust in de app', duration: 1 }] });
    assert(!inApp.isError && inApp.structured.ok === true, `wijziging in de app: ${inApp.text}`);
    assertEq(app.store.getState().tasks.length, before + 1, 'één taak in de app');
    assert(s.stderr().includes('staying without the app') && s.stderr().includes('stopped the planner without the app')
      && s.stderr().includes('switched to the app'), `logregels van de wissel:\n${s.stderr()}`);
  } finally {
    await s.client.close();
    if (bridge) await bridge.close();
    while (app.store.getState().tasks.length > before) app.store.getState().undo();
  }
});

test('wijziging zonder app zonder antwoord op tijd: telt als niet weggeschreven, de planner blijft tot het opslaan (review r1, 1)', async () => {
  // Het schakelstuk zelf, met een nep-kindproces: een time-out van 130 s is in een test niet af te wachten.
  const sent: Json[] = [];
  const toChild: string[] = [];
  let closed = false;
  let appOpen = false;
  const answer = (msg: Json, result: Json) => ({ type: 'reply' as const, json: { jsonrpc: '2.0', id: msg.id, result } });
  const toolResult = (docId: string) => {
    const structured = { ok: true, envelope: { activeDocumentId: docId } };
    return { content: [{ type: 'text', text: JSON.stringify(structured) }], structuredContent: structured };
  };
  const tool = (name: string, readOnly: boolean) => ({ name, inputSchema: { type: 'object' }, annotations: { readOnlyHint: readOnly } });
  const channel: HeadlessChannel = {
    alive: true,
    async request(message) {
      const msg = message as Json;
      const name = msg.method === 'tools/call' ? String(msg.params?.name) : String(msg.method);
      toChild.push(name);
      if (msg.method === 'initialize') {
        return answer(msg, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'headless', version: 't' }, instructions: 'h' });
      }
      if (msg.id === undefined) return { type: 'none' };
      if (msg.method === 'tools/list') {
        return answer(msg, { tools: [tool('planner_get_project_info', true), tool('planner_list_documents', true),
          tool('planner_add_tasks', false), tool('planner_export_ifc', false)] });
      }
      // De wijziging wordt uitgevoerd, maar het antwoord komt te laat.
      if (name === 'planner_add_tasks') return { type: 'timeout' };
      return answer(msg, toolResult('doc-zonder-app'));
    },
    async close() { closed = true; },
  };
  const proxy = createPlannerProxy({
    version: 't',
    requestTimeoutMs: 1000,
    findApp: () => (appOpen ? { port: 1, token: TOKEN, key: 'nep-app', appVersion: 't', pid: process.pid } : null),
    headless: { root: '/werkmap', start: async () => channel },
    fetchImpl: async (_url, init) => {
      const msg = JSON.parse(String(init?.body)) as Json;
      const result = msg.method === 'initialize'
        ? { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'app', version: 't' }, instructions: 'a' }
        : msg.method === 'tools/call' ? toolResult('doc-app') : {};
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }),
        { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 'sessie-app' } });
    },
    log: () => {},
  }, async (message) => { sent.push(message as unknown as Json); });
  const reply = (id: number) => sent.find((m) => m.id === id)?.result as Json;
  const callTool = (id: number, name: string) => proxy.handle({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: {} } });
  try {
    await proxy.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    await proxy.handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await proxy.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    await callTool(3, 'planner_add_tasks');
    assert(reply(3).isError === true && String(reply(3).content[0].text).includes('did not answer within'), `time-out: ${JSON.stringify(reply(3))}`);

    appOpen = true;
    await callTool(4, 'planner_get_project_info');
    assertEq(reply(4).content[0].text, UNSAVED_STAY_NOTE, 'blijft zonder app: de wijziging kan uitgevoerd zijn');
    assertEq(closed, false, 'het kindproces blijft draaien');
    assert(toChild.includes('planner_list_documents'), `het actieve document opgevraagd: ${toChild.join(', ')}`);
    await callTool(5, 'planner_get_project_info');
    assertEq(closed, false, 'nog steeds zonder app tot het opslaan');

    await callTool(6, 'planner_export_ifc');
    await callTool(7, 'planner_get_project_info');
    assertEq(closed, true, 'na het opslaan naar de app');
    assertEq(reply(7).content[0].text, SWITCH_TO_APP_NOTE, 'melding van de wissel');
  } finally {
    await proxy.close();
  }
});

test('verloren antwoord van de app: een wijziging gaat niet twee keer, een leesaanvraag wel opnieuw (review r1, 3)', async () => {
  const bridge = await startMirror();
  let addPosts = 0;
  let readPosts = 0;
  let dropAdd = true;
  let dropRead = true;
  // Tussen bundel en spiegel: geeft de aanvraag door, en verbreekt bij de eerste wijziging en de eerste
  // leesaanvraag de verbinding vóór het antwoord (de app voerde ze dan wel uit).
  const front = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const name = (JSON.parse(body) as Json).params?.name;
        const headers: Record<string, string> = {};
        for (const h of ['content-type', 'accept', 'authorization', 'mcp-session-id', 'mcp-protocol-version']) {
          const v = req.headers[h];
          if (typeof v === 'string') headers[h] = v;
        }
        const up = await fetch(bridge.url, { method: 'POST', headers, body });
        const text = await up.text();
        if (name === 'planner_add_tasks') {
          addPosts++;
          if (dropAdd) { dropAdd = false; res.destroy(); return; }
        }
        if (name === 'planner_get_project_info') {
          readPosts++;
          if (dropRead) { dropRead = false; res.destroy(); return; }
        }
        const out: Record<string, string> = {};
        for (const h of ['content-type', 'mcp-session-id']) {
          const v = up.headers.get(h);
          if (v) out[h] = v;
        }
        res.writeHead(up.status, out);
        res.end(text);
      })();
    });
  });
  await new Promise<void>((resolve) => front.listen(0, '127.0.0.1', () => resolve()));
  const before = app.store.getState().tasks.length;
  const s = await startWithApp((front.address() as AddressInfo).port);
  try {
    await toolNames(s);
    const lost = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-l', name: 'Antwoord kwijt', duration: 1 }] });
    assert(lost.isError, 'de client krijgt een fout');
    assertEq(lost.text, UNKNOWN_OUTCOME_MESSAGE, 'afloop onbekend, niet opnieuw gestuurd');
    assertEq(addPosts, 1, 'één tool-POST');
    assertEq(app.store.getState().tasks.length, before + 1, 'precies één taak in de app');
    const read = await call(s, 'planner_get_project_info');
    assert(!read.isError && projectName(read) === APP_PROJECT, `leesaanvraag opnieuw en geslaagd: ${read.text}`);
    assertEq(readPosts, 2, 'de leesaanvraag ging één keer opnieuw');
    const next = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-m', name: 'Daarna gewoon', duration: 1 }] });
    assert(!next.isError && next.structured.ok === true, `volgende wijziging: ${next.text}`);
    assertEq([addPosts, app.store.getState().tasks.length], [2, before + 2], 'één POST en één taak erbij');
    assert(s.stderr().includes('not sending it again'), `logregel:\n${s.stderr()}`);
  } finally {
    await s.client.close();
    await new Promise<void>((resolve) => front.close(() => resolve()));
    await bridge.close();
    while (app.store.getState().tasks.length > before) app.store.getState().undo();
  }
});

test('de headless planner stopt onverwacht: melding, en wijzigen pas na opnieuw openen', async () => {
  const root = newRoot();
  const s = await startExtension({ discovery: newDiscoveryDir(), root });
  try {
    await toolNames(s);
    const opened = await call(s, 'planner_import_schedule', { path: '~/plan.ifc' });
    assert(!opened.isError && opened.structured.ok === true, `bestand openen: ${opened.text}`);
    const pid = Number(/starting the planner without the app \(pid (\d+)\)/.exec(s.stderr())?.[1]);
    assert(Number.isInteger(pid) && pid > 0, `pid van het kindproces in de log:\n${s.stderr()}`);
    process.kill(pid, 'SIGKILL');
    await waitFor(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
    await sleep(100);
    const read = await call(s, 'planner_get_project_info');
    assertEq(read.texts[0], HEADLESS_RESTART_NOTE, 'melding na de herstart');
    const refused = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-k', name: 'Na de crash', duration: 1 }] });
    assertEq(refused.text, headlessLostMessage(root, 'the process ended'), 'wijziging geweigerd tot opnieuw openen');
    const again = await call(s, 'planner_import_schedule', { path: '~/plan.ifc' });
    assert(!again.isError && again.structured.ok === true, `opnieuw openen: ${again.text}`);
    const added = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-l', name: 'Na opnieuw openen', duration: 1 }] });
    assert(!added.isError && added.structured.ok === true, `wijziging na opnieuw openen: ${added.text}`);
  } finally {
    await s.client.close();
  }
});

// --- Met de app: sessies, herstarts en annuleren (zoals vóór #730, nu via runtime.json) ------------

test('app-herstart (sessie kwijt): leestool wordt herhaald, schrijftool niet', async () => {
  const s = await startWithApp(mirror.port);
  try {
    await toolNames(s); // de bundel leert welke tools alleen lezen
    const restart = async () => {
      const port = mirror.port;
      await mirror.close();
      mirror = await startMirror(port); // nieuwe sessietabel, zoals een herstarte app
    };
    await restart();
    const read = await call(s, 'planner_get_project_info');
    assert(!read.isError && read.structured.ok === true, `leestool na herstart: ${read.text}`);

    await restart();
    const before = app.store.getState().tasks.length;
    const args = { tasks: [{ tempId: 'tmp-mcpb', name: 'Via de bundel', duration: 1 }] };
    const refused = await call(s, 'planner_add_tasks', args);
    assert(refused.isError, 'schrijftool na sessieverlies hoort een fout te geven');
    assertEq(refused.text, SESSION_RESET_MESSAGE, 'heldere fout na sessieverlies');
    assertEq(app.store.getState().tasks.length, before, 'de wijziging is niet uitgevoerd');

    const blocked = await call(s, 'planner_add_tasks', args);
    assertEq(blocked.text, SESSION_RESET_MESSAGE, 'ook de volgende wijziging blijft geweigerd tot het plan gelezen is');
    assertEq(app.store.getState().tasks.length, before, 'ook die wijziging is niet uitgevoerd');
    const info = await call(s, 'planner_get_project_info');
    assert(!info.isError && info.structured.ok === true, `plan lezen: ${info.text}`);
    const stillBlocked = await call(s, 'planner_add_tasks', args);
    assertEq(stillBlocked.text, SESSION_RESET_MESSAGE, 'lezen alleen heft de blokkade niet op (review r2)');
    const chosen = await call(s, 'planner_switch_document', { documentId: app.store.getState().activeDocumentId });
    assert(!chosen.isError && chosen.structured.ok === true, `document kiezen: ${chosen.text}`);
    const again = await call(s, 'planner_add_tasks', args);
    assert(!again.isError && again.structured.ok === true, `schrijftool na de documentkeuze: ${again.text}`);
    assertEq(app.store.getState().tasks.length, before + 1, 'de herhaalde wijziging is één keer uitgevoerd');
    app.store.getState().undo();
  } finally {
    await s.client.close();
  }
});

test('nieuwe runtime.json (andere bridge) tijdens de sessie: nieuwe sessie, wijzigingen geblokkeerd tot een keuze', async () => {
  const discovery = newDiscoveryDir();
  writeRuntime(discovery, mirror.port);
  const s = await startExtension({ discovery });
  const other = await startMirror();
  const before = app.store.getState().tasks.length;
  try {
    await toolNames(s);
    writeRuntime(discovery, other.port); // de app herstartte de bridge op een andere poort
    const read = await call(s, 'planner_get_project_info');
    assert(!read.isError && read.structured.ok === true, `lezen bij de nieuwe bridge: ${read.text}`);
    const refused = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-n', name: 'Nieuwe bridge', duration: 1 }] });
    assertEq(refused.text, SESSION_RESET_MESSAGE, 'wijziging na een nieuwe bridge geweigerd');
    assertEq(app.store.getState().tasks.length, before, 'niets uitgevoerd');
    assert(s.stderr().includes(`port ${other.port}`), `logregel noemt de nieuwe poort:\n${s.stderr()}`);
  } finally {
    await s.client.close();
    await other.close();
  }
});

test('app-herstart met een ander plan actief, ontdekt door een ping: wachtende en volgende wijzigingen geweigerd (review r1, 1)', async () => {
  const s = await startWithApp(mirror.port);
  const docA = app.store.getState().activeDocumentId;
  let docB: string | null = null;
  try {
    await toolNames(s);
    const bind = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a', name: 'Op plan A', duration: 1 }] });
    assert(!bind.isError && bind.structured.ok === true, `sessie binden aan plan A: ${bind.text}`);

    // De app herstart; daarna is plan B actief. De oude sessie (met anker A) bestaat niet meer.
    const port = mirror.port;
    await mirror.close();
    docB = app.store.getState().newDocument();
    mirror = await startMirror(port);
    const tasksB = app.store.getState().tasks.length;

    // De ping ontdekt het sessieverlies; de wijziging staat er al achter in de wachtrij.
    const later = { tasks: [{ tempId: 'tmp-b', name: 'Hoort bij plan A', duration: 1 }] };
    const [, waiting] = await Promise.all([s.client.ping(), call(s, 'planner_add_tasks', later)]);
    assertEq(waiting.text, SESSION_RESET_MESSAGE, 'wachtende wijziging na een ping met 404');
    const next = await call(s, 'planner_add_tasks', later);
    assertEq(next.text, SESSION_RESET_MESSAGE, 'volgende wijziging na een ping met 404');
    assertEq(app.store.getState().activeDocumentId, docB, 'plan B is actief');
    assertEq(app.store.getState().tasks.length, tasksB, 'niets op plan B gezet');

    const chosen = await call(s, 'planner_switch_document', { documentId: docB });
    assert(!chosen.isError && chosen.structured.ok === true, `plan B kiezen: ${chosen.text}`);
    const allowed = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-c', name: 'Bewust op plan B', duration: 1 }] });
    assert(!allowed.isError && allowed.structured.ok === true, `wijziging na de documentkeuze: ${allowed.text}`);
    assertEq(app.store.getState().tasks.length, tasksB + 1, 'die ene wijziging staat op plan B');
  } finally {
    await s.client.close();
    if (docB !== null) app.store.getState().closeDocument(docB);
    if (app.store.getState().activeDocumentId !== docA) app.store.getState().switchDocument(docA);
  }
});

test('na sessieverlies: lezen heft niets op, expliciete documentkeuze wel; daarna houdt de drift-guard stand (review r2)', async () => {
  const s = await startWithApp(mirror.port);
  const docA = app.store.getState().activeDocumentId;
  const opened: string[] = [];
  const count = () => app.store.getState().tasks.length;
  const add = (name: string) => call(s, 'planner_add_tasks', { tasks: [{ tempId: `tmp-${name}`, name, duration: 1 }] });
  try {
    await toolNames(s);
    const bind = await add('Op plan A');
    assert(!bind.isError && bind.structured.ok === true, `sessie binden aan plan A: ${bind.text}`);

    // App-herstart met plan B actief.
    const port = mirror.port;
    await mirror.close();
    const docB = app.store.getState().newDocument();
    opened.push(docB);
    mirror = await startMirror(port);
    const tasksB = count();

    // (a) Een leesaanvraag ontdekt het verlies en wordt herhaald; de wijziging erachter wacht al.
    const [read, waiting] = await Promise.all([call(s, 'planner_get_project_info'), add('Hoort bij plan A')]);
    assert(!read.isError && read.structured.ok === true, `leesaanvraag na herstart: ${read.text}`);
    assertEq(waiting.text, SESSION_RESET_MESSAGE, '(a) wachtende wijziging na een herhaalde lezing');
    assertEq(count(), tasksB, '(a) niets op plan B');

    // (b) De gebruiker opent plan C; zonder documentkeuze blijft elke wijziging geweigerd.
    const docC = app.store.getState().newDocument();
    opened.push(docC);
    const tasksC = count();
    const onC = await add('Zonder keuze');
    assertEq(onC.text, SESSION_RESET_MESSAGE, '(b) wijziging na lezen en tabwissel');
    assertEq(count(), tasksC, '(b) niets op plan C');

    // (c) Expliciete keuze van plan B: de wijziging landt op B ...
    const chosen = await call(s, 'planner_switch_document', { documentId: docB });
    assert(!chosen.isError && chosen.structured.ok === true, `(c) plan B kiezen: ${chosen.text}`);
    assertEq(app.store.getState().activeDocumentId, docB, '(c) plan B is actief');
    assertEq(count(), tasksB, '(c) plan B is nog onaangeroerd');
    const onB = await add('Bewust op plan B');
    assert(!onB.isError && onB.structured.ok === true, `(c) wijziging op plan B: ${onB.text}`);
    assertEq(count(), tasksB + 1, '(c) één taak op plan B');

    // ... en wisselt de gebruiker daarna naar C, dan weigert de drift-guard van de app.
    app.store.getState().switchDocument(docC);
    const drift = await add('Na tabwissel');
    assert(drift.isError && drift.structured.code === 'DOC_DRIFT', `(c) drift-guard: ${drift.text}`);
    assertEq(count(), tasksC, '(c) niets op plan C');
  } finally {
    await s.client.close();
    for (const id of opened) app.store.getState().closeDocument(id);
    if (app.store.getState().activeDocumentId !== docA) app.store.getState().switchDocument(docA);
  }
});

test('sessieherstel via nieuw/import: alleen expliciet, alleen na succes en zonder herhaling (207)', async () => {
  const s = await startWithApp(mirror.port);
  const docA = app.store.getState().activeDocumentId;
  const beforeIds = new Set(app.store.getState().getOpenDocuments().map(d => d.id));
  const previousFs = fileToolDeps.getFs;
  const count = () => app.store.getState().getOpenDocuments().length;
  const add = () => call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-recovery', name: 'Na herstel', duration: 1 }] });
  const restart = async () => {
    const port = mirror.port;
    await mirror.close();
    mirror = await startMirror(port);
  };
  let reads = 0;
  fileToolDeps.getFs = async () => ({
    homeDir: async () => '/home/test',
    exists: async () => true,
    stat: async () => ({ isFile: true, dev: 1, ino: 1 }),
    writeTextFile: async () => { throw new Error('unexpected write'); },
    readFile: async () => { throw new Error('unexpected binary read'); },
    readTextFile: async (path) => {
      reads++;
      if (path.endsWith('/missing.csv')) throw new Error('missing fixture');
      return 'Name;Duration;Start;Finish\nImported;1;2015-01-05;2015-01-05';
    },
  });
  try {
    await toolNames(s);
    await restart();
    const before = count();
    const lostNew = await call(s, 'planner_new_document');
    assertEq(lostNew.text, SESSION_RESET_MESSAGE, 'nieuw dat sessieverlies ontdekt wordt niet herhaald');
    assertEq(count(), before, 'geen extra document bij de geweigerde aanvraag');
    const duplicate = await call(s, 'planner_duplicate_document');
    assertEq(duplicate.text, SESSION_RESET_MESSAGE, 'kopie van toevallig actief document blijft geblokkeerd');
    // Ook een echte toolfout mag de blokkade niet opheffen.
    app.store.getState().setUI({ aiReadOnly: true });
    const failedNew = await call(s, 'planner_new_document');
    assert(failedNew.isError, 'alleen-lezen weigert nieuw document');
    app.store.getState().setUI({ aiReadOnly: false });
    assertEq((await add()).text, SESSION_RESET_MESSAGE, 'mislukt nieuw heft blokkade niet op');
    const fresh = await call(s, 'planner_new_document');
    assert(!fresh.isError && fresh.structured.ok === true, `expliciet nieuw: ${fresh.text}`);
    assertEq(count(), before + 1, 'precies één nieuw document');
    assert((await add()).structured.ok === true, 'wijziging op expliciet nieuw document toegestaan');

    await restart();
    const lostImport = await call(s, 'planner_import_schedule', { path: '/home/test/plan.csv' });
    assertEq(lostImport.text, SESSION_RESET_MESSAGE, 'import die sessieverlies ontdekt wordt niet herhaald');
    assertEq(reads, 0, 'geen bestandslezing bij automatische herverbinding');
    const failedImport = await call(s, 'planner_import_schedule', { path: '/home/test/missing.csv' });
    assert(failedImport.isError && failedImport.structured.code === 'NOT_FOUND', 'werkelijke importfout doorgestuurd');
    assertEq((await add()).text, SESSION_RESET_MESSAGE, 'mislukte import heft blokkade niet op');
    const imported = await call(s, 'planner_import_schedule', { path: '/home/test/plan.csv' });
    assert(!imported.isError && imported.structured.ok === true, `expliciete import: ${imported.text}`);
    assertEq(reads, 2, 'elk expliciet importverzoek precies eenmaal gelezen');
    assert(app.store.getState().tasks.some(t => t.name === 'Imported'), 'echte CSV-parser en documentroute uitgevoerd');
    assert((await add()).structured.ok === true, 'wijziging op importdocument toegestaan');
    app.store.getState().switchDocument(docA);
    const drift = await add();
    assert(drift.isError && drift.structured.code === 'DOC_DRIFT', 'anker na import beschermt nog steeds tegen tabwissel');
  } finally {
    fileToolDeps.getFs = previousFs;
    app.store.getState().setUI({ aiReadOnly: false });
    await s.client.close();
    for (const d of app.store.getState().getOpenDocuments()) if (!beforeIds.has(d.id)) app.store.getState().closeDocument(d.id);
    if (app.store.getState().activeDocumentId !== docA) app.store.getState().switchDocument(docA);
  }
});

test('geannuleerde wijziging in de wachtrij gaat nooit naar de bridge (review r1, 2)', async () => {
  const bodies: string[] = [];
  let hold = false;
  let release = () => {};
  const gated = await startMirror(undefined, {
    handleMessage: async (body, ctx) => {
      bodies.push(body);
      if (hold && body.includes('planner_get_project_info')) await new Promise<void>((resolve) => { release = () => resolve(); });
      return handleMcpMessage(body, ctx);
    },
  });
  const s = await startWithApp(gated.port);
  try {
    await toolNames(s);
    const before = app.store.getState().tasks.length;
    hold = true;
    const slow = call(s, 'planner_get_project_info');
    await waitFor(() => bodies.some((b) => b.includes('planner_get_project_info')));
    assert(bodies.some((b) => b.includes('planner_get_project_info')), 'de trage leesaanvraag staat bij de bridge');

    const controller = new AbortController();
    const outcome = s.client.callTool(
      { name: 'planner_add_tasks', arguments: { tasks: [{ tempId: 'tmp-x', name: 'Geannuleerd', duration: 1 }] } },
      undefined,
      { signal: controller.signal },
    ).then(() => 'beantwoord', () => 'afgebroken');
    await sleep(200); // de wijziging staat nu in de wachtrij van de bundel
    controller.abort('de gebruiker stopt'); // de SDK stuurt notifications/cancelled
    await sleep(200);
    hold = false;
    release();
    const read = await slow;
    assert(!read.isError, `trage leesaanvraag: ${read.text}`);
    assertEq(await outcome, 'afgebroken', 'de client gaf de wijziging op');
    await toolNames(s); // komt pas na de geannuleerde aanvraag aan de beurt
    assert(!bodies.some((b) => b.includes('planner_add_tasks')), 'planner_add_tasks bereikte de bridge');
    assertEq(app.store.getState().tasks.length, before, 'geen taak toegevoegd');
  } finally {
    hold = false;
    release();
    await s.client.close();
    await gated.close();
  }
});

test('knownbugs 206/323: annuleren tijdens verbinden en na 404 voorkomt de tool-POST', async () => {
  const port = await freePort();
  const s = await startWithApp(port); // lokale initialize terwijl de bridge nog uit staat (geen werkmap)
  let release = () => {};
  let holding = false;
  const bodies: string[] = [];
  const handleMessage = async (body: string, ctx: McpContext) => {
    bodies.push(body);
    if (JSON.parse(body).method === 'initialize') {
      holding = true;
      await new Promise<void>(resolve => { release = resolve; });
    }
    return handleMcpMessage(body, ctx);
  };
  let late = await startMirror(port, { handleMessage });
  try {
    const before = app.store.getState().tasks.length;
    const controller = new AbortController();
    const outcome = s.client.callTool({ name: 'planner_add_tasks',
      arguments: { tasks: [{ tempId: 'tmp-cancel-reconnect', name: 'MAG NIET NA ANNULEREN', duration: 1 }] } },
    undefined, { signal: controller.signal }).then(() => 'beantwoord', () => 'afgebroken');
    await waitFor(() => holding);
    assert(holding, 'de aanvraag wacht daadwerkelijk op upstream initialize');
    controller.abort('annuleren tijdens opnieuw verbinden');
    assertEq(await outcome, 'afgebroken', 'SDK-client annuleert');
    await sleep(200); // laat de cancellation-notification de stdio-proxy bereiken
    release();
    await toolNames(s); // wacht achter aanvraag én annuleringsmelding in dezelfde proxywachtrij
    assert(!bodies.some(body => body.includes('planner_add_tasks')), 'geannuleerde tool is niet naar bridge gepost');
    assertEq(app.store.getState().tasks.length, before, 'geen taak toegevoegd na annuleren');
    const next = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-after-cancel', name: 'Na annuleren', duration: 1 }] });
    assert(!next.isError, `volgende aanvraag werkt: ${next.text}`);
    assertEq(app.store.getState().tasks.length, before + 1, 'volgende aanvraag precies eenmaal uitgevoerd');
    app.store.getState().undo();

    // Een app-herstart wist de sessie: de eerste lees-POST krijgt 404 en wacht daarna op initialize.
    await late.close();
    bodies.length = 0;
    holding = false;
    late = await startMirror(port, { handleMessage });
    const after404 = new AbortController();
    const cancelledRead = s.client.callTool({ name: 'planner_get_project_info' }, undefined,
      { signal: after404.signal }).then(() => 'beantwoord', () => 'afgebroken');
    await waitFor(() => holding);
    assert(holding, 'na sessieverlies wacht de leesaanvraag op een nieuwe initialize');
    after404.abort('annuleren na 404 tijdens opnieuw verbinden');
    assertEq(await cancelledRead, 'afgebroken', 'SDK-client annuleert de leesaanvraag na 404');
    await sleep(200); // de cancellation-notification bereikt de proxy terwijl initialize nog wacht
    release();
    await toolNames(s); // barrière achter aanvraag en annuleringsmelding
    assert(!bodies.some(body => body.includes('planner_get_project_info')), 'geannuleerde lezing niet herhaald na 404');
    assertEq(app.store.getState().tasks.length, before, 'geen taakwijziging tijdens sessieherstel');
    const read = await call(s, 'planner_get_project_info');
    assert(!read.isError && read.structured.ok === true, `volgende lezing werkt: ${read.text}`);
    assertEq(bodies.filter(body => body.includes('planner_get_project_info')).length, 1, 'alleen de volgende lezing uitgevoerd');
  } finally {
    release();
    await s.client.close();
    await late.close();
  }
});

// --- Geen van beide planners: de statustool ------------------------------------------------------

test('bridge Stop/Start zonder werkmap, sessie behouden: statustool en terug, elk met list_changed (review r1, 3)', async () => {
  const sessions = createMcpSessionTable();
  let bridge = await startMirror(undefined, { sessions });
  const port = bridge.port;
  const s = await startWithApp(port);
  try {
    assert((await toolNames(s)).includes('planner_get_project_info'), 'online: plannertools');
    assertEq(s.listChanged(), 0, 'nog geen list_changed');

    await bridge.close(); // Stop in de app (runtime.json blijft hier staan: de bundel moet het zelf merken)
    const off = await call(s, 'planner_get_project_info');
    assert(off.isError && off.text.startsWith(`Open Planner Studio does not answer on http://127.0.0.1:${port}/mcp`), `bridge gestopt: ${off.text}`);
    assert(off.text.includes('No working folder is set'), `de fout noemt de ontbrekende werkmap: ${off.text}`);
    await waitFor(() => s.listChanged() >= 1);
    assertEq(s.listChanged(), 1, 'list_changed bij de overgang naar de statustool');
    assertEq(await toolNames(s), [STATUS_TOOL_NAME], 'toollijst met de bridge gestopt');

    bridge = await startMirror(port, { sessions }); // Start in de app: dezelfde sessies
    const status = await call(s, STATUS_TOOL_NAME);
    assert(!status.isError && status.text.startsWith('Connected to the Open Planner Studio app'), `statustool: ${status.text}`);
    await waitFor(() => s.listChanged() >= 2);
    assertEq(s.listChanged(), 2, 'list_changed bij de overgang terug naar de plannertools');
    const names = await toolNames(s);
    assert(names.includes('planner_get_project_info') && !names.includes(STATUS_TOOL_NAME), `tools na Start: ${names.length}`);
    const before = app.store.getState().tasks.length;
    const write = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-s', name: 'Na Stop/Start', duration: 1 }] });
    assert(!write.isError && write.structured.ok === true, `sessie behouden, dus wijzigen mag: ${write.text}`);
    assertEq(app.store.getState().tasks.length, before + 1, 'één taak toegevoegd');
    assert(s.stderr().includes('is still valid; continuing'), `logregel van de hervatte sessie:\n${s.stderr()}`);
    app.store.getState().undo();
  } finally {
    await s.client.close();
    await bridge.close();
  }
});

test('geen app en geen werkmap: alleen de statustool met een heldere fout; daarna start de app', async () => {
  const discovery = newDiscoveryDir();
  const s = await startExtension({ discovery });
  try {
    assertEq(s.client.getServerVersion()?.name, 'open-planner-studio', 'lokale serverInfo');
    assertEq(await toolNames(s), [STATUS_TOOL_NAME], 'toollijst zonder planner');
    const res = await call(s, 'planner_get_project_info');
    assert(res.isError && res.text.startsWith('The Open Planner Studio desktop app is not running, or its MCP bridge is off.'),
      `geen app: ${res.text}`);
    assert(res.text.includes('No working folder is set') && res.text.includes('"Start bridge"'), `beide uitwegen: ${res.text}`);

    const late = await startMirror();
    writeRuntime(discovery, late.port);
    try {
      const status = await call(s, STATUS_TOOL_NAME);
      assert(!status.isError && status.text.startsWith('Connected to the Open Planner Studio app'), `statustool: ${status.text}`);
      await waitFor(() => s.listChanged() >= 1);
      assertEq(s.listChanged(), 1, 'notifications/tools/list_changed na verbinden');
      const names = await toolNames(s);
      assert(names.includes('planner_get_project_info') && !names.includes(STATUS_TOOL_NAME), `tools na verbinden: ${names.length}`);
      const read = await call(s, 'planner_get_project_info');
      assert(!read.isError && read.structured.ok === true, `leestool na verbinden: ${read.text}`);
    } finally {
      await late.close();
    }
  } finally {
    await s.client.close();
  }
});

test('werkmap bestaat niet en geen app: de statustool noemt de map', async () => {
  const missing = join(work, 'bestaat-niet');
  const s = await startExtension({ discovery: newDiscoveryDir(), root: missing });
  try {
    assertEq(await toolNames(s), [STATUS_TOOL_NAME], 'toollijst zonder planner');
    const status = await call(s, STATUS_TOOL_NAME);
    assert(status.isError && status.text.includes(`The working folder '${missing}' does not exist.`), `statustool: ${status.text}`);
    mkdirSync(missing);
    copyFileSync(EXAMPLE, join(missing, 'plan.ifc'));
    const ok = await call(s, STATUS_TOOL_NAME);
    assert(!ok.isError && ok.text.startsWith(`Connected to the planner without the app, in the working folder '${missing}'`), `statustool: ${ok.text}`);
    const opened = await call(s, 'planner_import_schedule', { path: '~/plan.ifc' });
    assert(!opened.isError && opened.structured.ok === true, `openen na het aanmaken van de map: ${opened.text}`);
    assert(existsSync(join(missing, 'plan.ifc')), 'het bestand staat er');
  } finally {
    await s.client.close();
  }
});

test('afsluiten', async () => {
  await mirror.close();
  rmSync(work, { recursive: true, force: true });
});

await run();
