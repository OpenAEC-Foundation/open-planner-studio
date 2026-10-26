// MCP-requestafhandeling — sessies, wachtrij en activiteitenlog, los van de app-singleton.
//
// Verplaatst uit `server.ts` (issue #570) zodat de headless MCP-server (`headless/mcp-server/`) dezelfde
// requestlaag gebruikt als de bridge in de app, zonder `appStore.ts`, React of Tauri mee te laden.
// `server.ts` exporteert alles hieronder opnieuw; bestaande imports blijven werken. Het gedrag is
// ongewijzigd: zie de toelichting bij `createRequestHandler`.

import { record as recordActivity, capField } from './activityLog';
import type { ActivityEntry, McpContext } from './contracts';

// --- Request-handler (injecteerbaar → headless testbaar) -----------------------------------------

export interface RequestHandlerDeps {
  /** Emit-functie (echt: Tauri `emit`); ontvangt het event + payload. */
  emit: (event: string, payload: unknown) => void | Promise<void>;
  /** Bouwt de per-request ctx (echt: `buildMcpContext`). */
  buildContext: () => McpContext;
  /** Verwerkt de rauwe JSON-RPC-body (echt: `handleMcpMessage`). */
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
  /** Klok in ms (test-injectie; echt: `Date.now`). */
  now?: () => number;
  /** Nieuwe sessie-id (test-injectie; echt: 16 crypto-random bytes, hex). Alleen gebruikt als
   *  `sessions` ontbreekt. */
  newSessionId?: () => string;
  /** De sessietabel. Echt: één per app-sessie (`appMcpSessions`, via de bridge-controller), zodat een
   *  bridge-herstart sessies en ankers behoudt. Ontbreekt hij, dan krijgt deze handler een eigen tabel. */
  sessions?: McpSessionTable;
}

/** Eén request zoals Rust het doorgeeft: de body plus de `Mcp-Session-Id`-header als die er was. */
export interface McpRequestEvent {
  id: number;
  body: string;
  sessionId?: string | null;
}

/** Het antwoord terug naar Rust. `sessionId` ⇒ Rust zet de `Mcp-Session-Id`-header; `status` ⇒ Rust
 *  antwoordt met die HTTP-status in plaats van 200: `400` (sessie-header ontbreekt, met JSON-RPC-fout als
 *  body) of `404` (onbekende sessie, zonder body). */
export interface McpResponseEvent {
  id: number;
  body: string;
  sessionId?: string;
  status?: number;
}

/**
 * Zoveel MCP-sessies (elk met een eigen drift-anker) onthoudt de app. Een nieuwe sessie boven die grens
 * verdringt de oudste sessie ZONDER anker (die heeft geen binding te verliezen; de client krijgt `404` en
 * begint opnieuw). Een sessie MET anker wordt nooit verdrongen: anders landde de mutatie van een client die
 * net `DOC_DRIFT` kreeg na zijn nieuwe `initialize` stil op het andere tabblad (review 3 PR #439). Zijn alle
 * plekken bezet door sessies met anker, dan weigert de app een nieuwe `initialize` met een JSON-RPC-fout.
 * 32 is ruim boven wat een gebruiker tegelijk koppelt (één tot een paar AI-clients).
 */
export const MCP_MAX_SESSIONS = 32;

/** De sessietabel: sessie-id → drift-anker (`null` = nog niet gebonden). */
export interface McpSessionTable {
  has(id: string): boolean;
  anchor(id: string): string | null;
  setAnchor(id: string, anchor: string | null): void;
  /** Is er plek voor een nieuwe sessie (eventueel door een sessie zonder anker te verdringen)? */
  canOpen(): boolean;
  /** Open een nieuwe sessie; verdringt zo nodig de oudste sessie zonder anker. `null` = vol. */
  open(): string | null;
  /** Alle sessies weg (nieuw token: oude koppelingen gelden niet meer). */
  clear(): void;
  size(): number;
}

export function createMcpSessionTable(
  newSessionId: () => string = randomSessionId,
  max: number = MCP_MAX_SESSIONS,
): McpSessionTable {
  // Map-volgorde = volgorde van openen; de oudste sessie zonder anker gaat eerst.
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

/**
 * Hoe lang een request in de wachtrij mag staan voordat het NIET meer wordt uitgevoerd. Rust geeft
 * na `RESPONSE_TIMEOUT` (120 s, `mcp_bridge.rs`) de client al een 504; een daarna alsnog uitgevoerde
 * mutatie zou de client als mislukt zien en bij een retry dubbel landen. De marge (10 s) dekt de
 * tijd tussen Rusts klok-start en de aankomst van het event hier: liever een request te veel
 * weigeren (niet uitgevoerd + fout = consistent) dan er een te veel uitvoeren.
 */
export const MCP_QUEUE_DEADLINE_MS = 110_000;

// --- Activiteits-samenvatting --------------------------------------------------------------------

/**
 * Vat de args van een `tools/call` compact samen voor het activiteitenpaneel: het eerste array-veld
 * wordt "N <veld>" (bijv. "42 tasks"); ontbreekt dat, dan de veldnamen; lege args → "". Bewust géén
 * i18n (de samenvatting is opgeslagen data, geen UI-string) en bewust generiek (geen per-tool-kennis
 * — dit blijft correct als er nieuwe tools bijkomen).
 */
function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) return `${v.length} ${k}`;
  }
  const keys = Object.keys(obj);
  return keys.length ? keys.join(', ') : '';
}

/** Best-effort foutmelding uit een MCP-tool-fout-respons (result.isError) — content-tekst of niets. */
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

/**
 * Parse request- + respons-body licht (try/catch) en `record` één `ActivityEntry`: tijdstip, tool/
 * methode, compacte samenvatting, duur, ok/fout (+ evt. foutcode), en de volledige args/result-JSON
 * (afgekapt op 20 kB per veld). Notificaties (lege respons-body) worden NIET gelogd — het paneel toont
 * request/respons-paren, geen fire-and-forget-notificaties. Nooit gooien: het log mag de bridge niet
 * kunnen breken.
 */
function recordRequestActivity(reqBody: string, respBody: string, durationMs: number): void {
  // Notificatie ⇒ geen respons-body ⇒ niet loggen.
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
      // Onparseerbaar antwoord: markeer als fout zodat het in het paneel opvalt.
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
    /* het activiteitenlog mag de request-flow nooit kunnen breken */
  }
}

/**
 * Maak de `mcp://request`-handler. Elk request draait door de dispatcher; het antwoord gaat 1-op-1
 * terug als `mcp://response` met HETZELFDE Rust-correlatie-id. Óók een notificatie (lege respons-
 * body) wordt geëmit — de Rust-loop correleert op id en wacht altijd op een antwoord, dus een
 * uitgebleven emit zou daar in een timeout lopen.
 *
 * SESSIES (MCP streamable HTTP, `Mcp-Session-Id`; reviewrondes 1 en 2 van PR #439). Elke geslaagde
 * `initialize` krijgt een nieuwe sessie-id; Rust zet die als header op het antwoord en geeft de header van
 * latere requests door. Het drift-anker hoort bij de sessie en bij niets anders:
 *   - ELK request behalve `initialize` moet een bekende sessie-id dragen, ook leesrequests, pings en
 *     notificaties. Ontbreekt de header: `400` met een JSON-RPC-fout (de spec: "Servers that require a
 *     session ID SHOULD respond to requests without an Mcp-Session-Id header (other than initialization)
 *     with HTTP 400 Bad Request"). Onbekend (verdrongen zonder anker, na een nieuw token of na een herstart
 *     van de app): `404` zonder body, waarna de client volgens de spec opnieuw initialiseert. Eén regel voor alles is het
 *     eenvoudigste dat spec-conform is: er bestaat geen pad meer waarlangs een request zonder sessie
 *     een tool draait, dus ook geen gedeeld anker dat een ander kan wissen.
 *   - Een `initialize` raakt nooit het anker van een andere sessie; een `initialize` zonder `id` is een
 *     notificatie, maakt geen sessie en raakt niets.
 * De sessietabel zit hier en niet in Rust: alleen deze laag weet of een antwoord een geslaagde
 * `initialize` is, en Rust blijft zo protocol-onwetend.
 */
export function createRequestHandler(
  deps: RequestHandlerDeps,
): (payload: McpRequestEvent) => Promise<void> {
  // Het drift-anker leeft per VERBINDING (= per handler, dus per bridge-start), niet per request:
  // `buildContext` levert elk request een verse ctx met `expectedDocId: null`. Zonder deze overdracht
  // bond elke eerste mutatie van ieder request opnieuw aan het dán actieve document, zodat een
  // user-tabwissel tussen twee AI-calls nooit `DOC_DRIFT` gaf en de mutatie stil op het andere
  // tabblad landde; ook het verzetten door `switch_document`/`new_document`/`duplicate_document`/
  // `import_schedule` ging met de weggegooide ctx verloren. `tempIdMap` blijft bewust per request
  // (batch-only, de batch-executor bezit hem).
  // Anker per sessie, in een tabel die (in de app) langer leeft dan deze handler.
  const sessions = deps.sessions ?? createMcpSessionTable(deps.newSessionId ?? randomSessionId);
  // Requests strikt NA elkaar (audit 2026-09-26). Rust houdt één request tegelijk in de lucht, maar
  // geeft dat slot na zijn time-out (120 s) vrij terwijl de webview nog aan het oude request werkt;
  // zonder deze keten liep het volgende request (vaak een retry van dezelfde import) bij elke await
  // door het oude heen. De keten voorkomt dat verweven; een request dat al door Rust is opgegeven
  // slaat hij over (`MCP_QUEUE_DEADLINE_MS`). Een retry die pas NA die grens binnenkomt is voor ons
  // een nieuw request: een import opent dan wel een tweede tabblad (geen ontdubbeling op pad).
  let tail: Promise<void> = Promise.resolve();
  const now = deps.now ?? Date.now;
  const handleOne = async (payload: McpRequestEvent, arrivedAt: number): Promise<void> => {
    const isInitialize = requestMethod(payload.body) === 'initialize';
    const incoming = typeof payload.sessionId === 'string' && payload.sessionId !== '' ? payload.sessionId : null;
    // Een nieuwe MCP-sessie (`initialize`) begint zonder anker: anders erfde een herstarte client
    // de documentbinding van de vorige en kreeg hij DOC_DRIFT op een tabblad dat hij nooit zag.
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
      // Vol met gebonden sessies: niet stil verdringen, maar deze initialize weigeren.
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
      // Vangnet buiten de dispatcher-crashbarrière (bv. een niet-serialiseerbaar resultaat): altijd
      // een JSON-RPC-fout terugsturen, anders wacht de client tot de Rust-time-out.
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
        // Kan alleen als de tabel tussen de controle en hier volliep (requests lopen serieel, dus niet in
        // de praktijk); dan liever een fout dan een initialize zonder sessie.
        response.body = sessionsFullResponse(payload.body);
      }
    }
    // Leg de aanroep vast in het activiteitenlog (notificaties = lege body worden overgeslagen).
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

/** Heeft dit JSON-RPC-bericht een `id` (een request, geen notificatie)? */
function requestHasId(rawBody: string): boolean {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'id' in parsed;
  } catch { return false; }
}

/** JSON-RPC-fout voor een `initialize` terwijl alle sessieplekken bezet zijn door gebonden sessies. */
function sessionsFullResponse(rawBody: string): string {
  let id: unknown = null;
  try { id = (JSON.parse(rawBody) as { id?: unknown }).id ?? null; } catch { /* id null */ }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32000,
      message: `Too many MCP sessions: all ${MCP_MAX_SESSIONS} are bound to a document. Close other MCP connections, or generate a new token in Open Planner Studio (MCP tab) to reset all connections.`,
    },
  });
}

/** JSON-RPC-fout bij een request zonder `Mcp-Session-Id` (HTTP 400). */
function missingSessionResponse(rawBody: string): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) id = parsed.id ?? null;
  } catch { /* onparseerbaar ⇒ id null */ }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code: -32600, message: 'Bad Request: missing Mcp-Session-Id header; send initialize first and include the session id it returns' },
  });
}

/** Is dit een geslaagd JSON-RPC-antwoord (met `result`, zonder `error`)? */
function isResultResponse(rawBody: string): boolean {
  try {
    const parsed = JSON.parse(rawBody) as { result?: unknown; error?: unknown };
    return !!parsed && typeof parsed === 'object' && 'result' in parsed && !('error' in parsed);
  } catch { return false; }
}

/** De `method` van een enkel JSON-RPC-request, of null (batch-array, onparseerbaar). */
function requestMethod(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as { method?: unknown };
    return parsed && typeof parsed === 'object' && typeof parsed.method === 'string' ? parsed.method : null;
  } catch { return null; }
}

/** Antwoord voor een request dat te lang in de wachtrij stond en daarom niet is uitgevoerd: dezelfde
 *  `-32001 timeout` als Rust geeft. Een notificatie krijgt een lege body. */
function queueTimeoutResponse(rawBody: string): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('id' in parsed)) return '';
    id = (parsed as { id?: unknown })?.id ?? null;
  } catch { /* onparseerbaar ⇒ id null */ }
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32001, message: 'timeout: not executed, waited too long in the queue' } });
}

/** JSON-RPC `-32603 Internal error` voor een request waarvan de verwerking zelf wierp. Een
 *  notificatie (geen `id`) krijgt, zoals altijd, een lege body. */
function internalErrorResponse(rawBody: string, error: unknown): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !('id' in parsed)) return '';
    id = parsed?.id ?? null;
  } catch { /* onparseerbaar ⇒ id null */ }
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: `Internal error: ${message}` } });
}
