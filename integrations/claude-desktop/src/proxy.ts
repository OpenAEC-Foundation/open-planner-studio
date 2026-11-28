import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export const DEFAULT_REQUEST_TIMEOUT_MS = 130_000;
export const STATUS_TOOL_NAME = 'open_planner_studio_status';
const FALLBACK_PROTOCOL_VERSION = '2025-06-18';

export type Mode = 'app' | 'headless';

export interface AppTarget {
  port: number;
  token: string;
  key: string;
  appVersion: string;
  pid: number;
}

export type HeadlessReply =
  | { type: 'reply'; json: unknown }
  | { type: 'none' }
  | { type: 'timeout' }
  | { type: 'exited'; detail: string };

export interface HeadlessChannel {
  readonly alive: boolean;
  request(message: unknown, timeoutMs: number): Promise<HeadlessReply>;
  close(): Promise<void>;
}

export interface HeadlessStarter {
  readonly root: string | null;
  start(): Promise<HeadlessChannel>;
}

export type ProxyFailure =
  | { kind: 'no-app' }
  | { kind: 'token' }
  | { kind: 'unreachable'; detail: string; maybeDelivered: boolean }
  | { kind: 'timeout' }
  | { kind: 'refused'; message: string }
  | { kind: 'http'; status: number }
  | { kind: 'headless'; message: string };

export function appFailureMessage(failure: ProxyFailure, port: number | null): string {
  const where = port === null ? 'the port in its runtime file' : `http://127.0.0.1:${port}/mcp`;
  switch (failure.kind) {
    case 'no-app':
      return 'The Open Planner Studio desktop app is not running, or its MCP bridge is off.';
    case 'token':
      return `Open Planner Studio refused the token from its runtime file (HTTP 401) on ${where}.`;
    case 'unreachable':
      return `Open Planner Studio does not answer on ${where} (${failure.detail}).`;
    case 'timeout':
      return `Open Planner Studio did not answer within ${Math.round(DEFAULT_REQUEST_TIMEOUT_MS / 1000)} seconds. `
        + 'It is not known whether the request was carried out. Ask the user to check the app '
        + '(an open dialog blocks the MCP client) and read the plan again before you retry a change.';
    case 'refused':
      return `Open Planner Studio refused the connection: ${failure.message}`;
    case 'http':
      return `Something answers on ${where}, but it is not the Open Planner Studio MCP bridge (HTTP ${failure.status}).`;
    case 'headless':
      return failure.message;
  }
}

export function offlineMessage(headless: ProxyFailure, app: ProxyFailure, port: number | null): string {
  return `${appFailureMessage(app, port)} ${appFailureMessage(headless, null)} `
    + 'To use the app, ask the user to open the Open Planner Studio desktop app, go to the MCP tab and click "Start bridge".';
}

export const DOCUMENT_CHOICE_TOOL = 'planner_switch_document';
const DOCUMENT_RECOVERY_TOOLS = new Set([DOCUMENT_CHOICE_TOOL, 'planner_new_document', 'planner_import_schedule']);
export const EXPORT_TOOL = 'planner_export_ifc';

export const SESSION_RESET_MESSAGE =
  'The connection to Open Planner Studio was reset (the app or its MCP bridge restarted), so this change was NOT carried out. '
  + 'Another document may be active now. Changes stay blocked until you choose the document explicitly: call '
  + `planner_list_documents, pick the document you mean, confirm it with ${DOCUMENT_CHOICE_TOOL}, then send the change again. `
  + 'Alternatively, explicitly create a new plan with planner_new_document or import a file with planner_import_schedule.';

const inFolder = (root: string | null) => (root === null ? 'the working folder' : `the working folder '${root}'`);

export const SWITCH_TO_APP_MESSAGE =
  'The Open Planner Studio app is open now with its MCP bridge, so requests go to the app again. This change was NOT carried out: '
  + 'the documents in the app are not the ones you had open without the app. Call planner_list_documents, choose the document '
  + `with ${DOCUMENT_CHOICE_TOOL} (or open a file with planner_import_schedule), then send the change again.`;

export function switchToHeadlessMessage(root: string | null): string {
  return 'The Open Planner Studio app closed (or its MCP bridge stopped), so requests now go to the planner without the app, '
    + `which works on files in ${inFolder(root)}. This change was NOT carried out: the documents from the app are not open here. `
    + 'Open a file with planner_import_schedule (a path like ~/plan.ifc is a file in that folder) or start a new plan with '
    + 'planner_new_document, then send the change again. Changes here are only kept when you write them with planner_export_ifc.';
}

export function headlessLostMessage(root: string | null, detail: string): string {
  return `The planner without the app (${inFolder(root)}) stopped unexpectedly (${detail}). It is not known whether the `
    + 'last request was carried out, and changes that were not written with planner_export_ifc are lost. Changes stay blocked '
    + 'until you open a file again with planner_import_schedule (or start a new plan with planner_new_document).';
}

const NOTE_PREFIX = 'Note from the Open Planner Studio extension: ';
export const SWITCH_TO_APP_NOTE = `${NOTE_PREFIX}the Open Planner Studio app is open now, so this answer comes from the app. `
  + 'Choose the document again before you change anything.';
export function switchToHeadlessNote(root: string | null): string {
  return `${NOTE_PREFIX}the Open Planner Studio app closed, so this answer comes from the planner without the app, in `
    + `${inFolder(root)}. Documents from the app are not open here.`;
}
export const HEADLESS_RESTART_NOTE = `${NOTE_PREFIX}the planner without the app stopped unexpectedly and started again, `
  + 'so this answer comes from a new, empty planner. Changes that were not written with planner_export_ifc are lost.';
export const UNSAVED_STAY_NOTE = `${NOTE_PREFIX}the Open Planner Studio app is open now, but the planner without the app `
  + 'still has changes that are not written to a file. Requests stay with the planner without the app until you write them '
  + 'with planner_export_ifc. While the app runs, that planner does not replace an existing file, so choose a new file name. '
  + 'After that, requests go to the app.';
export const HEADLESS_BUSY_MESSAGE = 'The planner without the app did not answer an earlier change in time, and it does '
  + 'not answer yet. This request was NOT carried out, so that the earlier change stays with the right document. Try '
  + 'again in a moment; read-only tools still work.';
export const UNKNOWN_OUTCOME_MESSAGE = 'The connection to the Open Planner Studio app broke before its answer came, so it is '
  + 'not known whether this change was carried out. The extension does not send it again. Read the plan again before you '
  + 'retry the change.';

export function bundleInstructions(root: string | null): string {
  return '\n\nThis extension uses the Open Planner Studio app while its MCP bridge runs; otherwise a planner without the app on '
    + `files in ${inFolder(root)} (~/plan.ifc is a file there; no auto-save: keep changes with planner_export_ifc). It `
    + 'switches by itself when the app opens or closes and says so in the next tool answer; then choose the document again '
    + 'before you change anything.';
}

export interface PlannerProxyOptions {
  version: string;
  findApp: () => AppTarget | null;
  headless: HeadlessStarter;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  log?: (line: string) => void;
}

export interface PlannerProxy {
  handle(message: JSONRPCMessage): Promise<void>;
  close(): Promise<void>;
}

type Id = string | number;
type Json = Record<string, unknown>;

type Upstream =
  | { type: 'ok'; status: number; sessionId: string | null; json: unknown }
  | { type: 'session-lost' }
  | { type: 'fail'; failure: ProxyFailure };

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is Id => typeof v === 'string' || typeof v === 'number';

function describeError(error: unknown): string {
  const cause = isObject(error) && isObject(error.cause) ? error.cause : null;
  const code = cause && typeof cause.code === 'string' ? cause.code : null;
  const message = error instanceof Error ? error.message : String(error);
  return code ? `${message} (${code})` : message;
}

const STATUS_TOOL = {
  name: STATUS_TOOL_NAME,
  title: 'Open Planner Studio connection status',
  description: 'Checks the connection of the Open Planner Studio extension. The planner_ tools appear while the desktop app '
    + 'runs with its MCP bridge started, or while the extension can start the planner without the app in its working folder. '
    + 'Call this tool when they are missing: it connects if it can, and otherwise explains what the user must do.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true, openWorldHint: false },
};

export function createPlannerProxy(opts: PlannerProxyOptions, send: (message: JSONRPCMessage) => Promise<void>): PlannerProxy {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const log = opts.log ?? (() => {});
  const root = opts.headless.root;

  let clientInitParams: Json | null = null;
  let toolsShown: 'planner' | 'status' | null = null;
  const readOnlyTools = new Set<string>();
  const queuedIds = new Set<Id>();
  const cancelledIds = new Set<Id>();
  let internalId = 0;
  let queue: Promise<void> = Promise.resolve();

  let mode: Mode | null = null;
  let blocked: string | null = null;
  let pendingNote: string | null = null;

  let app: AppTarget | null = null;
  let appConnected = false;
  let sessionId: string | null = null;
  let protocolVersion: string | null = null;
  let resumeSession: string | null = null;

  let channel: HeadlessChannel | null = null;
  let headlessReady = false;
  const unsaved = new Set<string>();
  let uncertainChange = false;
  let unsavedNoted = false;

  const endpoint = () => `http://127.0.0.1:${app?.port ?? 0}/mcp`;

  async function postApp(message: unknown, withSession: boolean): Promise<Upstream> {
    if (app === null) return { type: 'fail', failure: { kind: 'no-app' } };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${app.token}`,
    };
    const sentSession = withSession && sessionId !== null;
    if (sentSession) headers['Mcp-Session-Id'] = sessionId as string;
    if (withSession && protocolVersion) headers['Mcp-Protocol-Version'] = protocolVersion;
    let res: Response;
    try {
      res = await fetchImpl(endpoint(), {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isObject(error) && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        return { type: 'fail', failure: { kind: 'timeout' } };
      }
      const cause = isObject(error) && isObject(error.cause) ? error.cause : null;
      const maybeDelivered = cause?.code !== 'ECONNREFUSED';
      return { type: 'fail', failure: { kind: 'unreachable', detail: describeError(error), maybeDelivered } };
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) return { type: 'fail', failure: { kind: 'token' } };
    if (res.status === 404 && sentSession) {
      blocked = SESSION_RESET_MESSAGE;
      log('session lost (app restarted); changes are blocked until a document is chosen again');
      return { type: 'session-lost' };
    }
    let json: unknown;
    if (text !== '') {
      try { json = JSON.parse(text); } catch { json = undefined; }
    }
    if (res.status === 200 || res.status === 202 || isObject(json)) {
      return { type: 'ok', status: res.status, sessionId: res.headers.get('mcp-session-id'), json };
    }
    return { type: 'fail', failure: { kind: 'http', status: res.status } };
  }

  function initParams(): Json {
    return clientInitParams ?? {
      protocolVersion: FALLBACK_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'open-planner-studio-mcpb', version: opts.version },
    };
  }

  function adoptInitialize(reply: Upstream): ProxyFailure | null {
    if (reply.type === 'fail') return reply.failure;
    if (reply.type === 'session-lost') return { kind: 'http', status: 404 };
    const json = reply.json;
    if (!isObject(json) || !isObject(json.result)) {
      const error = isObject(json) && isObject(json.error) ? json.error : null;
      const message = error && typeof error.message === 'string' ? error.message : `no valid initialize answer (HTTP ${reply.status})`;
      return { kind: 'refused', message };
    }
    sessionId = reply.sessionId && reply.sessionId !== '' ? reply.sessionId : null;
    protocolVersion = typeof json.result.protocolVersion === 'string' ? json.result.protocolVersion : null;
    appConnected = true;
    return null;
  }

  const notifyToolsChanged = () => send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' } as JSONRPCMessage);

  async function markOnline(): Promise<void> {
    if (toolsShown === 'status') {
      toolsShown = null;
      await notifyToolsChanged();
    }
  }

  async function markOffline(): Promise<void> {
    if (toolsShown === 'planner') {
      toolsShown = null;
      await notifyToolsChanged();
    }
  }

  async function connectApp(): Promise<ProxyFailure | null> {
    sessionId = null;
    appConnected = false;
    const reply = await postApp({ jsonrpc: '2.0', id: `ops-mcpb-init-${++internalId}`, method: 'initialize', params: initParams() }, false);
    const failure = adoptInitialize(reply);
    if (failure) return failure;
    resumeSession = null;
    await postApp({ jsonrpc: '2.0', method: 'notifications/initialized' }, true);
    log(`connected to the app: ${endpoint()} (Open Planner Studio ${app?.appVersion}, pid ${app?.pid})${sessionId ? ', new session' : ''}`);
    if (mode === 'app' && blocked === null) {
      blocked = SESSION_RESET_MESSAGE;
      log('new session with the app; changes are blocked until a document is chosen again');
    }
    return null;
  }

  async function closeHeadless(): Promise<void> {
    const old = channel;
    channel = null;
    headlessReady = false;
    unsaved.clear();
    uncertainChange = false;
    if (old) await old.close();
  }

  async function connectHeadless(clientId?: Id): Promise<{ failure: ProxyFailure } | { json: unknown }> {
    await closeHeadless();
    let started: HeadlessChannel;
    try {
      started = await opts.headless.start();
    } catch (error) {
      return { failure: { kind: 'headless', message: error instanceof Error ? error.message : String(error) } };
    }
    channel = started;
    const init = await started.request({
      jsonrpc: '2.0', id: clientId ?? `ops-mcpb-init-${++internalId}`, method: 'initialize', params: initParams(),
    }, timeoutMs);
    if (init.type !== 'reply' || !isObject(init.json) || !isObject(init.json.result)) {
      const detail = init.type === 'exited' ? init.detail
        : init.type === 'timeout' ? `no answer within ${Math.round(timeoutMs / 1000)} seconds` : 'no valid initialize answer';
      await closeHeadless();
      return { failure: { kind: 'headless', message: `The planner without the app could not start (${detail}).` } };
    }
    if (clientId === undefined) await started.request({ jsonrpc: '2.0', method: 'notifications/initialized' }, timeoutMs);
    headlessReady = true;
    log(`started the planner without the app on ${inFolder(root)}`);
    return { json: init.json };
  }

  async function enter(next: Mode): Promise<void> {
    if (mode === next) return;
    const previous = mode;
    mode = next;
    if (previous === null) {
      log(`mode: ${next === 'app' ? `the app (${endpoint()})` : `without the app (${inFolder(root)})`}`);
      return;
    }
    resumeSession = null;
    if (next === 'app') {
      await closeHeadless();
      blocked = SWITCH_TO_APP_MESSAGE;
      pendingNote = SWITCH_TO_APP_NOTE;
      log(`switched to the app (${endpoint()}); the planner without the app stopped; changes are blocked until a document is chosen`);
    } else {
      appConnected = false;
      sessionId = null;
      blocked = switchToHeadlessMessage(root);
      pendingNote = switchToHeadlessNote(root);
      log(`switched to working without the app (${inFolder(root)}); changes are blocked until a document is opened`);
    }
    toolsShown = null;
    await notifyToolsChanged();
  }

  async function selectBackend(): Promise<Mode | ProxyFailure> {
    if (headlessReady && channel?.alive !== true) {
      headlessReady = false;
      unsaved.clear();
      uncertainChange = false;
      if (mode === 'headless') {
        blocked = headlessLostMessage(root, 'the process ended');
        pendingNote = HEADLESS_RESTART_NOTE;
      }
      log('the planner without the app ended unexpectedly; its unsaved changes are lost');
    }
    const found = opts.findApp();
    const pending = unsaved.size > 0 || uncertainChange;
    if (found === null || !pending) unsavedNoted = false;
    const stayHeadless = found !== null && mode === 'headless' && headlessReady && channel?.alive === true && pending;
    if (stayHeadless && !unsavedNoted) {
      unsavedNoted = true;
      pendingNote = UNSAVED_STAY_NOTE;
      log('the app is open, but the planner without the app has changes that are not written yet; staying without the app');
    }
    let appFailure: ProxyFailure = { kind: 'no-app' };
    if (found !== null && !stayHeadless) {
      if (app === null || app.key !== found.key) {
        app = found;
        appConnected = false;
        sessionId = null;
        resumeSession = null;
      }
      if (!appConnected && resumeSession !== null) {
        sessionId = resumeSession;
        const ping = await postApp({ jsonrpc: '2.0', id: `ops-mcpb-ping-${++internalId}`, method: 'ping' }, true);
        if (ping.type === 'ok') {
          appConnected = true;
          resumeSession = null;
          log(`the session with the app on port ${found.port} is still valid; continuing`);
        } else {
          if (ping.type === 'session-lost') resumeSession = null;
          sessionId = null;
        }
      }
      const failure = appConnected ? null : await connectApp();
      if (failure === null) {
        await enter('app');
        return 'app';
      }
      if (failure.kind === 'timeout') return failure;
      appFailure = failure;
      log(`${appFailureMessage(failure, found.port)} Working without the app.`);
    }
    if (!headlessReady) {
      const started = await connectHeadless();
      if ('failure' in started) {
        return { kind: 'headless', message: offlineMessage(started.failure, appFailure, found?.port ?? null) };
      }
    }
    await enter('headless');
    return 'headless';
  }

  const reply = (id: Id, result: Json) => send({ jsonrpc: '2.0', id, result } as JSONRPCMessage);
  const replyError = (id: Id, message: string, code = -32000) =>
    send({ jsonrpc: '2.0', id, error: { code, message } } as JSONRPCMessage);
  const toolError = (id: Id, text: string) => reply(id, { content: [{ type: 'text', text }], isError: true });

  async function answerOffline(id: Id, method: string, failure: ProxyFailure): Promise<void> {
    const message = appFailureMessage(failure, app?.port ?? null);
    if (method === 'tools/list') {
      toolsShown = 'status';
      await reply(id, { tools: [STATUS_TOOL] });
      return;
    }
    if (method === 'tools/call') await toolError(id, message);
    else if (method === 'ping') await reply(id, {});
    else await replyError(id, message);
    if (failure.kind !== 'timeout') await markOffline();
  }

  function rememberTools(json: unknown): void {
    if (!isObject(json) || !isObject(json.result) || !Array.isArray(json.result.tools)) return;
    readOnlyTools.clear();
    for (const tool of json.result.tools) {
      if (isObject(tool) && typeof tool.name === 'string' && isObject(tool.annotations) && tool.annotations.readOnlyHint === true) {
        readOnlyTools.add(tool.name);
      }
    }
  }

  const succeeded = (result: Json) => result.isError !== true
    && !(isObject(result.structuredContent) && result.structuredContent.ok === false);

  const changesDocument = (toolName: string | null): toolName is string => toolName !== null
    && !readOnlyTools.has(toolName) && !DOCUMENT_RECOVERY_TOOLS.has(toolName) && toolName !== EXPORT_TOOL;

  function activeDocument(result: Json): string | null {
    const envelope = isObject(result.structuredContent) && isObject(result.structuredContent.envelope)
      ? result.structuredContent.envelope : null;
    return envelope && typeof envelope.activeDocumentId === 'string' ? envelope.activeDocumentId : null;
  }

  function trackUnsaved(toolName: string, result: Json): void {
    if (!succeeded(result)) return;
    const docId = activeDocument(result) ?? '(unknown)';
    if (toolName === EXPORT_TOOL) unsaved.delete(docId);
    else if (changesDocument(toolName)) unsaved.add(docId);
  }

  async function resolveUncertain(): Promise<void> {
    const check = await (channel as HeadlessChannel).request({
      jsonrpc: '2.0', id: `ops-mcpb-check-${++internalId}`, method: 'tools/call',
      params: { name: 'planner_list_documents', arguments: {} },
    }, timeoutMs);
    const result = check.type === 'reply' && isObject(check.json) && isObject(check.json.result) ? check.json.result : null;
    const docId = result ? activeDocument(result) : null;
    if (docId === null) return;
    unsaved.add(docId);
    uncertainChange = false;
    log(`the change without an answer counts as not written for document ${docId}`);
  }

  async function forwardReply(id: Id, method: string, toolName: string | null, json: unknown, status: number): Promise<void> {
    if (Array.isArray(json)) {
      for (const item of json) await send(item as JSONRPCMessage);
      return;
    }
    if (!isObject(json)) {
      await replyError(id, `Open Planner Studio gave an empty answer (HTTP ${status}).`, -32603);
      return;
    }
    if (json.id === null || json.id === undefined) json.id = id;
    const result = isObject(json.result) ? json.result : null;
    if (method === 'initialize' && result) {
      const capabilities = isObject(result.capabilities) ? result.capabilities : {};
      const tools = isObject(capabilities.tools) ? capabilities.tools : {};
      result.capabilities = { ...capabilities, tools: { ...tools, listChanged: true } };
      if (typeof result.instructions === 'string') result.instructions += bundleInstructions(root);
    }
    if (method === 'tools/list' && result) {
      rememberTools(json);
      toolsShown = 'planner';
    }
    if (method === 'tools/call' && result && toolName !== null) {
      if (mode === 'headless') trackUnsaved(toolName, result);
      if (blocked !== null && DOCUMENT_RECOVERY_TOOLS.has(toolName) && succeeded(result)) {
        blocked = null;
        log(`document chosen with ${toolName}; changes are allowed again`);
      }
      if (pendingNote !== null && Array.isArray(result.content)) {
        result.content = [{ type: 'text', text: pendingNote }, ...result.content];
        pendingNote = null;
      }
    }
    await send(json as JSONRPCMessage);
  }

  async function refuseBlocked(id: Id): Promise<void> {
    await toolError(id, blocked as string);
    pendingNote = null;
  }

  async function handleStatusTool(id: Id): Promise<void> {
    if (mode === 'app' && appConnected) {
      const ping = await postApp({ jsonrpc: '2.0', id: `ops-mcpb-ping-${++internalId}`, method: 'ping' }, true);
      if (ping.type !== 'ok') {
        appConnected = false;
        if (ping.type === 'fail' && ping.failure.kind !== 'token') resumeSession = sessionId;
      }
    }
    const selected = await selectBackend();
    if (typeof selected !== 'string') {
      await toolError(id, appFailureMessage(selected, app?.port ?? null));
      if (selected.kind !== 'timeout') await markOffline();
      return;
    }
    const where = selected === 'app'
      ? `the Open Planner Studio app (version ${app?.appVersion}) on port ${app?.port}`
      : `the planner without the app, in ${inFolder(root)}`;
    await reply(id, {
      content: [{ type: 'text', text: `Connected to ${where}. The planner_ tools are available; ask for the tool list again if you do not see them.` }],
    });
    await markOnline();
  }

  async function handleInitialize(id: Id, params: Json): Promise<void> {
    clientInitParams = params;
    toolsShown = null;
    blocked = null;
    pendingNote = null;
    mode = null;
    appConnected = false;
    sessionId = null;
    resumeSession = null;
    await closeHeadless();
    let appFailure: ProxyFailure = { kind: 'no-app' };
    const found = opts.findApp();
    if (found !== null) {
      app = found;
      const result = await postApp({ jsonrpc: '2.0', id, method: 'initialize', params }, false);
      const failure = adoptInitialize(result);
      if (failure === null && result.type === 'ok') {
        await enter('app');
        await forwardReply(id, 'initialize', null, result.json, result.status);
        return;
      }
      appFailure = failure ?? { kind: 'refused', message: 'no valid initialize answer' };
      log(`${appFailureMessage(appFailure, found.port)}${appFailure.kind === 'timeout' ? '' : ' Working without the app.'}`);
    }
    let message: string;
    if (appFailure.kind === 'timeout') {
      message = appFailureMessage(appFailure, found?.port ?? null);
    } else {
      const started = await connectHeadless(id);
      if ('json' in started) {
        await enter('headless');
        await forwardReply(id, 'initialize', null, started.json, 200);
        return;
      }
      message = offlineMessage(started.failure, appFailure, found?.port ?? null);
    }
    log(`not connected: ${message}`);
    await reply(id, {
      protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : FALLBACK_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: 'open-planner-studio', version: opts.version },
      instructions: `Open Planner Studio is not available yet. ${message} `
        + `When the user has fixed this, call ${STATUS_TOOL_NAME}; the planner_ tools then appear.`,
    });
  }

  async function viaApp(id: Id, method: string, toolName: string | null, mutates: boolean, message: Json): Promise<'done' | 'retry'> {
    queuedIds.delete(id);
    let result = await postApp(message, true);
    if (result.type === 'session-lost') {
      queuedIds.add(id);
      const failure = await connectApp();
      if (cancelledIds.has(id)) return 'done';
      if (failure) {
        if (failure.kind === 'timeout') await answerOffline(id, method, failure);
        else if (mutates) await toolError(id, SESSION_RESET_MESSAGE);
        else return 'retry';
        return 'done';
      }
      if (mutates) {
        await toolError(id, SESSION_RESET_MESSAGE);
        return 'done';
      }
      queuedIds.delete(id);
      result = await postApp(message, true);
      if (result.type === 'session-lost') {
        await answerOffline(id, method, { kind: 'refused', message: 'the new session was refused right away; try again' });
        return 'done';
      }
    }
    if (result.type === 'fail') {
      if (result.failure.kind === 'timeout') {
        await answerOffline(id, method, result.failure);
        return 'done';
      }
      appConnected = false;
      if (result.failure.kind !== 'token') resumeSession = sessionId;
      if (mutates && ((result.failure.kind === 'unreachable' && result.failure.maybeDelivered) || result.failure.kind === 'http')) {
        log(`${appFailureMessage(result.failure, app?.port ?? null)} The change may have been carried out; not sending it again.`);
        await toolError(id, UNKNOWN_OUTCOME_MESSAGE);
        return 'done';
      }
      log(`${appFailureMessage(result.failure, app?.port ?? null)} Choosing again.`);
      return 'retry';
    }
    await forwardReply(id, method, toolName, result.json, result.status);
    await markOnline();
    return 'done';
  }

  async function viaHeadless(id: Id, method: string, toolName: string | null, message: Json): Promise<void> {
    if (uncertainChange) {
      await resolveUncertain();
      if (cancelledIds.has(id)) return;
      if (uncertainChange && toolName !== null && !readOnlyTools.has(toolName)) {
        await toolError(id, HEADLESS_BUSY_MESSAGE);
        return;
      }
    }
    queuedIds.delete(id);
    const result = await (channel as HeadlessChannel).request(message, timeoutMs);
    if (result.type === 'exited') {
      headlessReady = false;
      blocked = headlessLostMessage(root, result.detail);
      log(`the planner without the app ended unexpectedly: ${result.detail}`);
      if (method === 'tools/call') await toolError(id, blocked);
      else await replyError(id, blocked);
      return;
    }
    if (result.type === 'timeout') {
      if (changesDocument(toolName)) {
        uncertainChange = true;
        log(`no answer in time to ${toolName}; the planner without the app counts as having changes that are not written`);
      }
      const text = `The planner without the app did not answer within ${Math.round(timeoutMs / 1000)} seconds. `
        + 'It is not known whether the request was carried out. Read the plan again before you retry a change.';
      if (method === 'tools/call') await toolError(id, text);
      else await replyError(id, text);
      return;
    }
    if (result.type === 'none') {
      await replyError(id, 'The planner without the app gave no answer.', -32603);
      return;
    }
    await forwardReply(id, method, toolName, result.json, 200);
    await markOnline();
  }

  async function handleRequest(id: Id, method: string, message: Json): Promise<void> {
    if (method === 'initialize') {
      await handleInitialize(id, isObject(message.params) ? message.params : {});
      return;
    }
    const params = isObject(message.params) ? message.params : {};
    const toolName = method === 'tools/call' && typeof params.name === 'string' ? params.name : null;
    if (toolName === STATUS_TOOL_NAME) {
      await handleStatusTool(id);
      return;
    }
    const mutates = toolName !== null && !readOnlyTools.has(toolName) && toolName !== DOCUMENT_CHOICE_TOOL;
    const refuses = () => mutates && blocked !== null && !DOCUMENT_RECOVERY_TOOLS.has(toolName as string);
    if (refuses()) {
      await refuseBlocked(id);
      return;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const selected = await selectBackend();
      if (cancelledIds.has(id)) return;
      if (typeof selected !== 'string') {
        await answerOffline(id, method, selected);
        return;
      }
      if (refuses()) {
        await refuseBlocked(id);
        return;
      }
      if (selected === 'headless') {
        await viaHeadless(id, method, toolName, message);
        return;
      }
      if (await viaApp(id, method, toolName, mutates, message) === 'done') return;
    }
    await answerOffline(id, method, { kind: 'refused', message: 'the connection changed twice during this request; try again' });
  }

  async function handleNotification(message: Json): Promise<void> {
    if (message.method === 'notifications/cancelled' && isObject(message.params) && isId(message.params.requestId)
      && cancelledIds.delete(message.params.requestId)) {
      return;
    }
    if (mode === 'headless' && headlessReady && channel !== null) {
      await channel.request(message, timeoutMs);
      return;
    }
    if (mode !== 'app' || !appConnected) return;
    const result = await postApp(message, true);
    if (result.type === 'session-lost') await connectApp();
  }

  async function processMessage(message: JSONRPCMessage): Promise<void> {
    const raw = message as unknown as Json;
    const method = typeof raw.method === 'string' ? raw.method : null;
    if (method !== null && isId(raw.id)) {
      const id = raw.id;
      try {
        if (cancelledIds.has(id)) {
          log(`request ${String(id)} was cancelled before it was sent; dropped`);
          return;
        }
        await handleRequest(id, method, raw);
      } finally {
        queuedIds.delete(id);
      }
    } else if (method !== null) {
      await handleNotification(raw);
    }
  }

  return {
    handle(message) {
      const raw = message as unknown as Json;
      if (raw.method === 'notifications/cancelled' && isObject(raw.params) && isId(raw.params.requestId)
        && queuedIds.has(raw.params.requestId)) {
        cancelledIds.add(raw.params.requestId);
      }
      if (typeof raw.method === 'string' && isId(raw.id)) {
        queuedIds.add(raw.id);
        cancelledIds.delete(raw.id);
      }
      const next = queue.then(() => processMessage(message)).catch(async (error: unknown) => {
        log(`error while handling a message: ${describeError(error)}`);
        if (isId(raw.id) && typeof raw.method === 'string' && !cancelledIds.has(raw.id)) {
          await replyError(raw.id, `Internal error in the Open Planner Studio extension: ${describeError(error)}`, -32603)
            .catch(() => {});
        }
      });
      queue = next;
      return next;
    },
    close: closeHeadless,
  };
}
