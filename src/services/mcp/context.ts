// De per-request `McpContext`, zonder app-singleton.
//
// `buildMcpContext` in `server.ts` kiest voor de app de singleton, de compatibiliteitstransacties en
// de Tauri-gated backup; daarna bouwt hij de context hier. De headless MCP-server
// (`headless/mcp-server/`, issue #570) bouwt hem met een eigen storecontext en een eigen backupmap.
// Eén constructor, zodat beide hosts dezelfde vorm en dezelfde beginwaarden leveren.
import type { AppStoreContext } from '@/state/appStoreFactory';
import type { McpTransactions } from '@/state/runtime/createMcpTransactions';
import type { McpBackupBinding, McpContext } from './contracts';

/**
 * Een verse context voor één request. `paused`/`readOnly` komen LIVE uit de ui-state van `app`;
 * `expectedDocId` begint op null (de request-handler zet het anker van de sessie erin) en `tempIdMap`
 * is leeg (de batch-executor bezit hem).
 */
export function createMcpContext(
  app: AppStoreContext,
  transactions: McpTransactions,
  backup: McpBackupBinding,
): McpContext {
  const ui = app.store.getState().ui;
  return {
    app,
    transactions,
    expectedDocId: null,
    tempIdMap: new Map<string, string>(),
    paused: ui.aiPaused,
    readOnly: ui.aiReadOnly,
    ensureBackup: backup.ensureBackup,
    markDuplicateBorn: backup.markDuplicateBorn,
  };
}
