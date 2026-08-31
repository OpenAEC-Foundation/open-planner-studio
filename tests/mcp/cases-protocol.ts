// T9 — MCP-dispatcher + toolRegistry: rauwe JSON-RPC-strings door `handleMcpMessage` met een
// STUB-registry. Geen SDK, geen HTTP — puur de protocol-/routeringslaag headless op Node.
//
// De store is hier niet nodig; we importeren `test`/`assert`/`run` uit de harness (die de DOM-shim
// en de store-re-export meebrengt — onschadelijk) en registreren stub-tools in de registry.
import { makeMcpContext, test, assert, assertEq, run } from './harness';
import type { McpToolDef, McpToolResult, McpContext } from '@/services/mcp/contracts';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import {
  handleMcpMessage,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  DEFAULT_PROTOCOL_VERSION,
} from '@/services/mcp/dispatcher';

// --- Stub-omgeving -------------------------------------------------------------------------------

const stubEnvelope = {
  activeDocumentId: 'doc-1',
  documentTitle: 'Teststub',
  scheduleStale: false,
  paused: false,
  readOnly: false,
};

/** Leestool die zijn args echoot — bewijst arg-routering + ok-verpakking. */
const echoTool: McpToolDef = {
  name: 'planner_echo',
  description: 'Echoot de meegegeven waarde terug (teststub).',
  kind: 'read',
  batchable: true,
  inputSchema: {
    type: 'object',
    description: 'schema-omschrijving (mag NIET in tools/list belanden)',
    properties: { value: { type: 'string' } },
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (args): McpToolResult => ({ ok: true, envelope: stubEnvelope, data: { received: args } }),
};

/** Muteertool die altijd faalt — bewijst error-verpakking + isError-vlag. */
const failTool: McpToolDef = {
  name: 'planner_fail',
  description: 'Faalt altijd (teststub).',
  kind: 'mutate',
  batchable: false,
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (): McpToolResult => ({ ok: false, envelope: stubEnvelope, error: 'stub-fout', code: 'VALIDATION' }),
};

/** Handler die SYNCHROON gooit — bewijst de crash-barrière (-32603, geen info-lek). */
const throwTool: McpToolDef = {
  name: 'planner_throw',
  description: 'Gooit synchroon (teststub).',
  kind: 'mutate',
  batchable: false,
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (): McpToolResult => {
    throw new Error('GEHEIM-INTERN-detail met stack die NOOIT naar de client mag');
  },
};

/** Handler die een rejected promise teruggeeft — bewijst dat de barrière ook async rejections vangt. */
const rejectTool: McpToolDef = {
  name: 'planner_reject',
  description: 'Rejectet asynchroon (teststub).',
  kind: 'mutate',
  batchable: false,
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (): Promise<McpToolResult> => Promise.reject(new Error('GEHEIM-ASYNC-detail dat NOOIT lekt')),
};

// Registreer de goede stubs bij module-load. Latere bad-registration-tests gooien vóór ze de
// interne staat vervangen, dus deze blijven gedurende de hele run geregistreerd.
registerToolModules([[echoTool], [failTool], [throwTool], [rejectTool]]);

const ctx: McpContext = makeMcpContext();

/** Stuur een rauw JSON-RPC-bericht en parse het antwoord (of geef de rauwe string terug). */
async function send(body: unknown): Promise<any> {
  const raw = await handleMcpMessage(typeof body === 'string' ? body : JSON.stringify(body), ctx);
  return raw;
}

function assertThrows(fn: () => void, needle: string, label: string): void {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    const m = e instanceof Error ? e.message : String(e);
    assert(m.includes(needle), `${label}: verwachtte foutmelding met "${needle}", kreeg "${m}"`);
  }
  assert(threw, `${label}: verwachtte een throw, maar er werd niets gegooid`);
}

// --- Tests ---------------------------------------------------------------------------------------

test('initialize echoot een bekende client-protocolversie', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  const msg = JSON.parse(raw);
  assertEq(msg.jsonrpc, '2.0', 'jsonrpc-veld');
  assertEq(msg.id, 1, 'id-echo');
  assertEq(msg.result.protocolVersion, '2025-06-18', 'protocolVersion-echo');
  assertEq(msg.result.capabilities, { tools: {} }, 'capabilities.tools');
  assertEq(msg.result.serverInfo.name, MCP_SERVER_NAME, 'serverInfo.name');
  assertEq(msg.result.serverInfo.version, MCP_SERVER_VERSION, 'serverInfo.version');
});

test('initialize valt terug op de default bij een onbekende client-versie', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  const msg = JSON.parse(raw);
  assertEq(msg.result.protocolVersion, DEFAULT_PROTOCOL_VERSION, 'default protocolVersion');
});

test('notifications/initialized geeft een lege string (geen respons)', async () => {
  const raw = await send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assertEq(raw, '', 'lege string bij notificatie');
});

test('tools/list bevat de stubs met schema + annotations en alle namen dragen planner_', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  const msg = JSON.parse(raw);
  const tools: any[] = msg.result.tools;
  assert(Array.isArray(tools) && tools.length >= 2, 'tools-array met minstens 2 stubs');
  for (const t of tools) {
    assert(typeof t.name === 'string' && t.name.startsWith('planner_'), `naam mist planner_-prefix: ${t.name}`);
    assert(t.inputSchema != null && typeof t.inputSchema === 'object', `inputSchema ontbreekt op ${t.name}`);
    assert(t.annotations != null && typeof t.annotations.readOnlyHint === 'boolean', `annotations ontbreekt op ${t.name}`);
    assert(typeof t.description === 'string', `description ontbreekt op ${t.name}`);
  }
  const echo = tools.find((t) => t.name === 'planner_echo');
  // description komt uit het eersteklas def-veld — NIET uit inputSchema.description.
  assertEq(echo.description, 'Echoot de meegegeven waarde terug (teststub).', 'echo-description uit het def-veld');
  assertEq(echo.annotations.readOnlyHint, true, 'echo readOnlyHint');
});

test('tools/call routeert args naar de stub en verpakt een ok-resultaat', async () => {
  const raw = await send({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'planner_echo', arguments: { value: 'hoi' } },
  });
  const msg = JSON.parse(raw);
  assertEq(msg.result.isError, false, 'ok ⇒ isError false');
  assertEq(msg.result.structuredContent.data.received, { value: 'hoi' }, 'args gerouteerd naar handler');
  assert(Array.isArray(msg.result.content) && msg.result.content[0].type === 'text', 'content[0] is text');
  // content[0].text is de geserialiseerde McpToolResult.
  const parsed = JSON.parse(msg.result.content[0].text);
  assertEq(parsed.ok, true, 'content-text bevat het ok-resultaat');
  assertEq(msg.result.structuredContent.ok, true, 'structuredContent = het rauwe resultaat');
});

test('tools/call verpakt een error-resultaat met isError true', async () => {
  const raw = await send({
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'planner_fail', arguments: {} },
  });
  const msg = JSON.parse(raw);
  assertEq(msg.result.isError, true, 'niet-ok ⇒ isError true');
  assertEq(msg.result.structuredContent.ok, false, 'structuredContent.ok false');
  assertEq(msg.result.structuredContent.code, 'VALIDATION', 'error-code doorgegeven');
});

test('tools/call op een onbekende tool geeft JSON-RPC -32602', async () => {
  const raw = await send({
    jsonrpc: '2.0', id: 6, method: 'tools/call',
    params: { name: 'planner_bestaat_niet', arguments: {} },
  });
  const msg = JSON.parse(raw);
  assertEq(msg.error.code, -32602, 'onbekende tool ⇒ -32602');
  assert(msg.result === undefined, 'geen result-veld bij een fout');
});

test('ping geeft een leeg result-object', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 7, method: 'ping' });
  const msg = JSON.parse(raw);
  assertEq(msg.result, {}, 'ping ⇒ leeg result');
});

test('onbekende methode geeft JSON-RPC -32601', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 8, method: 'geen/methode' });
  const msg = JSON.parse(raw);
  assertEq(msg.error.code, -32601, 'onbekende methode ⇒ -32601');
});

test('JSON-parse-fout geeft -32700 met id null', async () => {
  const raw = await handleMcpMessage('{ dit is geen json', ctx);
  const msg = JSON.parse(raw);
  assertEq(msg.error.code, -32700, 'parse-fout ⇒ -32700');
  assertEq(msg.id, null, 'parse-fout ⇒ id null');
});

test('een batch-array geeft -32600', async () => {
  const raw = await handleMcpMessage('[{"jsonrpc":"2.0","id":1,"method":"ping"}]', ctx);
  const msg = JSON.parse(raw);
  assertEq(msg.error.code, -32600, 'array ⇒ -32600');
});

test('id 0 wordt exact geëchood (falsy-valkuil-guard)', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 0, method: 'ping' });
  const msg = JSON.parse(raw);
  assert('id' in msg, 'respons mist het id-veld');
  assertEq(msg.id, 0, 'id 0 moet exact terugkomen, niet naar null vallen');
  assertEq(msg.result, {}, 'ping-result');
});

test('ping zonder id (notification) geeft een lege string', async () => {
  const raw = await send({ jsonrpc: '2.0', method: 'ping' });
  assertEq(raw, '', 'notification ⇒ geen respons');
});

test('een synchroon gooiende handler geeft -32603 zonder info-lek', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 42, method: 'tools/call', params: { name: 'planner_throw', arguments: {} } });
  const msg = JSON.parse(raw);
  assertEq(msg.error.code, -32603, 'throw ⇒ -32603');
  assertEq(msg.id, 42, 'id blijft behouden bij een crash');
  assert(msg.result === undefined, 'geen result-veld bij een crash');
  assert(!msg.error.message.includes('GEHEIM'), `foutmelding lekt intern detail: ${msg.error.message}`);
  assert(!msg.error.message.toLowerCase().includes('stack'), 'foutmelding mag geen stack noemen');
  assert(msg.error.message.includes('planner_throw'), 'melding benoemt wél de tool-naam');
});

test('een rejectende (async) handler geeft -32603 zonder info-lek', async () => {
  const raw = await send({ jsonrpc: '2.0', id: 43, method: 'tools/call', params: { name: 'planner_reject', arguments: {} } });
  const msg = JSON.parse(raw);
  assertEq(msg.error.code, -32603, 'reject ⇒ -32603');
  assertEq(msg.id, 43, 'id blijft behouden bij een rejection');
  assert(!msg.error.message.includes('GEHEIM'), `foutmelding lekt intern detail: ${msg.error.message}`);
});

test('dubbele toolnaam bij registratie gooit hard', () => {
  assertThrows(
    () => registerToolModules([[echoTool], [echoTool]]),
    'Dubbele',
    'dubbele registratie',
  );
});

test('een toolnaam zonder planner_-prefix gooit bij registratie', () => {
  const badTool: McpToolDef = { ...echoTool, name: 'echo_zonder_prefix' };
  assertThrows(
    () => registerToolModules([[badTool]]),
    'prefix',
    'ontbrekende prefix',
  );
});

test('een lege description gooit bij registratie', () => {
  const badTool: McpToolDef = { ...echoTool, name: 'planner_leeg', description: '   ' };
  assertThrows(
    () => registerToolModules([[badTool]]),
    'description',
    'lege description',
  );
});

await run();
