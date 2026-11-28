import { appStoreContext, useAppStore, type AppStoreContext } from '@/state/appStore';
import { mcpTransactions } from '@/state/mcpTransaction';
import { createMcpTransactions, type McpTransactions } from '@/state/runtime/createMcpTransactions';
import { loadMcpPort, loadMcpToken, saveMcpToken, saveAiMode } from '@/utils/settingsStore';
import { isTauri } from '@/utils/platform';
import { handleMcpMessage } from './dispatcher';
import { createAppBackupService, ensureBackup, resetBackupSession, markDuplicateBorn } from './backup';
import { registerAllTools } from './toolRegistry';
import { getMcpDiscoveryWriter } from './discoveryFiles';
import { createMcpContext } from './context';
import type { McpBackupBinding, McpContext, McpServerStatus } from './contracts';
import {
  createRequestHandler, createMcpSessionTable, type McpRequestEvent, type McpSessionTable,
} from './requestHandler';

export function initMcpRuntime(): void {
  registerAllTools();
}

initMcpRuntime();

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export function ensureMcpToken(): string {
  const existing = loadMcpToken();
  if (existing) return existing;
  const token = generateToken();
  saveMcpToken(token);
  return token;
}

export function regenerateMcpToken(): string {
  const token = generateToken();
  saveMcpToken(token);
  return token;
}

export async function regenerateAndApplyMcpToken(isRunning: () => boolean): Promise<string> {
  const token = regenerateMcpToken();
  appMcpSessions.clear();
  if (isTauri() && isRunning()) {
    try {
      const controller = await getLiveController();
      await controller.restart();
    } catch (error) {
      console.error('MCP: herstart na nieuw token mislukt:', error);
    }
  }
  return token;
}

export interface ApplyAiModeDeps {
  setAiMode: (value: boolean) => void;
  persist: (value: boolean) => void | Promise<void>;
  stopServer: () => void | Promise<void>;
  setStatus: (status: McpServerStatus) => void;
  port: number;
}

export async function applyAiMode(value: boolean, deps: ApplyAiModeDeps): Promise<void> {
  deps.setAiMode(value);
  await deps.persist(value);
  if (!value) {
    await deps.stopServer();
    deps.setStatus({ state: 'off', port: deps.port });
  }
}

export function applyAiModeLive(value: boolean): Promise<void> {
  const state = useAppStore.getState();
  return applyAiMode(value, {
    setAiMode: (v) => state.setUI({ aiMode: v }),
    persist: saveAiMode,
    stopServer: stopMcpServer,
    setStatus: state.setAiServerStatus,
    port: loadMcpPort(),
  });
}

export function buildMcpContext(
  app: AppStoreContext = appStoreContext,
  transactions?: McpTransactions,
  backupOverride?: McpBackupBinding,
): McpContext {
  const contextBackupService = app === appStoreContext ? null : createAppBackupService(app);
  const backup: McpBackupBinding = backupOverride ?? (
    app === appStoreContext
      ? { ensureBackup, markDuplicateBorn }
      : {
          ensureBackup: (docId, kind) => isTauri()
            ? contextBackupService!.ensureBackup(docId, kind)
            : Promise.resolve(null),
          markDuplicateBorn: contextBackupService!.markDuplicateBorn,
        }
  );
  return createMcpContext(
    app,
    transactions ?? (app === appStoreContext ? mcpTransactions : createMcpTransactions(app)),
    backup,
  );
}

export {
  createRequestHandler, createMcpSessionTable, MCP_MAX_SESSIONS, MCP_QUEUE_DEADLINE_MS,
  type RequestHandlerDeps, type McpRequestEvent, type McpResponseEvent, type McpSessionTable,
} from './requestHandler';

export const appMcpSessions: McpSessionTable = createMcpSessionTable();

function mapRustState(state: string): McpServerStatus['state'] {
  switch (state) {
    case 'running': return 'live';
    case 'stopped': return 'off';
    default: return 'error';
  }
}

export interface StatusHandlerDeps {
  setStatus: (status: McpServerStatus) => void;
}

export function createStatusHandler(
  deps: StatusHandlerDeps,
): (payload: { state: string; port: number; message?: string }) => void {
  return (payload) => {
    deps.setStatus({
      state: mapRustState(payload.state),
      port: payload.port,
      ...(payload.message ? { message: payload.message } : {}),
    });
  };
}

export interface AttemptStartDeps {
  invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
  setStatus: (status: McpServerStatus) => void;
  port: number;
  token: string;
}

export async function attemptBridgeStart(deps: AttemptStartDeps): Promise<boolean> {
  try {
    await deps.invoke('mcp_bridge_start', { port: deps.port, token: deps.token });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    deps.setStatus({ state: 'port-busy', port: deps.port, message });
    return false;
  }
}

export interface BridgeDeps {
  listen: <T>(event: string, handler: (payload: T) => void) => Promise<() => void>;
  invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
  emit: (event: string, payload: unknown) => void | Promise<void>;
  setStatus: (status: McpServerStatus) => void;
  buildContext: () => McpContext;
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
  getPort: () => number;
  getToken: () => string;
  sessions?: McpSessionTable;
  onBridgeStarted?: (port: number, token: string) => void | Promise<void>;
  onBridgeStopped?: () => void | Promise<void>;
}

export interface BridgeController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  activeListenerCount: () => number;
}

export function createBridgeController(deps: BridgeDeps): BridgeController {
  const sessions = deps.sessions ?? createMcpSessionTable();
  let unlisteners: Array<() => void> = [];
  let starting = false;

  async function notify(hook: (() => void | Promise<void>) | undefined): Promise<void> {
    if (!hook) return;
    try { await hook(); } catch (error) { console.warn('MCP: ontdekkingsbestand bijwerken mislukt:', error); }
  }

  function cleanup(): void {
    for (const un of unlisteners) {
      try { un(); } catch { }
    }
    unlisteners = [];
  }

  async function start(): Promise<void> {
    if (starting) return;
    starting = true;
    try {
      cleanup();

      const port = deps.getPort();
      const token = deps.getToken();

      const onRequest = createRequestHandler({
        emit: deps.emit,
        buildContext: deps.buildContext,
        handleMessage: deps.handleMessage,
        sessions,
      });
      const onStatus = createStatusHandler({ setStatus: deps.setStatus });

      const unReq = await deps.listen<McpRequestEvent>('mcp://request', (p) => { void onRequest(p); });
      const unStatus = await deps.listen<{ state: string; port: number; message?: string }>('mcp://status', (p) => { onStatus(p); });
      unlisteners = [unReq, unStatus];

      let started = await attemptBridgeStart({ invoke: deps.invoke, setStatus: () => {}, port, token });
      if (!started) {
        try { await deps.invoke('mcp_bridge_stop', {}); } catch { }
        started = await attemptBridgeStart({ invoke: deps.invoke, setStatus: deps.setStatus, port, token });
      }
      if (!started) {
        cleanup();
        await notify(deps.onBridgeStopped);
      } else {
        await notify(deps.onBridgeStarted ? () => deps.onBridgeStarted!(port, token) : undefined);
      }
    } finally {
      starting = false;
    }
  }

  async function stop(): Promise<void> {
    cleanup();
    try { await deps.invoke('mcp_bridge_stop', {}); } catch { }
    deps.setStatus({ state: 'off', port: deps.getPort() });
    await notify(deps.onBridgeStopped);
  }

  async function restart(): Promise<void> {
    await stop();
    await start();
  }

  return { start, stop, restart, activeListenerCount: () => unlisteners.length };
}

let liveControllerPromise: Promise<BridgeController> | null = null;

async function buildLiveController(): Promise<BridgeController> {
  const { invoke } = await import('@tauri-apps/api/core');
  const { emit, listen } = await import('@tauri-apps/api/event');
  return createBridgeController({
    listen: <T>(event: string, handler: (payload: T) => void) =>
      listen<T>(event, (ev) => handler(ev.payload)),
    invoke: (cmd, args) => invoke(cmd, args),
    emit: (event, payload) => emit(event, payload),
    setStatus: useAppStore.getState().setAiServerStatus,
    buildContext: buildMcpContext,
    handleMessage: handleMcpMessage,
    getPort: loadMcpPort,
    getToken: ensureMcpToken,
    sessions: appMcpSessions,
    onBridgeStarted: (port, token) => getMcpDiscoveryWriter()?.bridgeStarted(port, token),
    onBridgeStopped: () => getMcpDiscoveryWriter()?.bridgeStopped(),
  });
}

function getLiveController(): Promise<BridgeController> {
  if (!liveControllerPromise) liveControllerPromise = buildLiveController();
  return liveControllerPromise;
}

export async function startMcpServer(): Promise<void> {
  initMcpRuntime();
  if (!isTauri()) return;
  resetBackupSession();
  const controller = await getLiveController();
  await controller.start();
}

export async function stopMcpServer(): Promise<void> {
  if (!isTauri()) return;
  const controller = await getLiveController();
  await controller.stop();
}
