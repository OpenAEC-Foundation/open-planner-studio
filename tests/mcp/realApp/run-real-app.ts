// Externe-clienttest tegen de ECHTE app: een Tauri-dev-build met de echte Rust-bridge
// (`src-tauri/src/mcp_bridge.rs`). Dezelfde SDK-controles als `cases-externe-client.ts`
// (`externalClient.ts`); alleen de `probe` verschilt: die bedient de app via het ops-test-kanaal
// (`src/utils/devBridge.ts`, Tier 2 in `docs/self-test-harness.md`), zoals een gebruiker het
// AI-tabblad en Ctrl+Z zou bedienen.
//
// Start de app NIET zelf; dat doet `tests/mcp/realApp/run.sh` (xvfb + `npm run tauri:dev`).
// Geen cases-*.ts: `tests/mcp/run.sh` mag hem niet oppikken, want hij heeft een draaiende app nodig.
import { test, run, assert, assertEq } from '../harness';
import { readFileSync, writeFileSync, renameSync, existsSync, rmSync, readdirSync, statSync, mkdtempSync, copyFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROTOCOL_VERSION, MCP_INSTRUCTIONS, MCP_SERVER_NAME } from '@/services/mcp/dispatcher';
import { getTools } from '@/services/mcp/toolRegistry';
import { externalClientChecks, type AppProbe } from '../externalClient';
import { readOpenFilesFile, readRuntimeFile, MCP_DISCOVERY_DIR } from '@/services/mcp/discoveryContract';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { switchToHeadlessNote } from '../../../integrations/claude-desktop/src/proxy';

const OPS_DIR = process.env.OPS_TEST_DIR ?? join(homedir(), '.local/share/org.openaec.planner/ops-test');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP_VERSION = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

/** Eén opdracht over het ops-test-kanaal: atomisch `cmd.json` schrijven, wachten op `res.json` met hetzelfde id. */
async function ops(op: string, args?: Record<string, unknown>): Promise<any> {
  const id = `mcp-real-${++seq}`;
  const resPath = join(OPS_DIR, 'res.json');
  rmSync(resPath, { force: true });
  writeFileSync(join(OPS_DIR, 'cmd.tmp'), JSON.stringify({ id, op, args }));
  renameSync(join(OPS_DIR, 'cmd.tmp'), join(OPS_DIR, 'cmd.json'));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (existsSync(resPath)) {
      try {
        const res = JSON.parse(readFileSync(resPath, 'utf8')) as { id?: string; ok?: boolean; error?: string; result?: unknown };
        if (res.id === id) {
          if (!res.ok) throw new Error(`ops ${op} mislukt: ${res.error}`);
          return res.result;
        }
      } catch (error) {
        if (error instanceof SyntaxError) { /* half geschreven; opnieuw lezen */ } else throw error;
      }
    }
    await sleep(100);
  }
  throw new Error(`ops ${op}: geen antwoord binnen 30 s`);
}

const probe: AppProbe = {
  taskCount: async () => ((await ops('getState')) as { tasks: number }).tasks,
  undo: async () => { await ops('dispatch', { action: 'undo', args: [] }); },
  setSafety: async (flags) => { await ops('dispatch', { action: 'setUI', args: [flags] }); },
  newDocument: async () => ((await ops('dispatch', { action: 'newDocument', args: [] })) as { ret: string }).ret,
  closeDocument: async (id) => { await ops('dispatch', { action: 'closeDocument', args: [id] }); },
  switchDocument: async (id) => { await ops('dispatch', { action: 'switchDocument', args: [id] }); },
  restartBridge: async () => {
    await ops('mcpRestart');
    await waitLive();
  },
};

/** Wacht tot de bridge `live` meldt; gooit bij `port-busy`/`error` of na 30 s. */
async function waitLive(): Promise<{ port: number; token: string | null; status: { state: string; message?: string } }> {
  let last: { port: number; token: string | null; status: { state: string; message?: string } } | null = null;
  for (let i = 0; i < 100; i++) {
    last = await ops('mcpConnection');
    if (last!.status.state === 'live' && last!.token) return last!;
    if (last!.status.state === 'port-busy' || last!.status.state === 'error') {
      throw new Error(`bridge start mislukt: ${JSON.stringify(last!.status)}`);
    }
    await sleep(300);
  }
  throw new Error(`bridge niet live: ${JSON.stringify(last)}`);
}

// AI-modus + automatisch starten aan, zoals de gebruiker in Instellingen doet; `useAiAutostart`
// start de bridge daarop. Daarna wachten tot de Rust-bridge "running" meldt (status `live`).
await ops('ping');
// Een verse app opent het welkomstvenster; zolang dat open is, weigert de bridge elke tool met
// DIALOG_OPEN (bewust, zie de gids). Sluit het zoals de gebruiker het wegklikt.
await ops('dispatch', {
  action: 'setUI',
  args: [{ welcomePending: false, showWelcomeDialog: false, showTourOverlay: false, showTutorialOffer: false }],
});
await ops('dispatch', { action: 'setUI', args: [{ aiMode: true, aiAutostart: true }] });
const conn = await waitLive();
console.log(`bridge live op 127.0.0.1:${conn.port} (app ${APP_VERSION})`);

const checks = externalClientChecks({
  url: `http://127.0.0.1:${conn.port}/mcp`,
  token: conn.token!,
  probe,
  expected: {
    name: MCP_SERVER_NAME,
    version: APP_VERSION,
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    instructions: MCP_INSTRUCTIONS,
    tools: getTools().map((t) => ({ name: t.name, annotations: t.annotations })),
  },
});
for (const check of checks) test(`echte app: ${check.name}`, check.fn);

// Ontdekkingsbestanden voor de MCP-plugin (issue #570, `docs/mcp-ontdekking.md`). De dev-build schrijft
// ze met de worktree-slug in de naam (`runtime.<slug>.json`); daarom zoeken we op voorvoegsel.
const MCP_DIR = join(dirname(OPS_DIR), MCP_DISCOVERY_DIR);
function discoveryFile(prefix: 'runtime' | 'open-files'): string | null {
  if (!existsSync(MCP_DIR)) return null;
  const names = readdirSync(MCP_DIR).filter((n) => n.startsWith(`${prefix}.`) && n.endsWith('.json'));
  if (names.length > 1) throw new Error(`meer dan één ${prefix}-bestand: ${names.join(', ')}`);
  return names.length ? join(MCP_DIR, names[0]) : null;
}
function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
/** Wacht tot `check` slaagt (de app schrijft via een wachtrij, dus heel even later). */
async function eventually(what: string, check: () => void): Promise<void> {
  let last: unknown = null;
  for (let i = 0; i < 50; i++) {
    try { check(); return; } catch (error) { last = error; }
    await sleep(200);
  }
  throw new Error(`${what}: ${last instanceof Error ? last.message : String(last)}`);
}

test('echte app: runtime.json beschrijft de draaiende bridge (poort, token, pid, versie, 0600)', async () => {
  const live = await waitLive();
  await eventually('runtime.json', () => {
    const path = discoveryFile('runtime');
    assert(path, `geen runtime-bestand in ${MCP_DIR}`);
    const read = readRuntimeFile(readFileSync(path!, 'utf8'));
    assert(read.status === 'valid', `runtime-bestand niet geldig volgens het contract: ${JSON.stringify(read)}`);
    const file = read.status === 'valid' ? read.file : null;
    assertEq([file!.port, file!.token, file!.appVersion], [live.port, live.token, APP_VERSION], 'poort, token en versie');
    assert(pidAlive(file!.pid), `pid ${file!.pid} leeft niet`);
    assertEq(statSync(path!).mode & 0o777, 0o600, 'rechten 0600');
  });
});

test('echte app: open-files.json bestaat met hetzelfde pid en 0600', async () => {
  await eventually('open-files.json', () => {
    const path = discoveryFile('open-files');
    assert(path, `geen register in ${MCP_DIR}`);
    const read = readOpenFilesFile(readFileSync(path!, 'utf8'));
    assert(read.status === 'valid', `register niet geldig volgens het contract: ${JSON.stringify(read)}`);
    const file = read.status === 'valid' ? read.file : null;
    assert(pidAlive(file!.pid), `pid ${file!.pid} leeft niet`);
    // Twee levende processen zijn niet noodzakelijk dezelfde app (knownbug 212).
    const runtimePath = discoveryFile('runtime');
    assert(runtimePath, `geen runtime-bestand in ${MCP_DIR}`);
    const runtime = readRuntimeFile(readFileSync(runtimePath!, 'utf8'));
    assert(runtime.status === 'valid', 'runtime-bestand niet geldig voor de pid-vergelijking');
    const runtimeFile = runtime.status === 'valid' ? runtime.file : null;
    assertEq(file!.pid, runtimeFile!.pid, 'open-files en runtime horen bij hetzelfde proces');
    assertEq(file!.appVersion, APP_VERSION, 'versie');
    assertEq(statSync(path!).mode & 0o777, 0o600, 'rechten 0600');
  });
});

/** Tekst van een tool-antwoord van de bundel. */
async function bundleCall(client: Client, name: string): Promise<{ isError: boolean; texts: string[] }> {
  const res = await client.callTool({ name, arguments: {} }, undefined, { timeout: 60_000 });
  const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
  return { isError: res.isError === true, texts: content.filter((c) => c.type === 'text').map((c) => c.text ?? '') };
}

// De Claude Desktop-bundel (#730, gebouwd door run.sh in `OPS_MCPB_SERVER`) tegen de echte bridge: eerst via de app,
// en na het stoppen van de bridge zonder app, in dezelfde sessie. Daarna dezelfde controles op de ontdekkingsbestanden.
test('echte app: de Claude Desktop-bundel gaat via de bridge, en na stoppen ervan zonder app; runtime.json weg, register blijft', async () => {
  const server = process.env.OPS_MCPB_SERVER;
  assert(server && existsSync(server), `geen gebouwde bundel in OPS_MCPB_SERVER (${server})`);
  const runtimePath = discoveryFile('runtime');
  assert(runtimePath, `geen runtime-bestand in ${MCP_DIR}`);
  // De dev-build schrijft `runtime.<slug>.json`; de bundel zoekt dat bestand met dezelfde slug.
  const slug = basename(runtimePath!).slice('runtime.'.length, -'.json'.length);
  const root = mkdtempSync(join(tmpdir(), 'ops-mcpb-root-'));
  copyFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), join(root, 'plan.ifc'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server!],
    env: {
      PATH: process.env.PATH ?? '', OPS_MCP_DISCOVERY_DIR: MCP_DIR, OPS_MCP_DEV_INSTANCE: slug, OPS_MCP_ROOT: root,
      OPS_MCP_DATA_DIR: mkdtempSync(join(tmpdir(), 'ops-mcpb-data-')),
    },
    stderr: 'pipe',
  });
  let log = '';
  transport.stderr?.on('data', (chunk: Buffer) => { log += chunk.toString('utf8'); });
  const client = new Client({ name: 'ops-mcpb-real-app', version: '1.0.0' });
  await client.connect(transport);
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    assertEq(tools.length, getTools().length, `toollijst via de bundel: ${tools.join(', ')}`);
    const viaApp = await bundleCall(client, 'planner_get_project_info');
    assert(!viaApp.isError, `leestool via de app: ${viaApp.texts.join('\n')}`);
    assert(log.includes('found the app'), `logregel van de bundel bij de app:\n${log}`);

    await ops('mcpStop');
    await eventually('runtime.json weg', () => {
      assertEq(discoveryFile('runtime'), null, 'runtime-bestand na stop');
      assert(discoveryFile('open-files'), 'register blijft staan zolang de app draait');
    });
    const withoutApp = await bundleCall(client, 'planner_get_project_info');
    assertEq(withoutApp.texts[0], switchToHeadlessNote(root), 'melding van de wissel naar zonder app');
    assert(!withoutApp.isError, `leestool zonder app: ${withoutApp.texts.join('\n')}`);
    assert(log.includes('switched to working without the app') && log.includes('starting the planner without the app'),
      `logregels van de wissel:\n${log}`);
  } finally {
    await client.close();
    console.log(`logregels van de bundel:\n${log}`);
  }
});

await run();
