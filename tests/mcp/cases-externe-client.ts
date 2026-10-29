// Externe-clienttest: de OFFICIËLE MCP-client (`@modelcontextprotocol/sdk`) praat over echt HTTP met
// de productcode. De HTTP-schil is `bridgeMirror.ts` (spiegel van `src-tauri/src/mcp_bridge.rs`);
// daarachter draait de echte `createRequestHandler` → `handleMcpMessage` → `planner_*`-tools op een
// EIGEN headless storecontext (niet de app-singleton), met `buildMcpContext` zoals de app hem bouwt.
//
// De spiegel is een kopie van de Rust-HTTP-laag en bewijst niets over Rust zelf. Het Rust-gedrag toetst
// `.github/workflows/mcp-real-app.yml`, met dezelfde SDK-controles tegen de ECHTE bridge.
import { test, assertEq, run } from './harness';
import { createAppStoreContext } from '@/state/appStore';
import { buildMcpContext } from '@/services/mcp/server';
import {
  handleMcpMessage,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  DEFAULT_PROTOCOL_VERSION,
  MCP_INSTRUCTIONS,
} from '@/services/mcp/dispatcher';
import { getTools } from '@/services/mcp/toolRegistry';
import type { McpToolDef } from '@/services/mcp/contracts';
import { startBridgeMirror } from './bridgeMirror';
import { externalClientChecks, type AppProbe } from './externalClient';

// --- De headless app achter de spiegel -----------------------------------------------------------

const app = createAppStoreContext();
app.store.getState().setProject({ name: 'Externe client' });
app.store.getState().ensureProjectCalendarInLibrary();
// Warm-up zoals in cases-batch.ts: de eerste undo promoot de projectkalender naar de bibliotheek.
app.store.getState().addTask({ name: 'warmup' });
app.store.getState().undo();

const backupCalls: Array<{ docId: string; kind: McpToolDef['kind'] }> = [];
const backup = {
  ensureBackup: async (docId: string, kind: McpToolDef['kind']) => { backupCalls.push({ docId, kind }); return null; },
  markDuplicateBorn: () => {},
};

const TOKEN = 'a'.repeat(64);
const mirror = await startBridgeMirror({
  token: TOKEN,
  buildContext: () => buildMcpContext(app, undefined, backup),
  handleMessage: handleMcpMessage,
});

const probe: AppProbe = {
  taskCount: async () => app.store.getState().tasks.length,
  undo: async () => { app.store.getState().undo(); },
  setSafety: async (flags) => { app.store.getState().setUI(flags); },
  newDocument: async () => app.store.getState().newDocument(),
  closeDocument: async (id) => { app.store.getState().closeDocument(id); },
  switchDocument: async (id) => { app.store.getState().switchDocument(id); },
  restartBridge: async () => { mirror.restart(); },
};

let historyBefore = 0;
let backupsBefore = 0;
const checks = externalClientChecks(
  {
    url: mirror.url,
    token: TOKEN,
    probe,
    expected: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      instructions: MCP_INSTRUCTIONS,
      tools: getTools().map((t) => ({ name: t.name, annotations: t.annotations })),
    },
  },
  {
    beforeMutation: () => {
      historyBefore = app.store.getState().nextHistorySequence;
      backupsBefore = backupCalls.length;
    },
    afterWrite: () => {
      assertEq(app.store.getState().nextHistorySequence - historyBefore, 1, 'add_tasks = precies één undo-event');
      assertEq(backupCalls.slice(backupsBefore).map((c) => c.kind), ['mutate'], 'één AI-backup vóór de mutatie');
    },
    afterBatch: () => {
      assertEq(app.store.getState().nextHistorySequence - historyBefore, 1, 'batch = precies één undo-event');
      assertEq(backupCalls.slice(backupsBefore).map((c) => c.kind), ['batch'], 'één AI-backup voor de hele batch');
    },
    afterRefusal: (label) => {
      assertEq(app.store.getState().nextHistorySequence, historyBefore, `${label}: geen undo-event na weigering`);
      assertEq(backupCalls.length, backupsBefore, `${label}: geen backup na weigering`);
    },
  },
);
for (const check of checks) test(`SDK-client: ${check.name}`, check.fn);

test('tools/list telt 41 tools (feit in AGENTS.md en .claude/rules/mcp.md)', () => {
  assertEq(getTools().length, 41, 'aantal planner_*-tools');
});

test('afsluiten', async () => {
  await mirror.close();
});

await run();
