// T15 — AI-activiteitenlog headless: ring-buffer-gedrag + de server.ts-wiring.
//
// Twee lagen: (1) `activityLog` puur (record/getEntries/clear/subscribe + ring-buffer-cap + afkap),
// en (2) de echte `createRequestHandler`-wiring die een `tools/call` door de ECHTE dispatcher stuurt
// en één `ActivityEntry` in het log legt. Geen Tauri: emit wordt als fake geïnjecteerd, precies zoals
// cases-server.ts.

// --- localStorage-shim (vóór elke @/-import; server.ts→settingsStore leest 'm) -------------------
const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};

import { activityFieldText } from '@/i18n/activityFieldText';
import { test, assert, assertEq, run } from './harness';
import type { ActivityEntry, McpToolDef, McpToolResult, McpEnvelope } from '@/services/mcp/contracts';
import {
  record,
  getEntries,
  clear,
  subscribe,
  capField,
  MAX_ENTRIES,
  FIELD_CAP,
  TRUNCATE_MARKER,
} from '@/services/mcp/activityLog';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createRequestHandler, buildMcpContext } from '@/services/mcp/server';

const stubEnvelope: McpEnvelope = {
  activeDocumentId: 'doc-1',
  documentTitle: 'Teststub',
  scheduleStale: false,
  paused: false,
  readOnly: false,
};

function mkEntry(over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    ts: Date.now(),
    tool: 'planner_stub',
    summary: 'planner_stub',
    durationMs: 1,
    ok: true,
    argsJson: '{}',
    resultJson: '{}',
    ...over,
  };
}

// --- (1) record legt een entry met de juiste velden -----------------------------------------------

test('record voegt één entry toe met alle velden intact', () => {
  clear();
  const e = mkEntry({ tool: 'planner_add_tasks', summary: 'planner_add_tasks: 42 tasks', durationMs: 12, ok: true, argsJson: '{"tasks":[]}', resultJson: '{"ok":true}' });
  record(e);
  const list = getEntries();
  assertEq(list.length, 1, 'precies één entry na één record');
  const got = list[0];
  assertEq(got.tool, 'planner_add_tasks', 'tool bewaard');
  assertEq(got.summary, 'planner_add_tasks: 42 tasks', 'summary bewaard');
  assertEq(got.durationMs, 12, 'duur bewaard');
  assertEq(got.ok, true, 'ok bewaard');
  assertEq(got.argsJson, '{"tasks":[]}', 'argsJson bewaard');
  assertEq(got.resultJson, '{"ok":true}', 'resultJson bewaard');
});

test('record bewaart de fout-tak (ok:false + error)', () => {
  clear();
  record(mkEntry({ ok: false, error: '-32602: Invalid params' }));
  const got = getEntries()[0];
  assertEq(got.ok, false, 'ok:false bewaard');
  assertEq(got.error, '-32602: Invalid params', 'error-string bewaard');
});

// --- (2) ring-buffer capt op MAX_ENTRIES (501e verdringt de oudste) --------------------------------

test('ring-buffer capt op 500: de 501e verdringt de oudste', () => {
  clear();
  assertEq(MAX_ENTRIES, 500, 'cap is 500 (spec)');
  for (let i = 0; i <= MAX_ENTRIES; i++) {   // 0..500 = 501 entries
    record(mkEntry({ tool: `t${i}`, summary: `t${i}` }));
  }
  const list = getEntries();
  assertEq(list.length, MAX_ENTRIES, 'buffer blijft op 500 gecapt');
  assertEq(list[0].tool, 't1', 'de oudste (t0) is verdrongen; nu begint het bij t1');
  assertEq(list[list.length - 1].tool, `t${MAX_ENTRIES}`, 'de nieuwste (t500) staat achteraan');
});

// --- (3) subscribe vuurt; (4) clear leegt ---------------------------------------------------------

test('subscribe vuurt bij record met de nieuwe snapshot, en unsubscribe stopt het', () => {
  clear();
  let fires = 0;
  let lastLen = -1;
  const unsub = subscribe((entries) => { fires++; lastLen = entries.length; });
  record(mkEntry());
  assertEq(fires, 1, 'subscriber vuurde één keer na één record');
  assertEq(lastLen, 1, 'de snapshot bevatte de nieuwe entry');
  unsub();
  record(mkEntry());
  assertEq(fires, 1, 'na unsubscribe vuurt de subscriber niet meer');
});

test('clear leegt de buffer en notificeert', () => {
  clear();
  record(mkEntry());
  record(mkEntry());
  assertEq(getEntries().length, 2, 'twee entries vóór clear');
  let notified = false;
  const unsub = subscribe(() => { notified = true; });
  clear();
  assertEq(getEntries().length, 0, 'leeg na clear');
  assert(notified, 'clear notificeert de subscribers');
  unsub();
});

// --- (5) afkappen: capField + record garanderen ≤ 20 kB + marker ----------------------------------

test('capField kapt >20 kB af met de marker en is idempotent', () => {
  const big = 'x'.repeat(FIELD_CAP + 5000);
  const cut = capField(big);
  assert(cut.endsWith(TRUNCATE_MARKER), 'afgekapt veld eindigt op de marker');
  assertEq(cut.length, FIELD_CAP + TRUNCATE_MARKER.length, 'lengte = CAP + marker');
  assertEq(capField(cut), cut, 'dubbel afkappen verandert niets (idempotent)');
  const small = 'y'.repeat(10);
  assertEq(capField(small), small, 'klein veld blijft onaangeroerd');
  assertEq(activityFieldText(cut, '… afgekapt'), 'x'.repeat(FIELD_CAP) + '… afgekapt', 'UI vertaalt alleen de afkapmarker');
  assertEq(activityFieldText('inhoud … truncated', '… afgekapt'), 'inhoud … truncated', 'korte technische inhoud blijft letterlijk');
});

test('record kapt een >20 kB argsJson defensief af (laatste linie)', () => {
  clear();
  const big = JSON.stringify({ blob: 'x'.repeat(FIELD_CAP + 5000) });
  record(mkEntry({ argsJson: big }));
  const got = getEntries()[0];
  assert(got.argsJson.endsWith(TRUNCATE_MARKER), 'record kapt argsJson af als de wiring het niet deed');
  assert(got.argsJson.length <= FIELD_CAP + TRUNCATE_MARKER.length, 'argsJson binnen de cap');
});

// --- (6) server.ts-wiring: een echte tools/call door de handler legt één entry ---------------------

function registerStub(): void {
  const stub: McpToolDef = {
    name: 'planner_activity_stub',
    description: 'Echoot zijn args (T15-teststub).',
    kind: 'read',
    batchable: true,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: (args): McpToolResult => ({ ok: true, envelope: stubEnvelope, data: { echo: args } }),
  };
  registerToolModules([[stub]]);
}

/**
 * De echte request-handler met een geopende MCP-sessie: elk request behalve `initialize` moet een sessie
 * dragen (anders 400). De `initialize` zelf komt ook in het log; daarom daarna `clear()`.
 */
async function sessionHandler(): Promise<(payload: { id: number; body: string }) => Promise<void>> {
  const handler = createRequestHandler({
    emit: () => { /* niet relevant voor de log-assertie */ },
    buildContext: buildMcpContext,
    handleMessage: handleMcpMessage,
    newSessionId: () => 'sessie-activiteit',
  });
  await handler({ id: 1, body: JSON.stringify({ jsonrpc: '2.0', id: 'init', method: 'initialize', params: {} }) });
  clear();
  return (payload) => handler({ ...payload, sessionId: 'sessie-activiteit' });
}

test('wiring: een tools/call door de echte handler legt één entry met toolnaam + ok + duur ≥ 0', async () => {
  registerStub();
  clear();
  const handler = await sessionHandler();
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: { name: 'planner_activity_stub', arguments: { tasks: [1, 2, 3] } },
  });
  await handler({ id: 88, body });

  const list = getEntries();
  assertEq(list.length, 1, 'precies één entry na één tools/call');
  const got = list[0];
  assertEq(got.tool, 'planner_activity_stub', 'de toolnaam komt uit params.name');
  assertEq(got.ok, true, 'de stub gaf ok ⇒ ok:true');
  assert(got.durationMs >= 0, `duur moet ≥ 0 zijn, kreeg ${got.durationMs}`);
  assertEq(got.summary, 'planner_activity_stub: 3 tasks', 'summary telt het eerste array-veld (3 tasks)');
  assert(got.argsJson.includes('"tasks"'), 'argsJson bevat de doorgegeven args');
});

test('wiring: een notificatie (lege respons-body) wordt NIET gelogd', async () => {
  clear();
  const handler = await sessionHandler();
  const note = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' });
  await handler({ id: 3, body: note });
  assertEq(getEntries().length, 0, 'een notificatie levert geen activiteitsregel op');
});

test('wiring: een onbekende tool ⇒ entry met ok:false', async () => {
  clear();
  const handler = await sessionHandler();
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: { name: 'planner_does_not_exist', arguments: {} },
  });
  await handler({ id: 91, body });
  const got = getEntries()[0];
  assert(got != null, 'er is een entry gelogd voor de mislukte aanroep');
  assertEq(got.ok, false, 'een onbekende tool ⇒ ok:false in het log');
});

test('wiring: een >20 kB arg wordt afgekapt met de marker', async () => {
  registerStub();
  clear();
  const handler = await sessionHandler();
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'planner_activity_stub', arguments: { blob: 'x'.repeat(FIELD_CAP + 8000) } },
  });
  await handler({ id: 70, body });
  const got = getEntries()[0];
  assert(got.argsJson.endsWith(TRUNCATE_MARKER), 'de te grote argsJson is afgekapt met de marker');
  assert(got.argsJson.length <= FIELD_CAP + TRUNCATE_MARKER.length, 'argsJson binnen de cap');
});

test('wiring: vaste foutmarkeringen hebben taalonafhankelijke soorten', async () => {
  for (const [response, errorKind] of [['invalid', 'unparseableResponse'], ['{"error":{}}', 'error']] as const) {
    clear();
    const handler = createRequestHandler({
      emit: () => {}, buildContext: buildMcpContext,
      handleMessage: async (body, ctx) => body.includes('"initialize"') ? handleMcpMessage(body, ctx) : response,
      newSessionId: () => 'sessie-markering',
    });
    await handler({ id: 0, body: JSON.stringify({ jsonrpc: '2.0', id: 'init', method: 'initialize', params: {} }) });
    clear();
    await handler({ id: 1, body: '{invalid', sessionId: 'sessie-markering' });
    const entry = getEntries()[0];
    assertEq(entry?.summaryKind, 'unparseableRequest', 'requestsoort voor de UI');
    assertEq(entry?.errorKind, errorKind, 'antwoordsoort voor de UI');
  }
});

await run();
