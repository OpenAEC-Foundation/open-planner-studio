import { record as recordActivity, capField } from './activityLog';
import type { ActivityEntry, McpContext } from './contracts';

export interface RequestHandlerDeps {
  emit: (event: string, payload: unknown) => void | Promise<void>;
  buildContext: () => McpContext;
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
  now?: () => number;
  newSessionId?: () => string;
  sessions?: McpSessionTable;
}

export interface McpRequestEvent {
  id: number;
  body: string;
  sessionId?: string | null;
}

export interface McpResponseEvent {
  id: number;
  body: string;
  sessionId?: string;
  status?: number;
}

export const MCP_MAX_SESSIONS = 32;

export interface McpSessionTable {
  has(id: string): boolean;
  anchor(id: string): string | null;
  setAnchor(id: string, anchor: string | null): void;
  canOpen(): boolean;
  open(): string | null;
  clear(): void;
  size(): number;
}

export function createMcpSessionTable(
  newSessionId: () => string = randomSessionId,
  max: number = MCP_MAX_SESSIONS,
): McpSessionTable {
  const anchors = new Map<string, string | null>();
  const oldestUnanchored = (): string | undefined => {
    for (const [id, anchor] of anchors) if (anchor === null) return id;
    return undefined;
  };
  return {
    has: (id) => anchors.has(id),
    anchor: (id) => anchors.get(id) ?? null,
    setAnchor: (id, anchor) => { if (anchors.has(id)) anchors.set(id, anchor); },
    canOpen: () => anchors.size < max || oldestUnanchored() !== undefined,
    open: () => {
      if (anchors.size >= max) {
        const victim = oldestUnanchored();
        if (victim === undefined) return null;
        anchors.delete(victim);
      }
      const id = newSessionId();
      anchors.set(id, null);
      return id;
    },
    clear: () => { anchors.clear(); },
    size: () => anchors.size,
  };
}

function randomSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export const MCP_QUEUE_DEADLINE_MS = 110_000;

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) return `${v.length} ${k}`;
  }
  const keys = Object.keys(obj);
  return keys.length ? keys.join(', ') : '';
}

function extractToolError(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  const content = r.content;
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c && typeof c === 'object' && typeof (c as any).text === 'string') return (c as any).text;
    }
  }
  return undefined;
}

function recordRequestActivity(reqBody: string, respBody: string, durationMs: number): void {
  if (!respBody) return;
  try {
    let method = '?';
    let tool = '?';
    let argsJson = '';
    let summary = '';
    let summaryKind: ActivityEntry['summaryKind'];
    try {
      const req = JSON.parse(reqBody) as { method?: unknown; params?: any };
      method = typeof req.method === 'string' ? req.method : '?';
      if (method === 'tools/call' && req.params && typeof req.params === 'object') {
        tool = typeof req.params.name === 'string' ? req.params.name : '?';
        const args = req.params.arguments ?? {};
        argsJson = JSON.stringify(args);
        const argsSummary = summarizeArgs(args);
        summary = argsSummary ? `${tool}: ${argsSummary}` : tool;
      } else {
        tool = method;
        argsJson = req.params !== undefined ? JSON.stringify(req.params) : '';
        summary = method;
      }
    } catch {
      summary = 'Unparseable request';
      summaryKind = 'unparseableRequest';
    }

    let ok = true;
    let error: string | undefined;
    let errorKind: ActivityEntry['errorKind'];
    try {
      const resp = JSON.parse(respBody) as { error?: any; result?: any };
      if (resp.error) {
        ok = false;
        const code = resp.error.code;
        const msg = typeof resp.error.message === 'string' ? resp.error.message : '';
        error = code != null ? `${code}: ${msg}` : (msg || 'Error');
        if (code == null && !msg) errorKind = 'error';
      } else if (resp.result && resp.result.isError === true) {
        ok = false;
        error = extractToolError(resp.result);
      }
    } catch {
      ok = false;
      error = 'Unparseable response';
      errorKind = 'unparseableResponse';
    }

    const entry: ActivityEntry = {
      ts: Date.now(),
      tool,
      summary,
      ...(summaryKind ? { summaryKind } : {}),
      ...(errorKind ? { errorKind } : {}),
      durationMs,
      ok,
      ...(error ? { error } : {}),
      argsJson: capField(argsJson),
      resultJson: capField(respBody),
    };
    recordActivity(entry);
  } catch {
  }
}

export function createRequestHandler(
  deps: RequestHandlerDeps,
): (payload: McpRequestEvent) => Promise<void> {
  const sessions = deps.sessions ?? createMcpSessionTable(deps.newSessionId ?? randomSessionId);
  let tail: Promise<void> = Promise.resolve();
  const now = deps.now ?? Date.now;
  const handleOne = async (payload: McpRequestEvent, arrivedAt: number): Promise<void> => {
    const isInitialize = requestMethod(payload.body) === 'initialize';
    const incoming = typeof payload.sessionId === 'string' && payload.sessionId !== '' ? payload.sessionId : null;
    let session: string | null = null;
    if (!isInitialize) {
      if (incoming === null) {
        await deps.emit('mcp://response', { id: payload.id, body: missingSessionResponse(payload.body), status: 400 } satisfies McpResponseEvent);
        return;
      }
      if (!sessions.has(incoming)) {
        await deps.emit('mcp://response', { id: payload.id, body: '', status: 404 } satisfies McpResponseEvent);
        return;
      }
      session = incoming;
    } else if (requestHasId(payload.body) && !sessions.canOpen()) {
      const body = sessionsFullResponse(payload.body);
      recordRequestActivity(payload.body, body, 0);
      await deps.emit('mcp://response', { id: payload.id, body } satisfies McpResponseEvent);
      return;
    }
    const ctx = deps.buildContext();
    if (ctx.expectedDocId === null) {
      ctx.expectedDocId = session !== null ? sessions.anchor(session) : null;
    }
    const start = performance.now();
    let body: string;
    try {
      body = now() - arrivedAt >= MCP_QUEUE_DEADLINE_MS
        ? queueTimeoutResponse(payload.body)
        : await deps.handleMessage(payload.body, ctx);
    } catch (error) {
      body = internalErrorResponse(payload.body, error);
    } finally {
      if (session !== null) sessions.setAnchor(session, ctx.expectedDocId);
    }
    const response: McpResponseEvent = { id: payload.id, body };
    if (isInitialize && isResultResponse(body)) {
      const id = sessions.open();
      if (id !== null) {
        response.sessionId = id;
      } else {
        response.body = sessionsFullResponse(payload.body);
      }
    }
    recordRequestActivity(payload.body, body, performance.now() - start);
    await deps.emit('mcp://response', response);
  };
  return (payload) => {
    const arrivedAt = now();
    const run = tail.then(() => handleOne(payload, arrivedAt));
    tail = run.catch((error) => { console.error('MCP: antwoord versturen mislukt:', error); });
    return run;
  };
}

function requestHasId(rawBody: string): boolean {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'id' in parsed;
  } catch { return false; }
}

function sessionsFullResponse(rawBody: string): string {
  let id: unknown = null;
  try { id = (JSON.parse(rawBody) as { id?: unknown }).id ?? null; } catch { }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32000,
      message: `Too many MCP sessions: all ${MCP_MAX_SESSIONS} are bound to a document. Close other MCP connections, or generate a new token in Open Planner Studio (MCP tab) to reset all connections.`,
    },
  });
}

function missingSessionResponse(rawBody: string): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) id = parsed.id ?? null;
  } catch { }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code: -32600, message: 'Bad Request: missing Mcp-Session-Id header; send initialize first and include the session id it returns' },
  });
}

function isResultResponse(rawBody: string): boolean {
  try {
    const parsed = JSON.parse(rawBody) as { result?: unknown; error?: unknown };
    return !!parsed && typeof parsed === 'object' && 'result' in parsed && !('error' in parsed);
  } catch { return false; }
}

function requestMethod(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as { method?: unknown };
    return parsed && typeof parsed === 'object' && typeof parsed.method === 'string' ? parsed.method : null;
  } catch { return null; }
}

function queueTimeoutResponse(rawBody: string): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('id' in parsed)) return '';
    id = (parsed as { id?: unknown })?.id ?? null;
  } catch { }
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32001, message: 'timeout: not executed, waited too long in the queue' } });
}

function internalErrorResponse(rawBody: string, error: unknown): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !('id' in parsed)) return '';
    id = parsed?.id ?? null;
  } catch { }
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: `Internal error: ${message}` } });
}
