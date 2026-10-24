// Claude Desktop-bundel (`.mcpb`): bouwt hem met `scripts/build-mcpb.mjs`, controleert de ZIP en het
// manifest, en laat de MEEGELEVERDE doorstuurserver (uit de ZIP gehaald) via stdio praten met de
// bridge-spiegel (`bridgeMirror.ts`) rond de echte TS-kant op een eigen headless store. De client is
// de officiële SDK-client; het stdio-transport hieronder start de server zoals Claude Desktop dat doet
// (`node server/index.mjs`). Niet de `StdioClientTransport` van de SDK: die sleept `cross-spawn` (CommonJS)
// mee, en dat laadt niet in de ESM-testbundel van `run.sh`.
//
// Wat dit NIET bewijst: dat Claude Desktop de bundel installeert en het installatievenster toont.
// De volledige schemacontrole van het manifest doet de officiële `mcpb validate` in
// `.github/workflows/mcpb.yml` en `release.yml`; hier staan de velden waar de stekker op leunt.
import { test, assert, assertEq, run } from './harness';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import { getTools } from '@/services/mcp/toolRegistry';
import { parseZipEntries } from '@/services/zip';
import { MCP_DEFAULT_PORT } from '@/utils/settingsStore';
import { startBridgeMirror, type BridgeMirror } from './bridgeMirror';
import { DEFAULT_BRIDGE_PORT, SESSION_RESET_MESSAGE, STATUS_TOOL_NAME } from '../../integrations/claude-desktop/src/proxy';
import { readProxyConfig } from '../../integrations/claude-desktop/src/config';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const appPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string; license: string };
const work = mkdtempSync(join(tmpdir(), 'ops-mcpb-'));
const outDir = join(work, 'out');
const serverFile = join(work, 'extracted', 'server', 'index.mjs');

type Json = Record<string, any>;
let manifest: Json = {};
let entries = new Map<string, Uint8Array>();

// --- De headless app achter de spiegel -----------------------------------------------------------

const app = createAppStoreContext();
app.store.getState().setProject({ name: 'Claude Desktop-bundel' });
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
          const timer = setTimeout(() => { child.kill(); resolve(); }, 2000);
          child.once('close', () => { clearTimeout(timer); resolve(); });
        });
      }
    },
  };
  return transport;
}

/** Start de meegeleverde server zoals Claude Desktop: `node server/index.mjs` met token en poort in env. */
async function startExtension(token: string, port: number): Promise<Session> {
  let log = '';
  const transport = stdioTransport(
    { PATH: process.env.PATH ?? '', OPS_MCP_TOKEN: token, OPS_MCP_PORT: String(port) },
    (text) => { log += text; },
  );
  const client = new Client({ name: 'ops-mcpb-test', version: '1.0.0' });
  let changes = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => { changes++; });
  await client.connect(transport);
  return { client, listChanged: () => changes, stderr: () => log };
}

interface ToolResult { isError: boolean; text: string; structured: Json }

async function call(session: Session, name: string, args: Json = {}): Promise<ToolResult> {
  const res = await session.client.callTool({ name, arguments: args }, undefined, { timeout: 30_000 });
  const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
  return {
    isError: res.isError === true,
    text: content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n'),
    structured: (res.structuredContent ?? {}) as Json,
  };
}

async function toolNames(session: Session): Promise<string[]> {
  return (await session.client.listTools()).tools.map((t) => t.name);
}

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
  assertEq([...entries.keys()].sort(), ['LICENSE', 'LICENSE.GPL', 'THIRD-PARTY-NOTICES.md', 'icon.png', 'manifest.json', 'server/index.mjs'], 'inhoud van de bundel');
  const server = entries.get('server/index.mjs') as Uint8Array;
  assert(server.length < 1024 * 1024, `server/index.mjs is ${server.length} bytes; verwacht onder 1 MB`);
  const png = entries.get('icon.png') as Uint8Array;
  assertEq([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'icon.png is een PNG');
  const notices = new TextDecoder().decode(entries.get('THIRD-PARTY-NOTICES.md'));
  assert(notices.includes('@modelcontextprotocol/sdk'), 'THIRD-PARTY-NOTICES.md noemt de SDK');
  mkdirSync(dirname(serverFile), { recursive: true });
  writeFileSync(serverFile, server);
  manifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json'))) as Json;
});

test('manifest.json: de velden waar de stekker op leunt', () => {
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
  assertEq(manifest.server?.mcp_config, {
    command: 'node',
    args: ['${__dirname}/server/index.mjs'],
    env: { OPS_MCP_TOKEN: '${user_config.token}', OPS_MCP_PORT: '${user_config.port}' },
  }, 'server.mcp_config');
  assertEq(manifest.user_config?.token?.type, 'string', 'token: type');
  assertEq(manifest.user_config?.token?.sensitive, true, 'token: sensitive');
  assertEq(manifest.user_config?.token?.required, true, 'token: required');
  assertEq(manifest.user_config?.port?.type, 'number', 'port: type');
  assertEq(manifest.user_config?.port?.default, MCP_DEFAULT_PORT, 'port: standaard = standaardpoort van de app');
  assertEq([manifest.user_config?.port?.min, manifest.user_config?.port?.max], [1, 65535], 'port: grenzen');
  assertEq(DEFAULT_BRIDGE_PORT, MCP_DEFAULT_PORT, 'standaardpoort van de doorstuurserver = die van de app');
});

test('instellingen: lege of letterlijke manifestvariabelen en een ongeldige poort', () => {
  assertEq(readProxyConfig({ OPS_MCP_TOKEN: ' abc ', OPS_MCP_PORT: '4000' }), { port: 4000, token: 'abc', notes: [] }, 'gewone waarden');
  assertEq(readProxyConfig({ OPS_MCP_TOKEN: '${user_config.token}', OPS_MCP_PORT: '${user_config.port}' }),
    { port: MCP_DEFAULT_PORT, token: '', notes: [] }, 'niet ingevuld');
  const bad = readProxyConfig({ OPS_MCP_TOKEN: 'x', OPS_MCP_PORT: '70000' });
  assertEq([bad.port, bad.notes.length], [MCP_DEFAULT_PORT, 1], 'poort buiten 1..65535');
});

// --- De doorstuurserver via stdio ----------------------------------------------------------------

let mirror: BridgeMirror;

test('via stdio: initialize, tools/list met de planner_-tools en één leestool', async () => {
  mirror = await startMirror();
  const s = await startExtension(TOKEN, mirror.port);
  try {
    assertEq(s.client.getServerVersion()?.name, MCP_SERVER_NAME, 'serverInfo komt van de bridge, niet van de bundel');
    assertEq(s.client.getInstructions(), MCP_INSTRUCTIONS, 'instructions van de bridge gaan ongewijzigd door');
    assertEq(s.client.getServerCapabilities()?.tools?.listChanged, true, 'listChanged ook bij een online initialize (review r1, 3)');
    const names = await toolNames(s);
    assertEq(names.length, getTools().length, 'aantal tools');
    assert(names.every((n) => n.startsWith('planner_')), `alleen planner_-tools: ${names.join(', ')}`);
    const res = await call(s, 'planner_get_project_info');
    assert(!res.isError && res.structured.ok === true, `leestool faalde: ${res.text}`);
  } finally {
    await s.client.close();
  }
});

test('app-herstart (sessie kwijt): leestool wordt herhaald, schrijftool niet', async () => {
  const s = await startExtension(TOKEN, mirror.port);
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

test('app-herstart met een ander plan actief, ontdekt door een ping: wachtende en volgende wijzigingen geweigerd (review r1, 1)', async () => {
  const s = await startExtension(TOKEN, mirror.port);
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

test('na sessieverlies: lezen heft niets op, alleen planner_switch_document; daarna houdt de drift-guard stand (review r2)', async () => {
  const s = await startExtension(TOKEN, mirror.port);
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
  const s = await startExtension(TOKEN, gated.port);
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

test('bridge Stop/Start met behouden sessie: statustool en terug, elk met list_changed (review r1, 3)', async () => {
  const sessions = createMcpSessionTable();
  let bridge = await startMirror(undefined, { sessions });
  const port = bridge.port;
  const s = await startExtension(TOKEN, port);
  try {
    assert((await toolNames(s)).includes('planner_get_project_info'), 'online: plannertools');
    assertEq(s.listChanged(), 0, 'nog geen list_changed');

    await bridge.close(); // Stop in de app
    const off = await call(s, 'planner_get_project_info');
    assert(off.isError && off.text.startsWith('Open Planner Studio is not running'), `bridge gestopt: ${off.text}`);
    await waitFor(() => s.listChanged() >= 1);
    assertEq(s.listChanged(), 1, 'list_changed bij de overgang naar de statustool');
    assertEq(await toolNames(s), [STATUS_TOOL_NAME], 'toollijst met de bridge gestopt');

    bridge = await startMirror(port, { sessions }); // Start in de app: dezelfde sessies
    const status = await call(s, STATUS_TOOL_NAME);
    assert(!status.isError && status.text.startsWith('Connected to Open Planner Studio'), `statustool: ${status.text}`);
    await waitFor(() => s.listChanged() >= 2);
    assertEq(s.listChanged(), 2, 'list_changed bij de overgang terug naar de plannertools');
    const names = await toolNames(s);
    assert(names.includes('planner_get_project_info') && !names.includes(STATUS_TOOL_NAME), `tools na Start: ${names.length}`);
    const before = app.store.getState().tasks.length;
    const write = await call(s, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-s', name: 'Na Stop/Start', duration: 1 }] });
    assert(!write.isError && write.structured.ok === true, `sessie behouden, dus wijzigen mag: ${write.text}`);
    assertEq(app.store.getState().tasks.length, before + 1, 'één taak toegevoegd');
    app.store.getState().undo();
  } finally {
    await s.client.close();
    await bridge.close();
  }
});

test('fout token: alleen de statustool, en een heldere fout', async () => {
  const s = await startExtension('d'.repeat(64), mirror.port);
  try {
    assertEq(s.client.getServerVersion()?.name, 'open-planner-studio', 'lokale serverInfo');
    assertEq(await toolNames(s), [STATUS_TOOL_NAME], 'toollijst zonder verbinding');
    const res = await call(s, 'planner_get_project_info');
    assert(res.isError, 'leestool hoort te falen');
    assert(res.text.startsWith('Open Planner Studio refused the token (HTTP 401).'), `fout token: ${res.text}`);
    const status = await call(s, STATUS_TOOL_NAME);
    assert(status.isError && status.text.includes('refused the token'), `statustool: ${status.text}`);
  } finally {
    await s.client.close();
  }
});

test('geen token ingevuld: een heldere fout', async () => {
  const s = await startExtension('', mirror.port);
  try {
    const res = await call(s, 'planner_get_project_info');
    assert(res.isError && res.text.startsWith('No token is set for Open Planner Studio.'), `geen token: ${res.text}`);
  } finally {
    await s.client.close();
  }
});

test('bridge uit: een heldere fout; daarna start de app en verschijnen de tools', async () => {
  const port = await freePort();
  const s = await startExtension(TOKEN, port);
  try {
    assertEq(await toolNames(s), [STATUS_TOOL_NAME], 'toollijst zonder app');
    const res = await call(s, 'planner_get_project_info');
    assert(res.isError, 'leestool hoort te falen');
    assert(res.text.startsWith('Open Planner Studio is not running or the MCP bridge is off'), `bridge uit: ${res.text}`);
    assert(res.text.includes(`127.0.0.1:${port}`), 'de fout noemt de poort');

    const late = await startMirror(port);
    try {
      const status = await call(s, STATUS_TOOL_NAME);
      assert(!status.isError && status.text.startsWith('Connected to Open Planner Studio'), `statustool: ${status.text}`);
      for (let i = 0; i < 50 && s.listChanged() === 0; i++) await new Promise((r) => setTimeout(r, 20));
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

test('afsluiten', async () => {
  await mirror.close();
  rmSync(work, { recursive: true, force: true });
});

await run();
