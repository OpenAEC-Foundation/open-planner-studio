// De controles met de OFFICIËLE MCP-client (`@modelcontextprotocol/sdk`: `Client` +
// `StreamableHTTPClientTransport`) tegen een draaiende bridge. Gedeeld door twee routes:
//   - `cases-externe-client.ts`: tegen `bridgeMirror.ts` (Node-host die het Rust-contract spiegelt)
//     rond de echte TS-kant op een eigen headless storecontext — draait in `npm test`;
//   - `realApp/run-real-app.ts`: tegen de ECHTE Rust-bridge in een Tauri-dev-build (aparte workflow
//     `.github/workflows/mcp-real-app.yml`), waar `probe` via het ops-test-kanaal de app bedient.
//
// Bewust zonder store-import: de route bepaalt via `probe` hoe hij de app bekijkt en bedient.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** Hoe een route de app bekijkt en bedient, buiten MCP om (zoals een gebruiker in de app zou doen). */
export interface AppProbe {
  taskCount(): Promise<number>;
  /** Eén keer Ctrl+Z (store-actie `undo`). */
  undo(): Promise<void>;
  /** Zet de veiligheidsvlaggen die de gebruiker op het AI-tabblad zet. */
  setSafety(flags: { aiPaused?: boolean; aiReadOnly?: boolean }): Promise<void>;
  /** Nieuw document (tabblad) openen; wordt actief. Geeft het id. */
  newDocument(): Promise<string>;
  /** Een open document sluiten. */
  closeDocument(id: string): Promise<void>;
  /** Naar een open document wisselen. */
  switchDocument(id: string): Promise<void>;
  /** De bridge stoppen en weer starten (zoals Stop/Start op het AI-tabblad). */
  restartBridge(): Promise<void>;
}

export interface ExpectedServer {
  name: string;
  version: string;
  protocolVersion: string;
  instructions: string;
  /** Naam + annotaties per tool, zoals de registry ze in de code draagt. */
  tools: Array<{ name: string; annotations: unknown }>;
}

export interface ExternalClientEnv {
  url: string;
  token: string;
  probe: AppProbe;
  expected: ExpectedServer;
}

export interface ClientCheck {
  name: string;
  fn: () => Promise<void>;
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertSame(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  kreeg:    ${a}`);
}

const CLIENT_INFO = { name: 'ops-externe-client-test', version: '1.0.0' };

/** Een SDK-client met de gegeven extra headers; `connect` doet initialize + notifications/initialized. */
export async function connectClient(
  url: string,
  headers: Record<string, string>,
): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });
  const client = new Client(CLIENT_INFO);
  await client.connect(transport);
  return { client, transport };
}

/** Verwacht dat `connect` faalt met precies deze HTTP-status. */
async function expectConnectStatus(url: string, headers: Record<string, string>, status: number): Promise<void> {
  let caught: unknown = null;
  try {
    const { client } = await connectClient(url, headers);
    await client.close();
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof StreamableHTTPError, `verwacht een StreamableHTTPError (${status}), kreeg: ${String(caught)}`);
  assertSame((caught as StreamableHTTPError).code, status, 'HTTP-status van de geweigerde verbinding');
}

interface ToolOutcome {
  isError: boolean;
  structured: { ok?: boolean; code?: string; envelope?: { activeDocumentId?: string }; [k: string]: unknown };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  let res: Awaited<ReturnType<Client['callTool']>>;
  try {
    // 30 s i.p.v. de SDK-standaard (60 s): een hangend request moet de run snel en herkenbaar laten falen.
    res = await client.callTool({ name, arguments: args }, undefined, { timeout: 30_000 });
  } catch (error) {
    const first = (args as { tasks?: Array<{ name?: string }> }).tasks?.[0]?.name;
    throw new Error(`${name}${first ? ` (${first})` : ''}: ${String(error)}`);
  }
  return {
    isError: res.isError === true,
    structured: (res.structuredContent ?? {}) as ToolOutcome['structured'],
  };
}

/** Een kale JSON-RPC-POST (buiten de SDK om), met of zonder sessie-header. */
async function rawPost(url: string, headers: Record<string, string>, message: unknown): Promise<Response> {
  return await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(message),
  });
}

const TWO_TASKS = {
  tasks: [
    { tempId: 'tmp-a', name: 'Externe client A', duration: 2 },
    { tempId: 'tmp-b', name: 'Externe client B', duration: 3 },
  ],
};

/**
 * De controles, in volgorde; ze delen één verbonden client. `extra` mag per stap een route-eigen
 * controle toevoegen (bijv. het aantal undo-events of backup-aanroepen in de headless store).
 */
export function externalClientChecks(
  env: ExternalClientEnv,
  extra: {
    afterWrite?: () => Promise<void> | void;
    afterBatch?: () => Promise<void> | void;
    beforeMutation?: () => Promise<void> | void;
    /** Direct na elke geweigerde mutatie: de route toetst dat er niets veranderde sinds `beforeMutation`. */
    afterRefusal?: (label: string) => Promise<void> | void;
  } = {},
): ClientCheck[] {
  const auth = { Authorization: `Bearer ${env.token}` };
  let client: Client;
  let transport: StreamableHTTPClientTransport;

  return [
    {
      name: 'HTTP: notificatie krijgt 202 zonder body, requests blijven 200 JSON (knownbug 137)',
      fn: async () => {
        // De SDK accepteerde ook 200 met een lege body. Toets het HTTP-contract daarom rechtstreeks:
        // https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#sending-messages-to-the-server
        const initialized = await rawPost(env.url, auth, {
          jsonrpc: '2.0', id: 'http-initialize', method: 'initialize',
          params: { protocolVersion: env.expected.protocolVersion, capabilities: {}, clientInfo: CLIENT_INFO },
        });
        assertSame(initialized.status, 200, 'initialize blijft HTTP 200');
        assertSame(initialized.headers.get('content-type'), 'application/json', 'initialize blijft JSON');
        const sessionId = initialized.headers.get('mcp-session-id');
        assert(sessionId, 'initialize geeft een sessie-header');
        const initBody = (await initialized.json()) as { id?: unknown; result?: { protocolVersion?: string } };
        assertSame(initBody.id, 'http-initialize', 'initialize behoudt het request-id');
        assertSame(initBody.result?.protocolVersion, env.expected.protocolVersion, 'protocolversie in de JSON-body');
        const headers = { ...auth, 'Mcp-Session-Id': sessionId!, 'MCP-Protocol-Version': env.expected.protocolVersion };
        const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
        const accepted = await rawPost(env.url, headers, notification);
        assertSame(accepted.status, 202, 'geaccepteerde notificatie krijgt HTTP 202');
        assertSame(accepted.statusText, 'Accepted', 'redenzin bij HTTP 202');
        assertSame(accepted.headers.get('content-type'), null, 'geen Content-Type bij een notificatie');
        assertSame(accepted.headers.get('connection'), 'close', 'ook een notificatie sluit de verbinding');
        assertSame(await accepted.text(), '', 'geen body bij een notificatie');

        const ping = await rawPost(env.url, headers, { jsonrpc: '2.0', id: 0, method: 'ping' });
        assertSame(ping.status, 200, 'request met id 0 blijft HTTP 200');
        assertSame(ping.headers.get('content-type'), 'application/json', 'ping blijft JSON');
        assertSame(ping.headers.get('connection'), 'close', 'ook een request sluit de verbinding');
        assertSame(await ping.json(), { jsonrpc: '2.0', id: 0, result: {} }, 'ping behoudt zijn JSON-RPC-body');

        const error = await rawPost(env.url, headers, { jsonrpc: '2.0', id: 'http-error', method: 'onbekend' });
        assertSame(error.status, 200, 'JSON-RPC-fout blijft HTTP 200');
        assertSame(error.headers.get('content-type'), 'application/json', 'JSON-RPC-fout blijft JSON');
        const errorBody = (await error.json()) as { id?: unknown; error?: { code?: number } };
        assertSame([errorBody.id, errorBody.error?.code], ['http-error', -32601], 'JSON-RPC-fout behoudt id en code');

        // Een lege foutbody (404) mag niet door het nieuwe 202-pad worden geaccepteerd.
        const unknown = await rawPost(env.url, { ...headers, 'Mcp-Session-Id': 'onbekende-sessie' }, notification);
        assertSame(unknown.status, 404, 'notificatie met onbekende sessie blijft 404');
        assertSame(unknown.headers.get('content-type'), null, 'geen Content-Type bij 404');
        assertSame(await unknown.text(), '', 'geen body bij 404');
        const bare = await rawPost(env.url, auth, notification);
        assertSame(bare.status, 400, 'notificatie zonder sessie-header blijft 400');
        assertSame(bare.headers.get('content-type'), 'application/json', 'sessiefout blijft JSON');
        const bareBody = (await bare.json()) as { id?: unknown; error?: { code?: number } };
        assertSame([bareBody.id, bareBody.error?.code], [null, -32600], 'JSON-RPC-fout bij ontbrekende sessie');
      },
    },
    {
      name: 'initialize: protocolversie, serverInfo, capabilities, instructions en Mcp-Session-Id',
      fn: async () => {
        ({ client, transport } = await connectClient(env.url, auth));
        assert(typeof transport.sessionId === 'string' && transport.sessionId.length > 0,
          'de server hoort na initialize een Mcp-Session-Id te geven');
        assertSame(transport.protocolVersion, env.expected.protocolVersion, 'onderhandelde protocolversie');
        assertSame(client.getServerVersion(), { name: env.expected.name, version: env.expected.version }, 'serverInfo');
        assertSame(client.getServerCapabilities(), { tools: {} }, 'capabilities: alleen tools (geen resources/prompts)');
        assertSame(client.getInstructions(), env.expected.instructions, 'instructions');
        await client.ping();
      },
    },
    {
      name: 'tools/list: alle tools met de annotaties uit de code',
      fn: async () => {
        const { tools, nextCursor } = await client.listTools();
        assert(nextCursor === undefined, 'tools/list hoort in één pagina te komen');
        assertSame(tools.length, env.expected.tools.length, 'aantal tools');
        const byName = new Map(tools.map((t) => [t.name, t]));
        for (const exp of env.expected.tools) {
          const got = byName.get(exp.name);
          assert(got, `tool ontbreekt in tools/list: ${exp.name}`);
          assertSame(got!.annotations, exp.annotations, `annotaties van ${exp.name}`);
          assert(got!.inputSchema && got!.inputSchema.type === 'object', `inputSchema van ${exp.name}`);
        }
      },
    },
    {
      name: 'leestool planner_get_project_info',
      fn: async () => {
        const res = await callTool(client, 'planner_get_project_info', {});
        assert(!res.isError && res.structured.ok === true, `leestool faalde: ${JSON.stringify(res.structured)}`);
      },
    },
    {
      name: 'schrijftool planner_add_tasks is met één undo terug te draaien',
      fn: async () => {
        await extra.beforeMutation?.();
        const before = await env.probe.taskCount();
        const res = await callTool(client, 'planner_add_tasks', TWO_TASKS);
        assert(!res.isError && res.structured.ok === true, `add_tasks faalde: ${JSON.stringify(res.structured)}`);
        assertSame(await env.probe.taskCount(), before + 2, 'taken na add_tasks');
        await extra.afterWrite?.();
        await env.probe.undo();
        assertSame(await env.probe.taskCount(), before, 'taken na één undo');
      },
    },
    {
      name: 'planner_batch (add_tasks + update_tasks) is één undo-stap',
      fn: async () => {
        await extra.beforeMutation?.();
        const before = await env.probe.taskCount();
        const res = await callTool(client, 'planner_batch', {
          steps: [
            { tool: 'planner_add_tasks', args: TWO_TASKS },
            { tool: 'planner_update_tasks', args: { updates: [{ id: 'tmp-a', fields: { name: 'Externe client A2' } }] } },
          ],
        });
        assert(!res.isError && res.structured.ok === true, `batch faalde: ${JSON.stringify(res.structured)}`);
        assertSame(await env.probe.taskCount(), before + 2, 'taken na batch');
        await extra.afterBatch?.();
        await env.probe.undo();
        assertSame(await env.probe.taskCount(), before, 'taken na één undo van de batch');
      },
    },
    {
      name: 'aiReadOnly: schrijftool geweigerd (READ_ONLY), leestool werkt',
      fn: async () => {
        await extra.beforeMutation?.();
        await env.probe.setSafety({ aiReadOnly: true });
        try {
          const before = await env.probe.taskCount();
          const res = await callTool(client, 'planner_add_tasks', TWO_TASKS);
          assert(res.isError, 'add_tasks hoort isError te geven in alleen-lezen');
          assertSame(res.structured.code, 'READ_ONLY', 'foutcode');
          assertSame(await env.probe.taskCount(), before, 'geen taken bij weigering');
          await extra.afterRefusal?.('READ_ONLY');
          const read = await callTool(client, 'planner_get_project_info', {});
          assert(!read.isError, 'leestool hoort te werken in alleen-lezen');
        } finally {
          await env.probe.setSafety({ aiReadOnly: false });
        }
      },
    },
    {
      name: 'aiPaused: schrijftool geweigerd (PAUSED)',
      fn: async () => {
        await extra.beforeMutation?.();
        await env.probe.setSafety({ aiPaused: true });
        try {
          const before = await env.probe.taskCount();
          const res = await callTool(client, 'planner_add_tasks', TWO_TASKS);
          assert(res.isError, 'add_tasks hoort isError te geven bij pauze');
          assertSame(res.structured.code, 'PAUSED', 'foutcode');
          assertSame(await env.probe.taskCount(), before, 'geen taken bij weigering');
          await extra.afterRefusal?.('PAUSED');
        } finally {
          await env.probe.setSafety({ aiPaused: false });
        }
        await client.close();
      },
    },
    {
      name: 'twee clients: een initialize van B wist het documentanker van A niet (review PR #439)',
      fn: async () => {
        const a = await connectClient(env.url, auth);
        let docB: string | null = null;
        let docA: string | null = null;
        try {
          const before = await env.probe.taskCount();
          const first = await callTool(a.client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a1', name: 'Sessie A', duration: 1 }] });
          assert(!first.isError, `A: eerste mutatie faalde: ${JSON.stringify(first.structured)}`);
          docA = first.structured.envelope?.activeDocumentId ?? null;
          assert(docA, 'A: envelop zonder activeDocumentId');
          assertSame(await env.probe.taskCount(), before + 1, 'taken in het eerste document na A');

          docB = await env.probe.newDocument();
          assert(docB !== docA, 'nieuw document hoort een ander id te hebben');
          const drift = await callTool(a.client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a2', name: 'Sessie A drift', duration: 1 }] });
          assertSame(drift.structured.code, 'DOC_DRIFT', 'A na tabwissel');

          // Review 3: meer nieuwe sessies dan de tabel kan houden verdringen A niet (A heeft een anker).
          for (let i = 0; i < 40; i++) {
            try {
              const extra = await connectClient(env.url, auth);
              await extra.client.close();
            } catch (error) {
              throw new Error(`extra sessie ${i + 1} van 40: ${String(error)}`);
            }
          }
          const afterFlood = await callTool(a.client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a5', name: 'Sessie A na 40 sessies', duration: 1 }] });
          assertSame(afterFlood.structured.code, 'DOC_DRIFT', 'A na 40 nieuwe sessies: geen 404, nog steeds DOC_DRIFT');

          // Review 3: een bridge-herstart behoudt de sessie van A en haar anker.
          try {
            await env.probe.restartBridge();
          } catch (error) {
            throw new Error(`bridge-herstart: ${String(error)}`);
          }
          const afterRestart = await callTool(a.client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a6', name: 'Sessie A na herstart', duration: 1 }] });
          assertSame(afterRestart.structured.code, 'DOC_DRIFT', 'A na bridge-herstart: nog steeds DOC_DRIFT');
          assertSame(await env.probe.taskCount(), 0, 'niets van A in het tweede document');

          // B begint een sessie (de route uit de review) en doet nog niets anders.
          const b = await connectClient(env.url, auth);
          try {
            assert(b.transport.sessionId && b.transport.sessionId !== a.transport.sessionId,
              'B hoort een eigen sessie-id te krijgen');
            const again = await callTool(a.client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a3', name: 'Sessie A na B', duration: 1 }] });
            assertSame(again.structured.code, 'DOC_DRIFT', 'A na initialize van B: anker van A hoort te blijven');

            // Review 2: een initialize ZONDER id (notificatie) maakt geen sessie en raakt het anker van A niet.
            const bareInit = await rawPost(env.url, auth, { jsonrpc: '2.0', method: 'initialize', params: {} });
            assert(bareInit.headers.get('mcp-session-id') === null, 'initialize zonder id hoort geen sessie te geven');
            const stillDrift = await callTool(a.client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-a4', name: 'Sessie A na kale init', duration: 1 }] });
            assertSame(stillDrift.structured.code, 'DOC_DRIFT', 'A na initialize zonder id: anker blijft');

            // Review 2: dezelfde mutatie zonder sessie-header (een client die de header weglaat, of een
            // headerloze client) wordt geweigerd met 400 en landt nergens.
            const addCall = {
              jsonrpc: '2.0', id: 77, method: 'tools/call',
              params: { name: 'planner_add_tasks', arguments: { tasks: [{ tempId: 'tmp-x', name: 'Zonder sessie', duration: 1 }] } },
            };
            const noHeader = await rawPost(env.url, auth, addCall);
            assertSame(noHeader.status, 400, 'mutatie zonder sessie-header');
            const noHeaderBody = (await noHeader.json()) as { id?: unknown; error?: { code?: number } };
            assertSame([noHeaderBody.id, noHeaderBody.error?.code], [77, -32600], 'JSON-RPC-fout bij 400');
            const withHeader = await rawPost(env.url, { ...auth, 'Mcp-Session-Id': a.transport.sessionId! }, addCall);
            assertSame(withHeader.status, 200, 'dezelfde mutatie mét de sessie van A komt door de transportlaag');
            const withHeaderBody = (await withHeader.json()) as { result?: { structuredContent?: { code?: string } } };
            assertSame(withHeaderBody.result?.structuredContent?.code, 'DOC_DRIFT', 'en krijgt DOC_DRIFT');
            assertSame(await env.probe.taskCount(), 0, 'niets van A of zonder sessie in het tweede document');

            const fromB = await callTool(b.client, 'planner_add_tasks', { tasks: [{ tempId: 'tmp-b1', name: 'Sessie B', duration: 1 }] });
            assert(!fromB.isError, `B: mutatie faalde: ${JSON.stringify(fromB.structured)}`);
            assertSame(fromB.structured.envelope?.activeDocumentId, docB, 'B werkt in het actieve (tweede) document');
            assertSame(await env.probe.taskCount(), 1, 'taak van B in het tweede document');
          } finally {
            await b.client.close();
          }
        } finally {
          await a.client.close();
          if (docB) await env.probe.closeDocument(docB);
          if (docA) await env.probe.switchDocument(docA);
        }
        // Opruimen: de taak van A in het eerste document is één undo-stap.
        const withA = await env.probe.taskCount();
        await env.probe.undo();
        assertSame(await env.probe.taskCount(), withA - 1, 'taak van A met één undo weg');
      },
    },
    {
      name: 'onbekende sessie-id ⇒ 404; zonder sessie-header ⇒ 400, ook voor lezen',
      fn: async () => {
        const list = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
        const unknown = await fetch(env.url, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json', 'Mcp-Session-Id': 'onbekende-sessie' },
          body: list,
        });
        assertSame(unknown.status, 404, 'status bij onbekende sessie');
        assertSame(await unknown.text(), '', 'geen body bij 404');
        const bare = await fetch(env.url, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: list,
        });
        assertSame(bare.status, 400, 'tools/list zonder sessie-header');
        const parsed = (await bare.json()) as { id?: unknown; error?: { code?: number } };
        assertSame([parsed.id, parsed.error?.code], [1, -32600], 'JSON-RPC-fout bij 400');
      },
    },
    {
      name: 'zonder token, met fout token en met fout scheme ⇒ 401',
      fn: async () => {
        await expectConnectStatus(env.url, {}, 401);
        await expectConnectStatus(env.url, { Authorization: 'Bearer fout-token' }, 401);
        await expectConnectStatus(env.url, { Authorization: `Basic ${env.token}` }, 401);
      },
    },
    {
      name: 'met Origin-header ⇒ 403, ook met geldig token',
      fn: async () => {
        await expectConnectStatus(env.url, { ...auth, Origin: 'http://evil.example' }, 403);
      },
    },
    {
      name: 'ander pad ⇒ 404, GET ⇒ 405 met Allow: POST',
      fn: async () => {
        const other = new URL(env.url);
        other.pathname = '/anders';
        const r404 = await fetch(other, { method: 'POST', headers: auth, body: '{}' });
        assertSame(r404.status, 404, 'status ander pad');
        const r405 = await fetch(env.url, { method: 'GET', headers: auth });
        assertSame(r405.status, 405, 'status GET');
        assertSame(r405.headers.get('allow'), 'POST', 'Allow-header bij 405');
      },
    },
  ];
}
